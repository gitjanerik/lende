// 3D-høydekurver: buildContours fra dem.js gir polylinjer med hver sin
// elevasjon — de legges som skarpe vektorlinjer svakt over terrenget.
// Togglebart lag (default på); bygges lazily etter at scenen er klar.
//
// LineBasicMaterial er låst til 1 px i WebGL, så tykkelsen kommer fra
// examples/jsm/lines (LineSegments2 + LineMaterial, instansert med
// piksel-bredde). LineMaterial trenger renderer-oppløsningen som uniform —
// kalleren mater setResolution ved resize.

import { Group } from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { buildContours } from '../dem.js'
import { settLinjeSegmenter } from './linjeSegmenter.js'

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
    const geo = new LineSegmentsGeometry()
    // settLinjeSegmenter og ikke setPositions: uten slacken ble den SISTE
    // kurvestreken i hvert av de to bufferne en snorrett linje til world-origo
    // på eierens telefon — «røde bånd som ikke følger terrenget», og alltid
    // nøyaktig to av dem, én per buffer. Se linjeSegmenter.js.
    settLinjeSegmenter(geo, pts)
    const mat = new LineMaterial({
      color: 0xb0532e,
      linewidth: isIndex ? 3.2 : 2.2,
      transparent: true,
      opacity: isIndex ? 0.9 : 0.55,
    })
    geometries.push(geo)
    materials.push(mat)
    const lines = new LineSegments2(geo, mat)
    lines.frustumCulled = false
    group.add(lines)
  }

  emit(false)
  emit(true)

  return {
    group,
    geometries,
    materials,
    setResolution(w, h) {
      for (const m of materials) m.resolution.set(w, h)
    },
    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
