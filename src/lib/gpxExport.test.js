import { describe, it, expect } from 'vitest'
import { buildRouteGpx, buildGpx } from './gpxExport.js'

describe('buildRouteGpx — planlagt rute som GPX <rte>', () => {
  const route = {
    navn: 'Finnskogen & «grusen» <tur>',
    opprettet: 1751500800000,
    points: [
      [11.2, 60.1, 175.0],
      [11.21, 60.11],
      [11.25, 60.14, 210.5],
    ],
  }

  it('bygger gyldig GPX 1.1 med rte/rtept og 7 desimaler', () => {
    const xml = buildRouteGpx(route)
    expect(xml).toContain('<gpx version="1.1"')
    expect(xml).toContain('<rte>')
    expect(xml).toContain('<rtept lat="60.1000000" lon="11.2000000">')
    expect(xml).toContain('<rtept lat="60.1400000" lon="11.2500000">')
    expect(xml).not.toContain('<trk>')
  })

  it('escaper XML-spesialtegn i navnet', () => {
    const xml = buildRouteGpx(route)
    expect(xml).toContain('Finnskogen &amp; «grusen» &lt;tur&gt;')
    expect(xml).not.toContain('<tur>')
  })

  it('inkluderer ele kun når den finnes', () => {
    const xml = buildRouteGpx(route)
    expect(xml).toContain('<ele>175.0</ele>')
    expect(xml).toContain('<ele>210.5</ele>')
    expect((xml.match(/<ele>/g) ?? []).length).toBe(2)
  })

  it('tomt input → tom streng', () => {
    expect(buildRouteGpx(null)).toBe('')
    expect(buildRouteGpx({ points: [] })).toBe('')
  })

  it('bærer ODbL-attribusjon, og den står mellom name og time', () => {
    const xml = buildRouteGpx(route)
    expect(xml).toContain('<copyright author="OpenStreetMap contributors">')
    expect(xml).toContain('<license>https://opendatacommons.org/licenses/odbl/1-0/</license>')
    expect(xml).toContain('<year>2025</year>')
    // GPX 1.1 sin metadataType er en xsd:sequence — feil rekkefølge gjør fila ugyldig.
    expect(xml.indexOf('<copyright')).toBeGreaterThan(xml.indexOf('<name>'))
    expect(xml.indexOf('<copyright')).toBeLessThan(xml.indexOf('<time>'))
  })
})

describe('buildGpx — eget GPS-spor', () => {
  const meta = { minE: 500000, minN: 6600000, widthM: 2000, heightM: 2000 }
  const track = { opprettet: 1751500800000, points: [{ x: 10, y: 10, t: 1751500800000 }] }

  it('har INGEN copyright — sporet er brukerens egen måling', () => {
    const xml = buildGpx(track, meta, 'Tur')
    expect(xml).toContain('<trk>')
    expect(xml).not.toContain('<copyright')
  })
})
