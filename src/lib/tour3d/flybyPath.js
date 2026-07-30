// Fly-by-kameraets bane: resampl ruta grovt, løft og forskyv sideveis,
// garanter terrengklaring i en radius rundt hvert banepunkt, og glatt med
// boksfilter-pass. Glattingen er det som gir dronefølelsen — den dreper
// DEM-jitter og skarpe rutehjørner.

import { sampleElevation } from '../demSampling.js'
import { makePositionLookup } from './routePath.js'

/**
 * @param {Array<[number,number]>} coordinates  rute i SVG-meter
 * @param {import('../demSampling.js').DEM|null} dem
 * @param {ReturnType<import('./coords.js').makeCoords>} coords
 * @returns {{points3: Float32Array, cumM: Float32Array, totalM: number}}
 */
export function buildFlybyPath(coordinates, dem, coords, {
  stepM = 50, upM = 130, sideM = 55,
  clearRadiusM = 60, clearAboveM = 60,
  smoothPasses = 3, smoothWindow = 7,
} = {}) {
  const pts = resample(coordinates, stepM)
  const n = pts.length
  const raw = []
  const minE = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]
    // Sideforskyvning vinkelrett på lokal retning (fast høyreside).
    const [px, py] = perp(pts, i)
    const cx = x + px * sideM
    const cy = y + py * sideM
    const groundE = elevAt(dem, x, y)
    // Klaringspass: 5-punkts stencil rundt kamerapunktet.
    const maxE = maxElevInRadius(dem, cx, cy, clearRadiusM)
    minE[i] = maxE + clearAboveM
    raw.push([cx, Math.max(groundE + upM, minE[i]), cy])
  }

  // Klaringen re-håndheves etter hvert glattingspass — boksfilteret kan
  // ellers trekke banen ned i en smal rygg mellom to lavere naboer.
  for (let p = 0; p < smoothPasses; p++) {
    boxSmooth(raw, smoothWindow)
    for (let i = 0; i < n; i++) if (raw[i][1] < minE[i]) raw[i][1] = minE[i]
  }

  const points3 = new Float32Array(n * 3)
  const cumM = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const [sx, e, sy] = raw[i]
    const [wx, wy, wz] = coords.toWorld(sx, sy, e)
    points3[i * 3] = wx
    points3[i * 3 + 1] = wy
    points3[i * 3 + 2] = wz
    if (i > 0) cumM[i] = cumM[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }
  return { points3, cumM, totalM: cumM[n - 1] ?? 0 }
}

export function makeFlybyLookup(path) {
  return makePositionLookup(path)
}

function elevAt(dem, x, y) {
  if (!dem) return 0
  const e = sampleElevation(dem, x, y)
  return Number.isFinite(e) ? e : 0
}

function maxElevInRadius(dem, x, y, r) {
  let m = elevAt(dem, x, y)
  for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    const e = elevAt(dem, x + dx, y + dy)
    if (e > m) m = e
  }
  return m
}

function resample(coordinates, stepM) {
  if (!coordinates || coordinates.length < 2) return (coordinates ?? []).map(c => [c[0], c[1]])
  const out = [[coordinates[0][0], coordinates[0][1]]]
  let carry = 0
  for (let i = 1; i < coordinates.length; i++) {
    const [ax, ay] = coordinates[i - 1]
    const [bx, by] = coordinates[i]
    const segLen = Math.hypot(bx - ax, by - ay)
    if (segLen === 0) continue
    let d = stepM - carry
    while (d < segLen) {
      const t = d / segLen
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t])
      d += stepM
    }
    carry = (carry + segLen) % stepM
  }
  const last = coordinates[coordinates.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 1) out.push([last[0], last[1]])
  return out
}

function perp(pts, i) {
  const a = pts[Math.max(0, i - 1)]
  const b = pts[Math.min(pts.length - 1, i + 1)]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [dy / len, -dx / len]
}

function boxSmooth(arr, window) {
  const half = Math.floor(window / 2)
  const n = arr.length
  const src = arr.map(p => p.slice())
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sz = 0, cnt = 0
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      sx += src[j][0]; sy += src[j][1]; sz += src[j][2]; cnt++
    }
    arr[i][0] = sx / cnt; arr[i][1] = sy / cnt; arr[i][2] = sz / cnt
  }
}
