// Skydottene skal ALDRI nå lerret-kanten.
//
// Dette er ikke en generisk grensetest. Fram til v5.20.2 tegnet cloudTexture()
// radielle gradienter på et 256 × 128-lerret med radier målt mot BREDDEN, så en
// dott på y = 47 med r = 54 rakk 7 px over kanten. `fillRect` klippet den og lot
// ~10 % alfa stå igjen i øverste teksel-rad — som med ClampToEdge-wrapping
// tegnes som en knivrett strek tvers over toppen av billboardet. Det var de lyse
// firkantene brukeren så i himmelen.
//
// Sjekken er på den RENE funksjonen (skyDotter), ikke på lerretet: den trenger
// ingen DOM, den kjører på hver seed, og den fanger feilen der den oppstår — i
// plasseringen, ikke i tegningen.
import { describe, it, expect } from 'vitest'
import { skyDotter, SKY_TEX_W, SKY_TEX_H, SKY_TEX_MARGIN } from './skyDome.js'

// Seedene cloudTexture faktisk bruker. Seed 29 var den som brakk: den brukes av
// sprite 2, 5, 8 … (materials[i % 3]), som er hvorfor bare NOEN skyer så kuttet
// ut — en detalj som gjorde feilen vanskelig å tro på.
const SEEDS = [7, 13, 29]
// Les de EKTE målene framfor å gjenta dem: testen skal måle det koden gjør, ikke
// det den gjorde da testen ble skrevet. Fram til v5.21.3 sto 160 hardkodet her
// mens koden var på vei tilbake til 128, og da hadde testen målt et lerret som
// ikke fantes.
const BREDDE = SKY_TEX_W
const HOYDE = SKY_TEX_H
const MARGIN = SKY_TEX_MARGIN

describe('skyflekk-lerretet', () => {
  it('har toerpotens i BEGGE retninger', () => {
    // Dette er regresjonen fra v5.20.2: høyden ble satt til 160 for å gi
    // blobbene luft. 160 er ikke en toerpotens, og på WebGL1 — som en del
    // Android-webviews fortsatt gir — resampler three.js NPOT-teksturer og
    // genererer mipmaps på resultatet. Det kan smøre alfa ut til kanten, og da
    // males HELE sprite-quaden som et blekt rektangel i himmelen. Feilen var
    // ikke synlig på skrivebordet; den ble oppdaget på en telefon i felt.
    const potens = (n) => n > 0 && (n & (n - 1)) === 0
    expect(potens(SKY_TEX_W), `bredden ${SKY_TEX_W} er ikke en toerpotens`).toBe(true)
    expect(potens(SKY_TEX_H), `høyden ${SKY_TEX_H} er ikke en toerpotens`).toBe(true)
  })

  it('er romslig nok til at dottene ikke klippes ned til ingenting', () => {
    // Toerpotens-kravet over må ikke «løses» ved å krympe lerretet til 256×16.
    for (const seed of SEEDS) {
      const r = skyDotter(seed).map((d) => d.r)
      expect(Math.max(...r)).toBeGreaterThan(20)
    }
  })
})

describe('skyDotter', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}: hver dott ligger helt innenfor lerretet med margin`, () => {
      const dotter = skyDotter(seed, { bredde: BREDDE, hoyde: HOYDE, margin: MARGIN })
      expect(dotter.length).toBeGreaterThan(0)
      for (const { x, y, r } of dotter) {
        // Gradienten går til alfa 0 ved radien, så det holder at sirkelen er
        // inne. Slakken på 0,01 er flyttall, ikke slingringsmonn.
        expect(x - r).toBeGreaterThanOrEqual(MARGIN - 0.01)
        expect(y - r).toBeGreaterThanOrEqual(MARGIN - 0.01)
        expect(x + r).toBeLessThanOrEqual(BREDDE - MARGIN + 0.01)
        expect(y + r).toBeLessThanOrEqual(HOYDE - MARGIN + 0.01)
      }
    })
  }

  it('er deterministisk — samme seed gir samme skyer', () => {
    // Skyene skal se like ut mellom økter; en ny RNG-rekkefølge her ville
    // endre alle tre teksturene stille.
    expect(skyDotter(29)).toEqual(skyDotter(29))
  })

  it('klipper radien i stedet for å slippe dotten ut av et smalt lerret', () => {
    // Det er selve mekanismen: på et lerret som er FOR lite for den ønskede
    // radien skal dotten bli mindre, ikke havne utenfor. Uten klippingen ville
    // disse radiene (opp mot 0,22 × bredden) stukket ut på alle kanter.
    const dotter = skyDotter(29, { bredde: 120, hoyde: 60, margin: 2 })
    for (const { x, y, r } of dotter) {
      expect(x - r).toBeGreaterThanOrEqual(2 - 0.01)
      expect(y - r).toBeGreaterThanOrEqual(2 - 0.01)
      expect(x + r).toBeLessThanOrEqual(118 + 0.01)
      expect(y + r).toBeLessThanOrEqual(58 + 0.01)
    }
  })
})
