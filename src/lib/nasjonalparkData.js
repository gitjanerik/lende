// Nasjonalparker som dekker et kart — lokalt oppslag, ingen nettverkskall.
//
// Datasettet (`public/data/nasjonalparker.json`) bygges av
// `scripts/build-nasjonalparker.js` i CI: alle norske nasjonalparker med
// forenklede grenser og Naturbase-metadata. Se scriptet for hvorfor det er
// bundlet og ikke slått opp ved kartbygging.
//
// Parkene TEGNES aldri (de er 20–3400 km²; en overlay ville dekket hele arket).
// Dette oppslaget mater bare faktaboksen i infoskuffen — og siden det er
// klient-side, gjelder det også kart som allerede er bygget.

let parksPromise = null

function dataUrl() {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')
  return `${base}data/nasjonalparker.json`
}

/**
 * Last park-datasettet (cachet for økten). Returnerer [] hvis filen mangler
 * eller feiler — da vises ingen faktaboks, aldri en oppdiktet park.
 * @returns {Promise<Array<object>>}
 */
export function loadNasjonalparker() {
  if (parksPromise) return parksPromise
  parksPromise = fetch(dataUrl())
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (Array.isArray(data?.parker) ? data.parker : []))
    .catch(() => [])
  return parksPromise
}

// Standard ray-casting. Ringen er [[lon, lat], …].
function pointInRing(ring, lon, lat) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function bboxesOverlap(a, bbox) {
  const [minLon, minLat, maxLon, maxLat] = a
  return !(maxLon < bbox.west || minLon > bbox.east || maxLat < bbox.south || minLat > bbox.north)
}

/**
 * Ligger hele eller deler av parken innenfor kart-bboxen?
 *
 * To tester, fordi begge retninger forekommer:
 *   • et grensepunkt inne i kartet  → grensa krysser arket («deler av»)
 *   • et kartpunkt inne i en ring   → arket ligger inne i parken («hele»)
 * Senter + de fire hjørnene dekker det siste også når parken bare tar ett
 * hjørne av arket.
 */
export function parkCoversBbox(park, bbox) {
  if (!park?.rings?.length || !bbox) return false
  if (Array.isArray(park.bbox) && !bboxesOverlap(park.bbox, bbox)) return false
  for (const ring of park.rings) {
    for (const [lon, lat] of ring) {
      if (lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north) return true
    }
  }
  const midLat = (bbox.south + bbox.north) / 2
  const midLon = (bbox.west + bbox.east) / 2
  const probes = [
    [midLon, midLat],
    [bbox.west, bbox.south], [bbox.east, bbox.south],
    [bbox.west, bbox.north], [bbox.east, bbox.north],
  ]
  for (const ring of park.rings) {
    for (const [lon, lat] of probes) {
      if (pointInRing(ring, lon, lat)) return true
    }
  }
  return false
}

/** Alle parker som dekker kartet, sortert på navn. */
export function parksForBbox(parker, bbox) {
  if (!Array.isArray(parker) || !bbox) return []
  return parker
    .filter((p) => parkCoversBbox(p, bbox))
    .map(({ rings, bbox: _bbox, ...facts }) => facts)
}
