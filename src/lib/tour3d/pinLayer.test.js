import { describe, it, expect } from 'vitest'
import { Scene, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { createPinLayer } from './pinLayer.js'

// Flat, ekte DEM (samme minimalform som pinField-testen bruker).
const dem = {
  data: new Float32Array(16 * 16).fill(100),
  cols: 16,
  rows: 16,
  noData: -9999,
  transform: { pixelWidth: 10, pixelHeight: 10 },
}
const coords = {
  widthM: 160,
  heightM: 160,
  exaggeration: 1,
  toWorld: (x, y, elev) => [x - 80, elev, y - 80],
  toSvg: (wx, wz) => ({ x: wx + 80, y: wz + 80 }),
  elevToWorldY: (e) => e,
  worldYToElev: (y) => y,
}

const feature = (name, kind, x, y) => ({ name, kind, x, y, ele: null, areaM2: null, categories: null })

// Alle nåler synlige: project() legger dem spredt utover skjermen så
// declutteren ikke har grunn til å skjule noen.
const spredning = (i) => ({ x: 20 + i * 200, y: 20 + i * 200, behind: false })

function lag(project = (x) => spredning(Math.round((x + 80) / 40))) {
  const scene = new Scene()
  return { scene, layer: createPinLayer({ scene, dem, coords, project }) }
}

describe('createPinLayer', () => {
  it('legger nålene i scenen og teller dem', () => {
    const { scene, layer } = lag()
    layer.setFeatures([
      feature('Storhaugen', 'peak', 20, 20),
      feature('Tjernet', 'vann-navn', 100, 100),
    ])
    expect(layer.count).toBe(2)
    expect(scene.children.includes(layer.group)).toBe(true)
    expect(layer.group.children.length).toBe(2)   // stammer + hoder
  })

  it('bygger feltet på nytt ved nytt sett, uten å samle opp gamle nåler', () => {
    const { layer } = lag()
    layer.setFeatures([feature('A', 'peak', 20, 20)])
    layer.setFeatures([feature('B', 'peak', 30, 30), feature('C', 'hytte-navn', 40, 40)])
    expect(layer.count).toBe(2)
    expect(layer.group.children.length).toBe(2)
  })

  it('tomt sett rydder feltet helt', () => {
    const { layer } = lag()
    layer.setFeatures([feature('A', 'peak', 20, 20)])
    layer.setFeatures([])
    expect(layer.count).toBe(0)
    expect(layer.group.children.length).toBe(0)
  })

  it('setVisible skjuler gruppa — og da kan ingenting treffes', () => {
    const { layer } = lag()
    layer.setFeatures([feature('A', 'peak', 80, 80)])
    layer.setVisible(false)
    expect(layer.group.visible).toBe(false)
    expect(layer.raycast(new Raycaster())).toBeNull()
    layer.setVisible(true)
    expect(layer.group.visible).toBe(true)
  })

  it('trykk-treff gir POI-en nåla står for, med bakkepunkt og radius', () => {
    const { layer } = lag()
    const topp = feature('Storhaugen', 'peak', 80, 80)
    layer.setFeatures([topp])
    layer.update(new PerspectiveCamera(60, 1, 1, 5000))

    // Sikt rett ned på nåla: den står i world (0, 100, 0), stammen strekker seg
    // oppover derfra.
    const ray = new Raycaster()
    ray.set(new Vector3(0, 400, 0), new Vector3(0, -1, 0))
    const hit = layer.raycast(ray)
    expect(hit).not.toBeNull()
    expect(hit.feature.name).toBe('Storhaugen')
    expect(hit.world[0]).toBeCloseTo(0, 6)
    expect(hit.world[2]).toBeCloseTo(0, 6)
    expect(hit.radiusM).toBe(60)
  })

  it('radius kommer fra arealet når POI-en har et — store vann rammes inn videre', () => {
    const { layer } = lag()
    const vann = { ...feature('Storvannet', 'vann-omrade', 80, 80), areaM2: Math.PI * 250 * 250 }
    layer.setFeatures([vann])
    layer.update(new PerspectiveCamera(60, 1, 1, 5000))
    const ray = new Raycaster()
    ray.set(new Vector3(0, 400, 0), new Vector3(0, -1, 0))
    expect(layer.raycast(ray).radiusM).toBeCloseTo(250, 5)
  })

  it('gruppefilter tar bort nåler brukeren har slått av', () => {
    const { layer } = lag()
    layer.setFeatures([
      feature('Storhaugen', 'peak', 80, 80),
      feature('Hytta', 'hytte-navn', 40, 40),
    ])
    layer.update(new PerspectiveCamera(60, 1, 1, 5000))
    // Bare hytter: toppen er filtrert bort og kan ikke treffes.
    layer.setGroups(new Set(['hytte']))
    layer.update(new PerspectiveCamera(60, 1, 1, 5000))
    const ray = new Raycaster()
    ray.set(new Vector3(0, 400, 0), new Vector3(0, -1, 0))
    expect(layer.raycast(ray)).toBeNull()
    // … og med filteret av er den tilbake.
    layer.setGroups(null)
    layer.update(new PerspectiveCamera(60, 1, 1, 5000))
    expect(layer.raycast(ray)?.feature.name).toBe('Storhaugen')
  })

  it('declutter kjører på egen kadens, ikke hver frame', () => {
    let kall = 0
    const { layer } = lag((x) => { kall++; return spredning(Math.round((x + 80) / 40)) })
    layer.setFeatures([feature('A', 'peak', 20, 20)])
    const etterOppsett = kall
    layer.maybeDeclutter(10)      // for tidlig
    expect(kall).toBe(etterOppsett)
    layer.maybeDeclutter(400)     // over terskelen
    expect(kall).toBeGreaterThan(etterOppsett)
  })

  // Kollisjonsboksen er hele nåla slik den står på skjermen, ikke en fast
  // firkant rundt hodet. Projeksjonen under er «loddrett»: skjerm-y faller med
  // verdens-y (nåla peker opp) og forskyves av verdens-z, så to nåler kan legges
  // et kjent antall piksler fra hverandre.
  const loddrett = (x, y, z) => ({ x: 100, y: 500 + z - y * 0.5, behind: false })

  it('to nåler som overlapper på skjermen gir bare én — avstands-skalaen teller med', () => {
    const scene = new Scene()
    const layer = createPinLayer({ scene, dem, coords, project: loddrett })
    // Samme svgX, 60 m fra hverandre i svgY → 60 px fra hverandre på skjermen.
    layer.setFeatures([
      feature('Nære toppen', 'peak', 80, 100),
      feature('Fjerne toppen', 'peak', 80, 160),
    ])

    // Nært kamera: nålene er ~30 px høye og går klar av hverandre.
    const naer = new PerspectiveCamera(60, 1, 1, 20000)
    naer.position.set(0, 200, 0)
    layer.update(naer)
    layer.maybeDeclutter(400)
    expect(layer.visibleIndices.size).toBe(2)

    // Langt unna blåses nålene opp til 5× (pinScaleAt), og da står de oppå
    // hverandre. Før v5.18.0 så declutteren en fast 32×52-boks og lot begge stå.
    const langt = new PerspectiveCamera(60, 1, 1, 20000)
    langt.position.set(0, 6200, 0)
    layer.update(langt)
    layer.maybeDeclutter(1000)
    expect(layer.visibleIndices.size).toBe(1)
  })

  it('av to like nåler på samme flekk vinner den nærmeste betrakteren', () => {
    const scene = new Scene()
    const layer = createPinLayer({ scene, dem, coords, project: loddrett })
    // Kameraet står i nord (lav svgY = lav world-z), så nål 1 er nærmest.
    layer.setFeatures([
      feature('Fjerne toppen', 'peak', 80, 150),
      feature('Nære toppen', 'peak', 80, 100),
    ])
    const kam = new PerspectiveCamera(60, 1, 1, 20000)
    kam.position.set(0, 6200, -3000)
    layer.update(kam)
    layer.maybeDeclutter(400)
    const synlige = layer.visibleIndices
    expect(synlige.size).toBe(1)
    expect(synlige.has(1)).toBe(true)
  })

  it('dispose tar gruppa ut av scenen', () => {
    const { scene, layer } = lag()
    layer.setFeatures([feature('A', 'peak', 20, 20)])
    layer.dispose()
    expect(scene.children.includes(layer.group)).toBe(false)
  })
})
