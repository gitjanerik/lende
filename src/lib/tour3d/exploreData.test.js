import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  collectAllFeatures, collectBrukerminnePins, clusterFeaturesByMeters,
  groupOfKind, countByGroup, featureType, PIN_GROUPS,
} from './exploreData.js'
import { collectMapFeatures } from './tourData.js'

const entry = (over = {}) => ({
  id: 'x', name: 'Noe', kind: 'peak', x: 0, y: 0, ele: null, areaM2: null,
  categories: null, el: {}, ...over,
})

describe('collectAllFeatures', () => {
  it('tar med POI-er uansett hvor langt fra en rute de ligger', () => {
    const index = [
      entry({ name: 'Nær topp', kind: 'peak', x: 10, y: 10 }),
      entry({ name: 'Fjern topp', kind: 'peak', x: 9000, y: 9000 }),
    ]
    const route = [[0, 0], [100, 0]]
    // Turvisningens korridor slipper bare den nære gjennom …
    expect(collectMapFeatures(index, route).map(f => f.name)).toEqual(['Nær topp'])
    // … utforskeren tar begge, for der er hele kartet motivet.
    expect(collectAllFeatures(index).map(f => f.name)).toEqual(['Nær topp', 'Fjern topp'])
  })

  it('dropper navnløse oppføringer og ukjente typer', () => {
    const out = collectAllFeatures([
      entry({ name: '' }),
      entry({ name: 'Ukjent type', kind: 'kontur-tall' }),
      entry({ name: 'Gyldig' }),
    ])
    expect(out.map(f => f.name)).toEqual(['Gyldig'])
  })

  it('stripper DOM-referansen så resultatet er rene data', () => {
    const out = collectAllFeatures([entry({ name: 'Topp' })])
    expect(out[0].el).toBeUndefined()
    expect(out[0]).toMatchObject({ name: 'Topp', kind: 'peak', x: 0, y: 0 })
  })

  it('tåler tom eller manglende indeks', () => {
    expect(collectAllFeatures(null)).toEqual([])
    expect(collectAllFeatures([])).toEqual([])
  })
})

describe('collectBrukerminnePins', () => {
  // linkedom er samme DOM-motor som MCP-serveren bruker headless, så testen
  // dekker begge veier inn i parseren.
  const svgOf = (inner) => {
    const { document } = parseHTML(
      `<html><body><svg xmlns="http://www.w3.org/2000/svg">${inner}</svg></body></html>`)
    return document.querySelector('svg')
  }

  it('leser posisjon, tittel og kategori fra SVG-en', () => {
    const svg = svgOf(`
      <g data-kulturminne-id="12" data-kat="gravminne" data-tittel="Gravhaugen"
         transform="translate(120.5,300.25)"></g>`)
    const pins = collectBrukerminnePins(svg)
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({
      name: 'Gravhaugen', kind: 'brukerminne', x: 120.5, y: 300.25,
    })
    expect(pins[0].detail).toMatchObject({ kat: 'gravminne', kulturminneId: '12' })
  })

  it('takler mellomrom-separert translate og manglende tittel', () => {
    const svg = svgOf(`
      <g data-kulturminne-id="7" data-kat="stein" transform="translate(10 20)"></g>`)
    const pins = collectBrukerminnePins(svg)
    expect(pins[0].x).toBe(10)
    expect(pins[0].y).toBe(20)
    expect(pins[0].name).toBe('Kulturminne')
  })

  it('hopper over elementer uten brukbar transform', () => {
    const svg = svgOf(`<g data-kulturminne-id="1" data-kat="annet"></g>`)
    expect(collectBrukerminnePins(svg)).toEqual([])
  })

  it('tåler at det ikke finnes noe SVG', () => {
    expect(collectBrukerminnePins(null)).toEqual([])
  })
})

describe('clusterFeaturesByMeters', () => {
  it('slår sammen tettliggende POI av samme type', () => {
    const out = clusterFeaturesByMeters([
      { name: 'A', kind: 'kulturminne', x: 0, y: 0 },
      { name: 'B', kind: 'kulturminne', x: 10, y: 0 },
      { name: 'C', kind: 'kulturminne', x: 500, y: 0 },
    ], 40)
    expect(out.map(f => f.name)).toEqual(['A', 'C'])
  })

  it('rører ikke POI av ulik type på samme sted', () => {
    const out = clusterFeaturesByMeters([
      { name: 'Toppen', kind: 'peak', x: 0, y: 0 },
      { name: 'Hytta', kind: 'hytte-navn', x: 1, y: 1 },
    ], 40)
    expect(out).toHaveLength(2)
  })
})

describe('gruppering for filterpanelet', () => {
  it('legger hver kind i én gruppe', () => {
    expect(groupOfKind('peak')).toBe('topp')
    expect(groupOfKind('vann-omrade')).toBe('vann')
    expect(groupOfKind('nve')).toBe('nve')
    expect(groupOfKind('kulturminne')).toBe('kulturminne')
    expect(groupOfKind('brukerminne')).toBe('brukerminne')
  })

  it('teller per gruppe med alle grupper representert', () => {
    const counts = countByGroup([
      { kind: 'peak' }, { kind: 'peak' }, { kind: 'nve' },
    ])
    expect(counts.topp).toBe(2)
    expect(counts.nve).toBe(1)
    expect(counts.vann).toBe(0)
    for (const g of PIN_GROUPS) expect(counts[g.key]).toBeGreaterThanOrEqual(0)
  })
})

describe('featureType', () => {
  it('oversetter kind til typen infokortet forventer', () => {
    expect(featureType({ kind: 'peak' })).toBe('topp')
    expect(featureType({ kind: 'nve' })).toBe('vannstasjon')
    expect(featureType({ kind: 'brukerminne' })).toBe('kulturminne')
    expect(featureType({ kind: 'kulturminne' })).toBe('kulturminne')
  })

  it('faller til «sted» for ukjente typer', () => {
    expect(featureType({ kind: 'tull' })).toBe('sted')
    expect(featureType(null)).toBe('sted')
  })
})
