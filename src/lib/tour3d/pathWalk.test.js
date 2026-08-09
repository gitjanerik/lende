import { describe, it, expect } from 'vitest'
import { buildRoutingGraph } from '../routing.js'
import { walkFromNode, walkStartAt, rerouteAtJunction, angleDiff } from './pathWalk.js'

// Hjelper: bygg en graf av rette strekk oppgitt som punktlister.
const graphOf = (features) => buildRoutingGraph(features, { snapM: 2 })

const line = (coords, isomCode = '505') => ({ coordinates: coords, isomCode })

// Node-id for en posisjon (grafen navngir dem i innsettingsrekkefølge).
const nodeAt = (rg, x, y) => rg.nearestNode([x, y]).id

describe('angleDiff', () => {
  it('gir alltid minste vinkel i [0, π]', () => {
    expect(angleDiff(0, 0)).toBeCloseTo(0)
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI)
    // 350° og 10° er 20° fra hverandre, ikke 340°.
    expect(angleDiff((350 * Math.PI) / 180, (10 * Math.PI) / 180)).toBeCloseTo((20 * Math.PI) / 180, 5)
  })
})

describe('walkFromNode — rettest fram vinner', () => {
  it('går rett gjennom et T-kryss i stedet for å svinge av', () => {
    // Hovedsti vestover→østover langs y=0, sidesti stikker nordover fra (100,0).
    const rg = graphOf([
      line([[0, 0], [100, 0], [200, 0]]),
      line([[100, 0], [100, -100]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    const last = walk.coordinates[walk.coordinates.length - 1]
    expect(last).toEqual([200, 0])
    // Sidestien skal aldri besøkes.
    expect(walk.coordinates.some(([, y]) => y === -100)).toBe(false)
  })

  it('holder retningen gjennom et X-kryss', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [200, 0]]),
      line([[100, -100], [100, 0], [100, 100]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([200, 0])
  })

  it('melder krysset som passeres, med alternativene sortert på svingvinkel', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [200, 0]]),
      line([[100, 0], [100, -100]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.junctions).toHaveLength(1)
    const j = walk.junctions[0]
    expect(j.alongM).toBeCloseTo(100)
    expect(j.chosenNodeId).toBe(nodeAt(rg, 200, 0))
    expect(j.options).toHaveLength(2)
    expect(j.options[0].nodeId).toBe(nodeAt(rg, 200, 0))   // rettest fram først
    expect(j.options[0].turn).toBeLessThan(j.options[1].turn)
  })

  it('bryter uavgjort på stitype — tydelig sti slår stitråkk', () => {
    // To grener som begge svinger like mye (±30°), men ulik ISOM-kode.
    const d = 100
    const rad = (30 * Math.PI) / 180
    const rg = graphOf([
      line([[0, 0], [100, 0]], '505'),
      line([[100, 0], [100 + d * Math.cos(rad), d * Math.sin(rad)]], '507'),
      line([[100, 0], [100 + d * Math.cos(rad), -d * Math.sin(rad)]], '505'),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    const last = walk.coordinates[walk.coordinates.length - 1]
    expect(last[1]).toBeLessThan(0)   // valgte 505-grenen
  })
})

describe('walkFromNode — stoppregler', () => {
  it('stopper i en blindvei', () => {
    const rg = graphOf([line([[0, 0], [100, 0], [200, 0]])])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([200, 0])
    expect(walk.lengthM).toBeCloseTo(200)
  })

  it('snur ikke når bare en skarp tilbakesving er igjen', () => {
    // Stien knekker 170° tilbake på seg selv ved (100,0).
    const rg = graphOf([line([[0, 0], [100, 0], [10, 8]])])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([100, 0])
  })

  it('stopper i en løkke i stedet for å gå evig', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0]]),
      line([[100, 0], [200, 100], [100, 200], [0, 100], [100, 0]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates.length).toBeLessThan(40)
    expect(Number.isFinite(walk.lengthM)).toBe(true)
  })

  it('respekterer lengdetaket', () => {
    const coords = []
    for (let i = 0; i <= 100; i++) coords.push([i * 100, 0])
    const rg = graphOf([line(coords)])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0], maxLengthM: 1000 })
    expect(walk.lengthM).toBeGreaterThanOrEqual(1000)
    expect(walk.lengthM).toBeLessThan(1200)
  })

  it('gir tom tur for en ukjent node', () => {
    const rg = graphOf([line([[0, 0], [100, 0]])])
    expect(walkFromNode(rg, 'finnes-ikke').coordinates).toEqual([])
  })
})

describe('walkStartAt — retning bort fra kamera', () => {
  it('velger startretning vekk fra kameraet', () => {
    const rg = graphOf([line([[0, 0], [100, 0], [200, 0]])])
    // Kamera vest for stien: turen skal gå østover.
    const start = walkStartAt(rg, [100, 0], [-500, 0])
    expect(start).not.toBeNull()
    expect(start.headingXY[0]).toBeGreaterThan(0)
    const walk = walkFromNode(rg, start.nodeId, { headingXY: start.headingXY })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([200, 0])
  })

  it('snur når kameraet står på den andre siden', () => {
    const rg = graphOf([line([[0, 0], [100, 0], [200, 0]])])
    const start = walkStartAt(rg, [100, 0], [700, 0])
    const walk = walkFromNode(rg, start.nodeId, { headingXY: start.headingXY })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([0, 0])
  })

  it('gir null når klikket er for langt fra enhver sti', () => {
    const rg = graphOf([line([[0, 0], [100, 0]])])
    expect(walkStartAt(rg, [5000, 5000], [0, 0], { tolM: 120 })).toBeNull()
  })
})

describe('rerouteAtJunction', () => {
  it('beholder det som er gått og fortsetter ned den valgte grenen', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [200, 0]]),
      line([[100, 0], [100, -100], [100, -200]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    const j = walk.junctions[0]
    const sideId = nodeAt(rg, 100, -100)
    const ny = rerouteAtJunction(rg, walk, j, sideId)

    // Prefikset fram til krysset er urørt …
    expect(ny.coordinates[0]).toEqual([0, 0])
    expect(ny.coordinates[1]).toEqual([100, 0])
    // … og resten går nordover i stedet for østover.
    expect(ny.coordinates[ny.coordinates.length - 1]).toEqual([100, -200])
    expect(ny.lengthM).toBeCloseTo(300)
  })

  it('returnerer turen uendret for et kryss som ikke er i den', () => {
    const rg = graphOf([line([[0, 0], [100, 0]])])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    const ny = rerouteAtJunction(rg, walk, { nodeId: 'ukjent', alongM: 0 }, 'n0')
    expect(ny).toBe(walk)
  })
})
