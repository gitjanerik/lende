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
  controls.maxPolarAngle = (85 * Math.PI) / 180
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

  // Første interaksjon slår av rotasjonen. `controls.autoRotate` settes også
  // av OrbitControls' egen 'start', men vi vil fange hjul og berøring før
  // dempingen rekker å flytte noe.
  const stopAuto = () => {
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
      quiet = true
      controls.update()
      quiet = false
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
