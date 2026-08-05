import { describe, it, expect } from 'vitest'
import { useMapHighlight, publiserMerkeKlar, sendMerkeKommando } from './useMapHighlight.js'

describe('useMapHighlight', () => {
  it('melder om at markering er mulig', () => {
    const { merkeKlar } = useMapHighlight()
    publiserMerkeKlar(true)
    expect(merkeKlar.value).toBe(true)
    publiserMerkeKlar(false)
    expect(merkeKlar.value).toBe(false)
  })

  it('teller opp id-en så to like kommandoer begge trigger watchen', () => {
    const { kommando } = useMapHighlight()
    sendMerkeKommando({ navn: 'Stordammen', lat: 64.5, lon: 13.2 })
    const forste = kommando.value.id
    sendMerkeKommando({ navn: 'Stordammen', lat: 64.5, lon: 13.2 })
    expect(kommando.value.id).toBe(forste + 1)
    expect(kommando.value.navn).toBe('Stordammen')
  })

  it('bærer fjern-kommandoen', () => {
    const { kommando } = useMapHighlight()
    sendMerkeKommando({ fjern: true })
    expect(kommando.value.fjern).toBe(true)
  })
})
