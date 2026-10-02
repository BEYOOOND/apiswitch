#!/usr/bin/env bash
# Build ApiSwitch.app into macos/build/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-1.1.0}"
BUILD_DIR="$ROOT/build"
APP="$BUILD_DIR/ApiSwitch.app"
BIN_DIR="$APP/Contents/MacOS"
RES_DIR="$APP/Contents/Resources"
RESOURCES_ROOT="$ROOT/../resources"

echo "==> swift build (release)"
xcrun --sdk macosx swift build -c release --product ApiSwitch

BIN="$(xcrun --sdk macosx swift build -c release --show-bin-path)/ApiSwitch"
if [[ ! -x "$BIN" ]]; then
  echo "Missing binary: $BIN" >&2
  exit 1
fi

rm -rf "$APP"
mkdir -p "$BIN_DIR" "$RES_DIR"
cp "$BIN" "$BIN_DIR/ApiSwitch"
chmod +x "$BIN_DIR/ApiSwitch"

# Menu bar pixel A
for f in tray-16.png tray-32.png; do
  [[ -f "$RESOURCES_ROOT/$f" ]] && cp "$RESOURCES_ROOT/$f" "$RES_DIR/$f"
done

# Finder / Applications icon
ICON_SRC=""
for cand in icon-512.png "icon@2x.png" icon.png; do
  if [[ -f "$RESOURCES_ROOT/$cand" ]]; then
    ICON_SRC="$RESOURCES_ROOT/$cand"
    break
  fi
done

if [[ -n "$ICON_SRC" ]]; then
  ICONSET="$BUILD_DIR/AppIcon.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  sips -z 16 16     "$ICON_SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32     "$ICON_SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "$ICON_SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64     "$ICON_SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "$ICON_SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256   "$ICON_SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "$ICON_SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512   "$ICON_SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "$ICON_SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
  cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET" -o "$RES_DIR/AppIcon.icns"
  rm -rf "$ICONSET"
  echo "Created AppIcon.icns"
else
  echo "WARNING: no icon source" >&2
fi

cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>ApiSwitch</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.vincentz.apiswitch</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>ApiSwitch</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticTermination</key>
  <false/>
  <key>NSSupportsSuddenTermination</key>
  <false/>
</dict>
</plist>
EOF

codesign --force --deep --sign - "$APP" 2>/dev/null || true
echo "Built $APP"
