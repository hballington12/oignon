// GET /g/:code — serve the app shell for a share link.
//
// This is a Pages Function rather than a `_redirects` rewrite on purpose:
// Functions have deterministic routing precedence, whereas a
// `/g/* /app/index.html 200` rewrite was silently shadowed by Cloudflare's SPA
// fallback, which served the root landing page (support.js/graph-data.js) at
// /g/<code> and broke every share link.
//
// We serve /app/index.html verbatim (URL stays /g/<code>). The app boots with
// base /app/, reads the code from the path, and fetches the graph from
// /api/share/:code.
export async function onRequest(context) {
  const { request, env } = context
  const appShell = new URL(request.url)
  appShell.pathname = '/app/index.html'
  return env.ASSETS.fetch(new Request(appShell.toString(), request))
}
