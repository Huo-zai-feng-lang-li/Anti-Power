<p align="center">
  <img src="docs/assets/images/LOGO.gif" alt="Antigravity-Power-Pro" width="320">
</p>

<h1 align="center">🚀 Antigravity-Power-Pro</h1>

<p align="center">
  <strong>让你的 AI IDE 体验更上一层楼 — 强大的 Antigravity & Windsurf 增强补丁</strong>
</p>

<p align="center">
  <a href="https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/releases">
    <img src="https://img.shields.io/badge/version-v2.6.75-gold?style=flat-square" alt="版本">

  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/支持_Antigravity-v1.23.2-green.svg?style=flat-square" alt="Antigravity">

  </a>
  <a href="https://codeium.com/windsurf">
    <img src="https://img.shields.io/badge/支持_Windsurf-✓-00b4d8.svg?style=flat-square" alt="Windsurf">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/协议-MIT-orange.svg?style=flat-square" alt="开源协议">
  </a>
  <br>
  <a href="README_EN.md">
    <img src="https://img.shields.io/badge/Language-English-blue?style=for-the-badge&logo=google-translate&logoColor=white" alt="English">
  </a>
</p>

---

## 🌟 项目简介

**Antigravity-Power-Pro** 是一款专为 **Antigravity AI IDE** 和 **Windsurf IDE** 打造的深度增强工具。它通过巧妙的注入技术，补齐了官方在侧边栏和 Manager 窗口中的体验短板。

当前版本聚焦 **提示词增强 (Prompt Enhance)**、**智能滚动** 与默认关闭的 **字体调节**，让补丁更稳定、更轻量。

---

## ✨ 核心特性

| 功能模块                  | 描述说明                                                    |
| :------------------------ | :---------------------------------------------------------- |
| 🧠 **提示词增强**         | 对接自定义 LLM API，一键优化你的 Prompt (类似 Augment Code) |
| ⚓ **智能滚动**           | Cascade 面板浮动按钮，助你快速定位到最新对话                |
| 📏 **字体调节**           | 自由调节侧边栏字体大小，打造最舒适的阅读体验                |

### 🌊 Windsurf 专属支持

- ⚡ **内嵌增强按钮**：深度集成至 Windsurf 输入框，实现毫秒级响应。
- ⚓ **智能滚动**：消息区域浮动按钮，助你快速定位到最新对话。

---

## 📸 效果预览

> [!TIP]
> 更多高清效果截图请查看 [效果展示.md](docs/reference/screenshots.md)

![提示词增强效果](./docs/assets/images/8.gif)

---

## 📥 快速开始

### 💻 Windows 用户（推荐）

1. 📥 前往 [Releases](https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/releases) 下载最新版 `Antigravity-Power-Pro.exe`。
2. 🚀 双击运行（程序具备自动路径识别功能）。
3. ✅ 勾选你想要的功能模块，点击 **「安装补丁」**。
4. 🔄 重启 IDE，立即享受增强体验。

> [!TIP]
> **进阶推荐**：配合 [Auto-Agent-AntiGravity](https://github.com/Huo-zai-feng-lang-li/Auto-Agent-AntiGravity) 项目，可实现自动点击「允许」并支持自动重试，让自动化流程更顺滑。

---

## 🧭 文档索引

- [🎨 效果展示](docs/reference/screenshots.md)
- [🐛 已知问题与修复方案](docs/reference/known-issues.md)
- [🛠️ 开发与贡献指南](docs/guides/developer-guide.md)
- [📦 发布流程说明](docs/guides/release-guide.md)

---

## 📋 版本历史

> [!NOTE]
> 查看官方更新动态：[Antigravity Changelog](https://antigravity.google/changelog)

| 补丁版本    | 支持 IDE 版本      | 发布日期   | 重大更新内容                                                                                         |
| :---------- | :----------------- | :--------- | :--------------------------------------------------------------------------------------------------- |
| **v2.6.72** | v1.23.2 / Windsurf | 2026-08-03 | **配置**: 默认提示词 API 升级至 TokenRhythm & deepseek-v4-flash；彻底修复自定义配置无法持久化保存退回默认值的 Bug | ✅ 推荐 |
| **v2.6.71** | v1.23.2 / Windsurf | 2026-05-17 | **修复**: 安装器提示词增强连接测试改由 Tauri 后端发起，规避跨域假失败；补齐版本同步脚本入口 | ✅ 推荐 |
| **v2.6.70** | v1.23.2 / Windsurf | 2026-05-17 | **配置**: Antigravity 侧边栏新增左右间距控制，默认 8px / 3px，仅作用于 Cascade 侧边栏 | ✅ 推荐 |
| **v2.6.69** | v1.23.2 / Windsurf | 2026-05-16 | **清理**: 物理删除复制、Mermaid、Math、表格修复链路；字体调节保留但默认关闭；Manager 提示词扫描改为 DOM 变更触发 | ✅ 推荐 |
| **v2.6.68** | v1.23.2 / Windsurf | 2026-05-16 | **修复**: 旧配置自动关闭复制、字体、渲染类非核心开关，并同步写入 workbench 运行配置，避免 copy 按钮继续显示 | ✅ 推荐 |
| **v2.6.67** | v1.23.2 / Windsurf | 2026-05-16 | **配置**: 默认仅开启滚动到底部和提示词增强，复制按钮与字体调节保留可选但默认关闭 | ✅ 推荐 |
| **v2.6.66** | v1.23.2 / Windsurf | 2026-05-16 | **修复**: 侧边栏滚动按钮容器识别兜底、滚动事件轻量化，并修复 Cascade 重复注入问题 | ✅ 推荐 |
| **v2.6.65** | v1.23.2 / Windsurf | 2026-05-16 | **同步**: Manager 面板滚动补丁支持 Shadow DOM 穿透，确保与侧边栏逻辑归一 | ✅ 推荐 |
| **v2.6.64** | v1.23.2 / Windsurf | 2026-05-16 | **重构**: 滚动性能重构 — State Lock 模式解决长会话卡顿，修复事件监听器泄漏 | ✅ 推荐 |
| **v2.6.63** | v1.23.2 / Windsurf | 2026-05-16 | **修复**: Manager 提示词增强按钮每2秒重复创建，改用 input 元素标记去重 | ✅ 推荐 |
| **v2.6.62** | v1.23.2 / Windsurf | 2026-05-15 | **修复**: 双面板滚动按钮互斥 — 侧边栏不再出现 manager 的重复按钮 | ✅ 推荐 |
| **v2.6.61** | v1.23.2 / Windsurf | 2026-05-15 | **根治**: Manager 滚动按钮终极修复，移除对不存在的语义类名依赖，改为 Tailwind 工具类无关策略 | - |
| **v2.6.60** | v1.23.2 / Windsurf | 2026-05-15 | **根治**: 使用底层 Range/Selection 物理锁定划取输入区，消除“旧文本未清除而引发的优化追加堆叠”Bug | ✅ 推荐 |


---

## 🔧 想手动定制 IDE 版本号？

如果想自定义 Antigravity 版本可在 PowerShell 中执行以下命令手动定制版本号：

```powershell
$p = "D:\Antigravity\resources\app\product.json"
$prod = Get-Content $p -Raw | ConvertFrom-Json
$prod.ideVersion = "1.23.2"
$prod.date = "2026-04-16T08:28:19.366Z"
$prod | ConvertTo-Json -Depth 100 | Set-Content $p -Encoding UTF8
Write-Output "✅ ideVersion & date 修改完成"
```

> [!NOTE]
> 将路径中的 `D:\Antigravity` 替换为实际安装路径。执行后无需重新安装补丁，重启 IDE 即可生效。

---

## 🤝 参与贡献

我们非常欢迎社区的反馈与支持！

- 提交 [Issue](https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/issues) 报告 Bug 或提出新功能。
- 提交 [Pull Request](https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/pulls) 贡献代码。

感谢贡献者: [@mikessslxxx](https://github.com/mikessslxxx)

---

<p align="center">
  💡 如果这个项目提升了你的开发效率, 欢迎点个 <b>Star ⭐</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>
