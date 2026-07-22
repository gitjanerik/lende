// Long-press-kontekstmenyens tilstand og oppslag — skilt ut fra MapView
// v1.0.10 (kode uendret). Gesten (long-press/høyreklikk), punkt-geometrien
// (vann/land, nærmeste sted), contextMenuInfo og alle datakildene (NVE
// innsjø/HydAPI, Naturbase + GBIF/rødliste, NiN-naturtyper, SNL/Wikipedia)
// med sine watches bor her. Forelderen eier SVG-verten og inset-refene;
// composablen mottar refs destrukturert. Selve arket rendres av
// ContextMenuSheet, handlings-knappene av forelderen.
import { ref, computed, watch } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { sampleElevation } from '../lib/demSampling.js'
import { fetchLakeData } from '../lib/nveLakeFetcher.js'
import { fetchLiveWater } from '../lib/nveHydApi.js'
import { fetchProtectedArea } from '../lib/verneFetcher.js'
import { fetchNaturtypes } from '../lib/naturtypeFetcher.js'
import { fetchSpeciesSummary } from '../lib/gbifSpecies.js'
import { summarizeRedListed } from '../lib/redListNo.js'
import { groupSpecies } from '../lib/speciesGroups.js'
import { fetchWikiSummary, titleMatches } from '../lib/wikiSummary.js'
import { fetchNearestWikiPlace, placeNameMatches } from '../lib/wikiPlace.js'
import { fetchSnlSummary } from '../lib/snlFetcher.js'
import { cacheGet, cacheSet, pointKey, naturtypePointKey, placePointKey, TTL } from '../lib/protectedAreaCache.js'
import {
  bearingDeg, bearingToCompass, formatDistanceM,
  findNearestPlace, pointToPolylineDist,
} from '../lib/mapContext.js'

export function useContextLookups({
  svgHostRef, wrapperRef, meta, storedDem, ensureDem, userPos, searchIndex,
  buildingOnTheFly, searchOpen, fillingInDetails, sti, scale, mapSearch,
  contextDrawer, mapId, closeDrawer, knobPanel, proximityPanelOpen, clientToSvg,
}) {
  // ── Long-press kontekstmeny ──────────────────────────────────────────────
  // Long-press (~550ms hold uten bevegelse) eller høyreklikk på kartet åpner
  // en bottom-sheet med koordinater, stedsinfo og handlinger (kopier, del,
  // start måling, åpne i Google Maps/Street View, plasser annotering).
  //
  // Implementasjon: vi binder pointer-events på wrapperRef. Pinch-zoom binder
  // touch-events (touchstart/move/end) via egne addEventListener, så de to
  // håndterer-settene konkurrerer ikke. Vi sporer kun primær-pointer'en og
  // avbryter timeren ved bevegelse (>10 px) eller en sekundær pointer (pinch).
  const contextMenuOpen = ref(false)
  const contextMenuPoint = ref(null)     // { svgX, svgY, clientX, clientY }
  // NVE Innsjødatabase-oppslag for long-press-punktet. Status: 'loading' |
  // 'done' (med hoyde+navn) | 'empty' (ikke en registrert innsjø) | 'error'.
  // Token-nøkkel forkaster trege svar når brukeren long-presser et nytt punkt.
  const lakeQuery = ref(null)
  let lakeQueryToken = 0
  // Verneområde-oppslag (Naturbase + GBIF + Wikipedia) ved long-press.
  // null = ingen verneområde her | { status:'loading' } | { status:'done',
  // area, species, wiki }. species/wiki: 'loading' | objekt | null (utilgjengelig).
  const verneQuery = ref(null)
  let verneQueryToken = 0
  // Hvilken rødliste-kategori (CR/EN/VU/NT) som er foldet ut i kortet. Accordion:
  // kun én åpen om gangen. Nullstilles når et nytt verneområde slås opp.
  const expandedRedCat = ref(null)
  // NiN-naturtype-oppslag ved long-press (uavhengig av verneområde — naturtyper
  // finnes overalt). null = ingen treff/ikke spurt | { status:'done', items:[…] }.
  const naturtypeQuery = ref(null)
  let naturtypeQueryToken = 0
  // Nærmeste Wikipedia-sted (geosearch) ved long-press — uavhengig av verneområde.
  // null = ikke spurt | { status:'loading' } | { status:'done', place } | { status:'empty' }.
  const placeWikiQuery = ref(null)
  let placeWikiToken = 0
  const LONG_PRESS_MS = 550
  const LONG_PRESS_MOVE_PX = 10

  let lpTimer = null
  let lpPointerId = null
  let lpStartX = 0
  let lpStartY = 0
  let lpEvent = null      // siste pointerdown-event så vi kan re-projisere ved fire

  function clearLongPress() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null }
    lpPointerId = null
    lpEvent = null
  }

  // Klient-koordinat → viewBox-meter. Bruker den browser-uavhengige matte-
  // inversen fra useMapExtend (clientToSvg) i stedet for svg.getScreenCTM():
  // sistnevnte regner IKKE med CSS-transformen (pan/zoom/rotasjon) på kartets
  // forelder-wrapper på iOS/Safari, så long-press-punktet — og dermed Stifinner-
  // målet — havnet kilometer på avveie når kartet var panorert (v1.0.71).
  function clientToSvgPoint(clientX, clientY) {
    return clientToSvg ? clientToSvg(clientX, clientY) : null
  }

  function openContextMenuAt(clientX, clientY) {
    // Long-press skal være no-op mens et annet overlay (søk, on-the-fly) eier
    // UI-en, eller mens et ferskt kart fortsatt fyller inn detaljer
    // (detalj-insetet ville ellers vist halvbygd data).
    if (buildingOnTheFly.value || searchOpen.value ||
        fillingInDetails.value || sti.blocking.value) return
    const local = clientToSvgPoint(clientX, clientY)
    if (!local) return
    contextMenuPoint.value = {
      svgX: local.x, svgY: local.y,
      clientX, clientY,
    }
    contextMenuOpen.value = true
    contextDrawer.reset()
    closeDrawer()
    knobPanel.value = null   // FAB-panelet viker for kontekst-arket (unngå stablede sheets)
    // v9.3.3: INGEN auto-pan av hovedkartet. Brukeren har allerede plassert/
    // zoomet/rotert kartet slik de vil — å flytte det ved long-press var
    // forvirrende og ødela oversikten. Punktet vises i pin + detalj-inset.
  }

  function closeContextMenu() {
    contextMenuOpen.value = false
    contextMenuPoint.value = null
    contextActionState.value = 'idle'
    proximityPanelOpen.value = false
  }

  function onPointerDownLongPress(e) {
    // Kun primær single-pointer. Hvis en annen pointer allerede er aktiv (pinch),
    // avbryt timeren — det er en gest, ikke en long-press.
    if (lpPointerId != null) { clearLongPress(); return }
    // Ignorer høyreklikk her — den håndteres av contextmenu-eventet (som også
    // gir oss preventDefault på native browsermenyen).
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Ignorer tap inne på interaktive UI-elementer (knapper, drawer-håndtak,
    // kant-soner) — disse har egne klikk-handlere.
    if (e.target.closest('button, input, textarea, select, a, [data-extend-dir]')) return
    lpPointerId = e.pointerId
    lpStartX = e.clientX
    lpStartY = e.clientY
    lpEvent = { clientX: e.clientX, clientY: e.clientY }
    lpTimer = setTimeout(() => {
      if (lpEvent) openContextMenuAt(lpEvent.clientX, lpEvent.clientY)
      clearLongPress()
    }, LONG_PRESS_MS)
  }
  function onPointerMoveLongPress(e) {
    if (lpPointerId == null || e.pointerId !== lpPointerId) return
    const dx = e.clientX - lpStartX
    const dy = e.clientY - lpStartY
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) clearLongPress()
  }
  function onPointerUpLongPress(e) {
    if (lpPointerId != null && e.pointerId === lpPointerId) clearLongPress()
  }
  function onContextMenuEvent(e) {
    // Høyreklikk på desktop. preventDefault stopper browser-menyen.
    e.preventDefault()
    openContextMenuAt(e.clientX, e.clientY)
  }

  // Ligger SVG-punktet (meter-rom) inni et ferskvanns-polygon (ISOM 301 innsjø /
  // 302 tjern)? Brukes til å være ærlig om høyde: NHM_DTM er en bar-bakke-modell
  // uten retur over vann, så vannflater leses som nodata-fylt-til-0 («0 moh»).
  // Over innsjøer er den 0-en meningsløs (Tyrifjorden ligger på ~63 m, ikke 0),
  // så vi viser «ikke tilgjengelig» istedenfor en falsk høyde. Saltvann (303)
  // utelates med vilje — der ER havnivå ≈ 0 riktig.
  function pointOnFreshwater(svgX, svgY) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || typeof svg.createSVGPoint !== 'function') return false
    const paths = svg.querySelectorAll('g[data-iso="301"] path, g[data-iso="302"] path')
    if (!paths.length) return false
    const rootPt = svg.createSVGPoint()
    rootPt.x = svgX
    rootPt.y = svgY
    for (const path of paths) {
      if (typeof path.isPointInFill !== 'function') continue
      // getCTM(): path-lokalt → SVG-rot-bruker-rom (= viewBox-meter, der svgX/svgY
      // bor). Invers mapper punktet ned til path-ens eget rom før fill-testen, så
      // evt. transform på mellomliggende grupper håndteres. fill-rule evenodd
      // respekteres → øy-hull i innsjøen teller korrekt som land.
      const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
      let local = rootPt
      if (ctm) {
        try { local = rootPt.matrixTransform(ctm.inverse()) } catch { continue }
      }
      if (path.isPointInFill(local)) return true
    }
    return false
  }

  // Ligger punktet PÅ en vannflate (sjø ELLER ferskvann)? Punkt-i-fyll mot alle
  // vann-AREAL-koder (POLYGON_CODES-vannet i mapBuilder): 301/302 innsjø+elv-areal,
  // 303 sjø, 307 dybdeareal, 308/309. Linjer (304/305 elv/bekk) telles ikke — vi
  // vil bare avvise selve vannflaten. Brukes av Stifinner til å nekte start-/mål-
  // punkt i vann. Samme CTM-invers-mønster som pointOnFreshwater (øy-hull via
  // fill-rule evenodd teller som land).
  const WATER_AREA_SELECTOR = ['301', '302', '303', '307', '308', '309']
    .map(c => `g[data-iso="${c}"] path`).join(', ')
  function pointOnWater(svgX, svgY) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || typeof svg.createSVGPoint !== 'function') return false
    const paths = svg.querySelectorAll(WATER_AREA_SELECTOR)
    if (!paths.length) return false
    const rootPt = svg.createSVGPoint()
    rootPt.x = svgX
    rootPt.y = svgY
    for (const path of paths) {
      if (typeof path.isPointInFill !== 'function') continue
      const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
      let local = rootPt
      if (ctm) {
        try { local = rootPt.matrixTransform(ctm.inverse()) } catch { continue }
      }
      if (path.isPointInFill(local)) return true
    }
    return false
  }

  // Parse en linje-path-d ("M x,y L x,y ... M ...") til lister av [x,y]-punkter,
  // én per subpath. mapBuilder skriver kun M/L med komma-separerte tall.
  function parseLinePoints(d) {
    const subs = []
    for (const part of String(d).split('M')) {
      if (!part.trim()) continue
      const pts = []
      const re = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g
      let mm
      while ((mm = re.exec(part)) !== null) {
        const x = parseFloat(mm[1]), y = parseFloat(mm[2])
        if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
      }
      if (pts.length) subs.push(pts)
    }
    return subs
  }

  // Finn en navngitt vann-feature (elv/innsjø/bekk) som long-press-punktet ligger
  // PÅ — uavhengig av hvor feature-ens navne-anker (sentroid) er. Løser at en lang
  // elv (f.eks. Drammenselva) ellers taper mot et nærmere stedsnavn fordi
  // findNearestPlace kun måler avstand til anker-punktet, ikke til geometrien.
  //   1. Navngitte vann-AREALER (301/302/303): punkt-i-fyll. Velg minste areal
  //      ved overlapp (mest spesifikk feature).
  //   2. Navngitte vann-LINJER (304/305 elv/bekk): nærmeste punkt på polylinjen,
  //      ren matematikk (ingen layout-tvingende getPointAtLength). Toleransen
  //      skalerer med zoom (~14 px finger-treff) og clampes til [8, 60] m.
  function findWaterFeatureAtPoint(svgX, svgY) {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg || typeof svg.createSVGPoint !== 'function') return null
    const pt = svg.createSVGPoint()
    pt.x = svgX
    pt.y = svgY

    // 1) Vann-arealer — punkt-i-fyll (samme CTM-invers-mønster som pointOnFreshwater).
    let bestArea = null
    for (const path of svg.querySelectorAll(
      'g[data-iso="301"] path[data-name], g[data-iso="302"] path[data-name], g[data-iso="303"] path[data-name]')) {
      const name = path.getAttribute('data-name')?.trim()
      if (!name || typeof path.isPointInFill !== 'function') continue
      const ctm = typeof path.getCTM === 'function' ? path.getCTM() : null
      let local = pt
      if (ctm) { try { local = pt.matrixTransform(ctm.inverse()) } catch { continue } }
      if (!path.isPointInFill(local)) continue
      let area = Infinity
      try { const bb = path.getBBox(); area = bb.width * bb.height } catch { /* keep Infinity */ }
      if (!bestArea || area < bestArea.area) bestArea = { name, area }
    }
    if (bestArea) return { name: bestArea.name, kind: 'vann', onFeature: true, distM: 0, x: svgX, y: svgY }

    // 2) Vann-linjer — nærmeste-punkt-på-polylinje, zoom-skalert toleranse.
    let tolM = 30
    const wrap = wrapperRef.value?.getBoundingClientRect()
    const m = meta.value
    if (wrap && m && m.widthM && m.heightM) {
      const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
      const mPerPx = 1 / (fit * (scale.value || 1))
      if (Number.isFinite(mPerPx) && mPerPx > 0) tolM = Math.min(60, Math.max(8, 14 * mPerPx))
    }
    let bestLine = null
    for (const path of svg.querySelectorAll('g[data-iso="304"] path[data-name], g[data-iso="305"] path[data-name]')) {
      const name = path.getAttribute('data-name')?.trim()
      if (!name) continue
      const d = path.getAttribute('d')
      if (!d) continue
      for (const sub of parseLinePoints(d)) {
        const dist = pointToPolylineDist(svgX, svgY, sub)
        if (dist <= tolM && (!bestLine || dist < bestLine.distM)) bestLine = { name, distM: dist }
      }
    }
    if (bestLine) return { name: bestLine.name, kind: 'vann', onFeature: true, distM: bestLine.distM, x: svgX, y: svgY }
    return null
  }

  // Info-utregning når menyen er åpen. Cachet via computed slik at en åpen meny
  // ikke re-evaluerer på hver pinch (kun når contextMenuPoint, searchIndex eller
  // DEM endrer seg).
  const contextMenuInfo = computed(() => {
    const p = contextMenuPoint.value
    if (!p || !meta.value) return null
    const m = meta.value
    // Klamp til kart-bounds — long-press kan treffe utenfor SVG-content
    // pga letterboxing ved bredt aspekt-ratio.
    const inside = p.svgX >= 0 && p.svgX <= m.widthM && p.svgY >= 0 && p.svgY <= m.heightM
    const { lat, lon } = svgToWgs84(p.svgX, p.svgY, m)
    const ele = (storedDem.value && inside)
      ? sampleElevation(storedDem.value, p.svgX, p.svgY)
      : NaN

    // Geometri-bevisst stedsoppslag: ligger punktet PÅ en navngitt elv/innsjø/bekk,
    // vinner den over nærmeste navne-anker (ellers tapte lange elver mot et nærmere
    // stedsnavn). Faller tilbake til nærmeste-anker-heuristikken ellers.
    const waterHit = inside ? findWaterFeatureAtPoint(p.svgX, p.svgY) : null
    const place = waterHit ?? (inside ? findNearestPlace(mapSearch.index.value, p.svgX, p.svgY) : null)

    // NB: «nærmeste sti/vei»-utregningen er bevisst fjernet (v9.1.22).
    // findNearestPath sampler hver path i sti/vei/bekk-lagene med
    // getPointAtLength — en synkron, layout-tvingende operasjon som blokkerte
    // hovedtråden i sekunder på den ekte (CI-bygde) Vardåsen og frøs store
    // bruker-kart helt. Informasjonen er uansett synlig direkte på kartet.

    // Avstand fra brukerens GPS-posisjon (kun synlig når GPS-en er aktiv
    // og brukeren er på kartet). Retning fra meg → punktet.
    let fromUser = null
    if (userPos.isWatching && userPos.svgX != null && userPos.svgY != null) {
      const dx = p.svgX - userPos.svgX
      const dy = p.svgY - userPos.svgY
      const distM = Math.hypot(dx, dy)
      const deg = bearingDeg(userPos.svgX, userPos.svgY, p.svgX, p.svgY)
      fromUser = { distM, deg, compass: bearingToCompass(deg) }
    }

    // Over en innlands-vannflate er DEM-en nodata-fylt-til-0 → ikke vis falsk
    // høyde. To uavhengige signaler (robust mot at det ene svikter):
    //   1. SVG-treff i et ferskvanns-polygon (ISOM 301/302).
    //   2. DEM-artefakt: på et bekreftet INNLANDS-kart (meta.coastal === false)
    //      er en måling ≈ 0 m nødvendigvis vannflate-artefakten — ekte norsk
    //      innlands-terreng ligger aldri på havnivå. Fanger store innsjøer
    //      (Mjøsa/Tyrifjorden) selv når 301-treffet glipper. På kyst-/ukjente
    //      kart er 0 m ekte havnivå, så da slår ikke (2) inn.
    const onFreshwater = inside ? pointOnFreshwater(p.svgX, p.svgY) : false
    const inlandWaterArtifact = inside && Number.isFinite(ele) &&
      Math.abs(ele) < 0.5 && meta.value?.coastal === false
    const isWater = onFreshwater || inlandWaterArtifact

    return {
      lat, lon, inside,
      elevationM: (Number.isFinite(ele) && !isWater) ? ele : null,
      isWater,
      place,
      fromUser,
    }
  })

  // HydAPI-nøkkel — kun for lokal dev mot NVE direkte. I produksjon er den tom
  // og kallene går via Cloudflare-proxyen (cloudflare/nve-proxy/) som holder
  // nøkkelen server-side.
  const HYDAPI_KEY = import.meta.env.VITE_NVE_HYDAPI_KEY ?? ''

  // Long-press over (sannsynlig) vann → hent innsjø-data fra NVE Innsjødatabase
  // (vannflate-høyde + dyp/areal/volum/magasin når oppmålt). NHM_DTM leser ~0 m
  // over vann; NVE har de autoritative verdiene (Mjøsa ~123 m / 453 m dyp,
  // Tyrifjorden ~63 m). Token forkaster trege svar. Feiler NVE → 'error'/'empty'
  // → UI viser «ikke tilgjengelig» (aldri 0). Når innsjøen er funnet og en
  // HydAPI-nøkkel er satt, hentes sanntids vannstand/temperatur i et andre,
  // ikke-blokkerende steg (fyller lakeQuery.live når den lander).
  watch(contextMenuPoint, async (p) => {
    const token = ++lakeQueryToken
    lakeQuery.value = null
    if (!p || !contextMenuOpen.value) return
    const info = contextMenuInfo.value
    if (!info?.inside || !info.isWater) return   // bare slå opp når punktet er vann
    lakeQuery.value = { status: 'loading', live: null }
    try {
      const lake = await fetchLakeData(info.lat, info.lon)
      if (token !== lakeQueryToken) return        // brukeren har flyttet punktet
      if (!lake || !Number.isFinite(lake.hoyde)) {
        lakeQuery.value = { status: 'empty', live: null }
        return
      }
      lakeQuery.value = { status: 'done', lake, live: null }
      // Sanntids vannstand/temp via NVE-proxyen (ikke-blokkerende, graceful).
      fetchLiveWater(info.lat, info.lon, { apiKey: HYDAPI_KEY, lakeHoyde: lake.hoyde })
        .then((live) => {
          if (token === lakeQueryToken && live && lakeQuery.value?.status === 'done') {
            lakeQuery.value = { ...lakeQuery.value, live }
          }
        })
        .catch(() => { /* graceful: ingen sanntidslinje */ })
    } catch {
      if (token === lakeQueryToken) lakeQuery.value = { status: 'error', live: null }
    }
  })

  // Long-press hvor som helst på kartet → slå opp om punktet ligger i et
  // verneområde (Naturbase via Miljødirektoratet). Ved treff vises navn/verneform/
  // vernedato/areal umiddelbart, og to ikke-blokkerende kall fyller arts-/
  // observasjons-tellere (GBIF) og Wikipedia-ingress når de lander. Ingen treff →
  // ingen verne-seksjon. Token forkaster trege svar; cache gjør gjentatte oppslag
  // momentane (IndexedDB + minne, TTL pr kilde).
  watch(contextMenuPoint, async (p) => {
    const token = ++verneQueryToken
    verneQuery.value = null
    expandedRedCat.value = null
    if (!p || !contextMenuOpen.value) return
    const info = contextMenuInfo.value
    if (!info?.inside) return
    verneQuery.value = { status: 'loading' }
    try {
      const ptKey = pointKey(info.lat, info.lon)
      let area = await cacheGet(ptKey)
      if (!area) {
        area = await fetchProtectedArea(info.lat, info.lon)
        if (area) cacheSet(ptKey, area, TTL.vern)
      }
      if (token !== verneQueryToken) return
      if (!area) { verneQuery.value = null; return }
      verneQuery.value = { status: 'done', area, species: 'loading', wiki: 'loading' }
      loadVerneSpecies(token, area, info.lat, info.lon)
      loadVerneWiki(token, area)
    } catch {
      if (token === verneQueryToken) verneQuery.value = null
    }
  })

  // Long-press → slå opp NiN-naturtype-lokaliteter for punktet (Miljødirektoratet
  // «Naturtyper på land»). Uavhengig av verneområde-oppslaget over: naturtyper er
  // kartlagt i hele landet, ikke bare i verneområder. Cachet 30 dager. Ingen treff
  // (tom liste) eller utilgjengelig → ingen naturtype-seksjon.
  watch(contextMenuPoint, async (p) => {
    const token = ++naturtypeQueryToken
    naturtypeQuery.value = null
    if (!p || !contextMenuOpen.value) return
    const info = contextMenuInfo.value
    if (!info?.inside) return
    try {
      const key = naturtypePointKey(info.lat, info.lon)
      let items = await cacheGet(key)
      if (!items) {
        items = await fetchNaturtypes(info.lat, info.lon)
        if (items && items.length) cacheSet(key, items, TTL.naturtype)
      }
      if (token !== naturtypeQueryToken) return
      naturtypeQuery.value = (items && items.length) ? { status: 'done', items } : null
    } catch {
      if (token === naturtypeQueryToken) naturtypeQuery.value = null
    }
  })

  // Long-press hvor som helst → nærmeste Wikipedia-sted (geosearch). Gir fakta om
  // innsjø/fjelltopp/grend/elv/stedsnavn også UTENFOR verneområder. Cachet 7 dager
  // på ~100 m-grid. Ingen treff/utilgjengelig → ingen sted-seksjon. Kjører også
  // utenfor kart-bounds (koordinaten er gyldig uansett).
  watch(contextMenuPoint, async (p) => {
    const token = ++placeWikiToken
    placeWikiQuery.value = null
    if (!p || !contextMenuOpen.value) return
    const info = contextMenuInfo.value
    if (!info) return
    placeWikiQuery.value = { status: 'loading' }
    try {
      const key = placePointKey(info.lat, info.lon)
      let place = await cacheGet(key)
      if (!place) {
        // Nærmeste kartlabel (f.eks. «Glitre», «Bondivannet») som navne-hint, så
        // navn-søket kan disambiguere store features og bestemt/ubestemt form.
        place = await fetchNearestWikiPlace(info.lat, info.lon, { hintName: info.place?.name })
        if (place) {
          // SNL foretrekkes for TEKSTEN: Wikipedia-geosearch har allerede
          // identifisert og lokalisert featuren (koordinat-trygt), så her bytter vi
          // bare inn SNLs ingress/lenke for det bekreftede navnet og BEHOLDER
          // avstanden fra Wikipedia-ankeret. SNL har ingen koordinater.
          const snl = await fetchSnlSummary(place.title, { accept: placeNameMatches })
          if (snl) {
            place = { ...place, source: 'snl', title: snl.title, extract: snl.extract,
                      url: snl.url, thumbnail: snl.thumbnail ?? place.thumbnail }
          }
          // Den overordnede «første del»-artikkelen (selve stedet ved siden av
          // stasjonen/toppen): foretrekk SNL-lenken her også. KUN lenke + tittel —
          // ingen ingress-tekst, siden kortet viser teksten for den mest spesifikke.
          // Faller tilbake til Wikipedia-lenken fra wikiPlace; droppes hvis den
          // ender på samme URL som primær-lenken.
          if (place.secondary) {
            const snl2 = await fetchSnlSummary(place.secondary.title, { accept: placeNameMatches })
            const sec = snl2
              ? { ...place.secondary, source: 'snl', title: snl2.title, url: snl2.url }
              : place.secondary
            place = (sec.url && sec.url !== place.url)
              ? { ...place, secondary: sec }
              : { ...place, secondary: null }
          }
        } else if (info.place?.name) {
          // Ingen Wikipedia-treff i nærheten, men vi har et stedsnavn → siste utvei:
          // slå opp navnet i SNL (uten avstand, ingen koordinat-verifisering).
          const snl = await fetchSnlSummary(info.place.name, { accept: placeNameMatches })
          if (snl) place = { ...snl, lat: null, lon: null, distanceM: null }
        }
        if (place) cacheSet(key, place, TTL.wiki)
      }
      if (token !== placeWikiToken) return
      placeWikiQuery.value = place ? { status: 'done', place } : { status: 'empty' }
    } catch {
      if (token === placeWikiToken) placeWikiQuery.value = { status: 'empty' }
    }
  })

  // Sted-kortet vises kun når geosearch fant en artikkel, og IKKE når den er
  // identisk med verneområdets egen Wikipedia-lenke (unngå duplikat).
  const placeWikiCard = computed(() => {
    if (placeWikiQuery.value?.status !== 'done') return null
    const place = placeWikiQuery.value.place
    const w = verneQuery.value?.wiki
    const verneUrl = (w && w !== 'loading') ? w.url : null
    if (verneUrl && place.url && verneUrl === place.url) return null
    return place
  })

  // Kilde-etikett for lenke-/status-tekst. Oppslag kan komme fra SNL (foretrukket)
  // eller Wikipedia (fallback). Default Wikipedia for gamle cachede objekter uten kilde.
  const SOURCE_LABEL = { snl: 'Store norske leksikon', wikipedia: 'Wikipedia' }
  function sourceLabel(s) { return SOURCE_LABEL[s] ?? 'Wikipedia' }

  // Verdi-klasse for naturtype-badge: «svært høy»/«høy»/«svært viktig» → sterk
  // grønn, «moderat»/«viktig» → gulgrønn, «lav»/«lokalt» → dempet. Ukjent → nøytral.
  function naturtypeVerdiClass(verdi) {
    const v = String(verdi ?? '').toLowerCase()
    if (/sv[æa]rt h[øo]y|^h[øo]y|sv[æa]rt viktig/.test(v)) return 'bg-emerald-500/25 text-emerald-100 border-emerald-400/40'
    if (/moderat|^viktig/.test(v)) return 'bg-lime-500/20 text-lime-100 border-lime-400/35'
    if (/lav|lokalt/.test(v)) return 'bg-white/8 text-white/60 border-white/15'
    return 'bg-white/8 text-white/70 border-white/15'
  }

  // Arts-/observasjons-telling fra GBIF for verneområdet. Cachet 24 t på område-ID.
  // Bruker Naturbase-polygonet når det er i lon/lat, ellers en bbox rundt klikk-
  // punktet (robust mot at WFS-en leverer projiserte UTM-meter). Setter species
  // til objekt (treff) eller null (utilgjengelig).
  async function loadVerneSpecies(token, area, lat, lon) {
    const key = `species:${area.id}`
    try {
      let sp = await cacheGet(key)
      if (!sp) {
        sp = await fetchSpeciesSummary({ rings: area.rings, lat, lon, areaKm2: area.arealKm2 })
        if (sp) cacheSet(key, sp, TTL.species)
      }
      // Norsk rødliste: snitt GBIF-artene mot den bundlede Artsdatabanken-lista.
      // Dvale (returnerer null) hvis bundelen ennå ikke er generert → ingen linje.
      if (sp?.speciesKeys && !sp.redListNo) {
        const rl = await summarizeRedListed(sp.speciesKeys)
        if (rl) sp = { ...sp, redListNo: rl }
      }
      patchVerne(token, { species: sp ?? null })
    } catch {
      patchVerne(token, { species: null })
    }
  }

  // Wikipedia-ingress for verneområdet. Slår opp på fullt navn (navn + verneform)
  // før bart navn, så vi treffer «Storøya biotopvernområde» og ikke øya på
  // Svalbard. Cachet 7 dager på navn + verneform (nøkkelen forbi-cacher gamle
  // feil-treff lagret under bart navn).
  async function loadVerneWiki(token, area) {
    const navn = area?.navn
    if (!navn) { patchVerne(token, { wiki: null }); return }
    const key = `wiki2:${navn}|${area.verneform ?? ''}`   // v2: invaliderer pre-SNL cache
    try {
      let wiki = await cacheGet(key)
      if (!wiki) {
        // SNL foretrekkes; Wikipedia som fallback.
        wiki = await fetchSnlSummary(navn, { accept: titleMatches })
          ?? await fetchWikiSummary(navn, { verneform: area.verneform })
        if (wiki) cacheSet(key, wiki, TTL.wiki)
      }
      patchVerne(token, { wiki: wiki ?? null })
    } catch {
      patchVerne(token, { wiki: null })
    }
  }

  // Slå sammen et delvis resultat inn i verneQuery — kun hvis token fortsatt
  // gjelder og oppslaget er i 'done'-tilstand (brukeren kan ha flyttet punktet).
  function patchVerne(token, patch) {
    if (token === verneQueryToken && verneQuery.value?.status === 'done') {
      verneQuery.value = { ...verneQuery.value, ...patch }
    }
  }

  // Vernedato (ISO YYYY-MM-DD) → norsk dd.mm.yyyy. Faller tilbake til råverdi.
  function formatVernedato(iso) {
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
  }

  // Heltall med tusenskille (norsk: mellomrom). 1342 → «1 342».
  function formatCount(n) {
    return Number(n).toLocaleString('nb-NO')
  }

  // Rødliste-kategorier i alvorlighets-rekkefølge, med fullt norsk navn (tooltip) og
  // fargeklasse for kategori-chipene i kortet.
  const RED_CATS = [
    { code: 'CR', label: 'Kritisk truet', cls: 'text-rose-100 border-rose-400/50 bg-rose-500/20' },
    { code: 'EN', label: 'Sterkt truet', cls: 'text-rose-200 border-rose-400/40 bg-rose-500/15' },
    { code: 'VU', label: 'Sårbar', cls: 'text-amber-200 border-amber-400/40 bg-amber-500/15' },
    { code: 'NT', label: 'Nær truet', cls: 'text-amber-100/90 border-amber-300/30 bg-amber-400/10' },
  ]

  // Rødliste-kategorier som faktisk har treff, til kategori-chipene.
  function redListCats(byCat) {
    return RED_CATS.filter((c) => byCat?.[c.code] > 0)
  }

  // Artene i den utvidede kategorien, gruppert etter grov dyre-/plantegruppe.
  function redListGroups(redListNo, cat) {
    if (!redListNo || !cat) return []
    const inCat = (redListNo.species ?? []).filter((s) => s.category === cat)
    return groupSpecies(inCat)
  }

  // Veksle hvilken kategori som er foldet ut (accordion).
  function toggleRedCat(code) {
    expandedRedCat.value = expandedRedCat.value === code ? null : code
  }

  // Areal: under 1 km² vises med to desimaler (små vann), ellers heltall/én desimal.
  function formatAreaKm2(km2) {
    if (km2 < 1) return km2.toFixed(2)
    if (km2 < 100) return km2.toFixed(1)
    return String(Math.round(km2))
  }
  // Volum kommer i mill. m³ fra NVE. Store volum vises i km³ (1 km³ = 1000 mill m³).
  function formatVolum(millM3) {
    if (millM3 >= 1000) return `${(millM3 / 1000).toFixed(1)} km³`
    if (millM3 >= 1) return `${Math.round(millM3)} mill. m³`
    return `${(millM3 * 1e6).toFixed(0)} m³`
  }

  const contextActionState = ref('idle')   // 'idle' | 'copied' | 'failed'
  let contextActionTimer = null
  function flashContextAction(state) {
    contextActionState.value = state
    if (contextActionTimer) clearTimeout(contextActionTimer)
    contextActionTimer = setTimeout(() => { contextActionState.value = 'idle' }, 1400)
  }

  return {
    contextMenuOpen, contextMenuPoint, contextMenuInfo,
    lakeQuery, verneQuery, naturtypeQuery, placeWikiCard, expandedRedCat,
    clearLongPress, clientToSvgPoint, openContextMenuAt, closeContextMenu,
    onPointerDownLongPress, onPointerMoveLongPress, onPointerUpLongPress,
    onContextMenuEvent,
    pointOnFreshwater, pointOnWater, findWaterFeatureAtPoint,
    sourceLabel, naturtypeVerdiClass, formatVernedato, formatCount,
    redListCats, redListGroups, toggleRedCat, formatAreaKm2, formatVolum,
    contextActionState, flashContextAction,
  }
}
