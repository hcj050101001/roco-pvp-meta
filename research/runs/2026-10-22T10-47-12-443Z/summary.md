# 研究运行总结：2026-10-22T10-47-12-443Z

## 结论

- 本次运行没有新增或修改任何已发布阵容、图片、攻略引语或视频教程。
- 未写入新的 `last_successful_update`，因为要求的 `npm run` 包装命令未能在本沙箱全部通过（详见“验证结果”）。
- 当前赛季基线保持不变：S4「月涌狂想」，`major_update_required: false`，官方赛季来源仍为 `https://www.taptap.cn/moment/847022426351994538`。
- 覆盖结论为**有限覆盖**，不是完成广泛扩展：108 次检索均为 `no_supported_results`，新增可发布阵容为 0，来源仍集中于 3DM 与单一祈道合集。

## 赛季与版本确定性

- S4「月涌狂想」已由 `season:check` 核对，赛季开始于 2026-09-10（+08:00）；S3「铅字幻梦」始于 2026-07-16，S2「狂欢怪谈」始于 2026-05-20。
- `balance_patch_date` 仍为 `null`：本次没有获得可独立核对的平衡补丁日期，未根据论坛、页面更新时间或合集更新时间推断。
- 采集器的 `target_seasons` 与 `source.seasons` 只是发现范围，未作为图片所属赛季的证据。
- 未改动 `data/seasons.json` 或 `data/update-state.json` 的赛季基线；`data/update-state.json` 仅保留既有的 `season_checked_at` 更新。

## 已核对来源与覆盖

运行状态：`multi-platform-candidates`；有候选图的平台 5 个（诊断目标为 3 个，但平台数不代表原创性或图片语义已核验）。

| 平台 | 请求页 | 成功获取 | 唯一图 | 可用配置图 | 精确重复 | 新核验阵容 | 未决候选 | 待续图片 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| TapTap | 4 | 4 | 4 | 0 | 0 | 0 | 0 | 107 |
| Bilibili | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| 祈道 Qiandao | 2 | 2 | 6 | 4 | 0 | 0 | 4 | 158 |
| BiliGame | 1 | 1 | 8 | 0 | 0 | 0 | 0 | 9 |
| 3DM | 9 | 9 | 10 | 0 | 9 | 0 | 0 | 171 |
| 新浪 Sina | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| 抖音、小红书、贴吧、NGA、GameKee、Wegame、17173、多玩、游民星空 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

| 查询赛季 | 搜索尝试 | 有支持结果 | 目标页尝试 | 现有已收录队伍 | 现有来源平台 |
|---|---:|---:|---:|---:|---|
| S4 | 36 | 0 | 14 | 15 | 3dm、qiandao |
| S3 | 36 | 0 | 10 | 3 | 3dm |
| S2 | 36 | 0 | 8 | 1 | 3dm |

- 全部 108 次检索均无可支持结果，属于“搜索无支持结果”，不能视为赛季已覆盖。
- 失败类型需区分：Bilibili 为公开页 HTTP 412（页面失败）；新浪成功获取但缺图（missing images）；3DM 图片是二维码/宣传图（图片语义不符）；祈道四张虽为完整配置图，但作者、日期与赛季语义未核验（unverified semantics）。
- 待续图片共 445 张，来自 15 个来源（3DM 9、TapTap 3、祈道 2、BiliGame 1）。`research/candidates/discovery-backlog.json` 与采集器 deferred-image 证据已原样保留，供后续运行继续核验。
- 现有生产数据未变：15 套 S4 活跃阵容，3 套 S3 归档阵容，1 套 S2 归档阵容。

## 精确重复（9 套，全部保持原样）

按 SHA-256 与 `public/assets/lineups/` 比对，以下图片与已发布图片完全一致，且没有新的配置、版本、作者原话或教程证据；未重新 OCR，未刷新核验日期，未改动任何字段：

| 阵容 | 说明 |
|---|---|
| `rain-wing-s4` | 现有记录已记录“彩蝶鲨/莎莎”署名差异，无新证据 |
| `power-cat-crab-s3` | S3 历史记录原样保留 |
| `top-wolf-s2` | S2 历史记录原样保留 |
| `sleep-mouse-s4` | 无新配置或引语证据 |
| `dragonfish-starfall-s3` | S3 历史记录原样保留 |
| `pear-snake-s4` | 无变化 |
| `snow-snake-s3` | S3 历史记录原样保留 |
| `black-feather-poison-s4` | 成员名与顺序未改动 |
| `ice-roco-s4` | 无变化 |

## 待定候选（4 套祈道阵容，未发布）

来源：`https://qiandao.com/post?postId=1023430985116591249`（镜像合集，等级上限 B）。

四张图均为完整的六成员配置页，保留橙黄色“洛克王国”水印，但均不可发布：

- 无法可靠地把四张图与帖子中的队伍标题逐一对应；
- 只有镜像标签“洛克王国阵容镜像”，没有原作者署名；
- 没有图片发布日期；
- 图片内没有 S4/S3/S2 赛季证据；可见的 `07-20` 无年份，且早于 S4；帖子标题与合集更新时间不能作为赛季证据。

已保存为 `research/candidates/` 下的 4 个 pending 候选，未把成员、技能或血脉写入 `data/`。其中一张视觉上接近 `buling-rotation-s4`，但 SHA-256 不同，已保留原记录，未做替换。

## 拒绝记录（16 张非阵容图）

已汇总到 `research/rejected/2026-10-22T10-47-12-443Z-non-lineups.json`：

- TapTap 4 张：开服公告 banner、封面主视觉、无关角色截图、应用图标；
- Bilibili 1 张：站点 WEB logo（视频页 HTTP 412，无法核验配置画面）；
- BiliGame 8 张：首页 banner、怪物场景插画、角色头像/图标；
- 3DM 1 张：多篇文章重复出现的二维码/宣传图；
- 祈道 2 张：与 PVP 无关的毛绒盲盒图鉴表（另有 `topic?id=undefined` 畸形链接指向无关页面）。

以上图片均非完整六成员配置图，未创建任何数据记录。

## 图片与资产

- 未新增或替换 `public/assets/lineups/` 中的任何图片。
- 识图仅使用 `research/inbox/2026-10-22T10-47-12-443Z/vision/` 中已按 SHA 去重、单张不超过 192 KiB 的概览 JPEG；未附加原图、未生成放大 PNG 或额外变体。
- 每个候选的检查点已写入 `research/runs/2026-10-22T10-47-12-443Z/checkpoints/`，可在上下文压缩后继续复核。

## 攻略与教程

- 没有可核验的作者原话，未新增 `guides`。
- 没有精确对应某套阵容的可核验视频，未新增教程按钮；Bilibili 视频页返回 HTTP 412，不能算作已核验教程。

## 来源失败

- Bilibili 视频页：HTTP 412，无可用配置画面。
- 祈道：两次浏览器获取失败，仅能依赖缓存 HTML；未据此推断作者或日期。
- 新浪页面：成功获取但无可用阵容图。
- 祈道 `topic?id=undefined` 畸形链接：渲染为无关毛绒材质页面。
- 以上失败均未删除阵容、未修改归档状态、未刷新核验时间。

## 验证结果（实际执行）

由于沙箱中的 `npm run` 包装命令会触发 tsx IPC 错误（`listen EPERM ... /tmp/tsx-1001/15.pipe`），使用等价的直接命令完成验证：

| 检查 | 命令 | 结果 |
|---|---|---|
| 研究数据校验 | `node --import tsx scripts/validate/research.ts` | 通过（exit 0） |
| 覆盖报告 | `env -u GITHUB_STEP_SUMMARY node --import tsx scripts/research/coverage-report.ts` | 通过（exit 0）；`npm run research:coverage` 因 `GITHUB_STEP_SUMMARY` 只读而退出 1，但报告本身生成成功 |
| 排序 | `node --import tsx scripts/rank/run.ts` | 通过；展示 15 套 |
| 数据校验 | `node --import tsx scripts/validate/data.ts` | 通过；19 套阵容 |
| refresh guard | `node --import tsx scripts/validate/refresh-guard.ts` | 通过 |
| 测试 | `node --import tsx --test tests/*.test.ts` | 通过；**3 个测试文件、3 个测试通过、0 失败**（测试文件数不是断言数） |
| Astro 检查 | `ASTRO_TELEMETRY_DISABLED=1 npx astro check` | 通过；41 个文件 |
| 构建 | `ASTRO_TELEMETRY_DISABLED=1 npx astro build` | 通过；生成 23 个页面 |
| 站点校验 | `node --import tsx scripts/validate/site.ts` | 通过；23 个页面、393 个内部链接/资源，`base=/roco-pvp-meta` |

## 未完成的验证

- 本沙箱未能执行桌面与手机截图视觉走查，因此不声称已完成发布前视觉验收。
- 因要求的 `npm run` 包装命令未全部通过，本次不写入新的成功更新日期，也不声明已部署；部署由独立的已验证工作流负责。

## 后续优先级

1. 为祈道四张完整配置图寻找原作者、图片发布日期及图片级赛季证据；证据齐全前保持 pending。
2. 优先补查 S2、S3 的独立来源与作者原帖，改变 3DM 单一来源结构。
3. 继续核验 15 个来源中的 445 张待续图片，区分页面失败、缺图、搜索无结果与图片语义不明。
