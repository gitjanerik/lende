import { describe, it, expect } from 'vitest'
import {
  KARTSTILER, KARTSTIL_KEYS, DEFAULT_KARTSTIL, STI_PALETTER,
  kartStil, stiPalett, aktivKartStil, utvidKartStil,
} from './kartStiler.js'
import { kartStilForhandsvisning, erMorktTema } from './mapSettingsApply.js'
import katalog from './isomCatalog.json'
import { dashMm } from './strekMonster.js'

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
  // Temaets mønster (mm eller faktorer) erstatter basens; bredden er basens.
  const dash = (tema, kode) => {
    const b = katalog.categories.manmade[kode].stroke
    const t = katalog.themes[tema]?.categories?.[kode]?.stroke
    const s = t?.dash ? { dash: t.dash } : t?.dashFaktor ? { dashFaktor: t.dashFaktor } : b
    return dashMm(s, b.widthMm)
  }

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

    it(`${tema}: alle tre stiene har samme stiplingsmønster`, () => {
      // v7.9.16: dobbelstreken (v7.9.13) leste som en liten veg inne i
      // casingen. Mønsteret er nå likt, og bare strekbredden skiller.
      expect(dash(tema, '506')).toEqual(dash(tema, '505'))
      expect(dash(tema, '507')).toEqual(dash(tema, '505'))
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

describe('høyfjellet skiller seg fra skogen når arket HAR skogdata', () => {
  // Fram til v5.26.0 hevdet Turkart skog gjennom bakgrunnsfargen, og påstanden
  // gjaldt over alt: rett over tregrensa var arket like grønt som granskogen.
  // Skillet kommer av at bakgrunnen viker for `backgroundApen` når arket bærer
  // ekte N50-skog, og at 406 males oppå. De to MÅ da kunne skilles fra
  // hverandre — hvis ikke er byttet gjort uten å ha løst noe.
  const lum = (hex) => {
    const n = parseInt(String(hex).replace('#', ''), 16)
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  }
  const turkart = katalog.themes.turkart

  it('Turkart har en egen åpen-mark-tone, og den er ikke skog-tonen', () => {
    expect(turkart.backgroundApen).toMatch(/^#[0-9a-f]{6}$/i)
    expect(turkart.backgroundApen.toLowerCase()).not.toBe(turkart.background.toLowerCase())
  })

  it('skog (406) er merkbart mørkere enn åpen mark — ellers er skillet på papiret', () => {
    const skog = turkart.categories['406'].fill.color
    expect(lum(turkart.backgroundApen) - lum(skog)).toBeGreaterThan(0.06)
  })

  it('isbre er lysere enn åpen mark, og har en kant som holder den fra hverandre', () => {
    // Hvit bre på lys åpen mark har nesten ingen flate-kontrast. Kanten er
    // derfor ikke pynt: uten den forsvinner breen akkurat der breer finnes.
    const bre = turkart.categories['410']
    expect(lum(bre.fill.color)).toBeGreaterThanOrEqual(lum(turkart.backgroundApen))
    expect(lum(turkart.backgroundApen) - lum(bre.stroke.color)).toBeGreaterThan(0.15)
  })

  it('ALLE temaer har en kirkegård (516) som skiller seg fra sin egen bakgrunn', () => {
    // 516 er et MØNSTER og ikke et flatt fyll, så temaet overstyrer mønsterets
    // egen bunn (--pattern-kirkegard-fill) framfor --iso-516-fill. Sjekken er
    // den samme som for breen: enten bunnen eller korsene må leses mot arket.
    for (const [navn, tema] of Object.entries(katalog.themes)) {
      const bunn = tema.patterns?.kirkegard?.fill ?? katalog.patterns.kirkegard.background
      const kors = tema.patterns?.kirkegard?.stroke ?? katalog.patterns.kirkegard.elements[0].stroke
      const bg = tema.background ?? katalog.background.color
      expect(bunn, navn).toMatch(/^#[0-9a-f]{6}$/i)
      expect(kors, navn).toMatch(/^#[0-9a-f]{6}$/i)
      const skille = Math.max(Math.abs(lum(bunn) - lum(bg)), Math.abs(lum(kors) - lum(bg)))
      expect(skille, navn).toBeGreaterThan(0.05)
      // Og korsene må leses mot sin EGEN bunn — uten det er flata bare en flate,
      // og en flate uten raster leses som en park.
      expect(Math.abs(lum(kors) - lum(bunn)), navn).toBeGreaterThan(0.08)
    }
  })

  it('ALLE temaer har en 410-farge, og ingen av dem flater breen ut mot sin egen bakgrunn', () => {
    for (const [navn, tema] of Object.entries(katalog.themes)) {
      const bre = tema.categories?.['410'] ?? katalog.categories.terrain['410']
      const fyll = bre.fill?.color ?? katalog.categories.terrain['410'].fill.color
      const strek = bre.stroke?.color ?? katalog.categories.terrain['410'].stroke.color
      const bg = tema.background ?? katalog.background.color
      expect(fyll, navn).toMatch(/^#[0-9a-f]{6}$/i)
      // Enten flata eller kanten må skille seg fra bakgrunnen. På de mørke
      // temaene er det flata som gjør jobben, på de lyse er det kanten.
      const skille = Math.max(Math.abs(lum(fyll) - lum(bg)), Math.abs(lum(strek) - lum(bg)))
      expect(skille, navn).toBeGreaterThan(0.1)
    }
  })
})

// v7.8.37: skogsvegen (504) og stien (505) leste nesten likt — begge 0,1 mm
// sort strek, og bare stien hadde den lyse casingen som løfter den over
// terrenget. Vegen var altså den SVAKESTE av de to. Testene under verner de
// to endringene som rettet det, fordi begge er tall man lett «rydder» tilbake.
describe('skogsveg (504) leses som veg, ikke som sti', () => {
  const d = (kode) => katalog.categories.manmade[kode]

  it('504 er heltrukken — rytmen er hele forskjellen mot stien', () => {
    expect(d('504').stroke.dasharray).toBeUndefined()
    expect(d('505').stroke.dasharray).toBeDefined()
  })

  it('504 har tyngre strek enn 505, og casingen er aldri smalere', () => {
    expect(d('504').stroke.widthMm).toBeGreaterThan(d('505').stroke.widthMm)
    expect(d('504').casingStroke.widthMm).toBeGreaterThanOrEqual(d('505').casingStroke.widthMm)
  })

  // v7.9.14: med 0,30 mm casing var skogsvegen dobbelt så bred som småvegen,
  // og småvegens tynne svarte kant så ut som stumper ved siden av den.
  it('504 har SAMME totalbredde som småvegen (503)', () => {
    expect(d('504').casingStroke.widthMm).toBe(d('503').stroke.widthMm)
  })

  it('504 er lettere enn småvegen (503), som er den over den igjen', () => {
    expect(d('504').stroke.widthMm).toBeLessThan(d('503').stroke.widthMm)
    // ...og 503 er den eneste av de to som bærer farge.
    expect(d('503').overlayStroke).toBeDefined()
    expect(d('504').overlayStroke).toBeUndefined()
  })
})

// Sti-stigen: 505 «godt løp» → 506 «uklar» → 507 «stitråkk». Fram til v7.8.37
// var 506 TETTERE enn 505 i hvert tema ([0.1, 0.1] mot [0.12, 0.11]) — den
// utydelige stien leste altså fastere enn den gode. Regelen er monoton.
// v7.9.16: stigen bæres av strekbredden alene — mønsteret er likt, så den
// tydeligste stien er den med tykkest strek.
describe('sti-stigen er monoton — tydeligst sti er tykkest', () => {
  it('strekbredden avtar fra 505 via 506 til 507', () => {
    const w = (k) => katalog.categories.manmade[k].stroke.widthMm
    expect(w('505')).toBeGreaterThan(w('506'))
    expect(w('506')).toBeGreaterThan(w('507'))
  })

  it('forskjellen er liten — 507 er minst to tredjedeler av 505', () => {
    const w = (k) => katalog.categories.manmade[k].stroke.widthMm
    expect(w('507') / w('505')).toBeGreaterThanOrEqual(2 / 3)
  })
})

// v7.9.14: stiene var et lappverk — tre bredder, og 507 uten casing, så den
// minste stien var en løs grå stump ved siden av de hvit-kantede. Nå har alle
// tre SAMME form utenpå, og bare den svarte streken inne i casingen skiller dem.
describe('alle stier har samme ytre form', () => {
  const d = (kode) => katalog.categories.manmade[kode]
  const STIER = ['505', '506', '507']

  it('lik casing-bredde og likt mønster i faste mm på 505/506/507', () => {
    for (const k of STIER) {
      expect(d(k).casingStroke?.widthMm, k).toBe(d('505').casingStroke.widthMm)
      expect(d(k).stroke.dasharray, k).toEqual(d('505').stroke.dasharray)
      expect(d(k).stroke.dashFast, k).toBe(true)
    }
  })

  it('casingen er ikke bredere enn småvegen — stien skal aldri veie mer enn vegen', () => {
    expect(d('505').casingStroke.widthMm).toBeLessThanOrEqual(d('503').stroke.widthMm)
  })

  for (const tema of ['turkart', 'padling', 'print']) {
    it(`${tema}: samme strekfarge og casing-farge på alle tre`, () => {
      const t = katalog.themes[tema].categories
      for (const k of STIER) {
        expect(t[k].stroke.color, k).toBe(t['505'].stroke.color)
        expect(t[k].casingStroke?.color, k).toBe(t['505'].casingStroke.color)
      }
    })
  }
})
