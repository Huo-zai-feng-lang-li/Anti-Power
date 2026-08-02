<p align="center">
  <img src="docs/assets/images/LOGO.gif" alt="Antigravity-Power-Pro" width="120">
</p>

<h1 align="center">Antigravity-Power-Pro Patch</h1>

<p align="center">
  <a href="https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/releases">
    <img src="https://img.shields.io/badge/Version-v2.6.72-gold.svg?style=flat-square" alt="Version">
  </a>
  <a href="https://codeium.com/antigravity">
    <img src="https://img.shields.io/badge/Supports_Antigravity-v1.23.2-green.svg?style=flat-square" alt="Antigravity">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License">
  </a>
  <br>
  <a href="README.md">
    <img src="https://img.shields.io/badge/Language-简体中文-blue?style=for-the-badge&logo=google-translate&logoColor=white" alt="简体中文">
  </a>
</p>

> 🚀 Enhancement patch for **Antigravity AI IDE**, improving the Sidebar and Manager window conversation experience!

<p align="center">
  💬 <a href="https://qm.qq.com/q/AHUKoyLVKg">QQ Group: 993975349</a>
</p>

---

## Introduction

Antigravity-Power-Pro enhances the Antigravity Sidebar, Manager window, and Windsurf conversation experience. The current release focuses on prompt enhancement, smart scroll, and optional font size adjustment.

---

## Features

| Feature                       | Description                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| **Prompt Enhancement**        | Connects to custom LLM APIs to optimize your prompts (similar to Augment Code)                    |
| **Smart Scroll**             | Floating button in the sidebar to quickly locate the latest conversation                          |
| **Font Adjustment**           | Freely adjust sidebar font size for the most comfortable reading experience                       |

## 📸 Demo

For screenshots, see [screenshots.md](docs/reference/screenshots.md).

---

## 📥 Installation

### Windows (Recommended)

1. Go to the Releases page and download `Antigravity-Power-Pro.exe`.
2. Double-click to run; no installation required.
3. The program automatically detects the Antigravity installation path.
4. Select the desired features and click "Install Patch".
5. Restart Antigravity or reopen the Manager window to see the effects.

For manual installation, download the patch zip file from Releases (e.g., `Antigravity-Power-Pro-patches.zip`) and refer to [manual-install.md](patcher/patches/manual-install.md).

### Manual Installation

For manual installation, download the patch zip from Releases and refer to [manual-install.md](patcher/patches/manual-install.md).

---

## Notes

- **Update Overwrite**: Official Antigravity updates may overwrite the patch, requiring reinstallation.
- **Version Compatibility**: Please verify that your Antigravity version matches the supported version before use.
- **Backup Habits**: Create a backup of original files before replacement to facilitate rollback.
- **Known Issues**: See [known-issues.md](docs/reference/known-issues.md).

---

## Documentation

- Project Structure & Classification: [project-structure.md](docs/reference/project-structure.md)
- Screenshots: [screenshots.md](docs/reference/screenshots.md)
- Known Issues: [known-issues.md](docs/reference/known-issues.md)
- Developer Guide: [developer-guide.md](docs/guides/developer-guide.md)
- Release Guide: [release-guide.md](docs/guides/release-guide.md)
- Index: [README.md](docs/README.md)

---

## 📋 Version Info

| Patch Version | Supported Antigravity Version | Date       | Update Content                                                                     |
| ------------- | ----------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| v2.6.71       | v1.23.2 / Windsurf            | 2026-05-17 | **Fix**: Prompt enhance connection test now runs through the Tauri backend to avoid CORS false failures; added the version sync npm entry |
| v2.6.70       | v1.23.2 / Windsurf            | 2026-05-17 | **Config**: Added Antigravity sidebar left/right spacing controls, defaulting to 8px / 3px and scoped to Cascade only |
| v2.6.69       | v1.23.2 / Windsurf            | 2026-05-16 | **清理**: 物理删除复制、Mermaid、Math、表格修复链路；字体调节保留但默认关闭；Manager 提示词扫描改为 DOM 变更触发 |
| v2.6.68       | v1.23.2 / Windsurf            | 2026-05-16 | **修复**: 旧配置自动关闭复制、字体、渲染类非核心开关，并同步写入 workbench 运行配置，避免 copy 按钮继续显示 |
| v2.6.67       | v1.23.2 / Windsurf            | 2026-05-16 | **配置**: 默认仅开启滚动到底部和提示词增强，复制按钮与字体调节保留可选但默认关闭 |
| v2.6.66       | v1.23.2 / Windsurf            | 2026-05-16 | **Fix**: Sidebar scroll button robust container detection, lightweight scroll updates, and idempotent cascade injection |
| v2.6.65       | v1.23.2 / Windsurf            | 2026-05-16 | **Sync**: Manager panel scroll patch supports Shadow DOM traversal, aligning with sidebar logic |
| v2.6.64       | v1.23.2 / Windsurf            | 2026-05-16 | **Refactor**: Scroll performance refactor — State Lock mode to solve long-session lag, fixed memory leak |
| v2.6.56       | v1.23.2 / Windsurf            | 2026-05-15 | **Fix**: Native DOM inject via ClipboardEvent/execCommand, bypassing React Virtual DOM blocks |
| v2.6.55       | v1.23.2 / Windsurf            | 2026-05-15 | **Fix**: Manager scroll priority +10000 to prevent hijacked tracking by sidebars   |
| v2.6.54       | v1.23.2 / Windsurf            | 2026-05-15 | **Fix**: Manager scroll conditionally mounted to `.monaco-workbench` safely        |
| v2.6.53       | v1.23.2 / Windsurf            | 2026-05-15 | **Tweak**: Removed aggressive fallback mapping to `.monaco-workbench`              |
| v2.6.52       | v1.23.2 / Windsurf            | 2026-05-15 | **Fix**: Manager scroll button display issue (findRoot exclusion)                  |
| v2.6.51       | v1.23.2 / Windsurf            | 2026-05-15 | **Fix**: Windsurf input value retrieval (innerText) and echo status accurate report|
| v2.6.49       | v1.23.2 / Windsurf            | 2026-05-14 | **Performance**: Scoped scanning to root containers, reducing CPU load             |
| v2.6.0        | v1.15.8 / Windsurf            | 2026-03-12 | Minimalist Refactor: Focus UI on 3 core features, removed redundant items          |
| v2.5.7        | v1.15.8 / Windsurf            | 2026-03-11 | Prompt enhancement logic optimization and path fix                                 |
| v2.5.6        | v1.15.8 / Windsurf            | 2026-03-11 | Optimize prompt enhancement button style (rounded rectangle)                       |
| v2.2.0        | v1.14.2                       | 2026-01-21 | Manager Mermaid/Math rendering, width/font size adjustment, thanks to @mikessslxxx |
| v2.1.0        | v1.14.2                       | 2026-01-19 | Sidebar font adjustment, Mermaid error hint optimization, Manager one-click copy   |
| v2.0.1        | v1.14.2                       | 2026-01-14 | Performance optimization                                                           |
| v2.0.0        | v1.14.2                       | 2026-01-14 | Added Tauri tool, supports toggling individual features                            |
| v1.2.1        | v1.13.3                       | 2026-01-13 | Bug fixes                                                                          |
| v1.2.0        | v1.13.3                       | 2026-01-13 | Mermaid rendering                                                                  |
| v1.1.0        | v1.13.3                       | 2026-01-13 | Math formula rendering                                                             |
| v1.0.0        | v1.13.3                       | 2026-01-13 | One-click copy, table fix                                                          |

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

---

## 🙏 Acknowledgments

Thanks to the following contributors for their support:

- [@mikessslxxx](https://github.com/mikessslxxx)

---

## ⚖️ License

MIT License

---

<p align="center">
  💡 If this project helps you, please Star ⭐
</p>
