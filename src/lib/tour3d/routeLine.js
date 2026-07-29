// Ruta i 3D: tube-geometri over den draperte kurven, med progresjon som
// shader-splitt på per-verteks arc-length (aAlongM) mot uniform uProgressM —
// én uniform-skriving per frame, ingen geometri-endring under avspilling.

import {
  CatmullRomCurve3, TubeGeometry, Mesh, MeshBasicMaterial, Vector3,
  BufferAttribute, Color, SphereGeometry, RingGeometry, DoubleSide,
} from 'three'

const DONE_COLOR = new Color('#dc2626')
const REMAIN_COLOR = new Color('#f8b4b4')

export function buildRouteLine(path, { radiusM = 5 } = {}) {
  const pts = []
  for (let i = 0; i < path.points3.length / 3; i++) {
    pts.push(new Vector3(path.points3[i * 3], path.points3[i * 3 + 1], path.points3[i * 3 + 2]))
  }
  const curve = new CatmullRomCurve3(pts, false, 'centripetal')
  const tubularSegments = Math.min(2200, Math.max(16, pts.length - 1))
  const geometry = new TubeGeometry(curve, tubularSegments, radiusM, 6, false)

  // TubeGeometry har (tubularSegments+1) ringer à (radialSegments+1)
  // vertekser i rekkefølge — gi hver ring sin alongM.
  const vertsPerRing = 6 + 1
  const count = geometry.attributes.position.count
  const along = new Float32Array(count)
  for (let seg = 0; seg <= tubularSegments; seg++) {
    const t = seg / tubularSegments
    const d = t * path.totalM
    for (let r = 0; r < vertsPerRing; r++) {
      const idx = seg * vertsPerRing + r
      if (idx < count) along[idx] = d
    }
  }
  geometry.setAttribute('aAlongM', new BufferAttribute(along, 1))

  const uniforms = { uProgressM: { value: 0 } }
  const material = new MeshBasicMaterial({ color: 0xffffff })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgressM = uniforms.uProgressM
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlongM;\nvarying float vAlongM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlongM = aAlongM;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uProgressM;
varying float vAlongM;
const vec3 doneColor = vec3(${DONE_COLOR.r.toFixed(4)}, ${DONE_COLOR.g.toFixed(4)}, ${DONE_COLOR.b.toFixed(4)});
const vec3 remainColor = vec3(${REMAIN_COLOR.r.toFixed(4)}, ${REMAIN_COLOR.g.toFixed(4)}, ${REMAIN_COLOR.b.toFixed(4)});`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(doneColor, remainColor, step(uProgressM, vAlongM));
// Glødende front rundt nåværende posisjon.
float glow = 1.0 - smoothstep(0.0, 30.0, abs(vAlongM - uProgressM));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 1.0), glow * 0.55);`)
  }
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  return {
    mesh, geometry, material,
    setProgress(alongM) { uniforms.uProgressM.value = alongM },
  }
}

// Bevegelig posisjonsmarkør: kule + flat ring på bakken under.
export function buildRouteMarker({ radiusM = 9 } = {}) {
  const sphereGeo = new SphereGeometry(radiusM, 16, 12)
  const sphereMat = new MeshBasicMaterial({ color: 0xdc2626 })
  const sphere = new Mesh(sphereGeo, sphereMat)
  const ringGeo = new RingGeometry(radiusM * 1.6, radiusM * 2.2, 32)
  const ringMat = new MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.5, side: DoubleSide })
  const ring = new Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  return {
    sphere, ring,
    geometries: [sphereGeo, ringGeo],
    materials: [sphereMat, ringMat],
    setPosition(x, y, z) {
      sphere.position.set(x, y, z)
      ring.position.set(x, y - 6, z)
    },
    pulse(timeS) {
      const s = 1 + 0.15 * Math.sin(timeS * 3)
      ring.scale.setScalar(s)
      ringMat.opacity = 0.35 + 0.2 * Math.sin(timeS * 3)
    },
  }
}
