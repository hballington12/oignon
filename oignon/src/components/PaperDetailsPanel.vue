<script setup lang="ts">
import { computed } from 'vue'
import { useGraphStore } from '@/stores/graph'
import type { VisualNode } from '@/types'

const store = useGraphStore()

const displayNode = computed(() => {
  if (store.selectedNodes.length === 1) {
    return store.selectedNodes[0] ?? null
  }
  return store.sourceNode ?? null
})

function formatDoi(doi: string | undefined): string {
  if (!doi) return ''
  return doi.replace('https://doi.org/', '')
}

function openDoi(doi: string | undefined) {
  if (doi) window.open(doi, '_blank')
}

function openOpenAlex(url: string | undefined) {
  if (url) window.open(url, '_blank')
}
</script>

<template>
  <div v-if="displayNode && store.hasGraph" class="details-panel">
    <div class="label">
      {{ store.selectedNodes.length === 1 ? 'Selected' : 'Source' }}
    </div>

    <h3 class="title">{{ displayNode.metadata.title }}</h3>

    <div class="meta-row">
      <span class="year">{{ displayNode.order }}</span>
      <span class="citations">{{ displayNode.metadata.citationCount }} citations</span>
    </div>

    <div v-if="displayNode.metadata.authors.length" class="authors">
      <div v-for="(author, i) in displayNode.metadata.authors.slice(0, 5)" :key="i" class="author">
        {{ author }}
      </div>
      <div v-if="displayNode.metadata.authors.length > 5" class="author more">
        +{{ displayNode.metadata.authors.length - 5 }} more authors
      </div>
    </div>

    <div class="links">
      <button v-if="displayNode.metadata.doi" @click="openDoi(displayNode.metadata.doi)">
        DOI: {{ formatDoi(displayNode.metadata.doi) }}
      </button>
      <button
        v-if="displayNode.metadata.openAlexUrl"
        @click="openOpenAlex(displayNode.metadata.openAlexUrl)"
      >
        OpenAlex
      </button>
    </div>
  </div>
</template>

<style scoped>
.details-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  max-width: 400px;
  background: rgba(30, 30, 50, 0.95);
  border-radius: 8px;
  padding: 16px;
  color: #fff;
  z-index: 100;
}

.label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 8px;
}

.title {
  margin: 0 0 10px 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
}

.meta-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
}

.year {
  color: #6b8afd;
}

.authors {
  margin-bottom: 12px;
}

.author {
  font-size: 12px;
  color: #aaa;
  padding: 2px 0;
}

.author.more {
  color: #666;
  font-style: italic;
}

.links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.links button {
  padding: 6px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background: transparent;
  color: #6b8afd;
  font-size: 12px;
  cursor: pointer;
}

.links button:hover {
  background: rgba(107, 138, 253, 0.1);
  border-color: #6b8afd;
}
</style>
