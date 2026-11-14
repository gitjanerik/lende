import { describe, it, expect, beforeEach } from 'vitest'
import { pakkMaske, havIBbox, hentHavmaske, havmaskeSvar, nullstillHavmaske, MASKE_VERSJON } from './havmaske.js'

// 4 × 3-rutenett, 1° per celle, vest 10, sør 60 (nord 63). Rad 0 er nord.
//   rad 0 (62–63): . . . X
//   rad 1 (61–62): . . . .
//   rad 2 (60–61): X . . .
function lagMaske() {
  const celler = new Uint8Array(12)
  celler[3] = 1
  celler[8] = 1
  return { vest: 10, sor: 60, dLon: 1, dLat: 1, kolonner: 4, rader: 3, biter: pakkMaske(celler, 4, 3) }
}

describe('pakkMaske', () => {
  it('én bit per celle, lav bit først', () => {
    const b = pakkMaske(Uint8Array.from([1, 0, 0, 1, 0, 0, 0, 0, 1]), 3, 3)
    expect(Array.from(b)).toEqual([0b1001, 0b1])
  })
})

describe('havIBbox', () => {
  const m = lagMaske()
  it('finner sjø i nordøst-hjørnet', () => {
    expect(havIBbox(m, { south: 62.2, north: 62.8, west: 13.2, east: 13.8 })).toBe(true)
  })
  it('finner sjø i sørvest-hjørnet — rad 0 er nord, ikke sør', () => {
    expect(havIBbox(m, { south: 60.2, north: 60.8, west: 10.2, east: 10.8 })).toBe(true)
    expect(havIBbox(m, { south: 62.2, north: 62.8, west: 10.2, east: 10.8 })).toBe(false)
  })
  it('innland midt i rutenettet er nei', () => {
    expect(havIBbox(m, { south: 61.1, north: 61.9, west: 11.1, east: 12.9 })).toBe(false)
  })
  it('en bbox som så vidt rører en sjøcelle er ja', () => {
    expect(havIBbox(m, { south: 61.5, north: 62.01, west: 12.5, east: 13.01 })).toBe(true)
  })
  it('helt utenfor rutenettet er null — masken vet ingenting der', () => {
    expect(havIBbox(m, { south: 70, north: 71, west: 20, east: 21 })).toBeNull()
  })
  it('delvis utenfor klemmes til rutenettet', () => {
    expect(havIBbox(m, { south: 62.5, north: 64, west: 13.5, east: 15 })).toBe(true)
  })
})

describe('hentHavmaske', () => {
  beforeEach(() => nullstillHavmaske())
  const manifest = (over = {}) => JSON.stringify({
    versjon: MASKE_VERSJON, vest: 10, sor: 60, dLon: 1, dLat: 1, kolonner: 4, rader: 3, fil: 'havmaske.bin', ...over,
  })

  it('leser manifest + biter og svarer', async () => {
    const opts = { basePath: '/a/', hentTekst: async () => manifest(), hentBytes: async () => lagMaske().biter }
    expect(await havmaskeSvar({ south: 60.2, north: 60.8, west: 10.2, east: 10.8 }, opts)).toBe(true)
  })
  it('manglende manifest gir null, ikke nei', async () => {
    const opts = { basePath: '/b/', hentTekst: async () => null, hentBytes: async () => null }
    expect(await havmaskeSvar({ south: 60.2, north: 60.8, west: 10.2, east: 10.8 }, opts)).toBeNull()
  })
  it('ukjent versjon gir null', async () => {
    const opts = { basePath: '/c/', hentTekst: async () => manifest({ versjon: 99 }), hentBytes: async () => lagMaske().biter }
    expect(await hentHavmaske(opts)).toBeNull()
  })
  it('for kort bitfil gir null', async () => {
    const opts = { basePath: '/d/', hentTekst: async () => manifest(), hentBytes: async () => new Uint8Array(1) }
    expect(await hentHavmaske(opts)).toBeNull()
  })
  it('et feilet forsøk låser ikke økta', async () => {
    let n = 0
    const opts = {
      basePath: '/e/',
      hentTekst: async () => (n++ === 0 ? null : manifest()),
      hentBytes: async () => lagMaske().biter,
    }
    expect(await hentHavmaske(opts)).toBeNull()
    await new Promise(r => setTimeout(r, 0))
    expect(await hentHavmaske(opts)).not.toBeNull()
  })
})
