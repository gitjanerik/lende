import { describe, it, expect } from 'vitest'
import { lastefeilPaaNorsk, NETT_KREVES, UTEN_NETT } from './lastefeil.js'

describe('lastefeilPaaNorsk', () => {
  it('oversetter nettleserens fetch-feil på alle tre motorene', () => {
    for (const m of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
      expect(lastefeilPaaNorsk(m)).toBe(NETT_KREVES)
    }
  })

  it('sier det rett ut når nettleseren VET at vi er offline', () => {
    expect(lastefeilPaaNorsk('Failed to fetch', { offline: true })).toBe(UTEN_NETT)
    expect(lastefeilPaaNorsk('Ugyldig SVG', { offline: true })).toBe(UTEN_NETT)
  })

  it('påstår ikke at nettet mangler når vi bare vet at hentingen feilet', () => {
    expect(lastefeilPaaNorsk('Failed to fetch')).not.toMatch(/uten nett/i)
  })

  it('lar våre egne norske meldinger stå', () => {
    expect(lastefeilPaaNorsk('Ugyldig SVG')).toBe('Ugyldig SVG')
    expect(lastefeilPaaNorsk('Mangler data-meta i SVG')).toBe('Mangler data-meta i SVG')
  })

  it('setter norsk tekst rundt en HTTP-status', () => {
    expect(lastefeilPaaNorsk('HTTP 404')).toBe('Serveren svarte HTTP 404. Prøv igjen om litt.')
  })

  it('gir en tom feil en tekst å vise', () => {
    expect(lastefeilPaaNorsk('')).toBe(NETT_KREVES)
    expect(lastefeilPaaNorsk(null)).toBe(NETT_KREVES)
  })

  it('er på norsk, uansett inndata', () => {
    expect(lastefeilPaaNorsk('Failed to fetch')).not.toMatch(/[a-z]etch|failed/i)
  })
})
