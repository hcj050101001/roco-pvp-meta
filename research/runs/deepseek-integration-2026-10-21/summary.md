# DeepSeek 接入验证（2026-10-21）

- 半月研究改用 GitHub Secret `DEEPSEEK_API_KEY`，实际模型为 `deepseek-flash`，请求发往 `https://api.deepseek.com/responses`。Codex CLI 固定为 0.163.0，图片及工具能力由提交到仓库的模型目录声明。
- 每月 1 日、16 日北京时间 03:17 的调度保持不变；每日官方换季检查在有密钥时继续触发重大更新研究，允许该入口使用的 `github-actions[bot]` 调用研究 Action。
- 第一次接入检查在本地模型目录解析时失败，未调用模型；已按固定版本的 ModelInfo 补齐必填字段并重新验证。
- [真实接口检查 39559610722](https://github.com/hcj050101001/roco-pvp-meta/actions/runs/39559610722) 成功：DeepSeek 完成 Responses 流式响应、随机文件读取，以及只存在于 PNG 中的随机六位数识别；结果与运行器保存的预期值一致。此检查不修改生产内容。
- 本地实际运行 `research:validate`、`lineup:rank`、`validate`、`check`、`test`、带 `/roco-pvp-meta` 的 `build` 和 `test:ui`。19 套数据与原图一致，类型检查无错误，10 项单元测试、8 项桌面/手机浏览器测试通过；23 页及 393 个站内链接/资源校验通过。
- 已检查 19 张卡片各自的桌面和手机截图，共 38 张；完整原图、标题和底部操作正常。截图在忽略的 `artifacts/`，本次不改页面或阵容数据。
- [接入配置对应的 Pages 发布 39559608365](https://github.com/hcj050101001/roco-pvp-meta/actions/runs/39559608365) 成功，线上首页 HTTP 200、标题正确。
- [完整研究 39559722303](https://github.com/hcj050101001/roco-pvp-meta/actions/runs/39559722303) 已手动启动；该批次的内容结果以其独立研究摘要及 Actions 最终状态为准，接口检查成功不等于该批次资料已复核完成。
- 没有新增/归档阵容、替换配置图或挂接新教程，没有更改生产数据的验证日期。
