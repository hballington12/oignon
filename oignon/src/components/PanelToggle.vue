<script setup lang="ts">
defineProps<{
  collapsed: boolean
  direction: 'up' | 'down' | 'left' | 'right'
}>()

const emit = defineEmits<{
  toggle: []
}>()

function getRotation(direction: string, collapsed: boolean): string {
  const rotations: Record<string, { open: number; closed: number }> = {
    up: { open: -135, closed: 45 },
    down: { open: 45, closed: -135 },
    left: { open: 135, closed: -45 },
    right: { open: -45, closed: 135 },
  }
  const r = rotations[direction] ?? rotations.up!
  return `rotate(${collapsed ? r!.closed : r!.open}deg)`
}
</script>

<template>
  <button class="panel-toggle" :title="collapsed ? 'Expand' : 'Collapse'" @click="emit('toggle')">
    <span class="arrow" :style="{ transform: getRotation(direction, collapsed) }" />
  </button>
</template>

<style scoped>
.panel-toggle {
  width: var(--toggle-size);
  height: var(--toggle-size);
  border: 1px solid var(--panel-border);
  border-radius: var(--control-btn-radius);
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-smooth);
  flex-shrink: 0;
}

.panel-toggle:hover {
  background: rgba(0, 0, 0, 0.8);
  color: var(--text-primary);
}

.arrow {
  display: block;
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transition: transform var(--transition-smooth);
}
</style>
