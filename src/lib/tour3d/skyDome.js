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

// Lerretet skyflekkene tegnes på. Høyden var en gang halvparten av bredden,
// og DET var feilen: blob-radiene måles mot BREDDEN, så en dott med r = 54 på
// y = 47 rakk 7 px over kanten. `fillRect` klippet den, og det sto igjen ~10 %
// alfa i øverste teksel-rad — som med ClampToEdge tegnes som en knivrett strek
// tvers over toppen av billboardet. Det var de lyse firkantene i himmelen.
const SKY_TEX_W = 256
const SKY_TEX_H = 160
// Alfa skal være null her. Marginen er ikke pynt: den er beviset på at
// gradienten har fått gå helt ut, ikke blitt kuttet.
const SKY_TEX_MARGIN = 4
// Grunn-opasiteten en sky har når ingenting demper den.
const SKY_OPASITET = 0.85

/**
 * Skydottene i én skyflekk-tekstur: sentre og radier som er GARANTERT innenfor
 * lerretet med margin. Skilt ut fra tegningen fordi det er her feilen kan
 * gjenoppstå, og fordi det da kan testes uten et canvas.
 *
 * Radien klippes mot avstanden til nærmeste kant i stedet for å måles mot
 * bredden aleine. En dott nær kanten blir dermed MINDRE — aldri kuttet.
 */
export function skyDotter(seed, {
  bredde = SKY_TEX_W, hoyde = SKY_TEX_H, margin = SKY_TEX_MARGIN,
} = {}) {
  const rnd = mulberry32(seed)
  const antall = 6 + Math.floor(rnd() * 4)
  const dotter = []
  for (let i = 0; i < antall; i++) {
    // Samme fordeling som før — utseendet skal ikke endres, bare kuttet bort.
    const x = bredde * (0.2 + rnd() * 0.6)
    const y = hoyde * (0.35 + rnd() * 0.3)
    const ønsket = bredde * (0.1 + rnd() * 0.12)
    const r = Math.min(
      ønsket,
      x - margin, bredde - x - margin,
      y - margin, hoyde - y - margin,
    )
    if (r > 1) dotter.push({ x, y, r })
  }
  return dotter
}

// Myk skyflekk-tekstur: noen overlappende radielle gradienter på canvas.
function cloudTexture(seed) {
  const canvas = document.createElement('canvas')
  canvas.width = SKY_TEX_W
  canvas.height = SKY_TEX_H
  const ctx = canvas.getContext('2d')
  for (const { x, y, r } of skyDotter(seed)) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SKY_TEX_W, SKY_TEX_H)
  }
  // Belte OG bukseseler: en elliptisk alfa-maske som tvinger alfa til 0 langs
  // alle fire kanter. skyDotter() skal alt garantere det, men denne holder selv
  // om noen seinere justerer fordelingen og bommer — og det er nettopp det som
  // skjedde sist. Koster én composite-operasjon, én gang per tekstur.
  const maske = ctx.createRadialGradient(
    SKY_TEX_W / 2, SKY_TEX_H / 2, 0,
    SKY_TEX_W / 2, SKY_TEX_H / 2, SKY_TEX_W / 2,
  )
  maske.addColorStop(0, 'rgba(255,255,255,1)')
  maske.addColorStop(0.72, 'rgba(255,255,255,1)')
  maske.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.save()
  ctx.translate(SKY_TEX_W / 2, SKY_TEX_H / 2)
  ctx.scale(1, SKY_TEX_H / SKY_TEX_W)
  ctx.translate(-SKY_TEX_W / 2, -SKY_TEX_H / 2)
  ctx.fillStyle = maske
  ctx.fillRect(0, 0, SKY_TEX_W, SKY_TEX_H)
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
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
 * eksterne assets, ~14 sprites, umerkelig på GPU-budsjettet.
 *
 * `driftX`/`driftZ` er en retning (normaliseres her), så vindretning fra et
 * ekte værvarsel kan sendes rett inn. Feltet resirkulerer langs BEGGE akser,
 * ikke bare +X: så snart driften har en Z-komponent, ville en X-bare-wrap
 * tømme feltet nordover og etterlate en tom himmel på den ene sida.
 */
export function buildClouds({
  widthM, heightM, baseY = 1200, count = 14,
  driftX = 1, driftZ = 0,
} = {}) {
  const group = new Group()
  const rnd = mulberry32(42)
  // Feltet var 1,6 × arket. Åpningsposen i freeRig legger kameraet ca.
  // 0,63 × span meter opp og utenfor den halvbredda, så spredningen av
  // billboards SLUTTET midt i bildet når man så ovenfra-og-ned — enda en grunn
  // til at himmelen så avkuttet ut. 2,6 × dekker den utsikten.
  const spanX = widthM * 2.6
  const spanZ = heightM * 2.6
  const textures = [cloudTexture(7), cloudTexture(13), cloudTexture(29)]
  // Ett materiale PER sprite (ikke tre delte): opasiteten dempes individuelt
  // etter avstand til kameraet, se update(). Fjorten materialer mot tre er
  // ingenting her, og tre teksturer deles fortsatt.
  const materials = []
  const sprites = []
  // Sprite-høyden følger TEKSTURENS sideforhold. Faktoren 0,7 er valgt så
  // uttrykket gir 0,35 ved det gamle 2:1-lerretet — skyene skal se like ut som
  // før, bare uten kuttet. Uten denne koblingen strekker et nytt lerret skyene.
  const aspekt = (SKY_TEX_H / SKY_TEX_W) * 0.7
  for (let i = 0; i < count; i++) {
    const material = new SpriteMaterial({
      map: textures[i % textures.length],
      transparent: true,
      opacity: SKY_OPASITET,
      depthWrite: false,
      // Tåka må ikke røre skyene — samme feil som ble rettet for stjernene og
      // månen i v5.3.0 (se begrunnelsen over buildNightSky), men fiksen ble
      // aldri gitt til skyene. makeFog setter far til maxDim × 2,6, og skyene
      // ligger ut til 1,3 × widthM: de fjerneste ble malt i flat FOG_COLOR
      // (#cfe0ee) mot en #3d7ec9 senit. En blek, flat flekk — som i seg selv
      // leses som en avkuttet form.
      fog: false,
    })
    materials.push(material)
    const sprite = new Sprite(material)
    const w = 1200 + rnd() * 2200
    sprite.scale.set(w, w * aspekt, 1)
    sprite.position.set(
      (rnd() - 0.5) * spanX,
      baseY + rnd() * 700,
      (rnd() - 0.5) * spanZ,
    )
    sprite.userData.driftM = 8 + rnd() * 14
    sprite.userData.basisOpasitet = SKY_OPASITET
    group.add(sprite)
    sprites.push(sprite)
  }

  const lengde = Math.hypot(driftX, driftZ) || 1
  let retningX = driftX / lengde
  let retningZ = driftZ / lengde

  return {
    group,
    materials,
    textures,
    /**
     * @param {number} dt sekunder siden forrige frame
     * @param {import('three').Camera} [camera] brukes til nær-demping
     */
    update(dt, camera) {
      for (const s of sprites) {
        s.position.x += retningX * s.userData.driftM * dt
        s.position.z += retningZ * s.userData.driftM * dt
        if (s.position.x > spanX / 2) s.position.x -= spanX
        else if (s.position.x < -spanX / 2) s.position.x += spanX
        if (s.position.z > spanZ / 2) s.position.z -= spanZ
        else if (s.position.z < -spanZ / 2) s.position.z += spanZ
        // Flyr man gjennom en sky i fri-riggen, dekker ett billboard hele
        // skjermen i et hvitt vask og kartet under er borte. Dempingen er
        // derfor lesbarhet, ikke effekt: skyen tones ut idet den kommer
        // nærmere enn sin egen bredde.
        if (camera) {
          const naer = s.scale.x
          const d = s.position.distanceTo(camera.position)
          const faktor = d >= naer ? 1 : Math.max(0, d / naer)
          s.material.opacity = s.userData.basisOpasitet * faktor
        }
      }
    },
    dispose() {
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}
