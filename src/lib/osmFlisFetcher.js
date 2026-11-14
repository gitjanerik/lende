// Henter OSM fra de bakte flisene (lib/osmFlis.js, docs/PLAN_OSM_UAVHENGIG.md
// fase 2) i stedet for Overpass. Svaret har Overpass' form, så mapBuilder og
// alt etter den ser ingen forskjell.
//
// Flisene ligger i R2 bak proxy-Workeren (`/osm/…`). Manifestet hentes først:
// det sier hvilken bake flisene kommer fra, og bake-tidspunktet henges på hver
// flis-URL som cache-nøkkel — samme grep som `n50FlisNokkel`, bare at nøkkelen
// her er en tid og ikke en hash. En flis som ikke finnes (404) er tom: baken
// skriver ikke fliser uten innhold, og det er hav eller fjell uten et eneste
// OSM-objekt vi ber om.
//
// Kaster når flisene ikke kan leses — kalleren (`fetchOsm`) faller da til
// Overpass. Et halvt sett fliser er aldri et svar: det ville gitt et kart med
// et rektangulært hull og ingen feilmelding.

import { flisNoklerForBbox, slaSammenFliser, delteIder, deltFilnavn, OSM_FLIS_VERSJON } from './osmFlis.js'

export const OSM_FLIS_URL =
  import.meta.env?.VITE_OSM_FLIS_URL ??
  'https://lende-proxy.jepedersen73.workers.dev/osm'

const CACHE = 'lende-osm'
const MANIFEST_MAKS_ALDER_MS = 60 * 60 * 1000

let manifestLover = null
let manifestHentet = 0

export function nullstillOsmManifest() { manifestLover = null; manifestHentet = 0 }

async function hentManifest(base, signal) {
  if (manifestLover && Date.now() - manifestHentet < MANIFEST_MAKS_ALDER_MS) return manifestLover
  manifestHentet = Date.now()
  manifestLover = fetch(`${base}/manifest.json`, { signal, cache: 'no-cache' }).then(async (res) => {
    if (!res.ok) throw new Error(`OSM-manifest: HTTP ${res.status}`)
    const m = await res.json()
    if (m.versjon !== OSM_FLIS_VERSJON) throw new Error(`OSM-fliser v${m.versjon}, klienten leser v${OSM_FLIS_VERSJON}`)
    return m
  })
  manifestLover.catch(() => { manifestLover = null })
  return manifestLover
}

/** Manifestet for gjeldende bake ({ osmTid, bakt, … }) — for visning i appen. */
export function hentOsmManifest({ signal, base = OSM_FLIS_URL } = {}) {
  return hentManifest(base, signal)
}

/** Pakk ut en gzip-kropp. Har nettleseren alt pakket den ut, er den JSON. */
async function lesJson(res) {
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buf))
  const strom = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(strom).text())
}

async function aapneCache() {
  try { return typeof caches !== 'undefined' ? await caches.open(CACHE) : null } catch { return null }
}

// Cache-first på nøklet URL. Gamle utgaver av SAMME fil ryddes når en ny lagres,
// ellers ville hver månedsbake lagt et nytt sett ved siden av det gamle.
async function hentFil(url, { signal, cache }) {
  const hit = cache && await cache.match(url).catch(() => null)
  if (hit) return hit
  const res = await fetch(url, { signal })
  if (res.ok && cache) {
    const sti = new URL(url).pathname
    cache.put(url, res.clone()).then(() => cache.keys()).then(nokler => Promise.all(
      nokler.filter(k => new URL(k.url).pathname === sti && k.url !== url).map(k => cache.delete(k)),
    )).catch(() => {})
  }
  return res
}

/**
 * OSM for bboksen fra flisene, i Overpass-form. `meta` sier hvor svaret kom
 * fra og hvor gammelt det er.
 */
export async function hentOsmFraFliser(bbox, { signal, base = OSM_FLIS_URL } = {}) {
  const manifest = await hentManifest(base, signal)
  const nokkel = encodeURIComponent(manifest.osmTid ?? manifest.bakt)
  const cache = await aapneCache()
  const les = async (sti) => {
    const res = await hentFil(`${base}/${sti}?t=${nokkel}`, { signal, cache })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`OSM-flis ${sti}: HTTP ${res.status}`)
    return lesJson(res)
  }
  const fliser = await Promise.all(flisNoklerForBbox(bbox).map(k => les(`${k}.json.gz`)))
  const ider = delteIder(fliser)
  const delte = new Map(await Promise.all(ider.map(async id => [id, await les(deltFilnavn(id))])))
  for (const id of ider) if (!delte.get(id)) throw new Error(`OSM-flis peker på ${id}, som mangler`)
  const ut = slaSammenFliser(fliser, bbox, delte)
  ut.meta = { kilde: 'fliser', osmTid: manifest.osmTid ?? null, fliser: fliser.length, delte: ider.length }
  return ut
}
