import { ref, watch } from 'vue'
import { PRINT_ASPECT } from '../lib/mapBuilder.js'
import { BREDDE_MIN_KM, BREDDE_MAKS_KM } from '../lib/mapDensityRules.js'
import { EQUIDISTANSE_M, minEquidistanceForWidthKm as minEqFraBredde } from '../lib/equidistanceRules.js'

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
// v6.5.76: spennet er 2–20 km, og BÅDE grensene og ekvidistanse-tabellen er nå
// re-eksporter fra lib — de sto i to nesten like kopier her og i
// equidistanceRules/mapDensityRules, og en tabell som må endres to steder blir
// endret ett sted. En lagret bredde utenfor spennet, eller en lagret
// ekvidistanse på 2,5/5 m, faller til DEFAULT/auto av seg selv i load().
//
// Modul-nivå refs ⇒ delte singletons mellom MapHomeView (leser), MapView og
// DrawerAboutTab (skriver).
const KEY = 'lende-map-size-km'
const FORMAT_KEY = 'lende-map-format'
const EQ_KEY = 'lende-map-eq'

// Slider-grensene ER tetthets-reglenes bredde-spenn (mapDensityRules) — det
// rådgivende taket måles mot de samme endene som slideren har.
export const MAP_SIZE_MIN_KM = BREDDE_MIN_KM
export const MAP_SIZE_MAX_KM = BREDDE_MAKS_KM
// «Standard»-bredden (km) for nye kart når brukeren ikke har valgt noe.
// Fast kvadrat — IKKE skjerm-skalert (se v11.0.59-merknaden over).
// v6.5.76: 8 → 10 km. Sammen med ekvidistanse-tabellen (≥ 10 km → 25 m) gir
// det et standardkart i norsk N50-manér: 10 × 10 km med 25 m høydekurver.
export const DEFAULT_MAP_WIDTH_KM = 10

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

// Ekvidistanse-valg — samme liste som «Flere valg» (MapPickerContent), fra
// den delte kilden.
export const MAP_EQ_OPTIONS = EQUIDISTANSE_M

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
    // parseFloat og ikke parseInt: en lagret 2,5 fra før v6.5.76 skal leses
    // som 2.5 og forkastes av lista under, ikke leses som 2 og forkastes der.
    const n = parseFloat(localStorage.getItem(EQ_KEY))
    if (MAP_EQ_OPTIONS.includes(n)) return n
  } catch { /* private mode */ }
  return null   // null = auto (fineste tillatte for bredden)
}

// Minste TILLATTE ekvidistanse for en kart-bredde — den delte tabellen
// (lib/equidistanceRules), med DEFAULT_MAP_WIDTH_KM for «ikke valgt».
export function minEquidistanceForWidthKm(km) {
  return minEqFraBredde(km || DEFAULT_MAP_WIDTH_KM)
}

// Auto-ekvidistanse for snarvei-kart (søk/GPS): den FINESTE tillatte for
// bredden. Fram til v6.5.76 hadde denne et eget 5 m-gulv, fordi 2,5 m var et
// bevisst manuelt valg ingen snarvei skulle få uoppfordret. Med 2,5 og 5 m ute
// av lista er fineste tillatte 10 m, og gulvet har ingenting å gjøre.
export function equidistanceForWidthKm(km) {
  return minEquidistanceForWidthKm(km)
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

// Felles «Nullstill»-standard: 10 km bredde + 25 m ekvidistanse + kvadratisk.
// (null-verdiene ER standarden: 10 km-default og auto-ekvidistanse for 10 km
// = 25 m, altså N50.)
export function resetMapPreferences() {
  mapSizeKm.value = null
  mapFormat.value = DEFAULT_MAP_FORMAT
  mapEquidistance.value = null
}

export function useMapSizePreference() {
  return { mapSizeKm, mapFormat, mapEquidistance }
}
