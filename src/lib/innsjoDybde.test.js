import { describe, it, expect, vi } from 'vitest'

vi.mock('./innsjoDybderData.js', () => ({
  INNSJO_DYBDER: { 5252: [10.5, null, 1979], 522: [288, 93, 1980] },
}))

const { radTilDybde, samleDybder, dybdeModulKilde, dybdeFor, dybdeEtikett } = await import('./innsjoDybde.js')
const { buildSvg } = await import('./mapBuilder.js')
const { INNSJO_DYBDER: EKTE } = await vi.importActual('./innsjoDybderData.js')

describe('radTilDybde', () => {
  it('leser feltene fra NVE-laget «Dybdekart»', () => {
    expect(radTilDybde({ vatnlnr: 522, maksdyp_m: 288, middeldyp_m: 93, oppmaltaar: 1980 }))
      .toEqual({ vatnlnr: 522, maks: 288, snitt: 93, aar: 1980 })
  })

  it('dropper rader uten brukbart maksdyp eller innsjønummer', () => {
    expect(radTilDybde({ vatnlnr: 1, maksdyp_m: null })).toBeNull()
    expect(radTilDybde({ vatnlnr: 1, maksdyp_m: 0 })).toBeNull()
    expect(radTilDybde({ vatnlnr: 1, maksdyp_m: 9999 })).toBeNull()
    expect(radTilDybde({ vatnlnr: null, maksdyp_m: 10 })).toBeNull()
  })

  it('forkaster snitt over maks og år utenfor rimelighet', () => {
    expect(radTilDybde({ vatnlnr: 2, maksdyp_m: 10, middeldyp_m: 40, oppmaltaar: 1 }))
      .toEqual({ vatnlnr: 2, maks: 10, snitt: null, aar: null })
  })
})

describe('samleDybder', () => {
  it('beholder det dypeste dybdekartet per innsjø', () => {
    const m = samleDybder([
      { vatnlnr: 7, maksdyp_m: 20, oppmaltaar: 1950 },
      { vatnlnr: 7, maksdyp_m: 31, oppmaltaar: 1990 },
      { vatnlnr: 8, maksdyp_m: 4.5 },
    ])
    expect(m.get(7)).toEqual({ maks: 31, snitt: null, aar: 1990 })
    expect(m.size).toBe(2)
  })
})

describe('dybdeModulKilde', () => {
  it('sorterer på innsjønummer så en ny bake gir ren diff', () => {
    const kilde = dybdeModulKilde(new Map([[9, { maks: 3, snitt: null, aar: null }], [2, { maks: 5, snitt: 2, aar: 1980 }]]),
      { kilde: 'test', hentet: '2026-11-20' })
    expect(kilde.indexOf('  2: [5, 2, 1980],')).toBeLessThan(kilde.indexOf('  9: [3, null, null],'))
    expect(kilde).toContain('2 innsjøer')
  })
})

describe('dybdeFor / dybdeEtikett', () => {
  it('slår opp på vatnlnr også når taggen er en streng', () => {
    expect(dybdeFor('522')).toEqual({ maks: 288, snitt: 93, aar: 1980 })
    expect(dybdeFor(undefined)).toBeNull()
    expect(dybdeFor(1)).toBeNull()
  })

  it('én desimal under 10 m, med komma', () => {
    expect(dybdeEtikett(4.5)).toBe('maks 4,5 m')
    expect(dybdeEtikett(10.5)).toBe('maks 11 m')
    expect(dybdeEtikett(0)).toBe('')
  })
})

describe('den bakte tabellen', () => {
  it('har bare plausible verdier', () => {
    for (const [nr, [maks, snitt, aar]] of Object.entries(EKTE)) {
      expect(Number(nr)).toBeGreaterThan(0)
      expect(maks).toBeGreaterThan(0)
      expect(maks).toBeLessThanOrEqual(700)
      if (snitt != null) expect(snitt).toBeLessThanOrEqual(maks)
      if (aar != null) expect(aar).toBeGreaterThanOrEqual(1800)
    }
  })
})

describe('mapBuilder: maksdyp som detalj-lag', () => {
  const bbox = { south: 59.96, north: 59.98, west: 10.6, east: 10.64 }
  const ring = [
    { lat: 59.965, lon: 10.61 }, { lat: 59.965, lon: 10.63 },
    { lat: 59.975, lon: 10.63 }, { lat: 59.975, lon: 10.61 }, { lat: 59.965, lon: 10.61 },
  ]

  it('legger «maks N m» i et skjult innsjodybde-lag for en oppmålt innsjø', () => {
    const lake = { type: 'way', id: 1, _source: 'n50', geometry: ring, tags: { natural: 'water', navn: 'Bogstadvannet', vatnlnr: '5252' } }
    const { svg, meta } = buildSvg([lake], bbox, {})
    const lag = /<g data-layer="innsjodybde" data-detail="1" style="display:none">([\s\S]*?)<\/g>/.exec(svg)
    expect(lag).not.toBeNull()
    expect(lag[1]).toContain('data-label="dybde-tall">maks 11 m</text>')
    expect(meta.innsjoDybder).toBe(1)
  })

  it('emitterer ingenting for en innsjø uten dybdekart', () => {
    const lake = { type: 'way', id: 2, _source: 'n50', geometry: ring, tags: { natural: 'water', navn: 'Sognsvann', vatnlnr: '42' } }
    const { svg, meta } = buildSvg([lake], bbox, {})
    expect(svg).not.toContain('data-layer="innsjodybde"')
    expect(meta.innsjoDybder).toBe(0)
  })
})
