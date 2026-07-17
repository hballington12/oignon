import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Base path resolution, in priority order:
//   1. Capacitor (native app) needs relative paths.
//   2. Explicit DEPLOY_BASE override, if set.
//   3. Cloudflare Pages serves from the domain root, so base '/'. CF_PAGES=1 is
//      set automatically by Cloudflare in every build (production AND preview),
//      so this needs no dashboard config and can't be scoped to the wrong env.
//   4. Default '/oignon/' for GitHub Pages, which serves from a sub-path.
const webBase = process.env.DEPLOY_BASE || (process.env.CF_PAGES ? '/' : '/oignon/')

// https://vite.dev/config/
export default defineConfig({
  base: process.env.CAPACITOR ? './' : webBase,
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
