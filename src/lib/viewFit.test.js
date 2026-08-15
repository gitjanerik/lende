import { describe, it, expect } from 'vitest'
import { dekningsSkala, DEKNING_OVERSKUDD } from './viewFit.js'

const O = 1 + DEKNING_OVERSKUDD

describe('dekningsSkala', () => {
  it('kvadratisk ark i kvadratisk viewport trenger bare overskuddet', () => {
    expect(dekningsSkala({ w: 800, h: 800, widthM: 8000, heightM: 8000 })).toBeCloseTo(O, 6)
  })

  it('høy viewport (mobil i portrett) med bredt ark skalerer opp på høyden', () => {
    // a = 390/8000, b = 850/8000 → cover/fit = 850/390
    const s = dekningsSkala({ w: 390, h: 850, widthM: 8000, heightM: 8000 })
    expect(s).toBeCloseTo((850 / 390) * O, 6)
  })

  it('A-format-ark (høyere enn bredt) i portrett-viewport', () => {
    // widthM 8000, heightM 11314 → a = 390/8000, b = 850/11314
    const a = 390 / 8000, b = 850 / 11314
    const s = dekningsSkala({ w: 390, h: 850, widthM: 8000, heightM: 11314 })
    expect(s).toBeCloseTo((Math.max(a, b) / Math.min(a, b)) * O, 6)
  })

  it('dekker faktisk viewporten: arket er minst like stort som skjermen etterpå', () => {
    const v = { w: 390, h: 850, widthM: 8000, heightM: 11314 }
    const s = dekningsSkala(v)
    const fit = Math.min(v.w / v.widthM, v.h / v.heightM)
    expect(v.widthM * fit * s).toBeGreaterThanOrEqual(v.w)
    expect(v.heightM * fit * s).toBeGreaterThanOrEqual(v.h)
  })

  it('går aldri under 1', () => {
    expect(dekningsSkala({ w: 100, h: 100, widthM: 8000, heightM: 8000, overskudd: 0 })).toBe(1)
  })

  it('ubrukelige mål gir 1 i stedet for NaN', () => {
    expect(dekningsSkala({ w: 0, h: 850, widthM: 8000, heightM: 8000 })).toBe(1)
    expect(dekningsSkala()).toBe(1)
  })
})
