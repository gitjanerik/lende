import { describe, it, expect } from 'vitest'
import { buildRoutingGraph } from '../routing.js'
import {
  walkFromNode, walkStartAt, rerouteAtJunction, angleDiff, signedTurn,
  isBlindStub, isInBlindStub, BLIND_STUB_M, findGapHop,
} from './pathWalk.js'

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
    // Gående østover er grenen mot nord (negativ y) til VENSTRE — negativt
    // fortegn. UI-ets høyre/venstre-etiketter hviler på denne konvensjonen.
    expect(j.options[1].turnSigned).toBeLessThan(0)
  })

  it('signedTurn: positiv er høyre i kartrommet (y vokser sørover)', () => {
    // Østover (0) → sørover (+π/2) er en høyresving.
    expect(signedTurn(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    // Østover → nordover er venstre.
    expect(signedTurn(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    // Wrap rundt ±π: fra −170° til +170° er 20° til venstre.
    const d = signedTurn((-170 * Math.PI) / 180, (170 * Math.PI) / 180)
    expect(d).toBeCloseTo((-20 * Math.PI) / 180, 5)
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

describe('blindvei-stumper (< 100 m)', () => {
  it('BLIND_STUB_M er 100 meter', () => {
    expect(BLIND_STUB_M).toBe(100)
  })

  it('et kryss med bare en kort stump som alternativ meldes ikke som kryss', () => {
    // Hovedsti østover med en 60 m adkomststump nordover midt på.
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -60]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([300, 0])
    expect(walk.junctions).toHaveLength(0)
  })

  it('en gren på 100 m eller mer tilbys fortsatt', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -100]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.junctions).toHaveLength(1)
    expect(walk.junctions[0].options).toHaveLength(2)
  })

  it('kjede-stump med flere punkter måles på samlet lengde', () => {
    // Stumpen er 40 + 40 = 80 m fordelt på to segmenter.
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -40], [100, -80]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.junctions).toHaveLength(0)
  })

  it('rettest fram velger aldri en stump når et ekte alternativ finnes', () => {
    // Stumpen fortsetter rett fram; den ekte stien svinger 90° nordover.
    const rg = graphOf([
      line([[0, 0], [100, 0], [160, 0]]),
      line([[100, 0], [100, -300]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([100, -300])
    expect(walk.coordinates.some(([x]) => x === 160)).toBe(false)
  })

  it('turen ender i krysset når alle grener er stumper', () => {
    const rg = graphOf([
      line([[0, 0], [200, 0]]),
      line([[200, 0], [250, 40]]),
      line([[200, 0], [250, -40]]),
    ])
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([200, 0])
  })

  it('isBlindStub skiller stump fra gjennomgående gren', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -60]]),
    ])
    expect(isBlindStub(rg, nodeAt(rg, 100, 0), nodeAt(rg, 100, -60))).toBe(true)
    expect(isBlindStub(rg, nodeAt(rg, 100, 0), nodeAt(rg, 300, 0))).toBe(false)
  })

  it('walkStartAt nekter start på tuppen og midt i en stump', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -40], [100, -80]]),
    ])
    expect(walkStartAt(rg, [100, -80], [100, 500])).toBeNull()
    expect(walkStartAt(rg, [100, -40], [100, 500])).toBeNull()
    // … men hovednettet rett ved fungerer som før.
    expect(walkStartAt(rg, [100, 0], [100, 500])).not.toBeNull()
  })

  it('walkStartAt godtar en lang blindvei', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -150]]),
    ])
    expect(walkStartAt(rg, [100, -150], [100, 500])).not.toBeNull()
  })

  it('en kort isolert stubb nektes også', () => {
    const rg = graphOf([
      line([[0, 0], [300, 0]]),
      line([[500, 500], [540, 500]]),
    ])
    expect(walkStartAt(rg, [520, 500], [520, 900])).toBeNull()
  })

  it('isInBlindStub: kryss og hovednett er aldri stump', () => {
    const rg = graphOf([
      line([[0, 0], [100, 0], [300, 0]]),
      line([[100, 0], [100, -60]]),
    ])
    expect(isInBlindStub(rg, nodeAt(rg, 100, 0))).toBe(false)
    expect(isInBlindStub(rg, nodeAt(rg, 0, 0))).toBe(false)
    expect(isInBlindStub(rg, nodeAt(rg, 100, -60))).toBe(true)
  })
})

describe('findGapHop — fortsettelsen på andre siden av bruddet', () => {
  // Bruddet, isolert: to strekk med et hull imellom, i en graf UTEN hull-broing
  // (den er ruterens jobb, og den slår bare til når omveien er absurd). Her
  // prøves hoppets egne regler.
  const brudd = (gapM, opts = {}) => buildRoutingGraph([
    line([[0, 0], [200, 0]]),
    line([[200 + gapM, 0], [600, 0]]),
  ], { snapM: 2, gapMaxSlopePct: 60, gapObstacleMinM: 8, ...opts })
  const tuppen = (rg) => ({ node: nodeAt(rg, 200, 0), pos: [200, 0], bearing: 0 })

  it('finner fortsettelsen 20 m rett fram', () => {
    const rg = brudd(20)
    const hop = findGapHop(rg, tuppen(rg))
    expect(hop).not.toBeNull()
    expect(hop.pos).toEqual([220, 0])
    expect(hop.length).toBeCloseTo(20)
    expect(hop.bearing).toBeCloseTo(0)
  })

  it('gir opp når bruddet er større enn hoppet tåler', () => {
    expect(findGapHop(brudd(90), tuppen(brudd(90)))).toBeNull()
    // … men taket kan settes ned per tur.
    const rg = brudd(50)
    expect(findGapHop(rg, tuppen(rg), { maxGapM: 30 })).toBeNull()
  })

  it('hopper ikke på tvers — en kryssende sti er ikke samme sti', () => {
    const rg = buildRoutingGraph([
      line([[0, 0], [200, 0]]),
      line([[220, -300], [220, 300]]),
    ], { snapM: 2 })
    expect(findGapHop(rg, tuppen(rg))).toBeNull()
  })

  it('hopper ikke inn i en kort stump', () => {
    const rg = buildRoutingGraph([
      line([[0, 0], [200, 0]]),
      line([[220, 0], [260, 0]]),
    ], { snapM: 2 })
    expect(findGapHop(rg, tuppen(rg))).toBeNull()
  })

  it('hopper ikke over et vann', () => {
    const rg = brudd(20, {
      barriers: [{ coordinates: [[210, -100], [210, 100]], isomCode: '301' }],
    })
    expect(findGapHop(rg, tuppen(rg))).toBeNull()
  })

  it('hopper ikke over et stup — for bratt terreng i hullet', () => {
    // 40 m fall over 20 hull-meter = 200 %, langt over gapMaxSlopePct.
    const rg = brudd(20, { elevationAt: (x) => (x < 210 ? 100 : 60) })
    expect(findGapHop(rg, tuppen(rg))).toBeNull()
  })

  it('hopper ikke tilbake til noder turen alt har vært på', () => {
    const rg = brudd(20)
    const visits = new Map([[nodeAt(rg, 220, 0), 1]])
    expect(findGapHop(rg, tuppen(rg), { visits })).toBeNull()
  })
})

describe('walkFromNode — turen stopper ikke på et lite brudd i stinettet', () => {
  // Slik ser det ekte tilfellet ut: en sti som ender 20 m fra fortsettelsen,
  // men som henger sammen med den via en 430 m omvei. Ruteren broer IKKE et
  // slikt hull (omveien er kort nok til at «gå rundt» er svaret), så vandringen
  // dør her — og en sightseeing-tur på 450 m er ikke en tur.
  const bruddNett = (opts = {}) => buildRoutingGraph([
    line([[0, 0], [300, 0], [450, 0]]),
    line([[470, 0], [800, 0]]),
    line([[300, 0], [300, -40], [500, -40], [500, 0]]),
  ], { snapM: 2, gapBridgeM: 30, gapMaxSlopePct: 60, gapObstacleMinM: 8, ...opts })

  it('fortsetter over bruddet i stedet for å avslutte turen', () => {
    const rg = bruddNett()
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([800, 0])
    expect(walk.hops).toHaveLength(1)
    expect(walk.hops[0].gapM).toBeCloseTo(20)
    expect(walk.hops[0].alongM).toBeCloseTo(450)
    expect(walk.lengthM).toBeCloseTo(800)
  })

  it('hopGapM: 0 gir gammel oppførsel — turen ender på tuppen', () => {
    const rg = bruddNett()
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0], hopGapM: 0 })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([450, 0])
  })

  it('et vann i hullet avslutter turen — slik den skal', () => {
    const rg = bruddNett({
      barriers: [{ coordinates: [[460, -100], [460, 100]], isomCode: '301' }],
    })
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([450, 0])
    expect(walk.hops).toHaveLength(0)
  })

  it('ender fortsatt der stien slutter for godt', () => {
    const rg = buildRoutingGraph([line([[0, 0], [200, 0], [400, 0]])], { snapM: 2 })
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([400, 0])
    expect(walk.hops).toHaveLength(0)
  })

  it('kommer videre der stien ender i en skarp knekk-stump', () => {
    // Dagens stoppregel (170°-knekk) møter et 25 m brudd rett fram.
    const rg = buildRoutingGraph([
      line([[0, 0], [200, 0], [110, 8]]),
      line([[225, 0], [600, 0]]),
    ], { snapM: 2 })
    const walk = walkFromNode(rg, nodeAt(rg, 0, 0), { headingXY: [1, 0] })
    expect(walk.coordinates[walk.coordinates.length - 1]).toEqual([600, 0])
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
