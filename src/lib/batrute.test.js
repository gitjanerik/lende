import { describe, it, expect } from 'vitest'
import isomCatalog from './isomCatalog.json'
import { classifyToIsom } from './symbolizer.js'
import { erBatStrekk, turruterToElements } from './turrutebasenFetcher.js'
import { buildOverpassQuery, buildSvg } from './mapBuilder.js'
import { buildStrokeOverrideCss, STROKE_GROUPS } from './strokeOverrides.js'
import { LAYERS, MARINE_LAYER_KEYS, DEFAULT_VISIBLE_LAYER_KEYS } from './mapLayerCatalog.js'
import { ALL_LAYER_KEYS } from './mapLayerCatalog.js'
import { KARTSTILER } from './kartStiler.js'

const bbox = { south: 59.00, west: 10.00, north: 59.05, east: 10.09 }

describe('Båtrute (561) — «stier» i sjøen er trafikkerte båtruter', () => {
  it('OSM route=ferry blir 561 og ikke sti', () => {
    expect(classifyToIsom({ type: 'way', tags: { route: 'ferry' } }))
      .toEqual({ code: '561', cat: 'manmade' })
  })

  it('en fergelenke tagget som vann blir båtrute, ikke innsjø', () => {
    // Regelen står FØR vann-reglene med vilje: en route=ferry som falt ned i
    // 301 ville blitt en blå flate midt i fjorden.
    expect(classifyToIsom({ type: 'way', tags: { route: 'ferry', natural: 'water' } }).code)
      .toBe('561')
  })

  it('en fergelenke med highway-tagg for landfestet blir fortsatt båtrute', () => {
    expect(classifyToIsom({ type: 'way', tags: { route: 'ferry', highway: 'path' } }).code)
      .toBe('561')
  })

  it('Overpass-spørringen henter fergerutene', () => {
    expect(buildOverpassQuery(bbox)).toContain('way["route"="ferry"]')
  })

  it('561 har hvit casing under blå stipling — sjøkart-konvensjonen', () => {
    const def = isomCatalog.categories.manmade['561']
    expect(def.casingStroke.color).toBe('#ffffff')
    expect(def.stroke.dasharray.length).toBe(2)
    // Lengre dash enn stiens (505 = 0,36 mm): en kort ~6:5-stipling i sjøen
    // ville lest som en sti man kan gå.
    expect(def.stroke.dasharray[0]).toBeGreaterThan(isomCatalog.categories.manmade['505'].stroke.dasharray[0])
  })

  it('hvert tema med egne sti-farger har også en båtrute-farge', () => {
    for (const [key, t] of Object.entries(isomCatalog.themes)) {
      if (!t.categories?.['505']) continue   // 'light' arver katalogen
      expect(t.categories['561'], `tema ${key}`).toBeTruthy()
    }
  })

  it('rendres som eget lag data-layer="batrute" med casing-tvilling', () => {
    const ferry = {
      type: 'way', id: 1, tags: { route: 'ferry' },
      geometry: [
        { lat: 59.01, lon: 10.01 }, { lat: 59.02, lon: 10.04 }, { lat: 59.03, lon: 10.07 },
      ],
    }
    const { svg } = buildSvg([ferry], bbox, {})
    expect(svg).toContain('data-layer="batrute" data-iso="561"')
    expect(svg).toMatch(/data-iso="561">[\s\S]*class="casing"/)
  })
})

describe('Turrutebasen — båtstrekk går til båtrute-laget', () => {
  it('erBatStrekk kjenner igjen båt og ferge i alle skrivemåter', () => {
    for (const v of ['Båt', 'båtrute', 'Baat', 'Ferge', 'Ferje', 'ferjesamband']) {
      expect(erBatStrekk(v), v).toBe(true)
    }
    for (const v of ['Sti', 'Veg', 'Trapp', 'Bru', '', null, undefined]) {
      expect(erBatStrekk(v), String(v)).toBe(false)
    }
  })

  it('båtstrekk får lende:batrute og IKKE lende:turrute', () => {
    const [el] = turruterToElements([{
      id: 'a', merking: 'JA', ruteFolger: 'Båt',
      geometry: [{ lat: 59, lon: 10 }, { lat: 59.01, lon: 10.01 }],
    }])
    expect(el.tags['lende:batrute']).toBe('turrute')
    expect(el.tags['lende:turrute']).toBeUndefined()
    expect(classifyToIsom(el).code).toBe('561')
  })

  it('vanlige fotruter er urørt', () => {
    const [el] = turruterToElements([{
      id: 'b', merking: 'JA', ruteFolger: 'Sti',
      geometry: [{ lat: 59, lon: 10 }, { lat: 59.01, lon: 10.01 }],
    }])
    expect(el.tags['lende:turrute']).toBe('fotrute')
    expect(el.tags['lende:batrute']).toBeUndefined()
    expect(classifyToIsom(el).code).toBe('506')
  })
})

describe('Båtrute-laget i UI-vokabularet', () => {
  it('finnes i lag-katalogen, i den marine seksjonen, og er PÅ som default', () => {
    expect(LAYERS.some((l) => l.key === 'batrute')).toBe(true)
    expect(MARINE_LAYER_KEYS.has('batrute')).toBe(true)
    expect(DEFAULT_VISIBLE_LAYER_KEYS).toContain('batrute')
  })

  it('er med i alle kartstiler — lag-settene bygges som unntak, ikke lister', () => {
    expect(ALL_LAYER_KEYS).toContain('batrute')
    for (const stil of KARTSTILER) {
      expect(stil.lag, stil.key).toContain('batrute')
    }
  })

  it('har en egen strekbredde-slider i «Strek — dette kartet»', () => {
    const g = STROKE_GROUPS.find((x) => x.id === 'batrute')
    expect(g).toBeTruthy()
    expect(g.codes).toEqual(['561'])
    const css = buildStrokeOverrideCss({ batrute: 1.6 })
    expect(css).toContain('[data-iso="561"]')
    expect(css).toContain('path.casing')
  })
})
