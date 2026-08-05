import { describe, it, expect } from 'vitest'
import {
  buildDensityProbeQuery, parseDensityCounts, totalCount, densityCacheKey,
  DENSITY_CATEGORIES,
} from './densityProbe.js'

const BBOX = { south: 59.88, west: 10.68, north: 59.97, east: 10.81 }

describe('buildDensityProbeQuery', () => {
  const q = buildDensityProbeQuery(BBOX)

  it('ber om JSON og setter bbox i header-en', () => {
    expect(q.startsWith('[out:json]')).toBe(true)
    expect(q).toContain(`[bbox:${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}]`)
  })

  it('har ett «out count» per kategori og INGEN geometri-utdata', () => {
    expect((q.match(/out count;/g) ?? []).length).toBe(DENSITY_CATEGORIES.length)
    expect(q).not.toContain('out geom')
    expect(q).not.toContain('out body')
  })

  it('pakker hver kategori i en eksplisitt union', () => {
    // Uten parentesene ville statement nr. 2 overskrive resultatsettet `_`, og
    // vi ville bare telt den SISTE selektoren i kategorien.
    for (const c of DENSITY_CATEGORIES) {
      if (c.selectors.length < 2) continue
      const blokk = `(\n  ${c.selectors.join('\n  ')}\n);\nout count;`
      expect(q).toContain(blokk)
    }
    expect((q.match(/^\(\s*$/gm) ?? []).length).toBe(DENSITY_CATEGORIES.length)
  })

  it('inkluderer alle selektorene', () => {
    for (const c of DENSITY_CATEGORIES) {
      for (const s of c.selectors) expect(q).toContain(s)
    }
  })
})

describe('parseDensityCounts', () => {
  // Formen Overpass faktisk svarer med: ett count-element per «out count»,
  // i samme rekkefølge som statementene.
  const svar = (...totals) => ({
    version: 0.6,
    elements: totals.map(t => ({
      type: 'count', id: 0,
      tags: { nodes: '0', ways: String(t), relations: '0', total: String(t) },
    })),
  })

  it('leser totalene posisjonsbasert mot DENSITY_CATEGORIES', () => {
    const tall = [47759, 542, 41363, 1467, 230, 925]
    const c = parseDensityCounts(svar(...tall))
    DENSITY_CATEGORIES.forEach((cat, i) => expect(c[cat.key], cat.key).toBe(tall[i]))
  })

  it('gir 0 for kategorier som mangler i svaret', () => {
    const c = parseDensityCounts(svar(100, 200))
    expect(c[DENSITY_CATEGORIES[0].key]).toBe(100)
    expect(c[DENSITY_CATEGORIES[1].key]).toBe(200)
    for (const cat of DENSITY_CATEGORIES.slice(2)) expect(c[cat.key], cat.key).toBe(0)
  })

  it('ignorerer ikke-count-elementer', () => {
    const json = { elements: [{ type: 'node', id: 1 }, ...svar(7).elements] }
    expect(parseDensityCounts(json)[DENSITY_CATEGORIES[0].key]).toBe(7)
  })

  it('tåler tomt/ugyldig svar uten å kaste', () => {
    for (const bad of [null, undefined, {}, { elements: null }, { elements: [] }]) {
      const c = parseDensityCounts(bad)
      expect(Object.keys(c).length).toBe(DENSITY_CATEGORIES.length)
      expect(totalCount(c)).toBe(0)
    }
  })

  it('gir 0 i stedet for NaN på søppel-totaler', () => {
    const json = { elements: [{ type: 'count', tags: { total: 'mange' } }] }
    expect(parseDensityCounts(json)[DENSITY_CATEGORIES[0].key]).toBe(0)
  })
})

describe('totalCount', () => {
  it('summerer alle kategorier', () => {
    expect(totalCount({ a: 1, b: 2, c: 3 })).toBe(6)
  })
  it('hopper over ikke-numeriske verdier', () => {
    expect(totalCount({ a: 1, b: 'nei', c: null, d: NaN })).toBe(1)
  })
  it('er 0 for tomt', () => {
    expect(totalCount(null)).toBe(0)
    expect(totalCount({})).toBe(0)
  })
})

describe('densityCacheKey', () => {
  it('kvantiserer til ~0,01° så små senter-justeringer treffer samme celle', () => {
    const a = densityCacheKey({ south: 59.8801, west: 10.6802, north: 59.9703, east: 10.8104 })
    const b = densityCacheKey({ south: 59.8799, west: 10.6798, north: 59.9697, east: 10.8096 })
    expect(a).toBe(b)
  })

  it('skiller områder som faktisk ligger ulike steder', () => {
    expect(densityCacheKey(BBOX)).not.toBe(densityCacheKey({ ...BBOX, south: 64.4 }))
  })

  it('er null uten bbox', () => {
    expect(densityCacheKey(null)).toBeNull()
  })
})
