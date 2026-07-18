// GET /api/share/:code
//
// Returns the stored graph blob for a share code, or 404 if it doesn't exist.
// The blob is opaque (client-compressed); we hand it back verbatim. Shares are
// immutable, so it's safe to cache hard.

export async function onRequestGet({ params, env }) {
  if (!env.SHARE_KV) return new Response('sharing not configured', { status: 503 })

  const code = params.code
  if (!code || Array.isArray(code)) return new Response('missing code', { status: 400 })

  const blob = await env.SHARE_KV.get(code)
  if (blob === null) return new Response('not found', { status: 404 })

  return new Response(blob, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
