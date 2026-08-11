import { describe, it, expect } from 'vitest'
import { PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { buildWaypointMarkers } from './waypointMarkers.js'

// Flat DEM i 100 moh — nålene står da i world-y = 100.
const dem = {
  data: new Float32Array(16 * 16).fill(100),
  cols: 16,
  rows: 16,
  noData: -9999,
  transform: { pixelWidth: 10, pixelHeight: 10 },
}
const coords = {
  widthM: 160,
  heightM: 160,
  exaggeration: 1,
  toWorld: (x, y, elev) => [x - 80, elev, y - 80],
  toSvg: (wx, wz) => ({ x: wx + 80, y: wz + 80 }),
  elevToWorldY: (e) => e,
  worldYToElev: (y) => y,
}

// P-skilt og hjem-skilt tegnes på canvas, som ikke finnes i node — derfor
// bygges markørene her uten dem. Nålene (start/mål/via) er poenget i denne
// testen: det er de brukeren ser og trykker på.
const route = { coordinates: [[40, 40], [80, 80], [120, 120]] }

// Nålene skaleres per frame og henger i grupper med egen posisjon; i appen er
// det rendereren som oppdaterer world-matrisene før et trykk kan treffe noe.
const posér = (wp) => {
  wp.update(new PerspectiveCamera(60, 1, 1, 5000))
  wp.group.updateMatrixWorld(true)
}

const nedPaa = (x, y) => {
  const ray = new Raycaster()
  ray.set(new Vector3(x - 80, 500, y - 80), new Vector3(0, -1, 0))
  return ray
}

describe('buildWaypointMarkers — trefftesting', () => {
  it('A→B: start, mål og vendepunkt er alle trefflige', () => {
    const wp = buildWaypointMarkers({ route, via: [{ svgX: 80, svgY: 80 }] }, dem, coords)
    posér(wp)
    expect(wp.pick(nedPaa(40, 40))?.kind).toBe('start')
    expect(wp.pick(nedPaa(120, 120))?.kind).toBe('mål')
    const via = wp.pick(nedPaa(80, 80))
    expect(via?.kind).toBe('via')
    expect(via?.name).toBe('Vendepunkt')
    wp.dispose()
  })

  it('treffet bærer bakkepunktet, så kameraet kan fly dit', () => {
    const wp = buildWaypointMarkers({ route }, dem, coords)
    posér(wp)
    const start = wp.pick(nedPaa(40, 40))
    expect(start.world[0]).toBeCloseTo(-40, 6)
    expect(start.world[1]).toBeCloseTo(100, 6)
    expect(start.world[2]).toBeCloseTo(-40, 6)
    wp.dispose()
  })

  it('rundtur: én nål, og den heter «Start og mål»', () => {
    const wp = buildWaypointMarkers({
      route: { coordinates: [[40, 40], [80, 80], [40, 40]] },
      isLoop: true,
    }, dem, coords)
    posér(wp)
    expect(wp.pick(nedPaa(40, 40))?.name).toBe('Start og mål')
    wp.dispose()
  })

  it('trykk der ingen nål står gir null', () => {
    const wp = buildWaypointMarkers({ route }, dem, coords)
    posér(wp)
    expect(wp.pick(nedPaa(10, 150))).toBeNull()
    wp.dispose()
  })
})
