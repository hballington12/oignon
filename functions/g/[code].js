// GET /g/:code — redirect a share link into the app, carrying the code in the
// fragment (/app/#g=:code). The app reads it client-side and fetches the graph
// from /api/share/:code.
//
// Why a redirect (not an ASSETS rewrite):
//   - Functions have routing precedence over Cloudflare's SPA fallback, which
//     otherwise served the root landing page at /g/<code> and broke share links.
//   - A 302 is dependency-free. Serving /app/index.html via env.ASSETS 500'd
//     (the ASSETS binding isn't reliably available here); Response.redirect
//     needs no bindings and can't fail that way.
export async function onRequest(context) {
  const { request, params } = context
  const origin = new URL(request.url).origin
  return Response.redirect(`${origin}/app/#g=${params.code}`, 302)
}
