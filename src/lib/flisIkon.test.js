import { describe, it, expect } from 'vitest'
import { kvadranterForRetning, KVADRANTER, flisIkonRuter, ikonRutenett } from './flisIkon.js'

const aktive = (dir) => KVADRANTER.filter(k => kvadranterForRetning(dir)[k])

// Et 2×2-ark er det generelle tilfellet: alle fire ruter finnes.
const ARK_2x2 = { cols: 2, rows: 2 }
const posisjoner = (dir, ark) =>
  flisIkonRuter(dir, ark).filter(r => r.aktiv).map(r => `${r.x},${r.y}`)

describe('kvadranterForRetning — ikonet peker dit flisa hentes', () => {
  it('kardinal-retninger dekker hele siden (to ruter)', () => {
    expect(aktive('N')).toEqual(['tv', 'th'])
    expect(aktive('S')).toEqual(['bv', 'bh'])
    expect(aktive('E')).toEqual(['th', 'bh'])
    expect(aktive('W')).toEqual(['tv', 'bv'])
  })

  it('diagonaler dekker hjørnet (én rute)', () => {
    expect(aktive('NE')).toEqual(['th'])
    expect(aktive('NW')).toEqual(['tv'])
    expect(aktive('SE')).toEqual(['bh'])
    expect(aktive('SW')).toEqual(['bv'])
  })

  it('nord er OPP og øst er HØYRE — ikonet er geografisk, ikke speilet', () => {
    expect(kvadranterForRetning('N').tv && kvadranterForRetning('N').th).toBe(true)
    expect(kvadranterForRetning('N').bv || kvadranterForRetning('N').bh).toBe(false)
    expect(kvadranterForRetning('E').th && kvadranterForRetning('E').bh).toBe(true)
    expect(kvadranterForRetning('E').tv || kvadranterForRetning('E').bv).toBe(false)
  })

  it('ukjent retning lar alle fire animere, så ikonet aldri står dødt', () => {
    expect(aktive(null)).toEqual(KVADRANTER)
    expect(aktive('tull')).toEqual(KVADRANTER)
  })
})

describe('ikonRutenett — ikonet er arket ETTER utvidelsen, klemt til 2×2', () => {
  it('ett enslig ark får rutenettet av retningen det vokser i', () => {
    expect(ikonRutenett('N', { cols: 1, rows: 1 })).toEqual({ kol: 1, rad: 2 })
    expect(ikonRutenett('S', { cols: 1, rows: 1 })).toEqual({ kol: 1, rad: 2 })
    expect(ikonRutenett('W', { cols: 1, rows: 1 })).toEqual({ kol: 2, rad: 1 })
    expect(ikonRutenett('NE', { cols: 1, rows: 1 })).toEqual({ kol: 2, rad: 2 })
  })

  it('en stående stripe blir værende én kolonne når den vokser opp eller ned', () => {
    expect(ikonRutenett('N', { cols: 1, rows: 3 })).toEqual({ kol: 1, rad: 2 })
    expect(ikonRutenett('S', { cols: 1, rows: 3 })).toEqual({ kol: 1, rad: 2 })
  })

  it('en stående stripe som vokser sidelengs blir to kolonner', () => {
    expect(ikonRutenett('E', { cols: 1, rows: 3 })).toEqual({ kol: 2, rad: 2 })
  })

  it('et stort ark klemmes til 2×2', () => {
    expect(ikonRutenett('N', { cols: 4, rows: 4 })).toEqual({ kol: 2, rad: 2 })
  })

  it('ukjent retning gir et helt ark', () => {
    expect(ikonRutenett(null, { cols: 1, rows: 1 })).toEqual({ kol: 2, rad: 2 })
    expect(ikonRutenett('tull', { cols: 1, rows: 1 })).toEqual({ kol: 2, rad: 2 })
  })
})

describe('flisIkonRuter — hvilke ruter animerer', () => {
  it('på et 2×2-ark dekker kardinal-retningen hele siden', () => {
    expect(posisjoner('W', ARK_2x2)).toEqual(['4,4', '4,17'])
    expect(posisjoner('E', ARK_2x2)).toEqual(['17,4', '17,17'])
    expect(posisjoner('N', ARK_2x2)).toEqual(['4,4', '17,4'])
    expect(posisjoner('S', ARK_2x2)).toEqual(['4,17', '17,17'])
  })

  it('på et 2×2-ark dekker diagonalen bare hjørnet', () => {
    expect(posisjoner('NE', ARK_2x2)).toEqual(['17,4'])
    expect(posisjoner('SW', ARK_2x2)).toEqual(['4,17'])
  })

  it('ved stående stripe animerer bare ÉN rute — den i retningen', () => {
    const nord = flisIkonRuter('N', { cols: 1, rows: 3 })
    expect(nord).toHaveLength(2)
    expect(nord.filter(r => r.aktiv)).toHaveLength(1)
    expect(nord[0].aktiv).toBe(true)
    expect(nord[1].aktiv).toBe(false)

    const sor = flisIkonRuter('S', { cols: 1, rows: 3 })
    expect(sor.filter(r => r.aktiv)).toHaveLength(1)
    expect(sor[1].aktiv).toBe(true)
  })

  it('ved liggende stripe animerer bare ÉN rute — den i retningen', () => {
    const vest = flisIkonRuter('W', { cols: 3, rows: 1 })
    expect(vest).toHaveLength(2)
    expect(vest.filter(r => r.aktiv)).toHaveLength(1)
    expect(vest[0].aktiv).toBe(true)

    const ost = flisIkonRuter('E', { cols: 3, rows: 1 })
    expect(ost.filter(r => r.aktiv)).toHaveLength(1)
    expect(ost[1].aktiv).toBe(true)
  })

  it('en enkelt rute står midtstilt i 32×32-viewBoxen', () => {
    const nord = flisIkonRuter('N', { cols: 1, rows: 1 })
    expect(nord.every(r => r.x === 10.5)).toBe(true)
    expect(nord.map(r => r.y)).toEqual([4, 17])
  })

  it('ukjent retning lar alle fire animere', () => {
    const alle = flisIkonRuter(null, { cols: 1, rows: 1 })
    expect(alle).toHaveLength(4)
    expect(alle.every(r => r.aktiv)).toBe(true)
  })

  it('nøklene er unike, så v-for ikke gjenbruker DOM-noder', () => {
    const n = flisIkonRuter('NE', ARK_2x2)
    expect(new Set(n.map(r => r.k)).size).toBe(n.length)
  })
})
