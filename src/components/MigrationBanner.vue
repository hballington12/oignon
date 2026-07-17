<script setup lang="ts">
import { ref } from 'vue'
import { buildMigrationUrl, dismissMoveBanner } from '@/lib/libraryMigration'

const emit = defineEmits<{ dismiss: [] }>()

const busy = ref(false)

function moveLibrary() {
  busy.value = true
  // Read our own first-party localStorage, compress it, and hand it to
  // oignon.dev through the URL fragment. Cross-origin navigation, no server.
  const { url } = buildMigrationUrl()
  window.location.href = url
}

function dismiss() {
  dismissMoveBanner()
  emit('dismiss')
}
</script>

<template>
  <div class="migration-banner">
    <span class="banner-text">
      <strong>oignon has a new home:</strong> oignon.dev. Bring your saved library
      (bookmarks, followed authors, recent graphs) across in one click.
    </span>
    <div class="banner-actions">
      <button class="banner-btn primary" :disabled="busy" @click="moveLibrary">
        {{ busy ? 'Moving…' : 'Bring my library →' }}
      </button>
      <button class="banner-btn dismiss" aria-label="Dismiss" @click="dismiss">✕</button>
    </div>
  </div>
</template>

<style scoped>
.migration-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-floating, 1000);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 16px;
  padding-top: calc(10px + env(safe-area-inset-top));
  background: #7c3aed;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

.banner-text {
  max-width: 640px;
  line-height: 1.35;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.banner-btn {
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;
}

.banner-btn.primary {
  padding: 7px 14px;
  border: none;
  background: #fff;
  color: #6d28d9;
  white-space: nowrap;
}

.banner-btn.primary:hover {
  background: #f3e8ff;
}

.banner-btn.primary:disabled {
  opacity: 0.7;
  cursor: default;
}

.banner-btn.dismiss {
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: transparent;
  color: #fff;
}

.banner-btn.dismiss:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
