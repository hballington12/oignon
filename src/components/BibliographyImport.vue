<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  parseBibliography,
  resolveDois,
  type ResolvedReference,
} from '@/lib/graph/bibliography'
import { MAX_MULTI_SOURCES } from '@/lib/graph/multiGraph'

const emit = defineEmits<{
  build: [ids: string[]]
  back: []
}>()

type Phase = 'input' | 'resolving' | 'review'

const phase = ref<Phase>('input')
const text = ref('')
const resolved = ref<ResolvedReference[]>([])
const checkedIds = ref<Set<string>>(new Set())
const unresolvedDois = ref<string[]>([])
const showUnresolved = ref(false)
const resolveProgress = ref({ completed: 0, total: 0 })
const fileInputRef = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')

// Live count of identifiers detected in the pasted text
const detectedDois = computed(() => parseBibliography(text.value))
const detectedCount = computed(() => detectedDois.value.length)
const overCap = computed(() => detectedCount.value > MAX_MULTI_SOURCES)

const checkedCount = computed(() => checkedIds.value.size)
const canBuild = computed(() => checkedCount.value >= 2)

function openFilePicker() {
  fileInputRef.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const content = await file.text()
    // Append so users can combine multiple files or add pasted text
    text.value = text.value ? `${text.value}\n${content}` : content
  } catch (e) {
    console.error('Failed to read file:', e)
    errorMessage.value = 'Could not read that file'
  }
  input.value = ''
}

async function scan() {
  errorMessage.value = ''
  const dois = detectedDois.value.slice(0, MAX_MULTI_SOURCES)
  if (dois.length === 0) return

  phase.value = 'resolving'
  resolveProgress.value = { completed: 0, total: 0 }

  try {
    const result = await resolveDois(dois, (completed, total) => {
      resolveProgress.value = { completed, total }
    })
    resolved.value = result.resolved
    unresolvedDois.value = result.unresolvedDois
    checkedIds.value = new Set(result.resolved.map((r) => r.id))
    phase.value = 'review'
  } catch (e) {
    console.error('Failed to resolve references:', e)
    errorMessage.value = 'Failed to look up references, please try again'
    phase.value = 'input'
  }
}

function toggleChecked(id: string) {
  const next = new Set(checkedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  checkedIds.value = next
}

function backToInput() {
  phase.value = 'input'
  showUnresolved.value = false
}

function build() {
  if (!canBuild.value) return
  const ids = resolved.value.filter((r) => checkedIds.value.has(r.id)).map((r) => r.id)
  emit('build', ids)
}

function formatCitations(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(count >= 10000 ? 0 : 1) + 'k'
  }
  return String(count)
}
</script>

<template>
  <div class="biblio-import">
    <!-- Input phase -->
    <template v-if="phase === 'input'">
      <div class="biblio-header">
        <button class="back-btn" aria-label="Back to search" @click="emit('back')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="biblio-title">Build from a bibliography</div>
      </div>

      <textarea
        v-model="text"
        class="biblio-textarea"
        placeholder="Paste a reference list, .bbl or .bib content, or anything containing DOIs / arXiv IDs..."
        spellcheck="false"
      />

      <div class="biblio-hint">
        <span v-if="detectedCount === 0">No DOIs or arXiv IDs detected yet</span>
        <span v-else-if="overCap">
          {{ detectedCount }} references detected, using the first {{ MAX_MULTI_SOURCES }}
        </span>
        <span v-else>{{ detectedCount }} reference{{ detectedCount === 1 ? '' : 's' }} detected</span>
      </div>

      <div v-if="errorMessage" class="biblio-error">{{ errorMessage }}</div>

      <div class="biblio-actions">
        <button class="secondary-btn" @click="openFilePicker">Load file...</button>
        <button class="primary-btn" :disabled="detectedCount === 0" @click="scan">
          Find papers
        </button>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept=".bbl,.bib,.txt,.tex,.md"
        class="file-input-hidden"
        @change="onFileSelected"
      />
    </template>

    <!-- Resolving phase -->
    <div v-else-if="phase === 'resolving'" class="biblio-status">
      <div class="spinner" />
      <span>
        Looking up references{{
          resolveProgress.total > 1
            ? ` (${resolveProgress.completed}/${resolveProgress.total})`
            : '...'
        }}
      </span>
    </div>

    <!-- Review phase -->
    <template v-else>
      <div class="biblio-header">
        <button class="back-btn" aria-label="Back to input" @click="backToInput">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="biblio-title">
          {{ resolved.length }} paper{{ resolved.length === 1 ? '' : 's' }} matched
        </div>
      </div>

      <div class="biblio-list">
        <label v-for="paper in resolved" :key="paper.id" class="biblio-item">
          <input
            type="checkbox"
            :checked="checkedIds.has(paper.id)"
            @change="toggleChecked(paper.id)"
          />
          <div class="biblio-item-body">
            <div class="biblio-item-title">{{ paper.title }}</div>
            <div class="biblio-item-meta">
              <span v-if="paper.firstAuthor">
                {{ paper.firstAuthor }}{{ paper.year ? `, ${paper.year}` : '' }}
              </span>
              <span v-else-if="paper.year">{{ paper.year }}</span>
              <span class="biblio-item-citations">
                {{ formatCitations(paper.citationCount) }} citations
              </span>
            </div>
          </div>
        </label>
      </div>

      <div v-if="unresolvedDois.length > 0" class="biblio-unresolved">
        <button class="unresolved-toggle" @click="showUnresolved = !showUnresolved">
          {{ unresolvedDois.length }} DOI{{ unresolvedDois.length === 1 ? '' : 's' }} not found
          {{ showUnresolved ? '▾' : '▸' }}
        </button>
        <div v-if="showUnresolved" class="unresolved-list">
          <div v-for="doi in unresolvedDois" :key="doi" class="unresolved-doi">{{ doi }}</div>
        </div>
      </div>

      <div class="biblio-actions">
        <button class="primary-btn" :disabled="!canBuild" @click="build">
          Build graph ({{ checkedCount }} paper{{ checkedCount === 1 ? '' : 's' }})
        </button>
      </div>
      <div v-if="!canBuild" class="biblio-hint">Select at least 2 papers</div>
    </template>
  </div>
</template>

<style scoped>
.biblio-import {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 12px);
  width: 100%;
  min-height: 0;
  /* Overlay is teleported to body, so text color must come from the theme
     variables (overridden by .search-overlay.light-mode), not inheritance */
  color: var(--text-primary, #ffffff);
}

.biblio-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 6px;
  background: var(--overlay-subtle, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--overlay-border, rgba(255, 255, 255, 0.15));
  border-radius: 50%;
  color: inherit;
  cursor: pointer;
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--overlay-hover, rgba(255, 255, 255, 0.2));
}

.back-btn svg {
  width: 100%;
  height: 100%;
}

.biblio-title {
  font-size: 16px;
  font-weight: 600;
}

.biblio-textarea {
  width: 100%;
  min-height: 180px;
  padding: var(--spacing-md, 12px);
  background: var(--panel-bg, rgba(0, 0, 0, 0.3));
  border: 1px solid var(--overlay-border, rgba(255, 255, 255, 0.15));
  border-radius: 12px;
  color: inherit;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.biblio-textarea:focus {
  border-color: var(--overlay-focus, rgba(255, 255, 255, 0.3));
}

.biblio-hint {
  font-size: 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.6));
}

.biblio-error {
  font-size: 12px;
  color: #ff6b6b;
}

.biblio-actions {
  display: flex;
  gap: var(--spacing-sm, 8px);
  justify-content: flex-end;
}

.primary-btn,
.secondary-btn {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  color: inherit;
  border: 1px solid var(--overlay-border, rgba(255, 255, 255, 0.15));
  background: var(--overlay-subtle, rgba(255, 255, 255, 0.1));
}

.primary-btn {
  background: var(--overlay-focus, rgba(255, 255, 255, 0.3));
  font-weight: 600;
}

.primary-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.primary-btn:not(:disabled):hover,
.secondary-btn:hover {
  background: var(--overlay-hover, rgba(255, 255, 255, 0.2));
}

.file-input-hidden {
  display: none;
}

.biblio-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-lg, 16px);
  opacity: 0.8;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--overlay-border, rgba(255, 255, 255, 0.15));
  border-top-color: currentColor;
  border-radius: 50%;
  animation: biblio-spin 0.8s linear infinite;
}

@keyframes biblio-spin {
  to {
    transform: rotate(360deg);
  }
}

.biblio-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 45vh;
}

.biblio-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  background: var(--overlay-subtle, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--overlay-border, rgba(255, 255, 255, 0.15));
  border-radius: 10px;
  cursor: pointer;
}

.biblio-item:hover {
  background: var(--overlay-hover, rgba(255, 255, 255, 0.2));
}

.biblio-item input[type='checkbox'] {
  margin-top: 3px;
  accent-color: currentColor;
  flex-shrink: 0;
}

.biblio-item-body {
  min-width: 0;
}

.biblio-item-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
}

.biblio-item-meta {
  display: flex;
  gap: var(--spacing-sm, 8px);
  font-size: 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.6));
  margin-top: 2px;
}

.biblio-unresolved {
  font-size: 12px;
}

.unresolved-toggle {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}

.unresolved-toggle:hover {
  opacity: 1;
}

.unresolved-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 100px;
  overflow-y: auto;
}

.unresolved-doi {
  font-family: monospace;
  font-size: 11px;
  opacity: 0.6;
  word-break: break-all;
}
</style>
