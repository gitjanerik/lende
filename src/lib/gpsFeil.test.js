import { describe, it, expect } from 'vitest'
import { gpsFeilTekst, GPS_FEIL_TEKST } from './gpsFeil.js'

describe('gpsFeilTekst', () => {
  it('dekker alle tre Geolocation-kodene', () => {
    expect(Object.keys(GPS_FEIL_TEKST).sort()).toEqual(['1', '2', '3'])
    for (const kode of [1, 2, 3]) expect(gpsFeilTekst(kode)).toMatch(/GPS/)
  })

  it('nevner tillatelse på kode 1 — det er den brukeren kan gjøre noe med', () => {
    expect(gpsFeilTekst(1)).toBe('GPS-tillatelse avvist')
  })

  it('faller tilbake på ukjent og manglende kode', () => {
    expect(gpsFeilTekst(undefined)).toBe('GPS-feil')
    expect(gpsFeilTekst(99, 'egen tekst')).toBe('egen tekst')
  })

  // v7.8.16: etiketten er den ENESTE varianten. Bar den en gang et råd i tillegg
  // («Trykk på låsikonet …»), var den lange varianten i bruk ett sted og den
  // korte to andre — samme feil i to lengder leses som to ulike feil.
  it('er én setning uten punktum — boksen viser etiketten alene', () => {
    for (const kode of [1, 2, 3]) expect(gpsFeilTekst(kode)).not.toMatch(/\./)
  })
})
