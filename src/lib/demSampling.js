/**
 * DEM-sampling — unpack og oppslag av lagret DEM.
 *
 * DEM-strukturen (fra demFetcher.js) har:
 *   data:      Float32Array av lengde cols*rows, indeksert [row*cols + col]
 *   cols/rows: grid-dimensjoner
 *   transform: { originX:0, originY:0, pixelWidth, pixelHeight } i meter
 *   noData:    sentinel-verdi (-9999) for hull i datasettet
 *
 * SVG-koordinater i kart-viewBox (`0 0 widthM heightM`) mapper direkte til
 * grid-koord via col = svgX / pixelWidth, row = svgY / pixelHeight. Både
 * GeoTIFF-rekker og SVG y-aksen øker nedover, så ingen flip nødvendig.
 */

/** @typedef {{data: Float32Array, cols: number, rows: number, transform: {pixelWidth: number, pixelHeight: number, originX: number, originY: number}, noData: number}} DEM */

/**
 * Bilinear-interpolert elevasjon ved (svgX, svgY). Returnerer NaN ved
 * out-of-bounds eller hvis noen av de fire hjørne-cellene er noData.
 *
 * @param {DEM} dem
 * @param {number} svgX
 * @param {number} svgY
 * @returns {number} høyde i meter, eller NaN
 */
export function sampleElevation(dem, svgX, svgY) {
  const { data, cols, rows, transform, noData } = dem
  const colF = svgX / transform.pixelWidth
  const rowF = svgY / transform.pixelHeight
  if (colF < 0 || rowF < 0 || colF > cols - 1 || rowF > rows - 1) return NaN

  const c0 = Math.floor(colF)
  const c1 = Math.min(c0 + 1, cols - 1)
  const r0 = Math.floor(rowF)
  const r1 = Math.min(r0 + 1, rows - 1)
  const u = colF - c0
  const v = rowF - r0

  const v00 = data[r0 * cols + c0]
  const v10 = data[r0 * cols + c1]
  const v01 = data[r1 * cols + c0]
  const v11 = data[r1 * cols + c1]
  if (v00 === noData || v10 === noData || v01 === noData || v11 === noData) return NaN

  const top = v00 * (1 - u) + v10 * u
  const bot = v01 * (1 - u) + v11 * u
  return top * (1 - v) + bot * v
}

/**
 * Høyde-oppslag for terrengavhengige REGLER — hull-broingen i routing.js og
 * stinett-diagnosen. Returnerer undefined når kartet ikke har ekte terrengdata:
 * en syntetisk DEM er oppdiktet terreng og skal aldri avgjøre om et hull mellom
 * to stier er trygt å krysse. Kallstedene tolker undefined som «regelen finnes
 * ikke» og ruter som før.
 *
 * @param {DEM|null|undefined} dem
 * @returns {((x:number,y:number)=>number)|undefined}
 */
export function realElevationAt(dem) {
  if (!dem || dem.source?.startsWith?.('synthetic')) return undefined
  return (x, y) => sampleElevation(dem, x, y)
}

/**
 * Finner høyeste punkt i DEM-griddet. Returnerer SVG-koord og elevasjon,
 * eller null hvis hele griddet er noData.
 *
 * @param {DEM} dem
 * @returns {{svgX: number, svgY: number, elevation: number} | null}
 */
export function findHighestPoint(dem) {
  const { data, cols, rows, transform, noData } = dem
  let maxIdx = -1
  let maxZ = -Infinity
  for (let i = 0; i < data.length; i++) {
    const z = data[i]
    if (z !== noData && z > maxZ) {
      maxZ = z
      maxIdx = i
    }
  }
  if (maxIdx < 0) return null
  const col = maxIdx % cols
  const row = Math.floor(maxIdx / cols)
  return {
    svgX: (col + 0.5) * transform.pixelWidth,
    svgY: (row + 0.5) * transform.pixelHeight,
    elevation: maxZ,
  }
}

/**
 * Pakk DEM-data til en form som kan persisteres i IndexedDB. Returnerer
 * et POJO med ArrayBuffer for data-array (Float32Array er ikke direkte
 * structured-clonable i alle browsere, men ArrayBuffer er).
 *
 * @param {DEM} dem
 * @returns {{buffer: ArrayBuffer, cols: number, rows: number, transform: object, noData: number}}
 */
export function packDem(dem) {
  return {
    buffer: dem.data.buffer.slice(0),
    cols: dem.cols,
    rows: dem.rows,
    transform: { ...dem.transform },
    noData: dem.noData,
  }
}

/**
 * Nedskaler et DEM til ~targetResM ved box-snitt, for LAGRING i kartet.
 *
 * Kartet bakes med full DEM-oppløsning (konturer/CHM), men det innebygde
 * rutenettet trengs bare til høyde-ved-trykk og rute-høydeprofil — der er
 * ~10 m rikelig. Rå Float32 er 4 byte/celle, så et 1–2 m-rutenett blåser
 * kartfila (1 m/1 km ≈ 4 MB). Nedskalering til 10 m kutter det ~25–100×
 * uten merkbart tap for høydeoppslag. Er DEM-et alt ≥ targetResM (factor ≤ 1)
 * returneres samme referanse.
 *
 * @param {DEM} dem
 * @param {number} targetResM
 * @returns {DEM}
 */
export function downsampleDem(dem, targetResM = 10) {
  const curRes = Math.abs(dem.transform?.pixelWidth || dem.resolution || targetResM)
  const factor = Math.max(1, Math.round(targetResM / curRes))
  if (factor <= 1) return dem
  const { data, cols, rows, noData } = dem
  const nc = Math.max(1, Math.floor(cols / factor))
  const nr = Math.max(1, Math.floor(rows / factor))
  const out = new Float32Array(nc * nr)
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) {
      let sum = 0, n = 0
      for (let dy = 0; dy < factor; dy++) {
        const sr = r * factor + dy
        if (sr >= rows) break
        for (let dx = 0; dx < factor; dx++) {
          const sc = c * factor + dx
          if (sc >= cols) break
          const v = data[sr * cols + sc]
          if (v === noData || !Number.isFinite(v)) continue
          sum += v; n++
        }
      }
      out[r * nc + c] = n ? sum / n : noData
    }
  }
  return {
    data: out,
    cols: nc,
    rows: nr,
    transform: {
      ...dem.transform,
      pixelWidth: dem.transform.pixelWidth * factor,
      pixelHeight: dem.transform.pixelHeight * factor,
    },
    noData,
    resolution: Math.abs(dem.transform.pixelWidth * factor),
  }
}

/**
 * Pakk ut igjen til DEM-form med Float32Array-view.
 *
 * @param {{buffer: ArrayBuffer, cols: number, rows: number, transform: object, noData: number}} packed
 * @returns {DEM}
 */
export function unpackDem(packed) {
  return {
    data: new Float32Array(packed.buffer),
    cols: packed.cols,
    rows: packed.rows,
    transform: packed.transform,
    noData: packed.noData,
  }
}

/**
 * Lagrings-formen av et DEM: nedskalert til ~10 m, pakket til ArrayBuffer, og
 * kartets høyeste punkt. Ett sted fordi den kjøres i mapSvg-workeren (der
 * arbeidet hører hjemme) og på hovedtråden når workeren ikke er tilgjengelig.
 */
export function pakkLagretDem(dem) {
  return { pakketDem: packDem(downsampleDem(dem, 10)), hoyestePunkt: findHighestPoint(dem) }
}
