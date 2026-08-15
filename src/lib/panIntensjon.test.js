import { describe, it, expect } from 'vitest'
import {
  DODSONE_FRAC, KONUS_GRADER, MODEN_DRAG_FRAC, MAKS_PAUSE_MS,
  oktantFraDelta, nyIntensjon, oppdaterIntensjon,
} from './panIntensjon.js'

// Samme rekkefølge som EDGE_DIRS i useMapExtend — oktanten SKAL kunne brukes
// som indeks der, uten oversettelse.
const EDGE_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
// Flisbredden er UTLEDET av terskelen, ikke omvendt: prøvene under er skrevet i
// runde meter rundt en moden-terskel på 400 m, og de skal fortsette å bety det
// samme selv om MODEN_DRAG_FRAC justeres (det skjedde i v5.19.1). Ville vi
// hardkodet bredden, ville hver terskeljustering krevd en manuell omskriving av
// tjue fixtures — og da er det fixturene som blir testet, ikke logikken.
const MODEN = 400
const CFG = { flisBreddeM: MODEN / MODEN_DRAG_FRAC, flisHoydeM: 1400 }
const DODSONE = DODSONE_FRAC * CFG.flisBreddeM

describe('oktantFraDelta — tabellen som må matche EDGE_DIRS', () => {
  // SVG-y vokser NEDOVER: nord er negativ dy.
  const tabell = [
    ['N', 0, -100, 0],
    ['NE', 100, -100, 1],
    ['E', 100, 0, 2],
    ['SE', 100, 100, 3],
    ['S', 0, 100, 4],
    ['SW', -100, 100, 5],
    ['W', -100, 0, 6],
    ['NW', -100, -100, 7],
  ]
  for (const [navn, dx, dy, okt] of tabell) {
    it(`${navn} → oktant ${okt} (EDGE_DIRS[${okt}] = ${EDGE_DIRS[okt]})`, () => {
      expect(oktantFraDelta(dx, dy, DODSONE)).toBe(okt)
      expect(EDGE_DIRS[oktantFraDelta(dx, dy, DODSONE)]).toBe(navn)
    })
  }

  it('nord er negativ dy, ikke positiv', () => {
    expect(EDGE_DIRS[oktantFraDelta(0, -100, 0)]).toBe('N')
    expect(EDGE_DIRS[oktantFraDelta(0, 100, 0)]).toBe('S')
  })

  it('grensene runder med klokka: nøyaktig 22,5° er NØ', () => {
    const r = 22.5 * Math.PI / 180
    expect(oktantFraDelta(Math.sin(r) * 100, -Math.cos(r) * 100, 0)).toBe(1)
  })
  it('nøyaktig 337,5° faller tilbake til N (ingen oktant 8)', () => {
    const r = 337.5 * Math.PI / 180
    expect(oktantFraDelta(Math.sin(r) * 100, -Math.cos(r) * 100, 0)).toBe(0)
  })
  it('like under grensa blir værende i N', () => {
    const r = 22.4 * Math.PI / 180
    expect(oktantFraDelta(Math.sin(r) * 100, -Math.cos(r) * 100, 0)).toBe(0)
  })

  it('under dødsonen → null', () => {
    expect(oktantFraDelta(DODSONE - 1, 0, DODSONE)).toBe(null)
    expect(oktantFraDelta(DODSONE + 1, 0, DODSONE)).toBe(0 + 2)
  })
  it('null-bevegelse og ugyldige tall → null', () => {
    expect(oktantFraDelta(0, 0, 0)).toBe(null)
    expect(oktantFraDelta(NaN, 0, 0)).toBe(null)
    expect(oktantFraDelta(1, undefined, 0)).toBe(null)
  })
})

// Kjør en serie prøver gjennom maskinen og samle hendelsene.
function kjor(prover, cfg = CFG) {
  let s = nyIntensjon()
  const hendelser = []
  for (const p of prover) {
    const { neste, hendelse } = oppdaterIntensjon(s, p, cfg)
    hendelser.push(hendelse)
    s = neste
  }
  return { state: s, hendelser }
}

describe('oppdaterIntensjon — dødsone og forankring', () => {
  it('første prøve gir bare anker, ingen hendelse', () => {
    const { hendelser, state } = kjor([{ x: 0, y: 0, t: 0 }])
    expect(hendelser).toEqual(['ingen'])
    expect(state.oktant).toBe(null)
    expect(state.akkumulert).toBe(0)
  })
  it('bevegelse under dødsonen teller ikke', () => {
    const { state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: DODSONE - 1, y: 0, t: 100 },
    ])
    expect(state.akkumulert).toBe(0)
    expect(state.oktant).toBe(null)
  })
  it('ankeret står stille under dødsonen, så små steg summerer seg opp', () => {
    // Ti steg à 10 m østover — hvert enkelt under dødsonen (20 m), men annethvert
    // par krysser den og teller.
    const prover = [{ x: 0, y: 0, t: 0 }]
    for (let i = 1; i <= 10; i++) prover.push({ x: i * 10, y: 0, t: i * 100 })
    const { state } = kjor(prover)
    expect(state.oktant).toBe(2)
    expect(state.akkumulert).toBeGreaterThanOrEqual(80)
  })
  it('muterer ikke tilstanden som ble sendt inn', () => {
    const s = nyIntensjon()
    const kopi = { ...s }
    oppdaterIntensjon(s, { x: 100, y: 0, t: 0 }, CFG)
    expect(s).toEqual(kopi)
  })
  it('uten flisbredde skjer ingenting', () => {
    const { hendelser } = kjor([{ x: 0, y: 0, t: 0 }, { x: 900, y: 0, t: 10 }], {})
    expect(hendelser).toEqual(['ingen', 'ingen'])
  })
})

describe('oppdaterIntensjon — modning', () => {
  it('like under moden-terskelen er ikke moden, like over er', () => {
    const under = kjor([
      { x: 0, y: 0, t: 0 },
      { x: MODEN - 10, y: 0, t: 200 },
    ])
    expect(under.hendelser).toEqual(['ingen', 'ingen'])
    expect(under.state.moden).toBe(false)

    const over = kjor([
      { x: 0, y: 0, t: 0 },
      { x: MODEN + 10, y: 0, t: 200 },
    ])
    expect(over.hendelser).toEqual(['ingen', 'moden'])
    expect(over.state.moden).toBe(true)
    expect(EDGE_DIRS[over.state.oktant]).toBe('E')
  })

  it('«moden» fyrer ÉN gang, uansett hvor lenge man drar videre', () => {
    const prover = [{ x: 0, y: 0, t: 0 }]
    for (let i = 1; i <= 10; i++) prover.push({ x: i * 100, y: 0, t: i * 200 })
    const { hendelser } = kjor(prover)
    expect(hendelser.filter(h => h === 'moden')).toHaveLength(1)
    // Den fyrer i det akkumulert passerer 400 m, altså på prøven ved x = 400.
    expect(hendelser.indexOf('moden')).toBe(4)
  })

  it('akkumulering i samme oktant over flere steg modnes', () => {
    const { hendelser } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -150, t: 200 },
      { x: 0, y: -300, t: 400 },
      { x: 0, y: -450, t: 600 },
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'ingen', 'moden'])
  })

  it('en drag innenfor konusen (±30°) regnes som samme reise', () => {
    // 25° av nord — innenfor halve konusen, så retningen holdes og veien legges til.
    const r = 25 * Math.PI / 180
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -250, t: 200 },
      { x: Math.sin(r) * 250, y: -250 - Math.cos(r) * 250, t: 400 },
    ])
    expect(KONUS_GRADER / 2).toBe(30)
    expect(hendelser).toEqual(['ingen', 'ingen', 'moden'])
    expect(EDGE_DIRS[state.oktant]).toBe('N')
  })
})

describe('oppdaterIntensjon — retningsskifte', () => {
  it('skarp sving gir retningsskifte og nullstiller akkumulatoren', () => {
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -300, t: 200 },     // 300 m nord
      { x: 300, y: -300, t: 400 },   // 300 m øst — 90° unna
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'retningsskifte'])
    expect(EDGE_DIRS[state.oktant]).toBe('E')
    expect(state.akkumulert).toBe(300)   // ikke 600
    expect(state.moden).toBe(false)
  })

  it('to halve etapper i motsatt retning modnes aldri', () => {
    const { hendelser } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 300, y: 0, t: 200 },
      { x: 0, y: 0, t: 400 },
      { x: 300, y: 0, t: 600 },
    ])
    expect(hendelser).not.toContain('moden')
  })

  it('45° sving (over halve konusen) er et skifte', () => {
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -200, t: 200 },
      { x: 200, y: -400, t: 400 },
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'retningsskifte'])
    expect(EDGE_DIRS[state.oktant]).toBe('NE')
  })

  it('opphold lengre enn MAKS_PAUSE_MS gir retningsskifte selv i samme retning', () => {
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 200, y: 0, t: 200 },
      { x: 400, y: 0, t: 200 + MAKS_PAUSE_MS + 1 },
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'retningsskifte'])
    expect(state.akkumulert).toBe(200)
    expect(EDGE_DIRS[state.oktant]).toBe('E')
  })

  it('opphold nøyaktig på MAKS_PAUSE_MS er fortsatt samme reise', () => {
    const { hendelser } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 200, y: 0, t: 200 },
      { x: 400, y: 0, t: 200 + MAKS_PAUSE_MS },
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'moden'])
  })

  it('opphold uten bevegelse (under dødsonen) nullstiller også', () => {
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 300, y: 0, t: 200 },
      { x: 301, y: 0, t: 200 + MAKS_PAUSE_MS + 1 },
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'retningsskifte'])
    expect(state.oktant).toBe(null)
    expect(state.akkumulert).toBe(0)
  })

  it('etter et skifte kan den nye retningen modnes på vanlig vis', () => {
    const { hendelser, state } = kjor([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: -300, t: 200 },
      { x: 300, y: -300, t: 400 },   // skifte til øst
      { x: 500, y: -300, t: 600 },   // 500 m øst totalt
    ])
    expect(hendelser).toEqual(['ingen', 'ingen', 'retningsskifte', 'moden'])
    expect(EDGE_DIRS[state.oktant]).toBe('E')
  })
})
