/**
 * Antigravity-Power-Pro 补丁入口
 * 根据配置文件动态加载功能模块
 */

import { loadStyle } from "./utils.js";

const DEFAULT_CONFIG = {
  mermaid: true,
  math: true,
  copyButton: true,
  tableColor: true,
  fontSizeEnabled: true,
  fontSize: 20,
  scrollToBottom: true,
  // 提示词增强配置
  promptEnhance: {
    enabled: false,
    apiBase: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    systemPrompt: "",
  },
};

// 加载配置
const loadConfig = async () => {
  try {
    const res = await fetch("./cascade-panel/config.json", {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Config load failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...data };
  } catch {
    // 默认全部启用
    return DEFAULT_CONFIG;
  }
};

// 应用字体大小配置
const applyFontSize = (userConfig) => {
  const root = document.documentElement;
  if (!root) return;

  if (!userConfig?.fontSizeEnabled) {
    root.style.removeProperty("--cascade-panel-font-size");
    return;
  }

  const size = Number(userConfig.fontSize);
  if (!Number.isFinite(size) || size <= 0) {
    root.style.removeProperty("--cascade-panel-font-size");
    return;
  }

  root.style.setProperty("--cascade-panel-font-size", `${size}px`);
};

// 动态加载表格修复样式
const loadTableFix = () => {
  void loadStyle("./cascade-panel/table-fix.css").catch((error) => {
    console.warn("[Cascade] 表格样式加载失败:", error);
  });
};

// 入口
(async () => {
  const config = await loadConfig();
  applyFontSize(config);

  // 表格颜色修复（CSS 动态加载）
  if (config.tableColor) {
    loadTableFix();
  }

  // 初始化提示词增强模块
  if (config.promptEnhance?.enabled) {
    try {
      const enhance = await import("./enhance.js");
      enhance.init(config.promptEnhance);
      enhance.injectStyles();
      console.log("[Cascade] 提示词增强模块已加载");
    } catch (error) {
      console.warn("[Cascade] 提示词增强模块加载失败:", error);
    }
  }

  // 启动扫描模块，传入配置
  const { start } = await import("./scan.js");
  start(config);

  // 滚动到底部按钮
  if (config.scrollToBottom !== false) {
    try {
      const scrollMod = await import("./scroll-to-bottom.js");
      scrollMod.init();
    } catch (error) {
      console.warn("[Cascade] 滚动模块加载失败:", error);
    }
  }
})();
