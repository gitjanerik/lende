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
// 3) MET Norway Locationforecast (https://api.met.no) krever en IDENTIFISERENDE
//    `User-Agent` med kontaktinfo, og svarer 403 Forbidden på en generisk eller
//    manglende en. En nettleser kan ikke sette den headeren — `User-Agent` er
//    forbudt i fetch() — så et direkte klient-kall kan ikke oppfylle METs vilkår
//    uansett hvor snill CORS-en deres er. Derfor hit. Speiler:
//      GET /vaer/locationforecast/2.0/compact?lat=&lon=
//    Ingen nøkkel; MET er åpent. Vi runder lat/lon til 4 desimaler (METs krav —
//    flere ødelegger cachen deres, og vil etter hvert gi 400) og cacher, så tjue
//    turgåere på samme fjell koster MET ett kall.
//
// Alt annet gir 404 — Worker-en er bevisst ingen åpen proxy. Query-strengen
// videresendes uendret (unntatt METs koordinat-avrunding); svaret speiles med
// CORS-headere så nettleseren godtar det.

const HYDAPI_ORIGIN = 'https://hydapi.nve.no'
const HYDAPI_PATHS = new Set(['/api/v1/Stations', '/api/v1/Observations'])

const RA_ORIGIN = 'https://api.ra.no'
const RA_PREFIX = '/brukerminner/'
// Datasettet er brukerregistrerte kulturminner — det endrer seg over dager, ikke
// minutter. Et døgn fjerner både mobil-timeouts og gjentatte kall for samme kart.
const RA_CACHE_S = 86400

const MET_ORIGIN = 'https://api.met.no'
const MET_PREFIX = '/vaer/'
// Kun dette ene endepunktet. Prefikset er ikke en åpen dør til api.met.no.
const MET_PATHS = new Map([
  ['/vaer/locationforecast/2.0/compact', '/weatherapi/locationforecast/2.0/compact'],
])
// METs vilkår: identifiser deg med kontaktinfo. Uten dette → 403 fra MET.
// Versjonen her er PROXY-rutas, ikke appens: den skal ikke følge app-bumpene
// (Workeren deployes for seg), og en versjon som drifter er verre enn en stabil.
const MET_UA = 'lende/1.0 (+https://github.com/gitjanerik/lende)'
// Locationforecast oppdateres hver time. Et halvtimes tak er godt innenfor
// «ikke poll hardere enn nødvendig», og vi respekterer upstream `Expires` når
// den er kortere. MET regner over 20 req/s som tung trafikk.
const MET_CACHE_S = 1800
// METs harde krav: aldri mer enn 4 desimaler i lat/lon.
const MET_DESIMALER = 4

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
    // Workeren fikk ikke opp en forbindelse i det hele tatt. Egen status (599)
    // og egen header, så dette ikke kan forveksles med en 502 vi SPEILER fra
    // opphavet — de to har helt ulike årsaker, og v4.8.7-røyktesten klarte
    // ikke å skille dem («502 fra Workeren» var feil: den kom fra api.ra.no).
    return new Response(`Kunne ikke nå api.ra.no: ${e?.message ?? 'ukjent feil'}`,
      { status: 599, headers: { ...cors, 'X-Lende-Upstream': 'unreachable' } })
  }

  const raw = await upstream.text()
  const type = upstream.headers.get('Content-Type') ?? 'application/geo+json'
  // Feil fra opphavet speiles med SIN status, så vi kan se forskjell: 404 betyr
  // «endepunktet er flyttet», 5xx «tjenesten er nede». X-Lende-Upstream gjør det
  // utvetydig at statusen er opphavets, ikke vår egen — api.ra.no ligger selv bak
  // Cloudflare og returnerer feilsider som ligner våre.
  if (!upstream.ok) {
    return new Response(raw, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': type, 'X-Lende-Upstream': String(upstream.status) },
    })
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

/**
 * Rund en koordinat til METs maks-presisjon. Returnerer null når verdien ikke
 * er et tall i gyldig område — da svarer vi 400 selv i stedet for å sende
 * søppel videre til MET (som ville sett det som en klient uten peiling).
 */
export function metKoordinat(v, grense) {
  // `searchParams.get()` gir null for en manglende parameter, og Number(null)
  // er 0 — ikke NaN. Uten denne vakta ville et kall uten `lat` blitt et varsel
  // for 0,0000 / 0,0000, altså Guineabukta, uten at noe så feil ut.
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || Math.abs(n) > grense) return null
  return n.toFixed(MET_DESIMALER)
}

/**
 * Hvor lenge svaret kan caches: upstream `Expires` når den finnes og er kortere
 * enn taket vårt, ellers taket. `naaMs` er injisert så funksjonen kan testes.
 */
export function metCacheSekunder(expiresHeader, naaMs) {
  if (!expiresHeader) return MET_CACHE_S
  const ms = Date.parse(expiresHeader)
  if (!Number.isFinite(ms)) return MET_CACHE_S
  const s = Math.floor((ms - naaMs) / 1000)
  if (s <= 0) return 60          // alt utløpt: hold et minutt, ikke null
  return Math.min(s, MET_CACHE_S)
}

async function proxyMet(url, cors, ctx) {
  const oppstrømsPath = MET_PATHS.get(url.pathname)
  if (!oppstrømsPath) return new Response('Not Found', { status: 404, headers: cors })

  const lat = metKoordinat(url.searchParams.get('lat'), 90)
  const lon = metKoordinat(url.searchParams.get('lon'), 180)
  if (lat === null || lon === null) {
    return new Response('lat/lon mangler eller er ugyldige.', { status: 400, headers: cors })
  }
  // Bygg query-strengen SELV framfor å videresende klientens. To grunner: den
  // avrundede koordinaten er det MET faktisk skal se, og cache-nøkkelen blir
  // kanonisk — ellers ville «?lon=10.44&lat=59.83» og «?lat=59.83&lon=10.44»
  // vært to oppslag på samme sted.
  const oppstrøms = `${MET_ORIGIN}${oppstrømsPath}?lat=${lat}&lon=${lon}`
  const cacheKey = new Request(`${url.origin}${url.pathname}?lat=${lat}&lon=${lon}`, { method: 'GET' })
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) {
    return new Response(await hit.text(), {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': hit.headers.get('Content-Type') ?? 'application/json',
        'X-Lende-Cache': 'hit',
      },
    })
  }

  let upstream
  try {
    upstream = await fetch(oppstrøms, {
      headers: { Accept: 'application/json', 'User-Agent': MET_UA },
    })
  } catch (e) {
    // Samme skille som på kulturminne-ruta: 599 = Workeren fikk ikke kontakt i
    // det hele tatt, en speilet 5xx = MET svarte og var nede. Ulike årsaker.
    return new Response(`Kunne ikke nå api.met.no: ${e?.message ?? 'ukjent feil'}`,
      { status: 599, headers: { ...cors, 'X-Lende-Upstream': 'unreachable' } })
  }

  const raw = await upstream.text()
  const type = upstream.headers.get('Content-Type') ?? 'application/json'
  if (!upstream.ok) {
    return new Response(raw, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': type, 'X-Lende-Upstream': String(upstream.status) },
    })
  }

  const maxAge = metCacheSekunder(upstream.headers.get('Expires'), Date.now())
  ctx.waitUntil(cache.put(cacheKey, new Response(raw, {
    headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${maxAge}` },
  })))
  return new Response(raw, {
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
    if (url.pathname.startsWith(MET_PREFIX)) return proxyMet(url, cors, ctx)
    return new Response('Not Found', { status: 404, headers: cors })
  },
}
