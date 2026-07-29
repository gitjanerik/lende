import { describe, it, expect } from 'vitest'
import { makeCoords } from './coords.js'
import { buildRoutePath, makePositionLookup } from './routePath.js'

function flatDem(elev = 100) {
  return {
    data: new Float32Array(100 * 100).fill(elev),
    cols: 100, rows: 100,
    transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
    noData: -9999,
  }
}

const coords = makeCoords({ widthM: 990, heightM: 990, exaggeration: 1 })

describe('buildRoutePath', () => {
  it('densifiserer til ~stepM og cumM er monotont stigende med riktig total', () => {
    const path = buildRoutePath([[0, 0], [500, 0]], flatDem(), coords, { stepM: 5 })
    expect(path.totalM).toBeCloseTo(500, 6)
    expect(path.cumM.length).toBeGreaterThanOrEqual(100)
    for (let i = 1; i < path.cumM.length; i++) {
      expect(path.cumM[i]).toBeGreaterThanOrEqual(path.cumM[i - 1])
    }
  })

  it('respekterer maxPoints ved å heve steget', () => {
    const path = buildRoutePath([[0, 0], [900, 0]], flatDem(), coords, { stepM: 1, maxPoints: 50 })
    expect(path.cumM.length).toBeLessThanOrEqual(52)
    expect(path.totalM).toBeCloseTo(900, 6)
  })

  it('løfter ruta offsetM over bakken', () => {
    const path = buildRoutePath([[100, 100], [200, 100]], flatDem(120), coords, { offsetM: 3 })
    expect(path.points3[1]).toBeCloseTo(123, 5)
  })

  it('NaN-hull i DEM fylles fra forrige gyldige høyde', () => {
    const dem = flatDem(80)
    // Rute som stikker utenfor DEM-et (svgX > 990 → NaN).
    const path = buildRoutePath([[900, 100], [1200, 100]], dem, coords, { stepM: 50 })
    for (let i = 0; i < path.points3.length / 3; i++) {
      expect(path.points3[i * 3 + 1]).toBeCloseTo(83, 5)
    }
  })
})

describe('makePositionLookup', () => {
  const path = buildRoutePath([[0, 0], [1000, 0]], flatDem(0), coords, { stepM: 10, offsetM: 0 })
  const lookup = makePositionLookup(path)

  it('interpolerer posisjon på gitt alongM', () => {
    const mid = lookup.at(500)
    expect(mid[0]).toBeCloseTo(500 - 495, 4)
    const start = lookup.at(0)
    expect(start[0]).toBeCloseTo(-495, 4)
  })

  it('klemmer utenfor [0, totalM]', () => {
    expect(lookup.at(-100)[0]).toBeCloseTo(lookup.at(0)[0], 6)
    expect(lookup.at(99999)[0]).toBeCloseTo(lookup.at(1000)[0], 6)
  })

  it('tangenten peker langs ruta og er normalisert', () => {
    const t = lookup.tangentAt(500)
    expect(t[0]).toBeCloseTo(1, 4)
    expect(Math.hypot(t[0], t[1], t[2])).toBeCloseTo(1, 6)
  })
})
