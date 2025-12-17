import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { usePostHog } from './composables/usePostHog'

// Initialize PostHog analytics
usePostHog()

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
