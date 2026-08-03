# Antigravity-Power-Pro 补丁手动安装说明

适用于 Windows 的手动安装与配置.

## 适用场景

- Windows: 推荐优先使用 Antigravity-Power-Pro.exe 安装器, 也可手动安装

## 补丁包内容

- cascade-panel.html
- cascade-panel/ 目录
- workbench-jetski-agent.html
- launchpad-bridge.html
- manager-panel/ 目录
- manual-install.md (本文档)

## Windows (推荐: 安装器方式)

1. 下载 Antigravity-Power-Pro.exe
2. 双击运行, 自动检测 Antigravity 安装路径
3. 勾选功能并点击 安装补丁
4. 重新打开 Antigravity 与 Manager 窗口

## Windows (手动安装)

1. 关闭所有 Antigravity 窗口
2. 进入安装目录:
   - ...\resources\app\extensions\antigravity\
   - ...\resources\app\out\vs\code\electron-browser\workbench\
3. 备份并替换文件:
   - 备份 cascade-panel.html -> cascade-panel.html.bak
   - 复制 cascade-panel.html 与 cascade-panel/ 到 extensions\antigravity\
   - 备份 workbench-jetski-agent.html -> workbench-jetski-agent.html.bak
   - 复制 workbench-jetski-agent.html、launchpad-bridge.html 与 manager-panel/ 到 workbench\
4. 重新打开 Antigravity 与 Manager 窗口

## 配置开关

补丁会在以下路径生成配置文件, 可按需修改:

- 侧边栏: extensions/antigravity/cascade-panel/config.json 与 out/vs/code/electron-browser/workbench/cascade-panel/config.json（两处保持一致）
- Manager: out/vs/code/electron-browser/workbench/manager-panel/config.json

示例 (侧边栏):

```json
{
  "featureDefaultsVersion": 1,
  "scrollToBottom": true,
  "fontSizeEnabled": false,
  "fontSize": 14,
  "sidePaddingLeft": 8,
  "sidePaddingRight": 3,
  "promptEnhance": {
    "enabled": true
  }
}
```

示例 (Manager):

```json
{
  "featureDefaultsVersion": 1,
  "scrollToBottom": true,
  "fontSizeEnabled": false,
  "fontSize": 16,
  "promptEnhance": {
    "enabled": true
  }
}
```

修改配置后, 建议重新打开 Manager 窗口以生效.

## 注意事项

- 修改 workbench-jetski-agent.html 会触发 扩展已损坏 提示, 但不影响使用
- Antigravity 官方更新可能覆盖补丁, 需要重新安装
