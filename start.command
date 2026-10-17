#!/bin/bash
# Double-click in Finder, or run ./start.command from Terminal.
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  printf '\nPython 3 is required to preview this website.\n'
  printf 'Install it from https://www.python.org/downloads/macos/ and try again.\n\n'
  read -r -p 'Press Return to close this window. '
  exit 1
fi

exec python3 scripts/preview.py "$@"
