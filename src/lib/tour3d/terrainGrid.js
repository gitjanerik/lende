// DEM → geometri-arrays for terrengmeshen. Ren tallknusing uten three/DOM
// så modulen kan testes i node.
//
// noData (-9999) settes til 0 (havnivå): kystkart får flat sjø akkurat der
// ISOM-teksturen maler vann, og små innlands-hull flater harmløst ut. NaN må
// aldri nå posisjonene (ødelegger bounding-sfæren i three).
//
// «Skirts»: en ekstra vertex-ring rundt kanten, kopiert i XZ men senket
// skirtDropM, skjuler bakgrunnen gjennom mesh-kanten ved skrå kameravinkler.

import { downsampleDem } from '../demSampling.js'

export const MAX_GRID_DIM = 512

// Desimer DEM-en til ≤ maxDim celler i største retning (store mosaikk-kart
// kan ellers gi millioner av vertekser).
export function decimateForTerrain(dem, maxDim = MAX_GRID_DIM) {
  const largest = Math.max(dem.cols, dem.rows)
  if (largest <= maxDim) return dem
  const curRes = Math.abs(dem.transform.pixelWidth)
  const targetRes = curRes * Math.ceil(largest / maxDim)
  return downsampleDem(dem, targetRes)
}

/**
 * @param {import('../demSampling.js').DEM} dem  (allerede desimert)
 * @param {ReturnType<import('./coords.js').makeCoords>} coords
 * @param {{skirtDropM?: number}} [opts]
 * @returns {{positions: Float32Array, uvs: Float32Array, indices: Uint32Array,
 *            cols: number, rows: number, minElev: number, maxElev: number}}
 */
export function buildTerrainGrid(dem, coords, { skirtDropM = 40 } = {}) {
  const { data, cols, rows, transform, noData } = dem
  const pw = transform.pixelWidth
  const ph = transform.pixelHeight
  const gridCount = cols * rows
  const skirtCount = 2 * cols + 2 * (rows - 2)
  const positions = new Float32Array((gridCount + skirtCount) * 3)
  const uvs = new Float32Array((gridCount + skirtCount) * 2)

  let minElev = Infinity
  let maxElev = -Infinity
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      let z = data[i]
      if (z === noData || !Number.isFinite(z)) z = 0
      if (z < minElev) minElev = z
      if (z > maxElev) maxElev = z
      const svgX = c * pw
      const svgY = r * ph
      const [wx, wy, wz] = coords.toWorld(svgX, svgY, z)
      positions[i * 3] = wx
      positions[i * 3 + 1] = wy
      positions[i * 3 + 2] = wz
      const [u, v] = coords.uvOf(svgX, svgY)
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  }
  if (!Number.isFinite(minElev)) { minElev = 0; maxElev = 0 }

  // Skirt-vertekser: kopier kant-verteksene, senk Y, klamp UV til kanten.
  const edgeIdx = []
  for (let c = 0; c < cols; c++) edgeIdx.push(c)
  for (let r = 1; r < rows - 1; r++) { edgeIdx.push(r * cols + cols - 1); edgeIdx.push(r * cols) }
  for (let c = 0; c < cols; c++) edgeIdx.push((rows - 1) * cols + c)
  const drop = skirtDropM * coords.exaggeration
  const skirtOf = new Map()
  edgeIdx.forEach((src, k) => {
    const dst = gridCount + k
    positions[dst * 3] = positions[src * 3]
    positions[dst * 3 + 1] = positions[src * 3 + 1] - drop
    positions[dst * 3 + 2] = positions[src * 3 + 2]
    uvs[dst * 2] = uvs[src * 2]
    uvs[dst * 2 + 1] = uvs[src * 2 + 1]
    skirtOf.set(src, dst)
  })

  const quadCount = (cols - 1) * (rows - 1)
  const skirtQuadCount = 2 * (cols - 1) + 2 * (rows - 1)
  const indices = new Uint32Array((quadCount + skirtQuadCount) * 6)
  let k = 0
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c
      const b = a + 1
      const d = a + cols
      const e = d + 1
      indices[k++] = a; indices[k++] = d; indices[k++] = b
      indices[k++] = b; indices[k++] = d; indices[k++] = e
    }
  }
  const skirtQuad = (edgeA, edgeB) => {
    const sa = skirtOf.get(edgeA)
    const sb = skirtOf.get(edgeB)
    indices[k++] = edgeA; indices[k++] = sa; indices[k++] = edgeB
    indices[k++] = edgeB; indices[k++] = sa; indices[k++] = sb
  }
  for (let c = 0; c < cols - 1; c++) skirtQuad(c + 1, c)
  for (let c = 0; c < cols - 1; c++) skirtQuad((rows - 1) * cols + c, (rows - 1) * cols + c + 1)
  for (let r = 0; r < rows - 1; r++) skirtQuad(r * cols, (r + 1) * cols)
  for (let r = 0; r < rows - 1; r++) skirtQuad((r + 1) * cols + cols - 1, r * cols + cols - 1)

  return { positions, uvs, indices, cols, rows, minElev, maxElev }
}
