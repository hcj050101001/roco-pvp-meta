# 半月研究复核（2026-10-21T07-24-21-433Z）

- 赛季：S4「月涌狂想」。依据官方 TapTap 公告
  `https://www.taptap.cn/moment/847022426351994538`，`season:check` 于
  2026-10-21T07:24:17.831Z 确认无变更，`major_update_required` 保持 false。
- 补丁：`balance_patch_date` 仍为 null，未独立核实到已生效的平衡补丁公告，不对版本强
  度作任何判断。
- 核对来源：3DM 五篇公开攻略（B 级镜像，正文作者非镜像站）、TapTap 赛季公告、
  千岛与 B 站入口（均抓取失败）。未使用搜索摘要、OCR 文本或平台 AI 摘要作为作者
  原话。
- 候选：5 张，全部为已发布 S4 阵容图的 SHA-256 完全重复，无新增图片、无重复对、
  无归档、无驳回、无教学视频、无攻略引语、无热度信号变更。
- 图片：仍未改动任何原图；发布资产保持既有完整原始 WebP（含水印），未生成占位图、
  未裁切、未重编码。

## 逐条复核

| 候选 | 现有记录 | 结论 |
| --- | --- | --- |
| 雨天翼王队（艾伦） | `data/lineups/rain-wing-s4.json` | 更正火羽第二技能“禁锢烙印”→“焚烧烙印”；其余六只成员、水印、来源、日期、彩蝶鲨/莎莎差异说明保持不变 |
| 瞌睡鼠鼠队（包包） | `data/lineups/sleep-mouse-s4.json` | 第六只更正为“壳粟丝鼠”；其技能栏字迹无法可靠辨认，清空为未知而非猜测；保留已核验引语 |
| 梨螺萌蛇队（五彩小梨螺花） | `data/lineups/pear-snake-s4.json` | 与记录无实质差异，未改动 |
| 黑羽首领毒队（樟藤） | `data/lineups/black-feather-poison-s4.json` | 第五只更正为“丧卡”；毒队技能栏不可靠辨认，保持空值；既有战绩信号保留 |
| 冰露罗头队（洛王） | `data/lineups/ice-roco-s4.json` | 与记录无实质差异，未改动 |

三条更正记录写入 `last_verified_at: 2026-10-21T07:29:36+00:00`，并在
`verification_notes` 中记录具体更正点与未辨认项。逐候选证据检查点见
`checkpoints/01-rain-wing.md` 至 `05-ice-roco.md`。

来源与日期（镜像发布时刻）：

- 雨天：`https://ol.3dmgame.com/gl/355668.html`，2026-10-13T11:10:33+08:00
- 瞌睡鼠鼠：`https://ol.3dmgame.com/gl/355666.html`，2026-10-13T11:09:21+08:00
- 梨螺萌蛇：`https://ol.3dmgame.com/gl/354707.html`，2026-09-28T14:48:42+08:00
- 黑羽首领毒：`https://ol.3dmgame.com/gl/353802.html`，2026-09-20T09:17:27+08:00
- 冰露罗头：`https://ol.3dmgame.com/gl/353804.html`，2026-09-20T09:19:30+08:00

## 采集失败（不影响既有记录）

- 千岛 `https://qiandao.com/post?postId=1023430985116591249`：HTTP 405。
- B 站 `https://www.bilibili.com/video/BV1N8hk6rErM/`：HTTP 412，视频无法核验，
  因此未添加任何教学按钮，也未改动既有记录与 `last_verified_at`。

## 验证结果（实际执行）

| 命令 | 结果 |
| --- | --- |
| `npm run research:validate` | 失败：沙箱禁止 `tsx` 创建 IPC 管道（`listen EPERM /tmp/tsx-1001/*.pipe`） |
| `node --import tsx/esm scripts/validate/research.ts` | 通过：候选 5 张，重复对 0 |
| `npm run lineup:rank` 等价命令 | 通过：写入 `research/runs/2026-10-21/ranking.md`，展示 15 套 |
| `npm run validate` | 失败：同一 `tsx` IPC 限制 |
| `node --import tsx/esm scripts/validate/data.ts` | 通过：19 套阵容数据与图片校验通过 |
| `npx astro check`（`ASTRO_TELEMETRY_DISABLED=1`） | 通过：37 个文件，0 errors / 0 warnings / 0 hints |
| `npm test` | 失败：同一 `tsx` IPC 限制 |
| `node --import tsx/esm --test tests/*.test.ts` | 通过：2 项测试全部通过 |
| 构建等价命令（data 校验 + `astro build` + `site.ts`） | 通过：23 页，393 个站内链接/资源，base=/roco-pvp-meta |

## 浏览器视觉检查：未完成（沙箱限制）

已尝试用现有 Playwright 附带 Chromium 对构建产物截图，浏览器进程在启动阶段即因沙箱
限制退出（`sandbox_host_linux.cc` FATAL，SIGTRAP），加 `--no-sandbox` 仍失败；本地
HTTP 服务亦因 `listen EPERM` 无法启动。`screenshots/` 目录为空。因此本次未取得桌面或
手机截图，不能宣称视觉验收通过；该检查需由具备浏览器环境的发布工作流补做。

## 状态

- 未写入新的成功更新日期，`last_successful_update` 保持
  `2026-10-21T12:40:00+08:00`，`season_checked_at` 为 `season:check` 记录的
  2026-10-21T07:24:17.831Z。
- 未删除任何阵容或图片，未改动 `research/candidates/`、`research/rejected/`、
  `public/assets/lineups/`。
- 部署由独立的已验证工作流执行，本代理未部署。
