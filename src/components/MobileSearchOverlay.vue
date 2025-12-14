<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchAutocomplete, type AutocompleteResult } from '@/lib/graph/openAlexApi'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()

const props = defineProps<{
  open: boolean
  colormapColor?: string
}>()

const emit = defineEmits<{
  close: []
  build: [id: string]
}>()

const query = ref('')
const results = ref<AutocompleteResult[]>([])
const loading = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const selectedPaper = ref<AutocompleteResult | null>(null)

// Show building screen when store is loading
const isBuilding = computed(() => store.loading)

// Pass colormap color as CSS variable for Teleport
const overlayStyle = computed(() => ({
  '--bg-colormap': props.colormapColor || '#000000',
}))
const buildProgress = computed(() => store.loadingProgress)

// Focus input when overlay opens
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      query.value = ''
      results.value = []
      selectedPaper.value = null
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

// Close overlay when build completes
watch(
  () => store.loading,
  (loading, wasLoading) => {
    if (wasLoading && !loading && props.open) {
      emit('close')
    }
  },
)

// Handle Escape key to close overlay
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && !isBuilding.value) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

const searchPapers = useDebounceFn(async (q: string) => {
  if (!q || q.length === 0) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    const data = await fetchAutocomplete(q)
    results.value = data.slice(0, 6) // Show max 6 results
  } catch (e) {
    console.error('Search error:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}, 300)

function onInput() {
  if (query.value.length > 0) {
    loading.value = true
  }
  searchPapers(query.value)
}

function onSelect(result: AutocompleteResult) {
  selectedPaper.value = result
  emit('build', result.id)
}

function onBackdropClick(e: MouseEvent) {
  // Don't close while building
  if (isBuilding.value) return
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

function clearQuery() {
  query.value = ''
  results.value = []
  inputRef.value?.focus()
}

function formatCitations(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k'
  }
  return String(count)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="open" class="search-overlay" :style="overlayStyle" @click="onBackdropClick">
        <!-- Building state -->
        <div v-if="isBuilding" class="building-container">
          <div class="building-card">
            <div class="building-spinner" />
            <div class="building-title">Building graph</div>
            <div v-if="selectedPaper" class="building-paper">
              {{ selectedPaper.display_name }}
            </div>
            <div v-if="buildProgress" class="building-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: buildProgress.percent + '%' }" />
              </div>
              <div class="progress-message">{{ buildProgress.message }}</div>
            </div>
          </div>
        </div>

        <!-- Search state -->
        <div v-else class="search-container">
          <!-- Search input -->
          <div class="search-bar">
            <svg
              class="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="search-input"
              placeholder="Search papers..."
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @input="onInput"
            />
            <button v-if="query" class="clear-btn" @click="clearQuery" aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Results list -->
          <div class="results-container">
            <!-- Loading state -->
            <div v-if="loading && results.length === 0" class="results-status">
              <div class="spinner" />
              <span>Searching...</span>
            </div>

            <!-- Results -->
            <div v-else-if="results.length > 0" class="results-list">
              <button
                v-for="result in results"
                :key="result.id"
                class="result-item"
                @click="onSelect(result)"
              >
                <div class="result-header">
                  <svg
                    class="result-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <div class="result-title">{{ result.display_name }}</div>
                </div>
                <div class="result-meta">
                  <span v-if="result.hint" class="result-hint">{{ result.hint }}</span>
                  <span v-if="result.cited_by_count" class="result-citations">
                    {{ formatCitations(result.cited_by_count) }} citations
                  </span>
                </div>
              </button>
            </div>

            <!-- Empty state (typed but no results) -->
            <div v-else-if="query && !loading" class="results-status">
              <span>No papers found</span>
            </div>

            <!-- Initial state -->
            <div v-else class="results-status results-status--hint">
              <span>Search by title, author, or DOI</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay transparency levels */
.search-overlay {
  --overlay-subtle: rgba(255, 255, 255, 0.1);
  --overlay-border: rgba(255, 255, 255, 0.15);
  --overlay-hover: rgba(255, 255, 255, 0.2);
  --overlay-focus: rgba(255, 255, 255, 0.3);
  --panel-opacity: 70%;
  --panel-bg: color-mix(in srgb, var(--bg-colormap) var(--panel-opacity), transparent);
}

.search-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-panel-colormap-light, rgba(0, 0, 0, 0.3));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

/* Search container */
.search-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-lg);
  padding-top: calc(env(safe-area-inset-top, 0px) + var(--spacing-lg));
}

/* Search bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--panel-bg);
  border: 1px solid var(--overlay-border);
  border-radius: 50px;
  padding: 14px 20px;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.search-bar:focus-within {
  border-color: var(--overlay-focus);
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 16px; /* Prevents iOS zoom */
  font-family: inherit;
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-placeholder);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--overlay-subtle);
  border: none;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.clear-btn:active {
  background: var(--overlay-hover);
  color: var(--text-secondary);
}

.clear-btn svg {
  width: 16px;
  height: 16px;
}

/* Results */
.results-container {
  margin-top: var(--spacing-lg);
}

.results-list {
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border: 1px solid var(--overlay-border);
  border-radius: 20px;
  overflow: hidden;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--overlay-subtle);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:active {
  background: var(--overlay-subtle);
}

.result-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.result-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--text-muted);
  margin-top: 1px;
}

.result-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-muted);
}

.result-hint {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-citations {
  flex-shrink: 0;
  color: var(--text-dim);
}

/* Status states */
.results-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-lg);
  color: var(--text-muted);
  font-size: 15px;
}

.results-status--hint {
  color: var(--text-dim);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--overlay-hover);
  border-top-color: var(--text-muted);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Building state */
.building-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
}

.building-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
  background: var(--panel-bg);
  border: 1px solid var(--overlay-border);
  border-radius: 24px;
  padding: var(--spacing-xl) var(--spacing-xl);
  max-width: 320px;
  width: 100%;
  text-align: center;
}

.building-spinner {
  width: 56px;
  height: 56px;
  border: 3px solid var(--overlay-hover);
  border-top-color: var(--progress-fill);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.building-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.building-paper {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.building-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.progress-bar {
  height: 6px;
  background: var(--progress-bg);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
  border-radius: 3px;
  transition: width var(--transition-smooth);
  box-shadow: var(--shadow-glow-green);
}

.progress-message {
  font-size: 13px;
  color: var(--text-dim);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
