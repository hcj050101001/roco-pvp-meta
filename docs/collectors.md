# 公开来源采集器

采集器用于发现阵容资料和整理候选证据，不负责判定阵容真伪，也不会直接修改生产阵容。每次运行写入 `research/inbox/<run-id>/`，其中网页、图片节点、评论和字幕都属于不可信来源数据。

## 命令

```sh
npm run research:collect       # 采集 data/sources.json 中启用的来源
npm run research:discover      # Bing RSS 搜索后采集发现的支持平台链接
npm run research:full          # 全赛季、多平台 discover + 无登录 Chromium 页面渲染
npm run research:full -- --scope history # 单独历史补档
npm run research:coverage      # 按平台、赛季报告发现与收录覆盖
npm run research:validate     # 对最新 run 统计候选图和重复项，不自动认证
npm run research:vision       # SHA 去重后生成字节受限的模型识图 JPEG，不修改原图
npm run season:check          # 由可信官方已生效公告核对赛季
```

可用 `--seeds <json文件>` 导入 URL 字符串数组：

```sh
node node_modules/tsx/dist/cli.mjs scripts/collect/run.ts --seeds path/to/urls.json
```

完整发现策略见 [多来源、跨赛季策略](research-strategy.md)。平台、预算和诊断目标在 `data/research-policy.json`；默认自动读取扩展种子及跨轮待续查链接。

## 当前实现

- `search.ts` 读取 `data/search-queries.json`，按平台和全部目标赛季生成查询，先从公开 Bing RSS 获取结果、无支持结果时尝试 Bing HTML，并解码结果追踪 URL；只接受配置允许的平台域名，并保存搜索响应与来源健康状态。
- `run.ts` 合并 `data/sources.json`、扩展种子、已发布当季与历史出处和待续查队列，按平台及赛季公平分配采集预算，提取标题、正文线索和图片节点；符合 URL 特征的候选图片可下载到 inbox 并计算 SHA-256、感知哈希和尺寸。采集结果会标为未验证。同一时间只跑一个采集进程：启动时对 `research/.research.lock` 加 `flock`，锁被占用则打印持有进程 PID 并退出，不写入 inbox。
- `network.ts` 只请求公开 HTTPS。每一跳重定向都会重新解析并拒绝私有地址；实际连接使用该跳已核验的地址，并在连上后核对远端地址，避免 DNS 重绑定。浏览器补充仍在导航前拒绝非公开 URL，不绕过登录或验证码。
- `browser.ts` 使用全新无登录 Chromium 上下文，滚动触发公开页面懒加载并保存页面快照。访问验证或无法访问时记录失败，不尝试绕过。可通过 `RESEARCH_CHROMIUM_PATH` 选择已有浏览器；浏览器补充失败时保留已经合法抓取的公开 HTML。
- `extract/page.ts` 解析常见图片属性、`srcset`、`picture`、链接、Open Graph、JSON-LD 和可识别的内嵌 JSON。
- `extract/image.ts` 识别图片格式并计算尺寸、SHA-256、pHash；哈希和尺寸只能证明文件属性，不能证明内容是某套真实阵容。
- `validate/research.ts` 生成候选与重复图报告。人工视觉核对、图片映射、版本和成员确认仍需维护流程处理。
- `research/vision.ts` 从最新 manifest 去重候选原图，为模型准备不超过 192 KiB 的 JPEG 概览和原尺寸重叠分块，保存 `vision/index.json`。保留原图字节及全部来源关联，不将 JPEG 预览发布到网站。32,000 tokens 的上下文压缩与逐候选研究记录限制对话中累积的图片；禁止模型自行放大 PNG 或重复附图。
- `season.ts` 只接受指定 TapTap 官方账号发布且已生效的赛季公告。公告不可访问或证据不符合条件时保留现有赛季。

`coverage.json`/`coverage.md` 区分查询范围、请求成功和候选图片，给出每个平台、每个赛季的覆盖及未收录哈希；哈希不等于真实新队。超预算链接保存在 `research/candidates/discovery-backlog.json`，图片候选超预算项留在 manifest，不静默当作已处理。

## 晋升与安全边界

生产内容必须遵守 `.agents/skills/roco-pvp-site-maintainer/SKILL.md` 和 `src/lib/schema.ts`。候选必须核实完整真实配置图、图片中六只精灵、所属赛季和来源；技能、血脉、作者攻略、实绩/热度记录、视频匹配只在有直接证据时填写。不得凭搜索摘要、相邻图片、同体系视频或平台 AI 摘要推断。

不访问需要登录、验证码、付费、DRM、私人 Cookie 或其他访问绕过的内容。来源失败只写健康记录，不得据此删除、归档或刷新已有资料。手动发布前须校验现有记录、图片哈希、测试和构建；失败时不部署候选数据。

图片 SHA 与既有资料一致且没有新配置/版本/原话/视频证据时保留原记录。已有成员名称及顺序不可被自动 OCR 修订覆盖，`refresh:guard` 会独立拒绝；可能的更正只写入 `research/candidates/`，等待单独核验。

采集器只在用户主动提出更新后，由助手按任务需要运行。若需模型识图，先运行 `research:vision` 准备受限 JPEG，再在当前任务中逐图核对；模型连接成功不代表候选已验证。

## 证据保存

`research/inbox/` 与 `research/baseline.json` 在 `.gitignore` 中忽略，避免提交原始网页快照或临时基线。可提交且与具体研究任务有关的结论记录放在 `research/runs/<run-id>/`。研究摘要只记录实际执行过的来源检查和验证，不将历史一次性结果写成采集器的永久能力保证。
