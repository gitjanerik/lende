import { describe, it, expect } from 'vitest'
import { LAYERS } from './mapLayerCatalog.js'
import { kartStil } from './kartStiler.js'
import { utm32ToWgs84 } from './utm.js'
import {
  FRITT_LENDE_LAG,
  FRATREKK,
  frittLendeTema,
  frittLendeUtmBbox,
  knappeHandling,
  knappeEtikett,
  fixVurdering,
  arkErGammelt,
  BREDDE_M,
  DEM_OPPLOSNING_M,
  EKVIDISTANSE_M,
  GAMMELT_ARK_DOGN,
  dekningsSkala,
  DEKNING_MARGIN,
} from './frittLende.js'

const LAG_NOKLER = new Set(LAYERS.map((l) => l.key ?? l))

describe('lagsettet', () => {
  // En feilstavet lag-nøkkel er i dag en STILLE no-op: applyLayerVisibility
  // gjør querySelectorAll('[data-layer="…"]') og finner ingenting. Denne
  // testen er den eneste som ville fanget det.
  it('hver nøkkel finnes faktisk i katalogen', () => {
    for (const k of FRITT_LENDE_LAG) expect(LAG_NOKLER.has(k), k).toBe(true)
    for (const k of FRATREKK) expect(LAG_NOKLER.has(k), k).toBe(true)
  })

  it('trekker fra de tre modusen ikke vil ha', () => {
    for (const k of ['bymasse', 'parkering', 'holdeplass']) {
      expect(FRITT_LENDE_LAG).not.toContain(k)
    }
  })

  // Disse er allerede ute via OVERLEGG i orientering-stilen. Testen fanger at
  // noen senere legger dem inn igjen der.
  it('har ingen overlegg — kulturminner og vannstasjoner', () => {
    for (const k of ['kulturminne', 'fredet-kulturminne', 'vannstasjon']) {
      expect(FRITT_LENDE_LAG).not.toContain(k)
    }
  })

  // En hytte er ly, og ly betyr noe når det mørkner.
  it('beholder bygninger og terrenget man faktisk navigerer etter', () => {
    for (const k of ['bygning', 'kontur', 'vann']) {
      if (LAG_NOKLER.has(k)) expect(FRITT_LENDE_LAG, k).toContain(k)
    }
  })

  // Fratrekk og ikke liste: et NYTT lag i katalogen skal komme med av seg selv.
  it('er orientering-settet minus nøyaktig fratrekket', () => {
    const forventet = kartStil('orientering').lag.filter((k) => !FRATREKK.includes(k))
    expect([...FRITT_LENDE_LAG]).toEqual(forventet)
  })
})

describe('frittLendeTema', () => {
  it('er ISOM-uttrykket som standard', () => {
    expect(frittLendeTema(false)).toBe(kartStil('orientering').tema)
  })
  // Et hvitt ark på full lysstyrke på et mørkt fjell ødelegger nattsynet.
  it('følger brukerens mørke turkart når det er på', () => {
    expect(frittLendeTema(true)).toBe(kartStil('natt').tema)
    expect(frittLendeTema(true)).not.toBe(frittLendeTema(false))
  })
})

describe('frittLendeUtmBbox', () => {
  const steder = [
    ['Vardåsen', 59.8412, 10.4123],
    ['Gjende', 61.4950, 8.7700],
    ['Tromsø', 69.6492, 18.9553],
  ]

  it.each(steder)('%s: arket er eksakt 2000 × 2000 m', (_, lat, lon) => {
    const b = frittLendeUtmBbox(lat, lon)
    expect(b.maxE - b.minE).toBe(BREDDE_M)
    expect(b.maxN - b.minN).toBe(BREDDE_M)
  })

  // Snappingen er hele grunnen til at DEM-flis-cachen kan gjenbrukes mellom to
  // bygg i samme område.
  it.each(steder)('%s: alle fire kanter ligger på DEM-rutenettet', (_, lat, lon) => {
    const b = frittLendeUtmBbox(lat, lon)
    for (const v of [b.minE, b.maxE, b.minN, b.maxN]) {
      expect(v % DEM_OPPLOSNING_M).toBe(0)
    }
  })

  it('senterpunktet ligger inne i arket, nær midten', () => {
    const b = frittLendeUtmBbox(59.8412, 10.4123)
    const midt = utm32ToWgs84((b.minE + b.maxE) / 2, (b.minN + b.maxN) / 2)
    expect(Math.abs(midt.lat - 59.8412)).toBeLessThan(0.001)
    expect(Math.abs(midt.lon - 10.4123)).toBeLessThan(0.001)
  })

  // To bygg fra punkter innenfor samme rutenettcelle skal gi SAMME bboks —
  // ellers lastes DEM-en på nytt for et ark som i praksis er det samme.
  it('to nærliggende punkter i samme celle gir identisk bboks', () => {
    const a = frittLendeUtmBbox(59.84120, 10.41230)
    const b = frittLendeUtmBbox(59.841203, 10.412303)
    expect(b).toEqual(a)
  })
})

describe('knappeHandling', () => {
  const grunn = { harArk: true, gpsPaa: true, utenforArket: false, ferskLast: false, bygger: false }
  const h = (over = {}) => knappeHandling({ ...grunn, ...over })

  it('uten ark: knappen lager ett', () => {
    expect(h({ harArk: false, gpsPaa: false })).toBe('start-gps-og-bygg')
    expect(h({ harArk: false, gpsPaa: true })).toBe('bygg')
  })

  // INVARIANT 1 — dette er svaret på «GPS-en min er et helt annet sted nå».
  // Åpner du appen hjemme med et ark fra fjellet, gjør første trykk ingen skade.
  it('INVARIANT: første tap etter fersk last bygger aldri', () => {
    expect(h({ gpsPaa: false, ferskLast: true })).toBe('start-gps')
    expect(h({ gpsPaa: false, ferskLast: true, utenforArket: true })).toBe('start-gps')
    expect(h({ gpsPaa: true, ferskLast: true, utenforArket: true })).toBe('sentrer')
  })

  it('etter at ferskLast er ryddet, bygger tap utenfor arket', () => {
    expect(h({ utenforArket: true })).toBe('bygg')
  })

  // INVARIANT 2 — muligheten finnes ikke, i stedet for å ha en fartsdump.
  it('INVARIANT: tap kan aldri bygge mens du står på arket', () => {
    for (const ferskLast of [true, false]) {
      expect(h({ utenforArket: false, ferskLast })).toBe('sentrer')
    }
  })

  it('hold bygger, også innenfra arket og rett etter en fersk last', () => {
    expect(h({ hold: true })).toBe('bygg')
    expect(h({ hold: true, ferskLast: true })).toBe('bygg')
    expect(h({ hold: true, gpsPaa: false })).toBe('start-gps-og-bygg')
  })

  it('er deaktivert mens byggingen pågår', () => {
    expect(h({ bygger: true })).toBeNull()
    expect(h({ bygger: true, hold: true })).toBeNull()
  })
})

describe('knappeEtikett', () => {
  const grunn = { harArk: true, gpsPaa: true, utenforArket: false, ferskLast: false, bygger: false }
  const e = (over = {}) => knappeEtikett({ ...grunn, ...over })

  // Etiketten er avledet av SAMME tilstand som handlingen, så den kan ikke
  // komme i utakt. Testen holder de to sammen der det betyr noe.
  it('lover bygging nøyaktig når et tap faktisk bygger', () => {
    const tilstander = [
      { harArk: false, gpsPaa: false }, { harArk: false, gpsPaa: true },
      { utenforArket: true }, { utenforArket: false },
      { gpsPaa: false }, { ferskLast: true, utenforArket: true },
    ]
    for (const t of tilstander) {
      const handling = knappeHandling({ ...grunn, ...t })
      const etikett = e(t)
      const byggerNaa = handling === 'bygg' || handling === 'start-gps-og-bygg'
      expect(/lag .*kart/i.test(etikett), `${JSON.stringify(t)} → ${etikett}`).toBe(byggerNaa)
    }
  })

  it('sier fra mens den bygger', () => {
    expect(e({ bygger: true })).toMatch(/bygger/i)
  })
})

describe('fixVurdering', () => {
  // Et 2 km-ark bygget på en ±500 m posisjon setter deg nær kanten fra første
  // sekund, og du merker det ikke.
  it('bygger straks på en god fix', () => {
    expect(fixVurdering({ accuracyM: 12, ventetMs: 300 })).toBe('bygg')
    expect(fixVurdering({ accuracyM: 50, ventetMs: 0 })).toBe('bygg')
  })

  it('venter litt på noe bedre når fixen er middels', () => {
    expect(fixVurdering({ accuracyM: 120, ventetMs: 1000 })).toBe('vent')
    expect(fixVurdering({ accuracyM: null, ventetMs: 3000 })).toBe('vent')
  })

  it('bygger på beste fix etter ventetiden', () => {
    expect(fixVurdering({ accuracyM: 120, ventetMs: 8000 })).toBe('bygg')
  })

  it('spør først når fixen er elendig og det har gått lang tid', () => {
    expect(fixVurdering({ accuracyM: 420, ventetMs: 15000 })).toBe('spor')
  })
})

describe('arkErGammelt', () => {
  const DOGN = 24 * 3600 * 1000
  const naa = Date.UTC(2026, 7, 29)

  it('et ferskt ark sier ingenting', () => {
    expect(arkErGammelt(naa - 2 * DOGN, naa)).toBe(false)
  })
  it('et ark fra forrige uke nevnes', () => {
    expect(arkErGammelt(naa - (GAMMELT_ARK_DOGN + 1) * DOGN, naa)).toBe(true)
  })
  it('tåler manglende tidsstempel', () => {
    expect(arkErGammelt(undefined, naa)).toBe(false)
    expect(arkErGammelt(NaN, naa)).toBe(false)
  })
})

describe('arkets faste form', () => {
  it('er 2 km med 10 m ekvidistanse og 10 m DEM', () => {
    expect(BREDDE_M).toBe(2000)
    expect(EKVIDISTANSE_M).toBe(10)
    expect(DEM_OPPLOSNING_M).toBe(10)
  })
})

// Åpningsvisningen. Feilen dette retter var synlig i felt: et kvadratisk 2 km-ark
// på en høy telefon la seg etter BREDDEN og etterlot et tomt felt over og under.
describe('dekningsSkala', () => {
  const ark = { widthM: 2000, heightM: 2000 }

  it('dekker viewporten på en høy, smal skjerm', () => {
    const { w, h } = { w: 430, h: 787 }
    const s = dekningsSkala({ w, h, ...ark })
    const contain = Math.min(w / 2000, h / 2000)
    // Arkets høyde på skjermen skal være minst viewportens høyde.
    expect(2000 * contain * s).toBeGreaterThanOrEqual(h)
    // …og bredden er da bredere enn skjermen, som er hele poenget med cover.
    expect(2000 * contain * s).toBeGreaterThan(w)
  })

  it('har margin, så en arkkant ikke dukker opp av litt panorering', () => {
    const { w, h } = { w: 430, h: 787 }
    const s = dekningsSkala({ w, h, ...ark })
    const bart = Math.max(w / 2000, h / 2000) / Math.min(w / 2000, h / 2000)
    expect(s).toBeGreaterThan(bart)
    expect(s / bart).toBeCloseTo(DEKNING_MARGIN, 10)
  })

  it('zoomer mer jo høyere skjermen er', () => {
    const lav = dekningsSkala({ w: 430, h: 600, ...ark })
    const hoy = dekningsSkala({ w: 430, h: 900, ...ark })
    expect(hoy).toBeGreaterThan(lav)
  })

  // Nullpunktet er contain (SVG-en står på 100 % med preserveAspectRatio=meet),
  // så en kvadratisk viewport trenger ingen zoom utover marginen.
  it('gir bare marginen på en kvadratisk skjerm', () => {
    expect(dekningsSkala({ w: 800, h: 800, ...ark })).toBeCloseTo(DEKNING_MARGIN, 10)
  })

  // En umålt flate MÅ gi 1 og ikke NaN eller 0: verdien går rett inn i en
  // CSS-transform, og NaN der gir et usynlig kart.
  it('faller trygt tilbake til 1 uten målt flate', () => {
    expect(dekningsSkala({ w: 0, h: 0, ...ark })).toBe(1)
    expect(dekningsSkala({ w: 430, h: 787, widthM: 0, heightM: 0 })).toBe(1)
    expect(dekningsSkala({})).toBe(1)
  })
})
