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
    <div class="title">{{ hoveredNode.metadata.title }}</div>
    <div class="meta">
      <span class="year">{{ hoveredNode.order }}</span>
      <span class="citations">{{ hoveredNode.metadata.citationCount }} citations</span>
    </div>
    <div v-if="hoveredNode.metadata.authors.length" class="authors">
      {{ hoveredNode.metadata.authors.slice(0, 3).join(', ') }}
      <span v-if="hoveredNode.metadata.authors.length > 3">
        +{{ hoveredNode.metadata.authors.length - 3 }} more
      </span>
    </div>
  </div>
</template>

<style scoped>
.tooltip {
  position: fixed;
  max-width: 320px;
  padding: 12px;
  background: rgba(20, 20, 35, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  pointer-events: none;
  z-index: 1000;
}

.title {
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 8px;
}

.meta {
  display: flex;
  gap: 12px;
  color: #888;
  font-size: 12px;
  margin-bottom: 6px;
}

.year {
  color: #6b8afd;
}

.authors {
  font-size: 12px;
  color: #666;
}
</style>
