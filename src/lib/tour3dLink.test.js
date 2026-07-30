import { describe, it, expect } from 'vitest'
import { buildTourParams, parseTourQuery, buildTour3dUrl } from './tour3dLink.js'

const OSLO = { lat: 59.913868, lon: 10.752245 }
const MAAL = { lat: 59.95, lon: 10.8 }

describe('buildTourParams / parseTourQuery', () => {
  it('rundtur runder tur-retur gjennom params', () => {
    const params = buildTourParams({ origin: OSLO, via: [MAAL], routeIdx: 1 })
    expect(params.dlat).toBeUndefined()
    const tour = parseTourQuery(params)
    expect(tour.dest).toBeNull()
    expect(tour.origin.lat).toBeCloseTo(OSLO.lat, 6)
    expect(tour.via).toHaveLength(1)
    expect(tour.via[0].lon).toBeCloseTo(MAAL.lon, 6)
    expect(tour.routeIdx).toBe(1)
    expect(tour.open3d).toBe(true)
  })

  it('A→B med via-punkter', () => {
    const via = [{ lat: 59.93, lon: 10.77 }, { lat: 59.94, lon: 10.78 }]
    const tour = parseTourQuery(buildTourParams({ origin: OSLO, dest: MAAL, via }))
    expect(tour.dest.lat).toBeCloseTo(MAAL.lat, 6)
    expect(tour.via).toHaveLength(2)
  })

  it('open3d: false utelater v3d', () => {
    const params = buildTourParams({ origin: OSLO, via: [MAAL], open3d: false })
    expect(params.v3d).toBeUndefined()
    expect(parseTourQuery(params).open3d).toBe(false)
  })

  it('gamle rundtur-lenker (olat/olon/rtv/ri) parses som før', () => {
    const tour = parseTourQuery({ olat: '59.913868', olon: '10.752245', rtv: '59.95,10.8', ri: '2' })
    expect(tour.dest).toBeNull()
    expect(tour.via).toHaveLength(1)
    expect(tour.routeIdx).toBe(2)
    expect(tour.open3d).toBe(false)
  })

  it('turnavn (tn) rundes gjennom params og trunkeres til 60 tegn', () => {
    const params = buildTourParams({ origin: OSLO, via: [MAAL], name: '  Rundtur Høgevarde  ' })
    expect(params.tn).toBe('Rundtur Høgevarde')
    expect(parseTourQuery(params).name).toBe('Rundtur Høgevarde')
    const langt = buildTourParams({ origin: OSLO, via: [MAAL], name: 'x'.repeat(80) })
    expect(langt.tn).toHaveLength(60)
  })

  it('uten navn: tn utelates og parse gir null-navn', () => {
    const params = buildTourParams({ origin: OSLO, via: [MAAL] })
    expect(params.tn).toBeUndefined()
    expect(parseTourQuery(params).name).toBeNull()
    expect(parseTourQuery(buildTourParams({ origin: OSLO, via: [MAAL], name: '   ' })).name).toBeNull()
  })

  it('ugyldig/tom query gir null', () => {
    expect(parseTourQuery({})).toBeNull()
    expect(parseTourQuery({ olat: 'x', olon: '10' })).toBeNull()
    // Origo uten både mål og via er ingen tur.
    expect(parseTourQuery({ olat: '59.9', olon: '10.7' })).toBeNull()
  })
})

describe('buildTour3dUrl', () => {
  it('bygger komplett /kart/nytt-dyplenke', () => {
    const url = buildTour3dUrl({
      map: { lat: 59.91387, lon: 10.75224, kmBredde: 4, equidistanceM: 20, aspekt: 1.414 },
      tour: { origin: OSLO, via: [MAAL] },
    })
    expect(url).toContain('https://gitjanerik.github.io/lende/kart/nytt?')
    expect(url).toContain('lat=59.91387')
    expect(url).toContain('km=4')
    expect(url).toContain('eq=20')
    expect(url).toContain('v3d=1')
    // Round-trip: query-delen skal parse tilbake til samme tur.
    const q = Object.fromEntries(new URL(url).searchParams)
    const tour = parseTourQuery(q)
    expect(tour.origin.lat).toBeCloseTo(OSLO.lat, 6)
    expect(tour.open3d).toBe(true)
  })
})
