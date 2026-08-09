// Uttynning av linjer mot linjer vi ALLEREDE tegner.
//
// Delt mellom Turrutebasen (v5.0.2) og N50-stinettet: begge er kilder som
// legges OPPÅ OSM, og begge overlapper OSM kraftig. Målt for Turrutebasen:
// 72 % av geometrien lå oppå stier vi allerede hadde. Uten uttynning blir
// hver slik sti tegnet to ganger med et par meters forskyvning — en dobbel,
// «uskarp» strek langs alle hovedstiene.
//
// Skilt ut fra turrutebasenFetcher.js da N50-løftet kom, slik at de to
// kildene deler nøyaktig samme regler. To kopier av denne logikken ville
// før eller siden drevet fra hverandre.


const R_EARTH = 6371000
const toRad = Math.PI / 180

function metersBetween(a, b) {
  const lat0 = ((a.lat + b.lat) / 2) * toRad
  return R_EARTH * Math.hypot((b.lat - a.lat) * toRad, (b.lon - a.lon) * toRad * Math.cos(lat0))
}

// Punkter langs en linje med maks `stepM` mellomrom. Nødvendig i BEGGE
// retninger: en OSM-way kan ha to punkter 400 m fra hverandre, og en
// verteks-mot-verteks-test ville da kalt hele strekket «nytt» selv om ruta
// ligger rett oppå den.
function densify(geometry, stepM) {
  const out = []
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i], b = geometry[i + 1]
    const d = metersBetween(a, b)
    const steps = Math.max(1, Math.ceil(d / stepM))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t })
    }
  }
  if (geometry.length) out.push(geometry[geometry.length - 1])
  return out
}

// Enkelt lat/lon-rutenett for nærhets-oppslag. Cellestørrelsen settes til
// toleransen, så et treff alltid ligger i en av de 9 nabocellene.
function buildGrid(points, cellM) {
  const grid = new Map()
  if (!points.length) return { grid, cellM, latC: 0, lonC: 0 }
  const latC = cellM / 111320
  const midLat = points[0].lat
  const lonC = cellM / (111320 * Math.max(0.05, Math.cos(midLat * toRad)))
  for (const p of points) {
    const key = `${Math.floor(p.lat / latC)},${Math.floor(p.lon / lonC)}`
    let cell = grid.get(key)
    if (!cell) grid.set(key, (cell = []))
    cell.push(p)
  }
  return { grid, cellM, latC, lonC }
}

function hasNeighbourWithin(index, p, tolM) {
  const { grid, latC, lonC } = index
  if (!grid.size) return false
  const gi = Math.floor(p.lat / latC), gj = Math.floor(p.lon / lonC)
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const cell = grid.get(`${gi + di},${gj + dj}`)
      if (!cell) continue
      for (const q of cell) if (metersBetween(p, q) <= tolM) return true
    }
  }
  return false
}

// Linje-geometrier fra OSM-elementene vi allerede tegner. Bare ferdselslinjer
// er relevante — en rute som følger en innsjøkant er ikke en duplikat.
const FERDSEL = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
  'unclassified', 'service', 'living_street', 'path', 'track', 'bridleway',
  'steps', 'footway', 'cycleway',
])

export function travelLineGeometries(elements) {
  const out = []
  for (const el of elements ?? []) {
    const t = el?.tags
    if (!t) continue
    // OSM-ferdselslinjer ELLER våre egne kilder. Det siste er ikke pynt: N50
    // legges oppå BÅDE OSM og Turrutebasen, så uten dette ville en sti
    // Turrutebasen alt hadde tegnet blitt tegnet en gang til av N50.
    const erFerdsel = (t.highway && FERDSEL.has(t.highway)) ||
                      !!t['lende:turrute'] || !!t['lende:n50sti']
    if (!erFerdsel) continue
    if (Array.isArray(el.geometry) && el.geometry.length >= 2) out.push(el.geometry)
  }
  return out
}

// Hvor nær en eksisterende linje en rute må ligge for å regnes som duplikat.
// 30 m er valgt fra dataene: Turrutebasen oppgir `nøyaktighet` 50 (cm-enheter
// → ±0,5 m) men er ofte digitalisert fra eldre kilder, og OSM-stier er tegnet
// fra sporlogger. 30 m fanger den reelle forskyvningen mellom to tegninger av
// SAMME sti uten å svelge en parallell sti på andre siden av en myr.
export const DEDUP_TOLERANCE_M = 30
// Kortere nye biter enn dette droppes. Uten dette gir små avvik langs en
// duplikat-rute en stiplet «konfetti» av 10-20 m-stumper.
export const MIN_NEW_SEGMENT_M = 60
const DENSIFY_M = 10

function lengthOf(geometry) {
  let sum = 0
  for (let i = 0; i < geometry.length - 1; i++) sum += metersBetween(geometry[i], geometry[i + 1])
  return sum
}

/**
 * Behold bare de partiene av hver rute som IKKE følger en linje vi allerede
 * tegner. Returnerer nye rute-objekter (én per sammenhengende nytt parti).
 *
 * @param {Array} routes    fra parseFotruter()
 * @param {Array} lines     [{lat,lon}[]] fra travelLineGeometries()
 */
export function dedupeRoutesAgainstLines(routes, lines, {
  toleranceM = DEDUP_TOLERANCE_M, minSegmentM = MIN_NEW_SEGMENT_M,
} = {}) {
  const dense = []
  for (const g of lines ?? []) dense.push(...densify(g, DENSIFY_M))
  const index = buildGrid(dense, toleranceM)
  const out = []
  for (const route of routes ?? []) {
    // Ruta densifiseres også, ellers kan et langt rute-segment hoppe over
    // dekningen midt på og bli stående som «nytt».
    const pts = densify(route.geometry, DENSIFY_M)
    let run = []
    const flush = () => {
      if (run.length >= 2 && lengthOf(run) >= minSegmentM) {
        out.push({ ...route, id: `${route.id}-${out.length}`, geometry: run })
      }
      run = []
    }
    for (const p of pts) {
      if (hasNeighbourWithin(index, p, toleranceM)) flush()
      else run.push(p)
    }
    flush()
  }
  return out
}

