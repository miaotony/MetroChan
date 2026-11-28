# 回归验证

使用 Node 24、Python 3、Git 和 `tar`。在仓库根目录执行：

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium --only-shell
TEST_SITE=dist TEST_PREFIX=/ npm run test:e2e
TEST_SITE=dist TEST_PREFIX=/MetroChan/ npm run test:e2e
npm run test:offline
```

Linux 首次安装浏览器可加 `--with-deps`。`npm run build` 同时生成网站 `dist/` 和单文件 `release/MetroChan-offline.html`。网站测试在回环地址启动原版和候选服务；离线测试针对本地 HTML，不用网站服务代替，也不依赖 PWA 或 Service Worker。

构建会检查实际文件字节数（不是 HTTP 传输估算）：整站 ≤512 KiB，离线单文件 ≤480 KiB，全部路径块 ≤145 KiB、单块 ≤12 KiB。可用 `npm run size` 重查。单测按旧版固定 SHA-256 指纹逐起点比对全部 87,153 个站对；产物测试还会检查网站外置和离线内嵌的每一块都与通过校验的源数据逐字节一致，离线打赏图解码后的像素也与原图一致。

- 原版参考固定为 `518a2400ac6cacab8e97b809f4c7bc0a8bd44779`，浅克隆请先取回这个提交。测试从 Git 临时解包，不检出或修改其他分支。
- `baselines/chromium/` 保留重构前的 16 张整页截图（macOS、锁定的 Chromium、桌面 1440×900 / 手机 390×844、亮/暗）。只有显式设置 `CAPTURE_BASELINE=1` 运行 `visual.spec.ts` 才会重拍参考图；不要用更新截图来处理失败。
- 自动比对在同一系统、字体和浏览器上分别渲染参考提交和候选页面，避免用 Linux 的字形去比 macOS 图片。失败时在 `test-results/` 查看截图、差异和 trace。
- `TEST_SITE` 指向候选静态站点目录；`TEST_PREFIX=/MetroChan/` 检查子路径部署。固定站对结果在 `fixtures/`，不是从待测页面即时计算的期望值。
- CI 失败时，从该次运行下载 `regression-diagnostics`：其中包含已产生的 Playwright 结果和报告。离线浏览器测试的失败 trace 位于 `test-results/offline/`；即使没有生成 trace，只要该步骤已启动，就可以看 `offline-test.log`。
- 验证工作流进入默认分支后才能手动触发，不在推送、PR 或定时任务上运行。成功时可下载 `MetroChan-offline`，无需发布网站；只有在 `main` 上显式选择 `deploy_pages` 才会发布 `dist/` 到 Pages。见[部署与下载说明](../docs/deploy.md)。
