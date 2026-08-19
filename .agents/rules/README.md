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
