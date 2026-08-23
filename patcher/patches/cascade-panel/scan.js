/**
 * Cascade Panel 扫描模块
 *
 * 负责提示词增强按钮、输入框 placeholder 与 Mermaid 离线图表自动渲染。
 * 支持虚拟列表滚动监听与防抖优化，确保零性能损耗、随滚随出图。
 */

let config = {
  placeholder: "",
  mermaid: true,
  promptEnhance: {
    enabled: false,
    apiBase: "",
    apiKey: "",
    model: "",
    systemPrompt: "",
  },
};

const INPUT_SELECTORS = [
  '.antigravity-agent-side-panel [role="textbox"]',
  '.antigravity-agent-side-panel [contenteditable="true"]',
  '[placeholder*="Ask anything"]',
  '[placeholder*="Ctrl+L"]',
  '[aria-label*="chat" i]',
  '[aria-label*="input" i]',
  '[aria-label*="message" i]',
  '[class*="chat-input"]',
  '[class*="message-input"]',
  '[class*="prompt-input"]',
  '[contenteditable="true"]',
];
const INPUT_SELECTOR = INPUT_SELECTORS.join(", ");
const ENHANCE_BTN_CLASS = "Antigravity-Power-Pro-enhance-btn";
let enhanceModule = null;
let mermaidModule = null;
let observer = null;
let boundScrollElements = new WeakSet();
let mermaidScanTimer = null;

const getRoot = () =>
  document.querySelector(".antigravity-agent-side-panel") ||
  document.getElementById("conversation") ||
  document.getElementById("chat") ||
  document.getElementById("react-app") ||
  document.body;

function querySelectorAllDeep(selector, root = document) {
  const list = [];
  function traverse(node) {
    if (!node?.querySelectorAll) return;
    node.querySelectorAll(selector).forEach((el) => list.push(el));
    node.querySelectorAll("*").forEach((child) => {
      if (child.shadowRoot) traverse(child.shadowRoot);
    });
  }
  traverse(root);
  return list;
}

const findInput = (root) => {
  const roleInputs = querySelectorAllDeep('[role="textbox"][contenteditable="true"]', root);
  if (roleInputs.length > 0) return roleInputs[0];

  const inputs = querySelectorAllDeep(INPUT_SELECTOR, root);
  return inputs.length > 0 ? inputs[0] : null;
};

const getInputText = (input) => {
  const raw = input?.innerText || input?.textContent || input?.value || "";
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
};

const initPromptEnhanceButton = async (root = getRoot()) => {
  if (!config.promptEnhance?.enabled) return;
  if (document.querySelector(`.${ENHANCE_BTN_CLASS}`)) return;

  if (!enhanceModule) {
    try {
      enhanceModule = await import("../shared/enhance.js");
    } catch (error) {
      console.warn("[Cascade] 无法加载增强模块:", error);
      return;
    }
  }

  enhanceModule.init(config.promptEnhance);
  if (!enhanceModule.isEnabled()) return;

  const input = findInput(root);
  if (!input) return;

  const parent = input.parentElement || input.parentNode?.host || input.parentNode;
  if (!parent) return;

  const btn = enhanceModule.createEnhanceButton(async () => {
    const currentInput = findInput(getRoot()) || input;
    if (!currentInput) {
      enhanceModule.showErrorModal("找不到输入框");
      return;
    }

    const conf = enhanceModule.getConfig();
    if (!conf.apiKey) {
      enhanceModule.showErrorModal("请先在 Antigravity-Power-Pro 中配置 apiKey 并设置模型");
      return;
    }

    const text = getInputText(currentInput);
    if (!text) {
      enhanceModule.showErrorModal("请先输入需要增强的提示词");
      return;
    }

    try {
      const enhanced = await enhanceModule.enhance(text);
      const success = await enhanceModule.setInputValue(currentInput, enhanced);
      enhanceModule.showResultModal(
        enhanced,
        success ? () => {} : (res) => navigator.clipboard.writeText(res).catch(() => {}),
      );
    } catch (error) {
      console.error("[PromptEnhance] 增强失败:", error);
      enhanceModule.showErrorModal(error.message);
    }
  });

  parent.style.setProperty("position", "relative", "important");
  parent.style.setProperty("overflow", "visible", "important");
  btn.style.setProperty("position", "absolute", "important");
  btn.style.setProperty("bottom", "4px", "important");
  btn.style.setProperty("right", "12px", "important");
  btn.style.setProperty("z-index", "999", "important");
  btn.style.setProperty("margin", "0", "important");

  parent.appendChild(btn);
  console.log("[PromptEnhance] 按钮已注入到侧边栏输入框");
};

const applyPlaceholder = () => {
  if (!config.placeholder) return;

  querySelectorAllDeep(INPUT_SELECTOR, getRoot()).forEach((el) => {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      if (el.placeholder !== config.placeholder) el.placeholder = config.placeholder;
      return;
    }

    if (el.contentEditable === "true" && el.dataset.placeholder !== config.placeholder) {
      el.dataset.placeholder = config.placeholder;
      el.setAttribute("aria-placeholder", config.placeholder);
    }
  });
};

// 极速防抖 Mermaid 扫描
const triggerMermaidScan = (root = getRoot()) => {
  if (config.mermaid === false) return;
  if (mermaidScanTimer) clearTimeout(mermaidScanTimer);
  mermaidScanTimer = setTimeout(async () => {
    if (!mermaidModule) {
      try {
        mermaidModule = await import(`./mermaid.js?t=${Date.now()}`);
      } catch (e) {
        console.warn("[Cascade] 无法加载 Mermaid 模块:", e);
        return;
      }
    }
    mermaidModule.scanAndRenderMermaid(root);
  }, 20);
};

// 全局单点捕获委托滚动监听 (O(1) 零开销，无需每次 DOM 变动遍历元素)
let scrollListenerBound = false;
const bindGlobalScrollListener = (root = getRoot()) => {
  if (scrollListenerBound || !root) return;
  scrollListenerBound = true;
  root.addEventListener(
    "scroll",
    () => {
      triggerMermaidScan(root);
    },
    { capture: true, passive: true },
  );
};

let globalScanTimer = null;

const init = () => {
  const root = getRoot();
  applyPlaceholder();
  void initPromptEnhanceButton(root);
  triggerMermaidScan(root);
  bindGlobalScrollListener(root);

  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    if (globalScanTimer) clearTimeout(globalScanTimer);
    globalScanTimer = setTimeout(() => {
      applyPlaceholder();
      const currentRoot = getRoot();
      void initPromptEnhanceButton(currentRoot);
      triggerMermaidScan(currentRoot);
      bindGlobalScrollListener(currentRoot);
    }, 20);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

export const start = (userConfig = {}) => {
  config = {
    ...config,
    ...userConfig,
    promptEnhance: {
      ...config.promptEnhance,
      ...(userConfig.promptEnhance || {}),
    },
  };
  console.log("[Cascade] 启动面板扫描，配置:", config);

  // 预热预加载 Mermaid 引擎，避免首次渲染延迟
  if (config.mermaid !== false) {
    import(`./mermaid.js?t=${Date.now()}`).then((mod) => {
      mermaidModule = mod;
      console.log("[Cascade] Mermaid 渲染引擎预热完成.");
    }).catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
};
