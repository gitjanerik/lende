import { describe, it, expect } from 'vitest'
import {
  buildColophonSvg, withColophon, chooseScaleBar, formatDenom, formatDato,
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
    expect(bar.groundM).toBe(250)
    expect(bar.printMm).toBeCloseTo(25, 5)
    expect(bar.label).toBe('250 m')
  })

  it('skalerer opp med målestokken', () => {
    // 1:50 000 → 1 km = 20 mm papir.
    const bar = chooseScaleBar(50000, 20000)
    expect(bar.groundM).toBe(2000)
    expect(bar.label).toBe('2 km')
  })

  it('holder linjalen innenfor en tredjedel av kartbredden', () => {
    const widthM = 900
    const bar = chooseScaleBar(10000, widthM)
    expect(bar.printMm).toBeLessThanOrEqual((widthM * 1000 / 10000) / 3 + 1e-9)
  })

  it('gir alltid en lengde, også for absurd små kart', () => {
    expect(chooseScaleBar(10000, 50).groundM).toBeGreaterThan(0)
  })
})

describe('buildColophonSvg', () => {
  it('tar med linjal, målestokk, ekvidistanse, appnavn, kartnavn og dato', () => {
    const g = buildColophonSvg({
      widthM: 4000, heightM: 5000, scaleDenom: 10000,
      equidistance: 5, title: 'Vardåsen', generated: META.generated,
    })
    expect(g).toContain('data-kolofon="1"')
    expect(g).toContain('250 m')                       // linjal-etikett
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
    expect(x).toBeCloseTo(40, 3)                  // 4 mm margin ved 1:10 000 = 40 m
    expect(y + boxH).toBeCloseTo(5000 - 40, 3)    // bunnkant 4 mm over kartkanten
    expect(x + boxW).toBeLessThan(4000)           // stikker ikke ut til høyre
  })

  it('holder samme FYSISKE størrelse når målestokken endres', () => {
    const a = buildColophonSvg({ widthM: 4000, heightM: 4000, scaleDenom: 10000 })
    const b = buildColophonSvg({ widthM: 20000, heightM: 20000, scaleDenom: 50000 })
    const hOf = (g) => Number(/<rect [^>]*height="([\d.]+)"/.exec(g)[1])
    // Bruker-enheter er meter, så 5× målestokk = 5× meter for samme mm.
    expect(hOf(b) / hOf(a)).toBeCloseTo(5, 2)
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
