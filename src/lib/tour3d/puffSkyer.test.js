// Volum-skyene. Ingen WebGL-kontekst trengs: geometri og materialer bygges i
// minnet, og det er nettopp de tallene som avgjør om skyene har volum.
//
// Testen finnes fordi den forrige skyimplementasjonen ble forsøkt reparert åtte
// ganger uten at noe kunne verifiseres. Her er egenskapen som betyr noe —
// utstrekning i TRE akser — et tall som kan måles, ikke en smakssak.
import { describe, it, expect } from 'vitest'
import { buildPuffClouds, klyngeGeometri, mulberry32, PUFFER_PR_SKY } from './puffSkyer.js'

const ARK = { widthM: 8000, heightM: 8000, baseY: 1500 }

function senterSpredning(geo) {
  const a = geo.getAttribute('aSenter').array
  const min = [Infinity, Infinity, Infinity]
  const maks = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < a.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (a[i + k] < min[k]) min[k] = a[i + k]
      if (a[i + k] > maks[k]) maks[k] = a[i + k]
    }
  }
  return [maks[0] - min[0], maks[1] - min[1], maks[2] - min[2]]
}

describe('klyngeGeometri', () => {
  it('har utstrekning i ALLE tre akser', () => {
    // Dette er hele forskjellen fra en sprite. En flat plate har null
    // utstrekning i dybden, og da er toppen flat uansett hva teksturen sier.
    for (const seed of [1, 42, 4711]) {
      const { geo } = klyngeGeometri(mulberry32(seed), 2000, 0.34)
      const [dx, dy, dz] = senterSpredning(geo)
      expect(dx, `seed ${seed}: ingen bredde`).toBeGreaterThan(50)
      expect(dy, `seed ${seed}: ingen HØYDE — klyngen er flat`).toBeGreaterThan(50)
      expect(dz, `seed ${seed}: ingen DYBDE — klyngen er en plate`).toBeGreaterThan(50)
    }
  })

  it('bygger én firkant per puff', () => {
    const { geo } = klyngeGeometri(mulberry32(42), 2000, 0.34)
    expect(geo.getAttribute('aSenter').count).toBe(PUFFER_PR_SKY * 4)
    expect(geo.getIndex().count).toBe(PUFFER_PR_SKY * 6)
  })

  it('gir hver puff en positiv radius', () => {
    const { geo } = klyngeGeometri(mulberry32(42), 2000, 0.34)
    const r = geo.getAttribute('aRadius').array
    for (let i = 0; i < r.length; i++) expect(r[i]).toBeGreaterThan(0)
  })

  it('lar puffene OVERLAPPE — ellers ser man kulene og ikke skya', () => {
    // Summen av radier må være godt større enn klyngens bredde. Skrus
    // radiusFaktor ned uten å tenke, blir skya en klase separate baller.
    const { geo } = klyngeGeometri(mulberry32(42), 2000, 0.34)
    const r = geo.getAttribute('aRadius').array
    let sum = 0
    for (let i = 0; i < r.length; i += 4) sum += r[i]      // én pr puff
    const [dx] = senterSpredning(geo)
    expect(sum).toBeGreaterThan(dx)
  })

  it('setter et eksplisitt bounding-volum', () => {
    // Geometrien har ingen `position`-attributt, så three kan ikke regne det ut
    // selv — et null her gir NaN framfor en advarsel.
    const { geo } = klyngeGeometri(mulberry32(42), 2000, 0.34)
    expect(geo.boundingSphere).toBeTruthy()
    expect(Number.isFinite(geo.boundingSphere.radius)).toBe(true)
  })

  it('er deterministisk — samme seed gir samme sky', () => {
    const a = klyngeGeometri(mulberry32(7), 2000, 0.34).geo.getAttribute('aSenter').array
    const b = klyngeGeometri(mulberry32(7), 2000, 0.34).geo.getAttribute('aSenter').array
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('buildPuffClouds', () => {
  it('bygger én mesh per sky, altså én draw call hver', () => {
    const c = buildPuffClouds({ ...ARK, count: 14 })
    expect(c.group.children).toHaveLength(14)
    expect(c.materials).toHaveLength(14)
    c.dispose()
  })

  it('slår av frustum-culling, siden billboardingen skjer i shaderen', () => {
    const c = buildPuffClouds({ ...ARK, count: 3 })
    for (const m of c.group.children) expect(m.frustumCulled).toBe(false)
    c.dispose()
  })

  it('sprer skyene over arket og over bakken', () => {
    const c = buildPuffClouds({ ...ARK, count: 14 })
    const y = c.group.children.map((m) => m.position.y)
    expect(Math.min(...y)).toBeGreaterThanOrEqual(ARK.baseY)
    // Ikke alle i samme høyde — ellers ligger de som et tak.
    expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(100)
    c.dispose()
  })

  describe('setVaer', () => {
    it('etterlater ingen spor når været slås av', () => {
      const c = buildPuffClouds({ ...ARK, count: 14 })
      const f = () => ({
        synlige: c.group.children.filter((m) => m.visible).length,
        tetthet: +c.materials[0].uniforms.uTetthet.value.toFixed(4),
        lys: +c.materials[0].uniforms.uLys.value.r.toFixed(4),
      })
      const start = f()
      c.setVaer({ antall: 3, opasitet: 0.9, gratone: 0.55, driftX: 0, driftZ: 1, driftFart: 2 })
      expect(f()).not.toEqual(start)
      c.setVaer(null)
      expect(f()).toEqual(start)
      c.dispose()
    })

    it('skjuler skyer i klarvær og mørkner dem i regn', () => {
      const c = buildPuffClouds({ ...ARK, count: 14 })
      c.setVaer({ antall: 1, opasitet: 0.55, gratone: 1 })
      expect(c.group.children.filter((m) => m.visible)).toHaveLength(1)
      c.setVaer({ antall: 14, opasitet: 0.9, gratone: 0.58 })
      expect(c.materials[0].uniforms.uLys.value.r).toBeLessThan(0.7)
      c.dispose()
    })

    it('har alltid minst én synlig sky', () => {
      const c = buildPuffClouds({ ...ARK, count: 14 })
      c.setVaer({ antall: 0, opasitet: 0.5, gratone: 1 })
      expect(c.group.children.filter((m) => m.visible).length).toBeGreaterThanOrEqual(1)
      c.dispose()
    })
  })

  describe('update', () => {
    it('drifter dit vinden går, ikke bare langs +X', () => {
      const c = buildPuffClouds({ ...ARK, count: 4 })
      c.setVaer({ antall: 4, opasitet: 0.85, gratone: 1, driftX: 0, driftZ: 1, driftFart: 1 })
      const f = c.group.children[0]
      const x0 = f.position.x, z0 = f.position.z
      c.update(1)
      expect(Math.abs(f.position.x - x0)).toBeLessThan(0.001)
      expect(f.position.z).toBeGreaterThan(z0)
      c.dispose()
    })

    it('resirkulerer i begge akser framfor å tømme himmelen', () => {
      const c = buildPuffClouds({ ...ARK, count: 2 })
      const f = c.group.children[0]
      f.position.x = ARK.widthM * 1.9 / 2 + 10
      c.update(0.016)
      expect(f.position.x).toBeLessThan(0)
      c.dispose()
    })

    it('takler at kameraet mangler', () => {
      const c = buildPuffClouds({ ...ARK, count: 2 })
      expect(() => c.update(0.016)).not.toThrow()
      c.dispose()
    })
  })
})
