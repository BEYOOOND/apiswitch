# Windows · Electron + React

应用名 **ApiSwitch** · 版本 **1.0.1** · `appId` `com.vincentz.apiswitch`

源码在**仓库根目录**（与 [`macos/`](../macos/) 并列）。

## 目录

```
src/main/       # 主进程、Codex 写入、托盘
src/preload/
src/renderer/   # React：API / Skills / Agents / Setting
tests/          # vitest
resources/      # 图标与 tray
package.json
```

## 命令

```bash
npm install
npm run dev
npm test
npm run package:win
# → dist/ApiSwitch-1.0.1-win-x64.zip
```

关闭主窗口后驻留系统托盘；「退出 ApiSwitch」才退出。

macOS 日常请用原生版（`docs/macos.md`）；根目录 `package:mac` 仅为 Electron 备用产物。
