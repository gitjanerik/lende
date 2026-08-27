import { describe, it, expect } from 'vitest'
import {
  PLANETER, planetPosisjon, synligePlaneter, MIN_ELONGASJON,
} from './planeter.js'
import { solEkvatorial } from './astronomi.js'

const GRAD = Math.PI / 180
const utc = (d) => new Date(`${d}T22:00:00Z`)

/**
 * FASIT FRA EN UAVHENGIG IMPLEMENTASJON.
 *
 * Tallene er hentet fra `astronomy-engine` (cosinekitty, MIT) — en helt annen
 * kodebase med en helt annen metode: full VSOP87 mot våre lineære middel-
 * elementer fra JPL. De er generert med `Equator(kropp, dato, observatør,
 * ofdate=false, aberration=false)`, altså geometrisk posisjon i J2000-rammen,
 * som er nøyaktig det `planetPosisjon` returnerer.
 *
 * Grunnen til at de står BAKT inn her og ikke hentes i testen: en test som
 * krever nett er en test som blir skrudd av. Grunnen til at de står her i det
 * hele tatt: uten et eksternt anker kan en egenskrevet banemekanikk være helt
 * internt konsistent og likevel peke feil vei, og en planet på feil plass ser
 * ikke ut som noe.
 *
 * [id, dato, ra i timer, dek i grader]
 */
const FASIT = [
  ['merkur', '2026-01-15', 19.58847, -23.48858],
  ['venus', '2026-01-15', 19.99325, -21.62117],
  ['mars', '2026-01-15', 19.72591, -22.29464],
  ['jupiter', '2026-01-15', 7.37335, 22.36186],
  ['saturn', '2026-01-15', 23.86510, -3.28892],
  ['merkur', '2026-06-01', 6.02512, 25.59987],
  ['venus', '2026-06-01', 7.18180, 24.38979],
  ['mars', '2026-06-01', 2.52425, 14.24811],
  ['jupiter', '2026-06-01', 7.72188, 21.73337],
  ['saturn', '2026-06-01', 0.79168, 2.63916],
  ['merkur', '2026-08-27', 10.46635, 11.48722],
  ['venus', '2026-08-27', 13.12221, -10.26697],
  ['mars', '2026-08-27', 6.75829, 23.49788],
  ['jupiter', '2026-08-27', 9.00553, 17.56091],
  ['saturn', '2026-08-27', 0.89762, 2.90320],
  ['merkur', '2027-03-10', 21.69343, -13.61614],
  ['venus', '2027-03-10', 20.90146, -17.29056],
  ['mars', '2027-03-10', 9.81715, 17.50091],
  ['jupiter', '2027-03-10', 9.40472, 16.36236],
  ['saturn', '2027-03-10', 0.90774, 3.38659],
  ['merkur', '2030-11-01', 15.27873, -19.46534],
  ['venus', '2030-11-01', 14.67064, -14.83595],
  ['mars', '2030-11-01', 11.31105, 6.03890],
  ['jupiter', '2030-11-01', 15.97957, -19.86986],
  ['saturn', '2030-11-01', 4.36885, 19.41238],
]

const bueminutter = (ra1, dek1, ra2, dek2) => {
  const c = Math.sin(dek1 * GRAD) * Math.sin(dek2 * GRAD)
    + Math.cos(dek1 * GRAD) * Math.cos(dek2 * GRAD) * Math.cos((ra1 - ra2) * 15 * GRAD)
  return Math.acos(Math.max(-1, Math.min(1, c))) / GRAD * 60
}

describe('planetPosisjon — mot en uavhengig implementasjon', () => {
  it('treffer innenfor det de lineære elementene lover', () => {
    // JPL oppgir «bueminutter» for 1800–2050. Målt mot VSOP87 ligger vi under
    // 6′ på alle fem, og under 1′ på fire av dem.
    for (const [id, dato, ra, dek] of FASIT) {
      const p = planetPosisjon(id, utc(dato))
      expect(bueminutter(p.ra, p.dek, ra, dek), `${id} ${dato}`).toBeLessThan(6)
    }
  })

  it('er skarpest på de indre planetene', () => {
    // Saturn er verst, og det er forventet: lineære middel-elementer modellerer
    // ikke Jupiters perturbasjoner. Merkur og Venus har nesten ingen, og skal
    // derfor ligge under ett bueminutt. Faller den påstanden, er det ikke
    // approksimasjonen som er problemet — da er det oss.
    for (const [id, dato, ra, dek] of FASIT) {
      if (id !== 'merkur' && id !== 'venus' && id !== 'mars') continue
      const p = planetPosisjon(id, utc(dato))
      expect(bueminutter(p.ra, p.dek, ra, dek), `${id} ${dato}`).toBeLessThan(1)
    }
  })
})

describe('planetPosisjon — banemekanikken', () => {
  it('holder de indre planetenes elongasjon under de kjente takene', () => {
    // Merkur kommer aldri lenger enn ~28° fra sola, Venus aldri lenger enn
    // ~47°. Det er ytre fasit som ikke kan gjettes fram, og de faller straks
    // Kepler-løsningen eller rotasjonene er feil.
    let merkurMaks = 0
    let venusMaks = 0
    for (let d = 0; d < 800; d += 1) {
      const dato = new Date(Date.UTC(2026, 0, 1 + d))
      merkurMaks = Math.max(merkurMaks, planetPosisjon('merkur', dato).elongasjon)
      venusMaks = Math.max(venusMaks, planetPosisjon('venus', dato).elongasjon)
    }
    expect(merkurMaks).toBeGreaterThan(17)
    expect(merkurMaks).toBeLessThan(29)
    expect(venusMaks).toBeGreaterThan(44)
    expect(venusMaks).toBeLessThan(48)
  })

  it('lar de ytre planetene nå opposisjon', () => {
    // En ytre planet MÅ komme i 180° fra sola. Klarer den ikke det, er den
    // regnet som en indre planet et sted i koden.
    for (const id of ['mars', 'jupiter', 'saturn']) {
      let maks = 0
      for (let d = 0; d < 800; d += 2) {
        maks = Math.max(maks, planetPosisjon(id, new Date(Date.UTC(2026, 0, 1 + d))).elongasjon)
      }
      expect(maks, id).toBeGreaterThan(175)
    }
  })

  it('holder avstandene innenfor banene', () => {
    const grenser = {
      merkur: [0.5, 1.5], venus: [0.25, 1.75], mars: [0.35, 2.7],
      jupiter: [3.9, 6.6], saturn: [7.9, 11.1],
    }
    for (const [id, [min, maks]] of Object.entries(grenser)) {
      for (let d = 0; d < 800; d += 5) {
        const p = planetPosisjon(id, new Date(Date.UTC(2026, 0, 1 + d)))
        expect(p.avstandAE, `${id} ${d}`).toBeGreaterThan(min)
        expect(p.avstandAE, `${id} ${d}`).toBeLessThan(maks)
      }
    }
  })

  it('gir de indre planetene faser og de ytre nesten ingen', () => {
    // Venus går fra sigd til full som månen; Jupiter er alltid nesten full,
    // fordi vi ser den nesten rett ovenfra sola. Fasevinkelen kan ikke
    // overstige arcsin(1/a) for en ytre planet.
    let venusMinLys = 1
    let jupiterMinLys = 1
    for (let d = 0; d < 800; d += 2) {
      const dato = new Date(Date.UTC(2026, 0, 1 + d))
      venusMinLys = Math.min(venusMinLys, planetPosisjon('venus', dato).lysAndel)
      jupiterMinLys = Math.min(jupiterMinLys, planetPosisjon('jupiter', dato).lysAndel)
    }
    expect(venusMinLys).toBeLessThan(0.2)
    expect(jupiterMinLys).toBeGreaterThan(0.98)
  })

  it('gir magnituder som stemmer med de virkelige spennene', () => {
    // Ytre fasit, fra hva planetene FAKTISK varierer mellom:
    //   Venus   −4,9 … −3,8      Jupiter −2,9 … −1,6
    //   Merkur  −2,5 … +5,7      Saturn  −0,5 … +1,5 (med ringene)
    // Modellen skal ligge innenfor, ikke utenfor. Det var her det lineære
    // fase-leddet røk: Venus kom ut på −5,9, altså lysere enn Venus kan bli.
    const spenn = {}
    for (let d = 0; d < 800; d += 2) {
      const dato = new Date(Date.UTC(2026, 0, 1 + d))
      for (const id of ['merkur', 'venus', 'jupiter', 'saturn']) {
        const m = planetPosisjon(id, dato).mag
        const s = (spenn[id] ??= { min: 99, maks: -99 })
        s.min = Math.min(s.min, m)
        s.maks = Math.max(s.maks, m)
      }
    }
    // Venus: lysest på himmelen etter månen, men aldri lysere enn −4,9.
    expect(spenn.venus.min).toBeGreaterThan(-4.9)
    expect(spenn.venus.min).toBeLessThan(-4.3)
    expect(spenn.venus.maks).toBeLessThan(-3.5)
    // Jupiter: alltid blant de lyseste, aldri svakere enn en klar stjerne.
    expect(spenn.jupiter.min).toBeGreaterThan(-2.95)
    expect(spenn.jupiter.maks).toBeLessThan(-1.4)
    // Merkur svinger enormt fordi vi ser den både full og som sigd.
    expect(spenn.merkur.maks - spenn.merkur.min).toBeGreaterThan(5)
    // Saturn: vi ignorerer ringenes helling (±0,5 mag), så vårt spenn er
    // SMALERE enn det virkelige — det er en kjent forenkling, ikke en feil.
    expect(spenn.saturn.min).toBeGreaterThan(-0.6)
    expect(spenn.saturn.maks).toBeLessThan(1.6)
  })

  it('vinkeldiameteren er bueminutter, ikke grader', () => {
    // Jupiter er den største: 30–50 buesekund. Er tallet 0,5, har noen blandet
    // radius og diameter eller grader og radianer — og da tegnes en planet på
    // størrelse med månen.
    const j = planetPosisjon('jupiter', utc('2026-08-27'))
    expect(j.vinkelGrader * 3600).toBeGreaterThan(28)
    expect(j.vinkelGrader * 3600).toBeLessThan(52)
  })

  it('kaster på en ukjent planet framfor å svare med tull', () => {
    expect(() => planetPosisjon('pluto', new Date())).toThrow(/Ukjent planet/)
  })
})

describe('synligePlaneter', () => {
  const STED = { lat: 61.2, lon: 8.4 }

  it('utelater det som står for nær sola', () => {
    // Over et helt år skal ingen av de listede stå innenfor terskelen.
    for (let d = 0; d < 365; d += 7) {
      const dato = new Date(Date.UTC(2026, 0, 1 + d, 22))
      for (const p of synligePlaneter({ ...STED, dato })) {
        expect(p.elongasjon, p.navn).toBeGreaterThanOrEqual(MIN_ELONGASJON)
      }
    }
  })

  it('utelater det som står under horisonten', () => {
    for (let d = 0; d < 365; d += 7) {
      const dato = new Date(Date.UTC(2026, 0, 1 + d, 22))
      for (const p of synligePlaneter({ ...STED, dato })) {
        expect(p.hoyde, p.navn).toBeGreaterThan(0)
      }
    }
  })

  it('sorterer lysest først', () => {
    // Det er rekkefølgen man legger merke til dem i, og derfor rekkefølgen en
    // liste skal ha.
    for (let d = 0; d < 200; d += 11) {
      const liste = synligePlaneter({ ...STED, dato: new Date(Date.UTC(2026, 0, 1 + d, 22)) })
      for (let i = 1; i < liste.length; i++) {
        expect(liste[i].mag).toBeGreaterThanOrEqual(liste[i - 1].mag)
      }
    }
  })

  it('finner noe i løpet av et år', () => {
    // En himmel uten en eneste synlig planet gjennom et helt år ville betydd at
    // filteret er skrudd for hardt til.
    let treff = 0
    for (let d = 0; d < 365; d += 5) {
      treff += synligePlaneter({ ...STED, dato: new Date(Date.UTC(2026, 0, 1 + d, 22)) }).length
    }
    expect(treff).toBeGreaterThan(40)
  })

  it('svarer tomt uten sted framfor å gjette', () => {
    expect(synligePlaneter({ lat: NaN, lon: 8 })).toEqual([])
    expect(synligePlaneter({ lat: 61, lon: undefined })).toEqual([])
  })

  it('koordinatene er presessert, altså i samme ramme som stjernene', () => {
    // Uten dette ville planetene stått 16′ fra stjernene rundt seg — samme
    // feil som stjernene selv hadde til v6.0.0, bare motsatt vei.
    const dato = new Date('2026-08-27T22:00:00Z')
    const liste = synligePlaneter({ ...STED, dato })
    expect(liste.length).toBeGreaterThan(0)
    for (const p of liste) {
      const rå = planetPosisjon(p.id, dato)
      // Presesjonen flytter dem merkbart, men ikke langt.
      const flyttet = bueminutter(p.ra, p.dek, rå.ra, rå.dek)
      expect(flyttet, p.navn).toBeGreaterThan(5)
      expect(flyttet, p.navn).toBeLessThan(40)
    }
  })

  it('katalogen er de fem man ser med øyet', () => {
    expect(PLANETER.map((p) => p.id)).toEqual(['merkur', 'venus', 'mars', 'jupiter', 'saturn'])
    for (const p of PLANETER) {
      expect(p.navn).toBeTruthy()
      expect(p.farge).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.radiusKm).toBeGreaterThan(1000)
    }
    // Sola er ikke en planet, og Jorda er ikke synlig fra Jorda.
    expect(PLANETER.some((p) => p.id === 'jorda')).toBe(false)
    expect(solEkvatorial(new Date()).dek).toBeDefined()
  })
})
