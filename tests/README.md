# 回归验证

使用 Node 24、Python 3、Git 和 `tar`。初次运行 `npm ci` 和 `npx playwright install chromium --only-shell`（Linux 上加 `--with-deps`）。执行 `npm run test:e2e`；测试在回环地址开两个临时服务，不请求线上站点，也不依赖 CDN。

- 原版参考固定为 `518a2400ac6cacab8e97b809f4c7bc0a8bd44779`，浅克隆请先取回这个提交。测试从 Git 临时解包，不检出或修改其他分支。
- `baselines/chromium/` 保留重构前的 16 张整页截图（macOS、锁定的 Chromium、桌面 1440×900 / 手机 390×844、亮/暗）。只有显式设置 `CAPTURE_BASELINE=1` 运行 `visual.spec.ts` 才会重拍参考图；不要用更新截图来处理失败。
- 自动比对在同一系统、字体和浏览器上分别渲染参考提交和候选页面，避免用 Linux 的字形去比 macOS 图片。失败时在 `test-results/` 查看截图、差异和 trace。
- `TEST_SITE` 指向候选静态站点目录；`TEST_PREFIX=/MetroChan/` 检查子路径部署。固定站对结果在 `fixtures/`，不是从待测页面即时计算的期望值。
- `.github/workflows/verify.yml` 只有 `workflow_dispatch`，不会在推送、PR 或定时任务上执行，也不部署站点。
