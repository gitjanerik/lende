import { describe, it, expect } from 'vitest'
import {
  UNDERLAG, STI_KODER, VEG_KODER, DEFAULT_RUTE_PREF,
  SLAKK_MAKS_M, SLAKK_STEG_M,
  normaliserRutePref, kostnadsFaktorer, onskedeKoder, prefNokkel, erNoytral,
  prefTekst, oppsummerUnderlag,
} from './rutePreferanse.js'
import { ISOM_COST } from './routing.js'

describe('normaliserRutePref', () => {
  it('gir standarden for tomt og for null', () => {
    expect(normaliserRutePref()).toEqual({ ...DEFAULT_RUTE_PREF })
    expect(normaliserRutePref(null)).toEqual({ ...DEFAULT_RUTE_PREF })
    expect(normaliserRutePref({})).toEqual({ ...DEFAULT_RUTE_PREF })
  })

  // Et ukjent underlag skal falle til sti og ikke til veg: standarden er den
  // som ikke endrer noe, så en tastefeil kan ikke i stillhet legge om ruteren.
  it('faller til sti på ukjent underlag', () => {
    expect(normaliserRutePref({ underlag: 'grus' }).underlag).toBe(UNDERLAG.STI)
    expect(normaliserRutePref({ underlag: 'VEG' }).underlag).toBe(UNDERLAG.STI)
    expect(normaliserRutePref({ underlag: UNDERLAG.VEG }).underlag).toBe(UNDERLAG.VEG)
  })

  it('klemmer og runder slakken til steget', () => {
    expect(normaliserRutePref({ slakkM: -100 }).slakkM).toBe(0)
    expect(normaliserRutePref({ slakkM: 99999 }).slakkM).toBe(SLAKK_MAKS_M)
    expect(normaliserRutePref({ slakkM: 137 }).slakkM).toBe(150)
    expect(normaliserRutePref({ slakkM: 124 }).slakkM).toBe(100)
    expect(normaliserRutePref({ slakkM: SLAKK_STEG_M }).slakkM).toBe(SLAKK_STEG_M)
  })

  it('bruker standard-slakken når tallet ikke er et tall', () => {
    expect(normaliserRutePref({ slakkM: 'nei' }).slakkM).toBe(DEFAULT_RUTE_PREF.slakkM)
    expect(normaliserRutePref({ slakkM: NaN }).slakkM).toBe(DEFAULT_RUTE_PREF.slakkM)
  })

  it('tvinger krav til boolsk', () => {
    expect(normaliserRutePref({ krav: 1 }).krav).toBe(true)
    expect(normaliserRutePref({ krav: '' }).krav).toBe(false)
  })
})

describe('kostnadsFaktorer', () => {
  // Kjerne-invarianten: standarden skal gi en graf som er bit for bit den
  // samme som før preferansen fantes. ISOM_COST ER allerede sti-preferansen.
  it('er null for den nøytrale preferansen', () => {
    expect(kostnadsFaktorer()).toBeNull()
    expect(kostnadsFaktorer({ underlag: UNDERLAG.STI, krav: false })).toBeNull()
    expect(erNoytral({})).toBe(true)
    expect(erNoytral({ underlag: UNDERLAG.VEG })).toBe(false)
    expect(erNoytral({ underlag: UNDERLAG.STI, krav: true })).toBe(false)
  })

  it('gir veg rabatt og sti straff når veg foretrekkes', () => {
    const f = kostnadsFaktorer({ underlag: UNDERLAG.VEG })
    expect(f['504']).toBeLessThan(1)
    expect(f['503']).toBeLessThan(1)
    // 504 er vegen i marka og skal være billigere enn den offentlige småvegen.
    expect(f['504']).toBeLessThan(f['503'])
    for (const k of STI_KODER) expect(f[k]).toBeGreaterThan(1)
    // Hovedveg og motorveg er IKKE en del av en veg-i-marka-preferanse.
    expect(f['501']).toBeUndefined()
    expect(f['502']).toBeUndefined()
  })

  it('straffer hardere med krav enn med foretrekk', () => {
    const foretrekk = kostnadsFaktorer({ underlag: UNDERLAG.VEG })
    const krav = kostnadsFaktorer({ underlag: UNDERLAG.VEG, krav: true })
    expect(krav['505']).toBeGreaterThan(foretrekk['505'])
  })

  // Straffen skal kunne TAPE mot geografien. Et tall stort nok til å aldri
  // tape er et forbud med flere trinn, og da er «fant ingen rute» tilbake.
  it('er en multiplikator og aldri et forbud', () => {
    for (const pref of [
      { underlag: UNDERLAG.VEG },
      { underlag: UNDERLAG.VEG, krav: true },
      { underlag: UNDERLAG.STI, krav: true },
    ]) {
      for (const v of Object.values(kostnadsFaktorer(pref))) {
        expect(v).toBeGreaterThan(0)
        expect(v).toBeLessThan(100)
      }
    }
  })

  it('straffer alt kjørbart likt når sti er et krav', () => {
    const f = kostnadsFaktorer({ underlag: UNDERLAG.STI, krav: true })
    expect(f['504']).toBe(f['503'])
    expect(f['501']).toBe(f['503'])
    for (const k of STI_KODER) expect(f[k]).toBeUndefined()
  })

  // Faktorene ganges INN I ISOM_COST — det er FORHOLDET etter gangingen som
  // styrer ruta, ikke tallene hver for seg.
  it('gir ønsket underlag lavest effektiv vekt etter ISOM_COST', () => {
    const f = kostnadsFaktorer({ underlag: UNDERLAG.VEG })
    const eff = (k) => ISOM_COST[k] * (f[k] ?? 1)
    expect(eff('504')).toBeLessThan(eff('505'))
    expect(eff('503')).toBeLessThan(eff('505'))
    expect(eff('504')).toBeLessThan(eff('502'))
  })

  it('bare kjente ISOM-koder får faktor', () => {
    for (const pref of [{ underlag: UNDERLAG.VEG }, { underlag: UNDERLAG.STI, krav: true }]) {
      for (const k of Object.keys(kostnadsFaktorer(pref))) {
        expect(ISOM_COST[k]).toBeTypeOf('number')
      }
    }
  })
})

describe('onskedeKoder', () => {
  it('svarer sti-kodene som standard og veg-kodene for veg', () => {
    expect(onskedeKoder()).toEqual([...STI_KODER])
    expect(onskedeKoder({ underlag: UNDERLAG.VEG })).toEqual([...VEG_KODER])
  })

  it('returnerer en kopi, ikke den frosne lista', () => {
    const k = onskedeKoder()
    k.push('999')
    expect(onskedeKoder()).toEqual([...STI_KODER])
  })
})

describe('prefNokkel', () => {
  it('er stabil for like preferanser og ulik for ulike', () => {
    expect(prefNokkel({ underlag: 'sti', krav: false, slakkM: 250 })).toBe(prefNokkel({}))
    expect(prefNokkel({ underlag: UNDERLAG.VEG })).not.toBe(prefNokkel({}))
    expect(prefNokkel({ krav: true })).not.toBe(prefNokkel({}))
    expect(prefNokkel({ slakkM: 0 })).not.toBe(prefNokkel({}))
  })

  // Nøkkelen normaliserer, så to skrivemåter av samme preferanse deler cache.
  it('normaliserer før den nøkler', () => {
    expect(prefNokkel({ slakkM: 137 })).toBe(prefNokkel({ slakkM: 150 }))
    expect(prefNokkel({ underlag: 'tull' })).toBe(prefNokkel({}))
  })
})

describe('prefTekst', () => {
  it('nevner begge vegordene når veg er valgt', () => {
    const t = prefTekst({ underlag: UNDERLAG.VEG })
    expect(t).toContain('skogsveg')
    expect(t).toContain('småveg')
  })

  it('sier fra om slakken, og sier fra når den er null', () => {
    expect(prefTekst({ slakkM: 300 })).toContain('300 m')
    expect(prefTekst({ slakkM: 0 })).toContain('Ingen slakk')
  })

  it('skiller krav fra foretrekk', () => {
    expect(prefTekst({ underlag: UNDERLAG.VEG, krav: true })).not
      .toBe(prefTekst({ underlag: UNDERLAG.VEG, krav: false }))
  })
})

describe('oppsummerUnderlag', () => {
  it('summerer og regner andel på ønsket underlag', () => {
    const o = oppsummerUnderlag({ '504': 800, '505': 200 }, { underlag: UNDERLAG.VEG })
    expect(o.totalM).toBe(1000)
    expect(o.onsketM).toBe(800)
    expect(o.avvikM).toBe(200)
    expect(o.andel).toBeCloseTo(0.8)
    expect(o.oppfylt).toBe(true)
    expect(o.tekst).toContain('80 %')
  })

  // Bro-kanter er ikke kartlagt underlag i det hele tatt og teller som avvik.
  it('teller bro som avvik', () => {
    const o = oppsummerUnderlag({ '504': 900, bridge: 100 }, { underlag: UNDERLAG.VEG })
    expect(o.avvikM).toBe(100)
  })

  it('har høyere terskel for krav enn for foretrekk', () => {
    const m = { '504': 600, '505': 400 }
    expect(oppsummerUnderlag(m, { underlag: UNDERLAG.VEG }).oppfylt).toBe(true)
    expect(oppsummerUnderlag(m, { underlag: UNDERLAG.VEG, krav: true }).oppfylt).toBe(false)
  })

  it('tåler tomt og ugyldig innhold', () => {
    expect(oppsummerUnderlag(null, {}).totalM).toBe(0)
    expect(oppsummerUnderlag({}, {}).tekst).toContain('Ingen underlagsdata')
    const o = oppsummerUnderlag({ '505': NaN, '506': -5, '507': 100 }, {})
    expect(o.totalM).toBe(100)
  })
})
