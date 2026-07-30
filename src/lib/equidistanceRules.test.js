import { describe, it, expect } from 'vitest'
import { minEquidistanceForWidthKm, DEFAULT_EQUIDISTANCE_M } from './equidistanceRules.js'

describe('minEquidistanceForWidthKm', () => {
  it('følger terskel-tabellen fra pickeren', () => {
    expect(minEquidistanceForWidthKm(1)).toBe(2.5)
    expect(minEquidistanceForWidthKm(2)).toBe(2.5)
    expect(minEquidistanceForWidthKm(2.1)).toBe(5)
    expect(minEquidistanceForWidthKm(3.9)).toBe(5)
    expect(minEquidistanceForWidthKm(4)).toBe(10)
    expect(minEquidistanceForWidthKm(5.9)).toBe(10)
    expect(minEquidistanceForWidthKm(6)).toBe(20)
    // MCP kan bygge bredere enn appens 16 km-tak — regelen topper på 20 m.
    expect(minEquidistanceForWidthKm(14.2)).toBe(20)
    expect(minEquidistanceForWidthKm(40)).toBe(20)
  })

  it('default er turkart-standarden 20 m', () => {
    expect(DEFAULT_EQUIDISTANCE_M).toBe(20)
  })
})
