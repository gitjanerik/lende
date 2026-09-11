import { describe, it, expect } from 'vitest'
import {
  SNARVEIER, STANDARD_REKKEFOLGE, normaliserRekkefolge, snarveierIRekkefolge,
  flyttSnarvei, antallKolonner, antallRader, flytteIndeks,
  SNARVEI_NAVN_KEY, SNARVEI_MIN_H, SNARVEI_MIN_H_SMAL, lesVisNavn, skrivVisNavn,
} from './snarveier.js'

// Et minimalt localStorage: testene skal si noe om REGELEN, ikke om jsdom.
function fakeStore(start = {}) {
  const data = { ...start }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
    _data: data,
  }
}

describe('«Vis navn når minimert» (v7.6.0)', () => {
  it('er PÅ når ingenting er lagret', () => {
    expect(lesVisNavn(fakeStore())).toBe(true)
  })
  it('er PÅ for alt annet enn en eksplisitt «0»', () => {
    // Standarden skal overleve søppel: en halvskrevet verdi fra en eldre
    // utgave skal ikke skjule navnene for noen.
    expect(lesVisNavn(fakeStore({ [SNARVEI_NAVN_KEY]: '1' }))).toBe(true)
    expect(lesVisNavn(fakeStore({ [SNARVEI_NAVN_KEY]: 'ja' }))).toBe(true)
    expect(lesVisNavn(fakeStore({ [SNARVEI_NAVN_KEY]: '0' }))).toBe(false)
  })
  it('tåler at det ikke finnes noe lager (privat modus)', () => {
    expect(lesVisNavn(null)).toBe(true)
    expect(() => skrivVisNavn(null, false)).not.toThrow()
  })
  it('skriver «1»/«0» og leses tilbake likt', () => {
    const s = fakeStore()
    skrivVisNavn(s, false)
    expect(s._data[SNARVEI_NAVN_KEY]).toBe('0')
    expect(lesVisNavn(s)).toBe(false)
    skrivVisNavn(s, true)
    expect(lesVisNavn(s)).toBe(true)
  })
  it('har en smal celle som er merkbart lavere, men over SC 2.5.8', () => {
    // Hele gevinsten ved å skru bryteren av er høyden; er de to like, gjør
    // bryteren ingenting. 24 px er AA-kravet til trykkflate.
    expect(SNARVEI_MIN_H_SMAL).toBeLessThan(SNARVEI_MIN_H)
    expect(SNARVEI_MIN_H - SNARVEI_MIN_H_SMAL).toBeGreaterThanOrEqual(6)
    expect(SNARVEI_MIN_H_SMAL).toBeGreaterThanOrEqual(24)
  })
})

describe('katalogen', () => {
  it('har unike ider og en etikett per funksjon', () => {
    const ider = SNARVEIER.map(s => s.id)
    expect(new Set(ider).size).toBe(ider.length)
    expect(SNARVEIER.every(s => s.label && s.aria)).toBe(true)
  })
  it('bærer funksjonene pluss «Valg» sist (v7.6.0)', () => {
    // Søket og de eksterne kartene er fortsatt ute (v7.2.0), og chatten bor i
    // Lende-FAB-en. Innstillingene er derimot tilbake som snarvei — sist, fordi
    // de er det man går til når man har satt seg ned.
    expect(STANDARD_REKKEFOLGE).toEqual(
      ['posisjon', 'stifinner', 'runde', 'maaling', 'tre-d', 'annotering',
       'sporing', 'info', 'innstillinger'])
    expect(STANDARD_REKKEFOLGE.at(-1)).toBe('innstillinger')
    expect(STANDARD_REKKEFOLGE).not.toContain('sok')
    expect(STANDARD_REKKEFOLGE).not.toContain('chat')
  })
  it('holder etikettene korte — de setter kolonnebredden (v7.6.0)', () => {
    // Alle cellene er like brede, så den LENGSTE etiketten koster for alle ni.
    // «Annotering» gjorde hver celle så bred som det ordet og halverte antallet
    // som fikk plass på en telefon; kortformene er det som kjøpte plassen
    // tilbake da navnene sluttet å være skjult sammenlagt.
    for (const s of SNARVEIER) expect(s.label.length).toBeLessThanOrEqual(5)
    expect(SNARVEIER.find(s => s.id === 'posisjon').label).toBe('GPS')
    expect(SNARVEIER.find(s => s.id === 'annotering').label).toBe('Merk')
  })
  it('lar `aria` bære det fulle navnet der etiketten er en kortform', () => {
    // Det er ikke to navn på samme ting: «Merk» leses sammen med ikonet, mens
    // en skjermleser bare får ordet. Der finnes ingen kolonnebredde å spare.
    const merk = SNARVEIER.find(s => s.id === 'annotering')
    expect(merk.aria).toBe('Annotering')
    expect(SNARVEIER.find(s => s.id === 'posisjon').aria).toBe('Posisjon')
  })
  it('kaller innstillingene «Valg» BEGGE steder (v7.6.0)', () => {
    // Etiketten i raden og `aria` på knappen er det samme ordet, og det samme
    // som overskriften i skuffa. Et kort ord i raden og «Innstillinger» i
    // headeren ville vært to navn på samme sted.
    const valg = SNARVEIER.find(s => s.id === 'innstillinger')
    expect(valg.label).toBe('Valg')
    expect(valg.aria).toBe('Valg')
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

describe('antallKolonner', () => {
  it('betaler gap for mellomrommene og ikke for første kolonne', () => {
    // 3 × 70 px + 2 × 4 px gap = 218.
    expect(antallKolonner(70, 218, 4, 8)).toBe(3)
    expect(antallKolonner(70, 217, 4, 8)).toBe(2)
  })
  it('gulvet er én kolonne — et gitter uten celler er bare et håndtak', () => {
    expect(antallKolonner(200, 10, 4, 8)).toBe(1)
  })
  it('taket er antall snarveier, ellers blir det tomme kolonner', () => {
    expect(antallKolonner(44, 4000, 4, 8)).toBe(8)
  })
  it('gir null uten en målt cellebredde', () => {
    expect(antallKolonner(0, 500, 4, 8)).toBe(0)
  })
})

describe('antallRader', () => {
  it('runder opp — siste rad kan være halvfull', () => {
    expect(antallRader(8, 4)).toBe(2)
    expect(antallRader(8, 3)).toBe(3)
    expect(antallRader(8, 8)).toBe(1)
  })
  it('gir null før gitteret er målt', () => {
    expect(antallRader(8, 0)).toBe(0)
    expect(antallRader(0, 4)).toBe(0)
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
