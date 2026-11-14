import { describe, it, expect } from 'vitest'
import {
  parseSelektorer, osmSelektorer, treffer, filterNokler, flisNoklerForBbox, slaSammenFliser, elementBbox,
  flisNoklerForSegment, flisNoklerForElement, elementIBbox, delteIder, deltFilnavn,
  nesteOsmBake, OSM_BAKE_PLAN,
} from './osmFlis.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildOverpassQuery } from './mapBuilder.js'

describe('osmSelektorer', () => {
  it('leser hver linje i buildOverpassQuery', () => {
    const q = buildOverpassQuery({ south: 0, west: 0, north: 1, east: 1 })
    const linjer = q.split('\n').filter(l => /^\s*(node|way|relation|nwr)\[/.test(l))
    expect(osmSelektorer()).toHaveLength(linjer.length)
  })

  it('kaster på en selektor den ikke forstår', () => {
    expect(() => parseSelektorer('(\n  way(around:5);\n);')).toThrow(/Forstår ikke/)
  })
})

describe('treffer', () => {
  const sel = osmSelektorer()
  it('regex, likhet og nøkkel finnes', () => {
    expect(treffer('way', { highway: 'path' }, sel)).toBe(true)
    expect(treffer('way', { highway: 'pathway' }, sel)).toBe(false)
    expect(treffer('way', { water: 'pond' }, sel)).toBe(true)
    expect(treffer('node', { natural: 'peak' }, sel)).toBe(true)
    expect(treffer('node', { highway: 'path' }, sel)).toBe(false)
  })
  it('alle krav på rad må holde, og !~ godtar manglende nøkkel', () => {
    expect(treffer('way', { highway: 'footway' }, sel)).toBe(false)
    expect(treffer('way', { highway: 'footway', bridge: 'yes' }, sel)).toBe(true)
    expect(treffer('way', { highway: 'footway', bridge: 'no' }, sel)).toBe(false)
    expect(treffer('way', { leisure: 'nature_reserve' }, sel)).toBe(false)
    expect(treffer('way', { leisure: 'nature_reserve', name: 'X' }, sel)).toBe(true)
  })
  it('uten tagger treffer ingenting', () => {
    expect(treffer('way', null, sel)).toBe(false)
  })
})

describe('filterNokler', () => {
  it('gir første positive nøkkel per type', () => {
    const n = filterNokler(osmSelektorer())
    expect(n.way.has('highway')).toBe(true)
    expect(n.node.has('natural')).toBe(true)
    expect(n.relation.has('boundary')).toBe(true)
    expect(n.way.has('bridge')).toBe(false)
  })
})

// Testene bruker et 0,1 × 0,2-gitter, så tallene er lette å lese.
const G = { dLat: 0.1, dLon: 0.2 }

describe('flisNoklerForBbox', () => {
  it('én flis inne i en celle, fire over et hjørne', () => {
    expect(flisNoklerForBbox({ south: 59.81, north: 59.89, west: 10.41, east: 10.59 }, G)).toEqual(['598_52'])
    expect(flisNoklerForBbox({ south: 59.75, north: 59.85, west: 10.3, east: 10.5 }, G).sort())
      .toEqual(['597_51', '597_52', '598_51', '598_52'])
  })
  it('en kant nøyaktig på gitteret drar ikke inn naboen', () => {
    expect(flisNoklerForBbox({ south: 59.8, north: 59.9, west: 10.4, east: 10.6 }, G)).toEqual(['598_52'])
  })
})

describe('flisNoklerForSegment', () => {
  it('en diagonal går gjennom en stripe, ikke hele boksen', () => {
    // Fra celle (0,0) til (4,4): boksen er 25 celler, streken krysser 9.
    const ut = flisNoklerForSegment({ lat: 0.05, lon: 0.1 }, { lat: 0.45, lon: 0.9 + 0.01 }, G)
    expect(ut.size).toBeLessThanOrEqual(9)
    expect(ut.has('0_0')).toBe(true)
    expect(ut.has('4_4')).toBe(true)
    expect(ut.has('0_4')).toBe(false)
  })
  it('hver flis streken faktisk krysser er med', () => {
    const a = { lat: 0.013, lon: 0.017 }, b = { lat: 0.377, lon: 1.234 }
    const ut = flisNoklerForSegment(a, b, G)
    for (let t = 0; t <= 1; t += 0.001) {
      const lat = a.lat + (b.lat - a.lat) * t, lon = a.lon + (b.lon - a.lon) * t
      expect(ut.has(`${Math.floor(lat / G.dLat)}_${Math.floor(lon / G.dLon)}`)).toBe(true)
    }
  })
  it('baklengs og loddrett', () => {
    expect([...flisNoklerForSegment({ lat: 0.35, lon: 0.1 }, { lat: 0.05, lon: 0.1 }, G)].sort())
      .toEqual(['0_0', '1_0', '2_0', '3_0'])
  })
})

describe('flisNoklerForElement', () => {
  it('relasjonen står der medlemmene går', () => {
    const rel = { type: 'relation', id: 1, members: [
      { type: 'way', ref: 1, geometry: [{ lat: 0.05, lon: 0.1 }, { lat: 0.05, lon: 0.3 }] },
      { type: 'way', ref: 2, geometry: [{ lat: 0.55, lon: 0.1 }] },
    ] }
    expect(flisNoklerForElement(rel, G).sort()).toEqual(['0_0', '0_1', '5_0'])
  })
})

describe('elementIBbox', () => {
  const bb = { south: 0, north: 1, west: 0, east: 1 }
  it('en strek som krysser uten et punkt inne er med', () => {
    expect(elementIBbox({ type: 'way', geometry: [{ lat: 0.5, lon: -1 }, { lat: 0.5, lon: 2 }] }, bb)).toBe(true)
  })
  it('en strek som går forbi hjørnet er ikke med, selv om boksen dens overlapper', () => {
    expect(elementIBbox({ type: 'way', geometry: [{ lat: 0.8, lon: -0.5 }, { lat: 1.6, lon: 0.3 }] }, bb)).toBe(false)
  })
})

describe('delte elementer', () => {
  it('filnavnet er trygt', () => {
    expect(deltFilnavn('relation/123')).toBe('delt/relation_123.json.gz')
  })
  it('pekerne løses opp og dedupes', () => {
    const rel = { type: 'relation', id: 7, members: [{ type: 'way', ref: 1, geometry: [{ lat: 59.85, lon: 10.45 }] }] }
    const fliser = [{ elements: [], delte: ['relation/7'] }, { elements: [], delte: ['relation/7', 'relation/8'] }]
    expect(delteIder(fliser)).toEqual(['relation/7', 'relation/8'])
    const ut = slaSammenFliser(fliser, { south: 59.8, north: 59.9, west: 10.4, east: 10.5 }, new Map([['relation/7', rel]]))
    expect(ut.elements).toEqual([rel])
  })
})

describe('slaSammenFliser', () => {
  const vei = { type: 'way', id: 1, geometry: [{ lat: 59.85, lon: 10.45 }, { lat: 59.95, lon: 10.45 }] }
  const langt = { type: 'node', id: 2, lat: 60.5, lon: 10.45 }
  const rel = { type: 'relation', id: 3, members: [{ type: 'way', ref: 9, role: 'outer', geometry: [{ lat: 59.86, lon: 10.46 }] }] }
  it('dedupliserer på id og tar ut det som ligger utenfor', () => {
    const ut = slaSammenFliser([{ elements: [vei, langt] }, { elements: [vei, rel] }, null],
      { south: 59.8, north: 59.9, west: 10.4, east: 10.5 })
    expect(ut.elements.map(e => `${e.type}/${e.id}`)).toEqual(['way/1', 'relation/3'])
  })
  it('elementBbox leser relasjonsmedlemmene', () => {
    expect(elementBbox(rel)).toEqual({ south: 59.86, north: 59.86, west: 10.46, east: 10.46 })
  })
})

describe('nesteOsmBake', () => {
  it('neste 1. i måneden kl. 02:23 UTC', () => {
    expect(nesteOsmBake(new Date('2026-11-14T10:00:00Z')).toISOString()).toBe('2026-12-01T02:23:00.000Z')
    expect(nesteOsmBake(new Date('2026-12-01T02:22:00Z')).toISOString()).toBe('2026-12-01T02:23:00.000Z')
    expect(nesteOsmBake(new Date('2026-12-01T02:23:00Z')).toISOString()).toBe('2027-01-01T02:23:00.000Z')
  })

  it('planen er den samme som cron-linja workflowen kjører på', () => {
    const yml = readFileSync(resolve(__dirname, '../../.github/workflows/bygg-osm-fliser.yml'), 'utf8')
    const cron = yml.match(/cron:\s*'([^']+)'/)[1].split(/\s+/)
    expect(cron).toEqual([String(OSM_BAKE_PLAN.minutt), String(OSM_BAKE_PLAN.time), String(OSM_BAKE_PLAN.dag), '*', '*'])
  })
})
