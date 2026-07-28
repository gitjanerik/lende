import { describe, it, expect } from 'vitest'
import { relativeDayNo, mapsSummary, routesSummary } from './menuSummary.js'

// Fast referanse-tid så «i dag»/«i går» er deterministisk: 14. mars 2026, 10:00
// lokal tid.
const NOW = new Date(2026, 2, 14, 10, 0, 0).getTime()
const at = (y, m, d, h = 12) => new Date(y, m, d, h).getTime()

describe('relativeDayNo', () => {
  it('samme kalenderdag → «i dag»', () => {
    expect(relativeDayNo(at(2026, 2, 14, 6), NOW)).toBe('i dag')
    expect(relativeDayNo(at(2026, 2, 14, 23), NOW)).toBe('i dag')
  })
  it('dagen før → «i går», også over midnatt', () => {
    expect(relativeDayNo(at(2026, 2, 13, 23), NOW)).toBe('i går')
    // 23:50 i går er «i går» klokka 00:10 — ikke «i dag» (kalenderdag, ikke timer).
    expect(relativeDayNo(at(2026, 2, 13, 23), new Date(2026, 2, 14, 0, 10).getTime())).toBe('i går')
  })
  it('eldre samme år → dag + måned uten årstall', () => {
    const s = relativeDayNo(at(2026, 1, 3), NOW)
    expect(s).toMatch(/3/)
    expect(s).not.toMatch(/2026/)
  })
  it('annet år → årstall med', () => {
    expect(relativeDayNo(at(2025, 10, 3), NOW)).toMatch(/2025/)
  })
  it('ugyldig tidsstempel → tom streng', () => {
    expect(relativeDayNo(undefined, NOW)).toBe('')
    expect(relativeDayNo(NaN, NOW)).toBe('')
    expect(relativeDayNo(null, NOW)).toBe('')
  })
})

describe('mapsSummary', () => {
  it('tom liste → oppfordring, ikke «0 lagrede»', () => {
    expect(mapsSummary([], NOW)).toBe('Ingen lagrede kart ennå')
    expect(mapsSummary(undefined, NOW)).toBe('Ingen lagrede kart ennå')
  })
  it('ett kart bøyes i entall', () => {
    expect(mapsSummary([{ navn: 'Håøya', opprettet: at(2026, 2, 14) }], NOW))
      .toBe('1 lagret · sist Håøya i dag')
  })
  it('flere kart: antall + nyeste navn og dag', () => {
    const maps = [
      { navn: 'Håøya', opprettet: at(2026, 2, 13) },
      { navn: 'Vardåsen', opprettet: at(2026, 2, 1) },
    ]
    expect(mapsSummary(maps, NOW)).toBe('2 lagrede · sist Håøya i går')
  })
  it('kart uten navn → bare antall og dag', () => {
    expect(mapsSummary([{ opprettet: at(2026, 2, 14) }], NOW)).toBe('1 lagret · sist i dag')
  })
  it('kart uten dato → bare antall og navn', () => {
    expect(mapsSummary([{ navn: 'Håøya' }], NOW)).toBe('1 lagret · sist Håøya')
  })
})

describe('routesSummary', () => {
  it('tom liste → oppfordring', () => {
    expect(routesSummary([])).toBe('Ingen ruter ennå')
    expect(routesSummary(undefined)).toBe('Ingen ruter ennå')
  })
  it('summerer lengden og runder til hele km over 10 km', () => {
    const routes = [{ lengthM: 20500 }, { lengthM: 20500 }]
    expect(routesSummary(routes)).toBe('2 ruter · 41 km planlagt')
  })
  it('under 10 km beholder én desimal med komma', () => {
    expect(routesSummary([{ lengthM: 800 }])).toBe('1 rute · 0,8 km planlagt')
  })
  it('hopper over ruter uten lengde', () => {
    expect(routesSummary([{ lengthM: 12000 }, {}, { lengthM: null }]))
      .toBe('3 ruter · 12 km planlagt')
  })
  it('ingen lengde i det hele tatt → bare antall', () => {
    expect(routesSummary([{}, {}])).toBe('2 ruter')
  })
})
