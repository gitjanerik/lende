// Eksport og print: SVG, PNG (300 dpi), PDF og nettleser-print.
//
// Trukket ut av MapView.vue i v5.12.0. Selve filskrivingen bor i
// lib/printExport.js; her står markup-byggingen — og den er delikat nok til å
// fortjene en egen fil:
//
//   • Eksport = det OPPRINNELIGE kartet (én print-tilpasset flis), ikke
//     mosaikken. Spøkelses-nabofliser klippes bort før serialisering.
//   • Temaet BAKES inn i klonen. 3D-vieweren ber om 'dark' uansett hva 2D
//     viser, og kolofonen droppes der (linjal og målestokk skal ikke drapes
//     over terrenget).
//   • `extent` (utvidet 3D-tur) beholder nabo-flisene og utvider viewBoxen. Da
//     må width/height settes i PIKSLER med nytt aspekt — print-mm-attributtene
//     har flisas gamle aspekt og ville letterboxe rasteret, som gir UV-feil i 3D.
//
// Alt går gjennom `runExport`, som holder én busy-tilstand så to samtidige
// eksporter ikke kan tråkke på hverandre.

import { ref, nextTick } from 'vue'
import { printDocument, exportSvgFile, exportPngFile, exportPdfFile } from '../lib/printExport.js'
import { buildThemeCss, themeVarEntries } from '../lib/mapSettingsApply.js'
import isomCatalog from '../lib/isomCatalog.json'
import { withColophon } from '../lib/mapColophon.js'

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, meta: import('vue').Ref,
 *   mapTitle: import('vue').Ref, currentTheme: import('vue').Ref,
 *   autoMapToast: import('vue').Ref,   // deles med useMapExtend (feilmelding)
 *   hooks: {
 *     applyUprightLabels: (kartRotDeg?: number) => void,
 *   },
 * }} deps
 */
export function useKartEksport({ svgHostRef, meta, mapTitle, currentTheme, autoMapToast, hooks }) {
  // Print- / eksport-handlers. 3D-vieweren gjenbruker samme markup som
  // eksporten (tema baket inn) men uten kolofon — linjal/målestokk skal ikke
  // drapes på terrenget. `theme` overstyrer gjeldende tema (3D-nattmodus baker
  // 'dark'-temaet uansett 2D-valg). `extent` (utvidet tur, se tourExtent.js)
  // beholder nabo-flisene og utvider viewBoxen så teksturen dekker hele turen.
  function mapSvgMarkupForExport({ colophon = true, theme = null, extent = null } = {}) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return ''
    // Eksport/print = det OPPRINNELIGE kartet (én A-format-flis), ikke mosaikken.
    // Klon og fjern spøkelses-naboflisene (#ghost-tiles) før serialisering så
    // utskriften blir det print-tilpassede utsnittet brukeren genererte — med
    // viewBox/print-mm fra den aktive flisa alene. (user-layer m.fl. strippes av
    // printExport.stripRuntimeOverlays.)
    //
    // Labels må rettes opp FØR kloningen: på skjermen counter-roteres de så de
    // står vannrett mens kartet er rotert, men den eksporterte SVG-en er alltid
    // nord-opp (rotasjonen bor på wrapper-diven). Uten dette fulgte
    // counter-rotasjonen med ut og la alle navn skjevt på et rett kart. Begge
    // kallene er synkrone med kloningen imellom, så nettleseren rekker aldri å
    // tegne mellomtilstanden.
    hooks.applyUprightLabels(0)
    const clone = svg.cloneNode(true)
    hooks.applyUprightLabels()      // tilbake til brukerens rotasjon
    // Stjernemerke-ringene er en SKJERM-affordanse (pulsen bor i app-CSS, ikke
    // i kartets stilark). En fil, et ark eller 3D-teksturen har ingen animasjon
    // å vise, og tre stillestående sirkler utenpå hverandre leses som en feil i
    // kartet — ikke som «dette minnet har jeg merket».
    for (const r of clone.querySelectorAll('.stjerne-ring')) r.remove()
    if (extent) {
      // Utvidet 3D-tur: behold nabo-flisene og utvid viewBoxen til union-
      // utsnittet. width/height settes i px med nytt aspekt — print-mm-attrs
      // har flisas gamle aspekt og ville letterboxe rasteret (UV-feil i 3D).
      clone.setAttribute('viewBox', `${extent.minX} ${extent.minY} ${extent.widthM} ${extent.heightM}`)
      const k = Math.min(1, 3000 / Math.max(extent.widthM, extent.heightM))
      clone.setAttribute('width', String(Math.round(extent.widthM * k)))
      clone.setAttribute('height', String(Math.round(extent.heightM * k)))
    } else {
      clone.querySelector('#ghost-tiles')?.remove()
    }
    // Temaet lever som CSS-variabler på mapInnerRef og bakgrunnsfarge på
    // wrapperRef — begge UTENFOR <svg>, så en ren klone falt tilbake på
    // symbolizerens lyse ISOM-defaults uansett valgt tema. Bak derfor temaet inn
    // i klonen: variablene som en <style>, pluss et bakgrunns-rect bakerst.
    // Rect-et er redundant for kart bygget med dagens symbolizer (som har
    // `#bakgrunn rect { fill: var(--bg, …) }`), men dekker eldre lagrede kart
    // uten den regelen. Sti-farger og strek-overstyringer ligger allerede inne i
    // SVG-en og følger med av seg selv.
    const themeKey = theme ?? currentTheme.value
    const themeCss = buildThemeCss(themeKey)
    const bg = isomCatalog.themes?.[themeKey]?.background
    if (bg) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      // %-verdier posisjonerer fra (0,0) — et extent-viewBox starter på minX/minY,
      // så bakgrunnen må settes i absolutte koordinater der.
      rect.setAttribute('x', String(extent?.minX ?? 0))
      rect.setAttribute('y', String(extent?.minY ?? 0))
      rect.setAttribute('width', extent ? String(extent.widthM) : '100%')
      rect.setAttribute('height', extent ? String(extent.heightM) : '100%')
      rect.setAttribute('fill', bg)
      clone.insertBefore(rect, clone.firstChild)
    }
    if (themeCss) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.setAttribute('id', 'tema-eksport')
      style.textContent = themeCss
      clone.appendChild(style)
    }
    // Kolofon nederst til venstre (v2.4.20): linjal, målestokk, ekvidistanse og
    // «Så i lende · <kart> · <dato>». Ligger HER, i den delte eksport-markupen,
    // så alle fire utgangene (SVG/PNG/PDF/print) får den — en fil eller et ark
    // har ingen app rundt seg til å vise tallene.
    if (!colophon) return clone.outerHTML
    return withColophon(clone.outerHTML, { meta: meta.value, title: mapTitle.value })
  }

  // ── Kartfliser til 3D-teksturen ────────────────────────────────────────────
  // 3D drapererer kartet over terrenget ved å rasterisere det. Fram til v5.18.1
  // fikk motoren HELE arket som én SVG-streng; det brakk ved ni fliser (bildet
  // lastet ikke, og terrenget fikk gråtone-fallbacken). Nå leverer vi flisene
  // hver for seg, med ruta hver av dem dekker, og motoren dekoder og tegner dem
  // én om gangen.
  //
  // Naboflisene ligger i DOM-en som nestede <svg x y> UTEN eget stilark
  // (useGhostTiles fjerner det med vilje, så de farges av aktiv flis). Løsrevet
  // fra arket må de derfor få stilarkene med seg, ellers rendres de svarte.

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const XLINK_NS = 'http://www.w3.org/1999/xlink'

  function bakeTile(el, { css, bg, viewBox }) {
    el.setAttribute('xmlns', SVG_NS)
    el.setAttribute('xmlns:xlink', XLINK_NS)
    el.removeAttribute('x')
    el.removeAttribute('y')
    if (bg && viewBox) {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(viewBox[0]))
      rect.setAttribute('y', String(viewBox[1]))
      rect.setAttribute('width', String(viewBox[2]))
      rect.setAttribute('height', String(viewBox[3]))
      rect.setAttribute('fill', bg)
      el.insertBefore(rect, el.firstChild)
    }
    if (css) {
      const style = document.createElementNS(SVG_NS, 'style')
      style.textContent = css
      el.appendChild(style)
    }
    return el.outerHTML
  }

  /**
   * @param {{theme?: string|null,
   *          extent?: {minX:number, minY:number, widthM:number, heightM:number}|null}} [opts]
   * @returns {null | {tiles: Array<{svg:string, x:number, y:number, w:number, h:number}>,
   *                   widthM:number, heightM:number, background:string}}
   *   x/y/w/h i meter, forskjøvet inn i utsnittets eget rom (0 … widthM).
   */
  function mapSvgTilesFor3d({ theme = null, extent = null } = {}) {
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m) return null

    // Samme grunn som i eksporten: labelene counter-roteres på skjermen, og den
    // rotasjonen skal ikke følge med inn i teksturen.
    hooks.applyUprightLabels(0)
    const clone = svg.cloneNode(true)
    hooks.applyUprightLabels()
    // Samme grunn som i eksporten over: ringen er en skjerm-affordanse.
    for (const r of clone.querySelectorAll('.stjerne-ring')) r.remove()

    const themeKey = theme ?? currentTheme.value
    const themeCss = buildThemeCss(themeKey)
    const bg = isomCatalog.themes?.[themeKey]?.background ?? isomCatalog.background.color
    // Aktiv flis' stilark, inkludert supplementene naboflisene trenger
    // (#ghost-isom-style for koder aktiv flis ikke selv bruker, #ghost-stroke-style).
    const delteStiler = [...clone.children]
      .filter((c) => (c.tagName ?? '').toLowerCase() === 'style')
      .map((s) => s.textContent ?? '').join('\n')

    const ghostHost = clone.querySelector('#ghost-tiles')
    const ghosts = ghostHost
      ? [...ghostHost.children].filter((e) => e.tagName?.toLowerCase() === 'svg')
      : []
    ghostHost?.remove()

    const minX = extent?.minX ?? 0
    const minY = extent?.minY ?? 0
    const tiles = [{
      svg: bakeTile(clone, { css: themeCss, bg, viewBox: [0, 0, m.widthM, m.heightM] }),
      x: -minX, y: -minY, w: m.widthM, h: m.heightM,
    }]
    for (const g of ghosts) {
      const x = parseFloat(g.getAttribute('x')) || 0
      const y = parseFloat(g.getAttribute('y')) || 0
      const w = parseFloat(g.getAttribute('width')) || m.widthM
      const h = parseFloat(g.getAttribute('height')) || m.heightM
      // Naboflisas viewBox har et halvmeters blø-hakk rundt cellen (søm-dekning),
      // og x/y/width/height følger det — så ruta her er den bledde ruta, og
      // naboer overlapper hverandre litt i stedet for å møtes på en kant.
      const vb = (g.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
      tiles.push({
        svg: bakeTile(g, {
          css: `${delteStiler}\n${themeCss}`,
          bg,
          viewBox: vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, w, h],
        }),
        x: x - minX, y: y - minY, w, h,
      })
    }
    return {
      tiles,
      widthM: extent?.widthM ?? m.widthM,
      heightM: extent?.heightM ?? m.heightM,
      background: bg,
    }
  }
  // Hvilken eksport som kjører nå ('' | 'svg' | 'png' | 'pdf' | 'print'). Brukes
  // til å vise spinner på den aktive knappen og deaktivere de andre — PNG/PDF
  // bruker noen sekunder (canvas-render + lazy jsPDF), så uten dette virket appen
  // «død» mellom trykk og nedlasting. nextTick før det tunge arbeidet så spinneren
  // rekker å males (gjelder også den synkrone SVG-blob-en).
  const exporting = ref('')
  const filenameBase = () => mapTitle.value.replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase()
  async function runExport(type, fn) {
    if (exporting.value) return
    // Vi rører IKKE brukerens visning. v5.16.0 nullstilte rotasjonen her, og det
    // virket, men eieren foretrakk at zoom, rotasjon og utsnitt står som de var
    // — man har gjerne lagt kartet til rette nettopp slik man vil ha det. Fila
    // blir nord-opp uansett (rotasjonen bor på wrapper-diven, ikke på SVG-en), og
    // labelene rettes opp i klonen av mapSvgMarkupForExport.
    const m = mapSvgMarkupForExport()
    if (!m) return
    exporting.value = type
    try {
      await nextTick()
      await fn(m)
    } catch (e) {
      console.error('Eksport feilet:', e)
      autoMapToast.value = 'Eksport feilet — prøv igjen'
      setTimeout(() => { if (autoMapToast.value.startsWith('Eksport')) autoMapToast.value = '' }, 3000)
    } finally {
      exporting.value = ''
    }
  }
  function onExportSvg() {
    runExport('svg', (m) => exportSvgFile(m, `${filenameBase()}.svg`))
  }
  function onExportPng() {
    runExport('png', (m) => exportPngFile(m, `${filenameBase()}.png`, { dpi: 300 }))
  }
  function onExportPdf() {
    runExport('pdf', (m) => exportPdfFile(m, `${filenameBase()}.pdf`, { dpi: 300 }))
  }
  function onPrint() {
    runExport('print', (m) => printDocument(m, { title: mapTitle.value }))
  }

  return {
    mapSvgMarkupForExport, mapSvgTilesFor3d, exporting,
    onExportSvg, onExportPng, onExportPdf, onPrint,
  }
}
