<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGraphStore } from '@/stores/graph'

const store = useGraphStore()
const mouseX = ref(0)
const mouseY = ref(0)

const hoveredNode = computed(() => {
  if (!store.hoveredNodeId) return null
  return store.nodes.get(store.hoveredNodeId) ?? null
})

function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <div
    v-if="hoveredNode"
    class="tooltip"
    :style="{ left: mouseX + 15 + 'px', top: mouseY + 15 + 'px' }"
  >
    <div class="tooltip-title">{{ hoveredNode.metadata.title }}</div>
    <div class="tooltip-meta">
      <span class="tooltip-year">{{ hoveredNode.order }}</span>
      <span class="tooltip-separator">|</span>
      <span class="tooltip-citations">{{ hoveredNode.metadata.citationCount }} citations</span>
    </div>
    <div v-if="hoveredNode.metadata.authors.length" class="tooltip-authors">
      {{ hoveredNode.metadata.authors.slice(0, 3).join(', ') }}
      <span v-if="hoveredNode.metadata.authors.length > 3" class="more">
        +{{ hoveredNode.metadata.authors.length - 3 }} more
      </span>
    </div>
  </div>
</template>

<style scoped>
.tooltip {
  position: fixed;
  max-width: 300px;
  padding: 10px 14px;
  background: var(--bg-tooltip);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  pointer-events: none;
  z-index: var(--z-tooltip);
  box-shadow: var(--shadow-tooltip);
}

.tooltip-title {
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: var(--spacing-sm);
}

.tooltip-meta {
  display: flex;
  gap: var(--spacing-sm);
  color: var(--text-muted);
  font-size: var(--font-size-base);
  margin-bottom: 6px;
}

.tooltip-year {
  color: var(--accent-link);
  font-family: var(--font-mono);
}

.tooltip-separator {
  color: var(--text-faint);
}

.tooltip-authors {
  font-size: var(--font-size-base);
  color: var(--text-dim);
  line-height: 1.4;
}

.tooltip-authors .more {
  color: var(--text-faint);
  font-style: italic;
}
</style>
