import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  analyserStinett, formatStinettSvar, minKomponentM, stinettFeaturesFromSvgEl,
  fjernIsolerteStumper,
  STI_KODER, KOBLER_KODER,
} from './stinettAnalyse.js'

// Fixtures i SVG-meter. Koordinatene holdes godt fra hverandre (>> snapM/
// bridgeM) der komponentene IKKE skal henge sammen.

const sti = (coords, code = '505') => ({ coordinates: coords, isomCode: code })

describe('minKomponentM', () => {
  it('gir gulvet 300 m ved lav tetthet', () => {
    expect(minKomponentM(0.5, 1)).toBe(300)
    expect(minKomponentM(1, 1)).toBe(300)
    expect(minKomponentM(2, 10)).toBe(300)
  })
  it('skalerer med kvadratrot av tettheten', () => {
    expect(minKomponentM(2.25, 1)).toBeCloseTo(450)
  })
  it('klemmes til 500 m i myldrenett (2 km-taket kuttet for mye ekte sti)', () => {
    expect(minKomponentM(4, 1)).toBe(500)
    expect(minKomponentM(100, 1)).toBe(500)
  })
})

describe('analyserStinett — sum og komponenter', () => {
  it('summerer to frakoblede komponenter, hver kant én gang', () => {
    const res = analyserStinett([
      sti([[0, 0], [1000, 0]]),
      sti([[0, 5000], [2000, 5000]]),
    ], { arealKm2: 25 })
    expect(res.stinett.totalStiM).toBeCloseTo(3000, 0)
    expect(res.stinett.inkluderteKomponenter).toBe(2)
    expect(res.stinett.ekskluderteKomponenter).toBe(0)
    expect(res.stinett.arealKm2).toBe(25)
  })

  it('ekskluderer kort isolert stump', () => {
    const res = analyserStinett([
      sti([[0, 0], [1000, 0]]),
      sti([[0, 5000], [150, 5000]]),
    ], { arealKm2: 25 })
    expect(res.stinett.totalStiM).toBeCloseTo(1000, 0)
    expect(res.stinett.ekskluderteKomponenter).toBe(1)
    expect(res.stinett.ekskludertM).toBeCloseTo(150, 0)
  })

  it('teller skogsbilvei (504) som sti, men aldri småveg (503)', () => {
    const res = analyserStinett([
      sti([[0, 0], [1000, 0]], '504'),
      sti([[0, 5000], [1000, 5000]], '503'),
    ], { arealKm2: 25 })
    expect(res.stinett.totalStiM).toBeCloseTo(1000, 0)
    expect(res.stinett.inkluderteKomponenter).toBe(1)
  })
})

describe('analyserStinett — bindeledd-fletting', () => {
  const toStierMedKobler = (koblerLengde) => [
    sti([[0, 0], [1000, 0]]),
    sti([[1000, 0], [1000 + koblerLengde, 0]], '503'),
    sti([[1000 + koblerLengde, 0], [2000 + koblerLengde, 0]]),
  ]

  it('fletter komponenter via kort småveg-strekk (≤ maksKoblerM)', () => {
    const res = analyserStinett(toStierMedKobler(250), { arealKm2: 25 })
    expect(res.stinett.inkluderteKomponenter).toBe(1)
    expect(res.stinett.totalStiM).toBeCloseTo(2000, 0)
    expect(res.stinett.koblerM).toBeCloseTo(250, 0)
    // Koblermeter teller i vandringen, ikke i sti-summen.
    expect(res.lengsteVandringM).toBeCloseTo(2250, 0)
  })

  it('fletter IKKE via langt småveg-strekk (> maksKoblerM)', () => {
    const res = analyserStinett(toStierMedKobler(400), { arealKm2: 25 })
    expect(res.stinett.inkluderteKomponenter).toBe(2)
    expect(res.stinett.totalStiM).toBeCloseTo(2000, 0)
    expect(res.stinett.koblerM).toBe(0)
    expect(res.lengsteVandringM).toBeCloseTo(1000, 0)
  })
})

describe('analyserStinett — lengste vandring og turer', () => {
  it('finner diameteren i en Y-graf (lengste arm-til-arm)', () => {
    const res = analyserStinett([
      sti([[0, 0], [1000, 0]]),
      sti([[0, 0], [-2000, 0]]),
      sti([[0, 0], [0, 3000]]),
    ], { arealKm2: 36 })
    expect(res.lengsteVandringM).toBeCloseTo(5000, 0)
    const abTurer = res.turer.filter((t) => t.type === 'AtilB')
    expect(abTurer).toHaveLength(1)
    expect(abTurer[0].lengdeM).toBeCloseTo(5000, 0)
    // Endepunktene er de to fjerneste armspissene.
    const ender = [abTurer[0].startXY, abTurer[0].sluttXY].map((p) => p.join(','))
    expect(ender).toContain('-2000,0')
    expect(ender).toContain('0,3000')
  })

  it('finner rundtur-kandidat i en løkke ≥ minTurM', () => {
    const res = analyserStinett([
      sti([[0, 0], [600, 0], [600, 600], [0, 600], [0, 0]]),
    ], { arealKm2: 1 })
    const runder = res.turer.filter((t) => t.type === 'rundtur')
    expect(runder).toHaveLength(1)
    expect(runder[0].lengdeM).toBeCloseTo(2400, 0)
    // Sløyfen er lukket: første og siste koordinat er like.
    const c = runder[0].coordinates
    expect(c[0]).toEqual(c[c.length - 1])
  })

  it('gir 0 treff når alt er under minstekravet', () => {
    const res = analyserStinett([
      sti([[0, 0], [400, 0], [400, 400], [0, 400], [0, 0]]),
    ], { arealKm2: 1, minTurM: 2000 })
    expect(res.turer).toHaveLength(0)
    // Nettet telles fortsatt i summen — det er TURER minTurM gjelder.
    expect(res.stinett.totalStiM).toBeCloseTo(1600, 0)
  })

  it('tomt stinett gir tom, ærlig analyse — og standard minTurM er 500', () => {
    const res = analyserStinett([], { arealKm2: 4 })
    expect(res.stinett.totalStiM).toBe(0)
    expect(res.lengsteVandringM).toBe(0)
    expect(res.turer).toHaveLength(0)
    expect(res.minTurM).toBe(500)
  })
})

describe('analyserStinett — stigning fra DEM', () => {
  // Rampe: høyde = x/10 (10 % jevn stigning østover), 10 m-celler.
  const rampeDem = () => {
    const cols = 130, rows = 80
    const data = new Float32Array(cols * rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) data[r * cols + c] = c
    }
    return { data, cols, rows, transform: { originX: 0, originY: 0, pixelWidth: 10, pixelHeight: 10 }, noData: -9999 }
  }

  it('beregner stigning, fall og bratteste/slakeste parti', () => {
    const res = analyserStinett([sti([[0, 500], [1000, 500]])], {
      arealKm2: 1, minTurM: 500, dem: rampeDem(),
    })
    const tur = res.turer[0]
    // Diameterstien kan gå begge veier langs rampa — summen av stigning og
    // fall er uansett ~100 m, og alt ligger i én retning.
    expect(tur.stigningM + tur.fallM).toBeGreaterThan(85)
    expect(tur.stigningM + tur.fallM).toBeLessThan(105)
    expect(Math.min(tur.stigningM, tur.fallM)).toBeLessThan(10)
    expect(tur.brattesteSegmentPst).toBeGreaterThanOrEqual(8)
    expect(tur.brattesteSegmentPst).toBeLessThanOrEqual(12)
    expect(tur.slakesteSegmentPst).toBeLessThanOrEqual(tur.brattesteSegmentPst)
  })

  it('utelater stigningsfelter uten DEM', () => {
    const res = analyserStinett([sti([[0, 500], [1000, 500]])], {
      arealKm2: 1, minTurM: 500, dem: null,
    })
    expect(res.turer[0].stigningM).toBeUndefined()
  })
})

describe('formatStinettSvar', () => {
  const analyse = {
    stinett: {
      totalStiM: 27431, koblerM: 940, inkluderteKomponenter: 3,
      ekskluderteKomponenter: 11, ekskludertM: 1810, minKomponentM: 400,
      tetthetKmPerKm2: 1.71,
    },
    lengsteVandringM: 9210,
    turer: [
      {
        type: 'AtilB', lengdeM: 9210,
        coordinates: [[0, 0], [9210, 0]],
        startXY: [0, 0], sluttXY: [9210, 0], viaXY: [4605, 0],
        stigningM: 310, fallM: 295, brattesteSegmentPst: 18, slakesteSegmentPst: 1,
      },
      {
        type: 'rundtur', lengdeM: 4120,
        coordinates: [[0, 0], [1000, 0], [0, 0]],
        startXY: [0, 0], sluttXY: [0, 0], viaXY: [1000, 0],
        stigningM: 120, fallM: 120, brattesteSegmentPst: 9, slakesteSegmentPst: 0,
      },
    ],
  }
  const toWgs84 = (x, y) => ({ lat: 67 + y / 111000, lon: 12 + x / 45000 })

  it('produserer kompakt norsk JSON med hand-off-koordinater', () => {
    const svar = formatStinettSvar(analyse, { toWgs84 })
    expect(svar.stinett.totalStiKm).toBe(27.4)
    expect(svar.stinett.koblerKm).toBe(0.9)
    expect(svar.lengsteVandringKm).toBe(9.2)
    expect(svar.treff).toBe(2)

    const [t1, r1] = svar.turer
    expect(t1.id).toBe('T1')
    expect(t1.navn).toContain('Lengste stitur')
    expect(t1.lengdeKm).toBe(9.2)
    expect(t1.start).toEqual({ lat: 67, lon: 12 })
    expect(t1.slutt.lon).toBeCloseTo(12.2047, 4)
    expect(t1.via).toBeDefined()
    expect(t1.estimertGangtidMin).toBeGreaterThan(100)

    expect(r1.id).toBe('R1')
    expect(r1.origo).toEqual({ lat: 67, lon: 12 })
    expect(r1.via).toBeDefined()
    expect(r1.start).toBeUndefined()
  })

  it('fyller høydepunkter på tvers av turene', () => {
    const svar = formatStinettSvar(analyse, { toWgs84 })
    expect(svar.hoydepunkter.mestStigning).toBe('T1')
    expect(svar.hoydepunkter.minstStigning).toBe('R1')
    expect(svar.hoydepunkter.brattesteSegment).toEqual({ tur: 'T1', prosent: 18 })
    expect(svar.hoydepunkter.slakesteSegment).toEqual({ tur: 'R1', prosent: 9 })
  })

  it('runder ned til nærmeste tier over 30 km og leverer totalStiTekst', () => {
    const svar = formatStinettSvar({
      stinett: {
        totalStiM: 414712, koblerM: 2300, inkluderteKomponenter: 18,
        ekskluderteKomponenter: 130, ekskludertM: 12495, minKomponentM: 500,
        tetthetKmPerKm2: 3.65, arealKm2: 105.3,
      },
      lengsteVandringM: 11522,
      minTurM: 500,
      turer: [],
    }, { toWgs84 })
    expect(svar.stinett.totalStiKm).toBe(410)
    expect(svar.totalStiTekst).toBe('mer enn 410 km')
    expect(svar.stinett.arealKm2).toBe(105.3)
    expect(svar.merknad).toContain('totalStiTekst')
  })

  it('beholder én desimal under 30 km, uten totalStiTekst', () => {
    const svar = formatStinettSvar(analyse, { toWgs84 })
    expect(svar.stinett.totalStiKm).toBe(27.4)
    expect(svar.totalStiTekst).toBeUndefined()
  })

  it('takler 0 treff og manglende stigning', () => {
    const svar = formatStinettSvar({
      stinett: {
        totalStiM: 900, koblerM: 0, inkluderteKomponenter: 1,
        ekskluderteKomponenter: 2, ekskludertM: 250, minKomponentM: 300,
        tetthetKmPerKm2: 0.2,
      },
      lengsteVandringM: 900,
      turer: [],
    }, { toWgs84 })
    expect(svar.treff).toBe(0)
    expect(svar.turer).toEqual([])
    expect(svar.hoydepunkter).toBeUndefined()
    expect(svar.merknad).toContain('minstekravet')
  })
})

describe('stinettFeaturesFromSvgEl', () => {
  it('leser sti- og bindeledd-geometri, hopper over store veier', () => {
    const { document } = parseHTML(`<html><body><svg viewBox="0 0 2000 2000">
      <g data-layer="roads" data-iso="505"><path d="M0,0L1000,0M0,100L500,100"/></g>
      <g data-layer="roads" data-iso="503"><path d="M1000,0L1200,0"/></g>
      <g data-layer="roads" data-iso="502"><path d="M0,200L1000,200"/></g>
      <g data-layer="contours" data-iso="101"><path d="M0,300L1000,300"/></g>
    </svg></body></html>`)
    const features = stinettFeaturesFromSvgEl(document.querySelector('svg'))
    expect(features).toHaveLength(3)
    expect(features.filter((f) => f.isomCode === '505')).toHaveLength(2)
    expect(features.filter((f) => f.isomCode === '503')).toHaveLength(1)
    expect(features.every((f) => f.coordinates.length >= 2)).toBe(true)
  })

  it('kodesettene er disjunkte', () => {
    for (const kode of STI_KODER) expect(KOBLER_KODER.has(kode)).toBe(false)
  })
})

describe('stinettFeaturesFromSvgEl — hoppOverSkjulte', () => {
  // Lag slås av ved å sette inline display:none på [data-layer]-gruppa
  // (applyLayerVisibility). 3D-visningen skal vise samme stinett som kartet:
  // har brukeren skjult veier, skal ikke 3D tegne dem likevel (v5.3.1).
  const svgOf = (inner) => {
    const { document } = parseHTML(
      `<html><body><svg xmlns="http://www.w3.org/2000/svg">${inner}</svg></body></html>`)
    return document.querySelector('svg')
  }
  const markup = `
    <g data-layer="sti"><g data-iso="505"><path d="M0,0 L100,0"/></g></g>
    <g data-layer="vei-liten" style="display: none"><g data-iso="503"><path d="M0,50 L100,50"/></g></g>
    <g data-layer="vei-skogsbil"><g data-iso="504"><path d="M0,90 L100,90"/></g></g>`

  it('tar med alt som default — analysen skal se hele nettet', () => {
    const koder = stinettFeaturesFromSvgEl(svgOf(markup)).map(f => f.isomCode)
    expect(koder.sort()).toEqual(['503', '504', '505'])
  })

  it('utelater skjulte lag når det er bedt om', () => {
    const koder = stinettFeaturesFromSvgEl(svgOf(markup), null, { hoppOverSkjulte: true })
      .map(f => f.isomCode)
    expect(koder.sort()).toEqual(['504', '505'])
  })

  it('finner display:none lenger opp i kjeden', () => {
    const nestet = `
      <g data-layer="vei-liten" style="display: none">
        <g><g data-iso="503"><path d="M0,0 L100,0"/></g></g>
      </g>`
    expect(stinettFeaturesFromSvgEl(svgOf(nestet), null, { hoppOverSkjulte: true })).toEqual([])
    expect(stinettFeaturesFromSvgEl(svgOf(nestet))).toHaveLength(1)
  })

  it('lar synlige lag være i fred selv med hoppOverSkjulte', () => {
    const synlig = `<g data-layer="sti" style="display: inline"><g data-iso="505"><path d="M0,0 L100,0"/></g></g>`
    expect(stinettFeaturesFromSvgEl(svgOf(synlig), null, { hoppOverSkjulte: true })).toHaveLength(1)
  })
})

describe('fjernIsolerteStumper', () => {
  const linje = (coords, isomCode = '505') => ({ coordinates: coords, isomCode })
  // Lang hovedsti: 1200 m østover.
  const hovedsti = linje([[0, 0], [600, 0], [1200, 0]])

  it('fjerner en kort, isolert stump', () => {
    const isolert = linje([[0, 5000], [200, 5000]])          // 200 m, langt unna
    const ut = fjernIsolerteStumper([hovedsti, isolert], { minKomponentM: 500 })
    expect(ut).toHaveLength(1)
    expect(ut[0]).toBe(hovedsti)
  })

  it('beholder en kort stump som går inn i en lang sti', () => {
    // 80 m sidegren fra midten av hovedstien — komponenten blir 1280 m.
    const sidegren = linje([[600, 0], [600, 80]])
    const ut = fjernIsolerteStumper([hovedsti, sidegren], { minKomponentM: 500 })
    expect(ut).toHaveLength(2)
  })

  it('beholder en stump som ender NÆR en lang sti (T-kryss etter forenkling)', () => {
    // Endepunktet ligger 8 m fra hovedstien — dangle-broingen kobler den.
    const nesten = linje([[600, 8], [600, 120]])
    const ut = fjernIsolerteStumper([hovedsti, nesten], { minKomponentM: 500 })
    expect(ut).toHaveLength(2)
  })

  it('fjerner flere isolerte fragmenter, men beholder hele hovednettet', () => {
    const fragmenter = [
      linje([[0, 3000], [150, 3000]]),
      linje([[0, 4000], [300, 4000]]),
      linje([[2000, 2000], [2100, 2000]]),
    ]
    const sidegren = linje([[1200, 0], [1200, 200]])
    const ut = fjernIsolerteStumper([hovedsti, sidegren, ...fragmenter], { minKomponentM: 500 })
    expect(ut).toHaveLength(2)
    expect(ut).toContain(hovedsti)
    expect(ut).toContain(sidegren)
  })

  it('beholder et isolert fragment som er langt nok i seg selv', () => {
    const eget = linje([[0, 9000], [700, 9000]])   // 700 m, isolert men lang
    const ut = fjernIsolerteStumper([hovedsti, eget], { minKomponentM: 500 })
    expect(ut).toHaveLength(2)
  })

  it('summerer komponenten — mange korte strekk som henger sammen består', () => {
    const kjede = []
    for (let i = 0; i < 8; i++) kjede.push(linje([[i * 100, 7000], [(i + 1) * 100, 7000]]))
    const ut = fjernIsolerteStumper(kjede, { minKomponentM: 500 })
    expect(ut).toHaveLength(8)   // 800 m til sammen
  })

  it('tåler tomt og degenerert input', () => {
    expect(fjernIsolerteStumper([])).toEqual([])
    expect(fjernIsolerteStumper(null)).toEqual([])
    expect(fjernIsolerteStumper([linje([[0, 0]])])).toEqual([])
    // minKomponentM 0 = filtrering av
    const alle = [hovedsti, linje([[0, 5000], [50, 5000]])]
    expect(fjernIsolerteStumper(alle, { minKomponentM: 0 })).toHaveLength(2)
  })
})
