import { describe, it, expect } from 'vitest'
import { velgFestede, utvidRekt } from './ghostFeste.js'

// Et rutenett av 1000×1000 m nabofliser rundt aktiv flis (som selv ligger på
// 0,0 og ikke er med i modellen).
const flis = (id, col, row) => ({ id, x: col * 1000, y: row * 1000, w: 1000, h: 1000 })
const FESTE = { minX: -100, minY: -100, maxX: 1100, maxY: 1100 }
const LOSNE = utvidRekt(FESTE, 1000, 1000)

describe('utvidRekt', () => {
  it('utvider like mye i alle fire retninger', () => {
    expect(utvidRekt({ minX: 0, minY: 0, maxX: 10, maxY: 20 }, 5, 5))
      .toEqual({ minX: -5, minY: -5, maxX: 15, maxY: 25 })
  })
  it('dy er valgfri og følger dx', () => {
    expect(utvidRekt({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 3))
      .toEqual({ minX: -3, minY: -3, maxX: 13, maxY: 13 })
  })
  it('ulik dx/dy', () => {
    expect(utvidRekt({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 2, 8))
      .toEqual({ minX: -2, minY: -8, maxX: 12, maxY: 18 })
  })
  it('null inn → null ut', () => {
    expect(utvidRekt(null, 5)).toBe(null)
  })
})

describe('velgFestede — første kall', () => {
  it('fester flisene som skjærer festeRekt', () => {
    const modell = [flis('a', 1, 0), flis('b', 0, 1), flis('fjern', 5, 5)]
    const ut = velgFestede(modell, { festeRekt: FESTE, losneRekt: LOSNE })
    expect(ut.fest.sort()).toEqual(['a', 'b'])
    expect(ut.losne).toEqual([])
    expect([...ut.festede].sort()).toEqual(['a', 'b'])
  })
  it('en flis som bare er innenfor losneRekt festes IKKE når den ikke alt er festet', () => {
    const ut = velgFestede([flis('mellom', 2, 0)], { festeRekt: FESTE, losneRekt: LOSNE })
    expect(ut.fest).toEqual([])
    expect(ut.losne).toEqual([])
    expect(ut.festede.size).toBe(0)
  })
  it('berøring teller som skjæring', () => {
    // Flis som starter nøyaktig på festeRekt sin høyrekant.
    const ut = velgFestede([{ id: 'kant', x: 1100, y: 0, w: 1000, h: 1000 }],
      { festeRekt: FESTE, losneRekt: LOSNE })
    expect(ut.fest).toEqual(['kant'])
  })
})

describe('velgFestede — hysterese', () => {
  it('en festet flis mellom de to rektanglene blir stående (verken fest eller løsne)', () => {
    const modell = [flis('mellom', 2, 0)]
    const ut = velgFestede(modell, {
      festeRekt: FESTE, losneRekt: LOSNE, forrigeFestede: new Set(['mellom']),
    })
    expect(ut.fest).toEqual([])
    expect(ut.losne).toEqual([])
    expect([...ut.festede]).toEqual(['mellom'])
  })
  it('en festet flis helt utenfor begge løsnes', () => {
    const ut = velgFestede([flis('langt', 5, 5)], {
      festeRekt: FESTE, losneRekt: LOSNE, forrigeFestede: new Set(['langt']),
    })
    expect(ut.losne).toEqual(['langt'])
    expect(ut.fest).toEqual([])
    expect(ut.festede.size).toBe(0)
  })
  it('uten losneRekt er det ingen hysterese — utenfor festeRekt løsner med en gang', () => {
    const ut = velgFestede([flis('mellom', 2, 0)], {
      festeRekt: FESTE, forrigeFestede: new Set(['mellom']),
    })
    expect(ut.losne).toEqual(['mellom'])
  })

  it('hele reisen: fest → bli hengende → løsne → fest igjen', () => {
    const modell = [flis('x', 2, 0)]
    // Utsnittet flytter seg østover, så vi flytter rektanglene i stedet.
    const feste = (dx) => ({ minX: -100 + dx, minY: -100, maxX: 1100 + dx, maxY: 1100 })

    // 1) Utsnittet når fram til flisa → festes.
    let f = velgFestede(modell, {
      festeRekt: feste(1000), losneRekt: utvidRekt(feste(1000), 1000, 1000),
    })
    expect(f.fest).toEqual(['x'])

    // 2) Utsnittet trekker seg litt tilbake — flisa er ute av festeRekt, men
    //    inne i losneRekt. Ingenting skal skje.
    let g = velgFestede(modell, {
      festeRekt: feste(0), losneRekt: utvidRekt(feste(0), 1000, 1000),
      forrigeFestede: f.festede,
    })
    expect(g.fest).toEqual([])
    expect(g.losne).toEqual([])

    // 3) Utsnittet drar langt vekk → flisa løsnes.
    const h = velgFestede(modell, {
      festeRekt: feste(-3000), losneRekt: utvidRekt(feste(-3000), 1000, 1000),
      forrigeFestede: g.festede,
    })
    expect(h.losne).toEqual(['x'])

    // 4) Tilbake igjen → festes på nytt.
    const i = velgFestede(modell, {
      festeRekt: feste(1000), losneRekt: utvidRekt(feste(1000), 1000, 1000),
      forrigeFestede: h.festede,
    })
    expect(i.fest).toEqual(['x'])
  })
})

describe('velgFestede — idempotens og tomme tilfeller', () => {
  it('to like kall gir tomme fest/løsne andre gang', () => {
    const modell = [flis('a', 1, 0), flis('b', 0, 1), flis('c', 5, 5)]
    const opts = { festeRekt: FESTE, losneRekt: LOSNE }
    const forst = velgFestede(modell, opts)
    const andre = velgFestede(modell, { ...opts, forrigeFestede: forst.festede })
    expect(andre.fest).toEqual([])
    expect(andre.losne).toEqual([])
    expect([...andre.festede].sort()).toEqual([...forst.festede].sort())
  })
  it('tom modell uten forhistorie → alt tomt', () => {
    const ut = velgFestede([], { festeRekt: FESTE, losneRekt: LOSNE })
    expect(ut).toEqual({ fest: [], losne: [], festede: new Set() })
  })
  it('tom modell med festede fliser → de løsnes (de finnes ikke å holde på)', () => {
    const ut = velgFestede([], {
      festeRekt: FESTE, losneRekt: LOSNE, forrigeFestede: new Set(['a', 'b']),
    })
    expect(ut.losne.sort()).toEqual(['a', 'b'])
    expect(ut.festede.size).toBe(0)
  })
  it('en flis som forsvant ut av modellen løsnes, resten står', () => {
    const ut = velgFestede([flis('a', 1, 0)], {
      festeRekt: FESTE, losneRekt: LOSNE, forrigeFestede: new Set(['a', 'borte']),
    })
    expect(ut.losne).toEqual(['borte'])
    expect(ut.fest).toEqual([])
    expect([...ut.festede]).toEqual(['a'])
  })
  it('tåler manglende modell og manglende opts', () => {
    expect(velgFestede()).toEqual({ fest: [], losne: [], festede: new Set() })
    expect(velgFestede(null, { festeRekt: FESTE })).toEqual({ fest: [], losne: [], festede: new Set() })
  })
  it('uten festeRekt festes ingenting, og det som var festet løsnes', () => {
    const ut = velgFestede([flis('a', 1, 0)], { forrigeFestede: new Set(['a']) })
    expect(ut.fest).toEqual([])
    expect(ut.losne).toEqual(['a'])
  })
  it('fliser uten id hoppes over', () => {
    const ut = velgFestede([{ x: 0, y: 0, w: 1000, h: 1000 }], { festeRekt: FESTE })
    expect(ut.fest).toEqual([])
  })
  it('forrigeFestede kan være en vanlig array', () => {
    const ut = velgFestede([flis('a', 1, 0)], { festeRekt: FESTE, forrigeFestede: ['a'] })
    expect(ut.fest).toEqual([])
    expect([...ut.festede]).toEqual(['a'])
  })
})
