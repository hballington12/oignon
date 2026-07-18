// POST /api/share
//
// Cloudflare Pages Function that stores a shared graph and returns a short code.
// The body is an opaque, already-compressed blob (the client compresses the
// slim cache with lz-string); this Function never parses it, it just stores the
// string in KV under a random code. Retrieval is GET /api/share/:code.
//
// Requires a KV namespace bound as SHARE_KV in the Pages project settings.

const MAX_BYTES = 1_000_000 // generous cap; compressed slim caches are tiny
const CODE_LEN = 8
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function makeCode() {
  const bytes = new Uint8Array(CODE_LEN)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export async function onRequestPost({ request, env }) {
  if (!env.SHARE_KV) return json({ error: 'sharing not configured' }, 503)

  const body = await request.text()
  if (!body) return json({ error: 'empty body' }, 400)
  if (body.length > MAX_BYTES) return json({ error: 'graph too large to share' }, 413)

  // Random code; the alphabet^8 space makes collisions astronomically unlikely,
  // but a couple of cheap existence checks cost nothing and remove all doubt.
  let code = makeCode()
  for (let i = 0; i < 3; i++) {
    if ((await env.SHARE_KV.get(code)) === null) break
    code = makeCode()
  }

  await env.SHARE_KV.put(code, body)
  return json({ code })
}
