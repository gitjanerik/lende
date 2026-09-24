import { describe, it, expect } from 'vitest'
import isomCatalog from './isomCatalog.json'
import { buildSvg } from './mapBuilder.js'
import { buildIsomCss } from './symbolizer.js'

const bbox = { south: 59.00, west: 10.00, north: 59.05, east: 10.09 }
const loype = {
  type: 'way', id: 1, tags: { leisure: 'track', sport: 'skiing' },
  geometry: [{ lat: 59.01, lon: 10.01 }, { lat: 59.02, lon: 10.04 }, { lat: 59.03, lon: 10.07 }],
}

describe('Lysløype (510) — gule prikker på gul linje, ett omriss', () => {
  it('begge omrissene ligger under begge de gule', () => {
    const { svg } = buildSvg([loype], bbox, { visibleLayers: ['lysloype'] })
    const gruppe = svg.match(/<g data-layer="[^"]*" data-iso="510">([\s\S]*?)<\/g>/)?.[1]
    expect(gruppe).toBeTruthy()
    const klasser = (gruppe.match(/<path[^>]*\/>/g) ?? []).map(p => p.match(/class="([^"]+)"/)?.[1] ?? 'prikk')
    expect(klasser).toEqual(['omriss-linje', 'omriss-prikk', 'underlag', 'prikk'])
  })

  it('prikk-omrisset arver stiplingen og legger omrisset til prikkbredden', () => {
    const css = buildIsomCss(isomCatalog, new Map(), {})
    const regel = css.match(/\[data-iso="510"\] path\.omriss-prikk \{([^}]*)\}/)?.[1]
    expect(regel).toContain('var(--w')
    expect(regel).not.toContain('stroke-dasharray')
    expect(css).toMatch(/\[data-iso="510"\] path\.underlag \{[^}]*stroke-dasharray: none/)
    expect(css).toMatch(/\[data-iso="510"\] path\.omriss-linje \{[^}]*stroke-dasharray: none/)
  })

  it('underlaget er smalere enn prikkene, så forhøyningene synes', () => {
    const def = isomCatalog.categories.manmade['510']
    expect(def.underlag.widthMm).toBeLessThan(def.stroke.widthMm)
  })
})
