# Antigravity Power Pro Project Handoff (v2.6.72)

## 当前状态 (Current Status)
- **版本**: v2.6.72
- **核心变更**:
  - **默认 API 配置全量升级**：提示词增强默认配置统一更新为 TokenRhythm（API Base: `https://tokenrhythm.studio/v1`，Model: `deepseek-v4-flash`，ApiKey: `sk_tr_8a8uvItmEItosRIGXcGHhc49BuDqJrP8uQrhOeeyFA0`）。
  - **配置持久化 Bug 彻底修复**：修成了用户自定义 Key/URL 保存后下一次打开又回退默认的持久化 Bug。移除了 `mergePromptEnhance` 中对 `apiKey` 长度必须大于 10 的过度硬编码限制，改用标准非空校验。
  - **清洗黑名单增量对齐**：更新了 `LEGACY_API_BASES` 与 `LEGACY_MODELS`，防止版本初始化合并时误覆盖用户的有效自定义配置。
  - **版本同步与代码上云**：版本号已递增至 `v2.6.72`，通过 `npm run --prefix patcher sync-version` 实现了 6 处版本号全量同步，且代码已提交并推送至 `main` 远程分支。

## 待办事项 (Next Steps)
1. **正式发版 Tag**：执行 `/tag` 工作流，打上 `v2.6.72` 的 Tag 并推送到远端 (`git push origin v2.6.72` / `git push origin --tags`) 以触发 GitHub Release 打包流程。
2. **实机构建与测试**：使用 `npm run --prefix patcher tauri:build` 生成最终安装器安装包，并在实际 IDE 环境验证提示词增强持久化效果。

## 技术规范提醒 (Critical Reminders)
- **版本同步**：禁止手动在各处改版本号，必须手动修改 `patcher/package.json` 后运行同步脚本 `npm run --prefix patcher sync-version`。
- **配置零覆盖原则**：补丁更新时必须遵循增量合并与用户配置优先原则，严禁强行覆盖用户的自定义 `apiKey` 和 `apiBase`。
- **DOM 策略**：严禁硬编码 Tailwind 语义类名，必须使用特征无关的 `findScrollEl` 策略。
- **共享模块**：`shared/enhance.js` 为核心逻辑，修改将同时影响 Cascade 与 Manager 两个面板。
