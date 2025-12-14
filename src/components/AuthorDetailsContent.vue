<script setup lang="ts">
import { useAuthorDetails } from '@/composables/useAuthorDetails'
import openAlexIcon from '@/assets/tricon-outlined.png'

const {
  displayName,
  affiliation,
  orcidUrl,
  worksCount,
  citedByCount,
  hIndex,
  i10Index,
  papersInGraph,
  badges,
  isFollowing,
  openOrcid,
  openOpenAlex,
  toggleFollow,
  formatCount,
} = useAuthorDetails()
</script>

<template>
  <div class="details-wrapper">
    <div class="details-content">
      <!-- Empty state -->
      <div v-if="!displayName" class="empty-state">
        <span>No author data</span>
      </div>

      <template v-else>
        <!-- Header with label, badges, and action buttons -->
        <div class="panel-header-row">
          <span class="panel-label">Author</span>
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
            <button v-if="orcidUrl" class="header-action" @click="openOrcid" title="Open ORCID">
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
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button class="header-action" @click="openOpenAlex" title="Open in OpenAlex">
              <img :src="openAlexIcon" alt="OpenAlex" width="12" height="12" />
            </button>
            <button
              class="header-action follow"
              :class="{ following: isFollowing }"
              @click="toggleFollow"
              :title="isFollowing ? 'Unfollow author' : 'Follow author'"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                :fill="isFollowing ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Display name -->
        <h3 class="author-name">{{ displayName }}</h3>

        <!-- Affiliation -->
        <div v-if="affiliation" class="author-affiliation">
          {{ affiliation }}
        </div>

        <!-- Stats -->
        <div class="author-stats">
          <div class="stat-row">
            <span class="stat-label">Total Works</span>
            <span class="stat-value">{{ formatCount(worksCount) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Total Citations</span>
            <span class="stat-value">{{ formatCount(citedByCount) }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">h-index</span>
            <span class="stat-value">{{ hIndex }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">i10-index</span>
            <span class="stat-value">{{ i10Index }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Works in Graph</span>
            <span class="stat-value">{{ papersInGraph }}</span>
          </div>
        </div>
      </template>
    </div>
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

.header-action.follow:active {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.header-action.follow.following {
  background: rgba(139, 92, 246, 0.15);
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.header-action img {
  opacity: 0.7;
}

.author-name {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.author-affiliation {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-bottom: var(--spacing-sm);
  font-style: italic;
}

.author-stats {
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
</style>
