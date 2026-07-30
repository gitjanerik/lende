import { describe, it, expect } from 'vitest'
import { computeTourExtent, shiftPoints, shiftVia, demIntoExtent } from './tourExtent.js'

const META = { widthM: 4000, heightM: 3000, minE: 580000, minN: 6640000, equidistance: 20 }

describe('computeTourExtent', () => {
  it('null når turen (med margin) ligger innenfor flisa', () => {
    expect(computeTourExtent(META, [[500, 500], [3000, 2500]])).toBeNull()
  })

  it('utvider vestover (negativ minX) med margin og 10 m-runding', () => {
    const ext = computeTourExtent(META, [[-1234, 500], [2000, 1000]])
    expect(ext.minX).toBe(Math.floor((-1234 - 250) / 10) * 10)
    expect(ext.minY).toBe(0)
    expect(ext.widthM).toBe(4000 - ext.minX)
    expect(ext.heightM).toBe(3000)
    // Vest-utvidelse flytter øst-forankringen tilsvarende.
    expect(ext.meta3d.minE).toBe(META.minE + ext.minX)
    // Sørkanten er uendret → minN uendret (maxY = heightM).
    expect(ext.meta3d.minN).toBe(META.minN)
  })

  it('utvidelse sørover senker minN (maxY > heightM)', () => {
    const ext = computeTourExtent(META, [[2000, 3400]])
    expect(ext.meta3d.minN).toBe(META.minN + META.heightM - (Math.ceil((3400 + 250) / 10) * 10))
    expect(ext.minX).toBe(0)
  })

  it('via-punkter utenfor teller også', () => {
    const ext = computeTourExtent(META, [[2000, 1000]], [{ svgX: 4500, svgY: 1000 }])
    expect(ext).not.toBeNull()
    expect(ext.widthM).toBeGreaterThan(4000)
  })
})

describe('shiftPoints / shiftVia', () => {
  const ext = { minX: -500, minY: -200 }
  it('forskyver inn i 0-basert rom', () => {
    expect(shiftPoints([[-500, -200], [0, 0]], ext)).toEqual([[0, 0], [500, 200]])
    expect(shiftVia([{ svgX: -100, svgY: 300 }], ext)).toEqual([{ svgX: 400, svgY: 500 }])
  })
})

describe('demIntoExtent', () => {
  it('bliter flisas DEM på riktig offset, noData utenfor', () => {
    const dem = {
      data: new Float32Array([1, 2, 3, 4]),
      cols: 2, rows: 2,
      transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
      noData: -9999,
    }
    // Utvid 20 m vest: nye kolonner 0–1 er noData, flisa ligger i 2–3.
    const out = demIntoExtent(dem, { minX: -20, minY: 0, widthM: 40, heightM: 20 })
    expect(out.cols).toBe(4)
    expect(out.rows).toBe(2)
    expect(out.data[0]).toBe(-9999)
    expect(out.data[2]).toBe(1)
    expect(out.data[3]).toBe(2)
    expect(out.data[4 + 2]).toBe(3)
    expect(out.data[4 + 3]).toBe(4)
  })

  it('null-DEM gir null', () => {
    expect(demIntoExtent(null, { minX: 0, minY: 0, widthM: 10, heightM: 10 })).toBeNull()
  })
})
