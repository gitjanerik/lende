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

/**
 * Kartet som lages når innsjøen velges i lista. Får innsjøen plass i et
 * standardkart (med en fjerdedel luft), sentreres kartet på den og gjøres så
 * lite som innsjøen tillater. Er den større, blir det et DEMO-utsnitt: 3D skal
 * vise både vann og land. Kandidatene er punkter på de dypeste kurvene, og
 * vinneren er vinduet med vann-andel nærmest `maalAndel`, med et lite fortrinn
 * for dypere vann. Å legge kartet et fast stykke fra stranda ble målt og
 * forkastet: smale innsjøer fikk 2 % vann og Tyrifjorden 74 %.
 *
 * @param {number[][][]} omriss  ringer i [lon, lat]
 * @param {{dybde:number, type:number, punkter:number[][]}[]} kurver
 * @returns {{lat:number, lon:number, km:number, demo:boolean, vannAndel?:number} | null}
 */
export function kartUtsnitt(omriss, kurver, { standardKm = 8, minKm = 2, maalAndel = 0.5, kandidater = 60 } = {}) {
  const alle = omriss.flat()
  if (!alle.length) return null
  const lat0 = alle[0][1] * Math.PI / 180
  const kx = 111320 * Math.cos(lat0)
  const ky = 110540
  const tilM = ([lon, lat]) => [lon * kx, lat * ky]
  const tilGrad = ([x, y]) => ({ lon: x / kx, lat: y / ky })

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of alle) {
    const [x, y] = tilM(p)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const spenn = Math.max(maxX - minX, maxY - minY) * 1.25
  if (spenn <= standardKm * 1000) {
    const km = Math.max(minKm, Math.ceil(spenn / 1000))
    return { ...tilGrad([(minX + maxX) / 2, (minY + maxY) / 2]), km, demo: false }
  }

  const ringerM = omriss.map(r => r.map(tilM))
  const halv = standardKm * 500
  const n = 32
  const andel = ([cx, cy]) => {
    const lokale = ringerM.map(r => r.map(([x, y]) => [x - cx + halv, cy - y + halv]))
    const m = rasterMaske(n, n, (2 * halv) / n, lokale)
    let v = 0
    for (let i = 0; i < m.length; i++) v += m[i]
    return v / m.length
  }

  const dybdeKurver = kurver.filter(k => k.type === 0 && k.punkter.length > 1)
  const maks = dybdeKurver.reduce((m, k) => Math.max(m, k.dybde), 0) || 1
  // Halvparten av kurvene, de dypeste, er kandidatfeltet. Jevnt utvalg langs dem.
  const sortert = [...dybdeKurver].sort((a, b) => b.dybde - a.dybde)
  const felt = sortert.slice(0, Math.max(1, Math.ceil(sortert.length / 2)))
  const punkter = felt.flatMap(k => k.punkter.map(p => ({ p: tilM(p), dybde: k.dybde })))
  const steg = Math.max(1, Math.floor(punkter.length / kandidater))
  let best = null
  for (let i = 0; i < punkter.length; i += steg) {
    const { p, dybde } = punkter[i]
    const a = andel(p)
    const score = Math.abs(a - maalAndel) - 0.1 * (dybde / maks)
    if (!best || score < best.score) best = { p, a, score }
  }
  if (!best) {
    const p = [(minX + maxX) / 2, (minY + maxY) / 2]
    best = { p, a: andel(p) }
  }
  // En smal innsjø (Gjende, Bitdalsvatn) fyller lite av et 8 km-kart uansett
  // hvor det legges. Da er et mindre kart et bedre bilde av den: prøv 6 og 4 km.
  if (best.a < MIN_VANN && standardKm > 4) {
    const mindre = kartUtsnitt(omriss, kurver, { standardKm: standardKm - 2, minKm, maalAndel, kandidater })
    if (mindre.demo && mindre.vannAndel > best.a) return mindre
  }
  return { ...tilGrad(best.p), km: standardKm, demo: true, vannAndel: Math.round(best.a * 100) / 100 }
}

const MIN_VANN = 0.2

// Even-odd scanline på et n × n-gitter med celle `celle` meter; y nedover.
function rasterMaske(cols, rows, celle, ringer) {
  const maske = new Uint8Array(cols * rows)
  const kryss = []
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) * celle
    kryss.length = 0
    for (const ring of ringer) {
      for (let i = 0, m = ring.length; i < m; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[(i + 1) % m]
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) kryss.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
      }
    }
    kryss.sort((a, b) => a - b)
    for (let k = 0; k + 1 < kryss.length; k += 2) {
      const c0 = Math.max(0, Math.ceil(kryss[k] / celle - 0.5))
      const c1 = Math.min(cols - 1, Math.floor(kryss[k + 1] / celle - 0.5))
      for (let c = c0; c <= c1; c++) maske[r * cols + c] = 1
    }
  }
  return maske
}
