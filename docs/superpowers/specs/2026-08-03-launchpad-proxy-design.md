# Launchpad 代理桥接设计

## 目标

修复侧边栏提示词增强通过 BroadcastChannel 请求 Launchpad 代理时，因 Launchpad 页面未加载响应端而触发 `Proxy Fetch Timeout` 的问题，并让支持 CORS 的 API 在不打开 Ctrl+E 时可直接使用。

## 根因证据

- 运行中的 Antigravity 主进程命令行包含 `--remote-debugging-port=9000`。
- CDP 页面包含 `workbench.html` 和 `workbench-jetski-agent.html`。
- `workbench.html` 加载 `shared/enhance.js`，Launchpad 页面没有加载任何补丁脚本。
- `shared/enhance.js` 的响应监听器只在 `workbench-jetski-agent.html` 页面工作，因此当前请求没有消费者。

## 设计

将请求链路调整为“直连优先、代理回退”，并将 BroadcastChannel 代理传输拆为 `shared/launchpad-proxy.js`：

1. 侧边栏先直接调用 API；直连成功时不需要 Launchpad。
2. 直连失败且处于 `vscode-file` 侧边栏时，再通过同一通道调用 Launchpad。
3. Launchpad HTML 独立加载该模块，由模块在 jetski 页面注册响应监听器。
4. 安装器在提示词增强功能任一侧启用时幂等注入 Launchpad 代理脚本；两侧都关闭时移除标记块。
5. 保留请求格式、API URL、请求体和提示词增强输出处理。

## 生命周期

- 安装/更新：复制共享模块并同步 Launchpad 注入。
- 关闭功能：移除代理注入标记，但不触碰原始 HTML 其他内容。
- 卸载：沿用现有备份恢复流程，并通过标记移除兜底清理代理注入。

## 验证

- JavaScript 单元测试验证请求响应、错误响应和超时清理。
- Rust 测试验证 Launchpad HTML 注入幂等、关闭时移除且保留原内容。
- `npm run build`、`cargo test`。
- 9000 CDP 运行时验证 Launchpad 页面加载代理模块并能收到代理请求。
