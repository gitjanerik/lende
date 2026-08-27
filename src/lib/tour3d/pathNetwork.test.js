// Stinettet drapert i terrenget. Ingen WebGL trengs: geometrien bygges i minnet,
// og det er y-verdiene som avgjør om stien ligger i terrenget eller faller ut av
// visningen.
//
// Testen finnes fordi det var nøyaktig dette som var feil (v5.27.0): der DEM-en
// manglet en høyde ble den 0 — HAVNIVÅ — og stinettet plunget rett ned fra
// fjellsida og løp videre langs et sjøplan hundrevis av meter under terrenget.
// Eieren så det i et nattbilde fra høyfjellet. Én linje kode, og ingen test som
// kunne se den.
import { describe, it, expect } from 'vitest'
import { buildPathNetwork } from './pathNetwork.js'
import { makeCoords } from './coords.js'

const COLS = 21
const ROWS = 21
const PIKSEL = 50           // 50 m celler ⇒ 1 000 × 1 000 m ark
const NO_DATA = -9999
const HOYDE = 1400

const coords = makeCoords({ widthM: 1000, heightM: 1000, exaggeration: 1 })

/**
 * DEM på 1 400 m med et rektangulært noData-hull. Hullet står for en naboflis
 * uten lagret DEM — det tilfellet mosaikkDemFallback lager når nettet er nede.
 */
function demMedHull({ hull = null } = {}) {
  const data = new Float32Array(COLS * ROWS).fill(HOYDE)
  if (hull) {
    for (let r = hull.r0; r <= hull.r1; r++) {
      for (let c = hull.c0; c <= hull.c1; c++) data[r * COLS + c] = NO_DATA
    }
  }
  return {
    data,
    cols: COLS,
    rows: ROWS,
    transform: { originX: 0, originY: 0, pixelWidth: PIKSEL, pixelHeight: PIKSEL },
    noData: NO_DATA,
  }
}

const sti = (fra, til) => [{
  isomCode: '505',
  coordinates: [fra, til],
}]

function yVerdier(nett) {
  const ut = []
  for (const g of nett.geometries) {
    // LineSegmentsGeometry lagrer hvert segment som start+slutt i `instanceStart`.
    const a = g.getAttribute('instanceStart').data.array
    for (let i = 1; i < a.length; i += 3) ut.push(a[i])
  }
  return ut
}

describe('buildPathNetwork — draperingen', () => {
  it('legger stien litt over terrenget der DEM-en har data', () => {
    const nett = buildPathNetwork(sti([100, 500], [900, 500]), demMedHull(), coords, { liftM: 4 })
    expect(nett.isEmpty).toBe(false)
    const ys = yVerdier(nett)
    expect(ys.length).toBeGreaterThan(10)
    for (const y of ys) expect(y).toBeCloseTo(HOYDE + 4, 3)
    nett.dispose()
  })

  it('BRYTER stien over et noData-hull i stedet for å plunge til havnivå', () => {
    // Hull midt på arket, tvers over stiens trasé.
    const dem = demMedHull({ hull: { r0: 0, r1: ROWS - 1, c0: 8, c1: 12 } })
    const nett = buildPathNetwork(sti([100, 500], [900, 500]), dem, coords, { liftM: 4 })
    const ys = yVerdier(nett)
    expect(ys.length).toBeGreaterThan(4)
    // Ingen y i nærheten av havnivå — det er hele poenget. Før v5.27.0 lå
    // halve stien på 4 m.
    for (const y of ys) expect(y).toBeGreaterThan(HOYDE - 1)
    nett.dispose()
  })

  it('tegner ingenting når DEM-en er tom, framfor en sti på havnivå', () => {
    const dem = demMedHull({ hull: { r0: 0, r1: ROWS - 1, c0: 0, c1: COLS - 1 } })
    const nett = buildPathNetwork(sti([100, 500], [900, 500]), dem, coords)
    expect(nett.isEmpty).toBe(true)
    nett.dispose()
  })

  it('beholder stien utenfor hullet, ikke bare den ene siden', () => {
    const dem = demMedHull({ hull: { r0: 0, r1: ROWS - 1, c0: 9, c1: 11 } })
    const nett = buildPathNetwork(sti([100, 500], [900, 500]), dem, coords)
    // Segmentene skal finnes på BEGGE sider av hullet (x < 450 og x > 550 i
    // SVG-meter, altså < −50 og > 50 i world-X siden arket er 1 000 m bredt).
    const g = nett.geometries[0]
    const a = g.getAttribute('instanceStart').data.array
    let vestFor = 0
    let ostFor = 0
    for (let i = 0; i < a.length; i += 3) {
      if (a[i] < -100) vestFor++
      if (a[i] > 100) ostFor++
    }
    expect(vestFor).toBeGreaterThan(0)
    expect(ostFor).toBeGreaterThan(0)
    nett.dispose()
  })

  it('skiller sti fra kjøreveg i to lag', () => {
    const dem = demMedHull()
    const nett = buildPathNetwork([
      { isomCode: '505', coordinates: [[100, 200], [900, 200]] },
      { isomCode: '503', coordinates: [[100, 800], [900, 800]] },
    ], dem, coords)
    expect(nett.geometries.length).toBe(2)
    expect(nett.materials.length).toBe(2)
    nett.dispose()
  })

  it('tåler tomt inndata', () => {
    const nett = buildPathNetwork([], demMedHull(), coords)
    expect(nett.isEmpty).toBe(true)
    expect(() => nett.setVisible(true)).not.toThrow()
    expect(() => nett.setResolution(800, 600)).not.toThrow()
    nett.dispose()
  })
})
