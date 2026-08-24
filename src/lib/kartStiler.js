// Kartstiler — ÉN kilde til sannhet for hvordan kartet ser ut.
//
// ── Hvorfor denne fila finnes ──────────────────────────────────────────────
// Fram til v5.23.0 styrte fire uavhengige akser utseendet, og ingen av dem
// visste om de andre:
//
//   tema (isomCatalog.themes)  → farger
//   forhåndsvalg (LAYER_PRESETS) → BARE lag-synlighet
//   strek (strokeOverrides)     → multiplikator per gruppe
//   sti-farger (trailColors)    → fri {fg, bg}-fargevelger
//
// Resultatet var at ingen kombinasjon føltes designet, fordi ingen VAR
// designet. Verst var forhåndsvalgene: de endret ikke ett eneste
// piksel-uttrykk. «Detaljert» skilte seg fra «Tur» på ni lag-nøkler, hvorav
// seks sjelden har data i innlandsterreng — i praksis var hele forskjellen
// gårdsnavn og gjerder. Den er fjernet, ikke omdøpt: et navn som lover
// detaljrikdom og leverer to lag er verre enn ingen knapp.
//
// En kartstil binder alle fire aksene til en helhet noen har tegnet med
// vilje. De frie knottene er ikke borte — de ligger under «Tilpass» og
// seedes fra kartstilen, så brukeren justerer fra et designet utgangspunkt
// i stedet for fra ingenting.
//
// ── Delt vokabular ────────────────────────────────────────────────────────
// Som mapLayerCatalog.js er dette delt med MCP-serveren (`juster_kart`) og
// Lende-chatten (`styr_kartlag`, `bytt_kart_tema`). Legger du til en
// kartstil her, kan chatten bytte til den uten flere endringer.

import { ALL_LAYER_KEYS } from './mapLayerCatalog.js'

// ── Lag-sett ──────────────────────────────────────────────────────────────
// Bygges som UNNTAK fra alle lag, ikke som lister: legges et nytt lag til i
// mapLayerCatalog, blir det med i stilene av seg selv. Det motsatte (eksplisitte
// lister) betyr at nye lag blir usynlige i alle stiler til noen husker dem.

// Vinter-ting er sjelden ønsket i oversikt og har ofte ingen data.
const VINTER = ['lysloype', 'heistrase', 'slalombakke']
// Marine POI — hører til Padling, ikke til et landkart.
const MARINE = ['kai', 'sjo-poi', 'sjo-navn']
// Overlegg som hentes live og tegner ikoner oppå kartet. De er nyttige, men
// de er ikke KARTET — en ren papirutskrift og et orienteringskart vil ha dem
// vekk.
const OVERLEGG = ['kulturminne', 'fredet-kulturminne', 'vannstasjon']

const uten = (...grupper) => {
  const fjern = new Set(grupper.flat())
  return ALL_LAYER_KEYS.filter((k) => !fjern.has(k))
}
const med = (base, ...ekstra) => [...new Set([...base, ...ekstra.flat()])]

// Turkart-grunnsettet: terreng, stinett, veier og navn. Kraftlinjer er
// BEVISST med — de er et av de sikreste orienterings-landemerkene i skog.
const LAG_TURKART = uten(MARINE, VINTER, [
  'idrettsanlegg',      // dekkende flate, sjelden ønsket i oversikt
  'stedsnavn-minor',    // grend/gård — navnerot på turkart
  'linje',              // gjerder
])

// ── Sti-paletter ──────────────────────────────────────────────────────────
// Erstatter den frie fargevelgeren som primærvalg. To fargevelgere med 16
// millioner verdier hver er ikke et valg, det er en oppgave — og de aller
// fleste kombinasjonene er dårligere enn temaets egen. Fem navngitte
// paletter dekker de reelle behovene; den frie velgeren finnes fortsatt
// bak «Egendefinert» for den som vil noe annet.
//
// `null` som verdi = følg temaet. Det er ikke det samme som svart/hvit:
// hvert tema setter sine egne sti-farger, og en hardkodet svart strek på
// et mørkt tema er usynlig.
export const STI_PALETTER = Object.freeze([
  {
    key: 'tema', label: 'Følg tema', farger: null,
    beskrivelse: 'Kartstilens egne sti-farger.',
  },
  {
    key: 'blekk', label: 'Blekk', farger: { fg: '#111111', bg: '#ffffff' },
    beskrivelse: 'Svart strek på hvit bunn — mest kontrast, som papirkart.',
  },
  {
    key: 'signal', label: 'Signalrød', farger: { fg: '#c1121f', bg: '#ffffff' },
    beskrivelse: 'Rød strek på hvit bunn, som UT.no og turrutebasen.',
  },
  {
    key: 'kobolt', label: 'Kobolt', farger: { fg: '#1d4ed8', bg: '#ffffff' },
    beskrivelse: 'Blå strek — skiller stien fra brune kurver og grønn skog.',
  },
  {
    key: 'magenta', label: 'Magenta', farger: { fg: '#c026d3', bg: '#ffffff' },
    beskrivelse: 'Maksimal kontrast mot alt naturen har av farger.',
  },
])

export const STI_PALETT_KEYS = STI_PALETTER.map((p) => p.key)

export function stiPalett(key) {
  return STI_PALETTER.find((p) => p.key === key) ?? null
}

// ── Kartstilene ───────────────────────────────────────────────────────────
// `strek` er multiplikatorer per STROKE_GROUPS-id (strokeOverrides.js).
// Utelatt gruppe = 1 (nøytral), som garanterer at en stil uten strek-mening
// rendres byte-identisk med katalogen.
//
// `relieff: null` = ikke rør brukerens valg. Bare Print har en mening her,
// og den er absolutt: relieffskygge er en gråtone-PNG med multiply-blend,
// og på papir blir den grumsete.
export const KARTSTILER = Object.freeze([
  {
    key: 'turkart',
    label: 'Turkart',
    beskrivelse: 'Grønn skog, brune høydekurver, tydelig stiplede stier. Leses som et vanlig norsk turkart.',
    tema: 'turkart',
    lag: LAG_TURKART,
    strek: { kurve: 0.85, sti: 1.3, litenVei: 1.1 },
    stiPalett: 'tema',
    relieff: null,
  },
  {
    key: 'orientering',
    label: 'Orientering',
    beskrivelse: 'ISOM 2017-2: kremgul mark, hvit løpbar skog, røde høydekurver. Sportskartet Lende ble bygget rundt.',
    tema: 'light',
    lag: med(uten(MARINE, VINTER, OVERLEGG, ['idrettsanlegg']), 'linje', 'stedsnavn-minor'),
    strek: {},
    stiPalett: 'tema',
    relieff: null,
  },
  {
    key: 'padling',
    label: 'Padling',
    beskrivelse: 'Sjøen i forgrunnen: dybde, kai, sjømerker og sjønavn. Land dempes til bakgrunn.',
    tema: 'padling',
    lag: med(uten(VINTER, ['idrettsanlegg', 'stedsnavn-minor', 'linje']), MARINE, 'dybde'),
    strek: { kurve: 0.7, sti: 0.9 },
    stiPalett: 'tema',
    relieff: null,
  },
  {
    key: 'natt',
    label: 'Natt',
    beskrivelse: 'Høykontrast mørkt kart for skjerm i mørket. Tykkere strek, dempede flater.',
    tema: 'dark',
    lag: LAG_TURKART,
    strek: { kurve: 1.15, sti: 1.4, litenVei: 1.2, storVei: 1.1 },
    stiPalett: 'tema',
    relieff: null,
  },
  {
    key: 'print',
    label: 'Print',
    beskrivelse: 'Blekk på hvitt papir. Relieff og GPS-spor av, kraftig strek — laget for å skrives ut.',
    tema: 'print',
    lag: uten(MARINE, VINTER, OVERLEGG, ['idrettsanlegg', 'stedsnavn-minor', 'spor']),
    strek: { kurve: 1.1, sti: 1.45, litenVei: 1.2, storVei: 1.15, bygg: 1.2 },
    stiPalett: 'blekk',
    relieff: false,
  },
])

export const KARTSTIL_KEYS = KARTSTILER.map((s) => s.key)
export const DEFAULT_KARTSTIL = 'turkart'

export function kartStil(key) {
  return KARTSTILER.find((s) => s.key === key) ?? null
}

/**
 * Hvilken kartstil svarer til gjeldende tilstand? Brukes til å markere den
 * aktive knappen i UI-et.
 *
 * Temaet er ankeret, ikke lagene: lag-synligheten kan brukeren finjustere
 * fritt etterpå uten at stilen skal slutte å være valgt. Motsatt vei ville
 * ett avslått lag gjort at ingen stil så valgt ut — nøyaktig den følelsen av
 * «ingenting henger sammen» som denne fila finnes for å fjerne.
 *
 * @param {{tema?: string}} tilstand
 * @returns {string|null}
 */
export function aktivKartStil({ tema } = {}) {
  return KARTSTILER.find((s) => s.tema === tema)?.key ?? null
}

/**
 * Utvid en innstillings-blokk med kartstilens verdier der brukeren ikke har
 * sagt noe selv. Eksplisitte felter vinner ALLTID — en kartstil er et
 * utgangspunkt, ikke en tvangstrøye, og det er hele poenget med at «Tilpass»
 * ligger under den.
 *
 * Bor her og ikke i mapSettingsApply fordi den er ren datalogikk på
 * kartstil-modellen. Kalles ett sted (buildSettingsCss), så MCP-verktøyet,
 * headless-byggingen og appens eksport arver den uten å vite om den.
 *
 * @param {{kartstil?: string, tema?: string, strek?: object, stiPalett?: string, stiFarger?: object}} innst
 */
export function utvidKartStil(innst = {}) {
  const s = innst.kartstil ? kartStil(innst.kartstil) : null
  if (!s) return innst
  return {
    ...innst,
    tema: innst.tema ?? s.tema,
    // Strek slås SAMMEN, ikke erstattes: stilens profil er basen, brukerens
    // egne multiplikatorer legges oppå gruppe for gruppe.
    strek: { ...s.strek, ...(innst.strek ?? {}) },
    stiPalett: innst.stiPalett ?? s.stiPalett,
  }
}
