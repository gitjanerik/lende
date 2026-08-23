// Demo-runden. Testen verner REKKEFØLGEN, som er det eneste her som kan bli
// «ryddet» i god tro: stegene står slik at naboene er sammenliknbare, og en
// alfabetisk sortering ville ødelagt hele poenget med demoen.
import { describe, it, expect } from 'vitest'
import { DEMO_STEG, DEMO_SEKUNDER, demoMaling } from './vaerDemo.js'
import { vaerTilHimmel } from './vaerHimmel.js'

describe('DEMO_STEG', () => {
  it('trapper skydekket OPP i de første stegene', () => {
    // klart → lettskyet → delvis → overskyet. Poenget er at man ser forskjellen
    // mellom naboer; en omstokking gjør runden til støy.
    const d = DEMO_STEG.slice(0, 4).map((s) => vaerTilHimmel(s.kode, demoMaling(s)).dekning)
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1])
  })

  it('setter torden RETT ETTER regnet den skal skille seg fra', () => {
    const i = DEMO_STEG.findIndex((s) => vaerTilHimmel(s.kode, demoMaling(s)).torden)
    expect(i).toBeGreaterThan(0)
    const forrige = vaerTilHimmel(DEMO_STEG[i - 1].kode, demoMaling(DEMO_STEG[i - 1]))
    expect(forrige.nedbor).toBe('regn')
  })

  it('viser vind som TO steg med samme skydekke og ulik fart', () => {
    // Vind har ikke noe eget utseende — bare fart og retning. Den eneste måten
    // å se den er å holde alt annet fast og endre farten.
    const vind = DEMO_STEG.filter((s) => s.vindMs != null)
    expect(vind.length).toBeGreaterThanOrEqual(2)
    const siste = vind.slice(-2)
    expect(siste[0].kode).toBe(siste[1].kode)
    const f = siste.map((s) => vaerTilHimmel(s.kode, demoMaling(s)).driftFart)
    expect(f[1]).toBeGreaterThan(f[0])
  })

  it('dekker alle nedbørstypene', () => {
    const typer = new Set(DEMO_STEG.map((s) => vaerTilHimmel(s.kode, demoMaling(s)).nedbor))
    expect(typer.has('regn')).toBe(true)
    expect(typer.has('sno')).toBe(true)
    expect(typer.has(null)).toBe(true)
  })

  it('gir hvert steg et navn, og en runde som er til å stå gjennom', () => {
    for (const s of DEMO_STEG) expect(s.navn).toBeTruthy()
    // 12 steg × 10 s = to minutter. Blir runden mye lengre, ser ingen slutten.
    expect(DEMO_STEG.length * DEMO_SEKUNDER).toBeLessThanOrEqual(150)
  })

  it('gir alle steg gyldige måleverdier', () => {
    for (const s of DEMO_STEG) {
      const m = demoMaling(s)
      expect(Number.isFinite(m.vindMs)).toBe(true)
      expect(Number.isFinite(m.vindRetningGrader)).toBe(true)
    }
  })
})
