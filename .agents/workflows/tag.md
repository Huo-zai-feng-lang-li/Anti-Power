---
description: 打 tag 发版前的检查清单和代码规范
---

# /tag 发版工作流

## 前置检查 (必须全部通过才能打 tag)

### 1. 版本号同步 (自动化)

// turbo-all
```bash
# 只要修改了 patcher/package.json 即可执行同步
npm run --prefix patcher sync-version
```

### 2. CHANGELOG.md 更新

- 在 `CHANGELOG.md` 顶部添加新版本记录
- 必须包含: Bug 修复表格 + 踩坑备忘 (如有新发现)
- 格式参考已有条目

### 3. README.md 版本表更新

- 更新 badge 版本号
- 在版本历史表格顶部添加新行

### 4. 代码规范检查

- [ ] CSS: 不同模块的 DOM 元素必须使用**不同 ID**, 禁止跨模块共享 CSS ID
- [ ] CSS: 通过 JS toggle class 切换的属性, 初始态和目标态的 `!important` 级别必须一致
- [ ] JS: `contenteditable` 元素**取值**用 `innerText`，**写入**必须用 `Range.selectNodeContents()` + `execCommand("insertText")`，严禁 `innerText = value` 赋值或 `execCommand("selectAll")`（会导致追加 Bug）
- [ ] 系统提示词: 修改 `DEFAULT_SYSTEM_PROMPT` 时必须同时递增 `SYSTEM_PROMPT_VERSION`
- [ ] 系统提示词: `App.vue` 和 `enhance.js` 的 `DEFAULT_SYSTEM_PROMPT` 必须同步
- [ ] 嵌入排除: 新增/删除补丁文件时检查 `.embed-exclude.txt` 是否需要更新
- [ ] 历史残留扫描: 确认已清理链路没有重新出现在运行时链路、配置模型、UI 开关和当前能力文档中
- [ ] 圈复杂度 ≤ 9

建议扫描命令:

```bash
rg -n "copyButton|copy_button|tableColor|table_color|table-fix|copy\.js|math\.js|mermaid\.js|extract\.js|icons\.js|constants\.js|anti-power\.sh|Antigravity-Power-Pro\.sh|Antigravity-Power-Pro-macOS\.sh|setInterval\(" patcher/src patcher/src-tauri patcher/patches README.md README_EN.md docs .agent/rules .agent/handoff.md CHANGELOG.md -S
```

允许例外:

- `CHANGELOG.md` 的历史版本记录可以保留旧字段名。
- README 当前能力说明不要继续宣传已清理链路。
- `workbench-*.html` 的 `trusted-types` 白名单中出现 `mermaid` / `dompurifyMermaid` 属于 IDE 宿主页面安全策略，不代表补丁功能残留，禁止为了清词误删。

### 5. 嵌入文件验证

确认 `build.rs` 自动生成的嵌入清单包含所有需要的补丁文件:

```bash
grep -r "include!" patcher/src-tauri/src/embedded.rs patcher/src-tauri/build.rs
cat patcher/patches/.embed-exclude.txt
rg --files patcher/patches
```

### 6. 多入口同步检查

修改以下文件时, 必须检查对应模块是否需要同步:

| 修改文件 | 必须同步检查 |
|----------|-------------|
| `cascade-panel/cascade-panel.css` | `manager-panel/manager-panel.css` 视觉归一 |
| `cascade-panel/scan.js` | `manager-panel/scan.js` (如有) |
| `shared/enhance.js` DEFAULT_SYSTEM_PROMPT | `src/App.vue` DEFAULT_SYSTEM_PROMPT |
| `cascade-panel/scroll-to-bottom.js` | `manager-panel/scroll-to-bottom.js` |

## 执行步骤

### Step 1: 递增版本号

修改 **patcher/package.json** 的版本号，然后运行 `npm run --prefix patcher sync-version` 自动对齐其余 5 处。

### Step 2: 更新文档

- CHANGELOG.md: 添加新版本记录
- README.md: 更新 badge + 版本历史表

### Step 3: 提交 + 打 tag + 推送

```bash
git add -A
git commit -m "chore: bump to vX.Y.Z

- <变更摘要>"
git tag vX.Y.Z
git push origin main --tags
```

### Step 4: 验证 CI

```bash
# 检查 GitHub Actions 是否触发
# 注意: force-push 已有 tag 不保证触发 CI, 必须用新 tag
```

## 禁止事项

- ❌ 禁止不改版本号就打 tag
- ❌ 禁止 force-push 已有 tag (删除重建可以, 但需同时删除远程 tag)
- ❌ 禁止跳过 CHANGELOG 更新
- ❌ 禁止修改补丁源文件后不重新构建 exe 就测试
