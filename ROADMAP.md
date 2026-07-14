# Oignon Product Roadmap

Goal: turn oignon from a side project into a real product. Free and unlimited stays the strategy.
Positioning: **the open-source citation graph tool. No signup, no quota, nothing leaves your browser.**
Hook feature: bibliography import ("find what your literature review is missing").

Owner key: `[H]` = Harry only (accounts, purchases, identity), `[C]` = Claude can do it, `[H+C]` = together.

## Phase 0 — Recover and quick wins (no infra needed)

- [x] `[H]` Recover PostHog login at us.posthog.com. DONE — US site was the key, analytics confirmed working, project is salvageable.
- [ ] `[C]` Fix analytics event volume: remove per-request `openalex_api_call` capture, attach `api_calls` count as a property on `graph_built` instead.
- [ ] `[C]` Add funnel events: `graph_shared`, `graph_exported`, `bibliography_imported`, plus graph mode on `graph_built`. Target metrics: activation (first graph), 14-day return, shares created, mode usage.
- [ ] `[C]` Add OpenAlex polite-pool `mailto=` param to all API requests. Address decided: `oignonapp@gmail.com` (also the shared project account for PostHog/domain/Sponsors/socials).
- [ ] `[C]` URL-fragment share links: compressed slim cache in `#g=...`. Works on GitHub Pages today, zero infra. Shared graphs open as a full working app with a subtle "built with oignon" affordance.
- [x] `[H]` Enable GitHub Sponsors — signed up. `[C]` add FUNDING.yml (pending confirmation Sponsors is approved/live).
- [x] `[H+C]` Citability — DONE via arXiv, DOI already in README. Zenodo route dropped as redundant. `[C]` may still surface "How to cite" inside the app UI.

## Phase 1 — Domain and web presence

- [ ] `[H]` Pick and buy a domain (check `oignon.app` first, fallback `getoignon.com`).
- [ ] `[H+C]` Migrate hosting to Cloudflare Pages (same static Vite build). Keep GitHub Pages as a redirect during transition.
- [ ] `[C]` Landing page at the root domain: headline positioning, 30-second demo recording, screenshots, "try it" straight into the app. App at `/app` or `app.` subdomain.
- [ ] `[C]` Landing page copy built on the two wedges: open-source/no-signup/private, and "paste your .bbl, see what your bibliography is missing before your reviewer does."
- [ ] `[C]` Changelog page (visible pulse; a dead-looking tool loses trust in academia).
- [ ] `[C]` In-app feedback link (GitHub issues or a simple form).
- [ ] `[C]` Repo hygiene: remove stale `v2-panel-styling` trigger from deploy.yml once `[H]` confirms the remote branch can be deleted.

## Phase 2 — Sharing backend and product deepening

- [ ] `[C]` Cloudflare Worker + KV short share links: POST slim cache, get `oignon.app/g/abc123`. No auth needed for anonymous shares.
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
