import { describe, it, expect } from 'vitest'
import {
  KARTSTILER, KARTSTIL_KEYS, DEFAULT_KARTSTIL, STI_PALETTER,
  kartStil, stiPalett, aktivKartStil, utvidKartStil,
} from './kartStiler.js'
import { kartStilForhandsvisning, erMorktTema } from './mapSettingsApply.js'
import katalog from './isomCatalog.json'

describe('kartstil-modellen', () => {
  it('har fem stiler med unike nøkler, etiketter og beskrivelser', () => {
    expect(KARTSTILER).toHaveLength(5)
    expect(new Set(KARTSTIL_KEYS).size).toBe(5)
    for (const s of KARTSTILER) {
      expect(s.label, s.key).toBeTruthy()
      expect(s.beskrivelse, s.key).toBeTruthy()
      expect(s.lag.length, s.key).toBeGreaterThan(5)
    }
  })

  it('«detaljert» finnes ikke lenger', () => {
    // Den lovet detaljrikdom og leverte gårdsnavn og gjerder — se toppen av
    // kartStiler.js. Testen står så den ikke kan snike seg inn igjen.
    expect(KARTSTIL_KEYS).not.toContain('detaljert')
    expect(kartStil('detaljert')).toBeNull()
  })

  it('standarden er Turkart', () => {
    expect(DEFAULT_KARTSTIL).toBe('turkart')
    expect(kartStil(DEFAULT_KARTSTIL)).toBeTruthy()
  })

  it('hver stil peker på sitt eget tema — ingen deler palett', () => {
    const temaer = KARTSTILER.map((s) => s.tema)
    expect(new Set(temaer).size).toBe(temaer.length)
  })

  it('aktivKartStil finner stilen ut fra temaet', () => {
    for (const s of KARTSTILER) {
      expect(aktivKartStil({ tema: s.tema })).toBe(s.key)
    }
    expect(aktivKartStil({ tema: 'mono-sepia' })).toBeNull()
    expect(aktivKartStil({})).toBeNull()
  })
})

// Dette er testen som holder eierens faktiske klage i sjakk: «for lite
// kontrast mellom turkart, detaljert, padling og orint». Stilene må skille
// seg på FLATER, ikke bare i navnet.
describe('kartstilene har reell visuell kontrast', () => {
  const forhandsvisninger = KARTSTILER.map((s) => [s.key, kartStilForhandsvisning(s.key)])

  it('hver stil har en forhåndsvisning med alle fem fargene', () => {
    for (const [key, f] of forhandsvisninger) {
      expect(f, key).toBeTruthy()
      for (const rolle of ['bg', 'kontur', 'sti', 'vann', 'skog']) {
        expect(f[rolle], `${key}.${rolle}`).toMatch(/^#[0-9a-f]{3,6}$/i)
      }
    }
  })

  it('ingen to stiler har samme bakgrunnsfarge', () => {
    const bg = forhandsvisninger.map(([, f]) => f.bg.toLowerCase())
    expect(new Set(bg).size).toBe(bg.length)
  })

  it('ingen to stiler har identisk palett', () => {
    const fingeravtrykk = forhandsvisninger.map(([, f]) =>
      [f.bg, f.kontur, f.sti, f.vann, f.skog].join('|').toLowerCase())
    expect(new Set(fingeravtrykk).size).toBe(fingeravtrykk.length)
  })

  it('Turkart snur ISOM-logikken: skogen er grønnere enn bakgrunnen er gul', () => {
    // ISOM har hvit løpbar skog på kremgul mark — omvendt av alle andre
    // norske kart. Turkart legger skogen i bakgrunnen og maler åpenhet oppå.
    const turkart = kartStilForhandsvisning('turkart')
    const orientering = kartStilForhandsvisning('orientering')
    const gronnhet = (hex) => {
      const n = parseInt(hex.replace('#', ''), 16)
      return ((n >> 8) & 255) - (((n >> 16) & 255) + (n & 255)) / 2
    }
    expect(gronnhet(turkart.bg)).toBeGreaterThan(gronnhet(orientering.bg))
  })

  it('høydekurvene er brune i Turkart og røde i Orientering', () => {
    const rod = (hex) => {
      const n = parseInt(hex.replace('#', ''), 16)
      return ((n >> 16) & 255) - ((n >> 8) & 255)
    }
    // Rød ISOM-kurve har mye større rød-overvekt enn en brun.
    expect(rod(kartStilForhandsvisning('orientering').kontur))
      .toBeGreaterThan(rod(kartStilForhandsvisning('turkart').kontur))
  })

  it('bare Natt er mørkt', () => {
    for (const s of KARTSTILER) {
      expect(erMorktTema(s.tema), s.key).toBe(s.key === 'natt')
    }
  })
})

describe('sti-paletter', () => {
  it('«Følg tema» har ingen farger — de andre har både fg og bg', () => {
    expect(stiPalett('tema').farger).toBeNull()
    for (const p of STI_PALETTER.filter((x) => x.key !== 'tema')) {
      expect(p.farger.fg, p.key).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.farger.bg, p.key).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.beskrivelse, p.key).toBeTruthy()
    }
  })

  it('er 3–5 valg, ikke en fargevelger', () => {
    // Eierens poeng: to fargevelgere med 16 millioner verdier hver er ikke et
    // valg. Vokser lista forbi fem, er vi tilbake til en oppgave.
    expect(STI_PALETTER.length).toBeGreaterThanOrEqual(3)
    expect(STI_PALETTER.length).toBeLessThanOrEqual(5)
  })
})

describe('utvidKartStil', () => {
  it('fyller tema, strek og sti-palett fra stilen', () => {
    const ut = utvidKartStil({ kartstil: 'print' })
    expect(ut.tema).toBe('print')
    expect(ut.stiPalett).toBe('blekk')
    expect(ut.strek.sti).toBeCloseTo(1.45)
  })

  it('eksplisitte felter vinner over stilens', () => {
    const ut = utvidKartStil({ kartstil: 'print', tema: 'dark', stiPalett: 'signal' })
    expect(ut.tema).toBe('dark')
    expect(ut.stiPalett).toBe('signal')
  })

  it('strek slås SAMMEN — brukerens gruppe legges oppå stilens profil', () => {
    const ut = utvidKartStil({ kartstil: 'print', strek: { kurve: 2 } })
    expect(ut.strek.kurve).toBe(2)
    expect(ut.strek.sti).toBeCloseTo(1.45)
  })

  it('uten kartstil er den en no-op', () => {
    const inn = { tema: 'dark' }
    expect(utvidKartStil(inn)).toBe(inn)
    expect(utvidKartStil()).toEqual({})
  })
})

// v5.23.1: eieren meldte fra felt at stiplingen fortsatt leste som en
// heltrukken strek på telefon. Det som skiller en sti fra en vei er RYTMEN,
// og rytmen måles i periode (strek + luft) — ikke i strekfarge. Testene her
// verner tettheten mot å drive tilbake mot ISOM-spec-en ved neste finpuss.
describe('sti-stiplingen er tett nok til å leses som stiplet', () => {
  const dash = (tema, kode) =>
    katalog.themes[tema]?.categories?.[kode]?.stroke?.dash
      ?? katalog.categories.manmade[kode].stroke.dasharray

  const periode = (d) => d[0] + d[1]

  it('ISOM-spec-en er referansen vi måler mot', () => {
    // 505 i basekatalogen ER spec-en: 0,36 mm strek + 0,30 mm luft.
    expect(katalog.categories.manmade['505'].stroke.dasharray).toEqual([0.36, 0.3])
  })

  for (const tema of ['turkart', 'padling', 'dark', 'print']) {
    it(`${tema} har minst dobbelt så tett sti-rytme som ISOM`, () => {
      const spec = periode(katalog.categories.manmade['505'].stroke.dasharray)
      expect(periode(dash(tema, '505')) * 2).toBeLessThanOrEqual(spec)
    })

    it(`${tema} har strek på høyst en tredjedel av ISOM-lengden`, () => {
      expect(dash(tema, '505')[0]).toBeLessThanOrEqual(0.36 / 3 + 1e-9)
    })

    it(`${tema} holder stitråkk (507) tydelig glisnere enn vanlig sti (505)`, () => {
      // Blir de like tette, mister 507 sin betydning: «vanskelig å følge».
      expect(periode(dash(tema, '507'))).toBeGreaterThan(periode(dash(tema, '505')))
    })
  }

  // v5.23.1 antok først at papir trengte lengre strek (blekk-spredning). Eieren
  // så på et ekte Print-kart at det er DER problemet er verst: lange strek
  // smelter sammen med det øvrige svarte linjeverket. Print deler derfor rytme
  // med resten. Testen står så antakelsen ikke sniker seg inn igjen.
  it('Print deler den tette rytmen — papir er ikke et unntak', () => {
    expect(dash('print', '505')).toEqual(dash('turkart', '505'))
  })

  it('Orientering er urørt ISOM-spec (temaet setter ingen dash)', () => {
    expect(katalog.themes.light.categories?.['505']?.stroke?.dash).toBeUndefined()
  })
})
