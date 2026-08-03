import { querySelectorAllDeep } from './utils.js';

const INPUT_SELECTOR = '[role="textbox"][contenteditable="true"], textarea[placeholder*="Ask"], .chat-input textarea';
const ENHANCE_BTN_CLASS = "Antigravity-Power-Pro-enhance-btn";

const actionButtonSelectors = [
    'button[aria-label*="send" i]',
    'button[aria-label*="发送" i]',
    'button[aria-label*="Mic" i]',
    'button[title*="send" i]',
    'button[title*="Mic" i]',
    'button[type="submit"]',
    '[class*="send-button"]',
    '[data-testid*="send"]',
];

let config = {};
let enhanceModule = null;
let observer = null;
let scanTimer = 0;

const getRoot = () => document.getElementById('window-container') || document.body;

const readInputText = (input) =>
    (input?.innerText || input?.textContent || input?.value || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();

const resolveInput = (input, root, expectedText = '') => {
    if (input?.isConnected) return input;
    return querySelectorAllDeep(INPUT_SELECTOR, root).find((candidate) =>
        !candidate.closest('.antigravity-agent-side-panel') &&
        (!expectedText || readInputText(candidate) === expectedText),
    ) || null;
};

const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
        scanTimer = 0;
        scan();
    }, 160);
};

export const start = async (userConfig) => {
    config = userConfig;
    if (!config.promptEnhance?.enabled) {
        console.log("[Manager] 提示词增强已关闭，跳过扫描器");
        observer?.disconnect();
        observer = null;
        return;
    }

    console.log("[Manager] 启动扫描，配置:", config);
    try {
        enhanceModule = await import('../shared/enhance.js');
        enhanceModule.init(config.promptEnhance);

        observer?.disconnect();
        observer = new MutationObserver(scheduleScan);
        observer.observe(getRoot(), { childList: true, subtree: true });
        scan();
        console.log("[Manager] 扫描器已就绪");
    } catch (e) {
        console.error("[Manager] 初始化失败:", e);
    }
};

const scan = () => {
    if (!enhanceModule?.isEnabled()) return;

    const root = getRoot();
    const inputAreas = querySelectorAllDeep(INPUT_SELECTOR, root);

    inputAreas.forEach(input => {
        try {
            // 隔离侧边栏：侧边栏由专门的 cascade-panel/scan.js 处理，避免逻辑冲突
            if (input.closest('.antigravity-agent-side-panel')) {
              return;
            }

            // 终端过滤 (针对 Manager 窗口优化：仅排除真正的命令行，保留输入框)
            if (input.closest('.terminal-container') || 
                input.closest('.xterm-helper-textarea') ||
                (input.className.includes('xterm') && !input.getAttribute('role'))) {
              return;
            }

            // 使用 input 自身标记去重，避免按钮插入位置与检查位置不一致
            if (input.dataset.enhanceAttached) return;

            const parent = input.parentElement || (input.parentNode instanceof ShadowRoot ? input.parentNode.host : null);
            if (!parent) return;

            input.dataset.enhanceAttached = 'true';

            const btn = enhanceModule.createEnhanceButton(async () => {
                const currentRoot = getRoot();
                const currentInput = resolveInput(input, currentRoot);
                if (!currentInput) {
                    enhanceModule.showErrorModal("找不到当前输入框");
                    return;
                }

                const conf = enhanceModule.getConfig();
                if (!conf.apiKey) {
                    enhanceModule.showErrorModal("请先在 Antigravity-Power-Pro 中配置 apiKey 并设置模型");
                    return;
                }

                // 使用 innerText 并剔除零宽字符，确保提示词获取精准
                const text = readInputText(currentInput);
                if (!text) {
                    enhanceModule.showErrorModal("请先输入需要增强的提示词");
                    return;
                }

                try {
                    const enhanced = await enhanceModule.enhance(text);
                    const targetInput = resolveInput(input, currentRoot, text);
                    const success = targetInput
                        ? await enhanceModule.setInputValue(targetInput, enhanced)
                        : false;
                    
                    enhanceModule.showResultModal(
                      enhanced,
                      success ? () => {} : (res) => navigator.clipboard.writeText(res).catch(() => {})
                    );
                } catch (error) {
                    console.error("[Manager PromptEnhance] 增强失败:", error);
                    enhanceModule.showErrorModal(error.message);
                }
            });

            // 插入逻辑：采用动态邻近算法
            const findActionButton = () => {
              // 在整个根节点深层搜索原生按钮
              for (const selector of actionButtonSelectors) {
                const els = querySelectorAllDeep(selector, root);
                // 找到距离当前输入框最近的那个
                if (els.length > 0) {
                  // 优先返回在同一容器或邻近容器的
                  return els.find(el => input.closest('.relative')?.contains(el)) || els[0];
                }
              }
              return null;
            };

            const actionBtn = findActionButton();

            if (actionBtn && actionBtn.parentElement) {
                console.log("[Manager-Prompt] 找到原生按钮组，往右侧插入");
                // 插入到操作区的最后面，使其在所有按钮的最右边
                actionBtn.parentElement.appendChild(btn);
                btn.style.setProperty('position', 'relative', 'important');
                btn.style.setProperty('margin', '0 0 0 8px', 'important'); 
                btn.style.setProperty('flex-shrink', '0', 'important');
                btn.style.setProperty('left', 'auto', 'important');
                btn.style.setProperty('right', 'auto', 'important');
            } else {
                // 增强版容器查找逻辑：穿透 Shadow DOM 边界向上查找
                const findContainer = (el) => {
                    let curr = el;
                    while (curr) {
                        // 1. 优先查找具有布局能力的容器
                        if (curr.classList && (curr.classList.contains('relative') || curr.classList.contains('flex'))) {
                            return curr;
                        }
                        // 2. 向上移动：如果是 Shadow Root 转换到 Host
                        const next = curr.parentElement || (curr.parentNode instanceof ShadowRoot ? curr.parentNode.host : null);
                        if (!next || next === root) break;
                        curr = next;
                    }
                    return el.parentElement || root;
                };

                const container = findContainer(input);
                console.warn("[Manager-Prompt] 未找到原生按钮，使用容器挂载:", container);
                
                if (window.getComputedStyle(container).position === 'static') {
                    container.style.setProperty('position', 'relative', 'important');
                }
                container.style.setProperty('overflow', 'visible', 'important');

                btn.style.setProperty('position', 'absolute', 'important');
                btn.style.setProperty('right', '12px', 'important');
                btn.style.setProperty('bottom', '8px', 'important');
                btn.style.setProperty('z-index', '999', 'important');
                container.appendChild(btn);
            }
        } catch (e) {
            console.error("[Manager] 处理输入框失败:", e);
        }
    });
};
