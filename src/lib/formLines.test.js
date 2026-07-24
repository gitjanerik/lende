import { describe, it, expect } from 'vitest'
import { buildSvg } from './mapBuilder.js'
import { syntheticDEM } from './dem.js'

// ~600 m bbox; eksakt plassering uvesentlig for lag-tilstedeværelse.
const bbox = { south: 59, north: 59.0054, west: 10, east: 10.0105 }
// Matcher <g data-iso="103">…</g>-GRUPPA, ikke CSS-regelen [data-iso="103"].
const has103 = (svg) => /<g data-iso="103">.*?<\/g>/s.test(svg)

// Kuppel med ~120 m relieff → rikelig med 5 m og 2,5 m høydekurver.
const fineDem = () => syntheticDEM(600, 600,
  { originX: 0, originY: 0, pixelWidth: 2, pixelHeight: 2 },
  [{ x: 300, y: 300, h: 120, sigma: 150 }], 100)
const coarseDem = () => syntheticDEM(600, 600,
  { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 },
  [{ x: 300, y: 300, h: 120, sigma: 150 }], 100)

describe('hjelpekurver (ISOM 103)', () => {
  it('formLines=false → ingen 103-gruppe', () => {
    const { svg } = buildSvg([], bbox, { dem: fineDem(), contourIntervalM: 5, formLines: false })
    expect(has103(svg)).toBe(false)
  })

  it('formLines + fint DEM ved 5 m ekvidistanse → 103-gruppe', () => {
    const { svg } = buildSvg([], bbox, { dem: fineDem(), contourIntervalM: 5, formLines: true })
    expect(has103(svg)).toBe(true)
  })

  // Regresjon: default-ekvidistansen er 20 m. Bryteren MÅ virke der også
  // (createMapFlow henter fint DEM når formLines er på), ikke bare ved 5 m.
  it('formLines + fint DEM ved grov (20 m) ekvidistanse → 103-gruppe', () => {
    const { svg } = buildSvg([], bbox, { dem: fineDem(), contourIntervalM: 20, formLines: true })
    expect(has103(svg)).toBe(true)
  })

  // Grovt DEM (10 m) → hjelpekurver ville blitt trappetrinn, så de bygges ikke.
  it('formLines + grovt (10 m) DEM → ingen 103-gruppe', () => {
    const { svg } = buildSvg([], bbox, { dem: coarseDem(), contourIntervalM: 20, formLines: true })
    expect(has103(svg)).toBe(false)
  })
})
