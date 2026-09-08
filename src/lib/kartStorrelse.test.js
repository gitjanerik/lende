import { describe, it, expect } from 'vitest'
import { formatKartBytes, formatKartKm, kartdataTekst } from './kartStorrelse.js'

describe('formatKartBytes', () => {
  it('gir KB under 1 MB og MB over', () => {
    expect(formatKartBytes(400 * 1024)).toBe('400 KB')
    expect(formatKartBytes(12.4 * 1024 * 1024)).toBe('12,4 MB')
  })
  it('gir null når det ikke er noe å vise', () => {
    expect(formatKartBytes(0)).toBeNull()
    expect(formatKartBytes(undefined)).toBeNull()
    expect(formatKartBytes(NaN)).toBeNull()
  })
})

describe('formatKartKm', () => {
  it('bruker norsk desimalkomma', () => {
    expect(formatKartKm(10000)).toBe('10,0')
    expect(formatKartKm(20480)).toBe('20,5')
  })
})

describe('kartdataTekst', () => {
  it('beskriver et ikke-kvadratisk ark med sine EGNE mål', () => {
    expect(kartdataTekst({ widthM: 10000, heightM: 20000, bytes: 5 * 1024 * 1024 }))
      .toBe('10,0 × 20,0 km · 5,0 MB')
  })
  it('tar med flisetallet bare når arket er mer enn én flis', () => {
    expect(kartdataTekst({ widthM: 4000, heightM: 4000, bytes: 1024, fliser: 1 }))
      .toBe('4,0 × 4,0 km · 1 KB')
    expect(kartdataTekst({ widthM: 8000, heightM: 8000, bytes: 1024, fliser: 4 }))
      .toBe('8,0 × 8,0 km · 1 KB · 4 fliser')
  })
  it('utelater deler som mangler', () => {
    expect(kartdataTekst({ widthM: 2000, heightM: 2000 })).toBe('2,0 × 2,0 km')
    expect(kartdataTekst({ bytes: 2048 })).toBe('2 KB')
    expect(kartdataTekst({})).toBe('')
  })
})
