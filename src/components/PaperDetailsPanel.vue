<script setup lang="ts">
import { usePaperDetails } from '@/composables/usePaperDetails'
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'
import ExpandableAbstract from '@/components/ExpandableAbstract.vue'
import openAlexIcon from '@/assets/tricon-outlined.png'

const {
  abstractExpanded,
  detailsContent,
  backgroundColor,
  displayNode,
  isStandalone,
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
  store,
  openDoi,
  openOpenAlex,
  handleBuild,
  toggleBookmark,
  expandAbstract,
  collapseAbstract,
} = usePaperDetails()
</script>

<template>
  <div v-if="displayNode && (store.hasGraph || isStandalone)" class="details-panel-container">
    <CollapsiblePanel
      v-model:collapsed="store.detailsPanelCollapsed"
      toggle-position="lower-east"
      :width="360"
      icon="info"
      label="metadata"
    >
      <div class="details-wrapper">
        <Transition name="slide" mode="out-in">
          <div ref="detailsContent" :key="displayNode.id" class="details-content">
            <!-- Loading state -->
            <div v-if="isMetadataLoading" class="metadata-loading">
              <div class="loading-spinner"></div>
              <span>Loading metadata...</span>
            </div>

            <template v-else>
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
                <div class="header-actions">
                  <button
                    v-if="!isSource"
                    class="header-action build"
                    @click="handleBuild"
                    title="Build graph from this paper"
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
                    v-if="displayNode.metadata.openAlexUrl"
                    class="header-action"
                    @click="openOpenAlex(displayNode.metadata.openAlexUrl)"
                    title="Open in OpenAlex"
                  >
                    <img :src="openAlexIcon" alt="OpenAlex" width="14" height="14" />
                  </button>
                  <button
                    class="header-action bookmark"
                    :class="{ bookmarked: isBookmarked }"
                    @click="toggleBookmark"
                    :title="isBookmarked ? 'Remove bookmark' : 'Add bookmark'"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
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
                :truncate-length="300"
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
            </template>
          </div>
        </Transition>

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
    </CollapsiblePanel>
  </div>
</template>

<style>
@import '@/assets/styles/panel.css';
</style>

<style scoped>
.details-panel-container {
  position: absolute;
  bottom: var(--spacing-xl);
  left: var(--spacing-xl);
  z-index: var(--z-panel);
  pointer-events: none;
}

.details-wrapper {
  position: relative;
  max-height: calc(100vh - 160px);
}

.details-content {
  padding: var(--spacing-lg);
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.metadata-loading {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-muted);
  font-size: var(--font-size-base);
  padding: var(--spacing-md) 0;
}

.loading-spinner {
  width: 16px;
  height: 16px;
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
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.panel-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-dim);
}

.header-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  cursor: default;
  transition:
    filter var(--transition-fast),
    transform var(--transition-fast);
}

.header-badge:hover {
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
  transition: all var(--transition-fast);
}

.header-action:hover {
  background: var(--bg-item-hover);
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

.header-action.build {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.header-action.build:hover {
  background: var(--accent-blue-light);
  border-color: var(--accent-blue-light);
}

.header-action.bookmark:hover {
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

.header-action:hover img {
  opacity: 1;
}

.paper-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.paper-source {
  font-size: var(--font-size-base);
  color: var(--text-muted);
  margin-bottom: var(--spacing-sm);
}

.source-type {
  color: var(--text-dim);
}

.source-name {
  color: var(--text-secondary);
  font-style: italic;
}

.paper-authors {
  font-size: var(--font-size-base);
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: var(--spacing-md);
}

.paper-author.more {
  color: var(--text-faint);
  font-style: italic;
}

.paper-stats {
  background: var(--bg-item);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: var(--spacing-md);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.stat-row:not(:last-child) {
  border-bottom: 1px solid var(--border-subtle);
}

.stat-row.text-row {
  justify-content: flex-start;
  gap: var(--spacing-sm);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-dim);
}

.stat-value {
  font-size: var(--font-size-base);
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
  margin-bottom: var(--spacing-md);
}

/* Transition for content swap */
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal),
    filter var(--transition-normal);
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
  filter: blur(4px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  filter: blur(4px);
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
  padding: var(--spacing-lg);
  padding-top: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
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
  transition: all var(--transition-fast);
}

.close-btn:hover {
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
}

.expanded-content p {
  font-size: var(--font-size-base);
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
