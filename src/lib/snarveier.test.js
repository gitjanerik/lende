import { describe, it, expect } from 'vitest'
import {
  SNARVEIER, STANDARD_REKKEFOLGE, normaliserRekkefolge, snarveierIRekkefolge,
  flyttSnarvei, antallSomFar, flytteIndeks,
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
    // Lende-FAB-en, og strek/relieff i Innstillinger → Kartstil (v7.4.0).
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
  it('bærer ingen knotter — strek og relieff er innstillinger (v7.4.0)', () => {
    // De sto som gruppe-piller ved siden av funksjonene fram til v7.4.0, med
    // en egen form (`gruppe`) og et eget bunn-ark. Begge deler er slettet, og
    // en gjenoppstått `gruppe`-oppføring her ville bygget pille-formen på nytt.
    expect(SNARVEIER.some(s => s.gruppe)).toBe(false)
    expect(STANDARD_REKKEFOLGE).not.toContain('strek')
    expect(STANDARD_REKKEFOLGE).not.toContain('relieff')
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
    // 3 × 70 px + 2 × 4 px gap = 218. Håndtaket ligger på sin EGEN linje under
    // raden fra v7.4.0 og spiser derfor ingen bredde her.
    expect(antallSomFar([70, 70, 70], 218, 4)).toBe(3)
    expect(antallSomFar([70, 70, 70], 217, 4)).toBe(2)
  })
  it('gulvet er én knapp', () => {
    expect(antallSomFar([200, 200], 10, 4)).toBe(1)
  })
  it('gir null uten knapper', () => {
    expect(antallSomFar([], 500, 4)).toBe(0)
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
