/**
 * 从侧边栏虚拟列表的 React 元素中递归提取消息数据.
 *
 * 用法:
 *   node scripts/dump-cascade-dom.js                    # 自动发现
 *   node scripts/dump-cascade-dom.js "ws://..."         # 手动
 */

const { connectCDP, findCascadeFrame } = require('./cdp-utils');
const fs = require('fs');
const path = require('path');

async function main() {
    const browser = await connectCDP(process.argv[2]);

    const result = await findCascadeFrame(browser);
    const cascadeFrame = result?.frame;

    if (!cascadeFrame) {
        console.log('❌ 未找到侧边栏 frame');
        await browser.close();
        process.exit(1);
    }
    console.log('🎯 找到侧边栏 frame!\n');

    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    console.log('🔍 从 React 元素中递归提取消息...\n');

    const analysis = await cascadeFrame.evaluate(() => {
        const result = {
            extractedMessages: [],
            reactElementProps: [],
        };

        const gapContainer = document.querySelector('[class*="gap-y-3"][class*="px-4"]');
        if (gapContainer) {
            const fiberKey = Object.keys(gapContainer).find(k =>
                k.startsWith('__reactFiber$')
            );

            if (fiberKey) {
                let fiber = gapContainer[fiberKey];

                for (let i = 0; i < 30 && fiber; i++) {
                    if (fiber.memoizedProps?.children) {
                        const children = fiber.memoizedProps.children;
                        if (Array.isArray(children)) {
                            result.reactElementProps.push({
                                depth: i,
                                childrenCount: children.length,
                            });

                            for (let j = 0; j < children.length; j++) {
                                const child = children[j];
                                if (child?.props) {
                                    const props = child.props;
                                    const propKeys = Object.keys(props);

                                    result.extractedMessages.push({
                                        index: j,
                                        propKeys: propKeys.slice(0, 15),
                                        hasItem: !!props.item,
                                        itemData: props.item ? JSON.stringify(props.item, (k, v) => {
                                            if (typeof v === 'function') return '[fn]';
                                            if (typeof v === 'bigint') return v.toString();
                                            if (typeof v === 'string' && v.length > 500) return v.slice(0, 500) + '...';
                                            if (v && typeof v === 'object' && v.$$typeof) return '[ReactEl]';
                                            return v;
                                        }, 2).slice(0, 5000) : null,
                                        otherData: propKeys
                                            .filter(k => k !== 'children' && k !== 'item')
                                            .reduce((acc, k) => {
                                                const v = props[k];
                                                if (v && typeof v === 'object' && !v.$$typeof) {
                                                    acc[k] = v;
                                                } else if (typeof v !== 'function') {
                                                    acc[k] = v;
                                                }
                                                return acc;
                                            }, {}),
                                    });
                                }
                            }
                            break;
                        }
                    }
                    fiber = fiber.return;
                }
            }
        }

        return result;
    });

    const analysisPath = path.join(tempDir, 'cascade-extracted.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8');
    console.log(`✅ 分析结果已保存到: ${analysisPath}`);

    console.log('\n🎯 提取的消息数据:');
    if (analysis.extractedMessages.length === 0) {
        console.log('   (无)');
    } else {
        analysis.extractedMessages.forEach((msg, i) => {
            console.log(`\n   === 消息 ${i + 1} ===`);
            console.log(`   propKeys: ${msg.propKeys.join(', ')}`);
            console.log(`   hasItem: ${msg.hasItem}`);
            if (msg.itemData) {
                console.log(`   itemData: ${msg.itemData.slice(0, 500)}...`);
            }
            if (Object.keys(msg.otherData).length > 0) {
                console.log(`   otherData: ${JSON.stringify(msg.otherData).slice(0, 300)}`);
            }
        });
    }

    console.log('\n🎉 分析完成!');
    await browser.close();
}

main().catch((e) => {
    console.error('❌ 错误:', e.message);
    console.error(e.stack);
});
