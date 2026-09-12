// Path-forenkling og glatting. Brukes for konturer, OSM-stier og
// hvor som helst vi trenger zoom-aware generalisering.
//
// - simplifyDP(points, tol)     Douglas-Peucker
// - chaikin(points, iters)      Chaikin corner-cutting
// - smoothCatmullRom(points, t) Catmull-Rom interpolation
// - polylineLength(points)
// - polylineToPath(points, [close]) → SVG d-attr
//
// Alle koordinater er [x, y] i meter (SVG-units).

import simplifyJs from 'simplify-js'

/** @param {Array<[number,number]>} points */
export function simplifyDP(points, toleranceM = 1) {
  if (points.length < 3) return points
  const obj = points.map(([x, y]) => ({ x, y }))
  return simplifyJs(obj, toleranceM, true).map(p => [p.x, p.y])
}

/**
 * Chaikin corner-cutting smoothing. Hver iterasjon dobler antall
 * punkter og kutter hjørnene. 2-3 iterasjoner er typisk nok.
 */
export function chaikin(points, iterations = 2, closed = false) {
  let pts = points.slice()
  for (let it = 0; it < iterations; it++) {
    const next = []
    const n = pts.length
    if (n < 3) return pts
    if (!closed) next.push(pts[0])
    const start = closed ? 0 : 0
    const end = closed ? n : n - 1
    for (let i = start; i < end; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % n]
      next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]])
      next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]])
    }
    if (!closed) next.push(pts[n - 1])
    pts = next
  }
  return pts
}

export function polylineLength(points) {
  let s = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    s += Math.hypot(dx, dy)
  }
  return s
}

/** Konverter polyline til SVG path-d. */
export function polylineToPath(points, close = false) {
  if (!points.length) return ''
  let d = `M${fmt(points[0][0])},${fmt(points[0][1])}`
  for (let i = 1; i < points.length; i++) {
    d += `L${fmt(points[i][0])},${fmt(points[i][1])}`
  }
  if (close) d += 'Z'
  return d
}

/** Korteste avstand fra punkt (px,py) til linjesegment (ax,ay)–(bx,by). */
export function distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = ax + t * dx, cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/**
 * Er punktet {x,y} innenfor `maxDist` av minst én av polylinjene?
 * `polylines` er en array av punkt-arrayer ({x,y}). Early-out ved første
 * treff. Brukes til sti-nærhets-kvalifisering av utfartsparkering i mapBuilder
 * (samme enhet inn = samme enhet ut; med projiserte meter-koordinater er
 * `maxDist` i meter).
 */
export function isPointNearPolylines(pt, polylines, maxDist) {
  for (const line of polylines) {
    if (!line || line.length < 2) continue
    for (let i = 1; i < line.length; i++) {
      if (distPointToSegment(pt.x, pt.y, line[i - 1].x, line[i - 1].y, line[i].x, line[i].y) <= maxDist) {
        return true
      }
    }
  }
  return false
}

/**
 * Splitt en SVG path-d-streng til separate polylinjer — én pr subpath
 * (M-kommando). Brukes av Stifinner for å lese sti-/vei-geometri tilbake
 * fra den rendrede kart-SVG-en (kun `<path d>` er tilgjengelig på view-tid).
 *
 * Forventer ABSOLUTTE M/L-kommandoer slik `polylineToPath` produserer.
 * Ekstra koordinat-par etter en M tolkes som implisitt L (SVG-spec). `Z`
 * og andre kommandoer (kurver) ignoreres — kall kun på M/L-paths.
 *
 * @param {string} d
 * @returns {Array<Array<[number,number]>>} subpaths, hver med ≥1 punkt
 */
export function parsePathSubpaths(d) {
  if (typeof d !== 'string' || !d) return []
  const subpaths = []
  let current = null
  const re = /([ML])([^MLZ]*)/gi
  let m
  while ((m = re.exec(d)) !== null) {
    const cmd = m[1].toUpperCase()
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number)
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const pt = [nums[i], nums[i + 1]]
      if (cmd === 'M' && i === 0) {
        if (current && current.length) subpaths.push(current)
        current = [pt]
      } else if (current) {
        current.push(pt)
      } else {
        current = [pt]
      }
    }
  }
  if (current && current.length) subpaths.push(current)
  return subpaths
}

// v9.1.7: konturer/cliffs er i meter-rom (viewBox). 1 desimal = 0.1 m ≈
// 0.01 mm @ 1:10 000 — usynlig, men kutter bytes på path-tunge konturlag.
function fmt(n) { return Number(n.toFixed(1)) }
