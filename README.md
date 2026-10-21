# 洛克配队手册

《洛克王国：世界》PVP 阵容资料站。Astro + TypeScript + Zod，静态多页面，GitHub Pages 部署。当前收录 5 份经视觉核对的 S4 完整一图流；没有编造 T0、胜率或无法核实的教学视频。

线上地址：https://hcj050101001.github.io/roco-pvp-meta/

## 本地启动

需要 Node.js 22。

```sh
npm ci
npm run dev
```

浏览器打开终端提示的本地地址。生产构建用 `npm run build`，输出 `dist/`。

## 内容维护

每套资料保存在 `data/lineups/<slug>.json`；归档保存在 `data/archive/`。所有字段通过严格 Zod Schema。原图在 `public/assets/lineups/`，记录来源、尺寸、SHA-256、64 位 DCT pHash、证据等级和视觉检查说明。

- 首页图片完整显示，点击进入独立详情页；详情顶部常驻返回、底部再次返回。
- 搜索覆盖阵容、别名、体系和六只精灵；支持体系过滤和发布时间排序。
- 不明确的首发标记推断；血脉、看不清的技能、无精确对应的视频不补写。
- 当前补丁尚未独立核对。资料排序是编辑资料分，不是实时胜率榜。
- 历史阵容归档需理由，原图与原记录不硬删除。

## 研究流程

```sh
npm run refresh:snapshot
npm run research:discover
npm run research:validate
# Codex 按项目 Skill 对候选进行视觉/版本/成员核对，更新资料
npm run lineup:rank
npm run refresh:guard
npm run check
npm test
npm run build
npm run links:check
```

`research:discover` 从公开 Bing RSS 搜索索引发现受支持平台链接。没有结果或来源阻止抓取时记录失败，不绕过限制。`research:full` 进一步使用新建的无登录 Chromium 上下文检查懒加载内容；先执行 `npx playwright install chromium`。直接运行 `node node_modules/tsx/dist/cli.mjs scripts/collect/run.ts --seeds <文件>` 可导入搜索结果 URL 数组。所有 HTML、DOM 图片节点、公开评论、视频元数据与候选图只写入 `research/inbox/<run-id>/`。采集器不会修改生产 JSON。

图片提取覆盖 src/data-src/data-original/srcset/picture、JSON-LD、og:image、内嵌 JSON 与点击原图链接；保存 DOM 顺序和邻近文字。社区多阵容映射只作为候选，不能由相邻文字自动晋升。B 站/抖音使用公开页面；动态评论未公开渲染、登录或验证码阻止时不宣称已取得评论。

已合法取得的本地公开视频可选用 ffmpeg 场景抽帧：

```sh
npx tsx scripts/extract/video.ts path/to/public-video.mp4 research/inbox/run-id/videos/video-id/frames
```

需自行安装 ffmpeg。工具不下载受限视频、不使用私人 Cookie，不自动把帧晋升为生产图。首次未获得精确教学视频，因此没有视频按钮。

## 验证

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:ui
```

浏览器测试覆盖桌面 1440px、手机 390px，检查搜索筛选、详情路由、双返回、图片实际加载、自然宽高比、无横向溢出和运行时错误。截图在 `artifacts/`。GitHub CI 会在项目子路径下重复检查。

本地模拟 GitHub Pages（PowerShell）：

```powershell
$env:SITE_BASE='/roco-pvp-meta'
npm run build
$env:TEST_BASE='/roco-pvp-meta'
npm run test:ui
```

## 部署与半月更新

`.github/workflows/deploy.yml` 对 main 推送和手动运行执行类型检查、测试、构建、浏览器验证，然后使用 configure-pages/upload-pages-artifact/deploy-pages 发布。

`.github/workflows/refresh-and-deploy.yml` 在每月 1 日、16 日北京时间 03:17 执行，也支持手动运行。使用 GitHub 官方 timezone 调度。先采集、再由 Codex 判断；独立发布 job 使用可信程序再次校验候选及非破坏性更新约束，验证通过才提交内容并部署。研究 job 不具有仓库写权限，Codex 无法直接发布程序或工作流修改。

**尚需配置：** 在仓库 Settings → Secrets and variables → Actions 添加 `OPENAI_API_KEY`。不要提交密钥。没有该 Secret 时研究日志仍会保留，判断/发布会停止，线上内容保持不变。首次完整 AI 自动更新需添加凭证后手动运行验证。平台抓取可能随反爬变化失败；不可保证每周期都有新阵容。

官方参考：[Astro GitHub Pages](https://docs.astro.build/en/guides/deploy/github/)、[Codex GitHub Action](https://learn.chatgpt.com/docs/github-action)、[GitHub schedule timezone](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule)。

## 文件与来源

- `.agents/skills/roco-pvp-site-maintainer/SKILL.md`：保留用户提供的维护 Skill，两份附件内容相同。
- `docs/project-runbook.md`：原操作手册。
- `research/runs/`：实际采集摘要、排序、失败记录、外链验证。
- `src/`：布局、静态页面、样式与数据约束；不在组件中硬编码阵容事实。

这是玩家非官方学习索引。配置图归原作者所有，原始水印完整保留；每图记录制图者、原配置作者和转载页。明确禁止转载的资源不缓存。图片授权与纠错可通过仓库 issue 反馈。项目代码可复用，不代表第三方图像获得了相同许可。
