/**
 * 连接 Antigravity 远程调试端口, 列出所有页面和基本 DOM 信息.
 *
 * 用法:
 *   node scripts/connect-antigravity.js                    # 自动发现
 *   node scripts/connect-antigravity.js "ws://127.0.0.1:9222/devtools/browser/xxx"  # 手动
 */

const { connectCDP } = require("./cdp-utils");

async function main() {
  const browser = await connectCDP(process.argv[2]);

  const contexts = browser.contexts();
  console.log(`📂 找到 ${contexts.length} 个浏览器上下文\n`);

  let pageIndex = 0;
  for (const context of contexts) {
    for (const page of context.pages()) {
      pageIndex++;
      const title = await page.title();
      console.log(`--- 页面 ${pageIndex} ---`);
      console.log(`   标题: ${title}`);
      console.log(`   URL: ${page.url()}\n`);
    }
  }

  if (contexts.length > 0 && contexts[0].pages().length > 0) {
    const firstPage = contexts[0].pages()[0];
    console.log("🔍 正在分析第一个页面的 DOM 结构...\n");

    const bodyInfo = await firstPage.evaluate(() => {
      const children = Array.from(document.body.children).map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || "(无)",
        className: el.className || "(无)",
        childCount: el.children.length,
      }));
      return {
        totalElements: document.querySelectorAll("*").length,
        bodyChildren: children,
      };
    });

    console.log(`📊 DOM 统计: 总元素=${bodyInfo.totalElements}, body子元素=${bodyInfo.bodyChildren.length}\n`);
    bodyInfo.bodyChildren.forEach((child, i) => {
      console.log(`   ${i + 1}. <${child.tag}> id="${child.id}" class="${child.className}" (${child.childCount} 子元素)`);
    });
  }

  console.log("\n📌 连接保持打开，按 Ctrl+C 退出\n");
  await new Promise(() => {});
}

main().catch((e) => {
  console.error("❌ 连接失败:", e.message);
  console.log("\n请确保 Antigravity 以 --remote-debugging-port=9222 启动");
});
