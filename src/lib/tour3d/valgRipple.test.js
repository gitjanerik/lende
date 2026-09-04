import { describe, it, expect } from 'vitest'
import {
  skalRippe, rippleFase, RIPPLE_VARIGHET_S, RIPPLE_START_PX, RIPPLE_SLUTT_PX,
} from './valgRipple.js'

describe('skalRippe', () => {
  const stjerne = { id: 'sirius', type: 'stjerne', azimut: 2.1, hoyde: 0.3 }

  it('kvitterer en løs stjerne — det var bestillingen', () => {
    expect(skalRippe(stjerne)).toBe(true)
  })

  it('kvitterer Merkur og Venus, som verken har ring eller globe', () => {
    expect(skalRippe({ id: 'merkur', type: 'planet', azimut: 1, hoyde: 0.1 })).toBe(true)
    expect(skalRippe({ id: 'venus', type: 'planet', azimut: 1, hoyde: 0.1 })).toBe(true)
  })

  it('kvitterer IKKE et legeme med globe — kula er kvitteringen', () => {
    expect(skalRippe({
      id: 'saturn', type: 'planet', harGlobe: true, azimut: 1, hoyde: 0.4,
    })).toBe(false)
  })

  it('kvitterer IKKE en formasjon — middelretningen er tom himmel (v6.3.11)', () => {
    expect(skalRippe({
      id: 'dragen', type: 'formasjon', azimut: 0.5, hoyde: 1.1,
    })).toBe(false)
  })

  it('krever endelige koordinater', () => {
    expect(skalRippe({ ...stjerne, hoyde: NaN })).toBe(false)
    expect(skalRippe({ ...stjerne, azimut: undefined })).toBe(false)
    expect(skalRippe(null)).toBe(false)
  })
})

describe('rippleFase', () => {
  it('er null før og etter animasjonen', () => {
    expect(rippleFase(-0.01)).toBeNull()
    expect(rippleFase(RIPPLE_VARIGHET_S)).toBeNull()
    expect(rippleFase(RIPPLE_VARIGHET_S + 1)).toBeNull()
    expect(rippleFase(NaN)).toBeNull()
  })

  it('slipper andre bølge ETTER den første', () => {
    const [a, b] = rippleFase(0.05)
    expect(a.opasitet).toBeGreaterThan(0)
    expect(b.opasitet).toBe(0)
    const senere = rippleFase(0.5)
    expect(senere[0].vei).toBeGreaterThan(senere[1].vei)
    expect(senere[1].opasitet).toBeGreaterThan(0)
  })

  it('lar bølgen vokse monotont og falme mens den vokser', () => {
    let forrigeVei = -1
    let forrigeOpasitet = Infinity
    for (let t = 0.02; t < 0.7; t += 0.02) {
      const [b] = rippleFase(t)
      expect(b.vei).toBeGreaterThan(forrigeVei)
      expect(b.opasitet).toBeLessThan(forrigeOpasitet)
      forrigeVei = b.vei
      forrigeOpasitet = b.opasitet
    }
  })

  it('holder veien i [0, 1] gjennom hele animasjonen', () => {
    for (let t = 0; t < RIPPLE_VARIGHET_S; t += 0.01) {
      for (const b of rippleFase(t)) {
        expect(b.vei).toBeGreaterThanOrEqual(0)
        expect(b.vei).toBeLessThanOrEqual(1)
        expect(b.opasitet).toBeGreaterThanOrEqual(0)
        expect(b.opasitet).toBeLessThanOrEqual(1)
      }
    }
  })

  it('begge bølgene rekker helt ut innen animasjonen er over', () => {
    // Blir varigheten kortere enn den siste bølgen trenger, blir den klippet
    // midt i luften — og en bølge som forsvinner på halvveien leses som en feil.
    const sisteFase = rippleFase(RIPPLE_VARIGHET_S - 0.001)
    for (const b of sisteFase) expect(b.opasitet).toBeLessThan(0.05)
  })

  it('starter innenfor trykk-ringens 46 px og ender godt utenfor', () => {
    expect(RIPPLE_START_PX).toBeLessThan(46)
    expect(RIPPLE_SLUTT_PX).toBeGreaterThan(46)
  })
})
