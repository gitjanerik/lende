// Kamerarigger: Follow (dempet chase-kamera), Free (OrbitControls) og
// FlyBy (forhåndsberegnet dronespline). Demping er frame-rate-uavhengig
// eksponentiell (`1 − exp(−dt·λ)`) — stabil ved enhver dt, ingen
// fjær-oscillasjon å tune.
//
// Under HOLD (feature-direktøren) får aktiv rigg et «frame target» som
// rammer inn featurens boundingsfære; Free-modus overstyres aldri.

import { Vector3, Quaternion, Matrix4 } from 'three'
import { sampleElevation } from '../demSampling.js'

const TRANSITION_S = 1.2

function damp(current, target, lambda, dt) {
  const t = 1 - Math.exp(-lambda * dt)
  current.lerp(target, t)
}

function terrainYAt(dem, coords, wx, wz, fallback = 0) {
  if (!dem) return fallback
  const { x, y } = coords.toSvg(wx, wz)
  const e = sampleElevation(dem, x, y)
  return Number.isFinite(e) ? coords.elevToWorldY(e) : fallback
}

export function createCameraRigs({ camera, dem, coords, routeLookup, flybyLookup, domElement }) {
  const camPos = new Vector3()
  const lookPos = new Vector3()
  let mode = null
  let controls = null
  let frameTarget = null
  let transition = null

  const follow = { distanceM: 60, heightM: 35, lookAheadM: 40 }

  const v = {
    routeAt: new Vector3(), ahead: new Vector3(), tangent: new Vector3(),
    desired: new Vector3(), tmp: new Vector3(),
  }

  function desiredFollowPose(alongM, outPos, outLook) {
    const p = routeLookup.at(alongM)
    const t = routeLookup.tangentAt(alongM)
    v.routeAt.set(p[0], p[1], p[2])
    // XZ-tangent, normalisert — kamera bak og over punktet.
    const len = Math.hypot(t[0], t[2]) || 1
    outPos.set(
      p[0] - (t[0] / len) * follow.distanceM,
      p[1] + follow.heightM,
      p[2] - (t[2] / len) * follow.distanceM,
    )
    const a = routeLookup.at(Math.min(routeLookup.totalM, alongM + follow.lookAheadM))
    outLook.set(a[0], a[1], a[2])
  }

  // Start-oversikt for Utforsk-modus: nesten fugleperspektiv bak startpunktet
  // med ruta og terrenget liggende foran — gir umiddelbar oversikt over hele
  // turen før brukeren spiller av eller bytter modus.
  function overviewPose() {
    const n = 8
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i <= n; i++) {
      const p = routeLookup.at((routeLookup.totalM * i) / n)
      if (p[0] < minX) minX = p[0]
      if (p[0] > maxX) maxX = p[0]
      if (p[1] < minY) minY = p[1]
      if (p[1] > maxY) maxY = p[1]
      if (p[2] < minZ) minZ = p[2]
      if (p[2] > maxZ) maxZ = p[2]
    }
    const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
    const span = Math.max(maxX - minX, maxZ - minZ, 800)
    const s = routeLookup.at(0)
    const start = new Vector3(s[0], s[1], s[2])
    // Retning fra start mot rutas tyngdepunkt i XZ; degenererer ruta (svært
    // kompakt rundtur) brukes starttangenten.
    let dirX = center.x - start.x
    let dirZ = center.z - start.z
    let len = Math.hypot(dirX, dirZ)
    if (len < 1) {
      const t = routeLookup.tangentAt(0)
      dirX = t[0]; dirZ = t[2]
      len = Math.hypot(dirX, dirZ) || 1
    }
    dirX /= len; dirZ /= len
    const dist = Math.min(6000, Math.max(600, span * 0.75))
    const pos = new Vector3(
      start.x - dirX * dist * 0.55,
      Math.max(start.y, center.y) + dist * 0.85,
      start.z - dirZ * dist * 0.55,
    )
    const minCamY = terrainYAt(dem, coords, pos.x, pos.z) + 60 * coords.exaggeration
    if (pos.y < minCamY) pos.y = minCamY
    return { pos, target: center }
  }

  function desiredFlybyPose(alongM, outPos, outLook) {
    // Kamera-splinen parametriseres så kamera-alongM følger playback med
    // et lite forsprang.
    const p = flybyLookup.at(Math.min(flybyLookup.totalM, alongM + 25))
    outPos.set(p[0], p[1], p[2])
    const a = routeLookup.at(Math.min(routeLookup.totalM, alongM + 60))
    outLook.set(a[0], a[1], a[2])
  }

  function applyFrameTarget(outPos, outLook, alongM) {
    // Ramm inn featuren: kamera på buen mellom markør og feature, avstand
    // fra boundingsfæren og kameraets FOV.
    const f = frameTarget
    const r = Math.max(30, f.radius)
    const dist = r / Math.tan(((camera.fov * Math.PI) / 180 / 2) * 0.8)
    const m = routeLookup.at(alongM)
    const dirX = m[0] - f.x
    const dirZ = m[2] - f.z
    const len = Math.hypot(dirX, dirZ) || 1
    outPos.set(f.x + (dirX / len) * dist, f.y + dist * 0.55, f.z + (dirZ / len) * dist)
    outLook.set(f.x, f.y, f.z)
  }

  function ensureControls() {
    if (controls) return controls
    return null
  }

  return {
    get mode() { return mode },
    follow,
    setFollowParams(p) { Object.assign(follow, p) },
    setFrameTarget(t) { frameTarget = t },
    clearFrameTarget() { frameTarget = null },

    async setMode(next, alongM = 0) {
      if (next === mode) return
      const prevMode = mode
      mode = next
      if (controls) controls.enabled = next === 'free'
      if (next === 'free') {
        if (!controls) {
          const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
          controls = new OrbitControls(camera, domElement)
          controls.enableDamping = true
          controls.maxPolarAngle = (85 * Math.PI) / 180
          controls.minDistance = 50
          controls.maxDistance = 1.5 * Math.max(coords.widthM, coords.heightM)
        }
        controls.enabled = true
        if (prevMode === null) {
          // Åpningspose: fugleperspektiv-oversikt over hele ruta.
          const { pos, target } = overviewPose()
          camera.position.copy(pos)
          controls.target.copy(target)
        } else {
          const p = routeLookup.at(alongM)
          controls.target.set(p[0], p[1], p[2])
        }
        controls.update()
        return
      }
      // Glatt overgang inn i ny rigg fra nåværende pose.
      if (prevMode !== null) {
        transition = {
          t: 0,
          fromPos: camera.position.clone(),
          fromQuat: camera.quaternion.clone(),
        }
      } else {
        // Første pose: hopp rett dit.
        const pos = new Vector3()
        const look = new Vector3()
        if (next === 'flyby') desiredFlybyPose(alongM, pos, look)
        else desiredFollowPose(alongM, pos, look)
        camera.position.copy(pos)
        camera.lookAt(look)
        camPos.copy(pos)
        lookPos.copy(look)
      }
    },

    update(dt, alongM) {
      if (mode === 'free') {
        controls?.update()
        return
      }
      const desiredPos = v.desired
      const desiredLook = v.tmp
      if (frameTarget) applyFrameTarget(desiredPos, desiredLook, alongM)
      else if (mode === 'flyby') desiredFlybyPose(alongM, desiredPos, desiredLook)
      else desiredFollowPose(alongM, desiredPos, desiredLook)

      // Terrengklaring for kameraposisjonen.
      const minY = terrainYAt(dem, coords, desiredPos.x, desiredPos.z) + 12 * coords.exaggeration
      if (desiredPos.y < minY) desiredPos.y = minY

      damp(camPos, desiredPos, 3, dt)
      damp(lookPos, desiredLook, 5, dt)

      if (transition) {
        transition.t += dt / TRANSITION_S
        const k = transition.t >= 1 ? 1 : easeInOutCubic(transition.t)
        camera.position.lerpVectors(transition.fromPos, camPos, k)
        const targetQuat = quatLookingAt(camera.position, lookPos)
        camera.quaternion.slerpQuaternions(transition.fromQuat, targetQuat, k)
        if (transition.t >= 1) transition = null
        return
      }
      camera.position.copy(camPos)
      camera.lookAt(lookPos)
    },

    syncFromCamera(alongM) {
      // Etter Free-modus: fortsett dempingen fra der brukeren forlot kameraet.
      camPos.copy(camera.position)
      const p = routeLookup.at(alongM)
      lookPos.set(p[0], p[1], p[2])
    },

    dispose() {
      controls?.dispose()
      controls = null
    },
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const _q = new Quaternion()
const _m4 = new Matrix4()
const _up = new Vector3(0, 1, 0)
function quatLookingAt(pos, look) {
  _m4.lookAt(pos, look, _up)
  return _q.setFromRotationMatrix(_m4).clone()
}
