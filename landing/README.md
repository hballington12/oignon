# Landing page (oignon.dev root)

- This directory is the **marketing landing page** served at `oignon.dev/`.
- The Vue app is separate and lives at `oignon.dev/app` (built from `src/`).
- On a Cloudflare Pages build, `scripts/assemble-landing.mjs` copies everything
  here into `dist/` root, alongside the built app in `dist/app/`.

## Files

- `index.html` — the landing page. Currently a placeholder; replace with the
  real design.
- `_redirects` — Cloudflare routing rules. Do not delete. `/g/*` rewrites to the
  app shell so share links work; `/api/*` is handled by Pages Functions.

## Dropping in the real design

1. Replace `index.html` with the exported design.
2. Put any assets it needs (css, js, images) in this directory; they'll land at
   `oignon.dev/<file>`. Keep paths root-relative (e.g. `/styles.css`), and avoid
   an `app/` subfolder name here (that path belongs to the Vue app).
3. Keep a link/button to `/app/` so visitors can launch the tool.
4. Keep `_redirects` as-is.
5. If you want analytics on the landing page, add the PostHog snippet directly
   to `index.html` (the app tracks itself separately).

## Local preview of the full Cloudflare structure

```
CF_PAGES=1 npm run build      # app -> dist/app, landing -> dist root
npx serve dist                # or any static server; visit / and /app/
```

Note: `/api/*` (share links) only runs on a real Cloudflare deploy, not a local
static server.
