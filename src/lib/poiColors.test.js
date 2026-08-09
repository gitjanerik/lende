import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FREDET_KAT_COLOR, BRUKERMINNE_KAT_COLOR, poiColor, brukerminneColorRules,
} from './poiColors.js'
import { buildIsomCss } from './symbolizer.js'

describe('kulturminne-fargene', () => {
  it('automatisk fredet er lilla og uklassifisert er grå', () => {
    expect(FREDET_KAT_COLOR.automatisk).toBe('#8e44ad')
    expect(FREDET_KAT_COLOR.annet).toBe('#7f8c8d')
  })

  it('poiColor skiller lilla fra grått kulturminne', () => {
    const lilla = { kind: 'kulturminne', detail: { kulturminne: { kategori: 'automatisk' } } }
    const graa = { kind: 'kulturminne', detail: { kulturminne: { kategori: 'annet' } } }
    expect(poiColor(lilla)).toBe('#8e44ad')
    expect(poiColor(graa)).toBe('#7f8c8d')
    expect(poiColor(lilla)).not.toBe(poiColor(graa))
  })

  it('ukjent vernetype faller til grå, ikke til en tilfeldig farge', () => {
    expect(poiColor({ kind: 'kulturminne', detail: { kulturminne: { kategori: 'tull' } } }))
      .toBe(FREDET_KAT_COLOR.annet)
    expect(poiColor({ kind: 'kulturminne' })).toBe(FREDET_KAT_COLOR.annet)
  })

  it('brukerminner farges på egen kategori', () => {
    expect(poiColor({ kind: 'brukerminne', detail: { kat: 'gravminne' } }))
      .toBe(BRUKERMINNE_KAT_COLOR.gravminne)
    expect(poiColor({ kind: 'brukerminne', detail: { kat: 'ukjent' } }))
      .toBe(BRUKERMINNE_KAT_COLOR.annet)
  })
})

describe('poiColor for øvrige typer', () => {
  it('gir egne farger per POI-type', () => {
    expect(poiColor({ kind: 'peak' })).toBe('#8b5a2b')
    expect(poiColor({ kind: 'nve' })).toBe('#1d4ed8')
    expect(poiColor({ kind: 'vann-navn' })).toBe('#0ea5e9')
  })

  it('vann-kategorien slår inn når kind ikke er kjent', () => {
    expect(poiColor({ kind: 'noe-nytt', categories: ['vann'] })).toBe('#0ea5e9')
  })

  it('tåler tomt input', () => {
    expect(poiColor(null)).toMatch(/^#[0-9a-f]{6}$/)
    expect(poiColor({})).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('2D og 3D leser samme fargekilde', () => {
  it('symbolizer-CSS-en genereres fra tabellen', () => {
    const css = buildIsomCss(undefined, new Map(), {})
    for (const [kat, hex] of Object.entries(BRUKERMINNE_KAT_COLOR)) {
      expect(css).toContain(hex)
      if (kat !== 'annet') expect(css).toContain(`g[data-kat="${kat}"]`)
    }
  })

  it('brukerminneColorRules scoper til kalleren sin rot', () => {
    const rules = brukerminneColorRules('.isom-map')
    expect(rules[0]).toContain('.isom-map [data-layer="kulturminne"]')
    expect(rules[0]).toContain('cursor: pointer')
    expect(rules).toHaveLength(Object.keys(BRUKERMINNE_KAT_COLOR).length)
  })

  // Vakt mot at noen skriver hex-verdiene tilbake inn i kildene og lar de to
  // drive fra hverandre igjen — det var nettopp grunnen til at tabellen ble
  // trukket ut.
  it('fargene står ikke hardkodet i symbolizer eller useHeritageLayers', () => {
    const symbolizer = readFileSync(new URL('./symbolizer.js', import.meta.url), 'utf8')
    const heritage = readFileSync(new URL('../composables/useHeritageLayers.js', import.meta.url), 'utf8')
    for (const hex of Object.values(BRUKERMINNE_KAT_COLOR)) {
      expect(symbolizer).not.toContain(hex)
    }
    for (const hex of Object.values(FREDET_KAT_COLOR)) {
      expect(heritage).not.toContain(hex)
    }
  })
})
