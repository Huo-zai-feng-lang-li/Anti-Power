/**
 * Cascade Panel — 滚动到底部按钮
 *
 * 监听 #cascade 内的可滚动区域，当用户未处于底部时显示浮动箭头。
 * React 切换对话时会替换滚动容器节点，通过 MutationObserver 自动重挂。
 *
 * 选择器来源：CDP 探测得到的唯一匹配
 *   #cascade .grow.overflow-y-auto  (position: relative, overflow-y: auto)
 */

const BTN_ID = "cascade-scroll-bottom-btn";
const THRESHOLD = 120;

/** 查找滚动容器 */
const findScrollEl = () =>
  document.querySelector("#cascade .grow.overflow-y-auto");

/** 创建双箭头 SVG */
const createArrowSVG = () => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const attrs = {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round",
  };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);

  const pts = ["7 13 12 18 17 13", "7 6 12 11 17 6"];
  for (const p of pts) {
    const poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", p);
    svg.appendChild(poly);
  }
  return svg;
};

/**
 * 初始化滚动到底部功能
 * @exports
 */
export const init = () => {
  let trackedEl = null;
  let resizeObs = null;

  const ensureButton = () => {
    const el = findScrollEl();
    if (!el) return;
    if (el === trackedEl && document.getElementById(BTN_ID)) return;

    // 清理旧按钮与旧 ResizeObserver
    document.getElementById(BTN_ID)?.remove();
    resizeObs?.disconnect();
    trackedEl = el;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.title = "滚动到底部";
    btn.appendChild(createArrowSVG());

    // 滚动容器自身 position: relative，直接 append
    el.appendChild(btn);

    const update = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const visible = gap > THRESHOLD;
      btn.style.opacity = visible ? "1" : "0";
      btn.style.pointerEvents = visible ? "auto" : "none";
      btn.style.transform = visible ? "translateY(0)" : "translateY(8px)";
    };

    btn.addEventListener("click", () => {
      el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
    });
    el.addEventListener("scroll", update, { passive: true });

    resizeObs = new ResizeObserver(update);
    resizeObs.observe(el);
    update();
  };

  ensureButton();

  // 对话切换时 React 会替换滚动容器，自动重挂
  let timer = null;
  const cascade = document.getElementById("cascade") || document.body;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(ensureButton, 200);
  }).observe(cascade, { childList: true, subtree: true });

  console.log("[Cascade] 滚动到底部按钮已启动");
};
