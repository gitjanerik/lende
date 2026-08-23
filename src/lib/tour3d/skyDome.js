// Himmel og atmosfære: gradient-kuppel (lys horisont → blå senit), drivende
// prosedurale skyer og avstandsdis. Disen (Fog) plukkes automatisk opp av
// terrengets MeshBasicMaterial og mykner horisonten; kuppelen selv ignorerer
// den (ShaderMaterial uten fog-chunk).

import {
  SphereGeometry, ShaderMaterial, Mesh, BackSide, Color, Fog,
  CanvasTexture, SpriteMaterial, Sprite, Group, SRGBColorSpace,
  BufferGeometry, BufferAttribute, PointsMaterial, Points, AdditiveBlending,
  LineSegments, LineBasicMaterial,
} from 'three'

const ZENITH = '#3d7ec9'
const HORIZON = '#dbe9f5'
export const FOG_COLOR = '#cfe0ee'
const NIGHT_ZENITH = '#070b1a'
const NIGHT_HORIZON = '#1a2947'
export const NIGHT_FOG_COLOR = '#111a30'

export function buildSkyDome({ radius = 25000 } = {}) {
  const geometry = new SphereGeometry(radius, 24, 12)
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new Color(ZENITH) },
      uHorizon: { value: new Color(HORIZON) },
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying float vH;
      void main() {
        float t = smoothstep(-0.05, 0.5, vH);
        gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return {
    mesh, geometry, material,
    setNight(on) {
      material.uniforms.uZenith.value.set(on ? NIGHT_ZENITH : ZENITH)
      material.uniforms.uHorizon.value.set(on ? NIGHT_HORIZON : HORIZON)
    },
  }
}

export function makeFog(maxDimM) {
  return new Fog(new Color(FOG_COLOR), maxDimM * 0.6, maxDimM * 2.6)
}

// Dus måne: myk radiell gradient uten skarp kant, så den leses som lys bak
// tynne skyer framfor en klistret disk.
function moonTexture() {
  const px = 128
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2)
  g.addColorStop(0, 'rgba(255,252,235,0.95)')
  g.addColorStop(0.42, 'rgba(250,246,225,0.72)')
  g.addColorStop(0.62, 'rgba(226,232,240,0.22)')
  g.addColorStop(1, 'rgba(226,232,240,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, px, px)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/**
 * Nattehimmel: én dus måne høyt på kuppelen og et knippe bitte små gule
 * stjerner. Bare synlig i nattmodus — setNight() styrer hele gruppa.
 *
 * Stjernene er ett Points-objekt (ikke sprites): én draw call, ingen tekstur,
 * og `sizeAttenuation: false` gjør at de holder samme pikselstørrelse uansett
 * hvor kuppelen er — de skal være prikker, ikke kuler man flyr forbi.
 * Legges på kuppel-radius × 0.9 så de ligger innenfor himmelen men langt
 * utenfor terrenget, og frustumCulled er av siden vi følger kameraet.
 */
export function buildNightSky({ radius = 25000, starCount = 160 } = {}) {
  const group = new Group()
  group.visible = false

  const rnd = mulberry32(1337)
  const r = radius * 0.9
  const pos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    // Jevnt fordelt over øvre halvkule: cos-vektet høyde unngår klumping i senit.
    const az = rnd() * Math.PI * 2
    const h = 0.12 + rnd() * 0.88            // sin(elevasjon), aldri helt i horisonten
    const ring = Math.sqrt(Math.max(0, 1 - h * h))
    pos[i * 3] = Math.cos(az) * ring * r
    pos[i * 3 + 1] = h * r
    pos[i * 3 + 2] = Math.sin(az) * ring * r
  }
  const starGeo = new BufferGeometry()
  starGeo.setAttribute('position', new BufferAttribute(pos, 3))
  const starMat = new PointsMaterial({
    color: new Color('#ffe9a3'),
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
    // Tåka må ikke røre stjernene (v5.3.0). makeFog setter far til
    // maxDim × 2.6, så på ethvert kart smalere enn ~8,6 km lå hele
    // stjerneskallet (22 500) UTENFOR tåka og ble malt i ren tåkefarge —
    // altså usynlig mot nattehimmelen. Kuppelen slipper unna fordi den
    // bruker en egen shader uten fog-chunk; her må det sies eksplisitt.
    fog: false,
  })
  const stars = new Points(starGeo, starMat)
  stars.frustumCulled = false
  group.add(stars)

  const moonTex = moonTexture()
  const moonMat = new SpriteMaterial({
    map: moonTex, transparent: true, opacity: 0.85, depthWrite: false,
    fog: false,   // samme grunn som stjernene — månen lå på 20 500
  })
  const moon = new Sprite(moonMat)
  const moonR = radius * 0.82
  const moonAz = 2.3
  const moonH = 0.62
  const moonRing = Math.sqrt(Math.max(0, 1 - moonH * moonH))
  moon.position.set(Math.cos(moonAz) * moonRing * moonR, moonH * moonR, Math.sin(moonAz) * moonRing * moonR)
  moon.scale.setScalar(radius * 0.075)
  moon.frustumCulled = false
  group.add(moon)

  return {
    group,
    geometries: [starGeo],
    materials: [starMat, moonMat],
    textures: [moonTex],
    setNight(on) { group.visible = !!on },
    dispose() {
      starGeo.dispose()
      starMat.dispose()
      moonMat.dispose()
      moonTex.dispose()
    },
  }
}

// Skyene bor IKKE her lenger — se lib/tour3d/puffSkyer.js (v5.22.0).
//
// Denne fila hadde en sprite-basert buildClouds fra starten, og den ble forsøkt
// reparert åtte ganger fordi eieren så skyene som «kuttet» og flate i toppen. Alle
// forsøkene var feil sted å lete: en THREE.Sprite ER en flat plate som alltid
// vender mot kameraet, så toppen er flat uansett hva teksturen inneholder,
// silhuetten er den samme fra alle vinkler, og man kan ikke fly gjennom en sky.
// En GPU-måling fra eierens telefon frikjente hele teksturveien (sRGB, mipmap,
// NPOT, tømt lerret, ufullstendig tekstur — alle rene), og da var billboardet
// selv det eneste som sto igjen.
//
// Skyene er derfor klynger av kule-skyggede puffer med ekte utstrekning i tre
// akser. mulberry32 står igjen her fordi nattehimmelen bruker den.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Nedbør. TO objekter, og det er hele poenget:
 *
 *   • REGN og SLUDD er LineSegments — korte streker langs fallretningen. Regn
 *     SER ut som streker, ikke som prikker. Fram til v5.22.1 var alt Points, og
 *     da var regn og snø praktisk talt umulig å skille fra hverandre.
 *   • SNØ er Points — runde fnugg som daler. Der er prikken riktig form.
 *
 * Begge deler ett posisjons-budsjett (NEDBOR_TAK) som avsettes ÉN gang; bare
 * drawRange flyttes når tettheten endres, så en værendring allokerer ingenting
 * midt i en RAF-loop.
 *
 * `fog: false` av samme grunn som stjernene (v5.3.0): makeFog setter far til
 * maxDim × 2,6, og alt utenfor males i ren tåkefarge.
 */
export function buildNedbor({ widthM, heightM, toppY = 2200, maks = 700 } = {}) {
  const group = new Group()
  group.visible = false
  const spanX = widthM * 1.6
  const spanZ = heightM * 1.6
  const hoyde = Math.max(600, toppY)

  const rnd = mulberry32(4711)
  // Én posisjon pr dråpe, delt av begge framstillingene.
  const pos = new Float32Array(maks * 3)
  const spredning = new Float32Array(maks)
  for (let i = 0; i < maks; i++) {
    pos[i * 3] = (rnd() - 0.5) * spanX
    pos[i * 3 + 1] = rnd() * hoyde
    pos[i * 3 + 2] = (rnd() - 0.5) * spanZ
    spredning[i] = 0.7 + rnd() * 0.6
  }

  // --- Snø: punkter -------------------------------------------------------
  const snoGeo = new BufferGeometry()
  const snoAttr = new BufferAttribute(pos, 3)
  snoGeo.setAttribute('position', snoAttr)
  snoGeo.setDrawRange(0, 0)
  const snoMat = new PointsMaterial({
    color: new Color('#ffffff'), size: 3.2, sizeAttenuation: false,
    transparent: true, opacity: 0.62, depthWrite: false, fog: false,
  })
  const sno = new Points(snoGeo, snoMat)
  sno.frustumCulled = false
  sno.visible = false
  group.add(sno)

  // --- Regn/sludd: streker ------------------------------------------------
  // To vertekser pr dråpe: hodet i dråpens posisjon, halen et stykke OPP langs
  // fallretningen. Halen skrives i update(), som også er der fallretningen er
  // kjent (vinden skyver den sidelengs).
  const strekPos = new Float32Array(maks * 2 * 3)
  const strekGeo = new BufferGeometry()
  const strekAttr = new BufferAttribute(strekPos, 3)
  strekGeo.setAttribute('position', strekAttr)
  strekGeo.setDrawRange(0, 0)
  const strekMat = new LineBasicMaterial({
    color: new Color('#cfe0ee'), transparent: true, opacity: 0.5,
    depthWrite: false, fog: false,
  })
  const streker = new LineSegments(strekGeo, strekMat)
  streker.frustumCulled = false
  streker.visible = false
  group.add(streker)

  // Fallfart (m/s), sidedrift, strek-lengde og utseende per type. Tallene er
  // scenefart, ikke fysikk: ekte 9 m/s regn over et 5 km ark ville vært usynlig.
  const TYPER = {
    // `drift` er sidedrift som andel av fallfarten, og den avgjør hvor SKRÅTT
    // regnet står. Sto på 0,10, som ga 4° helning i 12 m/s vind — altså loddrett
    // regn i storm. Nå bøyes nedbøren merkbart av vinden, som er den andre
    // halvdelen av å gjøre vind synlig (v5.22.1).
    regn:  { fall: 300, drift: 0.30, strek: 95, opacity: 0.48, farge: '#cfe0ee', punkt: false },
    sludd: { fall: 190, drift: 0.42, strek: 50, opacity: 0.55, farge: '#e4eef8', punkt: false },
    sno:   { fall: 70,  drift: 0.70, strek: 0,  opacity: 0.62, farge: '#ffffff', punkt: true },
  }
  let type = null
  let antall = 0

  return {
    group,
    geometries: [snoGeo, strekGeo],
    materials: [snoMat, strekMat],
    /**
     * @param {null|'regn'|'sludd'|'sno'} nyType
     * @param {number} tetthet antall dråper, klippet til budsjettet
     */
    setNedbor(nyType, tetthet) {
      type = TYPER[nyType] ? nyType : null
      antall = type ? Math.max(0, Math.min(maks, Math.round(tetthet || 0))) : 0
      group.visible = antall > 0
      if (!type) {
        sno.visible = false
        streker.visible = false
        snoGeo.setDrawRange(0, 0)
        strekGeo.setDrawRange(0, 0)
        return
      }
      const t = TYPER[type]
      sno.visible = t.punkt
      streker.visible = !t.punkt
      snoGeo.setDrawRange(0, t.punkt ? antall : 0)
      strekGeo.setDrawRange(0, t.punkt ? 0 : antall * 2)
      if (t.punkt) {
        snoMat.opacity = t.opacity
        snoMat.color.set(t.farge)
      } else {
        strekMat.opacity = t.opacity
        strekMat.color.set(t.farge)
      }
    },
    /** @param {number} dt  @param {number} vindX  @param {number} vindZ */
    update(dt, vindX = 0, vindZ = 0) {
      if (!antall || !type) return
      const t = TYPER[type]
      const sideX = vindX * t.fall * t.drift
      const sideZ = vindZ * t.fall * t.drift
      for (let i = 0; i < antall; i++) {
        const j = i * 3
        pos[j + 1] -= t.fall * spredning[i] * dt
        pos[j] += sideX * dt
        pos[j + 2] += sideZ * dt
        // Nådd bakken: sett den øverst igjen. Vi bryr oss ikke om terrenghøyden
        // — partiklene er en antydning av nedbør, ikke en simulering.
        if (pos[j + 1] < 0) {
          pos[j + 1] = hoyde
          pos[j] = (pos[j] + spanX * 1.5) % spanX - spanX / 2
          pos[j + 2] = (pos[j + 2] + spanZ * 1.5) % spanZ - spanZ / 2
        }
      }
      if (t.punkt) {
        snoAttr.needsUpdate = true
        return
      }
      // Streken peker MOTSATT vei av fallet: halen ligger der dråpen kom fra.
      // Uten sidedriften i halen ville strekene stått loddrett i sidevind, og da
      // ser regnet ut som et gitter framfor å bli blåst.
      const lengde = t.strek
      const fx = -sideX, fy = t.fall, fz = -sideZ
      const norm = Math.hypot(fx, fy, fz) || 1
      const hx = (fx / norm) * lengde, hy = (fy / norm) * lengde, hz = (fz / norm) * lengde
      for (let i = 0; i < antall; i++) {
        const j = i * 3
        const v = i * 6
        strekPos[v] = pos[j]
        strekPos[v + 1] = pos[j + 1]
        strekPos[v + 2] = pos[j + 2]
        strekPos[v + 3] = pos[j] + hx
        strekPos[v + 4] = pos[j + 1] + hy
        strekPos[v + 5] = pos[j + 2] + hz
      }
      strekAttr.needsUpdate = true
    },
    dispose() {
      snoGeo.dispose(); strekGeo.dispose()
      snoMat.dispose(); strekMat.dispose()
    },
  }
}

/**
 * Lyn: en sikksakk-strek fra skybasen og ned, synlig i selve blinket.
 *
 * Fram til v5.22.1 var torden BARE et løft av dis- og bakgrunnsfargen. Det leste
 * som «himmelen ble litt lysere», ikke som lyn — eieren så det i demoen. Nå
 * tegnes en faktisk strek samtidig, og den er det man ser.
 *
 * Formene bygges ÉN gang (tre stykker) og gjenbrukes; blinket flytter og skalerer
 * bare den som skal vises. Ingen geometri bygges midt i en RAF-loop, og ingen
 * Math.random i byggingen — samme seed gir samme lyn, som gjør det testbart.
 */
export function buildLyn({ toppY = 2000, lengde = 1400, former = 3, ledd = 9 } = {}) {
  const group = new Group()
  group.visible = false
  const rnd = mulberry32(913)

  const geometrier = []
  for (let f = 0; f < former; f++) {
    // Hovedstammen: ledd som vandrer nedover med sidesprang. Pluss én gren
    // omtrent midtveis, som er det som gjør at det leses som lyn og ikke som
    // en sprukken strek.
    const punkter = []
    let x = 0, y = 0, z = 0
    for (let i = 0; i < ledd; i++) {
      const nyY = y - lengde / ledd
      const nyX = x + (rnd() - 0.5) * lengde * 0.16
      const nyZ = z + (rnd() - 0.5) * lengde * 0.10
      punkter.push(x, y, z, nyX, nyY, nyZ)
      x = nyX; y = nyY; z = nyZ
      if (i === Math.floor(ledd * 0.45)) {
        // Grenen: to korte ledd ut til siden, så slutt.
        let gx = x, gy = y, gz = z
        for (let k = 0; k < 2; k++) {
          const bx = gx + (rnd() - 0.35) * lengde * 0.22
          const by = gy - lengde / ledd * 0.7
          const bz = gz + (rnd() - 0.5) * lengde * 0.12
          punkter.push(gx, gy, gz, bx, by, bz)
          gx = bx; gy = by; gz = bz
        }
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(punkter), 3))
    geometrier.push(geo)
  }

  const material = new LineBasicMaterial({
    color: new Color('#f4f8ff'), transparent: true, opacity: 0.95,
    depthWrite: false, fog: false,
  })
  const streker = geometrier.map((g) => {
    const l = new LineSegments(g, material)
    l.frustumCulled = false
    l.visible = false
    group.add(l)
    return l
  })

  let valgt = 0

  return {
    group,
    geometries: geometrier,
    materials: [material],
    /**
     * Vis et lyn ved (x, z), hengende fra `fraY`. Kalles av torden-blinket.
     * Formen roteres tilfeldig om Y så det samme lynet ikke leses som en gjenganger.
     */
    blink(x, z, fraY = toppY, vinkel = 0) {
      for (const l of streker) l.visible = false
      valgt = (valgt + 1) % streker.length
      const l = streker[valgt]
      l.position.set(x, fraY, z)
      l.rotation.y = vinkel
      l.visible = true
      group.visible = true
    },
    slukk() {
      group.visible = false
      for (const l of streker) l.visible = false
    },
    dispose() {
      for (const g of geometrier) g.dispose()
      material.dispose()
    },
  }
}
