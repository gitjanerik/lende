import { describe, it, expect } from 'vitest'
import {
  buildColophonSvg, withColophon, chooseScaleBar, colophonScale,
  formatDenom, formatDato,
} from './mapColophon.js'

const META = { scaleDenom: 10000, equidistance: 5, generated: '2026-07-28T09:15:00.000Z' }
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 5000" width="400mm" height="500mm"><g id="kart"/></svg>'

describe('formatDenom', () => {
  it('grupperer med hardt mellomrom', () => {
    expect(formatDenom(10000)).toBe('10 000')
    expect(formatDenom(7500)).toBe('7 500')
    expect(formatDenom(500)).toBe('500')
    expect(formatDenom(1000000)).toBe('1 000 000')
  })
})

describe('formatDato', () => {
  it('formaterer som dd.mm.yyyy', () => {
    expect(formatDato('2026-07-28T09:15:00.000Z')).toMatch(/^\d{2}\.\d{2}\.2026$/)
  })
  it('tåler manglende og ugyldig dato', () => {
    expect(formatDato(null)).toBe('')
    expect(formatDato('bare tekst')).toBe('')
  })
})

describe('chooseScaleBar', () => {
  it('velger største runde lengde som holder seg innenfor print-vinduet', () => {
    const bar = chooseScaleBar(10000, 4000)
    expect(bar.groundM).toBe(500)
    expect(bar.printMm).toBeCloseTo(50, 5)
    expect(bar.label).toBe('500 m')
  })

  it('skalerer opp med målestokken', () => {
    // 1:50 000 → 1 km = 20 mm papir, og et 20 km kart får k=3 (vindu 60–180 mm).
    const bar = chooseScaleBar(50000, 20000, 3)
    expect(bar.groundM).toBe(5000)
    expect(bar.label).toBe('5 km')
  })

  it('holder linjalen innenfor en tredjedel av kartbredden', () => {
    const widthM = 900
    const bar = chooseScaleBar(10000, widthM)
    expect(bar.printMm).toBeLessThanOrEqual((widthM * 1000 / 10000) / 3 + 1e-9)
  })

  it('gir alltid en lengde, også for absurd små kart', () => {
    expect(chooseScaleBar(10000, 50).groundM).toBeGreaterThan(0)
  })

  it('velger en lengre linjal på et større ark', () => {
    const liten = chooseScaleBar(10000, 4000, colophonScale(4000))
    const stor = chooseScaleBar(10000, 10000, colophonScale(10000))
    expect(stor.groundM).toBeGreaterThan(liten.groundM)
  })
})

describe('colophonScale', () => {
  it('er 1 ved referanse-størrelsen og vokser lineært til taket', () => {
    expect(colophonScale(4000)).toBeCloseTo(1, 6)
    expect(colophonScale(2000)).toBe(1)          // aldri under 1
    expect(colophonScale(9200)).toBeCloseTo(2.3, 6)
    expect(colophonScale(12000)).toBe(3)
    expect(colophonScale(40000)).toBe(3)         // taket
    expect(colophonScale(undefined)).toBe(1)
  })
})

describe('buildColophonSvg', () => {
  it('tar med linjal, målestokk, ekvidistanse, appnavn, kartnavn og dato', () => {
    const g = buildColophonSvg({
      widthM: 4000, heightM: 5000, scaleDenom: 10000,
      equidistance: 5, title: 'Vardåsen', generated: META.generated,
    })
    expect(g).toContain('data-kolofon="1"')
    expect(g).toContain('500 m')                       // linjal-etikett
    expect(g).toContain('1:10 000')               // størrelsesforhold
    expect(g).toContain('Ekvidistanse 5 m')
    expect(g).toContain('Så i lende')
    expect(g).toContain('Vardåsen')
    expect(g).toMatch(/\d{2}\.\d{2}\.2026/)
  })

  it('plasseres nederst til venstre, innenfor kartet', () => {
    const g = buildColophonSvg({ widthM: 4000, heightM: 5000, scaleDenom: 10000, equidistance: 5 })
    const [x, y] = /transform="translate\(([-\d.]+) ([-\d.]+)\)"/.exec(g).slice(1).map(Number)
    const boxH = Number(/<rect [^>]*height="([\d.]+)"/.exec(g)[1])
    const boxW = Number(/<rect [^>]*width="([\d.]+)"/.exec(g)[1])
    expect(x).toBeCloseTo(50, 3)                  // 5 mm margin ved 1:10 000 = 50 m
    expect(y + boxH).toBeCloseTo(5000 - 50, 3)    // bunnkant 5 mm over kartkanten
    expect(x + boxW).toBeLessThan(4000)           // stikker ikke ut til høyre
  })

  it('LINJALEN måler en ekte bakke-avstand, uansett skalering', () => {
    // Selve streken kan aldri skaleres som dekor — den ER avstanden. 1 bruker-
    // enhet = 1 m, så strekens bredde må være nøyaktig groundM.
    for (const widthM of [2000, 4000, 9200, 20000]) {
      const g = buildColophonSvg({ widthM, heightM: widthM, scaleDenom: 10000 })
      const bar = chooseScaleBar(10000, widthM, colophonScale(widthM))
      const line = /<g stroke[^>]*>\s*<line x1="([\d.]+)"[^>]*x2="([\d.]+)"/.exec(g)
      expect(Number(line[2]) - Number(line[1])).toBeCloseTo(bar.groundM, 2)
    }
  })

  it('holder samme FYSISKE størrelse når bare målestokken endres', () => {
    // Samme kart-bredde i meter → samme k, så boksen er identisk i mm og
    // skalerer bare med meter-pr-mm (5× nevner = 5× bruker-enheter).
    const a = buildColophonSvg({ widthM: 4000, heightM: 4000, scaleDenom: 10000 })
    const b = buildColophonSvg({ widthM: 4000, heightM: 4000, scaleDenom: 50000 })
    const hOf = (g) => Number(/<rect [^>]*height="([\d.]+)"/.exec(g)[1])
    expect(hOf(b) / hOf(a)).toBeCloseTo(5, 2)
  })

  it('holder omtrent samme ANDEL av arket når kartet blir større', () => {
    // Kjernen i v2.4.21: med faste print-mm ble kolofonen en flekk på et 10 km
    // kart. Boksens andel av kartbredden skal være omtrent konstant fra
    // referanse-størrelsen opp til taket.
    const frac = (widthM) => {
      const g = buildColophonSvg({ widthM, heightM: widthM, scaleDenom: 10000 })
      return Number(/<rect [^>]*width="([\d.]+)"/.exec(g)[1]) / widthM
    }
    const f4 = frac(4000), f9 = frac(9200), f12 = frac(12000)
    expect(f9 / f4).toBeGreaterThan(0.8)
    expect(f9 / f4).toBeLessThan(1.25)
    expect(f12 / f4).toBeGreaterThan(0.8)
    expect(f12 / f4).toBeLessThan(1.25)
  })

  it('lar aldri boksen sluke et lite ark', () => {
    for (const widthM of [800, 1500, 2500]) {
      const g = buildColophonSvg({ widthM, heightM: widthM, scaleDenom: 10000 })
      const boxW = Number(/<rect [^>]*width="([\d.]+)"/.exec(g)[1])
      expect(boxW / widthM).toBeLessThanOrEqual(0.46)
    }
  })

  it('utelater ekvidistanse-leddet når kartet mangler høydekurver', () => {
    const g = buildColophonSvg({ widthM: 4000, heightM: 4000, scaleDenom: 10000, equidistance: null })
    expect(g).toContain('1:10 000')
    expect(g).not.toContain('Ekvidistanse')
  })

  it('escaper kartnavn med XML-tegn', () => {
    const g = buildColophonSvg({
      widthM: 4000, heightM: 4000, scaleDenom: 10000, title: 'Sør & <Nord>',
    })
    expect(g).toContain('Sør &amp; &lt;Nord&gt;')
    expect(g).not.toContain('<Nord>')
  })

  it('returnerer tom streng uten geometri', () => {
    expect(buildColophonSvg({})).toBe('')
    expect(buildColophonSvg({ widthM: 0, heightM: 100, scaleDenom: 10000 })).toBe('')
    expect(buildColophonSvg({ widthM: 100, heightM: 100, scaleDenom: 0 })).toBe('')
  })
})

describe('withColophon', () => {
  it('limer kolofonen inn rett før siste </svg>', () => {
    const out = withColophon(SVG, { meta: META, title: 'Vardåsen' })
    expect(out.indexOf('data-kolofon')).toBeGreaterThan(out.indexOf('<g id="kart"/>'))
    expect(out.endsWith('</svg>')).toBe(true)
    expect(out.match(/<\/svg>/g)).toHaveLength(1)
  })

  it('legger seg etter nestede svg-viewporter (detalj-inset)', () => {
    const nested = '<svg viewBox="0 0 4000 5000"><svg id="inset" viewBox="0 0 10 10"></svg></svg>'
    const out = withColophon(nested, { meta: META })
    expect(out.indexOf('data-kolofon')).toBeGreaterThan(out.indexOf('id="inset"'))
    expect(out.endsWith('</svg>')).toBe(true)
  })

  it('leser geometrien fra viewBox', () => {
    const out = withColophon(SVG, { meta: META })
    const y = Number(/transform="translate\([-\d.]+ ([-\d.]+)\)"/.exec(out)[1])
    expect(y).toBeGreaterThan(4000)   // nær bunnen av et 5000 m høyt kart
    expect(y).toBeLessThan(5000)
  })

  it('lar markupen være i fred når viewBox mangler eller er ugyldig', () => {
    expect(withColophon('<svg></svg>', { meta: META })).toBe('<svg></svg>')
    expect(withColophon('<svg viewBox="0 0 0 0"></svg>', { meta: META }))
      .toBe('<svg viewBox="0 0 0 0"></svg>')
    expect(withColophon('', { meta: META })).toBe('')
  })

  it('daterer arket med eksport-tidspunktet når meta.generated mangler', () => {
    // De innebygde kartene (public/maps/*.svg) har ingen generated i meta.
    const out = withColophon(SVG, {
      meta: { scaleDenom: 10000, equidistance: 5 },
      title: 'Vardåsen',
      now: '2026-07-28T22:00:00.000Z',
    })
    expect(out).toMatch(/Vardåsen\s+·\s+\d{2}\.\d{2}\.2026/)
  })

  it('foretrekker meta.generated framfor eksport-tidspunktet', () => {
    const out = withColophon(SVG, {
      meta: { scaleDenom: 10000, generated: '2024-05-04T10:00:00.000Z' },
      now: '2026-07-28T22:00:00.000Z',
    })
    expect(out).toContain('.2024')
    expect(out).not.toContain('.2026')
  })

  it('faller tilbake til 1:10 000 når meta mangler', () => {
    const out = withColophon(SVG, {})
    expect(out).toContain('1:10 000')
  })
})
