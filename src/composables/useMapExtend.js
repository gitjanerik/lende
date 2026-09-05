// Mosaikk + manuell kart-utvidelse — skilt ut fra MapView v1.0.8. Kanthåndtak
// (8 trekanter rett utenfor arkets kant) utvider bruttokartet i valgt retning; flisa
// under skjermsenter auto-promoteres til aktiv etter litt ro. Composablen eier
// bygge-/toast-tilstanden og håndtaks-geometrien; forelderen eier SVG-verten,
// transform-tilstanden og mosaikken (useGhostTiles), destrukturert inn.
// Watchene som driver re-render/aktiverings-sjekk ligger fortsatt i MapView.
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { pruneAutoTiles, rectOverlapFraction, findGridGaps, findRectangleGaps } from '../lib/tileCache.js'
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
// De 8 kompassrosene i kart-rommet er erstattet av DOM-håndtak som sitter på
// ARKETS kant i skjerm-rommet (v2.4.13; trekanter rett utenfor kanten fra
// v5.25.5, runde knapper på kanten før det). Rekkefølgen er DOM-/tab-rekkefølgen
// fra designet: N → NØ → Ø → SØ → S → SV → V → NV.
export const EDGE_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
// Retningsvektor i skjerm-/SVG-koordinater (y vokser nedover → nord = −y).
export const EDGE_DIR_VEC = {
  N: { dx: 0, dy: -1 }, NE: { dx: 1, dy: -1 }, E: { dx: 1, dy: 0 }, SE: { dx: 1, dy: 1 },
  S: { dx: 0, dy: 1 }, SW: { dx: -1, dy: 1 }, W: { dx: -1, dy: 0 }, NW: { dx: -1, dy: -1 },
}
// Trekantens mål (px) — likesidet, og den samme for alle åtte. Utstikket er
// halve høyden, fordi trekant-boksen er sentrert på håndtakets punkt: da faller
// BASEN nøyaktig på arkkanten (kardinal) eller med midtpunktet i hjørnet
// (diagonal), og hele trekanten står utenfor kartet. Fram til v5.25.5 var dette
// 4 px INNOVER med en 38 px rund knapp oppå — se MapEdgeHandles.vue.
export const EDGE_TRI_SIDE = 26
export const EDGE_TRI_HEIGHT = EDGE_TRI_SIDE * Math.sqrt(3) / 2   // ≈ 22.5
export const EDGE_HANDLE_UTSTIKK = EDGE_TRI_HEIGHT / 2            // ≈ 11.3 px utover
// Hjørne-håndtakene har RETT vinkel og ikke 60° (v5.25.6). Grunnen er geometrisk:
// en 90° vinkel dreid 45° får beina parallelle med arkets to kanter, så merket
// leser som et hjørne-merke på arket i stedet for en pil som tilfeldigvis står
// på skrå. Beinet er 19 px, litt kortere enn kardinalenes 26, fordi det ligger
// langs kanten og ikke på tvers av den.
export const EDGE_HJORNE_BEIN = 19
export const EDGE_LABEL_OFFSET = { x: 88, y: 44 }  // pille-forskyvning innover (px)

/** Klamp `v` inn i [lo, hi]. Tåler at lo > hi (bittesmå viewporter) — da midtstilles. */
export function klamp(v, lo, hi) {
  if (!(hi > lo)) return (lo + hi) / 2
  return Math.min(Math.max(v, lo), hi)
}

// Hvor mye av kartet fyller skjermen? Får mer enn ÉN flis plass i bredden, ser
// brukeren på arket som helhet og ikke på en bestemt flis.
//
// Terskelen brukes til å skru av auto-promotering under oversikts-zoom. Se
// notatet ved serHeleArket i composablen for hva som gikk galt uten den.
// Rotasjon ignoreres med vilje: dette er en grov terskel, ikke en eksakt boks.
export const OVERSIKT_FRAC = 0.9

/** @param {{w:number,h:number,widthM:number,heightM:number,scale:number}} v */
export function erOversikt(v, frac = OVERSIKT_FRAC) {
  if (!v || !(v.widthM > 0) || !(v.heightM > 0) || !(v.w > 0) || !(v.h > 0)) return false
  const fit = Math.min(v.w / v.widthM, v.h / v.heightM)
  if (!(fit > 0)) return false
  const synligBreddeM = v.w / (fit * (v.scale || 1))
  return synligBreddeM > v.widthM * frac
}

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

// Enhetsvektoren UTOVER fra arkkanten, rotert med kartet — samme akse som
// trekanten peker langs, og samme uttrykk som edgeLabelOffset negerer for å
// peke innover. Den regnes fra RETNINGEN og ikke fra «ankeret minus arkets
// senter»: for et avlangt ark går senter→hjørne ikke i 45°, så et
// senter-avledet utstikk ville skjøvet hjørne-trekantene på skrå av sin egen
// spiss. Diagonalene normaliseres, ellers ville de stukket √2 så langt ut.
export function edgeUtRetning(dir, rotationDeg = 0) {
  const v = EDGE_DIR_VEC[dir]
  if (!v) return null
  const n = Math.hypot(v.dx, v.dy) || 1
  const dx = v.dx / n, dy = v.dy / n
  const r = (rotationDeg || 0) * Math.PI / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

/** Er dette et hjørne-håndtak (diagonal), altså det som tegnes med rett vinkel? */
export function erHjorne(dir) {
  const v = EDGE_DIR_VEC[dir]
  return !!v && v.dx !== 0 && v.dy !== 0
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

// ── Kanthåndtak — trygg ramme, nærhet og dokking (v5.25.2) ───────────────────
// Fram til v5.25.1 var alle åtte håndtakene ALLTID synlige og klampet 28 px inn
// fra viewportens ytterkant. De var dermed tilgjengelige, men landet under
// toppbaren, modus-chipsene, målestokken og FAB-klyngen — og en knapp man ser
// men ikke kan trykke er verre enn en knapp som ikke er der.
//
// To regler avløser klampen, og de deler den samme TRYGGE RAMMEN: rektangelet i
// kart-wrapperen der ingen annen kontroll bor.
//
//   NÆRHET   — er ankeret på arkkanten innenfor rammen (pluss litt slakk), står
//              håndtaket PÅ arkkanten og følger den gjennom pan/zoom/rotasjon.
//              Det er svaret på «gjør knappene tilgjengelig når brukeren nærmer
//              seg ytterkanten»: panorerer du mot nord, kommer nord-håndtaket
//              til syne av seg selv, og bare det.
//   DOKKING  — er ankeret utenfor, finnes ikke arkkanten på skjermen. Håndtaket
//              dokker til en FAST plass på rammen (hjørne eller kant-midtpunkt),
//              og vises bare i et kort vindu etter en handling som viser
//              formatet: kartet blir klart, «Sentrer» trykkes, en utvidelse er
//              ferdig, eller man holder inne et håndtak.
//
// Hvilke akser en retning bryr seg om følger retningsvektoren: nord-håndtaket
// skal komme fram når nordkanten er på skjermen, uansett hvor langt øst man har
// panorert, mens nordøst krever at HJØRNET er nært. Derfor testes bare de aksene
// der komponenten er ulik null.

// Plassen de andre kontrollene tar, i wrapper-px. Tallene er målt mot chromet:
// toppbaren (safe-area + 40 px knapp + 12 px luft) og modus-chip-raden under den
// (--ovl-top = 4rem + safe-top, ~58 px høy) i toppen; målestokk/attribusjon
// (~32 px) og FAB-klyngen (48 px + 12 px bunnluft) i bunnen. Safe-area er bakt
// inn i slakken framfor å leses ut: `--safe-top` er en env()-verdi, og
// getComputedStyle gir custom properties uoppløst.
// Sidene har INGEN chrome — 30 px fram til v5.25.4 var bare en marg, og den
// gjorde at de dokkede side-håndtakene fløt inne PÅ kartet i stedet for å ligge
// langs kanten av det. 16 px setter trekant-spissen ~5 px fra viewportkanten:
// den flukter med kartets ytterkant, som er hele poenget med formen. Toppen og
// bunnen er derimot ekte chrome og står urørt.
export const EDGE_FRAME_CHROME = { top: 168, bottom: 96, side: 16 }

// Slakk rundt rammen før et anker regnes som «nært». 96 px ≈ to knappebredder:
// håndtaket dukker opp litt før arkkanten faktisk glir inn i den frie flaten, så
// det er framme når man trenger det og ikke først når kanten er passert.
export const EDGE_NAERHET_PX = 96

/**
 * Den frie flaten i wrapperen — rammen både nærhets-testen og dokkingen bruker.
 * Kollapser rammen (lav landskaps-viewport, desktop-panel som spiser bredden),
 * midtstilles den framfor å inverteres.
 */
export function edgeSafeFrame(size, chrome = EDGE_FRAME_CHROME) {
  if (!size?.w || !size?.h) return null
  let minX = chrome.side, maxX = size.w - chrome.side
  let minY = chrome.top, maxY = size.h - chrome.bottom
  if (minX > maxX) { minX = maxX = size.w / 2 }
  if (minY > maxY) { minY = maxY = size.h / 2 }
  return { minX, minY, maxX, maxY }
}

/**
 * Fast dokk-plass på rammen for en retning — kant-midtpunkt for kardinaler,
 * hjørne for diagonaler. Samme form som edgeAnchorSvg, men i skjerm-px og på
 * rammen i stedet for arket: dette ER det statiske åtte-knapp-oppsettet, og
 * plassene er faste, så dokkede håndtak kan aldri havne oppå hverandre.
 */
export function edgeStaticSlot(dir, frame) {
  const v = EDGE_DIR_VEC[dir]
  if (!v || !frame) return null
  return {
    x: v.dx < 0 ? frame.minX : v.dx > 0 ? frame.maxX : (frame.minX + frame.maxX) / 2,
    y: v.dy < 0 ? frame.minY : v.dy > 0 ? frame.maxY : (frame.minY + frame.maxY) / 2,
  }
}

/**
 * Er arkkanten denne retningen utvider PÅ nær nok den frie flaten til at
 * håndtaket skal stå på selve kanten? Bare aksene retningen har en komponent på
 * teller — se notatet over.
 * @param {{x:number,y:number}} p ankeret i wrapper-px
 */
export function edgeAnkerNaer(dir, p, frame, slakk = EDGE_NAERHET_PX) {
  const v = EDGE_DIR_VEC[dir]
  if (!v || !p || !frame) return false
  if (v.dx !== 0 && !(p.x >= frame.minX - slakk && p.x <= frame.maxX + slakk)) return false
  if (v.dy !== 0 && !(p.y >= frame.minY - slakk && p.y <= frame.maxY + slakk)) return false
  return true
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
}) {
  // ── Mosaikk + manuell utvidelse ───────────────────────────────────────────
  // ARKET UTVIDES BARE PÅ BESTILLING (v6.5.22). Kanthåndtakene på arkkanten er
  // den eneste veien: åtte piler som bygger en rad eller kolonne, med kostnaden
  // skrevet på. Automatisk påfyll av nabofliser på dvele fantes (useAutoNabo,
  // v5.19.0) og er FJERNET — se CHANGELOG. Promotering på dvele
  // (AUTO_PROMOTE_MS) er noe annet og står fortsatt: den navigerer mellom
  // fliser som ALLEREDE finnes, den bygger ingenting. Navn med «autoMap»-prefiks
  // dekker delt infrastruktur (bygge-opts, toast, modus-gate).
  const buildingOnTheFly = ref(false)  // full-screen loader-flagg (gjenbrukes)
  // Utvidelsen er ikke-blokkerende, men den kan ta et halvminutt per flis — og
  // fram til v6.5.48 fantes det ingen vei ut av den. Avbryteren aborterer den
  // flisa som er under arbeid og stopper løkka mellom fliser; det som ALLEREDE
  // er bygd beholdes og tegnes i finally, som er den samme stien en flis som
  // feiler går. Ventelista er derfor fortsatt sannheten om hva som gjenstår.
  let byggAvbryter = null
  function avbrytUtvidelse() { byggAvbryter?.abort() }
  const buildingProgress = ref('')
  // RETNINGEN BYGGE-CHIPEN VISER (v6.5.22). Den fôrer flis-ikonet — arket i
  // miniatyr, med rutene som ligger i retningen blinkende — og er null for alt
  // annet enn en kant-utvidelse. Null betyr «vi vet ikke hvor», og ikonet svarer
  // med et helt ark der alt jobber, som er sant for en utfylling til firkant.
  // Ikke utled den av `hoveredDir`: den følger pekeren og er borte i det man
  // slipper håndtaket, altså nøyaktig når byggingen starter.
  const byggerFlisRetning = ref(null)
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
    if (avslorTimer) clearTimeout(avslorTimer)
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

  // Arkets størrelse i fliser. Samme cols/rows-regning som extendMapGeometry,
  // men reaktiv, fordi bygge-chipens ikon tegner arket i miniatyr og trenger å
  // vite om det er en stripe eller et rutenett.
  const arkRutenett = computed(() => {
    const m = meta.value
    if (!m) return { cols: 1, rows: 1 }
    const b = extendZonesBounds()
    return {
      cols: Math.max(1, Math.round((b.maxX - b.minX) / m.widthM)),
      rows: Math.max(1, Math.round((b.maxY - b.minY) / m.heightM)),
    }
  })

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

  // ── Avsløring — det korte vinduet der DOKKEDE håndtak vises ────────────────
  // Et håndtak som står på arkkanten (nært) er alltid synlig: det er brukeren som
  // har panorert dit, og knappen ligger der arket faktisk vokser. Et DOKKET
  // håndtak er derimot en påstand om en retning man ikke ser kanten av, og åtte
  // slike permanent langs skjermkanten leses som chrome — ikke som arkets kant.
  // De vises derfor bare rett etter en handling som viser formatet.
  const AVSLOR_MS = 5000
  const handtakAvslort = ref(false)
  let avslorTimer = null
  function avslorHandtak(ms = AVSLOR_MS) {
    handtakAvslort.value = true
    if (avslorTimer) clearTimeout(avslorTimer)
    avslorTimer = setTimeout(() => { handtakAvslort.value = false; avslorTimer = null }, ms)
  }
  // Kartet ble klart, draweren lukket, måling/sti avsluttet — hver gang
  // håndtakene blir RELEVANTE presenterer de seg én gang. Det dekker «ved lasting
  // av kart» uten en egen krok i laste-pipelinen.
  //
  // Watchen opprettes i onMounted og ikke i setup: `watch(computed, cb)` leser
  // getteren ÉN gang med en gang for å ha en gammel verdi å sammenligne med, og
  // en getter som leser noe MapView deklarerer lenger ned i fila er i TDZ der
  // (hoisting-fella i CLAUDE.md). Ved montering er alt initialisert.
  onMounted(() => {
    if (extendZonesVisible.value) avslorHandtak()
    watch(extendZonesVisible, (v) => { if (v) avslorHandtak() })
  })

  // De 8 håndtakene i wrapper-lokale skjerm-px. Reaktiv på pan/zoom/rotasjon
  // (transform-refene) og på wrapper-størrelse (wrapperSize, satt av MapViews
  // ResizeObserver) — getBoundingClientRect er i seg selv ikke reaktiv.
  const edgeHandles = computed(() => {
    const size = wrapperSize?.value
    if (!size?.w || !size?.h || !extendZonesVisible.value) return []
    const v = transformView()
    if (!v) return []
    const frame = edgeSafeFrame(size)
    if (!frame) return []
    const b = extendZonesBounds()
    const counts = edgeTileCounts.value
    // Holder man inne et håndtak for å lese pilla, skal ikke avslørings-vinduet
    // rekke å lukke seg under fingeren.
    const avslort = handtakAvslort.value || hoveredDir.value != null
    const out = []
    for (const dir of EDGE_DIRS) {
      const a = edgeAnchorSvg(dir, b)
      const p = viewBoxToScreen(a.x, a.y, v)
      // Skyv punktet halve trekant-høyden UTOVER fra arkkanten, langs den
      // roterte retningsaksen. Da flukter basen med arkets ytterkant og
      // trekanten står helt utenfor kartet (v5.25.5).
      const ut = edgeUtRetning(dir, v.rotationDeg)
      const ax = p.x + ut.x * EDGE_HANDLE_UTSTIKK
      const ay = p.y + ut.y * EDGE_HANDLE_UTSTIKK
      const naer = edgeAnkerNaer(dir, { x: ax, y: ay }, frame)
      // Dokket håndtak utenfor avslørings-vinduet: ikke render det i det hele
      // tatt. Det er hele poenget — ingen knapp under toppbaren å bomme på.
      if (!naer && !avslort) continue
      const pos = naer
        ? { x: klamp(ax, frame.minX, frame.maxX), y: klamp(ay, frame.minY, frame.maxY) }
        : edgeStaticSlot(dir, frame)
      const off = edgeLabelOffset(dir, v.rotationDeg)
      out.push({
        dir,
        name: extendZoneLabelText(dir),
        count: counts[dir] ?? 0,
        x: pos.x,
        y: pos.y,
        // Dokkede håndtak peker mot en kant man ikke ser, og roterer derfor med
        // KARTET og ikke med arket — retningen er fortsatt sann på skjermen.
        knobDeg: edgeKnobDeg(dir, v.rotationDeg),
        lx: off.lx,
        ly: off.ly,
        dokket: !naer,
        // Diagonal = hjørne-håndtak, og det tegnes med rett vinkel. Avledes av
        // retningsvektoren og ikke av at nøkkelen har to bokstaver.
        hjorne: erHjorne(dir),
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
    // Slipper man holdet uten å trykke, skal vinduet være ferskt igjen — ellers
    // forsvinner de dokkede naboene i samme øyeblikk som man slapp.
    avslorHandtak()
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

  // Ser brukeren på ÉN flis, eller på arket som helhet?
  //
  // Auto-promotering gir bare mening i det første tilfellet: hele poenget er at
  // «aktiv flis = den du faktisk ser på». Er du zoomet ut for å få oversikt, er
  // det ingen flis du ser på — du ser fire — og en promotering der gjør ekte
  // skade (rapportert v5.19.4): den navigerer (router.replace), MapView
  // remonteres, hele mosaikken tegnes på nytt (synlig flimmer), og i vinduet før
  // renderGhostTiles er ferdig er ghostRects tom. Da tror mosaicMinScale at du
  // har én flis, setter zoom-gulvet til 0,5 — og neste zoom-interaksjon klamper
  // deg opp dit. Brukeren mister utsnittet sitt midt i en oversikts-zoom.
  //
  // Målet er utsnittets bredde i meter mot flisbredden: får mer enn én flis
  // plass på skjermen, er dette en oversikt.
  function serHeleArket() {
    const v = transformView()
    return v ? erOversikt(v) : false
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
    // Zoomet ut for oversikt → ikke promoter. Se serHeleArket for hvorfor.
    if (serHeleArket()) { activatableTile.value = null; return }
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
    // Brukeren kan ha zoomet ut i dvale-vinduet — sjekk på nytt ved fyring.
    if (serHeleArket()) return
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
    byggerFlisRetning.value = direction
    buildingProgress.value = 'Forbereder …'
    closeDrawer()
    closeSearch()
    const builtIds = []
    // Bokfør planen FØR byggingen. Blir økta avbrutt her — reload, app-lukking,
    // en flis som feiler — er dette det eneste sporet av hva som skulle bygges.
    const plan = toBuild.map(({ center, utmBbox }) => ({ opts: autoMapBuildOpts(center), utmBbox }))
    leggTilVentende(plan)
    let tegnet = false
    byggAvbryter = new AbortController()
    try {
      for (let i = 0; i < toBuild.length; i++) {
        if (byggAvbryter.signal.aborted) break
        const prefix = toBuild.length > 1 ? `Utsnitt ${i + 1}/${toBuild.length}` : ''
        buildingProgress.value = toBuild.length > 1
          ? `Bygger utsnitt ${i + 1} av ${toBuild.length} …`
          : 'Bygger nytt utsnitt …'
        const { id } = await buildMapFromCenter({
          ...plan[i].opts,
          utmBbox: toBuild[i].utmBbox,   // eksakt ±W/±H-offset → flukter med aktiv flis
          terrainFirst: false,   // full flis med en gang
          signal: byggAvbryter.signal,
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
      avslorHandtak()
    } catch (e) {
      if (e?.name === 'AbortError') showAutoMapToast('Avbrutt')
      else {
        console.error('Kant-sone-utvidelse feilet:', e)
        showAutoMapToast('Kunne ikke lage nytt utsnitt')
      }
    } finally {
      byggAvbryter = null
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
      byggerFlisRetning.value = null
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
    refreshFirkant()
  }

  // Fyll alle mosaikk-hull. Bygger hver manglende celle (samme flyt som extendMap:
  // buildMapFromCenter isAuto + eksakt utmBbox), tegner mosaikken på nytt og kapper
  // cachen. Ikke-destruktivt — rører aldri eksisterende fliser. Krever nett.
  // Bygg en liste manglende celler. Delt av «Fyll hullene» og «Gjør firkant» —
  // de skiller seg bare i HVILKE celler de ber om og hva de kaller dem.
  // `ord` = { ting, gerund } på bokmål, i entall (flertall lages med -ene/-ene).
  async function byggCeller(cells, ord) {
    if (extendingMap || buildingOnTheFly.value || fillingInDetails.value) return
    if (autoMapModeBusy()) return
    const m = meta.value
    if (!m) return
    if (!cells.length) { refreshMosaicGaps(); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      showAutoMapToast(`Offline — kan ikke ${ord.gerund}`)
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
    byggAvbryter = new AbortController()
    try {
      // Per-flis feilhåndtering: én flis som feiler (f.eks. Overpass nede) skal
      // ikke forkaste flisene som lyktes — vi bygger så mange som mulig og
      // tegner mosaikken på nytt uansett i finally.
      for (let i = 0; i < cells.length; i++) {
        if (byggAvbryter.signal.aborted) break
        const prefix = cells.length > 1 ? `Flis ${i + 1}/${cells.length}` : ''
        buildingProgress.value = cells.length > 1
          ? `Bygger flis ${i + 1} av ${cells.length} …`
          : 'Bygger flis …'
        try {
          const { id } = await buildMapFromCenter({
            ...cells[i].opts,
            utmBbox: cells[i].utmBbox,
            terrainFirst: false,
            signal: byggAvbryter.signal,
            onProgress: (msg) => {
              buildingProgress.value = prefix ? `${prefix}: ${msg}` : msg
            },
          })
          if (id) {
            builtIds.push(id)
            fjernVentende(cells[i].utmBbox)
          } else failed++
        } catch (e) {
          if (e?.name !== 'AbortError') console.error('Flis feilet:', e)
          failed++
        }
      }
    } finally {
      byggAvbryter = null
      // Tegn mosaikken på nytt så det som FAKTISK ble bygd vises (også ved delvis
      // feil), kapp cachen og re-tell → bannerne speiler ny tilstand.
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
        showAutoMapToast(builtIds.length === 1
          ? `Bygde ${ord.ting}` : `Bygde ${builtIds.length} ${ord.flertall}`)
      } else if (builtIds.length && failed) {
        showAutoMapToast(`Bygde ${builtIds.length} ${ord.flertall}, ${failed} gjenstår`)
      } else {
        showAutoMapToast(`Kunne ikke ${ord.gerund} — prøv igjen`)
      }
    }
  }

  function repairMosaicGaps() {
    return byggCeller(manglendeFliser(), {
      ting: 'hullet i kartet', flertall: 'hull', gerund: 'fylle hull',
    })
  }

  // ── «Gjør arket firkantet» ──────────────────────────────────────────────────
  // Automatikken bygger ÉN flis om gangen — naboen du faktisk beveget deg mot —
  // så et ark som har vokst av seg selv blir organisk formet, ikke rektangulært.
  // Det er med vilje: en kardinal-utvidelse på et 3×1-ark koster tre fliser, og
  // panorerer du forbi et hjørne har du ikke bedt om dem.
  //
  // Men formen koster noe: 3D bruker arkets omsluttende rektangel (tomme hjørner
  // i terrenget), og pan-grensa gjør det samme, så du kan panorere ut i krem
  // inne i ditt eget ark. Derfor dette: en EKSPLISITT knapp med kostnaden
  // skrevet på, ikke en automatikk. Se findRectangleGaps for hvorfor det skillet
  // er hele forskjellen på trygg og utrygg her.
  const firkantAntall = ref(0)

  function firkantCeller() {
    const m = meta.value
    if (!m || m.minE == null) return []
    const mangler = findRectangleGaps({ w: m.widthM, h: m.heightM }, ghostRects.value)
    const sett = new Set()
    const ut = []
    for (const g of mangler) {
      const sx = g.col * m.widthM, sy = g.row * m.heightM
      const minE = Math.round(m.minE + sx)
      const maxN = Math.round(m.maxN - sy)
      const utmBbox = { minE, maxE: minE + Math.round(m.widthM), minN: maxN - Math.round(m.heightM), maxN }
      const n = cellenokkel(utmBbox)
      if (!n || sett.has(n)) continue
      sett.add(n)
      ut.push({ opts: autoMapBuildOpts({ x: sx + m.widthM / 2, y: sy + m.heightM / 2 }), utmBbox })
    }
    return ut
  }

  function refreshFirkant() {
    firkantAntall.value = firkantCeller().length
  }

  function gjorArketFirkantet() {
    return byggCeller(firkantCeller(), {
      ting: 'flisa som manglet', flertall: 'fliser', gerund: 'gjøre arket firkantet',
    })
  }

  return {
    buildingOnTheFly, buildingProgress, byggerFlisRetning, avbrytUtvidelse, autoMapToast, currentMapIsAuto,
    drawerCoversCanvas, extendZonesVisible, activatableTile, mosaicGapCount,
    edgeHandles, hoveredDir, previewExtend, clearExtendPreview, avslorHandtak,
    showAutoMapToast,
    visibleCenterSvg, clientToSvg, svgToClient, scheduleActivatableCheck, autoMapModeBusy,
    autoMapBuildOpts, promoteTile, extendMap, armAutoMap,
    extendZonesBounds, arkRutenett, teardownMapExtend,
    refreshMosaicGaps, repairMosaicGaps,
    firkantAntall, gjorArketFirkantet,
  }
}
