# 部署 UML Orbit

UML Orbit 的线上产物是纯静态文件。GitHub Pages 无需后端、数据库、API Key 或个人访问令牌。

## GitHub Pages

1. 将完整源码上传到仓库，保留 `.github/workflows/pages.yml`、`package-lock.json` 与 `.node-version`。
2. 打开仓库 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 打开 **Actions → Check and deploy GitHub Pages → Run workflow**，选择默认分支并运行；也可以推送新提交到默认分支。
5. 等待 `Check, test and build` 和 `Deploy to GitHub Pages` 均成功。部署地址显示在工作流的 `github-pages` 环境中。

当前仓库的地址为 `https://liang193.github.io/uml-orbit/`。Fork 后使用 `https://你的账号.github.io/仓库名/`；无需修改资源基础路径。

工作流会自动读取默认分支名，因此 `main`、`master` 或其他默认分支均可使用。PR、功能分支和非默认分支的手动运行只检查与构建，不部署。

配置入口参考：[GitHub 官方 Pages 发布来源文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。Pages 部署采用官方 [upload-pages-artifact](https://github.com/actions/upload-pages-artifact) 和 [deploy-pages](https://github.com/actions/deploy-pages) Actions。

## 自动部署做了什么

1. 检出代码，使用 `.node-version` 指定的 Node.js 24。
2. 从锁文件执行 `npm ci`，运行语法检查和全部测试。
3. 将允许发布的浏览器资源复制到干净的 `dist/`。
4. 仅默认分支上传 Pages artifact 并部署。

部署只需要 GitHub 提供的 `GITHUB_TOKEN`。工作流默认只有源码读取权限，部署作业单独申请 `pages: write` 与 `id-token: write`。无需添加 Secrets。不要把个人访问令牌写进源码或工作流。

## 本地验证构建产物

```sh
npm ci
npm run validate
npm run preview -- --base /uml-orbit/
```

打开 `http://127.0.0.1:4173/uml-orbit/`。自动测试会核对页面所需模块和 Worker 是否全部包含在构建包中，并测试子路径加载与源文件隔离。

## 更新与回退

- 更新：提交并推送到默认分支，工作流自动部署最新版本。
- 回退：在默认分支 revert 有问题的提交，再推送；工作流将部署回退后的代码。
- 网站有缓存时：使用 Ctrl+F5 刷新。部署不会删除访问者浏览器中的图纸，建议重大更新前导出 JSON 备份。

## 其他静态托管

支持从 GitHub 导入仓库的静态托管平台，使用以下通用配置：

| 配置项 | 值 |
| --- | --- |
| 框架 | Other / Static |
| Node.js | 24 |
| 安装命令 | `npm ci` |
| 构建命令 | `npm run build` |
| 发布目录 | `dist` |
| 环境变量 | 无 |

站点不需要后端 SPA rewrite。请使用 HTTPS，确保模块 Worker 能以 JavaScript MIME 类型加载，保留入口目录的末尾 `/`。

## 常见问题

**部署提示找不到 Pages 站点**：检查 Settings → Pages 是否已选择 GitHub Actions，以及仓库或组织是否允许 Pages。

**工作流等待审批**：在仓库的 Environments → github-pages 检查部署保护规则，并由具有权限的人批准；不要通过移除组织保护规则绕过审批。

**只有检查作业，没有部署作业**：确认运行的是仓库默认分支，而不是 PR 或功能分支。

**页面能打开但没有关系线 / Java 分析不可用**：检查浏览器控制台与 Network，确认 `routing-worker.js`、`java-import-worker.js` 及它们导入的模块返回 200，并且 Content-Type 为 JavaScript。

**上传后显示文档而非编辑器**：Source 应选择 GitHub Actions；实际部署的是工作流构建的 `dist/`，而不是 README 或 `docs/` 目录。

**本机图纸在线上不见了**：localStorage 按浏览器和站点来源隔离。本机与线上各自保存数据，请通过 JSON 导出 / 导入迁移。
