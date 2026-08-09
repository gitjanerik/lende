// Kamerariggen for 3D-utforskeren: fri orbit rundt kartet, med en åpningspose
// som viser hele utsnittet nordover fra god høyde, og en meget langsom
// rotasjon som gir liv i bildet til brukeren tar over.
//
// Rotasjonen stopper ved FØRSTE berøring og kommer ikke tilbake av seg selv —
// et kamera som begynner å snurre igjen mens man studerer en fjellside er
// irriterende, ikke elegant. «Oversikt»-knappen er veien tilbake, og den
// starter rotasjonen på nytt fordi brukeren da eksplisitt ba om oversikten.
//
// Terrengklaringen og overgangstiden deles med turvisningens rigger
// (cameraRigs.js), så de to modusene oppfører seg likt der de kan.

import { Vector3, Quaternion, Matrix4 } from 'three'
import { terrainYAt, clearSightLine, easeInOutCubic, TRANSITION_S } from './cameraRigs.js'

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

export async function createExploreRig({ camera, dem, coords, domElement }) {
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = (85 * Math.PI) / 180
  controls.minDistance = 50
  // Rikelig takhøyde for fugleperspektiv — hele kartet skal kunne rammes inn
  // med god margin uansett hvor avlangt utsnittet er.
  controls.maxDistance = 3 * Math.max(coords.widthM, coords.heightM)
  controls.autoRotate = true
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED

  let transition = null
  let userTook = false
  const listeners = []

  const on = (target, event, fn, opts) => {
    target.addEventListener(event, fn, opts)
    listeners.push([target, event, fn, opts])
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
    controls.update()
  }

  // Første pose settes uten animasjon — det er den brukeren møter.
  applyPose(overviewPose())

  return {
    controls,
    get autoRotating() { return controls.autoRotate },
    get userTookOver() { return userTook },

    /** Tilbake til fugleperspektivet, mykt, og rotasjonen starter igjen. */
    resetToOverview() {
      applyPose(overviewPose(), { animate: true })
      controls.autoRotate = true
    },

    stopAutoRotate: stopAuto,

    /**
     * Fly til et punkt i verden og ramm det inn. `radius` er objektets
     * omtrentlige utstrekning; avstanden regnes av kameraets FOV slik at små
     * ting kommer nær og store rammes inn på avstand.
     */
    flyTo(x, y, z, { radius = 60 } = {}) {
      stopAuto()
      const target = new Vector3(x, y, z)
      const r = Math.max(30, radius)
      const dist = r / Math.tan(((camera.fov * Math.PI) / 180 / 2) * 0.8)
      // Behold kameraets nåværende asimut, så flyturen leses som en
      // innzooming og ikke som en desorienterende omplassering.
      const dir = new Vector3().subVectors(camera.position, controls.target)
      dir.y = 0
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
      dir.normalize()
      const pos = new Vector3(
        x + dir.x * dist,
        y + dist * 0.55,
        z + dir.z * dist,
      )
      const minY = terrainYAt(dem, coords, pos.x, pos.z, 0) + 25 * coords.exaggeration
      if (pos.y < minY) pos.y = minY
      clearSightLine(dem, coords, pos, target)
      applyPose({ pos, target }, { animate: true })
    },

    /** Kameraets posisjon i kartets SVG-meter — brukes til «bort fra kamera». */
    cameraSvgXY() {
      const { x, y } = coords.toSvg(camera.position.x, camera.position.z)
      return [x, y]
    },

    update(dt) {
      if (transition) {
        transition.t += dt / TRANSITION_S
        const k = transition.t >= 1 ? 1 : easeInOutCubic(transition.t)
        camera.position.lerpVectors(transition.fromPos, transition.toPos, k)
        const targetQuat = quatLookingAt(camera.position, transition.toTarget)
        camera.quaternion.slerpQuaternions(transition.fromQuat, targetQuat, k)
        if (transition.t >= 1) {
          controls.target.copy(transition.toTarget)
          transition = null
          controls.update()
        }
        return
      }
      controls.update()
    },

    dispose() {
      for (const [target, event, fn, opts] of listeners) target.removeEventListener(event, fn, opts)
      listeners.length = 0
      controls.dispose()
    },
  }
}
