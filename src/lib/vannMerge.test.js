import { describe, it, expect } from 'vitest'
import { vannKildeFlagg, ytreRinger, slaaSammenVann } from './vannMerge.js'

// Sammenslåingen av OSM-vann og de autoritative kildene. Regelen som holder alt
// sammen: en kilde er autoritativ for DET DEN FAKTISK LEVERER, og ikke for noe
// mer. Testene under er skrevet rundt den ene setningen.

const el = (tags, extra = {}) => ({ type: 'way', id: 1, tags, ...extra })

// En lukket ring rundt (10, 60); en flate med sentroide her er «dekket».
const ringGeom = (lon0, lat0, lon1, lat1) => [
  { lat: lat0, lon: lon0 }, { lat: lat0, lon: lon1 },
  { lat: lat1, lon: lon1 }, { lat: lat1, lon: lon0 }, { lat: lat0, lon: lon0 },
]
const nveInnsjo = (id = 'nve-1') => ({
  type: 'way', id, tags: { natural: 'water' },
  geometry: ringGeom(10, 60, 10.01, 60.01),
})
const osmFlate = (tags, inni = true) => ({
  type: 'way', id: 99, tags,
  geometry: inni ? ringGeom(10.002, 60.002, 10.008, 60.008) : ringGeom(11, 59, 11.01, 59.01),
})

describe('vannKildeFlagg — hva kilden faktisk inneholder', () => {
  it('NVE Innsjødatabasen: innsjøer, ingen bekker, ingen sjø', () => {
    expect(vannKildeFlagg([nveInnsjo()])).toEqual({
      harSjo: false, harInnsjo: true, harBekk: false,
    })
  })

  it('en full N50-vannstack melder både sjø, innsjø og bekk', () => {
    const kilde = [
      el({ natural: 'water' }),
      el({ natural: 'water', salt: 'yes' }),
      el({ waterway: 'stream' }),
    ]
    expect(vannKildeFlagg(kilde)).toEqual({ harSjo: true, harInnsjo: true, harBekk: true })
  })

  it('tom kilde melder ingenting — da er OSM alene autoritativ', () => {
    expect(vannKildeFlagg([])).toEqual({ harSjo: false, harInnsjo: false, harBekk: false })
    expect(vannKildeFlagg(null)).toEqual({ harSjo: false, harInnsjo: false, harBekk: false })
  })
})

describe('ytreRinger', () => {
  it('leser ringer fra både ways og relations-medlemmer', () => {
    const rel = {
      type: 'relation',
      members: [
        { role: 'outer', geometry: ringGeom(1, 1, 2, 2) },
        { role: 'inner', geometry: ringGeom(1.2, 1.2, 1.4, 1.4) },
      ],
    }
    expect(ytreRinger([nveInnsjo(), rel])).toHaveLength(2)   // way + outer, ikke inner
  })

  it('kan utelate ways — asymmetrien appen har for NVE-laget', () => {
    expect(ytreRinger([nveInnsjo()], { inkluderWays: false })).toHaveLength(0)
  })
})

describe('slaaSammenVann — en innsjø-kilde tar ikke elvene med seg', () => {
  // Selve regresjonen (v5.18.3). Headless kastet alt OSM-vann i det kilden
  // leverte én innsjø; NVE har verken elveløp eller bekker, så det som ble
  // kastet ble ikke erstattet av noe. Rondvassbu: 72,7 → 14,6 km elv.
  it('bekker og grøfter overlever en kilde som bare har innsjøer', () => {
    const bekk = el({ waterway: 'stream' })
    const grøft = el({ waterway: 'ditch' })
    const ut = slaaSammenVann({ osm: [bekk, grøft], n50Water: [nveInnsjo()] })
    expect(ut).toContain(bekk)
    expect(ut).toContain(grøft)
  })

  it('elve-FLATER overlever også (Drammenselva, natural=water+water=river)', () => {
    const elv = osmFlate({ natural: 'water', water: 'river', name: 'Drammenselva' })
    expect(slaaSammenVann({ osm: [elv], n50Water: [nveInnsjo()] })).toContain(elv)
  })

  it('innsjøer kilden IKKE dekker beholdes (responsen er ofte ufullstendig)', () => {
    const fjern = osmFlate({ natural: 'water', name: 'Ulvenvatnet' }, false)
    expect(slaaSammenVann({ osm: [fjern], n50Water: [nveInnsjo()] })).toContain(fjern)
  })

  it('innsjøen kilden DEKKER byttes ut — kildens øy-hull skal vinne', () => {
    const kopi = osmFlate({ natural: 'water', name: 'Setten' })
    const kilde = nveInnsjo()
    const ut = slaaSammenVann({ osm: [kopi], n50Water: [kilde] })
    expect(ut).not.toContain(kopi)
    expect(ut).toContain(kilde)
  })

  it('ikke-vann passerer uberørt, og kildens flater legges til', () => {
    const vei = el({ highway: 'path' })
    const kilde = nveInnsjo()
    expect(slaaSammenVann({ osm: [vei], n50Water: [kilde] })).toEqual([vei, kilde])
  })

  it('uten autoritativ kilde (CORS-feil i nettleseren) beholdes ALT OSM-vann', () => {
    const osm = [
      el({ natural: 'water', name: 'Tyrifjorden' }),
      el({ waterway: 'stream' }),
      el({ natural: 'water', salt: 'yes' }),
    ]
    expect(slaaSammenVann({ osm, n50Water: [] })).toEqual(osm)
  })

  it('en kilde som SELV har bekker undertrykker OSM-bekkene, som før', () => {
    const bekk = el({ waterway: 'stream' })
    const kilde = [nveInnsjo(), { type: 'way', id: 'n50-b', tags: { waterway: 'stream' } }]
    expect(slaaSammenVann({ osm: [bekk], n50Water: kilde })).not.toContain(bekk)
  })

  it('NVE-fallbacken legges til, men ikke der N50 alt dekker flata', () => {
    const n50 = nveInnsjo('n50-1')
    const nveDekket = { type: 'relation', id: 'nve-dekket', tags: { natural: 'water' },
      members: [{ role: 'outer', geometry: ringGeom(10.002, 60.002, 10.008, 60.008) }] }
    const nveFjern = { type: 'relation', id: 'nve-fjern', tags: { natural: 'water' },
      members: [{ role: 'outer', geometry: ringGeom(11, 59, 11.01, 59.01) }] }
    const ut = slaaSammenVann({ osm: [], n50Water: [n50], nveLakes: [nveDekket, nveFjern] })
    expect(ut).toContain(n50)
    expect(ut).not.toContain(nveDekket)
    expect(ut).toContain(nveFjern)
  })
})
