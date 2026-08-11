import { describe, it, expect } from 'vitest'
import { deriveFollowView, FOLLOW_DEFAULTS, INHERIT_DIST_RANGE } from './cameraRigs.js'

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
