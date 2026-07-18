/**
 * One-origin-to-another library migration for the GitHub Pages -> oignon.dev move.
 *
 * localStorage is per-origin, so a plain redirect would strand every existing
 * user's saved library (bookmarks, followed authors, recent graphs, prefs).
 * Instead we hand the data forward through the URL fragment:
 *
 *   - On the OLD origin (hballington12.github.io) the app reads its OWN
 *     first-party localStorage (always allowed, no storage-partitioning issues),
 *     compresses it, and navigates to oignon.dev/#migrate=<blob>.
 *   - On the NEW origin (oignon.dev) we decode the fragment on boot and merge it
 *     additively into localStorage, then strip the fragment.
 *
 * It is "self-healing": the banner fires on any later visit to the old bookmark,
 * so a user who returns months later still gets their library carried over.
 */

import LZString from 'lz-string'

const OLD_HOST = 'hballington12.github.io'
// The migration link must land on the APP (/app), not the static landing page
// at the root, so the app's boot code runs the import.
const NEW_APP_URL = 'https://oignon.dev/app/'

// Everything we own is namespaced. We skip the transient active-graph cache
// (regenerates on its own, and it's large) and origin-local UI flags.
const MIGRATE_PREFIXES = ['oignon_', 'oignon:']
const RECENTS_KEY = 'oignon_recent_graphs'
const BANNER_DISMISSED_KEY = 'oignon:moveBannerDismissed'
const SKIP_KEYS = new Set<string>(['oignon_graph_cache', BANNER_DISMISSED_KEY])

const MIGRATE_FRAGMENT = '#migrate='

// Keep the migration URL comfortably inside safe navigation limits. Recents
// carry embedded slim caches and are the only heavy part; if the blob exceeds
// this, we drop whole oldest recents (never partial ones, so every migrated
// recent still loads).
const MAX_BLOB_CHARS = 24000

// Array-valued keys are merged by unioning on an id field; everything else is
// treated as a scalar preference.
const ARRAY_ID_FIELDS: Record<string, string> = {
  oignon_bookmarks: 'id',
  oignon_followed_authors: 'id',
  [RECENTS_KEY]: 'sourceId',
}

type LibraryBundle = Record<string, string>

// --- origin checks ---

export function isOldOrigin(): boolean {
  return window.location.hostname === OLD_HOST
}

// --- export side (runs on the old origin) ---

function collectLibrary(): LibraryBundle {
  const bundle: LibraryBundle = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || SKIP_KEYS.has(key)) continue
    if (!MIGRATE_PREFIXES.some((p) => key.startsWith(p))) continue
    const value = localStorage.getItem(key)
    if (value !== null) bundle[key] = value
  }
  return bundle
}

function encode(bundle: LibraryBundle): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(bundle))
}

// Compress the bundle, trimming whole recents from the oldest end only if the
// blob would otherwise be too big for a safe URL.
function encodeWithBudget(bundle: LibraryBundle): { blob: string; trimmedRecents: number } {
  let blob = encode(bundle)
  if (blob.length <= MAX_BLOB_CHARS || !bundle[RECENTS_KEY]) {
    return { blob, trimmedRecents: 0 }
  }

  try {
    // newest first, so pop() drops the oldest
    const recents = (JSON.parse(bundle[RECENTS_KEY]) as Array<{ addedAt?: number }>)
      .slice()
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    let trimmedRecents = 0
    while (recents.length > 0 && blob.length > MAX_BLOB_CHARS) {
      recents.pop()
      trimmedRecents++
      blob = encode({ ...bundle, [RECENTS_KEY]: JSON.stringify(recents) })
    }
    return { blob, trimmedRecents }
  } catch {
    return { blob, trimmedRecents: 0 }
  }
}

export function buildMigrationUrl(): { url: string; trimmedRecents: number } {
  const { blob, trimmedRecents } = encodeWithBudget(collectLibrary())
  return { url: `${NEW_APP_URL}${MIGRATE_FRAGMENT}${blob}`, trimmedRecents }
}

// --- import side (runs on the new origin) ---

function clearMigrationFragment(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

function mergeArrayById(existingRaw: string | null, incomingRaw: string, idField: string): string {
  let incoming: Array<Record<string, unknown>>
  try {
    const parsed = JSON.parse(incomingRaw)
    if (!Array.isArray(parsed)) return existingRaw ?? incomingRaw
    incoming = parsed
  } catch {
    return existingRaw ?? incomingRaw
  }

  let existing: Array<Record<string, unknown>> = []
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw)
      if (Array.isArray(parsed)) existing = parsed
    } catch {
      // fall through with empty existing
    }
  }

  // Existing (new-origin) entries win on id collision.
  const seen = new Set(existing.map((e) => e?.[idField]))
  const merged = existing.slice()
  for (const item of incoming) {
    const id = item?.[idField]
    if (!seen.has(id)) {
      merged.push(item)
      seen.add(id)
    }
  }
  return JSON.stringify(merged)
}

/**
 * If the current URL carries a migrated library, merge it into localStorage.
 * Additive: array keys union by id (existing wins), scalar prefs only fill gaps.
 * Runs before the store initializes. Returns true if anything was imported.
 */
export function importLibraryFromUrl(): boolean {
  if (isOldOrigin()) return false
  const hash = window.location.hash
  if (!hash.startsWith(MIGRATE_FRAGMENT)) return false

  try {
    const json = LZString.decompressFromEncodedURIComponent(hash.slice(MIGRATE_FRAGMENT.length))
    if (!json) return false
    const bundle = JSON.parse(json) as LibraryBundle
    if (!bundle || typeof bundle !== 'object') return false

    for (const [key, value] of Object.entries(bundle)) {
      if (typeof value !== 'string') continue
      const idField = ARRAY_ID_FIELDS[key]
      if (idField) {
        localStorage.setItem(key, mergeArrayById(localStorage.getItem(key), value, idField))
      } else if (localStorage.getItem(key) === null) {
        // scalar preference: never clobber a choice the user already made here
        localStorage.setItem(key, value)
      }
    }
    return true
  } catch {
    return false
  } finally {
    clearMigrationFragment()
  }
}

// --- banner dismissal (old origin) ---

export function isMoveBannerDismissed(): boolean {
  return localStorage.getItem(BANNER_DISMISSED_KEY) === '1'
}

export function dismissMoveBanner(): void {
  localStorage.setItem(BANNER_DISMISSED_KEY, '1')
}
