# 已知问题

本文档记录 Antigravity-Power-Pro 的已知问题和限制.

---

## 表格内公式渲染失败

**问题描述**: 在 Markdown 表格中使用包含 `|` 字符的 LaTeX 公式时, 公式可能无法正常渲染.

**影响范围**:

- 绝对值: `$|x|$`
- 行列式: `$\left| ... \right|$`
- 其他使用裸露 `|` 的公式

**原因**: Antigravity 官方 Markdown 解析器会将 `|` 字符误认为表格分隔符, 破坏公式结构.

**变通方案**:

1. **LaTeX 公式**: 使用不含 `|` 的替代写法
   - 绝对值: `$\lvert x \rvert$` 替代 `$|x|$`
   - 条件符号: `$\mid$` 替代 `$|$`

2. **纯文本**: 使用反斜杠转义 `\|` 来显示竖线字符

**详细信息**: [Issue #7](https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro/issues/7)

---

## Manager 字号调节暂未生效

**问题描述**: Manager 窗口的字体大小开关与数值目前不会影响实际渲染.

**影响范围**:

- Manager 窗口设置中的 "字体大小"

**备注**: 该功能保留为占位, 后续会在 Manager 渲染链路稳定后补齐.

---

## ~~Manager 补丁导致 "安装损坏" 提示~~ (已修复)

> ✅ **此问题已在 v2.3.1 版本中修复**
>
> 现在安装 Manager 补丁时，Patcher 会自动清空 `product.json` 中的 `checksums` 字段，从而避免"安装损坏"提示。

**问题描述**: 启用 Manager 补丁后, 打开 Antigravity 时左下角会弹出 "Antigravity 安装似乎损坏. 请重新安装." 的提示.

**原因**: Manager 补丁需要修改 `workbench-jetski-agent.html` 文件, Antigravity 启动时会检测该文件的完整性, 发现被修改后会弹出此警告.

**解决方案**: Patcher 在安装 Manager 补丁时会自动清空 `product.json` 的 checksums 字段, 绕过完整性校验.
