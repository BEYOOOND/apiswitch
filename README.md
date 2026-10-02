# ApiSwitch

**Codex 官方 Plus ↔ API 中转站一键切换**。Electron + React 桌面应用，支持 macOS 与 Windows，关闭窗口后驻留系统托盘。

当前正式版本：**v1.0.1**（仅管理 Codex；Skills / Agents 为本地只读中枢）。

## 功能

- **Codex 切换**：写入 `~/.codex`（`auth.json` / `config.toml`），在官方 ChatGPT 登录与中转 Profile 之间切换
- **Profile**：名称、ID、Base URL、API Key、Model；保存并可立即启用
- **Skills / Agents**：扫描本机 Codex / Cursor 相关资源（不修改第三方工具配置以外的中转写入）
- **安全**：API Key 优先存入系统钥匙串 / Credential Manager（`keytar`，service `com.vincentz.apiswitch`）

## 环境要求

- Node.js 20+
- macOS 13+（Apple Silicon 打包脚本默认 arm64）或 Windows 10+

## 开发

```bash
git clone https://github.com/<your-username>/apiswitch.git
cd apiswitch
npm install
npm run dev
```

```bash
npm test          # vitest
npm run typecheck
```

## 打包

产物默认在仓库根目录的 `dist/`（已 gitignore），**不会**覆盖 `/Applications/ApiSwitch.app`。

```bash
# macOS（目录包 + zip，并复制到桌面 ApiSwitch-<version>.app）
npm run package:mac

# Windows（在 macOS 上可打 win-unpacked zip；完整安装包建议在 Windows 上）
npm run package:win
# 或在 Windows 上：
npm run dist:win
```

## 用户数据（勿提交）

| 路径 | 说明 |
|------|------|
| `~/.apiswitch/` | Profile 与备份 |
| `~/.codex/` | Codex 配置（由本应用切换时写入） |
| Keychain / Credential Manager | API Key |

本仓库**不包含**任何密钥或个人 Profile。

## 技术栈

- Electron 33 + electron-vite
- React 18 + TypeScript + Zustand
- vitest · electron-builder · keytar

## 仓库结构

```
src/main/       # 主进程、切换逻辑、Codex writer
src/preload/    # IPC 桥
src/renderer/   # UI（API / Skills / Agents / Setting）
tests/          # 核心单元测试
resources/      # 图标
scripts/        # 打包辅助
```

## License

[MIT](LICENSE)

## 上传 GitHub

见 [docs/github.md](docs/github.md)（个人备份、主页与首次 push 步骤）。
