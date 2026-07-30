import { describe, it, expect } from 'vitest'
import { stripContourLayers, stripVectorRelief, stripPointSymbols, cleanSvgForTexture } from './mapTexture.js'

// Speiler mapBuilder-strukturen: kontur-laget har NESTEDE grupper
// (data-iso="101"/"102" + kontur-tall), som knekker non-greedy regex.
const CONTOUR_LAYER =
  '<g data-layer="kontur">' +
  '<g data-iso="101"><path d="M0,0 L1,1"/></g>' +
  '<g data-iso="102"><path d="M2,2 L3,3"/></g>' +
  '<g data-label="kontur-tall"><text x="5" y="5">120</text></g>' +
  '</g>'

const SVG = `<svg viewBox="0 0 100 100"><g data-layer="vann" data-iso="301"><path d="M9,9"/></g>${CONTOUR_LAYER}<g data-layer="skog" data-iso="406"><path d="M4,4"/></g></svg>`

describe('stripContourLayers', () => {
  it('fjerner hele kontur-laget inkl. nestede grupper', () => {
    const out = stripContourLayers(SVG)
    expect(out).not.toContain('data-layer="kontur"')
    expect(out).not.toContain('data-iso="101"')
    expect(out).not.toContain('kontur-tall')
  })

  it('beholder alle andre lag urørt', () => {
    const out = stripContourLayers(SVG)
    expect(out).toContain('data-layer="vann"')
    expect(out).toContain('data-layer="skog"')
    expect(out).toContain('<path d="M9,9"/>')
  })

  it('fjerner flere kontur-lag (nestede flis-SVG-er)', () => {
    const two = `<svg>${CONTOUR_LAYER}<g data-layer="vann"/>${CONTOUR_LAYER}</svg>`
    const out = stripContourLayers(two)
    expect(out).not.toContain('kontur')
    expect(out).toContain('data-layer="vann"')
  })

  it('svg uten kontur-lag passerer uendret', () => {
    const plain = '<svg><g data-layer="vann"><path d="M0,0"/></g></svg>'
    expect(stripContourLayers(plain)).toBe(plain)
  })
})

describe('stripVectorRelief', () => {
  const VECTOR_RELIEF =
    '<g id="hillshade-layer" data-layer="hillshade" opacity="0.6">' +
    '<path d="M0,0 L5,5 Z" fill="#000" fill-opacity="0.1"/>' +
    '<path d="M1,1 L6,6 Z" fill="#000" fill-opacity="0.2"/>' +
    '</g>'
  const RASTER_RELIEF =
    '<image id="hillshade-layer" data-layer="hillshade" href="data:image/png;base64,x" opacity="0.6"/>'

  it('fjerner «Skarp (vektor)»-relieffet (g-variant)', () => {
    const out = stripVectorRelief(`<svg>${VECTOR_RELIEF}<g data-layer="vann"/></svg>`)
    expect(out).not.toContain('hillshade-layer')
    expect(out).toContain('data-layer="vann"')
  })

  it('beholder «Mjuk (bilde)»-relieffet (image-variant)', () => {
    const out = stripVectorRelief(`<svg>${RASTER_RELIEF}</svg>`)
    expect(out).toContain('<image id="hillshade-layer"')
  })

  it('cleanSvgForTexture: vektor-relieff strippes så mykt relieff bakes i stedet', () => {
    const out = cleanSvgForTexture(`<svg>${VECTOR_RELIEF}</svg>`)
    expect(out.includes('id="hillshade-layer"')).toBe(false)
  })
})

describe('stripPointSymbols', () => {
  const SVG =
    '<svg>' +
    '<g data-layer="parkering" data-iso="534">' +
    '<g data-upright="1" data-iso="534u" data-name="Knivåsen Utfartsparkering"><use href="#p-sym"/></g>' +
    '</g>' +
    '<g data-layer="holdeplass" data-iso="560"><g data-upright="1"><use href="#buss-sym"/></g></g>' +
    '<g data-layer="sjo-poi">' +
    '<g data-upright="1" data-iso="554"><use href="#wc-sym"/></g>' +
    '<g data-upright="1" data-iso="553"><use href="#vann-sym"/></g>' +
    '</g>' +
    '<g data-layer="bymasse" data-iso="522"><path d="M0,0 L5,5 Z" fill-rule="evenodd"/></g>' +
    '<g data-layer="skog" data-iso="406"><path d="M1,1"/></g>' +
    '</svg>'

  it('fjerner P-skilt, buss/tog, WC og tett bebyggelse', () => {
    const out = stripPointSymbols(SVG)
    expect(out).not.toContain('parkering')
    expect(out).not.toContain('holdeplass')
    expect(out).not.toContain('data-iso="554"')
    expect(out).not.toContain('bymasse')
  })

  it('beholder andre sjø-POI (drikkevann) og øvrige lag', () => {
    const out = stripPointSymbols(SVG)
    expect(out).toContain('data-iso="553"')
    expect(out).toContain('data-layer="sjo-poi"')
    expect(out).toContain('data-layer="skog"')
  })
})

describe('cleanSvgForTexture', () => {
  it('stripper både runtime-lag og kurver, og sikrer xlink-namespace', () => {
    const s = `<svg viewBox="0 0 10 10"><g id="user-layer"><circle r="1"/></g>${CONTOUR_LAYER}<g data-layer="skog"/></svg>`
    const out = cleanSvgForTexture(s)
    expect(out).not.toContain('user-layer')
    expect(out).not.toContain('kontur')
    expect(out).toContain('data-layer="skog"')
    expect(out).toContain('xmlns:xlink')
  })
})
