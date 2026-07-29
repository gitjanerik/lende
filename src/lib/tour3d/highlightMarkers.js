// Markering av aktiv feature: pulserende bakkering + vertikal lysstråle
// (additiv billboard) som leses over terreng fra alle vinkler. Én instans
// gjenbrukes og reposisjoneres — ingen post-processing (mobilbudsjett).

import {
  Mesh, MeshBasicMaterial, RingGeometry, PlaneGeometry, DoubleSide,
  AdditiveBlending, Group,
} from 'three'

export function buildHighlightMarker({ color = 0xfbbf24 } = {}) {
  const group = new Group()
  const ringGeo = new RingGeometry(24, 34, 40)
  const ringMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false })
  const ring = new Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  group.add(ring)

  const beamGeo = new PlaneGeometry(14, 220)
  const beamMat = new MeshBasicMaterial({
    color, transparent: true, opacity: 0.35,
    blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
  })
  const beam = new Mesh(beamGeo, beamMat)
  beam.position.y = 110
  group.add(beam)

  group.visible = false

  return {
    group,
    geometries: [ringGeo, beamGeo],
    materials: [ringMat, beamMat],
    showAt(x, y, z) {
      group.position.set(x, y + 2, z)
      group.visible = true
    },
    hide() { group.visible = false },
    update(timeS, camera) {
      if (!group.visible) return
      const s = 1 + 0.2 * Math.sin(timeS * 2.5)
      ring.scale.setScalar(s)
      ringMat.opacity = 0.5 + 0.25 * Math.sin(timeS * 2.5)
      // Billboard: strålen vender alltid mot kameraet rundt Y-aksen.
      const dx = camera.position.x - group.position.x
      const dz = camera.position.z - group.position.z
      beam.rotation.y = Math.atan2(dx, dz)
    },
  }
}
