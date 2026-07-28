import { describe, it, expect } from 'vitest'
import { computeHillshade, shadeToToneRGBA } from './hillshade.js'

// v9.3.39: relieffet blendes nå via bakt alfa (normal kompositt) i stedet for
// mix-blend-mode. shadeToToneRGBA må være PIKSELIDENTISK med de gamle blend-
// modusene — ellers endrer relieffet utseende. Testene låser ekvivalensen.

const mkShade = (grays) => {
  const rgba = new Uint8ClampedArray(grays.length * 4)
  grays.forEach((g, i) => {
    rgba[i * 4] = g; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = g; rgba[i * 4 + 3] = 255
  })
  return { cols: grays.length, rows: 1, rgba }
}

describe('shadeToToneRGBA — blend bakt inn i alfa', () => {
  it('multiply: svart overlegg, alfa = 255 − skygge', () => {
    const out = shadeToToneRGBA(mkShade([0, 128, 255]), 'multiply')
    // px0 (mørk skygge) → helt svart, full dekning
    expect([out[0], out[1], out[2], out[3]]).toEqual([0, 0, 0, 255])
    // px1 (midt) → svart, halv alfa
    expect([out[4], out[5], out[6], out[7]]).toEqual([0, 0, 0, 127])
    // px2 (lyst = ingen skygge) → gjennomsiktig
    expect([out[8], out[9], out[10], out[11]]).toEqual([0, 0, 0, 0])
  })

  it('screen: hvitt overlegg, alfa = skygge', () => {
    const out = shadeToToneRGBA(mkShade([0, 128, 255]), 'screen')
    expect([out[0], out[1], out[2], out[3]]).toEqual([255, 255, 255, 0])
    expect([out[4], out[5], out[6], out[7]]).toEqual([255, 255, 255, 128])
    expect([out[8], out[9], out[10], out[11]]).toEqual([255, 255, 255, 255])
  })

  it('feather: kant-alfa tones til 0, senter uberørt (3×3-flis-relieff)', () => {
    // 9×9 fullt mørk skygge (g=0 ⇒ multiply-alfa=255 overalt uten feather).
    const n = 9
    const shade = { cols: n, rows: n, rgba: new Uint8ClampedArray(n * n * 4) }
    for (let i = 0; i < n * n; i++) { shade.rgba[i * 4 + 3] = 255 }
    const plain = shadeToToneRGBA(shade, 'multiply')
    const feathered = shadeToToneRGBA(shade, 'multiply', { feather: 0.2 })
    const at = (buf, r, c) => buf[(r * n + c) * 4 + 3]
    // Uten feather: full dekning overalt
    expect(at(plain, 0, 0)).toBe(255)
    expect(at(plain, 4, 4)).toBe(255)
    // Med feather: hjørnet (kant) → 0, senteret beholder full alfa
    expect(at(feathered, 0, 0)).toBe(0)
    expect(at(feathered, 4, 4)).toBe(255)
    // Monotont stigende innover fra kanten langs diagonalen
    expect(at(feathered, 1, 1)).toBeLessThan(at(feathered, 2, 2))
  })

  it('feather=0 er identisk med ingen feather (bakoverkompat)', () => {
    const shade = mkShade([0, 64, 128, 192, 255])
    const a = shadeToToneRGBA(shade, 'screen')
    const b = shadeToToneRGBA(shade, 'screen', { feather: 0 })
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('vignette: hjørner helt transparente, senter full styrke (ingen rektangel)', () => {
    // 21×21 fullt mørk skygge (multiply ⇒ alfa 255 uten vignette overalt).
    const n = 21
    const shade = { cols: n, rows: n, rgba: new Uint8ClampedArray(n * n * 4) }
    for (let i = 0; i < n * n; i++) shade.rgba[i * 4 + 3] = 255
    const out = shadeToToneRGBA(shade, 'multiply', { vignette: 0.55 })
    const at = (r, c) => out[(r * n + c) * 4 + 3]
    const mid = (n - 1) / 2
    expect(at(mid, mid)).toBe(255)   // senter: full
    expect(at(0, 0)).toBe(0)         // hjørner (rad ≈ 1,41): borte
    expect(at(0, n - 1)).toBe(0)
    expect(at(n - 1, 0)).toBe(0)
    expect(at(n - 1, n - 1)).toBe(0)
    expect(at(0, mid)).toBe(0)       // kant-midtpunkt (rad = 1): borte
    expect(at(mid, 0)).toBe(0)
    // Monotont stigende innover langs en akse
    expect(at(mid, 2)).toBeLessThan(at(mid, Math.round(mid)))
  })

  it('vignette vinner over feather når begge er satt', () => {
    const n = 11
    const shade = { cols: n, rows: n, rgba: new Uint8ClampedArray(n * n * 4) }
    for (let i = 0; i < n * n; i++) shade.rgba[i * 4 + 3] = 255
    const both = shadeToToneRGBA(shade, 'multiply', { feather: 0.2, vignette: 0.5 })
    const vigOnly = shadeToToneRGBA(shade, 'multiply', { vignette: 0.5 })
    expect(Array.from(both)).toEqual(Array.from(vigOnly))
  })

  it('alfa-kompositt er matematisk lik mix-blend-mode for alle skygge/base-par', () => {
    const grays = [0, 32, 64, 128, 200, 255]
    const bases = [0, 50, 128, 220, 255]
    const mul = shadeToToneRGBA(mkShade(grays), 'multiply')
    const scr = shadeToToneRGBA(mkShade(grays), 'screen')
    grays.forEach((g, i) => {
      for (const base of bases) {
        // multiply: base × (skygge/255)
        const aM = mul[i * 4 + 3] / 255
        const overBlack = base * (1 - aM) + 0 * aM
        expect(Math.round(overBlack)).toBe(Math.round(base * (g / 255)))
        // screen: 1 − (1−base)(1−skygge/255)
        const aS = scr[i * 4 + 3] / 255
        const overWhite = base * (1 - aS) + 255 * aS
        const screenRef = 255 * (1 - (1 - base / 255) * (1 - g / 255))
        expect(Math.round(overWhite)).toBe(Math.round(screenRef))
      }
    })
  })
})

// v2.4.17: relieffet skal være UAVHENGIG av flisas DEM-oppløsning, og kantradene
// skal ikke få halvert skråning. Begge ga synlige sprang langs flis-skjøtene: DEM-
// oppløsning velges per flis (10/20 m probe + 2/3/5 m oppgradering som kan falle
// tilbake), så nabofliser kunne ha ulikt rutenett over samme terreng.

// Et plan med konstant helning: z = slopeFrac · x (meter). Skråningen er den
// samme uansett hvor tett vi sampler den.
function ramp(cols, rows, cellSize, slopeFrac) {
  const data = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) data[r * cols + c] = slopeFrac * c * cellSize
  }
  return { data, cols, rows, transform: { pixelWidth: cellSize, pixelHeight: cellSize }, noData: -9999 }
}
const midPixel = (sh) => {
  const r = (sh.rows / 2) | 0, c = (sh.cols / 2) | 0
  return sh.rgba[(r * sh.cols + c) * 4]
}

describe('computeHillshade — samme terreng, ulik DEM-oppløsning', () => {
  it('gir samme skygge for 2 m, 10 m og 20 m rutenett', () => {
    // Samme 400 m × 400 m flate med 20 % helning, samplet tre ulike måter.
    const fine = computeHillshade(ramp(200, 200, 2, 0.2))
    const mid = computeHillshade(ramp(40, 40, 10, 0.2))
    const coarse = computeHillshade(ramp(20, 20, 20, 0.2))
    expect(Math.abs(midPixel(fine) - midPixel(coarse))).toBeLessThanOrEqual(1)
    expect(Math.abs(midPixel(mid) - midPixel(coarse))).toBeLessThanOrEqual(1)
  })

  it('brattere terreng gir sterkere relieff (den faste basislinja flater ikke ut)', () => {
    // Flat bakke gir shade = cos(45°) ≈ 0,707 → ~180. Retningen på skråningen
    // avgjør om den blir lysere eller mørkere enn det (her vender den mot sola i
    // nordvest), så vi måler AVSTANDEN fra flatt — det er relieff-styrken.
    const FLAT = Math.round(Math.cos(Math.PI / 4) * 255)
    const slak = Math.abs(midPixel(computeHillshade(ramp(40, 40, 10, 0.05))) - FLAT)
    const bratt = Math.abs(midPixel(computeHillshade(ramp(40, 40, 10, 0.6))) - FLAT)
    expect(bratt).toBeGreaterThan(slak)
  })
})

describe('computeHillshade — kantrader', () => {
  it('ytterste kolonne får samme skygge som midten på en jevn skråning', () => {
    // Den gamle koden delte alltid på 2 celler, også der kant-clampingen bare ga
    // 1 → halvert skråning → en systematisk lysere stripe rundt hver flis, og en
    // dobbel lys stripe der to fliser møttes.
    const sh = computeHillshade(ramp(40, 40, 10, 0.2))
    const row = (sh.rows / 2) | 0
    const at = (c) => sh.rgba[(row * sh.cols + c) * 4]
    const mid = at((sh.cols / 2) | 0)
    expect(Math.abs(at(0) - mid)).toBeLessThanOrEqual(1)
    expect(Math.abs(at(sh.cols - 1) - mid)).toBeLessThanOrEqual(1)
  })

  it('ytterste rad får samme skygge som midten', () => {
    const sh = computeHillshade(ramp(40, 40, 10, 0.2))
    const col = (sh.cols / 2) | 0
    const at = (r) => sh.rgba[(r * sh.cols + col) * 4]
    const mid = at((sh.rows / 2) | 0)
    expect(Math.abs(at(0) - mid)).toBeLessThanOrEqual(1)
    expect(Math.abs(at(sh.rows - 1) - mid)).toBeLessThanOrEqual(1)
  })
})
