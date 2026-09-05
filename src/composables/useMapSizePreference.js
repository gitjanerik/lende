import { ref, watch } from 'vue'
import { PRINT_ASPECT } from '../lib/mapBuilder.js'

// Brukerstyrte standarder for NYE kart laget via forsidens søk/GPS-flyt
// (MapHomeView) og «Bygg om»-knappen: kart-BREDDE (fri km-slider), FORMAT
// (kvadrat/stående/liggende) og HØYDEKURVE-intervall (ekvidistanse). Settes i
// «Innstillinger»-fanen (MapView). Persisteres i localStorage.
//
// v11.0.59: «Standard» var `autoMapSquare(2)` = et skjerm-skalert kvadrat
// (4 km × viewportAspect). På en høy mobil-skjerm (h/w ≈ 2,2) ble det ~8,7 km.
// Erstattet med et fast kvadrat (defaultMapDims).
// v11.0.60: faste valg 4/6/8 km, default 10 km, utdatert 20 km-preferanse
// ugyldiggjort i load().
// v11.0.61: størrelsen er nå en fri SLIDER 1–20 km (default 10). Auto-
// ekvidistansen følger «Flere valg»-gulvet (minste TILLATTE = fineste):
// < 4 km → 5 m, 4–6 km → 10 m, ≥ 6 km → 20 m (samme tabell som
// MapPickerView.minEquidistance). En lagret verdi utenfor [1, maks] klampes/
// ignoreres i load() → faller til DEFAULT.
// v11.0.70: maks redusert fra 20 til 12 km (samme grense som «Flere valg»).
// v12.0.17: maks redusert fra 12 til 8 km, default fra 10 til 8 km (ytelse:
// store kart drev både Overpass-responsstørrelse og DEM-cellemengde; 8 km er
// grensen der kyst-DEM-oppgraderingen fortsatt er håndterbar på mobil).
// Lagrede preferanser > 8 km ugyldiggjøres i load() → faller til DEFAULT.
// v1.0.27 (lende): default redusert fra 8 til 4 km («Nullstill»-standarden er
// 4 km + 10 m + kvadratisk), og preferansen utvidet med FORMAT og
// EKVIDISTANSE — samme tre valg som «Flere valg» i kart-pickeren.
// v1.0.63: default hevet fra 4 til 5 km etter mobil-ytelse-sporet v1.0.59–62
// (gest-gating, content-visibility, måling). 5 km er største bredde som
// beholder 10 m auto-ekvidistanse (tabellen under: ≥ 6 km → 20 m), så
// standard-kartet får 56 % mer areal uten grovere høydekurver.
// v2.3.8: default hevet fra 5 til 8 km og maks fra 8 til 16 km — appen er nå
// responsiv nok (også på eldre mobil, testet på Samsung S22+) til å tåle større
// standardkart. 8 km-default gir 20 m auto-ekvidistanse (≥ 6 km → 20 m). 16 km-
// kart faller tilbake til grovere DEM via celletaket (createMapFlow), aldri
// avvist. Lagrede preferanser > 16 km ugyldiggjøres i load() → faller til DEFAULT.
//
// Modul-nivå refs ⇒ delte singletons mellom MapHomeView (leser), MapView og
// DrawerAboutTab (skriver).
const KEY = 'lende-map-size-km'
const FORMAT_KEY = 'lende-map-format'
const EQ_KEY = 'lende-map-eq'

export const MAP_SIZE_MIN_KM = 1
export const MAP_SIZE_MAX_KM = 16
// «Standard»-bredden (km) for nye kart når brukeren ikke har valgt noe.
// Fast kvadrat — IKKE skjerm-skalert (se v11.0.59-merknaden over).
export const DEFAULT_MAP_WIDTH_KM = 8

// Format-valg for nye kart — samme trippel som «Flere valg» i pickeren.
//   'square'   → kvadrat (aspect = 1) — standard
//   'staaende' → stående A-format (√2)
//   'liggende' → liggende A-format (1/√2)
//
// v6.5.46: «Portrett (mobilskjerm)» og «Utskrift (A4)» er slått sammen til
// STÅENDE, og LIGGENDE er ny. To grunner. Skjerm-aspektet var ikke et format i
// det hele tatt — det var telefonens tilfeldige forhold (~1:2,2), altså et
// annet ark på hver enhet og et som ikke lar seg skrive ut. Og undertekstene
// («mobilskjerm», «A4») var det som brakk: ved 150 % tekst orket ikke knappene
// tre ord hver, og «Kvad-ratisk» / «Por-trett» delte seg midt i ordet. Formatet
// er nå ETT ord per knapp, og begge de to A-formatene er samme ark snudd.
//
// At man ikke lenger kan velge skjerm-aspektet er en BEVISST tap: regelen om at
// kartet skal fylle skjermen ved åpning (lib/viewFit.js) gjør det unødvendig —
// et stående A-ark dekker en mobilskjerm med god margin uansett.
export const MAP_FORMAT_OPTIONS = [
  { value: 'square',   label: 'Kvadratisk' },
  { value: 'staaende', label: 'Stående' },
  { value: 'liggende', label: 'Liggende' },
]
export const DEFAULT_MAP_FORMAT = 'square'

// Lagrede valg fra før v6.5.46. Begge de gamle var HØYE ark, så begge blir
// stående — en bruker som hadde valgt portrett skal ikke plutselig få liggende.
const GAMLE_FORMAT = Object.freeze({ portrait: 'staaende', print: 'staaende' })

// Ren oversetter fra lagret verdi til gyldig format. Skilt ut fra `loadFormat`
// så migreringen kan testes uten localStorage — den kjører ved modul-last og
// er ellers usynlig helt til en gammel klient åpner appen.
export function formatFraLagret(v) {
  if (MAP_FORMAT_OPTIONS.some(o => o.value === v)) return v
  return GAMLE_FORMAT[v] ?? DEFAULT_MAP_FORMAT
}

// Ekvidistanse-valg — samme liste som «Flere valg» (MapPickerView).
export const MAP_EQ_OPTIONS = [2.5, 5, 10, 20, 25, 50]

// Høyde/bredde-forhold for et format-valg.
export function aspectForFormat(format) {
  if (format === 'staaende') return PRINT_ASPECT
  if (format === 'liggende') return 1 / PRINT_ASPECT
  return 1
}

// Dimensjoner for «Standard»-kartet: et DEFAULT_MAP_WIDTH_KM-bredt kvadrat.
// Samme form som en valgt størrelse (aspect = 1) så velgeren er konsistent.
export function defaultMapDims() {
  return { halfKm: DEFAULT_MAP_WIDTH_KM / 2, aspect: 1 }
}

function load() {
  try {
    const n = parseInt(localStorage.getItem(KEY), 10)
    if (Number.isFinite(n) && n >= MAP_SIZE_MIN_KM && n <= MAP_SIZE_MAX_KM) return n
  } catch { /* private mode */ }
  return null   // null = DEFAULT_MAP_WIDTH_KM
}

function loadFormat() {
  try {
    const v = localStorage.getItem(FORMAT_KEY)
    if (v != null) return formatFraLagret(v)
  } catch { /* private mode */ }
  return DEFAULT_MAP_FORMAT
}

function loadEq() {
  try {
    const n = parseFloat(localStorage.getItem(EQ_KEY))   // parseFloat: 2,5 m er ikke heltall
    if (MAP_EQ_OPTIONS.includes(n)) return n
  } catch { /* private mode */ }
  return null   // null = auto (fineste tillatte for bredden)
}

// Minste TILLATTE ekvidistanse for en kart-bredde — samme tabell som «Flere
// valg»-gatingen (MapPickerView.minEquidistance): tette kurver drukner på
// store kart.
//   ≤ 2 km  → 2,5 m   (ISOM-sprint — kun små kart)
//   < 4 km  → 5 m
//   4–6 km  → 10 m
//   ≥ 6 km  → 20 m
export function minEquidistanceForWidthKm(km) {
  const w = km || DEFAULT_MAP_WIDTH_KM
  if (w >= 6) return 20
  if (w >= 4) return 10
  if (w > 2) return 5
  return 2.5
}

// Auto-ekvidistanse for snarvei-kart (søk/GPS): den FINESTE tillatte for
// bredden, men ALDRI finere enn 5 m automatisk — 2,5 m er et bevisst manuelt
// valg (dobbelt så tette kurver), ikke noe snarvei-kart skal få uoppfordret.
export function equidistanceForWidthKm(km) {
  return Math.max(5, minEquidistanceForWidthKm(km))
}

const mapSizeKm = ref(load())
const mapFormat = ref(loadFormat())
const mapEquidistance = ref(loadEq())   // null = auto

watch(mapSizeKm, (v) => {
  try {
    if (v == null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(v))
  } catch { /* private mode / quota — ignore */ }
})
watch(mapFormat, (v) => {
  try {
    if (v === DEFAULT_MAP_FORMAT) localStorage.removeItem(FORMAT_KEY)
    else localStorage.setItem(FORMAT_KEY, v)
  } catch { /* private mode / quota — ignore */ }
})
watch(mapEquidistance, (v) => {
  try {
    if (v == null) localStorage.removeItem(EQ_KEY)
    else localStorage.setItem(EQ_KEY, String(v))
  } catch { /* private mode / quota — ignore */ }
})

// Effektiv ekvidistanse for en bredde: brukerens valg hvis lovlig, ellers
// klampet opp til minste tillatte. null-valg (auto) = fineste tillatte.
// Lagret valg beholdes urørt — velger man 5 m ved 3 km og drar slideren til
// 8 km, bygges 20 m nå, men 5 m gjelder igjen om man drar tilbake.
export function effectiveEquidistanceForWidthKm(km) {
  const min = minEquidistanceForWidthKm(km)
  const chosen = mapEquidistance.value
  if (chosen == null) return min
  return Math.max(chosen, min)
}

// Felles «Nullstill»-standard: 8 km bredde + 20 m ekvidistanse + kvadratisk.
// (null-verdiene ER standarden: 8 km-default og auto-ekvidistanse for 8 km = 20 m.)
export function resetMapPreferences() {
  mapSizeKm.value = null
  mapFormat.value = DEFAULT_MAP_FORMAT
  mapEquidistance.value = null
}

export function useMapSizePreference() {
  return { mapSizeKm, mapFormat, mapEquidistance }
}
