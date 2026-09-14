import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { KART_SKIVE, KART_BLEKK, kartSkive, kartBlekk } from './kartFlate.js'
import { overBunn, kontrast } from './uiKontrast.js'
import { erMorktTema } from './mapSettingsApply.js'
import isomCatalog from './isomCatalog.json'

// Skiva som `rgba(r,g,b,a)` → { hex, alfa }, så `overBunn` kan komponere den
// mot en ekte kart-bunn. Regexen er streng med vilje: en skrivefeil i tabellen
// skal bli en feil her og ikke en stille NaN-kontrast, samme regel som
// `hexTilRgb` har i uiKontrast.
function delSkive(rgba) {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba)
  if (!m) throw new Error(`Ugyldig skive: ${rgba}`)
  const t = (n) => Number(n).toString(16).padStart(2, '0')
  return { hex: `#${t(m[1])}${t(m[2])}${t(m[3])}`, alfa: Number(m[4]) }
}

// Alle bunnene et ark faktisk kan ha, klassifisert med den SAMME regelen som
// avgjør hvilken skive som brukes (`erMorktTema` → `mork`-propen). Legger noen
// til et tema med en ytterligere bunn, måles det av seg selv.
function bunnerPerValor() {
  const ut = { lys: [], mork: [] }
  const nokler = ['', ...Object.keys(isomCatalog.themes ?? {})]
  for (const k of nokler) {
    const bg = isomCatalog.themes?.[k]?.background ?? isomCatalog.background?.color
    if (typeof bg !== 'string' || !/^#[0-9a-f]{6}$/i.test(bg.trim())) continue
    ut[erMorktTema(k, isomCatalog) ? 'mork' : 'lys'].push(bg.trim())
  }
  return ut
}

describe('kartFlate', () => {
  it('velger skive og blekk etter ARKETS valør', () => {
    expect(kartSkive(false)).toBe(KART_SKIVE.lys)
    expect(kartSkive(true)).toBe(KART_SKIVE.mork)
    expect(kartBlekk(false)).toBe(KART_BLEKK.lys)
    expect(kartBlekk(true)).toBe(KART_BLEKK.mork)
  })

  it('holder på kompassnålas verdier fra v6.5.67', () => {
    // Paret ble flyttet UT av KompassKnapp og inn hit da snarvei-raden skulle
    // bruke det samme (v7.8.18). Flyttingen skulle ikke endre noe man ser, så
    // verdiene står her som en fasit — endres de, er det et bevisst valg.
    expect(KART_SKIVE.lys).toBe('rgba(255,255,255,0.82)')
    expect(KART_SKIVE.mork).toBe('rgba(63,63,70,0.82)')
    expect(KART_BLEKK.lys.ink).toBe('#1c1917')
    expect(KART_BLEKK.mork.ink).toBe('#e4e4e7')
  })

  it('lar skiva være GJENNOMSIKTIG — en opak flate er en klistrelapp', () => {
    for (const rgba of Object.values(KART_SKIVE)) {
      const { alfa } = delSkive(rgba)
      expect(alfa).toBeGreaterThan(0.5)
      expect(alfa).toBeLessThan(1)
    }
  })

  it('gir hvert blekk-nivå minst 4,5:1 mot den VERSTE kart-bunnen', () => {
    // Skiva er halvgjennomsiktig, så kontrasten avhenger av arket under. Målt
    // mot alle bunnene katalogen har — den mørkeste av de lyse (turkart,
    // #dbe8c2) og den lyseste av de mørke (mocha, #39210e) er de som biter.
    const bunner = bunnerPerValor()
    expect(bunner.lys.length).toBeGreaterThan(0)
    expect(bunner.mork.length).toBeGreaterThan(0)
    for (const valor of ['lys', 'mork']) {
      const { hex, alfa } = delSkive(KART_SKIVE[valor])
      for (const bunn of bunner[valor]) {
        const flate = overBunn(hex, alfa, bunn)
        for (const [niva, farge] of Object.entries(KART_BLEKK[valor])) {
          const k = kontrast(farge, flate)
          expect(k, `${valor}/${niva} på ${flate} (ark ${bunn})`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('holder nivåene i rekkefølge — ink er sterkest, ink3 svakest', () => {
    // Et hierarki som ikke er monotont er ikke et hierarki: uten dette kan to
    // nivåer bytte plass i en fargejustering uten at noe annet sier fra.
    for (const valor of ['lys', 'mork']) {
      const { hex, alfa } = delSkive(KART_SKIVE[valor])
      const flate = overBunn(hex, alfa, valor === 'lys' ? '#fefae0' : '#0e1116')
      const { ink, ink2, ink3 } = KART_BLEKK[valor]
      expect(kontrast(ink, flate)).toBeGreaterThan(kontrast(ink2, flate))
      expect(kontrast(ink2, flate)).toBeGreaterThan(kontrast(ink3, flate))
    }
  })

  it('er den ENESTE kilden — verken nåla eller raden skriver fargene selv', () => {
    // Poenget med modulen er at de to flatene ikke kan sprike igjen. En
    // gjeninnført literal i en av komponentene er nettopp den drivingen dette
    // finnes for å hindre, og den ville ikke gitt utslag noe annet sted.
    for (const fil of ['../components/KompassKnapp.vue', '../components/SnarveiRad.vue']) {
      const kilde = readFileSync(new URL(fil, import.meta.url), 'utf8')
      expect(kilde, fil).toContain('kartFlate.js')
      expect(kilde, fil).not.toMatch(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.82\s*\)/)
      expect(kilde, fil).not.toMatch(/rgba\(\s*63\s*,\s*63\s*,\s*70\s*,\s*0\.82\s*\)/)
    }
  })
})
