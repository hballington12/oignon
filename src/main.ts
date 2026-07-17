import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { usePostHog } from './composables/usePostHog'
import { importLibraryFromUrl } from './lib/libraryMigration'

// If we arrived via a "bring my library" migration link from the old GitHub
// Pages origin, merge that library into localStorage before the store reads it.
importLibraryFromUrl()

// Initialize PostHog analytics
usePostHog()

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
