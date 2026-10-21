# 公开来源采集器

采集器用于发现阵容资料和整理候选证据，不负责判定阵容真伪，也不会直接修改生产阵容。每次运行写入 `research/inbox/<run-id>/`，其中网页、图片节点、评论和字幕都属于不可信来源数据。

## 命令

```sh
npm run research:collect       # 采集 data/sources.json 中启用的来源
npm run research:discover      # Bing RSS 搜索后采集发现的支持平台链接
npm run research:full          # discover + 无登录 Chromium 页面渲染
npm run research:validate     # 对最新 run 统计候选图和重复项，不自动认证
npm run research:vision       # SHA 去重后生成字节受限的模型识图 JPEG，不修改原图
npm run season:check          # 由可信官方已生效公告核对赛季
```

可用 `--seeds <json文件>` 导入 URL 字符串数组：

```sh
node node_modules/tsx/dist/cli.mjs scripts/collect/run.ts --seeds path/to/urls.json
```

## 当前实现

- `search.ts` 读取 `data/search-queries.json`，从公开 Bing RSS 获取结果；只接受配置允许的平台域名，并保存搜索响应与来源健康状态。
- `run.ts` 从 `data/sources.json` 读取启用来源，提取标题、正文线索和图片节点；符合 URL 特征的候选图片可下载到 inbox 并计算 SHA-256、感知哈希和尺寸。采集结果会标为未验证。
- `browser.ts` 使用全新无登录 Chromium 上下文，滚动触发公开页面懒加载并保存页面快照。访问验证或无法访问时记录失败，不尝试绕过。
- `extract/page.ts` 解析常见图片属性、`srcset`、`picture`、链接、Open Graph、JSON-LD 和可识别的内嵌 JSON。
- `extract/image.ts` 识别图片格式并计算尺寸、SHA-256、pHash；哈希和尺寸只能证明文件属性，不能证明内容是某套真实阵容。
- `validate/research.ts` 生成候选与重复图报告。人工视觉核对、图片映射、版本和成员确认仍需维护流程处理。
- `research/vision.ts` 从最新 manifest 去重候选原图，为模型准备不超过 192 KiB 的 JPEG 概览和原尺寸重叠分块，保存 `vision/index.json`。保留原图字节及全部来源关联，不将 JPEG 预览发布到网站。32,000 tokens 的上下文压缩与逐候选研究记录限制对话中累积的图片；禁止模型自行放大 PNG 或重复附图。
- `season.ts` 只接受指定 TapTap 官方账号发布且已生效的赛季公告。公告不可访问或证据不符合条件时保留现有赛季。

## 晋升与安全边界

生产内容必须遵守 `.agents/skills/roco-pvp-site-maintainer/SKILL.md` 和 `src/lib/schema.ts`。候选必须核实完整真实配置图、图片中六只精灵、所属赛季和来源；技能、血脉、作者攻略、实绩/热度记录、视频匹配只在有直接证据时填写。不得凭搜索摘要、相邻图片、同体系视频或平台 AI 摘要推断。

不访问需要登录、验证码、付费、DRM、私人 Cookie 或其他访问绕过的内容。来源失败只写健康记录，不得据此删除、归档或刷新已有资料。自动发布 job 会再次校验现有记录、图片哈希、测试和构建；失败时不部署候选数据。

图片 SHA 与既有资料一致且没有新配置/版本/原话/视频证据时保留原记录。已有成员名称及顺序不可被自动 OCR 修订覆盖，`refresh:guard` 会独立拒绝；可能的更正只写入 `research/candidates/`，等待单独核验。

半月流程使用 DeepSeek Responses API 的 `deepseek-flash` 处理采集证据并核对图片，凭证仅保存在 GitHub Secret `DEEPSEEK_API_KEY`。Codex Action 负责工具执行和隔离代理，模型请求目标为 `https://api.deepseek.com/responses`。`Verify DeepSeek connection` 是独立的真实接口检查，验证文件工具和图片输入，不修改生产内容；通过连通性检查不代表已完成某次阵容研究。

## 证据保存

`research/inbox/` 与 `research/baseline.json` 在 `.gitignore` 中忽略，避免提交原始网页快照或临时基线。可提交且与具体研究任务有关的结论记录放在 `research/runs/<run-id>/`；GitHub Actions 也会上传有限期 artifact。研究摘要只记录实际执行过的来源检查和验证，不将历史一次性结果写成采集器的永久能力保证。
