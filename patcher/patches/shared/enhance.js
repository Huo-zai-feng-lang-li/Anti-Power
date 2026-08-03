/**
 * 提示词增强模块
 * 调用自定义 LLM API 优化用户输入的提示词
 * 支持 OpenAI 兼容格式和 Anthropic Claude 格式
 * 
 * 功能特性:
 * - 极速直连 API Engine (Node.js https / Fetch / XHR 三重防护，穿透 CORS)
 * - 自动收集 IDE 上下文信息
 * - 物理擦除并替换输入框内容
 * - 简洁的 toast 提示
 */

const DEFAULT_SYSTEM_PROMPT = `你是一个智能提示词优化器，专门帮助用户生成更有效的 AI 对话提示词。

核心任务
将用户输入的原始提示词优化为更清晰、更具体、更有效的版本。

你会收到的信息
1. 对话上下文：之前的对话历史（如果有）
2. 当前文件：用户正在编辑的文件（如果有）
3. 选中代码：用户选中的代码片段（如果有）
4. 用户原始提示词：需要优化的内容

优化规则
1. 理解上下文：仔细阅读对话历史，理解当前讨论的主题和背景
2. 保持连贯性：优化后的提示词应该与之前的对话保持逻辑连贯
3. 具体化：让模糊的问题变得具体，如果上下文中有相关信息就引用它
4. 结构化：为复杂问题添加清晰的结构
5. 保持意图：不改变用户的原始意图，只是表达得更清晰

输出格式 重要
- 禁止使用 Markdown 语法（禁止 ** 加粗、禁止 # 标题、禁止 \` 代码块）
- 使用纯文本格式：换行分隔段落，用数字1./2. 或短横线 - 开头列表
- 只输出优化后的提示词，不要任何解释和额外内容
- 保持用户使用的语言（中文/英文）
- 确保输出包含必要的换行符，不要将长文本压缩成一行

示例

示例 1 - 无上下文
输入: hi
输出: 你好，请帮我解决一个问题。我会详细描述需求，请提供完整的解决方案。

示例 2 - 有上下文
对话历史: [用户问了如何修复登录 bug，AI 提供了方案]
输入: 还有问题
输出: 按照你之前提供的登录 bug 修复方案，我尝试后发现仍有问题。请帮我进一步排查，可能是哪些原因导致的？`;

// 配置默认值
const DEFAULT_CONFIG = {
  enabled: true,
  provider: "openai",
  apiBase: "https://tokenrhythm.studio/v1",
  apiKey: "sk_tr_8a8uvItmEItosRIGXcGHhc49BuDqJrP8uQrhOeeyFA0",
  model: "deepseek-v4-flash",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

let config = { ...DEFAULT_CONFIG };

// 初始化配置
try {
  if (typeof localStorage !== "undefined") {
    const savedConfig = localStorage.getItem("Antigravity_PromptEnhance_Config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // 强制清理 legacy 错误配置
      if (parsed.apiBase && parsed.apiBase.includes("127.0.0.1:8045")) {
        console.log("[PromptEnhance] 清理旧版本地代理地址，重置为 Freemodel");
        parsed.apiBase = DEFAULT_CONFIG.apiBase;
        parsed.model = DEFAULT_CONFIG.model;
      }
      config = { ...config, ...parsed };
    }
  }
} catch (e) {
  console.error("[PromptEnhance] 加载配置失败:", e);
}

// 供外部更新配置的方法
const setGlobalUpdateFn = (fn) => {
  if (typeof window !== "undefined") window.updatePromptEnhanceConfig = fn;
  if (typeof globalThis !== "undefined") globalThis.updatePromptEnhanceConfig = fn;
};

setGlobalUpdateFn((newConfig) => {
  config = { ...config, ...newConfig };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("Antigravity_PromptEnhance_Config", JSON.stringify(config));
  }
  console.log("[PromptEnhance] 配置已更新", config);
});

export const init = (initialConfig) => {
  if (initialConfig) {
    config = { ...config, ...initialConfig };
  }
  injectStyles();
  console.log("[PromptEnhance] 模块已初始化", config);
};

export const isEnabled = () => config.enabled;
const isAnthropicAPI = () => config.provider === "anthropic" || config.apiBase.includes("anthropic");

// ============================================
// 上下文收集
// ============================================

const CONVERSATION_SELECTORS = [
  // Antigravity v1.23+ 唯一精准对话容器 (CDP 实测)
  ".antigravity-agent-side-panel .h-full.overflow-y-auto.grow",
  ".cascade-scrollbar",
  ".conversation-container",
  "[class*=\"conversation\"]",
];

const NOISE_SELECTORS = [
  ".model-selector-container",
  ".chat-input-container",
  "button",
  ".antigravity-agent-side-panel-header",
];

/**
 * 收集对话上下文信息
 */
function buildContextPrefix() {
  let context = "";

  // 1. 获取对话滚动区域
  let conversationEl = null;
  for (const selector of CONVERSATION_SELECTORS) {
    conversationEl = document.querySelector(selector);
    if (conversationEl) break;
  }

  if (conversationEl) {
    // 克隆并过滤噪声元素
    const clone = conversationEl.cloneNode(true);
    NOISE_SELECTORS.forEach(s => {
      clone.querySelectorAll(s).forEach(n => n.remove());
    });
    const historyText = clone.innerText.trim();
    if (historyText) {
      context += `对话历史:\n${historyText.substring(Math.max(0, historyText.length - 3000))}\n\n`;
    }
  }

  // 2. 获取当前编辑文件名 (尝试从 Tab 获取)
  const activeTab = document.querySelector("[class*=\"tab-\"].active, .tab.selected");
  if (activeTab) {
    context += `当前文件: ${activeTab.innerText.trim()}\n\n`;
  }

  // 3. 获取选中的代码 (如果可能)
  const selection = window.getSelection().toString().trim();
  if (selection && selection.length < 2000) {
    context += `选中代码:\n${selection}\n\n`;
  }

  return context;
}

// ============================================
// 三重驱动直连网络引擎 (Node https + Fetch + XHR)
// ============================================

/**
 * 极速直连网络请求引擎 (Triple-Engine HTTP Client)
 * 优先使用 Electron/Node 原生 https 模块 (彻底避开浏览器 CORS/CSP 跨域限制)
 * 降级使用 Standard fetch
 * 兜底使用 XMLHttpRequest
 */
async function directHttpRequest({ url, method = "POST", headers = {}, body = "", timeoutMs = 15000 }) {
  // 1. 优先尝试 Node.js 原生 https/http 模块 (绕过 CORS 跨域)
  try {
    const getRequire = () => {
      if (typeof window !== "undefined" && typeof window.require === "function") return window.require;
      if (typeof globalThis !== "undefined" && typeof globalThis.require === "function") return globalThis.require;
      return null;
    };
    const reqFn = getRequire();
    if (reqFn) {
      const https = reqFn("https");
      const http = reqFn("http");
      const urlModule = reqFn("url");

      if (https && http && urlModule) {
        const parsedUrl = new urlModule.URL(url);
        const transport = parsedUrl.protocol === "https:" ? https : http;

        return await new Promise((resolve, reject) => {
          const bodyBuf = Buffer.from(body, "utf-8");
          const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
              ...headers,
              "Content-Length": bodyBuf.length,
            },
            timeout: timeoutMs,
          };

          const req = transport.request(reqOptions, (res) => {
            let resData = "";
            res.on("data", (chunk) => { resData += chunk; });
            res.on("end", () => {
              resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                json: async () => JSON.parse(resData || "{}"),
                text: async () => resData,
              });
            });
          });

          req.on("error", (e) => reject(new Error(`Node Direct Request Fail: ${e.message}`)));
          req.on("timeout", () => {
            req.destroy();
            reject(new Error(`API 直连超时 (${timeoutMs / 1000}s)`));
          });

          req.write(bodyBuf);
          req.end();
        });
      }
    }
  } catch (nodeErr) {
    console.warn("[PromptEnhance] Node native http client unavailable, falling back to Fetch:", nodeErr);
  }

  // 2. 使用 Fetch API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    return response;
  } catch (fetchErr) {
    if (fetchErr.name === "AbortError") {
      throw new Error(`API 直连超时 (${timeoutMs / 1000}s)，请检查网络状况`);
    }

    // 3. 如果 Fetch 发生 Failed to fetch (如 CORS 拦截)，尝试使用 XHR 降级
    console.warn("[PromptEnhance] Fetch failed, attempting XHR fallback...", fetchErr);
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.timeout = timeoutMs;

        xhr.onload = () => {
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            json: async () => JSON.parse(xhr.responseText || "{}"),
            text: async () => xhr.responseText,
          });
        };
        xhr.onerror = () => reject(new Error("CORS 跨域被拒或网络中断"));
        xhr.ontimeout = () => reject(new Error(`XHR 请求超时 (${timeoutMs / 1000}s)`));
        xhr.send(body);
      });
    } catch (xhrErr) {
      throw new Error(`API 直连失败: ${fetchErr.message}。由于 Electron file:// 协议限制，若目标 API 未开放 Access-Control-Allow-Origin: *，请检查网络或使用兼容节点。`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// LLM 交互 (纯直连模式)
// ============================================

/**
 * 执行提示词增强
 * @param {string} prompt - 原始提示词
 * @returns {Promise<string>} - 增强后的提示词
 */
export async function enhance(prompt) {
  if (!prompt.trim()) {
    throw new Error("提示词不能为空");
  }

  const contextPrefix = buildContextPrefix();

  try {
    if (isAnthropicAPI()) {
      return await callAnthropicAPI(prompt, contextPrefix);
    } else {
      return await callOpenAIAPI(prompt, contextPrefix);
    }
  } catch (error) {
    console.error("[PromptEnhance] API Direct Fetch Error:", error);
    throw error;
  }
}

/**
 * 调用 OpenAI 兼容 API (三重直连)
 */
async function callOpenAIAPI(prompt, contextPrefix = "") {
  const userMessage = contextPrefix 
    ? `上下文信息:\n${contextPrefix}\n用户原始提示词:\n${prompt.trim()}`
    : prompt.trim();

  const baseUrl = config.apiBase.endsWith("/") ? config.apiBase.slice(0, -1) : config.apiBase;
  const url = `${baseUrl}/chat/completions`;

  const bodyStr = JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
  });

  const response = await directHttpRequest({
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: bodyStr,
    timeoutMs: 15000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 响应错误: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  
  if (!content) {
    console.error("[PromptEnhance] API 返回格式不正确:", data);
    throw new Error("无法从 API 获取优化结果，请确认模型与 API Key 设置是否正确");
  }
  
  return content;
}

/**
 * 调用 Anthropic Claude API (三重直连)
 */
async function callAnthropicAPI(prompt, contextPrefix = "") {
  const userMessage = contextPrefix 
    ? `上下文信息:\n${contextPrefix}\n用户原始提示词:\n${prompt.trim()}`
    : prompt.trim();

  const url = `${config.apiBase}/messages`;

  const bodyStr = JSON.stringify({
    model: config.model,
    max_tokens: 2048,
    system: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const response = await directHttpRequest({
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: bodyStr,
    timeoutMs: 15000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Anthropic API 响应错误: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || prompt;
}

// ============================================
// DOM 交互逻辑
// ============================================

const INPUT_SELECTORS = [
  "[contenteditable=\"true\"][role=\"textbox\"]",
  "textarea.native-textarea",
  "textarea[placeholder*=\"Ask\"]",
  "textarea[placeholder*=\"message\"]",
  "#windsurf-input",
];

function findActiveInput() {
  for (const selector of INPUT_SELECTORS) {
    const el = document.querySelector(selector);
    if (el && el.isConnected) return el;
  }
  return document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.contentEditable === "true" 
    ? document.activeElement : null;
}

function getInputValue(input) {
  if (!input) return "";
  const raw = input.contentEditable === "true" 
    ? (input.innerText || input.textContent || "") 
    : (input.value || "");
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

/**
 * 强力物理清空 contenteditable 输入框内的所有文本与 DOM 节点
 * 严格遵循 Selection/Range API 规范，禁止使用 innerText = ""
 */
function clearContenteditableInput(input) {
  try {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
  } catch (e) {
    console.warn("[PromptEnhance] clear via delete failed:", e);
  }

  if (getInputValue(input).length > 0) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      range.deleteContents();
      selection.removeAllRanges();
    } catch (e) {
      console.warn("[PromptEnhance] range.deleteContents failed:", e);
    }
  }
}

/**
 * 安全且强制覆盖地设置输入框内容，确保原始文本被完全替换而非拼接追加
 * @param {HTMLElement} input 
 * @param {string} value 
 * @returns {Promise<boolean>} 是否成功填充
 */
async function setInputValue(input, value) {
  if (!input) return false;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const normalizedValue = value.trim();

  try {
    input.focus();
    await sleep(30);

    if (input.contentEditable === "true") {
      const selection = window.getSelection();
      const range = document.createRange();

      // 1. 强制物理清空原始文本，防止选区在 focus 时坍塌导致追加拼接
      clearContenteditableInput(input);

      // 2. 重新全选空容器并执行 insertText 写入新文本
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);

      document.execCommand("insertText", false, value);
      await sleep(50);

      let currentVal = getInputValue(input);
      if (currentVal === normalizedValue) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }

      // 3. 校验未通过，尝试 Clipboard Paste 事件降级
      console.warn("[PromptEnhance] insertText mismatch, attempting Paste fallback...");
      clearContenteditableInput(input);

      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", value);
      input.dispatchEvent(new ClipboardEvent("paste", {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true,
      }));
      input.dispatchEvent(new Event("input", { bubbles: true }));

      await sleep(100);
      currentVal = getInputValue(input);
      if (currentVal === normalizedValue) {
        return true;
      }

      // 4. 若最终依旧不匹配（例如发生脏文本追加），彻底清空污染内容，防止在输入框保留重复拼接
      console.warn("[PromptEnhance] Fallback mismatch. Wiping dirty content to prevent duplicates.");
      clearContenteditableInput(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return false;

    } else {
      // 普通 textarea 原生 setter 注入
      input.value = "";
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      await sleep(50);
      return getInputValue(input) === normalizedValue;
    }
  } catch (e) {
    console.error("[PromptEnhance] DOM set error:", e);
    return false;
  }
}

// ============================================
// Toast & UI
// ============================================

function showToast(message, type = "info", duration = 2000) {
  const existing = document.querySelector(".Antigravity-Power-Pro-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `Antigravity-Power-Pro-toast Antigravity-Power-Pro-toast-${type}`;
  toast.innerText = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }
  return toast;
}

async function performEnhance() {
  if (!isEnabled()) {
    showToast("提示词增强功能已关闭", "error");
    return;
  }

  if (!config.apiKey) {
    showToast("请先在配置中设置 API Key", "error", 5000);
    return;
  }

  const input = findActiveInput();
  if (!input) {
    showToast("未找到活动输入框", "error");
    return;
  }

  const originalPrompt = getInputValue(input).trim();
  if (!originalPrompt) {
    showToast("请先输入提示词", "error");
    return;
  }

  const loadingToast = showToast("✨ 正在优化提示词...", "info", 0);
  try {
    const enhanced = await enhance(originalPrompt);
    const success = await setInputValue(input, enhanced);
    loadingToast.remove();
    if (success) showToast("✓ 已完成并自动填充", "success", 2000);
    else {
      navigator.clipboard.writeText(enhanced).catch(() => {});
      showToast("⚠️ 写入遭拦截，结果已妥投至系统剪贴板 (Ctrl+V)", "info", 4000);
    }
  } catch (error) {
    loadingToast.remove();
    showToast(`✗ 失败: ${error.message}`, "error", 5000);
  }
}

export function createEnhanceButton(onClick) {
  const btn = document.createElement("button");
  btn.className = "Antigravity-Power-Pro-enhance-btn";
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
    </svg>
  `;
  btn.addEventListener("click", onClick || performEnhance);
  return btn;
}

export function injectStyles() {
  if (document.getElementById("Antigravity-Power-Pro-enhance-styles")) return;
  const style = document.createElement("style");
  style.id = "Antigravity-Power-Pro-enhance-styles";
  style.textContent = `
    .Antigravity-Power-Pro-enhance-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 28px !important;
      height: 28px !important;
      padding: 0 !important;
      margin: 0 6px !important;
      background: rgba(30, 30, 30, 0.8) !important;
      border: 1px solid rgba(251, 191, 36, 0.4) !important;
      border-radius: 50% !important;
      color: rgba(251, 191, 36, 0.8) !important;
      cursor: pointer !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      flex-shrink: 0 !important;
      backdrop-filter: blur(4px) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
      outline: none !important;
    }
    .Antigravity-Power-Pro-enhance-btn:hover {
      background: rgba(251, 191, 36, 0.15) !important;
      color: #fbbf24 !important;
      border-color: rgba(251, 191, 36, 0.6) !important;
      transform: scale(1.05) !important;
    }
    .Antigravity-Power-Pro-enhance-btn:hover svg {
      animation: Antigravity-Power-Pro-spin 2s linear infinite !important;
      filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.4)) !important;
    }
    .Antigravity-Power-Pro-enhance-btn.loading {
      background: rgba(251, 191, 36, 0.25) !important;
      color: #fbbf24 !important;
      border-color: #fbbf24 !important;
      animation: Antigravity-Power-Pro-glow 1.5s ease-in-out infinite !important;
      transform: scale(1.1) !important;
      box-shadow: 0 0 15px rgba(251, 191, 36, 0.5), inset 0 0 10px rgba(251, 191, 36, 0.3) !important;
    }
    .Antigravity-Power-Pro-enhance-btn.loading svg {
      animation: Antigravity-Power-Pro-spin 0.8s linear infinite !important;
      filter: drop-shadow(0 0 8px #fbbf24) !important;
    }
    .Antigravity-Power-Pro-enhance-btn svg {
      width: 14px !important;
      height: 14px !important;
    }
    .Antigravity-Power-Pro-enhance-btn.loading svg {
      animation: Antigravity-Power-Pro-spin 1s linear infinite !important;
    }
    @keyframes Antigravity-Power-Pro-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes Antigravity-Power-Pro-glow {
      0% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.3), inset 0 0 5px rgba(251, 191, 36, 0.2); }
      50% { box-shadow: 0 0 18px rgba(251, 191, 36, 0.6), inset 0 0 8px rgba(251, 191, 36, 0.3); }
      100% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.3), inset 0 0 5px rgba(251, 191, 36, 0.2); }
    }
    .Antigravity-Power-Pro-toast {
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      z-index: 100000;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
      pointer-events: none;
      white-space: nowrap;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(251, 191, 36, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.2);
    }
    .Antigravity-Power-Pro-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .Antigravity-Power-Pro-toast-info { background: rgba(30, 30, 30, 0.9); color: #3b82f6; }
    .Antigravity-Power-Pro-toast-success { background: rgba(30, 30, 30, 0.9); color: #22c55e; }
    .Antigravity-Power-Pro-toast-error { background: rgba(30, 30, 30, 0.9); color: #ef4444; }
  `;
  document.head.appendChild(style);
}

export function showErrorModal(msg) { showToast(msg, "error"); }
export function showResultModal(enhanced, onApply, onFail) {
  if (onApply) {
    onApply(enhanced);
    showToast("✓ 已优化并填充", "success");
  } else if (onFail) {
    onFail(enhanced);
    showToast("⚠️ 已优化，回填失败，已复制到剪贴板", "info", 4000);
  } else {
    showToast("✓ 已优化", "success");
  }
}
export function getConfig() { return { ...config }; }
export function triggerEnhance() { performEnhance(); }
export { setInputValue };
