<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  collapsed: boolean
  direction: 'up' | 'down' | 'left' | 'right'
  icon?: 'info' | 'library' | 'wrench' | 'search'
  label?: string
}>()

const tooltip = computed(() => {
  if (props.collapsed && props.label) {
    return `Show ${props.label}`
  }
  return props.collapsed ? 'Expand' : 'Collapse'
})

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
  <button class="panel-toggle" :title="tooltip" @click="emit('toggle')">
    <!-- Icon shown when collapsed -->
    <span v-if="icon" class="toggle-icon" :class="{ visible: collapsed }">
      <!-- Info icon -->
      <svg
        v-if="icon === 'info'"
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <!-- Library icon -->
      <svg
        v-else-if="icon === 'library'"
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
        <path d="m16 6 4 14" />
        <path d="M12 6v14" />
        <path d="M8 8v12" />
        <path d="M4 4v16" />
      </svg>
      <!-- Wrench icon -->
      <svg
        v-else-if="icon === 'wrench'"
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
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        />
      </svg>
      <!-- Search icon -->
      <svg
        v-else-if="icon === 'search'"
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
    </span>

    <!-- Arrow shown when expanded -->
    <span class="toggle-arrow" :class="{ visible: !collapsed || !icon }">
      <span class="arrow" :style="{ transform: getRotation(direction, collapsed) }" />
    </span>
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
  position: relative;
}

.panel-toggle:hover {
  background: rgba(0, 0, 0, 0.8);
  color: var(--text-primary);
}

.toggle-icon,
.toggle-arrow {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 300ms ease,
    transform 300ms ease,
    filter 300ms ease;
}

.toggle-icon {
  opacity: 0;
  transform: scale(0.8);
  filter: blur(4px);
}

.toggle-icon.visible {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}

.toggle-arrow {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}

.toggle-arrow:not(.visible) {
  opacity: 0;
  transform: scale(0.8);
  filter: blur(4px);
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
