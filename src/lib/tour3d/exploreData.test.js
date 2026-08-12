import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  collectAllFeatures, collectBrukerminnePins, collectGhostFeatures, clusterFeaturesByMeters,
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

  it('løfter et minne i en naboflis til aktiv-flisas koordinatrom', () => {
    const svg = svgOf(`
      <svg x="4000" y="-3000" width="4000" height="3000">
        <g data-kulturminne-id="9" data-kat="stein" data-tittel="Bautaen"
           transform="translate(100,200)"></g>
      </svg>`)
    const pins = collectBrukerminnePins(svg)
    expect(pins[0]).toMatchObject({ name: 'Bautaen', x: 4100, y: -2800 })
  })
})

describe('collectGhostFeatures — navn fra naboflisene', () => {
  const arkOf = (ghosts) => {
    const { document } = parseHTML(
      `<html><body><svg xmlns="http://www.w3.org/2000/svg">
         <text x="10" y="20" data-label="stedsnavn">Aktiv flis</text>
         <g id="ghost-tiles">${ghosts}</g>
       </svg></body></html>`)
    return document.querySelector('svg')
  }

  it('leser navn, type og posisjon, forskjøvet med flisas x/y', () => {
    const svg = arkOf(`
      <svg x="4000" y="0" width="4000" height="3000">
        <text x="500" y="600" data-label="stedsnavn">Nabogrenda</text>
        <text x="800" y="900" data-label="vann-navn">Nabotjernet</text>
      </svg>`)
    const ut = collectGhostFeatures(svg)
    expect(ut).toEqual([
      { name: 'Nabogrenda', kind: 'stedsnavn', x: 4500, y: 600, ele: null, areaM2: null, categories: null },
      { name: 'Nabotjernet', kind: 'vann-navn', x: 4800, y: 900, ele: null, areaM2: null, categories: null },
    ])
  })

  it('toppnavn: høyden skilles ut av teksten, og gruppa er posisjonen', () => {
    const svg = arkOf(`
      <svg x="0" y="-3000" width="4000" height="3000">
        <g transform="translate(1200,1500)">
          <text x="2mm" y="-0.4mm" data-label="peak">Storhaugen<tspan data-label="peak-ele">1483</tspan></text>
        </g>
      </svg>`)
    const ut = collectGhostFeatures(svg)
    expect(ut).toHaveLength(1)
    expect(ut[0]).toMatchObject({ name: 'Storhaugen', kind: 'peak', x: 1200, y: -1500, ele: 1483 })
  })

  it('hopper over tall-labels, veinummer og navnløse topper', () => {
    const svg = arkOf(`
      <svg x="4000" y="0">
        <text x="10" y="10" data-label="kontur-tall">900</text>
        <text x="20" y="20" data-label="veinummer">E134</text>
        <text x="30" y="30" data-label="peak">1483</text>
        <text x="40" y="40" data-label="dybde-tall">12</text>
      </svg>`)
    expect(collectGhostFeatures(svg)).toEqual([])
  })

  it('samme navn i to nabofliser blir én nål', () => {
    const svg = arkOf(`
      <svg x="4000" y="0"><text x="10" y="10" data-label="vann-navn">Langvatnet</text></svg>
      <svg x="4000" y="3000"><text x="10" y="10" data-label="vann-navn">Langvatnet</text></svg>`)
    expect(collectGhostFeatures(svg)).toHaveLength(1)
  })

  it('rører ikke den aktive flisa — den kommer fra søkeindeksen', () => {
    const svg = arkOf('')
    expect(collectGhostFeatures(svg).map(f => f.name)).toEqual([])
  })

  it('tåler kart uten nabofliser og uten SVG', () => {
    const { document } = parseHTML(
      '<html><body><svg xmlns="http://www.w3.org/2000/svg"></svg></body></html>')
    expect(collectGhostFeatures(document.querySelector('svg'))).toEqual([])
    expect(collectGhostFeatures(null)).toEqual([])
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
