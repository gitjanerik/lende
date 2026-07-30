// Utvidet 3D-utsnitt for ruter som går utenfor aktiv kartflise (utvidede
// mosaikk-kart): 3D-verdenen dekker unionen av flisa og rutas bounding-boks,
// så turen aldri «går i tomme lufta». Utsnittet rundes til 10 m-grid slik at
// det aligner med DEM-flis-cachens globale UTM32-rutenett, og meta3d gir
// samme WGS84-forankring i det forskjøvede rommet (svgX' = svgX − minX).

const GRID_M = 10

/**
 * @param {{widthM:number, heightM:number, minE:number, minN:number, equidistance?:number}} meta
 * @param {Array<[number,number]>} route  rute i aktiv-flise-SVG-meter
 * @param {Array<{svgX:number, svgY:number}>} [via]
 * @returns {null | {minX:number, minY:number, widthM:number, heightM:number,
 *                   meta3d: {minE:number, minN:number, widthM:number, heightM:number, equidistance:number|null}}}
 *   null når hele turen (med margin) ligger innenfor flisa.
 */
export function computeTourExtent(meta, route, via = [], { padM = 250 } = {}) {
  if (!meta || !route?.length) return null
  let minX = 0
  let minY = 0
  let maxX = meta.widthM
  let maxY = meta.heightM
  let outside = false
  const expand = (x, y) => {
    if (x - padM < minX) { minX = x - padM; outside = true }
    if (x + padM > maxX) { maxX = x + padM; outside = true }
    if (y - padM < minY) { minY = y - padM; outside = true }
    if (y + padM > maxY) { maxY = y + padM; outside = true }
  }
  for (const [x, y] of route) expand(x, y)
  for (const v of via) expand(v.svgX, v.svgY)
  if (!outside) return null

  minX = Math.floor(minX / GRID_M) * GRID_M
  minY = Math.floor(minY / GRID_M) * GRID_M
  maxX = Math.ceil(maxX / GRID_M) * GRID_M
  maxY = Math.ceil(maxY / GRID_M) * GRID_M
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
  if (!dem) return null
  const res = dem.transform.pixelWidth
  const cols = Math.max(1, Math.round(extent.widthM / res))
  const rows = Math.max(1, Math.round(extent.heightM / res))
  const data = new Float32Array(cols * rows).fill(dem.noData)
  const offC = Math.round(-extent.minX / res)
  const offR = Math.round(-extent.minY / res)
  for (let r = 0; r < dem.rows; r++) {
    const tr = r + offR
    if (tr < 0 || tr >= rows) continue
    const srcStart = r * dem.cols
    const c0 = Math.max(0, -offC)
    const c1 = Math.min(dem.cols, cols - offC)
    if (c1 <= c0) continue
    data.set(dem.data.subarray(srcStart + c0, srcStart + c1), tr * cols + offC + c0)
  }
  return {
    data, cols, rows,
    transform: { ...dem.transform, originX: 0, originY: 0 },
    noData: dem.noData,
  }
}
