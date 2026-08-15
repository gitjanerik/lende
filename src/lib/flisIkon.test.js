import { describe, it, expect } from 'vitest'
import { kvadranterForRetning, KVADRANTER } from './flisIkon.js'

const aktive = (dir) => KVADRANTER.filter(k => kvadranterForRetning(dir)[k])

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
