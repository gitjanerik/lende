import { describe, it, expect } from 'vitest'
import { summerRader, velgFormatFor } from './mal-n50-sti.mjs'

// Landsmålingen tar ett fylke om gangen og summerer. Summeringen må være
// riktig, ellers er landstallet verdiløst — og den må ta UNIONEN av flis-
// nøkler, ikke summen, siden nabofylker deler grensefliser.

describe('summerRader', () => {
  const fylkeA = [{ tol: 3, punkter: 100, raa: 1000, gz: 400, storst: 120, nokler: ['59.5_10.0', '60.0_10.0'] }]
  const fylkeB = [{ tol: 3, punkter: 50, raa: 500, gz: 200, storst: 90, nokler: ['60.0_10.0', '60.5_10.0'] }]

  it('summerer byte og punkter', () => {
    const [r] = summerRader([fylkeA, fylkeB])
    expect(r.punkter).toBe(150)
    expect(r.raa).toBe(1500)
    expect(r.gz).toBe(600)
  })

  it('tar UNIONEN av flis-nøkler, ikke summen', () => {
    const [r] = summerRader([fylkeA, fylkeB])
    // 2 + 2 nøkler, men 60.0_10.0 er delt → 3 unike.
    expect(r.fliser).toBe(3)
  })

  it('beholder STØRSTE enkeltflis, ikke summen av dem', () => {
    expect(summerRader([fylkeA, fylkeB])[0].storst).toBe(120)
  })

  it('holder forenklingsnivåene fra hverandre og sorterer dem', () => {
    const a = [{ tol: 8, punkter: 1, raa: 1, gz: 1, storst: 1, nokler: [] },
               { tol: 3, punkter: 2, raa: 2, gz: 2, storst: 2, nokler: [] }]
    const ut = summerRader([a, a])
    expect(ut.map(r => r.tol)).toEqual([3, 8])
    expect(ut.find(r => r.tol === 3).punkter).toBe(4)
    expect(ut.find(r => r.tol === 8).punkter).toBe(2)
  })

  it('tåler tom input og manglende nøkler', () => {
    expect(summerRader([])).toEqual([])
    expect(summerRader([[{ tol: 3, punkter: 1, raa: 1, gz: 1, storst: 1 }]])[0].fliser).toBe(0)
  })
})

describe('velgFormatFor', () => {
  const globaleFormater = [{ name: 'FGDB' }, { name: 'GML' }, { name: 'PostGIS' }, { name: 'SOSI' }]
  const globaleProj = [{ code: '25832' }, { code: '25833' }]

  it('velger fra områdets EGEN liste, ikke den globale (v5.0.9-feilen)', () => {
    // Buskerud har ikke GML, selv om den globale lista har det.
    const buskerud = {
      name: 'Buskerud',
      formats: [{ name: 'PostGIS', projections: [{ code: '25833' }] },
                { name: 'FGDB', projections: [{ code: '25832' }, { code: '25833' }] }],
    }
    const { format, proj } = velgFormatFor(buskerud, globaleFormater, globaleProj)
    expect(format.name).toBe('FGDB')
    expect(proj.code).toBe('25833')
  })

  it('foretrekker FGDB, som GDAL leser uten ekstra avhengigheter', () => {
    const o = { name: 'X', formats: [{ name: 'PostGIS' }, { name: 'GML' }, { name: 'FGDB' }] }
    expect(velgFormatFor(o, globaleFormater, globaleProj).format.name).toBe('FGDB')
  })

  it('faller tilbake til PostGIS bare når ingenting annet finnes', () => {
    const o = { name: 'X', formats: [{ name: 'PostGIS' }] }
    expect(velgFormatFor(o, globaleFormater, globaleProj).format.name).toBe('PostGIS')
  })

  it('bruker global liste når området ikke oppgir egen', () => {
    expect(velgFormatFor({ name: 'X' }, globaleFormater, globaleProj).format.name).toBe('FGDB')
  })

  it('sier tydelig fra når området ikke har noe format', () => {
    expect(() => velgFormatFor({ name: 'Tomt', formats: [] }, [], [])).toThrow(/ingen formater/)
  })
})
