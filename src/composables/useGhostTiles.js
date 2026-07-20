// Mosaikk / spøkelses-fliser — skilt ut fra MapView v1.0.8 (kode uendret,
// bortsett fra componentAlive → isAlive()-getter). Tidligere besøkte fliser
// tegnes som nabo-fliser i den aktive flisas meter-rom så man kan «scrolle
// tilbake». Composablen eier ghostRects + cachene; forelderen eier SVG-verten,
// relieff-innstillingene og lag-/pan-funksjonene (destrukturert inn).
import { ref } from 'vue'
import { listMaps as listStoredMaps, loadMap as loadStoredMap, deleteMap as deleteStoredMap } from '../lib/mapStorage.js'
import { tileIsCurrent } from '../lib/tileCache.js'
import { APP_VERSION } from '../version.js'
import { isomCatalog, buildIsomDefs, buildIsomCss } from '../lib/symbolizer.js'
import { unpackDem } from '../lib/demSampling.js'
import { computeHillshade, hillshadeToDataURL } from '../lib/hillshade.js'
import { buildReliefBands } from '../lib/reliefBands.js'
import { tileOffset, tilesAreGridCompatible } from '../lib/tileCache.js'

export function useGhostTiles({
  svgHostRef, meta, mapId, isAlive, isGesturing,
  reliefEnabled, reliefMode, reliefOpacity, reliefBlendMode, RELIEF_BANDS,
  applyLayerVisibility, clampPan,
}) {
  // ── Mosaikk / spøkelses-fliser (steg 2) ─────────────────────────────────────
  // Tidligere besøkte fliser tegnes som falmede nabo-fliser (kun bakgrunn + vann
  // + høydekurver) i den aktive flisas meter-rom, så man kan «scrolle tilbake».
  // ghostRects holder hver spøkelses-flis' rektangel (i aktiv-flis-koordinater)
  // → brukes av clampPan (mosaikk-utstrekning) og checkAutoMapTrigger (ikke bygg
  // nytt over en flis vi allerede har). Relieff på spøkelser kommer i steg 2b.
  const ghostRects = ref([])           // [{ id, x, y, w, h }]
  let ghostRenderToken = 0             // invaliderer pågående render ved navigasjon
  const GHOST_OPACITY = 1.0            // opake spøkelser: ingen dobbel-mørkning/bånd i overlapp-soner
  const GHOST_RENDER_RADIUS_TILES = 3  // hvor mange flis-bredder unna vi tegner
  const MAX_GHOSTS_RENDERED = 12       // tak på antall spøkelser i DOM samtidig
  const GHOST_TRIGGER_SUPPRESS_FRAC = 0.35  // overlapp-andel som undertrykker auto-kart
  // Cache for spøkelses-relieff (data-URL) nøklet på «tileId:blendMode» — DEM-en
  // per flis endrer seg ikke, så vi slipper å re-beregne hillshade ved scroll
  // frem/tilbake. Tømmes ikke (bundet av MAX_AUTO_TILES-fliser × 2 blend-modi).
  const ghostShadeCache = new Map()
  // Vektor-relieff-bånd pr spøkelses-flis (id:blend:bands → bånd-array). Egen cache
  // fordi d3-contour pr flis ikke er gratis; gjenbrukes ved scroll frem/tilbake.
  const ghostBandsCache = new Map()
  // Pattern-id-mappingen (navn → iso-pat-id) for å bygge supplerende ISOM-CSS for
  // spøkelses-fliser, se ensureGhostIsomStyles. Katalogen er statisk → regn én gang.
  const { patternIds: ghostPatternIds } = buildIsomDefs(isomCatalog)

  // Bygg ett spøkelse (nested <svg>) fra en lagret flis' SVG-tekst, plassert i den
  // aktive flisas meter-rom. Returnerer { el, rect } eller null (for langt unna /
  // ugyldig). Option A: FULL detalj — hele den lagrede flisa klones (vegetasjon,
  // veier, bygninger, vann, kurver) + relieff fra flisas DEM, så naboene ser ut
  // som ekte kart, ikke gråtone-relieff. Detaljer:
  //  • `data-iso` BEHOLDES (fyll/strek-farger er CSS-nøklet på den) — den aktive
  //    flisas <style> (samme katalog, scoped .isom-map) farger spøkelses-innholdet.
  //  • `data-layer` RENAVNES til `data-ghost-layer`: lag-toggling (applyLayerVisibility)
  //    når fortsatt spøkelsene (f.eks. «Tett bebyggelse» av/på), men `data-name`/
  //    `data-detail`-queries (navn-LOD, søkeindeks) og perf-regelen `[data-layer] path`
  //    (non-scaling-stroke) matcher dem IKKE — strekene blir skalerende og GPU-
  //    komposittert (ingen re-tessellering per frame under zoom).
  //  • `data-name`/`data-detail` STRIPPES helt.
  //  • Tekst (navn, kontur-/dybde-tall) FJERNES: unngår LOD-/upright-prosessering
  //    av spøkelses-labels og tett tekst-rot ved utzoom. Spøkelser er kontekst.
  function buildGhostSvg(stored, activeMeta) {
    const svgText = stored?.svg
    if (!svgText) return null
    let doc
    try { doc = new DOMParser().parseFromString(svgText, 'image/svg+xml') } catch { return null }
    const root = doc.documentElement
    if (!root || root.nodeName === 'parsererror' || root.querySelector('parsererror')) return null
    let gm
    try { gm = JSON.parse(root.getAttribute('data-meta')) } catch { return null }
    const ub = gm?.utmBbox
    const Wg = gm?.widthM, Hg = gm?.heightM
    if (!ub || !Wg || !Hg) return null
    // Kun fliser som deler aktiv-flisas størrelse OG gitter tegnes som spøkelser.
    // Ulik-bygde kart (innebygd demo, eldre brukerkart i annen størrelse) ville
    // ellers feiljusteres og «smelte sammen» i trappetrinn (rapportert v11.0.22).
    if (!tilesAreGridCompatible(
          { minE: activeMeta.minE, minN: activeMeta.minN, widthM: activeMeta.widthM, heightM: activeMeta.heightM },
          { minE: ub.minE, minN: ub.minN, widthM: Wg, heightM: Hg })) return null
    const off = tileOffset({ minE: activeMeta.minE, maxN: activeMeta.maxN }, { minE: ub.minE, maxN: ub.maxN })
    if (!off) return null
    // Rund offset til hele meter. Flisene er snappet til res-rutenettet (10/20/5 m)
    // så ekte nabo-offset ER et heltall; float-restfeil (~1e-9 m) i UTM-subtraksjon
    // ga ellers en sub-piksel-glipe ved flis-kanten. Rundingen lar kanter flukte
    // eksakt → ingen søm-strek mellom fliser (sammen med cream-viewport-basen).
    off.dx = Math.round(off.dx)
    off.dy = Math.round(off.dy)
    // Radius-gate i meter: ikke tegn fliser fra et helt annet område.
    if (Math.abs(off.dx) > GHOST_RENDER_RADIUS_TILES * activeMeta.widthM ||
        Math.abs(off.dy) > GHOST_RENDER_RADIUS_TILES * activeMeta.heightM) return null

    // Dyp-klon hele flisa (selvstendig: egne defs + <use>/mønster-referanser).
    const gsvg = root.cloneNode(true)
    gsvg.removeAttribute('data-meta')
    gsvg.querySelector('style')?.remove()          // bruk aktiv flis' <style>
    // v12.0.11: behold NAVN på spøkelses-/utvidelses-fliser (stedsnavn, vann-navn,
    // topp, område, hytte) så nybygde nabofliser viser navn UMIDDELBART — før var
    // all tekst strippet, så utvidede utsnitt sto blanke til en 5–10 s auto-bygging
    // gjorde dem aktive. Navnene styles av aktiv flis' delte <style> + arver
    // --land/water-font og zoom-LOD-klasser (CSS) fra aktiv SVG. De holdes UTENFOR
    // søkeindeksen og JS-tetthets-budsjettet (useMapSearch hopper over #ghost-tiles)
    // — spøkelser er nested <svg> med x/y-offset som declutter-mattematematikken ikke
    // håndterer, og de skal ikke gi doble søketreff. Rene tall-/detalj-labels fjernes
    // (kontur-/vann-/dybde-tall, skjult dem-topp) for å holde naboflisene rene.
    for (const det of gsvg.querySelectorAll(
      '[data-label="kontur-tall"], [data-label="vann-tall"], [data-label="dybde-tall"], [data-label="dem-topp"]'
    )) det.remove()
    gsvg.setAttribute('x', String(off.dx))
    gsvg.setAttribute('y', String(off.dy))
    gsvg.setAttribute('width', String(Wg))
    gsvg.setAttribute('height', String(Hg))
    gsvg.setAttribute('viewBox', `0 0 ${Wg} ${Hg}`)
    gsvg.setAttribute('preserveAspectRatio', 'none')  // 1:1 meter, ingen letterbox
    gsvg.setAttribute('class', 'isom-map')
    gsvg.setAttribute('opacity', String(GHOST_OPACITY))
    gsvg.setAttribute('pointer-events', 'none')
    gsvg.style.contain = 'paint'                    // perf-isolasjon (mister [data-layer]-containment)

    // Relieff fra flisas egen DEM, UNDER vann-laget (finn vann FØR data-layer
    // strippes) — samme hillshade-pipeline + blend-modus som aktiv flis. Hoppes
    // over når relieff er av (eller knotten på 0) → ingen hillshade-PNG genereres/
    // dekodes for spøkelser (sparer GPU/RAM). v11.0.51: relieff på ALLE fliser i
    // BEGGE moduser — brukerens relieff-preferanse gjelder hele kartet, ikke bare
    // aktiv flis. Mjuk = data-URL-<image>, vektor = bånd-<g> fra flisas DEM (cachet
    // pr flis). Begge merkes `data-ghost-relief` så gest-skjuling + opacity-knott
    // treffer dem.
    if (stored.dem && reliefEnabled.value && reliefOpacity.value > 0) {
      const ns = 'http://www.w3.org/2000/svg'
      const doc = gsvg.ownerDocument
      const vann = gsvg.querySelector('[data-layer="vann"]')
      const insert = (node) => { if (vann) gsvg.insertBefore(node, vann); else gsvg.appendChild(node) }
      const gesturing = isGesturing && isGesturing.value
      if (reliefMode.value === 'mjuk') {
        const url = ghostHillshadeUrl(stored)
        if (url) {
          const img = doc.createElementNS(ns, 'image')
          img.setAttribute('x', '0'); img.setAttribute('y', '0')
          img.setAttribute('width', String(Wg)); img.setAttribute('height', String(Hg))
          img.setAttribute('preserveAspectRatio', 'none')
          img.setAttribute('pointer-events', 'none')
          img.setAttribute('decoding', 'async')
          img.setAttribute('href', url)
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url)
          img.setAttribute('opacity', String(reliefOpacity.value))
          img.setAttribute('data-ghost-relief', '1')
          if (gesturing) img.style.visibility = 'hidden'
          insert(img)
        }
      } else {
        const bands = ghostReliefBands(stored, reliefBlendMode())
        if (bands && bands.length) {
          const g = doc.createElementNS(ns, 'g')
          g.setAttribute('data-ghost-relief', '1')
          g.setAttribute('pointer-events', 'none')
          g.setAttribute('opacity', String(reliefOpacity.value))
          for (const b of bands) {
            const p = doc.createElementNS(ns, 'path')
            p.setAttribute('d', b.d)
            p.setAttribute('fill', b.fill)
            p.setAttribute('fill-rule', 'evenodd')
            p.setAttribute('fill-opacity', String(b.fillOpacity))
            g.appendChild(p)
          }
          if (gesturing) g.style.visibility = 'hidden'
          insert(g)
        }
      }
    }

    // Renavn data-layer → data-ghost-layer (toggling når dem, perf-regelen ikke),
    // strip resten (behold data-iso for fyll-/strek-farger).
    for (const el of gsvg.querySelectorAll('[data-layer]')) {
      el.setAttribute('data-ghost-layer', el.getAttribute('data-layer'))
      el.removeAttribute('data-layer')
    }
    for (const el of gsvg.querySelectorAll('[data-name],[data-detail]')) {
      el.removeAttribute('data-name')
      el.removeAttribute('data-detail')
    }
    // Bakgrunns-rektangelet må følge tema-bytte. Vi stripper #bakgrunn-id-en (unngå
    // duplikat-id i DOM-en med aktiv flis), men da slutter aktiv-flisas CSS-regel
    // `.isom-map #bakgrunn rect { fill: var(--bg) }` å treffe spøkelsets bakgrunn →
    // den ble hengende på det inline LYSE default-fyllet (kremgul) også i mørkt/
    // Curves-tema, så nybygde utvidelses-fliser rendret lyse mens aktiv flis var
    // mørk (rapportert v11.0.x: «halvt mørkt, halvt kremgult kart»). Skriv fyllet om
    // til var(--bg, <inline default>) så det arver --bg fra mapInnerRef som aktiv flis.
    const ghostBg = gsvg.querySelector('#bakgrunn')
    if (ghostBg) {
      ghostBg.removeAttribute('id')
      const bgRect = ghostBg.querySelector('rect')
      if (bgRect) {
        const fallback = bgRect.getAttribute('fill') || isomCatalog.background.color
        bgRect.setAttribute('fill', `var(--bg, ${fallback})`)
      }
    }

    return { el: gsvg, rect: { x: off.dx, y: off.dy, w: Wg, h: Hg } }
  }

  // Oppdater opacity på spøkelses-relieffet live når relieff-knotten endres
  // (billig — ingen re-render / DEM-relast). href/blend-modus uendret.
  function updateGhostReliefOpacity() {
    const imgs = svgHostRef.value?.querySelector('svg #ghost-tiles')?.querySelectorAll('[data-ghost-relief]')
    if (!imgs) return
    for (const im of imgs) im.setAttribute('opacity', String(reliefOpacity.value))
  }

  // Hillshade-data-URL for en spøkelses-flis, fra flisas lagrede (pakkede) DEM.
  // Cachet på id:blendMode. Returnerer null ved manglende DEM / feil (flat fallback).
  function ghostHillshadeUrl(stored) {
    const mode = reliefBlendMode()
    const key = `${stored.id ?? stored.navn}:${mode}`
    const hit = ghostShadeCache.get(key)
    if (hit !== undefined) return hit
    let url = null
    try {
      const dem = unpackDem(stored.dem)
      if (dem) url = hillshadeToDataURL(computeHillshade(dem), { mode })
    } catch { url = null }
    ghostShadeCache.set(key, url)
    return url
  }

  // Vektor-relieff-bånd for en spøkelses-flis (v11.0.51). Cachet på id:blend:bands
  // (d3-contour pr flis er ikke gratis). Returnerer null/[] ved manglende DEM.
  function ghostReliefBands(stored, blend) {
    const key = `${stored.id ?? stored.navn}:${blend}:${RELIEF_BANDS}`
    const hit = ghostBandsCache.get(key)
    if (hit !== undefined) return hit
    let bands = null
    try {
      const dem = unpackDem(stored.dem)
      if (dem) {
        const sh = computeHillshade(dem)
        bands = buildReliefBands(sh, {
          bands: RELIEF_BANDS, blend, widthM: sh.widthM, heightM: sh.heightM,
        })
      }
    } catch { bands = null }
    ghostBandsCache.set(key, bands)
    return bands
  }

  // Tegn falmede nabo-fliser rundt den aktive. Asynkront + token-vaktet (avbrytes
  // hvis brukeren navigerer videre). Fail-safe: feil → ingen spøkelser, aktiv flis
  // uberørt. Kjøres etter at den aktive flisa er satt opp (også ved silent reload,
  // siden setupHostSvg tømmer DOM-en).
  async function renderGhostTiles() {
    const token = ++ghostRenderToken
    ghostRects.value = []
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m || m.minE == null) return
    svg.querySelector('#ghost-tiles')?.remove()

    let tiles
    try { tiles = await listStoredMaps() } catch { return }
    if (token !== ghostRenderToken || !isAlive()) return

    // Pre-filtrer på senter-avstand (grader) så vi ikke laster fjerne kart fra
    // andre regioner. Grov terskel basert på flis-bredde i grader.
    const activeCenter = m.bbox
      ? { lat: (m.bbox.south + m.bbox.north) / 2, lon: (m.bbox.west + m.bbox.east) / 2 }
      : null
    const radiusDeg = activeCenter
      ? (GHOST_RENDER_RADIUS_TILES + 1) * (m.widthM / 111320)
      : Infinity
    // Stale AUTO-fliser (bygd med annen app-versjon) er ubrukelige som cache:
    // gjenbruk serverte gamle data i «helt nye» kart. Usynliggjør dem her (så
    // de verken rendres, undertrykker nybygging eller kan promoteres) og rydd
    // dem fra IndexedDB i bakgrunnen. Brukerens egne kart røres aldri.
    for (const t of tiles) {
      if (t.isAuto && !tileIsCurrent(t, APP_VERSION)) {
        deleteStoredMap(t.id).catch(() => {})
      }
    }
    const cands = tiles
      .filter(t => tileIsCurrent(t, APP_VERSION))
      .filter(t => t.id !== mapId.value && t.center && (!activeCenter ||
        Math.abs(t.center.lat - activeCenter.lat) < radiusDeg))
      .map(t => ({ t, d: activeCenter ? Math.hypot(t.center.lat - activeCenter.lat, t.center.lon - activeCenter.lon) : 0 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_GHOSTS_RENDERED)
    if (!cands.length) return

    const ns = 'http://www.w3.org/2000/svg'
    const container = document.createElementNS(ns, 'g')
    container.setAttribute('id', 'ghost-tiles')
    container.setAttribute('pointer-events', 'none')
    // HELT BAK den aktive flisa (foran #bakgrunn): den aktive flisas opake
    // bakgrunn + innhold dekker spøkelsene fullstendig i sitt eget rektangel, så
    // spøkelser vises KUN utenfor aktiv flis — ingen gjennomslag i åpen mark og
    // ingen søm i overlapp-sonen (aktiv flis er autoritativ der). Trygt mht queries
    // siden data-layer er strippet fra spøkelser.
    const bg = svg.querySelector('#bakgrunn')
    if (bg) svg.insertBefore(container, bg)
    else svg.insertBefore(container, svg.firstChild)

    const rects = []
    for (const { t } of cands) {
      let stored
      try { stored = await loadStoredMap(t.id) } catch { continue }
      if (token !== ghostRenderToken || !isAlive()) { container.remove(); return }
      if (!stored?.svg) continue
      const ghost = buildGhostSvg(stored, m)
      if (!ghost) continue
      container.appendChild(ghost.el)
      rects.push({ id: t.id, isAuto: !!t.isAuto, ...ghost.rect })
    }
    if (token !== ghostRenderToken) { container.remove(); return }
    if (!rects.length) container.remove()
    ghostRects.value = rects
    if (rects.length) {
      // Sørg for at spøkelses-koder som den aktive flisa ikke selv bruker (og
      // derfor mangler i dens lazy CSS) får fyll-/strek-regler — ellers rendres de
      // svart. Deretter respekterer vi lag-toggling (f.eks. bymasse av) på dem.
      ensureGhostIsomStyles(svg, container)
      ensureGhostStrokeStyle(svg)
      applyLayerVisibility()
    }
    clampPan()   // utvid pan-grensa til mosaikken
  }

  // Gi spøkelses-strekene SAMME non-scaling-stroke som aktiv flis. Nyere kart har
  // regelen bakt inn i sin egen <style> (symbolizer.js), men eldre lagrede kart —
  // som kan være den AKTIVE flisa hvis spøkelsene farges av dens <style> — har den
  // ikke, så uten denne runtime-injeksjonen skalerer spøkelses-strekene med zoom og
  // blir tynnere enn originalen (rapportert v11.0.15). is-zooming-varianten bevarer
  // gest-perf (ingen re-tessellering per frame under pinch).
  function ensureGhostStrokeStyle(svg) {
    if (svg.querySelector('#ghost-stroke-style')) return
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    st.setAttribute('id', 'ghost-stroke-style')
    st.textContent =
      '.isom-map [data-ghost-layer] path{vector-effect:non-scaling-stroke}' +
      '.isom-map.is-zooming [data-ghost-layer] path{vector-effect:none}'
    svg.insertBefore(st, svg.firstChild)
  }

  // Den aktive flisas <style> er «lazy» (v9.1.10) — den emitterer kun ISOM-regler
  // for koder flisa SELV bruker. Spøkelses-nabofliser bruker aktiv-flisas <style>
  // til farging, så en kode et spøkelse har men aktiv-flisa mangler (f.eks. 522
  // tett bebyggelse i en by-nabo til en sjø-flis) får ingen fyll-regel → den
  // rendres med SVG-default svart fyll. Vi skanner spøkelses-kodene, finner de som
  // aktiv-stilen ikke dekker, og injiserer ett supplerende <style> med regler for
  // dem (fra GJELDENDE katalog → konsistente farger). Pattern-referansene
  // (url(#iso-pat-…)) resolves mot spøkelsenes egne <defs> som klones med flisa.
  function ensureGhostIsomStyles(svg, container) {
    const codes = new Set()
    for (const el of container.querySelectorAll('[data-iso]')) codes.add(el.getAttribute('data-iso'))
    if (!codes.size) return
    const activeCss = svg.querySelector('style')?.textContent ?? ''
    const missing = new Set([...codes].filter(c => !activeCss.includes(`[data-iso="${c}"]`)))
    if (!missing.size) return
    const css = buildIsomCss(isomCatalog, ghostPatternIds, { usedCodes: missing, widthM: meta.value?.widthM })
    let suppl = svg.querySelector('#ghost-isom-style')
    if (!suppl) {
      suppl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      suppl.setAttribute('id', 'ghost-isom-style')
      // Først i SVG-en → den aktive (autoritative) <style> kommer etter og vinner
      // på evt. delte boilerplate-regler; supplerende per-kode-regler står alene.
      svg.insertBefore(suppl, svg.firstChild)
    }
    suppl.textContent = css
  }

  return {
    ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC,
    renderGhostTiles, updateGhostReliefOpacity,
  }
}
