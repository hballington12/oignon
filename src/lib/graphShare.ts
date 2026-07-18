/**
 * Graph sharing via short links (oignon.dev/g/<code>).
 *
 * The client compresses the slim cache (numeric IDs + connections only, no
 * metadata) into an opaque blob and POSTs it to /api/share, a Cloudflare Pages
 * Function backed by KV. It returns a short code; the share URL is
 * `<origin>/g/<code>`. Opening that link fetches the blob back and rehydrates
 * full paper metadata from OpenAlex via the store's loadSharedGraph path, so
 * only IDs travel and the link stays short regardless of graph size.
 *
 * The compression envelope is versioned so the format can evolve without
 * breaking old links.
 */

import LZString from 'lz-string'
import type { SlimCache } from '@/types'

const SHARE_SCHEMA_VERSION = 1

interface SharePayload {
  v: number
  c: SlimCache
}

export function encodeGraph(slim: SlimCache): string {
  const payload: SharePayload = { v: SHARE_SCHEMA_VERSION, c: slim }
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeGraph(encoded: string): SlimCache | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const payload = JSON.parse(json) as SharePayload
    if (!payload || payload.v !== SHARE_SCHEMA_VERSION) return null
    if (!payload.c?.slim || !Array.isArray(payload.c.nodes)) return null
    return payload.c
  } catch {
    return null
  }
}

/** POST the graph, get a short code back, return the full share URL. */
export async function createShareLink(slim: SlimCache): Promise<string> {
  const res = await fetch('/api/share', { method: 'POST', body: encodeGraph(slim) })
  if (!res.ok) throw new Error(`share failed: ${res.status}`)
  const { code } = (await res.json()) as { code?: string }
  if (!code) throw new Error('share failed: no code returned')
  return `${window.location.origin}/g/${code}`
}

const SHARE_PATH = /^\/g\/([A-Za-z0-9]+)\/?$/

/** If the current URL is a share link, return its code. */
export function readShareCodeFromUrl(): string | null {
  const match = window.location.pathname.match(SHARE_PATH)
  return match?.[1] ?? null
}

/** Fetch and decode a shared graph by code, or null if missing/invalid. */
export async function fetchSharedGraph(code: string): Promise<SlimCache | null> {
  try {
    const res = await fetch(`/api/share/${code}`)
    if (!res.ok) return null
    return decodeGraph(await res.text())
  } catch {
    return null
  }
}

/** Replace /g/<code> with / (no reload, no history entry) once it's loaded. */
export function clearSharePath(): void {
  window.history.replaceState(null, '', '/')
}
