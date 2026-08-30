// Faktamodulen. Alt her er DATA, og det er nettopp derfor den trenger tester:
// koden kan ikke kaste, så en manglende faktablokk viser seg som et tomt panel i
// mørket og ingenting annet. Testene svarer på ett spørsmål — får hvert legeme
// man kan trykke på faktisk noe å lese? — pluss at lenkene peker på riktige
// tjenester og at månelinja tåler alle tre tilfellene.
import { describe, it, expect } from 'vitest'
import { HIMMEL_FAKTA, MANETALL_AR, faktaFor, manerLinje } from './himmelFakta.js'
import { PLANETER } from './planeter.js'

const ALLE = Object.entries(HIMMEL_FAKTA)

describe('HIMMEL_FAKTA', () => {
  it('dekker sola, månen og HVER planet i planeter.js', () => {
    // Den ene invarianten som virkelig teller: legger noen til en planet i
    // himmelen, skal denne testen kreve fakta for den før den vises. Sola kom
    // inn i v6.5.6 og er ikke i PLANETER — den står derfor navngitt her, som
    // månen.
    const nokler = Object.keys(HIMMEL_FAKTA).sort()
    const ventet = ['sol', 'mane', ...PLANETER.map((p) => p.id)].sort()
    expect(nokler).toEqual(ventet)
  })

  it.each(ALLE)('%s har type, oppdaget, fakta og lenker', (_id, f) => {
    expect(f.type).toBeTruthy()
    expect(f.oppdaget).toBeTruthy()
    expect(f.fakta.length).toBeGreaterThanOrEqual(3)
    for (const linje of f.fakta) expect(linje.length).toBeGreaterThan(10)
    expect(f.snl).toMatch(/^https:\/\/snl\.no\//)
    expect(f.wikipedia).toMatch(/^https:\/\/no\.wikipedia\.org\/wiki\//)
  })

  it.each(ALLE)('%s har utforskningshistorie i kronologisk rekkefølge', (_id, f) => {
    expect(f.utforskning.length).toBeGreaterThanOrEqual(3)
    // Eldst først. Snudd rekkefølge er den ene feilen som ser helt normal ut i
    // et panel, og som gjør historien uleselig.
    const ar = f.utforskning.map((u) => Number(String(u.ar).slice(0, 4)))
    for (let i = 1; i < ar.length; i++) expect(ar[i]).toBeGreaterThanOrEqual(ar[i - 1])
    for (const u of f.utforskning) expect(u.tekst.length).toBeGreaterThan(20)
  })

  it('navngir Mars-roverne, som var det som ble bestilt', () => {
    const tekst = HIMMEL_FAKTA.mars.utforskning.map((u) => u.tekst).join(' ')
    for (const rover of ['Sojourner', 'Spirit', 'Opportunity', 'Curiosity', 'Perseverance', 'Zhurong']) {
      expect(tekst).toContain(rover)
    }
  })

  it('månetallene er merket med året de gjaldt', () => {
    // De endrer seg — nye småmåner blir funnet — så et tall uten år er et tall
    // som blir feil uten at noen merker det.
    expect(MANETALL_AR).toBeGreaterThanOrEqual(2025)
  })

  it('bruker ekte æ/ø/å og ikke escapede tegn i teksten', () => {
    const alt = JSON.stringify(ALLE.map(([, f]) => [f.type, f.fakta, f.utforskning]))
    expect(alt).not.toMatch(/\\u00[0-9a-f]{2}/i)
    expect(alt).toMatch(/[æøåÆØÅ]/)
  })
})

describe('faktaFor', () => {
  it('tar imot både månen og planet-prefikset', () => {
    expect(faktaFor({ type: 'mane', id: 'mane' })).toBe(HIMMEL_FAKTA.mane)
    expect(faktaFor({ type: 'planet', id: 'planet:mars' })).toBe(HIMMEL_FAKTA.mars)
  })

  it('gir null for stjernebilder og for tomt inn', () => {
    // Stjernebilder har sin egen tekst i stjernebildeInfo.js. Et tomt objekt
    // kommer før første valg er gjort.
    expect(faktaFor({ type: 'formasjon', id: 'karlsvogna' })).toBeNull()
    expect(faktaFor(null)).toBeNull()
    expect(faktaFor({})).toBeNull()
  })
})

describe('manerLinje', () => {
  it('null for et legeme som selv er en måne', () => {
    expect(manerLinje(null)).toBeNull()
    expect(manerLinje(HIMMEL_FAKTA.mane.maner)).toBeNull()
  })

  it('«Ingen måner» er et faktum og ikke en manglende verdi', () => {
    expect(manerLinje({ antall: 0, navn: [] })).toBe('Ingen måner')
  })

  it('lister alle når alle er navngitt', () => {
    expect(manerLinje({ antall: 2, navn: ['Phobos', 'Deimos'] }))
      .toBe('2 måner: Phobos og Deimos')
  })

  it('sier «de største» når bare noen er navngitt', () => {
    const l = manerLinje({ antall: 97, navn: ['Io', 'Europa', 'Ganymedes', 'Kallisto'] })
    expect(l).toContain('97 måner')
    expect(l).toContain('de største er Io, Europa, Ganymedes og Kallisto')
    // Ikke «de fire største»: et hardkodet mengdeord blir feil neste gang noen
    // legger til et navn.
    expect(l).not.toMatch(/de \w+ største/)
  })

  it('bøyer entall riktig', () => {
    expect(manerLinje({ antall: 1, navn: ['Titan'] })).toBe('1 måne: Titan')
  })

  it('tåler antall uten navn', () => {
    expect(manerLinje({ antall: 5, navn: [] })).toBe('5 måner')
    expect(manerLinje({ antall: 5 })).toBe('5 måner')
  })
})
