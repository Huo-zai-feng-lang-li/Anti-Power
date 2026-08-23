/**
 * Cascade Panel Mermaid 纯净图表渲染模块 (Ultra Pro 增强版 - 高性能零卡顿)
 *
 * 核心特性：
 * 1. 【同源离线引擎】：加载本地同目录 ./cascade-panel/mermaid.min.js，零网络依赖，零 CSP 冲突；
 * 2. 【智能语法锚点清洗】：精准截取合法 Mermaid DSL 语法，自动剥离外壳干扰；
 * 3. 【防重入与防死锁】：WeakSet + DOM 状态标记（pending/1/error），杜绝重入卡顿；
 * 4. 【沉浸式全屏预览】：支持右上角全屏、双击全屏、滚轮无级缩放、平移拖拽与 ESC 退出；
 * 5. 【三重健壮剪贴板】：Electron 原生 Clipboard > Navigator API > DOM 选区降级；
 * 6. 【现代鲜活彩色主题】：高对比度科技蓝、霓虹紫、翡翠绿配色体系。
 */

let mermaidReady = false;
let mermaidLoadingPromise = null;
let mermaidIdCounter = 0;

const MERMAID_ATTR = "data-cascade-mermaid-rendered";
const MERMAID_CONTAINER_CLASS = "cascade-mermaid-container";
const renderedSet = new WeakSet();

// 支持全量 Mermaid 图表语法起始关键字（兼容 frontmatter --- 与 %% 注释）
const MERMAID_START_REGEX = /(?:^|\n)\s*(?:---|%%|\b(graph|flowchart|sequenceDiagram|classDiagram|classDiagram-v2|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|xychart|sankey|block|packet|architecture|kanban|c4|requirementDiagram)\b)/i;

/**
 * 安全获取原生 Node / Electron require 句柄
 */
function getNativeRequire() {
  try {
    if (typeof require === "function") {
      if (typeof require.nodeRequire === "function") return require.nodeRequire;
      return require;
    }
  } catch (e) {}
  try {
    if (typeof window !== "undefined" && typeof window.require === "function") {
      if (typeof window.require.nodeRequire === "function") return window.require.nodeRequire;
      return window.require;
    }
  } catch (e) {}
  try {
    if (typeof process !== "undefined" && process.mainModule && typeof process.mainModule.require === "function") {
      return process.mainModule.require;
    }
  } catch (e) {}
  return null;
}

/**
 * 健壮的文本剪贴板复制函数（Electron 原生 + Navigator + DOM 三重保障）
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  // 1. 最高优先级：尝试 Electron 原生 clipboard 模块
  try {
    const req = getNativeRequire();
    if (req) {
      const electron = req("electron");
      if (electron?.clipboard?.writeText) {
        electron.clipboard.writeText(text);
        return true;
      }
    }
  } catch (e) {
    console.warn("[Cascade] Electron 原生 clipboard 访问失败，尝试回退:", e);
  }

  // 2. 次级尝试：navigator.clipboard
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn("[Cascade] navigator.clipboard 写入受限，回退至 DOM execCommand:", e);
    }
  }

  // 3. 兜底方案：优化版 textarea + 明确选区 execCommand('copy')
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.contain = "strict";
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.fontSize = "12pt";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);
    return !!successful;
  } catch (err) {
    console.error("[Cascade] 复制失败:", err);
    return false;
  }
};

/**
 * 动态加载并初始化炫彩 Mermaid 库
 */
export const ensureMermaid = async () => {
  if (mermaidReady || (window.mermaid && typeof window.mermaid.render === "function")) {
    mermaidReady = true;
    return true;
  }
  if (mermaidLoadingPromise) return mermaidLoadingPromise;

  mermaidLoadingPromise = (async () => {
    // 1. 尝试从 Electron Node 环境 require 本地内置 mermaid
    if (!window.mermaid) {
      try {
        const req = getNativeRequire();
        if (req) {
          const m = req("mermaid");
          if (m) window.mermaid = m.default || m;
        }
      } catch (e) {}
    }

    // 2. 尝试从同源本地 script 标签加载
    if (!window.mermaid || typeof window.mermaid.render !== "function") {
      const loadScript = (src) =>
        new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.onload = () => resolve(true);
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });

      try {
        await loadScript("./cascade-panel/mermaid.min.js");
      } catch (e) {
        try {
          await loadScript("../../../../node_modules/mermaid/dist/mermaid.min.js");
        } catch (err) {
          console.warn("[Cascade] 本地 Mermaid 脚本加载异常:", err);
        }
      }
    }

    // 兼容导出命名空间
    if (!window.mermaid) {
      if (typeof window.US !== "undefined") window.mermaid = window.US;
      else if (typeof window.ih !== "undefined") window.mermaid = window.ih;
    }

    if (window.mermaid && typeof window.mermaid.initialize === "function") {
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            darkMode: true,
            background: "#0f172a",
            mainBkg: "#1e293b",
            nodeBorder: "#38bdf8",
            clusterBkg: "#0f172a",
            clusterBorder: "#334155",
            titleColor: "#f8fafc",
            edgeLabelBackground: "#1e293b",
            primaryColor: "#2563eb",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#60a5fa",
            lineColor: "#38bdf8",
            secondaryColor: "#7c3aed",
            secondaryTextColor: "#ffffff",
            secondaryBorderColor: "#a78bfa",
            tertiaryColor: "#059669",
            tertiaryTextColor: "#ffffff",
            tertiaryBorderColor: "#34d399",
            noteBkgColor: "#312e81",
            noteTextColor: "#e0e7ff",
            noteBorderColor: "#818cf8",
            actorBkg: "#1e293b",
            actorBorder: "#38bdf8",
            actorTextColor: "#f8fafc",
            actorLineColor: "#64748b",
            signalColor: "#38bdf8",
            signalTextColor: "#f8fafc",
            labelBoxBkgColor: "#1e293b",
            labelBoxBorderColor: "#475569",
            labelTextColor: "#f8fafc",
            loopTextColor: "#f8fafc",
            activationBorderColor: "#818cf8",
            activationBkgColor: "#312e81",
            sequenceNumberColor: "#ffffff",
            fontSize: "13px",
            fontFamily: 'var(--vscode-font-family, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
            // 甘特图深色适配
            taskBkgColor: "#2563eb",
            taskTextColor: "#ffffff",
            taskBorderColor: "#60a5fa",
            taskTextLightColor: "#ffffff",
            activeTaskBkgColor: "#7c3aed",
            activeTaskBorderColor: "#a78bfa",
            doneTaskBkgColor: "#059669",
            doneTaskBorderColor: "#34d399",
            critBkgColor: "#dc2626",
            critBorderColor: "#f87171",
            todayLineColor: "#fbbf24",
            gridColor: "#334155",
            sectionBkgColor: "#1e293b",
            altSectionBkgColor: "#0f172a",
            sectionBkgColor2: "#1e293b",
          },
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
            curve: "basis",
            padding: 14,
          },
          sequence: {
            useMaxWidth: false,
            actorFontSize: 13,
            messageFontSize: 12,
            noteFontSize: 12,
            mirrorActors: false,
          },
          gantt: {
            useMaxWidth: false,
            fontSize: 12,
            sectionFontSize: 12,
            titleTopMargin: 25,
            barHeight: 24,
            barGap: 8,
            topPadding: 50,
            sidePadding: 100,
            axisFormat: "%m-%d",
          },
          securityLevel: "loose",
        });
        mermaidReady = true;
        return true;
      } catch (initErr) {
        console.warn("[Cascade] Mermaid initialize 警告:", initErr);
      }
    }

    mermaidReady = !!(window.mermaid && typeof window.mermaid.render === "function");
    return mermaidReady;
  })();

  return mermaidLoadingPromise;
};

/**
 * 智能精确提取 Mermaid 源码（自动剔除外部干扰文字与围栏）
 * @param {Element} el
 * @returns {string}
 */
export const extractMermaidSource = (el) => {
  if (!el) return "";
  let raw = "";
  if (typeof el.querySelectorAll === "function") {
    const lines = el.querySelectorAll(".line-content, .view-line");
    if (lines && lines.length > 0) {
      raw = Array.from(lines)
        .map((line) => line.textContent || "")
        .join("\n");
    }
  }

  if (!raw && typeof el.querySelector === "function") {
    const code = el.querySelector("code") || el.querySelector("pre") || el.querySelector(".language-mermaid");
    if (code) {
      raw = code.textContent || "";
    }
  }

  if (!raw) {
    raw = el.textContent || el.innerText || (typeof el === "string" ? el : "");
  }

  raw = (raw || "").trim();
  raw = raw.replace(/^```mermaid\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  const match = raw.match(
    /\b(graph|flowchart|sequenceDiagram|classDiagram|classDiagram-v2|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|xychart|sankey|block|packet|architecture)\b[\s\S]*/i
  );
  if (match) {
    return match[0].trim();
  }

  return raw;
};

/**
 * 打开沉浸式全屏/缩放交互模态弹窗 (GPU 硬件加速与 rAF 极速渲染版)
 * @param {string} svgContent
 * @param {string} source
 */
const openFullscreenViewer = (svgContent, source) => {
  const existing = document.getElementById("cascade-mermaid-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "cascade-mermaid-modal";
  modal.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,12,18,0.92);backdrop-filter:blur(10px);z-index:999999;display:flex;flex-direction:column;justify-content:center;align-items:center;user-select:none;animation:fadeIn 0.15s ease-out;";

  // 工具栏 (右上角关闭 - 留出 64px 安全距离彻底避开 IDE 顶栏窗口控制区)
  const header = document.createElement("div");
  header.style.cssText =
    "position:absolute !important;top:64px !important;right:32px !important;display:flex !important;gap:10px !important;z-index:1000000 !important;";

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕ 关闭 (Esc)";
  closeBtn.style.cssText =
    "padding:7px 16px;background:#27272a;color:#f4f4f5;border:1px solid #3f3f46;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;box-shadow:0 4px 16px rgba(0,0,0,0.6);";
  closeBtn.onmouseenter = () => (closeBtn.style.background = "#dc2626");
  closeBtn.onmouseleave = () => (closeBtn.style.background = "#27272a");

  header.appendChild(closeBtn);
  modal.appendChild(header);

  // 视口容器
  const viewport = document.createElement("div");
  viewport.style.cssText =
    "width:94vw;height:84vh;display:flex;justify-content:center;align-items:center;overflow:hidden;cursor:grab;position:relative;";

  const contentBox = document.createElement("div");
  contentBox.style.cssText =
    "display:inline-block;transform-origin:center center;will-change:transform;";
  contentBox.innerHTML = svgContent;

  const svgEl = contentBox.querySelector("svg");
  if (svgEl) {
    svgEl.style.maxWidth = "none";
    svgEl.style.maxHeight = "none";
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
  }

  viewport.appendChild(contentBox);
  modal.appendChild(viewport);

  // 缩放控制与拖拽逻辑 (rAF 极速渲染)
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let rafId = null;

  const scheduleUpdate = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      contentBox.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
      rafId = null;
    });
  };

  // 滚轮无级缩放
  viewport.onwheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    scale = Math.min(Math.max(0.3, scale * zoomFactor), 8.0);
    scheduleUpdate();
  };

  // 仅在按下时动态绑定 move 与 up，零平时 CPU 损耗
  const onMouseMove = (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    scheduleUpdate();
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      viewport.style.cursor = "grab";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
  };

  viewport.onmousedown = (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    viewport.style.cursor = "grabbing";
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
  };

  // 底部操作控制面板
  const bottomBar = document.createElement("div");
  bottomBar.style.cssText =
    "position:absolute;bottom:20px;background:#18181b;border:1px solid #3f3f46;border-radius:30px;padding:6px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,0.6);";

  const makeBtn = (text, onClick) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.style.cssText =
      "background:transparent;color:#e4e4e7;border:none;padding:4px 8px;font-size:12px;cursor:pointer;border-radius:4px;transition:all 0.15s;";
    b.onmouseenter = () => (b.style.background = "#27272a");
    b.onmouseleave = () => (b.style.background = "transparent");
    b.onclick = onClick;
    return b;
  };

  bottomBar.appendChild(
    makeBtn("➕ 放大", () => {
      scale = Math.min(8.0, scale * 1.25);
      scheduleUpdate();
    })
  );
  bottomBar.appendChild(
    makeBtn("➖ 缩小", () => {
      scale = Math.max(0.3, scale * 0.8);
      scheduleUpdate();
    })
  );
  bottomBar.appendChild(
    makeBtn("↺ 重置", () => {
      scale = 1.0;
      translateX = 0;
      translateY = 0;
      scheduleUpdate();
    })
  );
  bottomBar.appendChild(
    makeBtn("📋 复制源码", async (e) => {
      const ok = await copyToClipboard(`\`\`\`mermaid\n${source}\n\`\`\``);
      e.target.textContent = ok ? "已复制 ✓" : "复制失败 ✗";
      setTimeout(() => (e.target.textContent = "📋 复制源码"), 1800);
    })
  );
  bottomBar.appendChild(
    makeBtn("✕ 退出全屏", () => {
      closeModal();
    })
  );

  modal.appendChild(bottomBar);

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const closeModal = () => {
    if (rafId) cancelAnimationFrame(rafId);
    document.body.style.overflow = originalOverflow;
    viewport.onwheel = null;
    viewport.onmousedown = null;
    closeBtn.onclick = null;
    modal.onclick = null;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    modal.remove();
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") closeModal();
  };

  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal || e.target === viewport) closeModal();
  };
  window.addEventListener("keydown", onKeyDown);

  document.body.appendChild(modal);
};

/**
 * 创建顶部操作工具条（全屏放大 + 复制）
 * @param {string} source
 * @param {Function} getSvgContent
 * @returns {HTMLElement}
 */
const createActionBar = (source, getSvgContent) => {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:absolute;top:6px;right:6px;display:flex;gap:6px;z-index:10;opacity:0.85;transition:opacity 0.2s;";

  bar.onmouseenter = () => (bar.style.opacity = "1");
  bar.onmouseleave = () => (bar.style.opacity = "0.85");

  // 全屏/放大按钮
  const expandBtn = document.createElement("button");
  expandBtn.innerHTML = "🔍 全屏查看";
  expandBtn.title = "全屏查看 / 滚轮缩放 / 拖拽平移";
  expandBtn.style.cssText =
    "padding:3px 8px;font-size:11px;font-family:inherit;font-weight:500;background:#1e293b;color:#38bdf8;border:1px solid #0284c7;border-radius:4px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.3);";
  expandBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFullscreenViewer(getSvgContent(), source);
  };

  // 专属复制按钮
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "复制";
  copyBtn.style.cssText =
    "padding:3px 8px;font-size:11px;font-family:inherit;font-weight:500;background:#27272a;color:#d4d4d8;border:1px solid #3f3f46;border-radius:4px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.3);";

  copyBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const formatted = `\`\`\`mermaid\n${source}\n\`\`\``;
    const ok = await copyToClipboard(formatted);
    if (ok) {
      copyBtn.textContent = "已复制 ✓";
      copyBtn.style.borderColor = "#22c55e";
      copyBtn.style.color = "#22c55e";
      setTimeout(() => {
        copyBtn.textContent = "复制";
        copyBtn.style.borderColor = "#3f3f46";
        copyBtn.style.color = "#d4d4d8";
      }, 2000);
    } else {
      copyBtn.textContent = "复制失败 ✗";
      copyBtn.style.borderColor = "#ef4444";
      copyBtn.style.color = "#ef4444";
      setTimeout(() => {
        copyBtn.textContent = "复制";
        copyBtn.style.borderColor = "#3f3f46";
        copyBtn.style.color = "#d4d4d8";
      }, 2000);
    }
  };

  bar.appendChild(expandBtn);
  bar.appendChild(copyBtn);
  return bar;
};

/**
 * 渲染单个 Mermaid 代码容器 (具备流式时序容错与自愈能力)
 * @param {Element} container
 */
export const renderMermaidBlock = async (container) => {
  if (!container || renderedSet.has(container)) return;
  const currentAttr = container.getAttribute(MERMAID_ATTR);
  if (currentAttr === "1" || currentAttr === "pending") return;

  const source = extractMermaidSource(container);
  // 如果内容尚未生成完整，不打死标记，等待后续流式 DOM 更新重新触发
  if (!source || !MERMAID_START_REGEX.test(source)) {
    return;
  }

  // 临时标记为 pending，防止微秒级并发重入
  container.setAttribute(MERMAID_ATTR, "pending");

  const ready = await ensureMermaid();
  if (!ready || !window.mermaid) {
    container.removeAttribute(MERMAID_ATTR);
    return;
  }

  const id = `cascade-mermaid-${++mermaidIdCounter}`;
  try {
    if (typeof window.mermaid.parse === "function") {
      await window.mermaid.parse(source);
    }

    let targetWrapper = container.nextElementSibling;
    if (!targetWrapper || !targetWrapper.classList.contains(MERMAID_CONTAINER_CLASS)) {
      targetWrapper = document.createElement("div");
      targetWrapper.className = MERMAID_CONTAINER_CLASS;
      targetWrapper.style.cssText =
        "position:relative;margin:12px 0;padding:22px 16px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;overflow-x:auto;max-height:520px;display:flex;justify-content:center;align-items:center;box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,0.35);cursor:zoom-in;animation:cascadeMermaidFadeIn 0.18s ease-out;";
      container.insertAdjacentElement("afterend", targetWrapper);
    }

    const { svg } = await window.mermaid.render(id, source, targetWrapper);
    targetWrapper.innerHTML = svg;

    // 双击直接进入全屏预览
    targetWrapper.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFullscreenViewer(targetWrapper.innerHTML, source);
    };

    const svgEl = targetWrapper.querySelector("svg");
    if (svgEl) {
      svgEl.style.maxWidth = "100%";
      svgEl.style.height = "auto";
      svgEl.style.maxHeight = "480px";
      svgEl.style.display = "block";
      svgEl.style.margin = "0 auto";

      // 针对甘特图等时间密集型图表，确保最小展开宽度与刻度倾斜，彻底杜绝重叠
      const isGantt = source.includes("gantt") || svgEl.querySelector(".grid, .task, .sectionTitle");
      if (isGantt) {
        svgEl.style.minWidth = "580px";
        svgEl.style.width = "100%";
        const tickTexts = svgEl.querySelectorAll(".tick text, g.grid text, .grid text");
        tickTexts.forEach((t) => {
          const currentTransform = t.getAttribute("transform") || "";
          if (!currentTransform.includes("rotate")) {
            const x = t.getAttribute("x") || "0";
            const y = t.getAttribute("y") || "0";
            t.setAttribute("transform", `translate(${x},${y}) rotate(-32)`);
            t.setAttribute("text-anchor", "end");
            t.setAttribute("font-size", "10px");
          }
        });
      } else {
        const vb = svgEl.getAttribute("viewBox");
        if (vb) {
          const parts = vb.trim().split(/\s+/).map(Number);
          if (parts.length >= 4 && parts[2] > 0) {
            const naturalWidth = parts[2];
            if (naturalWidth < 680) {
              svgEl.style.width = `${naturalWidth}px`;
            }
          }
        }
      }
    }

    targetWrapper.appendChild(
      createActionBar(source, () => targetWrapper.querySelector("svg")?.outerHTML || targetWrapper.innerHTML)
    );

    // 零尺寸隐藏原始代码块并打上永久渲染成功标记
    container.style.cssText =
      "position:absolute !important;width:0 !important;height:0 !important;max-height:0 !important;opacity:0 !important;overflow:hidden !important;pointer-events:none !important;margin:0 !important;padding:0 !important;border:none !important;clip:rect(0,0,0,0) !important;";
    container.setAttribute(MERMAID_ATTR, "1");
    container.querySelectorAll?.("pre, code")?.forEach((sub) => {
      sub.setAttribute(MERMAID_ATTR, "1");
      renderedSet.add(sub);
    });
    renderedSet.add(container);
  } catch (error) {
    // 流式打字尚未结束时可能语法暂未闭合，释放 pending 标记允许后续重试
    container.style.cssText = "";
    container.removeAttribute(MERMAID_ATTR);
  }
};

/**
 * 扫描指定根节点下的 Mermaid 代码块（使用顶层容器归一化，彻底消除父子嵌套冲突）
 * @param {Element} root
 */
export const scanAndRenderMermaid = async (root = document.body) => {
  if (!root || !root.querySelectorAll) return;

  const rawElements = root.querySelectorAll(
    'div[class*="code-block"]:not([data-cascade-mermaid-rendered="1"]), pre:not([data-cascade-mermaid-rendered="1"]), [class*="language-mermaid"]:not([data-cascade-mermaid-rendered="1"])'
  );

  const targetContainers = new Set();
  for (const el of rawElements) {
    const container = el.closest('div[class*="code-block"]') || el.closest("pre") || el;
    const attr = container.getAttribute(MERMAID_ATTR);
    if (attr !== "1" && attr !== "pending" && !renderedSet.has(container)) {
      targetContainers.add(container);
    }
  }

  for (const container of targetContainers) {
    const attr = container.getAttribute(MERMAID_ATTR);
    if (attr === "1" || attr === "pending" || renderedSet.has(container)) {
      continue;
    }

    const langLabel = container.querySelector('.font-sans, [class*="text-ide-text-color"], [class*="language-"]')?.textContent || "";
    const source = extractMermaidSource(container);

    const isMermaid =
      langLabel.trim().toLowerCase() === "mermaid" ||
      container.classList.contains("language-mermaid") ||
      container.querySelector(".language-mermaid") ||
      MERMAID_START_REGEX.test(source);

    if (isMermaid) {
      container.querySelectorAll?.("pre, code")?.forEach((sub) => {
        sub.setAttribute(MERMAID_ATTR, "1");
        renderedSet.add(sub);
      });
      await renderMermaidBlock(container);
    } else {
      // 性能极致优化：对明确非 Mermaid 代码块直接标记已处理，后续扫描 0 开销跳过
      if (langLabel && langLabel.trim().toLowerCase() !== "" && langLabel.trim().toLowerCase() !== "mermaid") {
        container.setAttribute(MERMAID_ATTR, "1");
        container.querySelectorAll?.("pre, code")?.forEach((sub) => {
          sub.setAttribute(MERMAID_ATTR, "1");
          renderedSet.add(sub);
        });
        renderedSet.add(container);
      }
    }
  }
};
