/**
 * 自动连接 Antigravity 并调试 Manager 窗口.
 * 需要使用 --remote-debugging-port=9222 启动, 并打开 Manager 窗口.
 */

const { connectCDP } = require("./cdp-utils");

(async () => {
  const browser = await connectCDP();

    const contexts = browser.contexts();
    for (const context of contexts) {
      const pages = context.pages();
      for (const page of pages) {
        const title = await page.title();
        const url = page.url();

        if (
          title.includes("Manager") ||
          url.includes("workbench-jetski-agent")
        ) {
          console.log(`\n🎯 找到 Manager 窗口: ${title}`);
          console.log(`   URL: ${url}`);

          // 监听 Console 消息.
          page.on("console", (msg) => {
            const type = msg.type().toUpperCase();
            const text = msg.text();
            if (
              type === "ERROR" ||
              text.includes("Manager") ||
              text.includes("Antigravity-Power-Pro")
            ) {
              console.log(`[${type}] ${text}`);
            }
          });

          // 监听页面错误.
          page.on("pageerror", (error) => {
            console.log(`[PAGE ERROR] ${error.message}`);
          });

          // 检查脚本是否加载.
          console.log("\n📜 检查脚本状态...");
          const scriptInfo = await page.evaluate(() => {
            const scripts = document.querySelectorAll("script");
            return Array.from(scripts).map((s) => s.src || "[inline]");
          });
          console.log("加载的脚本:", scriptInfo);

          // 获取库加载状态与错误线索.
          console.log("\n🔴 获取页面错误...");
          const errors = await page.evaluate(() => {
            // 尝试获取任何错误信息
            return {
              hasKatex: typeof window.katex !== "undefined",
              hasMermaid: typeof window.mermaid !== "undefined",
              hasRenderMathInElement:
                typeof window.renderMathInElement !== "undefined",
            };
          });
          console.log("库加载状态:", errors);

          // 尝试手动执行脚本逻辑.
          console.log("\n🧪 测试内容选择器...");
          const contentTest = await page.evaluate(() => {
            const selector = ".leading-relaxed.select-text";
            const elements = document.querySelectorAll(selector);
            return {
              selector,
              count: elements.length,
              samples: Array.from(elements)
                .slice(0, 3)
                .map((el) => ({
                  tag: el.tagName,
                  textPreview: (el.textContent || "").slice(0, 100),
                })),
            };
          });
          console.log("内容元素:", JSON.stringify(contentTest, null, 2));

          console.log("\n⏳ 持续监听 20 秒...");
          await new Promise((r) => setTimeout(r, 20000));

          break;
        }
      }
    }

    await browser.close();
})().catch((error) => {
  console.error("❌ 错误:", error.message);
  console.log("\n💡 请确保:");
  console.log("   1. Antigravity 以 --remote-debugging-port=9222 启动");
  console.log("   2. Manager 窗口已打开");
});
