// Utvidet 3D-utsnitt: 3D-verdenen dekker mer enn den aktive kartflisa.
//
// To grunner til at den må det:
//  1. MOSAIKKEN (v5.18.0). Har brukeren utvidet kartet med kanthåndtakene, er
//     «kartet» arket de ser — aktiv flis pluss nabofliser. 3D bygde likevel bare
//     den aktive flisa, så åtte av ni fliser forsvant i det man trykket «3D».
//  2. RUTER som går utenfor aktiv flis — ellers «går turen i tomme lufta»
//     forbi flisekanten.
//
// Utsnittet rundes til et grid (10 m default, DEM-oppløsningen ved store
// utsnitt) slik at det aligner med DEM-flis-cachens globale UTM32-rutenett, og
// meta3d gir samme WGS84-forankring i det forskjøvede rommet (svgX' = svgX − minX).

const GRID_M = 10

/**
 * @param {{widthM:number, heightM:number, minE:number, minN:number, equidistance?:number}} meta
 * @param {{mosaic?: {minX:number,minY:number,maxX:number,maxY:number}|null,
 *          route?: Array<[number,number]>, via?: Array<{svgX:number, svgY:number}>,
 *          padM?: number, gridM?: number}} [opts]
 *   mosaic  yttergrensa til arket (aktiv flis ∪ spøkelsesfliser), i aktiv-flisas
 *           meter-rom. Tas med UTEN margin — det er en eksakt flisekant.
 *   gridM   utsnittet snappes til dette rutenettet; sett det til DEM-
 *           oppløsningen når den er grovere enn 10 m, ellers lander ikke
 *           utsnittet på DEM-gitteret.
 * @returns {null | {minX:number, minY:number, widthM:number, heightM:number,
 *                   meta3d: {minE:number, minN:number, widthM:number, heightM:number, equidistance:number|null}}}
 *   null når alt ligger innenfor den aktive flisa.
 */
export function computeExtent(meta, { mosaic = null, route = [], via = [], padM = 250, gridM = GRID_M } = {}) {
  if (!meta) return null
  let minX = 0
  let minY = 0
  let maxX = meta.widthM
  let maxY = meta.heightM
  let outside = false

  if (mosaic) {
    if (mosaic.minX < minX) { minX = mosaic.minX; outside = true }
    if (mosaic.minY < minY) { minY = mosaic.minY; outside = true }
    if (mosaic.maxX > maxX) { maxX = mosaic.maxX; outside = true }
    if (mosaic.maxY > maxY) { maxY = mosaic.maxY; outside = true }
  }

  const expand = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    if (x - padM < minX) { minX = x - padM; outside = true }
    if (x + padM > maxX) { maxX = x + padM; outside = true }
    if (y - padM < minY) { minY = y - padM; outside = true }
    if (y + padM > maxY) { maxY = y + padM; outside = true }
  }
  for (const [x, y] of route ?? []) expand(x, y)
  for (const v of via ?? []) expand(v.svgX, v.svgY)
  if (!outside) return null

  const g = gridM > 0 ? gridM : GRID_M
  minX = Math.floor(minX / g) * g
  minY = Math.floor(minY / g) * g
  maxX = Math.ceil(maxX / g) * g
  maxY = Math.ceil(maxY / g) * g
  const widthM = maxX - minX
  const heightM = maxY - minY
  return {
    minX, minY, widthM, heightM,
    // utm.js-invariant: svgY = heightM − (n − minN) ⇒ minN' = minN + H − maxY.
    meta3d: {
      minE: meta.minE + minX,
      minN: meta.minN + meta.heightM - maxY,
      widthM,
      heightM,
      equidistance: Number.isFinite(meta.equidistance) ? meta.equidistance : null,
    },
  }
}

/**
 * Utsnittet en RUTE trenger. Tynn innpakning rundt computeExtent, beholdt fordi
 * det er den formen kallerne (og testene) kjenner.
 */
export function computeTourExtent(meta, route, via = [], opts = {}) {
  if (!route?.length) return null
  return computeExtent(meta, { route, via, ...opts })
}

/** Rute-koordinater → forskjøvet rom (0..widthM). */
export function shiftPoints(coordinates, extent) {
  return coordinates.map(([x, y]) => [x - extent.minX, y - extent.minY])
}

/** {svgX, svgY}-punkt → forskjøvet rom. */
export function shiftVia(via, extent) {
  return via.map((v) => ({ svgX: v.svgX - extent.minX, svgY: v.svgY - extent.minY }))
}

/** Søkeindeks-oppføringer → forskjøvet rom (kun feltene 3D bruker). */
export function shiftIndex(entries, extent) {
  return (entries ?? []).map((e) => ({
    name: e.name,
    kind: e.kind,
    x: e.x - extent.minX,
    y: e.y - extent.minY,
    ele: e.ele ?? null,
    areaM2: e.areaM2 ?? null,
    categories: e.categories ?? null,
  }))
}

/**
 * Offline-fallback: blit flisas DEM inn i et noData-fylt union-grid med samme
 * oppløsning. Området utenfor flisa flater til havnivå i terrengbyggingen —
 * ikke pent, men ruta svever ikke. Primærveien er fersk DEM via flis-cachen.
 */
export function demIntoExtent(dem, extent) {
  return demsIntoExtent([{ dem, x: 0, y: 0 }], extent)
}

/**
 * Samme, men for FLERE fliser: hver spøkelses-/nabofliss lagrede DEM legges inn
 * på sin plass i union-gridet. Uten dette sto åtte av ni fliser i et 3×3-ark på
 * havnivå når nettet var nede (eller WCS svarte syntetisk) — kartteksturen viste
 * fjell, terrenget var flatt.
 *
 * Oppløsningen er den FØRSTE gyldige flisas; fliser med annen oppløsning hoppes
 * over framfor å blittes feil (de er sjeldne — mosaikken krever gitter-kompatible
 * fliser — og en flis på feil sted er verre enn en flis som mangler).
 *
 * @param {Array<{dem: object|null, x: number, y: number}>} placements
 *   x/y = flisas topp-venstre i AKTIV-flisas meter-rom (aktiv flis: 0,0).
 */
export function demsIntoExtent(placements, extent) {
  const list = (placements ?? []).filter(p => p?.dem?.data && p.dem.cols > 0 && p.dem.rows > 0)
  if (!list.length) return null
  const first = list[0].dem
  const res = first.transform.pixelWidth
  const cols = Math.max(1, Math.round(extent.widthM / res))
  const rows = Math.max(1, Math.round(extent.heightM / res))
  const noData = first.noData
  const data = new Float32Array(cols * rows).fill(noData)

  for (const { dem, x, y } of list) {
    if (Math.abs(dem.transform.pixelWidth - res) > 1e-6) continue
    const offC = Math.round((x - extent.minX) / res)
    const offR = Math.round((y - extent.minY) / res)
    for (let r = 0; r < dem.rows; r++) {
      const tr = r + offR
      if (tr < 0 || tr >= rows) continue
      const srcStart = r * dem.cols
      const c0 = Math.max(0, -offC)
      const c1 = Math.min(dem.cols, cols - offC)
      if (c1 <= c0) continue
      data.set(dem.data.subarray(srcStart + c0, srcStart + c1), tr * cols + offC + c0)
    }
  }
  return {
    data, cols, rows,
    transform: { ...first.transform, originX: 0, originY: 0 },
    noData,
  }
}

// DEM-en for et stort utsnitt må ikke vokse uhemmet: et 4×4-ark av 3 km-fliser
// er 12 km, og på 10 m ville det blitt 1200² = 1,4 M samples (5,8 MB) — som må
// hentes, cachees og samples per nål/rutepunkt. Terrengmeshen desimerer likevel
// til 512 celler (terrainGrid.MAX_GRID_DIM), så finere data enn dette ser man
// bare i kurvene og i drapering av nåler.
const DEM_MAX_SAMPLES = 1600

/** Grovest fornuftige DEM-oppløsning for et utsnitt (multiplum av 10 m). */
export function demResolutionFor(widthM, heightM, { maxSamples = DEM_MAX_SAMPLES } = {}) {
  const maxDim = Math.max(widthM || 0, heightM || 0)
  if (!(maxDim > 0)) return 10
  return Math.max(10, Math.ceil(maxDim / maxSamples / 10) * 10)
}
