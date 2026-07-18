import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const cfPages = !!process.env.CF_PAGES

// Base path resolution, in priority order:
//   1. Capacitor (native app) needs relative paths.
//   2. Explicit DEPLOY_BASE override, if set.
//   3. Cloudflare Pages: the app lives under /app (oignon.dev root is the
//      marketing landing page). CF_PAGES=1 is set automatically by Cloudflare in
//      every build (production AND preview), so this needs no dashboard config.
//   4. Default '/oignon/' for GitHub Pages, which serves from a sub-path.
const webBase = process.env.DEPLOY_BASE || (cfPages ? '/app/' : '/oignon/')

// On Cloudflare we build the app into dist/app/ so the landing page (assembled
// by scripts/assemble-landing.mjs) can own dist/ root. Elsewhere, plain dist/.
const outDir = cfPages ? 'dist/app' : 'dist'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.CAPACITOR ? './' : webBase,
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
  },
})
