<script setup lang="ts">
import { computed } from 'vue'
import PanelToggle from '@/components/PanelToggle.vue'

export type TogglePosition = 'upper-east' | 'upper-west' | 'lower-east' | 'lower-west'

const props = withDefaults(
  defineProps<{
    /** Toggle button position relative to panel */
    togglePosition: TogglePosition
    /** Width of the panel when expanded */
    width?: number
  }>(),
  {
    width: 200,
  },
)

const collapsed = defineModel<boolean>('collapsed', { default: false })

function toggle() {
  collapsed.value = !collapsed.value
}

// Determine flex direction based on east/west
const isEast = computed(() => props.togglePosition.includes('east'))
const isLower = computed(() => props.togglePosition.includes('lower'))

// Arrow direction: east = points right when open, west = points left when open
const arrowDirection = computed(() => (isEast.value ? 'right' : 'left'))

// Wrapper alignment for lower positions
const wrapperAlignment = computed(() => (isLower.value ? 'flex-end' : 'flex-start'))
</script>

<template>
  <div
    class="collapsible-panel-wrapper"
    :class="{
      'toggle-east': isEast,
      'toggle-west': !isEast,
    }"
    :style="{ alignItems: wrapperAlignment }"
  >
    <PanelToggle
      class="panel-toggle-btn"
      :collapsed="collapsed"
      :direction="arrowDirection"
      @toggle="toggle"
    />

    <div
      class="collapsible-panel"
      :class="{ collapsed }"
      :style="{ '--panel-width': `${width}px` }"
    >
      <div class="panel-content" :style="{ width: `${width}px` }">
        <slot />
      </div>
    </div>
  </div>
</template>

<style>
@import '@/assets/styles/panel.css';
</style>

<style scoped>
.collapsible-panel-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--spacing-sm);
}

/* East: toggle on right side of panel - use row-reverse so panel shrinks toward toggle */
.collapsible-panel-wrapper.toggle-east {
  flex-direction: row-reverse;
}

/* West: toggle on left side of panel */
.collapsible-panel-wrapper.toggle-west {
  flex-direction: row;
}

.collapsible-panel {
  width: var(--panel-width);
  min-width: var(--panel-width);
  pointer-events: auto;
}

.panel-content {
  flex-shrink: 0;
}

.panel-toggle-btn {
  flex-shrink: 0;
  pointer-events: auto;
}
</style>
