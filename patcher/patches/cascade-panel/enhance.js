/**
 * 提示词增强模块
 * 调用自定义 LLM API 优化用户输入的提示词
 * 支持 OpenAI 兼容格式和 Anthropic Claude 格式
 *
 * 功能特性:
 * - 双击空格快捷键触发增强
 * - 直接替换输入框内容（无弹窗）
 * - 自动收集 IDE 上下文信息
 * - 简洁的 toast 提示
 */

// 默认系统提示词 - 更明确的任务描述
const DEFAULT_SYSTEM_PROMPT = `你是一个提示词优化专家。你的唯一任务是：将用户输入的原始提示词优化为更好的版本。

重要规则：
1. 你必须直接输出优化后的提示词，不能有任何前缀、解释或额外内容
2. 不要回答用户的问题，只需优化提示词本身
3. 如果用户输入很短或模糊（如"hi"、"帮我"），将其扩展为一个更具体、更有效的提示词
4. 保持用户的原始意图和语言（中文/英文）
5. 让优化后的提示词更加清晰、具体、结构化

示例：
- 输入："hi" -> 输出："你好，我需要你帮助我完成一个编程任务。请先了解我的需求，然后提供解决方案。"
- 输入："这个代码有bug" -> 输出："请分析以下代码中的潜在bug，找出问题根源并提供修复方案。请详细解释bug产生的原因。"
- 输入："优化性能" -> 输出："请分析当前代码的性能瓶颈，并提供具体的优化建议。包括：1) 识别性能热点 2) 提供优化方案 3) 估计性能提升幅度"

如果提供了上下文信息（如当前文件、选中代码），请在优化后的提示词中合理引用这些上下文。`;

// 配置默认值
const DEFAULT_CONFIG = {
  enabled: false,
  provider: "anthropic",
  apiBase: "https://api.anthropic.com",
  apiKey: "",
  model: "claude-sonnet-4-5-20250514",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

let config = { ...DEFAULT_CONFIG };

/**
 * 初始化配置
 * @param {Object} userConfig - 用户配置
 */
export function init(userConfig = {}) {
  config = { ...DEFAULT_CONFIG, ...userConfig };
  if (!config.systemPrompt) {
    config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  // 初始化快捷键监听
  if (config.enabled) {
    initKeyboardShortcut();
    injectStyles();
  }
}

/**
 * 检查功能是否启用
 * @returns {boolean}
 */
export function isEnabled() {
  return config.enabled && config.apiKey && config.apiBase && config.model;
}

/**
 * 检查是否为 Anthropic API
 * @returns {boolean}
 */
function isAnthropicAPI() {
  return (
    config.provider === "anthropic" || config.apiBase.includes("anthropic")
  );
}

// ============================================
// 上下文收集功能
// ============================================

/**
 * 从 IDE 页面收集上下文信息
 * @returns {Object} 上下文信息对象
 */
function collectIDEContext() {
  const context = {
    currentFile: null,
    recentMessages: [],
    selectedCode: null,
    projectInfo: null,
  };

  try {
    // 1. 尝试获取当前文件路径
    // 从标签页、面包屑、标题等位置查找
    const titleElement = document.querySelector(
      '[class*="title"], [class*="filename"], [class*="breadcrumb"], [class*="tab"][class*="active"]'
    );
    if (titleElement) {
      const titleText = titleElement.textContent?.trim();
      if (titleText && titleText.match(/\.(js|ts|vue|py|java|go|rs|cpp|c|h|css|html|json|md|txt|yaml|yml)$/i)) {
        context.currentFile = titleText;
      }
    }

    // 2. 尝试获取最近的对话历史（AI 回复）
    const messageElements = document.querySelectorAll(
      '[class*="message"], [class*="prose"], [class*="response"], [class*="assistant"]'
    );
    const recentMessages = [];
    messageElements.forEach((el, index) => {
      if (index < 3) { // 只取最近3条
        const text = el.textContent?.trim();
        if (text && text.length > 20 && text.length < 500) {
          recentMessages.push(text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        }
      }
    });
    if (recentMessages.length > 0) {
      context.recentMessages = recentMessages;
    }

    // 3. 尝试获取选中的代码（如果有）
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      const selectedText = selection.toString().trim();
      if (selectedText.length < 1000) {
        context.selectedCode = selectedText;
      }
    }

    // 4. 尝试从 URL 或其他位置获取项目信息
    const url = window.location.href;
    const urlMatch = url.match(/project[\/=]([^\/&]+)/i);
    if (urlMatch) {
      context.projectInfo = urlMatch[1];
    }

  } catch (error) {
    console.warn('[PromptEnhance] 收集上下文时出错:', error);
  }

  return context;
}

/**
 * 将上下文信息格式化为提示词前缀
 * @param {Object} context - 上下文对象
 * @returns {string} 格式化的上下文字符串
 */
function formatContextForPrompt(context) {
  const parts = [];

  if (context.currentFile) {
    parts.push(`[当前文件: ${context.currentFile}]`);
  }

  if (context.selectedCode) {
    parts.push(`[选中代码:\n\`\`\`\n${context.selectedCode}\n\`\`\`]`);
  }

  if (context.recentMessages && context.recentMessages.length > 0) {
    parts.push(`[最近对话摘要: ${context.recentMessages[0]}]`);
  }

  return parts.length > 0 ? parts.join('\n') + '\n\n' : '';
}

// ============================================
// API 调用
// ============================================

/**
 * 调用 Anthropic Claude API
 * @param {string} prompt - 原始提示词
 * @param {string} contextPrefix - 上下文前缀
 * @returns {Promise<string>} - 增强后的提示词
 */
async function callAnthropicAPI(prompt, contextPrefix = '') {
  const userMessage = contextPrefix 
    ? `上下文信息:\n${contextPrefix}\n用户原始提示词:\n${prompt.trim()}`
    : prompt.trim();

  const response = await fetch(`${config.apiBase}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: config.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API 请求失败: ${response.status}`,
    );
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error("API 返回内容为空");
  }

  return content.trim();
}

/**
 * 调用 OpenAI 兼容 API
 * @param {string} prompt - 原始提示词
 * @param {string} contextPrefix - 上下文前缀
 * @returns {Promise<string>} - 增强后的提示词
 */
async function callOpenAICompatibleAPI(prompt, contextPrefix = '') {
  const userMessage = contextPrefix 
    ? `上下文信息:\n${contextPrefix}\n用户原始提示词:\n${prompt.trim()}`
    : prompt.trim();

  const messages = [
    { role: "system", content: config.systemPrompt },
    { role: "user", content: userMessage },
  ];

  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `API 请求失败: ${response.status}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("API 返回内容为空");
  }

  return content.trim();
}

/**
 * 调用 LLM API 增强提示词（带上下文收集）
 * @param {string} prompt - 原始提示词
 * @returns {Promise<string>} - 增强后的提示词
 */
export async function enhance(prompt) {
  if (!isEnabled()) {
    throw new Error("提示词增强功能未配置或未启用");
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("提示词不能为空");
  }

  // 收集 IDE 上下文
  const context = collectIDEContext();
  const contextPrefix = formatContextForPrompt(context);

  try {
    if (isAnthropicAPI()) {
      return await callAnthropicAPI(prompt, contextPrefix);
    } else {
      return await callOpenAICompatibleAPI(prompt, contextPrefix);
    }
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("网络请求失败,请检查网络连接和 API 地址");
    }
    throw error;
  }
}

// ============================================
// 输入框操作
// ============================================

/**
 * 查找当前活动的输入框
 * @returns {HTMLTextAreaElement|HTMLInputElement|null}
 */
function findActiveInput() {
  const active = document.activeElement;
  if (
    active &&
    (active.tagName === "TEXTAREA" ||
      (active.tagName === "INPUT" && active.type === "text") ||
      active.contentEditable === "true")
  ) {
    return active;
  }

  // 尝试查找 Cascade 的输入框
  const cascadeInput =
    document.querySelector('textarea[placeholder*="Ask"]') ||
    document.querySelector("textarea[data-testid]") ||
    document.querySelector(".chat-input textarea") ||
    document.querySelector('[contenteditable="true"]');
  return cascadeInput;
}

/**
 * 获取输入框的值
 * @param {HTMLElement} input
 * @returns {string}
 */
function getInputValue(input) {
  if (input.contentEditable === "true") {
    return input.textContent || "";
  }
  return input.value || "";
}

/**
 * 设置输入框的值
 * @param {HTMLElement} input
 * @param {string} value
 */
function setInputValue(input, value) {
  if (input.contentEditable === "true") {
    input.textContent = value;
    // 触发 input 事件
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    // 对于 React 受控组件，需要特殊处理
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set ||
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // 触发 React 的 onChange
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 聚焦并将光标移到末尾
  input.focus();
  if (input.setSelectionRange) {
    input.setSelectionRange(value.length, value.length);
  }
}

// ============================================
// Toast 提示
// ============================================

/**
 * 显示 Toast 提示
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 * @param {number} duration
 */
function showToast(message, type = "info", duration = 2000) {
  // 移除已有的 toast
  const existing = document.querySelector(".anti-power-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `anti-power-toast anti-power-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 显示动画
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // 自动隐藏
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  return toast;
}

/**
 * 执行提示词增强（直接替换输入框内容）
 */
async function performEnhance() {
  if (!isEnabled()) {
    showToast("提示词增强未配置", "error");
    return;
  }

  const input = findActiveInput();
  if (!input) {
    showToast("未找到输入框", "error");
    return;
  }

  const originalPrompt = getInputValue(input).trim();
  if (!originalPrompt) {
    showToast("请先输入提示词", "error");
    return;
  }

  // 显示加载状态
  const loadingToast = showToast("✨ 正在优化提示词...", "info", 0);

  try {
    const enhanced = await enhance(originalPrompt);

    // 直接替换输入框内容
    setInputValue(input, enhanced);

    // 移除加载提示，显示成功
    loadingToast.remove();
    showToast("✓ 提示词已优化", "success", 1500);
  } catch (error) {
    loadingToast.remove();
    showToast(`✗ ${error.message}`, "error", 3000);
    console.error("[PromptEnhance] Error:", error);
  }
}

/**
 * 初始化键盘快捷键（Alt+空格）
 */
function initKeyboardShortcut() {
  document.addEventListener(
    "keydown",
    (e) => {
      // Alt+空格 触发增强
      if (e.key === " " && e.altKey && !e.ctrlKey && !e.metaKey) {
        // 只在输入框中生效
        const target = e.target;
        const isInput =
          target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.contentEditable === "true";

        if (!isInput) return;

        e.preventDefault();
        performEnhance();
      }
    },
    true
  );
}

/**
 * 创建增强按钮元素
 * @param {Function} onClick - 点击回调
 * @returns {HTMLButtonElement}
 */
export function createEnhanceButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "anti-power-enhance-btn";
  btn.title = "提示词增强 (Alt+空格)";
  btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
    `;
  btn.addEventListener("click", onClick || performEnhance);
  return btn;
}

/**
 * 注入样式
 */
export function injectStyles() {
  if (document.getElementById("anti-power-enhance-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "anti-power-enhance-styles";
  style.textContent = `
        /* 增强按钮样式 */
        .anti-power-enhance-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            padding: 0;
            margin: 0 4px;
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            transition: all 0.15s ease;
            flex-shrink: 0;
        }

        .anti-power-enhance-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fbbf24;
            border-color: rgba(251, 191, 36, 0.3);
        }

        .anti-power-enhance-btn:active {
            transform: scale(0.95);
        }

        .anti-power-enhance-btn.loading {
            pointer-events: none;
            opacity: 0.6;
        }

        .anti-power-enhance-btn.loading svg {
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .anti-power-enhance-btn svg {
            width: 14px;
            height: 14px;
        }

        /* Toast 提示样式 */
        .anti-power-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            z-index: 99999;
            opacity: 0;
            transition: all 0.2s ease;
            pointer-events: none;
            white-space: nowrap;
        }

        .anti-power-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        .anti-power-toast-info {
            background: rgba(59, 130, 246, 0.95);
            color: white;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .anti-power-toast-success {
            background: rgba(34, 197, 94, 0.95);
            color: white;
            box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
        }

        .anti-power-toast-error {
            background: rgba(239, 68, 68, 0.95);
            color: white;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }
    `;
  document.head.appendChild(style);
}

/**
 * 显示错误提示（向后兼容）
 * @param {string} message - 错误信息
 */
export function showErrorModal(message) {
  showToast(`✗ ${message}`, "error", 3000);
}

/**
 * 显示结果（向后兼容，直接应用）
 * @param {string} enhancedPrompt - 增强后的提示词
 * @param {Function} onApply - 应用回调
 * @param {Function} onCancel - 取消回调
 */
export function showResultModal(enhancedPrompt, onApply, onCancel) {
  // 直接应用，不再显示弹窗
  if (onApply) {
    onApply(enhancedPrompt);
  }
  showToast("✓ 提示词已优化", "success", 1500);
}

/**
 * 获取配置
 * @returns {Object}
 */
export function getConfig() {
  return { ...config };
}

/**
 * 手动触发增强（供外部调用）
 */
export function triggerEnhance() {
  performEnhance();
}
