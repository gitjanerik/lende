import { describe, it, expect } from 'vitest'
import {
  computeExtent, computeTourExtent, demResolutionFor, demsIntoExtent,
  shiftPoints, shiftVia, demIntoExtent,
} from './tourExtent.js'

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

describe('computeExtent — mosaikken er kartet', () => {
  it('null når arket er én flis og det ikke er noen rute', () => {
    expect(computeExtent(META, {})).toBeNull()
    expect(computeExtent(META, {
      mosaic: { minX: 0, minY: 0, maxX: META.widthM, maxY: META.heightM },
    })).toBeNull()
  })

  it('dekker et 3×3-ark: aktiv flis i midten, åtte naboer rundt', () => {
    const ext = computeExtent(META, {
      mosaic: { minX: -4000, minY: -3000, maxX: 8000, maxY: 6000 },
    })
    expect(ext.minX).toBe(-4000)
    expect(ext.minY).toBe(-3000)
    expect(ext.widthM).toBe(12000)
    expect(ext.heightM).toBe(9000)
    expect(ext.meta3d.minE).toBe(META.minE - 4000)
    // Sørkanten flyttet 3000 m ned → minN tilsvarende.
    expect(ext.meta3d.minN).toBe(META.minN - 3000)
  })

  it('mosaikk-kanten får INGEN margin — den er en eksakt flisekant', () => {
    const ext = computeExtent(META, {
      mosaic: { minX: -4000, minY: 0, maxX: META.widthM, maxY: META.heightM },
    })
    expect(ext.minX).toBe(-4000)
    expect(ext.widthM).toBe(8000)
  })

  it('en rute utenfor arket utvider videre, med margin', () => {
    const ext = computeExtent(META, {
      mosaic: { minX: -4000, minY: 0, maxX: META.widthM, maxY: META.heightM },
      route: [[2000, -900]],
    })
    expect(ext.minY).toBe(Math.floor((-900 - 250) / 10) * 10)
  })

  it('gridM snapper utsnittet til DEM-oppløsningen', () => {
    const ext = computeExtent(META, { route: [[-1234, 500]], gridM: 20 })
    expect(ext.minX).toBe(-1500)
    expect(ext.widthM % 20).toBe(0)
  })

  it('computeTourExtent er fortsatt rute-varianten, og krever en rute', () => {
    expect(computeTourExtent(META, [])).toBeNull()
    expect(computeTourExtent(META, [[-1000, 500]])).toEqual(
      computeExtent(META, { route: [[-1000, 500]] }),
    )
  })
})

describe('demResolutionFor', () => {
  it('holder 10 m så lenge utsnittet er håndterbart', () => {
    expect(demResolutionFor(4000, 3000)).toBe(10)
    expect(demResolutionFor(12000, 9000)).toBe(10)
  })

  it('grovner i multipla av 10 m for svært store ark', () => {
    expect(demResolutionFor(20000, 20000)).toBe(20)
    expect(demResolutionFor(40000, 10000)).toBe(30)
  })

  it('tåler tomt utsnitt', () => {
    expect(demResolutionFor(0, 0)).toBe(10)
  })
})

describe('demsIntoExtent — hver flis sin DEM på sin plass', () => {
  const flis = (verdier) => ({
    data: new Float32Array(verdier),
    cols: 2, rows: 2,
    transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
    noData: -9999,
  })

  it('legger nabo-flisa øst for den aktive', () => {
    const ext = { minX: 0, minY: 0, widthM: 40, heightM: 20 }
    const out = demsIntoExtent([
      { dem: flis([1, 2, 3, 4]), x: 0, y: 0 },
      { dem: flis([5, 6, 7, 8]), x: 20, y: 0 },
    ], ext)
    expect(out.cols).toBe(4)
    expect([...out.data.slice(0, 4)]).toEqual([1, 2, 5, 6])
    expect([...out.data.slice(4, 8)]).toEqual([3, 4, 7, 8])
  })

  it('en naboflis vest krever at utsnittet forskyves — noData der ingen flis er', () => {
    const ext = { minX: -20, minY: 0, widthM: 60, heightM: 20 }
    const out = demsIntoExtent([
      { dem: flis([1, 2, 3, 4]), x: 0, y: 0 },
      { dem: flis([5, 6, 7, 8]), x: -20, y: 0 },
    ], ext)
    expect([...out.data.slice(0, 6)]).toEqual([5, 6, 1, 2, -9999, -9999])
  })

  it('hopper over fliser med annen oppløsning framfor å plassere dem feil', () => {
    const grov = {
      ...flis([9, 9, 9, 9]),
      transform: { originX: 0, originY: 0, pixelWidth: 20, pixelHeight: 20 },
    }
    const out = demsIntoExtent([
      { dem: flis([1, 2, 3, 4]), x: 0, y: 0 },
      { dem: grov, x: 20, y: 0 },
    ], { minX: 0, minY: 0, widthM: 40, heightM: 20 })
    expect([...out.data.slice(0, 4)]).toEqual([1, 2, -9999, -9999])
  })

  it('ingen brukbare fliser gir null', () => {
    expect(demsIntoExtent([{ dem: null, x: 0, y: 0 }], { minX: 0, minY: 0, widthM: 10, heightM: 10 }))
      .toBeNull()
    expect(demsIntoExtent([], { minX: 0, minY: 0, widthM: 10, heightM: 10 })).toBeNull()
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
