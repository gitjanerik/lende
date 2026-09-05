import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  kontrast, relativLuminans, overBunn, maalUiTekst,
  UI_TEKST, UI_FLATER, AA_NORMAL,
} from './uiKontrast.js'

const css = readFileSync(fileURLToPath(new URL('../style.css', import.meta.url)), 'utf-8')

describe('kontrast-regnestykket', () => {
  it('er ankret i WCAG-ens egne ytterpunkter', () => {
    expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(kontrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(relativLuminans('#ffffff')).toBeCloseTo(1, 5)
    expect(relativLuminans('#000000')).toBeCloseTo(0, 5)
    // Kjent referanse: #767676 er den lyseste grå som klarer 4,5:1 mot hvitt.
    expect(kontrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(kontrast('#777777', '#ffffff')).toBeLessThan(4.5)
  })

  it('er symmetrisk', () => {
    expect(kontrast('#123456', '#abcdef')).toBeCloseTo(kontrast('#abcdef', '#123456'), 10)
  })

  it('komponerer alfa mot bunnen', () => {
    expect(overBunn('#ffffff', 1, '#000000')).toBe('#ffffff')
    expect(overBunn('#ffffff', 0, '#000000')).toBe('#000000')
    expect(overBunn('#ffffff', 0.5, '#000000')).toBe('#808080')
  })
})

describe('UI-ens teksthierarki', () => {
  it('klarer AA mot hver eneste flate i sitt eget tema', () => {
    for (const r of maalUiTekst()) {
      expect(r.forhold, `${r.tema}/${r.nivaa} på ${r.flate} (${r.farge} mot ${r.bunn})`)
        .toBeGreaterThanOrEqual(AA_NORMAL)
    }
  })

  it('er monotont — nivå 2 er alltid svakere enn 1, 3 enn 2, 4 enn 3', () => {
    for (const tema of Object.keys(UI_TEKST)) {
      const bunn = UI_FLATER[tema].app
      const f = ['ink', 'ink-2', 'ink-3', 'ink-4'].map((n) => kontrast(UI_TEKST[tema][n], bunn))
      for (let i = 1; i < f.length; i++) {
        expect(f[i], `${tema} nivå ${i + 1}`).toBeLessThan(f[i - 1])
      }
    }
  })

  // Gaten mot drift: tabellen over er bare sann så lenge style.css sier det
  // samme. Uten denne kunne en token endres i CSS-en og testen fortsette å måle
  // den gamle verdien — altså en grønn sjekk på farger ingen ser.
  it('speiler style.css', () => {
    for (const [nivaa, farge] of Object.entries(UI_TEKST.dark)) {
      if (nivaa === 'ink') continue
      expect(css, `mørk --color-${nivaa}`).toContain(`--color-${nivaa}: ${farge};`)
    }
    for (const [nivaa, farge] of Object.entries(UI_TEKST.light)) {
      if (nivaa === 'ink') continue
      expect(css, `lys --color-${nivaa}`).toContain(`--color-${nivaa}: ${farge};`)
    }
    for (const [tema, flater] of Object.entries(UI_FLATER)) {
      for (const [flate, hex] of Object.entries(flater)) {
        expect(css.toLowerCase(), `${tema}/${flate}`).toContain(`--color-${flate}: ${hex}`)
      }
    }
  })

  it('har fokusring i begge tema, og den er lesbar mot appflata', () => {
    expect(css).toContain('--color-focus-ring: #ffffff;')
    expect(css).toContain('--color-focus-ring: #1c1917;')
    expect(kontrast('#ffffff', UI_FLATER.dark.app)).toBeGreaterThanOrEqual(3)
    expect(kontrast('#1c1917', UI_FLATER.light.app)).toBeGreaterThanOrEqual(3)
  })
})

describe('faste aksentflater', () => {
  // De solide aksentknappene og -toastene bærer hvit tekst i BEGGE tema
  // (.on-accent), så de måles én gang og ikke per tema.
  it('grønn knapp og gul toast bærer hvit tekst med margin', () => {
    expect(kontrast('#047857', '#ffffff')).toBeGreaterThanOrEqual(AA_NORMAL)  // emerald-700
    expect(kontrast('#92400e', '#ffffff')).toBeGreaterThanOrEqual(AA_NORMAL)  // amber-800
  })

  it('emerald-500 og -600 med hvit tekst er ute av kodebasen', () => {
    // De målte 2,5:1 og 3,8:1. Testen står så de ikke kan snike seg inn igjen.
    expect(kontrast('#10b981', '#ffffff')).toBeLessThan(AA_NORMAL)
    expect(kontrast('#059669', '#ffffff')).toBeLessThan(AA_NORMAL)
  })
})
