// Skyer med volum: klynger av kule-skyggede puffer.
//
// HVORFOR IKKE SPRITES: en THREE.Sprite er en flat plate som alltid vender mot
// kameraet. Da er toppen flat uansett hva teksturen inneholder, silhuetten er
// den samme fra alle vinkler, og man kan ikke fly gjennom en sky. Det var det
// eieren så som «kuttet» — ikke en GPU-feil, men billboardet selv.
//
// Her er hver sky en KLYNGE av puffer med hver sin posisjon i rommet. Hver puff
// er fortsatt en kamera-vendt firkant (billboard i view-space, som er gratis og
// alltid vendt riktig), men klyngen har ekte utstrekning i alle tre akser. Da
// endrer silhuetten seg når man flyr rundt, toppen buler, og puffene passerer
// forbi én for én når man flyr inn i skya.
//
// Hver puff skyggelegges som en KULE: normalen regnes ut av firkantens egne
// koordinater (n.z = sqrt(1 - r²)), og lyses opp mot en sol-retning som er
// oversatt til view-space hver frame. Det er den skyggingen som gjør at det
// leses som volum og ikke som en flekk — lys topp, dempet underside.
//
// Én draw call PER SKY (ikke per puff): alle puffene i en sky ligger i samme
// geometri, og billboardingen skjer i vertex-shaderen. Fjorten skyer = fjorten
// draw calls, som er samme budsjett som før.

import {
  BufferGeometry, BufferAttribute, Mesh, Group, ShaderMaterial, Vector3, Color, Sphere,
} from 'three'

// Ett tak, som resten av 3D-koden: her finnes ingen adaptiv nedtrapping.
export const PUFFER_PR_SKY = 13

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VS = `
  attribute vec3 aSenter;      // puffens midtpunkt i sky-lokale meter
  attribute vec2 aHjorne;      // -1..1 i firkanten
  attribute float aRadius;     // puffens radius i meter
  varying vec2 vHjorne;
  varying float vHoyde;        // 0 = klyngens bunn, 1 = toppen — for fargetoning
  uniform float uKlyngeHoyde;
  void main() {
    vHjorne = aHjorne;
    vHoyde = clamp(aSenter.y / max(uKlyngeHoyde, 1.0) + 0.5, 0.0, 1.0);
    // Billboard i view-space: flytt hjørnet i kameraets eget plan, så puffen
    // alltid vender rett mot betrakteren uten at vi trenger kameraets akser.
    vec4 vp = modelViewMatrix * vec4(aSenter, 1.0);
    vp.xy += aHjorne * aRadius;
    gl_Position = projectionMatrix * vp;
  }
`

const FS = `
  precision mediump float;
  varying vec2 vHjorne;
  varying float vHoyde;
  uniform vec3 uSolView;       // sol-retning i view-space, oppdatert pr frame
  uniform vec3 uLys;           // farge i lyset
  uniform vec3 uSkygge;        // farge i skyggen
  uniform float uTetthet;      // 0..1, hvor solid puffen er
  uniform float uKantMyk;      // hvor tidlig alfa faller
  uniform float uKontrast;     // kule-skyggingens styrke
  void main() {
    float r = length(vHjorne);
    if (r > 1.0) discard;
    // Kule-normal av firkantens koordinater. Dette er hele grunnen til at det
    // leses som volum: hver puff får en rund, skyggelagt overflate.
    vec3 n = vec3(vHjorne, sqrt(max(0.0, 1.0 - r * r)));
    // Dempet kontrast med vilje: full kule-skyggelegging gir blanke biljardkuler.
    // Skyer er tett dis — lyset skal antyde form, ikke modellere en overflate.
    float lys = clamp(dot(n, uSolView) * uKontrast + (1.0 - uKontrast), 0.0, 1.0);
    // Litt ekstra lys mot toppen av klyngen, mørkere mot bunnen — cumulus har
    // flat, dempet base og lys, bulende topp.
    lys = clamp(lys * (0.82 + 0.26 * vHoyde), 0.0, 1.0);
    vec3 farge = mix(uSkygge, uLys, lys);
    // Svært myk kant: alfa begynner å falle allerede midt i puffen, så puffene
    // SMELTER sammen framfor å ligge som separate kuler oppå hverandre. Det er
    // overlappet, ikke den enkelte puffen, som skal lese som en sky.
    float a = smoothstep(1.0, uKantMyk, r);
    gl_FragColor = vec4(farge, a * uTetthet);
  }
`

/**
 * Bygg én skys geometri: PUFFER_PR_SKY kamera-vendte firkanter, fordelt i en
 * flattrykt ellipsoide med flat base og bulende topp.
 */
export function klyngeGeometri(rnd, bredde, radiusFaktor) {
  const n = PUFFER_PR_SKY
  const pos = new Float32Array(n * 4 * 3)      // aSenter, gjentatt pr hjørne
  const hj = new Float32Array(n * 4 * 2)
  const rad = new Float32Array(n * 4)
  const idx = new Uint16Array(n * 6)
  let maksY = 1
  for (let i = 0; i < n; i++) {
    // Fordeling: bred og lav, med en bule oppover. u er «hvor høyt oppe i
    // klyngen» — de øverste puffene er mindre og trekkes mot midten, som gir
    // den karakteristiske blomkål-formen framfor en pannekake.
    const u = i === 0 ? 0 : rnd()
    const spredning = 1 - 0.55 * u
    const vinkel = rnd() * Math.PI * 2
    const avstand = Math.sqrt(rnd()) * spredning
    const cx = Math.cos(vinkel) * avstand * bredde * 0.42
    const cz = Math.sin(vinkel) * avstand * bredde * 0.42 * 0.72
    const cy = (u * 0.40 + rnd() * 0.05) * bredde * 0.5
    // Radien er STOR i forhold til spredningen: puffene skal overlappe kraftig,
    // ellers ser man kulene og ikke skya.
    const r = bredde * (radiusFaktor - 0.38 * radiusFaktor * u) * (0.88 + rnd() * 0.26)
    if (cy > maksY) maksY = cy
    const HJ = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k
      pos[v * 3] = cx; pos[v * 3 + 1] = cy; pos[v * 3 + 2] = cz
      hj[v * 2] = HJ[k][0]; hj[v * 2 + 1] = HJ[k][1]
      rad[v] = r
    }
    const b = i * 4
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('aSenter', new BufferAttribute(pos, 3))
  geo.setAttribute('aHjorne', new BufferAttribute(hj, 2))
  geo.setAttribute('aRadius', new BufferAttribute(rad, 1))
  geo.setIndex(new BufferAttribute(idx, 1))
  // Billboardingen skjer i shaderen, så et bounding-volum regnet fra
  // vertex-posisjonene ville vært feil uansett. Vi setter det EKSPLISITT (og
  // ikke null): geometrien har ingen `position`-attributt — puffsentrene heter
  // aSenter — så three ville ikke klart å regne det ut om noe spurte, og
  // resultatet blir NaN framfor en advarsel.
  geo.boundingSphere = new Sphere(new Vector3(0, maksY * 0.5, 0), bredde)
  return { geo, maksY }
}

/**
 * Drivende skyer med volum. Samme utvendige kontrakt som den gamle
 * sprite-versjonen: group, update(dt), setVaer(preg), dispose().
 */
export function buildPuffClouds({
  widthM, heightM, baseY = 1200, count = 14,
  solRetning = new Vector3(-0.35, 0.86, 0.37).normalize(),
  // De fire tallene som avgjør uttrykket. De står samlet her med vilje: de er
  // smak, ikke mekanikk, og de skal kunne stilles uten å lese shaderen.
  radiusFaktor = 0.34,    // puff-radius / klyngebredde. Høyere = mer overlapp.
  kantMyk = 0.18,         // hvor tidlig alfa begynner å falle. Lavere = skarpere.
  tetthet = 0.62,         // alfa pr puff. Summen av overlappet bærer formen.
  lysKontrast = 0.42,     // kule-skyggingens styrke. Høyt = blanke kuler.
} = {}) {
  const group = new Group()
  const rnd = mulberry32(42)
  const spanX = widthM * 1.9
  const spanZ = heightM * 1.9

  const LYS = new Color('#ffffff')
  const SKYGGE = new Color('#c6d6e6')

  const materials = []
  const geometries = []
  const skyer = []
  for (let i = 0; i < count; i++) {
    const bredde = 1500 + rnd() * 2600
    const { geo, maksY } = klyngeGeometri(rnd, bredde, radiusFaktor)
    const mat = new ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSolView: { value: new Vector3(0, 1, 0) },
        uLys: { value: LYS.clone() },
        uSkygge: { value: SKYGGE.clone() },
        uTetthet: { value: tetthet },
        uKantMyk: { value: kantMyk },
        uKontrast: { value: lysKontrast },
        uKlyngeHoyde: { value: maksY * 2 },
      },
    })
    const mesh = new Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.position.set(
      (rnd() - 0.5) * spanX,
      baseY + rnd() * 800,
      (rnd() - 0.5) * spanZ,
    )
    mesh.userData.driftM = 8 + rnd() * 14
    group.add(mesh)
    materials.push(mat)
    geometries.push(geo)
    skyer.push(mesh)
  }

  let retningX = 1
  let retningZ = 0
  let fart = 1
  const _sol = new Vector3()

  return {
    group,
    materials,
    geometries,
    setVaer(preg) {
      const synlige = preg
        ? Math.max(1, Math.min(skyer.length, Math.round(preg.antall ?? skyer.length)))
        : skyer.length
      for (let i = 0; i < skyer.length; i++) skyer[i].visible = i < synlige
      const g = preg?.gratone ?? 1
      for (const m of materials) {
        m.uniforms.uTetthet.value = (preg?.opasitet ?? 0.85) * (tetthet / 0.85)
        m.uniforms.uLys.value.setRGB(LYS.r * g, LYS.g * g, LYS.b * g)
        m.uniforms.uSkygge.value.setRGB(SKYGGE.r * g, SKYGGE.g * g, SKYGGE.b * g)
      }
      const l = Math.hypot(preg?.driftX ?? 1, preg?.driftZ ?? 0) || 1
      retningX = (preg?.driftX ?? 1) / l
      retningZ = (preg?.driftZ ?? 0) / l
      fart = preg?.driftFart ?? 1
    },
    /** @param {number} dt @param {import('three').Camera} camera */
    update(dt, camera) {
      for (const s of skyer) {
        s.position.x += retningX * s.userData.driftM * fart * dt
        s.position.z += retningZ * s.userData.driftM * fart * dt
        if (s.position.x > spanX / 2) s.position.x -= spanX
        else if (s.position.x < -spanX / 2) s.position.x += spanX
        if (s.position.z > spanZ / 2) s.position.z -= spanZ
        else if (s.position.z < -spanZ / 2) s.position.z += spanZ
      }
      // Sol-retningen må inn i view-space, ellers roterer lyset med kameraet og
      // skyene ser ut som lykter framfor opplyste former.
      if (camera) {
        _sol.copy(solRetning).transformDirection(camera.matrixWorldInverse)
        for (const m of materials) m.uniforms.uSolView.value.copy(_sol)
      }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
