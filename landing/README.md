# Landing page (oignon.dev root)

- This directory is the **marketing landing page** served at `oignon.dev/`.
- The Vue app is separate and lives at `oignon.dev/app` (built from `src/`).
- On a Cloudflare Pages build, `scripts/assemble-landing.mjs` copies everything
  here into `dist/` root, alongside the built app in `dist/app/`.

## Files

- `index.html` — the landing page (exported from Claude design). App/home links
  are root-relative (`/app/`, `/`) so they work on preview and prod. SEO/social
  meta (title, description, favicon, Open Graph, Twitter card) was added to the
  `<head>` by hand; keep them if you re-export the design.
- `graph-*.js`, `oignon-runtime.js`, `support.js`, `assets/`, `_ds/` — the
  design's static bundle (GPU-render demo, design-system tokens, SVG icons).
- `_redirects` — Cloudflare routing rules. Do not delete. `/g/*` rewrites to the
  app shell so share links work; `/api/*` is handled by Pages Functions.

## Re-exporting / updating the design

1. Replace `index.html` (+ assets) with the new export.
2. Keep paths root-relative, and avoid an `app/` subfolder name here (that path
   belongs to the Vue app).
3. Keep the `/app/` launch button, the `_redirects` file, and the `<head>` meta.
4. For landing-page analytics, add the PostHog snippet directly to `index.html`
   (the app tracks itself separately).

## Nice-to-have follow-up

- Social preview currently uses `assets/icon-gradient.svg`. Some platforms don't
  render an SVG `og:image`; a 1200x630 PNG social card gives reliable link
  previews. Drop it in here and point `og:image` / `twitter:image` at it.

## Local preview of the full Cloudflare structure

```
CF_PAGES=1 npm run build      # app -> dist/app, landing -> dist root
npx serve dist                # or any static server; visit / and /app/
```

Note: `/api/*` (share links) only runs on a real Cloudflare deploy, not a local
static server.
