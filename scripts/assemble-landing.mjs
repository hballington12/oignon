// Postbuild step (runs after `npm run build`).
//
// On Cloudflare Pages, Vite builds the Vue app into dist/app/ (base /app/). This
// script then lays the marketing landing page + routing rules over dist/ root,
// producing the final structure Cloudflare serves:
//
//   dist/
//     index.html        <- landing page (oignon.dev)
//     _redirects        <- /g/* rewrite to the app shell, etc.
//     <landing assets>
//     app/              <- the Vue app (oignon.dev/app)
//       index.html, assets/, ...
//
// It is a no-op anywhere CF_PAGES is not set (local builds, GitHub Pages CI),
// so those keep producing a plain dist/ with the app at the root of their base.

import { cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

if (!process.env.CF_PAGES) {
  process.exit(0)
}

const cwd = process.cwd()
const landingDir = path.join(cwd, 'landing')
const distDir = path.join(cwd, 'dist')

if (!existsSync(landingDir)) {
  console.error('[assemble-landing] landing/ not found; nothing to place at dist/ root')
  process.exit(1)
}

// Copy everything in landing/ (index.html, _redirects, assets) into dist/ root,
// alongside the already-built dist/app/. The README is docs-only, not shipped.
await cp(landingDir, distDir, {
  recursive: true,
  filter: (src) => path.basename(src) !== 'README.md',
})
console.log('[assemble-landing] placed landing/ at dist/ root (app is at dist/app/)')
