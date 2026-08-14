// 3D-inngangen: pin-ene på kartet, dataklargjøringen og viewerens livssyklus.
//
// Trukket ut av MapView.vue i v5.8.0. Grunnen står i CLAUDE.md: MapView var
// ~4 900 linjer, alt møttes der, og en assistent (eller et menneske) som bare
// ser utsnitt av fila om gangen gjør flere feil. Dette domenet er selvstendig:
// det leser kartet (meta, DEM, søkeindeks, SVG-en) og Stifinnerens rute, og
// eier ellers bare sin egen tilstand.
//
// Ett kart-SVG kan gi TO slags 3D: fri utforsking av utsnittet, eller en
// planlagt rute som står klar i følge-kameraet. Begge går til samme viser
// (Viewer3D.vue) — se scene3d.js.
//
// 3D DEKKER HELE ARKET, ikke bare den aktive flisa (v5.18.0). Har brukeren
// utvidet kartet med kanthåndtakene, er «kartet» aktiv flis pluss nabofliser —
// og fram til v5.18.0 bygde 3D bare den ene i midten, så et 3×3-ark mistet åtte
// niendedeler i det man trykket «3D». Nå regnes utsnittet av mosaikk-kanten
// (samme union pan-grensa bruker) ∪ rutas bounding-boks.
//
// Med et utvidet utsnitt må ALT som sendes inn forskyves til det nye
// koordinatrommet: rute, via-punkter, søkeindeks, stinett, brukerminner.
// Glemmer man én av dem, ligger den en flisebredde feil under turen.

import { ref, shallowRef, computed, watch, markRaw } from 'vue'
import {
  computeExtent, demResolutionFor, shiftPoints, shiftVia, shiftIndex, demsIntoExtent,
} from '../lib/tour3d/tourExtent.js'

/**
 * @param {{
 *   meta: import('vue').Ref, storedDem: import('vue').Ref,
 *   searchIndex: import('vue').Ref, svgHostRef: import('vue').Ref,
 *   wrapperRef: import('vue').Ref, animating: import('vue').Ref,
 *   scale: import('vue').Ref, translateX: import('vue').Ref,
 *   translateY: import('vue').Ref, rotation: import('vue').Ref,
 *   sti: object, userPos: object,
 *   ghostRects: import('vue').Ref,
 *   svgToClient: (x:number, y:number) => {x:number,y:number}|null,
 *   ensureDem: () => Promise<void>,
 *   mosaicBounds: () => {minX:number,minY:number,maxX:number,maxY:number}|null,
 * }} deps
 *   mosaicBounds  yttergrensa til arket (aktiv flis ∪ spøkelsesfliser). Sendes
 *     som funksjon fordi useMapExtend, som eier den, opprettes lenger ned i
 *     MapView — TDZ-regelen i CLAUDE.md.
 */
export function use3dEntry({
  meta, storedDem, searchIndex, svgHostRef, wrapperRef, animating,
  scale, translateX, translateY, rotation,
  sti, userPos, ghostRects, svgToClient, ensureDem, mosaicBounds = null,
}) {
  const view3dOpen = ref(false)
  const view3dLoading = ref(false)
  const view3dComp = shallowRef(null)
  const view3dData = shallowRef(null)
  const tour3dError = ref('')

  const stiSelectedRoute = computed(() =>
    sti.routes.value[sti.selectedRouteIdx.value] ?? null)

  const tour3dPinVisible = computed(() =>
    (sti.mode.value === 'showing' || sti.mode.value === 'following') &&
    !!stiSelectedRoute.value && !!sti.start.value && !!meta.value && !view3dOpen.value)

  // Samme knapp i målenden. Ved rundtur er mål == start, og da ville de to ligget
  // oppå hverandre — der holder den ene.
  const tour3dEndPinVisible = computed(() =>
    tour3dPinVisible.value && !sti.isLoop.value && !!sti.destination.value)

  const tour3dPinElRef = ref(null)
  const tour3dEndPinElRef = ref(null)

  function place3dPin(el, p, visible) {
    if (!el) return
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!p || !visible || !wrap) return
    const scr = svgToClient(p.svgX, p.svgY)
    if (!scr) return
    // Skjul (ikke flytt) når punktet er panorert utenfor kartflaten —
    // chips-knappen «Vis turen i 3D» dekker det tilfellet.
    const inside = scr.x >= wrap.left && scr.x <= wrap.right && scr.y >= wrap.top && scr.y <= wrap.bottom
    el.style.visibility = inside ? 'visible' : 'hidden'
    el.style.left = (scr.x - wrap.left) + 'px'
    el.style.top = (scr.y - wrap.top) + 'px'
  }

  function positionTour3dPin() {
    place3dPin(tour3dPinElRef.value, sti.start.value, tour3dPinVisible.value)
    place3dPin(tour3dEndPinElRef.value, sti.destination.value, tour3dEndPinVisible.value)
  }
  let tour3dPinRaf = 0
  function tour3dPinRafLoop() {
    positionTour3dPin()
    if (animating.value && tour3dPinVisible.value) {
      tour3dPinRaf = requestAnimationFrame(tour3dPinRafLoop)
    } else {
      tour3dPinRaf = 0
    }
  }
  watch([tour3dPinVisible, tour3dEndPinVisible, () => sti.start.value, () => sti.destination.value,
    scale, translateX, translateY, rotation], positionTour3dPin)
  watch(animating, (v) => {
    if (v && tour3dPinVisible.value && !tour3dPinRaf) tour3dPinRaf = requestAnimationFrame(tour3dPinRafLoop)
  })

  // Motorens ETA-kall er (meter, klatring-i-meter); stifinnerens Naismith tar
  // {ascent, descent}-objekt — adapter her. Sendes med begge veier inn i 3D, så
  // også en tur man finner ved å trykke på stinettet får «tid igjen».
  function tour3dEstWalk(lengthM, climbM) {
    return sti.estWalkMinutes(lengthM, climbM ? { ascent: climbM, descent: 0 } : null)
  }

  // Stinett, hindre og brukerminner leses ut av kart-SVG-en her, siden det er
  // MapView som eier DOM-en — 3D-chunken skal ikke røre den.
  async function svgLagFor3d(svgEl, extent = null) {
    const [
      { stinettFeaturesFromSvgEl, fjernIsolerteStumper },
      { collectBrukerminnePins, collectGhostFeatures },
      { BARRIER_CODES },
    ] = await Promise.all([
      import('../lib/stinettAnalyse.js'),
      import('../lib/tour3d/exploreData.js'),
      import('../lib/routing.js'),
    ])
    // Utvidet utsnitt: alt må inn i det forskjøvede rommet, ellers ligger
    // stinettet en flisebredde feil under turen.
    const flytt = (features) => (extent
      ? features.map(f => ({ ...f, coordinates: shiftPoints(f.coordinates, extent) }))
      : features)
    const flyttPunkter = (pins) => (extent
      ? pins.map(p => ({ ...p, x: p.x - extent.minX, y: p.y - extent.minY }))
      : pins)
    return {
      // Både stier og bindeledd (småveg/bro) — en tur langs stien skal kunne
      // krysse en skogsbilvei uten å stoppe. `hoppOverSkjulte` gjør at 3D viser
      // det samme stinettet som kartet: har brukeren slått av veier eller stier
      // for å rydde, skal ikke 3D tegne dem likevel.
      // … og korte, isolerte fragmenter luftes ut: de er verken nyttige å se
      // eller å trykke på. Stumper som henger sammen med en lang sti blir stående.
      pathFeatures: flytt(fjernIsolerteStumper(
        stinettFeaturesFromSvgEl(svgEl, null, { hoppOverSkjulte: true }),
        { minKomponentM: 500 },
      )),
      // Hindre-geometri (vann, hovedvei, jernbane, bygning, stup) — det
      // sti-vandringen i 3D trenger for å vite hvor et brudd i stinettet er et
      // ekte hinder og ikke bare et hull i kartdataene. Samme kodesett som
      // Stifinneren og chatten bruker.
      barrierFeatures: flytt(stinettFeaturesFromSvgEl(svgEl, new Set(Object.keys(BARRIER_CODES)))),
      brukerminner: flyttPunkter(collectBrukerminnePins(svgEl)),
      // Navngitte POI-er i naboflisene. Leveres UFORSKJØVET — de slås sammen med
      // søkeindeksen i prepare3dData og forskyves der, med shiftIndex, sammen
      // med resten av indeksen.
      nabonavn: collectGhostFeatures(svgEl),
    }
  }

  // Nabofliser inn i søkeindeksen 3D-nålene bygges av. Et navn som alt står i
  // den aktive flisas indeks vinner — et vann som strekker seg over flisekanten
  // har én label per flis, og to nåler på samme vann er bare rot.
  function medNabonavn(index, nabonavn) {
    if (!nabonavn?.length) return index ?? []
    const finnes = new Set(
      (index ?? []).map(e => `${e.kind}:${String(e.name ?? '').toLowerCase()}`),
    )
    return [
      ...(index ?? []),
      ...nabonavn.filter(g => !finnes.has(`${g.kind}:${g.name.toLowerCase()}`)),
    ]
  }

  // Offline-fallback for DEM-en når hentingen feiler (eller WCS svarer
  // syntetisk): legg hver flis' EGEN lagrede DEM inn på sin plass i union-gridet.
  // Uten naboflisene sto åtte av ni fliser i et 3×3-ark på havnivå mens
  // kartteksturen viste fjell.
  async function mosaikkDemFallback(extent) {
    const placements = [{ dem: storedDem.value, x: 0, y: 0 }]
    const rects = ghostRects?.value ?? []
    if (rects.length) {
      try {
        const [{ loadMap }, { unpackDem }] = await Promise.all([
          import('../lib/mapStorage.js'),
          import('../lib/demSampling.js'),
        ])
        for (const g of rects) {
          try {
            const lagret = await loadMap(g.id)
            const d = lagret?.dem ? unpackDem(lagret.dem) : null
            if (d) placements.push({ dem: d, x: g.x, y: g.y })
          } catch { /* en flis som ikke kan leses hoppes over */ }
        }
      } catch { /* uten lagring: aktiv flis alene, som før */ }
    }
    return demsIntoExtent(placements, extent)
  }

  // Ferdig preparert 3D-datasett. Dekker HELE arket: aktiv flis ∪ nabofliser ∪
  // (med tur) rutas bounding-boks. DEM hentes for hele utsnittet via flis-cachen
  // og alle koordinater forskyves inn i det nye rommet — kartbildet skal ikke
  // stoppe ved en flisekant, og turen skal aldri «gå i tomme lufta».
  async function prepare3dData({ medTur = false } = {}) {
    const svgEl = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    if (!svgEl || !m) return null

    const baseMeta = {
      minE: m.minE, minN: m.minN, widthM: m.widthM, heightM: m.heightM,
      equidistance: m.equidistance ?? null,
    }
    const r = medTur ? stiSelectedRoute.value : null
    if (medTur && !r) return null
    const viaArr = medTur ? sti.via.value.map(v => ({ svgX: v.svgX, svgY: v.svgY })) : []
    const mosaic = mosaicBounds?.() ?? null
    const utsnittFor = (gridM) => computeExtent(baseMeta, {
      mosaic, route: r?.coordinates ?? [], via: viaArr, gridM,
    })
    // To runder: første måler størrelsen, som bestemmer DEM-oppløsningen — og
    // utsnittet må snappes til DEN oppløsningen, ellers ligger det ikke på
    // DEM-gitteret og monteringen i flis-cachen faller tilbake til én full fetch.
    const grovt = utsnittFor(undefined)
    const demRes = grovt ? demResolutionFor(grovt.widthM, grovt.heightM) : 10
    const extent = grovt && demRes > 10 ? utsnittFor(demRes) : grovt

    let dem3d = storedDem.value
    if (extent) {
      let hentet = null
      try {
        const { fetchDEMWithCache, snapUtmBboxToGrid } = await import('../lib/demTileCache.js')
        const utm = snapUtmBboxToGrid({
          minE: extent.meta3d.minE,
          minN: extent.meta3d.minN,
          maxE: extent.meta3d.minE + extent.widthM,
          maxN: extent.meta3d.minN + extent.heightM,
        }, demRes)
        hentet = await fetchDEMWithCache(utm, { resolutionM: demRes, rejectSynthetic: true })
        // Samme hull-reparasjon som kart-byggingen gjør (createMapFlow →
        // maybeFillFromTerrarium). 3D hentet sitt eget DEM og hoppet over den,
        // så et datahull i NHM-mosaikken — 0 m midt i terrenget — ble stående
        // og terrenggitteret senket seg til havnivå der. Det var Otersjøen-
        // rapporten (v5.18.6): to rektangulære sjakter rett ned gjennom
        // innsjøflata, mye tydeligere i 3D enn i 2D fordi vannlaget i 2D
        // dekket over kurvene. Gaten er billig (ett gjennomløp av gitteret),
        // så hull-frie kart betaler ingen fliser og ingen ventetid.
        // Egen try: et Terrarium-uhell skal aldri kaste vekk DEM-et vi nettopp
        // hentet — da falt vi til mosaikk-fallbacken og mistet nabo-terrenget.
        if (hentet) {
          try {
            const { fillDemVoidsFromTerrarium } = await import('../lib/terrariumDem.js')
            const { dem: fylt } = await fillDemVoidsFromTerrarium(hentet, utm)
            hentet = fylt
          } catch (e) {
            console.warn(`[3D] Terrarium-fyll hoppet over: ${e?.message ?? e}`)
          }
        }
      } catch { hentet = null }
      // Offline/nettfeil (inkl. syntetisk WCS-fallback avvist over): blit hver
      // flis' EKTE DEM inn i union-gridet (utenfor = havnivå).
      dem3d = hentet ?? await mosaikkDemFallback(extent)
    }

    const lag = await svgLagFor3d(svgEl, extent)
    const { nabonavn, ...lagene } = lag
    const indeks = medNabonavn(searchIndex.value, nabonavn)
    return markRaw({
      ...lagene,
      dem: dem3d,
      meta: extent ? extent.meta3d : baseMeta,
      searchIndex: extent ? shiftIndex(indeks, extent) : indeks,
      extent,
      tour: r
        ? {
          route: {
            coordinates: extent ? shiftPoints(r.coordinates, extent) : r.coordinates,
            lengthM: r.lengthM,
          },
          via: extent ? shiftVia(viaArr, extent) : viaArr,
          isLoop: sti.isLoop.value,
        }
        : null,
    })
  }

  // Live GPS inn i 3D — kun når posisjonering allerede er aktiv. Nytt lite objekt
  // per fix (computed på svgX/svgY) så viewer-watchen trigges; koordinatene
  // forskyves til det (evt. utvidede) utsnittet.
  const gpsFor3d = computed(() => {
    if (!userPos.isWatching || userPos.svgX == null) return null
    const ext = view3dData.value?.extent
    return {
      svgX: userPos.svgX - (ext?.minX ?? 0),
      svgY: userPos.svgY - (ext?.minY ?? 0),
      accuracyM: userPos.accuracyM,
    }
  })

  async function open3d({ medTur = false } = {}) {
    if (view3dOpen.value) return
    tour3dError.value = ''
    view3dOpen.value = true
    view3dLoading.value = true
    try {
      await ensureDem()
      view3dData.value = await prepare3dData({ medTur })
      if (!view3dData.value) throw new Error(medTur ? 'ingen rute' : 'kartet er ikke lastet')
      if (!view3dComp.value) {
        const mod = await import('../components/tour3d/Viewer3D.vue')
        view3dComp.value = markRaw(mod.default)
      }
    } catch {
      view3dOpen.value = false
      view3dData.value = null
      tour3dError.value = 'Kunne ikke laste 3D-visningen — sjekk nettforbindelsen'
      setTimeout(() => { tour3dError.value = '' }, 4000)
    } finally {
      view3dLoading.value = false
    }
  }
  function openTour3d() { return open3d({ medTur: true }) }
  function openExplore3d() { return open3d({ medTur: false }) }
  function close3d() {
    view3dOpen.value = false
    view3dData.value = null
  }

  // Idle-warm-up: hashede chunks er cache-first-ved-første-fetch i sw.js, så én
  // online kartøkt legger 3D-chunken (inkl. three) i cachen — «Vis i 3D» virker
  // da også uten dekning senere.
  let tour3dWarmed = false
  watch(meta, (m) => {
    if (!m || tour3dWarmed) return
    tour3dWarmed = true
    const warm = () => {
      if (navigator.onLine === false || navigator.connection?.saveData) return
      import('../components/tour3d/Viewer3D.vue').catch(() => {})
    }
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 15000 })
    else setTimeout(warm, 5000)
  }, { immediate: true })

  return {
    // tilstand vieweren og malen leser
    view3dOpen, view3dLoading, view3dComp, view3dData, tour3dError,
    // 3D-pin ved start/mål av en planlagt rute
    tour3dPinVisible, tour3dEndPinVisible, tour3dPinElRef, tour3dEndPinElRef,
    positionTour3dPin,
    // det vieweren får inn
    gpsFor3d, tour3dEstWalk,
    // handlinger
    openTour3d, openExplore3d, close3d,
  }
}
