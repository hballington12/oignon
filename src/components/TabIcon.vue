<script setup lang="ts">
import { TAB_ICON_SIZE, type TabId } from '@/types/mobile'

defineProps<{
  tab: TabId
  size?: number
}>()
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size ?? TAB_ICON_SIZE"
    :height="size ?? TAB_ICON_SIZE"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- Search icon -->
    <template v-if="tab === 'search'">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </template>

    <!-- Details/Info icon -->
    <template v-else-if="tab === 'details'">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </template>

    <!-- Library icon -->
    <template v-else-if="tab === 'library'">
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </template>

    <!-- Controls/Wrench icon -->
    <template v-else-if="tab === 'controls'">
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
      />
    </template>
  </svg>
</template>
