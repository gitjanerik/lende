import { describe, it, expect } from 'vitest'
import {
  minEquidistanceForWidthKm, breddeHintFor,
  DEFAULT_EQUIDISTANCE_M, EQUIDISTANSE_VALG, EQUIDISTANSE_M,
} from './equidistanceRules.js'

describe('minEquidistanceForWidthKm', () => {
  it('følger terskel-tabellen fra pickeren', () => {
    expect(minEquidistanceForWidthKm(2)).toBe(10)
    expect(minEquidistanceForWidthKm(5.9)).toBe(10)
    expect(minEquidistanceForWidthKm(6)).toBe(20)
    expect(minEquidistanceForWidthKm(9.5)).toBe(20)
    expect(minEquidistanceForWidthKm(10)).toBe(25)
    expect(minEquidistanceForWidthKm(20)).toBe(25)
  })

  it('standard-bredden gir N50-ekvidistansen 25 m (v6.5.76)', () => {
    expect(minEquidistanceForWidthKm(10)).toBe(25)
    expect(minEquidistanceForWidthKm(9.999)).toBe(20)
  })

  it('MCP kan bygge bredere enn appens 20 km-tak — regelen topper på 25 m', () => {
    expect(minEquidistanceForWidthKm(40)).toBe(25)
    expect(minEquidistanceForWidthKm(1000)).toBe(25)
  })

  it('gulvet er alltid et valg som finnes i lista', () => {
    for (const km of [2, 4, 6, 9, 10, 16, 20, 40]) {
      expect(EQUIDISTANSE_M).toContain(minEquidistanceForWidthKm(km))
    }
  })

  it('50 m påtvinges aldri — den er alltid et fritt valg', () => {
    for (const km of [2, 6, 10, 20, 40, 1000]) {
      expect(minEquidistanceForWidthKm(km)).toBeLessThan(50)
    }
  })
})

describe('valglista', () => {
  it('er 10/20/25/50 m — 2,5 og 5 m er fjernet (v6.5.76)', () => {
    expect(EQUIDISTANSE_M).toEqual([10, 20, 25, 50])
    expect(EQUIDISTANSE_M).not.toContain(2.5)
    expect(EQUIDISTANSE_M).not.toContain(5)
  })
  it('hvert valg har etikett og forklaring, og verdiene står i stigende orden', () => {
    for (const o of EQUIDISTANSE_VALG) {
      expect(o.label).toBeTruthy()
      expect(o.desc).toBeTruthy()
    }
    expect([...EQUIDISTANSE_M].sort((a, b) => a - b)).toEqual(EQUIDISTANSE_M)
  })
  it('default er turkart-standarden 20 m, og den står i lista', () => {
    expect(DEFAULT_EQUIDISTANCE_M).toBe(20)
    expect(EQUIDISTANSE_M).toContain(DEFAULT_EQUIDISTANCE_M)
  })
})

describe('breddeHintFor', () => {
  it('forklarer de to valgene som kan bli utelukket', () => {
    expect(breddeHintFor(10)).toContain('6 km')
    expect(breddeHintFor(20)).toContain('10 km')
  })
  it('er tom for valg som aldri utelukkes', () => {
    expect(breddeHintFor(25)).toBe('')
    expect(breddeHintFor(50)).toBe('')
  })
  it('har en hint for hvert valg tabellen faktisk kan sperre', () => {
    // Grovest mulige gulv over hele spennet — alt under det kan bli utelukket.
    const grovesteGulv = Math.max(...[2, 6, 10, 20, 40].map(minEquidistanceForWidthKm))
    for (const v of EQUIDISTANSE_M.filter(v => v < grovesteGulv)) {
      expect(breddeHintFor(v)).not.toBe('')
    }
  })
})
