<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchAutocomplete, type AutocompleteResult } from '@/lib/graph/openAlexApi'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()

const props = defineProps<{
  open: boolean
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
      <div v-if="open" class="search-overlay" @click="onBackdropClick">
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
            <div v-if="loading && results.length === 0" class="results-loading">
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
                <div class="result-title">{{ result.display_name }}</div>
                <div class="result-meta">
                  <span v-if="result.hint" class="result-hint">{{ result.hint }}</span>
                  <span v-if="result.cited_by_count" class="result-citations">
                    {{ formatCitations(result.cited_by_count) }} citations
                  </span>
                </div>
              </button>
            </div>

            <!-- Empty state (typed but no results) -->
            <div v-else-if="query && !loading" class="results-empty">
              <span>No papers found</span>
            </div>

            <!-- Initial state -->
            <div v-else class="results-hint">
              <span>Search by title, author, or DOI</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.search-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: var(--spacing-md);
  padding-top: env(safe-area-inset-top, var(--spacing-md));
}

/* Search bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--bg-container);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
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
  width: 24px;
  height: 24px;
  background: var(--bg-input);
  border: none;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.clear-btn:active {
  background: var(--bg-input-focus);
}

.clear-btn svg {
  width: 14px;
  height: 14px;
}

/* Results */
.results-container {
  margin-top: var(--spacing-md);
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-container);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.result-item:active {
  background: var(--bg-input-focus);
}

.result-title {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
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

/* States */
.results-loading,
.results-empty,
.results-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl);
  color: var(--text-muted);
  font-size: var(--font-size-base);
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-medium);
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
  padding: var(--spacing-lg);
}

.building-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--bg-container);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl) var(--spacing-lg);
  max-width: 320px;
  width: 100%;
  text-align: center;
}

.building-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border-medium);
  border-top-color: var(--progress-fill);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.building-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.building-paper {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.building-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.progress-bar {
  height: 4px;
  background: var(--progress-bg);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
  border-radius: 2px;
  transition: width var(--transition-smooth);
}

.progress-message {
  font-size: var(--font-size-xs);
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
