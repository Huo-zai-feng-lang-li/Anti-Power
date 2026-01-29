<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header">
      <h2 class="card-title">提示词增强</h2>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">启用</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox" />
      </label>
    </div>

    <div class="feature-list">
      <!-- Provider Selection -->
      <div class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">服务商</span>
          <p class="feature-desc">选择 LLM 服务提供商</p>
        </div>
        <select
          v-model="selectedProvider"
          class="select-input"
          :disabled="!model.enabled"
          @change="onProviderChange"
        >
          <option value="custom">自定义</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
          <option value="moonshot">月之暗面 (Kimi)</option>
          <option value="zhipu">智谱 AI (GLM)</option>
          <option value="siliconflow">硅基流动</option>
        </select>
      </div>

      <!-- API Base URL -->
      <div class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">API 地址</span>
          <p class="feature-desc">
            {{ providerInfo.hint || "LLM API 的 Base URL" }}
          </p>
        </div>
        <input
          type="text"
          v-model="model.apiBase"
          class="text-input"
          :placeholder="providerInfo.apiBase"
          :disabled="!model.enabled"
        />
      </div>

      <!-- API Key -->
      <div class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">API Key</span>
          <p class="feature-desc">你的 API 密钥 (本地存储, 不会上传)</p>
        </div>
        <div class="key-input-wrapper">
          <input
            :type="showApiKey ? 'text' : 'password'"
            v-model="model.apiKey"
            class="text-input key-input"
            :placeholder="providerInfo.keyPlaceholder || 'sk-...'"
            :disabled="!model.enabled"
          />
          <button
            class="toggle-visibility"
            @click="showApiKey = !showApiKey"
            :disabled="!model.enabled"
            type="button"
          >
            {{ showApiKey ? "🔒" : "👁️" }}
          </button>
        </div>
      </div>

      <!-- Model -->
      <div class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">模型</span>
          <p class="feature-desc">
            {{ providerInfo.modelHint || "使用的模型名称" }}
          </p>
        </div>
        <select
          v-if="providerInfo.models && providerInfo.models.length > 0"
          v-model="model.model"
          class="select-input model-select"
          :disabled="!model.enabled"
        >
          <option
            v-for="m in providerInfo.models"
            :key="m.value"
            :value="m.value"
          >
            {{ m.label }}
          </option>
        </select>
        <input
          v-else
          type="text"
          v-model="model.model"
          class="text-input model-input"
          :placeholder="providerInfo.defaultModel || 'gpt-4o-mini'"
          :disabled="!model.enabled"
        />
      </div>

      <!-- System Prompt -->
      <div
        class="feature-item prompt-item"
        :class="{ 'item-disabled': !model.enabled }"
      >
        <div class="feature-info">
          <span class="feature-name">系统提示词</span>
          <p class="feature-desc">用于增强的系统指令 (可选, 留空使用默认)</p>
        </div>
        <textarea
          v-model="model.systemPrompt"
          class="textarea-input"
          placeholder="你是一个提示词优化专家，帮助用户优化他们的提示词，使其更加清晰、具体、有效..."
          :disabled="!model.enabled"
          rows="3"
        ></textarea>
      </div>

      <!-- Test Connection Button -->
      <div class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">连接测试</span>
          <p class="feature-desc">测试 API 配置是否正确</p>
        </div>
        <button
          class="test-btn"
          @click="testConnection"
          :disabled="!model.enabled || isTesting"
        >
          {{ isTesting ? "测试中..." : "测试连接" }}
        </button>
      </div>

      <!-- Test Result -->
      <div
        v-if="testResult"
        class="test-result"
        :class="testResult.success ? 'success' : 'error'"
      >
        {{ testResult.message }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

export interface PromptEnhanceConfig {
  enabled: boolean;
  provider: string;
  apiBase: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
}

interface ProviderInfo {
  apiBase: string;
  defaultModel: string;
  hint?: string;
  keyPlaceholder?: string;
  modelHint?: string;
  models?: { label: string; value: string }[];
}

const PROVIDERS: Record<string, ProviderInfo> = {
  anthropic: {
    apiBase: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-5-20250514",
    hint: "Anthropic Claude API",
    keyPlaceholder: "sk-ant-...",
    modelHint: "Claude 4.5 系列",
    models: [
      { label: "Claude Sonnet 4.5 (推荐)", value: "claude-sonnet-4-5-20250514" },
      { label: "Claude Haiku 4.5 (快速)", value: "claude-haiku-4-5-20250514" },
    ],
  },
  openai: {
    apiBase: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    hint: "OpenAI ChatGPT API",
    keyPlaceholder: "sk-...",
    modelHint: "推荐 gpt-4o-mini (性价比高)",
    models: [
      { label: "GPT-4o Mini (推荐)", value: "gpt-4o-mini" },
      { label: "GPT-4o", value: "gpt-4o" },
      { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
      { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    ],
  },
  deepseek: {
    apiBase: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    hint: "DeepSeek API (国产, 便宜)",
    keyPlaceholder: "sk-...",
    modelHint: "deepseek-chat 或 deepseek-reasoner",
    models: [
      { label: "DeepSeek Chat", value: "deepseek-chat" },
      { label: "DeepSeek Reasoner (R1)", value: "deepseek-reasoner" },
    ],
  },
  moonshot: {
    apiBase: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    hint: "月之暗面 Kimi API",
    keyPlaceholder: "sk-...",
    models: [
      { label: "Moonshot 8K", value: "moonshot-v1-8k" },
      { label: "Moonshot 32K", value: "moonshot-v1-32k" },
      { label: "Moonshot 128K", value: "moonshot-v1-128k" },
    ],
  },
  zhipu: {
    apiBase: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    hint: "智谱 AI GLM 系列",
    keyPlaceholder: "API Key",
    models: [
      { label: "GLM-4 Flash (免费)", value: "glm-4-flash" },
      { label: "GLM-4 Air", value: "glm-4-air" },
      { label: "GLM-4", value: "glm-4" },
    ],
  },
  siliconflow: {
    apiBase: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    hint: "硅基流动 (多模型聚合)",
    keyPlaceholder: "sk-...",
    models: [
      { label: "Qwen2.5-7B (免费)", value: "Qwen/Qwen2.5-7B-Instruct" },
      { label: "DeepSeek-V3", value: "deepseek-ai/DeepSeek-V3" },
      { label: "GLM-4-9B", value: "THUDM/glm-4-9b-chat" },
    ],
  },
  custom: {
    apiBase: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    hint: "自定义 OpenAI 兼容 API",
    keyPlaceholder: "API Key",
  },
};

const model = defineModel<PromptEnhanceConfig>({ required: true });

const selectedProvider = ref(model.value.provider || "anthropic");
const showApiKey = ref(false);
const isTesting = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const providerInfo = computed(
  () => PROVIDERS[selectedProvider.value] || PROVIDERS.custom,
);

// 初始化时同步 provider
watch(
  () => model.value.provider,
  (newVal) => {
    if (newVal && newVal !== selectedProvider.value) {
      selectedProvider.value = newVal;
    }
  },
  { immediate: true },
);

function onProviderChange() {
  const info = PROVIDERS[selectedProvider.value];
  if (info) {
    model.value.provider = selectedProvider.value;
    model.value.apiBase = info.apiBase;
    model.value.model = info.defaultModel;
  }
}

async function testConnection() {
  if (!model.value.apiBase || !model.value.apiKey || !model.value.model) {
    testResult.value = { success: false, message: "请填写完整的 API 配置" };
    return;
  }

  isTesting.value = true;
  testResult.value = null;

  try {
    let response: Response;

    // Anthropic 使用不同的 API 格式
    if (
      selectedProvider.value === "anthropic" ||
      model.value.apiBase.includes("anthropic")
    ) {
      response = await fetch(`${model.value.apiBase}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": model.value.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model.value.model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
    } else {
      // OpenAI 兼容格式
      response = await fetch(`${model.value.apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${model.value.apiKey}`,
        },
        body: JSON.stringify({
          model: model.value.model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10,
        }),
      });
    }

    if (response.ok) {
      testResult.value = { success: true, message: "✓ 连接成功!" };
    } else {
      const errorData = await response.json().catch(() => ({}));
      testResult.value = {
        success: false,
        message: `✗ 连接失败: ${errorData.error?.message || response.statusText}`,
      };
    }
  } catch (error: any) {
    testResult.value = {
      success: false,
      message: `✗ 网络错误: ${error.message}`,
    };
  } finally {
    isTesting.value = false;
  }
}
</script>

<style scoped>
.card {
  background: var(--ag-surface);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid var(--ag-border);
  transition: opacity 0.2s;
}

.card.is-disabled {
  opacity: 0.6;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--ag-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.enable-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-label {
  font-size: 12px;
  color: var(--ag-text-secondary);
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  transition: opacity 0.2s;
  gap: 16px;
}

.feature-item.prompt-item {
  flex-direction: column;
  align-items: stretch;
}

.feature-item.item-disabled {
  opacity: 0.5;
}

.feature-info {
  flex: 1;
  min-width: 0;
}

.feature-name {
  font-size: 14px;
  font-weight: 400;
}

.feature-desc {
  font-size: 12px;
  color: var(--ag-text-secondary);
  margin: 2px 0 0;
}

.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--ag-accent);
  cursor: pointer;
}

.checkbox:disabled {
  cursor: not-allowed;
}

.text-input,
.select-input {
  flex-shrink: 0;
  width: 220px;
  padding: 8px 12px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text);
}

.select-input {
  cursor: pointer;
}

.model-select {
  width: 180px;
}

.text-input:disabled,
.select-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-input:focus,
.select-input:focus {
  outline: none;
  border-color: var(--ag-accent);
}

.model-input {
  width: 150px;
}

.key-input-wrapper {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.key-input {
  width: 180px;
}

.toggle-visibility {
  padding: 8px 10px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}

.toggle-visibility:hover:not(:disabled) {
  background: var(--ag-border);
}

.toggle-visibility:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea-input {
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text);
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.textarea-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea-input:focus {
  outline: none;
  border-color: var(--ag-accent);
}

.test-btn {
  padding: 8px 16px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text);
  cursor: pointer;
  transition: all 0.15s;
}

.test-btn:hover:not(:disabled) {
  background: var(--ag-accent);
  border-color: var(--ag-accent);
  color: white;
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-result {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
}

.test-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
