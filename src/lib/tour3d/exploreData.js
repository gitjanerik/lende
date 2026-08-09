// Datainnsamling for 3D-UTFORSKEREN: alt i kartutsnittet, ikke bare det som
// ligger langs en rute.
//
// Turvisningen filtrerer POI mot en 400 m-korridor rundt turen (tourData.js).
// Utforskeren har ingen rute å måle mot — der er hele kartet motivet — så
// den samler bredt og lar autofiltreringen (klynging + skjermrom-declutter)
// gjøre jobben med å holde bildet ryddig.

import { wgs84ToSvg } from '../utm.js'
import { kindMeta } from './featureTimeline.js'
import { bboxFromMeta } from './tourData.js'

/**
 * Alle navngitte POI-er i søkeindeksen som 3D kan gjøre noe med.
 * Samme form som collectMapFeatures, men uten korridor-filteret.
 * @param {Array} searchIndex fra buildSearchIndex
 */
export function collectAllFeatures(searchIndex) {
  const out = []
  for (const entry of searchIndex ?? []) {
    if (!entry?.name || !kindMeta(entry.kind, entry.categories)) continue
    out.push({
      name: entry.name,
      kind: entry.kind,
      x: entry.x,
      y: entry.y,
      ele: entry.ele ?? null,
      areaM2: entry.areaM2 ?? null,
      categories: entry.categories ?? null,
    })
  }
  return out
}

/**
 * Brukerminner (Kulturminnesøk) rett fra kart-SVG-en. De ligger allerede bakt
 * inn som `<g data-kulturminne-id data-kat data-tittel transform="translate(x,y)">`
 * i SVG-meter, så de er offline-tilgjengelige uten nett.
 * @param {Element} svgEl
 */
export function collectBrukerminnePins(svgEl) {
  const out = []
  if (!svgEl?.querySelectorAll) return out
  for (const g of svgEl.querySelectorAll('g[data-kulturminne-id]')) {
    const t = g.getAttribute('transform') ?? ''
    const m = /translate\(\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*\)/.exec(t)
    if (!m) continue
    const x = Number(m[1])
    const y = Number(m[2])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out.push({
      name: g.getAttribute('data-tittel') || 'Kulturminne',
      kind: 'brukerminne',
      x,
      y,
      ele: null,
      areaM2: null,
      categories: null,
      detail: {
        kat: g.getAttribute('data-kat') || 'annet',
        kulturminneId: g.getAttribute('data-kulturminne-id'),
      },
    })
  }
  return out
}

/**
 * Fredede kulturminner for HELE kartutsnittet (rutefri variant av
 * loadHeritageFeatures). Samme WFS og samme TTL-cache.
 */
export async function loadHeritageForMap({ meta, signal }) {
  const [{ fetchFredaKulturminner, clusterByMinMeters }, cacheMod] = await Promise.all([
    import('../kulturminneWfs.js'),
    import('../protectedAreaCache.js'),
  ])
  const { cacheGet, cacheSet, fredetKulturminneBboxKey, TTL } = cacheMod
  const b = bboxFromMeta(meta)
  const bbox = { south: b.south, west: b.west, north: b.north, east: b.east }
  const key = fredetKulturminneBboxKey(bbox)
  let items = await cacheGet(key)
  if (!items) {
    items = await fetchFredaKulturminner(bbox, { signal })
    if (items?.length) cacheSet(key, items, TTL.kulturminne)
  }
  return clusterByMinMeters(items ?? [], 60).map(k => {
    const { x, y } = wgs84ToSvg(k.lat, k.lon, meta)
    return {
      name: k.navn || 'Kulturminne',
      kind: 'kulturminne',
      x,
      y,
      ele: null,
      areaM2: null,
      categories: null,
      detail: { kulturminne: k },
    }
  })
}

/**
 * Klyngefiltrering i SVG-meter: av flere POI av SAMME type innenfor `minM`
 * beholdes den første. Motstykket til clusterByMinMeters (som regner i
 * lat/lon) for data som allerede er projisert.
 *
 * Dette er første trinn i autofiltreringen — det fjerner de virkelig
 * sammenfallende nålene én gang ved bygging, så skjermrom-declutteren slipper
 * å gjøre den jobben på nytt hver eneste gang kameraet flytter seg.
 */
export function clusterFeaturesByMeters(features, minM = 40) {
  const kept = []
  const byKind = new Map()
  for (const f of features ?? []) {
    const bucket = byKind.get(f.kind) ?? []
    if (bucket.some(k => Math.hypot(k.x - f.x, k.y - f.y) < minM)) continue
    bucket.push(f)
    byKind.set(f.kind, bucket)
    kept.push(f)
  }
  return kept
}

/**
 * Grupperer POI-er i de filtrerbare kategoriene panelet viser.
 * Nøklene er stabile og brukes som localStorage-felt.
 */
export const PIN_GROUPS = [
  { key: 'topp', label: 'Topper', kinds: ['peak', 'hoydepunkt'] },
  { key: 'vann', label: 'Vann og innsjøer', kinds: ['vann-navn', 'vann-omrade'] },
  { key: 'hytte', label: 'Hytter', kinds: ['hytte-navn'] },
  { key: 'sted', label: 'Steder', kinds: ['stedsnavn', 'omrade'] },
  { key: 'vern', label: 'Naturreservat', kinds: ['naturreservat-navn', 'naturreservat'] },
  { key: 'nve', label: 'NVE-målestasjoner', kinds: ['nve'] },
  { key: 'kulturminne', label: 'Fredet kulturminne', kinds: ['kulturminne'] },
  { key: 'brukerminne', label: 'Brukerminne', kinds: ['brukerminne'] },
]

const GROUP_OF_KIND = new Map()
for (const g of PIN_GROUPS) for (const k of g.kinds) GROUP_OF_KIND.set(k, g.key)

export function groupOfKind(kind) {
  return GROUP_OF_KIND.get(kind) ?? 'sted'
}

/**
 * Typen infokortet (Tour3dFeatureCard) forventer. Kortet er skrevet for
 * tidslinje-hendelser, som bærer `type` fra KIND_META; utforskerens nåler
 * bærer `kind`, så oversettelsen skjer her i stedet for i kortet.
 */
export function featureType(feature) {
  if (feature?.kind === 'brukerminne') return 'kulturminne'
  return kindMeta(feature?.kind, feature?.categories)?.type ?? 'sted'
}

export function countByGroup(features) {
  const counts = {}
  for (const g of PIN_GROUPS) counts[g.key] = 0
  for (const f of features ?? []) {
    const g = groupOfKind(f.kind)
    counts[g] = (counts[g] ?? 0) + 1
  }
  return counts
}
