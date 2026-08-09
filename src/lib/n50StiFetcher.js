// N50-stinettet fra statiske fliser ved siden av appen.
//
// ── Hvorfor statisk ────────────────────────────────────────────────────────
// OSM er tynt i norsk utmark: nærmeste OSM-linje til Trettekollen (Drammens
// høyeste punkt) ligger 478 m fra toppen, mens N50 har et fullt stinett.
// N50 Samferdsel har ingen live WFS, så dataene bakes én gang
// (scripts/bygg-n50-sti.mjs) og serveres som filer.
//
// Målt over alle fylker: 179 706 km sti/traktorveg → 10,2 MB i 208 fliser,
// største flis 200 KB. Det er lite nok til å ligge i `public/` og bli servert
// fra samme opprinnelse som appen — ingen proxy, ingen nøkler, og service
// worker-en cacher flisene offline på kjøpet.
//
// ── Uttynning ──────────────────────────────────────────────────────────────
// N50 legges OPPÅ OSM og Turrutebasen, og overlapper begge kraftig. Uten
// uttynning ville hver hovedsti blitt tegnet to-tre ganger med noen meters
// forskyvning. Vi bruker samme regler som Turrutebasen (linjeDedup.js).
//
// Feiler aldri hardt: mangler flisene (ikke bakt ennå, eller offline), får
// kartet bare OSM + Turrutebasen som før.

import { fliserForBbox, lesFlis } from './n50StiPakke.js'
import { travelLineGeometries, dedupeRoutesAgainstLines } from './linjeDedup.js'

// Vite serverer appen under `base` ('/lende/' i produksjon). Flisene ligger i
// public/, altså på samme prefiks — hardkodet '/' ville brutt på GitHub Pages.
const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_N50_STI_URL) ||
  `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}data/n50-sti/`

const FLIS_TIMEOUT_MS = 15000

// Manifestet listar hvilke fliser som FINNES. Uten det ville hvert kart bedt
// om fliser over hav og utland og fylt konsollen med 404. Hentes én gang per
// økt; feiler den, faller vi tilbake til å prøve flisene direkte.
let manifestLover = null
export function nullstillManifestCache() { manifestLover = null }

async function hentManifest(basePath, signal) {
  if (!manifestLover) {
    manifestLover = (async () => {
      try {
        const res = await fetch(`${basePath}manifest.json`, { signal })
        if (!res.ok) return null
        const m = await res.json()
        return Array.isArray(m?.fliser) ? new Set(m.fliser) : null
      } catch { return null }
    })()
  }
  return manifestLover
}

/** Ligger noen del av linja innenfor bboxen? Fliser er større enn kartet. */
export function berorerBbox(geometry, bbox) {
  for (const p of geometry ?? []) {
    if (p.lat >= bbox.south && p.lat <= bbox.north && p.lon >= bbox.west && p.lon <= bbox.east) return true
  }
  // Linja kan krysse bboxen uten at noe VERTEKS ligger inni (lang rett strekning
  // tvers over et lite kart). Sjekk derfor også om noe segment krysser.
  for (let i = 0; i < (geometry?.length ?? 0) - 1; i++) {
    const a = geometry[i], b = geometry[i + 1]
    if (Math.min(a.lat, b.lat) <= bbox.north && Math.max(a.lat, b.lat) >= bbox.south &&
        Math.min(a.lon, b.lon) <= bbox.east && Math.max(a.lon, b.lon) >= bbox.west) return true
  }
  return false
}

/**
 * Hent rå N50-stilinjer for et bbox — NETTVERK BARE, ingen uttynning.
 * Skilt fra dedup av samme grunn som Turrutebasen: uttynningen trenger
 * OSM-elementene, og Overpass er den trege kilden. Flisene hentes parallelt
 * og tynnes først når begge er inne.
 */
export async function fetchN50StiLinjer(bbox, opts = {}) {
  const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : () => {}
  const basePath = opts.basePath ?? BASE
  if (!bbox || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
    onStatus({ state: 'feil', message: 'ugyldig bbox' })
    return []
  }
  const alle = fliserForBbox(bbox)
  const manifest = await hentManifest(basePath, opts.signal)
  // Uten manifest prøver vi alle flisene; med manifest bare de som finnes.
  const nokler = manifest ? alle.filter(n => manifest.has(n)) : alle
  if (!nokler.length) {
    onStatus({ state: 'ok', fliser: 0, linjer: 0, utenfor: !!manifest })
    return []
  }

  const linjer = []
  let feilet = 0
  await Promise.all(nokler.map(async (nokkel) => {
    try {
      const res = await fetch(`${basePath}${nokkel}.bin`, {
        signal: opts.signal ?? AbortSignal.timeout(FLIS_TIMEOUT_MS),
      })
      if (!res.ok) { if (res.status !== 404) feilet++; return }
      for (const l of lesFlis(new Uint8Array(await res.arrayBuffer()))) {
        if (berorerBbox(l.geometry, bbox)) linjer.push(l)
      }
    } catch (e) {
      feilet++
      console.warn(`[N50-sti] flis ${nokkel} feilet: ${e?.message ?? e}`)
    }
  }))

  if (feilet && !linjer.length) {
    onStatus({ state: 'feil', message: `${feilet} av ${nokler.length} fliser feilet` })
    return []
  }
  onStatus({ state: 'ok', fliser: nokler.length, linjer: linjer.length, feilet: feilet || undefined })
  return linjer
}

/**
 * N50-linjer → OSM-aktige way-elementer for buildSvg().
 *
 * `lende:n50sti` er vår egen tag (ikke OSM). symbolizer.js gir traktorveg
 * ISOM 504 (samme som OSM highway=track), merket sti 506 og umerket 507 —
 * samme skille som Turrutebasen bruker.
 */
export function n50StiTilElementer(linjer) {
  return (linjer ?? []).map((l, i) => ({
    type: 'way',
    id: `n50sti-${i}`,
    geometry: l.geometry,
    tags: {
      'lende:n50sti': l.type,
      merking: l.merket ? 'JA' : 'NEI',
    },
    _source: 'n50sti',
  }))
}

/**
 * Tynn N50-linjene mot alt vi allerede tegner (OSM + Turrutebasen) og gjør
 * dem om til kart-elementer. Oppdaterer `status` med hvor mye som ble nytt.
 */
export function n50StiElementerFra(linjer, alleredeTegnet, status = null) {
  const kept = dedupeRoutesAgainstLines(linjer, travelLineGeometries(alleredeTegnet))
  const elementer = n50StiTilElementer(kept)
  if (linjer?.length) {
    console.log(`[N50-sti] ${linjer.length} linjer → ${elementer.length} nye strekk (resten dekkes av OSM/Turrutebasen)`)
  }
  if (status && status.state === 'ok') status.nye = elementer.length
  return elementer
}

/** Hent + tynn i én operasjon (MCP/headless og tester). */
export async function fetchN50Sti(bbox, opts = {}) {
  const linjer = await fetchN50StiLinjer(bbox, opts)
  return n50StiElementerFra(linjer, opts.alleredeTegnet)
}
