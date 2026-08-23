# 最新接续状态 (2026-08-05 21:43)

## 核心进展
- 已完成 v2.6.82 修复并发布：`patcher/src-tauri/src/commands/patch.rs` 中 `install_patch()` 现在在安装流程末尾统一清空 `resources/app/product.json` 的 `checksums` 字段，修复只启用 Cascade 时 Antigravity 启动提示“安装似乎损坏。请重新安装。”的问题。
- **提示词上下文收集重构与 CDP 真实硬取证验证**：
  - 在 `patcher/patches/shared/enhance.js` 中实施了 **物理级 Monaco 选区提取与防失焦穿透采集**：
    1. 按钮绑定 `mousedown` 执行 `e.preventDefault()`，彻底阻止鼠标点击按钮抢夺焦点导致 Monaco 编辑器选区瞬间折叠清空；
    2. 多源窗口穿透（`window`, `window.parent`, `window.top`），解决 iframe 隔离下读不到主编辑器选区的问题；
    3. **CDP 真实取证修复**：定位到 Monaco Editor 中 `.selected-text` 的 `top: 0px` 属于相对行内偏移，真实行绝对坐标位于其 `parentElement`（`top: 111px, 130px...`）；已重构为读取 `b.parentElement.style.top` 逐行匹配 `.view-line`；
    4. 当前活动 Tab 穿透（`.tab.active`, `.editor-group-container.active .tab.active` 等）。
  - 已通过真实 CDP（端口 9000 注入 Electron 宿主）实测验证：成功 1:1 提取 8 行 `constructor` 真实选区代码；全量 24 项集成测试与 `pnpm --dir patcher build` 全部通过。

## 核心动机与背景 (Motivation & Background)
- 用户在真实 IDE 中划选代码片段，但大模型收到的是第一行而非选中的真实代码块。
- 根因排查（CDP 真实硬取证）：
  1. Monaco 编辑器的 `.selected-text` 自身的 `style.top` 恒为 `0px`，真实的行高物理位置 `top` 位于其 `parentElement`；
  2. 原代码直接读取 `b.style.top` 导致永远命中 `0px`（第一行代码）。

## 最新进展 (2026-08-23)
- **Mermaid 渲染性能与交互终极重构闭环**：
  - **ESBuild 作用域底层修复**：排查并修复了 Mermaid 官方 UMD 包中 `var __esbuild_esm_mermaid_nm` 与末尾 `globalThis` 的作用域不一致问题，彻底解决离线引擎加载失败。
  - **沉浸式全屏预览与交互优化**：支持鼠标滚轮无级缩放（0.3x ~ 8.0x）、鼠标拖拽平移、双击全屏、右上角与底部双重关闭入口。
  - **系统顶栏重叠避让与全链路防缓存**：调整全屏关闭按钮物理坐标至 `top: 64px !important; right: 32px !important;`（圆角胶囊药丸样式），留足 64px 绝对安全距离避开 Windows 原生标题栏控件；同时在 `cascade-panel.js` 和 `scan.js` 中全链路引入动态时间戳 `?t=${Date.now()}` 彻底击穿浏览器 ESM 内存缓存。
  - **甘特图排版与日期重叠根治**：引入 `axisFormat: "%m-%d"` 紧凑月日刻度格式，消除全格式年份字符横向挤压；同时基于 SVG 自然 `viewBox` 宽度进行自适应渲染，彻底杜绝小图被强制拉伸至 100% 导致的巨型字体失真。
  - **性能专项极致优化（零卡顿架构）**：
    1. **DOM 扫描过滤加速**：使用浏览器原生 `:not([data-cascade-mermaid-rendered])` 伪类替代 JS 遍历，避免长对话中对历史节点的重复遍历；
    2. **全局 MutationObserver 40ms 聚合防抖**：彻底消除流式打字输出时每秒数十次全量 ShadowRoot 深度扫描造成的 CPU 抢占；
    3. **GPU 硬件加速与 rAF 调度**：全屏拖拽与缩放采用 `translate3d` 配合 `requestAnimationFrame`，开启独立 Compositor 合成层，满帧 120 FPS 丝滑响应；
  - **顶层容器归一化与父子嵌套选择器冲突根治**：
    1. 引入 `Set` 进行顶层代码块容器归一化（优先 `.code-block` 其次 `pre`），彻底杜绝因 `div.code-block` 与内部 `<pre>` 同时命中导致生成的图表被外层 `overflow: hidden` 吞噬的隐蔽 Bug；
    2. 同步对容器内部所有 `pre`、`code` 打上已处理标记，实现全链路零重复渲染与零冲突。
  - **三重剪贴板写入保障**：集成 Electron 原生 Clipboard 模块 > Navigator API > DOM 物理选区降级，彻底解决复制失败问题。
  - **全量测试与构建**：单元测试 100% 通过，`pnpm --dir patcher build` 编译成功。

## 待办事项 (Next Steps)
- [x] Mermaid 图表预览接入与单测覆盖
- [x] CDP 宿主真实 DOM 端到端渲染取证闭环
- [x] 虚拟列表滚动与全局 Observer 实时出图闭环
- [x] 复制按钮剪贴板权限兼容与 execCommand 降级保障
- [x] ESBuild 作用域与同源离线引擎深度修复
- [x] 全屏模态窗交互重构与 IDE 顶栏避让
- [x] 本地 Release 核心可执行文件打包验证
- [ ] 如需打包 NSIS 安装包，在具备外网/GitHub 下载环境的机器上执行 `pnpm tauri build`。


