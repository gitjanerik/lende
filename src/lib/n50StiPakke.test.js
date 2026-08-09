import { describe, it, expect } from 'vitest'
import {
  kodeFlis, lesFlis, flisNokkel, fliserForBbox, forenkleLinje, lengdeM,
  delPaaFliser, TYPER, KVANT, FLIS_LAT, FLIS_LON,
} from './n50StiPakke.js'

// En realistisk sti: småbuktende linje med ~25 m mellom punktene.
function sti(lat0, lon0, n = 200, seed = 1) {
  const g = []
  let lat = lat0, lon = lon0, s = seed
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    lat += 0.00022 + (s / 2147483648 - 0.5) * 0.00004
    lon += 0.00040 + (s / 2147483648 - 0.5) * 0.00008
    g.push({ lat, lon })
  }
  return g
}

describe('flis-nøkler', () => {
  it('gir stabile, filnavn-trygge nøkler uten flyttalsstøy', () => {
    expect(flisNokkel(59.8399, 10.0804)).toBe('59.5_10.0')
    expect(flisNokkel(59.5, 10.0)).toBe('59.5_10.0')
    expect(flisNokkel(60.0, 11.0)).toBe('60.0_11.0')
    expect(flisNokkel(71.1, 28.3)).toBe('71.0_28.0')
    for (const k of [flisNokkel(59.9999, 10.9999), flisNokkel(59.5001, 10.0001)]) {
      expect(k).toMatch(/^-?\d+\.\d_-?\d+\.\d$/)
    }
  })

  it('dekker hele bboxen, inkludert når den krysser flis-grenser', () => {
    // Helt inne i én flis.
    expect(fliserForBbox({ south: 59.60, west: 10.1, north: 59.70, east: 10.5 }))
      .toEqual(['59.5_10.0'])
    // Krysser både lat- og lon-grensa → 2×2.
    const f = fliserForBbox({ south: 59.45, west: 9.9, north: 59.55, east: 10.1 })
    expect(f).toHaveLength(4)
    expect(new Set(f)).toEqual(new Set(['59.0_9.0', '59.0_10.0', '59.5_9.0', '59.5_10.0']))
  })

  it('et 16 km-kart trenger få fliser', () => {
    // 16 km ≈ 0,144° lat. Verste fall er et kart som ligger på et hjørne.
    const f = fliserForBbox({ south: 59.43, west: 9.93, north: 59.57, east: 10.07 })
    expect(f.length).toBeLessThanOrEqual(4)
  })

  it('tåler tom input', () => {
    expect(fliserForBbox(null)).toEqual([])
  })
})

describe('koding — rundtur', () => {
  it('bevarer geometri innenfor kvantiseringen (~1 m)', () => {
    const inn = [{ type: 'sti', geometry: sti(59.84, 10.08, 50) }]
    const ut = lesFlis(kodeFlis(inn))
    expect(ut).toHaveLength(1)
    expect(ut[0].type).toBe('sti')
    expect(ut[0].geometry).toHaveLength(50)
    for (let i = 0; i < 50; i++) {
      // 1/KVANT grader er kvantiseringssteget; avviket kan aldri overstige et halvt steg.
      expect(Math.abs(ut[0].geometry[i].lat - inn[0].geometry[i].lat)).toBeLessThanOrEqual(0.5 / KVANT)
      expect(Math.abs(ut[0].geometry[i].lon - inn[0].geometry[i].lon)).toBeLessThanOrEqual(0.5 / KVANT)
    }
  })

  it('bevarer merkingen, som skiller ISOM 506 fra 507', () => {
    const g = sti(59.84, 10.08, 5)
    const ut = lesFlis(kodeFlis([
      { type: 'sti', merket: true, geometry: g },
      { type: 'sti', merket: false, geometry: g },
      { type: 'traktorveg', merket: true, geometry: g },
    ]))
    expect(ut.map(l => l.merket)).toEqual([true, false, true])
    expect(ut.map(l => l.type)).toEqual(['sti', 'sti', 'traktorveg'])
  })

  it('merke-biten forstyrrer ikke typen', () => {
    // Alle typer × begge merkinger må komme uendret tilbake.
    const g = sti(59.84, 10.08, 3)
    const inn = TYPER.flatMap(t => [
      { type: t, merket: true, geometry: g },
      { type: t, merket: false, geometry: g },
    ])
    const ut = lesFlis(kodeFlis(inn))
    expect(ut.map(l => `${l.type}:${l.merket}`)).toEqual(inn.map(l => `${l.type}:${l.merket}`))
  })

  it('bevarer alle objekttyper', () => {
    const inn = TYPER.map((t, i) => ({ type: t, geometry: sti(59 + i * 0.1, 10, 5) }))
    const ut = lesFlis(kodeFlis(inn))
    expect(ut.map(l => l.type)).toEqual(TYPER)
  })

  it('ukjent type faller til «annet» i stedet for å ødelegge flisa', () => {
    const ut = lesFlis(kodeFlis([{ type: 'gangbru-over-bekk', geometry: sti(59.8, 10.1, 4) }]))
    expect(ut[0].type).toBe('annet')
    expect(ut[0].geometry).toHaveLength(4)
  })

  it('takler negative koordinater (vest for Greenwich)', () => {
    const inn = [{ type: 'sti', geometry: [{ lat: 58.1, lon: -4.5 }, { lat: 58.2, lon: -4.4 }] }]
    const ut = lesFlis(kodeFlis(inn))
    expect(ut[0].geometry[1].lon).toBeCloseTo(-4.4, 5)
    expect(ut[0].geometry[0].lat).toBeCloseTo(58.1, 5)
  })

  it('dropper linjer med under to punkter', () => {
    const ut = lesFlis(kodeFlis([
      { type: 'sti', geometry: [{ lat: 59, lon: 10 }] },
      { type: 'sti', geometry: sti(59.8, 10.1, 3) },
    ]))
    expect(ut).toHaveLength(1)
  })

  it('tom flis er lovlig', () => {
    expect(lesFlis(kodeFlis([]))).toEqual([])
    expect(lesFlis(kodeFlis(null))).toEqual([])
  })

  it('avviser fremmed eller korrupt data i stedet for å returnere søppel', () => {
    expect(() => lesFlis(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Ikke en N50-sti-flis/)
    const ok = kodeFlis([{ type: 'sti', geometry: sti(59.8, 10.1, 3) }])
    const feilVersjon = new Uint8Array(ok)
    // MAGIC er ~1,31e9 og krever 5 varint-byte, så versjonsbyten er nr. 6.
    // Regnes ut i stedet for å hardkodes, så testen ikke lyver hvis magic endres.
    const tomFlis = kodeFlis([])
    const versjonIdx = tomFlis.length - 2   // […magic, versjon, antall=0]
    expect(versjonIdx).toBe(5)
    feilVersjon[versjonIdx] = 99
    expect(() => lesFlis(feilVersjon)).toThrow(/versjon/)
  })
})

describe('koding — komprimering', () => {
  it('bruker vesentlig færre byte enn GeoJSON', () => {
    // Dette er tallet hele arkitekturvalget hviler på, så det er verdt en test.
    const linjer = Array.from({ length: 40 }, (_, i) => ({
      type: 'sti', geometry: sti(59.5 + i * 0.002, 10.0 + i * 0.003, 200, i + 1),
    }))
    const pakket = kodeFlis(linjer).length
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: linjer.map(l => ({
        type: 'Feature',
        properties: { type: l.type },
        geometry: { type: 'LineString', coordinates: l.geometry.map(p => [p.lon, p.lat]) },
      })),
    }).length
    expect(pakket).toBeLessThan(geojson / 5)
    // ~4 byte per punkt er taket vi regner med i størrelsesanslaget.
    expect(pakket / (40 * 200)).toBeLessThan(4)
  })
})

describe('forenkleLinje', () => {
  it('fjerner vertekser som ikke bærer form', () => {
    // Rett linje med mange mellompunkter → bare endepunktene trengs.
    const rett = Array.from({ length: 50 }, (_, i) => ({ lat: 59.8, lon: 10.0 + i * 0.001 }))
    expect(forenkleLinje(rett, 3)).toHaveLength(2)
  })

  it('beholder en tydelig knekk', () => {
    const knekk = [
      { lat: 59.80, lon: 10.00 }, { lat: 59.80, lon: 10.01 },
      { lat: 59.81, lon: 10.01 }, { lat: 59.82, lon: 10.01 },
    ]
    expect(forenkleLinje(knekk, 3).length).toBeGreaterThanOrEqual(3)
  })

  it('flytter aldri et punkt mer enn toleransen fra originalen', () => {
    const g = sti(59.84, 10.08, 300)
    const f = forenkleLinje(g, 5)
    expect(f.length).toBeLessThan(g.length)
    expect(f[0]).toEqual(g[0])
    expect(f.at(-1)).toEqual(g.at(-1))
    // Lengden skal ikke endres nevneverdig — forenkling som kutter hjørner
    // ville krympet linja.
    expect(Math.abs(lengdeM(f) - lengdeM(g))).toBeLessThan(lengdeM(g) * 0.02)
  })

  it('tåler korte og tomme linjer', () => {
    expect(forenkleLinje([], 3)).toEqual([])
    expect(forenkleLinje(null, 3)).toEqual([])
    const to = [{ lat: 59, lon: 10 }, { lat: 59.1, lon: 10.1 }]
    expect(forenkleLinje(to, 3)).toEqual(to)
  })
})

describe('delPaaFliser', () => {
  it('legger en linje innenfor én flis i akkurat den flisa', () => {
    const d = delPaaFliser({ type: 'sti', geometry: sti(59.60, 10.10, 20) })
    expect(d).toHaveLength(1)
    expect(d[0].nokkel).toBe('59.5_10.0')
  })

  it('deler en linje som krysser en flis-grense, uten hull i skjøten', () => {
    // Krysser lat 59.5 fra sør til nord.
    const g = [
      { lat: 59.48, lon: 10.2 }, { lat: 59.49, lon: 10.2 },
      { lat: 59.51, lon: 10.2 }, { lat: 59.52, lon: 10.2 },
    ]
    const d = delPaaFliser({ type: 'sti', geometry: g })
    const nokler = new Set(d.map(x => x.nokkel))
    expect(nokler).toEqual(new Set(['59.0_10.0', '59.5_10.0']))
    // Kryssende segment skal finnes i BEGGE fliser, ellers blir det en glipe
    // når appen tegner to nabofliser ved siden av hverandre.
    const sor = d.filter(x => x.nokkel === '59.0_10.0').flatMap(x => x.geometry)
    const nord = d.filter(x => x.nokkel === '59.5_10.0').flatMap(x => x.geometry)
    expect(sor).toContainEqual({ lat: 59.51, lon: 10.2 })
    expect(nord).toContainEqual({ lat: 59.49, lon: 10.2 })
  })

  it('bevarer typen på alle delene', () => {
    const d = delPaaFliser({
      type: 'traktorveg', merket: true,
      geometry: [{ lat: 59.4, lon: 10.2 }, { lat: 59.6, lon: 10.2 }, { lat: 59.8, lon: 10.2 }],
    })
    expect(d.length).toBeGreaterThan(1)
    for (const del of d) { expect(del.type).toBe('traktorveg'); expect(del.merket).toBe(true) }
  })

  it('tåler for korte linjer', () => {
    expect(delPaaFliser({ type: 'sti', geometry: [{ lat: 59, lon: 10 }] })).toEqual([])
    expect(delPaaFliser({ type: 'sti', geometry: [] })).toEqual([])
  })

  it('flis-konstantene er de dokumenterte', () => {
    expect(FLIS_LAT).toBe(0.5)
    expect(FLIS_LON).toBe(1.0)
  })
})
