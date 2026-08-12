import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerspectiveCamera } from 'three'
import {
  createFollowRig, deriveFollowView, FOLLOW_DEFAULTS, INHERIT_DIST_RANGE,
} from './cameraRigs.js'

// Kamera-posen følge-riggen ville satt for et gitt blikk-offset. Speiler
// desiredFollowPose (som er intern), så testene kan gå rundturen
// view → pose → view og kreve at man havner tilbake der man startet.
function poseFor({ view, routePos, tangent, follow = FOLLOW_DEFAULTS, reliefBoost = 1 }) {
  const heading = Math.atan2(tangent[2], tangent[0])
  const az = heading + Math.PI + view.yaw
  const basePitch = Math.atan2(follow.heightM, follow.distanceM)
  const pitch = basePitch + view.pitch
  const r = Math.hypot(follow.distanceM, follow.heightM) * view.dist * reliefBoost
  return {
    x: routePos[0] + Math.cos(az) * Math.cos(pitch) * r,
    y: routePos[1] + Math.sin(pitch) * r,
    z: routePos[2] + Math.sin(az) * Math.cos(pitch) * r,
  }
}

const P = [1000, 200, -500]
const T = [1, 0, 0]        // turen går østover

describe('deriveFollowView — perspektivet arves når kameraet festes til turen', () => {
  it('runder tur-retur: pose fra et blikk gir samme blikk tilbake', () => {
    const view = { yaw: 0.9, pitch: 0.25, dist: 1.6 }
    const camPos = poseFor({ view, routePos: P, tangent: T })
    const ut = deriveFollowView({ camPos, routePos: P, tangent: T })
    expect(ut.yaw).toBeCloseTo(view.yaw, 6)
    expect(ut.pitch).toBeCloseTo(view.pitch, 6)
    expect(ut.dist).toBeCloseTo(view.dist, 6)
  })

  it('standardposen gir nøytralt offset', () => {
    const view = { yaw: 0, pitch: 0, dist: 1 }
    const camPos = poseFor({ view, routePos: P, tangent: T })
    const ut = deriveFollowView({ camPos, routePos: P, tangent: T })
    expect(ut.yaw).toBeCloseTo(0, 6)
    expect(ut.pitch).toBeCloseTo(0, 6)
    expect(ut.dist).toBeCloseTo(1, 6)
  })

  it('yaw er uavhengig av hvilken vei turen går', () => {
    const view = { yaw: -1.2, pitch: 0, dist: 1 }
    for (const tangent of [[1, 0, 0], [0, 0, 1], [-0.7, 0, 0.7]]) {
      const camPos = poseFor({ view, routePos: P, tangent })
      expect(deriveFollowView({ camPos, routePos: P, tangent }).yaw).toBeCloseTo(view.yaw, 6)
    }
  })

  it('yaw wrappes til (−π, π] — 200° til høyre er 160° til venstre', () => {
    const view = { yaw: (200 * Math.PI) / 180, pitch: 0, dist: 1 }
    const camPos = poseFor({ view, routePos: P, tangent: T })
    const ut = deriveFollowView({ camPos, routePos: P, tangent: T })
    expect(ut.yaw).toBeCloseTo((-160 * Math.PI) / 180, 6)
  })

  it('relieff-boost regnes bort: samme pose gir mindre dist når riggen alt står langt bak', () => {
    const view = { yaw: 0, pitch: 0, dist: 2 }
    const camPos = poseFor({ view, routePos: P, tangent: T, reliefBoost: 1.5 })
    const ut = deriveFollowView({ camPos, routePos: P, tangent: T, reliefBoost: 1.5 })
    expect(ut.dist).toBeCloseTo(2, 6)
  })

  it('klamper et perspektiv riggen ikke kan gjengi — 8 km unna og rett ovenfra', () => {
    const ut = deriveFollowView({
      camPos: { x: P[0], y: P[1] + 8000, z: P[2] + 100 },
      routePos: P,
      tangent: T,
    })
    expect(ut.dist).toBe(4)                 // taket
    expect(ut.pitch).toBeCloseTo(0.7, 6)    // taket
  })

  it('kamera nær bakkenivå bak turen klampes til nedre pitch', () => {
    const ut = deriveFollowView({
      camPos: { x: P[0] - 300, y: P[1] - 200, z: P[2] },
      routePos: P,
      tangent: T,
    })
    expect(ut.pitch).toBeCloseTo(-0.6, 6)
  })

  it('arvet avstand holdes i turavstand — en innramming på 150 m tar ikke over turen', () => {
    // Kameraet står tett på (som etter en flytur til en severdighet): retningen
    // arves, men avstanden løftes til nedre turavstand.
    const view = { yaw: 0.4, pitch: 0, dist: 0.3 }
    const camPos = poseFor({ view, routePos: P, tangent: T })
    const ut = deriveFollowView({ camPos, routePos: P, tangent: T, distRange: INHERIT_DIST_RANGE })
    expect(ut.yaw).toBeCloseTo(0.4, 6)
    expect(ut.dist).toBe(INHERIT_DIST_RANGE[0])
    // Pinch-spennet er videre — der er 0,3 lovlig nær.
    expect(deriveFollowView({ camPos, routePos: P, tangent: T }).dist).toBeCloseTo(0.4, 6)
  })

  it('kamera oppå turpunktet gir nøytralt offset i stedet for NaN', () => {
    const ut = deriveFollowView({ camPos: { x: P[0], y: P[1], z: P[2] }, routePos: P, tangent: T })
    expect(ut).toEqual({ yaw: 0, pitch: 0, dist: 1 })
  })
})

// ── HOLD: fingeren ligger stille, kameraet blir stående ──────────────────────
// Ligger fingeren i ro et lite øyeblikk mens turen spiller, slipper kameraet
// ruta og blir stående der det er — man kan se rundt seg, opp og ned, mens turen
// ruller videre. Ved slipp glir det mykt tilbake i følge-posen.

function fakeElement() {
  const lyttere = new Map()
  return {
    addEventListener(type, fn) {
      if (!lyttere.has(type)) lyttere.set(type, [])
      lyttere.get(type).push(fn)
    },
    removeEventListener(type, fn) {
      const l = lyttere.get(type)
      if (l) l.splice(l.indexOf(fn), 1)
    },
    setPointerCapture() {},
    fyr(type, e) { for (const fn of [...(lyttere.get(type) ?? [])]) fn(e) },
  }
}

// Rett rute østover i flatt terreng. dem = null slår av terrengklaringen, så
// posene er ren geometri.
const lookup = {
  totalM: 4000,
  at: (m) => [m, 300, 0],
  tangentAt: () => [1, 0, 0],
}
const coordsFlatt = {
  widthM: 4000, heightM: 4000, exaggeration: 1,
  toSvg: (wx, wz) => ({ x: wx, y: wz }),
  elevToWorldY: (e) => e,
  worldYToElev: (y) => y,
}

function rigg() {
  const el = fakeElement()
  const camera = new PerspectiveCamera(55, 1, 1, 60000)
  const rig = createFollowRig({
    camera, dem: null, coords: coordsFlatt, routeLookup: lookup, domElement: el,
  })
  rig.enter(0)
  rig.setInputEnabled(true)
  return { el, camera, rig }
}

const peker = (x, y) => ({ pointerId: 1, clientX: x, clientY: y })

describe('createFollowRig — hold for å se rundt seg', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('et hold fryser kameraet der det står, mens turen ruller videre', () => {
    const { el, camera, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    expect(rig.holding).toBe(false)      // ennå ikke et hold
    vi.advanceTimersByTime(400)
    expect(rig.holding).toBe(true)

    rig.update(0.016, 0)
    const frosset = camera.position.clone()
    // Turen har gått 800 m; uten holdet ville kameraet fulgt etter.
    for (let i = 0; i < 20; i++) rig.update(0.016, 100 + i * 35)
    expect(camera.position.distanceTo(frosset)).toBeCloseTo(0, 6)
  })

  it('fingeren styrer blikket uten å flytte kameraet', () => {
    const { el, camera, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    rig.update(0.016, 0)
    const pos = camera.position.clone()
    const retning = camera.quaternion.clone()

    el.fyr('pointermove', peker(320, 340))
    rig.update(0.016, 0)
    expect(camera.position.distanceTo(pos)).toBeCloseTo(0, 6)
    expect(camera.quaternion.angleTo(retning)).toBeGreaterThan(0.05)
  })

  it('slipp: kameraet glir tilbake mot følge-posen', () => {
    const { el, camera, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    el.fyr('pointermove', peker(360, 400))
    for (let i = 0; i < 5; i++) rig.update(0.016, 0)
    const frosset = camera.position.clone()

    el.fyr('pointerup', peker(360, 400))
    expect(rig.holding).toBe(false)
    // Dempingen (λ = 1,5) er en glidning, ikke et hopp: ett par sekunder senere
    // står kameraet i følge-posen 900 m ute i ruta — bak turpunktet, altså rundt
    // x = 900 − cos(pitch)·r ≈ 340.
    for (let i = 0; i < 200; i++) rig.update(0.016, 900)
    expect(camera.position.distanceTo(frosset)).toBeGreaterThan(200)
    expect(camera.position.x).toBeGreaterThan(300)
    expect(camera.position.x).toBeLessThan(400)
  })

  it('et drag er ikke et hold — går fingeren, orbiterer man i stedet', () => {
    const { el, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    el.fyr('pointermove', peker(260, 400))
    vi.advanceTimersByTime(400)
    expect(rig.holding).toBe(false)
    expect(rig.holdConsumed).toBe(false)
    expect(rig.view.yaw).not.toBe(0)
  })

  it('holdet spiser trykket — 3D-scenen skal ikke også velge en nål', () => {
    const { el, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    el.fyr('pointerup', peker(200, 400))
    expect(rig.holding).toBe(false)
    expect(rig.holdConsumed).toBe(true)
    // Neste gest starter med rent ark.
    el.fyr('pointerdown', peker(200, 400))
    expect(rig.holdConsumed).toBe(false)
  })

  it('holdet meldes ut, så HUD-en kan vise hintet', () => {
    const { el, rig } = rigg()
    const meldinger = []
    rig.onHold((h) => meldinger.push(h))
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    el.fyr('pointerup', peker(200, 400))
    expect(meldinger).toEqual([true, false])
  })

  it('to fingre er pinch, ikke hold — og pinch avbryter et pågående hold', () => {
    const { el, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    expect(rig.holding).toBe(true)
    el.fyr('pointerdown', { pointerId: 2, clientX: 300, clientY: 400 })
    expect(rig.holding).toBe(false)
  })

  it('mister input-en (turen pauser) → holdet slippes, og trykket er ikke spist', () => {
    const { el, rig } = rigg()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    rig.setInputEnabled(false)
    expect(rig.holding).toBe(false)
    // Et pointerdown med input-en av returnerer før flagget nullstilles, så det
    // må ryddes her — ellers svelger et hold rett før pause det første trykket
    // etterpå.
    expect(rig.holdConsumed).toBe(false)
  })

  it('uten input gjør et trykk ingenting', () => {
    const { el, camera, rig } = rigg()
    rig.setInputEnabled(false)
    const pos = camera.position.clone()
    el.fyr('pointerdown', peker(200, 400))
    vi.advanceTimersByTime(400)
    expect(rig.holding).toBe(false)
    rig.update(0.016, 0)
    expect(camera.position.distanceTo(pos)).toBeCloseTo(0, 6)
  })
})
