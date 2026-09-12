import { describe, it, expect } from 'vitest'
import {
  ringSignedArea,
  closeRing,
  pointInRing,
  pointInMultiPolygon,
  unionRingsToSea,
  unionPolygonsToSea,
  pointFeatureKept,
} from './marineTopology.js'

// Hjelpere: enkle kvadrater i SVG-meter-rom (y-ned).
const square = (x0, y0, s) => [
  [x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0],
]

describe('ringSignedArea', () => {
  it('beregner areal av et 10×10-kvadrat', () => {
    expect(Math.abs(ringSignedArea(square(0, 0, 10)))).toBeCloseTo(100, 6)
  })
})

describe('closeRing', () => {
  it('lukker en åpen ring', () => {
    const r = closeRing([[0, 0], [1, 0], [1, 1]])
    expect(r[r.length - 1]).toEqual([0, 0])
    expect(r.length).toBe(4)
  })
  it('lar en allerede lukket ring være', () => {
    const r = closeRing(square(0, 0, 5))
    expect(r.length).toBe(5)
  })
})

describe('pointInRing', () => {
  const sq = square(0, 0, 10)
  it('punkt inne', () => expect(pointInRing(5, 5, sq)).toBe(true))
  it('punkt utenfor', () => expect(pointInRing(15, 5, sq)).toBe(false))
  it('punkt langt unna', () => expect(pointInRing(-5, -5, sq)).toBe(false))
})

describe('pointInMultiPolygon — øy som hull', () => {
  // Sjø = stort kvadrat (0..100) med øy-hull (40..60).
  const seaWithIsland = [[
    square(0, 0, 100),       // outer (sjø)
    square(40, 40, 20),      // hull (øy)
  ]]
  it('punkt i åpent vann er i sjø', () => {
    expect(pointInMultiPolygon(10, 10, seaWithIsland)).toBe(true)
  })
  it('punkt på øya (i hullet) er IKKE i sjø', () => {
    expect(pointInMultiPolygon(50, 50, seaWithIsland)).toBe(false)
  })
  it('punkt utenfor alt er ikke i sjø', () => {
    expect(pointInMultiPolygon(200, 200, seaWithIsland)).toBe(false)
  })
})

describe('unionRingsToSea', () => {
  it('smelter to overlappende kvadrater til én polygon', () => {
    const mp = unionRingsToSea([square(0, 0, 10), square(5, 0, 10)])
    expect(mp.length).toBe(1)        // ett sammenhengende polygon
    // Samlet areal ≈ 15×10 = 150 (overlapp 5×10 telles én gang)
    const area = Math.abs(ringSignedArea(mp[0][0]))
    expect(area).toBeCloseTo(150, 0)
  })
  it('to adskilte kvadrater forblir to polygoner', () => {
    const mp = unionRingsToSea([square(0, 0, 10), square(50, 0, 10)])
    expect(mp.length).toBe(2)
  })
  it('tom input gir tom MultiPolygon', () => {
    expect(unionRingsToSea([])).toEqual([])
    expect(unionRingsToSea([[[0, 0], [1, 1]]])).toEqual([])  // for få punkter
  })
})

describe('unionPolygonsToSea — bevarer øy-hull', () => {
  it('beholder hull når polygoner unioneres', () => {
    const polyWithHole = [square(0, 0, 100), square(40, 40, 20)]
    const mp = unionPolygonsToSea([polyWithHole])
    // Punkt i hullet skal fortsatt være utenfor sjø
    expect(pointInMultiPolygon(50, 50, mp)).toBe(false)
    expect(pointInMultiPolygon(10, 10, mp)).toBe(true)
  })
})

describe('pointFeatureKept — Marker ∈ Water', () => {
  const sea = unionRingsToSea([square(0, 0, 100)])
  it('beholder sjømerke i vann', () => {
    expect(pointFeatureKept(50, 50, sea, { requireWater: true })).toBe(true)
  })
  it('dropper sjømerke på land', () => {
    expect(pointFeatureKept(200, 200, sea, { requireWater: true })).toBe(false)
  })
  it('beholder havnestruktur uansett (requireWater=false)', () => {
    expect(pointFeatureKept(200, 200, sea, { requireWater: false })).toBe(true)
  })
  it('beholder alt når kyst-modell mangler', () => {
    expect(pointFeatureKept(200, 200, [], { requireWater: true })).toBe(true)
  })
})

