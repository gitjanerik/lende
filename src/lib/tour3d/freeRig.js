// Den FRIE kamerariggen: orbit rundt kartet, med en åpningspose som viser hele
// utsnittet nordover fra god høyde, og en meget langsom rotasjon som gir liv i
// bildet til brukeren tar over.
//
// Rotasjonen stopper ved FØRSTE berøring og kommer ikke tilbake av seg selv —
// et kamera som begynner å snurre igjen mens man studerer en fjellside er
// irriterende, ikke elegant. «Oversikt»-knappen er veien tilbake, og den
// starter rotasjonen på nytt fordi brukeren da eksplisitt ba om oversikten.
//
// Riggen er også kameraets LØSNEDE tilstand under en tur: står turen stille,
// armeres den (`arm`) med turpunktet som blikkpunkt, og første gest gjør at
// brukeren tar over (`onTakeOver`). Terrengklaringen, innrammingen og
// overgangstiden deles med følge-riggen (cameraRigs.js).

import { Vector3, Quaternion, Matrix4, MOUSE } from 'three'
import { terrainYAt, clearSightLine, easeInOutCubic, framePose, TRANSITION_S } from './cameraRigs.js'

// ≈ 5 minutter per omdreining ved 60 fps. OrbitControls' egen default (2.0)
// er 30 sekunder — det leses som en skjermsparer, ikke som et kart som lever.
const AUTO_ROTATE_SPEED = 0.2

// Hvor lavt orbiten selv slipper kameraet: 89° fra senit er et praktisk
// vannrett blikk med horisonten midt i bildet. Videre opp er ikke OrbitControls'
// jobb — den ser alltid PÅ blikkpunktet, og et blikkpunkt over kameraet finnes
// ikke i en orbit. Derfor himmelvippen under.
const POLAR_MAKS = (89 * Math.PI) / 180
// Så nær taket at vi regner orbiten som klampet. Dempingen (enableDamping) gjør
// at den nærmer seg asymptotisk, så en eksakt sammenlikning ville aldri slått til.
const TAK_SLARK = 0.02
// Hvor langt opp man kan vippe: 75°, altså nesten rett opp i senit. Resten av
// veien ville gitt et bilde uten et eneste holdepunkt.
export const HIMMEL_VIPP_MAKS = (75 * Math.PI) / 180
// Hvor lang en «se mot»-sving tar. Kort nok til at det ikke føles som venting,
// langt nok til at man beholder retningssansen — flytter blikket seg momentant,
// mister man hvor på himmelen man var.
const BLIKK_TID_S = 0.9

/**
 * Hvilken orbit-asimut og himmelvipp som får blikket til å peke mot et punkt på
 * himmelen. Ren funksjon, fordi det er her fortegnene kan gå galt.
 *
 * Orbiten ser alltid PÅ blikkpunktet, så kameraet må stå på MOTSATT side av
 * retningen man vil se. Og orbiten kan ikke løfte blikket over horisonten i det
 * hele tatt (se POLAR_MAKS), så all høyde over den går inn i vippen.
 *
 * Scenen har nord = −Z og øst = +X. three sin spherical måler theta som
 * atan2(x, z) på OFFSET-vektoren kamera − blikkpunkt.
 *
 * @param {number} azimut radianer fra nord mot øst
 * @param {number} hoyde radianer over horisonten
 * @returns {{theta: number, vipp: number}}
 */
/**
 * Kamera-forskyvning fra blikkpunktet for gitt radius og orbit-vinkler.
 *
 * Ren, og eksportert for TEST: konvensjonen er three sin egen
 * (`Spherical.setFromVector3`), og et ombyttet fortegn her ville sendt kameraet
 * til motsatt side av himmelen uten at noe kastet. `orbitPosisjon` mot three sin
 * Spherical er derfor egen test.
 *
 * @param {number} radius
 * @param {number} theta asimut, radianer
 * @param {number} phi polarvinkel fra +Y, radianer
 * @returns {[number, number, number]}
 */
export function orbitPosisjon(radius, theta, phi) {
  return [
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta),
  ]
}

export function blikkMot(azimut, hoyde) {
  // Ønsket blikkretning: (sin A, sin h, −cos A). Offset er den motsatte.
  const theta = Math.atan2(-Math.sin(azimut), Math.cos(azimut))
  // Orbiten står på taket sitt; resten er vippens. Taket gir et blikk
  // (90° − POLAR_MAKS) UNDER horisonten, så det må legges til.
  const fraTaket = Math.PI / 2 - POLAR_MAKS
  const vipp = Math.max(0, Math.min(HIMMEL_VIPP_MAKS, hoyde + fraTaket))
  return { theta, vipp }
}

/**
 * Ett steg av himmelvippen, som ren funksjon — det er her regelen bor.
 *
 * Gesten er en FORTSETTELSE av orbiten, ikke en ny modus: står orbiten på taket
 * og fingeren dras videre i samme retning, går utslaget inn i vippen. Dras den
 * tilbake, spises vippen opp FØR orbiten får bevege seg igjen. Én finger som
 * fortsetter forbi horisonten vipper altså blikket opp i himmelen, og samme
 * finger tilbake lander deg i kartet.
 *
 * `utslag` er i VIPPENS retning og ikke i skjermens: positivt = mot himmelen.
 * Oversettelsen fra fingerens dy bor på kallstedet, som er der OrbitControls'
 * eget fortegn hører hjemme.
 *
 * @param {number} vipp     nåværende vipp i radianer (0 = ser mot horisonten)
 * @param {number} utslag   piksler i vippens retning; positivt = mot himmelen
 * @param {boolean} paaTaket om orbiten står i POLAR_MAKS
 * @param {number} radPrPiksel  samme følsomhet som orbitens egen rotasjon
 * @returns {number} ny vipp
 */
export function himmelVippSteg(vipp, utslag, paaTaket, radPrPiksel) {
  if (!Number.isFinite(utslag) || utslag === 0) return vipp
  // Mot himmelen: bare når orbiten ikke har mer å gi. Uten den betingelsen ville
  // hvert drag både vippet himmelen og tiltet kartet, og de to bevegelsene hadde
  // lagt seg oppå hverandre.
  if (utslag > 0) {
    if (!paaTaket) return vipp
    return Math.min(HIMMEL_VIPP_MAKS, vipp + utslag * radPrPiksel)
  }
  // Tilbake ned: bare så langt vippen rekker. Resten er orbitens.
  if (vipp <= 0) return 0
  return Math.max(0, vipp + utslag * radPrPiksel)
}

const _q = new Quaternion()
const _m4 = new Matrix4()
const _up = new Vector3(0, 1, 0)
function quatLookingAt(pos, look) {
  _m4.lookAt(pos, look, _up)
  return _q.setFromRotationMatrix(_m4).clone()
}

/**
 * @param {{camera:object, dem:object, coords:object, domElement:HTMLElement,
 *          autoRotate?: boolean, enabled?: boolean}} arg
 *   autoRotate  false når 3D åpnes med en tur: kameraet står i følge-riggen,
 *               og en snurrende oversikt ville bare vært et blaff før turen.
 */
export async function createFreeRig({ camera, dem, coords, domElement, autoRotate = true, enabled = true }) {
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = POLAR_MAKS
  controls.minDistance = 50
  // Rikelig takhøyde for fugleperspektiv — hele kartet skal kunne rammes inn
  // med god margin uansett hvor avlangt utsnittet er.
  controls.maxDistance = 3 * Math.max(coords.widthM, coords.heightM)
  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED
  controls.enabled = enabled
  // Desktop: venstre-drag PANORERER kartet — det er det man forventer av et
  // kart, og OrbitControls' default (venstre = rotér, panorering gjemt på
  // høyre musetast) gjorde at kameraposisjonen ikke lot seg flytte i praksis.
  // Høyre-drag roterer, hjulet zoomer. Touch-oppsettet røres ikke (mobil
  // fungerer som før: én finger roterer, to fingre panorerer/zoomer).
  controls.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }
  // Panorér langs bakkeplanet, ikke skjermplanet — kartet skal gli under
  // kameraet, ikke drive opp i himmelen.
  controls.screenSpacePanning = false

  let transition = null
  let userTook = false
  let takeOverCb = null
  let takeOverCancelCb = null
  // Egne, programmatiske kall til controls.update() sender også 'change'.
  // Flagget skiller dem fra brukerens egne bevegelser.
  let quiet = false
  // Pågående gest: OrbitControls melder 'start' på pointerdown, 'change' først
  // når update() faktisk flytter kameraet. Et TRYKK gir start+end uten change —
  // da var det ikke et kamera-drag, og turen skal ikke bli løsnet av det.
  let gesture = null
  // Himmelvippen: hvor mange radianer blikket er løftet OVER orbitens eget tak.
  // 0 = kameraet ser dit OrbitControls peker det. Se himmelVippSteg for regelen.
  let himmelVipp = 0
  // Pågående «se mot»-animasjon: { fraTheta, tilTheta, fraVipp, tilVipp, t }.
  // Egen mekanisme og ikke `transition`, som animerer POSISJON og kvaternion mot
  // en pose — den ville kjempet mot vippen om den fikk styre begge.
  let blikkAnim = null
  // Orbitens polarvinkel er FROSSET mens vippen er i bruk, ellers ville et drag
  // både vippet himmelen og tiltet kartet. Asimuten er fortsatt fri — man skal
  // kunne se rundt seg på himmelen.
  let polarLast = false
  const listeners = []

  const on = (target, event, fn, opts) => {
    target.addEventListener(event, fn, opts)
    listeners.push([target, event, fn, opts])
  }

  const quietUpdate = () => {
    quiet = true
    controls.update()
    quiet = false
  }

  /**
   * Sett orbitens polar- og/eller asimutvinkel.
   *
   * HVORFOR EN EGEN FUNKSJON: OrbitControls i three 0.185 har `getPolarAngle`
   * og `getAzimuthalAngle`, men INGEN settere — de finnes bare i noen forks, og
   * `controls.setPolarAngle(...)` kaster «is not a function». Det gikk gjennom
   * hele enhetstest-suiten og bygget, og ble fanget av røyktesten i CI: 3D
   * krever WebGL, så ingen test som ikke kjører en nettleser ser det.
   *
   * Vi setter i stedet vinklene slik kontrollen selv LESER dem — ved å plassere
   * kameraet i sfæriske koordinater rundt blikkpunktet. Konvensjonen er three
   * sin egen (Spherical.setFromVector3): x = r·sinφ·sinθ, y = r·cosφ,
   * z = r·sinφ·cosθ. `controls.update()` leser posisjonen tilbake inn i sin
   * egen tilstand, så ingen private felt røres.
   *
   * @param {{theta?: number, phi?: number, oppdater?: boolean}} arg
   *   oppdater=false når kalleren kjører controls.update() rett etterpå selv —
   *   dempingen skal ikke tikke to ganger i samme frame.
   */
  const settOrbitVinkler = ({ theta, phi, oppdater = true } = {}) => {
    const r = camera.position.distanceTo(controls.target) || 1
    const t = Number.isFinite(theta) ? theta : controls.getAzimuthalAngle()
    const f = Number.isFinite(phi) ? phi : controls.getPolarAngle()
    const [dx, dy, dz] = orbitPosisjon(r, t, f)
    camera.position.set(
      controls.target.x + dx, controls.target.y + dy, controls.target.z + dz,
    )
    if (oppdater) quietUpdate()
  }

  // Første interaksjon slår av rotasjonen. `controls.autoRotate` settes også
  // av OrbitControls' egen 'start', men vi vil fange hjul og berøring før
  // dempingen rekker å flytte noe.
  const stopAuto = () => {
    // En pågående «se mot» skal gi seg straks brukeren rører kameraet selv;
    // ellers drar animasjonen blikket ut av fingeren.
    blikkAnim = null
    if (!controls.autoRotate) return
    controls.autoRotate = false
    userTook = true
  }
  on(domElement, 'pointerdown', stopAuto)
  on(domElement, 'wheel', stopAuto, { passive: true })
  // Brukeren tar over kameraet. Meldingen går på 'start' (pointerdown) fordi
  // OrbitControls samler dragets utslag der og først bruker det i update() —
  // ventet vi på bevegelse, ville scenen ikke rukket å gi riggen kameraet, og
  // første drag blitt borte. Var gesten et rent trykk, meldes det som avbrutt
  // like etter, og scenen fester kameraet tilbake til turen.
  on(controls, 'start', () => {
    gesture = { moved: false }
    userTook = true
    takeOverCb?.()
  })
  on(controls, 'change', () => {
    if (!quiet && gesture) gesture.moved = true
  })
  on(controls, 'end', () => {
    const g = gesture
    gesture = null
    if (g && !g.moved) takeOverCancelCb?.()
  })

  // ── Himmelvippen ────────────────────────────────────────────────────────────
  // OrbitControls eksponerer ikke dragets utslag, så vi sporer det selv. Vi kan
  // ikke hindre den fra å konsumere samme pointermove — derfor FRYSER vi
  // polarvinkelen (min = maks) så lenge vippen er i bruk, framfor å forsøke å
  // trekke bevegelsen fra i etterkant.
  const nedePekere = new Set()
  let dragY = null

  function settPolarLast(paa) {
    if (paa === polarLast) return
    polarLast = paa
    controls.minPolarAngle = paa ? POLAR_MAKS : 0
  }

  // Er dette en ROTASJONS-gest? På berøring er én finger rotasjon og to er
  // panorering/zoom (OrbitControls' eget oppsett). På mus er venstre PANORERING
  // i denne appen — se mouseButtons over — så bare høyre knapp roterer.
  const erRotasjon = (e) => (e.pointerType === 'touch'
    ? nedePekere.size === 1
    : (e.buttons & 2) !== 0)

  on(domElement, 'pointerdown', (e) => {
    nedePekere.add(e.pointerId)
    dragY = e.clientY
  })
  const slippPeker = (e) => {
    nedePekere.delete(e.pointerId)
    if (!nedePekere.size) dragY = null
  }
  on(domElement, 'pointerup', slippPeker)
  on(domElement, 'pointercancel', slippPeker)

  on(domElement, 'pointermove', (e) => {
    if (dragY === null || !controls.enabled || transition) { dragY = e.clientY; return }
    const dy = e.clientY - dragY
    dragY = e.clientY
    if (!erRotasjon(e)) return
    // Samme følsomhet som orbitens egen polarrotasjon: 2π over elementets høyde
    // (OrbitControls' rotateUp). Da fortsetter bevegelsen i akkurat samme tempo
    // over horisonten som under den, og overgangen kjennes ikke.
    const h = domElement.clientHeight || 1
    const radPrPiksel = (2 * Math.PI * controls.rotateSpeed) / h
    const paaTaket = controls.getPolarAngle() >= POLAR_MAKS - TAK_SLARK
    // FORTEGNET, og det var feil i første utgave — røyktesten fanget det.
    // OrbitControls gjør `phi -= 2π·dy/h` (rotateUp), så et drag OPPOVER
    // (dy < 0) ØKER polarvinkelen og senker blikket mot horisonten, mens et
    // drag nedover løfter kameraet til fugleperspektiv. Retningen som
    // fortsetter forbi horisonten er altså OPPOVER, og vippens utslag er −dy.
    const ny = himmelVippSteg(himmelVipp, -dy, paaTaket, radPrPiksel)
    if (ny === himmelVipp) return
    himmelVipp = ny
    settPolarLast(himmelVipp > 0)
  })

  /** Tilbake til et blikk langs orbitens egen retning. */
  function nullstillVipp() {
    himmelVipp = 0
    blikkAnim = null
    settPolarLast(false)
  }

  /**
   * Åpningsposen: blikkpunkt midt i kartet, kamera sør for sentrum og høyt
   * nok til at hele utsnittet får plass i bildet. Nord er −Z i world-rommet,
   * så «utsyn nordover» = kameraet står på +Z-siden og ser mot −Z.
   */
  function overviewPose() {
    const centerY = terrainYAt(dem, coords, 0, 0, 0)
    const target = new Vector3(0, centerY, 0)

    // Avstanden som trengs for å ramme inn den største utstrekningen, regnet
    // fra kameraets faktiske FOV — samme resonnement som innrammingen av en
    // severdighet i turvisningen.
    const span = Math.max(coords.widthM, coords.heightM)
    const vFov = (camera.fov * Math.PI) / 180
    const dist = (span / 2) / Math.tan(vFov / 2) * 1.15

    // ~35° over horisonten: høyt nok til å lese terrengformene som et kart,
    // lavt nok til at fjellene fortsatt har profil.
    const pitch = (35 * Math.PI) / 180
    const pos = new Vector3(
      0,
      target.y + Math.sin(pitch) * dist,
      Math.cos(pitch) * dist,
    )
    const minY = terrainYAt(dem, coords, pos.x, pos.z, 0) + 120 * coords.exaggeration
    if (pos.y < minY) pos.y = minY
    clearSightLine(dem, coords, pos, target)
    return { pos, target }
  }

  function applyPose({ pos, target }, { animate = false } = {}) {
    // Enhver programmatisk pose er et blikk NED i kartet, så himmelvippen skal
    // ikke overleve den. «Oversikt» skal alltid gi oversikt.
    nullstillVipp()
    if (animate) {
      transition = {
        t: 0,
        fromPos: camera.position.clone(),
        fromQuat: camera.quaternion.clone(),
        toPos: pos.clone(),
        toTarget: target.clone(),
      }
      return
    }
    camera.position.copy(pos)
    controls.target.copy(target)
    quietUpdate()
  }

  // Åpningsposen settes bare når den frie riggen ER kameraet fra start; åpnes
  // 3D med en tur, eier følge-riggen posen og vi skal ikke røre den.
  if (enabled) applyPose(overviewPose())

  return {
    controls,
    /** Hvor mange radianer blikket er løftet over horisonten. 0 = ser i kartet. */
    get himmelVipp() { return himmelVipp },
    nullstillVipp,

    /**
     * Rett blikket mot et punkt på himmelen, mykt. Brukt av alle tre veiene inn:
     * valg i lista, trykk i himmelen, og månen. ÉN metode, tre kallere — så
     * himmelvippen aldri får en andre, konkurrerende eier.
     *
     * @param {number} azimut radianer fra nord mot øst
     * @param {number} hoyde radianer over horisonten
     */
    seMot(azimut, hoyde) {
      if (!Number.isFinite(azimut) || !Number.isFinite(hoyde)) return
      controls.enabled = true
      controls.autoRotate = false
      userTook = true
      transition = null
      const { theta, vipp } = blikkMot(azimut, hoyde)
      // Polarvinkelen låses UMIDDELBART til taket: vippen er det som bærer
      // høyden, og en orbit som fortsatt kan bevege seg i polar ville dratt
      // blikket ned mens animasjonen løfter det.
      settOrbitVinkler({ phi: POLAR_MAKS })
      settPolarLast(true)
      // Korteste vei rundt: uten dette snurrer kameraet 350° for å komme 10°.
      const fra = controls.getAzimuthalAngle()
      let dTheta = theta - fra
      while (dTheta > Math.PI) dTheta -= 2 * Math.PI
      while (dTheta < -Math.PI) dTheta += 2 * Math.PI
      blikkAnim = {
        t: 0,
        fraTheta: fra,
        dTheta,
        fraVipp: himmelVipp,
        tilVipp: vipp,
      }
    },
    get autoRotating() { return controls.autoRotate },
    get userTookOver() { return userTook },
    /** @param {() => void} cb brukeren tok kameraet (gest startet) */
    onTakeOver(cb) { takeOverCb = cb },
    /** @param {() => void} cb gesten var bare et trykk — ingen kamerabevegelse */
    onTakeOverCancelled(cb) { takeOverCancelCb = cb },
    get enabled() { return controls.enabled },

    /**
     * Ta over kameraet der det står, uten å endre bildet: blikkpunktet settes
     * til det kameraet FAKTISK ser på, `distM` unna. Det gjør overtakelsen
     * usynlig — OrbitControls' første update() ville ellers vridd kameraet mot
     * et blikkpunkt det ikke pekte på (følge-riggen ser et stykke foran
     * turpunktet, ikke rett på det).
     */
    armFromCamera(distM = 400) {
      controls.enabled = true
      controls.autoRotate = false
      // Blikkpunktet settes til det kameraet FAKTISK ser på, altså med vippen
      // innbakt — da skal vippen nulles, ellers legges den på en gang for mye.
      nullstillVipp()
      const dir = new Vector3()
      camera.getWorldDirection(dir)
      controls.target.copy(camera.position).addScaledVector(dir, Math.max(50, distM))
    },

    setEnabled(v) {
      controls.enabled = !!v
      if (!v) {
        controls.autoRotate = false
        transition = null
      }
    },

    /** Tilbake til fugleperspektivet, mykt, og rotasjonen starter igjen. */
    resetToOverview() {
      controls.enabled = true
      applyPose(overviewPose(), { animate: true })
      controls.autoRotate = true
    },

    stopAutoRotate: stopAuto,

    /**
     * Fly til et punkt i verden og ramm det inn. `radiusM` er objektets
     * omtrentlige utstrekning; avstanden regnes av kameraets FOV slik at små
     * ting kommer nær og store rammes inn på avstand.
     *
     * `headingXY` (enhetsvektor i SVG-meter) legger kameraet BAK punktet i
     * forhold til retningen, så blikket peker videre framover — brukt når
     * GPS-posisjonen er i bevegelse og man vil se dit man sannsynligvis skal.
     */
    flyTo(x, y, z, { radiusM = 60, headingXY = null } = {}) {
      controls.enabled = true
      stopAuto()
      const target = new Vector3(x, y, z)
      // Uten heading: behold kameraets nåværende asimut, så flyturen leses
      // som en innzooming og ikke som en desorienterende omplassering.
      // SVG-y vokser sørover = world-Z, så vektoren mapper direkte.
      const dirXZ = headingXY
        ? [-headingXY[0], -headingXY[1]]
        : [camera.position.x - target.x, camera.position.z - target.z]
      applyPose(framePose({ camera, dem, coords, target, radiusM, dirXZ }), { animate: true })
    },

    /** Kameraets posisjon i kartets SVG-meter — brukes til «bort fra kamera». */
    cameraSvgXY() {
      const { x, y } = coords.toSvg(camera.position.x, camera.position.z)
      return [x, y]
    },

    update(dt) {
      // Panorering skal ikke kunne miste kartet: blikkpunktet klampes til
      // utsnittet med litt margin, så man alltid kan finne tilbake.
      const mx = (coords.widthM / 2) * 1.15
      const mz = (coords.heightM / 2) * 1.15
      if (controls.target.x < -mx) controls.target.x = -mx
      if (controls.target.x > mx) controls.target.x = mx
      if (controls.target.z < -mz) controls.target.z = -mz
      if (controls.target.z > mz) controls.target.z = mz
      if (transition) {
        transition.t += dt / TRANSITION_S
        const k = transition.t >= 1 ? 1 : easeInOutCubic(transition.t)
        camera.position.lerpVectors(transition.fromPos, transition.toPos, k)
        const targetQuat = quatLookingAt(camera.position, transition.toTarget)
        camera.quaternion.slerpQuaternions(transition.fromQuat, targetQuat, k)
        if (transition.t >= 1) {
          controls.target.copy(transition.toTarget)
          transition = null
          quietUpdate()
        }
        return
      }
      if (blikkAnim) {
        blikkAnim.t += dt / BLIKK_TID_S
        const k = blikkAnim.t >= 1 ? 1 : easeInOutCubic(blikkAnim.t)
        // Asimuten settes på orbiten; vippen legges på etterpå, som ellers.
        settOrbitVinkler({
          theta: blikkAnim.fraTheta + blikkAnim.dTheta * k,
          // controls.update() kjører noen linjer under; dempingen skal ikke
          // tikke to ganger i samme frame.
          oppdater: false,
        })
        himmelVipp = blikkAnim.fraVipp + (blikkAnim.tilVipp - blikkAnim.fraVipp) * k
        if (blikkAnim.t >= 1) {
          blikkAnim = null
          settPolarLast(himmelVipp > 0)
        }
      }
      quiet = true
      controls.update()
      quiet = false
      // Himmelvippen legges PÅ orbitens orientering, hver frame, fordi
      // controls.update() setter kvaternionen på nytt hver gang. Bare
      // orienteringen røres — posisjon, blikkpunkt og avstand er fortsatt
      // orbitens, så panorering og zoom virker som før mens man ser opp.
      if (himmelVipp > 0) camera.rotateX(himmelVipp)
    },

    dispose() {
      for (const [target, event, fn, opts] of listeners) target.removeEventListener(event, fn, opts)
      listeners.length = 0
      takeOverCb = null
      takeOverCancelCb = null
      controls.dispose()
    },
  }
}
