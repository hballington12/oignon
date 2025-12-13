<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()
const query = ref('10.1007/BF02834980')

const emit = defineEmits<{
  search: [query: string]
}>()

function triggerPendingBuild() {
  if (store.pendingBuildId) {
    query.value = store.pendingBuildId
    setTimeout(() => {
      handleSubmit()
      store.clearPendingBuild()
    }, 100)
  }
}

// Watch for external build requests (from Build button in details panel)
watch(() => store.pendingBuildId, triggerPendingBuild)

// Also check on mount in case the pending build was set before we mounted
onMounted(triggerPendingBuild)

function handleSubmit() {
  if (!query.value.trim()) return
  emit('search', query.value.trim())
}
</script>

<template>
  <div id="search-content" class="search-content">
    <form id="search-form" class="search-form" @submit.prevent="handleSubmit">
      <input
        v-model="query"
        type="text"
        class="search-input"
        placeholder="DOI or OpenAlex ID"
        :disabled="store.loading"
      />
      <div class="btn-wrapper" :class="{ loading: store.loading }">
        <div
          v-if="store.loading && store.loadingProgress"
          class="progress-ring"
          :style="{ '--progress': store.loadingProgress.percent + '%' }"
        ></div>
        <button type="submit" class="search-btn" :disabled="store.loading || !query.trim()">
          {{ store.loading ? 'Building...' : 'Build' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
@property --progress {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.search-content {
  padding: var(--spacing-md);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.search-form {
  display: flex;
  gap: var(--spacing-sm);
  width: 100%;
}

.search-input {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-medium);
  border-radius: var(--btn-radius);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-family: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.search-input::placeholder {
  color: var(--text-placeholder);
}

.search-input:focus {
  border-color: var(--border-focus);
  background: var(--bg-input-focus);
}

.btn-wrapper {
  position: relative;
  display: inline-flex;
}

.progress-ring {
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--btn-radius) + 3px);
  background: conic-gradient(
    from -90deg,
    var(--progress-fill) var(--progress),
    transparent var(--progress)
  );
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  padding: 3px;
  pointer-events: none;
  box-shadow: var(--shadow-glow-green);
  transition: --progress var(--transition-smooth);
}

.search-btn {
  padding: 10px 16px;
  background: var(--btn-bg);
  border: 1px solid var(--btn-border);
  border-radius: var(--btn-radius);
  color: var(--text-secondary);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.search-btn:active:not(:disabled) {
  background: var(--btn-bg-active);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-wrapper.loading .search-btn {
  border-color: transparent;
}
</style>
