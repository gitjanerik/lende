// Mosaikk + manuell kart-utvidelse — skilt ut fra MapView v1.0.8 (kode
// uendret). Kant-soner (8 prikker i kart-rommet) utvider bruttokartet i valgt
// retning; flisa under skjermsenter auto-promoteres til aktiv etter litt ro.
// Composablen eier bygge-/toast-tilstanden; forelderen eier SVG-verten,
// transform-tilstanden og mosaikken (useGhostTiles), destrukturert inn.
// Watchene som driver re-render/aktiverings-sjekk ligger fortsatt i MapView.
import { ref, computed, nextTick } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { pruneAutoTiles, rectOverlapFraction } from '../lib/tileCache.js'

// Retnings-vokabular for de 8 kant-sonene (utvidelses-knappene). Norske ord for
// toast + kompassrose-tekst, og arm-vinkelen (SVG-grader, opp = nord = 0°, med
// klokka) som avgjør hvilken kompassrose-arm som males rød.
export const EXTEND_DIR_WORD = {
  N: 'nord', S: 'sør', E: 'øst', W: 'vest',
  NE: 'nordøst', NW: 'nordvest', SE: 'sørøst', SW: 'sørvest',
}
export const EXTEND_DIR_DEG = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
}
// Kompassrose-farger (faste, uavhengig av tema — som dagens kant-sone-farge).
export const EXTEND_ROSE = { grey: '#7d7566', red: '#d8392c', dark: '#4a4436', disc: 'rgba(251,247,236,0.72)' }

// Synlig knapp-tekst: «<Retning> i lende» (navne-flørt). aria-label beholder
// handlingen «Utvid mot <retning>». Ukjent retning → tom streng.
export function extendZoneLabelText(dir) {
  const w = EXTEND_DIR_WORD[dir]
  return w ? `${w.charAt(0).toUpperCase()}${w.slice(1)} i lende` : ''
}

export function useMapExtend({
  svgHostRef, wrapperRef, meta, mapId, router,
  scale, rotation, translateX, translateY, isGesturing, panTo,
  loading, loadError, fillingInDetails,
  annot, measureMode, sti, searchOpen, showControls, drawer,
  ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC, renderGhostTiles,
  currentTheme, visibleLayers, userPos, maxTiles, refreshAutoTileCount,
  closeDrawer, closeSearch,
}) {
  // ── Mosaikk + manuell utvidelse ───────────────────────────────────────────
  // Den AUTOMATISKE auto-karten (bygg-på-dvele/prefetch/promotér-på-dvele) er
  // fjernet — brukeren utvider eksplisitt via kant-sonene (#extend-zones) og gjør
  // en nabo-flis aktiv via en knapp. Mosaikk-rendering (renderGhostTiles) og
  // tile-cachen (pruneAutoTiles) beholdes. Navn med «autoMap»-prefiks beholdes der
  // de nå dekker delt infrastruktur (bygge-opts, toast, modus-gate).
  const buildingOnTheFly = ref(false)  // full-screen loader-flagg (gjenbrukes)
  const buildingProgress = ref('')
  const autoMapToast = ref('')      // transient melding (offline, flyttet, utvidet)
  let autoMapToastTimer = null
  let autoMapOfflineNotified = false   // offline-toast vises kun én gang
  let autoMapArmed = true              // bygge-lås (extendMap/promoteTile)
  // loadMap re-armerer låsen etter hvert kart-bytte (flyttet hit v1.0.9 —
  // v1.0.8 mistet variabelen ut av forelder-scopet: «autoMapArmed is not
  // defined» ved kart-lasting).
  function armAutoMap() { autoMapArmed = true }
  // Rydd timerne ved unmount (kalles fra MapViews onUnmounted).
  function teardownMapExtend() {
    if (activatableTimer) clearTimeout(activatableTimer)
    clearAutoPromote()
    if (autoMapToastTimer) clearTimeout(autoMapToastTimer)
  }
  // Om kartet som vises NÅ ble auto-/utvidelses-generert (settes fra init-prefs).
  const currentMapIsAuto = ref(false)

  // Kant-soner (manuell utvidelse, auto-kart AV): 8 diskrete kompassroser tegnet
  // som EKTE SVG-elementer i kart-SVG-en (gruppe #extend-zones). De lever i kart-
  // rommet og panner/zoomer/roterer med kartet, så de er IKKE synlige før brukeren
  // enten zoomer ut eller panorerer forbi en kant (da kommer canvas-marginen utenfor
  // flisa til syne). De fjernes ved eksport/utskrift (se mapSvgMarkupForExport +
  // stripRuntimeOverlays). Rosene mot-skaleres til konstant skjermstørrelse.
  const EXTEND_ZONE_DIRS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']
  const EXTEND_ZONE_LABEL = {
    N: 'Utvid mot nord', S: 'Utvid mot sør', E: 'Utvid mot øst', W: 'Utvid mot vest',
    NE: 'Utvid mot nordøst', NW: 'Utvid mot nordvest',
    SE: 'Utvid mot sørøst', SW: 'Utvid mot sørvest',
  }
  const EXTEND_ZONE_OFF = 30    // hvor langt UTENFOR kanten knappen sitter (px)
  // Kompassrose-knapper: hver kant-sone er en liten 8-armet kompassrose med ÉN
  // rød arm som peker retningen den utvider, pluss teksten «<Retning> i lende».
  // Rosa ligger i kart-rommet → den roterer med kartet (rød arm følger terrenget);
  // teksten mot-roteres til vannrett av applyUprightLabels (samme som stedsnavn).
  // SVG-y vokser nedover, arm-base peker opp = nord = 0°, med klokka.
  // (EXTEND_DIR_DEG / EXTEND_ROSE / EXTEND_DIR_WORD ligger på modul-nivå, testbare.)
  // Drawer-en dekker kant-sonene kun når den er ÅPEN og i ekspandert tilstand
  // (mobil-bunnark). Når den er minimert titter bare fane-stripen opp (~32 px), så
  // prikkene som sitter utenfor kart-kanten er fortsatt synlige og klikkbare —
  // da skal de ikke skjules (v11.0.32). isMinimized er alltid false på desktop
  // (side-panel), så desktop-oppførselen er uendret.
  const drawerCoversCanvas = computed(() =>
    showControls.value && !drawer.isMinimized.value
  )
  const extendZonesVisible = computed(() =>
    !loading.value && !loadError.value && !!meta.value &&
    !buildingOnTheFly.value && !fillingInDetails.value &&
    !annot.isAnnotateMode.value &&
    !measureMode.value && !sti.active.value && !searchOpen.value && !drawerCoversCanvas.value
  )

  // Mot-skalerings-faktor: 1 base-enhet i en kant-sone-gruppe rendres som 1 skjerm-
  // piksel, uavhengig av zoom. SVG fyller wrapperen med fit = min(w/W, h/H), og
  // kart-CSS-transformen legger på scale; vi nuller begge ut.
  function extendZoneScaleK() {
    const m = meta.value
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!m || !wrap?.width || !wrap?.height) return null
    const fit = Math.min(wrap.width / m.widthM, wrap.height / m.heightM)
    if (!(fit > 0)) return null
    return 1 / (fit * (scale.value || 1))
  }

  // Yttergrensa for det som vises nå = aktiv flis ∪ alle spøkelses-rekter (samme
  // union som clampPan). Prikkene ankres til DENNE kanten, ikke bare aktiv flis, så
  // de alltid står ytterst i canvas — også etter at man har bygd et 2×2 brutto-kart.
  function extendZonesBounds() {
    const m = meta.value
    let minX = 0, minY = 0, maxX = m.widthM, maxY = m.heightM
    for (const g of ghostRects.value) {
      if (g.x < minX) minX = g.x
      if (g.y < minY) minY = g.y
      if (g.x + g.w > maxX) maxX = g.x + g.w
      if (g.y + g.h > maxY) maxY = g.y + g.h
    }
    return { minX, minY, maxX, maxY }
  }

  // Anker (på selve mosaikk-kanten) + utover-offset (i base-piksler) pr retning.
  // SVG-y vokser nedover → nord = mindre y.
  function extendZoneAnchor(direction, b) {
    const c = 0.7071   // diagonal-komponent (45°) så hjørne-prikker står like langt ut
    const O = EXTEND_ZONE_OFF
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
    switch (direction) {
      case 'N': return { ax: cx, ay: b.minY, ox: 0, oy: -O }
      case 'S': return { ax: cx, ay: b.maxY, ox: 0, oy: O }
      case 'E': return { ax: b.maxX, ay: cy, ox: O, oy: 0 }
      case 'W': return { ax: b.minX, ay: cy, ox: -O, oy: 0 }
      case 'NE': return { ax: b.maxX, ay: b.minY, ox: O * c, oy: -O * c }
      case 'NW': return { ax: b.minX, ay: b.minY, ox: -O * c, oy: -O * c }
      case 'SE': return { ax: b.maxX, ay: b.maxY, ox: O * c, oy: O * c }
      case 'SW': return { ax: b.minX, ay: b.maxY, ox: -O * c, oy: O * c }
      default: return null
    }
  }

  // Oppdater bare scale-komponenten på de eksisterende kant-sone-gruppene (billig,
  // kjøres på zoom-watch). Ankeret (translate) er uendret.
  function updateExtendZoneScale() {
    const g = svgHostRef.value?.querySelector('#extend-zones')
    if (!g) return
    const k = extendZoneScaleK()
    if (k == null) return
    for (const z of g.querySelectorAll('[data-extend-dir]')) {
      z.setAttribute('transform', `translate(${z.dataset.ax} ${z.dataset.ay}) scale(${k})`)
    }
  }

  // Tegn (eller fjern) de 8 kant-sonene som SVG-elementer i den aktive flisa.
  function renderExtendZones() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    svg.querySelector('#extend-zones')?.remove()
    if (!extendZonesVisible.value) return
    const m = meta.value
    const k = extendZoneScaleK()
    if (!m || k == null) return
    const bounds = extendZonesBounds()
    const ns = 'http://www.w3.org/2000/svg'
    const g = document.createElementNS(ns, 'g')
    g.setAttribute('id', 'extend-zones')
    // Containeren slipper gjennom pan-gester; kun prikkene fanger tap.
    g.setAttribute('pointer-events', 'none')
    for (const dir of EXTEND_ZONE_DIRS) {
      const a = extendZoneAnchor(dir, bounds)
      if (!a) continue
      const zone = document.createElementNS(ns, 'g')
      zone.setAttribute('data-extend-dir', dir)
      zone.dataset.ax = String(a.ax)
      zone.dataset.ay = String(a.ay)
      zone.setAttribute('transform', `translate(${a.ax} ${a.ay}) scale(${k})`)
      zone.setAttribute('pointer-events', 'auto')
      zone.setAttribute('cursor', 'pointer')
      zone.setAttribute('role', 'button')
      zone.setAttribute('aria-label', EXTEND_ZONE_LABEL[dir])
      const mk = (tag, attrs) => {
        const e = document.createElementNS(ns, tag)
        for (const [an, av] of Object.entries(attrs)) e.setAttribute(an, String(av))
        return e
      }
      // 8-armet kompassrose sentrert på (a.ox, a.oy). Armen på dir-vinkelen er rød.
      const rose = mk('g', { transform: `translate(${a.ox} ${a.oy})` })
      rose.appendChild(mk('circle', { r: 21, fill: EXTEND_ROSE.disc }))
      rose.appendChild(mk('circle', { r: 19, fill: 'none', stroke: EXTEND_ROSE.grey, 'stroke-width': 1, opacity: 0.5 }))
      const dirDeg = EXTEND_DIR_DEG[dir]
      for (let i = 0; i < 8; i++) {
        const ang = i * 45
        const card = i % 2 === 0
        const len = card ? 18 : 11.5
        const w = card ? 3.6 : 2.8
        const active = ang === dirDeg
        const yb = (-len * 0.42).toFixed(2)
        rose.appendChild(mk('polygon', {
          transform: `rotate(${ang})`,
          points: `0,0 ${w},${yb} 0,${-len} ${-w},${yb}`,
          fill: active ? EXTEND_ROSE.red : EXTEND_ROSE.grey,
          opacity: active ? 1 : (card ? 0.8 : 0.5),
        }))
      }
      rose.appendChild(mk('circle', { r: 2.4, fill: EXTEND_ROSE.dark }))
      zone.appendChild(rose)
      // Tekst «<Retning> i lende» like utenfor rosa (utover fra kartsenter).
      const TD = 30
      const norm = Math.hypot(a.ox, a.oy) || 1
      const ux = a.ox / norm, uy = a.oy / norm
      const anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle'
      const text = mk('text', {
        x: (a.ox + ux * TD).toFixed(1),
        y: (a.oy + uy * TD).toFixed(1),
        'data-extend-text': dir,
        'text-anchor': anchor,
        'dominant-baseline': 'central',
        style: "font-family: var(--land-font, 'Inter Variable'), system-ui, sans-serif;"
          + ' font-size: 13px; font-weight: 700; fill: #161616;'
          + ' stroke: #fbf7ec; stroke-width: 3; paint-order: stroke; stroke-linejoin: round;',
      })
      text.textContent = extendZoneLabelText(dir)
      zone.appendChild(text)
      zone.addEventListener('click', (ev) => { ev.stopPropagation(); extendMap(dir) })
      g.appendChild(zone)
    }
    svg.appendChild(g)
  }

  function showAutoMapToast(msg) {
    autoMapToast.value = msg
    if (autoMapToastTimer) clearTimeout(autoMapToastTimer)
    autoMapToastTimer = setTimeout(() => { autoMapToast.value = '' }, 3500)
  }

  // Viewbox-koordinaten (SVG-meter) som ligger midt på skjermen akkurat nå.
  // Invers av forward-transformen i applyNameLOD/panTo: SVG fyller wrapperen med
  // preserveAspectRatio="xMidYMid meet", deretter M = T(tx,ty)∘R(rot)∘S(s).
  function visibleCenterSvg() {
    const m = meta.value
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!m || !wrap || !wrap.width || !wrap.height) return null
    const w = wrap.width, h = wrap.height
    const fit = Math.min(w / m.widthM, h / m.heightM)
    const offX = (w - m.widthM * fit) / 2
    const offY = (h - m.heightM * fit) / 2
    const s = scale.value || 1
    const rot = (rotation.value || 0) * Math.PI / 180
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const tx = translateX.value, ty = translateY.value
    // Skjermsenter (wrapper-lokalt). Løs (X,Y) = T + s·R·(px,py) for (px,py),
    // deretter trekk fra letterbox-offset / del på fit for viewBox-koordinat.
    const A = (w / 2 - tx) / s
    const B = (h / 2 - ty) / s
    const px = A * cos + B * sin
    const py = -A * sin + B * cos
    return { x: (px - offX) / fit, y: (py - offY) / fit }
  }

  // «Gjør aktiv»-deteksjon: når skjermsenteret glir inn på en nabo-flis (utenfor
  // aktiv flis, inni en spøkelses-rect) eksponerer vi den som `activatableTile`.
  // v11.0.34: ingen manuell knapp lenger — flisa under senter auto-promoteres til
  // aktiv flis etter litt ro (AUTO_PROMOTE_MS). Gated mot måling/annotering/spill/
  // drawer via autoMapModeBusy, og promoteTile er sømløs (ingen spinner, beholder
  // zoom/posisjon), så byttet er usynlig for brukeren — det holder bare «aktiv
  // flis = den du faktisk ser på», som videre utvidelse (kant-soner) refererer til.
  const activatableTile = ref(null)   // { id, x, y, w, h, isAuto } eller null
  let activatableTimer = null
  let autoPromoteTimer = null
  const AUTO_PROMOTE_MS = 1500
  function clearAutoPromote() {
    if (autoPromoteTimer) { clearTimeout(autoPromoteTimer); autoPromoteTimer = null }
  }
  function scheduleActivatableCheck() {
    if (activatableTimer) clearTimeout(activatableTimer)
    clearAutoPromote()   // bevegelse nullstiller ro-telleren for auto-promotering
    activatableTimer = setTimeout(() => {
      if (isGesturing && isGesturing.value) { scheduleActivatableCheck(); return }
      updateActivatableTile()
    }, 250)
  }
  function updateActivatableTile() {
    clearAutoPromote()
    if (!ghostRects.value.length || autoMapModeBusy() || buildingOnTheFly.value || fillingInDetails.value) {
      activatableTile.value = null
      return
    }
    const m = meta.value
    const c = visibleCenterSvg()
    if (!m || !c) { activatableTile.value = null; return }
    // Fortsatt på aktiv flis → ingen kandidat.
    if (c.x >= 0 && c.x <= m.widthM && c.y >= 0 && c.y <= m.heightM) {
      activatableTile.value = null
      return
    }
    activatableTile.value = ghostRects.value.find(
      r => c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h
    ) ?? null
    // Kandidat funnet og senteret står i ro → auto-promoter etter en kort dvale.
    if (activatableTile.value) {
      autoPromoteTimer = setTimeout(maybeAutoPromote, AUTO_PROMOTE_MS)
    }
  }
  // Promoter flisa under senter til aktiv, men kun hvis den fortsatt er gyldig når
  // dvale-timeren fyrer (brukeren kan ha pannet/zoomet videre i mellomtiden).
  function maybeAutoPromote() {
    autoPromoteTimer = null
    const g = activatableTile.value
    if (!g) return
    if (autoMapModeBusy() || buildingOnTheFly.value || fillingInDetails.value) return
    if (isGesturing && isGesturing.value) { autoPromoteTimer = setTimeout(maybeAutoPromote, AUTO_PROMOTE_MS); return }
    const c = visibleCenterSvg()
    if (!c) return
    if (c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h) {
      promoteTile(g, c)
    }
  }

  // Felles gate: ikke kjør auto-kart-logikk når et annet modus eier UI-en
  // (måling, annotering, søk, åpen drawer) — da er skjermsenteret dekket
  // eller irrelevant.
  function autoMapModeBusy() {
    return annot.isAnnotateMode.value ||
           measureMode.value || sti.active.value || searchOpen.value || drawerCoversCanvas.value
  }

  // Bygge-parametre for en ny flis sentrert på et SVG-punkt (samme størrelse +
  // ekvidistanse som dagens kart). Brukes av kant-sone-utvidelsen.
  function autoMapBuildOpts(centerSvg) {
    const m = meta.value
    const { lat, lon } = svgToWgs84(centerSvg.x, centerSvg.y, m)
    const stamp = new Date().toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
    return {
      center: { lat, lon, name: 'Utvidelse' },
      halfKm: +(m.widthM / 2000).toFixed(3),
      // Arv den aktive flisas aspekt (høyde/bredde) så nabo-flisa får NØYAKTIG
      // samme dimensjoner → mosaikken flukter sømløst uansett om flisa er A-format
      // (v10.1.23) eller eldre skjerm-format. Uten dette ville en ny flis falt
      // tilbake til viewportAspect() og fått feil høyde → glipper i mosaikken.
      aspect: +(m.heightM / m.widthM).toFixed(5),
      equidistanceM: m.equidistance ?? 20,
      navn: `Tur ${stamp}`,
      isAuto: true,   // markér som auto-flis → inngår i tileCache (kappes, ikke brukerkart)
    }
  }

  // ── Manuell kart-utvidelse (kant-soner) ─────────────────────────────────────
  // 8 klikkbare kant-soner utvider HELE det (firkantede) bruttokartet i valgt
  // retning, så formatet alltid forblir rektangulært: en kardinal-knapp (N/S/Ø/V)
  // bygger en hel rad/kolonne langs den siden, en diagonal (NV/NØ/SV/SØ) bygger ny
  // rad + ny kolonne + hjørne (vokser begge dimensjoner med 1). Allerede-bygde
  // fliser hoppes over (centerOverExistingTile), så man betaler kun for det som
  // mangler. Sentrum flyttes til grensen/hjørnet; zoom beholdes. Gjenbruker
  // mosaikken: buildMapFromCenter (isAuto) + renderGhostTiles.

  // Geometri for en kant-sone i aktiv-flisas SVG-meter-rom, basert på YTTERGRENSA
  // til hele bruttokartet (aktiv flis ∪ alle nabofliser). Returnerer senter for hver
  // nye flis som trengs for å holde bruttoen rektangulær + pan-punktet (grense-midt
  // for kardinal, hjørne for diagonal). SVG-y vokser nedover → nord = mindre y.
  function extendMapGeometry(direction) {
    const m = meta.value
    if (!m) return null
    const W = m.widthM, H = m.heightM
    const b = extendZonesBounds()   // { minX, minY, maxX, maxY } — bruttoens union
    const e = 1                     // innover-nudge i meter
    const cols = Math.max(1, Math.round((b.maxX - b.minX) / W))
    const rows = Math.max(1, Math.round((b.maxY - b.minY) / H))
    // En vertikal kolonne (rows fliser) med venstrekant ved xLeft.
    const colAt = (xLeft) => Array.from({ length: rows },
      (_, r) => ({ x: xLeft + W / 2, y: b.minY + (r + 0.5) * H }))
    // En horisontal rad (cols fliser) med toppkant ved yTop.
    const rowAt = (yTop) => Array.from({ length: cols },
      (_, c) => ({ x: b.minX + (c + 0.5) * W, y: yTop + H / 2 }))
    const midX = (b.minX + b.maxX) / 2, midY = (b.minY + b.maxY) / 2
    let neighborCenters, panPoint
    switch (direction) {
      case 'N': neighborCenters = rowAt(b.minY - H); panPoint = { x: midX, y: b.minY + e }; break
      case 'S': neighborCenters = rowAt(b.maxY); panPoint = { x: midX, y: b.maxY - e }; break
      case 'E': neighborCenters = colAt(b.maxX); panPoint = { x: b.maxX - e, y: midY }; break
      case 'W': neighborCenters = colAt(b.minX - W); panPoint = { x: b.minX + e, y: midY }; break
      case 'NE': neighborCenters = [...colAt(b.maxX), ...rowAt(b.minY - H), { x: b.maxX + W / 2, y: b.minY - H / 2 }]; panPoint = { x: b.maxX - e, y: b.minY + e }; break
      case 'NW': neighborCenters = [...colAt(b.minX - W), ...rowAt(b.minY - H), { x: b.minX - W / 2, y: b.minY - H / 2 }]; panPoint = { x: b.minX + e, y: b.minY + e }; break
      case 'SE': neighborCenters = [...colAt(b.maxX), ...rowAt(b.maxY), { x: b.maxX + W / 2, y: b.maxY + H / 2 }]; panPoint = { x: b.maxX - e, y: b.maxY - e }; break
      case 'SW': neighborCenters = [...colAt(b.minX - W), ...rowAt(b.maxY), { x: b.minX - W / 2, y: b.maxY + H / 2 }]; panPoint = { x: b.minX + e, y: b.maxY - e }; break
      default: return null
    }
    // Autoritativ UTM-bboks per nabo, utledet med eksakt heltalls-offset fra aktiv
    // flis' (allerede rutenett-snappede) UTM-extent. Hver senter-celle har topp-
    // venstre (c.x - W/2, c.y - H/2) i aktiv SVG-meter-rom; SVG-y vokser nedover =
    // UTM-nord nedover, så maxN speiles om aktiv maxN. Siden b.minX/b.minY er
    // heltalls-multipla av W/H fra aktiv origo, lander hver nabo bit-eksakt på
    // aktiv-gitteret → mosaikken flukter uten søm (buildMapFromCenter bruker denne
    // direkte, ingen re-snapping). Avrund til hele meter mot float-rest.
    const neighborBboxes = neighborCenters.map((c) => {
      const sx = c.x - W / 2, sy = c.y - H / 2
      const minE = Math.round(m.minE + sx)
      const maxN = Math.round(m.maxN - sy)
      return { minE, maxE: minE + Math.round(W), minN: maxN - Math.round(H), maxN }
    })
    return { neighborCenters, neighborBboxes, panPoint }
  }

  // Ville en ny flis sentrert i `c` (samme størrelse som aktiv flis)
  // vesentlig duplisere en spøkelses-flis vi allerede har? I så fall skal vi IKKE
  // bygge nytt — man «scroller tilbake» til en flis vi har (steg 3 promoterer den
  // til full detalj). Returnerer true hvis overlapp med en spøkelse er stor nok.
  function centerOverExistingTile(c, m) {
    if (!ghostRects.value.length) return false
    const newRect = { x: c.x - m.widthM / 2, y: c.y - m.heightM / 2, w: m.widthM, h: m.heightM }
    return ghostRects.value.some(g => rectOverlapFraction(newRect, g) > GHOST_TRIGGER_SUPPRESS_FRAC)
  }

  // Gjør spøkelses-flisa `g` til aktiv flis (eksplisitt «Gjør dette til hovedkart»).
  // Bytter via router (oppdaterer mapId → annoteringer, spor, DEM bindes korrekt for
  // den nye flisa). promoteView i init-prefs lar loadMap panne slik at samme
  // geografiske punkt blir liggende under skjermsenter etter skiftet, og loadMap
  // hopper over full-skjerm-loaderen for promoteringer (peek på promoteView-pref)
  // → sømløst bytte, ingen spinner.
  function promoteTile(g, c) {
    const centerG = { x: c.x - g.x, y: c.y - g.y }   // c uttrykt i g's eget meter-rom
    try {
      sessionStorage.setItem(`mapview-init-prefs:${g.id}`, JSON.stringify({
        theme: currentTheme.value,
        layers: Array.from(visibleLayers.value),
        autoStartGps: userPos.isWatching,
        isAutoMap: !!g.isAuto,
        promoteView: { x: centerG.x, y: centerG.y, scale: scale.value, rotation: rotation.value },
      }))
    } catch { /* noop */ }
    activatableTile.value = null
    router.replace({ name: 'kart-vis', params: { id: g.id } })
  }

  // Manuell kant-sone-utvidelse. Navigerer IKKE — det aktive kartet beholdes, de
  // nye flisene vises som fullopake mosaikk-naboer og vi panorerer sentrum til
  // grensen/hjørnet med BEHOLDT zoom. Derfor rydder vi loader/state selv i finally.
  let extendingMap = false
  async function extendMap(direction) {
    if (extendingMap || buildingOnTheFly.value || fillingInDetails.value) return
    if (autoMapModeBusy()) return
    const m = meta.value
    if (!m) return
    const geom = extendMapGeometry(direction)
    if (!geom) return
    // Offline-gate: bygging krever nett (OSM Overpass + Kartverket WCS).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!autoMapOfflineNotified) {
        autoMapOfflineNotified = true
        showAutoMapToast('Offline — kan ikke lage nytt utsnitt')
      }
      return
    }
    // Hopp over naboer vi allerede har en (rutenett-flukta) flis for — da gir en
    // ny flis på samme senter ≈100 % overlapp med en eksisterende spøkelses-flis.
    const toBuild = geom.neighborCenters
      .map((center, i) => ({ center, utmBbox: geom.neighborBboxes[i] }))
      .filter(({ center }) => !centerOverExistingTile(center, m))
    if (!toBuild.length) {
      panTo(geom.panPoint.x, geom.panPoint.y, {
        vbWidth: m.widthM, vbHeight: m.heightM,
        targetScale: scale.value, keepRotation: true,
      })
      showAutoMapToast('Allerede bygd — flytter dit')
      return
    }
    extendingMap = true
    autoMapArmed = false
    buildingOnTheFly.value = true
    buildingProgress.value = 'Forbereder …'
    closeDrawer()
    closeSearch()
    const builtIds = []
    try {
      for (let i = 0; i < toBuild.length; i++) {
        const prefix = toBuild.length > 1 ? `Utsnitt ${i + 1}/${toBuild.length}` : ''
        buildingProgress.value = toBuild.length > 1
          ? `Bygger utsnitt ${i + 1} av ${toBuild.length} …`
          : 'Bygger nytt utsnitt …'
        const { id } = await buildMapFromCenter({
          ...autoMapBuildOpts(toBuild[i].center),
          utmBbox: toBuild[i].utmBbox,   // eksakt ±W/±H-offset → flukter med aktiv flis
          terrainFirst: false,   // full flis med en gang
          onProgress: (msg) => {
            buildingProgress.value = prefix ? `${prefix}: ${msg}` : msg
          },
        })
        if (id) builtIds.push(id)
      }
      // Tegn de nye flisene som mosaikk-naboer (fullopake, full detalj) og utvid
      // pan-grensa til mosaikken (renderGhostTiles → clampPan), så panTo ikke
      // klampes tilbake til aktiv-flisas grenser.
      await renderGhostTiles()
      await nextTick()
      panTo(geom.panPoint.x, geom.panPoint.y, {
        vbWidth: m.widthM, vbHeight: m.heightM,
        targetScale: scale.value, keepRotation: true,
      })
      // Kapp auto-flis-cachen til bruker-valgt grense, beskytt aktiv flis + det vi
      // nettopp bygde.
      try {
        const ll = svgToWgs84(geom.panPoint.x, geom.panPoint.y, m)
        pruneAutoTiles({ center: { lat: ll.lat, lon: ll.lon }, max: maxTiles.value, protectIds: [mapId.value, ...builtIds] })
          .then(() => { void refreshAutoTileCount() })
          .catch(() => {})
      } catch { /* svgToWgs84 feilet → hopp over pruning */ }
      showAutoMapToast(`Utvidet kartet mot ${EXTEND_DIR_WORD[direction]}`)
    } catch (e) {
      console.error('Kant-sone-utvidelse feilet:', e)
      showAutoMapToast('Kunne ikke lage nytt utsnitt')
    } finally {
      buildingOnTheFly.value = false
      buildingProgress.value = ''
      autoMapArmed = true
      extendingMap = false
    }
  }

  return {
    buildingOnTheFly, buildingProgress, autoMapToast, currentMapIsAuto,
    drawerCoversCanvas, extendZonesVisible, activatableTile,
    renderExtendZones, updateExtendZoneScale, showAutoMapToast,
    visibleCenterSvg, scheduleActivatableCheck, autoMapModeBusy,
    autoMapBuildOpts, promoteTile, extendMap, armAutoMap,
    extendZonesBounds, teardownMapExtend,
  }
}
