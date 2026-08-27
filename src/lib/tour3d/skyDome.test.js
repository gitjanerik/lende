// Natthimmelen. Ingen WebGL-kontekst trengs: posisjonene og fase-uniformene
// bygges i minnet, og det er nettopp de tallene som avgjør om himmelen står
// riktig vei.
//
// Testen finnes fordi en himmel som er nesten riktig ser helt riktig ut. En
// stjernehimmel speilvendt om nord–sør, en måne skåret på feil side, en
// stjernebilde-linje ut i bakken — ingenting av det ser ødelagt ut på et
// skjermbilde. Her er det tall.
import { describe, it, expect } from 'vitest'
import { PerspectiveCamera, Quaternion, Euler } from 'three'
import { buildMane, buildNightSky } from './skyDome.js'
import { STJERNER } from './stjerner.js'
import { lokalStjernetid, tilHorisont } from './astronomi.js'

// Vardåsen-aktig sted og et tidspunkt vi kan regne etter.
const STED = { lat: 61.2, lon: 8.4 }
const DATO = new Date('2026-02-14T22:30:00Z')

describe('buildMane', () => {
  it('er en skive med fase-uniformer, ikke en tekstur', () => {
    const m = buildMane({ radius: 25000 })
    // Ingen tekstur i det hele tatt — det ER rettelsen. Var formen avhengig av
    // et lerret, kunne den bli hva som helst på en mobil-driver.
    expect(m.materials[0].uniforms.map).toBeUndefined()
    expect(m.materials[0].uniforms.uLysAndel).toBeDefined()
    expect(m.materials[0].uniforms.uLysside).toBeDefined()
    m.dispose()
  })

  it('har konstant vinkelstørrelse: skalaen følger avstanden', () => {
    // Skiva er ~1,6° bred. Doblet avstand ⇒ doblet skala, ellers krymper månen
    // når himmelen blir større.
    const naer = buildMane({ avstand: 10000 })
    const fjern = buildMane({ avstand: 20000 })
    expect(fjern.mesh.scale.x / naer.mesh.scale.x).toBeCloseTo(2, 5)
    // 1,6° på 10 km ≈ 279 m.
    expect(naer.mesh.scale.x).toBeCloseTo(2 * 10000 * Math.tan((1.6 * Math.PI / 180) / 2), 3)
    naer.dispose()
    fjern.dispose()
  })

  it('setter fase og lysside fra det den får', () => {
    const m = buildMane({ avstand: 1000 })
    m.sett({ azimut: Math.PI / 2, hoyde: 0.5, lysAndel: 0.31, lyssideVinkel: -1.2 })
    expect(m.materials[0].uniforms.uLysAndel.value).toBeCloseTo(0.31, 6)
    expect(m.materials[0].uniforms.uLysside.value).toBeCloseTo(-1.2, 6)
    // Azimut 90° = øst = +X i scenens rom.
    expect(m.mesh.position.x).toBeGreaterThan(0)
    expect(Math.abs(m.mesh.position.z)).toBeLessThan(1)
    expect(m.mesh.position.y).toBeGreaterThan(0)
    m.dispose()
  })

  it('klipper lysandelen og tåler tull', () => {
    const m = buildMane({ avstand: 1000 })
    m.sett({ azimut: 0, hoyde: 0.3, lysAndel: 7, lyssideVinkel: NaN })
    expect(m.materials[0].uniforms.uLysAndel.value).toBe(1)
    expect(m.materials[0].uniforms.uLysside.value).toBe(0)
    // Et tomt kall skal ikke flytte noe.
    const for0 = m.mesh.position.clone()
    m.sett(null)
    m.sett({ azimut: NaN, hoyde: 0.3 })
    expect(m.mesh.position.equals(for0)).toBe(true)
    m.dispose()
  })

  it('skjules når den står under horisonten', () => {
    const m = buildMane({ avstand: 1000 })
    m.sett({ azimut: 1, hoyde: 0.4, lysAndel: 0.5, lyssideVinkel: 0 })
    expect(m.mesh.visible).toBe(true)
    m.sett({ azimut: 1, hoyde: -0.4, lysAndel: 0.5, lyssideVinkel: 0 })
    expect(m.mesh.visible).toBe(false)
    m.dispose()
  })

  it('vender skiva mot kameraet', () => {
    const m = buildMane({ avstand: 1000 })
    const kamera = new PerspectiveCamera(55, 1, 1, 60000)
    kamera.quaternion.setFromEuler(new Euler(0.3, 1.1, -0.2))
    m.update(kamera)
    expect(m.mesh.quaternion.equals(kamera.quaternion)).toBe(true)
    // Og uten kamera skal den ikke kaste.
    expect(() => m.update(null)).not.toThrow()
    expect(m.mesh.quaternion.equals(new Quaternion().setFromEuler(new Euler(0.3, 1.1, -0.2))))
      .toBe(true)
    m.dispose()
  })
})

describe('buildNightSky — astronomisk himmel', () => {
  it('tegner bare stjernene som er over horisonten', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    expect(sky.astronomisk).toBe(true)
    expect(sky.stjerneAntall).toBeGreaterThan(30)
    expect(sky.stjerneAntall).toBeLessThan(STJERNER.length)

    const pos = sky.group.children[0].geometry.getAttribute('position').array
    for (let i = 0; i < pos.length; i += 3) {
      // Y er opp. Litt slark for horisont-marginen (−1°).
      const r = Math.hypot(pos[i], pos[i + 1], pos[i + 2])
      expect(pos[i + 1] / r).toBeGreaterThan(-0.02)
    }
    sky.dispose()
  })

  it('plasserer polstjerna i nord, i høyde lik breddegraden', () => {
    // Den ene stjerna hvor svaret er kjent uten en almanakk — og den fanger
    // hele kjeden: katalog → stjernetid → horisont → world-akser.
    const sky = buildNightSky({ ...STED, dato: DATO })
    const lst = lokalStjernetid(DATO, STED.lon)
    const polaris = STJERNER.find((s) => s.navn === 'Polaris')
    const forventet = tilHorisont(polaris.ra, polaris.dek, lst, STED.lat)

    const pos = sky.group.children[0].geometry.getAttribute('position').array
    // Nord er −Z, så polstjerna skal ligge på negativ Z, høyt oppe, og med
    // X nær null.
    let funnet = null
    for (let i = 0; i < pos.length; i += 3) {
      const r = Math.hypot(pos[i], pos[i + 1], pos[i + 2])
      const hoyde = Math.asin(pos[i + 1] / r)
      if (Math.abs(hoyde - forventet.hoyde) < 0.002 && pos[i + 2] < 0
        && Math.abs(pos[i] / r) < 0.03) funnet = [pos[i], pos[i + 1], pos[i + 2], r]
    }
    expect(funnet, 'polstjerna i bufferet').not.toBeNull()
    const [, y, , r] = funnet
    expect(Math.asin(y / r) * 180 / Math.PI).toBeCloseTo(STED.lat, 0)
    sky.dispose()
  })

  it('gir de lyseste stjernene størst prikk', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const geo = sky.group.children[0].geometry
    const st = geo.getAttribute('storrelse').array
    const sty = geo.getAttribute('styrke').array
    expect(st.length).toBe(sky.stjerneAntall)
    expect(Math.max(...st)).toBeGreaterThan(Math.min(...st) + 1)
    for (let i = 0; i < st.length; i++) {
      expect(st[i]).toBeGreaterThan(1)
      expect(st[i]).toBeLessThanOrEqual(5)
      expect(sty[i]).toBeGreaterThan(0.3)
      expect(sty[i]).toBeLessThanOrEqual(1)
    }
    sky.dispose()
  })

  it('tegner ingen stjernebilde-linje ned i bakken', () => {
    // En linje der bare den ene enden er over horisonten ville stukket ned
    // gjennom terrenget. Halve stjernebilder er verre enn ingen strek.
    for (const dato of [
      new Date('2026-02-14T22:30:00Z'),
      new Date('2026-06-14T01:00:00Z'),
      new Date('2026-10-01T20:00:00Z'),
    ]) {
      const sky = buildNightSky({ ...STED, dato })
      const linjer = sky.group.children.find((c) => c.type === 'LineSegments')
      if (linjer) {
        const p = linjer.geometry.getAttribute('position').array
        for (let i = 0; i < p.length; i += 3) {
          const r = Math.hypot(p[i], p[i + 1], p[i + 2])
          expect(p[i + 1] / r).toBeGreaterThan(-0.02)
        }
      }
      sky.dispose()
    }
  })

  it('setter månen i fase fra stedet og tidspunktet', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const u = sky.mane.materials[0].uniforms
    expect(u.uLysAndel.value).toBeGreaterThanOrEqual(0)
    expect(u.uLysAndel.value).toBeLessThanOrEqual(1)
    expect(Number.isFinite(u.uLysside.value)).toBe(true)
    sky.dispose()
  })

  it('fasen endrer seg gjennom måneden', () => {
    const les = (d) => {
      const s = buildNightSky({ ...STED, dato: d })
      const k = s.mane.materials[0].uniforms.uLysAndel.value
      s.dispose()
      return k
    }
    const a = les(new Date('2026-02-01T22:00:00Z'))
    const b = les(new Date('2026-02-08T22:00:00Z'))
    expect(Math.abs(a - b)).toBeGreaterThan(0.1)
  })

  it('er skjult til setNight sier noe annet', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    expect(sky.group.visible).toBe(false)
    sky.setNight(true)
    expect(sky.group.visible).toBe(true)
    sky.setNight(false)
    expect(sky.group.visible).toBe(false)
    sky.dispose()
  })
})

describe('buildNightSky — uten sted', () => {
  it('faller tilbake på et pseudo-tilfeldig felt framfor en tom kuppel', () => {
    const sky = buildNightSky({})
    expect(sky.astronomisk).toBe(false)
    expect(sky.stjerneAntall).toBe(160)
    // Ingen stjernebilde-linjer uten en himmel å knytte dem til.
    expect(sky.group.children.some((c) => c.type === 'LineSegments')).toBe(false)
    // Halvmåne: en ærlig «vi vet ikke», ikke en fullmåne-påstand.
    expect(sky.mane.materials[0].uniforms.uLysAndel.value).toBeCloseTo(0.5, 6)
    sky.dispose()
  })

  it('gir samme himmel to ganger — feltet er seedet, ikke tilfeldig', () => {
    const a = buildNightSky({})
    const b = buildNightSky({})
    const pa = a.group.children[0].geometry.getAttribute('position').array
    const pb = b.group.children[0].geometry.getAttribute('position').array
    expect(Array.from(pa)).toEqual(Array.from(pb))
    a.dispose()
    b.dispose()
  })
})
