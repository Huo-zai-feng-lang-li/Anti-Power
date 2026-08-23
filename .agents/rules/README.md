# Antigravity-Power-Pro 规则速记

> 目标：让后续修改的人一眼看到项目边界、易错点和必测项。

## 1. 项目边界

- `patcher/patches/`：运行时补丁源码，改 UI / 注入 / 写回逻辑都优先看这里。
- `patcher/src-tauri/`：安装、检测、备份、写盘、版本同步。
- `patcher/src/`：安装器前端 UI。
- `.agent/`：跨会话规则和待办。

## 2. 最容易写错的地方

- **提示词增强的测试连接**在安装器链路里：
  - 前端：`patcher/src/components/PromptEnhanceCard.vue`
  - 后端：`patcher/src-tauri/src/commands/prompt.rs`
  - 这里只传当前表单里的 `provider`、`apiBase`、`apiKey`、`model`。
  - 不要误改 `patcher/patches/shared/enhance.js`，它只管 IDE 内真实增强。

- **共享模块职责要分开**：
  - `shared/enhance.js`：提示词业务、system prompt、回填、toast。
  - `shared/request-engine.js`：请求编排、桥接探测、超时分流。
  - `shared/launchpad-proxy.js`：BroadcastChannel 代理。

- **回填 contenteditable 时不要偷懒**：
  - `setInputValue()` 必须先清空旧 `Selection/Range`。
  - `replaceContenteditableDom()` 要做原子替换，再触发 `input/change`。
  - 最后用 `getInputValue()` 校验。
  - 禁止回退到 `innerText = ""`、`insertHTML`、只在末尾追加文本。
  - 现在的 `replaceContenteditableDom()` 会按行写入并保留 `pre-wrap`，要保留换行/缩进就继续改这里，不要散到调用方。

- **跨域/代理边界**：
  - `file://` 页面没有浏览器端跨域绕过能力。
  - 在线 Launchpad 桥接可用就走代理；不可用时才走直连。
  - 不要靠改请求头“伪造修复” CORS。
  - 只要 `apiBase` 明确指向 `http://127.0.0.1:8937` 这类本地端口，就要按道家本地反代链路理解延迟和返回结果。

- **写入和按钮都要保留隔离**：
  - Cascade / Manager 两边的扫描和按钮逻辑不要混。
  - Manager 里重渲染后要重新找当前输入框，不能只记旧节点。
  - Tailwind DOM 只能用特征无关的滚动容器识别，不要塞语义类名。

- **生成长度不要放飞**：
  - 现在 `shared/enhance.js` 里 OpenAI `max_tokens=512`，Anthropic `max_tokens=768`。
  - 改这里就是在改响应时延和输出长度，不要忘记同步体验。

- **配置和版本不要覆写**：
  - `config.json` 只能增量合并，别把用户的 `apiKey` 和自定义 `apiBase` 冲掉。
  - 改版本只改 `patcher/package.json`，然后跑 `npm run --prefix patcher sync-version` 对齐其余 5 处。

- **Mermaid 离线渲染与宿主环境边界（避坑与排查血泪史）**：
  1. **离线独立 Bundle 原则**：严禁在运行时补丁中依赖外网 CDN 或 node_modules 的 IIFE mermaid（存在作用域隔离读不到全局）。必须优先加载 IDE 内置的 `extensions/mermaid-chat-features/chat-webview-out/index.js` 并将 `US`/`ih` 挂载到 `window.mermaid`。
  2. **虚拟滚动（Virtual Scroll）按需挂载特性**：Antigravity 聊天面板采用虚拟列表技术，历史与离屏消息 DOM 会被动态销毁/重建。`MutationObserver` 必须监听全局 `document.body`，且必须给滚动容器绑定带有 60ms 防抖的 `scroll` 监听器，确保“随滚随渲染”。
  3. **Monaco Editor 嵌套污染与单层精准提取**：`.line-content` 与 `.view-line` 在复杂 DOM 下可能存在多层父子重叠，严禁直接取父级 `textContent`，必须使用单层提取并严格剥离首尾 ` ```mermaid ` 围栏。
  4. **Electron / VSCode 剪贴板权限隔离与三重驱动**：在 Electron / Webview 沙箱环境下，`navigator.clipboard.writeText` 经常因为窗口焦点丢失或权限策略抛出 `NotAllowedError`。必须优先调用 Electron 原生 `electron.clipboard.writeText`（穿透沙箱，100% 成功），次级尝试 `navigator.clipboard`，最后兜底使用优化版 `textarea` + 明确选区 `execCommand('copy')`。
  5. **SVG 尺寸与视口约束**：Mermaid 生成的 SVG 默认会撑满宽度或高度过大，必须设置 `max-height: 480px`、`max-width: 100%`，并在初始化时配置 `useMaxWidth: false` 与 `fontSize: 13px` 紧凑模式，保证阅读体验与性能平衡。

## 3. 改动前后必须看的验证

- `shared/enhance.js`、`shared/request-engine.js`、`shared/launchpad-proxy.js`、`shared/input-replacer.js` 改完后：
  - `node --test patcher/tests/launchpad-proxy.test.js patcher/tests/input-replacer.test.js`
  - `npm run build --prefix patcher`

- 要交付安装包时：
  - `npm run tauri:build --prefix patcher`

- 改配置保存或版本号时：
  - 检查 `patcher/package.json`、`tauri.conf.json`、`Cargo.toml`、`App.vue`、`README.md`、`README_EN.md` 是否同步。

## 4. 一句话原则

- 共享模块改动要先看影响面。
- 回填问题优先查 `setInputValue()`，不要散修调用方。
- 测试连接只改安装器链路，不碰运行时增强主链路。
