# ApiSwitch

Codex 官方 Plus ↔ API 中转站一键切换。显示名：**ApiSwitch**。

| 平台 | 框架 | 源码 | 版本 |
|------|------|------|------|
| **macOS 14+** | SwiftUI + `NSStatusItem`（日常推荐） | [`macos/`](macos/) | **1.1.0** |
| **Windows** | Electron + React 托盘 | 仓库根目录 | **1.0.1** |

配置互通：`~/.apiswitch`、`~/.codex`，钥匙串 service `com.vincentz.apiswitch`。

## 功能

- 仅管理 **Codex**（官方 ChatGPT ↔ 中转 Profile）
- Profile：名称 / ID / Base URL / API Key / Model
- Skills / Agents 本地只读清单（进入 Tab 时再扫描）
- macOS：菜单栏像素「A」、无 Dock；关窗后进程驻留

## 文档

| 文档 | 说明 |
|------|------|
| [docs/macos.md](docs/macos.md) | 原生 Mac 开发、安装、打包 |
| [docs/windows.md](docs/windows.md) | Electron Windows 开发与打包 |
| [docs/github.md](docs/github.md) | 上传 GitHub / Releases |
| [CHANGELOG.md](CHANGELOG.md) | 版本记录 |

## 快速命令

```bash
# macOS → /Applications/ApiSwitch.app
cd macos && ./scripts/package.sh

# Windows zip
npm install && npm run package:win
```

## License

[MIT](LICENSE)
