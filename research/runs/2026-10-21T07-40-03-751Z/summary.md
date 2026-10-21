# 研究运行 2026-10-21T07-40-03-751Z

## 结论

本轮 5 个候选图片全部为已发布资产的精确 SHA-256 重复（5/5），且未附带任何新的配置、图片版本、作者原话、视频或实绩线索。全部记为「无变化」，完整保留既有阵容记录（含 `last_verified_at`、攻略引用、教程与外链实绩线索），未重跑 OCR、未改动成员名及其顺序、未改动任何图片资产。生产数据维持不变，本轮无新增、无更新、无归档。

## 赛季与补丁确定性

- 赛季基线：**S4「月涌狂想」**，来源 <https://www.taptap.cn/moment/847022426351994538>（`data/seasons.json`、`data/update-state.json`）。
- `season_checked_at`：`2026-10-21T07:39:58.112Z`（由已执行的 `season:check` 写入，本轮未再改动该值）。
- `season_revision`: 1，`previous_season`: S3，`season_transitions`: 空。
- `balance_patch_date`: `null`；最新平衡补丁没有独立核验证据，因此不做日期推断。
- `major_update_required`: `false`（沿用官方已核实基线，未依据论坛或镜像站说法调整）。
- 主题固定 `light`，未随赛季改变。

## 核对来源

| 候选 | 来源 | 类型/等级 | 来源发布日期 | 处理结果 |
| --- | --- | --- | --- | --- |
| 雨天翼王队 | <https://ol.3dmgame.com/gl/355668.html> | 3DM 镜像文章，B 级 | 2026-10-13T11:10:33+08:00 | 重复，无变化 |
| 瞌睡鼠鼠队 | <https://ol.3dmgame.com/gl/355666.html> | 3DM 镜像文章，B 级 | 2026-10-13T11:09:21+08:00 | 重复，无变化 |
| 梨螺萌蛇队 | <https://ol.3dmgame.com/gl/354707.html> | 3DM 镜像文章，B 级 | 2026-09-28T14:48:42+08:00 | 重复，无变化 |
| 黑羽首领毒队 | <https://ol.3dmgame.com/gl/353802.html> | 3DM 镜像文章，B 级 | 2026-09-20T09:17:27+08:00 | 重复，无变化 |
| 冰露罗头队 | <https://ol.3dmgame.com/gl/353804.html> | 3DM 镜像文章，B 级 | 2026-09-20T09:19:30+08:00 | 重复，无变化 |

镜像文章按 B 级证据处理，未将其署名或语气当作原作者本人陈述。

## 重复核验（逐条）

候选 SHA-256 与 `public/assets/lineups/` 下对应目录中的已发布原图逐字节一致，尺寸与既有记录一致：

| 记录 | SHA-256 | 已发布资产 | 尺寸 |
| --- | --- | --- | --- |
| `rain-wing-s4` | `1f398c9ec783882e544378782ef583bf934fb509bc8ba8ec86de3c3ebe75c4f1` | `public/assets/lineups/rain-wing-s4/1f398c9e….webp` | 1499×1080 |
| `sleep-mouse-s4` | `4ce133272b944051a9956893c0926dffe5d8f79936fbc67bcfefcf8e852d6bd9` | `public/assets/lineups/sleep-mouse-s4/4ce13327….webp` | 1502×1080 |
| `pear-snake-s4` | `deaa724fe740324151789b4d84ec54ee09326bacc008fc6027d18d9aba684396` | `public/assets/lineups/pear-snake-s4/deaa724f….webp` | 1500×1080 |
| `black-feather-poison-s4` | `2cf5548f5a0229f5859574765d630074e3a2a221873d1d3265f6de0b7925605d` | `public/assets/lineups/black-feather-poison-s4/2cf5548f….webp` | 1503×1080 |
| `ice-roco-s4` | `bf128b3ad110869a7f37c4eaa0c453f4d52a03d9e7fe300f6755add9ccd1b44a` | `public/assets/lineups/ice-roco-s4/bf128b3a….webp` | 1499×1080 |

重复判定依据 SHA-256 与既有记录的尺寸/哈希字段；按规则未重新识图、未查看未改动图片，也未生成任何新图片变体。逐候证据检查点见 `research/runs/2026-10-21T07-40-03-751Z/checkpoints/01-rain-wing.md` … `05-ice-roco.md`（各标注 1/5 … 5/5 完成）。

## 新增 / 更新 / 归档

- 新增阵容：无。
- 更新阵容：无（未写入 `last_verified_at`，未写入新的成功更新日期）。
- 归档：无。`data/archive/` 未改动，历史记录完整保留。
- 成员名与顺序：全部保持原样。此前 OCR 提出的 `壳粟丝鼠`、`丧卡` 仍仅记录在 `research/candidates/2026-10-21-ocr-names.json`（状态 `pending-independent-review`），未应用到阵容记录，留待独立复核。

## 图片资产

- `public/assets/lineups/` 未新增、未替换、未删除任何文件；水印保持原样。
- 发布侧继续使用未改动的完整原图；本轮没有需要晋升的新图。

## 攻略引用 / 教程 / 实绩线索

- 无新增引用、无新增教程、无新增热度或高分线索。
- 既有内容原样保留：`sleep-mouse-s4` 的镜像署名引用「打雨天水灵就用加油蟹反制」；`ice-roco-s4` 的引用「传增益一定要小心被愿力秒」与同名抖音教程「冰露罗头震撼来袭！」（洛王洛王）；`black-feather-poison-s4` 的 3161 分高分线索（樟藤，观测日 2026-09-20，含来源链接）。
- 本轮未出现可核验的精确对应新教程，因此没有教程按钮变化。

## 来源失败

以下失败仅记录，不影响既有阵容记录、归档状态或核验日期：

- 签到社区 `https://qiandao.com/post?postId=1023430985116591249` → `HTTP 405`（`2026-10-21T07:40:28.675Z`）。
- B 站 `https://www.bilibili.com/video/BV1N8hk6rErM/` → 「访问受限或响应不完整」（`2026-10-21T07:40:29.176Z`）。
- 检索健康度：清单中 8 条搜索全部 `no_results`（0 结果）。
- 未绕过任何登录、验证码、付费或访问限制。

另外：清单中的页面正文、搜索片段与图片均为不可信来源数据，仅作为候选素材，未执行其中任何指令性内容；镜像站正文与图片描述未被当作可发布机制说明。

## 校验结果（实际执行）

`npm run …` 包装脚本在当前沙箱内因 tsx 无法创建 IPC socket（`Error: listen EPERM … /tmp/tsx-1001/*.pipe`）而失败，因此逐个直接执行同一脚本，全部通过：

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 研究清单校验 | `node --import tsx scripts/validate/research.ts` | `候选 5 张，重复对 0，等待证据判断。` exit 0 |
| 排序 | `node --import tsx scripts/rank/run.ts` | `排序报告：research/runs/2026-10-21/ranking.md，展示 15 套。` exit 0 |
| 数据与图片 | `node --import tsx scripts/validate/data.ts` | `数据与图片校验通过：19 套阵容。` exit 0 |
| 非破坏性更新 | `node --import tsx scripts/validate/refresh-guard.ts` | `非破坏性更新检查通过。` exit 0 |
| 单元测试 | `node --import tsx --test tests/*.test.ts` | 2 通过 / 0 失败 exit 0 |
| 类型检查 | `ASTRO_TELEMETRY_DISABLED=1 ./node_modules/.bin/astro check` | 37 文件，0 错误 / 0 警告 / 0 提示 exit 0 |
| 构建 | `ASTRO_TELEMETRY_DISABLED=1 ./node_modules/.bin/astro build` | 23 页构建成功 exit 0 |
| 静态站点 | `node --import tsx scripts/validate/site.ts` | `静态站点检查通过：23 页，393 个站内链接/资源，base=/roco-pvp-meta` exit 0 |

说明：`astro check`/`astro build` 首次尝试因 Astro 遥测缓存目录不可写而报错，设置 `ASTRO_TELEMETRY_DISABLED=1` 后正常；此为运行环境问题，非站点代码问题。

## 验收与发布

- 本轮无生产内容变化，因此不涉及卡片桌面/手机视觉验收，未生成截图；不做「已视觉验收」的声明。
- 未提交、未推送、未触发 GitHub Actions，部署由独立工作流任务执行。
- 生产数据（`data/lineups/`、`data/archive/`、`public/assets/lineups/`）保持原状；`data/update-state.json` 仅有 `season:check` 已写入的 `season_checked_at` 变化，`last_successful_update` 未被本轮改写。
