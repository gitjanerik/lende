// Terrengmesh: geometri fra terrainGrid + drapert karttekstur. Ulit
// materiale — belysningen er baket hillshade i teksturen, og ISOM-fargene
// skal matche 2D-kartet eksakt (ingen tone-mapping-overraskelser).

import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide } from 'three'
import { buildTerrainGrid, decimateForTerrain } from './terrainGrid.js'

export function buildTerrainMesh(dem, coords, texture, { skirtDropM = 40 } = {}) {
  const decimated = decimateForTerrain(dem)
  const grid = buildTerrainGrid(decimated, coords, { skirtDropM })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(grid.positions, 3))
  geometry.setAttribute('uv', new BufferAttribute(grid.uvs, 2))
  geometry.setIndex(new BufferAttribute(grid.indices, 1))
  geometry.computeBoundingSphere()
  const material = new MeshBasicMaterial({ map: texture, side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, material, minElev: grid.minElev, maxElev: grid.maxElev, dem: decimated }
}
