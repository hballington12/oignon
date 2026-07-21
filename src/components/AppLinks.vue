<script setup lang="ts">
// Small footer row of project links: feedback (GitHub issues), what's new
// (CHANGELOG), and the repo. Uses the same repo the app is published from.
const REPO = 'https://github.com/hballington12/oignon'

const links = [
  { label: 'Feedback', href: `${REPO}/issues/new`, title: 'Report a bug or suggest a feature' },
  { label: "What's new", href: `${REPO}/blob/main/CHANGELOG.md`, title: 'Recent changes' },
  { label: 'Privacy', href: `${REPO}/blob/main/PRIVACY.md`, title: 'Privacy policy' },
  { label: 'GitHub', href: REPO, title: 'Source code' },
]
</script>

<template>
  <div class="app-links">
    <template v-for="(link, i) in links" :key="link.label">
      <span v-if="i > 0" class="sep" aria-hidden="true">·</span>
      <a :href="link.href" target="_blank" rel="noopener noreferrer" :title="link.title">
        {{ link.label }}
      </a>
    </template>
  </div>
</template>

<style scoped>
.app-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 8px 4px;
  font-size: 12px;
  color: var(--text-muted, #8a8a99);
}

.app-links a {
  color: var(--text-muted, #8a8a99);
  text-decoration: none;
  transition: color 0.15s ease;
}

.app-links a:hover {
  color: var(--text-primary, #fff);
}

.sep {
  color: var(--text-muted, #8a8a99);
  opacity: 0.5;
}
</style>
