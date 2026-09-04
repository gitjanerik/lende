// Kart-laste-pipelinen — skilt ut fra MapView v1.0.10 (kode uendret, bortsett
// fra componentAlive → isAlive()-getter). Den sentrale orkestreringen:
// fetchBuiltinSvg (retry/cache-bust), loadMap (parse → meta → init-prefs →
// apply/render-passene → promote/restore-panning → ghost-fliser → terreng-
// finalize), consumeTerrainFinalize/retryMapDetails, scheduleDeferredMapPasses,
// reveal-animasjonen og setupHostSvg (DOM-adopsjon, detach av detalj-lag,
// user-layer, trails-deteksjon). Forelderen eier all tilstand og alle
// render-funksjonene — alt destrukturert inn fra ett deps-objekt,
// funksjonskroppene urørt.
import { nextTick } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { unpackDem } from '../lib/demSampling.js'
import { dekningsSkala } from '../lib/viewFit.js'
import { buildMapFromCenter, consumeMapFinalize } from '../lib/createMapFlow.js'
import { loadMap as loadStoredMap, deleteMap as deleteStoredMap } from '../lib/mapStorage.js'
import { logPerf } from '../lib/perfLog.js'
import { APP_VERSION } from '../version.js'
import { byggVertSvg } from '../lib/kartVert.js'

// Meta-felter fra buildSvg som med VILJE ikke løftes inn i MapViews meta:
// enten fordi de pakkes ut til egne felter (utmBbox → minE/minN/maxE/maxN),
// eller fordi de bare er byggetids-diagnostikk uten konsument i visningen.
// Står et felt her, er utelatelsen et valg — ikke en forglemmelse.
export const META_BEVISST_UTELATT = Object.freeze([
  'utmBbox',        // pakkes ut til minE/minN/maxE/maxN
  'elevationRange', // høydespenn fra DEM-en; ingen konsument i visningen
  'generated',      // byggetidsstempel, kun til feilsøking i rå-SVG-en
  'lakeLabels',     // internt tall fra navne-plasseringen
])

/**
 * SVG-ens `data-meta` → MapViews meta-objekt.
 *
 * ADVARSEL — dette er en HVITELISTE, og den har bitt oss tre ganger: den
 * strippet `appVersion` og `nveInnsjoStatus` da de ble innført (v1.0.45/47),
 * og `turruteStatus` da Turrutebasen kom (v5.0.2). Symptomet er alltid det
 * samme og ser ut som et databaseproblem, ikke en kodefeil: Utvikler-fanen
 * viser «ingen status» / «bygd med eldre versjon» på ALLE kart, også splitter
 * ferske. Legger du et nytt felt i buildSvg sin meta, MÅ det inn her — eller
 * i META_BEVISST_UTELATT hvis det ikke skal videre. Testen håndhever det.
 */
export function metaFromSvgMeta(m) {
  return {
    minE: m.utmBbox.minE,
    minN: m.utmBbox.minN,
    maxE: m.utmBbox.maxE,
    maxN: m.utmBbox.maxN,
    widthM: m.widthM,
    heightM: m.heightM,
    bbox: m.bbox,
    equidistance: m.equidistance ?? null,
    isomVersion: m.isomVersion ?? null,
    scaleDenom: m.scaleDenom ?? 10000,
    source: m.source,
    demSource: m.demSource ?? null,
    demResolutionM: m.demResolutionM ?? null, // grid-oppløsning (m) — diagnostikk for kyst-presisjon
    depthSource: m.depthSource ?? null, // 'sjokart' | 'dem-estimat' | 'ingen' | null (eldre kart)
    contoursSkipped: m.contoursSkipped ?? null,
    coastal: m.coastal ?? null,        // true=kyst, false=innland, null=ukjent (eldre kart)
    sjokartStatus: m.sjokartStatus ?? null, // utfall av Sjøkart-WFS ved bygging (Utvikler-fanen)
    appVersion: m.appVersion ?? null,       // app-versjonen arket ble bygd med
    nveInnsjoStatus: m.nveInnsjoStatus ?? null, // NVE-innsjø-utfall ved bygging
    turruteStatus: m.turruteStatus ?? null, // Turrutebasen-utfall ved bygging
    n50StiStatus: m.n50StiStatus ?? null,   // N50-sti-utfall ved bygging
    // tetthet + detaljNivaa ble strippet på samme måte fra v5.0.0 til v5.0.3:
    // hele tetthets-linja i Utvikler-fanen (DrawerDevTab.tetthetTekst leser
    // begge) var derfor tom på ALLE kart siden tetthets-automatikken kom.
    tetthet: m.tetthet ?? null,             // tetthets-beslutningen (Utvikler-fanen)
    detaljNivaa: m.detaljNivaa ?? null,     // 'full' | 'lett' | 'sparsom'
  }
}

export function useMapLoadPipeline(deps) {
  const {
    route, router, svgHostRef, wrapperRef, meta, storedDem, mapId, mapTitle, mapDataSize,
    loading, loadError, isAlive, isGesturing, scale, rotation, panTo,
    BUILTIN, kulturminneCount, mapHasTrails, currentMapIsAuto,
    fillingInDetails, detailsFailed, mapIsPartial, buildingOnTheFly, buildingProgress,
    visibleLayers, currentTheme, applyTheme,
    applyLayerVisibility, applyDepthLayer, applyNameLanguage,
    applyStrokeScale, applyStrokeOverrides, applyTrailColors, applyLabelScale, applyLabelFonts,
    applyHillshade, applyZoomTierClasses, applyUprightLabels, applyNameLOD,
    applyViewportCull, buildCullDomIndex, resetViewportCull,
    forcedVisibleNameEls, labelBoxCache, resetPrevShownNames,
    renderGhostTiles, renderAnnotations, renderTracks,
    renderMeasure, renderProximityTarget, refreshAutoTileCount,
    computePoiAvailability, maybeHighlightFromQuery, maybeRestoreRoundTripFromQuery, mapSearch,
    annot, tracker, sti, userPos, restoreProximityAlert,
    detachedDetailLayers, showAutoMapToast, armAutoMap,
    reliefStepIndex, FRESH_RELIEF_MIN_IDX,
  } = deps
  // Innebygde kart hentes som rå SVG-fil. Eldre service workers serverte denne
  // via stale-while-revalidate og kunne returnere en utdatert/avkuttet kopi på
  // første last → DOMParser ga «Ugyldig SVG», mens en refresh / «Prøv igjen»
  // traff den revaliderte (friske) kopien. Den nye SW-en henter maps/* network-
  // first, men en allerede-aktiv gammel SW i klienten retter seg ikke før den
  // byttes ut. For å være robust UANSETT SW-tilstand: valider at svaret faktisk
  // parser som SVG med data-meta, og prøv på nytt med cache-bust (query-param
  // som hverken SW-cache eller HTTP-cache matcher) før vi gir opp.
  // UTEN NETT ER BEGGE GREPENE OVER SNUDD (v6.5.41). `cache: 'reload'` går forbi
  // HTTP-cachen med vilje, og cache-bustingen lager en URL hverken
  // service-workerens kart-cache eller HTTP-cachen har sett — begge er rettet mot
  // en revalidering som ikke KAN skje i flymodus, og de tar fra oss det ene
  // svaret som finnes. Demokartet ligger ferdig i `lende-data` fra installasjonen
  // (se public/sw.js); her må vi bare la det svare.
  async function fetchBuiltinSvg(file) {
    const baseUrl = `${import.meta.env.BASE_URL}maps/${file}`
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    let lastErr = null
    for (let attempt = 0; attempt < (offline ? 1 : 3); attempt++) {
      // Cache-bust f.o.m. forsøk 2 — tvinger forbi en gammel SWR-service-worker.
      const url = attempt === 0 ? baseUrl : `${baseUrl}?v=${Date.now()}`
      try {
        const res = await fetch(url, { cache: offline ? 'force-cache' : 'reload' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
        const root = doc.documentElement
        const bad = !root || root.nodeName === 'parsererror' || root.querySelector('parsererror')
        if (!bad && root.getAttribute('data-meta')) return text
        lastErr = new Error('Ugyldig SVG')
      } catch (e) {
        lastErr = e
      }
      // Kort backoff — gir en bakgrunns-revalidering tid til å fullføre.
      if (attempt < 2) await new Promise((r) => setTimeout(r, 150))
    }
    throw lastErr ?? new Error('Ugyldig SVG')
  }

  // Peek (uten å konsumere) om det finnes en promoteView-pref for `id` — da er
  // dette en «gjør aktiv»-promotering, og vi hopper over full-skjerm-loaderen så
  // byttet føles sømløst (flisa er allerede bygd/lagret).
  function hasPromotePref(id) {
    try {
      const raw = sessionStorage.getItem(`mapview-init-prefs:${id}`)
      return !!raw && !!JSON.parse(raw)?.promoteView
    } catch { return false }
  }

  // Generasjonsteller for utsatte etter-paint-pass: en silent re-load (terreng-
  // finalize) kan lande mens et utsatt pass venter — da skal det gamle passet
  // droppes i stedet for å kjøre mot en utbyttet SVG-DOM.
  let loadGeneration = 0

  // Render-perf for ÅPNING av kart (motstykket til createMapFlows byggetider):
  // loadMap fyller inn hent/parse/DOM/pass-tider, og det utsatte etter-paint-
  // passet (scheduleDeferredMapPasses) fullfører med første-paint- og indeks-tid
  // + node-tall, og skriver ÉN perfLog-linje. Grunnlaget for å vurdere hvor mye
  // større default-kart mobilen tåler — leses fra PerfLogModal (Utvikler-fanen).
  let renderPerf = null
  const _now = () => performance.now()

  async function loadMap({ silent = false } = {}) {
    // silent = re-render av samme kart (terreng → full) uten full-skjerm-loader;
    // beholder zoom/pan og hopper over init-prefs (alt konsumert ved første last).
    // Promotering (gjør-aktiv): hopp også over loaderen, men prefs leses fortsatt.
    const gen = ++loadGeneration
    const t0 = _now()
    renderPerf = null
    const isPromote = !silent && hasPromotePref(route.params.id ?? 'vardasen')
    if (!silent && !isPromote) loading.value = true
    loadError.value = null
    try {
      const id = route.params.id ?? 'vardasen'
      let text
      let demBytes = 0
      let stored = null
      // Ufullstendig-flagg nullstilles ved hver last; settes fra lagret entry
      // under. Innebygde kart er alltid komplette.
      mapIsPartial.value = false
      if (BUILTIN[id]) {
        mapTitle.value = BUILTIN[id].navn
        text = await fetchBuiltinSvg(BUILTIN[id].file)
      } else {
        stored = await loadStoredMap(id)
        if (!stored) {
          // Kartet finnes ikke lenger (typisk: slettet + hard refresh der
          // router.js gjenopptok en foreldet lende-last-map). En feilside er
          // en blindvei her — rydd gjenopptaks-nøklene og gå til forsiden.
          try {
            if (localStorage.getItem('lende-last-map') === id) localStorage.removeItem('lende-last-map')
            localStorage.removeItem(`lende-view:${id}`)
          } catch { /* noop */ }
          loading.value = false
          router.replace({ name: 'kart-hjem' })
          return
        }
        mapTitle.value = stored.navn
        text = stored.svg
        // Bygging avbrutt (reload/lukking) før OSM-detaljene ble fylt inn lagrer
        // entry-en med partial:true. MapView tilbyr «Fullfør» (B) — med mindre
        // en finalize allerede fyller inn nå (consumeTerrainFinalize under).
        mapIsPartial.value = !!stored.partial
        // Hent DEM hvis lagret (brukes av relieff og høydeprofil)
        if (stored.dem) {
          try { storedDem.value = unpackDem(stored.dem) } catch { storedDem.value = null }
          demBytes = stored.dem.buffer?.byteLength ?? 0
        }
      }
      // Datamengde for dette kartet (vises i drawer-ens Debug + long-press-arket).
      // SVG-en er hoved-payloaden; DEM-en lagres separat (pakket Float32-buffer).
      // text.length ≈ bytes (ASCII-dominert SVG, samme konvensjon som mapStorage) —
      // slipper å allokere en Blob-kopi av hele strengen på åpne-stien.
      mapDataSize.value = { svgBytes: text.length, demBytes }
      void refreshAutoTileCount()
      const tHent = _now()                 // IDB-les / builtin-fetch ferdig
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'image/svg+xml')
      const tParse = _now()                // DOMParser over hele SVG-strengen
      const root = doc.documentElement
      if (root.nodeName === 'parsererror' || root.querySelector('parsererror')) {
        throw new Error('Ugyldig SVG')
      }
      const metaRaw = root.getAttribute('data-meta')
      if (!metaRaw) throw new Error('Mangler data-meta i SVG')
      const m = JSON.parse(metaRaw)
      meta.value = metaFromSvgMeta(m)
      // Forbruk init-prefs fra auto-kart / on-the-fly (tema + synlige lag, GPS,
      // auto-modus, bevart zoom/rotasjon). Én gang per ny mapId.
      let pendingAutoStartGps = false
      let pendingRestoreView = null   // {scale, rotation} — bevar visning over hopp
      let pendingPromoteView = null   // {x, y, scale, rotation} — mosaikk-promotering
      let pendingMovedToast = false
      let pendingResumeRecording = false   // gjenoppta GPS-opptak etter auto-kart-bytte
      try {
        const k = `mapview-init-prefs:${mapId.value}`
        const raw = sessionStorage.getItem(k)
        if (raw) {
          sessionStorage.removeItem(k)
          const prefs = JSON.parse(raw)
          if (prefs.theme) currentTheme.value = prefs.theme
          if (Array.isArray(prefs.layers)) visibleLayers.value = new Set(prefs.layers)
          if (prefs.autoStartGps) pendingAutoStartGps = true
          if (prefs.resumeRecording) pendingResumeRecording = true
          // «Gjør aktiv»-promotering setter isAutoMap eksplisitt (true/false), så å
          // promotere til opprinnelig kart nullstiller flagget korrekt.
          if (prefs.promoteView) currentMapIsAuto.value = !!prefs.isAutoMap
          else if (prefs.isAutoMap) currentMapIsAuto.value = true
          if (prefs.promoteView && typeof prefs.promoteView.x === 'number') {
            pendingPromoteView = prefs.promoteView
          } else if (typeof prefs.scale === 'number' || typeof prefs.rotation === 'number') {
            pendingRestoreView = { scale: prefs.scale ?? 1, rotation: prefs.rotation ?? 0 }
          }
          if (prefs.movedCenterToast) pendingMovedToast = true
        }
      } catch { /* noop */ }
      // Fersk-kart-baseline: garanter «litt kontur + litt relieff» på nye kart så
      // de ikke blir blast hvis relieff er globalt skrudd av. Consume-on-read.
      let isFreshBuild = false
      if (!silent) {
        try {
          const fk = `mapview-freshlook:${mapId.value}`
          if (sessionStorage.getItem(fk)) {
            sessionStorage.removeItem(fk)
            isFreshBuild = true
            if (reliefStepIndex.value === 0) reliefStepIndex.value = FRESH_RELIEF_MIN_IDX
            if (!visibleLayers.value.has('kontur')) {
              visibleLayers.value = new Set(visibleLayers.value).add('kontur')
            }
          }
        } catch { /* noop */ }
      }
      // Full trinnvis avsløring kun der den har en jobb: ferske bygg (masker den
      // første tunge painten) og silent finalize-swaps (masker DOM-byttet). En
      // vanlig åpning av et allerede-bygget kart får en kort enkelt-fade.
      const tDomStart = _now()
      setupHostSvg(root, { staged: isFreshBuild || silent })
      const tDom = _now()                  // adoptNode-innsetting + detalj-detach
      loading.value = false
      await nextTick()
      applyLayerVisibility()
      applyDepthLayer()              // dybde-toggle (default av) — kun synlig om Sjøkart-dybde finnes
      applyTheme()
      applyStrokeScale()
      applyStrokeOverrides()         // per-element strek (Strek-FAB-panelet)
      applyTrailColors()             // sti-farger for dette kartet (Strek-FAB-panelet)
      applyLabelScale()
      applyLabelFonts()
      userPos.recompute()
      // Auto-start GPS når init-prefs ber om det (kommer fra on-the-fly-
      // snarveien i MapHomeView, der bruker ikke har annen vei til å slå
      // GPS på). Trygt å kalle flere ganger — start() er idempotent.
      if (pendingAutoStartGps) userPos.start()
      await annot.load(stored)
      renderAnnotations()
      await tracker.load(stored)
      renderTracks()
      // Gjenoppta GPS-opptak etter et auto-kart-bytte. userPos.start() er allerede
      // kalt over (pendingAutoStartGps) og setter isWatching synkront, så
      // startRecording() lykkes. Sporet fortsetter som et nytt segment på denne flisa.
      if (pendingResumeRecording && userPos.isWatching) tracker.startRecording()
      applyUprightLabels()
      renderMeasure()
      restoreProximityAlert()
      renderProximityTarget()
      // Hill-shading (med innbakt knaus-relieff) er default ON — fire-and-forget.
      // Lazy DEM-load skjer internt hvis nødvendig (Vardåsen).
      applyHillshade()
      // Flerspråklige navn → vis kun norsk (eller fullt, etter innstilling).
      // Må kjøre FØR søkeindeksen bygges: applyNameLanguage stempler det fulle
      // navnet i data-name-full, som useMapSearch indekserer (alle språk søkbare).
      applyNameLanguage()
      // Overlever til det utsatte passet, som fullfører og logger linjen.
      // hent = IDB/nett, parse = DOMParser, dom = adoptNode-innsetting,
      // pass = apply-passene (inkl. annotering/spor-IDB-les).
      renderPerf = {
        gen, t0,
        hent: Math.round(tHent - t0),
        parse: Math.round(tParse - tHent),
        dom: Math.round(tDom - tDomStart),
        pass: Math.round(_now() - tDom),
        widthKm: (m.widthM ?? 0) / 1000,
        svgBytes: text.length,
        silent,
      }
      // De getBBox-tunge indeks-passene (søk, navn-LOD, culling) utsettes til
      // etter første paint — de bestemmer ikke hva første frame viser, men
      // tvang tidligere synkron layout av hele multi-MB-SVG-en før kartet kom
      // på skjerm. Labels holdes skjult av .lod-pending til passet er kjørt.
      scheduleDeferredMapPasses(gen)
      if (pendingPromoteView) {
        // «Gjør aktiv»-promotering: pan slik at det samme geografiske punktet (uttrykt
        // i den nye flisas meter-rom) blir liggende under skjermsenter — sømløst,
        // ingen hopp i forhold til der brukeren scrollet.
        rotation.value = pendingPromoteView.rotation ?? 0
        await nextTick()
        panTo(pendingPromoteView.x, pendingPromoteView.y, {
          vbWidth: meta.value.widthM, vbHeight: meta.value.heightM,
          targetScale: pendingPromoteView.scale ?? 1, keepRotation: true,
        })
        // Auto-promoteringen er med vilje usynlig (ingen spinner/hopp) — men da
        // ser et bytte til et ARK BYGD MED ELDRE APP ut som at innhold plutselig
        // «forsvinner» (f.eks. innsjøer bygd før NVE-kilden fantes). Si fra.
        if (meta.value.appVersion !== APP_VERSION && !BUILTIN[mapId.value]) {
          showAutoMapToast(`Viser eldre ark (bygd med ${meta.value.appVersion ? 'v' + meta.value.appVersion : 'eldre app'}) — bygg på nytt for ferske data`)
        }
      } else if (pendingRestoreView) {
        rotation.value = pendingRestoreView.rotation
        await nextTick()
        panTo(meta.value.widthM / 2, meta.value.heightM / 2, {
          vbWidth: meta.value.widthM, vbHeight: meta.value.heightM,
          targetScale: pendingRestoreView.scale, keepRotation: true,
        })
      } else if (!silent) {
        // Åpne på DEKNING, ikke på «hele arket i letterbox» (v5.19.2). Skala 1 er
        // meet-tilpasningen, og den lar kremgul bakgrunn ligge over og under
        // kartet — arket ser ut som et ark, og kanten leser som verdens ende.
        // Nå ligger det alltid kart like utenfor skjermkanten, så panorering
        // avslører mer KART. Se lib/viewFit.js for prisen (oversikten).
        //
        // Kun ved en ekte åpning: `silent` er terreng→full-byttet, som skal
        // beholde brukerens utsnitt, og de to grenene over eier sin egen visning.
        const wrap = wrapperRef.value?.getBoundingClientRect()
        const s = dekningsSkala({
          w: wrap?.width, h: wrap?.height,
          widthM: meta.value.widthM, heightM: meta.value.heightM,
        })
        if (s > 1) {
          await nextTick()
          panTo(meta.value.widthM / 2, meta.value.heightM / 2, {
            vbWidth: meta.value.widthM, vbHeight: meta.value.heightM,
            targetScale: s,
          })
        }
      }
      armAutoMap()
      if (pendingMovedToast) showAutoMapToast('Flyttet sentrum hit')
      // Mosaikk: tegn nabo-fliser så man kan utvide/gjøre dem aktive.
      // Async + fail-safe; setupHostSvg har tømt evt. gamle spøkelser.
      void renderGhostTiles()
      // Stedsnavn vannrett med én gang — viktig når kartet lastes allerede
      // rotert (f.eks. via promoteView). Kanthåndtakene er DOM-overlay og
      // trenger ingen render-runde her.
      applyUprightLabels()
      // Terreng-først: hvis dette kartet ble vist som terreng-skjelett, konsumér
      // finalize-promisen og re-render (stille) når full SVG med OSM er klar.
      if (!silent) consumeTerrainFinalize()
    } catch (e) {
      loading.value = false
      loadError.value = e.message ?? 'Kunne ikke laste kart'
    }
  }

  // Vent på terreng-først-finalize (full bygging i bakgrunnen) og re-render når
  // klar. Beholder gjeldende zoom/pan (silent re-load). Tåler at brukeren har
  // navigert videre (isAlive()-sjekk).
  function consumeTerrainFinalize() {
    const fin = consumeMapFinalize(mapId.value)
    if (!fin) return
    fillingInDetails.value = true
    detailsFailed.value = false
    fin.then(() => {
      if (!isAlive()) return
      return loadMap({ silent: true })
    }).catch(() => {
      // Bakgrunns-byggingen feilet (oftest Overpass nede). Vis en lesbar banner
      // med en «Prøv på nytt»-knapp i stedet for en teknisk toast.
      if (isAlive()) detailsFailed.value = true
    }).finally(() => {
      if (isAlive()) fillingInDetails.value = false
    })
  }

  // «Prøv på nytt» fra detalj-feil-banneret: bygg kartet på nytt fra samme senter
  // (samme størrelse/ekvidistanse/navn), erstatt det delvise kartet.
  async function retryMapDetails() {
    if (!meta.value || buildingOnTheFly.value) return
    detailsFailed.value = false
    const prevId = mapId.value
    const centerSvg = { x: meta.value.widthM / 2, y: meta.value.heightM / 2 }
    buildingOnTheFly.value = true
    buildingProgress.value = 'Prøver på nytt …'
    try {
      const { lat, lon } = svgToWgs84(centerSvg.x, centerSvg.y, meta.value)
      const { id } = await buildMapFromCenter({
        center: { lat, lon, name: mapTitle.value },
        halfKm: +(meta.value.widthM / 2000).toFixed(3),
        // Reproduser SAMME utsnitt — behold flisas aspekt (ellers falt høyden
        // tilbake til viewportAspect() og «prøv på nytt» ga et annet utsnitt).
        aspect: +(meta.value.heightM / meta.value.widthM).toFixed(5),
        equidistanceM: meta.value.equidistance ?? 20,
        navn: mapTitle.value,
        terrainFirst: true,
        isAuto: currentMapIsAuto.value,
        onProgress: (msg) => { buildingProgress.value = msg },
      })
      try {
        sessionStorage.setItem(`mapview-init-prefs:${id}`, JSON.stringify({
          theme: currentTheme.value,
          layers: Array.from(visibleLayers.value),
          autoStartGps: userPos.isWatching,
          isAutoMap: currentMapIsAuto.value,
          scale: scale.value,
          rotation: rotation.value,
        }))
      } catch { /* noop */ }
      if (prevId && prevId !== 'vardasen') { try { await deleteStoredMap(prevId) } catch { /* noop */ } }
      router.replace({ name: 'kart-vis', params: { id } })
    } catch (e) {
      console.error('Regenerering feilet:', e)
      buildingOnTheFly.value = false
      buildingProgress.value = ''
      detailsFailed.value = true
    }
  }

  // Utsatte etter-paint-pass (søkeindeks, POI-telling, navn-LOD, cull-indeks,
  // ?hl=-highlight). Dobbel-rAF garanterer at første frame av kartet er malt før
  // getBBox-stormene tvinger layout. Generasjonstelleren dropper passet hvis en
  // nyere loadMap (silent finalize-swap, flis-bytte) har byttet ut SVG-en.
  function scheduleDeferredMapPasses(gen) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (gen !== loadGeneration || !isAlive()) return
      const svg = svgHostRef.value?.querySelector('svg')
      if (!svg) return
      // Dobbel-rAF-en over har latt første kart-frame males — tidspunktet HER er
      // dermed «kartet er på skjermen» sett fra brukeren (≈ første paint).
      const tPaint = _now()
      // Bygg søkeindeks fra ferdig-loaded SVG-DOM (getBBox()+getCTM() krever
      // attached element).
      mapSearch.rebuild(svg)
      // Tell POI pr type så «nærmeste»-snarveiene i PUNKT-arket kan gråes ut
      // når kartet mangler typen (f.eks. ingen holdeplass).
      computePoiAvailability()
      // Kjør navn-LOD nå som indeksen finnes (skjuler overflødige navn i tette
      // utsnitt). Videre på zoom/pan via watch.
      applyNameLOD()
      // Viewport-culling: bygg rbush-indeks fra fersk SVG-DOM og kjør første
      // pass (force — ingen prevState å hysterese mot).
      buildCullDomIndex()
      applyViewportCull(true)
      // Auto-highlight hvis ?hl=<navn> i URL (delings-flow).
      maybeHighlightFromQuery()
      // Gjenskap delt rundtur hvis ?olat=&olon=&rtv= i URL (delings-flow).
      maybeRestoreRoundTripFromQuery?.()
      svg.classList.remove('lod-pending')
      // Fullfør render-perf-linjen fra loadMap: paint = t0 → første malte frame,
      // indeks = getBBox-passene over. Node-tallet (live collection, billig
      // .length) er den direkte driveren for DOM-kostnaden ved økt kartstørrelse.
      if (renderPerf?.gen === gen) {
        const p = renderPerf
        renderPerf = null
        logPerf(
          `[perf] åpne ${p.widthKm.toFixed(1)}km paint ${Math.round(tPaint - p.t0)}ms ` +
          `(hent ${p.hent} | parse ${p.parse} | dom ${p.dom} | pass ${p.pass}) ` +
          `indeks ${Math.round(_now() - tPaint)}ms | ` +
          `${svg.getElementsByTagName('*').length} noder, ${(p.svgBytes / 1048576).toFixed(1)} MB` +
          `${p.silent ? ' [finalize]' : ''} [ms]`
        )
      }
    }))
  }

  // Trinnvis kart-avsløring (v11.0.45). Struktur fades inn først, så tekstur +
  // labels et hakk etter — gir en «levende» ankomst i stedet for én tung paint.
  // Hopper helt over (vis straks) ved prefers-reduced-motion.
  const prefersReducedMotion = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })()
  function startMapReveal(svg, staged) {
    if (prefersReducedMotion) return
    if (!staged) {
      // Allerede-bygget kart: kort enkelt-fade i stedet for full to-trinns
      // avsløring — labels maskeres uansett av .lod-pending til LOD-passet.
      svg.classList.add('cb-reveal')
      requestAnimationFrame(() => requestAnimationFrame(() => {
        svg.classList.add('cb-reveal-quick', 'cb-revealing')
        svg.classList.remove('cb-reveal')
        setTimeout(() => svg.classList.remove('cb-revealing', 'cb-reveal-quick'), 200)
      }))
      return
    }
    svg.classList.add('cb-reveal', 'cb-reveal-late')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      svg.classList.add('cb-revealing')      // skru på opacity-transition
      svg.classList.remove('cb-reveal')      // struktur fader 0 → 1
      setTimeout(() => svg.classList.remove('cb-reveal-late'), 130)  // tekstur/labels etter
      setTimeout(() => svg.classList.remove('cb-revealing'), 540)    // rydd transitions
    }))
  }

  function setupHostSvg(sourceRoot, { staged = true } = {}) {
    const host = svgHostRef.value
    host.replaceChildren()
    // Ny SVG-DOM → element-referansene i culling-indeksen er foreldede.
    // Indeksen bygges på nytt etter at lasting er ferdig (buildCullDomIndex).
    resetViewportCull()
    // Samme for navn-LOD-statens el-referanser og boks-cache: tømmes HER (ikke
    // i det utsatte passet) så stale refs aldri overlever et SVG-bytte.
    forcedVisibleNameEls.clear()
    labelBoxCache.clear()
    resetPrevShownNames()

    // Selve DOM-byggingen bor i lib/kartVert.js (v6.5.0) — den deles med
    // Fritt lende, som ikke har noe av bokføringen rundt.
    const { svg, detaljLag, kulturminneAntall, harStier } = byggVertSvg(sourceRoot)
    detachedDetailLayers.length = 0
    detachedDetailLayers.push(...detaljLag)
    kulturminneCount.value = kulturminneAntall
    host.appendChild(svg)

    // v11.0.45: trinnvis avsløring — strukturen (bakgrunn/vann/kurver/veier) males
    // først, så toner tekstur (vegetasjon/relieff) og labels inn et lite øyeblikk
    // etter. Selv om total tid er lik, leses en trinnvis ankomst som «snappy»
    // mens én blokkerende paint leses som treg. Ren CSS-klasse-sekvens.
    startMapReveal(svg, staged)
    // v8.10.4: SVG-en er ny-bygget her — applikér evt. allerede-aktive
    // perf-klasser (.zoomed-in / .zoom-near / .is-zooming) basert på nåværende
    // state, siden watcheren bare reagerer på endringer.
    applyZoomTierClasses(svg, scale.value)
    if (isGesturing && isGesturing.value) svg.classList.add('is-zooming')
    // Stifinner: nytt kart → avbryt evt. aktiv modus + rydd rute-overlay, og
    // avgjør om kartet har routbare sti-/vei-lag (styrer «Naviger hit»).
    if (sti.active.value) sti.cancel()
    mapHasTrails.value = harStier
  }

  return {
    fetchBuiltinSvg, hasPromotePref, loadMap, consumeTerrainFinalize,
    retryMapDetails, scheduleDeferredMapPasses, startMapReveal, setupHostSvg,
  }
}
