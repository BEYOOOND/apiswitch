# 上传 GitHub

本仓库为 **ApiSwitch** 正式源码归档：

| 端 | 路径 | 版本 |
|----|------|------|
| macOS 原生 | `macos/` | 1.1.0 |
| Windows Electron | 仓库根目录 | 1.0.1 |

## 上传前

1. 将 [`package.json`](../package.json) 中 `YOUR_USERNAME` 换成你的 GitHub 用户名。
2. 确认未跟踪构建产物（`dist/`、`node_modules/`、`macos/.build/`、`macos/build/` 已在 `.gitignore`）。

```bash
cd /path/to/apiswitch
git status
git add .
git commit -m "$(cat <<'EOF'
release: ApiSwitch macOS 1.1.0 + Windows Electron 1.0.1

Native menu-bar Mac app and Codex-only Electron for Windows,
with shared ~/.apiswitch and ~/.codex configuration.
EOF
)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/apiswitch.git   # 若尚未添加
git push -u origin main
```

或：`gh repo create apiswitch --public --source=. --remote=origin --push`

## Releases 资产

| 文件 | 命令 |
|------|------|
| `ApiSwitch-1.1.0-mac-arm64.zip` | `cd macos && ./scripts/package.sh` |
| `ApiSwitch-1.0.1-win-x64.zip` | `npm run package:win` |

安装包用 Releases 上传；**不要**把 `dist/` 提交进 git。

## 检查清单

- [x] 双端源码与文档
- [x] CHANGELOG / LICENSE / CI
- [x] 应用名统一为 ApiSwitch
- [ ] 替换 `YOUR_USERNAME`
- [ ] `git push` 与创建 Release
