import { describe, it, expect } from 'vitest'
import { STJERNER, LINJER, STJERNEBILDER } from './stjerner.js'

// Katalogen er GENERERT (scripts/bygg-stjerner.mjs), så dette er ikke en test av
// kode — det er en test av at baken ga et brukbart datasett. To ting kan gå galt
// uten at noe ser ødelagt ut: koordinater i feil enhet (grader der det skal være
// timer er den klassiske), og linjer som peker på indekser som har flyttet seg
// fordi utvalget endret seg. Begge gir en himmel som ser ut som en himmel.
describe('stjernekatalogen', () => {
  it('har nok stjerner til å bære en himmel', () => {
    expect(STJERNER.length).toBeGreaterThan(100)
    // Taket er lesbarhet, ikke ytelse: 6,5 mag er øyets grense og gir 9 000
    // stjerner, som blir en grå støymatte på en telefonskjerm.
    expect(STJERNER.length).toBeLessThan(400)
  })

  it('holder seg innenfor gyldige koordinater', () => {
    for (const s of STJERNER) {
      expect(s.ra, `ra for ${s.navn ?? '?'}`).toBeGreaterThanOrEqual(0)
      expect(s.ra, `ra for ${s.navn ?? '?'}`).toBeLessThan(24)
      expect(Math.abs(s.dek), `dek for ${s.navn ?? '?'}`).toBeLessThanOrEqual(90)
      expect(Number.isFinite(s.mag)).toBe(true)
      expect(s.mag).toBeLessThan(5)
    }
  })

  it('er sortert på rektascensjon, så nye stjerner ikke flytter alle indeksene', () => {
    for (let i = 1; i < STJERNER.length; i++) {
      expect(STJERNER[i].ra).toBeGreaterThanOrEqual(STJERNER[i - 1].ra)
    }
  })

  // Fire stjerner med koordinater det går an å slå opp hvor som helst. Er
  // enheten forvekslet (grader i stedet for timer), eller er katalogen byttet
  // mot en annen epoke, faller disse.
  it('har kjente stjerner på kjent plass (J2000)', () => {
    const finn = (navn) => STJERNER.find((s) => s.navn === navn)
    const fasit = [
      ['Polaris', 2.5303, 89.2641, 1.97],
      ['Vega', 18.6156, 38.7837, 0.03],
      ['Sirius', 6.7525, -16.7161, -1.44],
      ['Betelgeuse', 5.9195, 7.4071, 0.45],
      ['Arcturus', 14.2610, 19.1825, -0.05],
      ['Deneb', 20.6905, 45.2803, 1.25],
    ]
    for (const [navn, ra, dek, mag] of fasit) {
      const s = finn(navn)
      expect(s, navn).toBeDefined()
      expect(s.ra, `${navn} ra`).toBeCloseTo(ra, 2)
      expect(s.dek, `${navn} dek`).toBeCloseTo(dek, 2)
      expect(s.mag, `${navn} mag`).toBeCloseTo(mag, 1)
    }
  })

  it('har de sju stjernene i Karlsvogna', () => {
    // Karlsvogna er den ene figuren alle kjenner igjen, og derfor den som
    // avslører en himmel som er nesten riktig.
    const navn = ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alkaid']
    for (const n of navn) {
      expect(STJERNER.some((s) => s.navn === n), n).toBe(true)
    }
  })
})

describe('stjernebilde-linjene', () => {
  it('peker på stjerner som finnes', () => {
    expect(LINJER.length).toBeGreaterThan(40)
    for (const [a, b] of LINJER) {
      expect(Number.isInteger(a)).toBe(true)
      expect(Number.isInteger(b)).toBe(true)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(STJERNER.length)
      expect(b).toBeLessThan(STJERNER.length)
      expect(a).not.toBe(b)
    }
  })

  it('tegner korte streker, ikke linjer tvers over himmelen', () => {
    // En feilpekende indeks gir oftest en strek på tvers av hele himmelen.
    // Ingen av figurene våre har en arm lengre enn 40°.
    for (const [a, b] of LINJER) {
      const p = STJERNER[a]
      const q = STJERNER[b]
      const rad = Math.PI / 180
      const cos = Math.sin(p.dek * rad) * Math.sin(q.dek * rad)
        + Math.cos(p.dek * rad) * Math.cos(q.dek * rad) * Math.cos((p.ra - q.ra) * 15 * rad)
      const grader = Math.acos(Math.max(-1, Math.min(1, cos))) / rad
      expect(grader, `${p.navn ?? a} → ${q.navn ?? b}`).toBeLessThan(40)
      expect(grader).toBeGreaterThan(0.5)
    }
  })

  it('navngir stjernebildene den tegner', () => {
    expect(STJERNEBILDER.length).toBeGreaterThan(8)
    expect(STJERNEBILDER).toContain('Karlsvogna')
    expect(STJERNEBILDER).toContain('Orion')
  })
})
