# Changelog

本文件记录每个版本的 Bug 修复和关键备忘, 防止后续改代码时重复踩坑. 时间格式如 `2026-05-15 09:00:00`同步的是git 提交时间

## v2.6.82 (2026-08-05 21:17:15)

### Antigravity 损坏提示修复

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **只启用 Cascade 时仍提示 Antigravity 安装似乎损坏** | `install_patch()` 只在 Manager 启用分支清空 `product.json.checksums`，但 Cascade 注入同样会修改 `workbench.html` | `patcher/src-tauri/src/commands/patch.rs` |
| **修复方案** | 安装流程结束前统一清空 `product.json.checksums`，覆盖 Cascade-only、Manager、Launchpad 代理写入路径 | Antigravity 安装补丁链路 |

### 踩坑备忘

- 只要写入 `workbench.html` 或 `workbench-jetski-agent.html`，就不能把 checksum 清理绑在某个 UI 分支上。
- “损坏提示”不是补丁文件本身坏了，而是宿主 product 校验清单仍保留旧 hash。

---

## v2.6.81 (2026-08-05 20:37:18)

### 提示词增强密钥隔离

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **真实提示词增强 Key 进入开源 tracked 文件** | 默认配置、补丁配置和联网测试脚本直接硬编码历史 API Key | `patcher/src/App.vue`、`patcher/patches/*`、`patcher/tests/direct-http.test.js` |
| **缺少提交前 Secret 防线** | 仅靠人工检查，无法防止 `sk_tr_` / `fe_oa_` 类密钥再次入库 | `patcher/tests/no-committed-secrets.test.js`、本地 `pre-commit` hook |
| **修复方案** | tracked 默认 key 置空；本机 key 改由忽略文件 `patcher/.env.local` 注入；新增 tracked secret 扫描测试 | 安装器默认配置、补丁默认配置、测试链路 |

### 踩坑备忘

- 公开源码只能保留空值或占位配置；真实 Key 只能来自本地未跟踪文件或 CI Secret。
- 本机 `.env.local` 构建出的安装包会内嵌 Key，公开 release 必须使用无本地 Key 的干净环境构建。

---

## v2.6.80 (2026-08-05 19:30:00)

### 提示词多行格式保持与文本清洗控制

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **多行提示词替换后丢失换行与缩进** | `replaceContenteditableDom` 简单将文本作为单个 TextNode 注入，导致浏览器转换为单行连续文本 | `patcher/patches/shared/input-replacer.js` |
| **编辑框与上下文中的文本不可见字符** | 各种 DOM 读取和事件输入可能带入不可见 Zero-width 字符及 `\r\n`，引发 API 编码异常或长度匹配偏差 | `patcher/patches/shared/enhance.js` |
| **提示词增强 API Token 限制与结构保护** | 上下文拼接与单次输出限制需避免超过模型 Window 上限 | `patcher/patches/shared/enhance.js` |
| **修复方案** | `input-replacer` 改为多行 `div` 节点拆分并设置 `whiteSpace: "pre-wrap"`；统一引入 `normalizeEditorText` 清洗不可见字符与标准换行；增加相关单元测试 | `input-replacer.js`、`enhance.js`、`input-replacer.test.js` |

### 踩坑备忘

- `contenteditable` 在虚拟 DOM 下处理多行替换时，必须将多行按 `\n` 切分为 `div` 子元素并带 `whiteSpace: "pre-wrap"` 样式，否则文本缩进和折行会被压平。
- 从 DOM 提取文本或输入框读取 `innerText` 时，需统一去除零宽字符 (`\u200B-\u200D\uFEFF`)，防止隐藏控制符干扰正则匹配或字符长度计算。

---

## v2.6.72 (2026-08-03 00:46:00)

### 提示词增强默认 API 升级与持久化闭环

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **提示词增强自定义配置无法持久化保存** | 安装器前端 `mergePromptEnhance` 存在硬编码校验，对不满指定长度的 API Key 会强制重置为默认值 | `src/App.vue` |
| **默认 API 供应商升级** | 全量将默认提示词增强 API 配置替换为 TokenRhythm (`https://tokenrhythm.studio/v1`) & `deepseek-v4-flash` | `src/App.vue`、`src-tauri/src/commands/patch.rs`、`patches/shared/enhance.js`、`patches/*/config.json` |
| **清洗黑名单增量对齐** | 补丁初始化合并时需要清除已淘汰的淘汰 API 地址与模型包袱 | `src/App.vue` |

### 踩坑备忘

- 补丁升级时必须遵守配置零覆盖原则，仅清洗已知淘汰的默认 API 地址，不得误重置用户的合法自定义 Key。
- 续接与交接文档（如 `handoff.md`）绝对禁止包含真实 API Key 字符，需统一使用掩码（如 `sk_tr_***`）。

---

## v2.6.71 (2026-05-17 00:00:00)

### 安装器连接测试与版本同步闭环

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **提示词增强连接测试总是提示跨域限制** | 安装器前端直接 `fetch` LLM API，会被 WebView/CORS 限制拦截，无法代表真实配置是否可用 | `src/components/PromptEnhanceCard.vue`、`src-tauri/src/commands/prompt.rs` |
| **版本同步脚本无法从 tag 工作流运行** | tag 流已要求 `npm run --prefix patcher sync-version`，但 `patcher/package.json` 缺少脚本入口且运行依赖被误删 | `patcher/package.json`、`scripts/sync-version.js`、`.agent/rules/README.md`、`.agent/workflows/tag.md` |
| **修复方案** | 新增 Tauri 后端 `test_prompt_connection` 命令，由 Rust 侧请求 OpenAI 兼容/Anthropic API；恢复安装器 npm scripts 与 dependencies，并挂载 `sync-version` 脚本 | 安装器、发版工作流 |

### 踩坑备忘

- 安装器内测试外部 LLM API 不应使用前端 `fetch`，必须走 Tauri 后端命令，避免 CORS 假失败。
- `sync-version.js` 以 `patcher/package.json` 为唯一版本源；发布前只改 package 版本，然后运行 `npm run --prefix patcher sync-version`。
- 已发布的 tag 不要移动；如果 `v2.6.70` 已在远端存在，后续修复必须递增为新版本。

---

## v2.6.70 (2026-05-17 00:00:00)

### Antigravity 侧边栏间距配置

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **侧边栏内容区左右留白过大且无法调节** | Cascade 面板内部 `.px-4` 由 IDE 原生 Tailwind 工具类控制，安装器没有暴露侧边栏间距配置 | `src/components/FeatureCard.vue`、`src/App.vue`、`cascade-panel/`、`src-tauri/src/commands/patch.rs` |
| **修复方案** | 新增 `sidePaddingLeft` / `sidePaddingRight` 配置，默认 8px / 3px；运行时用 CSS 变量覆盖 `.antigravity-agent-side-panel .px-4`，并限制在 0-48px | Antigravity Cascade 侧边栏 |

### 踩坑备忘

- 该配置只属于 Antigravity Cascade 侧边栏，不要同步到 Manager 或 Windsurf。
- CSS 选择器必须带 `.antigravity-agent-side-panel` 作用域，避免误伤其他 Tailwind `.px-4` 元素。
- 配置需要同时进入安装器默认值、Rust 写入、内置 `config.json`、运行时 fallback 和手动安装文档。

---

## v2.6.69 (2026-05-16 19:06:41)

### 非核心功能物理移除

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **已删除功能仍可能被误恢复** | copy、Mermaid、Math、表格修复虽然默认关闭，但文件、类型字段、UI 文案和文档仍有残留引用 | `patcher/patches/`、`src/App.vue`、`src-tauri/src/commands/`、README、规则文件 |
| **Manager 提示词扫描存在固定轮询开销** | 提示词按钮扫描使用 2 秒定时轮询，即使 DOM 没变化也会持续执行 | `manager-panel/scan.js` |
| **Manager/Windsurf 单独安装可能缺共享模块** | `shared/enhance.js` 依赖 Cascade 安装时的副作用同步，单独安装 Manager 或 Windsurf 时共享目录可能不存在 | `src-tauri/build.rs`、`src-tauri/src/commands/patch.rs` |
| **修复方案** | 物理删除 copy/Mermaid/Math/表格修复链路并清除配置字段；保留字体大小调节但默认关闭；Manager 扫描改为 DOM 变更节流触发；`shared/` 作为真实共享目录嵌入并随各入口安装 | 同上 |

### 踩坑备忘

- 当前默认只开启滚动到底部和提示词增强；字体大小调节可保留，但必须默认关闭。
- copy、Mermaid、Math、表格修复已从运行时链路和安装器配置模型移除，除非用户明确要求，不要重新加回 UI 或默认配置。
- `shared/` 必须作为真实共享目录嵌入；Manager/Windsurf 不能依赖 Cascade 安装副作用获得 `enhance.js`。
- IDE 原生 HTML 的 `trusted-types` 白名单中出现 `mermaid`/`dompurifyMermaid` 属于宿主页面安全策略，不等于补丁功能残留，禁止为了“清词”误删。
- 已删除的 macOS/Linux 脚本引用也要同步清理，避免文档指向不存在的文件。

---

## v2.6.68 (2026-05-16 16:23:45)

### 旧配置 copy 按钮残留修复

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **复制按钮在默认关闭后仍显示** | 旧 `config.json` 缺少默认策略版本标记，读取时会继续保留历史 `copyButton: true` | `src/App.vue`、`src-tauri/src/commands/patch.rs` |
| **更新配置没有覆盖实际运行路径** | `update_config` 只写 `extensions/antigravity/cascade-panel/config.json`，没有同步写 `workbench/cascade-panel/config.json` | Antigravity Cascade 运行配置 |
| **字体等非核心开关可能沿用旧默认值** | 旧配置没有迁移边界，`fontSizeEnabled` 等字段会覆盖新版默认关闭策略 | Cascade、Manager、Windsurf 配置读取 |
| **修复方案** | 增加 `featureDefaultsVersion`；无版本标记的旧配置自动关闭复制、字体、Mermaid、Math、表格修复类开关；滚动到底部和提示词增强保持默认开启；更新配置时双写 Cascade 配置路径 | 同上 |

### 踩坑备忘

- Cascade 存在 `extensions` 与 `workbench` 两份配置，实际运行入口可能读取 `workbench/cascade-panel/config.json`，更新配置必须双写。
- `featureDefaultsVersion` 缺失按旧配置处理；用户在新版手动开启复制或字体后会写入版本标记，后续继续保留用户选择。
- 补丁运行时加载配置也执行同一迁移，避免只替换新版 JS 但保留旧配置时继续显示 copy 按钮。
- 本次迁移只影响非核心默认关闭项，不改提示词 API、apiKey、模型、自定义系统提示词与滚动开关。

---

## v2.6.67 (2026-05-16 15:52:51)

### 默认功能开关收敛

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **默认功能开关不够收敛** | 补丁 fallback 配置和内置配置仍可能默认开启复制、字体、渲染类功能，与项目规则“仅默认开启滚动到底部和提示词增强”不一致 | `cascade-panel/`、`manager-panel/config.json`、`src-tauri/src/commands/`、安装器 UI |
| **复制按钮没有独立可选入口** | 侧边栏设置界面保留了 `copyButton` 数据字段，但没有给用户暴露开关 | `src/components/FeatureCard.vue` |
| **修复方案** | 默认仅开启滚动到底部和提示词增强；复制按钮、字体调节、Mermaid、Math、表格修复均默认关闭；复制按钮与字体调节保留为用户可选项 | 同上 |

### 踩坑备忘

- 默认值必须同时同步安装器 UI、Rust 后端默认值、补丁运行时 fallback 和内置 `config.json`，只改其中一处会导致无配置文件或手动安装场景回退到旧默认。
- 更新日志统一使用中文，避免发布记录出现英文表头和英文说明。

---

## v2.6.66 (2026-05-16 14:53:49)

### 侧边栏滚动按钮显示与注入清理

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **侧边栏滚动到底部按钮在部分布局中不显示** | 状态锁可能缓存到早期出现但并非真实滚动容器的元素，旧扫描逻辑也只依赖少量 overflow 工具类 | `cascade-panel/scroll-to-bottom.js` |
| **滚动事件路径存在额外性能开销** | 严格滚动容器判断在滚动事件中读取 computed style | `cascade-panel/scroll-to-bottom.js` |
| **重复安装后 workbench.html 可能残留重复 Cascade CSS/JS 标签** | 安装器只检查一种精确标签写法，未在重新注入前归一化清理旧变体 | `src-tauri/src/commands/patch.rs` |
| **修复方案** | 严格识别仅用于扫描，滚动事件改为轻量范围判断；新增 body-root fixed 定位兜底；注入前清理重复 Cascade 标签 | 同上 |

### 踩坑备忘

- Manager 提示词增强仍隔离在 `manager-panel/scan.js`，本次没有改共享 selector 或共享状态。
- Manager 滚动按钮继续使用 `manager-scroll-bottom-btn`，与 Cascade 的 `cascade-scroll-bottom-btn` 保持 ID 隔离。

---

## v2.6.65 (2026-05-16 14:30:00)

### Manager 滚动补丁同步 — Shadow DOM 穿透

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **Manager 面板在某些动态加载场景下无法识别滚动容器** | 原有 `findScrollEl` 仅扫描当前层级，未穿透 Shadow DOM，导致位于影子根内的滚动容器被漏掉 | `manager-panel/scroll-to-bottom.js` |
| **修复方案** | 引入 `traverse(root)` 递归函数，深度穿透所有 Shadow DOM 节点，并取全量 `scrollHeight` 最大者作为目标 | 同上 |

---

### 滚动性能重构 — State Lock (状态锁定) 模式

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **长会话下 UI 卡顿与 CPU 峰值** | 每当 DOM 变动时 `scroll-to-bottom.js` 都执行 O(N) 全量扫描，导致指数级性能损耗 | 全面板 |
| **内存泄漏 (事件监听器不释放)** | `update` 闭包引用错误导致 `removeEventListener` 无效 | 全面板 |
| **修复方案** | 引入状态锁定：锁定有效滚动容器后跳过扫描；外提 `update` 引用确保销毁成功 | `manager-panel/scroll-to-bottom.js` + `cascade-panel/scroll-to-bottom.js` |

---

## v2.6.63 (2026-05-16 02:26:00)

### Manager 提示词增强按钮重复创建修复

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **Manager 输入框每2秒增加一个提示词增强按钮** | `scan.js` 去重检查在 `input.parentElement` 查找按钮，但按钮实际被插入到 `actionBtn.parentElement` 或 `findContainer(input)`，检查位置 ≠ 插入位置，导致每次轮询都创建新按钮 | `manager-panel/scan.js` |
| **修复方案** | 改用 `input.dataset.enhanceAttached` 在 input 元素自身打标记去重，与按钮插入位置解耦 | 同上 |

---

## v2.6.62 (2026-05-15 21:17:00)

### 双面板滚动按钮互斥修复

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **侧边栏出现两个滚动按钮** | manager-panel.js 注入 workbench-jetski-agent.html 后在 `document.body` 创建 `manager-scroll-bottom-btn`，而侧边栏 cascade webview 共享外层 document 的部分 DOM 可见性，导致 manager 按钮视觉上出现在侧边栏区域。cascade 侧有事后 `dup.remove()` 清除逻辑但被 manager 的 MutationObserver 300ms 后重建覆盖 | `manager-panel/scroll-to-bottom.js` + `cascade-panel/scroll-to-bottom.js` |
| **修复方案** | manager 的 `ensureButton()` 开头检测 `cascade-scroll-bottom-btn` 是否存在，若存在则让权不创建按钮；cascade 侧移除冗余的事后删除逻辑 | 同上 |

---

## v2.6.61 (2026-05-15 20:31:00)

### Manager 滚动按钮终极修复 — findRoot/findScrollEl 条件判断全部落空

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **Manager 滚动按钮始终不显示** | `findRoot()` 查找 `.chat-container` / `.agent-view-container` 等语义类名，但 Manager 页面全部使用 Tailwind 工具类（如 `scrollbar-hide`、`overflow-y-auto`），导致 `findRoot()` 永远返回 `null`，`ensureButton()` 在守卫条件处直接退出 | `manager-panel/scroll-to-bottom.js` |
| **修复方案** | Manager 补丁独占 `workbench-jetski-agent.html`，`findRoot()` 直接返回 `document.body`；`findScrollEl()` 改为按 `scrollHeight` 取最大可滚动元素，不再依赖任何语义类名 | `manager-panel/scroll-to-bottom.js` |

### 踩坑备忘

- Manager 页面 DOM 全部由 Tailwind CSS 驱动，无任何语义化类名（`.chat-container` 等不存在），补丁代码不可依赖这些选择器
- CDP 取证流程：注入检查 → 模块加载检查 → `init()` 手动调用 → 确认 `findRoot()` 返回 `null` → 定位根因

---

## v2.6.60 (2026-05-15 20:00:46)

### Manager 滚动侦测重构 — 解除误伤屏蔽 + 全局事件代理

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **Manager 滚动按钮仍不展示** | `findScrollEl` 残存 `.monaco-editor` 硬排除，Manager 聊天区嵌套在编辑器内核内被误伤丢弃；仅识别 `auto/scroll` 忽略了 `overlay/hidden` 自定义滚动 | `scroll-to-bottom.js` |
| **修复方案** | 移除不必要排除（独立页面无需排除）；放宽 overflow 识别；增加 root 级 `capture: true` 全局滚动代理 | `scroll-to-bottom.js` |

---

## v2.6.59 (2026-05-15 19:15:37)

### Manager 滚动按钮修复（根因：findRoot 错误使用 .part.editor）

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **Manager 滚动按钮不显示** | `manager-panel` 补丁运行在独立的 `workbench-jetski-agent.html` 页面里，该页面不含 `.part.editor`，导致 `closest(".part.editor")` 永远返回 null | `manager-panel/scroll-to-bottom.js` |

---

## v2.6.58 (2026-05-15 18:00:00)

### 三连补丁：规则加固 + 降级兜底 + Manager 滚动按钮精准识别

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **架构规则加固** | 将"禁止 selectAll + 必须用 Range.selectNodeContents"写进永恒规则库 | `.agent/rules/README.md` |
| **增强降级兜底** | 回写失败时自动 `clipboard.writeText` 确保结果不丢失 | `shared/enhance.js` |
| **Manager 滚动按钮消失** | `closest(".antigravity-agent-side-panel")` 误判 Manager 也满足条件 | `manager-panel/scroll-to-bottom.js` |

---

## v2.6.57 (2026-05-15 17:30:00)

### 彻底根除回显文本"只追加不覆盖"问题 (Range Override Injection Fix)

| 修复项 | 根因 | 影响范围 |
|--------|------|----------|
| **提示词增强回填追加 Bug** | `execCommand("selectAll")` 在虚拟 DOM 框架下光标塌缩，改用 `Range.selectNodeContents` 物理全选覆盖 | `shared/enhance.js` |
| **性能收益** | 在侧边栏存在大量聊天历史时，扫描耗时降低约 40%-60% | `scan.js` 全系列 |
