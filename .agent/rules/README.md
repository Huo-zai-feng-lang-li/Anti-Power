---
trigger: glob
globs: *
---

- **配置零覆盖原则**: 补丁更新时，禁止覆盖用户已有的 `config.json`。必须采用增量合并逻辑，确保用户的 `apiKey` 和自定义 API 路径在升级后依然有效。在 Rust 侧后端或 Vue 侧保存时也要分情况合并。
- **版本全量同步**: 每次发布新 Tag 前，必须确保 6 处版本号完全一致。**操作指南**：手动修改 `patcher/package.json` 的 `version` 后，必须运行 `npm run --prefix patcher sync-version` 自动对齐其余 5 处 (`tauri.conf.json`、`Cargo.toml`、`App.vue`、`README.md`、`README_EN.md`)。
- **发布审计**: 打 Tag 必须包含 `git push origin --tags` 等全链路声明，遵照 `/tag` 工作流要求。

> 目标: 让 AI 一眼理解本项目在做什么, 补丁如何落地, 关键入口在哪里。

## 项目定位

- Antigravity-Power-Pro 是 AI 本地 IDE（如 Antigravity IDE Cascade 原型版本和 Windsurf IDE） 的全能挂载增强补丁。
- Antigravity：改造 Cascade 面板和 Manager 面板，当前聚焦滚动到底部、提示词增强、字体大小可选调节三条链路。
- 当前默认只开启滚动到底部和提示词增强；字体大小调节允许保留，但必须默认关闭。
- Windsurf：改造其独立客户端（包括字体调节、增强悬浮模块、提示词等）。
- 前端安装器使用了 Vue 提供的 Tab 布局进行环境切换（隔离状态）。

## 补丁落地流程 (核心链路)

1. 桌面安装器位于 `patcher/` (Tauri + Vue)。
2. Rust 后端由 `patcher/src-tauri/src/commands/*.rs` 负责：检测各自 IDE 路径、拉取默认配置与本地磁盘比对（执行白名单功能开关控制）。
3. 安装具体流程：
   - IDE 核心入口 `XXXX.html` 被 `app/out/...` 等路径下的 HTML 入口引用，安装时会被备份为 `.bak`，再原封不动写入增强补丁 `<script type="module" src="..."></script>`。
   - 补丁目录结构按 IDE 面板强隔离：`cascade-panel/`、`manager-panel/`、`windsurf-panel/`，配置互相不干扰（写入各自领域的 `config.json`）。
4. 本地补丁源代码置于 `patcher/patches/`，Rust 于编译时使用 `build.rs` 自动索引并打包至嵌入单体（除开 `.embed-exclude.txt` 排列项）。

## 关键目录 (优先修改落点)

- `patcher/patches/`: 全部补丁原始文件（HTML / JS / CSS），是前端视觉与注入的灵魂心脏。
- `patcher/src-tauri/`: 安装引擎逻辑。所有路径嗅探和备份重构。
- `patcher/src/`: 安装工具 UI 层，配置功能开关、检查各依赖可用性与系统同步。
- `.agent/`: AI Agent 自定义准则、工作流程的约束核心与知识挂载。

## 安装器 API 连接测试

- 提示词增强的“测试连接”属于安装器链路，不属于 IDE 运行时补丁链路。
- 前端入口: `patcher/src/components/PromptEnhanceCard.vue`，点击测试时必须把当前表单里的 `provider`、`apiBase`、`apiKey`、`model` 原样传给 Tauri 命令。
- 后端入口: `patcher/src-tauri/src/commands/prompt.rs` 的 `test_prompt_connection`。该命令使用当前传入的 API 配置发起真实请求；只允许硬编码最小测试 prompt（当前为 `"Hi"`）和 `max_tokens`，禁止硬编码 API 地址、API Key 或模型。
- OpenAI 兼容接口走 `{apiBase}/chat/completions`；Anthropic 走 `{apiBase}/v1/messages`。
- 修连接测试时优先修改安装器前后端，不要误改 `shared/enhance.js`；`shared/enhance.js` 只负责 IDE 内实际提示词增强。

## IDE 内部 Hook 锚标与漏洞机制

### Antigravity
- 侧翼环境: `resources/app/extensions/antigravity/cascade-panel.html`
- 会话中枢 (Manager): `resources/app/out/vs/code/electron-browser/workbench/workbench-jetski-agent.html`

### Windsurf
- 聚合门户: `resources/app/out/vs/code/electron-browser/workbench/workbench.html`
- 挂载须知: 替换修改该文件将不可避免地招致 “程序防篡改校验（安装似乎损坏）”，所以卸载功能被要求绝对退回 `.bak` 文件。并且 Windsurf 设置了严防死守的 `require-trusted-types-for`，已透过 `default` Trusted Types 全局下推来豁免。

### DOM 选择器红线

> **两个 IDE 页面均使用 Tailwind 工具类，严禁在补丁中硬编码依赖语义化类名 (如 `.chat-container`、`.agent-view-container`)。**

| 环境 | CSS 类名体系 | 可用锚点 | 滚动容器识别策略 |
|------|-------------|----------|-----------------|
| **cascade-panel** (侧边栏) | Tailwind 工具类 (`.overflow-y-auto`, `.overflow-auto`) | `.antigravity-agent-side-panel` (补丁自注入) | 按 `.overflow-y-auto` + `scrollHeight` 降序取最大 |
| **manager-panel** (Manager) | 纯 Tailwind 工具类 (`scrollbar-hide`, `overflow-y-auto`)，**无任何语义锚点** | `document.body` (独占页面) | 按 `getComputedStyle(el).overflowY` + `scrollHeight` 取最大，并保留 `clientWidth >= 350` 的窄栏过滤 |

- **禁止**: 在 `findRoot()` 或 `findScrollEl()` 中使用 `.chat-container`、`.conversation-container`、`.agent-view-container`、`.monaco-workbench` 等 IDE 原生语义类名作为必要条件判断
- **必须**: 使用特征无关策略 — 遍历 DOM 按 `overflowY` + `scrollHeight` 取最大可滚动元素
- **Manager 防误触**: Manager 页面存在文件列表、工具区、按钮组等同层 DOM。提示词按钮定位必须绑定“当前输入框邻近容器”，禁止用全局第一个 send/mic/submit 按钮作为兜底挂载点；滚动容器识别必须保留窄栏过滤，避免长列表抢占滚动焦点。

### 补丁文件修改地图 (双面板 × 双功能)

> **修改任何功能前，必须先查此表确认涉及哪些文件，两个面板各自独立、禁止交叉引用。**

#### 源码 → IDE 部署路径

| 源码目录 (patcher/patches/) | 部署位置 (IDE 内) |
|---------------------------|------------------|
| `cascade-panel/*` | `D:/Antigravity/resources/app/extensions/antigravity/cascade-panel/` |
| `manager-panel/*` | `D:/Antigravity/resources/app/out/vs/code/electron-browser/workbench/manager-panel/` |
| `shared/enhance.js` | 两处均部署：`extensions/antigravity/shared/` 和 `workbench/shared/` |

#### 功能模块对照表

| 功能 | cascade-panel (侧边栏) | manager-panel (Manager) | 共享模块 |
|------|----------------------|------------------------|---------|
| **滚动到底部** | `cascade-panel/scroll-to-bottom.js`<br>BTN_ID=`cascade-scroll-bottom-btn` | `manager-panel/scroll-to-bottom.js`<br>BTN_ID=`manager-scroll-bottom-btn` | 无 (各自独立) |
| **提示词增强** | `cascade-panel/scan.js` 内 enhance 调用区 | `manager-panel/scan.js` 内 enhance 调用区 | `shared/enhance.js` |
| **字体大小** | `cascade-panel/cascade-panel.js` + `cascade-panel/cascade-panel.css`，默认关闭 | `manager-panel/manager-panel.js` + `manager-panel/manager-panel.css`，默认关闭 | 无 |
| **入口加载** | `cascade-panel/cascade-panel.js` | `manager-panel/manager-panel.js` | 无 |
| **样式** | `cascade-panel/cascade-panel.css` | `manager-panel/manager-panel.css` | 无 |
| **配置** | `cascade-panel/config.json` | `manager-panel/config.json` | 无 |

#### 修改注意事项

1. **scroll-to-bottom.js 是两份独立文件**，不共享代码。修改一个面板时必须检查另一个是否需要同步
2. **enhance.js 是共享模块**，两个面板的 `scan.js` 通过 `import('../shared/enhance.js')` 引用。修改 enhance.js 会同时影响两个面板
3. **BTN_ID 严格隔离**：cascade 用 `cascade-scroll-bottom-btn`，manager 用 `manager-scroll-bottom-btn`，禁止混用
4. **findRoot 策略不同**：cascade 用 `.antigravity-agent-side-panel || document.body`，manager 直接用 `document.body`
5. **部署需重新安装**：源码修改后必须重新构建 exe 并执行安装，才能更新 IDE 内的部署文件

## 设计规范 (视觉与环境控制)

- **设计语言**: 统一使用 "Obsidian Gold" (黑金拟物极客) 风格。功能悬浮按键统一为 **Circular 圆形**，配搭金耀色晕投影 (`rgba(251, 191, 36, 0.4)`)。
- **UI 同步化**: 当你在某一环境例如 `cascade-panel` 修改了外观，**必须联动核准并更新**在 `manager-panel` 和 `windsurf-panel` 中的同级类视图。
- **暗层穿透 (Shadow DOM)**: 对于 IDE 阴影 DOM 层深藏的结构（输入框文本），必须用特制的深穿透查询脚本（如 `querySelectorAllDeep`）去提取，切勿简单地相信标准的 `.querySelector`。

## 终极架构防护红线

- **虚拟 DOM 劫持准则**: 对框架富文本区施行暴力植入时，**严禁使用 `innerText = ""` 发号施令清理，也严禁依赖浏览器封装的 `execCommand("selectAll")`，更禁止用 `insertHTML` 注入 LLM 返回内容**。这类弱手段会触发光标坍塌、追加 Bug、HTML 转义/清洗差异和潜在注入风险。必须采用 Selection/Range API 对容器内全体子节点划取：`range.selectNodeContents(input)` 配合 `selection.addRange` 包裹旧文本后，再触发 `execCommand("insertText")`；失败时用 `ClipboardEvent("paste")` + `text/plain` 降级，并用 `getInputValue(input).trim()` 校验是否写入成功。
- **UI 状态闭环底线**: LLM 增强与各种大工作量任务派发时，不能允许“点击没反应用户干等”。如果在防守严密的特定环境实在打不穿（比如极少数怪异布局），必须提供安全回退方案并 **触发明显的剪贴板复制提示 (showResultModal) **，拒绝静默失败。
- **空间焦点抢夺防护**: 向 Manager 类融合会话面板加插按钮或进行长列表追踪时（如滚动条吸底），禁绝贪婪匹配全体 root！这种行为会被窗口内同层文件列表等其他系统级长列表诱发劫夺，必须叠加专属 CSS 限定甚至施加超高 `10000` 权重，锁定专属领域挂载。
- **环境主权隔离**: `manager-panel/scan.js` 扫描时必须规避并隔离已属于侧边栏 `cascade-panel` 的特有类容（如 `.antigravity-agent-side-panel` 元素），实现跨模块井水不犯河水。位置定点权必须交放给各面板自己管理。绝对定位容器必须加上 `overflow: visible !important` 的超高权柄，防止界面跳变被断层裁剪。
- **遗留配置清洗**: App.vue 等设置界面的初始化里，若是探测到过去落后遗留的 API 地址或者淘汰默认值，应通过条件判定予以剔除和静默覆盖，不要给用户留下过时的包袱。

## 提示词增强连接与输入替换防护 (v2.6.78+)

- **连接链路分层**: `shared/enhance.js` 只负责提示词业务与直接 HTTP 引擎；`shared/request-engine.js` 负责请求编排；`shared/launchpad-proxy.js` 负责 Launchpad BroadcastChannel 桥接。修改其中一层时必须保留另外两层的职责边界。
- **Launchpad 无界面依赖**: `workbench-jetski-agent.html` 只注入 `./shared/launchpad-proxy.js`，通过 `PROXY_PING/PROXY_PONG` 探测桥接是否在线。Cascade/Manager 侧必须先探测可用桥接再请求；桥接不可用时走 direct HTTP，不能把“打开 Manager 页面”当成前置条件。
- **代理超时红线**: 禁止把代理探测改成等待完整 API 超时；探测必须使用短超时（当前 350~500ms），代理失败后应立即按既定顺序回退直连或返回原始错误。
- **CORS 事实边界**: `file://` 页面没有浏览器端跨域绕过能力。没有在线 Launchpad 桥接且 Electron 原生 `require` 不可用时，只有开放 CORS 的 API 能走浏览器直连；不要用修改请求头、关闭前端校验等方式伪造修复。
- **富文本替换红线**: `setInputValue()` 必须先清空旧 Selection/Range，再用 `replaceContenteditableDom()` 原子替换 `contenteditable` 的全部子节点，触发 `input/change`，并用 `getInputValue()` 精确校验；禁止改回仅在末尾插入、`innerText = ""`、`insertHTML` 或无校验的异步粘贴。
- **共享文件影响面**: `shared/enhance.js` 同时影响 Cascade 与 Manager，`shared/launchpad-proxy.js` 还影响安装器注入的 Launchpad 页面。每次改动至少运行 `node --test patcher/tests/launchpad-proxy.test.js patcher/tests/input-replacer.test.js`，并重新执行 `npm run build --prefix patcher`。
- **Tauri 构建红线**: 交付给用户的补丁程序必须使用 `npm run tauri:build --prefix patcher` 生成；禁止把 `cargo build --release` 的裸二进制当安装器交付，它会回退到 `devUrl` 并出现 `localhost` 拒绝连接。NSIS 下载失败时，仍可使用已生成的 `patcher/src-tauri/target/release/Antigravity-Power-Pro.exe`，但必须明确说明未生成安装包。
- **版本同步**: 修改版本只改 `patcher/package.json`，然后运行 `npm run --prefix patcher sync-version`，确认 `tauri.conf.json`、`Cargo.toml`、`App.vue`、`README.md`、`README_EN.md` 六处一致。
