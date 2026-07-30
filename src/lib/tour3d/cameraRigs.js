// Kamerarigger: Follow (dempet chase-kamera), Free (OrbitControls) og
// FlyBy (forhåndsberegnet dronespline). Demping er frame-rate-uavhengig
// eksponentiell (`1 − exp(−dt·λ)`) — stabil ved enhver dt, ingen
// fjær-oscillasjon å tune.
//
// Follow og FlyBy er «vogn-kameraer»: de følger ruta automatisk, men
// brukeren kan styre blikket underveis — én-finger-drag vrir vinkelen
// (Follow: orbiterer rundt turpunktet; FlyBy: snur hodet fra dronen) og
// pinch justerer nær/fjern. Offsetene nullstilles ved modusbytte.
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

// Siktlinje-klaring: står terreng (bratt fjellside bak målet) mellom kamera
// og blikkpunkt, løftes kameraet så synslinjen går klar — «brått opp» i
// stedet for å havne bak fjellet. Løser posY fra linjelikningen
// y(t) = posY·(1−t) + lookY·t ≥ terrengY(t) + margin for hvert sample;
// marginen tapres mot målet (terrenget DER er rutas eget underlag).
// Dempingen i update() gjør løftet mykt.
function clearSightLine(dem, coords, pos, look) {
  if (!dem) return
  const SAMPLES = 12
  const MAX_T = 0.85
  let required = -Infinity
  for (let i = 1; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * MAX_T
    const x = pos.x + (look.x - pos.x) * t
    const z = pos.z + (look.z - pos.z) * t
    const terrainY = terrainYAt(dem, coords, x, z, NaN)
    if (!Number.isFinite(terrainY)) continue
    const margin = (6 + 18 * (1 - t)) * coords.exaggeration
    const req = (terrainY + margin - look.y * t) / (1 - t)
    if (req > required) required = req
  }
  if (required > pos.y) pos.y = required
}

export function createCameraRigs({ camera, dem, coords, routeLookup, flybyLookup, domElement }) {
  const camPos = new Vector3()
  const lookPos = new Vector3()
  let mode = null
  let controls = null
  let frameTarget = null
  let transition = null

  // Rausere default-avstand/-høyde: ~dobbel avstand fra underlaget (v3.0.15,
  // var 110/70) — nær fugleperspektiv. Raske vinkelskift i skarpe svinger
  // ga «bilsyke» på nært hold; høyere/fjernere kamera senker vinkelfarten.
  const follow = { distanceM: 220, heightM: 140, lookAheadM: 60 }

  // Brukerens blikk-offset i vogn-modusene: yaw/pitch i radianer, dist som
  // faktor (pinch). Nullstilles ved modusbytte.
  const view = { yaw: 0, pitch: 0, dist: 1 }
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

  const pointers = new Map()
  let dragging = false
  let dragX = 0
  let dragY = 0
  let pinchStart = null

  const pinchDist = () => {
    const pts = [...pointers.values()]
    return Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1
  }
  const wagonModeActive = () => mode === 'follow' || mode === 'flyby'

  function onPointerDown(e) {
    if (!wagonModeActive()) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])
    domElement.setPointerCapture?.(e.pointerId)
    if (pointers.size === 1) {
      dragging = true
      dragX = e.clientX
      dragY = e.clientY
    } else if (pointers.size === 2) {
      dragging = false
      pinchStart = { d0: pinchDist(), dist0: view.dist }
    }
  }
  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])
    if (pinchStart && pointers.size === 2) {
      view.dist = clamp(pinchStart.dist0 * (pinchStart.d0 / pinchDist()), 0.4, 4)
    } else if (dragging) {
      view.yaw -= (e.clientX - dragX) * 0.006
      view.pitch = clamp(view.pitch + (e.clientY - dragY) * 0.004, -0.6, 0.7)
      dragX = e.clientX
      dragY = e.clientY
    }
  }
  function onPointerUp(e) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinchStart = null
    if (pointers.size === 1) {
      const [x, y] = [...pointers.values()][0]
      dragX = x; dragY = y
      dragging = true
    } else if (pointers.size === 0) {
      dragging = false
    }
  }
  domElement.addEventListener('pointerdown', onPointerDown)
  domElement.addEventListener('pointermove', onPointerMove)
  domElement.addEventListener('pointerup', onPointerUp)
  domElement.addEventListener('pointercancel', onPointerUp)

  const v = {
    routeAt: new Vector3(), ahead: new Vector3(), tangent: new Vector3(),
    desired: new Vector3(), tmp: new Vector3(),
  }

  function desiredFollowPose(alongM, outPos, outLook) {
    const p = routeLookup.at(alongM)
    const t = routeLookup.tangentAt(alongM)
    v.routeAt.set(p[0], p[1], p[2])
    // Sfærisk rundt turpunktet: bak tangenten som basis, pluss brukerens
    // yaw/pitch/dist-offset — «orbit rundt vogna» mens den ruller.
    const heading = Math.atan2(t[2], t[0])
    const az = heading + Math.PI + view.yaw
    const basePitch = Math.atan2(follow.heightM, follow.distanceM)
    const pitch = clamp(basePitch + view.pitch, 0.06, 1.35)
    const r = Math.hypot(follow.distanceM, follow.heightM) * view.dist
    outPos.set(
      p[0] + Math.cos(az) * Math.cos(pitch) * r,
      p[1] + Math.sin(pitch) * r,
      p[2] + Math.sin(az) * Math.cos(pitch) * r,
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
    clearSightLine(dem, coords, pos, center)
    return { pos, target: center }
  }

  function desiredFlybyPose(alongM, outPos, outLook) {
    // Kamera-splinen parametriseres så kamera-alongM følger playback med
    // et lite forsprang.
    const p = flybyLookup.at(Math.min(flybyLookup.totalM, alongM + 30))
    outPos.set(p[0], p[1], p[2])
    const a = routeLookup.at(Math.min(routeLookup.totalM, alongM + 90))
    // Brukerens hodedreining fra dronen: roter blikkretningen med yaw/pitch.
    let dx = a[0] - p[0]
    let dy = a[1] - p[1]
    let dz = a[2] - p[2]
    const len = Math.hypot(dx, dy, dz) || 1
    const az = Math.atan2(dz, dx) + view.yaw
    const el = clamp(Math.asin(dy / len) - view.pitch, -1.2, 1.2)
    dx = Math.cos(az) * Math.cos(el) * len
    dy = Math.sin(el) * len
    dz = Math.sin(az) * Math.cos(el) * len
    outLook.set(p[0] + dx, p[1] + dy, p[2] + dz)
    // Pinch i FlyBy: trekk dronen opp og bakover for videre utsyn.
    if (view.dist !== 1) {
      const k = (view.dist - 1) * 160
      outPos.y += k
      outPos.x -= (dx / len) * k * 0.6
      outPos.z -= (dz / len) * k * 0.6
    }
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
      view.yaw = 0; view.pitch = 0; view.dist = 1
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

      // Terrengklaring for kameraposisjonen + fri siktlinje til blikkpunktet.
      const minY = terrainYAt(dem, coords, desiredPos.x, desiredPos.z) + 12 * coords.exaggeration
      if (desiredPos.y < minY) desiredPos.y = minY
      clearSightLine(dem, coords, desiredPos, desiredLook)

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
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
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
