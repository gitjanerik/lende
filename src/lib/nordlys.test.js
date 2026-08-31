import { describe, it, expect } from 'vitest'
import {
  HOYDE_KM, til360, hoydeVinkel, sannsynlighetFor, ovalenNordover, styrkeOrd,
  seForhold, alderMinutter,
} from './nordlys.js'

describe('til360', () => {
  it('normaliserer til OVATIONs konvensjon', () => {
    // DETTE ER FELLA, og den er stille: 10,4 °E sendt som −349,6 slår opp på
    // motsatt side av jorda og gir et tall som ser helt rimelig ut.
    expect(til360(10.4)).toBeCloseTo(10.4, 6)
    expect(til360(-10.4)).toBeCloseTo(349.6, 6)
    expect(til360(-349.6)).toBeCloseTo(10.4, 6)
    expect(til360(370)).toBeCloseTo(10, 6)
  })
})

describe('hoydeVinkel', () => {
  it('rett over hodet er 90 grader', () => {
    expect(hoydeVinkel(0, HOYDE_KM.gronn)).toBeCloseTo(90, 6)
  })

  it('synker med avstanden', () => {
    const nær = hoydeVinkel(2, HOYDE_KM.gronn)
    const midt = hoydeVinkel(6, HOYDE_KM.gronn)
    const fjernt = hoydeVinkel(12, HOYDE_KM.gronn)
    expect(nær).toBeGreaterThan(midt)
    expect(midt).toBeGreaterThan(fjernt)
  })

  it('går under horisonten når jordkrumningen skjuler det', () => {
    // Et lag på 120 km er skjult av krumningen rundt 11° unna. Det er DENNE
    // grensa som gjør at vi ikke maler nordlys på en horisont der det fysisk
    // ikke kan stå.
    expect(hoydeVinkel(9, HOYDE_KM.gronn)).toBeGreaterThan(0)
    expect(hoydeVinkel(15, HOYDE_KM.gronn)).toBeLessThan(0)
  })

  it('høyere lag er synlig lenger unna', () => {
    // Det røde laget på 230 km rekker lenger enn det grønne på 120 km, og det er
    // derfor man fra Sør-Norge kan se en rød glød uten det grønne under.
    expect(hoydeVinkel(15, HOYDE_KM.rod)).toBeGreaterThan(hoydeVinkel(15, HOYDE_KM.gronn))
    expect(hoydeVinkel(14, HOYDE_KM.rod)).toBeGreaterThan(0)
  })

  it('fargelagene ligger i riktig rekkefølge', () => {
    // Snudd er dette den ene feilen alle som har sett nordlys kjenner igjen.
    expect(HOYDE_KM.fiolett).toBeLessThan(HOYDE_KM.gronn)
    expect(HOYDE_KM.gronn).toBeLessThan(HOYDE_KM.rod)
  })
})

describe('sannsynlighetFor', () => {
  const rutenett = [
    [10, 60, 3], [11, 60, 5], [10, 61, 9], [11, 61, 12], [350, 60, 44],
  ]

  it('finner nærmeste rutepunkt', () => {
    expect(sannsynlighetFor(rutenett, 60.1, 10.2)).toBe(3)
    expect(sannsynlighetFor(rutenett, 60.9, 10.9)).toBe(12)
  })

  it('tar imot negativ lengdegrad og treffer riktig', () => {
    // −10° er 350° i OVATIONs konvensjon. Uten normaliseringen ville dette slått
    // opp på 10° og gitt 3 i stedet for 44.
    expect(sannsynlighetFor(rutenett, 60, -10)).toBe(44)
  })

  it('svarer null på tomt rutenett framfor å kaste', () => {
    expect(sannsynlighetFor([], 60, 10)).toBeNull()
    expect(sannsynlighetFor(null, 60, 10)).toBeNull()
    expect(sannsynlighetFor(rutenett, NaN, 10)).toBeNull()
  })
})

describe('ovalenNordover', () => {
  const rutenett = [
    [10, 59, 2], [10, 60, 4], [10, 63, 30], [10, 67, 65], [10, 70, 40],
    [11, 67, 99],
  ]

  it('finner breddegraden med høyest verdi nordover langs egen lengdegrad', () => {
    const o = ovalenNordover(rutenett, 60, 10)
    expect(o.lat).toBe(67)
    expect(o.verdi).toBe(65)
  })

  it('ser bare NORDOVER — sørlys er ikke nordlys', () => {
    // 59° ligger sør for observatøren og skal ikke kunne vinne, selv om den var
    // sterkest. Et treff der ville plassert gardinene i feil himmelretning.
    const bare_sor = [[10, 55, 90], [10, 61, 6]]
    expect(ovalenNordover(bare_sor, 60, 10).lat).toBe(61)
  })

  it('holder seg til én lengdegrad-kolonne', () => {
    // 11° har en sterkere verdi, men den hører til en annen meridian.
    expect(ovalenNordover(rutenett, 60, 10).verdi).toBe(65)
  })

  it('svarer null når ingenting er over terskelen', () => {
    expect(ovalenNordover([[10, 65, 0]], 60, 10)).toBeNull()
  })
})

describe('styrkeOrd', () => {
  it('gir ordene i stigende rekkefølge', () => {
    expect(styrkeOrd(2)).toBe('Ingen')
    expect(styrkeOrd(10)).toBe('Svak')
    expect(styrkeOrd(25)).toBe('Synlig')
    expect(styrkeOrd(45)).toBe('Sterk')
    expect(styrkeOrd(80)).toBe('Svært sterk')
    expect(styrkeOrd(null)).toBeNull()
  })
})

describe('seForhold', () => {
  it('sier fra at det er lyst framfor å love nordlys', () => {
    const r = seForhold({ prosent: 90, skydekke: 0, erNatt: false })
    expect(r.kanSes).toBe(false)
    expect(r.hvorfor).toBe('Det er lyst ute')
  })

  it('et tett skylag slår ut et sterkt nordlys', () => {
    // DETTE ER HELE GRUNNEN TIL AT SKYDEKKET ER MED: «Sterk» gjennom et tett
    // skylag sender folk ut i kulda for ingenting.
    const r = seForhold({ prosent: 70, skydekke: 95, erNatt: true })
    expect(r.kanSes).toBe(false)
    expect(r.hvorfor).toBe('Overskyet')
    // Styrken oppgis likevel — det er sant at aktiviteten er høy.
    expect(r.styrke).toBe('Svært sterk')
  })

  it('delvis skyet gir et forbehold, ikke et nei', () => {
    const r = seForhold({ prosent: 40, skydekke: 70, erNatt: true })
    expect(r.kanSes).toBe(true)
    expect(r.hvorfor).toBe('Mye skyer')
  })

  it('klar natt med aktivitet er et rent ja', () => {
    const r = seForhold({ prosent: 40, skydekke: 10, erNatt: true })
    expect(r.kanSes).toBe(true)
    expect(r.hvorfor).toBeNull()
  })

  it('uten måling loves ingenting', () => {
    const r = seForhold({ prosent: null, skydekke: 0, erNatt: true })
    expect(r.kanSes).toBe(false)
    expect(r.styrke).toBeNull()
  })
})

describe('alderMinutter', () => {
  it('regner alderen på et tidsstempel', () => {
    const naa = Date.parse('2026-08-31T22:30:00Z')
    expect(alderMinutter('2026-08-31T22:09:00Z', naa)).toBe(21)
  })

  it('svarer null på søppel framfor å vise NaN', () => {
    expect(alderMinutter(null)).toBeNull()
    expect(alderMinutter('i går')).toBeNull()
  })
})
