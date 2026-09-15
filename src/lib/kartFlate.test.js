import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  KART_SKIVE, KART_SKIVE_LETT, KART_BLEKK, kartSkive, kartSkiveLett, kartBlekk,
} from './kartFlate.js'
import { overBunn, kontrast, relativLuminans } from './uiKontrast.js'
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

  it('holder verdiene som fasit — de endres bare med vilje', () => {
    // Paret ble flyttet UT av KompassKnapp og inn hit i v7.8.18, og den
    // flyttingen skulle ikke endre noe man ser. Den MØRKE valøren er siden
    // endret bevisst (v7.8.20): zink-700 med off-white blekk var to nabotoner i
    // samme grå familie, og det leses som en avslått kontroll uansett hva
    // kontrasttallene sier. Flata er dypere og blekket nær hvitt.
    expect(KART_SKIVE.lys).toBe('rgba(255,255,255,0.82)')
    expect(KART_SKIVE.mork).toBe('rgba(26,26,30,0.82)')
    expect(KART_BLEKK.lys.ink).toBe('#1c1917')
    expect(KART_BLEKK.mork.ink).toBe('#f4f4f5')
    // Den LETTE gikk fra 0,55 til 0,68 i v7.8.23. Testen under måler bare mot
    // kart-BUNNEN, og et stort stedsnavn er nettopp unntaket den ikke ser — så
    // verdien er valgt i felt og står som fasit her, ikke som et resultat.
    expect(KART_SKIVE_LETT.lys).toBe('rgba(255,255,255,0.68)')
    expect(KART_SKIVE_LETT.mork).toBe('rgba(26,26,30,0.68)')
  })

  it('gir den LETTE skiva mer gjennomsiktighet enn nålas, i begge valører', () => {
    // Hele grunnen til at det finnes to vekter: alfa oppleves etter AREAL.
    // Blir de like, er den store flata tung igjen — og da har `kartSkiveLett`
    // ingen jobb og kan like gjerne slettes.
    for (const valor of ['lys', 'mork']) {
      expect(delSkive(KART_SKIVE_LETT[valor]).alfa)
        .toBeLessThan(delSkive(KART_SKIVE[valor]).alfa)
      // SAMME KULØR, bare lettere. To ulike toner ville vært to materialer, og
      // da ville raden og nåla sprike igjen — det v7.8.18 nettopp ryddet.
      expect(delSkive(KART_SKIVE_LETT[valor]).hex).toBe(delSkive(KART_SKIVE[valor]).hex)
    }
    expect(kartSkiveLett(false)).toBe(KART_SKIVE_LETT.lys)
    expect(kartSkiveLett(true)).toBe(KART_SKIVE_LETT.mork)
  })

  it('holder blekket UNNA flatas egen tone i mørk valør (v7.8.20)', () => {
    // «Disabled»-inntrykket er ikke et kontrast-tall, det er en FAMILIE-likhet:
    // en midtgrå flate med en litt lysere grå tekst leses som nedtonet innhold.
    // Testen holder de to fra hverandre der det faktisk skjedde — blekket skal
    // ligge nær hvitt, ikke midt imellom.
    const flate = relativLuminans(delSkive(KART_SKIVE.mork).hex)
    const blekk = relativLuminans(KART_BLEKK.mork.ink)
    expect(blekk).toBeGreaterThan(0.8)
    expect(flate).toBeLessThan(0.05)
  })

  it('lar skiva være GJENNOMSIKTIG — en opak flate er en klistrelapp', () => {
    for (const rgba of Object.values(KART_SKIVE)) {
      const { alfa } = delSkive(rgba)
      expect(alfa).toBeGreaterThan(0.5)
      expect(alfa).toBeLessThan(1)
    }
  })

  it('gir hvert blekk-nivå minst 4,5:1 mot den VERSTE kart-bunnen — BEGGE vektene', () => {
    // Skiva er halvgjennomsiktig, så kontrasten avhenger av arket under. Målt
    // mot alle bunnene katalogen har — den mørkeste av de lyse (turkart,
    // #dbe8c2) og den lyseste av de mørke (mocha, #39210e) er de som biter.
    const bunner = bunnerPerValor()
    expect(bunner.lys.length).toBeGreaterThan(0)
    expect(bunner.mork.length).toBeGreaterThan(0)
    // BEGGE vektene måles: den lette slipper mer av arket igjennom, så det er
    // DEN som først kommer i klem — og den er den store flata folk leser.
    for (const [vekt, tab] of [['nål', KART_SKIVE], ['lett', KART_SKIVE_LETT]]) {
      for (const valor of ['lys', 'mork']) {
        const { hex, alfa } = delSkive(tab[valor])
        for (const bunn of bunner[valor]) {
          const flate = overBunn(hex, alfa, bunn)
          for (const [niva, farge] of Object.entries(KART_BLEKK[valor])) {
            const k = kontrast(farge, flate)
            expect(k, `${vekt}/${valor}/${niva} på ${flate} (ark ${bunn})`)
              .toBeGreaterThanOrEqual(4.5)
          }
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
      expect(kilde, fil).not.toMatch(/rgba\(\s*26\s*,\s*26\s*,\s*30\s*,/)
    }
  })
})
