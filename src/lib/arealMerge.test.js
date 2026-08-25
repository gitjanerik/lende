import { describe, it, expect } from 'vitest'
import { arealKildeFlagg, slaaSammenAreal } from './arealMerge.js'

const osmMyr = { type: 'way', id: 'o1', tags: { natural: 'wetland' } }
const osmSkog = { type: 'way', id: 'o2', tags: { landuse: 'forest' } }
const osmVann = { type: 'way', id: 'o3', tags: { natural: 'water' } }
const n50Myr = { type: 'way', id: 'n1', tags: { natural: 'wetland', 'lende:n50areal': 'myr' } }

describe('arealKildeFlagg — avledet av INNHOLD, ikke av at kilden svarte', () => {
  it('tom kilde gir bare false', () => {
    expect(arealKildeFlagg([])).toEqual({ harMyr: false, harSkog: false, harApen: false })
    expect(arealKildeFlagg(undefined).harMyr).toBe(false)
  })

  it('myr i kilden setter harMyr — og bare den', () => {
    expect(arealKildeFlagg([n50Myr])).toEqual({ harMyr: true, harSkog: false, harApen: false })
  })

  it('skog ville satt harSkog av seg selv den dagen baken bærer den', () => {
    // Dette er hele poenget med å avlede flagget av innholdet: en utvidet bake
    // skal ikke kreve en endring i arealMerge.
    const n50Skog = { tags: { 'lende:n50areal': 'skog' } }
    expect(arealKildeFlagg([n50Myr, n50Skog])).toEqual({ harMyr: true, harSkog: true, harApen: false })
  })
})

describe('slaaSammenAreal', () => {
  it('uten N50 er den en ren gjennomgang', () => {
    const ut = slaaSammenAreal({ osm: [osmMyr, osmSkog] })
    expect(ut).toHaveLength(2)
    expect(ut).toEqual([osmMyr, osmSkog])
  })

  it('N50-myr fortrenger OSM-myr — ellers dobbelt-tegnes mønsteret', () => {
    const ut = slaaSammenAreal({ osm: [osmMyr, osmSkog, osmVann], n50Areal: [n50Myr] })
    expect(ut.map((e) => e.id)).toEqual(['o2', 'o3', 'n1'])
  })

  it('rører ALDRI annet OSM-arealdekke — N50-baken leverer ikke skog', () => {
    const ut = slaaSammenAreal({ osm: [osmSkog, osmVann], n50Areal: [n50Myr] })
    expect(ut.map((e) => e.id)).toEqual(['o2', 'o3', 'n1'])
  })

  it('muterer ikke input', () => {
    const osm = [osmMyr, osmSkog]
    slaaSammenAreal({ osm, n50Areal: [n50Myr] })
    expect(osm).toHaveLength(2)
  })
})
