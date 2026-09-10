import { describe, it, expect } from 'vitest'
import { DOMParser } from 'linkedom'
import { dybdeAnker } from './useLagStyring.js'

// ─────────────────────────────────────────────────────────────────────────────
// Ankeret for dybde-hovedlaget MÅ være et direkte barn av kart-SVG-en.
//
// Feilen testen finnes for gir ingen fargefeil og ingen tom skjerm: den kaster.
// `svg.querySelector('[data-label]')` traff `<g data-label="kontur-tall">`, som
// ligger NESTET inne i `<g data-layer="kontur">`, og `insertBefore` svarer
// NotFoundError på en node som ikke er barn. Kastet drepte hele
// `applyLayerVisibility`, som kalles FØR `setMapTheme` i `bruksKartStil` — så
// kartstilen «Padling» (den eneste som slår på `dybde`) satte lagene og stoppet
// der. Ingen enhetstest så det, fordi geometrien var helt riktig.
// ─────────────────────────────────────────────────────────────────────────────

// Samme rekkefølge som mapBuilder emitterer: terreng → konturer (med NESTET
// kontur-tall) → dem-sjø → vann → bekk → veier → navn.
const EKTE_ARK = `
  <svg xmlns="http://www.w3.org/2000/svg">
    <g id="bakgrunn"><rect/></g>
    <g data-layer="skog" data-iso="406"><path/></g>
    <g data-layer="kontur">
      <g data-iso="101"><path/></g>
      <g data-label="kontur-tall"><text>240</text></g>
    </g>
    <g data-label="dem-topp" style="display:none"><text>317</text></g>
    <g data-layer="vann" data-iso="303" data-src="dem-sea"><path/></g>
    <g data-layer="vann" data-iso="301"><path/></g>
    <g data-layer="bekk" data-iso="304"><path/></g>
    <g data-layer="vei-stor" data-iso="501"><path/></g>
    <g data-layer="navn"><text data-label="omrade-navn">Storemyr</text></g>
  </svg>`

const parse = (kilde) =>
  new DOMParser().parseFromString(kilde.trim(), 'text/html').querySelector('svg')

describe('dybdeAnker', () => {
  it('returnerer en node som faktisk ER barn av svg-en', () => {
    const svg = parse(EKTE_ARK)
    const anker = dybdeAnker(svg)
    expect(anker).not.toBeNull()
    expect(anker.parentNode).toBe(svg)
  })

  it('insertBefore med ankeret kaster ikke — det gjorde den gamle regelen', () => {
    const svg = parse(EKTE_ARK)
    const g = svg.ownerDocument.createElement('g')
    expect(() => svg.insertBefore(g, dybdeAnker(svg))).not.toThrow()

    // Og her er feilen, holdt fast: den gamle regelen fant en NESTET node.
    const gammel = svg.querySelector('[data-label]')
    expect(gammel.parentNode).not.toBe(svg)
  })

  it('lander etter siste vann/bekk-gruppe, altså over sjøen og under veiene', () => {
    const svg = parse(EKTE_ARK)
    const g = svg.ownerDocument.createElement('g')
    g.setAttribute('data-layer', 'dybde')
    svg.insertBefore(g, dybdeAnker(svg))

    const lag = [...svg.children].map(e => e.getAttribute('data-layer'))
    expect(lag.indexOf('dybde')).toBeGreaterThan(lag.lastIndexOf('bekk'))
    expect(lag.indexOf('dybde')).toBeLessThan(lag.indexOf('vei-stor'))
  })

  it('et ark uten vann gir null — da er insertBefore en appendChild', () => {
    const svg = parse(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <g id="bakgrunn"><rect/></g>
        <g data-layer="kontur"><g data-label="kontur-tall"><text>240</text></g></g>
      </svg>`)
    expect(dybdeAnker(svg)).toBeNull()
    const g = svg.ownerDocument.createElement('g')
    expect(() => svg.insertBefore(g, dybdeAnker(svg))).not.toThrow()
    expect(svg.lastElementChild).toBe(g)
  })
})
