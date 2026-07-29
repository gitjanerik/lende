// Ruta som drapert 3D-kurve: densifiser polylinjen, sampl DEM-høyde per
// punkt (med glatting så 10–20 m-celler ikke gir trappetrinn), løft litt
// over bakken og bygg en arc-length-tabell for posisjonsoppslag.
//
// cumM er ekte 2D-lengde langs ruta — samme semantikk som lengthM/alongM
// ellers i appen (høydeprofil, ETA, distanceToRoute).

import { sampleElevation } from '../demSampling.js'

/**
 * @param {Array<[number,number]>} coordinates  rute i SVG-meter
 * @param {import('../demSampling.js').DEM|null} dem
 * @param {ReturnType<import('./coords.js').makeCoords>} coords
 * @param {{stepM?: number, offsetM?: number, maxPoints?: number}} [opts]
 * @returns {{points3: Float32Array, cumM: Float32Array, totalM: number}}
 */
export function buildRoutePath(coordinates, dem, coords, { stepM = 5, offsetM = 3, maxPoints = 2500 } = {}) {
  const dense = densify(coordinates, stepM, maxPoints)
  const n = dense.length
  const elevs = new Float32Array(n)
  let last = 0
  for (let i = 0; i < n; i++) {
    const e = dem ? sampleElevation(dem, dense[i][0], dense[i][1]) : NaN
    // NaN-hull (utenfor DEM / noData) fylles med forrige gyldige høyde.
    last = Number.isFinite(e) ? e : last
    elevs[i] = last
  }
  // Første punkter kan ha vært NaN før første gyldige — fyll bakover.
  let firstValid = 0
  while (firstValid < n && elevs[firstValid] === 0 && dem) {
    const e = sampleElevation(dem, dense[firstValid][0], dense[firstValid][1])
    if (Number.isFinite(e)) break
    firstValid++
  }
  for (let i = 0; i < firstValid && firstValid < n; i++) elevs[i] = elevs[firstValid]

  const smoothed = smooth3(elevs)
  const points3 = new Float32Array(n * 3)
  const cumM = new Float32Array(n)
  // Akkumuler i float64 — Float32-summering mister millimeterne som gjør
  // at totalM matcher rutas lengthM eksakt.
  let acc = 0
  for (let i = 0; i < n; i++) {
    const [x, y] = dense[i]
    const [wx, wy, wz] = coords.toWorld(x, y, smoothed[i] + offsetM)
    points3[i * 3] = wx
    points3[i * 3 + 1] = wy
    points3[i * 3 + 2] = wz
    if (i > 0) acc += Math.hypot(x - dense[i - 1][0], y - dense[i - 1][1])
    cumM[i] = acc
  }
  return { points3, cumM, totalM: acc }
}

function densify(coordinates, stepM, maxPoints) {
  if (!coordinates || coordinates.length < 2) return (coordinates ?? []).map(c => [c[0], c[1]])
  let totalM = 0
  for (let i = 1; i < coordinates.length; i++) {
    totalM += Math.hypot(coordinates[i][0] - coordinates[i - 1][0], coordinates[i][1] - coordinates[i - 1][1])
  }
  // Hev steget for veldig lange ruter så vi holder oss under maxPoints.
  const step = Math.max(stepM, totalM / Math.max(2, maxPoints - 1))
  const out = [[coordinates[0][0], coordinates[0][1]]]
  for (let i = 1; i < coordinates.length; i++) {
    const [ax, ay] = coordinates[i - 1]
    const [bx, by] = coordinates[i]
    const segLen = Math.hypot(bx - ax, by - ay)
    const parts = Math.max(1, Math.ceil(segLen / step))
    for (let p = 1; p <= parts; p++) {
      out.push([ax + ((bx - ax) * p) / parts, ay + ((by - ay) * p) / parts])
    }
  }
  return out
}

function smooth3(arr) {
  const n = arr.length
  if (n < 3) return arr
  const out = new Float32Array(n)
  out[0] = arr[0]
  out[n - 1] = arr[n - 1]
  for (let i = 1; i < n - 1; i++) out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3
  return out
}

/**
 * Arc-length-oppslag over en points3/cumM-tabell: binærsøk + lerp.
 * Deles av rutemarkør, kameraer og fly-by.
 */
export function makePositionLookup({ points3, cumM, totalM }) {
  const n = cumM.length
  const at = (alongM, out = [0, 0, 0]) => {
    if (n === 0) return out
    const d = Math.max(0, Math.min(totalM, alongM))
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cumM[mid] < d) lo = mid + 1
      else hi = mid
    }
    const i1 = Math.max(1, lo)
    const i0 = i1 - 1
    const seg = cumM[i1] - cumM[i0] || 1
    const t = (d - cumM[i0]) / seg
    for (let a = 0; a < 3; a++) {
      out[a] = points3[i0 * 3 + a] + (points3[i1 * 3 + a] - points3[i0 * 3 + a]) * t
    }
    return out
  }
  const tangentAt = (alongM, out = [0, 0, 0]) => {
    const h = Math.max(1, totalM / 500)
    const a = at(Math.max(0, alongM - h))
    const b = at(Math.min(totalM, alongM + h), out)
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz) || 1
    out[0] = dx / len; out[1] = dy / len; out[2] = dz / len
    return out
  }
  return { at, tangentAt, totalM }
}
