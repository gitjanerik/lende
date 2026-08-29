import { describe, it, expect } from 'vitest'
import { beregnMaalestokk, SCALE_BAR_MAX_PX } from './maalestokk.js'

// Verdiene er tatt fra MapViews egen scaleBar-computed FØR uttrekket i v6.5.0.
// Endrer noen tallene her, har linjalen skiftet oppførsel — ikke oppdater dem
// uten å ha ment det.
describe('beregnMaalestokk', () => {
  it('velger største kandidat som passer under taket', () => {
    const r = beregnMaalestokk({ w: 430, h: 900, widthM: 2000, heightM: 2000, scale: 1 })
    expect(r.label).toBe('500 m')
    expect(r.px).toBeCloseTo(107.5, 5)
    expect(r.px).toBeLessThanOrEqual(SCALE_BAR_MAX_PX)
  })

  it('gir fem tikker jevnt fordelt over lengden', () => {
    const { ticks, px } = beregnMaalestokk({ w: 430, h: 900, widthM: 2000, heightM: 2000, scale: 1 })
    expect(ticks).toHaveLength(5)
    expect(ticks[0]).toEqual({ px: 0, m: 0 })
    expect(ticks[4].px).toBeCloseTo(px, 5)
    expect(ticks[4].m).toBe(500)
  })

  it('bytter til km-etikett når man zoomer ut på et stort kart', () => {
    const r = beregnMaalestokk({ w: 430, h: 900, widthM: 16000, heightM: 16000, scale: 1 })
    expect(r.label).toMatch(/km$/)
  })

  it('følger zoom — mer zoom gir finere trinn', () => {
    const ut = beregnMaalestokk({ w: 430, h: 900, widthM: 2000, heightM: 2000, scale: 1 })
    const inn = beregnMaalestokk({ w: 430, h: 900, widthM: 2000, heightM: 2000, scale: 8 })
    expect(inn.ticks[4].m).toBeLessThan(ut.ticks[4].m)
  })

  it('returnerer tom bar uten meta eller uten målt wrapper', () => {
    const tom = { px: 0, label: '', ticks: [] }
    expect(beregnMaalestokk({ w: 0, h: 0, widthM: 2000, heightM: 2000, scale: 1 })).toEqual(tom)
    expect(beregnMaalestokk({ w: 430, h: 900, widthM: undefined, heightM: undefined, scale: 1 })).toEqual(tom)
  })
})
