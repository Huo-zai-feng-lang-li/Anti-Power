/**
 * Antigravity-Power-Pro Cascade 入口
 *
 * 保留功能：滚动到底部、提示词增强、字体大小（默认关闭）。
 */

if (window.trustedTypes && !window.trustedTypes.defaultPolicy) {
  window.trustedTypes.createPolicy("default", {
    createHTML: (string) => string,
    createScriptURL: (string) => string,
    createScript: (string) => string,
  });
  console.log("[Cascade] Trusted Types 'default' policy registered.");
}

const FEATURE_DEFAULTS_VERSION = 1;

const DEFAULT_CONFIG = {
  featureDefaultsVersion: FEATURE_DEFAULTS_VERSION,
  fontSizeEnabled: false,
  fontSize: 14,
  sidePaddingLeft: 8,
  sidePaddingRight: 3,
  scrollToBottom: true,
  placeholder: "Ask Antigravity...",
  promptEnhance: {
    enabled: true,
    apiBase: "https://tokenrhythm.studio/v1",
    apiKey: "",
    model: "deepseek-v4-flash",
    systemPrompt: "",
  },
};

const normalizeConfig = (data = {}) => {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const merged = {
    ...DEFAULT_CONFIG,
    ...source,
    promptEnhance: { ...DEFAULT_CONFIG.promptEnhance, ...(source.promptEnhance || {}) },
  };
  if ((Number(source.featureDefaultsVersion) || 0) < FEATURE_DEFAULTS_VERSION) {
    merged.fontSizeEnabled = false;
  }
  merged.featureDefaultsVersion = FEATURE_DEFAULTS_VERSION;
  return merged;
};

const loadConfig = async () => {
  try {
    const configUrl = new URL("./config.json", import.meta.url).href;
    const res = await fetch(configUrl, { cache: "no-store" });
    const data = await res.json();
    return normalizeConfig(data);
  } catch {
    return DEFAULT_CONFIG;
  }
};

const applyFontSize = (userConfig) => {
  const root = document.documentElement;
  if (root && userConfig?.fontSizeEnabled) {
    root.style.setProperty("--cascade-panel-font-size", `${userConfig.fontSize}px`);
  }
};

const toSafePixels = (value, fallback) => {
  const number = Number(value);
  const safeValue = Number.isFinite(number) ? number : fallback;
  return `${Math.min(48, Math.max(0, safeValue))}px`;
};

const applySidePadding = (userConfig) => {
  const root = document.documentElement;
  if (!root) return;
  root.style.setProperty(
    "--cascade-panel-padding-left",
    toSafePixels(userConfig?.sidePaddingLeft, DEFAULT_CONFIG.sidePaddingLeft),
  );
  root.style.setProperty(
    "--cascade-panel-padding-right",
    toSafePixels(userConfig?.sidePaddingRight, DEFAULT_CONFIG.sidePaddingRight),
  );
};

(async () => {
  const config = await loadConfig();
  applyFontSize(config);
  applySidePadding(config);

  const { start } = await import("./scan.js");
  start(config);

  if (config.scrollToBottom !== false) {
    const { init } = await import("./scroll-to-bottom.js");
    init();
  }
})();
