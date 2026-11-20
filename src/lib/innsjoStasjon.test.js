import { describe, it, expect } from 'vitest'
import { avstandTilOmrissKm, velgInnsjoStasjon, omrissBbox } from './innsjoStasjon.js'

// Kvadratisk innsjø på ~1,1 × 0,5 km ved 60° N, med en øy midt i.
const ytre = [[10, 60], [10.02, 60], [10.02, 60.01], [10, 60.01]]
const oy = [[10.009, 60.004], [10.011, 60.004], [10.011, 60.006], [10.009, 60.006]]
const omriss = [ytre, oy]
const st = (id, lat, lon, params) => ({
  stationId: id, latitude: lat, longitude: lon, seriesList: params.map(parameter => ({ parameter })),
})

describe('avstandTilOmrissKm', () => {
  it('er 0 i vannet og > 0 på øya og utenfor', () => {
    expect(avstandTilOmrissKm(omriss, 60.002, 10.005)).toBe(0)
    expect(avstandTilOmrissKm(omriss, 60.005, 10.01)).toBeGreaterThan(0)
    expect(avstandTilOmrissKm(omriss, 60.02, 10.01)).toBeCloseTo(1.1, 1)
  })
})

describe('velgInnsjoStasjon', () => {
  it('tar stasjonen i vannet foran en elvestasjon like ved', () => {
    const v = velgInnsjoStasjon([
      st('elv', 60.011, 10.02, [1001, 1003]),
      st('vann', 60.005, 10.002, [1000, 1003]),
    ], omriss)
    expect(v.stasjon.stationId).toBe('vann')
    expect(v.iVannet).toBe(true)
  })
  it('godtar en elvestasjon innen radien, ikke utenfor', () => {
    expect(velgInnsjoStasjon([st('elv', 60.015, 10.01, [1001])], omriss).stasjon.stationId).toBe('elv')
    expect(velgInnsjoStasjon([st('langt', 60.05, 10.01, [1001])], omriss)).toBeNull()
  })
  it('hopper over stasjoner uten vann-parametere', () => {
    expect(velgInnsjoStasjon([st('sno', 60.005, 10.002, [2002])], omriss)).toBeNull()
  })
})

describe('omrissBbox', () => {
  it('rommer omrisset med margin', () => {
    const b = omrissBbox(omriss, 2)
    expect(b.south).toBeLessThan(60 - 0.017)
    expect(b.east).toBeGreaterThan(10.02 + 0.035)
    expect(omrissBbox([])).toBeNull()
  })
})
