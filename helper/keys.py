#!/usr/bin/env python3
"""Wobbly Volley key helper for Linux (PLAN.md 6.12).

It looks at the state of exactly four keys (A, D, W, Esc) and writes to
stdout:
  K <mask> <unix ms>   once per change; bit 0 left, 1 right, 2 jump, 3 esc, 4 terminal in front
                       (PLAN.md 6.10); 0 while another window is in front
  H <unix ms>          a heartbeat every 500 ms; the first line, once the helper is ready
  E <word>             once, when it cannot work; then it exits
Diagnostics go to stderr. It looks at no other key, stores nothing and opens no connection. It
exits when its parent process is gone or a write to stdout fails.

Two ways to read the keys:
  x11    an X11 session: XQueryKeymap, and only while the window of the terminal that runs
         Claude Code is in front (_NET_ACTIVE_WINDOW against the terminal's process)
  evdev  a Wayland session, for a user in the `input` group: the key state of the keyboards under
         /dev/input. Wayland tells no program which window is in front, so bit 4 is always set,
         and the mod's 150 ms rule (PLAN.md 6.8) is the only guard.
Started by the mod as `python3 keys.py`. Run it bare in a terminal to watch its lines;
`--backend x11` or `--backend evdev` overrides the choice. Python 3.7 or later, no packages.
"""

import ctypes
import ctypes.util
import fcntl
import glob
import os
import sys
import time

LEFT, RIGHT, JUMP, ESC, FRONT = 1, 2, 4, 8, 16


def now_ms():
    return time.time_ns() // 1_000_000


def emit(line):
    os.write(1, (line + '\n').encode('ascii'))


def note(text):
    sys.stderr.write(text + '\n')
    sys.stderr.flush()


def fail(word, text):
    note(text)
    try:
        emit('E ' + word)
    except OSError:
        pass
    sys.exit(1)


def parent_of(pid):
    try:
        with open('/proc/%d/stat' % pid, 'rb') as f:
            stat = f.read()
    except OSError:
        return 0
    # The command name sits in parentheses and may hold spaces: the fields follow the last one.
    return int(stat[stat.rindex(b')') + 2:].split()[1])


def name_of(pid):
    try:
        with open('/proc/%d/comm' % pid) as f:
            return f.read().strip()
    except OSError:
        return '?'


def ancestors():
    chain = []
    pid = os.getpid()
    for _ in range(32):
        pid = parent_of(pid)
        if pid <= 1:
            break
        chain.append(pid)
    return chain


class X11:
    # Keysyms: a, d, w, Escape.
    KEYSYMS = {LEFT: (0x61,), RIGHT: (0x64,), JUMP: (0x77,), ESC: (0xFF1B,)}
    ANY_TYPE = 0

    def __init__(self):
        c = ctypes
        x = c.CDLL(c.util.find_library('X11') or 'libX11.so.6')
        x.XOpenDisplay.restype = c.c_void_p
        x.XOpenDisplay.argtypes = [c.c_char_p]
        x.XDefaultRootWindow.restype = c.c_ulong
        x.XDefaultRootWindow.argtypes = [c.c_void_p]
        x.XInternAtom.restype = c.c_ulong
        x.XInternAtom.argtypes = [c.c_void_p, c.c_char_p, c.c_int]
        x.XKeysymToKeycode.restype = c.c_ubyte
        x.XKeysymToKeycode.argtypes = [c.c_void_p, c.c_ulong]
        x.XQueryKeymap.argtypes = [c.c_void_p, c.c_char * 32]
        x.XGetWindowProperty.argtypes = [
            c.c_void_p, c.c_ulong, c.c_ulong, c.c_long, c.c_long, c.c_int, c.c_ulong,
            c.POINTER(c.c_ulong), c.POINTER(c.c_int), c.POINTER(c.c_ulong), c.POINTER(c.c_ulong),
            c.POINTER(c.c_void_p),
        ]
        x.XFree.argtypes = [c.c_void_p]
        # Xlib's own handler ends the process on an error, such as a window that closed meanwhile.
        handler_type = c.CFUNCTYPE(c.c_int, c.c_void_p, c.c_void_p)
        x.XSetErrorHandler.argtypes = [handler_type]
        x.XSetErrorHandler.restype = c.c_void_p
        self.handler = handler_type(lambda display, event: 0)
        x.XSetErrorHandler(self.handler)

        self.x = x
        self.display = x.XOpenDisplay(None)
        if not self.display:
            raise RuntimeError('cannot open the X display %r' % os.environ.get('DISPLAY'))
        self.root = x.XDefaultRootWindow(self.display)
        self.active = x.XInternAtom(self.display, b'_NET_ACTIVE_WINDOW', 0)
        self.clients = x.XInternAtom(self.display, b'_NET_CLIENT_LIST', 0)
        self.wm_pid = x.XInternAtom(self.display, b'_NET_WM_PID', 0)
        self.codes = {bit: [x.XKeysymToKeycode(self.display, s) for s in syms] for bit, syms in self.KEYSYMS.items()}
        self.keymap = (c.c_char * 32)()
        self.terminal = 0
        self.front = False
        self.front_at = 0

    def words(self, window, atom):
        """A property of format 32 as a list of numbers; Xlib hands them out as C longs."""
        c = ctypes
        kind, fmt, count, after, data = c.c_ulong(), c.c_int(), c.c_ulong(), c.c_ulong(), c.c_void_p()
        status = self.x.XGetWindowProperty(
            self.display, window, atom, 0, 4096, 0, self.ANY_TYPE,
            c.byref(kind), c.byref(fmt), c.byref(count), c.byref(after), c.byref(data),
        )
        if status != 0 or not data.value:
            return []
        try:
            if fmt.value != 32:
                return []
            items = c.cast(data, c.POINTER(c.c_ulong))
            return [items[i] for i in range(count.value)]
        finally:
            self.x.XFree(data)

    def find_terminal(self, chain):
        """The first process above this one that owns a window: the terminal."""
        owners = set()
        for window in self.words(self.root, self.clients):
            owners.update(self.words(window, self.wm_pid))
        return next((pid for pid in chain if pid in owners), 0)

    def in_front(self):
        windows = self.words(self.root, self.active)
        if not windows or windows[0] == 0:
            return False
        pids = self.words(windows[0], self.wm_pid)
        return bool(pids) and pids[0] == self.terminal

    def read(self, t):
        # The window in front is asked every 20 ms. No key is read while another one is in front.
        if t - self.front_at >= 20:
            self.front = self.in_front()
            self.front_at = t
        if not self.front:
            return 0
        self.x.XQueryKeymap(self.display, self.keymap)
        raw = self.keymap.raw
        mask = FRONT
        for bit, codes in self.codes.items():
            if any(code and raw[code >> 3] & (1 << (code & 7)) for code in codes):
                mask |= bit
        return mask

    def rescan(self):
        pass


class Evdev:
    # Linux key codes: KEY_A, KEY_D, KEY_W, KEY_ESC.
    CODES = {LEFT: (30,), RIGHT: (32,), JUMP: (17,), ESC: (1,)}
    BYTES = 96  # KEY_MAX / 8 + 1
    # _IOC(_IOC_READ, 'E', nr, BYTES): 0x18 is EVIOCGKEY (the key state), 0x21 EVIOCGBIT(EV_KEY).
    GET_STATE = (2 << 30) | (BYTES << 16) | (ord('E') << 8) | 0x18
    GET_KEYS = (2 << 30) | (BYTES << 16) | (ord('E') << 8) | 0x21
    KEY_A = 30

    def __init__(self):
        self.files = {}
        self.denied = 0
        self.rescan()
        if not self.files:
            if self.denied:
                raise PermissionError(
                    'no keyboard under /dev/input is readable (%d refused): this user is not in the '
                    'input group' % self.denied)
            raise RuntimeError('no keyboard found under /dev/input')

    def has(self, bits, code):
        return bits[code >> 3] & (1 << (code & 7))

    def rescan(self):
        """Opens keyboards plugged in since the last scan: devices that have an A key."""
        for path in glob.glob('/dev/input/event*'):
            if path in self.files:
                continue
            try:
                fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
            except PermissionError:
                self.denied += 1
                continue
            except OSError:
                continue
            bits = bytearray(self.BYTES)
            try:
                fcntl.ioctl(fd, self.GET_KEYS, bits)
            except OSError:
                bits = bytearray(self.BYTES)
            if self.has(bits, self.KEY_A):
                self.files[path] = fd
            else:
                os.close(fd)

    def read(self, t):
        mask = FRONT
        state = bytearray(self.BYTES)
        for path, fd in list(self.files.items()):
            try:
                fcntl.ioctl(fd, self.GET_STATE, state)
            except OSError:
                # Unplugged.
                os.close(fd)
                del self.files[path]
                continue
            for bit, codes in self.CODES.items():
                if any(self.has(state, code) for code in codes):
                    mask |= bit
        return mask


def choose(override):
    if override:
        return override
    if os.environ.get('XDG_SESSION_TYPE') == 'wayland' or os.environ.get('WAYLAND_DISPLAY'):
        return 'evdev'
    if os.environ.get('DISPLAY'):
        return 'x11'
    return None


def main(argv):
    started = now_ms()
    override = argv[2] if len(argv) >= 3 and argv[1] == '--backend' else None
    parent = os.getppid()
    chain = ancestors()
    names = ' < '.join('%s:%d' % (name_of(pid), pid) for pid in chain)

    backend = choose(override)
    if backend not in ('x11', 'evdev'):
        fail('nodisplay', 'no X11 or Wayland session here (neither DISPLAY nor WAYLAND_DISPLAY is set): chain ' + names)
    try:
        reader = X11() if backend == 'x11' else Evdev()
    except PermissionError as err:
        fail('noinput', str(err))
    except Exception as err:
        fail('no' + backend, '%s cannot start: %s' % (backend, err))
    if backend == 'x11':
        reader.terminal = reader.find_terminal(chain)
        if not reader.terminal:
            fail('nowindow', 'no process above this one owns a window: chain ' + names)

    note('start pid %d backend %s started %d ready %d terminal %d keyboards %s chain %s' % (
        os.getpid(), backend, started, now_ms(), reader.terminal if backend == 'x11' else 0,
        len(reader.files) if backend == 'evdev' else '-', names))

    last = -1
    beat = 0
    try:
        while True:
            t = now_ms()
            mask = reader.read(t)
            if t >= beat:
                if os.getppid() != parent:
                    return 0
                emit('H %d' % t)
                beat = t + 500
                reader.rescan()
            if mask != last:
                emit('K %d %d' % (mask, t))
                last = mask
            time.sleep(0.002)
    except BrokenPipeError:
        # stdout is closed: nobody reads any more.
        return 0
    except KeyboardInterrupt:
        return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
