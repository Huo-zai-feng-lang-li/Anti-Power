# 提示词增强代理修复记录

## v2.6.78 目标修复

- API 请求：Cascade/Manager 侧先用短超时探测 Launchpad 桥接；在线时直接走桥接，离线时走原生 HTTP / Fetch / XHR 回退，避免把 Manager UI 当成使用前提。
- 输入替换：contenteditable 先清理 Selection/Range，再原子替换全部子节点，派发输入事件并精确校验，避免增强结果与原文拼接。
- 竞态保护：增强按钮单飞，同一按钮的重复点击共享同一个在途请求；Manager 重渲染后重新解析仍连接的输入框。
- 延迟优化：Launchpad 可用性探测缓存 10 秒（不可用缓存 500ms），探测超时缩短为 120ms，移除成功写回路径上的固定等待。
- 安装注入：安装器向 `workbench-jetski-agent.html` 幂等注入 Launchpad 代理脚本，卸载时按标记清理。

### v2.78 验收边界

- CORS 开放的 API：无 Launchpad 时可以直连。
- 不开放 CORS 且 Electron 原生 `require` 不可用的 API：必须有在线 Launchpad 桥接；浏览器 `file://` 页面本身没有跨域绕过能力。
- 道家反代共存：其当前本地 HTTP 反代端口为 `127.0.0.1:8937`，只影响语言服务器/本地反代路由；提示词增强 API 不要误配到该端口，除非明确需要走该反代。
- 交付程序必须来自 `npm run tauri:build --prefix patcher`，不能使用裸 `cargo build --release` 产物。

## 目标

修复 Launchpad 代理响应端未加载导致的 `Proxy Fetch Timeout`。

## 已完成取证

- 运行中的 Antigravity 主进程命令行包含 `--remote-debugging-port=9000`。
- CDP 可访问主工作台和 Launchpad 页面。
- 主工作台加载 `shared/enhance.js`；Launchpad 当前资源列表为空，没有 Manager/代理补丁脚本。
- 现有 `enhance.js` 响应监听器只在 jetski 页面处理请求，因此请求无消费者。

## 执行状态

- [x] 根因确认并获用户批准修复方案
- [x] 写入设计与实现计划
- [x] TDD 失败测试：JS 缺失模块失败，Rust 缺失 helper 失败
- [x] 代理传输拆分：JS 4/4 通过
- [x] 安装器注入与卸载清理：Rust 4/4 通过
- [x] 全量测试、构建和差异检查
- [ ] 用户重启并通过 CDP 验证已安装桥接
- [x] 直连优先：支持 CORS 的 API 无需 Ctrl+E

## 约束

- 不改 API 请求协议、模型配置和提示词业务逻辑。
- 只通过项目自有 HTML 标记块注入/清理 Launchpad 代理脚本。

## 验证证据

- `node --test patcher/tests/launchpad-proxy.test.js`：6 passed。
- `cargo test --manifest-path patcher/src-tauri/Cargo.toml`：4 passed，0 failed。
- `npm run build --prefix patcher`：成功。
- Release executable：`patcher/src-tauri/target/release/Antigravity-Power-Pro.exe` 已生成。
- `cargo build --manifest-path patcher/src-tauri/Cargo.toml --release`：成功。
- `git diff --check`：通过。
- `cargo fmt --check`：未通过，原因是仓库既有多文件格式差异；未执行全仓格式化。
- NSIS 打包：失败于下载外部 `nsis-3.11.zip` 超时。

## 构建产物纠正

- `cargo build --release` 不是可交付 Tauri 应用，会回退到 `devUrl=http://localhost:5173`。
- 正确命令：`npm run tauri:build --prefix patcher`。
- 该命令已生成并启动原生窗口 `Antigravity-Power-Pro Patcher`；NSIS 仅在最后打包阶段受外部下载超时影响。
