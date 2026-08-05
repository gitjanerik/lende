import { describe, it, expect } from 'vitest'
import {
  classifyBuildings, multiPolyToPath, simplifyUrbanMass, ringArea,
  URBAN_MASS_SIMPLIFY_M, URBAN_MASS_MIN_AREA_M2,
} from './buildingMass.js'

// Lukket ring (første punkt == siste), slik polygon-clipping leverer dem.
const rect = (x0, y0, x1, y1) => [
  [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0],
]

describe('ringArea', () => {
  it('regner areal uavhengig av omløpsretning', () => {
    expect(ringArea(rect(0, 0, 10, 20))).toBe(200)
    expect(ringArea([...rect(0, 0, 10, 20)].reverse())).toBe(200)
  })
  it('er 0 for degenererte ringer', () => {
    expect(ringArea([])).toBe(0)
    expect(ringArea([[0, 0], [1, 1]])).toBe(0)
    expect(ringArea(null)).toBe(0)
  })
})

describe('simplifyUrbanMass', () => {
  it('kollapser en akse-justert trappelinje', () => {
    // Dette ER formen unionen av buffer-de bygnings-bbox-er produserer: en
    // diagonal «trapp» med små trinn. Ved 1:10 000 er 2 m = 0,2 mm, altså en
    // rett strek — punktene er ren kostnad. (Målt i Oslo: 126 151 punkter i én
    // path, 1 646 KB = 31,9 % av hele SVG-en.)
    const trapp = []
    for (let i = 0; i <= 100; i++) { trapp.push([i * 2, i * 2], [i * 2 + 2, i * 2]) }
    trapp.push([202, 400], [0, 400], [0, 0])
    const [poly] = simplifyUrbanMass([[trapp]])
    expect(poly[0].length).toBeLessThan(trapp.length / 5)
    // Ringen er fortsatt lukket, og arealet er omtrent bevart.
    expect(poly[0][0]).toEqual(poly[0].at(-1))
    expect(ringArea(poly[0])).toBeGreaterThan(ringArea(trapp) * 0.9)
  })

  it('dropper polygonen når YTRE ring er under minstearealet', () => {
    expect(simplifyUrbanMass([[rect(0, 0, 5, 5)]])).toEqual([])       // 25 m²
    expect(simplifyUrbanMass([[rect(0, 0, 100, 100)]])).toHaveLength(1)
  })

  it('fyller igjen mikro-hull men beholder store hull', () => {
    const stort = [[rect(0, 0, 1000, 1000), rect(100, 100, 400, 400)]]   // hull = 90 000 m²
    expect(simplifyUrbanMass(stort)[0]).toHaveLength(2)
    const mikro = [[rect(0, 0, 1000, 1000), rect(100, 100, 105, 105)]]   // hull = 25 m²
    expect(simplifyUrbanMass(mikro)[0]).toHaveLength(1)
  })

  it('respekterer minAreaM2-parameteren (mapBuilder skalerer den med kart-arealet)', () => {
    const poly = [[rect(0, 0, 20, 20)]]   // 400 m²
    expect(simplifyUrbanMass(poly, { minAreaM2: 100 })).toHaveLength(1)
    expect(simplifyUrbanMass(poly, { minAreaM2: 1000 })).toHaveLength(0)
  })

  it('lar et rektangel være i fred (ingenting å forenkle)', () => {
    const [poly] = simplifyUrbanMass([[rect(0, 0, 500, 500)]])
    expect(ringArea(poly[0])).toBeCloseTo(250000, 0)
  })

  it('tåler tomt/ugyldig input uten å kaste', () => {
    expect(simplifyUrbanMass(null)).toEqual([])
    expect(simplifyUrbanMass([])).toEqual([])
    expect(simplifyUrbanMass([[]])).toEqual([])
    expect(simplifyUrbanMass([[[[0, 0], [1, 1]]]])).toEqual([])   // < 4 punkter
  })

  it('har defaults i den størrelsesordenen print-skalaen tilsier', () => {
    // 3 m DP = 0,3 mm @ 1:10 000 (samme som vegetasjonsgrensene);
    // 200 m² = 2 mm² på papiret.
    expect(URBAN_MASS_SIMPLIFY_M).toBeLessThanOrEqual(3)
    expect(URBAN_MASS_MIN_AREA_M2).toBeLessThanOrEqual(400)
  })
})

describe('multiPolyToPath med heltalls-koordinater', () => {
  it('skriver ingen desimaler når fmt er Math.round', () => {
    const d = multiPolyToPath([[rect(1.34, 2.67, 10.51, 20.49)]], Math.round)
    expect(d).not.toMatch(/\d\.\d/)
    expect(d.startsWith('M1,3')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('er kortere med heltall enn med én desimal (byte-gevinsten)', () => {
    const poly = [[Array.from({ length: 200 }, (_, i) => [i * 1.37, i * 2.83])]]
    const heltall = multiPolyToPath(poly, Math.round)
    const desimal = multiPolyToPath(poly, (n) => Number(n.toFixed(1)))
    expect(heltall.length).toBeLessThan(desimal.length)
  })
})

describe('classifyBuildings — uendret kontrakt', () => {
  it('holder spredte bygninger utenfor bymassen', () => {
    const spredt = [
      { ring: rect(0, 0, 10, 10), original: 'a' },
      { ring: rect(500, 500, 510, 510), original: 'b' },
    ]
    const { urbanMass, scattered } = classifyBuildings(spredt, { minClusterSize: 5 })
    expect(urbanMass).toEqual([])
    expect(scattered.map(b => b.original).sort()).toEqual(['a', 'b'])
  })

  it('slår sammen en tett klynge til bymasse', () => {
    const tett = Array.from({ length: 6 }, (_, i) => ({
      ring: rect(i * 18, 0, i * 18 + 10, 10), original: i,
    }))
    const { urbanMass, scattered } = classifyBuildings(tett, {
      neighborRadiusM: 15, minClusterSize: 5, bufferM: 6,
    })
    expect(urbanMass.length).toBeGreaterThan(0)
    expect(scattered).toEqual([])
  })

  it('er tom for tom input', () => {
    expect(classifyBuildings([])).toEqual({ urbanMass: [], scattered: [] })
  })
})
