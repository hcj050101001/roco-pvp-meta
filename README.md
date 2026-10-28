# 洛克配队手册

《洛克王国：世界》PVP 玩家阵容图鉴，收录完整真实的配置图、可核验来源和精确对应的教学视频。网站使用 Astro 静态生成并部署在 GitHub Pages。

**线上网站：** <https://hcj050101001.github.io/roco-pvp-meta/><br />
**当前内容：** 15 套 S4 阵容，4 套 S2/S3 往期阵容。赛季和阵容数量由仓库数据决定，以上数字反映当前数据。

## 玩家可以做什么

- 按阵容名、精灵名、别名或体系搜索；按体系、配置发布时间或视频可用情况筛选。
- 默认顺序优先近期有来源的实绩或热度记录，其后按配置发布日期排列。线索只用于发现顺序，不代表胜率或强度；详情页列出有来源的近期记录。
- 查看完整配置图、配置日期、图源类型和资料核对日期。历史阵容保留原赛季标记。
- 详情页仅展示已核实的技能、作者攻略原话和精确匹配视频。缺少可靠信息时会说明或省略，不补写猜测。
- 浏览往期赛季。新赛季初期当季阵容少于三套时，上一赛季配置会标为过渡参考。

## 本地运行

需要 Node.js 22 或更高版本。

```sh
npm ci
npm run dev
```

常用检查：

```sh
npm run check
npm test
npm run build
npm run test:ui
```

持续集成与格式化：

- 每次 pull request 和推送到 `main` 都会运行 `.github/workflows/ci.yml`，它只做校验（类型检查、单测、带子路径的生产构建和浏览器测试），不部署；发布仍需手动触发 `Build and deploy Pages`，普通推送不会发布。
- 格式化与 Lint 配置为 Prettier（含 Astro 插件）与 ESLint（Flat Config，支持 `.astro` 与 TypeScript）：

```sh
npm run format
npm run format:check
npm run lint
```

为模拟 GitHub Pages 子路径，在 PowerShell 中运行浏览器测试：

```powershell
$env:SITE_BASE='/roco-pvp-meta'
npm run build
$env:TEST_BASE='/roco-pvp-meta'
npm run test:ui
```

浏览器测试覆盖桌面 1440px 和手机 390px，检查检索、筛选、详情路由、来源与视频链接、图片加载和逐卡布局。截图保存在被 Git 忽略的 `artifacts/`。

## 内容和目录

| 路径 | 用途 |
|---|---|
| `data/lineups/` | 当前阵容数据，每队一个严格校验的 JSON |
| `data/archive/` | 往期阵容及归档理由 |
| `public/assets/lineups/` | 原始完整配置图；不裁水印、不生成占位图 |
| `src/` | Astro 页面、组件、样式和数据模型 |
| `scripts/collect/` | 公开来源发现与候选采集 |
| `scripts/extract/`、`scripts/validate/` | 页面/图片提取与数据、图片、链接校验 |
| `research/` | 去重结果、研究记录及可复核证据；原始 inbox 与基线不提交 |
| `.agents/skills/roco-pvp-site-maintainer/SKILL.md` | 阵容核验、内容维护和发布的操作规范 |
| `docs/collectors.md` | 采集器能力、边界及运行方式 |

所有阵容事实由数据驱动，组件不硬编码阵容成员。研究候选不会自动晋升为网站内容；图片、版本、六只精灵、技能及视频匹配需要证据核验。未经证实的信息不应填入数据。

## 研究和赛季更新

手动发现公开来源：

```sh
npm run research:full -- --scope all
npm run research:validate
npm run research:coverage
```

`research:full` 默认同时搜索当季和历史赛季，跨平台发现并尝试用无登录 Chromium 查看公开渲染和懒加载内容。可用 `--scope history` 单独补充旧季。研究数据写入 `research/inbox/<run-id>/`，采集器不会直接改动阵容 JSON。默认接入扩展种子、已发布出处与待续查链接，也可通过 `--seeds <json文件>` 给采集器导入公开 URL 数组。具体策略见 [多来源、跨赛季阵容扩展](docs/research-strategy.md)；覆盖报告不等于阵容已核实。

阵容、赛季和网站仅在你主动发起聊天并提出更新后修改。仓库没有定时研究或赛季检查，也不会因推送代码自动发布。需要核对赛季时，助手手动运行 `npm run season:check`；来源不可用时保留现有赛季。

更新阵容时，助手按 [多来源、跨赛季策略](docs/research-strategy.md) 收集并核验真实配置图、来源、赛季与对应视频。采集器只产生候选；是否发布由本次聊天中的证据核验决定。

研究需要识图时可手动运行 `npm run research:vision` 准备受限 JPEG。图片看不清的细节不填入阵容。

`research:vision` 按 SHA 去重并生成单张不超过 192 KiB 的 JPEG 概览和原尺寸分块，仅供识图。网站使用的完整原图和水印保持原样。

相同 SHA 且没有新证据的图片保留既有记录，不重复 OCR、不刷新验证日期。已有成员名称和顺序的疑似修订保留为候选，`refresh:guard` 独立阻断未经核实的更改。

发布也只在你发起的更新任务中执行：助手完成资料与页面验收并推送至 `main` 后，手动运行 Actions 中的 `Build and deploy Pages`。该流程完成类型检查、单元测试、静态构建、浏览器测试，再部署 GitHub Pages；普通推送不会触发发布。

手动发布使用 `.github/actions/validate-site` 完成验收，保留桌面和手机截图及失败 trace。构建仍生成 `build-state.json` 内容指纹，供更新时检查实际发布内容。

搜索词、体系、赛季、视频筛选与排序保存在 URL，支持刷新和分享。详情页返回链接保留筛选条件并定位到原卡片；直接打开详情时仍使用默认返回入口。

## 来源与署名

这是非官方玩家资料站。配置图和视频归原作者及平台所有，页面保留来源和署名；明确禁止再分发的素材不缓存。玩家可通过网站页脚的 GitHub Issues 入口反馈错误或来源变更。
