// Live GPS-posisjon i 3D — delt av turvisningen og utforskeren.
//
// Markøren er en knappenål med samme form som POI-nålene (hvit stamme +
// kulehode), men hodet er sky-blått som 2D-kartets posisjonsprikk, og ved
// foten går konsentriske rippel-ringer utover — 3D-svaret på 2D-prikkens
// pulserende nøyaktighetsring. Ytterste rippel-radius er GPS-nøyaktigheten i
// ekte meter (klampet, så dårlig fix i tett skog ikke drukner terrenget).
// Nåla får samme avstandsoverdrivelse som de andre, så man finner seg selv
// også fra full oversikt.
//
// Posisjoner kommer inn i kartets SVG-meter (~1 Hz fra useUserPosition);
// utenfor kartutsnittet skjules markøren i stedet for å klistres til kanten.

import {
  SphereGeometry, CylinderGeometry, RingGeometry, MeshBasicMaterial, Mesh,
  Group, DoubleSide,
} from 'three'
import { sampleElevation } from '../demSampling.js'
import { pinScaleForCamera, PIN_STEM_H, PIN_STEM_R, PIN_HEAD_R } from './pinField.js'

const DOT_COLOR = 0x0ea5e9    // 2D-prikkens fyllfarge
const RING_COLOR = 0x38bdf8   // 2D-ringens sky-400
const RING_LIFT = 1.5
const MIN_RING_M = 15
const MAX_RING_M = 120
const RIPPLES = 3
const RIPPLE_PERIOD_S = 2.6

export function buildGpsMarker(dem, coords) {
  const group = new Group()
  group.visible = false

  // Nåla: samme mål som POI-nålene (pinField), blått hode.
  const pinHolder = new Group()
  const stemGeo = new CylinderGeometry(PIN_STEM_R, PIN_STEM_R, PIN_STEM_H, 8)
  const stemMat = new MeshBasicMaterial({ color: 0xffffff })
  const stem = new Mesh(stemGeo, stemMat)
  stem.position.y = PIN_STEM_H / 2
  const headGeo = new SphereGeometry(PIN_HEAD_R, 16, 12)
  const headMat = new MeshBasicMaterial({ color: DOT_COLOR })
  const head = new Mesh(headGeo, headMat)
  head.position.y = PIN_STEM_H + PIN_HEAD_R * 0.6
  pinHolder.add(stem)
  pinHolder.add(head)
  group.add(pinHolder)

  // Konsentriske rippler: ringer som ekspanderer fra foten ut til
  // nøyaktighetsradiusen og fader — faseforskjøvet så det alltid er liv.
  const rippleGeo = new RingGeometry(0.9, 1, 48)
  const ripples = []
  for (let i = 0; i < RIPPLES; i++) {
    const mat = new MeshBasicMaterial({
      color: RING_COLOR, transparent: true, opacity: 0,
      side: DoubleSide, depthWrite: false,
    })
    const mesh = new Mesh(rippleGeo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = RING_LIFT
    group.add(mesh)
    ripples.push({ mesh, mat, phase: i / RIPPLES })
  }

  for (const o of [group, pinHolder, stem, head, ...ripples.map(r => r.mesh)]) {
    o.frustumCulled = false
  }

  let ringRadiusM = 30

  return {
    group,
    // Raycast-mål for «fly til meg»: hodet er det naturlige treffpunktet,
    // stammen tas med så nåla er lett å treffe med finger.
    hitMeshes: [head, stem],
    get visible() { return group.visible },
    get position() { return group.position },
    /**
     * @param {{x:number, y:number, accuracyM?:number}|null} pos i SVG-meter;
     *   null eller utenfor kartet skjuler markøren.
     */
    setPosition(pos) {
      const inMap = pos
        && Number.isFinite(pos.x) && Number.isFinite(pos.y)
        && pos.x >= 0 && pos.x <= coords.widthM
        && pos.y >= 0 && pos.y <= coords.heightM
      group.visible = !!inMap
      if (!inMap) return
      const e = sampleElevation(dem, pos.x, pos.y)
      const [wx, wy, wz] = coords.toWorld(pos.x, pos.y, Number.isFinite(e) ? e : 0)
      group.position.set(wx, wy, wz)
      ringRadiusM = Math.min(MAX_RING_M, Math.max(MIN_RING_M, pos.accuracyM ?? 30))
    },
    update(timeS, camera) {
      if (!group.visible) return
      for (const r of ripples) {
        const t = ((timeS / RIPPLE_PERIOD_S) + r.phase) % 1
        const s = Math.max(0.001, ringRadiusM * t)
        r.mesh.scale.set(s, s, 1)
        r.mat.opacity = 0.5 * (1 - t)
      }
      const pinS = pinScaleForCamera(
        camera.position, group.position.x, group.position.y, group.position.z,
      )
      // Av framfor skala 0 — se waypointMarkers.update for hvorfor.
      pinHolder.visible = pinS > 0
      if (pinS > 0) pinHolder.scale.setScalar(pinS)
    },
    dispose() {
      stemGeo.dispose()
      headGeo.dispose()
      rippleGeo.dispose()
      stemMat.dispose()
      headMat.dispose()
      for (const r of ripples) r.mat.dispose()
    },
  }
}
