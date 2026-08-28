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
import { buildMane, buildNightSky, buildHimmelSkive } from './skyDome.js'
import { FORMASJONER } from './stjerner.js'
import { STJERNER } from './stjerner.js'
import { lokalStjernetid, tilHorisont, presesserTilDato, himmelFor } from './astronomi.js'

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
    // Forventningen MÅ presesseres som himmelen selv gjør (v6.0.0). Uten det
    // sammenlikner testen to ulike jevndøgn, og passerer bare fordi Polstjerna
    // tilfeldigvis flytter seg mindre enn toleransen — altså en test som
    // slutter å bety noe idet noen bytter stjerne eller strammer terskelen.
    const j = presesserTilDato(polaris.ra, polaris.dek, DATO)
    const forventet = tilHorisont(j.ra, j.dek, lst, STED.lat)

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
      // Grensene er CSS-piksler (se stjerneStorrelse), løftet i v6.0.0 etter
      // felttest i mørket.
      expect(st[i]).toBeGreaterThanOrEqual(1.7)
      expect(st[i]).toBeLessThanOrEqual(6.2)
      expect(sty[i]).toBeGreaterThanOrEqual(0.45)
      expect(sty[i]).toBeLessThanOrEqual(1)
    }
    sky.dispose()
  })

  it('skalerer prikkene med pixelRatio, ellers halveres de på en telefon', () => {
    // Dette ER feilen fra felttesten: gl_PointSize er i FRAMEBUFFER-piksler, og
    // sceneCore setter pixelRatio til opptil 2. En stjerne på 2,9 ble 1,5
    // CSS-piksel på telefonen og forsvant, mens desktop (ratio 1) så fin ut.
    const en = buildNightSky({ ...STED, dato: DATO, pikselForhold: 1 })
    const to = buildNightSky({ ...STED, dato: DATO, pikselForhold: 2 })
    const u = (s) => s.group.children[0].material.uniforms.uPikselForhold.value
    expect(u(en)).toBe(1)
    expect(u(to)).toBe(2)
    // Attributtene er de samme — det er shaderen som ganger opp.
    const a = en.group.children[0].geometry.getAttribute('storrelse').array
    const b = to.group.children[0].geometry.getAttribute('storrelse').array
    expect(Array.from(a)).toEqual(Array.from(b))
    // Og et tull-forhold skal ikke krympe stjernene bort.
    const null0 = buildNightSky({ ...STED, dato: DATO, pikselForhold: 0 })
    expect(u(null0)).toBe(1)
    en.dispose(); to.dispose(); null0.dispose()
  })

  it('tegner stjernebilde-linjene med pikselbredde, ikke LineBasicMaterial', () => {
    // LineBasicMaterial IGNORERER linewidth i WebGL — linjene ble alltid én
    // framebuffer-piksel, altså en halv CSS-piksel på telefonen. LineMaterial
    // (LineSegments2) er den samme teknikken høydekurvene og stinettet bruker.
    const sky = buildNightSky({ ...STED, dato: DATO })
    const linjer = sky.group.children.filter((c) => c.type === 'LineSegments2')
    expect(linjer.length).toBeGreaterThan(0)
    for (const l of linjer) {
      expect(l.material.linewidth).toBeGreaterThan(1)
      expect(l.material.resolution).toBeDefined()
    }
    // setResolution må nå ALLE pikselmaterialene, ellers tegnes noen med feil
    // bredde etter en rotasjon av skjermen.
    sky.setResolution(1080, 1920)
    for (const l of linjer) {
      expect(l.material.resolution.x).toBe(1080)
      expect(l.material.resolution.y).toBe(1920)
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

describe('buildNightSky — fremheving av valgt formasjon', () => {
  // Finn en formasjon som faktisk er over horisonten på testtidspunktet, ellers
  // tester vi ingenting.
  const medSynlig = (fn) => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const synlige = sky.synligeStjerner
    const f = FORMASJONER.find((x) => x.stjerner.every((i) => synlige.has(i)))
    expect(f, 'ingen formasjon helt over horisonten — velg et annet tidspunkt').toBeDefined()
    fn(sky, f)
    sky.dispose()
  }

  it('løfter stjernene i den valgte og bare dem', () => {
    medSynlig((sky, f) => {
      const st = sky.group.children[0].geometry.getAttribute('storrelse')
      const for0 = Array.from(st.array)
      sky.settValgt(f)
      const etter = Array.from(st.array)
      const bufferIdx = [...sky.synligeStjerner]
      let loftet = 0
      let urort = 0
      for (let i = 0; i < for0.length; i++) {
        if (etter[i] > for0[i] + 1e-6) loftet++
        else if (Math.abs(etter[i] - for0[i]) < 1e-6) urort++
      }
      expect(loftet).toBe(f.stjerner.length)
      expect(urort).toBe(for0.length - f.stjerner.length)
      expect(bufferIdx.length).toBeGreaterThan(0)
    })
  })

  it('nullstiller mellom valg, så himmelen ikke blir lysere for hvert trykk', () => {
    // Uten nullstillingen hoper faktoren seg opp: velger man fem formasjoner
    // etter hverandre, står den første med 1,6⁵ = 10× størrelse.
    medSynlig((sky, f) => {
      const st = sky.group.children[0].geometry.getAttribute('storrelse')
      sky.settValgt(f)
      const enGang = Array.from(st.array)
      sky.settValgt(f)
      sky.settValgt(f)
      expect(Array.from(st.array)).toEqual(enGang)
      // Og tilbake til null skal gi utgangspunktet.
      sky.settValgt(null)
      const grunn = Array.from(st.array)
      expect(grunn.some((v, i) => v < enGang[i] - 1e-6)).toBe(true)
    })
  })

  it('viser de valgte linjene og skjuler dem igjen', () => {
    medSynlig((sky, f) => {
      const valgt = sky.group.children.find(
        (c) => c.type === 'LineSegments2' && c.material.linewidth > 2,
      )
      expect(valgt).toBeDefined()
      expect(valgt.visible).toBe(false)
      sky.settValgt(f)
      expect(valgt.visible).toBe(true)
      sky.settValgt(null)
      expect(valgt.visible).toBe(false)
    })
  })

  it('tåler en formasjon som er under horisonten', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const synlige = sky.synligeStjerner
    const skjult = FORMASJONER.find((x) => x.stjerner.every((i) => !synlige.has(i)))
    if (skjult) {
      expect(() => sky.settValgt(skjult)).not.toThrow()
      const valgt = sky.group.children.find(
        (c) => c.type === 'LineSegments2' && c.material.linewidth > 2,
      )
      // Ingen synlige ender ⇒ ingen strek å tegne.
      expect(valgt.visible).toBe(false)
    }
    sky.dispose()
  })

  it('tåler tull uten å kaste', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    expect(() => sky.settValgt(undefined)).not.toThrow()
    expect(() => sky.settValgt({})).not.toThrow()
    expect(() => sky.settValgt({ stjerner: [9999], linjer: [[9999, 9998]] })).not.toThrow()
    sky.dispose()
  })

  it('uten sted finnes ingen formasjoner å fremheve, og det skal ikke kaste', () => {
    const sky = buildNightSky({})
    expect(() => sky.settValgt(FORMASJONER[0])).not.toThrow()
    expect(() => sky.setResolution(800, 600)).not.toThrow()
    sky.dispose()
  })
})

describe('buildNightSky — planetene', () => {
  it('tegner en skive per synlig planet, og skjuler resten', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const oppe = new Set(sky.synligePlaneter.map((p) => p.id))
    expect(oppe.size).toBeGreaterThan(0)
    // Fem skiver finnes alltid; bare de oppe er synlige. Uten skjulingen står
    // Jupiter igjen på himmelen etter at den har gått ned.
    const skiver = sky.group.children.filter((c) => c.type === 'Group')
    expect(skiver.length).toBeGreaterThanOrEqual(5)
    sky.dispose()
  })

  it('planetskivene er mye mindre enn månen, men store nok til å leses', () => {
    // Virkelig er en planet 5–50 buesekund — en tiendedel av en piksel. Skiva
    // er en bevisst overdrivelse, men den må være under månens, ellers leses
    // Jupiter som en andre måne.
    const mane = buildMane({ avstand: 10000 })
    const planet = buildHimmelSkive({ avstand: 10000, grader: 0.45 })
    expect(planet.mesh.scale.x).toBeLessThan(mane.mesh.scale.x / 3)
    expect(planet.mesh.scale.x).toBeGreaterThan(0)
    mane.dispose(); planet.dispose()
  })

  it('settPlaneter kan kalles på nytt uten å bygge geometri', () => {
    const sky = buildNightSky({ ...STED, dato: DATO })
    const for0 = sky.geometries.length
    const senere = sky.settPlaneter(new Date('2026-08-14T22:00:00Z'))
    expect(sky.geometries.length).toBe(for0)
    expect(Array.isArray(senere)).toBe(true)
    sky.dispose()
  })

  it('uten sted tegnes ingen planeter', () => {
    const sky = buildNightSky({})
    expect(sky.synligePlaneter).toEqual([])
    expect(sky.settPlaneter(new Date())).toEqual([])
    sky.dispose()
  })
})


describe('buildNightSky — tvungen måne', () => {
  // Skiva på himmelen og lista i himmelObjekter må være enige. Testen her er
  // halvparten av det: at flagget faktisk når fram til skiva, og at bryteren
  // virker MENS visningen står åpen (setteren) og ikke bare ved bygging.
  const oslo = { lat: 59.91, lon: 10.75 }
  const naarMaanenErNede = () => {
    for (let t = 0; t < 24 * 30; t++) {
      const dato = new Date(Date.UTC(2026, 7, 1, t))
      if (himmelFor({ ...oslo, dato }).mane.hoyde < 0) return dato
    }
    throw new Error('fant ikke et tidspunkt med månen under horisonten')
  }

  it('flagget følger med inn i byggingen', () => {
    const dato = naarMaanenErNede()
    const av = buildNightSky({ ...oslo, dato })
    const paa = buildNightSky({ ...oslo, dato, tvingMane: true })
    expect(av.tvingMane).toBe(false)
    expect(paa.tvingMane).toBe(true)
    // Månen står HØYERE med flagget på. Vi leser meshets y-posisjon, som er der
    // skiva faktisk havnet — ikke tallet vi sendte inn. Og den skal være SYNLIG:
    // `sett` skjuler en måne under −2°, så en løftet måne som fortsatt er skjult
    // ville vært en halv fiks.
    expect(paa.mane.mesh.position.y).toBeGreaterThan(av.mane.mesh.position.y)
    expect(av.mane.mesh.visible).toBe(false)
    expect(paa.mane.mesh.visible).toBe(true)
    av.dispose(); paa.dispose()
  })

  it('setteren flytter månen uten at himmelen bygges om', () => {
    const dato = naarMaanenErNede()
    const h = buildNightSky({ ...oslo, dato })
    const for0 = h.mane.mesh.position.y
    h.settTvingMane(true)
    expect(h.tvingMane).toBe(true)
    expect(h.mane.mesh.position.y).toBeGreaterThan(for0)
    // Og tilbake: bryteren skal kunne slås av igjen i samme økt.
    h.settTvingMane(false)
    expect(h.mane.mesh.position.y).toBeCloseTo(for0, 6)
    h.dispose()
  })

  it('uten sted gjør flagget ingenting, og kaster ikke', () => {
    // Kart uten brukbar posisjon får den pseudo-tilfeldige himmelen; der finnes
    // ingen ekte månehøyde å løfte.
    const h = buildNightSky({ tvingMane: true })
    expect(h.astronomisk).toBe(false)
    expect(() => h.settTvingMane(true)).not.toThrow()
    h.dispose()
  })
})
