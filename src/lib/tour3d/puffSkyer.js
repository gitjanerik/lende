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
  uniform float uGlimt;        // 0..1 — lyn INNE i skya
  uniform vec3 uGlimtFarge;
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
    // Lyn INNE i skya. Lyset kommer fra puffens KJERNE og ut, ikke fra sola:
    // derfor vektes glimtet mot midten. Det er den vektingen som gjør at det
    // leses som en blits inni en tett masse framfor et lag lagt oppå.
    //
    // Bevisst OVERDREVET (eieren ba om at Tor får vise vreden). To ledd, og
    // begge trengs: mix-leddet drar fargen mot glimtfargen, og det ADDITIVE leddet
    // lar den gå forbi hvitt, som er det som gjør at den blømmer framfor bare å
    // bli lys grå. Uten det additive leddet forsvant glimtet helt i en grå
    // tordensky — målt: knapt til å skille fra uopplyst.
    float kjerne = 1.0 - smoothstep(0.0, 1.05, r);
    float g = clamp(uGlimt, 0.0, 1.0);
    farge = mix(farge, uGlimtFarge, clamp(g * (0.35 + kjerne * 0.9), 0.0, 1.0));
    farge += uGlimtFarge * g * kjerne * 0.85;
    // Svært myk kant: alfa begynner å falle allerede midt i puffen, så puffene
    // SMELTER sammen framfor å ligge som separate kuler oppå hverandre. Det er
    // overlappet, ikke den enkelte puffen, som skal lese som en sky.
    float a = smoothstep(1.0, uKantMyk, r);
    // Glimtet gjør skya litt mer solid mens det står på — en opplyst sky ser
    // tettere ut, og uten dette lyser det «gjennom» henne.
    gl_FragColor = vec4(farge, clamp(a * uTetthet * (1.0 + uGlimt * 1.6), 0.0, 1.0));
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
  // MÅ stemme med relieffet i karttekstur: computeHillshade baker azimuth 315°
  // (sol fra nordvest) og elevasjon 45°. Scenen har nord = −Z og øst = +X, så
  // nordvest-og-opp blir (−0.5, 0.707, −0.5). Fram til v5.22.1 sto z positiv,
  // altså sol fra SØRvest — skyene ble lyssatt fra motsatt side av bakken.
  solRetning = new Vector3(-0.5, 0.707, -0.5).normalize(),
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
        uGlimt: { value: 0 },
        uGlimtFarge: { value: new Color('#ffffff') },
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
    // Skyggeradius på bakken: litt større enn klyngen, for skyggen sprer seg
    // med avstanden ned. Leses av skyskygge.js.
    mesh.userData.skyggeRadius = bredde * 0.55
    group.add(mesh)
    materials.push(mat)
    geometries.push(geo)
    skyer.push(mesh)
  }

  let retningX = 1
  let retningZ = 0
  let fart = 1
  const _sol = new Vector3()

  // Lyn inne i skyene. Et lyn er ikke ett jevnt lys som toner ut — det FLIMRER.
  // Kurven under er derfor to topper: en kort forglimt, et dropp, og så
  // hovedslaget. Tallene er sekunder inn i glimtet og styrke 0..1.
  const GLIMT_KURVE = [
    [0.00, 0.55], [0.05, 0.15], [0.09, 1.00],
    [0.20, 0.75], [0.34, 0.22], [0.48, 0.00],
  ]
  const GLIMT_VARIGHET = GLIMT_KURVE[GLIMT_KURVE.length - 1][0]
  let glimtSky = -1
  let glimtTid = 0

  function glimtStyrke(t) {
    if (t <= 0 || t >= GLIMT_VARIGHET) return 0
    for (let i = 1; i < GLIMT_KURVE.length; i++) {
      const [t1, v1] = GLIMT_KURVE[i]
      if (t <= t1) {
        const [t0, v0] = GLIMT_KURVE[i - 1]
        const k = (t - t0) / Math.max(t1 - t0, 1e-6)
        return v0 + (v1 - v0) * k
      }
    }
    return 0
  }

  return {
    group,
    materials,
    geometries,
    /** Skyene som mesh-er, til skyskyggene. */
    skyer,
    /**
     * Tenn et lyn INNE i en sky. Returnerer skyas posisjon, så den som kalte
     * kan sette lyn-streken under nettopp den skya — glimt og strek som ikke
     * hører sammen leses som to ubeslektede effekter.
     * @param {number} [indeks] hvilken sky; tilfeldig blant de synlige ellers
     */
    glimt(indeks) {
      const synlige = skyer.map((s, i) => (s.visible ? i : -1)).filter((i) => i >= 0)
      if (!synlige.length) return null
      if (indeks != null && skyer[indeks]?.visible) {
        glimtSky = indeks
      } else {
        // Vekt mot de store skyene: et lyn i en liten sky i kanten er ingen
        // opplevelse. Vi trekker tilfeldig blant den største halvparten.
        const sortert = [...synlige].sort((a, b) => skyer[b].scale.x - skyer[a].scale.x)
        const topp = sortert.slice(0, Math.max(1, Math.ceil(sortert.length / 2)))
        glimtSky = topp[Math.floor(Math.random() * topp.length)]
      }
      glimtTid = 0
      return skyer[glimtSky].position
    },
    /** Retningen MOT sola. Skyskyggene må bruke NØYAKTIG denne. */
    solRetning,
    setVaer(preg) {
      // Et glimt midt i et værskifte skal ikke overleve inn i klarvær.
      if (glimtSky >= 0) {
        materials[glimtSky].uniforms.uGlimt.value = 0
        glimtSky = -1
      }
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
      // Lyn-glimtet: flimrer gjennom kurven og slukker seg selv.
      if (glimtSky >= 0) {
        glimtTid += dt
        const v = glimtStyrke(glimtTid)
        materials[glimtSky].uniforms.uGlimt.value = v
        if (v <= 0) {
          materials[glimtSky].uniforms.uGlimt.value = 0
          glimtSky = -1
        }
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
