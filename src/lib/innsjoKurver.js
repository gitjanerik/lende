// Dybdekurver for oppmålte innsjøer — fil-formatet bake og klient deler.
//
// Én fil per innsjø (`public/data/innsjo-dybde/<vatnlnr>.json`), hentet først når
// noen åpner innsjøen i 3D. Koordinatene er WGS84 i hele 1e-5 grader (~1 m),
// delta-kodet per linje: JSON med små heltall pakker godt, og et eget binær-
// format ville kostet en dekoder for noen hundre kilobyte.
//
//   { v: 1, nr, omriss: [ring…], kurver: [[dybde, type, linje]…] }
//   ring/linje = [lon0, lat0, dlon1, dlat1, …]   (heltall, × 1e-5 grader)
//   type: 0 dybdekurve, 1 innsjøkant, 2 øy-grense
//
// Rene funksjoner; ingen nett, ingen DOM.

export const KURVE_FORMAT = 1
export const SKALA = 1e5

export const KURVE_TYPE = { kurve: 0, kant: 1, oy: 2 }

export function kurveType(objekttype) {
  const t = String(objekttype ?? '').toLowerCase()
  if (t.includes('øy') || t.includes('oy')) return KURVE_TYPE.oy
  if (t.includes('kant')) return KURVE_TYPE.kant
  return KURVE_TYPE.kurve
}

/** [[lon,lat]…] → delta-kodede heltall. */
export function kodLinje(punkter) {
  const ut = []
  let px = 0, py = 0
  for (const [lon, lat] of punkter) {
    const x = Math.round(lon * SKALA)
    const y = Math.round(lat * SKALA)
    if (ut.length && x === px && y === py) continue
    ut.push(x - px, y - py)
    px = x; py = y
  }
  return ut
}

/** Delta-kodede heltall → [[lon,lat]…]. */
export function dekodLinje(koder) {
  const ut = []
  let x = 0, y = 0
  for (let i = 0; i + 1 < koder.length; i += 2) {
    x += koder[i]; y += koder[i + 1]
    ut.push([x / SKALA, y / SKALA])
  }
  return ut
}

// Douglas–Peucker i en lokal meter-projeksjon. Toleransen er i meter: en kurve
// som bøyer seg mindre enn det er ikke synlig i 3D, og innsjøene er opptil
// 360 km omkrets.
export function forenkle(punkter, tolM) {
  if (punkter.length <= 2 || !(tolM > 0)) return punkter
  const lat0 = punkter[0][1] * Math.PI / 180
  const kx = 111320 * Math.cos(lat0)
  const ky = 110540
  const xy = punkter.map(([lon, lat]) => [lon * kx, lat * ky])
  const behold = new Uint8Array(punkter.length)
  behold[0] = 1; behold[punkter.length - 1] = 1
  const stakk = [[0, punkter.length - 1]]
  const tol2 = tolM * tolM
  while (stakk.length) {
    const [a, b] = stakk.pop()
    const [ax, ay] = xy[a], [bx, by] = xy[b]
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    let maks = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i]
      let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
      t = Math.max(0, Math.min(1, t))
      const ex = ax + t * dx - px, ey = ay + t * dy - py
      const d2 = ex * ex + ey * ey
      if (d2 > maks) { maks = d2; idx = i }
    }
    if (maks > tol2) {
      behold[idx] = 1
      stakk.push([a, idx], [idx, b])
    }
  }
  return punkter.filter((_, i) => behold[i])
}

function linjerFra(geom) {
  if (!geom) return []
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'MultiLineString') return geom.coordinates
  if (geom.type === 'Polygon') return geom.coordinates
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat()
  return []
}

/**
 * GeoJSON-features fra NVE (lag 2 DybdeKurve og lag 3 Innsjo_ved_dybdemaling)
 * → én innsjø-fil.
 */
export function byggKurveFil(nr, kurveFeatures, omrissFeatures, { tolM = 1.5 } = {}) {
  const kurver = []
  for (const f of kurveFeatures) {
    const raa = f?.properties?.dybde_m
    const dybde = raa == null || raa === '' ? NaN : Number(raa)
    if (!Number.isFinite(dybde) || dybde < 0) continue
    const type = kurveType(f?.properties?.objekttype)
    for (const linje of linjerFra(f.geometry)) {
      const kodet = kodLinje(forenkle(linje, tolM))
      if (kodet.length >= 4) kurver.push([dybde, type, kodet])
    }
  }
  kurver.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const omriss = []
  for (const f of omrissFeatures) {
    for (const ring of linjerFra(f.geometry)) {
      const kodet = kodLinje(forenkle(ring, tolM))
      if (kodet.length >= 6) omriss.push(kodet)
    }
  }
  return { v: KURVE_FORMAT, nr, omriss, kurver }
}

/** Fila → dekodede ringer og kurver, eller null for et format vi ikke kjenner. */
export function lesKurveFil(fil) {
  if (!fil || fil.v !== KURVE_FORMAT) return null
  return {
    nr: fil.nr,
    omriss: (fil.omriss ?? []).map(dekodLinje),
    kurver: (fil.kurver ?? []).map(([dybde, type, linje]) => ({ dybde, type, punkter: dekodLinje(linje) })),
  }
}

const BASE =
  `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}data/innsjo-dybde/`

/** Hent én innsjø. Feiler aldri hardt: null betyr at 3D-knappen ikke kan vise noe. */
export async function hentInnsjoKurver(vatnlnr, { basePath = BASE } = {}) {
  try {
    const res = await fetch(`${basePath}${vatnlnr}.json`, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    return lesKurveFil(await res.json())
  } catch {
    return null
  }
}
