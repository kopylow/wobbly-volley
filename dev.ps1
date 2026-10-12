# Starts Claude Code with Wobbly Volley loaded from this folder (PLAN.md, D12).
#   .\dev.ps1                  the mod itself
#   .\dev.ps1 -Only p1-band    only prototypes\p1-band (two mods drawing the band would hide each other)
# Every other argument goes to claude unchanged, for example: .\dev.ps1 --debug

$dir = $PSScriptRoot
$rest = @()
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq '-Only' -and $i + 1 -lt $args.Count) {
        $i++
        $dir = Join-Path $PSScriptRoot "prototypes\$($args[$i])"
    } else {
        $rest += $args[$i]
    }
}

if (-not (Test-Path (Join-Path $dir '.claude-plugin\plugin.json'))) {
    Write-Host "No plugin at $dir" -ForegroundColor Red
    exit 1
}

& claude --plugin-dir $dir @rest
exit $LASTEXITCODE
