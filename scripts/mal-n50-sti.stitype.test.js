import { describe, it, expect } from 'vitest'
import { velgStiVerdi } from './mal-n50-sti.mjs'

// N50 har ingen «Sti»-objekttype — sti skilles fra bilveg på et attributt vi
// ikke kjenner navnet på (kjøring 31311189249: 89 372 av 89 839 features er
// `Veglenke`). Vi klassifiserer derfor på VERDIEN, uansett hvilket felt den
// står i. Disse testene fastholder at mønstrene treffer det de skal og lar
// bilveger være i fred.

describe('velgStiVerdi', () => {
  it('finner sti uansett hvilket felt verdien står i', () => {
    expect(velgStiVerdi({ typeveg: 'Sti' })).toBe('sti')
    expect(velgStiVerdi({ vegkategori: 'sti' })).toBe('sti')
    expect(velgStiVerdi({ objtype: 'Veglenke', typeveg: 'Sti' })).toBe('sti')
  })

  it('kjenner igjen traktorveg og barmarksløype, med og uten ø', () => {
    expect(velgStiVerdi({ typeveg: 'Traktorveg' })).toBe('traktorveg')
    expect(velgStiVerdi({ typeveg: 'traktorvegSti' })).toBe('traktorveg')
    expect(velgStiVerdi({ typeveg: 'Barmarksløype' })).toBe('barmarksloype')
    expect(velgStiVerdi({ typeveg: 'Barmarksloype' })).toBe('barmarksloype')
  })

  it('lar bilveg og annen infrastruktur være', () => {
    for (const p of [
      { objtype: 'Veglenke', typeveg: 'enkelBilveg' },
      { objtype: 'Veglenke', typeveg: 'rampe' },
      { objtype: 'Bane' },
      { objtype: 'Vegsperring' },
      { objtype: 'Stasjon' },
    ]) expect(velgStiVerdi(p)).toBeNull()
  })

  it('krever HELE verdien, ikke bare et delstreng-treff', () => {
    // «Stikkveg» inneholder «sti», men er ikke en sti.
    expect(velgStiVerdi({ typeveg: 'Stikkveg' })).toBeNull()
    expect(velgStiVerdi({ navn: 'Stigningen' })).toBeNull()
  })

  it('tåler tomme og ikke-streng-verdier', () => {
    expect(velgStiVerdi({})).toBeNull()
    expect(velgStiVerdi(null)).toBeNull()
    expect(velgStiVerdi({ lengde: 1234, lukket: true, navn: null })).toBeNull()
  })
})
