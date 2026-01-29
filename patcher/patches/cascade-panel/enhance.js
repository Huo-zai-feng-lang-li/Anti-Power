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
const DEFAULT_SYSTEM_PROMPT = `你是一个提示词优化专家。

【核心任务】
将用户输入的"原始提示词"优化为更清晰、更具体、更有效的版本。

【输出格式】
- 只输出优化后的提示词文本本身
- 禁止输出任何前缀（如"优化后："、"建议："等）
- 禁止输出任何解释、说明或补充内容
- 禁止回答用户的问题，只需重写/优化提示词

【优化原则】
1. 保持用户原始意图和语言（中文/英文）
2. 让提示词更加清晰、具体、结构化
3. 如果原始提示词很短（如"hi"、"帮我"），扩展为完整的、有明确目标的提示词
4. 如果提供了上下文（当前文件、代码等），在优化后的提示词中适当引用

【示例】
输入: "hi"
输出: 你好，我需要你帮助我完成一个编程任务。请先了解我的需求，然后提供详细的解决方案。

输入: "这个代码有bug"
输出: 请分析当前代码中的潜在bug，找出问题根源并提供完整的修复方案。请详细解释bug产生的原因以及修复的思路。

输入: "优化性能"
输出: 请分析当前代码的性能瓶颈，并提供具体的优化建议。包括：1) 识别性能热点 2) 提供优化方案 3) 解释优化原理

【重要提醒】
用户消息中可能包含"上下文信息"部分，这只是帮助你理解背景的参考信息，不是对话历史。你的任务始终是：优化"原始提示词"部分的文本。`;

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

  // 注入样式
  if (config.enabled) {
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
// 上下文收集功能 - 增强版
// ============================================

// 缓存最近捕获的上下文（从请求拦截中获取）
let cachedContext = {
  messages: [],
  files: [],
  codeBlocks: [],
  timestamp: 0,
};

/**
 * 初始化请求拦截器，捕获 IDE 发送的上下文
 */
function initRequestInterceptor() {
  if (window.__antiPowerFetchIntercepted) return;
  window.__antiPowerFetchIntercepted = true;

  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    try {
      // 检测可能的 AI API 请求
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (options?.body && typeof options.body === 'string') {
        const isAIRequest = urlStr.includes('api') && (
          urlStr.includes('chat') ||
          urlStr.includes('message') ||
          urlStr.includes('completion') ||
          urlStr.includes('anthropic') ||
          urlStr.includes('openai')
        );
        
        if (isAIRequest) {
          try {
            const body = JSON.parse(options.body);
            if (body.messages && Array.isArray(body.messages)) {
              // 缓存请求中的上下文信息
              cachedContext = {
                messages: body.messages.slice(-5), // 最近5条消息
                files: extractFilesFromMessages(body.messages),
                codeBlocks: extractCodeFromMessages(body.messages),
                timestamp: Date.now(),
              };
              console.log('[PromptEnhance] 捕获到 AI 请求上下文:', cachedContext);
            }
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }
    } catch (e) {
      // 忽略错误，不影响原请求
    }
    return originalFetch.apply(this, arguments);
  };
}

/**
 * 从消息中提取文件引用
 */
function extractFilesFromMessages(messages) {
  const files = [];
  const filePattern = /@(file|codebase|folder)[:\s]*([^\s\n]+)/gi;
  
  messages.forEach(msg => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    let match;
    while ((match = filePattern.exec(content)) !== null) {
      files.push({ type: match[1], path: match[2] });
    }
  });
  
  return files;
}

/**
 * 从消息中提取代码块
 */
function extractCodeFromMessages(messages) {
  const codeBlocks = [];
  const codePattern = /```(\w+)?\n([\s\S]*?)```/g;
  
  messages.forEach(msg => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    let match;
    while ((match = codePattern.exec(content)) !== null) {
      codeBlocks.push({ language: match[1] || 'text', code: match[2].substring(0, 500) });
    }
  });
  
  return codeBlocks.slice(-3); // 最近3个代码块
}

/**
 * 尝试从 React Fiber 节点获取组件状态
 */
function getReactFiberState(element) {
  if (!element) return null;
  
  // React 17+ 的 Fiber 节点 key
  const fiberKeys = Object.keys(element).filter(key => 
    key.startsWith('__reactFiber$') || 
    key.startsWith('__reactInternalInstance$')
  );
  
  if (fiberKeys.length === 0) return null;
  
  try {
    const fiber = element[fiberKeys[0]];
    let current = fiber;
    const states = [];
    
    // 向上遍历 Fiber 树，收集状态
    for (let i = 0; i < 10 && current; i++) {
      if (current.memoizedState) {
        states.push(current.memoizedState);
      }
      if (current.memoizedProps) {
        // 查找可能包含上下文的 props
        const props = current.memoizedProps;
        if (props.messages || props.context || props.files || props.conversation) {
          return props;
        }
      }
      current = current.return;
    }
  } catch (e) {
    // 忽略错误
  }
  
  return null;
}

/**
 * 探测 Cascade/Windsurf 的全局状态对象
 */
function probeGlobalState() {
  const context = {
    conversationId: null,
    messages: [],
    activeFile: null,
    openFiles: [],
    workspace: null,
  };
  
  try {
    // 1. 检查 window 上的常见状态对象名称
    const stateKeys = [
      '__STORE__', '__store__', 'store', 
      '__STATE__', '__state__', 'state',
      '__APP__', '__app__', 'app',
      'cascade', 'windsurf', 'codeium',
      '__NUXT__', '__NEXT_DATA__', '__REDUX_DEVTOOLS_EXTENSION__'
    ];
    
    for (const key of stateKeys) {
      if (window[key]) {
        const state = window[key];
        console.log(`[PromptEnhance] 发现全局对象: ${key}`, typeof state);
        
        // 尝试提取有用信息
        if (typeof state === 'object') {
          if (state.getState) {
            // Redux store
            const reduxState = state.getState();
            if (reduxState.conversation) context.messages = reduxState.conversation.messages || [];
            if (reduxState.editor) context.activeFile = reduxState.editor.activeFile;
            if (reduxState.workspace) context.workspace = reduxState.workspace.path;
          }
        }
      }
    }
    
    // 2. 检查 localStorage/sessionStorage 中的状态
    try {
      const lsKeys = Object.keys(localStorage);
      for (const key of lsKeys) {
        if (key.includes('conversation') || key.includes('context') || key.includes('session')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && typeof data === 'object') {
              if (data.messages) context.messages = data.messages;
              if (data.files) context.openFiles = data.files;
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    
  } catch (error) {
    console.warn('[PromptEnhance] 探测全局状态失败:', error);
  }
  
  return context;
}

/**
 * 从 Cascade DOM 结构中收集上下文
 * 针对 Cascade/Windsurf 的特定选择器
 */
function collectFromCascadeDOM() {
  const context = {
    currentFile: null,
    openTabs: [],
    selectedCode: null,
    recentMessages: [],
    attachedFiles: [],
  };
  
  try {
    // 1. 获取当前活动文件（从编辑器标签）
    const activeTab = document.querySelector(
      '[class*="tab"][class*="active"], ' +
      '[class*="tab"][aria-selected="true"], ' +
      '[role="tab"][aria-selected="true"]'
    );
    if (activeTab) {
      context.currentFile = activeTab.textContent?.trim();
    }
    
    // 2. 获取所有打开的文件标签
    const allTabs = document.querySelectorAll(
      '[class*="tab"]:not([class*="active"]), ' +
      '[role="tab"]'
    );
    allTabs.forEach(tab => {
      const name = tab.textContent?.trim();
      if (name && name.match(/\.\w+$/)) {
        context.openTabs.push(name);
      }
    });
    
    // 3. 获取选中的代码
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      context.selectedCode = selection.toString().trim().substring(0, 2000);
    }
    
    // 4. 获取输入框中已有的 @ 引用（文件、代码库等）
    const inputArea = document.querySelector(
      'textarea, [contenteditable="true"], [class*="input"][class*="chat"]'
    );
    if (inputArea) {
      const inputText = inputArea.value || inputArea.textContent || '';
      const atMentions = inputText.match(/@\w+[:\s][^\s\n]+/g) || [];
      context.attachedFiles = atMentions;
    }
    
    // 5. 获取对话区域中的最近消息
    const messageContainers = document.querySelectorAll(
      '[class*="message-content"], ' +
      '[class*="prose"], ' +
      '[class*="markdown"], ' +
      '[data-message-role]'
    );
    
    const messages = [];
    messageContainers.forEach((el, idx) => {
      if (idx < 4) { // 最近4条
        const role = el.getAttribute('data-message-role') || 
                     (el.closest('[class*="assistant"]') ? 'assistant' : 'user');
        const content = el.textContent?.trim().substring(0, 500);
        if (content && content.length > 20) {
          messages.push({ role, content });
        }
      }
    });
    context.recentMessages = messages;
    
  } catch (error) {
    console.warn('[PromptEnhance] 收集 DOM 上下文失败:', error);
  }
  
  return context;
}

/**
 * 综合收集 IDE 上下文（使用所有可用策略）
 * @returns {Object} 上下文信息对象
 */
function collectIDEContext() {
  // 初始化请求拦截器
  initRequestInterceptor();
  
  // 1. 先检查缓存的请求上下文（最准确）
  const now = Date.now();
  const cacheValid = cachedContext.timestamp && (now - cachedContext.timestamp < 60000); // 1分钟内有效
  
  // 2. 从 DOM 收集
  const domContext = collectFromCascadeDOM();
  
  // 3. 探测全局状态
  const globalContext = probeGlobalState();
  
  // 4. 尝试从输入框容器的 React Fiber 获取
  const inputEl = document.querySelector('textarea, [contenteditable="true"]');
  const fiberState = inputEl ? getReactFiberState(inputEl.closest('[class*="chat"], [class*="input"], form')) : null;
  
  // 合并所有上下文
  const context = {
    // 从缓存的请求上下文
    cachedMessages: cacheValid ? cachedContext.messages : [],
    cachedFiles: cacheValid ? cachedContext.files : [],
    cachedCode: cacheValid ? cachedContext.codeBlocks : [],
    
    // 从 DOM
    currentFile: domContext.currentFile,
    openTabs: domContext.openTabs,
    selectedCode: domContext.selectedCode,
    recentMessages: domContext.recentMessages,
    attachedFiles: domContext.attachedFiles,
    
    // 从全局状态
    workspace: globalContext.workspace,
    activeFile: globalContext.activeFile,
    
    // 从 React Fiber
    fiberContext: fiberState,
  };
  
  console.log('[PromptEnhance] 收集到的上下文:', context);
  return context;
}

/**
 * 将上下文信息格式化为提示词前缀
 * @param {Object} context - 上下文对象
 * @returns {string} 格式化的上下文字符串
 */
function formatContextForPrompt(context) {
  const parts = [];

  // 1. 当前文件
  if (context.currentFile || context.activeFile) {
    parts.push(`[当前文件: ${context.currentFile || context.activeFile}]`);
  }
  
  // 2. 打开的文件
  if (context.openTabs && context.openTabs.length > 0) {
    parts.push(`[打开的文件: ${context.openTabs.slice(0, 5).join(', ')}]`);
  }
  
  // 3. 附加的文件引用（用户在输入框中 @ 引用的）
  if (context.attachedFiles && context.attachedFiles.length > 0) {
    parts.push(`[已引用: ${context.attachedFiles.join(', ')}]`);
  }
  
  // 4. 选中的代码
  if (context.selectedCode) {
    parts.push(`[选中代码:\n\`\`\`\n${context.selectedCode.substring(0, 1000)}\n\`\`\`]`);
  }
  
  // 5. 从缓存的请求中提取的代码
  if (context.cachedCode && context.cachedCode.length > 0) {
    const codeInfo = context.cachedCode.map(c => `${c.language}: ${c.code.substring(0, 200)}...`).join('\n');
    parts.push(`[相关代码:\n${codeInfo}]`);
  }
  
  // 6. 最近的对话摘要
  if (context.recentMessages && context.recentMessages.length > 0) {
    const msgSummary = context.recentMessages
      .slice(0, 2)
      .map(m => `${m.role}: ${m.content.substring(0, 150)}...`)
      .join('\n');
    parts.push(`[最近对话:\n${msgSummary}]`);
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
  const isContentEditable = input.contentEditable === "true";
  
  if (isContentEditable) {
    // 对于 contenteditable 元素
    input.textContent = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (input.tagName === "TEXTAREA") {
    // 对于 textarea，使用原生 setter 绕过 React 受控组件
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    // 触发 React 的事件
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    // 对于 input 元素
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
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

// 快捷键功能已移除，统一使用按钮触发

/**
 * 创建增强按钮元素
 * @param {Function} onClick - 点击回调
 * @returns {HTMLButtonElement}
 */
export function createEnhanceButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "anti-power-enhance-btn";
  btn.title = "提示词增强";
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
