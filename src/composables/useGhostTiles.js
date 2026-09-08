// Mosaikk / spøkelses-fliser — skilt ut fra MapView v1.0.8. Tidligere besøkte
// fliser tegnes som nabo-fliser i den aktive flisas meter-rom så man kan
// «scrolle tilbake». Composablen eier ghostRects + cachene; forelderen eier
// SVG-verten, relieff-innstillingene og lag-/pan-funksjonene (destrukturert inn).
//
// ── INVARIANT (v5.19.0) — «flisa finnes» er IKKE «flisa er i DOM» ────────────
// `ghostRects` er GEOMETRIMODELLEN over alt vi har av gitter-kompatible naboer,
// og den filtreres ALDRI på om flisa er montert. Tre nivåer:
//
//   modell   `ghostRects`  — alle kjente naboer. Driver clampPan,
//                            extendZonesBounds, findGridGaps,
//                            centerOverExistingTile, use3dEntry, promoteTile,
//                            og «Kartdata»-tallet (byte for HELE arket).
//   node     `ghostNoder`  — parset <svg> i minnet. Tak MAX_GHOST_NODER.
//   festet   `festede`     — faktisk i #ghost-tiles. Utsnitts-drevet.
//
// Blander du dem, KRYMPER arket under føttene på brukeren i det en flis
// demonteres: pan-grensa strammes midt i et drag, kanthåndtakene rykker innover,
// og 3D mister deler av arket det nettopp fikk (v5.18.0). Alt som spør «har vi
// terreng her?» skal lese modellen; bare tegningen bryr seg om resten.
import { ref } from 'vue'
import { listMaps as listStoredMaps, loadMap as loadStoredMap, deleteMap as deleteStoredMap } from '../lib/mapStorage.js'
import { tileIsCurrent } from '../lib/tileCache.js'
import { APP_VERSION } from '../version.js'
import { isomCatalog, buildIsomDefs, buildIsomCss } from '../lib/symbolizer.js'
import { unpackDem } from '../lib/demSampling.js'
import { computeHillshade } from '../lib/hillshade.js'
import { buildReliefBands } from '../lib/reliefBands.js'
import { tileOffset, tilesAreGridCompatible } from '../lib/tileCache.js'
import { velgFestede, utvidRekt, manglendeNoder, fjernesteNode } from '../lib/ghostFeste.js'
import { viewRectSvg, expandRect, needsRecull } from '../lib/viewportCull.js'
import { logPerf } from '../lib/perfLog.js'

// Datamengden én flis koster. Meta-oppføringene fra listMaps() bærer `sizeBytes`
// ferdig regnet; en full entry (leggTilSpokelse laster hele posten) gjør det
// ikke, så den regnes med samme formel som projectMetaEntry (v6.5.72).
function flisBytes(e) {
  if (Number.isFinite(e?.sizeBytes)) return e.sizeBytes
  return (e?.svg?.length ?? 0) + (e?.dem?.buffer?.byteLength ?? 0)
}

export function useGhostTiles({
  svgHostRef, wrapperRef, meta, mapId, isAlive, isGesturing,
  scale, rotation, translateX, translateY,
  reliefEnabled, reliefOpacity, reliefBlendMode, RELIEF_BANDS,
  applyLayerVisibility, clampPan, maxTiles, onNaboFlisKlar, onFesteEndret,
}) {
  // ── Mosaikk / spøkelses-fliser ──────────────────────────────────────────────
  const ghostRects = ref([])           // modellen — se invarianten øverst
  let ghostRenderToken = 0             // invaliderer pågående render ved navigasjon
  const GHOST_OPACITY = 1.0            // opake spøkelser: ingen dobbel-mørkning/bånd i overlapp-soner
  const GHOST_RENDER_RADIUS_TILES = 3  // hvor mange flis-bredder unna vi modellerer
  // Tak på PARSEDE noder i minnet — GULVET, og budsjettet for den FØRSTE
  // parse-runden i renderGhostTiles. Selve taket er `flisTak()`: brukerens
  // «Maks kartfliser» (4–36), fordi et ark på 25 fliser som bare kan tegne 13
  // celler er et ark med halve innholdet borte (v6.5.74). Første runde står
  // fortsatt på tolv så en kart-last ikke betaler 24 sekvensielle multi-MB-
  // parser før første maling; resten fylles av feste-passet, i den rekkefølgen
  // utsnittet faktisk trenger dem.
  const MAX_GHOST_NODER = 12
  // Modell og noder deler tak. Fram til v6.5.74 var node-taket fast 12 mens
  // modellen fulgte maxTiles, og DA var invarianten øverst halvsann: modellen
  // speilet det som var bygd, men arket kunne ikke tegne det modellen påstod.
  const flisTak = () => Math.max(MAX_GHOST_NODER, maxTiles?.value ?? MAX_GHOST_NODER)
  const GHOST_TRIGGER_SUPPRESS_FRAC = 0.35  // overlapp-andel som undertrykker auto-kart
  // Hvor mange meter hver flis blør ut over cellen sin for å dekke søm-streken
  // mellom nabofliser (se buildGhostSvg). 0,5 m er 0,05 mm på trykk i 1:10 000 —
  // usynlig som overlapp, men mer enn nok til å dekke en enhetspiksel-kant ved
  // all realistisk zoom. Trygt fordi spøkelser er OPAKE (GHOST_OPACITY = 1).
  const GHOST_EDGE_BLEED_M = 0.5
  // Vektor-relieff-bånd pr spøkelses-flis (id:blend:bands → bånd-array). Egen cache
  // fordi d3-contour pr flis ikke er gratis; gjenbrukes ved scroll frem/tilbake.
  const ghostBandsCache = new Map()
  // Parsede noder: id → { el, stored, relieffPaa }. Å beholde noden gjør en
  // gjenfesting til en ren appendChild. Alternativet — re-parse fra IndexedDB —
  // er nøyaktig kostnaden budsjettet her går til å unngå (multi-MB DOMParser på
  // hovedtråden), og den kan ikke skje inne i et 120 ms debounce-vindu.
  const ghostNoder = new Map()
  let festede = new Set()              // id-ene som er i #ghost-tiles nå
  // Måling for Utvikler-fanen. De tre nivåene sto bare i perf-loggen, og et ark
  // som modellerte 25 fliser og tegnet 13 så ut som et kart med manglende data
  // (v6.5.74) — tallene ved siden av hverandre er hele diagnosen.
  const mosaikkStats = ref({ modellert: 0, noder: 0, festet: 0, tak: 0 })
  let festeState = null                // needsRecull-tilstand for feste-passet
  let festeTimer = null
  const FESTE_DEBOUNCE_MS = 120
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
    // den AKTIVE søkeindeksen og JS-tetthets-budsjettet (useMapSearch hopper over
    // #ghost-tiles) — spøkelser er nested <svg> med x/y-offset som declutter-
    // matematikken ikke håndterer. Fra v5.19.x leses de derimot av en EGEN
    // nabo-indeks (useMapSearch.buildNaboSearchIndex via lib/kartNavn), så søket
    // dekker hele arket uten at LOD-en ser dem. Rører du tekst-strippingen her,
    // blir naboflisene usøkbare. Rene tall-/detalj-labels fjernes
    // (kontur-/vann-/dybde-tall, skjult dem-topp) for å holde naboflisene rene.
    for (const det of gsvg.querySelectorAll(
      '[data-label="kontur-tall"], [data-label="vann-tall"], [data-label="dybde-tall"], [data-label="dem-topp"]'
    )) det.remove()
    // En nested <svg> ER en viewport og klipper innholdet sitt. To nabofliser
    // klipper på NØYAKTIG samme koordinat, og når den ytre transformen skalerer
    // med en ikke-heltallig faktor havner klippekanten midt i en enhetspiksel:
    // begge sider dekker den bare delvis, og igjen står en hårfin søm-strek
    // (v2.4.17). Vi lar derfor hver flis blø et halvmeters-hakk UT over cellen sin
    // — viewBox utvides like mye som viewporten, så 1 enhet = 1 meter fortsatt
    // (ingen skalering av innholdet), bare klippekanten flyttes utenfor skjøten,
    // der nabofliser overlapper i stedet for å møtes på en kant.
    const bleed = GHOST_EDGE_BLEED_M
    gsvg.setAttribute('x', String(off.dx - bleed))
    gsvg.setAttribute('y', String(off.dy - bleed))
    gsvg.setAttribute('width', String(Wg + 2 * bleed))
    gsvg.setAttribute('height', String(Hg + 2 * bleed))
    gsvg.setAttribute('viewBox', `${-bleed} ${-bleed} ${Wg + 2 * bleed} ${Hg + 2 * bleed}`)
    gsvg.setAttribute('preserveAspectRatio', 'none')  // 1:1 meter, ingen letterbox
    // Strekk flisas egen bakgrunn ut i blø-sonen. Uten dette ville sonen stått
    // TRANSPARENT, og da hjelper det ikke å flytte klippekanten: sømmen viste
    // fortsatt underlaget (kremgul viewport-base) som en lys strek gjennom vann
    // og skog, der flatene har sin egen farge og slutter presis på flis-kanten.
    const bgRect = gsvg.querySelector('#bakgrunn > rect')
    if (bgRect) {
      bgRect.setAttribute('x', String(-bleed))
      bgRect.setAttribute('y', String(-bleed))
      bgRect.setAttribute('width', String(Wg + 2 * bleed))
      bgRect.setAttribute('height', String(Hg + 2 * bleed))
    }
    gsvg.setAttribute('class', 'isom-map')
    // Flis-id på noden, så feste-passet og eksport-braketten finner den uten å
    // telle indekser i containeren.
    gsvg.setAttribute('data-ghost-id', String(stored.id ?? ''))
    gsvg.setAttribute('opacity', String(GHOST_OPACITY))
    gsvg.setAttribute('pointer-events', 'none')
    gsvg.style.contain = 'paint'                    // perf-isolasjon (mister [data-layer]-containment)

    // Relieffet lages IKKE her (v5.19.0). Det lå inne i denne løkka, synkront,
    // per flis — `unpackDem` + `computeHillshade` + enten en PNG-encoding eller
    // d3-contour, interleavet med opptil tolv `DOMParser`-kall på 1–5 MB. Det er
    // den dyreste posten i mosaikk-tegningen, og den ble betalt akkurat når en
    // ny flis skulle gli inn. Nå kjører `paaforGhostRelieff` som et eget
    // etterpå-pass, og at relieffet toner inn ER kvitteringen på at flisa er
    // ferdig (se planleggRelieffPass).

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

  // Flis-rektangel UTEN å parse SVG-en. Fra v5.19.0 bærer den lagrede posten
  // sin egen `utmBbox` (createMapFlow.buildEntry), og den følger med i den lette
  // meta-projeksjonen fra listMaps. Da kan mosaikken avgjøre gitter-kompatibilitet
  // og plassering for ALLE fliser uten å laste en eneste multi-MB streng — det er
  // dette som gjør at modellen kan være større enn nodesettet.
  // Eldre poster mangler feltet → null, og da faller vi tilbake til å parse.
  function rectFraLagretMeta(t, m) {
    const ub = t?.utmBbox
    if (!ub || ub.minE == null || ub.maxN == null) return null
    const Wg = Math.round(ub.maxE - ub.minE)
    const Hg = Math.round(ub.maxN - ub.minN)
    if (!(Wg > 0) || !(Hg > 0)) return null
    if (!tilesAreGridCompatible(
      { minE: m.minE, minN: m.minN, widthM: m.widthM, heightM: m.heightM },
      { minE: ub.minE, minN: ub.minN, widthM: Wg, heightM: Hg })) return null
    const off = tileOffset({ minE: m.minE, maxN: m.maxN }, { minE: ub.minE, maxN: ub.maxN })
    if (!off) return null
    const dx = Math.round(off.dx), dy = Math.round(off.dy)
    if (Math.abs(dx) > GHOST_RENDER_RADIUS_TILES * m.widthM ||
        Math.abs(dy) > GHOST_RENDER_RADIUS_TILES * m.heightM) return null
    return { x: dx, y: dy, w: Wg, h: Hg }
  }

  // Oppdater opacity på spøkelses-relieffet live når relieff-knotten endres
  // (billig — ingen re-render / DEM-relast). Går over NODENE, ikke over DOM-en:
  // en løsnet flis er ikke i #ghost-tiles, og ville ellers blitt hengende på et
  // gammelt nivå til den ble festet igjen.
  function updateGhostReliefOpacity() {
    for (const { el } of ghostNoder.values()) {
      for (const im of el.querySelectorAll('[data-ghost-relief]')) {
        im.setAttribute('opacity', String(reliefOpacity.value))
      }
    }
  }

  // ── Relieff-passet — nabofliser bruker ALLTID vektor (v5.19.0) ──────────────
  // Aktiv flis følger fortsatt brukerens `reliefMode`. Naboene gjør det ikke, og
  // det er et bevisst valg: raster-kostnaden er den ENESTE som skalerer med
  // flisetallet. Per flis koster mjuk, etter den felles hillshaden, en ny full
  // RGBA-buffer, en canvas-PNG-encoding, en base64-streng satt på TO attributter
  // (href + xlink:href), og en dekoding tilbake til en bitmap kompositoren må
  // holde. Vektor koster fem <path>. Den gamle data-URL-cachen ble dessuten
  // aldri tømt — den holdt base64 for opptil tolv fliser × to blend-modi i heap
  // så lenge komponenten levde.
  //
  // Kostnaden, ærlig: har brukeren aktivt valgt «Mjuk», får aktiv flis en
  // kontinuerlig gradient mens naboene har fem diskrete bånd. Båndalfaen speiler
  // shadeToToneRGBA-matematikken bånd for bånd (reliefBands.js), så intensiteten
  // stemmer — men trinnene er synlige ved skjøten. Det treffer bare brukere som
  // har valgt bort defaulten ('vektor'), og det treffer i arkkanten der fliser
  // uansett er ulike. Å flippe HELE kartet til vektor når mosaikken vokser ble
  // vurdert og forkastet: det overstyrer et valg brukeren har tatt eksplisitt.

  // Vektor-relieff-bånd for en spøkelses-flis. Cachet på id:blend:bands
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

  // Påfør relieffet på ÉN flis. `fade` = true bare for fliser som nettopp ble
  // bygd — da toner relieffet inn som kvittering. Ved tema-/relieff-bytte
  // re-rendres hele mosaikken, og tolv samtidige inntoninger ville vært et
  // lysshow, ikke et signal.
  //
  // Kjører ALLTID, også når relieff er av: da settes ingenting inn, men
  // klasse-vippen skjer likevel og `onNaboFlisKlar` fyrer. Kvitteringen er
  // FULLFØRINGEN av passet — relieffet er bare dens mest synlige uttrykk. Uten
  // det ville en bruker med relieff av aldri fått vite at flisa var ferdig.
  function paaforGhostRelieff(id, { fade = false } = {}) {
    const node = ghostNoder.get(id)
    if (!node || node.relieffPaa) return
    const gsvg = node.el
    node.relieffPaa = true
    const t0 = performance.now()
    let bandCount = 0
    if (node.stored?.dem && reliefEnabled.value && reliefOpacity.value > 0) {
      const bands = ghostReliefBands(node.stored, reliefBlendMode())
      if (bands && bands.length) {
        bandCount = bands.length
        const ns = 'http://www.w3.org/2000/svg'
        const doc = gsvg.ownerDocument
        const g = doc.createElementNS(ns, 'g')
        g.setAttribute('data-ghost-relief', '1')
        g.setAttribute('pointer-events', 'none')
        // opacity som ATTRIBUTT, ikke inline style. CSS-opacity vinner over
        // SVG-presentasjonsattributtet, og det er nettopp derfor attributtet kan
        // bære brukerens relieff-nivå mens klassen driver inntoningen — og
        // derfor updateGhostReliefOpacity ikke slåss med den. Skriver noen dette
        // om til style.opacity, brekker begge deler stille.
        g.setAttribute('opacity', String(reliefOpacity.value))
        for (const b of bands) {
          const p = doc.createElementNS(ns, 'path')
          p.setAttribute('d', b.d)
          p.setAttribute('fill', b.fill)
          p.setAttribute('fill-rule', 'evenodd')
          p.setAttribute('fill-opacity', String(b.fillOpacity))
          g.appendChild(p)
        }
        if (isGesturing && isGesturing.value) g.style.visibility = 'hidden'
        const vann = gsvg.querySelector('[data-ghost-layer="vann"]')
        if (vann) gsvg.insertBefore(g, vann)
        else gsvg.appendChild(g)
      }
    }
    if (fade) {
      // rAF før klassebyttet: settes begge i samme frame, får nettleseren aldri
      // sett start-tilstanden og transitionen hopper over.
      requestAnimationFrame(() => {
        gsvg.classList.add('gh-relieff-inn')
        gsvg.classList.remove('gh-relieff-vent')
        setTimeout(() => gsvg.classList.remove('gh-relieff-inn'), 500)
      })
    } else {
      gsvg.classList.remove('gh-relieff-vent')
    }
    logPerf(`[mosaikk] relieff ${id}: ${Math.round(performance.now() - t0)} ms, ${bandCount} bånd`)
    if (typeof onNaboFlisKlar === 'function') {
      onNaboFlisKlar(id, { medRelieff: bandCount > 0 })
    }
  }

  // Kø som tar én flis per ledige stund. Hopper helt over mens brukeren
  // gestikulerer — d3-contour på hovedtråden midt i en pinch er nøyaktig den
  // janken alt annet her går ut på å unngå.
  let relieffKo = []
  let relieffKjorer = false
  function planleggRelieffPass({ fade = false } = {}) {
    const token = ghostRenderToken
    const naa = [...ghostNoder.keys()].filter(id => !ghostNoder.get(id).relieffPaa)
    for (const id of naa) if (!relieffKo.includes(id)) relieffKo.push(id)
    if (relieffKjorer || !relieffKo.length) return
    relieffKjorer = true
    const idle = typeof requestIdleCallback === 'function'
      ? (fn) => requestIdleCallback(fn, { timeout: 3000 })
      : (fn) => setTimeout(fn, 200)
    const steg = () => {
      if (token !== ghostRenderToken || !isAlive()) { relieffKo = []; relieffKjorer = false; return }
      if (isGesturing && isGesturing.value) { idle(steg); return }
      const id = relieffKo.shift()
      if (id && ghostNoder.has(id)) paaforGhostRelieff(id, { fade })
      if (relieffKo.length) idle(steg)
      else relieffKjorer = false
    }
    idle(steg)
  }

  // Tegn falmede nabo-fliser rundt den aktive. Asynkront + token-vaktet (avbrytes
  // hvis brukeren navigerer videre). Fail-safe: feil → ingen spøkelser, aktiv flis
  // uberørt. Kjøres etter at den aktive flisa er satt opp (også ved silent reload,
  // siden setupHostSvg tømmer DOM-en).
  async function renderGhostTiles() {
    const token = ++ghostRenderToken
    ghostRects.value = []
    ghostNoder.clear()
    festede = new Set()
    festeState = null
    relieffKo = []
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
    const modellTak = flisTak()
    const cands = tiles
      .filter(t => tileIsCurrent(t, APP_VERSION))
      .filter(t => t.id !== mapId.value && t.center && (!activeCenter ||
        Math.abs(t.center.lat - activeCenter.lat) < radiusDeg))
      .map(t => ({ t, d: activeCenter ? Math.hypot(t.center.lat - activeCenter.lat, t.center.lon - activeCenter.lon) : 0 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, modellTak)
    if (!cands.length) return

    // ── Steg 1: MODELLEN, uten å parse noe ────────────────────────────────────
    // Fram til v5.19.0 var modell-taket det samme som DOM-taket (12), og det var
    // en latent feil: et 16-flisers ark rapporterte bare 12 fliser til
    // extendZonesBounds, så kanthåndtakene satt for langt inn, mosaicMinScale lot
    // deg ikke zoome ut til hele arket, og clampPan stoppet deg for tidlig. Nå
    // speiler modellen det som faktisk er bygd.
    const rects = []
    const uparsede = []
    for (const { t } of cands) {
      const rect = rectFraLagretMeta(t, m)
      if (rect) rects.push({ id: t.id, isAuto: !!t.isAuto, bytes: flisBytes(t), ...rect })
      else uparsede.push(t)   // eldre post uten utmBbox → må parses for å plasseres
    }

    const ns = 'http://www.w3.org/2000/svg'
    const container = finnEllerLagGhostContainer(svg)

    // ── Steg 2: NODENE, for de nærmeste ───────────────────────────────────────
    const tParse = performance.now()
    const skalParses = [
      ...uparsede,
      ...cands.map(c => c.t).filter(t => rects.some(r => r.id === t.id)),
    ].slice(0, MAX_GHOST_NODER)
    for (const t of skalParses) {
      let stored
      try { stored = await loadStoredMap(t.id) } catch { continue }
      if (token !== ghostRenderToken || !isAlive()) { container.remove(); return }
      if (!stored?.svg) continue
      const ghost = buildGhostSvg(stored, m)
      if (!ghost) continue
      ghostNoder.set(t.id, { el: ghost.el, stored, relieffPaa: false })
      // Eldre post uten utmBbox: nå VET vi rektangelet, så modellen kan fylles.
      if (!rects.some(r => r.id === t.id)) {
        rects.push({ id: t.id, isAuto: !!t.isAuto, bytes: flisBytes(t), ...ghost.rect })
      }
    }
    if (token !== ghostRenderToken) { container.remove(); return }
    if (!rects.length) { container.remove(); return }
    ghostRects.value = rects

    // ── Steg 3: FESTINGEN ─────────────────────────────────────────────────────
    anvendGhostFeste({ force: true })
    if (festede.size) {
      // Sørg for at spøkelses-koder som den aktive flisa ikke selv bruker (og
      // derfor mangler i dens lazy CSS) får fyll-/strek-regler — ellers rendres de
      // svart. MÅ kalles ETTER at nodene er festet: ensureGhostIsomStyles skanner
      // containeren for [data-iso], så koder i en ennå ikke-festet flis ville
      // ikke fått regler, og flatene ville rendret SVARTE.
      ensureGhostIsomStyles(svg, container)
      ensureGhostStrokeStyle(svg)
      applyLayerVisibility()
    }
    logPerf(`[mosaikk] render: ${Math.round(performance.now() - tParse)} ms parse, ` +
      `${rects.length} modellert, ${ghostNoder.size} noder, ${festede.size} festet`)
    oppdaterMosaikkStats()
    clampPan()   // utvid pan-grensa til mosaikken
    planleggRelieffPass({ fade: false })
  }

  // #ghost-tiles finnes ikke på et fersk 1×1-kart. Uten dette oppslaget fikk den
  // aller første bakgrunnsflisa stille ingen effekt.
  function finnEllerLagGhostContainer(svg) {
    let container = svg.querySelector('#ghost-tiles')
    if (container) return container
    const ns = 'http://www.w3.org/2000/svg'
    container = document.createElementNS(ns, 'g')
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
    return container
  }

  // ── Feste-passet — hvilke fliser skal faktisk ligge i DOM ───────────────────
  // Gevinsten er ikke rasterminne, den er FULLT-DOKUMENT-TRAVERSERINGENE:
  // applyLayerVisibility gjør 35 querySelectorAll over hele dokumentet, og
  // viewport-cullingen skanner hver festet flis én gang. En demontert flis er
  // usynlig for begge. (Fram til v6.5.72 gjorde useGestPerf det samme med en
  // inline strokeDasharray per path ved BÅDE start og slutt av hver gest; det er
  // nå én CSS-regel, så den posten er borte — men ringen rundt utsnittet er
  // fortsatt tolv fliser DOM som ingen ser på.)
  // Viewport-cullingen indekserer spøkelsene PER FLIS (v6.5.73), og den kan ikke
  // se en gjenfesting selv: dens egen watcher er registrert FØR denne composablen
  // i MapView, så i samme tikk kjører cull-passet før feste-passet og den nye
  // flisa ville stått ucullet til neste pan. Derfor varsler feste-siden.
  function varsleFesteEndret() {
    if (typeof onFesteEndret === 'function') onFesteEndret()
  }

  function anvendGhostFeste({ force = false } = {}) {
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    const wrap = wrapperRef?.value?.getBoundingClientRect()
    if (!svg || !m || !wrap?.width || !wrap?.height) return
    if (!ghostRects.value.length) return
    const view = viewRectSvg({
      w: wrap.width, h: wrap.height, widthM: m.widthM, heightM: m.heightM,
      scale: scale?.value ?? 1, rotation: rotation?.value ?? 0,
      tx: translateX?.value ?? 0, ty: translateY?.value ?? 0,
    })
    if (!view) return
    if (!force && !needsRecull(festeState, view, scale?.value ?? 1)) return
    // Feste-rekt = utsnittet + én flis i hver retning («nærmeste ring»).
    // Løsne-rekt = feste-rekt + en halv flis til. To rektangler gir hysterese:
    // en flis på grensa flakser ikke inn og ut mens brukeren dirrer på fingeren.
    const festeRekt = utvidRekt(expandRect(view), m.widthM, m.heightM)
    const losneRekt = utvidRekt(festeRekt, m.widthM / 2, m.heightM / 2)
    const modell = ghostRects.value.filter(r => ghostNoder.has(r.id))
    const { fest, losne, festede: nye } = velgFestede(modell, {
      festeRekt, losneRekt, forrigeFestede: festede,
    })
    if (fest.length || losne.length) {
      const container = finnEllerLagGhostContainer(svg)
      for (const id of losne) ghostNoder.get(id)?.el.remove()
      for (const id of fest) {
        const node = ghostNoder.get(id)
        if (node) container.appendChild(node.el)
      }
      if (fest.length) applyLayerVisibility()
      varsleFesteEndret()
    }
    festede = nye
    festeState = { viewRect: view, expandedRect: festeRekt, scale: scale?.value ?? 1 }
    oppdaterMosaikkStats()
    void fyllManglendeNoder(festeRekt)
  }

  // Parse modell-fliser som utsnittet trenger men som ikke har node ennå.
  // Progressiv med vilje: hver flis er en multi-MB DOMParser på hovedtråden, så
  // vi tar dem én om gangen, nærmest utsnittet først, og lar IndexedDB-awaiten
  // mellom dem slippe fram et bilde. Taket er `flisTak()` — er det nådd, står de
  // fjerneste igjen uten node, og DET er ærlig: brukeren har satt grensa selv.
  let fyllerNoder = false
  async function fyllManglendeNoder(festeRekt) {
    if (fyllerNoder || !festeRekt) return
    if (isGesturing?.value) return
    const m = meta.value
    const svg = svgHostRef.value?.querySelector('svg')
    if (!m || m.minE == null || !svg) return
    const ids = manglendeNoder(ghostRects.value, {
      festeRekt,
      harNode: (id) => ghostNoder.has(id),
      senter: utsnittSenter(),
      ledige: Math.max(0, flisTak() - ghostNoder.size),
    })
    if (!ids.length) return
    fyllerNoder = true
    const token = ghostRenderToken
    const t0 = performance.now()
    let nye = 0
    try {
      for (const id of ids) {
        let stored
        try { stored = await loadStoredMap(id) } catch { continue }
        // Token-vakt: en full renderGhostTiles mens vi ventet på IndexedDB har
        // revet containeren, og noden ville hørt hjemme i et opphevet ark.
        if (token !== ghostRenderToken || !isAlive()) return
        if (!stored?.svg) continue
        const ghost = buildGhostSvg(stored, m)
        if (!ghost) continue
        ghost.el.classList.add('gh-relieff-vent')
        ghostNoder.set(id, { el: ghost.el, stored, relieffPaa: false })
        nye++
      }
      if (!nye || token !== ghostRenderToken || !isAlive()) return
      // Feste-passet gjør innsettingen, så hysteresen og utsnittet bestemmer hva
      // som faktisk havner i DOM — panorerte brukeren videre mens vi parset, blir
      // den nye noden stående i minnet uten å bli festet. Kallet står INNENFOR
      // `fyllerNoder`: halen av anvendGhostFeste kaller hit igjen, og en runde vi
      // selv utløste skal ikke starte en ny.
      anvendGhostFeste({ force: true })
      // ETTER innsettingen: ensureGhostIsomStyles skanner containeren for
      // [data-iso], og en kode bare den nye flisa har rendres SVART uten regel.
      const container = finnEllerLagGhostContainer(svg)
      ensureGhostIsomStyles(svg, container)
      ensureGhostStrokeStyle(svg)
      logPerf(`[mosaikk] fylte ${nye} node${nye === 1 ? '' : 'r'} for utsnittet: ` +
        `${Math.round(performance.now() - t0)} ms, ${ghostNoder.size}/${flisTak()} noder`)
      planleggRelieffPass({ fade: true })
    } finally {
      fyllerNoder = false
    }
  }

  function scheduleGhostFeste() {
    if (festeTimer) clearTimeout(festeTimer)
    festeTimer = setTimeout(() => {
      // Aldri midt i en gest: å demontere under brukerens finger er en paint- og
      // layout-invalidering på verst tenkelige tidspunkt. Gest-slutt-watcheren i
      // MapView tar den i stedet, som viewport-culleren gjør.
      if (!(isGesturing && isGesturing.value)) anvendGhostFeste()
    }, FESTE_DEBOUNCE_MS)
  }

  // ── Gjenfestings-vinduet ────────────────────────────────────────────────────
  // Fem konsumenter leser geometri eller navn rett ut av den LEVENDE kart-SVG-en,
  // og en løsnet flis er usynlig for dem: mapSvgTilesFor3d, tour3d/exploreData,
  // useStifinner.featuresFromSvg, navne-lesingen i 3D og kartsøkets nabo-indeks
  // (useKartSok.rebuildNaboIndeks). De må gå gjennom en av disse. `finally`
  // gjenoppretter NØYAKTIG forrige feste-sett — aldri «fest alt».
  function medAlleSpokelserFestet(fn) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || !ghostNoder.size) return fn()
    const for_ = new Set(festede)
    const container = finnEllerLagGhostContainer(svg)
    for (const [id, node] of ghostNoder) if (!for_.has(id)) container.appendChild(node.el)
    try {
      return fn()
    } finally {
      for (const [id, node] of ghostNoder) if (!for_.has(id)) node.el.remove()
      festede = for_
    }
  }

  async function medAlleSpokelserFestetAsync(fn) {
    const m = meta.value
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || !m) return fn()
    // Modell-oppføringer uten node (utenfor node-taket) må parses først — 3D og
    // eksport skal dekke HELE arket, ikke bare det som tilfeldigvis var i
    // minnet. Taket brytes med vilje her: neste leggTilSpokelse trimmer igjen.
    const manglerNode = ghostRects.value.filter(r => !ghostNoder.has(r.id))
    for (const r of manglerNode) {
      let stored
      try { stored = await loadStoredMap(r.id) } catch { continue }
      if (!stored?.svg) continue
      const ghost = buildGhostSvg(stored, m)
      if (!ghost) continue
      ghostNoder.set(r.id, { el: ghost.el, stored, relieffPaa: false })
      paaforGhostRelieff(r.id, { fade: false })
    }
    oppdaterMosaikkStats()
    return medAlleSpokelserFestet(fn)
  }

  // Legg til ÉN nybygd flis uten å rive mosaikken. Motstykket til
  // renderGhostTiles, som river #ghost-tiles og bygger alt på nytt med opptil
  // tolv sekvensielle multi-MB-parser — helt feil pris for én ny nabo.
  //
  // Returnerer true hvis flisa faktisk kom inn.
  async function leggTilSpokelse(tileId) {
    const token = ghostRenderToken
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svg || !m || m.minE == null || !tileId) return false
    if (ghostNoder.has(tileId)) return false
    const t0 = performance.now()
    let stored
    try { stored = await loadStoredMap(tileId) } catch { return false }
    // Token-vakt: en full renderGhostTiles kan ha startet mens vi ventet på
    // IndexedDB, og da hører denne noden hjemme i en container som alt er revet.
    if (token !== ghostRenderToken || !isAlive() || !stored?.svg) return false
    const ghost = buildGhostSvg(stored, m)
    if (!ghost) return false
    // Vent-klassen settes FØR innsetting, så relieffet aldri vises på full
    // styrke i én frame før inntoningen tar over.
    ghost.el.classList.add('gh-relieff-vent')
    const container = finnEllerLagGhostContainer(svg)
    container.appendChild(ghost.el)
    ghostNoder.set(tileId, { el: ghost.el, stored, relieffPaa: false })
    festede.add(tileId)
    ghostRects.value = [
      ...ghostRects.value.filter(r => r.id !== tileId),
      { id: tileId, isAuto: !!stored.isAuto, bytes: flisBytes(stored), ...ghost.rect },
    ]
    // ETTER appendChild: ensureGhostIsomStyles skanner containeren for [data-iso]
    // og skriver et supplerende stilark. Kalles den før, mangler den nye flisas
    // koder — og flatene rendres SVARTE. Rekkefølgen er ikke valgfri.
    ensureGhostIsomStyles(svg, container)
    ensureGhostStrokeStyle(svg)
    applyLayerVisibility()
    clampPan()
    varsleFesteEndret()
    // Node-taket: slipp den fjerneste noden vi ikke trenger. Aldri den vi nettopp
    // la til, og aldri en som er festet i utsnittet nå.
    if (ghostNoder.size > flisTak()) slippFjernesteNode(tileId)
    oppdaterMosaikkStats()
    logPerf(`[mosaikk] flis inn ${tileId}: ${Math.round(performance.now() - t0)} ms, ` +
      `${ghostNoder.size} noder, ${festede.size} festet`)
    planleggRelieffPass({ fade: true })
    return true
  }

  // Modellen beholder flisa (den er fortsatt bygd terreng) — bare den parsede
  // noden slippes. Kommer brukeren tilbake, går gjenfestingen via
  // leggTilSpokelse og betaler parsen på nytt. Verste fall er dagens kostnad.
  function slippFjernesteNode(beskyttId) {
    const offer = fjernesteNode(ghostNoder.keys(), {
      modell: ghostRects.value, festede, beskyttId, senter: utsnittSenter(),
    })
    if (!offer) return
    ghostNoder.get(offer)?.el.remove()
    ghostNoder.delete(offer)
    festede.delete(offer)
  }

  function oppdaterMosaikkStats() {
    mosaikkStats.value = {
      modellert: ghostRects.value.length,
      noder: ghostNoder.size,
      festet: festede.size,
      tak: flisTak(),
    }
  }

  // Utsnittets senter i aktiv flis' meter-rom, fra siste feste-pass. Null før
  // det første — da faller fjernesteNode tilbake på beskyttet flis.
  function utsnittSenter() {
    const v = festeState?.viewRect
    if (!v) return null
    return { x: (v.minX + v.maxX) / 2, y: (v.minY + v.maxY) / 2 }
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

  function teardownGhostTiles() {
    if (festeTimer) clearTimeout(festeTimer)
    relieffKo = []
  }

  return {
    ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC, mosaikkStats,
    renderGhostTiles, updateGhostReliefOpacity,
    leggTilSpokelse, scheduleGhostFeste, anvendGhostFeste,
    medAlleSpokelserFestet, medAlleSpokelserFestetAsync,
    teardownGhostTiles,
  }
}
