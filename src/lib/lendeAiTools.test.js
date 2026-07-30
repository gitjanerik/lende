import { describe, it, expect } from 'vitest'
import { AI_TOOLS, buildTourQuery, projectForModel } from './lendeAiTools.js'
import { parseTourQuery } from './tour3dLink.js'

describe('AI_TOOLS', () => {
  it('har OpenAI-formen modellen leser', () => {
    for (const t of AI_TOOLS) {
      expect(t.type).toBe('function')
      expect(t.function.name).toBeTruthy()
      expect(t.function.description).toBeTruthy()
      expect(t.function.parameters.type).toBe('object')
    }
  })

  it('har unike verktøynavn', () => {
    const navn = AI_TOOLS.map((t) => t.function.name)
    expect(new Set(navn).size).toBe(navn.length)
  })
})

describe('buildTourQuery', () => {
  it('bygger query som parseTourQuery i MapView leser tilbake', () => {
    const q = buildTourQuery({
      fraLat: 59.7412, fraLon: 10.1934,
      tilLat: 59.7211, tilLon: 10.1533,
      navn: 'Stormoen–Konnerudkollen',
    })
    const tur = parseTourQuery(q)
    expect(tur.origin.lat).toBeCloseTo(59.7412, 4)
    expect(tur.dest.lon).toBeCloseTo(10.1533, 4)
    expect(tur.open3d).toBe(true)
    expect(tur.name).toBe('Stormoen–Konnerudkollen')
  })

  it('utelater turnavn når det mangler', () => {
    const q = buildTourQuery({ fraLat: 1, fraLon: 2, tilLat: 3, tilLon: 4 })
    expect(q.tn).toBeUndefined()
    expect(q.v3d).toBe('1')
  })
})

describe('projectForModel', () => {
  it('projiserer kompakt og tåler hull i data', () => {
    const ut = projectForModel(
      [{ id: 'kart_a', navn: 'Håøya', meta: { widthM: 4200 }, updatedAt: 't1' }, { id: 'kart_b' }],
      [{ id: 'rute_x', navn: 'Finnemarka rundt', createdAt: 't2' }]
    )
    expect(ut.kart[0]).toEqual({ id: 'kart_a', navn: 'Håøya', kmBredde: 4.2, sistEndret: 't1' })
    expect(ut.kart[1].navn).toBe('Uten navn')
    expect(ut.kart[1].kmBredde).toBeNull()
    expect(ut.grusruter[0].sistEndret).toBe('t2')
  })
})
