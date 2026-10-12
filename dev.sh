#!/bin/sh
# Starts Claude Code with Wobbly Volley loaded from this folder (PLAN.md, D12), on Linux and macOS.
#   ./dev.sh                       the mod itself
#   ./dev.sh -Only p4-key-helper   only prototypes/p4-key-helper (two mods drawing the band would hide each other)
# Every other argument goes to claude unchanged, for example: ./dev.sh --debug

dir=$(cd "$(dirname "$0")" && pwd)
plugin=$dir
if [ "$1" = "-Only" ] && [ -n "$2" ]; then
  plugin=$dir/prototypes/$2
  shift 2
fi

if [ ! -f "$plugin/.claude-plugin/plugin.json" ]; then
  echo "No plugin at $plugin" >&2
  exit 1
fi

exec claude --plugin-dir "$plugin" "$@"
