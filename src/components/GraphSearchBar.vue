<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useGraphSearch } from '@/composables/useGraphSearch'

const props = defineProps<{
  colormapColor?: string
}>()

const emit = defineEmits<{
  selectNode: [id: string]
  close: []
}>()

const containerStyle = computed(() => ({
  '--bg-colormap': props.colormapColor || '#000000',
}))

const {
  query,
  results,
  selectedIndex,
  selectedResult,
  hasResults,
  nextResult,
  prevResult,
  close,
  search,
} = useGraphSearch()

const inputRef = ref<HTMLInputElement | null>(null)

// Focus input when mounted
nextTick(() => {
  inputRef.value?.focus()
})

// Debounced search
const debouncedSearch = useDebounceFn(search, 200)

function onInput() {
  debouncedSearch()
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    emit('close')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    nextResult()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    prevResult()
  } else if (e.key === 'Enter' && selectedResult.value) {
    e.preventDefault()
    emit('selectNode', selectedResult.value.id)
  }
}

function handleResultClick(nodeId: string) {
  emit('selectNode', nodeId)
}

function handleClose() {
  close()
  emit('close')
}
</script>

<template>
  <div class="graph-search-overlay" :style="containerStyle" @click.self="handleClose">
    <div class="search-container">
      <div class="search-input-row">
        <svg
          class="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="search-input"
          placeholder="Search in graph..."
          @input="onInput"
          @keydown="handleKeyDown"
        />
        <button class="close-btn" @click="handleClose">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Results dropdown hidden for now - nodes highlight directly on canvas -->
      <div v-if="hasResults" class="results-footer">
        <span class="results-count"
          >{{ results.length }} match{{ results.length === 1 ? '' : 'es' }}</span
        >
        <span class="nav-hint">Esc to close</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-search-overlay {
  --overlay-subtle: rgba(255, 255, 255, 0.1);
  --overlay-border: rgba(255, 255, 255, 0.15);
  --overlay-hover: rgba(255, 255, 255, 0.2);
  --panel-opacity: 70%;
  --panel-bg: color-mix(in srgb, var(--bg-colormap) var(--panel-opacity), transparent);

  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg);
  padding-top: calc(var(--spacing-lg) + env(safe-area-inset-top));
  z-index: 100;
  pointer-events: none;
}

.search-container {
  width: 100%;
  max-width: 480px;
  background: var(--panel-bg);
  border: 1px solid var(--overlay-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
  pointer-events: auto;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--overlay-subtle);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  padding: var(--spacing-xs) 0;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--overlay-hover);
}

.results-list {
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--overlay-subtle);
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover,
.result-item.selected {
  background: var(--overlay-subtle);
}

.result-item.selected {
  background: var(--overlay-hover);
}

.result-title {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-authors {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.no-results {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.results-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--overlay-subtle);
  border-top: 1px solid var(--overlay-subtle);
}

.results-count {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.nav-hint {
  color: var(--text-faint);
  font-size: var(--font-size-xs);
}
</style>
