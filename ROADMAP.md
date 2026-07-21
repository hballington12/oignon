# Oignon Product Roadmap

Goal: turn oignon from a side project into a real product. Free and unlimited stays the strategy.
Positioning: **the open-source citation graph tool. No signup, no quota, nothing leaves your browser.**
Hook feature: bibliography import ("find what your literature review is missing").

Owner key: `[H]` = Harry only (accounts, purchases, identity), `[C]` = Claude can do it, `[H+C]` = together.

## Phase 0 — Recover and quick wins (no infra needed)

- [x] `[H]` Recover PostHog login at us.posthog.com. DONE — US site was the key, analytics confirmed working, project is salvageable.
- [x] `[C]` Fix analytics event volume: removed per-request capture; `api_calls` now rides on `graph_built`. DONE on branch `feature/analytics-and-polite-pool` (pending test + merge).
- [x] `[C]` Add funnel events: `graph_exported`, `bibliography_imported`, `paper_bookmarked`, plus graph mode on `graph_built`. `graph_shared` defined, wired when sharing ships. DONE on same branch.
- [x] `[C]` Add OpenAlex polite-pool `mailto=oignonapp@gmail.com` at the single `apiFetch` chokepoint. DONE on same branch.
- [~] Sharing MOVED to Phase 1 as domain-based short links. The URL-fragment prototype (compressed slim cache in `#g=...`) is parked on branch `feature/graph-sharing`, NOT shipped: real graphs are typically 200+ nodes, which produce 8KB+ URLs that get truncated in most share contexts (Twitter, email clients). Its encode/decode + load-from-URL + `loadSharedGraph` logic is reused by the Worker method, so ~70% of it carries over.
- [x] `[H]` Enable GitHub Sponsors — signed up. `[C]` add FUNDING.yml (pending confirmation Sponsors is approved/live).
- [x] `[H+C]` Citability — DONE via arXiv, DOI already in README. Zenodo route dropped as redundant. `[C]` may still surface "How to cite" inside the app UI.

## Phase 1 — Domain, web presence, and sharing

- [x] `[H]` Domain purchased: **oignon.dev**. Note: `.dev` is HSTS-preloaded, so HTTPS is mandatory (Cloudflare provides it automatically, no action needed, but no plain-HTTP fallback exists).
- [x] `[H+C]` Migrate hosting to Cloudflare Pages. DONE: oignon.dev live, DNS on Cloudflare, Pages builds from main, custom domain CNAME'd to oignon.pages.dev. Root base path handled by auto-detecting `CF_PAGES` in vite.config (no dashboard env needed). Verified: served HTML uses root-relative `/assets/...` and the JS bundle returns 200.
- [x] `[H+C]` GitHub Pages transition bridge. LIVE on main (tested locally, merged): dismissible "we've moved" banner on the old origin does a first-party URL handoff (`oignon.dev/#migrate=<lz-string blob>`); the new origin imports before store init and merges additively (union by id, existing wins; scalar prefs fill gaps; oldest recents dropped if over a size budget). Self-healing on any later visit. Chose banner+bridge over blind redirect (would strand per-origin localStorage) and over hidden-iframe postMessage (storage partitioning breaks it in Safari/Chrome). Follow-ups (not urgent): add a hard github.io->oignon.dev redirect once enough users have migrated; optionally route oversized libraries through the share Worker for no size cap.
- [x] `[C]` **Graph sharing via Worker-backed short links**. LIVE (tested on Cloudflare preview, merged, KV `SHARE_KV` bound prod+preview). Implemented as Cloudflare **Pages Functions** (co-deploys with the site, no separate wrangler): `functions/api/share.js` POST stores the compressed slim cache in KV under a random 8-char code; `functions/api/share/[code].js` GET returns it. Share links (`/g/<code>`) are routed by the `functions/g/[code].js` Function, which 302-redirects to `/app/#g=<code>`; the app reads the code from the fragment, fetches, and rehydrates via `store.loadSharedGraph`. (Routing history: a `_redirects` `/g/* /app/index.html 200` rewrite was silently shadowed by Cloudflare's SPA fallback to the root landing page; serving the shell via `env.ASSETS` 500'd; a dependency-free 302 redirect is the reliable form.) Client in `src/lib/graphShare.ts`; Share button back in FloatingControls; fires `graph_shared`. Works at any graph size (only IDs travel). `[H]` TODO: create a KV namespace and bind it as `SHARE_KV` on the Pages project (production AND preview). Follow-up: this same endpoint can give the library-migration bridge a no-size-cap path.
- [~] Landing/app split DECIDED: landing at `oignon.dev`, app moves to `oignon.dev/app`. Plumbing BUILT on branch `feature/landing-app-split` (awaiting the real landing page + test + merge): vite base `/app/` + `dist/app/` output on Cloudflare, `scripts/assemble-landing.mjs` postbuild lays `landing/` over `dist/` root, `landing/_redirects` rewrites `/g/*` to the app shell, share-link + migration URLs retargeted to `/app`. Placeholder `landing/index.html` in place.
- [x] `[H]` Real landing page built in Claude design (GPU-render demo bundle), dropped into `landing/`, links retargeted root-relative, SEO/social meta added. On branch `feature/landing-app-split`, pushed for Cloudflare preview. `[H+C]` TODO: eyeball the preview (`/`, Launch → `/app`, a share link), then merge.
- [x] `[C]` Changelog + in-app feedback links. LIVE: `AppLinks` footer in the search overlay (Feedback → GitHub issues, What's new → `CHANGELOG.md`, GitHub → repo) + `CHANGELOG.md`.
- [x] `[C]` Official favicon. LIVE: brand SVG set in `brand/`; app tab uses `favicon.svg` (gradient) + raster `favicon.ico` (16/32/48) + `apple-touch-icon.png` (so Safari/iOS and .ico fallbacks show the brand, not the Vite default).
- [ ] `[C]` Repo hygiene: remove stale `v2-panel-styling` trigger from deploy.yml once `[H]` confirms the remote branch can be deleted.

## Phase 2 — Product deepening

- [ ] `[C]` BibTeX export (feeds oignon into people's actual writing workflow).
- [ ] `[C]` RIS export for Zotero import (stickiness with reference managers).
- [ ] `[C]` Visual ring/badge for source nodes in multi-paper graphs (flagged during multi-graph testing).
- [ ] `[C]` Competitor teardown doc: feature-by-feature vs Connected Papers, Litmaps, ResearchRabbit, Inciteful. Sharpens landing copy and finds gaps.

## Pre-launch hardening (before going truly public)

- [x] `[C]` Security headers (`landing/_headers`, site-wide): nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy. Verified served on preview. Full CSP deferred (needs testing vs inline landing scripts + OpenAlex/PostHog).
- [x] `[C]` Legal/brand: license set to MIT (code); `TRADEMARK.md` carve-out (name + logo reserved, © Harry Ballington); README License-and-brand section; `PRIVACY.md` updated to disclose share-link KV storage + Privacy link in app footer.
- [ ] `[H]` **Cloudflare rate-limiting rule on `POST /api/share`** (highest security item; the endpoint is unauthenticated). Dashboard → Security → WAF → Rate limiting rules. Optionally Turnstile on share creation.
- [x] `[H]` Trademark clearance DONE: EUIPO + USPTO searched. No "oignon" mark in software classes (9/42) — hits are food (SOIGNON goat cheese), an onion farm (descriptive, food class), and appliances (USPTO class 11). Clear to use "oignon" for research software (arbitrary=strong mark there). Use ™ now; register logo+wordmark in 9/42 only if it grows.
- [ ] `[H]` Confirm IP ownership with Wuppertal tech-transfer/legal (university-employee IP may be claimable) before public launch / any monetization.
- [ ] `[C]` (optional) Content-Security-Policy, tested on preview. `[C]` (optional) share TTL if KV storage growth becomes a concern (weigh vs link permanence for citability).

## Phase 3 — Launch and channels (order matters: loops before spikes)

- [ ] `[H+C]` Show HN launch. Only after domain + landing + sharing are live, or the traffic spike is wasted. `[C]` draft the post.
- [ ] `[H]` Product Hunt launch (needs a personal account).
- [ ] `[H]` Project account on Bluesky/Mastodon. `[C]` script the 30-second bibliography-to-graph screen recording.
- [ ] `[H+C]` Outreach to academic-productivity YouTubers with the demo clip. `[C]` draft the pitch email and target list.
- [ ] `[H]` Reddit presence: r/PhD, r/GradSchool, r/AskAcademia. Answer lit-review threads genuinely, no ads.
- [ ] `[H+C]` Librarian channel: `[C]` write a one-page "for librarians" PDF, `[H]` email subject librarians starting with Wuppertal.
- [ ] `[H+C]` Submit oignon to OpenAlex's tool showcase / get on their radar.

## Phase 4 — Later, only when the need is real

- [ ] Auth + cross-device sync via Supabase (Google login, Postgres, storage in one). Trigger: users asking for sync or owned share links, not before.
- [ ] Consider PostHog EU cloud if ever restarting the analytics project (GDPR tidiness).
- [ ] Modularize oversized files: MobileSearchOverlay.vue (~750 lines), stores/graph.ts (~930), App.vue (~720).

## Standing constraints

- Live app with real users: all localStorage/SlimCache changes must be purely additive.
- Deploys trigger on any push to main.
- Every server added is a permanent obligation; the plan adds exactly one Worker.
