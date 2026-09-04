import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { naermesteMarkor, MARKOR_TREFF_PX } from './markorTreff.js'

describe('naermesteMarkor', () => {
  it('gir 44 px trefflate — 22 px radius', () => {
    expect(MARKOR_TREFF_PX).toBe(22)
  })

  it('treffer en markør man bommet på med 20 px', () => {
    const km = { x: 100, y: 100, id: 'km' }
    expect(naermesteMarkor(100, 120, [km])).toBe(km)
  })

  it('slipper en markør utenfor terskelen', () => {
    expect(naermesteMarkor(100, 130, [{ x: 100, y: 100 }])).toBe(null)
  })

  it('måler radielt og ikke i en firkant — hjørnet er utenfor', () => {
    // 20 px i hver akse er 28,3 px unna, altså utenfor sirkelen selv om begge
    // aksene hver for seg er innenfor. En firkantet flate ville tatt den.
    expect(naermesteMarkor(120, 120, [{ x: 100, y: 100 }])).toBe(null)
  })

  it('velger den nærmeste av flere', () => {
    const naer = { x: 105, y: 100, id: 'naer' }
    const fjern = { x: 118, y: 100, id: 'fjern' }
    expect(naermesteMarkor(100, 100, [fjern, naer])).toBe(naer)
  })

  it('ved uavgjort vinner den første — DOM-rekkefølge er tegne-rekkefølge', () => {
    const under = { x: 110, y: 100, id: 'under' }
    const over = { x: 110, y: 100, id: 'over' }
    expect(naermesteMarkor(100, 100, [under, over])).toBe(under)
  })

  it('hopper over kandidater uten endelige koordinater', () => {
    const ok = { x: 100, y: 100, id: 'ok' }
    const rar = { x: NaN, y: 100, id: 'rar' }
    expect(naermesteMarkor(100, 100, [rar, ok])).toBe(ok)
    expect(naermesteMarkor(100, 100, [rar])).toBe(null)
  })

  it('tåler tom, manglende og ugyldig inndata', () => {
    expect(naermesteMarkor(0, 0, [])).toBe(null)
    expect(naermesteMarkor(0, 0, null)).toBe(null)
    expect(naermesteMarkor(0, 0, undefined)).toBe(null)
    expect(naermesteMarkor(NaN, 0, [{ x: 0, y: 0 }])).toBe(null)
  })

  it('respekterer en egen terskel', () => {
    const m = { x: 100, y: 100 }
    expect(naermesteMarkor(100, 130, [m], 34)).toBe(m)
    expect(naermesteMarkor(100, 130, [m], 10)).toBe(null)
  })
})

/**
 * KOBLINGEN I MapView, målt på KILDEN.
 *
 * Regelen over er ren og testbar; kallstedet er det ikke — prosjektet kan ikke
 * enhetsteste en Vue-komponent (se «Arkitektur-gjeld» i CLAUDE.md), og MapView
 * er dessuten fila der et kall lettest forsvinner stille. Samme grep som
 * `swCacheRydding.test.js` og `himmelTreff.test.js`: les kilden og hold fast de
 * invariantene som ikke kan feile på noen annen synlig måte.
 */
describe('MapView-koblingen', () => {
  const kilde = readFileSync(
    new URL('../views/MapView.vue', import.meta.url), 'utf-8')

  it('slår opp den nærmeste markøren når figuren ble bommet', () => {
    expect(kilde).toContain("import { naermesteMarkor } from '../lib/markorTreff.js'")
    expect(kilde).toContain('const naer = markorNaerTapp(e.clientX, e.clientY)')
  })

  it('dekker alle tre markørtypene, ellers åpner et nærtreff feil panel', () => {
    for (const attr of ['data-kulturminne-id', 'data-fredet-id', 'data-hydro-station-id']) {
      expect(kilde).toContain(`[${attr}]`)
      expect(kilde).toContain(`naer?.hasAttribute('${attr}')`)
    }
  })

  it('står bak samme port som de eksakte treffene', () => {
    // Nærtreffet må ikke kunne stjele et tapp fra måling, annotering eller
    // Stifinneren. Porten er den samme linja de tre eksakte treffene står bak,
    // så nærtreffet MÅ komme etter den og før blokka lukkes.
    const port = kilde.indexOf(
      'if (!measureMode.value && !annot.isAnnotateMode.value && !sti.blocking.value) {')
    const naer = kilde.indexOf('const naer = markorNaerTapp(')
    const eksakt = kilde.indexOf("e.target?.closest?.('[data-kulturminne-id]')")
    expect(port).toBeGreaterThan(-1)
    expect(naer).toBeGreaterThan(port)
    // Og etter de eksakte treffene: en figur man traff skal aldri tape mot en
    // nabo som tilfeldigvis ligger nærmere sentrum av trefflata.
    expect(naer).toBeGreaterThan(eksakt)
  })
})
