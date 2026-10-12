# Wobbly Volley key helper for Windows, and for WSL through powershell.exe (PLAN.md 6.12).
#
# It finds the terminal window that runs Claude Code and, while that window is in front, reads the
# state of exactly four keys: A, D, W and Esc. It writes to stdout:
#   K <mask> <unix ms>   once per change; bit 0 left, 1 right, 2 jump, 3 esc, 4 terminal in front
#                        (PLAN.md 6.10); 0 while another window is in front, when no key is read
#   H <unix ms>          a heartbeat every 500 ms; the first line, once the helper is ready
#   E <word>             once, when it cannot work; then it exits
# Diagnostics go to stderr. It reads no other key, stores nothing and opens no connection. It exits
# when its parent process is gone or a write to stdout fails.
#
# Started by the mod as
#   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File keys.ps1
# The policy flag applies to that one process. Run it bare in a terminal to watch its lines.

$ErrorActionPreference = 'Stop'
$scriptAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

# C# 5, the language Windows PowerShell 5.1 compiles.
$source = @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class VolleyKeys
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ProcessEntry
    {
        public uint Size;
        public uint Usage;
        public uint ProcessId;
        public IntPtr DefaultHeapId;
        public uint ModuleId;
        public uint Threads;
        public uint ParentProcessId;
        public int PriorityClassBase;
        public uint Flags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string ExeFile;
    }

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("winmm.dll")]
    static extern uint timeBeginPeriod(uint ms);
    [DllImport("winmm.dll")]
    static extern uint timeEndPeriod(uint ms);
    [DllImport("kernel32.dll")]
    static extern void GetSystemTimePreciseAsFileTime(out long fileTime);
    [DllImport("kernel32.dll")]
    static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32FirstW")]
    static extern bool Process32First(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "Process32NextW")]
    static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry entry);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")]
    static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
    [DllImport("kernel32.dll")]
    static extern uint WaitForSingleObject(IntPtr handle, uint ms);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetStdHandle(int which);
    [DllImport("kernel32.dll")]
    static extern uint GetFileType(IntPtr handle);

    const uint Synchronize = 0x00100000;
    const uint SnapshotProcesses = 0x00000002;
    const int StdOutput = -11;
    const uint FileTypeDisk = 1;
    const uint FileTypePipe = 3;

    static Stream output;

    static long Now()
    {
        long fileTime;
        GetSystemTimePreciseAsFileTime(out fileTime);
        return (fileTime - 116444736000000000L) / 10000;
    }

    // A pipe gets a stream of its own, so a write to a closed pipe throws; the console's own
    // stream swallows that error.
    static Stream OpenOutput(out string kind)
    {
        IntPtr handle = GetStdHandle(StdOutput);
        uint type = GetFileType(handle);
        if (type == FileTypePipe || type == FileTypeDisk)
        {
            try
            {
                kind = type == FileTypePipe ? "pipe" : "file";
                return new FileStream(new SafeFileHandle(handle, false), FileAccess.Write, 1);
            }
            catch (Exception)
            {
            }
        }
        kind = "console";
        return Console.OpenStandardOutput();
    }

    static void Emit(string line)
    {
        byte[] bytes = Encoding.ASCII.GetBytes(line + "\n");
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }

    static bool Down(int key)
    {
        return (GetAsyncKeyState(key) & 0x8000) != 0;
    }

    // No key is read while another window is in front.
    static int ReadMask(uint terminal)
    {
        uint front;
        GetWindowThreadProcessId(GetForegroundWindow(), out front);
        if (front != terminal) return 0;
        int mask = 16;
        if (Down(0x41)) mask |= 1;                                // A
        if (Down(0x44)) mask |= 2;                                // D
        if (Down(0x57)) mask |= 4;                                // W
        if (Down(0x1B)) mask |= 8;                                // Esc
        return mask;
    }

    // One snapshot of all processes: a WMI lookup per parent costs about 0.4 s (PLAN.md section 4).
    static Dictionary<uint, ProcessEntry> Processes()
    {
        Dictionary<uint, ProcessEntry> table = new Dictionary<uint, ProcessEntry>();
        IntPtr snapshot = CreateToolhelp32Snapshot(SnapshotProcesses, 0);
        if (snapshot == new IntPtr(-1)) return table;
        try
        {
            ProcessEntry entry = new ProcessEntry();
            entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
            for (bool more = Process32First(snapshot, ref entry); more; more = Process32Next(snapshot, ref entry))
            {
                table[entry.ProcessId] = entry;
            }
        }
        finally
        {
            CloseHandle(snapshot);
        }
        return table;
    }

    static bool HasWindow(uint pid)
    {
        try
        {
            using (Process p = Process.GetProcessById((int)pid))
            {
                return p.MainWindowHandle != IntPtr.Zero;
            }
        }
        catch (Exception)
        {
            return false;
        }
    }

    public static int Run(long scriptAt, long compiledAt)
    {
        string outputKind;
        output = OpenOutput(out outputKind);

        uint self;
        long processAt;
        using (Process me = Process.GetCurrentProcess())
        {
            self = (uint)me.Id;
            processAt = new DateTimeOffset(me.StartTime).ToUnixTimeMilliseconds();
        }

        // The terminal is the first process above this one that has a main window.
        Dictionary<uint, ProcessEntry> table = Processes();
        uint parent = 0;
        uint terminal = 0;
        StringBuilder chain = new StringBuilder();
        uint pid = self;
        for (int hop = 0; hop < 16 && terminal == 0; hop++)
        {
            ProcessEntry entry;
            ProcessEntry above;
            if (!table.TryGetValue(pid, out entry)) break;
            uint up = entry.ParentProcessId;
            if (up == 0 || up == pid || !table.TryGetValue(up, out above)) break;
            if (parent == 0) parent = up;
            chain.Append(" < ").Append(above.ExeFile).Append(':').Append(up);
            if (HasWindow(up)) terminal = up;
            pid = up;
        }
        IntPtr parentHandle = parent == 0 ? IntPtr.Zero : OpenProcess(Synchronize, false, parent);
        long readyAt = Now();

        Console.Error.WriteLine(
            "start pid " + self + " process " + processAt + " script " + scriptAt + " compiled " + compiledAt +
            " ready " + readyAt + " output " + outputKind + " terminal " + terminal + " chain" + chain);

        try
        {
            if (terminal == 0)
            {
                Emit("E nowindow");
                return 1;
            }

            timeBeginPeriod(1);
            try
            {
                int last = -1;
                long beat = 0;
                while (true)
                {
                    int mask = ReadMask(terminal);
                    long now = Now();
                    if (now >= beat)
                    {
                        if (parentHandle != IntPtr.Zero && WaitForSingleObject(parentHandle, 0) == 0) return 0;
                        Emit("H " + now);
                        beat = now + 500;
                    }
                    if (mask != last)
                    {
                        Emit("K " + mask + " " + now);
                        last = mask;
                    }
                    Thread.Sleep(2);
                }
            }
            finally
            {
                timeEndPeriod(1);
            }
        }
        catch (IOException)
        {
            // stdout is closed: nobody reads any more.
            return 0;
        }
    }
}
'@

try {
    if (-not ('VolleyKeys' -as [type])) { Add-Type -TypeDefinition $source }
} catch {
    [Console]::Out.Write("E compile`n")
    [Console]::Error.WriteLine('compile failed: ' + $_.Exception.Message)
    exit 1
}
$compiledAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

try {
    exit ([VolleyKeys]::Run($scriptAt, $compiledAt))
} catch {
    [Console]::Out.Write("E error`n")
    [Console]::Error.WriteLine('failed: ' + $_.Exception.Message)
    exit 1
}
