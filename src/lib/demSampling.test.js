import { describe, it, expect } from 'vitest'
import {
  sampleElevation,
  findHighestPoint,
  packDem,
  unpackDem,
  downsampleDem,
} from './demSampling.js'

// Helper: bygger en DEM med 4×4-grid og pixelWidth = 10m.
//   col=0 col=1 col=2 col=3
//   row 0:    [v0,  v1,  v2,  v3]   (svgY=0..10)
//   row 1:    [...]                 (svgY=10..20)
//   row 2:    [...]
//   row 3:    [...]
function makeDem(values, opts = {}) {
  const cols = opts.cols ?? 4
  const rows = opts.rows ?? 4
  return {
    data: new Float32Array(values),
    cols,
    rows,
    transform: {
      originX: 0,
      originY: 0,
      pixelWidth: opts.pixelWidth ?? 10,
      pixelHeight: opts.pixelHeight ?? 10,
    },
    noData: -9999,
  }
}

describe('downsampleDem', () => {
  it('returnerer samme referanse når DEM alt er ≥ mål (factor ≤ 1)', () => {
    const dem = makeDem([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], { pixelWidth: 10, pixelHeight: -10 })
    expect(downsampleDem(dem, 10)).toBe(dem)
  })

  it('box-snitter et 2 m-rutenett ned til ~10 m (factor 5) og oppdaterer transform', () => {
    const cols = 10, rows = 10
    const vals = new Float32Array(cols * rows)
    for (let i = 0; i < vals.length; i++) vals[i] = 100   // flatt → snitt = 100
    const dem = { data: vals, cols, rows, transform: { originX: 0, originY: 0, pixelWidth: 2, pixelHeight: -2 }, noData: -9999 }
    const out = downsampleDem(dem, 10)   // factor = round(10/2) = 5
    expect(out.cols).toBe(2)
    expect(out.rows).toBe(2)
    expect(out.transform.pixelWidth).toBe(10)
    expect(out.transform.pixelHeight).toBe(-10)
    for (const v of out.data) expect(v).toBeCloseTo(100)
    // Kraftig reduksjon i celletall (kartfil-vekt): 100 → 4 celler.
    expect(out.data.length).toBeLessThan(vals.length / 10)
  })

  it('hopper over noData-celler i snittet', () => {
    const cols = 4, rows = 4
    const vals = new Float32Array(cols * rows).fill(50)
    vals[0] = -9999   // én noData i første 2×2-blokk
    const dem = { data: vals, cols, rows, transform: { originX: 0, originY: 0, pixelWidth: 5, pixelHeight: -5 }, noData: -9999 }
    const out = downsampleDem(dem, 10)   // factor 2 → 2×2 ut
    expect(out.data[0]).toBeCloseTo(50)  // snitt av de tre gyldige 50-ene
  })
})

describe('sampleElevation', () => {
  it('returns exact grid value at integer cell centers', () => {
    const dem = makeDem([
      0, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15,
    ])
    // col=0, row=0 → svg(0,0) = 0
    expect(sampleElevation(dem, 0, 0)).toBe(0)
    // col=2, row=1 → svg(20,10) = 6
    expect(sampleElevation(dem, 20, 10)).toBe(6)
    // col=3, row=3 → svg(30,30) = 15
    expect(sampleElevation(dem, 30, 30)).toBe(15)
  })

  it('bilinear-interpolates between grid points', () => {
    // 2×2 with values 0,10,20,30 — midt mellom (col=0.5, row=0.5) skal gi 15
    const dem = makeDem([
      0, 10,
      20, 30,
    ], { cols: 2, rows: 2 })
    expect(sampleElevation(dem, 5, 5)).toBeCloseTo(15, 6)
    // 1/4 av veien fra 0 mot 10 = 2.5
    expect(sampleElevation(dem, 2.5, 0)).toBeCloseTo(2.5, 6)
    // 1/4 av veien fra 0 mot 20 = 5
    expect(sampleElevation(dem, 0, 2.5)).toBeCloseTo(5, 6)
  })

  it('returns NaN for out-of-bounds coords', () => {
    const dem = makeDem([0, 1, 2, 3], { cols: 2, rows: 2 })
    expect(sampleElevation(dem, -1, 0)).toBeNaN()
    expect(sampleElevation(dem, 0, -1)).toBeNaN()
    expect(sampleElevation(dem, 100, 0)).toBeNaN()
    expect(sampleElevation(dem, 0, 100)).toBeNaN()
  })

  it('returns NaN if any of the 4 corners is noData', () => {
    const dem = makeDem([
      0, -9999,
      20, 30,
    ], { cols: 2, rows: 2 })
    expect(sampleElevation(dem, 5, 5)).toBeNaN()
  })
})

describe('findHighestPoint', () => {
  it('locates the maximum cell center', () => {
    const dem = makeDem([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 99, // toppen er nederst-høyre (col=3, row=3)
    ])
    const peak = findHighestPoint(dem)
    expect(peak).not.toBeNull()
    expect(peak.elevation).toBe(99)
    // Cell-senter: (3+0.5)*10 = 35
    expect(peak.svgX).toBe(35)
    expect(peak.svgY).toBe(35)
  })

  it('ignores noData values', () => {
    const dem = makeDem([
      1, 2,
      -9999, 3, // -9999 er ikke høyeste (3 er det)
    ], { cols: 2, rows: 2 })
    const peak = findHighestPoint(dem)
    expect(peak.elevation).toBe(3)
  })

  it('returns null if all values are noData', () => {
    const dem = makeDem([-9999, -9999, -9999, -9999], { cols: 2, rows: 2 })
    expect(findHighestPoint(dem)).toBeNull()
  })
})

describe('packDem / unpackDem', () => {
  it('roundtrips DEM via ArrayBuffer', () => {
    const original = makeDem([0, 10, 20, 30], { cols: 2, rows: 2 })
    const packed = packDem(original)
    expect(packed.buffer).toBeInstanceOf(ArrayBuffer)
    const restored = unpackDem(packed)
    expect(restored.cols).toBe(original.cols)
    expect(restored.rows).toBe(original.rows)
    expect(restored.transform.pixelWidth).toBe(original.transform.pixelWidth)
    expect(Array.from(restored.data)).toEqual(Array.from(original.data))
  })
})
