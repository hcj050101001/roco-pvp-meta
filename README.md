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
npm run research:discover
npm run research:validate
```

`research:full` 会再尝试用无登录 Chromium 查看部分页面的公开渲染和懒加载内容。研究数据写入 `research/inbox/<run-id>/`，采集器不会直接改动阵容 JSON。可通过 `--seeds <json文件>` 给采集器导入公开 URL 数组。

`npm run season:check` 每日由 GitHub Actions 运行，只接受官方已生效公告；来源不可用时保留现有赛季。半月研究和发布流程在北京时间每月 1 日、16 日 03:17 运行，也支持手动触发。完整研究使用 DeepSeek `deepseek-flash`（支持图片核验），依赖仓库 Secret `DEEPSEEK_API_KEY`；在 GitHub 仓库 Settings → Secrets and variables → Actions 中设置。缺少 Secret 或 API 调用失败时研究 job 会停止，线上内容保持不变。

模型请求通过 Codex Action 的代理发往 `https://api.deepseek.com/responses`，消耗 DeepSeek API 账户余额。Action 的参数名仍叫 `openai-api-key`，传入的是 DeepSeek 密钥，无需 OpenAI API Key。模型能力定义在 `.github/codex/deepseek-models.json`；配置依据 [DeepSeek Responses 文档](https://api-docs.deepseek.com/guides/responses_api/)及 [Codex 接入文档](https://api-docs.deepseek.com/quick_start/agent_integrations/codex)。

可在 Actions 手动运行 `Verify DeepSeek connection`：真实调用 DeepSeek，核对随机文件读取与图片数字识别，不修改网站内容。`Research refresh and deploy` 才执行完整的候选采集、核验和发布。

完整研究会先运行 `research:vision`，按 SHA 去重并生成单张不超过 192 KiB 的 JPEG 概览和原尺寸分块，仅用于模型识图。每候选保存核验进度，32,000 tokens 后自动压缩上下文，避免连续附加放大 PNG 触发 DeepSeek 的 [48 MiB 请求体限制](https://api-docs.deepseek.com/guides/vision)。网站使用的完整原图和水印保持原样；预览无法确认的细节不填入数据。

推送到 `main` 会运行 `.github/workflows/deploy.yml`：类型检查、单元测试、静态构建、浏览器测试通过后部署 GitHub Pages。手动部署可在仓库 Actions 页面运行 `Build and deploy Pages`。

## 来源与署名

这是非官方玩家资料站。配置图和视频归原作者及平台所有，页面保留来源和署名；明确禁止再分发的素材不缓存。玩家可通过网站页脚的 GitHub Issues 入口反馈错误或来源变更。
