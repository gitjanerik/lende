import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  hexTilOklch, oklchTilHex, utenforGamut, aksentFlate,
  AKSENT_FLATER, AKSENT_MENY, MENY_FLATER, MENY_TEKST, MENY_TEKSTFLATER,
} from './systemAksent.js'
import { kontrast, UI_FLATER, UI_TEKST, AA_NORMAL } from './uiKontrast.js'

const css = readFileSync(fileURLToPath(new URL('../style.css', import.meta.url)), 'utf-8')
const meny = readFileSync(fileURLToPath(new URL('../components/AppMenu.vue', import.meta.url)), 'utf-8')

// Sveipen. 1° er finere enn øyet trenger, men billig — og en klemt metning har
// sitt verste punkt på en enkelt kulør (blått rundt 265°), så et grovt raster
// kan gå rett forbi den.
const KULORER = Array.from({ length: 360 }, (_, i) => i)

describe('OKLCH-omregningen', () => {
  // FASIT FRA NETTLESEREN, ikke fra en andre implementasjon av samme matte:
  // hver rad er malt i Chromium 141 (canvas + getImageData) og limt inn. En
  // egenskrevet fargekonvertering kan være helt internt konsistent og likevel
  // male noe annet enn nettleseren, og det er nøyaktig det som må stemme her.
  const MALT = [
    [0.1767, 0.0114, 260.6, '#0e1116'],   // dagens --color-app, mørkt
    [0.9382, 0.0144, 84.6, '#efeae0'],    // dagens --color-app, lyst
    [0.1767, 0.0280, 255.5, '#08111d'],
    [0.2103, 0.0280, 255.5, '#101925'],
    [0.2739, 0.0280, 255.5, '#1e2835'],
    [0.9382, 0.0220, 255.5, '#e1ecfa'],
    [0.9382, 0.0220, 30, '#f9e6e2'],
    [0.9382, 0.0220, 150, '#e1efe3'],
    [0.2739, 0.0280, 150, '#1d2b20'],
    [0.1767, 0.0280, 90, '#161003'],
  ]

  it('maler det nettleseren maler', () => {
    for (const [l, c, h, hex] of MALT) {
      expect(oklchTilHex(l, c, h), `oklch(${l} ${c} ${h})`).toBe(hex)
    }
  })

  it('er ankret i ytterpunktene', () => {
    expect(hexTilOklch('#ffffff').l).toBeCloseTo(1, 4)
    expect(hexTilOklch('#000000').l).toBeCloseTo(0, 4)
    expect(hexTilOklch('#ffffff').c).toBeCloseTo(0, 4)
    expect(oklchTilHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchTilHex(0, 0, 0)).toBe('#000000')
  })

  it('kaster på ugyldig hex framfor å gi NaN', () => {
    expect(() => hexTilOklch('#abc')).toThrow()
    expect(() => hexTilOklch('blå')).toThrow()
  })
})

describe('systemaksentens flate-tokens', () => {
  it('bærer NØYAKTIG dagens lyshet — tonen er kulør, ikke lysstyrke', () => {
    for (const [tema, flater] of Object.entries(AKSENT_FLATER)) {
      for (const [flate, t] of Object.entries(flater)) {
        const fra = hexTilOklch(UI_FLATER[tema][flate]).l
        expect(Number(fra.toFixed(4)), `${tema}/${flate}`).toBeCloseTo(t.l, 4)
      }
    }
  })

  it('gir dagens flate tilbake når aksenten er akromatisk', () => {
    // c = 0 i `min(c, tak)` betyr at brukeren har slått fargen av i systemet.
    // Da skal tonen være grå — ikke rød, som et fast metningstall ville gitt.
    for (const [tema, flater] of Object.entries(AKSENT_FLATER)) {
      for (const flate of Object.keys(flater)) {
        const { l, c } = hexTilOklch(oklchTilHex(AKSENT_FLATER[tema][flate].l, 0, 0))
        expect(c, `${tema}/${flate} metning`).toBeLessThan(0.002)
        expect(l, `${tema}/${flate} lyshet`).toBeCloseTo(AKSENT_FLATER[tema][flate].l, 2)
      }
    }
  })

  it('ligger innenfor sRGB for HVER kulør, så alle motorer maler likt', () => {
    // Utenfor sRGB spriker nettleserne: Chromium klipper per kanal, CSS Color 4
    // foreskriver metnings-reduksjon. Holder vi oss innenfor, finnes ikke
    // forskjellen.
    for (const [tema, flater] of Object.entries(AKSENT_FLATER)) {
      for (const [flate, t] of Object.entries(flater)) {
        for (const h of KULORER) {
          expect(utenforGamut(t.l, t.c, h), `${tema}/${flate} ved ${h}°`).toBeLessThan(0.5)
        }
      }
    }
  })

  it('rent hvitt bærer ingen tone — det er ikke plass til noen', () => {
    // Ved L = 1 er taket 0,0002. En tone der ville per konstruksjon havnet
    // utenfor sRGB, så de to flatene står hvite og det er en MÅLING, ikke en
    // forglemmelse.
    expect(UI_FLATER.light['surface-2']).toBe('#ffffff')
    expect(UI_FLATER.light.overlay).toBe('#ffffff')
    expect(AKSENT_FLATER.light['surface-2'].c).toBe(0)
    expect(AKSENT_FLATER.light.overlay.c).toBe(0)
  })
})

describe('kontrasten holder uansett hvilken farge brukeren har valgt', () => {
  it('klarer AA for alle fire tekstnivåer, alle flater, alle 360 kulører', () => {
    let verst = { forhold: Infinity }
    for (const [tema, flater] of Object.entries(AKSENT_FLATER)) {
      for (const flate of Object.keys(flater)) {
        for (const h of KULORER) {
          const bunn = aksentFlate(tema, flate, h)
          for (const [nivaa, farge] of Object.entries(UI_TEKST[tema])) {
            const forhold = kontrast(farge, bunn)
            if (forhold < verst.forhold) verst = { forhold, tema, flate, nivaa, h, bunn }
          }
        }
      }
    }
    expect(verst.forhold, `verste: ${verst.tema}/${verst.nivaa} på ${verst.flate} `
      + `ved ${verst.h}° (${verst.bunn})`).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('er ikke dårligere enn den utonede UI-en', () => {
    // Gulvet er ink-4, som er valgt til å ligge rett over AA. Tonen skal ikke
    // spise av den marginen — den flytter kulør, ikke lyshet.
    const bunnUtonet = Math.min(...Object.entries(UI_TEKST).flatMap(([tema, nivaaer]) =>
      Object.values(nivaaer).flatMap((f) =>
        Object.values(UI_FLATER[tema]).map((b) => kontrast(f, b)))))
    const bunnTonet = Math.min(...Object.entries(AKSENT_FLATER).flatMap(([tema, flater]) =>
      Object.keys(flater).flatMap((flate) =>
        KULORER.flatMap((h) => Object.values(UI_TEKST[tema])
          .map((f) => kontrast(f, aksentFlate(tema, flate, h)))))))
    expect(bunnTonet).toBeGreaterThan(bunnUtonet - 0.1)
  })
})

describe('style.css speiler tabellen', () => {
  // Samme gate som i uiKontrast.test.js, og av samme grunn: uten den kunne
  // taket endres i CSS-en mens testen fortsatte å måle det gamle — altså en
  // grønn sjekk på farger ingen ser.
  const blokk = css.slice(css.indexOf('@supports (color: oklch(from AccentColor'))
  // Per tema, ikke samlet: mørkt `--color-surface-2` HAR tone, lyst har ikke,
  // og en søk-etter-streng over hele blokka kan ikke skille dem.
  const DEL = {
    dark: blokk.slice(blokk.indexOf(':root, :root[data-theme="dark"]'),
      blokk.indexOf(':root[data-theme="light"]')),
    light: blokk.slice(blokk.indexOf(':root[data-theme="light"]')),
  }

  it('har @supports-porten, og den tester den FAKTISKE verdien', () => {
    // Firefox har hatt AccentColor siden 103, men relativ fargesyntaks først
    // fra 128. En port på `(color: AccentColor)` alene ville sluppet gjennom
    // en deklarasjon nettleseren ikke kan lese.
    expect(css).toContain('@supports (color: oklch(from AccentColor 0.5 min(c, 0.02) h))')
  })

  it('bærer nøyaktig de lyshetene og takene tabellen har', () => {
    for (const [tema, flater] of Object.entries(AKSENT_FLATER)) {
      for (const [flate, t] of Object.entries(flater)) {
        const linje = `--color-${flate}: oklch(from AccentColor ${t.l} min(c, ${t.c}) h);`
        if (t.c === 0) {
          expect(DEL[tema], `${tema}/${flate} skal stå UTEN tone`).not.toContain(`--color-${flate}: oklch(`)
        } else {
          expect(DEL[tema], `${tema}/${flate}`).toContain(linje)
        }
      }
    }
  })
})

describe('hovedmenyens egen palett', () => {
  it('bærer NØYAKTIG dagens lyshet', () => {
    for (const [tema, flater] of Object.entries(AKSENT_MENY)) {
      for (const [flate, t] of Object.entries(flater)) {
        const fra = hexTilOklch(MENY_FLATER[tema][flate]).l
        expect(Number(fra.toFixed(4)), `${tema}/--am-${flate}`).toBeCloseTo(t.l, 4)
      }
    }
  })

  it('ligger innenfor sRGB for HVER kulør', () => {
    for (const [tema, flater] of Object.entries(AKSENT_MENY)) {
      for (const [flate, t] of Object.entries(flater)) {
        for (const h of KULORER) {
          expect(utenforGamut(t.l, t.c, h), `${tema}/--am-${flate} ved ${h}°`).toBeLessThan(0.5)
        }
      }
    }
  })

  it('klarer AA for menytekst mot alle tre tekstflater, alle 360 kulører', () => {
    // `--am-line` er ikke med: den er en skillelinje og bærer aldri tekst.
    let verst = { forhold: Infinity }
    for (const [tema, flater] of Object.entries(AKSENT_MENY)) {
      for (const flate of MENY_TEKSTFLATER) {
        expect(flater[flate], `${tema}/--am-${flate}`).toBeTruthy()
        for (const h of KULORER) {
          const bunn = aksentFlate(tema, flate, h, AKSENT_MENY)
          for (const [nivaa, farge] of Object.entries(MENY_TEKST[tema])) {
            const forhold = kontrast(farge, bunn)
            if (forhold < verst.forhold) verst = { forhold, tema, flate, nivaa, h, bunn }
          }
        }
      }
    }
    expect(verst.forhold, `verste: ${verst.tema}/--am-${verst.nivaa} på `
      + `--am-${verst.flate} ved ${verst.h}° (${verst.bunn})`).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  it('speiler AppMenu.vue sine tekstfarger', () => {
    for (const [tema, nivaaer] of Object.entries(MENY_TEKST)) {
      for (const [nivaa, farge] of Object.entries(nivaaer)) {
        expect(meny, `${tema}/--am-${nivaa}`).toContain(`--am-${nivaa}: ${farge};`)
      }
    }
  })

  it('AppMenu.vue speiler tabellen', () => {
    const blokk = meny.slice(meny.indexOf('@supports (color: oklch(from AccentColor'))
    expect(blokk, 'porten').toContain('@supports (color: oklch(from AccentColor 0.5 min(c, 0.02) h))')
    const DEL = {
      dark: blokk.slice(blokk.indexOf('  .app-menu {'), blokk.indexOf(':root[data-theme="light"] .app-menu')),
      light: blokk.slice(blokk.indexOf(':root[data-theme="light"] .app-menu')),
    }
    for (const [tema, flater] of Object.entries(AKSENT_MENY)) {
      for (const [flate, t] of Object.entries(flater)) {
        expect(DEL[tema], `${tema}/--am-${flate}`)
          .toContain(`--am-${flate}: oklch(from AccentColor ${t.l} min(c, ${t.c}) h);`)
      }
    }
  })

  it('lar tekst og aksent stå utonet', () => {
    const blokk = meny.slice(meny.indexOf('@supports (color: oklch(from AccentColor'))
    for (const token of ['--am-text', '--am-dim', '--am-accent', '--am-on-accent', '--am-ring']) {
      expect(blokk, `${token} skal ikke tones`).not.toContain(`${token}: oklch(`)
    }
  })
})
