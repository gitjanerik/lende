import { describe, it, expect } from 'vitest'
import {
  KILDE_BRUKER, KILDE_FREDET,
  minneNokkel, harStjerne, veksleStjerne, stjerneAntall, stjerneRingFarge,
} from './stjerneminner.js'

describe('minneNokkel', () => {
  it('skiller de to kildene med samme id', () => {
    expect(minneNokkel(KILDE_BRUKER, '4711')).not.toBe(minneNokkel(KILDE_FREDET, '4711'))
  })

  it('gir null uten brukbar id — da har vi ingenting å feste stjerna til', () => {
    expect(minneNokkel(KILDE_FREDET, null)).toBeNull()
    expect(minneNokkel(KILDE_FREDET, '')).toBeNull()
    expect(minneNokkel(KILDE_FREDET, '   ')).toBeNull()
  })

  it('gir null for en ukjent kilde', () => {
    expect(minneNokkel('x', '4711')).toBeNull()
  })

  it('trimmer id-en, så samme minne ikke får to nøkler', () => {
    expect(minneNokkel(KILDE_BRUKER, ' 4711 ')).toBe(minneNokkel(KILDE_BRUKER, '4711'))
  })
})

describe('veksleStjerne', () => {
  const n = minneNokkel(KILDE_FREDET, '4711')

  it('legger til og fjerner igjen', () => {
    const på = veksleStjerne([], n)
    expect(harStjerne(på, n)).toBe(true)
    expect(harStjerne(veksleStjerne(på, n), n)).toBe(false)
  })

  it('kan ikke lage dublett uansett hvor mange ganger den kalles', () => {
    let liste = [n, n]
    liste = veksleStjerne(liste, n)     // fjerner BEGGE
    expect(liste).toEqual([])
    liste = veksleStjerne(veksleStjerne(liste, n), n)
    expect(liste).toEqual([])
  })

  it('gir alltid en ny referanse, så et kallsted som sammenligner med === ser endringen', () => {
    const før = [n]
    expect(veksleStjerne(før, n)).not.toBe(før)
    expect(veksleStjerne(før, null)).not.toBe(før)
  })

  it('tåler at lista mangler og rydder bort søppel-oppføringer', () => {
    expect(veksleStjerne(undefined, n)).toEqual([n])
    expect(veksleStjerne([null, '', 'f:1'], null)).toEqual(['f:1'])
  })
})

describe('stjerneAntall', () => {
  it('teller unike og tåler et kart uten feltet', () => {
    expect(stjerneAntall(undefined)).toBe(0)
    expect(stjerneAntall([])).toBe(0)
    expect(stjerneAntall(['f:1', 'f:1', 'k:1'])).toBe(2)
  })
})

describe('stjerneRingFarge', () => {
  // Ringen tegnes oppå kartarket, ikke oppå UI-flata, så den må stå mot BEGGE
  // ytterpunktene: kremgult ISOM-papir og et natt-tema. WCAG 1.4.11 krever 3:1
  // for ikke-tekst; her er gulvet satt der med margin.
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    const kanal = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255)
  }
  const kontrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  it('holder 3:1 mot kremgult papir og mot en mørk flate', () => {
    expect(kontrast(stjerneRingFarge(false), '#fefae0')).toBeGreaterThanOrEqual(3)
    expect(kontrast(stjerneRingFarge(true), '#1a1a1a')).toBeGreaterThanOrEqual(3)
  })

  it('er to ulike valører — én farge ville forsvunnet i den ene enden', () => {
    expect(stjerneRingFarge(true)).not.toBe(stjerneRingFarge(false))
  })
})
