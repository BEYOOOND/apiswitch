# 上传 GitHub

仓库归属：[BEYOOOND](https://github.com/BEYOOOND) · 项目：[apiswitch](https://github.com/BEYOOOND/apiswitch)

| 端 | 路径 | 版本 |
|----|------|------|
| macOS 原生 | `macos/` | 1.1.0 |
| Windows Electron | 仓库根目录 | 1.0.1 |

## 推送

```bash
cd /path/to/apiswitch
git remote add origin https://github.com/BEYOOOND/apiswitch.git   # 若尚未添加
git push -u origin main
```

或：`gh repo create BEYOOOND/apiswitch --public --source=. --remote=origin --push`

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
- [x] `package.json` 指向 BEYOOOND/apiswitch
- [ ] `git push` 与创建 Release
