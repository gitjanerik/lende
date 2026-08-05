import { describe, it, expect } from 'vitest'
import {
  tetthetsIndeks, tetthetsklasse, detaljNivaaFor, maxWidthKmFor, kostnad,
  tetthetsBeslutning, tetthetsBegrunnelse, separasjonerFor, erDroppet,
  konturTallTakFor, KOSTNADSBUDSJETT, BREDDE_STEG_KM, BREDDE_MAKS_KM,
  DETALJ_NIVAAER, NIVAA_FAKTOR,
} from './mapDensityRules.js'

// Ekte sonderte tall fra scripts/kalibrer-tetthet.mjs (8 km kvadrat, 64 km²).
// Disse er FASITEN for tersklene — endrer noen dem, skal denne testen falle.
const MAALT = {
  oslo:     { areal: 64, counts: { bygning: 47759, kulturminne: 542, vei: 41363, parkering: 1467, sted: 230, holdeplass: 925, fredet: 987 } },
  asker:    { areal: 64, counts: { bygning: 21440, kulturminne: 210, vei: 9596, parkering: 432, sted: 222, holdeplass: 220, fredet: 386 } },
  vardasen: { areal: 64, counts: { bygning: 22551, kulturminne: 189, vei: 9848, parkering: 463, sted: 201, holdeplass: 213, fredet: 329 } },
  lierne:   { areal: 64, counts: { bygning: 270, kulturminne: 0, vei: 79, parkering: 2, sted: 25, holdeplass: 19, fredet: 14 } },
}

describe('tetthetsIndeks', () => {
  it('rangerer de målte områdene i samme rekkefølge som faktisk SVG-størrelse', () => {
    // Målt headless: Lierne 448 KB · Vardåsen 2711 KB · Oslo 5166 KB
    const i = (k) => tetthetsIndeks(MAALT[k].counts, MAALT[k].areal)
    expect(i('lierne')).toBeLessThan(i('vardasen'))
    expect(i('vardasen')).toBeLessThan(i('oslo'))
  })

  it('gir tallene kalibreringen fant', () => {
    expect(Math.round(tetthetsIndeks(MAALT.oslo.counts, 64))).toBe(915)
    expect(Math.round(tetthetsIndeks(MAALT.vardasen.counts, 64))).toBe(255)
    expect(Math.round(tetthetsIndeks(MAALT.asker.counts, 64))).toBe(252)
    expect(Math.round(tetthetsIndeks(MAALT.lierne.counts, 64))).toBe(4)
  })

  it('er 0 for tomme/ugyldige input i stedet for NaN', () => {
    expect(tetthetsIndeks(null, 64)).toBe(0)
    expect(tetthetsIndeks({}, 64)).toBe(0)
    expect(tetthetsIndeks(MAALT.oslo.counts, 0)).toBe(0)
    expect(tetthetsIndeks(MAALT.oslo.counts, -5)).toBe(0)
  })

  it('ignorerer ukjente og ikke-numeriske kategorier', () => {
    const a = tetthetsIndeks({ vei: 100 }, 10)
    const b = tetthetsIndeks({ vei: 100, ukjent: 99999, sted: 'nei' }, 10)
    expect(b).toBe(a)
  })
})

describe('tetthetsklasse', () => {
  it('plasserer referansekartene der de skal', () => {
    expect(tetthetsklasse(tetthetsIndeks(MAALT.lierne.counts, 64))).toBe('åpen')
    expect(tetthetsklasse(tetthetsIndeks(MAALT.vardasen.counts, 64))).toBe('middels')
    expect(tetthetsklasse(tetthetsIndeks(MAALT.asker.counts, 64))).toBe('middels')
    expect(tetthetsklasse(tetthetsIndeks(MAALT.oslo.counts, 64))).toBe('svært tett')
  })

  it('faller til «åpen» for ugyldig input', () => {
    expect(tetthetsklasse(NaN)).toBe('åpen')
    expect(tetthetsklasse(-1)).toBe('åpen')
    expect(tetthetsklasse(undefined)).toBe('åpen')
  })
})

describe('detaljNivaaFor — trinn 1', () => {
  it('velger det LETTESTE nivået som holder budsjettet', () => {
    // Åpent og middels tett: full detalj, uendret kart.
    expect(detaljNivaaFor(tetthetsIndeks(MAALT.lierne.counts, 64), 64)).toBe('full')
    expect(detaljNivaaFor(tetthetsIndeks(MAALT.vardasen.counts, 64), 64)).toBe('full')
    expect(detaljNivaaFor(tetthetsIndeks(MAALT.asker.counts, 64), 64)).toBe('full')
    // Oslo sprekker på alle nivåer → sparsom, og trinn 2 tar resten.
    expect(detaljNivaaFor(tetthetsIndeks(MAALT.oslo.counts, 64), 64)).toBe('sparsom')
  })

  it('beholder full detalj på et LITE kart i tett by', () => {
    // Oslo 2 km = 4 km²: datamengden er liten selv om tettheten er høy.
    const indeks = tetthetsIndeks(MAALT.oslo.counts, 64)
    expect(detaljNivaaFor(indeks, 4)).toBe('full')
  })

  it('eskalerer monotont når arealet vokser', () => {
    const indeks = tetthetsIndeks(MAALT.oslo.counts, 64)
    const rekkefølge = [4, 16, 36, 64].map(a => DETALJ_NIVAAER.indexOf(detaljNivaaFor(indeks, a)))
    for (let i = 1; i < rekkefølge.length; i++) {
      expect(rekkefølge[i]).toBeGreaterThanOrEqual(rekkefølge[i - 1])
    }
  })
})

describe('maxWidthKmFor — trinn 2', () => {
  it('gir hele skalaen i åpent terreng', () => {
    expect(maxWidthKmFor(tetthetsIndeks(MAALT.lierne.counts, 64), 'full')).toBe(BREDDE_MAKS_KM)
  })

  it('klamper Oslo til 6 km på sparsom', () => {
    expect(maxWidthKmFor(tetthetsIndeks(MAALT.oslo.counts, 64), 'sparsom')).toBe(6)
  })

  it('runder NED til et slider-steg', () => {
    for (const indeks of [30, 120, 255, 480, 915, 2000]) {
      const km = maxWidthKmFor(indeks, 'sparsom')
      expect(Math.round(km / BREDDE_STEG_KM) * BREDDE_STEG_KM).toBeCloseTo(km, 10)
    }
  })

  it('gir et lavere tak for portrett enn for kvadrat (samme bredde = mer areal)', () => {
    const indeks = tetthetsIndeks(MAALT.oslo.counts, 64)
    const kvadrat = maxWidthKmFor(indeks, 'sparsom', { aspect: 1 })
    const portrett = maxWidthKmFor(indeks, 'sparsom', { aspect: 2.2 })
    expect(portrett).toBeLessThan(kvadrat)
  })

  it('holder seg innenfor [minKm, maksKm] også ved absurd tetthet', () => {
    expect(maxWidthKmFor(1e9, 'sparsom')).toBe(1)
    expect(maxWidthKmFor(1e-9, 'full')).toBe(BREDDE_MAKS_KM)
  })

  it('gir maks bredde for ugyldig tetthet (aldri klamp på dårlige data)', () => {
    expect(maxWidthKmFor(0, 'sparsom')).toBe(BREDDE_MAKS_KM)
    expect(maxWidthKmFor(NaN, 'sparsom')).toBe(BREDDE_MAKS_KM)
    expect(maxWidthKmFor(-5, 'sparsom')).toBe(BREDDE_MAKS_KM)
  })
})

describe('kostnad', () => {
  it('skalerer med nivåfaktoren', () => {
    expect(kostnad(100, 10, 'full')).toBe(1000)
    expect(kostnad(100, 10, 'lett')).toBeCloseTo(1000 * NIVAA_FAKTOR.lett, 6)
    expect(kostnad(100, 10, 'sparsom')).toBeCloseTo(1000 * NIVAA_FAKTOR.sparsom, 6)
  })

  it('behandler ukjent nivå som full (ingen skjult rabatt)', () => {
    expect(kostnad(100, 10, 'finnes-ikke')).toBe(1000)
  })
})

describe('tetthetsBeslutning', () => {
  it('returnerer null uten sondering — kalleren skal da bygge som før', () => {
    expect(tetthetsBeslutning(null, { breddeKm: 8 })).toBeNull()
    expect(tetthetsBeslutning(undefined, { breddeKm: 8 })).toBeNull()
    expect(tetthetsBeslutning({}, { breddeKm: 8 })).toBeNull()
    expect(tetthetsBeslutning({ counts: {}, arealKm2: 64 }, { breddeKm: 8 })).toBeNull()
  })

  it('lar Vardåsen og Lierne stå UENDRET på 8 km (regresjonsvakten)', () => {
    for (const key of ['vardasen', 'lierne', 'asker']) {
      const b = tetthetsBeslutning(
        { counts: MAALT[key].counts, arealKm2: MAALT[key].areal, perKm2: 1 },
        { breddeKm: 8, aspect: 1 },
      )
      expect(b.detaljNivaa, key).toBe('full')
      expect(b.breddeJustert, key).toBe(false)
      expect(b.breddeKm, key).toBe(8)
    }
  })

  it('senker både detalj og bredde i Oslo på 8 km', () => {
    const b = tetthetsBeslutning(
      { counts: MAALT.oslo.counts, arealKm2: 64, perKm2: 1 },
      { breddeKm: 8, aspect: 1 },
    )
    expect(b.klasse).toBe('svært tett')
    expect(b.detaljNivaa).toBe('sparsom')
    expect(b.breddeJustert).toBe(true)
    expect(b.breddeKm).toBe(6)
    expect(b.breddeKm).toBeLessThan(8)
  })

  it('rører ikke et lite Oslo-kart', () => {
    const b = tetthetsBeslutning(
      { counts: MAALT.oslo.counts, arealKm2: 64, perKm2: 1 },
      { breddeKm: 2, aspect: 1 },
    )
    expect(b.detaljNivaa).toBe('full')
    expect(b.breddeJustert).toBe(false)
    expect(b.breddeKm).toBe(2)
  })

  it('velger bredden som faktisk holder budsjettet', () => {
    const b = tetthetsBeslutning(
      { counts: MAALT.oslo.counts, arealKm2: 64, perKm2: 1 },
      { breddeKm: 8, aspect: 1 },
    )
    const indeks = tetthetsIndeks(MAALT.oslo.counts, 64)
    expect(kostnad(indeks, b.breddeKm ** 2, b.detaljNivaa)).toBeLessThanOrEqual(KOSTNADSBUDSJETT)
  })
})

describe('separasjoner og dropp', () => {
  it('«full» er dagens verdier — endres de, endres alle eksisterende kart', () => {
    const s = separasjonerFor('full')
    expect(s.parkering).toBe(50)    // PARKERING_MIN_SEP_M
    expect(s.holdeplass).toBe(25)   // HOLDEPLASS_MIN_SEP_M
    expect(s.kulturminne).toBe(30)  // mapBuilder kulturminne-klynging
    expect(s.fredet).toBe(25)       // useHeritageLayers
    expect(s.bom).toBe(0)           // ingen uttynning i dag
    expect(s.bro).toBe(0)
  })

  it('faller til «full» for ukjent nivå', () => {
    expect(separasjonerFor('tullball')).toEqual(separasjonerFor('full'))
    expect(separasjonerFor(undefined)).toEqual(separasjonerFor('full'))
    expect(separasjonerFor(null)).toEqual(separasjonerFor('full'))
  })

  it('øker separasjonene monotont gjennom nivåene', () => {
    for (const key of ['parkering', 'holdeplass', 'kulturminne', 'fredet', 'bom', 'bro']) {
      const [f, l, s] = DETALJ_NIVAAER.map(n => separasjonerFor(n)[key])
      expect(l, key).toBeGreaterThanOrEqual(f)
      expect(s, key).toBeGreaterThanOrEqual(l)
    }
  })

  it('dropper ingenting på «full»', () => {
    for (const lag of ['kraftlinje', 'servicevei', 'hytte-navn', 'stedsnavn-minor', 'dybdepunkt']) {
      expect(erDroppet(lag, 'full'), lag).toBe(false)
    }
  })

  it('dropper støylagene på «sparsom»', () => {
    for (const lag of ['kraftlinje', 'servicevei', 'hytte-navn', 'stedsnavn-minor', 'dybdepunkt']) {
      expect(erDroppet(lag, 'sparsom'), lag).toBe(true)
    }
  })

  it('behandler ukjent nivå som full (dropper ingenting)', () => {
    expect(erDroppet('kraftlinje', 'tullball')).toBe(false)
    expect(erDroppet('kraftlinje', undefined)).toBe(false)
  })

  it('holder kontur-tall-taket på dagens 80 for full', () => {
    expect(konturTallTakFor('full')).toBe(80)
    expect(konturTallTakFor('tullball')).toBe(80)
    expect(konturTallTakFor('sparsom')).toBeLessThan(80)
  })
})

describe('tetthetsBegrunnelse', () => {
  it('sier at hele skalaen er greit når taket er maks', () => {
    expect(tetthetsBegrunnelse(4, 16)).toContain('hele skalaen')
    expect(tetthetsBegrunnelse(4, 16)).toContain('Åpent')
  })

  it('oppgir taket når det er lavere enn maks', () => {
    expect(tetthetsBegrunnelse(915, 6)).toBe('Svært tett område — anbefalt inntil 6 km')
  })

  it('bruker komma som desimalskilletegn (norsk)', () => {
    expect(tetthetsBegrunnelse(915, 6.5)).toContain('6,5 km')
  })
})
