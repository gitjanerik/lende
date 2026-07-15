// Relieff-rendering (hillshade) — skilt ut fra MapView v1.0.8 (kode uendret).
// DEM → grayscale-skygge → enten mjuk PNG (<image>) eller skarpe vektor-
// tone-bånd, plassert under første vann-lag. Composablen eier memo-cachene;
// forelderen eier SVG-verten og relieff-innstillingene (destrukturert inn).
// Watchene som trigger applyHillshade ligger fortsatt i MapView.
import { isomCatalog } from '../lib/symbolizer.js'
import { computeHillshade, hillshadeToDataURL } from '../lib/hillshade.js'
import { buildReliefBands } from '../lib/reliefBands.js'

export function useReliefRender({
  svgHostRef, meta, storedDem, ensureDem, currentTheme,
  reliefEnabled, reliefMode, reliefOpacity, RELIEF_BANDS,
}) {
  // Reliefskygge (hill-shading, v8.9.4) — DEM regnes til grayscale-PNG og
  // embeddes som SVG <image> i bunnen av lag-stacken. Cached så bytte AV/PÅ
  // er øyeblikkelig, og en watch på visibleLayers + storedDem trigger
  // re-apply når brukeren toggler eller når DEM er lazy-lastet inn.
  let cachedHillshadeUrl = null   // memoize: avhenger av (DEM, blend-modus)
  let cachedHillshadeDem = null
  let cachedShade = null          // rå grayscale-skygge — re-tones ved tema-bytte uten DEM-rekalk
  let cachedHillshadeMode = null
  let cachedBandsKey = null       // vektor-relieff: `${blend}|${bands}`; nullstilles ved DEM-bytte

  // Relieff-blend velges per tema: lyse bakgrunner mørkner naturlig med
  // `multiply`, mens mørke/art-tema (Curves) får `screen` så terrenget lyser
  // opp bak konturene istedenfor å drukne i multiply-gjørme.
  function hexLuminance(hex) {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? '')
    if (!m) return 1
    const n = parseInt(m[1], 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  function reliefBlendMode() {
    const bg = isomCatalog.themes?.[currentTheme.value]?.background
    return hexLuminance(bg) < 0.4 ? 'screen' : 'multiply'
  }

  // Plasser-strategi (v9.3.36): relieffet skal DRAPERE LAND, ikke vann. Sett
  // relieffet UNDER det første vann-laget (men over vegetasjon/konturer/stupkant),
  // så det opake vannet dekker relieffet over innsjø/sjø: ren flat vannflate uten
  // skygge-frynse langs strandlinja, og land-relieffet leses med mer kontrast.
  // Faller tilbake til toppen av kropps-innholdet (under klient-overlays) når
  // kartet ikke har vann.
  function reliefInsertBefore(svg) {
    return svg.querySelector('[data-layer="vann"]')
        ?? svg.querySelector('#user-layer')
        ?? svg.querySelector('#annotation-layer')
        ?? svg.querySelector('#track-layer')
        ?? svg.querySelector('#measure-layer')
  }

  // Mjukt relieff (v9.3.39): blend-modus bakt inn i PNG-alfa (svart/multiply for
  // lyse tema, hvit/screen for mørke) så <image> tegnes med NORMAL kompositt —
  // pikselidentisk med mix-blend-mode, men uten dyr per-frame backdrop-blending.
  function applyReliefRaster(svg, mode) {
    let img = svg.querySelector('#hillshade-layer')
    if (img && img.tagName.toLowerCase() !== 'image') { img.remove(); img = null }
    if (!cachedHillshadeUrl || cachedHillshadeMode !== mode) {
      cachedHillshadeUrl = hillshadeToDataURL(cachedShade, { mode })
      cachedHillshadeMode = mode
    }
    if (!img) {
      const ns = 'http://www.w3.org/2000/svg'
      img = document.createElementNS(ns, 'image')
      img.setAttribute('id', 'hillshade-layer')
      img.setAttribute('data-layer', 'hillshade')
      img.setAttribute('preserveAspectRatio', 'none')
      img.setAttribute('pointer-events', 'none')
      img.setAttribute('image-rendering', 'auto')
      // v10.1.2 perf: la nettleseren dekode relieff-PNG-en asynkront.
      img.setAttribute('decoding', 'async')
    }
    const insertBefore = reliefInsertBefore(svg)
    if (insertBefore) svg.insertBefore(img, insertBefore)
    else svg.appendChild(img)
    img.setAttribute('x', '0'); img.setAttribute('y', '0')
    img.setAttribute('width', String(meta.value.widthM))
    img.setAttribute('height', String(meta.value.heightM))
    img.setAttribute('href', cachedHillshadeUrl)
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', cachedHillshadeUrl)
    img.setAttribute('opacity', String(reliefOpacity.value))
    img.style.mixBlendMode = 'normal'
  }

  // Skarpt relieff (v11.0.44): diskrete tone-bånd som rene SVG-polygoner. Bånd-
  // geometrien bygges kun ved DEM-/tema-bytte (cachedBandsKey); knott-justering
  // endrer bare gruppe-opacityen — billig. Selve filstørrelses-vinningen: ~KB
  // vektor i stedet for multi-MB base64-PNG.
  function applyReliefVector(svg, mode) {
    const ns = 'http://www.w3.org/2000/svg'
    let g = svg.querySelector('#hillshade-layer')
    if (g && g.tagName.toLowerCase() !== 'g') { g.remove(); g = null }
    const key = `${mode}|${RELIEF_BANDS}`
    if (!g || cachedBandsKey !== key) {
      const bands = buildReliefBands(cachedShade, {
        bands: RELIEF_BANDS,
        blend: mode,
        widthM: meta.value.widthM,
        heightM: meta.value.heightM,
      })
      if (!g) {
        g = document.createElementNS(ns, 'g')
        g.setAttribute('id', 'hillshade-layer')
        g.setAttribute('data-layer', 'hillshade')
        g.setAttribute('pointer-events', 'none')
      }
      while (g.firstChild) g.removeChild(g.firstChild)
      for (const b of bands) {
        const p = document.createElementNS(ns, 'path')
        p.setAttribute('d', b.d)
        p.setAttribute('fill', b.fill)
        p.setAttribute('fill-rule', 'evenodd')
        p.setAttribute('fill-opacity', String(b.fillOpacity))
        g.appendChild(p)
      }
      cachedBandsKey = key
    }
    const insertBefore = reliefInsertBefore(svg)
    if (insertBefore) svg.insertBefore(g, insertBefore)
    else svg.appendChild(g)
    g.setAttribute('opacity', String(reliefOpacity.value))
  }

  async function applyHillshade() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || !meta.value) return
    // v9.1.13: knaus er nå malt inn i relieffet. Rydd vekk et evt. gammelt
    // separat knaus-lag fra tidligere klient-versjoner.
    svg.querySelector('#knaus-relief-layer')?.remove()
    const wantOn = reliefEnabled.value && reliefOpacity.value > 0
    if (!wantOn) { svg.querySelector('#hillshade-layer')?.remove(); return }
    // Lazy-last DEM hvis nødvendig — built-in Vardåsen fetcher fra Kartverket WCS
    await ensureDem()
    if (!storedDem.value) { svg.querySelector('#hillshade-layer')?.remove(); return }
    if (cachedHillshadeDem !== storedDem.value) {
      // v9.1.17: ren hillshade — relieffet skygger kun terreng.
      cachedShade = computeHillshade(storedDem.value)
      cachedHillshadeDem = storedDem.value
      cachedHillshadeUrl = null   // tving re-toning
      cachedBandsKey = null       // tving re-banding
    }
    const mode = reliefBlendMode()
    if (reliefMode.value === 'vektor') applyReliefVector(svg, mode)
    else applyReliefRaster(svg, mode)
  }

  return { applyHillshade, reliefBlendMode }
}
