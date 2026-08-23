<template>
  <section class="card" :class="{ 'is-disabled': !model.enabled }">
    <div class="card-header">
      <h2 class="card-title">侧边栏设置</h2>
      <label class="enable-toggle" @click.stop>
        <span class="toggle-label">启用补丁</span>
        <input type="checkbox" v-model="model.enabled" class="checkbox">
      </label>
    </div>
    
    <div class="feature-list">
      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">滚动到底部按钮</span>
          <p class="feature-desc">在 Cascade 面板添加一键滚动到底部按钮</p>
        </div>
        <input type="checkbox" v-model="model.scrollToBottom" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">Mermaid 图表预览</span>
          <p class="feature-desc">在 Cascade 面板自动将 Mermaid 代码块渲染为流程/时序图</p>
        </div>
        <input type="checkbox" v-model="model.mermaid" class="checkbox" :disabled="!model.enabled">
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">侧边栏字体大小</span>
          <p class="feature-desc">调整 Cascade 面板整体字体大小</p>
        </div>
        <div class="feature-controls">
          <input type="checkbox" v-model="model.fontSizeEnabled" class="checkbox" :disabled="!model.enabled">
          <input
            type="number"
            v-model.number="model.fontSize"
            class="font-size-input"
            min="10"
            max="40"
            step="1"
            :disabled="!model.enabled || !model.fontSizeEnabled"
          >
        </div>
      </label>

      <label class="feature-item" :class="{ 'item-disabled': !model.enabled }">
        <div class="feature-info">
          <span class="feature-name">侧边栏左右间距</span>
          <p class="feature-desc">覆盖 Cascade 面板内容区 px-4 的左右留白</p>
        </div>
        <div class="feature-controls">
          <span class="field-label">左</span>
          <input
            type="number"
            v-model.number="model.sidePaddingLeft"
            class="pixel-input"
            min="0"
            max="48"
            step="1"
            :disabled="!model.enabled"
          >
          <span class="field-label">右</span>
          <input
            type="number"
            v-model.number="model.sidePaddingRight"
            class="pixel-input"
            min="0"
            max="48"
            step="1"
            :disabled="!model.enabled"
          >
        </div>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
export interface FeatureFlags {
  enabled: boolean;
  scrollToBottom: boolean;
  mermaid: boolean;
  fontSizeEnabled: boolean;
  fontSize: number;
  sidePaddingLeft: number;
  sidePaddingRight: number;
}

const model = defineModel<FeatureFlags>({ required: true });
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
  cursor: pointer;
  padding: 8px 0;
  transition: opacity 0.2s;
}

.feature-item.item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feature-info { flex: 1; }

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

.feature-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  color: var(--ag-text-secondary);
}

.font-size-input,
.pixel-input {
  width: 64px;
  padding: 6px 8px;
  background: var(--ag-surface-2);
  border: 1px solid var(--ag-border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--ag-text);
  text-align: center;
}

.pixel-input {
  width: 56px;
}

.font-size-input:disabled,
.pixel-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
