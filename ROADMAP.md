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
- [~] `[H+C]` GitHub Pages transition. Bridge BUILT on branch `feature/library-migration` (awaiting test + merge): dismissible "we've moved" banner on the old origin does a first-party URL handoff (`oignon.dev/#migrate=<lz-string blob>`); the new origin imports before store init and merges additively (union by id, existing wins; scalar prefs fill gaps; oldest recents dropped if over a size budget). Self-healing on any later visit. Chose banner+bridge over blind redirect (would strand per-origin localStorage) and over hidden-iframe postMessage (storage partitioning breaks it in Safari/Chrome). Still TODO after this lands: decide whether to add a hard redirect later, optionally route oversized libraries through the share Worker for no size cap.
- [ ] `[C]` **Graph sharing via Worker-backed short links** (moved up from Phase 2; it's the core growth loop and depends on the domain + Cloudflare, so it belongs here). Design: a Cloudflare Worker + KV. Client compresses the slim cache (reuse the parked `feature/graph-sharing` encode logic) and POSTs it; the Worker stores it under a short code and returns `oignon.dev/g/abc123`. Opening that link fetches the blob and rehydrates from OpenAlex via the already-built `loadSharedGraph` path. No auth for anonymous shares. Fire `graph_shared`. This is the domain-based method that replaces the URL-fragment approach, and it works regardless of graph size.
- [ ] `[C]` Landing page at the root domain (`oignon.dev`): headline positioning, 30-second demo recording, screenshots, "try it" straight into the app. App at `oignon.dev/app` or `app.oignon.dev`.
- [ ] `[C]` Landing page copy built on the two wedges: open-source/no-signup/private, and "paste your .bbl, see what your bibliography is missing before your reviewer does."
- [ ] `[C]` Changelog page (visible pulse; a dead-looking tool loses trust in academia).
- [ ] `[C]` In-app feedback link (GitHub issues or a simple form).
- [ ] `[C]` Repo hygiene: remove stale `v2-panel-styling` trigger from deploy.yml once `[H]` confirms the remote branch can be deleted.

## Phase 2 — Product deepening

- [ ] `[C]` BibTeX export (feeds oignon into people's actual writing workflow).
- [ ] `[C]` RIS export for Zotero import (stickiness with reference managers).
- [ ] `[C]` Visual ring/badge for source nodes in multi-paper graphs (flagged during multi-graph testing).
- [ ] `[C]` Competitor teardown doc: feature-by-feature vs Connected Papers, Litmaps, ResearchRabbit, Inciteful. Sharpens landing copy and finds gaps.

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
