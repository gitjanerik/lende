import { describe, it, expect } from 'vitest'
import {
  resolveVisibleLayers, buildSettingsCss, applyMapSettings, SETTINGS_STYLE_ID,
  buildThemeCss, listThemes, THEME_GROUPS,
} from './mapSettingsApply.js'
import {
  LAYERS, ALL_LAYER_KEYS, DEFAULT_VISIBLE_LAYER_KEYS, DEFAULT_OFF_LAYERS,
  MARINE_LAYER_KEYS,
} from './mapLayerCatalog.js'
import { KARTSTILER } from './kartStiler.js'

const SVG = '<svg class="isom-map"><g data-layer="kontur"/><g data-layer="sti"/></svg>'

describe('mapLayerCatalog', () => {
  it('har unike lag-nøkler og etiketter på alle lag', () => {
    const keys = LAYERS.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const l of LAYERS) expect(l.label).toBeTruthy()
  })

  it('kartstil-lag peker på ekte lag (kun «dybde» er pseudo)', () => {
    const known = new Set([...ALL_LAYER_KEYS, 'dybde'])
    for (const s of KARTSTILER) {
      for (const k of s.lag) expect(known.has(k), `${s.key}: ${k}`).toBe(true)
    }
  })

  it('default-synlighet = alle lag minus DEFAULT_OFF_LAYERS', () => {
    expect(DEFAULT_VISIBLE_LAYER_KEYS.length).toBe(LAYERS.length - DEFAULT_OFF_LAYERS.size)
    for (const k of DEFAULT_OFF_LAYERS) expect(DEFAULT_VISIBLE_LAYER_KEYS).not.toContain(k)
  })

  it('marine lag finnes i katalogen', () => {
    for (const k of MARINE_LAYER_KEYS) expect(ALL_LAYER_KEYS).toContain(k)
  })
})

describe('resolveVisibleLayers', () => {
  it('default: alt unntatt DEFAULT_OFF_LAYERS', () => {
    const v = resolveVisibleLayers()
    expect(v.has('kontur')).toBe(true)
    expect(v.has('lysloype')).toBe(false)
  })

  it('kartstil gir stilens lag-sett', () => {
    const v = resolveVisibleLayers({ kartstil: 'turkart' })
    expect(v.has('sti')).toBe(true)
    expect(v.has('sjo-poi')).toBe(false)
  })

  // Kartstilene skal skille seg på FLATER, ikke bare i navnet. Dette er
  // testen som hindrer at de gror sammen igjen slik Tur og Detaljert gjorde.
  it('kartstilene har reelt ulike lag-sett', () => {
    const sett = KARTSTILER.map((s) => [s.key, new Set(s.lag)])
    for (const [aKey, a] of sett) {
      for (const [bKey, b] of sett) {
        if (aKey >= bKey) continue
        const like = a.size === b.size && [...a].every((k) => b.has(k))
        // Natt og Turkart deler lag med vilje — de skiller seg på palett.
        if (aKey === 'natt' && bKey === 'turkart') continue
        if (aKey === 'turkart' && bKey === 'natt') continue
        expect(like, `${aKey} og ${bKey} har identisk lag-sett`).toBe(false)
      }
    }
  })

  it('lag-overstyring vinner over kartstil', () => {
    const v = resolveVisibleLayers({ kartstil: 'turkart', lag: { kontur: false, 'sjo-poi': true } })
    expect(v.has('kontur')).toBe(false)
    expect(v.has('sjo-poi')).toBe(true)
  })

  it('kaster på ukjent kartstil og ukjent lag', () => {
    expect(() => resolveVisibleLayers({ kartstil: 'tull' })).toThrow(/Ukjent kartstil/)
    // «detaljert» ble fjernet i v5.23.0 — den skal feile som enhver ukjent nøkkel.
    expect(() => resolveVisibleLayers({ kartstil: 'detaljert' })).toThrow(/Ukjent kartstil/)
    expect(() => resolveVisibleLayers({ lag: { finnesIkke: true } })).toThrow(/Ukjent lag/)
  })
})

describe('buildSettingsCss', () => {
  it('default-innstillinger speiler appens default-visning (kun lysloype skjult)', () => {
    const css = buildSettingsCss()
    expect(css).toContain('[data-layer="lysloype"]')
    expect(css).not.toContain('[data-layer="kontur"]')
  })

  it('alt synlig gir tom CSS', () => {
    expect(buildSettingsCss({ lag: { lysloype: true, vannstasjon: true }, strekSkala: 1 })).toBe('')
  })

  it('lag av → display:none-regel scoped til .isom-map (også ghost-fliser)', () => {
    const css = buildSettingsCss({ lag: { kontur: false } })
    expect(css).toContain('.isom-map [data-layer="kontur"]')
    expect(css).toContain('[data-ghost-layer="kontur"]')
    expect(css).toContain('display: none !important')
    expect(css).not.toContain('[data-layer="sti"]')
  })

  it('navn av skjuler også tall-labels (drawer-ens spesialtilfelle)', () => {
    const css = buildSettingsCss({ lag: { navn: false } })
    expect(css).toContain('[data-label]:not([data-label="stedsnavn"])')
  })

  it('dybde på tvinger frem detalj-lagene', () => {
    const css = buildSettingsCss({ lag: { dybde: true } })
    expect(css).toContain('[data-layer="dybdepunkt"]')
    expect(css).toContain('display: inline !important')
  })

  it('strekSkala setter --stroke-scale', () => {
    expect(buildSettingsCss({ strekSkala: 0.6 })).toContain('--stroke-scale: 0.6')
  })

  it('strek-gruppe gir override-regel med multiplikator; ukjent gruppe kaster', () => {
    const css = buildSettingsCss({ strek: { sti: 0.5 } })
    expect(css).toContain('[data-iso="505"]')
    expect(css).toContain('* 0.5')
    expect(() => buildSettingsCss({ strek: { tull: 2 } })).toThrow(/Ukjent strek-gruppe/)
  })
})

describe('tema', () => {
  it('listThemes returnerer alle katalog-temaer med etikett og beskrivelse', () => {
    const themes = listThemes()
    const keys = themes.map((t) => t.key)
    for (const k of ['light', 'dark', 'mono-sepia', 'mono-indigo', 'mono-slate', 'mocha', 'forest', 'curves']) {
      expect(keys).toContain(k)
    }
    for (const t of themes) {
      expect(t.label).toBeTruthy()
      expect(t.beskrivelse).toBeTruthy()
    }
    expect(themes.find((t) => t.key === 'curves').autoHideLayers).toBe(false)
    expect(themes.find((t) => t.key === 'dark').autoHideLayers).toBe(false)
  })

  // v5.23.0: 'hoved' er borte. Temaene som en kartstil eier ligger i gruppa
  // 'kartstil' og rendres KUN via Kartstil-fanen — to kontroller for samme
  // utseende var halve forvirringen kartstil-begrepet fjerner. Stemning-fanen
  // står igjen med monokrom-familien.
  it('kartstil-temaene er skilt fra stemningene', () => {
    const byKey = Object.fromEntries(listThemes().map((t) => [t.key, t]))
    for (const k of ['light', 'dark', 'turkart', 'padling', 'print']) {
      expect(byKey[k].group, `${k} skal eies av en kartstil`).toBe('kartstil')
      expect(byKey[k].monochrome, `${k} er ikke monokrom`).toBe(false)
    }
    for (const k of ['mono-sepia', 'mono-indigo', 'mono-slate', 'mocha', 'forest', 'curves']) {
      expect(byKey[k].group).toBe('monokrom')
      expect(byKey[k].monochrome).toBe(true)
    }
    expect(THEME_GROUPS.map((g) => g.key)).toEqual(['kartstil', 'monokrom'])
  })

  // Hver kartstil peker på et tema som MÅ finnes. Uten denne kunne en
  // omdøpt tema-nøkkel gi en kartstil-knapp som kaster ved trykk.
  it('hver kartstil peker på et tema som finnes', () => {
    const kjente = new Set(listThemes().map((t) => t.key))
    for (const s of KARTSTILER) {
      expect(kjente, `kartstil ${s.key} peker på ukjent tema ${s.tema}`).toContain(s.tema)
    }
  })

  it('light = katalog-defaults → ingen CSS', () => {
    expect(buildThemeCss('light')).toBe('')
  })

  it('dark setter samme CSS-variabler som appens applyTheme', () => {
    const css = buildThemeCss('dark')
    expect(css).toContain('--bg: #14181c')
    expect(css).toContain('--iso-101-stroke: #edc891')
    expect(css).toContain('--iso-depth-1: #295970')
    expect(css).toContain('--label-place-fill: #eeeff0')
    expect(css).toContain('--label-place-halo: #0a0d10')
    expect(css.startsWith('.isom-map {')).toBe(true)
    // fillOpacity 1 → ingen global demper. Høykontrast-temaet skal ikke blande
    // flatene mot bakgrunnen; variabelen emitteres kun når verdien er < 1.
    expect(css).not.toContain('--art-fill-opacity')
  })

  it('INGEN tema flater ut myra — alle beholder katalogens to mønstre', () => {
    // 308 fast / 309 utrygg skilles KUN av mønster-tettheten. Et flatt fyll gjør
    // dem identiske, altså utrygg myr umulig å skille fra fast — en sikkerhets-
    // regresjon på et turkart. Gjaldt opprinnelig bare dark; de seks monokrome
    // temaene flatet dem ut helt til v2.4.30.
    for (const key of listThemes().map((t) => t.key)) {
      const css = buildThemeCss(key)
      expect(css, `${key} flater ut fast myr`).not.toContain('--iso-308-fill')
      expect(css, `${key} flater ut utrygg myr`).not.toContain('--iso-309-fill')
    }
  })

  it('veier i dark farger kjernen, ikke bare casingen', () => {
    // Uten overlayStroke ble lys-temaets røde vegbane liggende igjen på toppen.
    const css = buildThemeCss('dark')
    expect(css).toContain('--iso-501-overlay-stroke: #eca688')
    expect(css).toContain('--iso-501-stroke: #0b0e11')
  })

  // Alt symbolizer.js leser som var(--label-<navn>-halo, #fff) må settes av HVERT
  // tema. Gjør det ikke det, faller labelen tilbake på base-katalogens lyse
  // ISOM-stil og får hvit halo midt på et mørkt kart. Nettopp det skjedde med
  // stedsnavn, omrade-navn, hytte-navn og naturreservat-navn.
  const LABEL_KINDS = [
    'place', 'peak', 'peak-ele', 'kontur-tall', 'vann-navn', 'vann-tall',
    'dybde-tall', 'stedsnavn', 'omrade-navn', 'hytte-navn', 'naturreservat-navn',
  ]
  const DARK_THEMES = listThemes().map((t) => t.key).filter((k) => k !== 'light')

  it('alle temaer setter fill OG halo for hver label-klasse', () => {
    for (const key of DARK_THEMES) {
      const css = buildThemeCss(key)
      for (const kind of LABEL_KINDS) {
        expect(css, `${key}/${kind}-fill`).toContain(`--label-${kind}-fill:`)
        expect(css, `${key}/${kind}-halo`).toContain(`--label-${kind}-halo:`)
      }
      // Ingen halo skal være hvit — den skal smelte inn i temaets bakgrunn.
      expect(css).not.toMatch(/--label-[a-z-]+-halo: (#fff\b|#ffffff|white)/)
    }
  })

  // Små bygg (< 500 m²) har egne variabler fordi de tegnes Kartverket-style
  // hvit/sort; uten tema-verdier ble hytter hvite ruter i alle mørke temaer.
  it('alle temaer setter småbygg-fargene (521-small)', () => {
    for (const key of DARK_THEMES) {
      const css = buildThemeCss(key)
      expect(css, `${key} mangler småbygg-fyll`).toContain('--iso-521-small-fill:')
      expect(css, `${key} mangler småbygg-strek`).toContain('--iso-521-small-stroke:')
    }
    // light beholder ISOM-defaultene (#fff/#000) — de er riktige på papir.
    expect(buildThemeCss('light')).toBe('')
  })

  // Punktsymbolene stein/bom/bru/bro/hule/gruve tegner med currentColor og
  // arver `color` fra .isom-map-roten. Uten --sym-ink pr tema falt de tilbake på
  // #000 og ble usynlige på mørk bakgrunn.
  it('alle temaer setter punktsymbol-blekket (--sym-ink)', () => {
    for (const key of DARK_THEMES) {
      const css = buildThemeCss(key)
      expect(css, `${key} mangler --sym-ink`).toContain('--sym-ink:')
      expect(css, `${key} mangler --sym-paper`).toContain('--sym-paper:')
    }
  })

  it('alle temaer farger myr-rasteret i sin egen kulør', () => {
    // Motstykket til testen over: strekfargen themes, tettheten ikke — så myra
    // slutter å være lys-modus' cyan uten at fast/utrygg-forskjellen ryker.
    for (const key of DARK_THEMES) {
      const css = buildThemeCss(key)
      expect(css, `${key} mangler myr-strek`).toContain('--pattern-myr-stroke:')
      expect(css, `${key} mangler utrygg-strek`).toContain('--pattern-myr-utrygg-stroke:')
      expect(css, `${key} har cyan myr`).not.toContain('#0099cc')
    }
  })

  it('stiFarger bakes inn i innstillings-CSS-en (MCP-paritet med appen)', () => {
    const css = buildSettingsCss({ stiFarger: { fg: '#7a4fa3', bg: '#ffee88' } })
    expect(css).toContain('stroke: #7a4fa3 !important')
    expect(css).toContain('[data-iso="505"] path.casing')
    // Tomt objekt = «følg tema» → ingen ekstra regler utover baselinjen.
    expect(buildSettingsCss({ stiFarger: {} })).toBe(buildSettingsCss({}))
    expect(() => buildSettingsCss({ stiFarger: { fg: 'lilla' } }))
      .toThrow(/Ugyldig sti-farge/)
  })

  it('ukjent tema kaster med liste over gyldige', () => {
    expect(() => buildThemeCss('neon')).toThrow(/Ukjent tema .*curves/)
  })

  it('curves beholder de gule kurvene, men skjuler ikke lenger resten', () => {
    const v = resolveVisibleLayers({ tema: 'curves' })
    expect(v.has('sti')).toBe(true)
    expect(v.has('vann')).toBe(true)
    const css = buildSettingsCss({ tema: 'curves' })
    expect(css).toContain('--iso-101-stroke: #ffd84a')
    expect(css).not.toContain('[data-layer="sti"]')
    expect(css).not.toContain('[data-layer="vann"]')
  })

  it('curves hvisker: øvrige elementer ligger tett opptil bakgrunnen', () => {
    // «Hviskende» er tallfestet — kurvene skal dominere. Sti-valøren ligger
    // langt under kurve-gulen, og flatene nesten oppå bakgrunnen.
    const css = buildThemeCss('curves')
    expect(css).toContain('--bg: #0d0520')
    expect(css).toContain('--iso-505-stroke: #5d5c65')
    expect(css).toContain('--iso-406-fill: #0a031d')
    // Dempingen ligger i valørene, ikke i en global opacity — den ville også
    // ha svekket de gule kurvene.
    expect(css).not.toContain('--art-fill-opacity')
  })

  it('lag-overstyring og kartstil virker som før', () => {
    const utenVann = resolveVisibleLayers({ tema: 'curves', lag: { vann: false } })
    expect(utenVann.has('vann')).toBe(false)
    const medStil = resolveVisibleLayers({ tema: 'curves', kartstil: 'turkart' })
    expect(medStil.has('sti')).toBe(true)
  })

  it('vanlig tema (dark) endrer ikke lag-synligheten', () => {
    const v = resolveVisibleLayers({ tema: 'dark' })
    expect(v.has('sti')).toBe(true)
    expect(v.has('kontur')).toBe(true)
  })
})

describe('applyMapSettings', () => {
  it('injiserer style-blokk før </svg>', () => {
    const out = applyMapSettings(SVG, { lag: { kontur: false } })
    expect(out).toContain(`<style id="${SETTINGS_STYLE_ID}">`)
    expect(out.indexOf('</svg>')).toBeGreaterThan(out.indexOf(SETTINGS_STYLE_ID))
  })

  it('er idempotent — ny påføring erstatter gammel blokk', () => {
    const once = applyMapSettings(SVG, { lag: { kontur: false } })
    const twice = applyMapSettings(once, { lag: { sti: false } })
    expect(twice.match(new RegExp(SETTINGS_STYLE_ID, 'g')).length).toBe(1)
    expect(twice).toContain('data-layer="sti"')
    expect(twice).not.toContain('.isom-map [data-layer="kontur"]')
  })

  it('alt-synlig-innstillinger fjerner eksisterende blokk og lar SVG-en ellers stå', () => {
    const allOn = { lag: { lysloype: true, vannstasjon: true } }
    const once = applyMapSettings(SVG, { lag: { kontur: false } })
    expect(applyMapSettings(once, allOn)).toBe(SVG)
    expect(applyMapSettings(SVG, allOn)).toBe(SVG)
  })
})
