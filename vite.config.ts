import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Base path resolution, in priority order:
//   1. Capacitor (native app) needs relative paths.
//   2. DEPLOY_BASE env var lets a host override it (Cloudflare Pages sets '/'
//      because it serves from the domain root, oignon.dev).
//   3. Default '/oignon/' for GitHub Pages, which serves from a sub-path.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.CAPACITOR ? './' : process.env.DEPLOY_BASE || '/oignon/',
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
