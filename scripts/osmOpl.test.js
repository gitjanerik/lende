import { describe, it, expect } from 'vitest'
import { parseLinje, parseNoder, parseTags } from './osmOpl.mjs'

describe('OPL', () => {
  it('node med tagger og escaping', () => {
    expect(parseLinje('n17 v1 Tnatural=peak,name=Store%20%Sk%e5%rmen x10.4107000 y59.8416000')).toEqual({
      type: 'node', id: 17, tags: { natural: 'peak', name: 'Store Skårmen' }, lon: 10.4107, lat: 59.8416,
    })
  })
  it('way med lokasjoner; noder uten lokasjon hoppes over', () => {
    const w = parseLinje('w5 Thighway=path Nn1x10.1y59.1,n2,n3x10.2y59.2')
    expect(w.type).toBe('way')
    expect(parseNoder(w.nodeFelt)).toEqual([{ lat: 59.1, lon: 10.1 }, { lat: 59.2, lon: 10.2 }])
  })
  it('relasjon med roller', () => {
    expect(parseLinje('r9 Ttype=multipolygon,natural=water Mw1@outer,w2@inner,n3@').medlemmer).toEqual([
      { type: 'way', ref: 1, role: 'outer' }, { type: 'way', ref: 2, role: 'inner' }, { type: 'node', ref: 3, role: '' },
    ])
  })
  it('komma og likhetstegn inne i en verdi', () => {
    expect(parseTags('note=a%2c%b%3d%c')).toEqual({ note: 'a,b=c' })
  })
  it('linje uten tagger gir tags null', () => {
    expect(parseLinje('w3 Nn1x1y2').tags).toBe(null)
  })
})
