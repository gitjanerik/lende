import { describe, it, expect } from 'vitest'
import { parkSlug, parkLogoSvg, parkLogoCount } from './nasjonalparkLogo.js'

describe('parkSlug — park-navn → filnavn', () => {
  it('stripper «nasjonalpark» og normaliserer æøå', () => {
    expect(parkSlug('Børgefjell nasjonalpark')).toBe('borgefjell')
    expect(parkSlug('Rondane nasjonalpark')).toBe('rondane')
    expect(parkSlug('Ytre Hvaler nasjonalpark')).toBe('ytre-hvaler')
    expect(parkSlug('Færder nasjonalpark')).toBe('faerder')
    expect(parkSlug('Ånderdalen nasjonalpark')).toBe('anderdalen')
  })

  it('fjerner aksenter i samiske navn', () => {
    expect(parkSlug('Anárjohka nasjonalpark')).toBe('anarjohka')
    expect(parkSlug('Reisa nasjonalpark')).toBe('reisa')
  })

  it('tåler tomt/ugyldig navn', () => {
    expect(parkSlug('')).toBe('')
    expect(parkSlug(null)).toBe('')
    expect(parkSlug(undefined)).toBe('')
  })
})

describe('parkLogoSvg — registeret', () => {
  it('returnerer null når merket ikke er lagt inn (ingen krasj)', () => {
    expect(parkLogoSvg('Finnes Ikke nasjonalpark')).toBeNull()
  })

  it('parkLogoCount er et tall (0 før logoene er lagt inn)', () => {
    expect(typeof parkLogoCount()).toBe('number')
    expect(parkLogoCount()).toBeGreaterThanOrEqual(0)
  })
})
