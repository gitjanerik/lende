// Nordlysgardiner på natthimmelen.
//
// FORMEN ER LODDRETTE STRÅLER, IKKE EN FLATE, og det er hele saken. Nordlyset
// følger jordas magnetfeltlinjer, som står nesten loddrett over Norge — derfor er
// strålene parallelle, og derfor leses et nordlys som nordlys selv i en grov
// framstilling. Samme lærdom som puff-skyene (v5.22.0): en flat plate KAN ikke
// se ut som en sky uansett hva teksturen inneholder, og en jevn grønn flate KAN
// ikke se ut som nordlys uansett hvor pen fargen er.
//
// HVER GARDIN ER ÉN STRIP-GEOMETRI som deformeres i vertex-shaderen. Ikke
// partikler, ikke sprites: en gardin må folde seg sammenhengende, og det er
// nettopp sammenhengen øyet leser som ett draperi framfor mange flekker.
//
// DEFORMASJONEN ER TRE LAG MED ULIK PERIODE, av samme grunn som terrengstøy
// legges i oktaver: én sinus leses som en animasjon, tre som ligger i utakt leses
// som noe levende. De er BEVISST langsomme — en gardin bruker minutter på å folde
// seg, og en som rykker ser ut som en feil.
//
// GJENNOMSIKTIG OG ADDITIV. Stjerner skinner alltid gjennom et nordlys. Additiv
// blanding gjør dessuten at overlappende gardiner blir lysere der de krysser, som
// de gjør i virkeligheten — og den slipper oss unna sorteringsproblemet som ellers
// ville gitt flimrende kanter når man snur kameraet.
//
// depthWrite AV, depthTest AV: gardinene henger i det uendelige sammen med
// stjernehimmelen, og skal aldri klippes av terrenget eller av hverandre.

import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh,
  ShaderMaterial,
} from 'three'
import { FARGER } from './nordlysHimmel.js'

/** Oppløsning per gardin. Nok til en myk fold, lite nok til at sju er gratis. */
const SEG_U = 48
const SEG_V = 10

/**
 * Bygg gardin-gruppa. Skjult til `setNordlys` sier noe annet — nøyaktig som
 * nedbøren: budsjettet avsettes ÉN gang her, og en endring flytter bare
 * uniformer. Et nordlys som slås på skal ikke allokere noe.
 *
 * @param {{radius?: number, maksAntall?: number}} opts
 */
export function buildNordlysGardiner({ radius = 24_000, maksAntall = 7 } = {}) {
  const group = new Group()
  group.visible = false
  // Gardinene henger sammen med resten av himmelen og skal ikke sorteres mot
  // terrenget. Negativ renderOrder ville lagt dem bak stjernene.
  group.renderOrder = 3

  const gardiner = []
  for (let i = 0; i < maksAntall; i++) {
    const mesh = lagGardin(radius, i)
    mesh.visible = false
    group.add(mesh)
    gardiner.push(mesh)
  }

  let styrke = 0
  let fart = 0.05

  return {
    group,

    /**
     * Legg et preg (nordlysHimmel.nordlysPreg) på gardinene. `null` skjuler alt
     * og etterlater ingen spor — samme kontrakt som setVaer(null).
     */
    setPreg(preg) {
      if (!preg) {
        group.visible = false
        for (const g of gardiner) g.visible = false
        styrke = 0
        return
      }
      styrke = preg.styrke
      fart = preg.fart
      const n = Math.min(gardiner.length, preg.antall)
      const gronn = new Color(FARGER.gronn)
      const rod = new Color(FARGER.rod)
      const fiolett = new Color(FARGER.fiolett)

      for (let i = 0; i < gardiner.length; i++) {
        const g = gardiner[i]
        g.visible = i < n
        if (!g.visible) continue
        const u = g.material.uniforms
        // Gardinene fordeles over buen, sentrert i NORD (asimut 0). Nord er −Z i
        // denne scenen, og det er `horisontTilWorld` som eier den konvensjonen —
        // se posisjoneringen i vertex-shaderen under.
        const spredning = preg.bueGrader * Math.PI / 180
        const andel = n === 1 ? 0 : (i / (n - 1)) - 0.5
        u.uAsimut.value = andel * spredning
        u.uFra.value = preg.fraGrader * Math.PI / 180
        u.uTil.value = preg.tilGrader * Math.PI / 180
        u.uStyrke.value = preg.styrke
        u.uRod.value = preg.rodAndel
        u.uFiolett.value = preg.fiolettAndel
        u.uStraaler.value = preg.straaleAndel ?? 1
        u.uGronnFarge.value.copy(gronn)
        u.uRodFarge.value.copy(rod)
        u.uFiolettFarge.value.copy(fiolett)
        // Hver gardin får sin egen fase, ellers folder alle seg i takt og hele
        // feltet ser ut som én bølge.
        u.uFase.value = i * 2.399963
      }
      group.visible = true
    },

    /** Kalles hver frame. `tidS` er sekunder siden start. */
    update(tidS) {
      if (!group.visible) return
      for (const g of gardiner) {
        if (g.visible) g.material.uniforms.uTid.value = tidS * fart
      }
    },

    /** For test og for Info-panelet. */
    get styrke() { return styrke },
    get antallSynlige() { return gardiner.filter((g) => g.visible).length },

    dispose() {
      for (const g of gardiner) {
        g.geometry.dispose()
        g.material.dispose()
      }
    },
  }
}

/**
 * Én gardin: et rutenett i (u, v) der u går langs draperiet og v fra bunn til
 * topp. Geometrien er FLAT i objektrommet; hele formen — buen langs himmelen,
 * høyden og foldene — regnes i vertex-shaderen, så en endring i styrke ikke
 * rører en eneste buffer.
 */
function lagGardin(radius, indeks) {
  const pos = []
  const uv = []
  const idx = []
  for (let j = 0; j <= SEG_V; j++) {
    for (let i = 0; i <= SEG_U; i++) {
      pos.push(0, 0, 0)                     // settes i shaderen
      uv.push(i / SEG_U, j / SEG_V)
    }
  }
  const rad = SEG_U + 1
  for (let j = 0; j < SEG_V; j++) {
    for (let i = 0; i < SEG_U; i++) {
      const a = j * rad + i
      idx.push(a, a + 1, a + rad, a + 1, a + rad + 1, a + rad)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  // Uten en satt bounding sphere culler three geometrien bort: alle posisjonene
  // er (0,0,0) på CPU-siden, så den regner seg fram til en tom kule. Samme
  // klasse felle som instansenes bounding sphere i pinField (v5.22.11).
  geo.computeBoundingSphere()
  geo.boundingSphere.radius = radius * 2

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uTid: { value: 0 },
      uFase: { value: indeks * 2.399963 },
      uRadius: { value: radius },
      uAsimut: { value: 0 },
      uFra: { value: 0.2 },
      uTil: { value: 1.0 },
      uStyrke: { value: 0 },
      uRod: { value: 0 },
      uFiolett: { value: 0 },
      uStraaler: { value: 1 },
      uGronnFarge: { value: new Color(FARGER.gronn) },
      uRodFarge: { value: new Color(FARGER.rod) },
      uFiolettFarge: { value: new Color(FARGER.fiolett) },
    },
    vertexShader: /* glsl */`
      uniform float uTid, uFase, uRadius, uAsimut, uFra, uTil;
      varying vec2 vUv;
      varying float vFold;

      void main() {
        vUv = uv;
        // u spenner ut draperiet i asimut, v fra nedre til øvre kant i høyde.
        float bredde = 0.55;
        float a = uAsimut + (uv.x - 0.5) * bredde;

        // HVER GARDIN HAR SIN EGEN HØYDE, og underkanten er ikke en sirkelbue
        // (v6.5.16). Uten disse to sto de sju gardinene som en jevn mur med
        // matematisk lik topp og bunn — det leses som en flate, ikke som et
        // draperi. Begge er deterministiske funksjoner av uFase, så ingen
        // tilfeldighet og ingen buffer å skrive om.
        float toppFaktor = 0.82 + 0.34 * sin(uFase * 3.3);
        float kantBolge = sin(uv.x * 6.2831 * 1.7 + uFase) * 0.035;
        // Klemt mot horisonten: gardinene tegnes uten depthTest, så en bølget
        // underkant under 0 ville malt grønt OVER terrenget — den ene løgnen
        // dette laget ikke skal fortelle.
        float fra = max(0.0, uFra + kantBolge);
        float h = mix(fra, fra + (uTil - fra) * toppFaktor, uv.y);

        // TRE FOLDER I UTAKT. Periodene er valgt til å IKKE gå opp i hverandre
        // (1 : 2,3 : 5,1), ellers gjentar mønsteret seg synlig hvert par sekund.
        float t = uTid + uFase;
        float f1 = sin(uv.x * 6.2831 * 1.0 + t * 1.00);
        float f2 = sin(uv.x * 6.2831 * 2.3 - t * 0.61) * 0.55;
        float f3 = sin(uv.x * 6.2831 * 5.1 + t * 0.33) * 0.22;
        float fold = f1 + f2 + f3;
        vFold = fold;

        // Folden slår ut i ASIMUT og ikke i høyde: en gardin bølger sidelengs
        // langs himmelen, den hopper ikke opp og ned. Utslaget vokser oppover,
        // slik en fri nedre kant henger roligere enn toppen.
        a += fold * 0.055 * (0.35 + uv.y * 0.65);

        // Nord er −Z (samme konvensjon som horisontTilWorld i astronomi.js).
        float r = cos(h) * uRadius;
        vec3 p = vec3(sin(a) * r, sin(h) * uRadius, -cos(a) * r);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uStyrke, uRod, uFiolett, uStraaler, uTid, uFase;
      uniform vec3 uGronnFarge, uRodFarge, uFiolettFarge;
      varying vec2 vUv;
      varying float vFold;

      void main() {
        // FARGEN SKIFTER MED HØYDEN, ikke på tvers: grønt nederst, rødt over,
        // fiolett frynse helt nede. Snudd er dette den ene feilen alle som har
        // sett nordlys kjenner igjen uten å kunne si hvorfor.
        // Toner ut i BEGGE ender: skarpe kanter avslører geometrien. Nedre kant
        // er hardere enn den øvre, fordi et ekte nordlys har en tydelig underkant
        // (der partiklene stopper) og en diffus topp.
        float loddrett = smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        float sidelengs = smoothstep(0.0, 0.22, vUv.x) * (1.0 - smoothstep(0.78, 1.0, vUv.x));

        // FARGEN SKIFTER MED HØYDEN, ikke på tvers: grønt nederst, rødt over,
        // fiolett frynse helt nede. Snudd er dette den ene feilen alle som har
        // sett nordlys kjenner igjen uten å kunne si hvorfor.
        //
        // PORTENE MÅ LIGGE DER «loddrett» FAKTISK SLIPPER LYS GJENNOM, og det er
        // feilen som ble rettet i v6.5.16: rødt var portet på smoothstep(0.45,
        // 1.0) mens loddrett begynte å tone ut allerede på 0.55 og var null på
        // 1.0 — altså full rødblanding nøyaktig der alfaen var borte. Fiolett
        // hadde samme feil speilvendt: smoothstep(0.18, 0.0) er full på vUv.y = 0,
        // som er der den nedre utoningen er null. Begge fargene var i praksis
        // multiplisert bort, og resultatet var et nordlys som alltid var grønt.
        // Rører du den ene, se på den andre.
        vec3 farge = uGronnFarge;
        farge = mix(farge, uRodFarge, smoothstep(0.30, 0.85, vUv.y) * uRod);
        farge = mix(farge, uFiolettFarge, smoothstep(0.28, 0.04, vUv.y) * uFiolett);

        // LODDRETTE STRÅLER. Uten dem er gardinen en jevn flate, og en jevn flate
        // er ikke nordlys. To frekvenser i utakt så strålene ikke blir en kam.
        //
        // FREKVENSEN ER MÅLT I STRÅLER PER GRAD, ikke i «en pen verdi»: gardinen
        // er 0,55 rad ≈ 31° bred, så 190 ga tretti stråler over den — altså én
        // per grad, som på en telefon er skanline-striper og ikke et nordlys.
        // 58 gir ni, med drøye tre grader mellom, som er størrelsesordenen på
        // ekte stråler. «uStraaler» demper dem helt bort i svake bånd, som ER
        // diffuse buer uten struktur.
        float r1 = sin(vUv.x * 58.0 + vFold * 2.0);
        float r2 = sin(vUv.x * 23.0 - uTid * 0.4 + uFase);
        float s = 1.0 + uStraaler * (0.45 * r1 + 0.30 * r2);
        s = clamp(s, 0.0, 1.8);

        // Svært langsom pulsering i intensitet — det er sånn et nordlys puster.
        float puls = 0.82 + 0.18 * sin(uTid * 0.7 + uFase * 1.7);

        float a = uStyrke * s * loddrett * sidelengs * puls * 0.48;
        if (a <= 0.002) discard;

        // IKKE «farge * a». AdditiveBlending i three er SRC_ALPHA + ONE, så en
        // ferdig premultiplisert farge blir ganget med alfaen ÉN GANG TIL: ved
        // a = 0,07 ga det 0,005 på skjermen, altså ingenting. Det var
        // hovedgrunnen til at de svake stegene i demoen var usynlige. Skal noen
        // premultiplisere her, må materialet samtidig få «premultipliedAlpha».
        gl_FragColor = vec4(farge, a);
      }
    `,
  })

  const mesh = new Mesh(geo, material)
  mesh.frustumCulled = false
  return mesh
}
