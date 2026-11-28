# MetroChan 部署与回滚

`npm run build` 一次生成两份产物，用途不同：

- **网站 `dist/`**：只部署这个目录。站点根目录应直接包含 `index.html` 和 `assets/` 等静态资源；同一份产物须在 `/` 和 `/MetroChan/` 下都能工作。地图和路径的 `.bin` 是应用自己的 gzip 数据，不要给这些文件手动设置 `Content-Encoding: gzip`。
- **离线文件 `release/MetroChan-offline.html`**：单独分发，直接用浏览器打开，无需本地服务器。不要把它复制进 `dist/`，也不要部署 `release/`、`public/` 或仓库根目录。

## 发布前验证

在仓库根目录使用 Node.js 24、npm、Python 3、Git 和 `tar`。Playwright 会在本机启动原版和候选站点；Git 历史必须包含下文的参考提交。以下命令与手动 CI 一致（Linux）：

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium --only-shell
TEST_SITE=dist TEST_PREFIX=/ npm run test:e2e
TEST_SITE=dist TEST_PREFIX=/MetroChan/ npm run test:e2e
npm run test:offline
```

macOS 安装浏览器时可省略 `--with-deps`。两次网站验证和离线验证都使用同一次构建的产物。视觉比对使用当前系统、同一浏览器渲染的原版和候选页；不要设置 `CAPTURE_BASELINE` 来处理失败。

## 下载离线版

手动验证时，`upload_offline` 默认勾选。全部测试通过后，从该次 Actions 运行的 **Artifacts → MetroChan-offline** 下载压缩包，解压后打开其中的 HTML。产物保留 7 天，不创建 GitHub Release，也不发布网站。取消勾选只跳过上传，仍会测试离线文件。

这是可复制的单文件快照，不是 PWA：无需先访问线上站点，也不依赖 Service Worker 缓存。更新时下载新版 HTML 替换旧文件；可安装的在线应用和缓存更新策略留待未来单独设计。

## Cloudflare Workers Builds（主站）

先在 Cloudflare 的 **Workers & Pages** 中确认现有项目类型；**Workers Builds** 和 **Cloudflare Pages** 不是同一条发布流程：

| 项目类型 | 构建与发布的配置 |
| --- | --- |
| Workers Builds + Static Assets | 在现有 Worker 的 **Settings → Builds** 核对仓库根目录和构建命令 `npm run build`（依赖按锁文件安装）。部署是独立的 **Deploy command**：现有 Wrangler 配置中 `assets.directory` 应指向 `./dist`，由 `npx wrangler deploy` 发布；若资产目录由命令指定，则使用 `npx wrangler deploy --assets ./dist`。两种方式都要确认目标是原有 Worker 和生产环境。 |
| Cloudflare Pages 项目 | 才使用 **Build command** `npm run build` 和 **Build output directory** `dist`。不要把 Pages 的输出目录字段当成 Worker 的部署命令，也不用 `wrangler pages deploy` 发布 Worker。 |

这些是供维护者核对的设置，不是本工作流执行的步骤。GitHub Actions 不访问 Cloudflare，不更改既有构建触发器、绑定、域名或 DNS。

## GitHub Pages（手动备用）

1. 如需启用备用站，仓库管理员先在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，而非 **Deploy from a branch**。无须设置自定义域名或改动主站 DNS。
2. 带 `workflow_dispatch` 的 `.github/workflows/verify.yml` 必须先存在于仓库的**默认分支**，才可在 **Actions → Verify MetroChan → Run workflow** 选择分支手动运行。默认 `deploy_pages=false`，不发布网站；推送和 PR 均不会触发此工作流。
3. 真正需要发布时，选择 **main** 并显式勾选 **Deploy the tested dist to GitHub Pages (main only)**。其他分支或标签即使勾选也不会发布。两种网站路径和离线文件均验证通过后，工作流才打包本次测试过的 `dist/`；部署作业不检出代码，也不再构建。
4. 从成功运行的 `github-pages` 环境打开部署 URL，确认 `/MetroChan/` 下四个标签页、线路图和票价数据正常。若验证失败，查看运行日志和 `regression-diagnostics`（有 Playwright 输出时）；失败不会替换当前站点。

## 安全回滚到重构前 v2

目标是 **`518a2400ac6cacab8e97b809f4c7bc0a8bd44779`**，即回归测试使用的重构前 v2；**不是 `v1.0` 分支**。发布前记录当前 Worker 的部署时间、版本 ID 与源提交，以及备用 Pages 的运行链接，便于核对回滚目标。

- **Worker**：在现有 Worker 的 **Deployments** 找到已确认来自该提交、包含静态资源的成功版本，执行 **Rollback**。不要仅按「上一个版本」猜测。核对主站路由、地图与票价；回滚不会撤销源码变更，后续发布前仍须修复问题。
- **GitHub Pages**：若有确认为该版本、仍保留 Pages 产物的成功 `main` 发布运行，可仅重新运行其部署作业。不要指望在旧提交上运行新工作流：该提交没有 npm 构建步骤。若无留存产物，可从固定提交在临时目录还原可发布站点：

```sh
revision=518a2400ac6cacab8e97b809f4c7bc0a8bd44779
recovery=$(mktemp -d)
git archive --format=tar -o "$recovery/site.tar" "$revision" index.html assets data favicon.svg og.png &&
  mkdir "$recovery/site" && tar -xf "$recovery/site.tar" -C "$recovery/site"
python3 -m http.server --bind 127.0.0.1 --directory "$recovery/site" 8000
```

在 `http://127.0.0.1:8000/` 检查静态资源和站到站查询。若需要从源码恢复发布，通过单独的修复分支和审查让 `main` 的构建产出该已验证站点；再走相同的双路径验证和手动发布流程。不要重置或强推 `main`，也不要把未验证的本地目录直接发布到 Pages。
