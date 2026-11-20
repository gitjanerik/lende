import { describe, it, expect } from 'vitest'
import { kodLinje, dekodLinje, forenkle, byggKurveFil, lesKurveFil, kurveType, KURVE_TYPE } from './innsjoKurver.js'

describe('kodLinje / dekodLinje', () => {
  it('går rundt med ~1 m presisjon og dropper doble punkter', () => {
    const linje = [[10.63211, 59.96912], [10.63211, 59.96912], [10.63305, 59.97001]]
    const kodet = kodLinje(linje)
    expect(kodet.length).toBe(4)
    const tilbake = dekodLinje(kodet)
    expect(tilbake[1][0]).toBeCloseTo(10.63305, 5)
    expect(tilbake[1][1]).toBeCloseTo(59.97001, 5)
  })
})

describe('forenkle', () => {
  it('fjerner punkter som ligger på en rett linje, beholder knekkene', () => {
    const rett = Array.from({ length: 11 }, (_, i) => [10 + i * 0.0001, 60])
    expect(forenkle(rett, 1)).toHaveLength(2)
    const knekk = [[10, 60], [10.001, 60], [10.001, 60.001]]
    expect(forenkle(knekk, 1)).toHaveLength(3)
  })
})

describe('kurveType', () => {
  it('skiller NVEs tre objekttyper', () => {
    expect(kurveType('Dybdekurve')).toBe(KURVE_TYPE.kurve)
    expect(kurveType('Innsjøkant')).toBe(KURVE_TYPE.kant)
    expect(kurveType('ØyInnsjøGrense')).toBe(KURVE_TYPE.oy)
  })
})

describe('byggKurveFil / lesKurveFil', () => {
  it('pakker kurver sortert på dybde og leser dem tilbake', () => {
    const ring = [[10, 60], [10.01, 60], [10.01, 60.01], [10, 60.01], [10, 60]]
    const fil = byggKurveFil(5252, [
      { properties: { dybde_m: 5, objekttype: 'Dybdekurve' }, geometry: { type: 'LineString', coordinates: ring } },
      { properties: { dybde_m: 0, objekttype: 'Innsjøkant' }, geometry: { type: 'MultiLineString', coordinates: [ring] } },
      { properties: { dybde_m: null }, geometry: { type: 'LineString', coordinates: ring } },
    ], [{ geometry: { type: 'Polygon', coordinates: [ring] } }])
    expect(fil.kurver.map(k => k[0])).toEqual([0, 5])
    const lest = lesKurveFil(JSON.parse(JSON.stringify(fil)))
    expect(lest.kurver[0].type).toBe(KURVE_TYPE.kant)
    expect(lest.omriss[0]).toHaveLength(5)
    expect(lest.kurver[1].punkter[2][1]).toBeCloseTo(60.01, 5)
  })

  it('avviser et format den ikke kjenner', () => {
    expect(lesKurveFil({ v: 99 })).toBeNull()
  })
})

import { kartUtsnitt } from './innsjoKurver.js'

describe('kartUtsnitt', () => {
  const ring = (lon0, lat0, dLon, dLat) =>
    [[lon0, lat0], [lon0 + dLon, lat0], [lon0 + dLon, lat0 + dLat], [lon0, lat0 + dLat], [lon0, lat0]]

  it('sentrerer en liten innsjø og lager så lite kart som den tillater', () => {
    const u = kartUtsnitt([ring(10.6, 59.96, 0.02, 0.01)], [])
    expect(u.demo).toBe(false)
    expect(u.km).toBe(2)
    expect(u.lon).toBeCloseTo(10.61, 3)
    expect(u.lat).toBeCloseTo(59.965, 3)
  })

  it('legger demo-utsnittet så det får både vann og land', () => {
    // 30 × 5 km innsjø med dype kurver langs hele midtlinja.
    const omr = [ring(10, 60, 0.54, 0.045)]
    const midt = Array.from({ length: 50 }, (_, i) => [10.02 + i * 0.01, 60.0225])
    const kurver = [{ dybde: 120, type: 0, punkter: midt }, { dybde: 20, type: 0, punkter: midt }]
    const u = kartUtsnitt(omr, kurver)
    expect(u.demo).toBe(true)
    expect(u.km).toBe(8)
    expect(u.vannAndel).toBeGreaterThan(0.3)
    expect(u.vannAndel).toBeLessThan(0.7)
  })
})
