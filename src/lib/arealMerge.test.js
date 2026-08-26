import { describe, it, expect } from 'vitest'
import { arealKildeFlagg, slaaSammenAreal } from './arealMerge.js'

const osmMyr = { type: 'way', id: 'o1', tags: { natural: 'wetland' } }
const osmSkog = { type: 'way', id: 'o2', tags: { landuse: 'forest' } }
const osmVann = { type: 'way', id: 'o3', tags: { natural: 'water' } }
const n50Myr = { type: 'way', id: 'n1', tags: { natural: 'wetland', 'lende:n50areal': 'myr' } }

describe('arealKildeFlagg — avledet av INNHOLD, ikke av at kilden svarte', () => {
  it('tom kilde gir bare false', () => {
    expect(arealKildeFlagg([])).toEqual({ harMyr: false, harSkog: false, harApen: false, harIsbre: false })
    expect(arealKildeFlagg(undefined).harMyr).toBe(false)
  })

  it('myr i kilden setter harMyr — og bare den', () => {
    expect(arealKildeFlagg([n50Myr])).toEqual({ harMyr: true, harSkog: false, harApen: false, harIsbre: false })
  })

  it('skog ville satt harSkog av seg selv den dagen baken bærer den', () => {
    // Dette er hele poenget med å avlede flagget av innholdet: en utvidet bake
    // skal ikke kreve en endring i arealMerge.
    const n50Skog = { tags: { 'lende:n50areal': 'skog' } }
    expect(arealKildeFlagg([n50Myr, n50Skog]))
      .toEqual({ harMyr: true, harSkog: true, harApen: false, harIsbre: false })
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

  it('rører ALDRI arealdekke kilden ikke leverer', () => {
    const ut = slaaSammenAreal({ osm: [osmSkog, osmVann], n50Areal: [n50Myr] })
    expect(ut.map((e) => e.id)).toEqual(['o2', 'o3', 'n1'])
  })

  it('muterer ikke input', () => {
    const osm = [osmMyr, osmSkog]
    slaaSammenAreal({ osm, n50Areal: [n50Myr] })
    expect(osm).toHaveLength(2)
  })
})

describe('skog fortrenger BARE skog', () => {
  const n50Skog = { id: 'n2', tags: { natural: 'wood', 'lende:n50areal': 'skog' } }
  const osmMyr2 = { id: 'o1', tags: { natural: 'wetland' } }
  const osmWood = { id: 'o2', tags: { natural: 'wood' } }
  const osmForest = { id: 'o3', tags: { landuse: 'forest' } }
  const osmBerg = { id: 'o4', tags: { natural: 'bare_rock' } }

  it('N50-skog fortrenger både natural=wood og landuse=forest', () => {
    const ut = slaaSammenAreal({ osm: [osmWood, osmForest, osmBerg], n50Areal: [n50Skog] })
    expect(ut.map((e) => e.id)).toEqual(['o4', 'n2'])
  })

  it('berg i dagen står urørt — N50s Skog erstatter det ikke', () => {
    const ut = slaaSammenAreal({ osm: [osmBerg], n50Areal: [n50Skog] })
    expect(ut.map((e) => e.id)).toContain('o4')
  })

  // Kjernen i «autoritativ for DET DEN LEVERER»: en bake med bare skog skal
  // ikke røre OSM-myra, og en bake med bare myr skal ikke røre OSM-skogen.
  it('bake med bare skog lar OSM-myra stå', () => {
    const ut = slaaSammenAreal({ osm: [osmMyr2, osmWood], n50Areal: [n50Skog] })
    expect(ut.map((e) => e.id)).toEqual(['o1', 'n2'])
  })

  it('bake med bare myr lar OSM-skogen stå', () => {
    const n50Myr2 = { id: 'n1', tags: { natural: 'wetland', 'lende:n50areal': 'myr' } }
    const ut = slaaSammenAreal({ osm: [osmMyr2, osmWood], n50Areal: [n50Myr2] })
    expect(ut.map((e) => e.id)).toEqual(['o2', 'n1'])
  })
})


describe('isbre — flata viker for N50, men navnet gjør det ikke', () => {
  const n50Isbre = { id: 'n3', tags: { natural: 'glacier', 'lende:n50areal': 'isbre' } }
  const osmBreUtenNavn = { id: 'o5', tags: { natural: 'glacier' } }
  const osmBreMedNavn = { id: 'o6', tags: { natural: 'glacier', name: 'Nigardsbreen' } }
  const osmSkog2 = { id: 'o7', tags: { natural: 'wood' } }

  it('setter harIsbre av seg selv', () => {
    expect(arealKildeFlagg([n50Isbre]).harIsbre).toBe(true)
    expect(arealKildeFlagg([n50Isbre]).harSkog).toBe(false)
  })

  it('en navnløs OSM-bre viker — den er bare N50s dublett', () => {
    const ut = slaaSammenAreal({ osm: [osmBreUtenNavn, osmSkog2], n50Areal: [n50Isbre] })
    expect(ut.map((e) => e.id)).toEqual(['o7', 'n3'])
  })

  it('en NAVNGITT OSM-bre blir stående — N50 Arealdekke har ingen navn å erstatte den med', () => {
    const ut = slaaSammenAreal({ osm: [osmBreMedNavn], n50Areal: [n50Isbre] })
    expect(ut.map((e) => e.id)).toEqual(['o6', 'n3'])
  })

  it('isbre fortrenger ikke skog, og skog ikke isbre', () => {
    const n50Skog = { id: 'n4', tags: { natural: 'wood', 'lende:n50areal': 'skog' } }
    expect(slaaSammenAreal({ osm: [osmBreUtenNavn], n50Areal: [n50Skog] }).map((e) => e.id))
      .toEqual(['o5', 'n4'])
    expect(slaaSammenAreal({ osm: [osmSkog2], n50Areal: [n50Isbre] }).map((e) => e.id))
      .toEqual(['o7', 'n3'])
  })
})
