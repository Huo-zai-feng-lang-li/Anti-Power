---
description: Antigravity-Power-Pro 项目开发技能与工作流
---

# Skills - Antigravity-Power-Pro

## 1. 新增 IDE 补丁功能

```
1. 在 patcher/patches/<ide>-panel/ 下创建 JS/CSS 文件
2. 修改 patcher/patches/.embed-exclude.txt 排除 config.json
3. 在 patcher/src-tauri/src/commands/patch.rs 添加:
   - FeatureConfig 结构体
   - install/uninstall/update_config/check_status/read_config 命令
   - backup/write/restore 辅助函数
4. 在 commands/mod.rs 导出, lib.rs 注册命令
5. 在 patcher/src/App.vue 添加前端状态和 UI
6. 更新 AGENTS.md 和 README.md
```

## 2. 调试 Windsurf DOM (CDP)

```powershell
# 确保 Windsurf 以 --remote-debugging-port=9222 启动
# 使用 Node.js + ws 库连接 CDP
$env:NODE_PATH="C:\Users\Administrator\AppData\Local\nvm\v20.19.5\node_modules"

# 查询 DOM 元素
node -e "
const WebSocket = require('ws');
const http = require('http');
http.get('http://127.0.0.1:9222/json', res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    const ws = new WebSocket(JSON.parse(d)[0].webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',
        params:{expression:'document.getElementById(\"windsurf.cascadePanel\")?.innerHTML.length'}}));
    });
    ws.on('message', m => { console.log(JSON.parse(m).result?.result?.value); ws.close(); });
  });
});
"
```

## 3. Trusted Types CSP 处理

Windsurf 的 CSP 启用了 `require-trusted-types-for 'script'`, 阻止所有 innerHTML 赋值.

```
解决方案:
1. workbench-windsurf.html CSP trusted-types 白名单添加 'default'
2. 补丁 JS 最早位置创建 default policy:
   if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
     window.trustedTypes.createPolicy("default", {
       createHTML: s => s, createScript: s => s, createScriptURL: s => s
     });
   }
3. SVG 图标优先用 document.createElementNS 纯 DOM API
```

## 4. 版本发布流程

```
// turbo
1. 同步版本号 (3 个文件):
   patcher/package.json
   patcher/src-tauri/tauri.conf.json
   patcher/src-tauri/Cargo.toml

2. 更新 README.md 版本 badge 和版本表格

3. git add -A
// turbo
4. git commit -m "release: vX.Y.Z"
// turbo
5. git tag vX.Y.Z
6. git push origin main --tags --force
   -> 触发 .github/workflows/release.yml 构建 EXE
```

## 5. 热更新补丁到 Windsurf (不重启)

```powershell
# 复制修改后的补丁文件到 Windsurf 目录
$wbDir = "C:\Users\Administrator\AppData\Local\Programs\Windsurf\resources\app\out\vs\code\electron-browser\workbench"
Copy-Item "patcher\patches\windsurf-panel\*.js" "$wbDir\windsurf-panel\" -Force
Copy-Item "patcher\patches\windsurf-panel\*.css" "$wbDir\windsurf-panel\" -Force

# 通过 CDP 重载 CSS (无需重启)
# 通过 CDP 注入 JS 测试新逻辑 (需要重启才能加载新 JS 模块)
```

## 6. product.json checksums 处理

```
- 修改 workbench.html 后 IDE 校验 checksums 不匹配, 提示 "安装损坏"
- 安装时: clear_product_checksums 清空 checksums 字段 (备份 .bak)
- 卸载时: 恢复 product.json.bak
- 注意: PowerShell Set-Content 会写入 UTF-8 BOM, Rust 需 trim_start_matches('\u{feff}')
```

## 7. 嵌入文件管理

```
- build.rs 自动扫描 patcher/patches/ 生成嵌入清单
- .embed-exclude.txt 排除不需要嵌入的文件 (config.json, 文档等)
- 新增补丁文件后需确认排除列表是否需要更新
- embedded.rs 通过 include!() 引入编译时生成的清单
```

## 8. Windsurf DOM 关键选择器

```
面板根节点:     #windsurf.cascadePanel
滚动区域:       .cascade-scrollbar
消息块:         .text-ide-message-block-bot-color
输入框:         [contenteditable][role="textbox"]
输入框父容器:   通过 input.closest('[class*="rounded"]') 定位
```
