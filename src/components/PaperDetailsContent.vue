<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGraphStore } from '@/stores/graph'
import { getDarkerBackgroundColorHex, COLORMAPS } from '@/lib/colormap'
import ExpandableAbstract from '@/components/ExpandableAbstract.vue'

const store = useGraphStore()

const abstractExpanded = ref(false)
const detailsContent = ref<HTMLElement | null>(null)

const backgroundColor = computed(() => {
  const colormap = COLORMAPS[store.activeColormap]
  return colormap ? getDarkerBackgroundColorHex(colormap) : '#0d0d17'
})

const displayNode = computed(() => {
  if (store.standalonePaper) {
    return store.standalonePaper
  }
  if (store.selectedNodes.length === 1) {
    return store.selectedNodes[0] ?? null
  }
  return store.sourceNode ?? null
})

// Close abstract overlay and reset scroll when node changes
watch(
  () => displayNode.value?.id,
  () => {
    abstractExpanded.value = false
    detailsContent.value?.scrollTo({ top: 0, behavior: 'smooth' })
  },
)

const isStandalone = computed(() => store.standalonePaper !== null)

const isSource = computed(() => {
  return displayNode.value?.metadata.isSource ?? false
})

const isMetadataLoading = computed(() => {
  return store.hydratingMetadata && displayNode.value?.metadata.title === 'Loading...'
})

const labelText = computed(() => {
  if (isStandalone.value) {
    return 'Bookmarked'
  }
  if (store.selectedNodes.length === 1) {
    return isSource.value ? 'Source' : 'Selected'
  }
  return 'Source'
})

const inGraphCitations = computed(() => {
  return displayNode.value?.citedBy.length ?? 0
})

const workType = computed(() => {
  const type = displayNode.value?.metadata.type
  if (!type) return null
  return type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
})

const sourceInfo = computed(() => {
  const meta = displayNode.value?.metadata
  if (!meta?.sourceName) return null
  const typeLabel =
    meta.sourceType === 'journal'
      ? 'Journal'
      : meta.sourceType === 'conference'
        ? 'Conference'
        : meta.sourceType === 'repository'
          ? 'Repository'
          : 'Source'
  return { type: typeLabel, name: meta.sourceName }
})

const isBookmarked = computed(() => {
  if (!displayNode.value) return false
  return store.isBookmarked(displayNode.value.id)
})

function openDoi(doi: string | undefined) {
  if (doi) window.open(doi, '_blank')
}

function openOpenAlex(url: string | undefined) {
  if (url) window.open(url, '_blank')
}

function handleBuild() {
  if (displayNode.value) {
    store.triggerBuild(displayNode.value.id)
  }
}

function toggleBookmark() {
  if (!displayNode.value) return
  const node = displayNode.value
  if (isBookmarked.value) {
    store.removeBookmark(node.id)
  } else {
    store.addBookmark({
      id: node.id,
      title: node.metadata.title,
      firstAuthor: node.metadata.authors?.[0],
      year: node.order,
      citations: node.metadata.citationCount,
      doi: node.metadata.doi,
      openAlexUrl: node.metadata.openAlexUrl,
    })
  }
}
</script>

<template>
  <div class="details-wrapper">
    <div ref="detailsContent" class="details-content">
      <!-- Empty state -->
      <div v-if="!displayNode" class="empty-state">
        <span>No paper selected</span>
      </div>

      <!-- Loading state -->
      <div v-else-if="isMetadataLoading" class="metadata-loading">
        <div class="loading-spinner"></div>
        <span>Loading metadata...</span>
      </div>

      <template v-else>
        <!-- Header with label and badges -->
        <div class="panel-header-row">
          <span class="panel-label">{{ labelText }}</span>
          <span v-if="isSource" class="source-badge">SRC</span>
          <button
            v-else
            class="build-badge"
            @click="handleBuild"
            title="Build graph from this paper"
          >
            Build
          </button>
          <span v-if="displayNode.metadata.openAccess" class="oa-badge" title="Open Access"
            >OA</span
          >
        </div>

        <!-- Title -->
        <h3 class="paper-title">{{ displayNode.metadata.title }}</h3>

        <!-- Source/Venue -->
        <div v-if="sourceInfo" class="paper-source">
          <span class="source-type">{{ sourceInfo.type }}:</span>
          <span class="source-name">{{ sourceInfo.name }}</span>
        </div>

        <!-- Authors -->
        <div v-if="displayNode.metadata.authors.length" class="paper-authors">
          <span
            v-for="(author, i) in displayNode.metadata.authors.slice(0, 5)"
            :key="i"
            class="paper-author"
          >
            {{ author
            }}<span v-if="i < Math.min(displayNode.metadata.authors.length, 5) - 1">, </span>
          </span>
          <span v-if="displayNode.metadata.authors.length > 5" class="paper-author more">
            +{{ displayNode.metadata.authors.length - 5 }} more
          </span>
        </div>

        <!-- Stats -->
        <div class="paper-stats">
          <div class="stat-row">
            <span class="stat-label">Year</span>
            <span class="stat-value">{{ displayNode.order }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Global Citations</span>
            <span class="stat-value">{{
              displayNode.metadata.citationCount.toLocaleString()
            }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">In-Graph Citations</span>
            <span class="stat-value">{{ inGraphCitations.toLocaleString() }}</span>
          </div>
          <div v-if="displayNode.metadata.referencesCount" class="stat-row">
            <span class="stat-label">References</span>
            <span class="stat-value">{{
              displayNode.metadata.referencesCount.toLocaleString()
            }}</span>
          </div>
          <div v-if="workType" class="stat-row">
            <span class="stat-label">Type</span>
            <span class="stat-value type-value">{{ workType }}</span>
          </div>
        </div>

        <!-- Abstract -->
        <ExpandableAbstract
          v-if="displayNode.metadata.abstract"
          :abstract="displayNode.metadata.abstract"
          :truncate-length="200"
          class="paper-abstract"
          @expand="abstractExpanded = true"
        />

        <!-- Links -->
        <div class="paper-links">
          <a
            v-if="displayNode.metadata.doi"
            class="paper-link"
            :href="displayNode.metadata.doi"
            target="_blank"
            @click.prevent="openDoi(displayNode.metadata.doi)"
          >
            DOI
          </a>
          <a
            v-if="displayNode.metadata.openAlexUrl"
            class="paper-link"
            :href="displayNode.metadata.openAlexUrl"
            target="_blank"
            @click.prevent="openOpenAlex(displayNode.metadata.openAlexUrl)"
          >
            OpenAlex
          </a>
          <button
            class="bookmark-btn"
            :class="{ bookmarked: isBookmarked }"
            @click="toggleBookmark"
            :title="isBookmarked ? 'Remove bookmark' : 'Add bookmark'"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              :fill="isBookmarked ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- Abstract overlay -->
    <Transition name="fade">
      <div
        v-if="abstractExpanded && displayNode?.metadata.abstract"
        class="abstract-overlay"
        @click="abstractExpanded = false"
      >
        <div class="abstract-expanded" :style="{ backgroundColor }" @click.stop>
          <button class="close-btn" @click="abstractExpanded = false" title="Close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div class="expanded-label">Abstract</div>
          <div class="expanded-content">
            <p>{{ displayNode.metadata.abstract }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.details-wrapper {
  position: relative;
  height: 100%;
}

.details-content {
  padding: var(--spacing-md);
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-dim);
  font-size: var(--font-size-sm);
}

.metadata-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  height: 100%;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-light);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.panel-header-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
}

.panel-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim);
}

.source-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--bg-container);
  background: var(--accent-green);
  padding: 2px 5px;
  border-radius: 3px;
}

.build-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-primary);
  background: var(--accent-blue);
  padding: 2px 6px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.build-badge:active {
  opacity: 0.8;
}

.oa-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #1a1a2e;
  background: #f59e0b;
  padding: 2px 5px;
  border-radius: 3px;
  margin-left: auto;
}

.paper-title {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.paper-source {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-bottom: var(--spacing-xs);
}

.source-type {
  color: var(--text-dim);
}

.source-name {
  color: var(--text-secondary);
  font-style: italic;
}

.paper-authors {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.4;
  margin-bottom: var(--spacing-sm);
}

.paper-author.more {
  color: var(--text-faint);
  font-style: italic;
}

.paper-stats {
  background: var(--bg-item);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: var(--spacing-sm);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}

.stat-row:not(:last-child) {
  border-bottom: 1px solid var(--border-subtle);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-dim);
}

.stat-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.stat-value.type-value {
  font-family: var(--font-family);
  font-weight: 500;
  text-transform: capitalize;
}

.paper-abstract {
  margin-bottom: var(--spacing-sm);
}

.paper-links {
  display: flex;
  gap: var(--spacing-xs);
}

.paper-link {
  font-size: var(--font-size-xs);
  color: var(--accent-link);
  text-decoration: none;
  padding: 4px 8px;
  background: var(--accent-link-bg);
  border-radius: 4px;
  -webkit-tap-highlight-color: transparent;
}

.paper-link:active {
  background: var(--accent-link-bg-hover);
}

.bookmark-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--text-dim);
  background: var(--bg-item);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: pointer;
  margin-left: auto;
  -webkit-tap-highlight-color: transparent;
}

.bookmark-btn:active {
  background: var(--bg-item-hover);
}

.bookmark-btn.bookmarked {
  background: rgba(249, 115, 22, 0.15);
  border-color: #f97316;
  color: #f97316;
}

/* Abstract overlay */
.abstract-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.abstract-expanded {
  position: absolute;
  inset: 0;
  background: var(--bg-container);
  padding: var(--spacing-md);
  padding-top: var(--spacing-lg);
  display: flex;
  flex-direction: column;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-item);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  color: var(--text-dim);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.close-btn:active {
  background: var(--bg-item-hover);
  color: var(--text-secondary);
}

.expanded-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--spacing-sm);
  flex-shrink: 0;
}

.expanded-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.expanded-content p {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
