// Avled øy-hull i innlands-innsjøer fra høydemodellen (DEM).
//
// Bakgrunn: Kartverkets N50 vektor-WFS (som modellerte innsjø-øyer som hull)
// er avviklet, og verken NVE-innsjødatabasen eller OSM leverer pålitelig øyer
// i norske innsjøer. Resultatet var at innsjøer ble malt som én solid blå
// flate rett over øyene (Kolstadøya i Setten). Men øyene STIGER over
// vannflaten — og det ser DEM-en. Vi detekterer terreng som stikker opp over
// innsjøens vannivå INNENFOR innsjø-polygonet, og returnerer de områdene som
// ringer klare til å brukes som hull (øyer) i vann-polygonet.
//
// Rent, DOM-/nettverks-fritt og fullt enhetstestbart: alt drives av en
// `sampleDem(xM, yM) → høyde|null`-funksjon i samme SVG-meter-rom som
// vann-ringene (mapBuilder.project()-output).

import { contours as d3Contours } from 'd3-contour'
import { simplifyDP, chaikin } from './pathUtils.js'

function signedArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  }
  return a / 2
}

// Ray casting punkt-i-ring (odd-even). Ringen kan være åpen eller lukket.
function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if (((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi)) inside = !inside
  }
  return inside
}

// Glatt en øy-ring på samme vis som konturer/DEM-sjø: DP-forenkling → Chaikin
// hjørne-kutt → lett final-DP, så øy-kanten bukter seg naturlig i stedet for å
// stå som et hardt marching-squares-raster.
function smoothRing(ring, simplifyM) {
  let r = ring
  if (r.length > 1) {
    const f = r[0], l = r[r.length - 1]
    if (f[0] === l[0] && f[1] === l[1]) r = r.slice(0, -1)
  }
  if (simplifyM > 0 && r.length > 4) r = simplifyDP(r, simplifyM)
  if (r.length >= 3) r = chaikin(r, 2, true)
  if (r.length > 4) r = simplifyDP(r, Math.max(0.5, simplifyM * 0.5))
  return r
}

/**
 * Finn øy-hull for ÉN innsjø-ytre-ring, avledet fra DEM.
 *
 * @param {Array<[number,number]>} outerRingM  ytre ring i SVG-meter
 * @param {(xM:number,yM:number)=>number|null} sampleDem  høyde i meter, null = nodata/utenfor
 * @param {object} [opts]
 * @param {number} [opts.aboveWaterM=6]   Terreng må stige minst så mye over vannivået for å regnes som øy
 * @param {number} [opts.minIslandM2=3000] Ignorer øy-flekker mindre enn dette (DEM-støy/skjær). Ved 20 m DEM kan vi uansett ikke oppløse øyer mindre enn noen få celler pålitelig.
 * @param {number} [opts.cellM=18]        Sample-rutenett i meter (≈ DEM-oppløsning)
 * @param {number} [opts.simplifyM=3]     DP-toleranse for glatting
 * @param {number} [opts.maxCells=120000] Sikkerhets-tak på rutenett-celler
 * @returns {Array<Array<[number,number]>>}  øy-ringer i SVG-meter (kan brukes som hull)
 */
export function islandHolesForLake(outerRingM, sampleDem, opts = {}) {
  const {
    aboveWaterM = 6,
    minIslandM2 = 3000,
    cellM = 18,
    simplifyM = 3,
    maxCells = 120000,
  } = opts
  if (!Array.isArray(outerRingM) || outerRingM.length < 3) return []
  if (typeof sampleDem !== 'function') return []

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of outerRingM) {
    if (!Array.isArray(p)) continue
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  const w = maxX - minX, h = maxY - minY
  if (!(w > 0 && h > 0)) return []

  const cols = Math.max(2, Math.ceil(w / cellM) + 1)
  const rows = Math.max(2, Math.ceil(h / cellM) + 1)
  if (cols * rows > maxCells) return []

  const n = cols * rows
  const inside = new Uint8Array(n)
  const elev = new Float64Array(n)
  const finiteVals = []
  let insideCount = 0
  for (let r = 0; r < rows; r++) {
    const y = minY + r * cellM
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const x = minX + c * cellM
      if (!pointInRing(x, y, outerRingM)) { elev[i] = NaN; continue }
      inside[i] = 1
      insideCount++
      const e = sampleDem(x, y)
      if (e == null || !Number.isFinite(e)) { elev[i] = NaN; continue }
      elev[i] = e
      finiteVals.push(e)
    }
  }
  if (insideCount < 8) return []

  // To regimer for hvordan DEM leser vann:
  //   • «verdi-vann»: vannflaten leses som en (nær) flat høyde (ofte ~0 m for
  //     NHM_DTM, eller innbrent vannivå). Øyer stikker opp OVER den → terskel
  //     = lavt-persentil (vann er majoriteten) + aboveWaterM.
  //   • «nodata-vann»: ingen LiDAR-retur over vann → celler er nodata. Da ER
  //     de finite-cellene inne i innsjøen nettopp øyer (ekte målt terreng).
  const finiteFrac = finiteVals.length / insideCount
  const field = new Array(n)
  let threshold
  if (finiteFrac < 0.5) {
    for (let i = 0; i < n; i++) field[i] = (inside[i] && Number.isFinite(elev[i])) ? 1 : 0
    threshold = 0.5
  } else {
    finiteVals.sort((a, b) => a - b)
    const waterLevel = finiteVals[Math.floor(finiteVals.length * 0.15)]
    threshold = waterLevel + aboveWaterM
    const low = waterLevel - 1000
    for (let i = 0; i < n; i++) field[i] = (inside[i] && Number.isFinite(elev[i])) ? elev[i] : low
  }

  const levels = d3Contours().size([cols, rows]).thresholds([threshold])(field)
  if (!levels.length) return []

  const holes = []
  for (const poly of levels[0].coordinates) {
    // poly[0] = øyas ytre omriss (evt. poly[1..] = tjern på øya — ignoreres,
    // så vi ikke re-fyller via nøstede hull).
    const outer = poly[0]
    if (!outer) continue
    // Areal-filter på RÅ marching-squares-ring (rutenett-tro) — glatting kan
    // blåse opp arealet til en bitteliten blokkete ring og slippe støy gjennom.
    const rawM = outer.map(([cx, cy]) => [minX + cx * cellM, minY + cy * cellM])
    if (Math.abs(signedArea(rawM)) < minIslandM2) continue
    const ring = smoothRing(rawM, simplifyM)
    if (ring.length < 3) continue
    holes.push(ring)
  }
  return holes
}
