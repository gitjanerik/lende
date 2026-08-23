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

// SKYENE ER RULLET TILBAKE TIL SLIK DE VAR FØR v5.20.2 (se v5.21.4).
//
// Mellom v5.20.2 og v5.21.3 ble det gjort fem endringer her for å rette at
// skyene så «kuttet» ut på eierens telefon: klipping av blob-radier, et høyere
// lerret, en alfa-vignett, fog: false, materiale pr sprite, alphaTest, større
// felt og nær-kamera-demping. Ingen av dem kunne verifiseres — artefakten viser
// seg BARE på den telefonens GPU, og aldri på skrivebordet eller i CI. Etter tre
// runder var resultatet harde hvite firkanter, altså klart dårligere enn
// utgangspunktet.
//
// Lærdommen, og grunnen til at denne kommentaren står her: en visuell feil som
// bare finnes på ÉN enhet kan ikke rettes ved å endre kode og spørre om det ble
// bedre. Hver runde er et gjett, og gjett akkumulerer. Skal dette tas opp igjen,
// må det starte med en MÅLING fra den enheten — en WebGL-capability-dump
// (webgl1 vs webgl2, maks tekstur, NPOT-håndtering) og gjerne en
// readPixels-prøve — ikke med en ny kodeendring.
//
// Koden under er derfor den opprinnelige, ordrett, med ÉN tilføyelse: setVaer,
// som værmodus (v5.21.1) trenger. Den rører bare synlighet, farge, opasitet og
// driftretning — ingen av mekanismene over.

// Myk skyflekk-tekstur: noen overlappende radielle gradienter på canvas.
function cloudTexture(seed) {
  const px = 256
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px / 2
  const ctx = canvas.getContext('2d')
  const rnd = mulberry32(seed)
  const blobs = 6 + Math.floor(rnd() * 4)
  for (let i = 0; i < blobs; i++) {
    const x = px * (0.2 + rnd() * 0.6)
    const y = (px / 2) * (0.35 + rnd() * 0.3)
    const r = px * (0.1 + rnd() * 0.12)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, px, px / 2)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Drivende skyer over kartet. Billboards med prosedural tekstur — ingen
 * eksterne assets, ~10 sprites, umerkelig på GPU-budsjettet.
 */
export function buildClouds({ widthM, heightM, baseY = 1200, count = 10 } = {}) {
  const group = new Group()
  const rnd = mulberry32(42)
  const spanX = widthM * 1.6
  const spanZ = heightM * 1.6
  const textures = [cloudTexture(7), cloudTexture(13), cloudTexture(29)]
  const materials = textures.map(t => new SpriteMaterial({
    map: t, transparent: true, opacity: 0.85, depthWrite: false,
  }))
  const sprites = []
  for (let i = 0; i < count; i++) {
    const sprite = new Sprite(materials[i % materials.length])
    const w = 1200 + rnd() * 2200
    sprite.scale.set(w, w * 0.35, 1)
    sprite.position.set(
      (rnd() - 0.5) * spanX,
      baseY + rnd() * 700,
      (rnd() - 0.5) * spanZ,
    )
    sprite.userData.driftM = 8 + rnd() * 14
    group.add(sprite)
    sprites.push(sprite)
  }

  // Værmodus. Materialene er DELTE (tre stykker, som i originalen), så farge og
  // opasitet settes pr materiale og ikke pr sprite — det er godt nok: et værpreg
  // gjelder hele himmelen.
  let retningX = 1
  let retningZ = 0
  let fart = 1

  return {
    group,
    materials,
    textures,
    /**
     * Legg et værpreg på skyene (lib/tour3d/vaerHimmel.js): hvor mange som er
     * synlige, hvor mørke og tette de er, og hvilken vei de drifter.
     * `null` gir standard-himmelen tilbake, uendret.
     */
    setVaer(preg) {
      const synlige = preg
        ? Math.max(1, Math.min(sprites.length, Math.round(preg.antall ?? sprites.length)))
        : sprites.length
      for (let i = 0; i < sprites.length; i++) sprites[i].visible = i < synlige
      const g = preg?.gratone ?? 1
      for (const m of materials) {
        m.opacity = preg?.opasitet ?? 0.85
        m.color.setRGB(g, g, g)
      }
      const l = Math.hypot(preg?.driftX ?? 1, preg?.driftZ ?? 0) || 1
      retningX = (preg?.driftX ?? 1) / l
      retningZ = (preg?.driftZ ?? 0) / l
      fart = preg?.driftFart ?? 1
    },
    update(dt) {
      for (const s of sprites) {
        s.position.x += retningX * s.userData.driftM * fart * dt
        s.position.z += retningZ * s.userData.driftM * fart * dt
        if (s.position.x > spanX / 2) s.position.x -= spanX
        else if (s.position.x < -spanX / 2) s.position.x += spanX
        if (s.position.z > spanZ / 2) s.position.z -= spanZ
        else if (s.position.z < -spanZ / 2) s.position.z += spanZ
      }
    },
    dispose() {
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
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
