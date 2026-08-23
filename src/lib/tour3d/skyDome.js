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
// BEGGE MÅ VÆRE TOERPOTENSER. v5.20.2 satte høyden til 160 for å gi blobbene
// luft, og det var en regresjon: 160 er ikke en toerpotens, og på WebGL1 — som
// en del Android-webviews fortsatt gir — resampler three.js NPOT-teksturer til
// toerpotens og genererer mipmaps på resultatet. Det kan smøre alfa ut til
// kanten, og da males HELE sprite-quaden som et blekt rektangel i himmelen.
// Luften blobbene trengte kommer fra radius-klippingen i skyDotter, ikke fra
// et høyere lerret.
export const SKY_TEX_W = 256
export const SKY_TEX_H = 128
// Alfa skal være null her. Marginen er ikke pynt: den er beviset på at
// gradienten har fått gå helt ut, ikke blitt kuttet.
export const SKY_TEX_MARGIN = 4
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
      // Kast bort nesten-gjennomsiktige piksler framfor å blande dem inn.
      // Dette er ikke finpuss: symptomet brukeren så var at hele quaden lå der
      // som et blekt rektangel, altså en LAV, JEVN alfa over hele flaten. Den
      // kan komme av mip-gjennomsnitt, driver-resampling eller presisjon — vi
      // kan ikke vite hvilken på en telefon vi ikke har. alphaTest treffer
      // klassen framfor årsaken. 2 % er godt under skyenes egen kant (som går
      // 0 → 75 % over titalls piksler), så formen er uendret.
      alphaTest: 0.02,
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
  let fart = 1

  return {
    group,
    materials,
    textures,
    /**
     * Legg et værpreg på skyene (se lib/tour3d/vaerHimmel.js). Endrer HVOR MANGE
     * sprites som er synlige, hvor mørke og tette de er, og hvilken vei de
     * drifter. Ingen geometri bygges om — bare synlighet, farge og retning, så
     * dette er trygt å kalle hver gang varselet endrer seg.
     *
     * `null` setter alt tilbake til standard-himmelen: værmodus av skal se
     * nøyaktig ut som før værmodus fantes.
     */
    setVaer(preg) {
      const p = preg ?? { antall: sprites.length, opasitet: SKY_OPASITET, gratone: 1, driftX: 1, driftZ: 0, driftFart: 1 }
      const synlige = Math.max(1, Math.min(sprites.length, Math.round(p.antall ?? sprites.length)))
      for (let i = 0; i < sprites.length; i++) {
        const s = sprites[i]
        s.visible = i < synlige
        s.userData.basisOpasitet = p.opasitet ?? SKY_OPASITET
        s.material.opacity = s.userData.basisOpasitet
        // Gråtonen males på materialets `color`, som three multipliserer med
        // teksturen. Teksturen er hvit, så dette er den billigste veien til en
        // regntung sky — ingen ny tekstur, ingen ny draw call.
        const g = p.gratone ?? 1
        s.material.color.setRGB(g, g, g)
      }
      const l = Math.hypot(p.driftX ?? 1, p.driftZ ?? 0) || 1
      retningX = (p.driftX ?? 1) / l
      retningZ = (p.driftZ ?? 0) / l
      fart = p.driftFart ?? 1
    },
    /**
     * @param {number} dt sekunder siden forrige frame
     * @param {import('three').Camera} [camera] brukes til nær-demping
     */
    update(dt, camera) {
      for (const s of sprites) {
        if (!s.visible) continue
        s.position.x += retningX * s.userData.driftM * fart * dt
        s.position.z += retningZ * s.userData.driftM * fart * dt
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
