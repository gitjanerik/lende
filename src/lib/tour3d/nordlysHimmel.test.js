import { describe, it, expect } from 'vitest'
import {
  nordlysPreg, bueBredde, MIN_PROSENT, MAKS_TOPP_GRADER, FARGER,
} from './nordlysHimmel.js'

describe('nordlysPreg', () => {
  it('gir null under terskelen — ikke et svakt nordlys', () => {
    // Samme kontrakt som setVaer(null): nordlysmodus av skal se nøyaktig ut som
    // før nordlyset fantes, ikke som «nesten ingenting».
    expect(nordlysPreg({ prosent: 0 })).toBeNull()
    expect(nordlysPreg({ prosent: MIN_PROSENT - 0.1 })).toBeNull()
    expect(nordlysPreg({ prosent: null })).toBeNull()
    expect(nordlysPreg({})).toBeNull()
  })

  it('gir et preg over terskelen', () => {
    const p = nordlysPreg({ prosent: 30, ovalGradNord: 3 })
    expect(p).toBeTruthy()
    expect(p.ord).toBe('Synlig')
    expect(p.styrke).toBeGreaterThan(0)
    expect(p.antall).toBeGreaterThanOrEqual(3)
  })

  it('rett over hodet fyller himmelen, langt nord ligger lavt', () => {
    // DETTE ER INVARIANTEN: alt du ser står der det faktisk står. Samme styrke,
    // ulik avstand, må gi ulik høyde over horisonten.
    const over = nordlysPreg({ prosent: 55, ovalGradNord: 0 })
    const fjernt = nordlysPreg({ prosent: 55, ovalGradNord: 9 })
    expect(over.fraGrader).toBeGreaterThan(fjernt.fraGrader)
    expect(over.tilGrader).toBeGreaterThan(fjernt.tilGrader)
  })

  it('når aldri helt til senit — ellers kollapser toppkanten til ett punkt', () => {
    // GEOMETRISK DEGENERASJON, ikke smak (v6.5.17). Radien i asimutretningen er
    // cos(h), altså NULL på 90°: hele toppkanten av hver gardin havner i samme
    // punkt uansett asimut, og alle sju gardinene strålte ut av det ene punktet.
    // Eieren så det umiddelbart som en tegnefeil, fordi det er en.
    for (const grad of [0, 0.5, 1, 2]) {
      const p = nordlysPreg({ prosent: 80, ovalGradNord: grad })
      expect(p.tilGrader, `${grad}°`).toBeLessThanOrEqual(MAKS_TOPP_GRADER)
    }
    expect(MAKS_TOPP_GRADER).toBeLessThan(90)
  })

  it('spillet i båndet følger aktiviteten', () => {
    // Foldene skal være langsomme uansett (se `fart`), men LYSBØLGEN som løper
    // langs gardinen er det som leses som «dansende» — og den hører til kraftige
    // utbrudd. En svak bue står nesten stille.
    const svak = nordlysPreg({ prosent: 8 })
    const sterk = nordlysPreg({ prosent: 72 })
    expect(svak.uro).toBeLessThan(sterk.uro)
    expect(svak.foldeUtslag).toBeLessThan(sterk.foldeUtslag)
    for (const p of [5, 30, 99]) {
      const v = nordlysPreg({ prosent: p })
      expect(v.uro, `${p} %`).toBeGreaterThan(0)
      expect(v.uro, `${p} %`).toBeLessThanOrEqual(1)
      expect(v.foldeUtslag, `${p} %`).toBeLessThan(0.2)
    }
  })

  it('tegner ingenting når ovalen er under horisonten', () => {
    // Et nordlys malt på en horisont der det fysisk ikke kan stå er den samme
    // løgnen som en tvungen sol på natthimmelen (v6.1.0).
    expect(nordlysPreg({ prosent: 90, ovalGradNord: 40 })).toBeNull()
  })

  it('nedre kant ligger alltid under den øvre', () => {
    for (const grad of [0, 2, 5, 8, 11, 13]) {
      const p = nordlysPreg({ prosent: 70, ovalGradNord: grad })
      if (!p) continue
      expect(p.fraGrader, `${grad}°`).toBeLessThan(p.tilGrader)
      expect(p.fraGrader, `${grad}°`).toBeGreaterThanOrEqual(0)
    }
  })

  it('rødt kommer først ved kraftig aktivitet', () => {
    // Den røde 630 nm-linja krever at partiklene når over 200 km, og det skjer
    // først ved sterke utbrudd. Et svakt nordlys som er rødt finnes ikke.
    expect(nordlysPreg({ prosent: 10 }).rodAndel).toBe(0)
    expect(nordlysPreg({ prosent: 70 }).rodAndel).toBeGreaterThan(0)
    expect(nordlysPreg({ prosent: 30 }).fiolettAndel).toBe(0)
    expect(nordlysPreg({ prosent: 60 }).fiolettAndel).toBeGreaterThan(0)
  })

  it('sterkere nordlys gir flere gardiner og bredere bue', () => {
    const svak = nordlysPreg({ prosent: 8 })
    const sterk = nordlysPreg({ prosent: 75 })
    expect(sterk.antall).toBeGreaterThan(svak.antall)
    expect(sterk.bueGrader).toBeGreaterThan(svak.bueGrader)
  })

  it('farten er LANGSOM, og taket holder', () => {
    // En gardin som rykker leses som en animasjonsfeil. Kp løfter farten litt,
    // men taket er lavt med vilje.
    for (const kp of [0, 3, 9]) {
      const p = nordlysPreg({ prosent: 60, kp })
      expect(p.fart).toBeGreaterThan(0)
      expect(p.fart).toBeLessThan(0.12)
    }
    expect(nordlysPreg({ prosent: 60, kp: 9 }).fart)
      .toBeGreaterThan(nordlysPreg({ prosent: 60, kp: 0 }).fart)
  })

  it('svakeste synlige nordlys har nok styrke til å SES', () => {
    // v6.5.16: den lineære skalaen ga 0,11 ved 8 %, og gjennom utoning, stråler
    // og en additiv blanding ble det ingenting på skjermen. Gulvet er en bevisst
    // overdrivelse — forskjellen mellom svakt og sterkt bæres av farge, høyde,
    // buebredde og antall gardiner, ikke av lysstyrke alene.
    expect(nordlysPreg({ prosent: MIN_PROSENT }).styrke).toBeGreaterThan(0.25)
    expect(nordlysPreg({ prosent: 8 }).styrke).toBeGreaterThan(0.3)
    // Men den stiger fortsatt.
    expect(nordlysPreg({ prosent: 70 }).styrke)
      .toBeGreaterThan(nordlysPreg({ prosent: 8 }).styrke)
  })

  it('strålene kommer med aktiviteten — et svakt nordlys er en diffus bue', () => {
    expect(nordlysPreg({ prosent: 8 }).straaleAndel)
      .toBeLessThan(nordlysPreg({ prosent: 45 }).straaleAndel)
    expect(nordlysPreg({ prosent: 70 }).straaleAndel).toBe(1)
    for (const p of [5, 20, 50, 99]) {
      const v = nordlysPreg({ prosent: p }).straaleAndel
      expect(v, `${p} %`).toBeGreaterThan(0)
      expect(v, `${p} %`).toBeLessThanOrEqual(1)
    }
  })

  it('styrken metter og går aldri over 1', () => {
    expect(nordlysPreg({ prosent: 100 }).styrke).toBeLessThanOrEqual(1)
    expect(nordlysPreg({ prosent: 400 }).styrke).toBeLessThanOrEqual(1)
  })
})

describe('bueBredde', () => {
  it('vokser med styrken', () => {
    expect(bueBredde(10)).toBeLessThan(bueBredde(20))
    expect(bueBredde(20)).toBeLessThan(bueBredde(40))
    expect(bueBredde(40)).toBeLessThan(bueBredde(70))
  })
})

describe('FARGER', () => {
  it('er de tre utslippslinjene, som gyldige hex', () => {
    for (const [navn, v] of Object.entries(FARGER)) {
      expect(v, navn).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(Object.keys(FARGER).sort()).toEqual(['fiolett', 'gronn', 'rod'])
  })
})
