import { describe, it, expect } from 'vitest'
import { rammeBane, rammeHoyde, RAMME } from './snarveiRamme.js'

// Banen er en streng; testene leser den som TALL. En regex over `d` er det
// eneste som kan si om formen er riktig uten en nettleser, og en bane som
// folder seg er nøyaktig den feilen man ikke ser i en enhetstest som bare
// sjekker at strengen finnes.
//
// BANEN MÅ TOKENISERES, IKKE GREPES. Første utgave av denne hjelperen plukket
// «to tall etter hverandre» ut av `d`, og traff da radiene i hver `A`
// (`A 16 16 0 0 1 …`) som om de var et punkt. Testene ble røde på en riktig
// bane. En `A` har sju tall og bare de to SISTE er en posisjon.
function tegn(d) {
  const ut = []
  let x = 0
  let y = 0
  for (const m of d.matchAll(/([MHVAZ])\s*([-\d.\s]*)/gi)) {
    const tall = m[2].trim().split(/\s+/).filter(Boolean).map(Number)
    switch (m[1]) {
      case 'M': [x, y] = tall; break
      case 'H': [x] = tall; break
      case 'V': [y] = tall; break
      case 'A': [x, y] = tall.slice(-2); break
      default: continue
    }
    ut.push({ kmd: m[1], x, y })
  }
  return ut
}
const alleY = (d) => tegn(d).map((p) => p.y)

describe('rammeBane', () => {
  it('lukker banen og holder seg innenfor bredden', () => {
    const d = rammeBane({ w: 336, h: 120 })
    expect(d.endsWith('Z')).toBe(true)
    const xs = tegn(d).map((p) => p.x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(336)
  })

  it('lar bula henge under bunnlinja, og bare den', () => {
    const h = 120
    const d = rammeBane({ w: 336, h })
    const ys = alleY(d)
    // Dypeste punkt = bunnlinja + bulas dybde (minus halve streken).
    expect(Math.max(...ys)).toBeCloseTo(h - RAMME.strek / 2 + RAMME.buleDybde, 1)
    // Ingenting over toppen.
    expect(Math.min(...ys)).toBeCloseTo(RAMME.strek / 2, 1)
  })

  it('midtstiller bula', () => {
    const w = 336
    const d = rammeBane({ w, h: 120 })
    // Bulas flate bunn: de to punktene på det dypeste nivået. De skal ligge
    // symmetrisk om midten — måles på FLATA og ikke på inngangspunktene, som
    // ligger på ulike kommandoer i hver ende.
    const p = tegn(d)
    const dypest = Math.max(...p.map((q) => q.y))
    const bunn = p.filter((q) => Math.abs(q.y - dypest) < 0.01).map((q) => q.x)
    expect(bunn).toHaveLength(2)
    expect(Math.min(...bunn) + Math.max(...bunn)).toBeCloseTo(w, 1)
  })

  it('går ALDRI oppover inni bula — banen skal ikke folde seg', () => {
    // Feilen som ble rettet før den rakk å bli sendt: den konkave overgangen
    // kan ende dypere enn der bulas hjørne begynner, og da snur `V` oppover.
    // Det ser ut som et hakk i streken og er umulig å se i en `d`-streng man
    // bare kikker på. Klemmen `bd - t` finnes for dette.
    for (const skala of [1, 1.25, 1.5, 2]) {
      for (const w of [200, 336, 700]) {
        const d = rammeBane({ w, h: 120, skala })
        const p = tegn(d)
        // Fra den første konkave buen (inn i bula) til den flate bunnen skal
        // y aldri MINKE: hvert steg går nedover eller blir stående.
        const i0 = p.findIndex((q) => q.y > 120)
        const dypest = Math.max(...p.map((q) => q.y))
        const iBunn = p.findIndex((q) => Math.abs(q.y - dypest) < 0.01)
        expect(i0).toBeGreaterThan(0)
        for (let i = i0; i < iBunn; i++) {
          expect(p[i + 1].y, `skala ${skala}, w ${w}, steg ${i}`)
            .toBeGreaterThanOrEqual(p[i].y - 0.01)
        }
      }
    }
  })

  it('bruker sweep 0 på overgangene og sweep 1 på hjørnene', () => {
    // De to konkave buene er de eneste med sweep 0. Byttes de til 1, får man
    // et hakk i stedet for en flyt — og det leses som en tegnefeil.
    const d = rammeBane({ w: 336, h: 120 })
    expect([...d.matchAll(/A [\d.]+ [\d.]+ 0 0 0 /g)]).toHaveLength(2)
    expect([...d.matchAll(/A [\d.]+ [\d.]+ 0 0 1 /g)]).toHaveLength(6)
  })

  it('gir et rent avrundet rektangel uten bule (sorterings-modus)', () => {
    const d = rammeBane({ w: 336, h: 120, bule: 0 })
    expect([...d.matchAll(/A /g)]).toHaveLength(4)
    expect(Math.max(...alleY(d))).toBeLessThanOrEqual(120)
    expect(Math.max(...tegn(d).map((p) => p.x))).toBeLessThanOrEqual(336)
  })

  it('klemmer hjørnet og bula på en smal rad framfor å folde banen', () => {
    const d = rammeBane({ w: 90, h: 40 })
    expect(d).toBeTruthy()
    const xs = tegn(d).map((p) => p.x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...xs)).toBeLessThanOrEqual(90)
  })

  it('svarer null på en boks uten mål', () => {
    expect(rammeBane({ w: 0, h: 120 })).toBeNull()
    expect(rammeBane({ w: 336, h: 0 })).toBeNull()
  })

  it('holder S-en sammenhengende — overgang + hjørne ER dybden', () => {
    // Står de ikke i forhold, klemmer `rammeBane` og legger inn et lite rett
    // stykke midt i svingen. Formen tåler det, men den er ikke lenger den
    // sammenhengende kurven bula finnes for.
    expect(RAMME.overgang + RAMME.buleHjorne).toBe(RAMME.buleDybde)
  })
})

describe('rammeHoyde', () => {
  it('gir plass til bula og til hele streken', () => {
    expect(rammeHoyde(120)).toBeCloseTo(120 + RAMME.buleDybde + RAMME.strek, 5)
    expect(rammeHoyde(120, { skala: 2 })).toBeCloseTo(120 + RAMME.buleDybde * 2 + RAMME.strek, 5)
  })
  it('dropper bule-plassen når det ikke er noen bule', () => {
    expect(rammeHoyde(120, { bule: 0 })).toBeCloseTo(120 + RAMME.strek, 5)
  })
  it('svarer 0 på en boks uten høyde', () => {
    expect(rammeHoyde(0)).toBe(0)
  })
})
