// Himmel og atmosfære: gradient-kuppel (lys horisont → blå senit), drivende
// prosedurale skyer og avstandsdis. Disen (Fog) plukkes automatisk opp av
// terrengets MeshBasicMaterial og mykner horisonten; kuppelen selv ignorerer
// den (ShaderMaterial uten fog-chunk).

import {
  SphereGeometry, ShaderMaterial, Mesh, BackSide, Color, Fog,
  Group, PlaneGeometry, DoubleSide,
  BufferGeometry, BufferAttribute, PointsMaterial, Points, AdditiveBlending,
  LineSegments, LineBasicMaterial,
} from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { STJERNER, LINJER } from './stjerner.js'
import { PLANETER, synligePlaneter } from './planeter.js'
import { harGlobe } from './himmellegemer.js'
import {
  himmelFor, lokalStjernetid, tilHorisont, horisontTilWorld, presesserTilDato,
} from './astronomi.js'

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

// Månen. Astronomisk plassert, i riktig fase, og en EKTE SIRKEL.
//
// Fram til v5.27.0 var den en THREE.Sprite med en 128 px radiell gradient, og
// eieren meldte at den ikke var sirkelformet. Det er samme klasse feil som
// puff-skyene brukte åtte forsøk på (se kommentaren nederst i fila): formen kan
// ikke reddes i teksturen når det er teksturveien som er problemet. Så vi tok
// teksturen ut av ligningen. En shader som forkaster alt utenfor r = 1 KAN ikke
// tegne noe annet enn en sirkel — uansett driver, mipmap-generering, fargerom
// eller nær-plan. Og fasen falt ut som en gratis bonus, siden vi nå eier hvert
// piksel i skiva.
//
// Skiva vender alltid mot kameraet, og her er billboardet det RIKTIGE svaret og
// ikke en snarvei: månen ER en flat skive sett fra jorda.

// Vinkelstørrelse. Den virkelige månen er 0,52° — det er ni piksler på en
// telefon, altså en lys prikk man ikke kan se fase på. Vi tegner den tre ganger
// for stor. Det er en bevisst kartografisk overdrivelse, som symbolstørrelsene
// i ISOM-katalogen: den skal LESES, ikke måles.
const MANE_GRADER = 1.6
// Nattsida er ikke svart: jordskinn (og øyets egen tilpasning) gjør at man ser
// den mørke delen som en svak skive. Uten den leses en halvmåne som en løsrevet
// bue framfor en kule.
const JORDSKINN = 0.055

/**
 * Månen. Tynn innpakning rundt buildHimmelSkive med månens tall.
 *
 * @param {{radius?: number, avstand?: number}} [opts]
 * @returns {{group: Group, sett: (m: object) => void, update: (camera: object) => void,
 *            geometries: object[], materials: object[], dispose: () => void}}
 */
export function buildMane({ radius = 25000, avstand = null } = {}) {
  return buildHimmelSkive({
    radius,
    avstand: avstand ?? radius * 0.82,
    grader: MANE_GRADER,
    farge: '#fdf6df',
    jordskinn: JORDSKINN,
    // Månen har en globe, og skal derfor bære trykk-ringen som sier det.
    ring: true,
  })
}

/**
 * Én fase-skyggelagt skive på himmelen — månen ELLER en planet.
 *
 * Delt fordi de er samme sak fysisk: en kule opplyst fra siden, sett på
 * avstand. Venus viser sigd akkurat som månen, og shaderen er den samme.
 * Forskjellen er tre tall: vinkelstørrelse, farge og hvor mye nattsida lyser.
 *
 * @param {{radius?: number, avstand?: number, grader?: number, farge?: string,
 *          jordskinn?: number}} [opts]
 */
// TRYKK-RINGEN, i CSS-PIKSLER — ikke i grader, og det er hele rettingen i v6.3.2.
//
// Fram til da var ringen `RING_FAKTOR` × skivas VINKELSTØRRELSE. For månen
// (1,6°) ga det et brukbart omriss, men for en planet på 0,45° ble ringen 17 px
// i diameter og streken under én piksel bred — altså usynlig. Eieren meldte at
// «de tre planetene vises ikke og må åpnes via søk», og det var nettopp dette:
// ringen var der, den var bare sub-piksel.
//
// Nå er den FAST I SKJERMSTØRRELSE og lik for alle fire, uavhengig av hvor stort
// legemet er. 46 px er ikke et tilfeldig tall: det er samme terskel som
// `plukkHimmel` i scene3d bruker, så det man ser er nøyaktig det man kan treffe.
const RING_PX = 46
const RING_STREK_PX = 1.8
/** Ett ripple-omløp, i sekunder. To pulser går et halvt omløp i utakt. */
const RING_PULS_S = 2.6

/**
 * Minste skive-diameter i CSS-piksler.
 *
 * Legemet skal IKKE gjøres uproporsjonalt større enn på den virkelige
 * natthimmelen — det var uttrykkelig bestillingen — men det må være noen piksler
 * stort, ellers er det ingenting å se inni ringen. 0,45° er alt en bevisst
 * overdrivelse (Jupiter er 0,01°); dette gulvet sikrer bare at en liten skjerm
 * ikke tar den ned i null.
 */
const MIN_SKIVE_PX = 5

/**
 * Kameraets vertikale synsfelt, i grader. MÅ følge PerspectiveCamera i
 * sceneCore: verdien oversetter piksler til verdensenheter, og en uenighet her
 * gir ringer i feil størrelse uten at noe kaster.
 */
const FOV_GRADER = 55

export function buildHimmelSkive({
  radius = 25000, avstand = null, grader = MANE_GRADER,
  farge = '#ffffff', jordskinn = JORDSKINN, ring = false,
} = {}) {
  const r = avstand ?? radius * 0.82
  // RINGEN ER EN AFFORDANSE, ikke pynt: den sier «dette kan du trykke på».
  // Månen og de tre planetene som har en globe får den; Merkur og Venus, som
  // ikke har noen, får den ikke — ellers lover omrisset noe som ikke finnes.
  //
  // Den tegnes i SAMME shader og på samme plan som skiva, og planet blåses opp
  // til det største av de to. Et eget mesh ville vært et objekt mer å holde i
  // takt med posisjon, skala og synlighet for ingen gevinst — og med en ring som
  // er fast i piksler mens skiva er fast i grader, ville de to hatt hver sin
  // skalering å holde i sync.
  const geometry = new PlaneGeometry(1, 1)
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      // 0 = nymåne, 1 = fullmåne.
      uLysAndel: { value: 0.75 },
      // Retningen til den LYSE randen, radianer, målt mot klokka fra «opp» på
      // skjermen. Den avgjør hvilken vei månen er skåret; uten den peker en
      // halvmåne tilfeldig.
      uLysside: { value: 0 },
      uFarge: { value: new Color(farge) },
      uJordskinn: { value: jordskinn },
      // Skivas radius i planets enheter. 1 = planet ER skiva (ingen ring).
      uSkive: { value: 1 },
      uRing: { value: ring ? 1 : 0 },
      // Ringens radius og strekbredde, også i planets enheter. Regnes om hver
      // gang skjermhøyden endres, se settSkjermHoyde.
      uRingR: { value: 0 },
      uRingStrek: { value: 0.02 },
      // Sekunder. Driver ripple-en; mates av update() hver frame.
      uTid: { value: 0 },
      uPeriode: { value: RING_PULS_S },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uLysAndel;
      uniform float uLysside;
      uniform vec3 uFarge;
      uniform float uJordskinn;
      uniform float uSkive;
      uniform float uRing;
      uniform float uRingR;
      uniform float uRingStrek;
      uniform float uTid;
      uniform float uPeriode;
      varying vec2 vUv;

      void main() {
        // Planets enheter: q i [-1, 1]². Skiva selv har radius uSkive; resten
        // av planet er luft, og der ligger eventuelt ringen.
        vec2 q = (vUv - 0.5) * 2.0;
        float rq = length(q);
        if (rq > 1.0) discard;

        // RINGEN: en pulserende ripple rundt legemet, som en radar-ping.
        //
        // Den er en AFFORDANSE og ikke pynt: den sier «dette kan du trykke på»,
        // og på en natthimmel er bevegelse det eneste øyet finner av seg selv.
        // Tre lag: et svakt FAST omriss, så det alltid er et mål å sikte på selv
        // i det øyeblikket pulsene er svakest, pluss to pulser som utvider seg
        // utover og dør ut, et halvt omløp i utakt.
        //
        // GUARDEN rq > uSkive er ikke valgfri: uten den kan en puls som passerer
        // over legemet overskrive det, og da blinker Mars i stedet for å ligge
        // stille inni ringen sin.
        if (uRing > 0.5 && rq > uSkive) {
          float a = (1.0 - smoothstep(uRingStrek * 0.45, uRingStrek, abs(rq - uRingR))) * 0.30;
          float indre = uSkive + (uRingR - uSkive) * 0.25;
          for (int i = 0; i < 2; i++) {
            float f = fract(uTid / uPeriode + float(i) * 0.5);
            float rr = mix(indre, uRingR, f);
            float d = abs(rq - rr);
            // Dør ut mot ytterkanten, så pulsen forsvinner der den slutter i
            // stedet for å bli klippet av planet.
            a += (1.0 - smoothstep(uRingStrek * 0.45, uRingStrek, d)) * 0.62 * (1.0 - f);
          }
          if (a > 0.004) {
            gl_FragColor = vec4(uFarge, min(a, 0.9));
            return;
          }
          discard;
        }

        // Enhetsskiva: p i [-1, 1]². Alt utenfor r = 1 finnes ikke.
        vec2 p = q / uSkive;
        float r = length(p);
        if (r > 1.0) discard;

        // Roter inn i lyssidas system: u peker MOT den lyse randen.
        float c = cos(uLysside);
        float sn = sin(uLysside);
        // «Opp» dreid mot klokka med uLysside blir (-sin, cos).
        vec2 lys = vec2(-sn, c);
        float u = dot(p, lys);
        float v = dot(p, vec2(lys.y, -lys.x));

        // Terminatoren på en kule projisert på skiva er en halv ellipse:
        //   u_t = -cos(fasevinkel) * sqrt(1 - v²),  cos(fase) = 2k - 1
        // k = 1 gir u_t på venstre kant (alt lyst), k = 0 på høyre (alt mørkt),
        // k = 0,5 gir u_t = 0 — en rett skillelinje, altså halvmåne.
        float kant = sqrt(max(0.0, 1.0 - v * v));
        float ut = -(2.0 * uLysAndel - 1.0) * kant;
        // Mykning på tvers av terminatoren. Skalert med kant slik at overgangen
        // ikke blir en hard hakk der terminatoren møter randen.
        float myk = 0.035 + 0.10 * (1.0 - kant);
        float lyst = smoothstep(ut - myk, ut + myk, u);

        // Randen: en myk kant i stedet for en trappet sirkel. Bredden er i
        // skive-enheter, så den følger skalaen og ikke pikslene.
        float rand = 1.0 - smoothstep(0.965, 1.0, r);

        float styrke = mix(uJordskinn, 1.0, lyst);
        gl_FragColor = vec4(uFarge * (0.55 + 0.45 * styrke), styrke * rand);
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  // SKALERINGEN. Avstanden er konstant fordi himmelen følger kameraet
  // (sceneCore.updateAmbient), så én verdensenhet på skiva er alltid like mange
  // piksler — men hvor mange, avhenger av skjermhøyden, og den endrer seg.
  //
  // Planet må romme det STØRSTE av skiva og ringen. Er ringen størst, blåses
  // planet opp og `uSkive` krymper tilsvarende, så legemet beholder sin ekte
  // vinkelstørrelse inni en ring som er like stor for alle fire.
  let skjermHoydePx = 900
  let skiveGrader = grader

  function oppdaterSkala() {
    // Verdensenheter per CSS-piksel ved skivas avstand.
    const perPx = (2 * r * Math.tan((FOV_GRADER * Math.PI / 180) / 2)) / skjermHoydePx
    const skiveBredde = Math.max(
      2 * r * Math.tan((skiveGrader * Math.PI / 180) / 2),
      MIN_SKIVE_PX * perPx,
    )
    // 1,18 gir strekken plass innenfor planet: lå ringen helt i kanten, ville
    // `if (rq > 1.0) discard` klippet den ytre halvdelen av den.
    const ringBredde = ring ? RING_PX * perPx * 1.18 : 0
    const planBredde = Math.max(skiveBredde, ringBredde)
    mesh.scale.setScalar(planBredde)
    material.uniforms.uSkive.value = skiveBredde / planBredde
    material.uniforms.uRingR.value = ring ? (RING_PX * perPx) / planBredde : 0
    material.uniforms.uRingStrek.value = (RING_STREK_PX * perPx * 2) / planBredde
  }
  oppdaterSkala()

  const group = new Group()
  group.add(mesh)

  return {
    group,
    mesh,
    geometries: [geometry],
    materials: [material],
    /**
     * Sett månen der himmelen sier den står, i den fasen den har.
     * @param {{azimut:number, hoyde:number, lysAndel:number, lyssideVinkel:number}} m
     */
    sett(m) {
      if (!m || !Number.isFinite(m.azimut) || !Number.isFinite(m.hoyde)) return
      const [x, y, z] = horisontTilWorld(m.azimut, m.hoyde, r)
      mesh.position.set(x, y, z)
      material.uniforms.uLysAndel.value = Math.max(0, Math.min(1, m.lysAndel ?? 0.75))
      material.uniforms.uLysside.value = Number.isFinite(m.lyssideVinkel) ? m.lyssideVinkel : 0
      // Månen under horisonten skal ikke stå og lyse gjennom fjellet. −2° og
      // ikke 0: en måne som står halvveis i horisonten er riktig, og terrenget
      // klipper den selv.
      mesh.visible = m.hoyde > -2 * Math.PI / 180
    },
    /**
     * Vend skiva mot kameraet, og driv ripple-en.
     *
     * Månen ER en flat skive sett fra jorda — derfor kvaternionen. Tida er
     * sekunder og trenger ikke være absolutt; bare monotont voksende.
     */
    update(camera, tidS = null) {
      if (camera) mesh.quaternion.copy(camera.quaternion)
      if (Number.isFinite(tidS)) material.uniforms.uTid.value = tidS
    },
    /**
     * Skjermhøyden i CSS-piksler. Ringen er fast i PIKSLER, så den må regnes om
     * ved hver resize — ellers er den 46 px på den skjermen appen startet på og
     * noe annet etterpå. sceneCore mater den fra setResolution.
     */
    settSkjermHoyde(px) {
      if (!Number.isFinite(px) || px < 1) return
      skjermHoydePx = px
      oppdaterSkala()
    },
    /** Skivas vinkelstørrelse i grader — månen vokser når globen åpnes. */
    settGrader(g) {
      if (!Number.isFinite(g) || g <= 0) return
      skiveGrader = g
      oppdaterSkala()
    },
    /** Skivas radius i planets enheter — for test. */
    get skiveAndel() { return material.uniforms.uSkive.value },
    /** Ringens radius i planets enheter, 0 uten ring — for test. */
    get ringAndel() { return material.uniforms.uRingR.value },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

// Stjernestørrelse fra magnitude, i CSS-PIKSLER. Lineær i magnitude, som er en
// logaritmisk skala — det er nettopp derfor det ser riktig ut: øyet leser
// lysstyrke logaritmisk.
//
// «CSS-piksler» er poenget, og det var feilen fram til v6.0.0: `gl_PointSize`
// måles i FRAMEBUFFER-piksler, og sceneCore setter pixelRatio til opptil 2. En
// stjerne på 2,9 ble derfor 1,5 CSS-piksel på eierens telefon og forsvant nesten
// helt, mens den så helt fin ut på en desktop med pixelRatio 1. Shaderen
// multipliserer nå med `uPikselForhold`, så tallene her betyr det samme overalt.
//
// Tallene er dessuten løftet et hakk etter felttest i mørket: 5,0 → 6,2 i taket
// og 1,1 → 1,7 i gulvet. «Litt større», ikke store — en stjernehimmel av
// diskoslys er ikke en stjernehimmel.
function stjerneStorrelse(mag) {
  return Math.max(1.7, Math.min(6.2, 5.5 - 0.66 * mag))
}
function stjerneStyrke(mag) {
  return Math.max(0.45, Math.min(1, 1.1 - 0.1 * mag))
}

// Under horisonten er stjerna under bakken, og der har den ingenting å gjøre.
// −1° og ikke 0: en stjerne rett i horisonten er riktig, og terrenget dekker
// den selv.
const HORISONT_MARGIN = -1 * Math.PI / 180

// Hvor kraftig stjernebilde-linjene tegnes. Smak, ikke mekanikk: for høyt og
// himmelen blir et planetarium, for lavt og 147 riktige punkter er ikke til å
// skille fra 160 tilfeldige.
//
// Løftet fra 0,13 til 0,26 etter felttest — men det var ikke opasiteten som var
// hovedproblemet: linjene var `LineBasicMaterial`, og `linewidth` er IGNORERT i
// WebGL. De ble alltid tegnet én framebuffer-piksel bred, altså en halv
// CSS-piksel på en telefon med pixelRatio 2. Nå brukes LineSegments2 +
// LineMaterial, samme teknikk som høydekurvene og stinettet, der bredden
// faktisk er i piksler. Prisen er at materialet trenger renderer-oppløsningen
// som uniform — se setResolution, som sceneCore mater ved resize.
const LINJE_OPASITET = 0.26
const LINJE_BREDDE_PX = 1.7
// Den valgte formasjonen lyser kraftigere. Verdiene er «tydelig, ikke skrikende»:
// man skal se hvilken man har valgt uten at resten av himmelen forsvinner.
const VALGT_LINJE_OPASITET = 0.85
const VALGT_LINJE_BREDDE_PX = 2.6
// Hvor mye større stjernene i den valgte formasjonen tegnes. 1,6 er nok til at
// figuren løfter seg ut av himmelen uten at den ser ut som en annen himmel.
const VALGT_STJERNE_FAKTOR = 1.6

// Planetenes vinkelstørrelse. Virkelig er de 5–50 BUESEKUND, altså en tiendedel
// av en piksel — de er prikker for øyet, og en prikk er umulig å skille fra en
// stjerne. 0,45° er en bevisst overdrivelse, som månens: skiva skal leses som
// «noe annet enn en stjerne», og det er hele grunnen til at planetene er med.
// Månen er 1,6°, så en planet er godt under en tredjedel av den.
const PLANET_GRADER = 0.45
// Nattsida av en planet er ikke synlig i det hele tatt på den avstanden, så
// jordskinnet er nesten null — men ikke helt null, ellers blir en Venus-sigd
// en tynn bue som forsvinner.
const PLANET_JORDSKINN = 0.02

/**
 * Nattehimmel: ekte stjerner der de faktisk står, stjernebilde-linjer som gjør
 * dem gjenkjennelige, og månen i riktig posisjon og fase. Bare synlig i
 * nattmodus — setNight() styrer hele gruppa.
 *
 * Stjernene er ett Points-objekt (ikke sprites): én draw call, ingen tekstur,
 * og gl_PointSize settes direkte i piksler, så de holder samme størrelse uansett
 * hvor kuppelen er — de skal være prikker, ikke kuler man flyr forbi. Størrelsen
 * varierer med magnitude, som er hele grunnen til at Karlsvogna leses som
 * Karlsvogna og ikke som sju like prikker.
 *
 * Himmelen er STATISK, satt ved bygging. Den roterer 15° i timen, som er usynlig
 * i en 3D-økt — og en animert stjernehimmel ville vært en presisjon vi ikke har
 * bruk for. Trengs et nytt tidspunkt, bygges natthimmelen på nytt.
 *
 * Uten lat/lon (ødelagt meta, syntetisk kart) faller vi tilbake på et
 * pseudo-tilfeldig stjernefelt. Det er den gamle himmelen, og den er bedre enn
 * en tom kuppel.
 *
 * @param {{radius?: number, lat?: number|null, lon?: number|null, dato?: Date,
 *          starCount?: number}} [opts]
 */
export function buildNightSky({
  radius = 25000, lat = null, lon = null, dato = null, starCount = 160,
  pikselForhold = 1, tvingHimmel = false,
} = {}) {
  const group = new Group()
  group.visible = false

  const r = radius * 0.9
  const ekteHimmel = Number.isFinite(lat) && Number.isFinite(lon)

  // --- Stjernene ----------------------------------------------------------
  const pos = []
  const storrelse = []
  const styrke = []
  // Katalog-indeks → indeksen stjerna fikk i bufferet, for linjene. Stjerner
  // under horisonten er ikke i bufferet i det hele tatt.
  const bufferIndeks = new Map()

  if (ekteHimmel) {
    const naa = dato ?? new Date()
    const lst = lokalStjernetid(naa, lon)
    for (let i = 0; i < STJERNER.length; i++) {
      const s = STJERNER[i]
      // Katalogen er J2000; stjernetida er i kveld. Uten presesjonen mangler
      // hele himmelen 26 års rotasjon — 16 bueminutter i snitt (v6.0.0).
      const j = presesserTilDato(s.ra, s.dek, naa)
      const { azimut, hoyde } = tilHorisont(j.ra, j.dek, lst, lat)
      if (hoyde < HORISONT_MARGIN) continue
      const [x, y, z] = horisontTilWorld(azimut, hoyde, r)
      bufferIndeks.set(i, pos.length / 3)
      pos.push(x, y, z)
      storrelse.push(stjerneStorrelse(s.mag))
      styrke.push(stjerneStyrke(s.mag))
    }
  } else {
    const rnd = mulberry32(1337)
    for (let i = 0; i < starCount; i++) {
      // Jevnt fordelt over øvre halvkule: cos-vektet høyde unngår klumping i senit.
      const az = rnd() * Math.PI * 2
      const h = 0.12 + rnd() * 0.88            // sin(elevasjon), aldri helt i horisonten
      const ring = Math.sqrt(Math.max(0, 1 - h * h))
      pos.push(Math.cos(az) * ring * r, h * r, Math.sin(az) * ring * r)
      storrelse.push(1.6 + rnd() * 1.6)
      styrke.push(0.55 + rnd() * 0.4)
    }
  }

  const starGeo = new BufferGeometry()
  starGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  starGeo.setAttribute('storrelse', new BufferAttribute(new Float32Array(storrelse), 1))
  starGeo.setAttribute('styrke', new BufferAttribute(new Float32Array(styrke), 1))
  // Egen shader framfor PointsMaterial, fordi størrelse PER stjerne er hele
  // poenget: med én felles `size` blir Sirius og en 4. størrelses stjerne like
  // store, og da bærer ingen av stjernebildene.
  //
  // Ingen fog-chunk her, som var en egen rettelse i v5.3.0: makeFog setter far
  // til maxDim × 2,6, så på ethvert kart smalere enn ~8,6 km lå hele
  // stjerneskallet UTENFOR tåka og ble malt i ren tåkefarge — altså usynlig.
  const starMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uFarge: { value: new Color('#ffeec4') },
      // gl_PointSize er i FRAMEBUFFER-piksler, og renderer.pixelRatio er opptil
      // 2. Uten dette blir «3 piksler» halvparten så stort på en telefon som på
      // en desktop, og stjernene forsvinner nesten — som de gjorde til v6.0.0.
      uPikselForhold: { value: Math.max(1, pikselForhold) },
    },
    vertexShader: `
      attribute float storrelse;
      attribute float styrke;
      uniform float uPikselForhold;
      varying float vStyrke;
      void main() {
        vStyrke = styrke;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = storrelse * uPikselForhold;
      }
    `,
    fragmentShader: `
      uniform vec3 uFarge;
      varying float vStyrke;
      void main() {
        // Rund prikk med myk kant. Uten dette er hver stjerne en firkant, og
        // det ser man på de lyseste.
        float d = length(gl_PointCoord - vec2(0.5));
        float a = (1.0 - smoothstep(0.22, 0.5, d)) * vStyrke;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(uFarge, a);
      }
    `,
  })
  const stars = new Points(starGeo, starMat)
  stars.frustumCulled = false
  group.add(stars)

  // --- Stjernebilde-linjene -----------------------------------------------
  // Bare linjer der BEGGE endene er over horisonten. Et halvt stjernebilde med
  // en strek ut i bakken er verre enn ingen strek.
  const geometrier = [starGeo]
  const materialer = [starMat]
  // Materialene som trenger renderer-oppløsningen (LineMaterial). setResolution
  // mates av sceneCore ved resize, som for høydekurvene.
  const pikselMaterialer = []
  let valgtLinjeGeo = null
  let valgtLinjer = null

  const linjePunkter = (par) => {
    const ut = []
    for (const [a, b] of par) {
      const ia = bufferIndeks.get(a)
      const ib = bufferIndeks.get(b)
      // Bare linjer der BEGGE ender er over horisonten. Et halvt stjernebilde
      // med en strek ut i bakken er verre enn ingen strek.
      if (ia == null || ib == null) continue
      ut.push(pos[ia * 3], pos[ia * 3 + 1], pos[ia * 3 + 2])
      ut.push(pos[ib * 3], pos[ib * 3 + 1], pos[ib * 3 + 2])
    }
    return ut
  }

  if (ekteHimmel) {
    const linjePos = linjePunkter(LINJER)
    if (linjePos.length) {
      const linjeGeo = new LineSegmentsGeometry()
      linjeGeo.setPositions(linjePos)
      const linjeMat = new LineMaterial({
        color: new Color('#9fb6d8'),
        linewidth: LINJE_BREDDE_PX,
        transparent: true,
        opacity: LINJE_OPASITET,
        depthWrite: false,
      })
      const linjer = new LineSegments2(linjeGeo, linjeMat)
      linjer.frustumCulled = false
      group.add(linjer)
      geometrier.push(linjeGeo)
      materialer.push(linjeMat)
      pikselMaterialer.push(linjeMat)
    }

    // Den valgte formasjonen tegnes i et EGET objekt oppå de svake. Geometrien
    // skrives om ved valg; det er billigere og enklere enn en per-vertex-attributt
    // på et LineSegmentsGeometry, og formasjonene er små (4–10 linjer).
    valgtLinjeGeo = new LineSegmentsGeometry()
    valgtLinjeGeo.setPositions([0, 0, 0, 0, 0, 0])
    const valgtMat = new LineMaterial({
      color: new Color('#ffe9a3'),
      linewidth: VALGT_LINJE_BREDDE_PX,
      transparent: true,
      opacity: VALGT_LINJE_OPASITET,
      depthWrite: false,
    })
    valgtLinjer = new LineSegments2(valgtLinjeGeo, valgtMat)
    valgtLinjer.frustumCulled = false
    valgtLinjer.visible = false
    group.add(valgtLinjer)
    geometrier.push(valgtLinjeGeo)
    materialer.push(valgtMat)
    pikselMaterialer.push(valgtMat)
  }

  // --- Planetene ----------------------------------------------------------
  // Én skive per synlig planet, med planetens egen farge og fase. Skivene bygges
  // for HELE katalogen og skjules når planeten ikke er oppe: fem materialer er
  // gratis, og alternativet er å bygge geometri når himmelen endrer seg.
  const planetSkiver = new Map()
  if (ekteHimmel) {
    for (const meta of PLANETER) {
      const skive = buildHimmelSkive({
        radius,
        avstand: radius * 0.86,
        grader: PLANET_GRADER,
        farge: meta.farge,
        jordskinn: PLANET_JORDSKINN,
        // RINGEN sier «trykk her». Bare de som HAR en globe får den — Merkur og
        // Venus har ingen (se HIMMELLEGEMER), og et omriss som lover en globe
        // som ikke finnes er verre enn ingen ring.
        ring: harGlobe(meta.id),
      })
      skive.mesh.visible = false
      group.add(skive.group)
      geometrier.push(...skive.geometries)
      materialer.push(...skive.materials)
      planetSkiver.set(meta.id, skive)
    }
  }

  /**
   * Sett planetene der de står nå. Kalles ved bygging og kan kalles på nytt —
   * planetene flytter seg for lite i en 3D-økt til at det er nødvendig, men en
   * himmel bygget i går skal ikke vise Jupiter der den sto da.
   */
  // Hvilket legeme som står som GLOBE nå. settPlaneter må vite det: uten dette
  // ville neste kall vist Jupiter-skiva igjen midt inne i Jupiter-globen.
  let globeLegeme = null

  // Utvikler-bryteren. Deklarert HER, over `settPlaneter`, fordi den leser den —
  // og det første kallet skjer noen linjer under. En `let` lenger ned ville gitt
  // «Cannot access before initialization», som er TDZ-fella CLAUDE.md advarer om.
  let himmelTvang = !!tvingHimmel

  function settPlaneter(naa) {
    if (!ekteHimmel) return []
    const synlige = synligePlaneter({ lat, lon, dato: naa, tving: himmelTvang })
    const oppe = new Set()
    for (const p of synlige) {
      const skive = planetSkiver.get(p.id)
      if (!skive) continue
      oppe.add(p.id)
      if (p.id === globeLegeme) { skive.mesh.visible = false; continue }
      skive.sett({
        azimut: p.azimut,
        hoyde: p.hoyde,
        lysAndel: p.lysAndel,
        // Lyssida peker MOT sola. Vi har ikke en egen parallaktisk vinkel for
        // planetene, og på 0,45° er retningen på en Venus-sigd under det man
        // ser på en telefon — så den står opp, som en fullmåne.
        lyssideVinkel: 0,
      })
    }
    // Resten skjules. Uten dette står Jupiter igjen på himmelen etter at den
    // har gått ned.
    for (const [id, skive] of planetSkiver) {
      if (!oppe.has(id)) skive.mesh.visible = false
    }
    return synlige
  }

  let synligePlanetListe = settPlaneter(dato ?? new Date())

  // --- Månen --------------------------------------------------------------
  const mane = buildMane({ radius })
  group.add(mane.group)
  geometrier.push(...mane.geometries)
  materialer.push(...mane.materials)
  // UTVIKLER-BRYTEREN bor i himmelFor for månen og i synligePlaneter for
  // planetene — de ENE kildene til hvor legemene står. Både skivene her og lista
  // i himmelObjekter går gjennom dem. To steder som tvinger et legeme hver for
  // seg kommer i utakt, og da tilbyr søket en planet trykk ikke finner (samme
  // lærdom som mosaikk-regelen i CLAUDE.md).
  const settMane = () => {
    mane.sett(himmelFor({ lat, lon, dato: dato ?? new Date(), tvingMane: himmelTvang }).mane)
  }
  if (ekteHimmel) {
    settMane()
  } else {
    // Uten sted vet vi ikke fasen. En halvmåne høyt på kuppelen er en ærlig
    // «vi vet ikke» — en fullmåne ville vært en påstand.
    mane.sett({ azimut: 2.3, hoyde: 0.67, lysAndel: 0.5, lyssideVinkel: Math.PI / 2 })
  }

  return {
    group,
    mane,
    /** Antall stjerner som faktisk ble tegnet — for test og feilsøking. */
    get stjerneAntall() { return pos.length / 3 },
    get astronomisk() { return ekteHimmel },
    /** Hvilke katalog-indekser som faktisk ble tegnet (over horisonten). */
    get synligeStjerner() { return new Set(bufferIndeks.keys()) },
    /** Planetene som var over horisonten da himmelen ble bygd. */
    get synligePlaneter() { return synligePlanetListe },
    settPlaneter,
    geometries: geometrier,
    materials: materialer,
    textures: [],
    setNight(on) { group.visible = !!on },
    /**
     * Vend skivene mot kameraet og driv trykk-ringenes ripple.
     *
     * PLANETSKIVENE MÅ MED, ikke bare månen: ringen er en shader-animasjon, og
     * en uniform som ikke mates står stille. Fram til v6.3.2 vendte bare månen
     * seg her — planetskivene sto med kameraets kvaternion fra byggingen, som
     * var riktig helt til man snudde seg.
     */
    update(camera, tidS = null) {
      mane.update(camera, tidS)
      for (const skive of planetSkiver.values()) skive.update(camera, tidS)
    },

    /** Skiva for én planet, så sceneCore kan skjule den mens globen står. */
    planetSkive(id) { return planetSkiver.get(id) ?? null },
    /** Hvilket legeme som står som globe — settPlaneter respekterer den. */
    settGlobeLegeme(id) { globeLegeme = id ?? null },

    /**
     * Utvikler-bryter: løft månen OG planetene med globe over horisonten.
     *
     * Planetene må settes på nytt her, ikke bare månen: `settPlaneter` leser
     * flagget, og uten kallet ville en planet som nettopp ble tvunget opp stått
     * i søkelista uten en skive på himmelen å trykke på.
     *
     * MERK: appen kaller den ikke — flagget leses ved montering, som vær-demoen.
     * Den finnes for konsoll og test, og den oppdaterer IKKE søkelista i
     * Viewer3D. Skal den kalles fra UI, må `himmelObjekter` regnes om samtidig.
     */
    settTvingHimmel(paa) {
      himmelTvang = !!paa
      if (!ekteHimmel) return
      settMane()
      synligePlanetListe = settPlaneter(dato ?? new Date())
    },
    get tvingHimmel() { return himmelTvang },

    /**
     * LineMaterial trenger renderer-oppløsningen som uniform for å kunne tegne
     * i piksler. Mates av sceneCore ved resize, som for høydekurvene.
     */
    setResolution(w, h) {
      for (const m of pikselMaterialer) m.resolution.set(w, h)
      // Trykk-ringene er faste i CSS-PIKSLER, så de må regnes om ved hver
      // resize — ellers er de 46 px på skjermen appen startet på og noe annet
      // etterpå. Rotasjon av telefonen er den vanlige måten å oppdage det.
      mane.settSkjermHoyde(h)
      for (const skive of planetSkiver.values()) skive.settSkjermHoyde(h)
    },

    /**
     * Fremhev én formasjon: linjene tegnes kraftigere i et eget objekt, og
     * stjernene i den løftes i størrelse og styrke.
     *
     * `null` rydder opp. Attributtene skrives om — ingen geometri bygges — så
     * dette kan kalles så ofte man vil.
     *
     * @param {{stjerner: number[], linjer: Array<[number,number]>}|null} formasjon
     */
    settValgt(formasjon) {
      const st = starGeo.getAttribute('storrelse')
      const sty = starGeo.getAttribute('styrke')
      // Alltid tilbake til grunnverdiene først, ellers hoper løftene seg opp
      // etter noen valg og himmelen blir gradvis lysere.
      for (const [katalogIndeks, bufferI] of bufferIndeks) {
        const mag = STJERNER[katalogIndeks].mag
        st.array[bufferI] = stjerneStorrelse(mag)
        sty.array[bufferI] = stjerneStyrke(mag)
      }
      if (formasjon?.stjerner?.length) {
        for (const katalogIndeks of formasjon.stjerner) {
          const bufferI = bufferIndeks.get(katalogIndeks)
          if (bufferI == null) continue
          st.array[bufferI] *= VALGT_STJERNE_FAKTOR
          sty.array[bufferI] = 1
        }
      }
      st.needsUpdate = true
      sty.needsUpdate = true

      if (!valgtLinjer) return
      const par = formasjon?.linjer ?? []
      const punkter = linjePunkter(par)
      if (!punkter.length) {
        valgtLinjer.visible = false
        return
      }
      valgtLinjeGeo.setPositions(punkter)
      // LineSegmentsGeometry cacher en bounding sphere som three ikke
      // invaliderer når posisjonene byttes. Den brukes ikke til raycast her,
      // men frustumCulled er av, så vi nuller den for ordens skyld.
      valgtLinjeGeo.boundingSphere = null
      valgtLinjer.visible = true
    },
    dispose() {
      for (const g of geometrier) g.dispose()
      for (const m of materialer) m.dispose()
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
