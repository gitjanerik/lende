// Mosaikk + manuell kart-utvidelse — skilt ut fra MapView v1.0.8. Kanthåndtak
// (8 runde knapper på arkets kant) utvider bruttokartet i valgt retning; flisa
// under skjermsenter auto-promoteres til aktiv etter litt ro. Composablen eier
// bygge-/toast-tilstanden og håndtaks-geometrien; forelderen eier SVG-verten,
// transform-tilstanden og mosaikken (useGhostTiles), destrukturert inn.
// Watchene som driver re-render/aktiverings-sjekk ligger fortsatt i MapView.
import { ref, computed, nextTick } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { pruneAutoTiles, rectOverlapFraction, findGridGaps } from '../lib/tileCache.js'
import {
  lesVentende, leggTilVentende, fjernVentende,
  cellenokkel, ventendeSenter, ventendePaaArket, VENTENDE_RADIUS_TILES,
} from '../lib/ventendeFliser.js'

// Bokføringen over ventende fliser bor i lib/ventendeFliser.js — den er «hva
// mosaikken skylder å bygge» og har flere konsumenter enn kant-utvidelsen.
// Re-eksporteres her fordi den var offentlig herfra før uttrekket.
export {
  cellenokkel, ventendeSenter, ventendePaaArket, VENTENDE_RADIUS_TILES,
} from '../lib/ventendeFliser.js'

// Retnings-vokabular for de 8 kanthåndtakene (utvidelses-knappene). Norske ord
// for toast + etikett-pille, og pil-vinkelen (grader, opp = nord = 0°, med
// klokka) som knappen roteres med.
export const EXTEND_DIR_WORD = {
  N: 'nord', S: 'sør', E: 'øst', W: 'vest',
  NE: 'nordøst', NW: 'nordvest', SE: 'sørøst', SW: 'sørvest',
}
export const EXTEND_DIR_DEG = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
}

// Synlig knapp-tekst: «<Retning> i lende» (navne-flørt). aria-label beholder
// handlingen «Hent kartfliser mot <Retning> i lende». Ukjent retning → tom streng.
export function extendZoneLabelText(dir) {
  const w = EXTEND_DIR_WORD[dir]
  return w ? `${w.charAt(0).toUpperCase()}${w.slice(1)} i lende` : ''
}

// ── Kanthåndtak — ren geometri (ingen Vue-refs, testbar) ─────────────────────
// De 8 kompassrosene i kart-rommet er erstattet av runde DOM-knapper som sitter
// på ARKETS kant i skjerm-rommet (v2.4.13). Rekkefølgen er DOM-/tab-rekkefølgen
// fra designet: N → NØ → Ø → SØ → S → SV → V → NV.
export const EDGE_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
// Retningsvektor i skjerm-/SVG-koordinater (y vokser nedover → nord = −y).
export const EDGE_DIR_VEC = {
  N: { dx: 0, dy: -1 }, NE: { dx: 1, dy: -1 }, E: { dx: 1, dy: 0 }, SE: { dx: 1, dy: 1 },
  S: { dx: 0, dy: 1 }, SW: { dx: -1, dy: 1 }, W: { dx: -1, dy: 0 }, NW: { dx: -1, dy: -1 },
}
export const EDGE_HANDLE_INSET = 4                 // px innover fra arkkanten
export const EDGE_LABEL_OFFSET = { x: 88, y: 44 }  // pille-forskyvning innover (px)

// Ankeret på arkkanten (SVG-meter) for en retning, gitt mosaikk-bboksen.
// Kardinal = kant-midtpunkt, diagonal = hjørne.
export function edgeAnchorSvg(dir, b) {
  const v = EDGE_DIR_VEC[dir]
  if (!v || !b) return null
  return {
    x: v.dx < 0 ? b.minX : v.dx > 0 ? b.maxX : (b.minX + b.maxX) / 2,
    y: v.dy < 0 ? b.minY : v.dy > 0 ? b.maxY : (b.minY + b.maxY) / 2,
  }
}

// Knapp-rotasjon. Pil-ikonet peker opp i hvile; vi legger kart-rotasjonen til
// retningsvinkelen så pila peker mot den kanten den faktisk utvider PÅ SKJERMEN
// (håndtakene sitter på arket, som roterer med kartet).
export function edgeKnobDeg(dir, rotationDeg = 0) {
  const d = EXTEND_DIR_DEG[dir]
  return d == null ? null : d + (rotationDeg || 0)
}

// Etikett-pillens forskyvning INNOVER fra knappen (skjerm-px). Retningsvektoren
// roteres med kartet, og komponentene skaleres anisotropisk som i designet
// (88 px vannrett, 44 px loddrett) — ved rotasjon 0 er dette (−dx·88, −dy·44).
export function edgeLabelOffset(dir, rotationDeg = 0) {
  const v = EDGE_DIR_VEC[dir]
  if (!v) return null
  const r = (rotationDeg || 0) * Math.PI / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  return {
    lx: -(v.dx * cos - v.dy * sin) * EDGE_LABEL_OFFSET.x,
    ly: -(v.dx * sin + v.dy * cos) * EDGE_LABEL_OFFSET.y,
  }
}

// ── Skjerm ⇄ viewBox — rene matte-kjerner (ingen Vue-refs, testbare) ──────────
// Inverterer den unified CSS-transformen på kart-wrapperen (translate ∘ rotate ∘
// scale, transform-origin 0 0) pluss viewBox-letterboxen. Vi gjør dette i ren
// aritmetikk i STEDET for svg.getScreenCTM() fordi getScreenCTM på iOS/Safari
// ikke regner med CSS-transformen på kartets forelder-wrapper — long-press-punkt
// (og dermed Stifinner-mål) havnet kilometer på avveie når kartet var panorert.
// v = { w, h, widthM, heightM, scale, rotationDeg, tx, ty }.

// Wrapper-lokal skjerm-px (sx,sy fra wrapperens topp-venstre) → viewBox-meter.
export function screenToViewBox(sx, sy, v) {
  const fit = Math.min(v.w / v.widthM, v.h / v.heightM)
  const offX = (v.w - v.widthM * fit) / 2
  const offY = (v.h - v.heightM * fit) / 2
  const s = v.scale || 1
  const rot = (v.rotationDeg || 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const A = (sx - v.tx) / s
  const B = (sy - v.ty) / s
  const px = A * cos + B * sin
  const py = -A * sin + B * cos
  return { x: (px - offX) / fit, y: (py - offY) / fit }
}

// Invers: viewBox-meter (vx,vy) → wrapper-lokal skjerm-px.
export function viewBoxToScreen(vx, vy, v) {
  const fit = Math.min(v.w / v.widthM, v.h / v.heightM)
  const offX = (v.w - v.widthM * fit) / 2
  const offY = (v.h - v.heightM * fit) / 2
  const s = v.scale || 1
  const rot = (v.rotationDeg || 0) * Math.PI / 180
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const px = vx * fit + offX
  const py = vy * fit + offY
  const rx = px * cos - py * sin
  const ry = px * sin + py * cos
  return { x: v.tx + s * rx, y: v.ty + s * ry }
}

export function useMapExtend({
  wrapperRef, wrapperSize, meta, mapId, router,
  scale, rotation, translateX, translateY, isGesturing, panTo,
  loading, loadError, fillingInDetails,
  annot, measureMode, sti, searchOpen, showControls, drawer,
  ghostRects, GHOST_TRIGGER_SUPPRESS_FRAC, renderGhostTiles,
  currentTheme, visibleLayers, userPos, maxTiles, refreshAutoTileCount,
  closeDrawer, closeSearch,
  // Nøkkelen til flisa bakgrunns-byggingen jobber med akkurat nå, eller null.
  // Getter, fordi useAutoNabo opprettes ETTER denne composablen (TDZ-regelen i
  // CLAUDE.md). Uten den ville «Fyll hullene»-banneret blinket «1 hull» i de
  // 5–30 sekundene en bakgrunnsbygging tar: planen bokføres FØR byggingen (for
  // at et avbrutt bygg skal overleve en reload), og bokføringen er nettopp det
  // manglendeFliser leser.
  byggerNaaNokkel = () => null,
}) {
  // ── Mosaikk + manuell utvidelse ───────────────────────────────────────────
  // Arbeidsdelingen her (v5.19.0): DENNE composablen eier den EKSPLISITTE
  // utvidelsen — kanthåndtakene på arkkanten, som bygger en hel rad eller kolonne
  // bak en full-skjerm-loader fordi brukeren har bedt om den. Automatisk påfyll av
  // ÉN naboflis på dvele bor i useAutoNabo og er bevisst ikke-blokkerende.
  // Promotering på dvele (AUTO_PROMOTE_MS) er fortsatt her. Navn med
  // «autoMap»-prefiks dekker delt infrastruktur (bygge-opts, toast, modus-gate)
  // som begge bruker.
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
  // Antall HULL i mosaikken akkurat nå (manglende gitter-celler inni bruttoens
  // omsluttende rektangel). Oppdateres når mosaikken endrer seg; > 0 → MapView
  // tilbyr «Reparer» (C). Typisk etter en bygging avbrutt av reload/app-lukking.
  const mosaicGapCount = ref(0)

  // Kanthåndtak (manuell utvidelse): 8 runde DOM-knapper som sitter på ARKETS
  // kant — utenfor kart-transformen, så knapp/pille/hårlinje holder konstant
  // skjermstørrelse uansett zoom, men ANKERET følger arket når det vokser eller
  // roterer. De rendres av MapEdgeHandles.vue fra `edgeHandles`; geometrien
  // ligger på modul-nivå (edgeAnchorSvg / edgeKnobDeg / edgeLabelOffset), testbar.
  // Erstatter de 8 SVG-kompassrosene i kart-rommet (v2.4.13) — ingen rose-detaljer,
  // ingen permanente etiketter i kartflaten, ingen eksport-stripping å vedlikeholde.
  // Drawer-en dekker håndtakene kun når den er ÅPEN og i ekspandert tilstand
  // (mobil-bunnark). Når den er minimert titter bare fane-stripen opp (~32 px), så
  // håndtakene langs arkkanten er fortsatt synlige og klikkbare — da skal de ikke
  // skjules (v11.0.32). isMinimized er alltid false på desktop (side-panel), så
  // desktop-oppførselen er uendret.
  const drawerCoversCanvas = computed(() =>
    showControls.value && !drawer.isMinimized.value
  )
  // Bevisst sti.active (ikke sti.blocking): kartutvidelse bygger ny SVG med
  // nytt koordinat-origo og ville invalidert en rute i bruk (following).
  const extendZonesVisible = computed(() =>
    !loading.value && !loadError.value && !!meta.value &&
    !buildingOnTheFly.value && !fillingInDetails.value &&
    !annot.isAnnotateMode.value &&
    !measureMode.value && !sti.active.value && !searchOpen.value && !drawerCoversCanvas.value
  )

  // Yttergrensa for det som vises nå = aktiv flis ∪ alle spøkelses-rekter (samme
  // union som clampPan). Håndtakene ankres til DENNE kanten, ikke bare aktiv flis,
  // så de alltid står ytterst på arket — også etter at man har bygd et 2×2 brutto-kart.
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

  // ── Kanthåndtak — reaktiv tilstand ──────────────────────────────────────────
  // hoveredDir er efemer og driver KUN forhåndsvisningen (pille, spøkelsesceller
  // og nedskaleringen av arket). Settes på pointerenter/fokus (mus/tastatur) og
  // på trykk-og-hold (touch); nullstilles på pointerleave/blur og ved commit.
  const hoveredDir = ref(null)

  // Hvor mange NYE fliser koster en utvidelse i `dir` akkurat nå? Nøyaktig samme
  // filtrering som extendMap gjør, så «+N» på pilla er den faktiske kostnaden:
  // fra 1×1 koster en side 1 flis og et hjørne 3; på et 1×2-ark koster en side 1
  // eller 2. Fliser vi allerede har hoppes over.
  function extendTileCount(dir) {
    const m = meta.value
    if (!m) return 0
    const geom = extendMapGeometry(dir)
    if (!geom) return 0
    return geom.neighborCenters.filter((c) => !centerOverExistingTile(c, m)).length
  }
  // Cachet pr mosaikk-endring (meta + ghostRects) — IKKE pr pan-frame, som
  // edgeHandles er. extendMapGeometry allokerer rad/kolonne-arrays og skal ikke
  // kjøre åtte ganger for hver touchmove.
  const edgeTileCounts = computed(() => {
    const out = {}
    if (!meta.value) return out
    for (const dir of EDGE_DIRS) out[dir] = extendTileCount(dir)
    return out
  })

  // De 8 håndtakene i wrapper-lokale skjerm-px. Reaktiv på pan/zoom/rotasjon
  // (transform-refene) og på wrapper-størrelse (wrapperSize, satt av MapViews
  // ResizeObserver) — getBoundingClientRect er i seg selv ikke reaktiv.
  const edgeHandles = computed(() => {
    const size = wrapperSize?.value
    if (!size?.w || !size?.h || !extendZonesVisible.value) return []
    const v = transformView()
    if (!v) return []
    const b = extendZonesBounds()
    const mid = viewBoxToScreen((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, v)
    const counts = edgeTileCounts.value
    const out = []
    for (const dir of EDGE_DIRS) {
      const a = edgeAnchorSvg(dir, b)
      const p = viewBoxToScreen(a.x, a.y, v)
      // Trekk ankeret 4 px innover mot arkets senter (designets sheetW/2 − 4),
      // regnet i skjerm-rommet så det holder også når kartet er rotert.
      const ix = mid.x - p.x, iy = mid.y - p.y
      const n = Math.hypot(ix, iy) || 1
      const off = edgeLabelOffset(dir, v.rotationDeg)
      out.push({
        dir,
        name: extendZoneLabelText(dir),
        count: counts[dir] ?? 0,
        x: p.x + (ix / n) * EDGE_HANDLE_INSET,
        y: p.y + (iy / n) * EDGE_HANDLE_INSET,
        knobDeg: edgeKnobDeg(dir, v.rotationDeg),
        lx: off.lx,
        ly: off.ly,
      })
    }
    return out
  })

  // Forhåndsvisningen RØRER IKKE kartflaten (v2.4.14). Den gjorde to ting som
  // begge måtte gå:
  //
  //  1. Den skalerte kartet ned så hele det kommende arket fikk plass, og satte
  //     det tilbake ved slipp. Med åtte håndtak på arkkanten ble hver stryking
  //     over kanten en serie zoom-ut/zoom-inn — utvidelsen føltes som hopp og
  //     sprett. Kartet står nå bom stille.
  //  2. Den tegnet mørkegrå spøkelsesceller for flisene trykket ville hente.
  //     Kart-transformen animeres over 200 ms mens cellene er absolutt-
  //     posisjonerte og hopper rett til sluttkoordinatene, så på mobil (der
  //     trykk-og-hold er hele interaksjonen) lå de grå feltene oppå det ennå
  //     ikke ferdig-animerte kartet. Cellene er fjernet helt.
  //
  // Det som er igjen er knappen som vokser og pilla «<Retning> i lende +N» —
  // ingenting males i kartflaten, og «+N» sier presist hva trykket koster.
  // Fjerningen tok også med seg et helt problemkompleks: da arket flyttet seg,
  // gled håndtaket vekk under en stillestående peker, nettleseren fyrte
  // pointerenter/-leave på layout-flyttingen, og visningen blinket i en løkke.
  // Står kartet stille, holder vanlig pointerenter/-leave.
  function previewExtend(dir) {
    if (!EDGE_DIR_VEC[dir] || !extendZonesVisible.value) return
    hoveredDir.value = dir
  }
  function clearExtendPreview() {
    hoveredDir.value = null
  }

  function showAutoMapToast(msg) {
    autoMapToast.value = msg
    if (autoMapToastTimer) clearTimeout(autoMapToastTimer)
    autoMapToastTimer = setTimeout(() => { autoMapToast.value = '' }, 3500)
  }

  // Viewbox-koordinaten (SVG-meter) som ligger midt på skjermen akkurat nå.
  // Invers av forward-transformen i applyNameLOD/panTo: SVG fyller wrapperen med
  // preserveAspectRatio="xMidYMid meet", deretter M = T(tx,ty)∘R(rot)∘S(s).
  // Nåværende transform-tilstand for de rene matte-kjernene (screenToViewBox /
  // viewBoxToScreen). null når kartet ikke er målbart ennå.
  function transformView() {
    const m = meta.value
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!m || !wrap || !wrap.width || !wrap.height) return null
    return {
      wrap, w: wrap.width, h: wrap.height, widthM: m.widthM, heightM: m.heightM,
      scale: scale.value || 1, rotationDeg: rotation.value || 0,
      tx: translateX.value, ty: translateY.value,
    }
  }
  function visibleCenterSvg() {
    const v = transformView()
    return v ? screenToViewBox(v.w / 2, v.h / 2, v) : null
  }
  // Klient-koordinat (viewport-px fra en pointer-event) → viewBox-meter.
  // Browser-uavhengig (se screenToViewBox); brukes av long-press og kart-tapp.
  function clientToSvg(clientX, clientY) {
    const v = transformView()
    return v ? screenToViewBox(clientX - v.wrap.left, clientY - v.wrap.top, v) : null
  }
  // Invers av clientToSvg: viewBox-meter → klient-koordinat (viewport-px).
  // Plasserer long-press-pinnen browser-uavhengig (matcher clientToSvg eksakt).
  function svgToClient(vx, vy) {
    const v = transformView()
    if (!v) return null
    const local = viewBoxToScreen(vx, vy, v)
    return { x: v.wrap.left + local.x, y: v.wrap.top + local.y }
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

  // Bokføringen (lesVentende/leggTilVentende/fjernVentende) ligger i
  // lib/ventendeFliser.js — se notatet der for HVORFOR utvidelsen skriver ned
  // planen sin før den bygger.

  // Finnes det alt en flis (aktiv eller nabo) som dekker dette senteret?
  function flisFinnes(c, m) {
    const nyRect = { x: c.x - m.widthM / 2, y: c.y - m.heightM / 2, w: m.widthM, h: m.heightM }
    const aktiv = { x: 0, y: 0, w: m.widthM, h: m.heightM }
    if (rectOverlapFraction(nyRect, aktiv) > GHOST_TRIGGER_SUPPRESS_FRAC) return true
    return ghostRects.value.some(g => rectOverlapFraction(nyRect, g) > GHOST_TRIGGER_SUPPRESS_FRAC)
  }

  // Bokførte fliser som fortsatt mangler PÅ DETTE arket: hører spesifikasjonen
  // hjemme her (ventendePaaArket), og finnes den ikke alt som flis?
  function ventendeFliser() {
    const m = meta.value
    if (!m || m.minE == null) return []
    return lesVentende().filter((spek) => {
      const c = ventendePaaArket(spek, m)
      return !!c && !flisFinnes(c, m)
    })
  }

  // Manuell kant-sone-utvidelse. Navigerer IKKE — det aktive kartet beholdes, de
  // nye flisene vises som fullopake mosaikk-naboer og vi panorerer sentrum til
  // grensen/hjørnet med BEHOLDT zoom. Derfor rydder vi loader/state selv i finally.
  let extendingMap = false
  async function extendMap(direction) {
    clearExtendPreview()
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
    // Bokfør planen FØR byggingen. Blir økta avbrutt her — reload, app-lukking,
    // en flis som feiler — er dette det eneste sporet av hva som skulle bygges.
    const plan = toBuild.map(({ center, utmBbox }) => ({ opts: autoMapBuildOpts(center), utmBbox }))
    leggTilVentende(plan)
    let tegnet = false
    try {
      for (let i = 0; i < toBuild.length; i++) {
        const prefix = toBuild.length > 1 ? `Utsnitt ${i + 1}/${toBuild.length}` : ''
        buildingProgress.value = toBuild.length > 1
          ? `Bygger utsnitt ${i + 1} av ${toBuild.length} …`
          : 'Bygger nytt utsnitt …'
        const { id } = await buildMapFromCenter({
          ...plan[i].opts,
          utmBbox: toBuild[i].utmBbox,   // eksakt ±W/±H-offset → flukter med aktiv flis
          terrainFirst: false,   // full flis med en gang
          onProgress: (msg) => {
            buildingProgress.value = prefix ? `${prefix}: ${msg}` : msg
          },
        })
        if (id) {
          builtIds.push(id)
          fjernVentende(toBuild[i].utmBbox)   // denne er i boks
        }
      }
      // Tegn de nye flisene som mosaikk-naboer (fullopake, full detalj) og utvid
      // pan-grensa til mosaikken (renderGhostTiles → clampPan), så panTo ikke
      // klampes tilbake til aktiv-flisas grenser.
      await renderGhostTiles()
      tegnet = true
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
      // Feilet løkka, rakk vi aldri å tegne det som FAKTISK ble bygd — og
      // banneret om det som mangler leses av mosaikken. Tegn derfor uansett, og
      // tell på nytt: det er dette som gjør at «Fyll hullene» dukker opp med en
      // gang i stedet for ved neste tilfeldige mosaikk-endring.
      if (!tegnet) {
        try {
          await renderGhostTiles()
          await nextTick()
        } catch { /* mosaikk-render er fail-safe */ }
      }
      buildingOnTheFly.value = false
      buildingProgress.value = ''
      autoMapArmed = true
      extendingMap = false
      refreshMosaicGaps()
    }
  }

  // ── Mosaikk-reparasjon ──────────────────────────────────────────────────────
  // Bygging avbrutt av reload/app-lukking (eller en feilet nabo-flis) etterlater
  // et ark som ikke er ferdig. Det som mangler kommer fra TO kilder, og de dekker
  // hver sin feilmåte:
  //
  //   • BOKFØRINGEN (ventendeFliser) — utvidelsen skrev ned hva den skulle bygge.
  //     Presis, ingen falske positive, og den fanger hakk i ytterkanten, som er
  //     nettopp det en avbrutt utvidelse etterlater.
  //   • GEOMETRIEN (findGridGaps) — innelukkede hull. Dekker ark som ble ødelagt
  //     FØR bokføringen fantes, og fliser kappet ut av cachen (pruneAutoTiles)
  //     lenge etter at utvidelsen var ferdig. Der finnes ingen bokføring.
  //
  // De slås sammen på celle-identitet, så en flis som begge finner tilbys én gang.

  // Manglende gitter-celler → byggespesifikasjoner (SVG-senter + eksakt UTM-bbox,
  // utledet identisk med extendMapGeometry så de flukter bit-eksakt med aktiv flis).
  function mosaicGapCells() {
    const m = meta.value
    if (!m || m.minE == null) return []
    const gaps = findGridGaps({ w: m.widthM, h: m.heightM }, ghostRects.value)
    return gaps.map((g) => {
      const sx = g.col * m.widthM, sy = g.row * m.heightM
      const minE = Math.round(m.minE + sx)
      const maxN = Math.round(m.maxN - sy)
      return {
        center: { x: sx + m.widthM / 2, y: sy + m.heightM / 2 },
        utmBbox: { minE, maxE: minE + Math.round(m.widthM), minN: maxN - Math.round(m.heightM), maxN },
      }
    })
  }
  // Alt som mangler på arket, som ferdige byggespesifikasjoner.
  function manglendeFliser() {
    const m = meta.value
    if (!m || m.minE == null) return []
    const ut = []
    const sett = new Set()
    // Flisa en bakgrunnsbygging holder på med er ikke et HULL — den er under
    // arbeid. Uten dette blinker «Fyll hullene» gjennom hele byggetida.
    const underArbeid = byggerNaaNokkel()
    if (underArbeid) sett.add(underArbeid)
    const leggTil = (opts, utmBbox) => {
      const n = cellenokkel(utmBbox)
      if (!n || sett.has(n)) return
      sett.add(n)
      ut.push({ opts, utmBbox })
    }
    // Bokføringen først: den er den presise kilden.
    for (const s of ventendeFliser()) leggTil(s.opts, s.utmBbox)
    for (const c of mosaicGapCells()) leggTil(autoMapBuildOpts(c.center), c.utmBbox)
    return ut
  }
  function refreshMosaicGaps() {
    mosaicGapCount.value = manglendeFliser().length
  }

  // Fyll alle mosaikk-hull. Bygger hver manglende celle (samme flyt som extendMap:
  // buildMapFromCenter isAuto + eksakt utmBbox), tegner mosaikken på nytt og kapper
  // cachen. Ikke-destruktivt — rører aldri eksisterende fliser. Krever nett.
  async function repairMosaicGaps() {
    if (extendingMap || buildingOnTheFly.value || fillingInDetails.value) return
    if (autoMapModeBusy()) return
    const m = meta.value
    if (!m) return
    const cells = manglendeFliser()
    if (!cells.length) { refreshMosaicGaps(); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showAutoMapToast('Offline — kan ikke fylle hull')
      return
    }
    extendingMap = true
    autoMapArmed = false
    buildingOnTheFly.value = true
    buildingProgress.value = 'Forbereder …'
    closeDrawer()
    closeSearch()
    const builtIds = []
    let failed = 0
    try {
      // Per-flis feilhåndtering: én flis som feiler (f.eks. Overpass nede) skal
      // ikke forkaste flisene som lyktes — vi bygger så mange som mulig og
      // tegner mosaikken på nytt uansett i finally.
      for (let i = 0; i < cells.length; i++) {
        const prefix = cells.length > 1 ? `Hull ${i + 1}/${cells.length}` : ''
        buildingProgress.value = cells.length > 1
          ? `Fyller hull ${i + 1} av ${cells.length} …`
          : 'Fyller hull i kartet …'
        try {
          const { id } = await buildMapFromCenter({
            ...cells[i].opts,
            utmBbox: cells[i].utmBbox,
            terrainFirst: false,
            onProgress: (msg) => {
              buildingProgress.value = prefix ? `${prefix}: ${msg}` : msg
            },
          })
          if (id) {
            builtIds.push(id)
            fjernVentende(cells[i].utmBbox)
          } else failed++
        } catch (e) {
          console.error('Hull-flis feilet:', e)
          failed++
        }
      }
    } finally {
      // Tegn mosaikken på nytt så det som FAKTISK ble bygd vises (også ved delvis
      // feil), kapp cachen og re-tell hull → banneret speiler ny tilstand.
      try {
        await renderGhostTiles()
        await nextTick()
      } catch { /* noop — mosaikk-render er fail-safe */ }
      if (builtIds.length) {
        try {
          const ll = svgToWgs84(m.widthM / 2, m.heightM / 2, m)
          pruneAutoTiles({ center: { lat: ll.lat, lon: ll.lon }, max: maxTiles.value, protectIds: [mapId.value, ...builtIds] })
            .then(() => { void refreshAutoTileCount() })
            .catch(() => {})
        } catch { /* svgToWgs84 feilet → hopp over pruning */ }
      }
      buildingOnTheFly.value = false
      buildingProgress.value = ''
      autoMapArmed = true
      extendingMap = false
      refreshMosaicGaps()
      if (builtIds.length && !failed) {
        showAutoMapToast(builtIds.length === 1 ? 'Fylte hullet i kartet' : `Fylte ${builtIds.length} hull i kartet`)
      } else if (builtIds.length && failed) {
        showAutoMapToast(`Fylte ${builtIds.length} hull, ${failed} gjenstår`)
      } else {
        showAutoMapToast('Kunne ikke fylle hull — prøv igjen')
      }
    }
  }

  return {
    buildingOnTheFly, buildingProgress, autoMapToast, currentMapIsAuto,
    drawerCoversCanvas, extendZonesVisible, activatableTile, mosaicGapCount,
    edgeHandles, hoveredDir, previewExtend, clearExtendPreview,
    showAutoMapToast,
    visibleCenterSvg, clientToSvg, svgToClient, scheduleActivatableCheck, autoMapModeBusy,
    autoMapBuildOpts, promoteTile, extendMap, armAutoMap,
    extendZonesBounds, teardownMapExtend,
    refreshMosaicGaps, repairMosaicGaps,
    // Eksponert for useAutoNabo — bakgrunnsbyggingen bruker NØYAKTIG samme
    // geometri og samme «har vi den alt?»-test som kanthåndtakene, så en
    // automatisk hentet flis lander bit-eksakt på samme gitter.
    extendMapGeometry, centerOverExistingTile,
  }
}
