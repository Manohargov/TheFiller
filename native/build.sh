#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$ROOT/dist/The Filler.app}"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
# Remove the obsolete executable when rebuilding an older bundle.
rm -f "$APP/Contents/MacOS/Jobfiller"
mkdir -p "$ROOT/work/native-build"
cp "$ROOT/native/Jobfiller.swift" "$ROOT/work/native-build/main.swift"
swiftc -O -target "$(uname -m)-apple-macos13.0" "$ROOT/work/native-build/main.swift" "$ROOT/native/ProfileImport.swift" -o "$APP/Contents/MacOS/TheFiller" -framework Cocoa
cp "$ROOT/native/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
cp "$ROOT/native/fill.js" "$APP/Contents/Resources/"
cp "${THE_FILLER_PROFILE:-$ROOT/config/profile.example.json}" "$APP/Contents/Resources/profile.json"
if [ -n "${THE_FILLER_RESUME:-}" ]; then cp "$THE_FILLER_RESUME" "$APP/Contents/Resources/resume.pdf"; else rm -f "$APP/Contents/Resources/resume.pdf"; fi
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>TheFiller</string>
<key>CFBundleIdentifier</key><string>local.manohar.jobfiller</string>
<key>CFBundleName</key><string>The Filler</string>
<key>CFBundleDisplayName</key><string>The Filler</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundleVersion</key><string>7</string>
<key>CFBundleShortVersionString</key><string>1.1</string>
<key>LSUIElement</key><false/>
<key>NSAppleEventsUsageDescription</key><string>Fill the application in your active browser tab when you click the floating circle.</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$APP"
echo "Built: $APP"
