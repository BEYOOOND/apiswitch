#!/usr/bin/env bash
# Build + install ApiSwitch.app to /Applications (name: ApiSwitch only)
# Also writes dist/ApiSwitch-<ver>-mac-<arch>.zip for releases
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
VERSION="${VERSION:-1.1.0}"
ARCH="$(uname -m)"
[[ "$ARCH" == "arm64" ]] || ARCH="x64"

"$ROOT/scripts/build.sh"

APP="$ROOT/build/ApiSwitch.app"
OUT="$REPO/dist"
ZIP="$OUT/ApiSwitch-${VERSION}-mac-${ARCH}.zip"
APPS="/Applications/ApiSwitch.app"

# Quit running instances
pkill -x ApiSwitch 2>/dev/null || true
sleep 0.5

mkdir -p "$OUT"
rm -rf "$APPS"
# Remove old named copies on Desktop / dist
rm -rf "$HOME/Desktop/ApiSwitch.app" \
  "$HOME/Desktop/ApiSwitch-"*.app \
  "$OUT/ApiSwitch.app" \
  "$OUT/ApiSwitch-"*.app \
  "$OUT"/ApiSwitch-*-native.zip 2>/dev/null || true

ditto "$APP" "$APPS"
# Ad-hoc sign after copy
codesign --force --deep --sign - "$APPS" 2>/dev/null || true

rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

echo "Installed $APPS"
echo "Created $ZIP"
echo "Removed old Desktop/dist ApiSwitch copies"
