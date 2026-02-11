<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import TitleBar from "./components/TitleBar.vue";
import PathCard from "./components/PathCard.vue";
import FeatureCard from "./components/FeatureCard.vue";
import ManagerFeatureCard from "./components/ManagerFeatureCard.vue";
import PromptEnhanceCard from "./components/PromptEnhanceCard.vue";
import AboutModal from "./components/AboutModal.vue";
import ConfirmModal from "./components/ConfirmModal.vue";

import { getVersion } from "@tauri-apps/api/app";

// 常量
const APP_VERSION = ref("");
const GITHUB_URL = "https://github.com/Huo-zai-feng-lang-li/Antigravity-Power-Pro";

const DEFAULT_SYSTEM_PROMPT = `你是一个智能提示词优化器，专门帮助用户生成更有效的 AI 对话提示词。

## 核心任务
将用户输入的原始提示词优化为更清晰、更具体、更有效的版本。

## 你会收到的信息
1. **对话上下文**：之前的对话历史（如果有）
2. **当前文件**：用户正在编辑的文件（如果有）
3. **选中代码**：用户选中的代码片段（如果有）
4. **用户原始提示词**：需要优化的内容

## 优化规则
1. **理解上下文**：仔细阅读对话历史，理解当前讨论的主题和背景
2. **保持连贯性**：优化后的提示词应该与之前的对话保持逻辑连贯
3. **具体化**：让模糊的问题变得具体，如果上下文中有相关信息就引用它
4. **结构化**：为复杂问题添加清晰的结构，使用 Markdown 列表
5. **保持意图**：不改变用户的原始意图，只是表达得更清晰
6. **保留格式**：必须使用 Markdown 格式（换行、列表、代码块），确保生成的提示词易于阅读

## 输出要求
- **只输出优化后的提示词**，不要任何解释、前缀或额外内容
- 保持用户使用的语言（中文/英文）
- 如果原始提示词是追问或继续之前的话题，保持这种连续性
- **关键**：确保输出包含必要的换行符，不要将长文本压缩成一行

## 示例

### 示例 1 - 无上下文
输入: hi
输出: 你好，请帮我解决一个问题。我会详细描述需求，请提供完整的解决方案。

### 示例 2 - 有上下文（之前讨论了一个 bug）
对话历史: [用户问了如何修复登录 bug，AI 提供了方案]
输入: 还有问题
输出: 按照你之前提供的登录 bug 修复方案，我尝试后发现仍有问题。请帮我进一步排查，可能是哪些原因导致的？

### 示例 3 - 引用代码
选中代码: function getData() { ... }
输入: 优化这个
输出: 请帮我优化上面选中的 getData 函数。具体需要：
1. 提高性能
2. 改进可读性
3. 添加错误处理

请解释每处修改的原因。

记住：直接输出优化后的提示词，不要任何其他内容。`;

// Tab 切换
const activeTab = ref<"antigravity" | "windsurf">("antigravity");

// 补丁文件清单
const PATCH_FILES = {
  // 将被修改的原始文件
  modified: ["cascade-panel.html", "workbench-jetski-agent.html"],
  // 将添加的新文件/目录
  added: ["cascade-panel/  (侧边栏模块)", "manager-panel/  (Manager模块)"],
  // 废弃文件（旧版本遗留，新版本不再使用）
  deprecated: [] as string[],
};

// 状态
const antigravityPath = ref<string | null>(null);
const isDetecting = ref(false);
const isInstalled = ref(false);
const showAbout = ref(false);
const showConfirm = ref(false);

// 侧边栏功能开关
const features = ref({
  enabled: true,
  mermaid: true,
  math: true,
  copyButton: true,
  tableColor: true,
  fontSizeEnabled: true,
  fontSize: 20,
  promptEnhance: {
    enabled: false,
    provider: "anthropic",
    apiBase: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-sonnet-4-5-20250514",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
});

// ============================================
// Windsurf IDE 状态
// ============================================
const windsurfPath = ref<string | null>(null);
const isDetectingWindsurf = ref(false);
const isWindsurfInstalled = ref(false);
const showWindsurfConfirm = ref(false);

const windsurfFeatures = ref({
  promptEnhance: {
    enabled: false,
    provider: "anthropic",
    apiBase: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-sonnet-4-5-20250514",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  },
});

const WINDSURF_PATCH_FILES = {
  modified: ["workbench.html"],
  added: ["windsurf-panel/  (字体+提示词增强)"],
  deprecated: [] as string[],
};

// Manager 功能开关（独立配置，默认禁用）
const managerFeatures = ref({
  enabled: false,
  mermaid: false,
  math: false,
  copyButton: true,
  maxWidthEnabled: false,
  maxWidthRatio: 75,
  fontSizeEnabled: false,
  fontSize: 16,
});

// ============================================
// Windsurf 操作函数
// ============================================
async function detectWindsurfPath() {
  isDetectingWindsurf.value = true;
  try {
    const path = await invoke<string | null>("detect_windsurf_path");
    windsurfPath.value = path;
    if (path) {
      await checkWindsurfPatchStatus(path);
    }
  } catch (e) {
    console.error("Windsurf 检测失败:", e);
  } finally {
    isDetectingWindsurf.value = false;
  }
}

async function checkWindsurfPatchStatus(path: string) {
  try {
    isWindsurfInstalled.value = await invoke<boolean>("check_windsurf_patch_status", { path });
    if (isWindsurfInstalled.value) {
      const config = await invoke<any>("read_windsurf_patch_config", { path });
      if (config) {
        const merged = { ...windsurfFeatures.value, ...config };
        if (config.promptEnhance) {
          merged.promptEnhance = { ...windsurfFeatures.value.promptEnhance, ...config.promptEnhance };
          if (!merged.promptEnhance.systemPrompt) {
            merged.promptEnhance.systemPrompt = DEFAULT_SYSTEM_PROMPT;
          }
        }
        windsurfFeatures.value = merged;
      }
    }
  } catch (e) {
    console.error("Windsurf 补丁状态检测失败:", e);
  }
}

async function browseWindsurfPath() {
  try {
    const selected = await open({
      directory: true,
      title: "选择 Windsurf 安装目录",
    });
    if (selected) {
      windsurfPath.value = selected as string;
    }
  } catch (e) {
    console.error("选择目录失败:", e);
  }
}

function requestWindsurfInstall() {
  if (!windsurfPath.value) return;
  showWindsurfConfirm.value = true;
}

async function confirmWindsurfInstall() {
  showWindsurfConfirm.value = false;
  if (!windsurfPath.value) return;
  try {
    await invoke("install_windsurf_patch", {
      path: windsurfPath.value,
      features: windsurfFeatures.value,
    });
    isWindsurfInstalled.value = true;
    showToast("✓ Windsurf 补丁安装成功");
  } catch (e) {
    console.error("Windsurf 安装失败:", e);
    showToast("✗ Windsurf 安装失败: " + e);
  }
}

async function uninstallWindsurfPatch() {
  if (!windsurfPath.value) return;
  try {
    await invoke("uninstall_windsurf_patch", { path: windsurfPath.value });
    isWindsurfInstalled.value = false;
    showToast("✓ Windsurf 已恢复原版");
  } catch (e) {
    console.error("Windsurf 卸载失败:", e);
    showToast("✗ Windsurf 恢复失败");
  }
}

async function updateWindsurfConfigOnly() {
  if (!windsurfPath.value) return;
  try {
    await invoke("update_windsurf_config", {
      path: windsurfPath.value,
      features: windsurfFeatures.value,
    });
    showToast("✓ Windsurf 配置已更新");
  } catch (e) {
    console.error("Windsurf 更新配置失败:", e);
    showToast("✗ Windsurf 更新失败");
  }
}

// ============================================
// Antigravity 操作函数
// ============================================

// 检测 Antigravity 安装路径
async function detectPath() {
  isDetecting.value = true;
  try {
    const path = await invoke<string | null>("detect_antigravity_path");
    antigravityPath.value = path;
    if (path) {
      await checkPatchStatus(path);
    }
  } catch (e) {
    console.error("检测失败:", e);
  } finally {
    isDetecting.value = false;
  }
}

// 检测补丁状态和读取配置
async function checkPatchStatus(path: string) {
  try {
    isInstalled.value = await invoke<boolean>("check_patch_status", { path });
    if (isInstalled.value) {
      // 读取侧边栏配置
      const config = await invoke<{
        mermaid: boolean;
        math: boolean;
        copyButton: boolean;
        tableColor: boolean;
        fontSizeEnabled?: boolean;
        fontSize?: number;
      } | null>("read_patch_config", { path });
      if (config) {
        const merged = { ...features.value, ...config };
        if ((config as any).promptEnhance) {
          merged.promptEnhance = { ...features.value.promptEnhance, ...(config as any).promptEnhance };
          if (!merged.promptEnhance.systemPrompt) {
            merged.promptEnhance.systemPrompt = DEFAULT_SYSTEM_PROMPT;
          }
        }
        features.value = merged;
      }

      // 读取 Manager 配置
      const managerConfig = await invoke<{
        mermaid: boolean;
        math: boolean;
        copyButton: boolean;
        maxWidthEnabled?: boolean;
        maxWidthRatio?: number;
        fontSizeEnabled?: boolean;
        fontSize?: number;
      } | null>("read_manager_patch_config", { path });
      if (managerConfig) {
        managerFeatures.value = {
          ...managerFeatures.value,
          ...managerConfig,
          enabled: true,
        };
      }
    }
  } catch (e) {
    console.error("检测补丁状态失败:", e);
  }
}

// 手动选择路径
async function browsePath() {
  try {
    const selected = await open({
      directory: true,
      title: "选择 Antigravity 安装目录",
    });
    if (selected) {
      antigravityPath.value = selected as string;
    }
  } catch (e) {
    console.error("选择目录失败:", e);
  }
}

// 请求安装（显示确认弹窗）
function requestInstall() {
  if (!antigravityPath.value) return;
  showConfirm.value = true;
}

// 确认安装
async function confirmInstall() {
  showConfirm.value = false;
  if (!antigravityPath.value) return;
  try {
    await invoke("install_patch", {
      path: antigravityPath.value,
      features: features.value,
      managerFeatures: managerFeatures.value,
    });
    isInstalled.value = true;
    showToast("✓ 补丁安装成功");
  } catch (e) {
    console.error("安装失败:", e);
    showToast("✗ 安装失败");
  }
}

// 卸载补丁
async function uninstallPatch() {
  if (!antigravityPath.value) return;
  try {
    await invoke("uninstall_patch", { path: antigravityPath.value });
    isInstalled.value = false;
    showToast("✓ 已恢复原版");
  } catch (e) {
    console.error("卸载失败:", e);
    showToast("✗ 恢复失败");
  }
}

// Toast 提示
const toastMessage = ref("");
const showToastFlag = ref(false);

function showToast(message: string) {
  toastMessage.value = message;
  showToastFlag.value = true;
  setTimeout(() => {
    showToastFlag.value = false;
  }, 3000);
}

// 仅更新配置
async function updateConfigOnly() {
  if (!antigravityPath.value) return;
  try {
    await invoke("update_config", {
      path: antigravityPath.value,
      features: features.value,
      managerFeatures: managerFeatures.value,
    });
    showToast("✓ 配置已更新");
  } catch (e) {
    console.error("更新配置失败:", e);
    showToast("✗ 更新失败");
  }
}

onMounted(async () => {
  APP_VERSION.value = await getVersion();
  detectPath();
  detectWindsurfPath();
});
</script>

<template>
  <div class="app-wrapper">
    <TitleBar title="Antigravity-Power-Pro" @openAbout="showAbout = true" />

    <main class="app-container">
      <!-- Tab 导航 -->
      <nav class="tab-nav">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'antigravity' }"
          @click="activeTab = 'antigravity'"
        >
          Antigravity
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'windsurf' }"
          @click="activeTab = 'windsurf'"
        >
          Windsurf
        </button>
      </nav>

      <!-- Antigravity 面板 -->
      <div v-show="activeTab === 'antigravity'" class="tab-panel">
        <PathCard
          v-model="antigravityPath"
          :isDetecting="isDetecting"
          @detect="detectPath"
          @browse="browsePath"
        />

        <FeatureCard v-model="features" />

        <ManagerFeatureCard v-model="managerFeatures" />

        <PromptEnhanceCard v-model="features.promptEnhance" />

        <section class="actions">
          <button
            @click="requestInstall"
            :disabled="!antigravityPath"
            class="primary-btn"
          >
            {{ isInstalled ? "重新安装" : "安装补丁" }}
          </button>

          <button
            @click="updateConfigOnly"
            :disabled="!antigravityPath"
            class="secondary-btn"
            title="仅更新功能开关配置，不重新复制补丁文件"
          >
            更新配置
          </button>

          <button
            @click="uninstallPatch"
            :disabled="!antigravityPath"
            class="secondary-btn danger"
          >
            恢复原版
          </button>
        </section>
      </div>

      <!-- Windsurf 面板 -->
      <div v-show="activeTab === 'windsurf'" class="tab-panel">
        <PathCard
          v-model="windsurfPath"
          :isDetecting="isDetectingWindsurf"
          @detect="detectWindsurfPath"
          @browse="browseWindsurfPath"
        />

        <PromptEnhanceCard
          v-if="windsurfPath"
          v-model="windsurfFeatures.promptEnhance"
        />

        <section v-if="windsurfPath" class="actions">
          <button
            @click="requestWindsurfInstall"
            :disabled="!windsurfPath"
            class="primary-btn windsurf-btn"
          >
            {{ isWindsurfInstalled ? "重新安装" : "安装补丁" }}
          </button>

          <button
            @click="updateWindsurfConfigOnly"
            :disabled="!windsurfPath"
            class="secondary-btn"
            title="仅更新 Windsurf 配置"
          >
            更新配置
          </button>

          <button
            @click="uninstallWindsurfPatch"
            :disabled="!windsurfPath"
            class="secondary-btn danger"
          >
            恢复原版
          </button>
        </section>
      </div>

      <footer class="footer">
        <p>
          v{{ APP_VERSION }} ·
          <a :href="GITHUB_URL" target="_blank" class="link">GitHub</a>
        </p>
      </footer>
    </main>

    <AboutModal
      :show="showAbout"
      :version="APP_VERSION"
      :githubUrl="GITHUB_URL"
      @close="showAbout = false"
    />

    <ConfirmModal
      :show="showConfirm"
      title="确认安装补丁"
      message="即将安装 Antigravity-Power-Pro 补丁，请确认以下文件变更："
      :modifiedFiles="PATCH_FILES.modified"
      :addedFiles="PATCH_FILES.added"
      :deprecatedFiles="PATCH_FILES.deprecated"
      @confirm="confirmInstall"
      @cancel="showConfirm = false"
    />

    <ConfirmModal
      :show="showWindsurfConfirm"
      title="确认安装 Windsurf 补丁"
      message="即将安装 Windsurf 增强补丁，请确认以下文件变更："
      :modifiedFiles="WINDSURF_PATCH_FILES.modified"
      :addedFiles="WINDSURF_PATCH_FILES.added"
      :deprecatedFiles="WINDSURF_PATCH_FILES.deprecated"
      @confirm="confirmWindsurfInstall"
      @cancel="showWindsurfConfirm = false"
    />

    <!-- Toast 提示 -->
    <Transition name="toast">
      <div v-if="showToastFlag" class="toast">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--ag-bg);
  color: var(--ag-text);
  overflow: hidden;
}

.app-container {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  min-height: 0; /* 关键：允许 flex 子项收缩 */
}

.actions {
  display: flex;
  gap: 16px;
}

.primary-btn {
  flex: 1;
  padding: 14px 24px;
  background: var(--ag-accent);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.primary-btn:hover:not(:disabled) {
  background: var(--ag-accent-hover);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  padding: 14px 24px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  color: var(--ag-text);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.secondary-btn:hover:not(:disabled) {
  background: var(--ag-border);
}

.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.footer {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--ag-text-secondary);
}

.link {
  color: var(--ag-accent);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* Tab 导航 */
.tab-nav {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: var(--ag-surface-2);
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ag-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.3px;
}

.tab-btn:hover:not(.active) {
  color: var(--ag-text);
  background: rgba(255, 255, 255, 0.04);
}

.tab-btn.active {
  background: var(--ag-surface);
  color: var(--ag-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.tab-panel {
  min-height: 0;
}

/* Windsurf 功能卡片 */
.card {
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--ag-text);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  cursor: pointer;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.slider-label {
  font-size: 13px;
  color: var(--ag-text-secondary);
  min-width: 42px;
  text-align: right;
}

.slider {
  flex: 1;
  accent-color: var(--ag-accent);
}

.windsurf-btn {
  background: #0ea5e9;
}

.windsurf-btn:hover:not(:disabled) {
  background: #0284c7;
}

/* Toast 提示样式 */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ag-surface);
  border: 1px solid var(--ag-border);
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  color: var(--ag-text);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
