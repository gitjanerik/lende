import { describe, it, expect } from 'vitest'
import { flattenNestedSvg } from './flattenNestedSvg.js'

describe('flattenNestedSvg', () => {
  it('lar en SVG uten nestede elementer stå urørt', () => {
    const svg = '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>'
    expect(flattenNestedSvg(svg)).toBe(svg)
  })

  it('returnerer ikke-strenger uendret', () => {
    expect(flattenNestedSvg(null)).toBe(null)
    expect(flattenNestedSvg(undefined)).toBe(undefined)
  })

  it('erstatter et nestet <svg> med klippet <g transform> og lar roten stå', () => {
    const svg =
      '<svg width="820" height="1352" viewBox="0 0 820 1352">' +
      '<text>før</text>' +
      '<svg x="10" y="20" width="100" height="100" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" class="isom-map"><path d="M0 0"/></svg>' +
      '<text>etter</text>' +
      '</svg>'
    const out = flattenNestedSvg(svg)
    // Bare rot-<svg> igjen (ett åpne + ett lukke).
    expect((out.match(/<svg\b/g) || []).length).toBe(1)
    // Klippebane injisert og referert.
    expect(out).toContain('<clipPath id="lende-flat-clip-0">')
    expect(out).toContain('clip-path="url(#lende-flat-clip-0)"')
    // Klassen bevart, innhold bevart, søsken-tekst bevart.
    expect(out).toContain('class="isom-map"')
    expect(out).toContain('<path d="M0 0"/>')
    expect(out).toContain('<text>før</text>')
    expect(out).toContain('<text>etter</text>')
  })

  it('regner ut korrekt transform for xMidYMid meet', () => {
    // box 100×100 @ (10,20), viewBox 0 0 200 100 → scale=min(0.5,1)=0.5,
    // xMid: tx = 10 - 0.5*0 + 0.5*(100 - 0.5*200) = 10
    // YMid: ty = 20 - 0.5*0 + 0.5*(100 - 0.5*100) = 20 + 25 = 45
    const svg =
      '<svg viewBox="0 0 500 500">' +
      '<svg x="10" y="20" width="100" height="100" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet"><g/></svg>' +
      '</svg>'
    const out = flattenNestedSvg(svg)
    expect(out).toContain('transform="translate(10 45) scale(0.5 0.5)"')
    expect(out).toContain('<rect x="10" y="20" width="100" height="100"/>')
  })

  it('flater ut nestede elementer i flere nivåer', () => {
    const svg =
      '<svg viewBox="0 0 500 500">' +
      '<svg x="0" y="0" width="200" height="200" viewBox="0 0 200 200">' +
      '<svg x="0" y="0" width="100" height="100" viewBox="0 0 100 100"><circle/></svg>' +
      '</svg>' +
      '</svg>'
    const out = flattenNestedSvg(svg)
    expect((out.match(/<svg\b/g) || []).length).toBe(1)
    expect((out.match(/<clipPath /g) || []).length).toBe(2)
    expect(out).toContain('<circle/>')
  })

  it('pakker om uten klipping når viewBox mangler', () => {
    const svg =
      '<svg viewBox="0 0 100 100">' +
      '<svg width="50" height="50"><rect/></svg>' +
      '</svg>'
    const out = flattenNestedSvg(svg)
    expect((out.match(/<svg\b/g) || []).length).toBe(1)
    expect(out).not.toContain('clipPath')
    expect(out).toContain('<rect/>')
  })
})
