// Himmel og atmosfære: gradient-kuppel (lys horisont → blå senit), drivende
// prosedurale skyer og avstandsdis. Disen (Fog) plukkes automatisk opp av
// terrengets MeshBasicMaterial og mykner horisonten; kuppelen selv ignorerer
// den (ShaderMaterial uten fog-chunk).

import {
  SphereGeometry, ShaderMaterial, Mesh, BackSide, Color, Fog,
  CanvasTexture, SpriteMaterial, Sprite, Group, SRGBColorSpace,
  BufferGeometry, BufferAttribute, PointsMaterial, Points, AdditiveBlending,
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
 * Nedbør: ETT Points-objekt over kartet, bygget etter stjernefeltet i
 * buildNightSky — én draw call, ingen tekstur, ingen per-partikkel-objekt.
 * Punktbudsjettet er avsatt én gang (NEDBOR_TAK) og bare DELER av det er
 * synlig av gangen (`setTetthet`); å bygge geometrien om for hver værendring
 * ville allokert et nytt Float32Array midt i en RAF-loop.
 *
 * `fog: false` av samme grunn som stjernene (v5.3.0): makeFog setter far til
 * maxDim × 2,6, og alt utenfor males i ren tåkefarge.
 *
 * Snø faller sakte og driver sidelengs; regn faller fort og rett. Sludd ligger
 * imellom. Alt er bevisst sparsomt — kartet under skal fortsatt kunne leses.
 */
export function buildNedbor({ widthM, heightM, toppY = 2200, maks = 700 } = {}) {
  const group = new Group()
  group.visible = false
  const spanX = widthM * 1.6
  const spanZ = heightM * 1.6
  const hoyde = Math.max(600, toppY)

  const rnd = mulberry32(4711)
  const pos = new Float32Array(maks * 3)
  // Fartsvariasjon per partikkel, så feltet ikke faller som ett teppe.
  const spredning = new Float32Array(maks)
  for (let i = 0; i < maks; i++) {
    pos[i * 3] = (rnd() - 0.5) * spanX
    pos[i * 3 + 1] = rnd() * hoyde
    pos[i * 3 + 2] = (rnd() - 0.5) * spanZ
    spredning[i] = 0.7 + rnd() * 0.6
  }
  const geo = new BufferGeometry()
  const attr = new BufferAttribute(pos, 3)
  geo.setAttribute('position', attr)
  geo.setDrawRange(0, 0)          // ingenting synlig før setTetthet

  const mat = new PointsMaterial({
    color: new Color('#dbe9f5'),
    size: 2.2,
    sizeAttenuation: false,       // like store uansett avstand — de er dråper, ikke kuler
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    fog: false,
  })
  const points = new Points(geo, mat)
  points.frustumCulled = false
  group.add(points)

  // Fallfart (m/s), sidedrift og utseende per type. Tallene er scenefart, ikke
  // fysikk: ekte 9 m/s regn over et 5 km ark ville vært usynlige streker.
  const TYPER = {
    regn:  { fall: 260, drift: 0.10, size: 1.8, opacity: 0.45, farge: '#cfe0ee' },
    sludd: { fall: 170, drift: 0.22, size: 2.4, opacity: 0.52, farge: '#e4eef8' },
    sno:   { fall: 70,  drift: 0.45, size: 3.2, opacity: 0.62, farge: '#ffffff' },
  }
  let type = null
  let antall = 0

  return {
    group,
    geometries: [geo],
    materials: [mat],
    /**
     * @param {null|'regn'|'sludd'|'sno'} nyType
     * @param {number} tetthet antall punkt, klippet til budsjettet
     */
    setNedbor(nyType, tetthet) {
      type = TYPER[nyType] ? nyType : null
      antall = type ? Math.max(0, Math.min(maks, Math.round(tetthet || 0))) : 0
      group.visible = antall > 0
      geo.setDrawRange(0, antall)
      if (!type) return
      const t = TYPER[type]
      mat.size = t.size
      mat.opacity = t.opacity
      mat.color.set(t.farge)
    },
    /** @param {number} dt sekunder  @param {number} vindX  @param {number} vindZ */
    update(dt, vindX = 0, vindZ = 0) {
      if (!antall || !type) return
      const t = TYPER[type]
      for (let i = 0; i < antall; i++) {
        const j = i * 3
        pos[j + 1] -= t.fall * spredning[i] * dt
        pos[j] += vindX * t.fall * t.drift * dt
        pos[j + 2] += vindZ * t.fall * t.drift * dt
        // Nådd bakken: sett den øverst igjen. Vi bryr oss ikke om terrenghøyden
        // — partiklene er en antydning av nedbør, ikke en simulering, og en
        // dråpe som forsvinner litt over bakken er ikke til å se.
        if (pos[j + 1] < 0) {
          pos[j + 1] = hoyde
          pos[j] = (pos[j] + spanX * 1.5) % spanX - spanX / 2
          pos[j + 2] = (pos[j + 2] + spanZ * 1.5) % spanZ - spanZ / 2
        }
      }
      attr.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
