// N50 arealdekke-flater (myr) fra statiske fliser ved siden av appen.
//
// ── Hvorfor statisk ────────────────────────────────────────────────────────
// Samme grunn som n50StiFetcher: OSM er tynt i norsk utmark. Ved
// Briskemyrputten i Drammensmarka viser UT.no en myr som dekker det meste av
// utsnittet; OSM har ingen `natural=wetland` der, så Lende tegnet bare selve
// putten. N50 Arealdekke har myra, men ingen live WFS, så den bakes én gang
// (scripts/bygg-n50-areal.mjs) og serveres som filer.
//
// ── Feiler aldri hardt ─────────────────────────────────────────────────────
// Mangler flisene — ikke bakt ennå, eller offline — får kartet bare OSM-myra
// som før. Det er med vilje: denne fila landet i repoet FØR flisene gjorde,
// nettopp fordi den skal tåle at de ikke er der.

import { fliserForBbox, lesFlis, bboxForRinger } from './n50ArealPakke.js'

// Vite serverer appen under `base` ('/lende/' i produksjon). Flisene ligger i
// public/, altså på samme prefiks — hardkodet '/' ville brutt på GitHub Pages.
const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_N50_AREAL_URL) ||
  `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}data/n50-areal/`

const FLIS_TIMEOUT_MS = 15000

/**
 * Les én URL → bytes. All I/O går via denne, så kallere som ikke kan bruke
 * `fetch` kan bytte den ut (`opts.hentBytes`).
 *
 * MERK: Node-ens `fetch` støtter IKKE `file:` — den kaster «not implemented».
 * MCP/headless leser derfor flisene fra disk i stedet (mcp/headless.js), samme
 * grep som for stiene. Uten det får headless-bygde kart null N50-myr, helt
 * stille, siden uthentingen aldri feiler hardt.
 */
async function hentBytesViaFetch(url, signal) {
  const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(FLIS_TIMEOUT_MS) })
  if (!res.ok) return { status: res.status, bytes: null }
  return { status: 200, bytes: new Uint8Array(await res.arrayBuffer()) }
}

// Manifestet lister hvilke fliser som FINNES. Uten det ville hvert kart bedt
// om fliser over hav og utland og fylt konsollen med 404.
let manifestLover = null
export function nullstillManifestCache() { manifestLover = null }

async function hentManifest(basePath, hentBytes, signal) {
  if (!manifestLover) {
    manifestLover = (async () => {
      try {
        const { bytes } = await hentBytes(`${basePath}manifest.json`, signal)
        if (!bytes) return null
        const m = JSON.parse(new TextDecoder().decode(bytes))
        return Array.isArray(m?.fliser) ? new Set(m.fliser) : null
      } catch { return null }
    })()
  }
  return manifestLover
}

/** Overlapper flatas bbox kartets bbox? Fliser er mye større enn kartet. */
export function berorerBbox(ringer, bbox) {
  const b = bboxForRinger(ringer)
  if (!b) return false
  return b.south <= bbox.north && b.north >= bbox.south
    && b.west <= bbox.east && b.east >= bbox.west
}

/**
 * Nøkkel for å kjenne igjen samme flate fra to nabofliser. En myr som krysser
 * en flisgrense lagres HEL i begge (se n50ArealPakke om hvorfor vi ikke
 * klipper), så uten dedup ville den blitt tegnet to ganger — og med
 * halvgjennomsiktig mønsterfyll ville dobbelt-tegningen VÆRT synlig.
 */
function flateNokkel(ringer) {
  const r = ringer[0]
  const p = r[0], q = r[r.length - 1]
  return `${r.length}:${p.lat.toFixed(5)},${p.lon.toFixed(5)}:${q.lat.toFixed(5)},${q.lon.toFixed(5)}`
}

/**
 * Hent N50-arealflater for et bbox. Returnerer `{type, ringer}`-flater.
 */
export async function fetchN50ArealFlater(bbox, opts = {}) {
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  const basePath = opts.basePath ?? BASE
  const hentBytes = opts.hentBytes ?? hentBytesViaFetch
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    onStatus({ state: 'feil', message: 'ugyldig bbox' })
    return []
  }
  const alle = fliserForBbox(bbox)
  const manifest = await hentManifest(basePath, hentBytes, opts.signal)
  const nokler = manifest ? alle.filter(n => manifest.has(n)) : alle
  if (!nokler.length) {
    onStatus({ state: 'ok', fliser: 0, flater: 0, utenfor: !!manifest })
    return []
  }

  const sett = new Map()
  let feilet = 0
  await Promise.all(nokler.map(async (nokkel) => {
    try {
      const { status, bytes } = await hentBytes(`${basePath}${nokkel}.bin`, opts.signal)
      if (!bytes) { if (status !== 404) feilet++; return }
      for (const f of lesFlis(bytes)) {
        if (!berorerBbox(f.ringer, bbox)) continue
        const k = flateNokkel(f.ringer)
        if (!sett.has(k)) sett.set(k, f)
      }
    } catch (e) {
      feilet++
      console.warn(`[N50-areal] flis ${nokkel} feilet: ${e?.message ?? e}`)
    }
  }))

  const flater = [...sett.values()]
  if (feilet && !flater.length) {
    onStatus({ state: 'feil', message: `${feilet} av ${nokler.length} fliser feilet` })
    return []
  }
  onStatus({ state: 'ok', fliser: nokler.length, flater: flater.length, feilet: feilet || undefined })
  return flater
}

/**
 * N50-flater → OSM-aktige elementer for buildSvg().
 *
 * Myr merkes med `natural=wetland` fordi det er taggen mapBuilder allerede
 * klassifiserer til ISOM 308/309 — vi legger oss på den eksisterende stien i
 * stedet for å lage en ny. `lende:n50areal` bæres i tillegg så diagnose-modus
 * og kildesporing kan skille N50-myr fra OSM-myr.
 *
 * Hull håndteres som OSM-multipolygon-relations: mapBuilder ring-syr dem via
 * `assembleRelationRings`, som er den veien wedge-artefakter unngås.
 */
// OSM-taggen hver N50-type skal bære. Vi legger oss på tagger mapBuilder
// ALLEREDE klassifiserer, i stedet for å lage en ny sti gjennom symbolizer:
//   wetland → ISOM 308/309 (myr, mønsterfyll)
//   wood    → ISOM 406 (skog)
// `lende:n50areal` bæres i tillegg, så diagnose-modus kan skille N50 fra OSM
// og arealMerge kan avlede hva kilden faktisk leverte.
const TAGG_FOR_TYPE = Object.freeze({
  myr: { natural: 'wetland' },
  skog: { natural: 'wood' },
  apen: { landuse: 'meadow' },
})

export function n50ArealTilElementer(flater) {
  return (flater ?? []).map((f, i) => ({
    type: f.ringer.length > 1 ? 'relation' : 'way',
    id: `n50areal-${i}`,
    ...(f.ringer.length > 1
      ? {
        members: f.ringer.map((ring, j) => ({
          type: 'way', role: j === 0 ? 'outer' : 'inner', geometry: ring,
        })),
      }
      : { geometry: f.ringer[0] }),
    tags: { ...(TAGG_FOR_TYPE[f.type] ?? TAGG_FOR_TYPE.myr), 'lende:n50areal': f.type },
    _source: 'n50areal',
  }))
}

/** Hent + konverter i én operasjon (MCP/headless og tester). */
export async function fetchN50Areal(bbox, opts = {}) {
  return n50ArealTilElementer(await fetchN50ArealFlater(bbox, opts))
}
