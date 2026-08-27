import { describe, it, expect } from 'vitest'
import { STJERNEBILDE_INFO, infoFor } from './stjernebildeInfo.js'
import { FORMASJONER, STJERNER } from './stjerner.js'

// Denne testen finnes for ÉN feilmodus: baken lager id-ene av det norske
// navnet, og infoteksten er nøklet på dem. Døper noen om et stjernebilde,
// mister teksten formasjonen sin — og resultatet er et infopanel som åpner seg
// tomt, som ser ut som en feil i UI-et og ikke som et manglende oppslag.
describe('stjernebildeInfo mot FORMASJONER', () => {
  it('hver formasjon har en tekst', () => {
    for (const f of FORMASJONER) {
      expect(STJERNEBILDE_INFO[f.id], `mangler tekst for ${f.navn} (${f.id})`).toBeDefined()
    }
  })

  it('hver tekst har en formasjon', () => {
    const ider = new Set(FORMASJONER.map((f) => f.id))
    for (const id of Object.keys(STJERNEBILDE_INFO)) {
      expect(ider.has(id), `tekst for «${id}» hører til ingen formasjon`).toBe(true)
    }
  })

  it('det latinske navnet stemmer med baken', () => {
    // Latin står BÅDE i baken (som data, til søket) og her (til visning). To
    // steder med samme faktum er to steder som kan komme i utakt.
    for (const f of FORMASJONER) {
      expect(STJERNEBILDE_INFO[f.id].latin, f.navn).toBe(f.latin)
    }
  })

  it('alle feltene er fylt ut, og ingen er en stubb', () => {
    for (const [id, info] of Object.entries(STJERNEBILDE_INFO)) {
      // Latin er kort av natur («Leo»), så den måles bare på at den finnes.
      expect(typeof info.latin, `${id}.latin`).toBe('string')
      expect(info.latin.trim().length, `${id}.latin`).toBeGreaterThan(2)
      for (const felt of ['mytologi', 'funFact', 'finnDen']) {
        expect(typeof info[felt], `${id}.${felt}`).toBe('string')
        expect(info[felt].trim().length, `${id}.${felt} er for kort`).toBeGreaterThan(30)
      }
      // Og ikke for lang: panelet ligger over kartet på en telefon.
      expect(info.mytologi.length, `${id}.mytologi`).toBeLessThan(400)
      expect(info.funFact.length, `${id}.funFact`).toBeLessThan(600)
      expect(info.finnDen.length, `${id}.finnDen`).toBeLessThan(400)
    }
  })

  it('teksten nevner stjerner vi faktisk tegner', () => {
    // En «finnDen» som peker på en stjerne vi ikke har, er en instruks brukeren
    // ikke kan følge. Vi krever at hver formasjon nevner minst én av sine EGNE
    // navngitte stjerner et sted i teksten.
    for (const f of FORMASJONER) {
      const info = STJERNEBILDE_INFO[f.id]
      const egne = f.stjerner.map((i) => STJERNER[i].navn).filter(Boolean)
      if (!egne.length) continue
      const alt = `${info.mytologi} ${info.funFact} ${info.finnDen}`
      const nevnt = egne.some((navn) => alt.includes(navn))
      expect(nevnt, `${f.navn} nevner ingen av sine egne stjerner: ${egne.join(', ')}`)
        .toBe(true)
    }
  })

  it('infoFor svarer null på ukjent id framfor å kaste', () => {
    expect(infoFor('karlsvogna')).toBeTruthy()
    expect(infoFor('sagittarius')).toBeNull()
    expect(infoFor(undefined)).toBeNull()
  })
})
