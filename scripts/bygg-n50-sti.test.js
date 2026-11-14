import { describe, it, expect } from 'vitest'
import { klassifiser, klassifiserVeg } from './bygg-n50-sti.mjs'

describe('klassifiserVeg', () => {
  it('bilveg per vegkategori', () => {
    const v = (kat) => klassifiserVeg({ objtype: 'Veglenke', typeveg: 'enkelBilveg', vegkategori: kat, vegfase: 'V', medium: 'T' })
    expect(['E', 'R', 'F', 'K', 'P', 'S'].map(k => v(k)?.type))
      .toEqual(['veg-e', 'veg-r', 'veg-f', 'veg-k', 'veg-p', 'veg-p'])
  })

  it('tunnel og bru fra medium', () => {
    const v = (medium) => klassifiserVeg({ typeveg: 'enkelBilveg', vegkategori: 'R', medium })
    expect(v('U')).toEqual({ type: 'veg-r', tunnel: true })
    expect(v('L')).toEqual({ type: 'veg-r', bru: true })
    expect(v('T')).toEqual({ type: 'veg-r' })
  })

  it('stier, gang- og sykkelveg og ferjer er ikke veger', () => {
    for (const typeveg of ['sti', 'traktorveg', 'gangOgSykkelveg', 'bilferje', 'passasjerferje']) {
      expect(klassifiserVeg({ typeveg, vegkategori: 'K' })).toBeNull()
    }
  })

  it('bare eksisterende veg', () => {
    expect(klassifiserVeg({ typeveg: 'enkelBilveg', vegkategori: 'K', vegfase: 'A' })).toBeNull()
  })

  it('bare jernbane i drift', () => {
    expect(klassifiserVeg({ objtype: 'Bane', anleggstype: 'J', banestatus: 'I' })).toEqual({ type: 'bane' })
    expect(klassifiserVeg({ objtype: 'Bane', anleggstype: 'J', banestatus: 'I', medium: 'U' }))
      .toEqual({ type: 'bane', tunnel: true })
    expect(klassifiserVeg({ objtype: 'Bane', anleggstype: 'J', banestatus: 'N' })).toBeNull()
    expect(klassifiserVeg({ objtype: 'Bane', anleggstype: 'M', banestatus: 'I' })).toBeNull()
  })

  it('sti-klassifiseringen er urørt', () => {
    expect(klassifiser({ typeveg: 'enkelBilveg' })).toBeNull()
    expect(klassifiser({ typeveg: 'sti', rutemerking: 'JA' })).toEqual({ type: 'sti', merket: true })
  })
})
