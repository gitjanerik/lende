// Hill-shading fra DEM (v8.9.4). Bruker standard Horn-formel: gradient
// fra 3×3 nabolag, kombinert med sol-azimut + elevasjon for å regne ut
// lokal lyshet. Output: grayscale RGBA-buffer + canvas → dataURL som kan
// embeddes som SVG <image>.
//
// Konvensjoner:
//   azimuth 315°  → solen fra nordvest (klassisk kartografi-konvensjon)
//   elevation 45° → solen halvveis oppe
// Endre via options for å eksperimentere.

// Gradient-basislinje i METER (v2.4.17). Skråningen måles alltid over ~20 m
// bakke, ikke over «én DEM-celle» — ellers avhenger relieffet av flisas DEM-
// oppløsning, og nabofliser fikk synlig ulik relieff-styrke.
//
// Hvorfor det slo inn i praksis: DEM-oppløsning velges PER FLIS. Probe-en er
// 10 m (fine konturer) eller 20 m, og for fine kart forsøkes en oppgradering til
// 2/3/5 m som faller tilbake til proben hvis nettet svikter. To nabofliser bygget
// på ulikt tidspunkt kunne derfor ende på f.eks. 2 m og 20 m. Et grovt rutenett
// glatter terrenget, så |∇z| målt over én celle blir systematisk mindre → flatere,
// lysere relieff. Resultatet var et tydelig sprang i relieffet langs flis-skjøten.
//
// Med fast basislinje estimerer begge fliser ∂z/∂x over samme 20 m, så de er
// enige der terrenget er det — uansett rutenett. 20 m er den groveste proben, så
// vi later aldri som vi har mer detalj enn dataene gir.
const GRADIENT_BASELINE_M = 20

/**
 * @param {{data: Float32Array, cols: number, rows: number, transform: {pixelWidth: number, pixelHeight: number}, noData: number}} dem
 * @param {{azimuthDeg?: number, elevationDeg?: number, zFactor?: number, gamma?: number, baselineM?: number}} [options]
 * @returns {{rgba: Uint8ClampedArray, cols: number, rows: number, widthM: number, heightM: number}}
 */
export function computeHillshade(dem, options = {}) {
  // zFactor 1.5: overdriv skråninger litt så relieffet trer tydeligere fram —
  // store/slake kart (f.eks. Tyrifjorden, 25 m ekvidistanse) ga ellers et veldig
  // svakt relieff under multiply-blend. gamma 1.0 (nøytral) i stedet for 0.85 så
  // skyggesidene ikke lysnes opp — dypere skygger = sterkere relieff. (v9.3.36)
  const {
    azimuthDeg = 315, elevationDeg = 45, zFactor = 1.5, gamma = 1.0,
    baselineM = GRADIENT_BASELINE_M,
  } = options
  const { data, cols, rows, transform, noData } = dem
  const cellSize = transform.pixelWidth
  // Hvor mange celler tilsvarer basislinja? Minst 1 (grovt rutenett bruker
  // nabocellen, som før), og aldri mer enn halve flisa.
  const step = Math.max(1, Math.min(
    Math.round(baselineM / (cellSize || baselineM)),
    Math.max(1, Math.floor(Math.min(cols, rows) / 2) - 1)))
  const zenithRad = (90 - elevationDeg) * Math.PI / 180
  // GDAL-konvensjon: azimuth måles med klokken fra nord, mens atan2 returnerer
  // matematisk vinkel (mot klokken fra øst). Konverter.
  const azimuthRad = (360 - azimuthDeg + 90) * Math.PI / 180

  const cosZenith = Math.cos(zenithRad)
  const sinZenith = Math.sin(zenithRad)
  const rgba = new Uint8ClampedArray(cols * rows * 4)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 3×3-nabolag `step` celler ut, klampet til flisa.
      const rUp = Math.max(0, r - step)
      const rDn = Math.min(rows - 1, r + step)
      const cL = Math.max(0, c - step)
      const cR = Math.min(cols - 1, c + step)
      const get = (rr, cc) => {
        const v = data[rr * cols + cc]
        return v === noData ? 0 : v
      }
      const z00 = get(rUp, cL), z01 = get(rUp, c), z02 = get(rUp, cR)
      const z10 = get(r,   cL),                    z12 = get(r,   cR)
      const z20 = get(rDn, cL), z21 = get(rDn, c), z22 = get(rDn, cR)

      // Sobel-vektet gradient, delt på FAKTISK avstand mellom prøvene. Den gamle
      // koden delte alltid på 2 celler selv der klampingen ga bare 1 — så hele
      // ytterste rad/kolonne fikk halvert skråning, altså en systematisk lysere
      // kantstripe rundt hver flis. Med to fliser inntil hverandre ble det en
      // dobbel lys stripe langs skjøten (v2.4.17).
      const spanX = (cR - cL) * cellSize
      const spanY = (rDn - rUp) * cellSize
      const dzdx = spanX > 0 ? ((z02 + 2 * z12 + z22) - (z00 + 2 * z10 + z20)) / (4 * spanX) : 0
      const dzdy = spanY > 0 ? ((z20 + 2 * z21 + z22) - (z00 + 2 * z01 + z02)) / (4 * spanY) : 0

      const slope = Math.atan(zFactor * Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)

      let shade = cosZenith * Math.cos(slope)
                + sinZenith * Math.sin(slope) * Math.cos(azimuthRad - aspect)
      if (shade < 0) shade = 0
      else if (shade > 1) shade = 1
      // Gamma-kurve så skyggene blir litt mer markante uten å bli kullsorte
      shade = Math.pow(shade, gamma)
      const px = Math.round(shade * 255)

      const idx = (r * cols + c) * 4
      rgba[idx]     = px
      rgba[idx + 1] = px
      rgba[idx + 2] = px
      rgba[idx + 3] = 255
    }
  }

  return {
    rgba,
    cols,
    rows,
    widthM: cols * cellSize,
    heightM: rows * Math.abs(transform.pixelHeight ?? cellSize),
  }
}

/**
 * Bak blend-modus inn i alfa-kanalen så relieffet kan tegnes med NORMAL
 * kompositt i stedet for `mix-blend-mode` (v9.3.39). mix-blend-mode tvinger
 * nettleseren til å re-rasterisere backdrop-en (hele vektor-kartet) per frame
 * under pan/zoom — en alvorlig mobil-flaskehals. Normal alfa-kompositt er
 * pikselidentisk når vi velger riktig farge + alfa:
 *
 *   multiply  (lyse tema): result = base × (skygge/255)
 *             = base × (1 − α)  ⇒  svart overlegg, α = 255 − skygge
 *   screen    (mørke tema): result = 1 − (1−base)(1−skygge/255)
 *             = base + α(1−base) ⇒  hvitt overlegg, α = skygge
 *
 * Begge er matematisk eksakt lik de respektive blend-modusene. Ren funksjon
 * (ingen canvas/DOM) så den er enhetstestbar.
 *
 * @param {{rgba: Uint8ClampedArray, cols: number, rows: number}} shade  grayscale-skygge fra computeHillshade
 * @param {'multiply'|'screen'} mode
 * @returns {Uint8ClampedArray} RGBA med tonet farge + bakt alfa
 */
export function shadeToToneRGBA(shade, mode) {
  const { rgba: src } = shade
  const out = new Uint8ClampedArray(src.length)
  const white = mode === 'screen'
  const v = white ? 255 : 0
  for (let i = 0; i < src.length; i += 4) {
    const g = src[i]                 // grå skyggeverdi 0..255 (kanalene er like)
    out[i] = v; out[i + 1] = v; out[i + 2] = v
    out[i + 3] = white ? g : 255 - g
  }
  return out
}

/**
 * Render hillshade RGBA til en data-URL (PNG). Brukes for å embedde resultatet
 * som SVG <image href="data:image/png;base64,..."/>.
 *
 * `mode` ('multiply'/'screen') bakes inn i alfa (se shadeToToneRGBA) så
 * <image> kan tegnes med normal kompositt.
 */
export function hillshadeToDataURL(shade, { mode = 'multiply' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = shade.cols
  canvas.height = shade.rows
  const ctx = canvas.getContext('2d')
  const imgData = new ImageData(shadeToToneRGBA(shade, mode), shade.cols, shade.rows)
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/png')
}
