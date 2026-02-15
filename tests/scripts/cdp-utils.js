/**
 * CDP 连接工具 — 所有调试脚本共用
 *
 * 自动从 /json/version 获取 wsUrl，也支持手动传参覆盖。
 * 用法:
 *   const { connectCDP, CDP_PORT } = require('./cdp-utils');
 *   const browser = await connectCDP(process.argv[2]);
 */

const { chromium } = require("playwright");

const CDP_PORT = Number(process.env.CDP_PORT) || 9222;
const CDP_HOST = process.env.CDP_HOST || "127.0.0.1";

/**
 * 连接 CDP。优先使用传入的 wsUrl，否则自动发现。
 * @param {string} [wsUrl] - 可选，手动指定的 WebSocket URL
 * @returns {Promise<import('playwright').Browser>}
 */
async function connectCDP(wsUrl) {
  if (!wsUrl) {
    console.log(`🔍 正在从 http://${CDP_HOST}:${CDP_PORT}/json/version 获取 WebSocket URL...`);
    const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`);
    const info = await res.json();
    wsUrl = info.webSocketDebuggerUrl;
  }
  console.log(`🔗 WebSocket URL: ${wsUrl}`);
  const browser = await chromium.connectOverCDP(wsUrl);
  console.log("✅ 成功连接!\n");
  return browser;
}

/**
 * 在所有页面中查找包含 Cascade 侧边栏的 frame
 * @param {import('playwright').Browser} browser
 * @returns {Promise<{frame: import('playwright').Frame, page: import('playwright').Page} | null>}
 */
async function findCascadeFrame(browser) {
  async function searchFrame(frame) {
    try {
      const found = await frame.evaluate(
        () => document.getElementById("react-app") !== null || document.getElementById("chat") !== null
      );
      if (found) return frame;
      for (const child of frame.childFrames()) {
        const r = await searchFrame(child);
        if (r) return r;
      }
    } catch {}
    return null;
  }

  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      const title = await page.title();
      if (title !== "Manager" && title !== "Launchpad") {
        const frame = await searchFrame(page.mainFrame());
        if (frame) return { frame, page };
      }
    }
  }
  return null;
}

module.exports = { connectCDP, findCascadeFrame, CDP_PORT, CDP_HOST };
