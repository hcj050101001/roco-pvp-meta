# 研究运行 2026-10-21T16-40-53-994Z

## 结论

本次运行**没有可支持的内容变更**。5 个候选的 SHA-256 均与网站已发布原图及既有阵容记录完全一致，且没有新的配置、版本、原话、评论或教学视频证据。5 套既有阵容全部保持原样，包括 `last_verified_at`、成员名称与顺序、攻略引用、教学视频和热度线索。生产数据未被替换或清空。

## 赛季与补丁确定性

- 当前赛季：S4「月涌狂想」，官方来源 `https://www.taptap.cn/moment/847022426351994538`。
- `season:check` 于 `2026-10-21T16:40:48.776Z` 复核，结果 `changed: false`；`season_revision: 1`，`previous_season: S3`，`season_transitions: []`。
- `major_update_required: false`。
- `balance_patch_date` 仍为 `null`：本次未发现可独立核实的平衡补丁公告，不依据论坛或镜像文章推断补丁日期。
- 本次仅更新 `data/update-state.json` 的 `season_checked_at` 时间戳；未改动赛季、版本标签、主题或策略基线。

## 检查的来源

| 来源 | 类型 | 结果 |
|---|---|---|
| `https://ol.3dmgame.com/gl/355668.html`（雨天翼王队） | 3DM 图文镜像，B 级 | 抓取成功，候选图与站内原图 SHA 一致 |
| `https://ol.3dmgame.com/gl/355666.html`（瞌睡鼠鼠队） | 3DM 图文镜像，B 级 | 抓取成功，候选图与站内原图 SHA 一致 |
| `https://ol.3dmgame.com/gl/354707.html`（梨螺萌蛇队） | 3DM 图文镜像，B 级 | 抓取成功，候选图与站内原图 SHA 一致 |
| `https://ol.3dmgame.com/gl/353802.html`（黑羽首领毒队） | 3DM 图文镜像，B 级 | 抓取成功，候选图与站内原图 SHA 一致 |
| `https://ol.3dmgame.com/gl/353804.html`（冰露罗头队） | 3DM 图文镜像，B 级 | 抓取成功，候选图与站内原图 SHA 一致 |
| 8 条公开搜索查询（当季一图流、千岛、TapTap、3DM、Bilibili、抖音） | 发现线索 | 全部 `no_results` |

镜像文章仅按 B 级证据记录，未冒充原作者；本次未新增或改写任何攻略引用。

## 候选判定（5/5 已完成）

逐候选证据检查点保存在 `research/runs/2026-10-21T16-40-53-994Z/checkpoints/`。

| 候选 | SHA-256（前缀） | 既有记录 | 判定 |
|---|---|---|---|
| 雨天翼王队（艾伦） | `1f398c9ec783` | `rain-wing-s4` | 精确重复，无新证据，原样保留 |
| 瞌睡鼠鼠队（包包） | `4ce133272b94` | `sleep-mouse-s4` | 精确重复，无新证据，原样保留 |
| 梨螺萌蛇队（五彩小梨螺花） | `deaa724fe740` | `pear-snake-s4` | 精确重复，无新证据，原样保留 |
| 黑羽首领毒队（樟藤） | `2cf5548f5a02` | `black-feather-poison-s4` | 精确重复，无新证据，原样保留 |
| 冰露罗头队（洛王） | `bf128b3ad110` | `ice-roco-s4` | 精确重复，无新证据，原样保留 |

重复核对方式：候选 SHA-256 同时等于 `public/assets/lineups/<slug>/` 下已发布原图的实测 SHA-256、记录内 `sha256` 字段及原图尺寸；候选来源 URL 与记录来源一致。

因属于“相同 SHA + 无新配置/版本/原话/视频证据”的无变化情形，未重复 OCR、未刷新核验日期、未改写成员名称或顺序。

## 新增

- 无。

## 更新

- 无内容更新。
- `data/update-state.json` 仅由既有 `season:check` 更新 `season_checked_at`。
- 未更新 `last_research_at` 或 `last_successful_update`，因为本次没有受支持的内容变更。

## 归档

- 无。没有任何证据表明既有阵容被取代，故不归档、不删除记录或图片。

## 拒绝

- 无新增拒绝项。
- 历史 OCR 名称修订建议 `壳粟丝鼠`、`丧卡` 仍仅保留在 `research/candidates/2026-10-21-ocr-names.json`，等待独立复核；未应用到阵容记录。

## 图片与资产

- 未新增、替换或删除任何图片资产。
- 未用预览图替换已发布原图；网站继续使用完整原图。
- 未查看或重复附送原图，未生成放大 PNG 或额外图片变体。

## 教学视频

- 未新增或修改教学视频。
- `ice-roco-s4` 既有精确标题抖音教学保持原样，本次未重新核验或替换。

## 来源失败

仅记录，不影响任何阵容、归档状态或核验时间：

| 来源 | 状态 | 时间 |
|---|---|---|
| `https://qiandao.com/post?postId=1023430985116591249` | HTTP 405 | `2026-10-21T16:41:32.584Z` |
| `https://www.bilibili.com/video/BV1N8hk6rErM/` | HTTP 412 | `2026-10-21T16:41:34.088Z` |

## 验证结果

`npm run` 的 `tsx` CLI 在当前沙箱中因 `/tmp/tsx-<uid>/<pid>.pipe` 监听返回 `EPERM` 而无法启动，因此使用等价的 `node --import tsx` 入口执行同一脚本；Astro 命令直接调用本地二进制。

| 检查 | 命令 | 结果 |
|---|---|---|
| 研究校验 | `node --import tsx scripts/validate/research.ts` | 通过：候选 5 张，重复对 0，等待证据判断 |
| 排序报告 | `node --import tsx scripts/rank/run.ts` | 通过：输出 `research/runs/2026-10-22/ranking.md`，展示 15 套 |
| 数据与图片校验 | `node --import tsx scripts/validate/data.ts` | 通过：19 套阵容 |
| 非破坏性刷新检查 | `node --import tsx scripts/validate/refresh-guard.ts` | 通过 |
| 类型检查 | `node_modules/.bin/astro check` | 通过：37 个文件，0 错误、0 警告、0 提示 |
| 测试 | `node --import tsx --test tests/*.test.ts` | 通过：2/2 |
| 构建 | `node_modules/.bin/astro build` | 通过：23 个页面 |
| 站点校验 | `node --import tsx scripts/validate/site.ts` | 通过：23 页、393 个站内链接/资源，base=`/roco-pvp-meta` |

## 发布状态

- 本次没有受支持的生产内容变更，现有生产数据完整保留。
- 未执行推送、部署或外部发布；部署由独立的已验证工作流任务负责。
