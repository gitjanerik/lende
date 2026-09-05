import { describe, it, expect } from 'vitest'
import { gpsFeilTekst, gpsFeilForklaring, GPS_FEIL_TEKST, GPS_FEIL_RAAD } from './gpsFeil.js'

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

describe('gpsFeilForklaring', () => {
  it('har et råd for hver kode etiketten dekker', () => {
    expect(Object.keys(GPS_FEIL_RAAD).sort()).toEqual(Object.keys(GPS_FEIL_TEKST).sort())
  })

  it('setter etikett og råd sammen til én setning', () => {
    expect(gpsFeilForklaring(1)).toBe(`${GPS_FEIL_TEKST[1]}. ${GPS_FEIL_RAAD[1]}`)
  })

  it('nevner innstillingen på kode 1 — en avvist tillatelse spørres ikke om igjen', () => {
    expect(gpsFeilForklaring(1)).toMatch(/Tillat/)
  })

  it('gir bare etiketten når koden ikke har noe råd', () => {
    expect(gpsFeilForklaring(99, 'egen tekst')).toBe('egen tekst')
  })
})
