<script setup lang="ts">
import { ref, computed, TransitionGroup } from 'vue'
import { useGraphStore } from '@/stores/graph'
import openAlexIcon from '@/assets/tricon-outlined.png'

const store = useGraphStore()
const activeTab = ref<'bookmarks' | 'graphs'>('bookmarks')

const emit = defineEmits<{
  showDetails: []
}>()

const hasBookmarks = computed(() => store.bookmarkedPapers.length > 0)
const hasRecentGraphs = computed(() => store.recentGraphs.length > 0)
const isEmpty = computed(() => {
  if (activeTab.value === 'bookmarks') return !hasBookmarks.value
  return !hasRecentGraphs.value
})

// Get author surname (last word of name)
function getSurname(author?: string): string {
  if (!author) return '?'
  const parts = author.trim().split(' ')
  return parts[parts.length - 1] || '?'
}

// Bookmark actions
function handleBookmarkClick(id: string) {
  store.selectBookmarkedPaper(id)
  emit('showDetails')
}

function removeBookmark(id: string) {
  store.removeBookmark(id)
}

function clearAllBookmarks() {
  store.clearBookmarks()
}

// Recent graph actions
function handleGraphClick(sourceId: string) {
  store.loadRecentGraph(sourceId)
}

function removeRecentGraph(sourceId: string) {
  store.removeRecentGraph(sourceId)
}

function clearRecentGraphs() {
  store.clearRecentGraphs()
}

// Shared actions
function handleBuild(id: string) {
  store.triggerBuild(id)
}

function openDoi(doi?: string) {
  if (doi) window.open(doi, '_blank')
}

function openOpenAlex(url?: string) {
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <div class="library-content">
    <!-- Tab switcher -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'bookmarks' }"
        @click="activeTab = 'bookmarks'"
      >
        Bookmarks
        <span v-if="hasBookmarks" class="tab-count">{{ store.bookmarkedPapers.length }}</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'graphs' }"
        @click="activeTab = 'graphs'"
      >
        Graphs
        <span v-if="hasRecentGraphs" class="tab-count">{{ store.recentGraphs.length }}</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="isEmpty" class="empty-state">
      <span class="empty-icon">~</span>
      <p v-if="activeTab === 'bookmarks'">No bookmarks yet</p>
      <p v-else>No cached graphs yet</p>
    </div>

    <!-- Bookmarked Papers -->
    <div v-if="activeTab === 'bookmarks' && hasBookmarks" class="library-section">
      <div class="section-header">
        <button class="clear-btn" @click="clearAllBookmarks">Clear all</button>
      </div>
      <TransitionGroup name="spine-slide" tag="div" class="book-shelf">
        <div
          v-for="paper in store.bookmarkedPapers"
          :key="paper.id"
          class="book-spine"
          @click="handleBookmarkClick(paper.id)"
        >
          <span class="spine-text">
            <span class="spine-meta">{{ getSurname(paper.firstAuthor) }} | {{ paper.year }} |</span>
            <span class="spine-title">{{ paper.title }}</span>
          </span>
          <div class="spine-actions">
            <button class="spine-action" @click.stop="handleBuild(paper.id)" title="Build graph">
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
                <path
                  d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"
                />
                <path d="M17.64 15L22 10.64" />
                <path
                  d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"
                />
              </svg>
            </button>
            <button
              v-if="paper.doi"
              class="spine-action"
              @click.stop="openDoi(paper.doi)"
              title="Open DOI"
            >
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button
              v-if="paper.openAlexUrl"
              class="spine-action"
              @click.stop="openOpenAlex(paper.openAlexUrl)"
              title="Open in OpenAlex"
            >
              <img :src="openAlexIcon" alt="OpenAlex" width="14" height="14" />
            </button>
            <button
              class="spine-action remove"
              @click.stop="removeBookmark(paper.id)"
              title="Remove"
            >
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Recent Graphs -->
    <div v-if="activeTab === 'graphs' && hasRecentGraphs" class="library-section">
      <div class="section-header">
        <button class="clear-btn" @click="clearRecentGraphs">Clear all</button>
      </div>
      <TransitionGroup name="spine-slide" tag="div" class="book-shelf">
        <div
          v-for="graph in store.recentGraphs"
          :key="graph.sourceId"
          class="book-spine"
          @click="handleGraphClick(graph.sourceId)"
        >
          <span class="spine-text">
            <span class="spine-meta">{{ getSurname(graph.firstAuthor) }} | {{ graph.year }} |</span>
            <span class="spine-title">{{ graph.title }}</span>
          </span>
          <div class="spine-actions">
            <button
              v-if="graph.doi"
              class="spine-action"
              @click.stop="openDoi(graph.doi)"
              title="Open DOI"
            >
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button
              v-if="graph.openAlexUrl"
              class="spine-action"
              @click.stop="openOpenAlex(graph.openAlexUrl)"
              title="Open in OpenAlex"
            >
              <img :src="openAlexIcon" alt="OpenAlex" width="14" height="14" />
            </button>
            <button
              class="spine-action remove"
              @click.stop="removeRecentGraph(graph.sourceId)"
              title="Remove"
            >
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.library-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-switcher {
  display: flex;
  padding: var(--spacing-sm) var(--spacing-md);
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 6px 10px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  -webkit-tap-highlight-color: transparent;
}

.tab-btn:active {
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-blue);
}

.tab-count {
  font-size: var(--font-size-xs);
  color: var(--text-faint);
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 5px;
  border-radius: 8px;
}

.tab-btn.active .tab-count {
  background: rgba(96, 165, 250, 0.2);
  color: var(--accent-blue);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.empty-icon {
  font-size: 20px;
  margin-bottom: var(--spacing-xs);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
}

.library-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-xs) var(--spacing-md) var(--spacing-sm);
}

.section-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--spacing-xs);
  flex-shrink: 0;
}

.clear-btn {
  font-size: var(--font-size-xs);
  color: var(--text-faint);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  -webkit-tap-highlight-color: transparent;
}

.clear-btn:active {
  color: var(--accent-red);
  background: rgba(248, 113, 113, 0.1);
}

.book-shelf {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.book-spine {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  border-left: 3px solid var(--accent-blue);
  border-radius: 2px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

.book-spine:active {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  border-left-color: var(--accent-green);
}

.spine-text {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
}

.spine-meta {
  color: var(--text-dim);
  font-family: var(--font-mono);
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.spine-title {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.spine-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: var(--spacing-sm);
}

.spine-action {
  width: 26px;
  height: 26px;
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

.spine-action:active {
  color: var(--accent-blue);
  background: rgba(96, 165, 250, 0.15);
  border-color: var(--accent-blue);
}

.spine-action.remove:active {
  color: var(--accent-red);
  background: rgba(248, 113, 113, 0.15);
  border-color: var(--accent-red);
}

.spine-action img {
  opacity: 0.7;
}

/* Spine slide animations */
.spine-slide-enter-active,
.spine-slide-leave-active {
  transition: all 0.25s ease;
}

.spine-slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.spine-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.spine-slide-move {
  transition: transform 0.25s ease;
}
</style>
