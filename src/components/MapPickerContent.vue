<script setup>
// Skjemaet for «Nytt turkart»: søk/GPS, senter, bredde, ekvidistanse, format og
// mini-forhåndsvisning — pluss del-kart-banneret. Trukket ut av MapPickerView
// (v2.4.16) fordi hovedmenyens «+» nå åpner det samme skjemaet som modal.
// Ruten /nytt består: den er inngangen for delte kart-lenker (?share=…).
//
// Verten eier ramme og scroll; her ligger innholdet. «Lag turkart» navigerer til
// det nye kartet, og verten rives ned av rute-endringen.
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNominatim } from '../composables/useNominatim.js'
import { useSpeechInput } from '../composables/useSpeechInput.js'
import { useSearchKeyboard } from '../composables/useSearchKeyboard.js'
import { bboxFromCenter, viewportAspect, PRINT_ASPECT } from '../lib/mapBuilder.js'
import { buildMapFromCenter } from '../lib/createMapFlow.js'
import { minEquidistanceForWidthKm } from '../lib/equidistanceRules.js'
import { reverseGeocode } from '../lib/geocode.js'
import { tileMosaic, zoomForKm, metersPerPixel } from '../lib/tileBackground.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'
import { t } from '../lib/i18n.js'

const router = useRouter()
const route = useRoute()

// v9.1.x: PWA-install fra del-kart-banneret. Hvis mottakeren ikke alt
// kjører appen i standalone-modus tilbyr vi å installere den når de
// genererer det delte kartet — gir fullskjerm + offline.
const { canInstall, isStandalone, promptInstall } = usePwaInstall()
const installRequested = ref(false)   // checkbox i del-kart-banneret
const showInstallInfo = ref(false)    // info-tooltip toggle

// Standard utgangspunkt: Oslo
const DEFAULT_CENTER = { lat: 59.9139, lon: 10.7522, name: 'Oslo' }

const center = ref({ ...DEFAULT_CENTER })
const halfKm = ref(4)  // halv-bredde av bbox i km (E/V). Kart blir 2*halfKm bredt (8 km = standarden, jf. DEFAULT_MAP_WIDTH_KM)
// Skjerm-format (høyde/bredde): kartet strekkes N/S til dette så det fyller
// fullskjerm uten letterbox (v10.1.10). Settes på mount + resize. buildMapFrom-
// Center utleder samme aspekt selv, så previewen viser det faktiske utsnittet.
const mapAspect = ref(viewportAspect())
const equidistanceM = ref(20)  // høydekurve-intervall, 5/10/20/25/50 m
const customName = ref('')

// Format-velger (trippel toggle). Styrer utsnittets høyde/bredde-forhold;
// bredden styres uansett av slideren, høyden utledes av valgt aspekt.
//   'square'   → kvadrat (aspect = 1) — default
//   'portrait' → skjerm-format (mobilskjerm, ~1:2,2) — tidligere default
//   'print'    → stående A-format (√2 ≈ 1,4142) for ren utskrift / PDF / SVG
const FORMAT_OPTIONS = [
  { value: 'square',   label: 'Kvadratisk', sub: '' },
  { value: 'portrait', label: 'Portrett',   sub: 'mobilskjerm' },
  { value: 'print',    label: 'Utskrift',   sub: 'A4' },
]
const format = ref('square')
// «Del kart og sted»-invitasjoner bærer avsenderens aspekt (?asp=) så
// mottakeren bygger samme utsnitt-FORM — ikke sitt eget skjermaspekt, som på
// mobil (~2.1) kunne doble arealet og fryse byggingen. Nullstilles hvis
// brukeren aktivt velger et annet format.
const inviteAspect = ref(null)
watch(format, () => { inviteAspect.value = null })
const effectiveAspect = computed(() => {
  if (inviteAspect.value) return inviteAspect.value
  if (format.value === 'portrait') return mapAspect.value
  if (format.value === 'print') return PRINT_ASPECT
  return 1
})

// v8.5.1: Sentrer på GPS. Forhindrer at brukeren ender med et kart sentrert
// på Nominatim-koordinaten for stedsnavnet (som kan ligge en stund vekk fra
// hvor brukeren faktisk står), og dermed får GPS-prikken utenfor sitt eget
// kart når de bruker det. Ingen watcher — én engangs hent på request.
const gpsState = ref({ status: 'idle', error: null })  // idle | locating | ok | error
// Når GPS-oppslaget ikke finner et navngitt sted skjuler vi «Sentrum av kart»-
// boksen helt: kartet får uansett navn («Min posisjon») + dato fra byggeflyten,
// og et tomt navnefelt gir bare støy. Settes tilbake så snart et navn finnes
// (GPS med treff, eller et valgt søketreff).
const nameHidden = ref(false)

async function onCenterOnMe() {
  if (controlsLocked.value) return
  if (!navigator.geolocation) {
    gpsState.value = { status: 'error', error: 'Nettleseren støtter ikke GPS' }
    return
  }
  gpsState.value = { status: 'locating', error: null }
  let pos
  try {
    pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }))
  } catch (err) {
    const map = {
      1: 'GPS-tillatelse avvist',
      2: 'GPS-posisjon ikke tilgjengelig',
      3: 'GPS-forespørsel tok for lang tid',
    }
    gpsState.value = { status: 'error', error: map[err.code] ?? 'GPS-feil' }
    return
  }
  const lat = pos.coords.latitude
  const lon = pos.coords.longitude
  // Slå opp nærmeste stedsnavn så kartet får et gjenkjennelig navn (samme flyt
  // som forsidens «Lag kart der jeg er»). Best-effort: feiler oppslaget eller
  // finnes ingen navngitt plass, skjuler vi navnefeltet.
  let placeName = null
  try {
    const rev = await reverseGeocode(lat, lon)
    if (rev?.placeLabel) placeName = rev.placeLabel
  } catch { /* behold null → skjul feltet */ }
  if (placeName) {
    customName.value = placeName
    center.value = { lat, lon, name: placeName }
    nameHidden.value = false
  } else {
    customName.value = ''
    center.value = { lat, lon, name: 'Min posisjon' }
    nameHidden.value = true
  }
  gpsState.value = { status: 'ok', error: null }
}

const shareInvite = ref(null) // { hl } — del-flyt fra delingslenke

// Et delt kart (shareInvite) låser alle utsnitt-valg (sted, navn, størrelse,
// ekvidistanse, preview drag/pinch). Poenget med deling er at mottakeren ser
// nøyaktig det samme som senderen — «se det jeg ser» — så bbox, størrelse og
// ekvidistanse skal ikke kunne endres.
const controlsLocked = computed(() => shareInvite.value !== null)

const lockedSearchPlaceholder = computed(() => t('picker.searchLockedPlaceholderShared'))
const lockedPreviewHint = computed(() => t('picker.previewLockedHintShared'))

function dismissShareInvite() {
  shareInvite.value = null
  installRequested.value = false
  showInstallInfo.value = false
  router.replace({ name: 'kart-nytt', query: {} })
}

// Del-flyt: URL har ?lat=&lon= (+ optional km/eq/hl). Pre-populerer feltene
// og returnerer en "shareInvite" struct som rendrer et beskjedent banner.
// Returner { hl } slik at generateMap kan forwarde highlight til MapView.
function parseShareInvite() {
  const q = route.query
  if (!q || !q.lat || !q.lon) return null
  const lat = parseFloat(q.lat)
  const lon = parseFloat(q.lon)
  const km = parseFloat(q.km)
  const eq = parseFloat(q.eq)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  center.value = { lat, lon, name: q.hl ? String(q.hl).slice(0, 60) : '' }
  // Eldre delte lenker kan ha km opptil 12 — clamp til dagens 16 km-tak.
  if (Number.isFinite(km) && km >= 1 && km <= 24) halfKm.value = Math.min(km, 16) / 2
  // Klamp mot bredde-regelen HER — watch(minEquidistance) fyrer bare når
  // minimumet ENDRES, og med 8 km som default-bredde står det allerede på
  // 20 m ved mount. En lenke med eq=5 og km=14 slapp derfor gjennom og ga
  // ISOM-tette kurver + knauser på mottakerens store kart.
  if (Number.isFinite(eq) && [2.5, 5, 10, 20, 25, 50].includes(eq)) {
    equidistanceM.value = Math.max(eq, minEquidistanceForWidthKm(halfKm.value * 2))
  }
  format.value = 'portrait'
  // Avsenderens aspekt (clampet til fornuftig spenn). Settes ETTER format-
  // tilordningen over — format-watchen nullstiller inviteAspect.
  const asp = parseFloat(q.asp)
  if (Number.isFinite(asp) && asp >= 0.3 && asp <= 3) {
    nextTick(() => { inviteAspect.value = asp })
  }
  if (q.hl) customName.value = String(q.hl).slice(0, 60)
  // «Del kart og sted»: slat/slon er stedets eksakte koordinater. Forwardes
  // til MapView så mottakeren får en rosa markering på nøyaktig samme punkt.
  const slat = parseFloat(q.slat)
  const slon = parseFloat(q.slon)
  const hasPlace = Number.isFinite(slat) && Number.isFinite(slon)
  // «Del rundtur» / 3D-turlenke (MCP-ens tur3dUrl): olat/olon (origo) +
  // rtv (vendepunkt/via) og/eller dlat/dlon (A→B-mål) + ri (valgt rute) +
  // v3d=1 (åpne 3D automatisk). Forwardes til MapView som gjenskaper turen.
  const olat = parseFloat(q.olat)
  const olon = parseFloat(q.olon)
  const dlat = parseFloat(q.dlat)
  const dlon = parseFloat(q.dlon)
  const hasDest = Number.isFinite(dlat) && Number.isFinite(dlon)
  const hasRoundTrip = Number.isFinite(olat) && Number.isFinite(olon) && (!!q.rtv || hasDest)
  // tn = turnavn fra tur-lenken (MCP / «Del rundtur»): kartet bygges med dette
  // navnet i stedet for «Uten navn». hl (delt sted) vinner hvis begge finnes.
  if (hasRoundTrip && !q.hl && typeof q.tn === 'string' && q.tn.trim()) {
    customName.value = q.tn.trim().slice(0, 60)
  }
  return {
    hl: q.hl ? String(q.hl).slice(0, 60) : null,
    slat: hasPlace ? slat : null,
    slon: hasPlace ? slon : null,
    hasPlace,
    hasRoundTrip,
    olat: hasRoundTrip ? olat : null,
    olon: hasRoundTrip ? olon : null,
    rtv: hasRoundTrip && q.rtv ? String(q.rtv) : null,
    ri: hasRoundTrip && q.ri != null ? String(q.ri) : null,
    dlat: hasRoundTrip && hasDest ? dlat : null,
    dlon: hasRoundTrip && hasDest ? dlon : null,
    v3d: hasRoundTrip && String(q.v3d) === '1' ? '1' : null,
  }
}

const EQUIDISTANCE_OPTIONS = [
  { value: 2.5, label: '2,5 m', desc: 'ISOM-sprint — kun kart ≤ 2 km' },
  { value: 5,   label: '5 m',   desc: 'ISOM-orientering — krever 1m DTM' },
  { value: 10,  label: '10 m',  desc: 'tett — for små områder' },
  { value: 20,  label: '20 m',  desc: 'turkart-standard' },
  { value: 25,  label: '25 m',  desc: 'norsk N50-standard' },
  { value: 50,  label: '50 m',  desc: 'oversikt — for store områder' },
]

// v10.1.x: minste tillatte ekvidistanse skaleres med bbox-bredde. Tett
// kontur-rendering er meningsløst på store kart (overlappende streker,
// rotete kart uten lesbarhet). Maks kartstørrelse er nå 16×16 km, men terskel-
// tabellen topper på 20 m: store kart (≥ 6 km, inkl. de nye 7–16 km) beholder
// 20/25/50 m som aktive valg, slik at 25 og 50 m alltid er tilgjengelig.
// Selve terskel-tabellen deles med MCP-serverens bygg_kart (equidistanceRules).
const minEquidistance = computed(() => minEquidistanceForWidthKm(halfKm.value * 2))

// Forklarende tooltip når et ekvidistanse-valg er utelukket av gjeldende bredde.
function widthHintFor(value) {
  if (value === 2.5) return 'Krever bredde ≤ 2 km'
  if (value === 5)  return 'Krever bredde < 4 km'
  if (value === 10) return 'Krever bredde < 6 km'
  return ''
}

// Auto-bump ekvidistanse n&aring;r bredde &oslash;kes forbi en grense og
// gjeldende valg blir ulovlig.
watch(minEquidistance, (minEq) => {
  if (equidistanceM.value < minEq) {
    equidistanceM.value = minEq
  }
})

const { query, results, isSearching, error: searchError } = useNominatim()

// Tale-til-tekst for stedssøket (skjules der nettleseren ikke støtter det).
const { isSupported: micSupported, isListening: micListening, toggle: toggleMic } =
  useSpeechInput({ onResult: (t) => { query.value = t } })

// GPS-snarveien er nå en grønn pin integrert i søkefeltet (samme som forsiden),
// ikke lenger en egen full-bredde-knapp under feltet. Høyre-padding + spinner-
// plassering avhenger av hvor mange kontroll-knapper som faktisk vises.
const supportsGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation
const rightControlCount = computed(() =>
  controlsLocked.value ? 0 : (supportsGeolocation ? 1 : 0) + (micSupported.value ? 1 : 0))
const searchRightPad = computed(() =>
  rightControlCount.value === 2 ? 'pr-24' : rightControlCount.value === 1 ? 'pr-14' : 'pr-3')
const spinnerRight = computed(() =>
  rightControlCount.value === 2 ? 'right-[5.9rem]' : rightControlCount.value === 1 ? 'right-[3.4rem]' : 'right-3')

const showResults = computed(() =>
  query.value.trim().length >= 2 && (results.value.length > 0 || isSearching.value)
)

function selectResult(r) {
  center.value = { lat: r.lat, lon: r.lon, name: r.shortName }
  customName.value = r.shortName
  nameHidden.value = false
  query.value = ''
  results.value = []
}

// Tastaturnavigasjon (desktop): pil ned/opp markerer, Enter velger, Escape
// nullstiller søkefeltet. Fokus blir i input-en så Escape alltid virker.
const { activeIndex: searchActiveIndex, onKeydown: onSearchKeydown } = useSearchKeyboard(results, {
  onSelect: selectResult,
  onClear: () => { query.value = ''; results.value = [] },
  optionId: (i) => `mappicker-opt-${i}`,
})

const bbox = computed(() => bboxFromCenter(center.value.lat, center.value.lon, halfKm.value, effectiveAspect.value))

const sizeKm = computed(() => (halfKm.value * 2).toFixed(1))
// Høyde i km (N/S-strekk) for label-en — bredde × høyde, ikke kvadrat lenger.
const sizeHeightKm = computed(() => (halfKm.value * 2 * effectiveAspect.value).toFixed(1))

// 'idle' | 'fetching' | 'building' | 'saving' | 'error'
const buildState = ref('idle')
const buildError = ref(null)
const buildProgress = ref('')

async function generateMap() {
  // v9.1.x: Hvis mottakeren har huket av «Installer kartappen» i del-kart-
  // banneret, trigg install-prompten først (best-effort). Vi venter på
  // brukerens valg og bygger kartet uansett utfall — på iOS/uten støtte er
  // canInstall false og vi går rett videre.
  if (installRequested.value && canInstall.value) {
    try { await promptInstall() } catch { /* avvist / utilgjengelig — bygg likevel */ }
  }

  buildState.value = 'fetching'
  buildError.value = null
  buildProgress.value = `Henter kartdata for ${sizeKm.value} × ${sizeKm.value} km …`

  try {
    const navn = customName.value.trim() || center.value.name || 'Uten navn'
    const { id } = await buildMapFromCenter({
      center: center.value,
      halfKm: halfKm.value,
      aspect: effectiveAspect.value,   // følg previewen (A-format når «tilpass til utskrift» er på)
      equidistanceM: equidistanceM.value,
      navn,
      terrainFirst: true,   // vis terreng straks, fyll inn OSM i bakgrunnen
      onProgress: (msg) => {
        buildProgress.value = msg
        // Heuristikk for state-overgang basert på status-tekst — beholder
        // tidligere oppførsel der buildState gikk fetching → building → saving.
        if (msg.startsWith('Bygger')) buildState.value = 'building'
        else if (msg.startsWith('Lagrer')) buildState.value = 'saving'
      },
    })
    // v8.10.0: Forwarde delings-highlight slik at mottaker ser samme markering
    // som sender hadde valgt. Brukes når shareInvite er aktiv (ikke
    // utfordrings-share).
    const nav = { name: 'kart-vis', params: { id } }
    const inv = shareInvite.value
    if (inv?.hl || inv?.hasPlace || inv?.hasRoundTrip) {
      nav.query = {}
      if (inv.hl) nav.query.hl = inv.hl
      if (inv.hasPlace) { nav.query.slat = String(inv.slat); nav.query.slon = String(inv.slon) }
      if (inv.hasRoundTrip) {
        nav.query.olat = String(inv.olat)
        nav.query.olon = String(inv.olon)
        if (inv.rtv) nav.query.rtv = inv.rtv
        if (inv.ri != null) nav.query.ri = inv.ri
        if (inv.dlat != null) { nav.query.dlat = String(inv.dlat); nav.query.dlon = String(inv.dlon) }
        if (inv.v3d) nav.query.v3d = inv.v3d
      }
    }
    router.push(nav)
  } catch (e) {
    buildState.value = 'error'
    buildError.value = e.message ?? 'Bygging feilet'
    if (autoBuild.value) {
      autoBuild.value = false
      shareInvite.value = null
    }
  }
}

// ── Preview med ekte Kartverket-tiler som bakgrunn ─────────────────────────
const previewRef = ref(null)
const previewSize = ref({ w: 0, h: 0 })
// Zoom-en må romme den STØRSTE aksen (høyden ved portrett-aspekt) i den
// kvadratiske previewen, ellers stikker bbox-rammen utenfor toppen/bunnen.
const previewZoom = computed(() => zoomForKm(halfKm.value * 2 * effectiveAspect.value + 2))

function measurePreview() {
  const r = previewRef.value?.getBoundingClientRect()
  if (r) previewSize.value = { w: r.width, h: r.height }
  // Oppdater skjerm-aspektet så previewen følger rotasjon/vindusendring.
  mapAspect.value = viewportAspect()
}

const tiles = computed(() => {
  if (!previewSize.value.w) return []
  return tileMosaic(
    center.value.lat, center.value.lon,
    previewZoom.value, previewSize.value
  )
})

// Kartverket-topo dekker bare Norge. Feiler en flis (utenfor dekning), skjul
// den så OSM-underlaget viser gjennom — slik blir svensk side ikke blank.
function onTopoTileError(e) {
  e.target.style.display = 'none'
}

// Pixel-størrelse av bbox-overlegget innen preview-en
const bboxOverlayPx = computed(() => {
  if (!previewSize.value.w) return { w: 0, h: 0 }
  const mPerPx = metersPerPixel(center.value.lat, previewZoom.value)
  const widthM = halfKm.value * 2 * 1000
  const heightM = widthM * effectiveAspect.value   // N/S-strekk = portrett-rammen
  return {
    w: widthM / mPerPx,
    h: heightM / mPerPx,
  }
})

// Pan + pinch på preview-en. Bruker drar kartet under den faste rammen.
// 1-touch (eller mus) = pan kartet (oppdaterer center.lat/lon). 2-touch
// = pinch-zoom (oppdaterer halfKm).
let lastDist = 0
let pinching = false
let panning = false
let panStart = null

function panShiftToCenter(dxPx, dyPx) {
  // Når kartet flyttes høyre med dxPx skal sentrum-punktet flyttes
  // VENSTRE i geografisk rom (kartet under flyttes til venstre).
  // I tile-rom: y øker nedover = lat synker.
  const mPerPx = metersPerPixel(center.value.lat, previewZoom.value)
  const dLat = (dyPx * mPerPx) / 111111
  const dLon = -(dxPx * mPerPx) / (111111 * Math.cos(center.value.lat * Math.PI / 180))
  return { dLat, dLon }
}

function onPreviewTouchStart(e) {
  if (controlsLocked.value) return
  if (e.touches.length === 2) {
    pinching = true
    panning = false
    lastDist = touchDist(e)
    e.preventDefault()
  } else if (e.touches.length === 1) {
    panning = true
    pinching = false
    panStart = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      lat: center.value.lat,
      lon: center.value.lon,
    }
  }
}
function onPreviewTouchMove(e) {
  if (controlsLocked.value) return
  if (pinching && e.touches.length === 2) {
    e.preventDefault()
    const d = touchDist(e)
    const ratio = d / lastDist
    const next = halfKm.value / ratio
    halfKm.value = Math.max(0.5, Math.min(8, next))
    lastDist = d
  } else if (panning && e.touches.length === 1 && panStart) {
    e.preventDefault()
    const dxPx = e.touches[0].clientX - panStart.x
    const dyPx = e.touches[0].clientY - panStart.y
    const { dLat, dLon } = panShiftToCenter(dxPx, dyPx)
    center.value = { ...center.value, lat: panStart.lat + dLat, lon: panStart.lon + dLon }
  }
}
function onPreviewTouchEnd(e) {
  if (e.touches.length < 2) pinching = false
  if (e.touches.length < 1) { panning = false; panStart = null }
}
function touchDist(e) {
  const dx = e.touches[0].clientX - e.touches[1].clientX
  const dy = e.touches[0].clientY - e.touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// Desktop: musedrag = pan
function onPreviewMouseDown(e) {
  if (controlsLocked.value) return
  if (e.button !== 0) return
  panning = true
  panStart = {
    x: e.clientX, y: e.clientY,
    lat: center.value.lat, lon: center.value.lon,
  }
  e.preventDefault()
}
function onPreviewMouseMove(e) {
  if (controlsLocked.value) return
  if (!panning || !panStart) return
  e.preventDefault()
  const dxPx = e.clientX - panStart.x
  const dyPx = e.clientY - panStart.y
  const { dLat, dLon } = panShiftToCenter(dxPx, dyPx)
  center.value = { ...center.value, lat: panStart.lat + dLat, lon: panStart.lon + dLon }
}
function onPreviewMouseUp() {
  panning = false
  panStart = null
}
// Desktop: scroll-hjul = zoom (pinch-ekvivalent)
function onPreviewWheel(e) {
  if (controlsLocked.value) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? 1.1 : 0.9
  const next = halfKm.value * delta
  halfKm.value = Math.max(0.5, Math.min(8, next))
}

// Chat-bygging (lag_kart i Lende-chat): ?auto=1 sammen med utfylte felter
// starter byggingen direkte — samme progress-UI og videresending (hl/tur) som
// del-lenker, men uten invitasjonsbanner (dette er brukerens egen bestilling,
// ikke en delt lenke). Ved byggefeil slippes låsen så feltene kan justeres.
const autoBuild = ref(false)

onMounted(() => {
  shareInvite.value = parseShareInvite()
  if (shareInvite.value && String(route.query.auto) === '1') {
    autoBuild.value = true
    nextTick(() => generateMap())
  }
  nextTick(() => measurePreview())
  window.addEventListener('resize', measurePreview)
})
</script>

<template>
<div class="flex flex-col">
  <!-- v8.10.0: Banner ved «Del kart»-lenke (uten utfordring). v9.1.x:
       utsnitt/størrelse/ekvidistanse er nå låst (controlsLocked) slik at
       mottakeren får en nøyaktig kopi — «se det jeg ser». ?hl=<navn>
       forwardes til MapView etter generering. Hvis appen ikke kjører i
       standalone-modus tilbys installasjon via checkbox under teksten. -->
  <div v-if="shareInvite && !autoBuild"
       class="relative mx-4 mt-4 rounded-xl border border-sky-300/40 bg-sky-500/10 px-4 py-3">
    <button @click="dismissShareInvite"
            :aria-label="t('share.invite.cancel')"
            class="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center
                   text-sky-200/70 hover:text-sky-100 hover:bg-sky-400/15
                   active:scale-95 transition">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div class="flex items-center gap-3 pr-8">
      <div class="shrink-0 w-10 h-10 rounded-full bg-sky-400/20 border border-sky-300/40
                  flex items-center justify-center text-sky-200">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[13px] font-semibold text-sky-100">
          {{ shareInvite.hasRoundTrip ? t('share.invite.titleRoundTrip')
             : shareInvite.hasPlace ? t('share.invite.titlePlace')
             : t('share.invite.title') }}
        </div>
        <div v-if="shareInvite.hl" class="text-[11px] text-sky-100/75 truncate">
          {{ t('share.invite.marking', { name: shareInvite.hl }) }}
        </div>
      </div>
    </div>
    <div class="mt-2 text-[11px] text-ink/70 leading-relaxed">
      {{ shareInvite.hasRoundTrip ? t('share.invite.bodyRoundTrip')
         : shareInvite.hasPlace ? t('share.invite.bodyPlace')
         : t('share.invite.body') }}
    </div>

    <!-- v9.1.x: Install-hint. Vises kun når appen IKKE alt kjører som PWA
         (standalone). Checkbox endrer CTA til «Installer som app og lag
         kart»; info-knappen forklarer kort hva installasjon innebærer. -->
    <div v-if="!isStandalone" class="mt-3 pt-3 border-t border-sky-300/15">
      <label class="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" v-model="installRequested"
               class="mt-0.5 w-4 h-4 shrink-0 accent-sky-400 cursor-pointer" />
        <span class="flex-1 text-[11px] text-sky-100/85 leading-relaxed">
          {{ t('share.invite.installCheckbox') }}
          <button type="button" @click.prevent="showInstallInfo = !showInstallInfo"
                  :aria-label="t('share.invite.installInfoLabel')"
                  :aria-expanded="showInstallInfo"
                  class="inline-flex items-center justify-center align-middle ml-1
                         w-4 h-4 rounded-full border border-sky-300/50 text-sky-200/90
                         text-[9px] font-bold leading-none active:scale-90 transition">
            i
          </button>
        </span>
      </label>
      <Transition name="fade">
        <div v-if="showInstallInfo"
             class="mt-2 ml-[26px] text-[10px] text-sky-100/60 leading-relaxed">
          {{ t('share.invite.installInfo') }}
        </div>
      </Transition>
    </div>
  </div>


  <!-- Søkefelt. v9.1.x: skjult i delingsmodus — mottakeren skal bare se og
       lage det delte kartet, ikke søke/velge sted. -->
  <div v-if="!shareInvite" class="px-4 pt-4 pb-3 relative z-20">
    <label class="text-ink/65 text-[11px] uppercase tracking-wide block mb-2">Sted, postnummer eller adresse</label>
    <div class="relative">
      <svg viewBox="0 0 24 24" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/50"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>
      </svg>
      <input v-model="query" type="search" autocomplete="off" autocorrect="off"
             :readonly="controlsLocked" :disabled="controlsLocked"
             @keydown="onSearchKeydown"
             role="combobox" aria-autocomplete="list" :aria-expanded="showResults"
             aria-controls="mappicker-results"
             :aria-activedescendant="searchActiveIndex >= 0 ? `mappicker-opt-${searchActiveIndex}` : undefined"
             :placeholder="controlsLocked ? lockedSearchPlaceholder : 'f.eks. Sognsvann, 0855, Vardåsen Asker'"
             :class="['w-full pl-10 py-3 rounded-xl bg-ink/[0.06] border border-ink/15',
                      'text-[14px] placeholder-ink/30 focus:outline-none focus:bg-ink/12',
                      'focus:border-slate-300/50 transition disabled:opacity-50 disabled:cursor-not-allowed',
                      searchRightPad]" />
      <div v-if="isSearching"
           :class="['absolute top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-ink/15',
                    'border-t-ink/70 rounded-full animate-spin', spinnerRight]" />
      <!-- Kontroll-knapper: mikrofon (diktér søk) + GPS (sentrer på meg).
           Samme mønster som forsidens søkefelt — den grønne pinnen ligger
           ytterst til høyre. -->
      <div v-if="!controlsLocked" class="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button v-if="micSupported" type="button" @click="toggleMic"
                :aria-label="micListening ? 'Stopp diktering' : 'Diktér søk (tale til tekst)'"
                :aria-pressed="micListening"
                :class="['w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95',
                         micListening ? 'bg-red-500/90 text-ink animate-pulse' : 'bg-ink/10 text-ink/70']">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button v-if="supportsGeolocation"
                @click="onCenterOnMe"
                :disabled="gpsState.status === 'locating'"
                aria-label="Sentrer kartet på min posisjon (GPS)"
                class="w-10 h-10 rounded-lg bg-emerald-500 text-white flex items-center justify-center
                       shadow-md active:scale-95 transition disabled:opacity-60">
          <svg v-if="gpsState.status === 'locating'"
               viewBox="0 0 24 24" class="w-5 h-5 animate-spin" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="10" r="3"/>
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Søkeresultater -->
    <Transition name="fade">
      <div v-if="showResults" id="mappicker-results" role="listbox"
           class="absolute left-4 right-4 mt-1 rounded-xl bg-surface/98 backdrop-blur
                  border border-ink/10 shadow-2xl max-h-[50dvh] overflow-y-auto z-30">
        <div v-if="results.length === 0 && !isSearching"
             class="px-4 py-3 text-[13px] text-ink/50">Ingen treff</div>
        <button v-for="(r, index) in results" :key="r.id"
                :id="`mappicker-opt-${index}`" role="option"
                :aria-selected="index === searchActiveIndex"
                @click="selectResult(r)"
                @mousemove="searchActiveIndex = index"
                class="w-full text-left px-4 py-2.5 transition border-b
                       border-ink/8 last:border-0"
                :class="index === searchActiveIndex ? 'bg-ink/12' : 'active:bg-ink/10'">
          <div class="text-[13px] font-medium text-ink truncate">{{ r.shortName }}</div>
          <div class="text-[11px] text-ink/50 truncate">{{ r.name }}</div>
        </button>
      </div>
    </Transition>

    <div v-if="searchError" class="mt-2 text-[11px] text-slate-300">{{ searchError }}</div>

    <!-- Hjelpetekst som forklarer den integrerte GPS-pinnen (samme mønster
         som forsiden — pin-ikonet alene er ikke helt selvforklarende). -->
    <div v-if="supportsGeolocation && !controlsLocked"
         class="mt-2 px-1 text-[11.5px] text-ink/45 flex items-center gap-1.5 leading-snug">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-emerald-300/80 shrink-0" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="10" r="3"/>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
      </svg>
      <span>Søk etter et sted — eller trykk den grønne knappen for å sentrere kartet der du står.</span>
    </div>
    <div v-if="gpsState.error"
         class="mt-2 text-[11px] text-amber-300">{{ gpsState.error }}</div>
  </div>

  <!-- Valgt sted. v9.1.x: skjult i delingsmodus — navn/koordinater er låst
       til det delte kartet, ingen grunn til å vise redigerings-feltet.
       v2.4.4: også skjult når GPS ikke fant et navngitt sted (nameHidden) —
       kartet får navn + dato fra byggeflyten, tomt navnefelt er bare støy. -->
  <div v-if="!shareInvite && !nameHidden" class="px-4 pb-2">
    <div class="rounded-xl bg-ink/[0.04] border border-ink/10 px-4 py-3">
      <div class="text-[11px] text-ink/50 uppercase tracking-wide mb-1">Sentrum av kart</div>
      <input v-model="customName"
             type="text" placeholder="Navn på kart"
             :readonly="controlsLocked"
             class="w-full bg-transparent text-[15px] font-semibold focus:outline-none
                    placeholder-ink/25 read-only:opacity-70" />
      <div class="mt-1 text-[11px] text-ink/45 tabular-nums">
        {{ center.lat.toFixed(4) }}°N, {{ center.lon.toFixed(4) }}°E
      </div>
    </div>
  </div>

  <!-- Mini-preview + bbox. v9.x: Bredde + Høydekurver er flyttet OVER
       forhåndsvisningen slik at brukeren ser (og kan justere) valgene før
       hen ruller ned til CTA-knappen nederst. -->
  <div class="px-4 pb-3 flex flex-col gap-3">
    <!-- Slider for størrelse -->
    <div class="rounded-xl bg-ink/[0.04] border border-ink/10 px-4 py-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[11px] text-ink/50 uppercase tracking-wide">Bredde</div>
        <div class="text-[13px] font-medium tabular-nums">{{ sizeKm }} km</div>
      </div>
      <input type="range" min="0.5" max="8" step="0.25" v-model.number="halfKm"
             :disabled="controlsLocked"
             class="w-full accent-slate-400 disabled:opacity-50 disabled:cursor-not-allowed" />
      <div class="flex justify-between text-[10px] text-ink/40 mt-1">
        <span>1 km</span><span>8,5 km</span><span>16 km</span>
      </div>
    </div>

    <!-- Ekvidistanse-velger -->
    <div class="rounded-xl bg-ink/[0.04] border border-ink/10 px-4 py-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[11px] text-ink/50 uppercase tracking-wide">Høydekurver</div>
        <div class="text-[13px] font-medium tabular-nums">hver {{ equidistanceM }} m</div>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="opt in EQUIDISTANCE_OPTIONS" :key="opt.value"
                :disabled="controlsLocked || opt.value < minEquidistance"
                :title="opt.value < minEquidistance ? widthHintFor(opt.value) : opt.desc"
                @click="equidistanceM = opt.value"
                class="px-2 py-1.5 rounded-md border text-[11px] font-medium active:scale-95 transition
                       disabled:cursor-not-allowed disabled:opacity-40"
                :class="equidistanceM === opt.value
                        ? 'bg-slate-400/20 border-slate-300/60 text-slate-100'
                        : 'bg-ink/5 border-ink/10 text-ink/65'">
          {{ opt.label }}
        </button>
      </div>
      <div class="text-[10px] text-ink/40 mt-1.5">
        {{ EQUIDISTANCE_OPTIONS.find(o => o.value === equidistanceM)?.desc }}
      </div>
    </div>

    <!-- Format-velger (trippel toggle). Styrer utsnittets høyde/bredde-forhold:
         Kvadratisk (default), Portrett (mobilskjerm) eller Utskrift (stående
         A-format √2 for ren utskrift / PDF / SVG). Previewen og det genererte
         kartet følger valget. -->
    <div class="rounded-xl bg-ink/[0.04] border border-ink/10 px-4 py-3">
      <div class="text-[11px] text-ink/50 uppercase tracking-wide mb-2">Format</div>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="opt in FORMAT_OPTIONS" :key="opt.value"
                :disabled="controlsLocked"
                @click="format = opt.value"
                class="px-2 py-1.5 rounded-md border text-[12px] font-medium active:scale-95 transition
                       flex flex-col items-center justify-center gap-0.5
                       disabled:cursor-not-allowed disabled:opacity-40"
                :class="format === opt.value
                        ? 'bg-slate-400/20 border-slate-300/60 text-slate-100'
                        : 'bg-ink/5 border-ink/10 text-ink/65'">
          <span>{{ opt.label }}</span>
          <span v-if="opt.sub" class="text-[9px] font-normal text-ink/45 leading-none">{{ opt.sub }}</span>
        </button>
      </div>
    </div>

    <div v-if="!shareInvite" class="text-ink/65 text-[11px] uppercase tracking-wide">
      <template v-if="controlsLocked">{{ lockedPreviewHint }}</template>
      <template v-else>Forhåndsvisning — dra kartet for å plassere, pinch / scroll for størrelse</template>
    </div>
    <!-- v8.2.2: preview-containeren er et kvadrat; netto-rammen (ROI) inni
         viser det FAKTISKE utsnittet — kvadrat, portrett eller A-format alt
         etter Format-valget (bboxOverlayPx følger effectiveAspect).
         Bruttokartet (tile-mosaikken) fyller hele kvadratet på 100% opacity —
         ingen lysegrå semitransparent maskering rundt netto-rammen. Netto-
         rammen er bare en stiplet kontur med subtilt fokus (drop-shadow +
         indre kant). -->
    <!-- v9.1.x: når utsnittet er låst (delt kart / utfordring) skal touch/scroll
         OVER kartet rulle siden — ikke pan/pinch/rotere forhåndsvisningen.
         Derfor `touch-auto` ved lås, `touch-none` (fang gesten) ellers.
         Touch-/wheel-handlerne early-returner alt på controlsLocked. -->
    <div ref="previewRef"
         class="aspect-square w-full rounded-xl bg-surface-2 border border-ink/10 overflow-hidden
                relative"
         :class="controlsLocked ? 'cursor-not-allowed opacity-90 touch-auto' : 'cursor-move touch-none'"
         @touchstart="onPreviewTouchStart"
         @touchmove="onPreviewTouchMove"
         @touchend="onPreviewTouchEnd"
         @touchcancel="onPreviewTouchEnd"
         @mousedown="onPreviewMouseDown"
         @mousemove="onPreviewMouseMove"
         @mouseup="onPreviewMouseUp"
         @mouseleave="onPreviewMouseUp"
         @wheel="onPreviewWheel">
      <!-- OSM-underlag: dekker globalt (også Sverige) så grensenære utsnitt
           ikke blir blanke der Kartverket-topo mangler. -->
      <img v-for="t in tiles" :key="'osm-' + t.url"
           :src="t.osmUrl" alt=""
           class="absolute pointer-events-none select-none"
           :style="{ left: t.leftPx + 'px', top: t.topPx + 'px', width: '256px', height: '256px' }"
           draggable="false" />
      <!-- Ekte Kartverket-tiler OVER OSM. Tiles flyttes når bruker drar
           (center oppdateres → tile-mosaikken regenereres rundt ny lat/lon).
           Skjules ved feil (utenfor norsk dekning) → OSM-underlaget viser. -->
      <img v-for="t in tiles" :key="t.url"
           :src="t.url" alt=""
           class="absolute pointer-events-none select-none"
           :style="{ left: t.leftPx + 'px', top: t.topPx + 'px', width: '256px', height: '256px' }"
           draggable="false" @error="onTopoTileError" />

      <!-- Netto-frame fast i sentrum (portrett — følger skjerm-formatet så
           kartet fyller fullskjerm). Brukeren drar kartet UNDER rammen for å
           velge utsnitt. Pinch / scroll endrer størrelse. Ingen dark-mask
           rundt — bruttokartet skal være synlig på 100% opacity. -->
      <div class="absolute pointer-events-none border-2 border-white rounded-sm
                  shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
           :style="{
             width:  bboxOverlayPx.w + 'px',
             height: bboxOverlayPx.h + 'px',
             left:   (previewSize.w - bboxOverlayPx.w) / 2 + 'px',
             top:    (previewSize.h - bboxOverlayPx.h) / 2 + 'px',
             transition: 'width 200ms cubic-bezier(0.2,0.8,0.2,1), height 200ms cubic-bezier(0.2,0.8,0.2,1)',
           }">
        <!-- Senter-kryss -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
          <div class="absolute top-1/2 left-0 right-0 h-0.5 bg-ink/85 -translate-y-1/2 shadow-[0_0_2px_rgba(0,0,0,0.7)]"></div>
          <div class="absolute left-1/2 top-0 bottom-0 w-0.5 bg-ink/85 -translate-x-1/2 shadow-[0_0_2px_rgba(0,0,0,0.7)]"></div>
        </div>
      </div>

      <div class="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-surface text-[11px]
                  text-ink border border-ink/30 font-medium shadow-lg z-10">
        {{ sizeKm }} × {{ sizeHeightKm }} km
      </div>
      <div class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-surface/85 text-ink/70 text-[8px]
                  text-ink/75 border border-ink/15 leading-tight pointer-events-none">
        © Kartverket
      </div>
    </div>
  </div>

  <!-- Bygg-knapp. -->
  <div class="sticky bottom-0 z-30 p-4 pb-4 bg-surface/95 backdrop-blur border-t border-ink/10">
    <button @click="generateMap" :disabled="buildState !== 'idle' && buildState !== 'error'"
            class="w-full py-4 rounded-xl text-ink font-semibold flex items-center justify-center gap-2
                   active:scale-[0.99] transition disabled:opacity-60
                   bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900">
      <div v-if="buildState !== 'idle' && buildState !== 'error'"
           class="w-4 h-4 border-2 border-ink/30 border-t-white rounded-full animate-spin"/>
      <span v-if="buildState !== 'idle' && buildState !== 'error'">{{ buildProgress }}</span>
      <template v-else>
        <!-- v9.1.x: når mottakeren har huket av install i del-kart-banneret
             bytter CTA-en til «Installer som app og lag kart» med last-ned-ikon. -->
        <svg v-if="installRequested" viewBox="0 0 24 24" class="w-4 h-4" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/>
          <rect x="3" y="17" width="18" height="4" rx="1"/>
        </svg>
        <span>{{ installRequested ? t('picker.makeMapInstall') : t('picker.makeMap') }}</span>
      </template>
    </button>
    <div v-if="buildError"
         class="mt-3 px-3 py-2 rounded-lg bg-slate-500/20 border border-slate-300/30
                text-slate-100 text-[11px]">
      {{ buildError }}
    </div>
    <div class="mt-3 text-[10px] text-ink/40 text-center">
      Henter data fra OpenStreetMap (ODbL) via Overpass API.
      <span class="text-ink/25">·</span>
      <button @click="router.push({ name: 'kart-vis', params: { id: 'vardasen' } })"
              class="underline decoration-dotted underline-offset-2 hover:text-ink/70 transition">
        Åpne innebygd kart
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

input[type="range"]::-webkit-slider-runnable-track {
  height: 4px; border-radius: 999px;
  background: color-mix(in oklab, var(--color-ink) 15%, transparent);
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px; border-radius: 999px;
  background: #a78bfa; margin-top: -7px;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(167,139,250,0.5);
}
</style>
