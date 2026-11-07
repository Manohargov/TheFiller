#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Public packages must not contain a candidate's private profile or resume.
unset THE_FILLER_PROFILE THE_FILLER_RESUME
"$ROOT/native/build.sh"
STAGE="$(mktemp -d "$ROOT/work/dmg-stage.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ditto "$ROOT/dist/The Filler.app" "$STAGE/The Filler.app"
ln -s /Applications "$STAGE/Applications"
mkdir -p "$ROOT/releases/macos"
OUTPUT="$ROOT/releases/macos/The-Filler-1.1.0-macOS-$(uname -m).dmg"
hdiutil create -volname "The Filler" -srcfolder "$STAGE" -ov -format UDZO "$OUTPUT"
hdiutil verify "$OUTPUT"
echo "Installer: $OUTPUT"
