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
import { skyDotter } from './skyDome.js'

// Seedene cloudTexture faktisk bruker. Seed 29 var den som brakk: den brukes av
// sprite 2, 5, 8 … (materials[i % 3]), som er hvorfor bare NOEN skyer så kuttet
// ut — en detalj som gjorde feilen vanskelig å tro på.
const SEEDS = [7, 13, 29]
const BREDDE = 256
const HOYDE = 160
const MARGIN = 4

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
