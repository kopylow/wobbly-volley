// Wobbly Volley key helper for macOS (PLAN.md 6.12), JavaScript for Automation:
//   osascript -l JavaScript keys.js
//
// It finds the terminal app that runs Claude Code and, while that app is in front, reads the
// state of exactly four keys (A, D, W, Esc) with CGEventSourceKeyState.
// It writes to stdout:
//   K <mask> <unix ms>   once per change; bit 0 left, 1 right, 2 jump, 3 esc, 4 terminal in front
//                        (PLAN.md 6.10); 0 while another app is in front, when no key is read
//   H <unix ms>          a heartbeat every 500 ms; the first line, once the helper is ready
//   E <word>             once, when it cannot work; then it exits
// Diagnostics go to stderr (osascript writes console.log there). It reads no other key, stores
// nothing and opens no connection. It exits when its parent process is gone or a write to stdout
// fails (the closed pipe ends osascript). Run it bare in a terminal to watch its lines.

ObjC.import('Cocoa')
ObjC.import('CoreGraphics')
ObjC.import('stdlib')

const LEFT = 1
const RIGHT = 2
const JUMP = 4
const ESC = 8
const FRONT = 16
// Virtual key codes: A 0, D 2, W 13, Escape 53.
const CODES = [
  [LEFT, [0]],
  [RIGHT, [2]],
  [JUMP, [13]],
  [ESC, [53]],
]
const COMBINED_SESSION_STATE = 0
const REGULAR_APP = 0

const shell = Application.currentApplication()
shell.includeStandardAdditions = true
const stdout = $.NSFileHandle.fileHandleWithStandardOutput

function emit(line) {
  stdout.writeData($(line + '\n').dataUsingEncoding($.NSUTF8StringEncoding))
}

function fail(word, text) {
  console.log(text)
  emit('E ' + word)
  $.exit(1)
}

function parentOf(pid) {
  try {
    return parseInt(shell.doShellScript('ps -o ppid= -p ' + pid).trim(), 10) || 0
  } catch (e) {
    return 0
  }
}

function nameOf(pid) {
  try {
    return shell.doShellScript('ps -o comm= -p ' + pid).trim().split('/').pop()
  } catch (e) {
    return '?'
  }
}

function frontPid() {
  const app = $.NSWorkspace.sharedWorkspace.frontmostApplication
  return app.isNil() ? 0 : app.processIdentifier
}

function readMask(terminal) {
  if (frontPid() !== terminal) return 0
  let mask = FRONT
  for (const [bit, codes] of CODES) {
    if (codes.some(code => $.CGEventSourceKeyState(COMBINED_SESSION_STATE, code))) mask |= bit
  }
  return mask
}

function run() {
  const started = Date.now()
  const self = $.NSProcessInfo.processInfo.processIdentifier
  const parent = parentOf(self)

  // The terminal is the first process above this one that is a regular app.
  let terminal = 0
  const chain = []
  let pid = self
  for (let hop = 0; hop < 32 && terminal === 0; hop++) {
    pid = parentOf(pid)
    if (pid <= 1) break
    chain.push(nameOf(pid) + ':' + pid)
    const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid)
    if (!app.isNil() && app.activationPolicy === REGULAR_APP) terminal = pid
  }
  if (terminal === 0) fail('nowindow', 'no app above this process: chain < ' + chain.join(' < '))
  console.log('start pid ' + self + ' started ' + started + ' ready ' + Date.now() + ' terminal ' + terminal + ' chain < ' + chain.join(' < '))

  // The run loop has to turn for frontmostApplication to follow app switches; a port keeps it
  // from returning at once when nothing else is attached.
  const loop = $.NSRunLoop.currentRunLoop
  loop.addPortForMode($.NSPort.port, $.NSDefaultRunLoopMode)

  let last = -1
  let beat = 0
  let beats = 0
  for (;;) {
    const pool = $.NSAutoreleasePool.alloc.init
    const mask = readMask(terminal)
    const now = Date.now()
    if (now >= beat) {
      // Every fourth heartbeat checks the parent: ps costs a process of its own.
      beats += 1
      if (beats % 4 === 0 && parentOf(self) !== parent) $.exit(0)
      emit('H ' + now)
      beat = now + 500
    }
    if (mask !== last) {
      emit('K ' + mask + ' ' + now)
      last = mask
    }
    loop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.002))
    pool.drain
  }
}
