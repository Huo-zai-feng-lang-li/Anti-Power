/**
 * 导出 Manager 窗口 (Launchpad) 的 DOM 结构.
 *
 * 用法:
 *   node scripts/dump-manager-dom.js                    # 自动发现
 *   node scripts/dump-manager-dom.js "ws://..."         # 手动
 */

const { connectCDP } = require('./cdp-utils');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const browser = await connectCDP(process.argv[2]);
        console.log('✅ 成功连接!\n');

        const contexts = browser.contexts();
        let managerPage = null;

        // 查找 Manager 窗口, 优先匹配标题为 "Manager" 的页面.
        let fallbackPage = null;
        for (const context of contexts) {
            for (const page of context.pages()) {
                const url = page.url();
                const title = await page.title();

                // 优先选择标题为 "Manager" 的页面.
                if (title === 'Manager') {
                    managerPage = page;
                    console.log(`🎯 找到 Manager 窗口: ${title}`);
                    break;
                }
                // 作为备选, 记录第一个 jetski-agent 页面.
                if (url.includes('workbench-jetski-agent.html') && !fallbackPage) {
                    fallbackPage = page;
                }
            }
            if (managerPage) break;
        }

        // 如果没找到 Manager, 使用备选页面.
        if (!managerPage && fallbackPage) {
            managerPage = fallbackPage;
            console.log(`⚠️ 未找到标题为 "Manager" 的页面，使用备选: ${await fallbackPage.title()}`);
        }

        if (!managerPage) {
            console.log('❌ 未找到 Manager 窗口，请确保已打开 Manager/Launchpad');
            await browser.close();
            process.exit(1);
        }

        console.log('\n📦 正在导出 DOM 结构...\n');

        // 输出目录固定为 tests/temp.
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 导出完整 HTML
        const fullHtml = await managerPage.content();
        const htmlPath = path.join(tempDir, 'manager-dom-full.html');
        fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
        console.log(`✅ 完整 HTML 已保存到: ${htmlPath}`);

        // 导出 DOM 树结构 (简化版, 方便阅读).
        const domTree = await managerPage.evaluate(() => {
            function getNodeInfo(element, depth = 0) {
                if (depth > 15) return null; // Limit depth to keep output concise.

                const info = {
                    tag: element.tagName?.toLowerCase() || '#text',
                    id: element.id || undefined,
                };

                // 处理 className 可能为对象的情况 (例如 SVG).
                const className = element.className;
                if (typeof className === 'string') {
                    info.class = className;
                } else if (className && typeof className === 'object' && className.baseVal !== undefined) {
                    info.class = className.baseVal;
                }

                // 只获取有意义的属性.
                if (element.getAttribute) {
                    const role = element.getAttribute('role');
                    const dataTestid = element.getAttribute('data-testid');
                    if (role) info.role = role;
                    if (dataTestid) info.testId = dataTestid;
                }

                // 递归获取子元素.
                if (element.children && element.children.length > 0) {
                    info.children = Array.from(element.children)
                        .map(child => getNodeInfo(child, depth + 1))
                        .filter(Boolean);
                }

                return info;
            }

            return getNodeInfo(document.body);
        });

        const treePath = path.join(tempDir, 'manager-dom-tree.json');
        fs.writeFileSync(treePath, JSON.stringify(domTree, null, 2), 'utf-8');
        console.log(`✅ DOM 树结构已保存到: ${treePath}`);

        // 提取有 ID 或关键 class 的元素, 便于定位.
        const keyElements = await managerPage.evaluate(() => {
            const elements = document.querySelectorAll('[id], [class*="cascade"], [class*="agent"], [class*="panel"], [class*="chat"]');
            return Array.from(elements).slice(0, 100).map(el => {
                let className = el.className;
                if (typeof className !== 'string') {
                    className = className?.baseVal || '';
                }
                return {
                    tag: el.tagName.toLowerCase(),
                    id: el.id || undefined,
                    class: className.split(' ').filter(c => c).slice(0, 5).join(' ') || undefined,
                    text: el.textContent?.slice(0, 50).trim() || undefined
                };
            });
        });

        const elementsPath = path.join(tempDir, 'manager-key-elements.json');
        fs.writeFileSync(elementsPath, JSON.stringify(keyElements, null, 2), 'utf-8');
        console.log(`✅ 关键元素列表已保存到: ${elementsPath}`);

        console.log('\n🎉 导出完成! 你可以查看以下文件:');
        console.log(`   - manager-dom-full.html    (完整 HTML)`.padEnd(50));
        console.log(`   - manager-dom-tree.json    (DOM 树结构)`);
        console.log(`   - manager-key-elements.json (关键元素列表)`);

        await browser.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

main();
