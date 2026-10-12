# P2 CPU sampler (PLAN.md section 7): the CPU time of the claude.exe this script runs under.
# Prints one line of whole numbers, since this machine's locale writes decimal commas:
#   CPU <cpu ms> <wall ms> <pid>
# or ERR <reason>.
param([int]$Seconds = 10)

$ErrorActionPreference = 'Stop'
try {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
    while ($p -and $p.Name -ne 'claude.exe') {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"
    }
    if (-not $p) {
        'ERR no claude.exe above this process'
        exit 1
    }

    $claude = Get-Process -Id $p.ProcessId
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $before = $claude.TotalProcessorTime.TotalMilliseconds
    Start-Sleep -Seconds $Seconds
    $claude.Refresh()
    $cpu = [int64]($claude.TotalProcessorTime.TotalMilliseconds - $before)
    "CPU $cpu $([int64]$watch.ElapsedMilliseconds) $($p.ProcessId)"
} catch {
    "ERR $($_.Exception.Message)"
    exit 1
}
