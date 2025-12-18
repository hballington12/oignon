<script setup lang="ts">
import { computed } from 'vue'
import type { VisualNode } from '@/types'

const props = defineProps<{
  node: VisualNode | null
  x: number
  y: number
}>()

const OFFSET_X = 16
const OFFSET_Y = 16

const style = computed(() => ({
  left: `${props.x + OFFSET_X}px`,
  top: `${props.y + OFFSET_Y}px`,
}))

const title = computed(() => {
  if (!props.node?.metadata?.title) return 'Untitled'
  const t = props.node.metadata.title
  return t.length > 80 ? t.slice(0, 77) + '...' : t
})

const authors = computed(() => {
  if (!props.node?.metadata?.authors?.length) return null
  const a = props.node.metadata.authors
  if (a.length === 1) return a[0]
  if (a.length === 2) return `${a[0]} & ${a[1]}`
  return `${a[0]} et al.`
})

const year = computed(() => props.node?.order ?? null)

const citations = computed(() => props.node?.metadata?.citationCount ?? 0)
</script>

<template>
  <Transition name="tooltip">
    <div v-if="node" class="node-tooltip" :style="style">
      <div class="tooltip-title">{{ title }}</div>
      <div v-if="authors" class="tooltip-authors">{{ authors }}</div>
      <div class="tooltip-meta">
        <span v-if="year">{{ year }}</span>
        <span v-if="year && citations"> · </span>
        <span>{{ citations }} citations</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.node-tooltip {
  position: fixed;
  z-index: 1000;
  max-width: 240px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 5px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-title {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
  margin-bottom: 3px;
}

.tooltip-authors {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 3px;
}

.tooltip-meta {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
}

.tooltip-enter-active {
  transition: opacity 0.15s ease-out;
}

.tooltip-leave-active {
  transition: opacity 0.1s ease-in;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}
</style>
