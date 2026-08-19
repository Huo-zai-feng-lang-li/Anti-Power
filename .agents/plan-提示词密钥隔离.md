# 提示词密钥隔离计划

## 目标

在不影响本地提示词增强默认可用的前提下，避免真实 `sk_tr_` API key 再进入 tracked 源码。

## 执行步骤

1. [x] 添加 secret 扫描测试，先确认当前硬编码 key 会导致测试失败。
2. [x] 清空 tracked 默认配置里的真实 key。
3. [x] 使用 `patcher/.env.local` 保存本机新 key，由 Vite 注入安装器默认配置。
4. [x] 运行扫描测试、相关 JS 测试和前端构建。

## 验收标准

- `git grep` 在 tracked 文件中找不到 `sk_tr_`。
- `node --test patcher/tests/no-committed-secrets.test.js` 通过。
- `patcher/.env.local` 未被 git 跟踪，且包含本机新 key。
- `npm run build --prefix patcher` 通过。
