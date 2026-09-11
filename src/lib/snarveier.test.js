import { describe, it, expect } from 'vitest'
import {
  SNARVEIER, STANDARD_REKKEFOLGE, normaliserRekkefolge, snarveierIRekkefolge,
  flyttSnarvei, antallKolonner, antallRader,
  gitterIndeks, gitterForskyvning, flettSynligRekkefolge,
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

describe('gitterIndeks', () => {
  // 9 snarveier i et 4-kolonners gitter: tre rader, den siste med én celle.
  const idx = (x, y) => gitterIndeks(x, y, 60, 50, 4, 9)

  it('leser kolonne og rad av punktet', () => {
    expect(idx(5, 5)).toBe(0)
    expect(idx(65, 5)).toBe(1)
    expect(idx(5, 55)).toBe(4)
    expect(idx(185, 55)).toBe(7)
  })
  it('klemmes til gitteret, ikke til rektangelet', () => {
    // Siste rad har bare plass 8; et punkt langt til høyre der skal ikke gi 11.
    expect(idx(230, 120)).toBe(8)
    expect(idx(-500, -500)).toBe(0)
    expect(idx(5000, 5000)).toBe(8)
  })
  it('gir null før stegene er målt', () => {
    expect(gitterIndeks(100, 100, 0, 50, 4, 9)).toBe(0)
    expect(gitterIndeks(100, 100, 60, 50, 0, 9)).toBe(0)
  })
})

describe('gitterForskyvning', () => {
  it('lar alt utenfor strekningen stå', () => {
    expect(gitterForskyvning(0, 2, 5, 4)).toEqual({ dKol: 0, dRad: 0 })
    expect(gitterForskyvning(7, 2, 5, 4)).toEqual({ dKol: 0, dRad: 0 })
    expect(gitterForskyvning(2, 2, 5, 4)).toEqual({ dKol: 0, dRad: 0 })
  })
  it('skyver de mellomliggende ett hakk MOT den som dras', () => {
    // 2 → 5: plassene 3, 4 og 5 rykker ned til 2, 3 og 4.
    expect(gitterForskyvning(3, 2, 5, 4)).toEqual({ dKol: -1, dRad: 0 })
    expect(gitterForskyvning(5, 2, 5, 4)).toEqual({ dKol: -1, dRad: 0 })
    // 5 → 2: samme strekning, motsatt vei. Plass 3 er siste celle i rad 1 og
    // rykker opp til første celle i rad 2 — ett hakk, men en ny rad.
    expect(gitterForskyvning(3, 5, 2, 4)).toEqual({ dKol: -3, dRad: 1 })
    expect(gitterForskyvning(4, 5, 2, 4)).toEqual({ dKol: 1, dRad: 0 })
  })
  it('bytter RAD når hakket krysser en radkant', () => {
    // Plass 4 er første celle i rad 2; ett hakk ned er siste celle i rad 1.
    expect(gitterForskyvning(4, 1, 6, 4)).toEqual({ dKol: 3, dRad: -1 })
    expect(gitterForskyvning(3, 6, 1, 4)).toEqual({ dKol: -3, dRad: 1 })
  })
  it('står stille uten et gyldig drag', () => {
    expect(gitterForskyvning(1, -1, -1, 4)).toEqual({ dKol: 0, dRad: 0 })
    expect(gitterForskyvning(1, 0, 2, 0)).toEqual({ dKol: 0, dRad: 0 })
  })
})

describe('flettSynligRekkefolge', () => {
  const full = [...STANDARD_REKKEFOLGE]
  const skjulte = ['annotering', 'sporing']
  const synlig = full.filter(id => !skjulte.includes(id))

  it('beholder alle idene', () => {
    const ny = flettSynligRekkefolge(full, [...synlig].reverse())
    expect([...ny].sort()).toEqual([...full].sort())
  })
  it('gir den synlige rekkefølgen forrang', () => {
    const snudd = [...synlig].reverse()
    const ny = flettSynligRekkefolge(full, snudd)
    expect(ny.filter(id => !skjulte.includes(id))).toEqual(snudd)
  })
  it('lar en skjult id følge den synlige den lå etter', () => {
    // Standarden er ... tre-d, annotering, sporing, info ... — flytter vi
    // «tre-d» bakerst, skal Annotering og Sporing bli med dit.
    const utenTreD = synlig.filter(id => id !== 'tre-d')
    const ny = flettSynligRekkefolge(full, [...utenTreD, 'tre-d'])
    expect(ny.slice(-3)).toEqual(['tre-d', 'annotering', 'sporing'])
  })
  it('holder en skjult id først når den lå først', () => {
    const ny = flettSynligRekkefolge(['sporing', ...synlig], synlig)
    expect(ny[0]).toBe('sporing')
  })
})
