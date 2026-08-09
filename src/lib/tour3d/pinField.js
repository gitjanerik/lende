// Knappenåler i 3D — den delte formen og den delte matematikken.
//
// En nål er en hvit stamme med et farget kulehode, plantet med foten i
// terrenget. Turvisningen bruker noen få (start/mål/via), utforskeren kan ha
// hundrevis, så feltet tegnes som to InstancedMesh-er med per-instans farge:
// én tegnekall for stammene og én for hodene uansett antall.
//
// Avstandsoverdrivelsen er felles og bevisst: nær kamera står nåla i naturlig
// størrelse, langt unna vokser den opptil 5× så den fortsatt kan lokaliseres
// i horisonten. Skaleringen skjer fra bakkepunktet, så nåla løftes aldri fra
// terrenget.

import {
  SphereGeometry, CylinderGeometry, MeshBasicMaterial, InstancedMesh, Color,
  Object3D, Vector3,
} from 'three'
import { sampleElevation } from '../demSampling.js'

export const PIN_STEM_H = 55
export const PIN_STEM_R = 2.2
export const PIN_HEAD_R = 9

const MAX_SCALE = 5
const SCALE_REF_M = 1200

export function drapedWorld(dem, coords, x, y, liftM = 0) {
  const e = sampleElevation(dem, x, y)
  return coords.toWorld(x, y, (Number.isFinite(e) ? e : 0) + liftM)
}

/**
 * Avstandsavhengig skala for en nål — delt av alle nåletyper.
 * @param {number} distM avstand kamera→nål i world-enheter
 */
export function pinScaleAt(distM) {
  return Math.min(MAX_SCALE, Math.max(1, distM / SCALE_REF_M))
}

/**
 * Bygg et nålefelt.
 * @param {Array<{x:number, y:number, color:number|string}>} items i SVG-meter
 * @param {object} dem
 * @param {object} coords
 * @param {{stemColor?: number}} [opts]
 */
export function buildPinField(items, dem, coords, { stemColor = 0xffffff } = {}) {
  const n = items.length
  const stemGeo = new CylinderGeometry(PIN_STEM_R, PIN_STEM_R, PIN_STEM_H, 8)
  const headGeo = new SphereGeometry(PIN_HEAD_R, 12, 10)
  const stemMat = new MeshBasicMaterial({ color: stemColor })
  const headMat = new MeshBasicMaterial({ vertexColors: false })

  const stems = new InstancedMesh(stemGeo, stemMat, Math.max(1, n))
  const heads = new InstancedMesh(headGeo, headMat, Math.max(1, n))
  stems.frustumCulled = false
  heads.frustumCulled = false
  stems.count = n
  heads.count = n

  // Bakkepunktene lagres slik at update() kan skalere om hver frame uten å
  // sample DEM-en på nytt.
  const bases = new Float32Array(n * 3)
  const dummy = new Object3D()
  const color = new Color()

  for (let i = 0; i < n; i++) {
    const it = items[i]
    const [wx, wy, wz] = drapedWorld(dem, coords, it.x, it.y)
    bases[i * 3] = wx
    bases[i * 3 + 1] = wy
    bases[i * 3 + 2] = wz
    color.set(it.color)
    heads.setColorAt(i, color)
  }
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true

  const _cam = new Vector3()

  // Første oppsett med skala 1 så feltet er riktig plassert før første update.
  const writeInstances = (scaleOf) => {
    for (let i = 0; i < n; i++) {
      const bx = bases[i * 3], by = bases[i * 3 + 1], bz = bases[i * 3 + 2]
      const s = scaleOf(i, bx, by, bz)
      dummy.position.set(bx, by + (PIN_STEM_H / 2) * s, bz)
      dummy.scale.setScalar(s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      stems.setMatrixAt(i, dummy.matrix)
      dummy.position.set(bx, by + (PIN_STEM_H + PIN_HEAD_R * 0.6) * s, bz)
      dummy.updateMatrix()
      heads.setMatrixAt(i, dummy.matrix)
    }
    stems.instanceMatrix.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
  }
  writeInstances(() => 1)

  // Skjulte nåler (autofiltrering) parkeres med skala 0 i stedet for at count
  // endres — indeksene må holde seg stabile for raycast-oppslaget.
  let visible = null   // null = alle synlige

  return {
    stems,
    heads,
    geometries: [stemGeo, headGeo],
    materials: [stemMat, headMat],
    get count() { return n },
    basePosition(i) {
      return [bases[i * 3], bases[i * 3 + 1], bases[i * 3 + 2]]
    },
    setVisibleSet(set) { visible = set },
    isVisible(i) { return !visible || visible.has(i) },
    update(camera) {
      _cam.copy(camera.position)
      writeInstances((i, bx, by, bz) => {
        if (visible && !visible.has(i)) return 0
        const d = Math.hypot(_cam.x - bx, _cam.y - by, _cam.z - bz)
        return pinScaleAt(d)
      })
    },
    // Raycast treffer stamme eller hode; begge peker tilbake på samme indeks.
    raycast(raycaster) {
      const hits = raycaster.intersectObjects([heads, stems], false)
      for (const h of hits) {
        if (h.instanceId != null && (!visible || visible.has(h.instanceId))) return h.instanceId
      }
      return null
    },
    dispose() {
      stemGeo.dispose()
      headGeo.dispose()
      stemMat.dispose()
      headMat.dispose()
      stems.dispose()
      heads.dispose()
    },
  }
}
