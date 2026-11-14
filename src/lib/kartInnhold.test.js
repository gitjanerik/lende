import { describe, it, expect } from 'vitest'
import {
  byggIndeks, tell, sok, naermeste, naermesteFor, beskriv, haversineM,
  naermestePaaLinje, kompass, velgPekere,
} from './kartInnhold.js'

// Et lite, flatt «kart»: 1 m = 1/111 320 grad nord, og øst-vest regnet med
// cos(60°). Origo i 60° N, 10° Ø; y vokser sørover som i SVG-en.
const LAT0 = 60
const LON0 = 10
const M_LAT = 1 / 111320
const M_LON = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180))
const tilMeter = (lat, lon) => ({ x: (lon - LON0) / M_LON, y: -(lat - LAT0) / M_LAT })
const tilWgs = (x, y) => ({ lat: LAT0 - y * M_LAT, lon: LON0 + x * M_LON })
const ll = (x, y) => tilWgs(x, y)

function lagIndeks() {
  return byggIndeks({
    brukerminner: [
      { id: 'b1', ...ll(0, 0), tittel: 'Konnerudgruvene - Bremsebanen ved Pukerudlinna (bunnen)', kategori: 'annet' },
      { id: 'b2', ...ll(0, -800), tittel: 'Konnerudgruvene - Bremsebanen ved Pukerudlinna (toppen)', kategori: 'annet' },
      { id: 'b3', ...ll(500, 0), tittel: 'Gravhaug ved Haugen', kategori: 'gravminne' },
    ],
    fredede: [
      { id: '100-1', ...ll(200, 0), navn: null, art: 'Gravhaug', kategoriLabel: 'Arkeologisk enkeltminne', datering: 'Jernalder', vernetype: 'Automatisk fredet' },
      { id: '100-2', ...ll(1000, 0), navn: 'Rødsberget', art: 'Gravrøys' },
    ],
    stasjoner: [
      { stationId: '12.34.0', stationName: 'Stordammen', riverName: 'Fiskumelva', latitude: ll(0, 300).lat, longitude: ll(0, 300).lon, masl: 210 },
    ],
    stier: [
      // Rett sti nord–sør 50 m vest for bunnen/toppen.
      { isomCode: '505', coordinates: [[-50, 100], [-50, -900]] },
      { isomCode: '504', coordinates: [[0, 2000], [1000, 2000]] },
      { isomCode: '509', coordinates: [[0, 0], [1, 1]] },
    ],
  }, tilMeter, tilWgs)
}

describe('byggIndeks', () => {
  it('normaliserer alle kildene og hopper over broer', () => {
    const idx = lagIndeks()
    expect(idx.map((o) => o.id)).toEqual(['km:b1', 'km:b2', 'km:b3', 'fm:100-1', 'fm:100-2', 'nve:12.34.0', 'sti:0', 'vei:1'])
    const fm = idx.find((o) => o.id === 'fm:100-1')
    expect(fm.navn).toBe('Gravhaug')
    expect(fm.kategori).toBe('Gravhaug')
    expect(idx.find((o) => o.id === 'sti:0').lengdeM).toBeCloseTo(1000, 6)
  })
})

describe('tell', () => {
  it('teller per kategori og kilde, i koden', () => {
    const { kulturminne, malestasjon } = tell(lagIndeks())
    expect(kulturminne.antall).toBe(5)
    expect(kulturminne.perKategori).toEqual({ 'Annet kulturminne': 2, Gravminne: 1, Gravhaug: 1, Gravrøys: 1 })
    expect(kulturminne.perKilde).toEqual({ brukerminne: 3, fredet: 2 })
    expect(malestasjon.antall).toBe(1)
  })

  it('summerer stilengde', () => {
    expect(tell(lagIndeks(), { type: 'sti' }).sti).toMatchObject({ antall: 1, lengdeKm: 1 })
  })
})

describe('sok', () => {
  it('finner Pukerudlinna midt i en lang tittel', () => {
    expect(sok(lagIndeks(), { tekst: 'pukerudlinna' }).map((o) => o.id)).toEqual(['km:b1', 'km:b2'])
  })

  it('«gravhaug» treffer både art og tittel', () => {
    expect(sok(lagIndeks(), { tekst: 'gravhaug' }).map((o) => o.id).sort()).toEqual(['fm:100-1', 'km:b3'])
  })

  it('alle ordene må finnes', () => {
    expect(sok(lagIndeks(), { tekst: 'pukerudlinna toppen' }).map((o) => o.id)).toEqual(['km:b2'])
  })
})

describe('naermeste', () => {
  it('måler punkt mot sti som avstand til linjestykket', () => {
    const idx = lagIndeks()
    const fra = idx.find((o) => o.id === 'km:b1')
    const [t] = naermeste(idx, fra, { type: 'sti' })
    expect(t.o.id).toBe('sti:0')
    expect(t.avstandM).toBeCloseTo(50, 6)
    expect(t.retning).toBe('vest')
  })

  it('punkt mot punkt med haversine, uten seg selv', () => {
    const idx = lagIndeks()
    const fra = idx.find((o) => o.id === 'km:b1')
    const liste = naermeste(idx, fra, { type: 'kulturminne', unntak: fra.id })
    expect(liste[0].o.id).toBe('fm:100-1')
    expect(liste[0].avstandM).toBeCloseTo(200, 0)
    expect(liste[0].retning).toBe('øst')
  })

  it('«hvilken gravhaug ligger nærmest en sti?»', () => {
    const idx = lagIndeks()
    const gravhauger = sok(idx, { tekst: 'gravhaug' })
    const [vinner, nr2] = naermesteFor(idx, gravhauger, { type: 'sti' })
    expect(vinner.fra.id).toBe('fm:100-1')
    expect(vinner.avstandM).toBeCloseTo(250, 6)
    expect(nr2.fra.id).toBe('km:b3')
    expect(nr2.avstandM).toBeCloseTo(550, 6)
  })

  it('målestasjon nærmest et punkt', () => {
    const idx = lagIndeks()
    const p = { ...ll(0, 250), ...tilMeter(ll(0, 250).lat, ll(0, 250).lon) }
    const [t] = naermeste(idx, p, { type: 'malestasjon' })
    expect(t.o.navn).toBe('Stordammen')
    expect(t.avstandM).toBeCloseTo(50, 0)
  })
})

describe('beskriv', () => {
  it('gir klartekst-feltene og utelater tomme', () => {
    const o = lagIndeks().find((x) => x.id === 'fm:100-1')
    const b = beskriv(o)
    expect(b).toMatchObject({ art: 'Gravhaug', datering: 'Jernalder', vern: 'Automatisk fredet' })
    expect('lenke' in b).toBe(false)
  })
})

describe('geometri', () => {
  it('haversine: én breddegrad ≈ 111,2 km', () => {
    expect(haversineM(60, 10, 61, 10)).toBeCloseTo(111195, -1)
  })

  it('punkt–segment klemmer til endepunktet', () => {
    expect(naermestePaaLinje([[0, 0], [10, 0]], 15, 5).avstand).toBeCloseTo(Math.hypot(5, 5), 9)
  })

  it('kompass: y sørover', () => {
    expect(kompass({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe('nord')
    expect(kompass({ x: 0, y: 0 }, { x: -10, y: 10 })).toBe('sørvest')
  })
})

describe('velgPekere', () => {
  const treff = [
    { id: 'km:b1', navn: 'Bunnen', type: 'kulturminne', lat: 1, lon: 1 },
    { id: 'km:b2', navn: 'Toppen', type: 'kulturminne', lat: 1, lon: 1 },
    { id: 'km:b1', navn: 'Bunnen', type: 'kulturminne', lat: 1, lon: 1 },
    { id: 'sti:0', navn: 'Sti', type: 'sti', lat: 1, lon: 1 },
  ]

  it('tar de som er nevnt, pluss stier', () => {
    expect(velgPekere(treff, 'Toppen ligger 50 m fra stien.').map((p) => p.id)).toEqual(['km:b2', 'sti:0'])
  })

  it('nevnes ingen, vises alle (uten duplikater)', () => {
    expect(velgPekere(treff, 'Det er to.').map((p) => p.id)).toEqual(['km:b1', 'km:b2', 'sti:0'])
  })
})
