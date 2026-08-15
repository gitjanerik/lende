import { describe, it, expect } from 'vitest'
import { erOversikt, OVERSIKT_FRAC } from './useMapExtend.js'

// Portrett-telefon, kvadratisk 8 km-flis. Ved skala 1 (meet) får HELE flisa
// plass på skjermen — altså oversikt. Zoomer man inn, er den det ikke lenger.
const base = { w: 390, h: 850, widthM: 8000, heightM: 8000 }

describe('erOversikt — skrur av auto-promotering under oversikts-zoom', () => {
  it('skala 1 på et ark som får plass = oversikt', () => {
    expect(erOversikt({ ...base, scale: 1 })).toBe(true)
  })

  it('zoomet inn = ikke oversikt', () => {
    expect(erOversikt({ ...base, scale: 4 })).toBe(false)
  })

  it('zoomet langt ut = fortsatt oversikt', () => {
    expect(erOversikt({ ...base, scale: 0.2 })).toBe(true)
  })

  it('terskelen ligger der den skal: like over og like under', () => {
    // Ved fit er synlig bredde = w/fit. Vi løser for skalaen som treffer
    // nøyaktig widthM * frac.
    const fit = Math.min(base.w / base.widthM, base.h / base.heightM)
    const grense = base.w / (fit * base.widthM * OVERSIKT_FRAC)
    expect(erOversikt({ ...base, scale: grense * 1.01 })).toBe(false)
    expect(erOversikt({ ...base, scale: grense * 0.99 })).toBe(true)
  })

  it('ubrukelige mål gir false i stedet for NaN-oppførsel', () => {
    expect(erOversikt(null)).toBe(false)
    expect(erOversikt({ ...base, widthM: 0, scale: 1 })).toBe(false)
    expect(erOversikt({ ...base, w: 0, scale: 1 })).toBe(false)
  })
})
