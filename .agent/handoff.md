# Antigravity Power Pro Project Handoff (v2.6.78)

## 当前状态 (Current Status)
- **版本**: v2.6.78
- **核心变更**:
  - **默认 API 配置全量升级**：提示词增强默认配置统一更新为 TokenRhythm（API Base: `https://tokenrhythm.studio/v1`，Model: `deepseek-v4-flash`，ApiKey: `sk_tr_***`）。
  - **配置持久化 Bug 彻底修复**：修成了用户自定义 Key/URL 保存后下一次打开又回退默认的持久化 Bug。移除了 `mergePromptEnhance` 中对 `apiKey` 长度必须大于 10 的过度硬编码限制，改用标准非空校验。
  - **清洗黑名单增量对齐**：更新了 `LEGACY_API_BASES` 与 `LEGACY_MODELS`，防止版本初始化合并时误覆盖用户的有效自定义配置。
  - **版本同步与本地提交**：版本号已递增至 `v2.6.78`，通过 `npm run --prefix patcher sync-version` 实现了 6 处版本号全量同步；基础修复已提交，本轮延迟/竞态修复合入后再发 Tag。

## 待办事项 (Next Steps)
1. **正式发版 Tag**：完成本轮请求缓存、重复点击和输入替换验收后，打上 `v2.6.78` 的 Tag 并推送到远端 (`git push origin main --tags`) 以触发 GitHub Release 打包流程。
2. **实机构建与测试**：使用 `npm run tauri:build --prefix patcher` 生成最终安装器安装包，并在实际 IDE 环境验证无 Manager、二次点击和长提示词替换。

## 技术规范提醒 (Critical Reminders)
- **版本同步**：禁止手动在各处改版本号，必须手动修改 `patcher/package.json` 后运行同步脚本 `npm run --prefix patcher sync-version`。
- **配置零覆盖原则**：补丁更新时必须遵循增量合并与用户配置优先原则，严禁强行覆盖用户的自定义 `apiKey` 和 `apiBase`。
- **DOM 策略**：严禁硬编码 Tailwind 语义类名，必须使用特征无关的 `findScrollEl` 策略。
- **共享模块**：`shared/enhance.js` 为核心逻辑，修改将同时影响 Cascade 与 Manager 两个面板。
- **提示词连接**：`shared/request-engine.js` 先短探测 Launchpad 桥接，在线优先代理、离线回退直连；不要把 Manager UI 是否打开作为使用条件。
- **Launchpad 注入**：`workbench-jetski-agent.html` 必须幂等注入 `./shared/launchpad-proxy.js`，使用 `PROXY_PING/PROXY_PONG` 探测，不得等待完整 API 超时。
- **输入替换**：`shared/input-replacer.js` 的 `replaceChildren` + `input/change` 事件 + 精确回读校验是防止原文拼接的关键链路。
- **重复点击**：`shared/enhance.js` 的 `createSingleFlight()` 会锁住同一按钮的在途请求，禁止恢复为可并发写回。
- **延迟控制**：`shared/request-engine.js` 缓存 Launchpad 探测结果；在线桥接优先，短探测失败后直连，代理失败会失效缓存并快速回退。
- **道家反代共存**：现场 `dao-proxy-pro` 的语言服务器当前指向 `http://127.0.0.1:8937`；它与 UI 按钮和 `Antigravity_Fetch_Proxy` 不同层。提示词增强若使用该本地端口，会进入道家外接 API 路由，应单独核对延迟与系统提示词注入。
- **构建交付**：必须执行 `npm run tauri:build --prefix patcher`；裸 `cargo build --release` 不是可交付的 Tauri 应用。
