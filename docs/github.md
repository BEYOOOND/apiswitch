# 发布到 GitHub（个人备份与主页）

本仓库已整理为可直接公开的源码形态（无构建产物、无密钥、无历史原型）。

## 首次上传

1. 在 GitHub 新建空仓库（建议名 `apiswitch`，Public 或 Private 均可）。
2. 将本仓库 `package.json` 中的 `YOUR_USERNAME` 换成你的 GitHub 用户名。
3. 在本目录执行：

```bash
git init
git add .
git commit -m "chore: release ApiSwitch v1.0.1 (Codex-only Electron)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/apiswitch.git
git push -u origin main
```

或使用 GitHub CLI：

```bash
gh repo create apiswitch --public --source=. --remote=origin --push
```

## 作为个人开发主页的一部分

- **一应用一仓库**：每个软件单独建仓，便于备份与展示。
- **Profile README**：在 `https://github.com/YOUR_USERNAME/YOUR_USERNAME` 建特殊仓库，用 Markdown 列出项目卡片与链接。
- **Release**：需要分发安装包时，用 GitHub Releases 上传 `dist/` 里的 zip（勿把 `dist/` 提交进 git）。
- **不要提交**：`node_modules/`、`out/`、`release/`、`dist/`、`.env`、任何含 API Key 的文件。

## 本项目检查清单

- [x] 仅保留 Electron 正式源码
- [x] README / LICENSE / CI
- [x] `.gitignore` 排除构建与密钥
- [ ] 替换 `YOUR_USERNAME`
- [ ] `git push` 到你的账号
