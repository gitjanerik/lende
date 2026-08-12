// Følge-riggen: det dempede «vogn-kameraet» som ruller langs en tur, pluss den
// delte kamera-matematikken (terrengklaring, siktlinje, innramming) som den frie
// riggen (freeRig.js) også bruker.
//
// Demping er frame-rate-uavhengig eksponentiell (`1 − exp(−dt·λ)`) — stabil ved
// enhver dt, ingen fjær-oscillasjon å tune.
//
// Riggen er et «vogn-kamera»: den følger ruta automatisk, men brukeren kan styre
// blikket underveis — én-finger-drag orbiterer rundt turpunktet, pinch justerer
// nær/fjern. Blikk-offsetet ({yaw, pitch, dist}) er også veien TILBAKE til ruta:
// når kameraet har vært løsnet (fri utforsking, flytur til en severdighet) og
// festes igjen, regnes offsetet ut av kameraets faktiske pose med
// `deriveFollowView`. Da arver turen perspektivet brukeren nettopp sto i, i
// stedet for å rykke tilbake til standardvinkelen.
//
// Under HOLD (feature-direktøren) får riggen et «frame target» som rammer inn
// featurens boundingsfære.

import { Vector3, Quaternion, Matrix4 } from 'three'
import { sampleElevation } from '../demSampling.js'

// Delt med den frie riggen (freeRig.js) så de to riggene får identisk
// overgangstid, demping og terrengklaring.
export const TRANSITION_S = 1.2

export function damp(current, target, lambda, dt) {
  const t = 1 - Math.exp(-lambda * dt)
  current.lerp(target, t)
}

export function terrainYAt(dem, coords, wx, wz, fallback = 0) {
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
export function clearSightLine(dem, coords, pos, look) {
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

/**
 * Kamerapose som rammer inn et punkt: avstanden regnes av kameraets FOV, så små
 * ting kommer nær og store rammes inn på avstand. `dirXZ` er retningen kameraet
 * skal stå i fra punktet (normaliseres her); uten den brukes +Z.
 *
 * Delt av severdighets-innrammingen i følge-riggen og «fly hit» i den frie
 * riggen — én kilde til sannhet for «ramm inn dette».
 */
export function framePose({ camera, dem, coords, target, radiusM = 60, dirXZ = null, minClearM = 25 }) {
  const r = Math.max(30, radiusM)
  const dist = r / Math.tan(((camera.fov * Math.PI) / 180 / 2) * 0.8)
  let dx = dirXZ?.[0] ?? 0
  let dz = dirXZ?.[1] ?? 1
  const len = Math.hypot(dx, dz)
  if (len < 1e-6) { dx = 0; dz = 1 } else { dx /= len; dz /= len }
  const pos = new Vector3(
    target.x + dx * dist,
    target.y + dist * 0.55,
    target.z + dz * dist,
  )
  const minY = terrainYAt(dem, coords, pos.x, pos.z, 0) + minClearM * coords.exaggeration
  if (pos.y < minY) pos.y = minY
  clearSightLine(dem, coords, pos, target)
  return { pos, target }
}

// Rausere default-avstand/-høyde (v3.0.15 var 110/70, v4.8.5 var 220/140,
// v4.8.5→v5.17 var 420/260): nær fugleperspektiv. Raske vinkelskift i skarpe
// svinger ga «bilsyke» på nært hold; høyere/fjernere kamera senker vinkelfarten.
// Poenget er å se UTOVER landskapet med posisjonen og (av og til) mål-nåla i
// bildet, ikke å ligge tett på den røde streken. Lengre lookAhead følger av at
// vi ser lenger. v5.18.0 løftet det et hakk til — 35° over horisonten i stedet
// for 32°, og 40 % lengre ut — fordi turen nå er noe man UTFORSKER mens den
// spiller, og da må man se hvor man er i landskapet, ikke bare hvor stien går.
export const FOLLOW_DEFAULTS = { distanceM: 560, heightM: 400, lookAheadM: 180 }

// Grensene for brukerens blikk-offset. Delt med deriveFollowView så et arvet
// perspektiv aldri kan sette riggen i en pose den selv ikke kunne nådd.
const PITCH_MIN = -0.6
const PITCH_MAX = 0.7
const DIST_MIN = 0.4
const DIST_MAX = 4

// Strammere spenn når perspektivet ARVES. Pinch-gulvet på 0,4 (≈200 m) er noe
// brukeren velger med to fingre og ser resultatet av; en flytur til en
// severdighet rammer den inn på 150 m, og å fortsette turen derfra ville satt
// kameraet i nakken på markøren med en nål på tvers av bildet. Retningen arves
// fullt ut — det er avstanden som må være en turavstand.
export const INHERIT_DIST_RANGE = [0.7, 3]

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const wrapPi = (a) => {
  let d = a % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d <= -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Inversen av følge-posen: hvilket {yaw, pitch, dist}-offset står kameraet i,
 * sett fra turpunktet? Brukes når kameraet festes til ruta igjen etter fri
 * utforsking — perspektivet brukeren valgte skal bli turens perspektiv.
 *
 * Ren funksjon (ingen three-avhengighet på inn-siden) så den kan testes direkte.
 *
 * @param {{camPos: {x:number,y:number,z:number},
 *          routePos: [number,number,number],
 *          tangent: [number,number,number],
 *          follow?: {distanceM:number, heightM:number},
 *          reliefBoost?: number,
 *          distRange?: [number, number]}} arg
 * @returns {{yaw:number, pitch:number, dist:number}}
 */
export function deriveFollowView({
  camPos, routePos, tangent, follow = FOLLOW_DEFAULTS, reliefBoost = 1,
  distRange = [DIST_MIN, DIST_MAX],
}) {
  const dx = camPos.x - routePos[0]
  const dy = camPos.y - routePos[1]
  const dz = camPos.z - routePos[2]
  const r = Math.hypot(dx, dy, dz)
  if (!(r > 1e-6)) return { yaw: 0, pitch: 0, dist: 1 }

  const heading = Math.atan2(tangent[2], tangent[0])
  const yaw = wrapPi(Math.atan2(dz, dx) - (heading + Math.PI))

  const basePitch = Math.atan2(follow.heightM, follow.distanceM)
  const pitch = clamp(Math.asin(clamp(dy / r, -1, 1)) - basePitch, PITCH_MIN, PITCH_MAX)

  const baseR = Math.hypot(follow.distanceM, follow.heightM) * (reliefBoost || 1)
  const dist = clamp(baseR > 0 ? r / baseR : 1, distRange[0], distRange[1])

  return { yaw, pitch, dist }
}

/**
 * @param {{camera: object, dem: object, coords: object,
 *          routeLookup: object, domElement: HTMLElement}} arg
 */
export function createFollowRig({ camera, dem, coords, routeLookup: initialRouteLookup, domElement }) {
  // Muterbar fordi 3D-scenen bytter ut turen under føttene på riggen når
  // brukeren velger en annen gren i et kryss. Å bygge riggen på nytt ville
  // nullstilt brukerens blikkvinkel midt i turen.
  let routeLookup = initialRouteLookup
  const camPos = new Vector3()
  const lookPos = new Vector3()
  let frameTarget = null
  let transition = null
  let started = false
  let inputEnabled = false

  const follow = { ...FOLLOW_DEFAULTS }

  // Relieff-tilpasning: går ruta mye opp og ned, trengs mer luft for å få
  // både terrenget og posisjonen i bildet. Vi måler høydespennet i et vindu
  // rundt nåværende posisjon (rutas egne world-Y, altså inkludert vertikal
  // overdrivelse) og skalerer avstand/høyde med det. Verdien dempes i update()
  // så den ikke rykker når ruta bretter seg.
  const RELIEF_WINDOW_M = 700
  const RELIEF_SAMPLES = 9
  const RELIEF_MAX_BOOST = 0.8      // ≤ 1.8× ved svært kupert terreng
  const RELIEF_FULL_SPAN_M = 220    // høydespenn (world-Y) som gir full boost
  let reliefBoost = 1

  function reliefSpanAt(alongM) {
    const half = RELIEF_WINDOW_M / 2
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i < RELIEF_SAMPLES; i++) {
      const d = alongM - half + (RELIEF_WINDOW_M * i) / (RELIEF_SAMPLES - 1)
      const p = routeLookup.at(Math.max(0, Math.min(routeLookup.totalM, d)))
      if (p[1] < lo) lo = p[1]
      if (p[1] > hi) hi = p[1]
    }
    return Number.isFinite(hi - lo) ? hi - lo : 0
  }

  // Brukerens blikk-offset: yaw/pitch i radianer, dist som faktor (pinch).
  const view = { yaw: 0, pitch: 0, dist: 1 }

  const pointers = new Map()
  let dragging = false
  let dragX = 0
  let dragY = 0
  let pinchStart = null

  // HOLD (v5.18.0): ligger fingeren stille et lite øyeblikk, slipper kameraet
  // turen og blir stående der det er — så lenge fingeren er nede kan man se
  // rundt seg, opp og ned, mens turen ruller videre uten en. Ved slipp glir
  // kameraet mykt tilbake i følge-posen, helt av seg selv: dempingen i update()
  // starter fra der holdet forlot camPos/lookPos.
  //
  // Hvorfor et hold og ikke en knapp: dette er noe man gjør ETT sekund om
  // gangen, midt i en bevegelse. En modus man må slå av igjen ville kostet mer
  // enn den gir.
  const HOLD_MS = 320
  // Under drag-slop-en i tapDispatcher (12 px) — går fingeren lenger enn dette
  // er det et vogn-drag, og holdet skal ikke slå inn.
  const HOLD_SLOP_PX = 10
  const HOLD_PITCH_LIMIT = 1.25
  let holdTimer = 0
  let downPt = null
  // { yaw, pitch, dist } — kikkeretningen fra det frosne punktet.
  let holdLook = null
  let holdPos = null
  // Ble gesten et hold, var det ikke et trykk: 3D-scenen spør om dette før den
  // lar et trykk velge en nål (tapDispatcher godtar opptil 600 ms).
  let holdConsumed = false
  let holdCb = null

  const cancelHoldTimer = () => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0 }
  }

  function enterHold() {
    holdTimer = 0
    if (!started || holdLook) return
    holdPos = camPos.clone()
    const dx = lookPos.x - camPos.x
    const dy = lookPos.y - camPos.y
    const dz = lookPos.z - camPos.z
    const len = Math.hypot(dx, dy, dz) || 1
    holdLook = {
      yaw: Math.atan2(dz, dx),
      pitch: Math.asin(clamp(dy / len, -1, 1)),
      dist: len,
    }
    holdConsumed = true
    holdCb?.(true)
  }

  function exitHold() {
    cancelHoldTimer()
    downPt = null
    if (!holdLook) return
    holdLook = null
    holdPos = null
    holdCb?.(false)
  }

  const pinchDist = () => {
    const pts = [...pointers.values()]
    return Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1
  }

  function onPointerDown(e) {
    if (!inputEnabled) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])
    domElement.setPointerCapture?.(e.pointerId)
    if (pointers.size === 1) {
      dragging = true
      dragX = e.clientX
      dragY = e.clientY
      holdConsumed = false
      downPt = { x: e.clientX, y: e.clientY }
      cancelHoldTimer()
      holdTimer = setTimeout(enterHold, HOLD_MS)
    } else if (pointers.size === 2) {
      dragging = false
      exitHold()
      pinchStart = { d0: pinchDist(), dist0: view.dist }
    }
  }
  function onPointerMove(e) {
    if (!inputEnabled || !pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, [e.clientX, e.clientY])
    if (pinchStart && pointers.size === 2) {
      view.dist = clamp(pinchStart.dist0 * (pinchStart.d0 / pinchDist()), DIST_MIN, DIST_MAX)
      return
    }
    if (holdLook) {
      // Fri kikking fra et fast punkt. Innholdet følger fingeren (som et
      // panorama): drar man mot høyre, svinger blikket mot venstre.
      holdLook.yaw -= (e.clientX - dragX) * 0.004
      holdLook.pitch = clamp(
        holdLook.pitch + (e.clientY - dragY) * 0.003, -HOLD_PITCH_LIMIT, HOLD_PITCH_LIMIT,
      )
      dragX = e.clientX
      dragY = e.clientY
      return
    }
    // Fingeren flyttet seg før holdet slo inn → dette er et vogn-drag.
    if (downPt && Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > HOLD_SLOP_PX) {
      cancelHoldTimer()
      downPt = null
    }
    if (dragging) {
      view.yaw -= (e.clientX - dragX) * 0.006
      view.pitch = clamp(view.pitch + (e.clientY - dragY) * 0.004, PITCH_MIN, PITCH_MAX)
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
      exitHold()
    }
  }
  domElement.addEventListener('pointerdown', onPointerDown)
  domElement.addEventListener('pointermove', onPointerMove)
  domElement.addEventListener('pointerup', onPointerUp)
  domElement.addEventListener('pointercancel', onPointerUp)

  const v = { routeAt: new Vector3(), desired: new Vector3(), tmp: new Vector3() }

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
    const r = Math.hypot(follow.distanceM, follow.heightM) * view.dist * reliefBoost
    outPos.set(
      p[0] + Math.cos(az) * Math.cos(pitch) * r,
      p[1] + Math.sin(pitch) * r,
      p[2] + Math.sin(az) * Math.cos(pitch) * r,
    )
    const a = routeLookup.at(Math.min(routeLookup.totalM, alongM + follow.lookAheadM))
    outLook.set(a[0], a[1], a[2])
  }

  function applyFrameTarget(outPos, outLook, alongM) {
    // Ramm inn featuren fra siden turen kommer fra, så bildet leses som «der
    // er den, litt foran oss».
    const f = frameTarget
    const m = routeLookup.at(alongM)
    const { pos, target } = framePose({
      camera, dem, coords,
      target: new Vector3(f.x, f.y, f.z),
      radiusM: f.radius,
      dirXZ: [m[0] - f.x, m[2] - f.z],
    })
    outPos.copy(pos)
    outLook.copy(target)
  }

  return {
    follow,
    get view() { return { ...view } },
    setFollowParams(p) { Object.assign(follow, p) },
    // Bytt hvilken tur riggen følger, uten å røre brukerens blikkvinkel.
    setRouteLookup(next) { routeLookup = next },
    setFrameTarget(t) { frameTarget = t },
    clearFrameTarget() { frameTarget = null },
    // Vogn-dragets fingerstyring er bare på når riggen ER kameraet OG turen
    // spiller. Står turen stille, er det den frie riggen som skal ta fingeren.
    setInputEnabled(v2) {
      inputEnabled = !!v2
      if (!inputEnabled) {
        pointers.clear()
        dragging = false
        pinchStart = null
        exitHold()
        // Flagget lever fra et hold til NESTE pointerdown, og et pointerdown med
        // input-en av returnerer før det nullstilles. Uten dette ville et hold
        // rett før man pauser svelget det første trykket etterpå — nåla man
        // trykket på gjorde ingenting.
        holdConsumed = false
      }
    },
    /** Står brukeren og ser rundt seg fra et frosset punkt akkurat nå? */
    get holding() { return !!holdLook },
    /** Ble den siste gesten et hold? Da var den ikke et trykk. */
    get holdConsumed() { return holdConsumed },
    /** @param {(holding: boolean) => void} cb holdet startet/sluttet */
    onHold(cb) { holdCb = cb },

    /**
     * Ta over kameraet ved `alongM`.
     *
     * `inherit`: arv perspektivet fra kameraets nåværende pose — brukt når
     *   kameraet festes tilbake til turen etter fri utforsking eller en flytur
     *   til en severdighet. Uten den brukes standardvinkelen.
     * `animate`: glid inn i posen fra der kameraet står (default når arvet).
     *   Av = hopp rett dit; det er åpningsbildet når 3D starter med en tur.
     */
    enter(alongM = 0, { inherit = false, animate = inherit } = {}) {
      exitHold()
      const p = routeLookup.at(alongM)
      if (inherit) {
        Object.assign(view, deriveFollowView({
          camPos: camera.position,
          routePos: p,
          tangent: routeLookup.tangentAt(alongM),
          follow,
          reliefBoost,
          distRange: INHERIT_DIST_RANGE,
        }))
      } else {
        view.yaw = 0; view.pitch = 0; view.dist = 1
      }
      if (animate) {
        // Dempingen tar kameraet fra der det står til ønsket pose; transisjonen
        // lerper bildet dit samtidig, så overgangen er én myk bevegelse.
        camPos.copy(camera.position)
        lookPos.set(p[0], p[1], p[2])
        transition = {
          t: 0,
          fromPos: camera.position.clone(),
          fromQuat: camera.quaternion.clone(),
        }
      } else {
        const pos = new Vector3()
        const look = new Vector3()
        desiredFollowPose(alongM, pos, look)
        camera.position.copy(pos)
        camera.lookAt(look)
        camPos.copy(pos)
        lookPos.copy(look)
        transition = null
      }
      started = true
    },

    update(dt, alongM) {
      if (!started) return
      // HOLD: kameraet står stille der brukeren tok det, og fingeren styrer
      // blikket. Ingen demping, ingen terrengklaring — vi flytter ingenting, og
      // punktet var klart i det vi frøs det. camPos/lookPos beholder verdiene
      // holdet forlot, så dempingen under glir tilbake i følge-posen ved slipp.
      if (holdLook && holdPos) {
        const { yaw, pitch, dist } = holdLook
        camPos.copy(holdPos)
        lookPos.set(
          holdPos.x + Math.cos(pitch) * Math.cos(yaw) * dist,
          holdPos.y + Math.sin(pitch) * dist,
          holdPos.z + Math.cos(pitch) * Math.sin(yaw) * dist,
        )
        transition = null
        camera.position.copy(camPos)
        camera.lookAt(lookPos)
        return
      }
      // Relieff-boost dempes mykt (λ = 0.8) — kupert terreng skal skyve
      // kameraet gradvis bakover, ikke rykke i det.
      const wantBoost = 1 + RELIEF_MAX_BOOST
        * Math.min(1, reliefSpanAt(alongM) / RELIEF_FULL_SPAN_M)
      reliefBoost += (wantBoost - reliefBoost) * (1 - Math.exp(-0.8 * dt))

      const desiredPos = v.desired
      const desiredLook = v.tmp
      if (frameTarget) applyFrameTarget(desiredPos, desiredLook, alongM)
      else desiredFollowPose(alongM, desiredPos, desiredLook)

      // Terrengklaring for kameraposisjonen + fri siktlinje til blikkpunktet.
      const minY = terrainYAt(dem, coords, desiredPos.x, desiredPos.z) + 12 * coords.exaggeration
      if (desiredPos.y < minY) desiredPos.y = minY
      clearSightLine(dem, coords, desiredPos, desiredLook)

      // Mykere demping (v4.8.5, var 3/5). Med kameraet langt bak trengs ikke
      // tett sporing: ved 256× rykket det i bildet for hver sving fordi
      // blikkpunktet nådde fram nesten momentant. Lavere λ lar kameraet gli —
      // det henger litt etter, men på denne avstanden leses etterslepet som ro.
      damp(camPos, desiredPos, 1.5, dt)
      damp(lookPos, desiredLook, 2.5, dt)

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

    dispose() {
      cancelHoldTimer()
      holdCb = null
      domElement.removeEventListener('pointerdown', onPointerDown)
      domElement.removeEventListener('pointermove', onPointerMove)
      domElement.removeEventListener('pointerup', onPointerUp)
      domElement.removeEventListener('pointercancel', onPointerUp)
    },
  }
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const _q = new Quaternion()
const _m4 = new Matrix4()
const _up = new Vector3(0, 1, 0)
function quatLookingAt(pos, look) {
  _m4.lookAt(pos, look, _up)
  return _q.setFromRotationMatrix(_m4).clone()
}
