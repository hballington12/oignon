<script setup lang="ts">
import { usePaperDetails } from '@/composables/usePaperDetails'
import ExpandableAbstract from '@/components/ExpandableAbstract.vue'
import openAlexIcon from '@/assets/tricon-outlined.png'

const {
  abstractExpanded,
  detailsContent,
  backgroundColor,
  displayNode,
  isSource,
  isMetadataLoading,
  labelText,
  inGraphCitations,
  workType,
  sourceInfo,
  isBookmarked,
  primaryTopic,
  keywords,
  sdgsFormatted,
  badges,
  openDoi,
  openOpenAlex,
  handleBuild,
  toggleBookmark,
  expandAbstract,
  collapseAbstract,
} = usePaperDetails()
</script>

<template>
  <div class="details-wrapper">
    <div id="details-panel" ref="detailsContent" class="details-content">
      <Transition name="paper-fade" mode="out-in">
        <!-- Empty state -->
        <div v-if="!displayNode" key="empty" class="empty-state">
          <span>No paper selected</span>
        </div>

        <!-- Loading state -->
        <div v-else-if="isMetadataLoading" key="loading" class="metadata-loading">
          <div class="loading-spinner"></div>
          <span>Loading metadata...</span>
        </div>

        <div v-else :key="displayNode.id" class="paper-content">
          <!-- Header with label, badges, and action buttons -->
          <div class="panel-header-row">
            <span class="panel-label">{{ labelText }}</span>
            <span
              v-for="(badge, i) in badges"
              :key="i"
              class="header-badge"
              :style="{ backgroundColor: badge.color, color: badge.textColor }"
              :title="badge.title"
            >
              {{ badge.text }}
            </span>
            <div id="details-actions" class="header-actions">
              <button
                v-if="!isSource"
                class="header-action build"
                @click="handleBuild"
                title="Build graph from this paper"
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
                v-if="displayNode.metadata.doi"
                class="header-action"
                @click="openDoi(displayNode.metadata.doi)"
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
                v-if="displayNode.metadata.openAlexUrl"
                class="header-action"
                @click="openOpenAlex(displayNode.metadata.openAlexUrl)"
                title="Open in OpenAlex"
              >
                <img :src="openAlexIcon" alt="OpenAlex" width="12" height="12" />
              </button>
              <button
                class="header-action bookmark"
                :class="{ bookmarked: isBookmarked }"
                @click="toggleBookmark"
                :title="isBookmarked ? 'Remove bookmark' : 'Add bookmark'"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
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
            @expand="expandAbstract"
          />

          <!-- Classification -->
          <div v-if="primaryTopic || sdgsFormatted || keywords" class="paper-stats">
            <div v-if="primaryTopic?.name" class="stat-row text-row">
              <span class="stat-label">Topic</span>
              <span class="stat-value text-value">{{ primaryTopic.name }}</span>
            </div>
            <div v-if="primaryTopic?.subfield?.name" class="stat-row text-row">
              <span class="stat-label">Subfield</span>
              <span class="stat-value text-value">{{ primaryTopic.subfield.name }}</span>
            </div>
            <div v-if="primaryTopic?.field?.name" class="stat-row text-row">
              <span class="stat-label">Field</span>
              <span class="stat-value text-value">{{ primaryTopic.field.name }}</span>
            </div>
            <div v-if="primaryTopic?.domain?.name" class="stat-row text-row">
              <span class="stat-label">Domain</span>
              <span class="stat-value text-value">{{ primaryTopic.domain.name }}</span>
            </div>
            <div v-if="sdgsFormatted" class="stat-row text-row">
              <span class="stat-label">SDGs</span>
              <span class="stat-value text-value">{{ sdgsFormatted }}</span>
            </div>
            <div v-if="keywords" class="stat-row text-row">
              <span class="stat-label">Keywords</span>
              <span class="stat-value text-value">{{ keywords.join(', ') }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Abstract overlay -->
    <Transition name="fade">
      <div
        v-if="abstractExpanded && displayNode?.metadata.abstract"
        class="abstract-overlay"
        @click="collapseAbstract"
      >
        <div class="abstract-expanded" :style="{ backgroundColor }" @click.stop>
          <button class="close-btn" @click="collapseAbstract" title="Close">
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

.header-badge {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px 5px;
  border-radius: 3px;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.header-badge:active {
  filter: brightness(1.15);
  transform: scale(1.05);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.header-action {
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

.header-action:active {
  background: var(--bg-item-hover);
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

.header-action.build {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.header-action.build:active {
  opacity: 0.8;
}

.header-action.bookmark:active {
  border-color: #f97316;
  color: #f97316;
}

.header-action.bookmark.bookmarked {
  background: rgba(249, 115, 22, 0.15);
  border-color: #f97316;
  color: #f97316;
}

.header-action img {
  opacity: 0.7;
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

.stat-row.text-row {
  justify-content: flex-start;
  gap: var(--spacing-xs);
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

.stat-value.text-value {
  font-family: var(--font-family);
  font-weight: 500;
}

.paper-abstract {
  margin-bottom: var(--spacing-sm);
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

/* Fade transition for abstract overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-normal);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Paper content fade transition */
.paper-fade-enter-active {
  transition: opacity 0.15s ease-out;
}

.paper-fade-leave-active {
  transition: opacity 0.08s ease-in;
}

.paper-fade-enter-from,
.paper-fade-leave-to {
  opacity: 0;
}
</style>
