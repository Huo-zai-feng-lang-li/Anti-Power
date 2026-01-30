/**
 * Cascade Panel 内容扫描模块
 *
 * 本模块是补丁的核心调度器，负责：
 * - 扫描 DOM 中的内容区域并触发渲染
 * - 监听 DOM 变更以处理新增内容
 * - 管理延迟渲染队列，等待内容稳定后再处理
 *
 * 扫描策略：
 * - 使用 MutationObserver 监听 DOM 变更
 * - 通过反馈按钮判断消息是否完成输出
 * - 延迟渲染避免流式输出时频繁触发
 *
 * 模块入口为 start() 函数，接收配置并启动扫描。
 */

import { CONTENT_SELECTOR } from "./constants.js";
import { addFeedbackCopyButtons, ensureContentCopyButton } from "./copy.js";
import { renderMath } from "./math.js";
import { renderMermaid } from "./mermaid.js";

/**
 * 功能配置（由入口传入）
 */
let config = {
  mermaid: true,
  math: true,
  copyButton: true,
  tableColor: true,
  fontSizeEnabled: true,
  fontSize: 20,
  promptEnhance: {
    enabled: false,
    apiBase: "",
    apiKey: "",
    model: "",
    systemPrompt: "",
  },
};

const FEEDBACK_SELECTOR =
  '[data-tooltip-id^="up-"], [data-tooltip-id^="down-"]';
const MAX_FEEDBACK_DEPTH = 20;
const STABLE_RENDER_DELAY = 360;
const STABLE_RENDER_MAX_WAIT = 2500;
const deferredRenders = new WeakMap();

/**
 * 判断内容区是否已有反馈按钮，代表消息已完成输出
 * @param {Element} contentEl
 * @returns {boolean}
 */
const hasFeedbackButtons = (contentEl) => {
  let node = contentEl;
  for (let i = 0; i < MAX_FEEDBACK_DEPTH && node; i += 1) {
    if (node.querySelector?.(FEEDBACK_SELECTOR)) {
      const contents = node.querySelectorAll(CONTENT_SELECTOR);
      if (contents.length === 0) return false;
      return contents[contents.length - 1] === contentEl;
    }
    node = node.parentElement;
  }
  return false;
};

/**
 * 取消延迟渲染调度
 * @param {Element} contentEl
 * @returns {void}
 */
const clearDeferredRender = (contentEl) => {
  const state = deferredRenders.get(contentEl);
  if (!state) return;
  clearTimeout(state.timerId);
  deferredRenders.delete(contentEl);
};

/**
 * 批量渲染内容区内的 Mermaid
 * @param {Element} root
 * @returns {void}
 */
const renderMermaidWithin = (root) => {
  if (!config.mermaid) return;
  const mermaidNodes = [];
  if (root.matches && root.matches('[class*="language-mermaid"]')) {
    mermaidNodes.push(root);
  }
  mermaidNodes.push(...root.querySelectorAll('[class*="language-mermaid"]'));
  mermaidNodes.forEach((node) => {
    void renderMermaid(node);
  });
};

/**
 * 延迟渲染：等待内容稳定或反馈按钮出现
 * @param {Element} contentEl
 * @returns {void}
 */
const scheduleDeferredRender = (contentEl) => {
  if (!contentEl || !contentEl.isConnected) return;

  const text = contentEl.textContent || "";
  const now = Date.now();
  const existing = deferredRenders.get(contentEl);

  if (existing) {
    if (existing.lastText !== text) {
      existing.lastText = text;
      existing.lastChange = now;
    }
    return;
  }

  const state = {
    lastText: text,
    lastChange: now,
    timerId: 0,
  };

  const attempt = () => {
    deferredRenders.delete(contentEl);
    if (!contentEl || !contentEl.isConnected) return;

    const currentText = contentEl.textContent || "";
    const currentTime = Date.now();
    if (currentText !== state.lastText) {
      state.lastText = currentText;
      state.lastChange = currentTime;
      state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
      deferredRenders.set(contentEl, state);
      return;
    }

    const idleMs = currentTime - state.lastChange;
    const complete = hasFeedbackButtons(contentEl);
    const feedbackExpected = document.querySelector(FEEDBACK_SELECTOR) !== null;

    if (complete) {
      renderContentNode(contentEl, true);
      return;
    }

    if (!feedbackExpected && idleMs >= STABLE_RENDER_DELAY) {
      renderContentNode(contentEl, true);
      return;
    }

    if (feedbackExpected && idleMs >= STABLE_RENDER_MAX_WAIT) {
      renderContentNode(contentEl, true);
      return;
    }

    state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
    deferredRenders.set(contentEl, state);
  };

  state.timerId = window.setTimeout(attempt, STABLE_RENDER_DELAY);
  deferredRenders.set(contentEl, state);
};

/**
 * 渲染单个内容区：等待完成信号或稳定后再处理
 * @param {Element} contentEl
 * @param {boolean} [force=false] - true 表示跳过完成信号检查
 * @returns {void}
 */
const renderContentNode = (contentEl, force = false) => {
  if (!contentEl || !contentEl.isConnected) return;

  if (config.copyButton) {
    ensureContentCopyButton(contentEl);
  }

  const ready = force || hasFeedbackButtons(contentEl);
  if (!ready) {
    scheduleDeferredRender(contentEl);
    return;
  }

  clearDeferredRender(contentEl);

  if (config.math) {
    void renderMath(contentEl);
  }
  renderMermaidWithin(contentEl);
};

/**
 * 扫描根节点并处理需要增强的内容区域
 * @param {Element} root
 * @returns {void}
 */
const scan = (root) => {
  if (!root || !root.isConnected) return;

  // 检查根节点本身及子节点是否匹配内容选择器
  const contentNodes = [];
  if (root.matches && root.matches(CONTENT_SELECTOR)) {
    contentNodes.push(root);
  }
  contentNodes.push(...root.querySelectorAll(CONTENT_SELECTOR));

  const contentSet = new Set(contentNodes);
  contentNodes.forEach((node) => renderContentNode(node));

  if (config.mermaid) {
    const mermaidNodes = [];
    if (root.matches && root.matches('[class*="language-mermaid"]')) {
      mermaidNodes.push(root);
    }
    mermaidNodes.push(...root.querySelectorAll('[class*="language-mermaid"]'));

    mermaidNodes.forEach((node) => {
      const contentRoot = node.closest?.(CONTENT_SELECTOR);
      if (contentRoot && contentSet.has(contentRoot)) {
        return;
      }
      void renderMermaid(node);
    });
  }
};

/**
 * 获取渲染根节点，按优先级依次寻找
 * @returns {Element}
 */
const getRoot = () =>
  document.getElementById("chat") ||
  document.getElementById("react-app") ||
  document.body;

let pendingNodes = new Set();
let scheduled = false;

/**
 * 批量处理待扫描节点
 */
const flushScan = () => {
  scheduled = false;
  const nodes = [...pendingNodes];
  pendingNodes.clear();

  nodes.forEach((node) => {
    if (node.isConnected) scan(node);
  });

  if (config.copyButton) {
    addFeedbackCopyButtons();
  }
};

/**
 * 调度扫描任务
 * @param {NodeList|Array} nodes
 */
const resolveScanRoot = (target) => {
  if (!target) return null;
  if (target.nodeType === Node.TEXT_NODE) {
    target = target.parentElement;
  }
  if (target.closest) {
    const contentRoot = target.closest(CONTENT_SELECTOR);
    if (contentRoot) return contentRoot;
  }

  let node = target;
  for (let i = 0; i < MAX_FEEDBACK_DEPTH && node; i += 1) {
    const candidate = node.querySelector?.(CONTENT_SELECTOR);
    if (candidate) return candidate;
    node = node.parentElement;
  }

  return target;
};

const scheduleScan = (nodes) => {
  let hasElements = false;
  const enqueue = (target) => {
    if (!target) return;
    const scanRoot = resolveScanRoot(target);
    if (!scanRoot) return;
    pendingNodes.add(scanRoot);
    hasElements = true;
  };

  nodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      enqueue(node);
      return;
    }
    if (node.parentElement) {
      enqueue(node.parentElement);
    }
  });

  if (hasElements && !scheduled) {
    scheduled = true;
    requestAnimationFrame(flushScan);
  }
};

/**
 * 提示词增强按钮初始化
 * 在输入框区域注入增强按钮
 */
// Cascade/Windsurf 输入框的多种可能选择器
const INPUT_SELECTORS = [
  // Cascade 特定选择器
  '[placeholder*="Ask anything"]',
  '[placeholder*="Ctrl+L"]',
  '[aria-label*="chat" i]',
  '[aria-label*="input" i]',
  '[aria-label*="message" i]',
  '[class*="chat-input"]',
  '[class*="message-input"]',
  '[class*="prompt-input"]',
  // 通用选择器
  "textarea",
  '[contenteditable="true"]',
  'input[type="text"]',
];
const INPUT_SELECTOR = INPUT_SELECTORS.join(", ");
const ENHANCE_BTN_CLASS = "Antigravity-Power-Pro-enhance-btn";
let enhanceModule = null;

/**
 * 查找 Cascade 的主输入框
 * @param {Element} root
 * @returns {Element|null}
 */
function findCascadeInput(root) {
  // 优先使用 Cascade 特定选择器
  for (const selector of INPUT_SELECTORS) {
    const el = root.querySelector(selector);
    if (
      el &&
      (el.tagName === "TEXTAREA" ||
        el.contentEditable === "true" ||
        el.tagName === "INPUT")
    ) {
      console.log(
        "[PromptEnhance] 找到输入框:",
        selector,
        el.tagName,
        el.className,
      );
      return el;
    }
  }
  return null;
}

const initPromptEnhanceButton = async () => {
  // 延迟加载增强模块
  if (!enhanceModule) {
    try {
      enhanceModule = await import("./enhance.js");
    } catch (error) {
      console.warn("[Cascade] 无法加载增强模块:", error);
      return;
    }
  }

  // 初始化模块配置（注入样式等）
  enhanceModule.init(config.promptEnhance);

  if (!enhanceModule.isEnabled()) return;

  // 查找输入框区域
  const root = getRoot();
  const inputAreas = root.querySelectorAll(INPUT_SELECTOR);

  inputAreas.forEach((input) => {
    // 检查是否已添加按钮
    const parent = input.parentElement;
    if (!parent || parent.querySelector(`.${ENHANCE_BTN_CLASS}`)) return;

    // 创建增强按钮
    const btn = enhanceModule.createEnhanceButton(async () => {
      // 重新获取当前活动的输入框
      const root = getRoot();
      const currentInput = findCascadeInput(root);

      if (!currentInput) {
        console.error(
          "[PromptEnhance] 找不到输入框，尝试的选择器:",
          INPUT_SELECTORS,
        );
        enhanceModule.showErrorModal("找不到输入框");
        return;
      }

      const text = currentInput.value || currentInput.textContent || "";
      if (!text.trim()) {
        enhanceModule.showErrorModal("请先输入提示词");
        return;
      }

      btn.classList.add("loading");
      try {
        const enhanced = await enhanceModule.enhance(text);
        console.log("[PromptEnhance] 增强完成，准备填入输入框");

        // 使用 enhance.js 中导出的可靠赋值方法
        const success = await enhanceModule.setInputValue(currentInput, enhanced);

        if (success) {
          console.log("[PromptEnhance] 输入框填入成功");
          enhanceModule.showResultModal(
            enhanced,
            () => {},
            () => {},
          );
        } else {
          // 如果自动填入失败，让用户手动复制
          console.warn("[PromptEnhance] 自动填入可能失败，显示结果供复制");
          enhanceModule.showResultModal(
            enhanced,
            () => copyToClipboard(enhanced),
            () => {},
          );
        }
      } catch (error) {
        console.error("[PromptEnhance] 增强失败:", error);
        enhanceModule.showErrorModal(error.message);
      } finally {
        btn.classList.remove("loading");
      }
    });

    function copyToClipboard(text) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.log("[PromptEnhance] 已复制到剪贴板");
        })
        .catch((err) => {
          console.error("[PromptEnhance] 复制失败:", err);
        });
    }

    // 插入按钮到发送按钮旁边
    // 查找发送按钮的多种可能选择器
    const sendButtonSelectors = [
      'button[type="submit"]',
      'button[aria-label*="send" i]',
      'button[aria-label*="发送" i]',
      'button[title*="send" i]',
      'button[title*="发送" i]',
      '[class*="send-button"]',
      '[class*="submit-button"]',
      '[data-testid*="send"]',
      '[data-testid*="submit"]',
    ];

    let sendButton = null;
    const inputContainer =
      input.closest(
        '[class*="input"], [class*="composer"], [class*="chat"], form',
      ) || parent;

    for (const selector of sendButtonSelectors) {
      sendButton = inputContainer.querySelector(selector);
      if (sendButton) break;
    }

    if (sendButton && sendButton.parentNode) {
      // 插入到发送按钮之前
      sendButton.parentNode.insertBefore(btn, sendButton);
    } else {
      // 备选：查找工具栏或按钮区域
      const toolbar = inputContainer.querySelector(
        '[class*="toolbar"], [class*="actions"], [class*="buttons"]',
      );
      if (toolbar) {
        toolbar.insertBefore(btn, toolbar.firstChild);
      } else {
        // 最后备选：插入到输入框后面
        input.parentNode.insertBefore(btn, input.nextSibling);
      }
    }
  });
};

/**
 * 初始化扫描与 MutationObserver
 * @returns {void}
 */
const init = () => {
  const root = getRoot();
  scan(root);
  if (config.copyButton) {
    addFeedbackCopyButtons();
  }

  // 初始化提示词增强按钮
  if (config.promptEnhance?.enabled) {
    initPromptEnhanceButton();
  }

  const observer = new MutationObserver((mutations) => {
    const nodesToScan = [];
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        if (mutation.target.parentElement) {
          nodesToScan.push(mutation.target.parentElement);
        }
        return;
      }
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => nodesToScan.push(node));
      }
    });
    if (nodesToScan.length > 0) {
      scheduleScan(nodesToScan);
    }

    // 检查是否需要重新注入增强按钮
    if (config.promptEnhance?.enabled) {
      initPromptEnhanceButton();
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};

/**
 * 模块入口：接收配置并启动
 * @param {Object} userConfig - 用户配置
 * @returns {void}
 */
export const start = (userConfig = {}) => {
  // 合并用户配置
  config = { ...config, ...userConfig };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
};
