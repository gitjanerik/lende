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
})
