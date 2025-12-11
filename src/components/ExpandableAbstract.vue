<script setup lang="ts">
defineProps<{
  abstract: string
  truncateLength?: number
}>()

const emit = defineEmits<{
  expand: []
}>()
</script>

<template>
  <div class="abstract-container">
    <div class="abstract-label">Abstract</div>
    <p class="abstract-text" @click="emit('expand')">
      {{ abstract.slice(0, truncateLength ?? 300)
      }}{{ abstract.length > (truncateLength ?? 300) ? '...' : '' }}
      <span v-if="abstract.length > (truncateLength ?? 300)" class="expand-hint"
        >tap to expand</span
      >
    </p>
  </div>
</template>

<style scoped>
.abstract-container {
  position: relative;
}

.abstract-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--spacing-xs);
}

.abstract-text {
  font-size: var(--font-size-base);
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.abstract-text:hover {
  color: var(--text-secondary);
}

.expand-hint {
  display: inline-block;
  margin-left: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--accent-link);
  font-style: italic;
}
</style>
