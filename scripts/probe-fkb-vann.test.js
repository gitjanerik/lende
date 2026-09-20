import { describe, it, expect } from 'vitest'
import {
  SLUGGER, FKB_OBJTYPE, fkbKandidater, klassifiserFkb, bboxOverlapper,
  ringBredde, nasjonaltAnslag, lesLagTyper, erFlateLag, velgOmrader, malFlater,
} from './probe-fkb-vann.mjs'
import { filnavnKandidater, BASER } from './geonorgeN50.mjs'

const OMRADE = { code: '3203', name: 'Asker', type: 'kommune' }
const FORMAT = { name: 'FGDB' }
const P32 = { code: '25832' }
const P33 = { code: '25833' }

describe('fkbKandidater', () => {
  it('krysser base × slug × projeksjon uten dubletter', () => {
    const ut = fkbKandidater(OMRADE, FORMAT, [P32, P33])
    expect(new Set(ut).size).toBe(ut.length)
    expect(ut.some(u => u.includes('/Geovekst/'))).toBe(true)
    expect(ut.some(u => u.includes('/Basisdata/'))).toBe(true)
    for (const s of SLUGGER) expect(ut.some(u => u.includes(`/${s}/`))).toBe(true)
    expect(ut.some(u => u.includes('25832'))).toBe(true)
    expect(ut.some(u => u.includes('25833'))).toBe(true)
  })

  it('prøver Basisdata før Geovekst — den billigste gjetningen først', () => {
    const ut = fkbKandidater(OMRADE, FORMAT, [P32])
    expect(ut[0].startsWith(BASER[0])).toBe(true)
  })

  it('gir ingenting uten projeksjoner', () => {
    expect(fkbKandidater(OMRADE, FORMAT, [])).toEqual([])
  })
})

// Generaliseringen av geonorgeN50 skal være byte-identisk for N50-kallstedene.
// Feiler denne, har en FKB-endring lekket inn i den nasjonale areal-baken.
describe('filnavnKandidater — N50-standardene er urørt', () => {
  it('bygger samme URL som før parameteriseringen', () => {
    const [url] = filnavnKandidater(OMRADE, FORMAT, P33)
    expect(url).toBe(
      'https://nedlasting.geonorge.no/geonorge/Basisdata/N50Kartdata/FGDB/' +
      'Basisdata_3203_Asker_25833_N50Kartdata_FGDB.zip')
  })
})

describe('klassifiserFkb', () => {
  it('kjenner igjen elv og innsjø i begge skrivemåter', () => {
    expect(klassifiserFkb({ objtype: 'ElvBekk' })).toBe('elv')
    expect(klassifiserFkb({ OBJTYPE: 'Innsjø' })).toBe('innsjo')
    expect(klassifiserFkb({ objtype: 'Innsjo Regulert' })).toBe('innsjo')
  })

  it('gir null for ukjent — en ukjent type skal DROPPES, ikke gjettes', () => {
    expect(klassifiserFkb({ objtype: 'Havflate' })).toBe(null)
    expect(klassifiserFkb({})).toBe(null)
    expect(klassifiserFkb(null)).toBe(null)
  })

  it('har bare lovlige måltyper', () => {
    for (const v of Object.values(FKB_OBJTYPE)) expect(['elv', 'innsjo']).toContain(v)
  })
})

describe('bboxOverlapper', () => {
  const a = { south: 59.8, west: 10.4, north: 59.9, east: 10.5 }
  it('ser overlapp og fravær av overlapp', () => {
    expect(bboxOverlapper(a, { south: 59.85, west: 10.45, north: 60, east: 10.6 })).toBe(true)
    expect(bboxOverlapper(a, { south: 60.1, west: 10.4, north: 60.2, east: 10.5 })).toBe(false)
    expect(bboxOverlapper(a, { south: 59.8, west: 10.1, north: 59.9, east: 10.2 })).toBe(false)
  })
  it('berøring i kanten teller som overlapp', () => {
    expect(bboxOverlapper(a, { south: 59.9, west: 10.5, north: 60, east: 10.6 })).toBe(true)
  })
  it('tåler manglende bbox', () => {
    expect(bboxOverlapper(a, null)).toBe(false)
    expect(bboxOverlapper(undefined, a)).toBe(false)
  })
})

describe('ringBredde', () => {
  // 2·A/P er nøyaktig B for et rektangel L × B. Uten den kan målingen ikke si
  // HVORFOR N50 mangler elva.
  it('gir kortsiden for et langt, smalt rektangel', () => {
    const lat = 59.83
    const mLat = 1 / 111320
    const mLon = mLat / Math.cos(lat * Math.PI / 180)
    const L = 800, B = 6
    const ring = [
      { lat, lon: 10.4 },
      { lat, lon: 10.4 + L * mLon },
      { lat: lat + B * mLat, lon: 10.4 + L * mLon },
      { lat: lat + B * mLat, lon: 10.4 },
    ]
    expect(ringBredde(ring)).toBeCloseTo(B, 1)
  })

  it('gir 0 for en degenerert ring', () => {
    expect(ringBredde([{ lat: 59.8, lon: 10.4 }, { lat: 59.8, lon: 10.4 }])).toBe(0)
  })
})

describe('nasjonaltAnslag', () => {
  it('ganger opp forholdet målt i samme utsnitt', () => {
    const r = nasjonaltAnslag({ fkbBytes: 300, n50Bytes: 100, n50Nasjonalt: 4_200_000 })
    expect(r.forhold).toBe(3)
    expect(r.anslagBytes).toBe(12_600_000)
    expect(r.grunn).toBe(null)
  })

  it('deler ikke på null, men sier hvorfor', () => {
    const r = nasjonaltAnslag({ fkbBytes: 300, n50Bytes: 0, n50Nasjonalt: 4_200_000 })
    expect(r.forhold).toBe(null)
    expect(r.anslagBytes).toBe(null)
    expect(r.grunn).toMatch(/null byte/)
  })
})

describe('lesLagTyper', () => {
  const ogrinfo = [
    'INFO: Open of `FKB.gdb\'',
    '',
    'Layer name: Vannflate',
    'Geometry: Multi Polygon',
    'Feature Count: 1234',
    '',
    'Layer name: Elvelinje',
    'Geometry: Line String',
  ].join('\n')

  it('parer lagnavn med geometritype', () => {
    expect(lesLagTyper(ogrinfo)).toEqual([
      { navn: 'Vannflate', geometri: 'Multi Polygon' },
      { navn: 'Elvelinje', geometri: 'Line String' },
    ])
  })

  it('dropper et lag uten geometrilinje', () => {
    expect(lesLagTyper('Layer name: Bare\nFeature Count: 3')).toEqual([])
  })

  it('erFlateLag skiller flater fra linjer', () => {
    expect(erFlateLag('Multi Polygon')).toBe(true)
    expect(erFlateLag('3D Measured Surface')).toBe(true)
    expect(erFlateLag('Line String')).toBe(false)
    expect(erFlateLag(undefined)).toBe(false)
  })
})

describe('velgOmrader', () => {
  const omrader = [
    { code: '3203', name: 'Asker', type: 'kommune' },
    { code: '32', name: 'Akershus', type: 'fylke' },
    { code: '0000', name: 'Landsdekkende', type: 'land' },
  ]
  it('treffer på navn og på kode', () => {
    expect(velgOmrader(omrader, ['Asker'])[0].omrade.code).toBe('3203')
    expect(velgOmrader(omrader, ['32'])[0].omrade.name).toBe('Akershus')
  })
  it('normaliserer æ/ø/å og store bokstaver', () => {
    const med = [{ code: '5501', name: 'Tromsø', type: 'kommune' }]
    expect(velgOmrader(med, ['tromso'])[0].omrade.code).toBe('5501')
  })
  it('melder fra om et ønske uten treff i stedet for å tie', () => {
    expect(velgOmrader(omrader, ['Finnmark'])).toEqual([{ onske: 'Finnmark', omrade: null }])
  })
})

describe('malFlater', () => {
  const kvadrat = (lat, lon, sideM) => {
    const mLat = 1 / 111320
    const mLon = mLat / Math.cos(lat * Math.PI / 180)
    return [
      { lat, lon },
      { lat, lon: lon + sideM * mLon },
      { lat: lat + sideM * mLat, lon: lon + sideM * mLon },
      { lat: lat + sideM * mLat, lon },
    ]
  }

  it('teller, pakker og rapporter hva det veier', () => {
    const flater = [
      { type: 'elv', ringer: [kvadrat(59.83, 10.42, 100)] },
      { type: 'innsjo', ringer: [kvadrat(59.84, 10.43, 200)] },
    ]
    const m = malFlater(flater, 4, 400)
    expect(m.n).toBe(2)
    expect(m.forkastet).toBe(0)
    expect(m.km2).toBeCloseTo(0.05, 2)
    expect(m.fliser).toBeGreaterThan(0)
    expect(m.bytes).toBeGreaterThan(0)
    expect(m.gz).toBeGreaterThan(0)
    expect(m.storstNokkel).toBeTruthy()
  })

  it('forkaster under minsteareal — skruen er den samme som i baken', () => {
    const m = malFlater([{ type: 'elv', ringer: [kvadrat(59.83, 10.42, 10)] }], 4, 400)
    expect(m.n).toBe(0)
    expect(m.forkastet).toBe(1)
    expect(m.fliser).toBe(0)
    expect(m.gz).toBe(0)
  })

  it('en hardere toleranse kan ikke gi flere byte', () => {
    const flater = [{ type: 'elv', ringer: [kvadrat(59.83, 10.42, 300)] }]
    expect(malFlater(flater, 8, 400).bytes).toBeLessThanOrEqual(malFlater(flater, 1, 400).bytes)
  })
})
