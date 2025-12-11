<script setup lang="ts">
import { ref, computed, TransitionGroup } from 'vue'
import { useGraphStore } from '@/stores/graph'
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'
import openAlexIcon from '@/assets/tricon-outlined.png'

const store = useGraphStore()
const collapsed = ref(false)
const activeTab = ref<'bookmarks' | 'graphs'>('bookmarks')

const hasBookmarks = computed(() => store.bookmarkedPapers.length > 0)
const hasRecentGraphs = computed(() => store.recentGraphs.length > 0)
const isEmpty = computed(() => {
  if (activeTab.value === 'bookmarks') return !hasBookmarks.value
  return !hasRecentGraphs.value
})

// Extract first name from author string (e.g., "John Smith" -> "John")
function getFirstName(author?: string): string {
  if (!author) return '?'
  const parts = author.trim().split(' ')
  return parts[0] || '?'
}

// Truncate title to first few words
function truncateTitle(title: string, maxWords = 4): string {
  const words = title.split(/\s+/).slice(0, maxWords)
  return words.join(' ') + (title.split(/\s+/).length > maxWords ? '...' : '')
}

// Bookmark actions
function handleBookmarkClick(id: string) {
  // Select the node in graph, or fetch standalone if not present
  store.selectBookmarkedPaper(id)
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
  <div class="library-panel-container">
    <CollapsiblePanel
      v-model:collapsed="collapsed"
      toggle-position="lower-west"
      :width="300"
      icon="library"
      label="library"
    >
      <div class="library-content">
        <div class="panel-header">
          <span>Library</span>
        </div>

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
            <button class="clear-btn" @click="clearAllBookmarks" title="Clear all">Clear</button>
          </div>
          <TransitionGroup name="book-slide" tag="div" class="book-shelf">
            <div
              v-for="paper in store.bookmarkedPapers"
              :key="paper.id"
              class="book-spine clickable"
              :title="paper.title"
              @click="handleBookmarkClick(paper.id)"
            >
              <span class="spine-text">
                {{ getFirstName(paper.firstAuthor) }} | {{ paper.year }} |
                {{ truncateTitle(paper.title) }}
              </span>
              <div class="spine-actions">
                <button
                  class="spine-action"
                  @click.stop="handleBuild(paper.id)"
                  title="Build graph"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
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
                    width="12"
                    height="12"
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
                  <img :src="openAlexIcon" alt="OpenAlex" width="12" height="12" />
                </button>
                <button
                  class="spine-action remove"
                  @click.stop="removeBookmark(paper.id)"
                  title="Remove"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
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
            <button class="clear-btn" @click="clearRecentGraphs" title="Clear all">Clear</button>
          </div>
          <TransitionGroup name="book-slide" tag="div" class="book-shelf">
            <div
              v-for="graph in store.recentGraphs"
              :key="graph.sourceId"
              class="book-spine clickable"
              :title="graph.title"
              @click="handleGraphClick(graph.sourceId)"
            >
              <span class="spine-text">
                {{ getFirstName(graph.firstAuthor) }} | {{ graph.year }} |
                {{ truncateTitle(graph.title) }}
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
                    width="12"
                    height="12"
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
                  <img :src="openAlexIcon" alt="OpenAlex" width="12" height="12" />
                </button>
                <button
                  class="spine-action remove"
                  @click.stop="removeRecentGraph(graph.sourceId)"
                  title="Remove"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
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
    </CollapsiblePanel>
  </div>
</template>

<style>
@import '@/assets/styles/panel.css';
</style>

<style scoped>
.library-panel-container {
  position: absolute;
  bottom: var(--spacing-xl);
  right: var(--spacing-xl);
  z-index: var(--z-panel);
  pointer-events: none;
}

.library-content {
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.panel-header {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.tab-switcher {
  display: flex;
  padding: var(--spacing-sm) var(--spacing-lg);
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--border-light);
}

.tab-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn:hover {
  color: var(--text-secondary);
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
  padding: var(--spacing-xl) var(--spacing-lg);
  text-align: center;
  color: var(--text-dim);
}

.empty-icon {
  font-size: 24px;
  display: block;
  margin-bottom: var(--spacing-sm);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: var(--font-size-sm);
}

.library-section {
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
}

.section-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.clear-btn {
  font-size: var(--font-size-xs);
  color: var(--text-faint);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  color: var(--accent-red);
  background: rgba(248, 113, 113, 0.1);
}

.book-shelf {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.book-spine {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
  border-left: 3px solid var(--accent-blue);
  border-radius: 2px;
  transition: all var(--transition-fast);
}

.book-spine.clickable {
  cursor: pointer;
}

.book-spine.clickable:hover {
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  border-left-color: var(--accent-green);
}

.spine-text {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono);
  letter-spacing: 0.3px;
}

.spine-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.book-spine:hover .spine-actions {
  opacity: 1;
}

.spine-action {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  border-radius: 3px;
  transition: all var(--transition-fast);
}

.spine-action:hover {
  color: var(--accent-blue);
  background: rgba(96, 165, 250, 0.15);
}

.spine-action.remove:hover {
  color: var(--accent-red);
  background: rgba(248, 113, 113, 0.15);
}

/* Book slide animations */
.book-slide-enter-active,
.book-slide-leave-active {
  transition:
    transform 300ms ease,
    opacity 300ms ease;
}

.book-slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.book-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.book-slide-move {
  transition: transform 300ms ease;
}
</style>
