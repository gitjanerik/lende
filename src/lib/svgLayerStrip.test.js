import { describe, it, expect } from 'vitest'
import { stripBalancedGroups, stripGroupsById } from './svgLayerStrip.js'

// Speiler useHydroStations-strukturen: lag med NESTEDE <g> per stasjon —
// det som knakk non-greedy regexen (ubalansert XML → rasterisering feilet).
const HYDRO_LAYER =
  '<g id="hydro-layer" data-layer="vannstasjon">' +
  '<g data-hydro-station-id="6.10.0"><use href="#hydro-sym"/></g>' +
  '<g data-hydro-station-id="6.11.0"><use href="#hydro-sym"/></g>' +
  '</g>'

const balanced = (s) => {
  const opens = (s.match(/<g\b[^>]*>/g) ?? []).filter(t => !t.endsWith('/>')).length
  const closes = (s.match(/<\/g>/g) ?? []).length
  return opens === closes
}

describe('stripGroupsById', () => {
  it('fjerner lag med nestede grupper komplett — XML forblir balansert', () => {
    const svg = `<svg><g data-layer="vann"><path d="M0,0"/></g>${HYDRO_LAYER}<g data-layer="skog"/></svg>`
    const out = stripGroupsById(svg, ['hydro-layer'])
    expect(out).not.toContain('hydro')
    expect(out).toContain('data-layer="vann"')
    expect(out).toContain('data-layer="skog"')
    expect(balanced(out)).toBe(true)
  })

  it('fjerner flere lag i én operasjon', () => {
    const svg = `<svg><g id="user-layer"><g><circle r="1"/></g></g>${HYDRO_LAYER}</svg>`
    const out = stripGroupsById(svg, ['user-layer', 'hydro-layer'])
    expect(out).toBe('<svg></svg>')
  })

  it('lag som mangler er no-op', () => {
    const svg = '<svg><g data-layer="vann"/></svg>'
    expect(stripGroupsById(svg, ['user-layer'])).toBe(svg)
  })
})

describe('stripBalancedGroups', () => {
  it('teller self-closing <g/> riktig i dybde-skanningen', () => {
    const svg = '<svg><g id="x"><g/><path d="M1,1"/></g><g data-layer="vann"/></svg>'
    const out = stripBalancedGroups(svg, /<g\b[^>]*id="x"[^>]*>/)
    expect(out).toBe('<svg><g data-layer="vann"/></svg>')
  })
})
