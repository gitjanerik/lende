// Værvarsel fra MET Norway (Locationforecast 2.0 compact).
//
// KILDE: api.met.no/weatherapi/locationforecast/2.0/compact. Data er lisensiert
// NLOD 2.0 + CC BY 4.0 og krever synlig attribusjon — «Værdata fra MET Norway».
// Den står i /om og i infopanelet; fjernes den, bryter vi lisensen.
//
// HVORFOR GJENNOM PROXYEN OG IKKE DIREKTE FRA NETTLESEREN: MET krever en
// identifiserende `User-Agent` med kontaktinfo, og svarer 403 Forbidden på en
// generisk eller manglende en. En nettleser KAN ikke sette User-Agent fra
// fetch() — headeren er forbudt. Et direkte klient-kall kan derfor ikke oppfylle
// METs vilkår, uansett om CORS tilfeldigvis slipper det gjennom. Kallet går
// derfor gjennom Cloudflare-proxyen (cloudflare/proxy/), som setter headeren
// server-side og i tillegg deler cachen: tjue turgåere på samme fjell koster MET
// ett kall. Samme mønster som NVE HydAPI, av en beslektet grunn.
//
// Proxyen runder også lat/lon til 4 desimaler. MET er eksplisitt om at flere
// desimaler ødelegger cachingen deres (modellen har ~1 km oppløsning) og at det
// etter hvert vil gi 400 Bad Request.
//
// CORS/nett: som de andre eksterne kildene kan dette feile; da returneres null
// (graceful), og kalleren viser INGEN værlinje — aldri en oppdiktet verdi.
//
// Merk: fila bundles inn i Cloudflare-Workerne via src/lib, så `import.meta.env`
// må leses med optional chaining (Vites env finnes ikke i workerd), og
// ingenting node-spesifikt eller på modulnivå. Se CLAUDE.md om boot:workers.

const MET_BASE =
  import.meta.env?.VITE_MET_URL ??
  'https://lende-proxy.jepedersen73.workers.dev/vaer'

// MET tåler ikke mer enn 4 desimaler. Vi sender 3 — samme rutenett som
// cache-nøkkelen (vaerPointKey), så nøkkel og forespørsel ikke kan komme i utakt.
export const VAER_DESIMALER = 3

/**
 * Hent JSON med timeout, avbrudd og ett nytt forsøk. Samme wrapper som
 * kulturminneFetcher — kaster aldri, returnerer `fallback`.
 */
async function safeFetchJson(url, { signal, timeoutMs = 9000, retries = 1 }, fallback) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) return fallback
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (res.ok) return await res.json()
      // 403 fra MET betyr som regel User-Agent, altså en feil i Workeren og ikke
      // noe et nytt forsøk løser. Si det tydelig i loggen — ellers blir det
      // feilsøkt som «nettet var dårlig».
      if (res.status === 403) {
        console.warn('[MET] 403 Forbidden — mangler proxyen en gyldig User-Agent?')
        return fallback
      }
      if (res.status === 400) {
        console.warn('[MET] 400 Bad Request — for mange desimaler i koordinaten?')
        return fallback
      }
    } catch (e) {
      if (signal?.aborted) return fallback
      if (attempt === retries) console.warn(`[MET] Henting feilet: ${e?.message ?? e}`)
    } finally {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    if (attempt < retries && !signal?.aborted) await new Promise((r) => setTimeout(r, 600))
  }
  return fallback
}

/**
 * Del et symbol_code i basis og variant: `clearsky_night` →
 * `{ basis: 'clearsky', variant: 'night' }`. Koder uten variant (`cloudy`,
 * `fog`, `rain` …) gir `variant: null`.
 *
 * Merk at basiskoden kan INNEHOLDE understrek-frie sammensetninger som
 * `lightssleetshowersandthunder` (med METs kjente skrivefeil — den ekstra
 * s-en etter «light» — som de har valgt å beholde for ikke å brekke klienter).
 * Derfor splittes det bare på det SISTE understreket, og bare når halen er en
 * kjent variant.
 */
const VARIANTER = new Set(['day', 'night', 'polartwilight'])
export function symbolBasis(symbolCode) {
  if (typeof symbolCode !== 'string' || !symbolCode) return { basis: null, variant: null }
  const i = symbolCode.lastIndexOf('_')
  if (i < 0) return { basis: symbolCode, variant: null }
  const hale = symbolCode.slice(i + 1)
  if (!VARIANTER.has(hale)) return { basis: symbolCode, variant: null }
  return { basis: symbolCode.slice(0, i), variant: hale }
}

/**
 * Bytt variant på et symbol_code slik at ikonet følger lysmodusen brukeren
 * HAR VALGT, ikke klokka. Står man i nattmodus i 3D, skal symbolet vise natt —
 * det er himmelen man ser på. Koder uten variant returneres urørt.
 */
export function medVariant(symbolCode, variant) {
  const { basis, variant: har } = symbolBasis(symbolCode)
  if (!basis || !har || !VARIANTER.has(variant)) return symbolCode
  return `${basis}_${variant}`
}

/**
 * Parse et Locationforecast-svar til det appen bruker. Ren funksjon — hele
 * feilrisikoen i denne fila ligger her, og den skal kunne testes offline.
 *
 * MET leverer 1-times-oppløsning bare et døgn eller to fram; deretter finnes
 * bare `next_6_hours`. Vi tar symbol og nedbør fra 1-times når den finnes og
 * faller tilbake til 6-timers, så en rad aldri blir tom bare fordi den ligger
 * langt fram.
 */
export function parseVarsel(json, { naa = null } = {}) {
  const serie = json?.properties?.timeseries
  if (!Array.isArray(serie) || !serie.length) return null
  const timer = []
  for (const punkt of serie) {
    const tid = punkt?.time
    const d = punkt?.data?.instant?.details
    if (!tid || !d) continue
    const neste = punkt.data.next_1_hours ?? punkt.data.next_6_hours ?? null
    timer.push({
      tid,
      temperaturC: tall(d.air_temperature),
      vindMs: tall(d.wind_speed),
      vindRetningGrader: tall(d.wind_from_direction),
      skydekkeProsent: tall(d.cloud_area_fraction),
      nedborMm: tall(neste?.details?.precipitation_amount),
      // Timen som varselet gjelder for: 1 når vi fikk next_1_hours, 6 ellers.
      // Uten dette ville «0,4 mm» lest som mm/time når det er mm/6 timer.
      nedborTimer: punkt.data.next_1_hours ? 1 : 6,
      symbol: neste?.summary?.symbol_code ?? null,
    })
  }
  if (!timer.length) return null
  return {
    oppdatert: json?.properties?.meta?.updated_at ?? null,
    hentet: naa ?? new Date().toISOString(),
    timer,
  }
}

function tall(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Timen som gjelder NÅ: den siste som starter på eller før `naa`. Er alle
 * fram i tid (varselet er ferskt og vi står før første punkt), brukes den
 * første. Er alle bak i tid, er varselet utdatert og vi returnerer null framfor
 * å vise gårsdagens vær som dagens.
 */
export function naaVarsel(varsel, naa = Date.now()) {
  const timer = varsel?.timer
  if (!Array.isArray(timer) || !timer.length) return null
  const t = typeof naa === 'number' ? naa : new Date(naa).getTime()
  let treff = null
  for (const time of timer) {
    const ms = new Date(time.tid).getTime()
    if (!Number.isFinite(ms)) continue
    if (ms <= t) treff = time
    else if (!treff) return time            // alle fram i tid
    else break
  }
  if (!treff) return null
  // Mer enn tre timer gammel: varselet er ikke lenger «nå».
  const alder = t - new Date(treff.tid).getTime()
  return alder > 3 * 60 * 60 * 1000 ? null : treff
}

/**
 * Timene framover fra nå, til en symbolrad. Hopper over det som er passert.
 */
export function timerFramover(varsel, { antall = 8, naa = Date.now() } = {}) {
  const timer = varsel?.timer
  if (!Array.isArray(timer)) return []
  const t = typeof naa === 'number' ? naa : new Date(naa).getTime()
  const naaTime = naaVarsel(varsel, t)
  const fra = naaTime ? timer.indexOf(naaTime) : timer.findIndex((x) => new Date(x.tid).getTime() >= t)
  if (fra < 0) return []
  return timer.slice(fra, fra + antall)
}

/**
 * Hent værvarsel for et punkt. Returnerer `null` ved enhver feil.
 * Koordinatene rundes her, så både URL-en og cache-nøkkelen ser samme punkt.
 */
export async function fetchVarsel(lat, lon, { signal, timeoutMs } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const q = (v) => Number(v).toFixed(VAER_DESIMALER)
  const url = `${MET_BASE}/locationforecast/2.0/compact?lat=${q(lat)}&lon=${q(lon)}`
  const json = await safeFetchJson(url, { signal, timeoutMs }, null)
  return json ? parseVarsel(json) : null
}
