// Live GPS-posisjon i 3D — delt av turvisningen og utforskeren.
//
// Samme visuelle språk som 2D-kartets posisjonsprikk: sky-blå kule med hvit
// kant, og en pulserende ring på bakken som viser GPS-nøyaktigheten i ekte
// meter (klampet, så dårlig fix i tunnel ikke drukner terrenget). Kula får
// samme avstandsoverdrivelse som knappenålene, så man finner seg selv også
// fra full oversikt.
//
// Posisjoner kommer inn i kartets SVG-meter (~1 Hz fra useUserPosition);
// utenfor kartutsnittet skjules markøren i stedet for å klistres til kanten.

import {
  SphereGeometry, RingGeometry, CircleGeometry, MeshBasicMaterial, Mesh,
  Group, DoubleSide, BackSide,
} from 'three'
import { sampleElevation } from '../demSampling.js'
import { pinScaleAt } from './pinField.js'

const DOT_COLOR = 0x0ea5e9    // 2D-prikkens fyllfarge
const RING_COLOR = 0x38bdf8   // 2D-ringens sky-400
const DOT_R = 7
const DOT_LIFT = 12
const RING_LIFT = 1.5
const MIN_RING_M = 15
const MAX_RING_M = 120

export function buildGpsMarker(dem, coords) {
  const group = new Group()
  group.visible = false

  // Kula + hvit kant: en litt større hvit kule rendret med baksidene gir en
  // jevn hvit kontur rundt den blå uansett hvilken vinkel man ser fra.
  const dotHolder = new Group()
  const dotGeo = new SphereGeometry(DOT_R, 16, 12)
  const dotMat = new MeshBasicMaterial({ color: DOT_COLOR })
  const dot = new Mesh(dotGeo, dotMat)
  const haloGeo = new SphereGeometry(DOT_R * 1.3, 16, 12)
  const haloMat = new MeshBasicMaterial({ color: 0xffffff, side: BackSide })
  const halo = new Mesh(haloGeo, haloMat)
  dot.position.y = DOT_LIFT
  halo.position.y = DOT_LIFT
  dotHolder.add(halo)
  dotHolder.add(dot)
  group.add(dotHolder)

  // Nøyaktighetsring på bakken (enhetsradius, skaleres til meter) + svakt fyll.
  const ringGeo = new RingGeometry(0.82, 1, 48)
  const ringMat = new MeshBasicMaterial({
    color: RING_COLOR, transparent: true, opacity: 0.45,
    side: DoubleSide, depthWrite: false,
  })
  const ring = new Mesh(ringGeo, ringMat)
  const fillGeo = new CircleGeometry(0.82, 48)
  const fillMat = new MeshBasicMaterial({
    color: RING_COLOR, transparent: true, opacity: 0.1,
    side: DoubleSide, depthWrite: false,
  })
  const fill = new Mesh(fillGeo, fillMat)
  for (const m of [ring, fill]) {
    m.rotation.x = -Math.PI / 2
    m.position.y = RING_LIFT
    group.add(m)
  }

  for (const o of [group, dotHolder, dot, halo, ring, fill]) o.frustumCulled = false

  let ringRadiusM = 30

  return {
    group,
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
      const s = ringRadiusM * (1 + 0.08 * Math.sin(timeS * 2.2))
      ring.scale.set(s, s, 1)
      fill.scale.set(s, s, 1)
      dotHolder.scale.setScalar(pinScaleAt(camera.position.distanceTo(group.position)))
    },
    dispose() {
      for (const g of [dotGeo, haloGeo, ringGeo, fillGeo]) g.dispose()
      for (const m of [dotMat, haloMat, ringMat, fillMat]) m.dispose()
    },
  }
}
