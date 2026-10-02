# macOS · 原生（SwiftUI）

应用名 **ApiSwitch** · 版本 **1.1.0** · Bundle ID `com.vincentz.apiswitch`

## 运行时

- 状态栏：`NSStatusItem` + `resources/tray-16.png`（像素 A，template）
- 主窗口：`NSHostingView`；关闭按钮 = 隐藏，不退出
- `LSUIElement`：不显示程序坞图标
- 配置：与 Windows Electron 共用 `~/.apiswitch` / `~/.codex` / Keychain

## 目录

```
macos/
  Package.swift
  Sources/ApiSwitchCore/   # ProfileStore · CodexWriter · Switcher …
  Sources/ApiSwitch/       # AppDelegate · UI
  Sources/CoreSmoke/       # 无完整 Xcode 时的冒烟测试
  Tests/ApiSwitchTests/    # XCTest（需 Xcode）
  scripts/build.sh         # 产出 .app + AppIcon.icns
  scripts/package.sh       # 安装到 /Applications/ApiSwitch.app
```

## 命令

```bash
cd macos
xcrun --sdk macosx swift run CoreSmoke
./scripts/package.sh
# → /Applications/ApiSwitch.app
# → dist/ApiSwitch-1.1.0-mac-arm64.zip
```
