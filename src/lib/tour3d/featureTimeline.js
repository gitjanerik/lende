// Feature-tidslinjen: severdigheter i korridoren rundt ruta som hendelser
// sortert på alongM (meter langs ruta). Punktkilder trigges innen fast
// radius; arealkilder (vann) skalerer radius med arealet — et tjern man går
// langs skal trigge selv om sentroiden ligger et stykke unna.

import { distanceToRoute } from '../routeEnrichment.js'

const KIND_META = {
  peak:            { type: 'topp',          radiusM: 350, priority: 6 },
  hoydepunkt:      { type: 'topp',          radiusM: 200, priority: 3 },
  kulturminne:     { type: 'kulturminne',   radiusM: 150, priority: 5 },
  'naturreservat-navn': { type: 'naturreservat', radiusM: 200, priority: 4 },
  naturreservat:   { type: 'naturreservat', radiusM: 200, priority: 4 },
  'vann-navn':     { type: 'vann',          radiusM: 120, priority: 3, area: true },
  'vann-omrade':   { type: 'vann',          radiusM: 120, priority: 3, area: true },
  omrade:          { type: 'område',        radiusM: 120, priority: 2, area: true },
  stedsnavn:       { type: 'sted',          radiusM: 120, priority: 2 },
  'hytte-navn':    { type: 'hytte',         radiusM: 150, priority: 4 },
  nve:             { type: 'vannstasjon',   radiusM: 300, priority: 2 },
}

const DEDUPE_ALONG_M = 150
const MAX_EVENTS = 14

export function kindMeta(kind, categories) {
  const meta = KIND_META[kind]
  if (meta) return meta
  if (categories?.includes('vann')) return KIND_META['vann-navn']
  return null
}

/**
 * @param {Array<{name:string, kind:string, x:number, y:number, ele?:number, areaM2?:number,
 *                categories?:string[]|null, detail?:object}>} features
 * @param {Array<[number,number]>} route  rute i SVG-meter
 * @param {{cum?: number[], holdMs?: number, approachM?: number, maxEvents?: number}} [opts]
 * @returns {Array<{alongM:number, distM:number, name:string, type:string, kind:string,
 *                  x:number, y:number, ele:number|null, areaM2:number|null,
 *                  priority:number, holdMs:number, approachM:number, detail:object|null}>}
 */
export function buildFeatureTimeline(features, route, { cum, holdMs = 4000, approachM = 120, maxEvents = MAX_EVENTS } = {}) {
  if (!route || route.length < 2) return []
  const candidates = []
  for (const f of features ?? []) {
    const meta = kindMeta(f.kind, f.categories)
    if (!meta || !f.name) continue
    let radius = meta.radiusM
    if (meta.area && Number.isFinite(f.areaM2) && f.areaM2 > 0) {
      radius = Math.max(radius, Math.sqrt(f.areaM2) * 0.6)
    }
    const { distM, alongM } = distanceToRoute([f.x, f.y], route, cum)
    if (distM > radius) continue
    candidates.push({
      alongM, distM,
      name: f.name, type: meta.type, kind: f.kind,
      x: f.x, y: f.y,
      ele: f.ele ?? null, areaM2: f.areaM2 ?? null,
      priority: meta.priority,
      holdMs, approachM,
      detail: f.detail ?? null,
    })
  }
  candidates.sort((a, b) => a.alongM - b.alongM)

  // Dedupe: innen DEDUPE_ALONG_M langs ruta vinner høyest prioritet
  // (nærmest ruta ved likhet). Også samme navn+type = duplikat.
  const kept = []
  const seenNames = new Set()
  for (const c of candidates) {
    const nameKey = `${c.type}:${c.name.toLowerCase()}`
    if (seenNames.has(nameKey)) continue
    const clashIdx = kept.findIndex(k => Math.abs(k.alongM - c.alongM) < DEDUPE_ALONG_M)
    if (clashIdx >= 0) {
      const k = kept[clashIdx]
      const better = c.priority > k.priority || (c.priority === k.priority && c.distM < k.distM)
      if (!better) continue
      seenNames.delete(`${k.type}:${k.name.toLowerCase()}`)
      kept.splice(clashIdx, 1)
    }
    kept.push(c)
    seenNames.add(nameKey)
  }

  if (kept.length > maxEvents) {
    // Behold de viktigste, men lever sortert på alongM.
    kept.sort((a, b) => b.priority - a.priority || a.distM - b.distM)
    kept.length = maxEvents
  }
  kept.sort((a, b) => a.alongM - b.alongM)
  return kept
}
