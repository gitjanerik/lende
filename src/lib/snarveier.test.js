import { describe, it, expect } from 'vitest'
import {
  SNARVEIER, STANDARD_REKKEFOLGE, normaliserRekkefolge, snarveierIRekkefolge,
  flyttSnarvei, antallSomFar, flytteIndeks, PILLER,
} from './snarveier.js'

describe('katalogen', () => {
  it('har unike ider og en etikett per funksjon', () => {
    const ider = SNARVEIER.map(s => s.id)
    expect(new Set(ider).size).toBe(ider.length)
    expect(SNARVEIER.every(s => s.label && s.aria)).toBe(true)
  })
  it('bærer BARE funksjonene, slanket tilbake etter felttesten (v7.2.0)', () => {
    // Alt som ikke GJØR noe med kartet er ute igjen: søket og innstillingene
    // står i topprada, de eksterne kartene øverst i infopanelet, chatten i
    // Lende-FAB-en, og strek/relieff i PILLER.
    expect(STANDARD_REKKEFOLGE).toEqual(
      ['posisjon', 'stifinner', 'runde', 'maaling', 'tre-d', 'annotering',
       'sporing', 'info'])
  })
  it('gir posisjonen plass #1, og kompasset er ikke i lista (v7.3.0)', () => {
    // Alle snarveier er likeverdige og sorterbare: den faste venstregruppen er
    // borte. Posisjonen står først i STANDARDEN — altså kan den bare havne bak
    // «Mer» hvis brukeren selv har sortert den dit — og kompasset har forlatt
    // raden helt, til fordel for linjal-boksen nede til venstre.
    expect(STANDARD_REKKEFOLGE[0]).toBe('posisjon')
    expect(STANDARD_REKKEFOLGE).not.toContain('kompass')
  })
  it('har ingen piller — de er sin egen liste', () => {
    expect(SNARVEIER.some(s => s.gruppe)).toBe(false)
  })
})

describe('PILLER', () => {
  it('er strek og relieff, med tannhjul og en egen aria-tekst', () => {
    // `gruppe` er kontrakten SnarveiRad rendrer den andre trykkflata av, og
    // uten en aria-tekst er tannhjulet en knapp uten navn.
    expect(PILLER.map(p => p.id)).toEqual(['strek', 'relieff'])
    expect(PILLER.every(p => p.gruppe && p.tannhjulAria && p.label && p.aria)).toBe(true)
  })
  it('ligger utenfor den sorterbare katalogen', () => {
    const ider = new Set(STANDARD_REKKEFOLGE)
    for (const p of PILLER) expect(ider.has(p.id)).toBe(false)
  })
})

describe('normaliserRekkefolge', () => {
  it('beholder brukerens rekkefølge', () => {
    expect(normaliserRekkefolge(['info', 'tre-d'])[0]).toBe('info')
    expect(normaliserRekkefolge(['info', 'tre-d'])[1]).toBe('tre-d')
  })
  it('dropper ukjente ider og dubletter', () => {
    const ut = normaliserRekkefolge(['info', 'finnesikke', 'info'])
    expect(ut.filter(id => id === 'info')).toHaveLength(1)
    expect(ut).not.toContain('finnesikke')
  })
  it('legger nye funksjoner bakerst, ikke først', () => {
    const ut = normaliserRekkefolge(['info'])
    expect(ut[0]).toBe('info')
    expect(ut).toHaveLength(STANDARD_REKKEFOLGE.length)
  })
  it('tåler søppel', () => {
    expect(normaliserRekkefolge(null)).toEqual(STANDARD_REKKEFOLGE)
    expect(normaliserRekkefolge('info')).toEqual(STANDARD_REKKEFOLGE)
  })
})

describe('snarveierIRekkefolge', () => {
  it('filtrerer bort de kart-egne på innebygde kart', () => {
    const ider = snarveierIRekkefolge(STANDARD_REKKEFOLGE, { egetKart: false }).map(s => s.id)
    expect(ider).not.toContain('annotering')
    expect(ider).not.toContain('sporing')
    expect(ider).toContain('maaling')
  })
  it('gir alle på egne kart', () => {
    expect(snarveierIRekkefolge(STANDARD_REKKEFOLGE)).toHaveLength(SNARVEIER.length)
  })
})

describe('flyttSnarvei', () => {
  it('flytter framover og bakover', () => {
    expect(flyttSnarvei(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(flyttSnarvei(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })
  it('er uendret utenfor rekkevidde', () => {
    expect(flyttSnarvei(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(flyttSnarvei(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
    expect(flyttSnarvei(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
  it('rører ikke originalen', () => {
    const inn = ['a', 'b']
    flyttSnarvei(inn, 0, 1)
    expect(inn).toEqual(['a', 'b'])
  })
})

describe('antallSomFar', () => {
  it('betaler gap for mellomrommene og ikke for første knapp', () => {
    // 3 × 70 px + 2 × 4 px gap = 218; pluss handle 36 + gap 4 = 258.
    expect(antallSomFar([70, 70, 70], 258, 36, 4)).toBe(3)
    expect(antallSomFar([70, 70, 70], 257, 36, 4)).toBe(2)
  })
  it('gulvet er én knapp', () => {
    expect(antallSomFar([200, 200], 10, 36, 4)).toBe(1)
  })
  it('gir null uten knapper', () => {
    expect(antallSomFar([], 500, 36, 4)).toBe(0)
  })
})

describe('flytteIndeks', () => {
  it('runder til nærmeste radhøyde', () => {
    expect(flytteIndeks(0, 0, 50, 5)).toBe(0)
    expect(flytteIndeks(0, 24, 50, 5)).toBe(0)
    expect(flytteIndeks(0, 26, 50, 5)).toBe(1)
    expect(flytteIndeks(2, -60, 50, 5)).toBe(1)
  })
  it('klemmes til lista', () => {
    expect(flytteIndeks(0, -5000, 50, 5)).toBe(0)
    expect(flytteIndeks(0, 5000, 50, 5)).toBe(4)
  })
  it('en radhøyde på null flytter ingenting', () => {
    expect(flytteIndeks(2, 300, 0, 5)).toBe(2)
  })
})
