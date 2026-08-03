// Lende — proxy-Worker (Cloudflare). Speiler to eksterne tjenester Lende bruker.
//
// 1) NVE HydAPI (https://hydapi.nve.no) krever en API-nøkkel sendt som
//    `X-API-Key`. Vite inliner klient-env i den offentlige bundelen, så nøkkelen
//    kan ikke bo i nettleseren. Worker-en holder den server-side som en
//    Cloudflare-secret (`NVE_HYDAPI_KEY`) og speiler KUN:
//      GET /api/v1/Stations
//      GET /api/v1/Observations
//    Uten secret satt → 500 (ingen kall til NVE).
//
// 2) Kulturminnesøk brukerminner (https://api.ra.no) trenger INGEN nøkkel, men
//    ble lagt hit i v4.8.7 fordi klient-side-hentingen feilet i praksis
//    («Kulturminner (!)» på Håøya). Utropstegnet skiller ikke nedetid, endret
//    path, mobilnett eller CORS — proxyen dekker alle fire, og cacher svaret,
//    som er trygt siden datasettet endrer seg sakte. Speiler alt under
//    /brukerminner/ (liste + enkelt-oppslag).
//
// Alt annet gir 404 — Worker-en er bevisst ingen åpen proxy. Query-strengen
// videresendes uendret; svaret speiles med CORS-headere så nettleseren godtar det.

const HYDAPI_ORIGIN = 'https://hydapi.nve.no'
const HYDAPI_PATHS = new Set(['/api/v1/Stations', '/api/v1/Observations'])

const RA_ORIGIN = 'https://api.ra.no'
const RA_PREFIX = '/brukerminner/'
// Datasettet er brukerregistrerte kulturminner — det endrer seg over dager, ikke
// minutter. Et døgn fjerner både mobil-timeouts og gjentatte kall for samme kart.
const RA_CACHE_S = 86400

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

/**
 * OGC API Features paginerer med ABSOLUTTE `links[rel=next]`-URL-er mot
 * api.ra.no. Klienten følger dem, så uten omskriving ville side 2 gått direkte
 * til opphavet og feilet på nytt — proxyen hadde bare hjulpet for første side.
 * Vi rører KUN links[].href: bilde-URL-er og `linkkulturminnesok` skal peke dit
 * de peker. Kan ikke kroppen tolkes som JSON, sendes den urørt videre.
 */
export function rewriteNextLinks(body, workerOrigin) {
  let json
  try {
    json = JSON.parse(body)
  } catch {
    return body
  }
  if (!Array.isArray(json?.links)) return body
  let endret = false
  for (const l of json.links) {
    if (typeof l?.href === 'string' && l.href.startsWith(RA_ORIGIN + RA_PREFIX)) {
      l.href = workerOrigin + l.href.slice(RA_ORIGIN.length)
      endret = true
    }
  }
  return endret ? JSON.stringify(json) : body
}

async function proxyHydApi(url, cors, env) {
  if (!env.NVE_HYDAPI_KEY) {
    return new Response('NVE_HYDAPI_KEY er ikke satt i Worker-en.', { status: 500, headers: cors })
  }
  let upstream
  try {
    upstream = await fetch(`${HYDAPI_ORIGIN}${url.pathname}${url.search}`, {
      headers: { Accept: 'application/json', 'X-API-Key': env.NVE_HYDAPI_KEY },
    })
  } catch {
    return new Response('Kunne ikke nå NVE HydAPI.', { status: 502, headers: cors })
  }
  const body = await upstream.text()
  return new Response(body, {
    status: upstream.status,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}

async function proxyBrukerminner(request, url, cors, ctx) {
  // Cache-nøkkelen er URL-en uten Origin-variasjon: innholdet er identisk for
  // alle kallere, og CORS-headeren settes på nytt ved retur.
  const cacheKey = new Request(url.toString(), { method: 'GET' })
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) {
    const body = await hit.text()
    return new Response(body, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': hit.headers.get('Content-Type') ?? 'application/geo+json',
        'X-Lende-Cache': 'hit',
      },
    })
  }

  const accept = request.headers.get('Accept') || 'application/geo+json'
  let upstream
  try {
    upstream = await fetch(`${RA_ORIGIN}${url.pathname}${url.search}`, { headers: { Accept: accept } })
  } catch (e) {
    return new Response(`Kunne ikke nå api.ra.no: ${e?.message ?? 'ukjent feil'}`,
      { status: 502, headers: cors })
  }

  const raw = await upstream.text()
  const type = upstream.headers.get('Content-Type') ?? 'application/geo+json'
  // Feil fra opphavet speiles med SIN status, så vi kan se forskjell: 404 betyr
  // «endepunktet er flyttet», 5xx «tjenesten er nede».
  if (!upstream.ok) {
    return new Response(raw, { status: upstream.status, headers: { ...cors, 'Content-Type': type } })
  }

  const body = type.includes('json') ? rewriteNextLinks(raw, url.origin) : raw
  // Bare vellykkede svar caches. waitUntil så skrivingen ikke forsinker svaret.
  ctx.waitUntil(cache.put(cacheKey, new Response(body, {
    headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${RA_CACHE_S}` },
  })))
  return new Response(body, {
    status: 200,
    headers: { ...cors, 'Content-Type': type, 'X-Lende-Cache': 'miss' },
  })
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: cors })
    }

    const url = new URL(request.url)
    if (HYDAPI_PATHS.has(url.pathname)) return proxyHydApi(url, cors, env)
    if (url.pathname.startsWith(RA_PREFIX)) return proxyBrukerminner(request, url, cors, ctx)
    return new Response('Not Found', { status: 404, headers: cors })
  },
}
