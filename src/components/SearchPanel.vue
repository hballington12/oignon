<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()
const query = ref('')
const isOpen = ref(true)

const emit = defineEmits<{
  search: [query: string]
}>()

// Watch for external build requests (from Build button in details panel)
watch(
  () => store.pendingBuildId,
  (newId) => {
    if (newId) {
      query.value = newId
      isOpen.value = true
      // Small delay to ensure panel is visible before submitting
      setTimeout(() => {
        handleSubmit()
        store.clearPendingBuild()
      }, 100)
    }
  },
)

function handleSubmit() {
  if (!query.value.trim()) return
  emit('search', query.value.trim())
}

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="search-panel-container">
    <div class="search-panel-wrapper">
      <div class="search-panel" :class="{ collapsed: !isOpen }">
        <div class="panel-header">Search</div>

        <div class="panel-section">
          <div class="panel-section-title">Paper Lookup</div>

          <form @submit.prevent="handleSubmit">
            <input
              v-model="query"
              type="text"
              class="search-input"
              placeholder="DOI or OpenAlex ID"
              :disabled="store.loading"
            />

            <div class="search-actions">
              <button type="submit" class="search-btn" :disabled="store.loading || !query.trim()">
                {{ store.loading ? 'Building...' : 'Build' }}
              </button>
              <button v-if="store.loading" type="button" class="cancel-btn">Cancel</button>
            </div>
          </form>

          <div v-if="store.loadingProgress" class="search-progress">
            <div
              class="search-progress-bar"
              :style="{ width: store.loadingProgress.percent + '%' }"
            ></div>
          </div>

          <div v-if="store.loadingProgress" class="search-status">
            {{ store.loadingProgress.message }}
          </div>
        </div>
      </div>

      <button
        class="toggle-btn"
        :class="{ collapsed: !isOpen }"
        @click="toggle"
        :title="isOpen ? 'Collapse' : 'Expand'"
      >
        <span class="arrow" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-panel-container {
  position: absolute;
  top: var(--spacing-xl);
  left: var(--spacing-xl);
  z-index: var(--z-panel);
}

.search-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

.search-panel {
  width: 260px;
  min-width: 260px;
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  border-radius: var(--panel-radius);
  border: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  transition:
    width var(--transition-smooth),
    min-width var(--transition-smooth),
    opacity var(--transition-smooth),
    border-color var(--transition-smooth);
  overflow: hidden;
}

.search-panel.collapsed {
  width: 0;
  min-width: 0;
  opacity: 0;
  border-color: transparent;
  pointer-events: none;
}

.panel-header {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  white-space: nowrap;
}

.panel-section {
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  white-space: nowrap;
}

.panel-section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--spacing-sm);
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: var(--btn-radius);
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-family: inherit;
  outline: none;
  transition: all var(--transition-fast);
  margin-bottom: var(--spacing-sm);
}

.search-input::placeholder {
  color: var(--text-placeholder);
}

.search-input:focus {
  border-color: var(--border-focus);
  background: var(--bg-input-focus);
}

.search-input:-webkit-autofill,
.search-input:-webkit-autofill:hover,
.search-input:-webkit-autofill:focus,
.search-input:-webkit-autofill:active {
  -webkit-text-fill-color: white !important;
  -webkit-box-shadow: 0 0 0 30px var(--bg-container) inset !important;
  caret-color: white;
}

.search-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.search-btn {
  flex: 1;
  padding: 8px 16px;
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.search-btn:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  border-color: var(--btn-border-hover);
}

.search-btn:active:not(:disabled) {
  background: var(--btn-bg-active);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--text-muted);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.cancel-btn:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.4);
  color: var(--accent-red);
}

.search-progress {
  height: var(--progress-height);
  background: var(--progress-bg);
  border-radius: 2px;
  margin-top: var(--spacing-sm);
  overflow: hidden;
}

.search-progress-bar {
  height: 100%;
  width: 0%;
  background: var(--progress-fill);
  border-radius: 2px;
  transition: width var(--transition-smooth);
  box-shadow: var(--shadow-glow-green);
}

.search-status {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-sm);
  color: var(--text-dim);
  line-height: 1.4;
}

/* Toggle button - anchored to panel */
.toggle-btn {
  width: var(--toggle-size);
  height: var(--toggle-size);
  border: 1px solid var(--panel-border);
  border-radius: var(--control-btn-radius);
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  color: var(--text-primary);
}

.toggle-btn .arrow {
  display: block;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(135deg);
  transition: transform var(--transition-smooth);
  margin-right: -2px;
}

.toggle-btn.collapsed .arrow {
  transform: rotate(-45deg);
  margin-right: 2px;
}
</style>
