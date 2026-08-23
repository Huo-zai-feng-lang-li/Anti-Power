# 图预览(Mermaid)接入与本地构建方案

## 1. 核心任务
- 在侧边栏 (Cascade 面板) 与界面配置中恢复并重构 Mermaid 图预览功能。
- 保证无外网/受限环境下稳定可用，支持 Monaco 单层精准提取、非破坏性错误回退与一键复制。
- 完整通过测试套件与 `pnpm build`，并最终执行本地 `tauri build` 生成 Windows `.exe` 安装包。

## 2. 改造计划
1. **新建 Mermaid 渲染核心模块**：`patcher/patches/cascade-panel/mermaid.js`（圈复杂度 < 6，单层 Monaco 代码提取，错误降级保留原始代码）。
2. **更新侧边栏扫描与入口**：
   - `patcher/patches/cascade-panel/scan.js`（增加 Mermaid 扫描与防抖处理）。
   - `patcher/patches/cascade-panel/cascade-panel.js`（支持 `mermaid: true` 开关配置）。
3. **更新 Tauri Rust 配置与 Vue 前端面板**：
   - `patcher/src-tauri/src/commands/patch.rs`（在 `FeatureConfig` 中加入 `mermaid: bool`）。
   - `patcher/src/components/FeatureCard.vue`（增加 Mermaid 图预览开关控制）。
   - `patcher/src/App.vue`（更新默认配置项与类型合并逻辑）。
4. **编写单元测试与验证**：
   - 在 `patcher/tests/` 编写测试，验证源码提取与渲染逻辑。
5. **本地构建打包**：
   - 执行前端 build + `tauri:build` 生成目标 `.exe`。
