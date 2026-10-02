# Changelog

## 1.1.0 — macOS native (SwiftUI)

- 新增 `macos/` 原生菜单栏应用（`NSStatusItem`、无 Dock）
- 关主窗口仅隐藏；状态栏像素「A」+ Profile 快捷菜单
- 与 Electron 共用 schema 6 / Keychain / `~/.codex`
- 安装名：`/Applications/ApiSwitch.app`

## 1.0.1 — Windows Electron (Codex-only)

- 收敛为仅 Codex；移除 OpenCode / Pi / env writer
- Profile：名称、ID、URL、Key、Model
- Skills / Agents 保留（Codex + Cursor）
- 打包：`ApiSwitch-1.0.1-win-x64.zip`
