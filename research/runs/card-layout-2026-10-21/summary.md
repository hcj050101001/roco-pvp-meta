# 卡片视觉修复

- 线上复现：洛尘布灵轮转队使用宽幅图，原卡片按原图高度排版，同排标题和卡片底边错位；带视频卡片额外一栏又撑高整行，留下空档。
- 修复：统一4:3图片预览框，object-fit:contain完整容纳原图；卡片按行等高，标题位置对齐；视频与配置入口并入同一底部操作区。详情原图保持自然宽高比。
- 修改范围：src/styles/player.css、src/components/LineupCard.astro、tests/browser/site.spec.ts、AGENTS.md及维护Skill。未修改阵容资料或原图。
- 实际验证：类型检查无错误/警告；19套原图哈希及尺寸校验通过；生产构建23页及391个站内链接通过；8项桌面/手机浏览器测试通过。
- 视觉核查：当季15张、历史4张，在1440桌面和390手机分别逐卡截图，共38张。已实际查看全部截图汇总及洛尘布灵轮转队单卡，检查横图留白、完整图、水印、标题、成员、底部入口及边界。
- 留存：artifacts/cards-desktop/、artifacts/cards-mobile/、artifacts/audit-{desktop,mobile}-{1..4}.png、整页截图。CI的ui-evidence会保存逐卡及整页截图。
- 后续发布前必须查看逐卡截图，不能把首屏、加载检查或测试通过当作视觉验收。
