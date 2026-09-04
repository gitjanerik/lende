// Bekreftelses-ripple: to bølger ut fra det man nettopp valgte på himmelen.
//
// PROBLEMET ER IKKE AT VALGET MANGLER, det er at man ikke SER at det skjedde.
// Trykker man på en løs stjerne, står blikket der fingeren var — mens hele
// svaret kommer et helt annet sted på skjermen, i en pille som kanskje alt sto
// der fra forrige valg (v6.3.11: ethvert valg gir sammenlagt kort). Stjerna selv
// løftes 1,6× i størrelse, og det er for lite til å fange et øye som ikke visste
// at det skulle se etter noe.
//
// DEN MÅ SKILLE SEG FRA TRYKK-RINGEN PÅ GLOBENE (v6.3.2), som ligger på de samme
// legemene og sier noe HELT annet — «dette kan du åpne». Tre ting skiller dem, og
// alle tre er med vilje:
//
//   1. Denne er ETT SKUDD og er borte etter drøyt et sekund. Ringen er permanent.
//      Det er den viktigste forskjellen: en effekt som dør har ikke sagt noe om
//      hva legemet ER, den har sagt at noe SKJEDDE.
//   2. Den vokser langt FORBI ringens 46 px (ut til 104) og starter innenfor den,
//      så bevegelsen går gjennom og ut av ringen i stedet for å ligge i den.
//   3. Den er RØD — samme røde som himmelkompassets markør, og av samme grunn:
//      rødt lys ødelegger mørkeadaptasjonen minst, og det er den ene fargen som
//      får lyse i nattmodus. Ringen er hvit.
//
// Regelen (hvor bølgene står, hvor sterke de er) er REN og bor her, ikke i
// GLSL-en: en shader kan ikke enhetstestes, og en tidsavhengig effekt er nettopp
// den slags som ser «omtrent riktig» ut mens den er feil. Shaderen får ferdige
// tall og tegner to sirkler.

import {
  Group, Mesh, PlaneGeometry, ShaderMaterial, Color, DoubleSide,
} from 'three'
import { horisontTilWorld } from './astronomi.js'

/** Hele animasjonen, i sekunder — etter dette er meshet skjult igjen. */
export const RIPPLE_VARIGHET_S = 1.15
/** Én bølges levetid. Den andre slippes `BOLGE_FORSINKELSE_S` etter den første. */
const BOLGE_S = 0.78
const BOLGE_FORSINKELSE_S = 0.37

/**
 * Bølgenes radius i CSS-PIKSLER, som trykk-ringen (v6.3.2) og av samme grunn:
 * det er piksler brukeren ser, og en effekt målt i grader blir sub-piksel på et
 * lite legeme. Starten ligger INNENFOR ringens 46 px og slutten godt utenfor.
 */
export const RIPPLE_START_PX = 12
export const RIPPLE_SLUTT_PX = 104
const RIPPLE_STREK_PX = 2.6

/** Samme røde som himmelkompassets markør — nattsyn, ikke smak. */
const RIPPLE_FARGE = '#ff4d3d'

/** MÅ følge PerspectiveCamera i sceneCore, som resten av piksel-regnestykkene. */
const FOV_GRADER = 55

/**
 * Skal et valg kvitteres med en ripple?
 *
 * Ja for det som er ET PUNKT på himmelen og ikke har noen annen kvittering:
 * løse stjerner (bestillingen), og Merkur og Venus, som verken får trykk-ring
 * eller globe og derfor har nøyaktig samme problem.
 *
 * Nei for en FORMASJON: middelretningen ligger i TOM HIMMEL for en figur som
 * spenner 40° (v6.3.11 — det var hele grunnen til at trykk-plukkingen sluttet å
 * måle dit), så en ring der ville pekt på ingenting. Figuren kvitterer dessuten
 * selv ved at hele den lyser opp.
 *
 * Nei for et legeme MED globe: kula som vokser fram er kvitteringen, og en
 * rød bølge oppå den permanente ringen ville bare vært to effekter som slåss.
 */
export function skalRippe(o) {
  if (!o || o.type === 'formasjon' || o.harGlobe) return false
  return Number.isFinite(o.azimut) && Number.isFinite(o.hoyde)
}

/**
 * Hvor bølgene står ved tida `tGaatt` (sekunder siden trykket).
 *
 * @returns {Array<{vei:number, opasitet:number}>|null} null når animasjonen er
 *   ferdig eller ikke har begynt. `vei` er 0–1 fra RIPPLE_START_PX til
 *   RIPPLE_SLUTT_PX.
 */
export function rippleFase(tGaatt) {
  if (!Number.isFinite(tGaatt) || tGaatt < 0 || tGaatt >= RIPPLE_VARIGHET_S) return null
  return [0, BOLGE_FORSINKELSE_S].map((start) => {
    const f = (tGaatt - start) / BOLGE_S
    if (f < 0 || f >= 1) return { vei: 0, opasitet: 0 }
    // Ut-easing: bølgen skyter fra legemet og roer seg — en dråpe i vann, ikke
    // en jevn radar-sveip. Det er nettopp den forskjellen som skiller den fra
    // trykk-ringen, som går lineært.
    return { vei: 1 - (1 - f) ** 3, opasitet: (1 - f) ** 1.5 }
  })
}

/**
 * Meshet. Ett plan som vender mot kameraet, plassert i legemets virkelige
 * himmelretning — så bølgen blir liggende PÅ stjerna gjennom kameraflyturen
 * `velgHimmel` setter i gang. Et DOM-overlegg på trykkpunktet ville drevet av
 * gårde i det kameraet begynte å bevege seg, altså akkurat mens man ser på det.
 */
export function buildValgRipple({ radius = 25000, avstand = null } = {}) {
  const r = avstand ?? radius * 0.82
  const geometry = new PlaneGeometry(1, 1)
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uFarge: { value: new Color(RIPPLE_FARGE) },
      // Bølgenes radius i planets enheter, og hver sin opasitet.
      uR: { value: [0, 0] },
      uA: { value: [0, 0] },
      uStrek: { value: 0.02 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uFarge;
      uniform float uR[2];
      uniform float uA[2];
      uniform float uStrek;
      varying vec2 vUv;

      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        float rq = length(q);
        if (rq > 1.0) discard;
        float a = 0.0;
        for (int i = 0; i < 2; i++) {
          if (uA[i] <= 0.0) continue;
          a += (1.0 - smoothstep(uStrek * 0.4, uStrek, abs(rq - uR[i]))) * uA[i];
        }
        if (a < 0.004) discard;
        gl_FragColor = vec4(uFarge, min(a, 0.92));
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.visible = false

  const group = new Group()
  group.add(mesh)

  let skjermHoydePx = 900
  let startTid = null
  // Bølgeradiene er i piksler, planet i verdensenheter — omregningen avhenger av
  // skjermhøyden, som endrer seg når telefonen snus.
  let indreAndel = 0
  let ytreAndel = 1

  function oppdaterSkala() {
    const perPx = (2 * r * Math.tan((FOV_GRADER * Math.PI / 180) / 2)) / skjermHoydePx
    // 1,12 gir strekken plass innenfor planet: lå ytterste bølge helt i kanten,
    // ville `if (rq > 1.0) discard` klippet halve den.
    const planBredde = RIPPLE_SLUTT_PX * perPx * 1.12
    mesh.scale.setScalar(planBredde)
    indreAndel = (RIPPLE_START_PX * perPx) / planBredde
    ytreAndel = (RIPPLE_SLUTT_PX * perPx) / planBredde
    material.uniforms.uStrek.value = (RIPPLE_STREK_PX * perPx * 2) / planBredde
  }
  oppdaterSkala()

  return {
    group,
    mesh,
    geometries: [geometry],
    materials: [material],

    /** Slipp bølgene fra ett punkt på himmelen. Et nytt trykk starter på nytt. */
    start({ azimut, hoyde } = {}) {
      if (!Number.isFinite(azimut) || !Number.isFinite(hoyde)) return false
      const [x, y, z] = horisontTilWorld(azimut, hoyde, r)
      mesh.position.set(x, y, z)
      startTid = null
      mesh.visible = true
      return true
    },

    /**
     * Vend planet mot kameraet og flytt bølgene. `tidS` er sekunder, monotont
     * voksende — samme klokke som resten av natthimmelen får.
     *
     * NULLPUNKTET SETTES HER og ikke i `start`: motoren har én klokke, og en
     * `performance.now()` hentet på trykktidspunktet ville vært en annen.
     */
    update(camera, tidS = null) {
      if (!mesh.visible) return
      if (camera) mesh.quaternion.copy(camera.quaternion)
      if (!Number.isFinite(tidS)) return
      if (startTid === null) startTid = tidS
      const faser = rippleFase(tidS - startTid)
      if (!faser) {
        mesh.visible = false
        startTid = null
        return
      }
      for (let i = 0; i < 2; i++) {
        material.uniforms.uR.value[i] = indreAndel
          + (ytreAndel - indreAndel) * faser[i].vei
        material.uniforms.uA.value[i] = faser[i].opasitet
      }
    },

    /** Skjermhøyden i CSS-piksler, matet av setResolution som trykk-ringen. */
    settSkjermHoyde(px) {
      if (!Number.isFinite(px) || px < 1) return
      skjermHoydePx = px
      oppdaterSkala()
    },

    /** Stopp uten å vente ut animasjonen — natta slås av, valget nullstilles. */
    stopp() {
      mesh.visible = false
      startTid = null
    },

    /** For test: står bølgene og går? */
    get aktiv() { return mesh.visible },

    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
