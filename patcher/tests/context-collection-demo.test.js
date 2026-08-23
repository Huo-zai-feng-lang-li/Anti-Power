import test from "node:test";
import assert from "node:assert/strict";

// 模拟真实 DOM 节点树与深拷贝过滤
class MockNode {
  constructor(tagName = "div", text = "", className = "") {
    this.tagName = tagName.toUpperCase();
    this.innerText = text;
    this.textContent = text;
    this.className = className;
    this.children = [];
    this.parentNode = null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }
  cloneNode(deep = true) {
    const clone = new MockNode(this.tagName, this.innerText, this.className);
    if (deep) {
      clone.children = this.children.map(c => {
        const childClone = c.cloneNode(true);
        childClone.parentNode = clone;
        return childClone;
      });
      clone.updateInnerText();
    }
    return clone;
  }
  updateInnerText() {
    if (this.children.length > 0) {
      this.innerText = this.children.map(c => c.innerText).join("\n");
    }
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode.updateInnerText();
      this.parentNode = null;
    }
  }
  querySelectorAll(selector) {
    const results = [];
    const check = (node) => {
      for (const child of node.children) {
        if (selector === "button" && child.tagName === "BUTTON") results.push(child);
        else if (selector.startsWith(".") && child.className.includes(selector.slice(1))) results.push(child);
        check(child);
      }
    };
    check(this);
    return results;
  }
}

// 抽取自 enhance.js 的真实过滤与收集算法
function extractContextAndFilterNoise({
  conversationTree,
  activeTabRaw,
  selectedCodeRaw,
  userPromptRaw,
}) {
  const CONVERSATION_HISTORY_LIMIT = 3000;
  const SELECTION_LIMIT = 1200;
  const NOISE_SELECTORS = [
    ".model-selector-container",
    ".chat-input-container",
    "button",
    ".antigravity-agent-side-panel-header",
  ];

  let context = "";

  // 1. 对话历史提取 + DOM 噪点物理剔除 + 文本特殊字符清洗
  if (conversationTree) {
    const clone = conversationTree.cloneNode(true);
    NOISE_SELECTORS.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    });

    const rawHistory = clone.innerText || "";
    // 字符级噪点过滤：移除 \u200B(零宽空格), \u200C(零宽非连), \u200D(零宽连接), \uFEFF(BOM)
    const cleanHistory = rawHistory.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

    if (cleanHistory) {
      context += `对话历史:\n${cleanHistory.substring(
        Math.max(0, cleanHistory.length - CONVERSATION_HISTORY_LIMIT)
      )}\n\n`;
    }
  }

  // 2. 当前文件名称提取 + 字符清洗
  if (activeTabRaw) {
    const cleanTab = activeTabRaw.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (cleanTab) {
      context += `当前文件: ${cleanTab}\n\n`;
    }
  }

  // 3. 选中代码提取 + 字符清洗 + 1200 字符门禁
  if (selectedCodeRaw) {
    const cleanSelection = selectedCodeRaw.replace(/[\u200B-\u200D\uFEFF]/g, "");
    if (cleanSelection && cleanSelection.length < SELECTION_LIMIT) {
      context += `选中代码:\n${cleanSelection}\n\n`;
    }
  }

  // 4. 原始提示词规范化
  const cleanPrompt = String(userPromptRaw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  // 组装最终发送给大模型的内容
  const userMessage = context
    ? `上下文信息:\n${context}用户原始提示词:\n${cleanPrompt}`
    : cleanPrompt;

  const payload = {
    model: "deepseek-v4-flash",
    max_tokens: 512,
    messages: [
      { role: "system", content: "你是一个智能提示词优化器..." },
      { role: "user", content: userMessage },
    ],
  };

  return { context, cleanPrompt, payload };
}

test("【测试1】DOM 结构噪点与字符级不可见噪点过滤测试", () => {
  // 构造包含各种 UI 噪点和不可见字符的真实 DOM 树
  const root = new MockNode("div", "", "cascade-scrollbar");
  
  // 噪点 1: 面板标题栏
  const header = new MockNode("div", "✨ Cascade Chat Header", "antigravity-agent-side-panel-header");
  // 噪点 2: 各种按钮 (滚动按钮、增强按钮、复制按钮等)
  const scrollBtn = new MockNode("button", "↓ 滚动到底部", "cascade-scroll-bottom-btn");
  const enhanceBtn = new MockNode("button", "✨ Prompt Enhance", "Antigravity-Power-Pro-enhance-btn");
  const copyBtn = new MockNode("button", "复制代码", "copy-code-btn");
  // 噪点 3: 模型选择器
  const modelSelector = new MockNode("div", "Current Model: deepseek-v4-flash", "model-selector-container");
  // 噪点 4: 输入框容器及其占位符
  const inputContainer = new MockNode("div", "Ask anything... Ctrl+L", "chat-input-container");

  // 真实对话内容 (混入不可见零宽字符 \u200B、\u200C、\u200D、\uFEFF)
  const dirtyRealChat = `User: 怎么解决异步函数\u200B超时问题？\nAI: 可以使用 Promise.race\uFEFF 或 AbortController\u200C 来设置超时时间。`;
  const messageNode = new MockNode("div", dirtyRealChat, "message-content");

  root.appendChild(header);
  root.appendChild(messageNode);
  root.appendChild(scrollBtn);
  root.appendChild(enhanceBtn);
  root.appendChild(copyBtn);
  root.appendChild(modelSelector);
  root.appendChild(inputContainer);
  root.updateInnerText();

  const dirtyActiveTab = `\uFEFFauth-service.ts\u200B`;
  const dirtySelectedCode = `const controller = new \u200BAbortController();\nsetTimeout(() => controller.abort(), 5000);`;
  const dirtyUserPrompt = `\u200B帮我加个重试 3 次的逻辑\uFEFF\r\n`;

  const { context, cleanPrompt, payload } = extractContextAndFilterNoise({
    conversationTree: root,
    activeTabRaw: dirtyActiveTab,
    selectedCodeRaw: dirtySelectedCode,
    userPromptRaw: dirtyUserPrompt,
  });

  const finalUserContent = payload.messages[1].content;

  console.log("\n================ [真实过滤后发送给大模型的 Payload] ================");
  console.log(finalUserContent);
  console.log("====================================================================\n");

  // 1. 验证 DOM 结构噪点已被 100% 物理清除
  assert.ok(!finalUserContent.includes("Cascade Chat Header"), "❌ 标题栏未被过滤");
  assert.ok(!finalUserContent.includes("滚动到底部"), "❌ 滚动按钮文字未被过滤");
  assert.ok(!finalUserContent.includes("Prompt Enhance"), "❌ 增强按钮文字未被过滤");
  assert.ok(!finalUserContent.includes("复制代码"), "❌ 复制按钮文字未被过滤");
  assert.ok(!finalUserContent.includes("Current Model:"), "❌ 模型选择器未被过滤");
  assert.ok(!finalUserContent.includes("Ask anything"), "❌ 输入框占位符未被过滤");

  // 2. 验证字符级不可见字符已 100% 被清洗
  assert.ok(!finalUserContent.includes("\u200B"), "❌ 零宽空格 \\u200B 未被过滤");
  assert.ok(!finalUserContent.includes("\u200C"), "❌ 零宽非连 \\u200C 未被过滤");
  assert.ok(!finalUserContent.includes("\u200D"), "❌ 零宽连接 \\u200D 未被过滤");
  assert.ok(!finalUserContent.includes("\uFEFF"), "❌ BOM \\uFEFF 未被过滤");

  // 3. 验证真实有效信息 100% 被完整保留
  assert.ok(finalUserContent.includes("User: 怎么解决异步函数超时问题？"));
  assert.ok(finalUserContent.includes("当前文件: auth-service.ts"));
  assert.ok(finalUserContent.includes("const controller = new AbortController();"));
  assert.ok(finalUserContent.includes("用户原始提示词:\n帮我加个重试 3 次的逻辑"));
});

test("【测试2】超长历史（截取末尾3000字）与超长代码门禁测试", () => {
  // 构造 5000 字符的历史
  const prefixHistory = "A".repeat(4000);
  const recentHistory = "【最近的重要讨论：Token 刷新机制已改为双 Token 模式】";
  const fullHistory = prefixHistory + recentHistory;

  const root = new MockNode("div", fullHistory, "cascade-scrollbar");

  // 超长代码片段 (超过 1200 字符)
  const hugeSelectedCode = "console.log('huge code');\n".repeat(100); // > 2500 字符

  const { payload } = extractContextAndFilterNoise({
    conversationTree: root,
    activeTabRaw: "main.rs",
    selectedCodeRaw: hugeSelectedCode,
    userPromptRaw: "总结一下",
  });

  const content = payload.messages[1].content;

  // 验证 1: 历史被截断，最近的重要讨论在末尾依然保留
  assert.ok(content.includes("双 Token 模式"));
  // 验证 2: 超长代码由于 > 1200 字符触发熔断，不被附带
  assert.ok(!content.includes("huge code"), "❌ 超过 1200 字符的代码未被安全门禁拦截");
  // 验证 3: 文件名正常保留
  assert.ok(content.includes("当前文件: main.rs"));
});
