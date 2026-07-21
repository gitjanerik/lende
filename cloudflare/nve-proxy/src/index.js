// Lende — NVE HydAPI-proxy (Cloudflare Worker).
//
// HydAPI (https://hydapi.nve.no) krever en API-nøkkel sendt som `X-API-Key`.
// Vite inliner klient-env i den offentlige bundelen, så nøkkelen kan ikke bo i
// nettleseren. Denne Worker-en holder nøkkelen server-side (som en Cloudflare-
// secret `NVE_HYDAPI_KEY`) og speiler KUN de to endepunktene Lende bruker:
//   GET /api/v1/Stations
//   GET /api/v1/Observations
// Alt annet gir 404 — Worker-en er bevisst ingen åpen proxy. Query-strengen
// videresendes uendret; svaret speiles med CORS-headere så nettleseren godtar
// det. Uten secret settes → 500 (ingen kall til NVE).

const HYDAPI_ORIGIN = 'https://hydapi.nve.no'
const ALLOWED_PATHS = new Set(['/api/v1/Stations', '/api/v1/Observations'])
const ALLOWED_ORIGINS = new Set([
  'https://gitjanerik.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://gitjanerik.github.io'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: cors })
    }

    const url = new URL(request.url)
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response('Not Found', { status: 404, headers: cors })
    }
    if (!env.NVE_HYDAPI_KEY) {
      return new Response('NVE_HYDAPI_KEY er ikke satt i Worker-en.', {
        status: 500,
        headers: cors,
      })
    }

    const target = `${HYDAPI_ORIGIN}${url.pathname}${url.search}`
    let upstream
    try {
      upstream = await fetch(target, {
        headers: { Accept: 'application/json', 'X-API-Key': env.NVE_HYDAPI_KEY },
      })
    } catch {
      return new Response('Kunne ikke nå NVE HydAPI.', { status: 502, headers: cors })
    }

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...cors,
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    })
  },
}
