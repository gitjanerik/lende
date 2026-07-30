// 3D-høydekurver: buildContours fra dem.js gir polylinjer med hver sin
// elevasjon — de legges som LineSegments svakt over terrenget. Togglebart
// lag (default av); bygges lazily første gang det slås på.

import { BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, Group } from 'three'
import { buildContours } from '../dem.js'

export function buildContourLines(dem, coords, { intervalM = 20, liftM = 1.5 } = {}) {
  const { features } = buildContours(dem, intervalM, 5, { smoothingM: 15 })
  const group = new Group()
  const geometries = []
  const materials = []

  const emit = (isIndex) => {
    const pts = []
    for (const f of features) {
      if (!!f.isIndex !== isIndex) continue
      const c = f.coordinates
      for (let i = 0; i + 1 < c.length; i++) {
        const [x1, y1] = c[i]
        const [x2, y2] = c[i + 1]
        const a = coords.toWorld(x1, y1, f.elevation + liftM)
        const b = coords.toWorld(x2, y2, f.elevation + liftM)
        pts.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
      if (f.closed && c.length > 1) {
        const [x1, y1] = c[c.length - 1]
        const [x2, y2] = c[0]
        const a = coords.toWorld(x1, y1, f.elevation + liftM)
        const b = coords.toWorld(x2, y2, f.elevation + liftM)
        pts.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }
    if (!pts.length) return
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
    const mat = new LineBasicMaterial({
      color: 0xa5673f,
      transparent: true,
      opacity: isIndex ? 0.85 : 0.45,
    })
    geometries.push(geo)
    materials.push(mat)
    const lines = new LineSegments(geo, mat)
    lines.frustumCulled = false
    group.add(lines)
  }

  emit(false)
  emit(true)

  return {
    group,
    geometries,
    materials,
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
