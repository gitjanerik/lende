import { describe, it, expect } from 'vitest'
import {
  SNARVEIER, STANDARD_REKKEFOLGE, normaliserRekkefolge, snarveierIRekkefolge,
  flyttSnarvei, antallSomFar, flytteIndeks, NAV_SNARVEIER,
} from './snarveier.js'

describe('katalogen', () => {
  it('har unike ider og en etikett per funksjon', () => {
    const ider = SNARVEIER.map(s => s.id)
    expect(new Set(ider).size).toBe(ider.length)
    expect(SNARVEIER.every(s => s.label && s.aria)).toBe(true)
  })
  it('bærer funksjonene skillet mellom funksjon og innstilling ga, og de som ikke gjør noe med kartet sist', () => {
    // Rekkefølgen ER standarden brukeren møter først: alt som gjør noe med
    // kartet, så de to som FORLATER appen, så de to som stiller kartet inn,
    // og til slutt chatten og inngangen til skuffen — se katalogen.
    expect(STANDARD_REKKEFOLGE).toEqual(
      ['stifinner', 'runde', 'maaling', 'tre-d', 'annotering', 'sporing', 'info',
       'utno', 'gmaps', 'strek', 'relieff', 'chat', 'innstillinger'])
  })
  it('gir strek og relieff en pille med tannhjul, og bare dem', () => {
    // `gruppe` er kontrakten SnarveiRad rendrer den andre trykkflata av, og
    // uten en aria-tekst er tannhjulet en knapp uten navn.
    const grupper = SNARVEIER.filter(s => s.gruppe)
    expect(grupper.map(s => s.id)).toEqual(['strek', 'relieff'])
    expect(grupper.every(s => s.tannhjulAria)).toBe(true)
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
  it('gir alle på egne kart når chatten er med', () => {
    expect(snarveierIRekkefolge(STANDARD_REKKEFOLGE, { chat: true }))
      .toHaveLength(SNARVEIER.length)
  })
  it('holder chatten ute uten token, og slipper den inn med', () => {
    // Samme port som `hasAiToken()` gater alt annet med: uten token skal
    // funksjonen ikke engang være synlig i sorteringen.
    expect(snarveierIRekkefolge(STANDARD_REKKEFOLGE).map(s => s.id)).not.toContain('chat')
    expect(snarveierIRekkefolge(STANDARD_REKKEFOLGE, { chat: true }).map(s => s.id))
      .toContain('chat')
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

describe('NAV_SNARVEIER', () => {
  it('er en egen gruppe som ikke ligger i den sorterbare katalogen', () => {
    const ider = new Set(STANDARD_REKKEFOLGE)
    for (const n of NAV_SNARVEIER) expect(ider.has(n.id)).toBe(false)
  })
  it('har posisjon først, og kompasset bak rotasjons-porten', () => {
    expect(NAV_SNARVEIER.map(n => n.id)).toEqual(['posisjon', 'kompass'])
    expect(NAV_SNARVEIER[0].kunRotasjon).toBeUndefined()
    expect(NAV_SNARVEIER[1].kunRotasjon).toBe(true)
  })
})
