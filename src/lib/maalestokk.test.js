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

  // v7.9.5: punktSkala er RUTEmeter per BAKKEmeter, og etiketten er bakkemeter.
  // Én bakkemeter er derfor k rutemeter, og baren for samme tall blir LENGER —
  // ikke kortere. Fortegnet er den ene tingen som er lett å snu her.
  it('strekker baren når UTM-skalaen er over 1', () => {
    const rett = beregnMaalestokk({ w: 430, h: 900, widthM: 8000, heightM: 8000, scale: 1 })
    const vardo = beregnMaalestokk({ w: 430, h: 900, widthM: 8000, heightM: 8000, scale: 1, punktSkala: 1.00769 })
    expect(vardo.label).toBe(rett.label)
    expect(vardo.px).toBeGreaterThan(rett.px)
    expect(vardo.px / rett.px).toBeCloseTo(1.00769, 5)
  })

  it('står uendret uten punktSkala — et ark uten posisjon skal ikke gjette', () => {
    const uten = beregnMaalestokk({ w: 430, h: 900, widthM: 8000, heightM: 8000, scale: 1 })
    for (const k of [undefined, 1, 0, -1, NaN]) {
      expect(beregnMaalestokk({ w: 430, h: 900, widthM: 8000, heightM: 8000, scale: 1, punktSkala: k }).px)
        .toBe(uten.px)
    }
  })

  it('returnerer tom bar uten meta eller uten målt wrapper', () => {
    const tom = { px: 0, label: '', ticks: [] }
    expect(beregnMaalestokk({ w: 0, h: 0, widthM: 2000, heightM: 2000, scale: 1 })).toEqual(tom)
    expect(beregnMaalestokk({ w: 430, h: 900, widthM: undefined, heightM: undefined, scale: 1 })).toEqual(tom)
  })
})
