import { describe, it, expect } from 'vitest'
import {
  buildTurruteUrl, parseSkiloyper, skiloyperToElements, skiloypeElementsFrom,
} from './turrutebasenFetcher.js'
import { classifyToIsom, erBelystLoype } from './symbolizer.js'

const gml = (navn, belysning, pos) => `
<app:${navn} gml:id="ski.1">
  <app:belysning>${belysning}</app:belysning>
  <app:rutenavn>Åttetallet</app:rutenavn>
  <gml:posList>${pos}</gml:posList>
</app:${navn}>`

const POS = '59.70 10.00 59.70 10.01 59.70 10.02'

describe('Turrutebasen Skiløype (v7.9.19)', () => {
  it('spør etter Skiløype når typen sendes inn, ellers Fotrute', () => {
    const bbox = { south: 59, west: 10, north: 60, east: 11 }
    expect(decodeURIComponent(buildTurruteUrl(bbox, { type: 'app:Skiløype' }))).toContain('typeNames=app:Skiløype')
    expect(buildTurruteUrl(bbox)).toContain('typeNames=app%3AFotrute')
  })

  it('leser elementnavnet med ø, tegnreferanse og uten ø', () => {
    for (const navn of ['Skiløype', 'Skil&#248;ype', 'Skiloype']) {
      const r = parseSkiloyper(gml(navn, 'JA', POS))
      expect(r, navn).toHaveLength(1)
      expect(r[0].geometry).toHaveLength(3)
      expect(r[0].navn).toBe('Åttetallet')
    }
  })

  it('belysning=JA gir lysløype, alt annet en løype uten lys', () => {
    const [lys] = skiloyperToElements(parseSkiloyper(gml('Skiløype', 'JA', POS)))
    const [mork] = skiloyperToElements(parseSkiloyper(gml('Skiløype', 'NEI', POS)))
    const [ukjent] = skiloyperToElements(parseSkiloyper(gml('Skiløype', '', POS)))
    expect(erBelystLoype(lys.tags)).toBe(true)
    expect(erBelystLoype(mork.tags)).toBe(false)
    expect(erBelystLoype(ukjent.tags)).toBe(false)
  })

  it('tegnes som 510, ikke som sti', () => {
    const [el] = skiloyperToElements(parseSkiloyper(gml('Skiløype', 'JA', POS)))
    expect(classifyToIsom(el).code).toBe('510')
    expect(el.tags['lende:turrute']).toBeUndefined()
  })

  it('tynnes mot OSM-løyper, men ikke mot en skogsvei den følger', () => {
    const routes = parseSkiloyper(gml('Skiløype', 'JA', POS))
    const geometry = routes[0].geometry
    const vei = { type: 'way', id: 1, tags: { highway: 'track' }, geometry }
    const loype = { type: 'way', id: 2, tags: { 'piste:type': 'nordic' }, geometry }
    expect(skiloypeElementsFrom(routes, [vei])).toHaveLength(1)
    expect(skiloypeElementsFrom(routes, [loype])).toHaveLength(0)
    const rel = { type: 'relation', id: 3, tags: { route: 'piste', 'piste:type': 'nordic' },
      members: [{ type: 'way', ref: 4, geometry }] }
    expect(skiloypeElementsFrom(routes, [rel])).toHaveLength(0)
  })
})
