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
    mapSvgMarkupForExport, exporting,
    onExportSvg, onExportPng, onExportPdf, onPrint,
  }
}
