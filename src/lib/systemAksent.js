// Systemets aksentfarge → UI-ens flate-tokens.
//
// CSS-en kan LESE brukerens aksentfarge fra operativsystemet (`AccentColor`,
// CSS Color 4 system-colors), men bare der nettleseren støtter den: Firefox og
// Safari gjør det, Chromium gjør det IKKE — målt, ikke antatt:
// `CSS.supports('color', 'AccentColor')` er false i Chromium 141, og dermed i
// Chrome på Android. Android eksponerer heller ikke Material You mot nettet på
// noen annen måte. Tonen er derfor en PROGRESSIV FORBEDRING: står den ikke til
// rådighet, er UI-en byte-identisk med i dag.
//
// MODELLEN ER «BARE KULØREN», IKKE «BLAND INN AKSENTEN», og det er hele grunnen
// til at dette kan testes. Hvert flate-token beholder sin EGEN lyshet (oklch L
// fra dagens hex) og får aksentens KULØR med en klemt metning:
//
//     --color-app: oklch(from AccentColor 0.1767 min(c, 0.028) h);
//
// Fordi L står fast, er luminansen — og dermed kontrasten mot teksten, som ikke
// tones — bundet uansett hvilken farge brukeren har valgt. Tabellen under er
// fasiten CSS-en speiler, og `systemAksent.test.js` sveiper alle 360 kulører mot
// hvert tekstnivå. En «bland inn aksenten»-variant (color-mix) ville flyttet L
// med fargen, og da er kontrasten en gjetning per bruker.
//
// TO KONSEKVENSER SOM ER LETTE Å «FORENKLE» BORT:
//
// 1. METNINGSTAKET ER PER TOKEN, ikke per tema. sRGB er en kjegle: jo nærmere
//    hvitt eller svart, jo mindre metning får plass. Ved L = 1 (lyst
//    `--color-surface-2`/`--color-overlay`, altså rent hvitt) er taket 0,0002 —
//    praktisk talt null, og de står derfor UTEN tone (c = 0). Blir taket satt
//    for høyt, havner fargen utenfor sRGB, og da spriker nettleserne: Chromium
//    klipper per kanal (`oklch(1 0.022 255.5)` males som #f6ffff, ikke hvitt),
//    mens CSS Color 4 foreskriver metnings-reduksjon. Testen krever at HVER
//    kulør ligger innenfor sRGB, så resultatet er det samme i alle motorer.
//
// 2. `min(c, tak)` OG IKKE ET FAST TALL. En grå eller umettet aksent har c ≈ 0,
//    og skal da gi en grå tone — ikke en rød en. Et fast metningstall ville
//    tvunget kulør 0 på en akromatisk aksent, altså farget UI-en rød for den som
//    har slått fargen AV i systemet.
//
// Ren modul: ingen DOM, ingen fs, ingen nett.

const tilSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
const fraSrgb = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

function hexTilKanaler(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex).trim())
  if (!m) throw new Error(`Ugyldig hex: ${hex}`)
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** sRGB (0–1 per kanal) → OKLab. Björn Ottossons matriser. */
export function rgbTilOklab(r, g, b) {
  const R = fraSrgb(r), G = fraSrgb(g), B = fraSrgb(b)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

/** OKLab → sRGB (0–1 per kanal, UKLIPPET — verdier utenfor 0–1 er utenfor gamut). */
export function oklabTilRgb(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
  return [
    tilSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    tilSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    tilSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ]
}

/** #rrggbb → { l, c, h } i OKLCH (h i grader, 0–360). */
export function hexTilOklch(hex) {
  const [L, A, B] = rgbTilOklab(...hexTilKanaler(hex))
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** OKLCH → #rrggbb, med samme per-kanal-klipping som Chromium gjør. Kall
 *  `utenforGamut` først om resultatet skal være motor-uavhengig. */
export function oklchTilHex(l, c, h) {
  const r = (h * Math.PI) / 180
  const v = oklabTilRgb(l, c * Math.cos(r), c * Math.sin(r))
  const b = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')
  return `#${v.map(b).join('')}`
}

/** Hvor langt utenfor sRGB en (l, c, h) ligger, i kanal-enheter 0–255.
 *  0 betyr at fargen males likt i enhver motor. */
export function utenforGamut(l, c, h) {
  const r = (h * Math.PI) / 180
  const v = oklabTilRgb(l, c * Math.cos(r), c * Math.sin(r))
  return Math.max(0, ...v.map((x) => Math.max(-x, x - 1))) * 255
}

// Flate-tokenenes lyshet og metningstak. `l` er dagens hex omregnet til OKLCH
// (fire desimaler — nok til at fargen males tilbake byte-identisk), `c` er
// taket kuløren klemmes til. c = 0 betyr «ingen tone»: rent hvitt har ikke
// plass til noen. Speiles av @supports-blokka i style.css, og testen krever at
// de to er enige.
export const AKSENT_FLATER = {
  dark: {
    app: { l: 0.1767, c: 0.028 },
    surface: { l: 0.2103, c: 0.028 },
    'surface-2': { l: 0.2739, c: 0.028 },
    overlay: { l: 0.1408, c: 0.022 },
    modal: { l: 0.1408, c: 0.022 },
  },
  light: {
    app: { l: 0.9382, c: 0.022 },
    surface: { l: 0.9793, c: 0.008 },
    'surface-2': { l: 1, c: 0 },
    overlay: { l: 1, c: 0 },
    modal: { l: 0.9660, c: 0.015 },
  },
}

// HOVEDMENYEN HAR SIN EGEN PALETT (`--am-*` i AppMenu.vue), og den må tones
// sammen med resten. Den er ikke en glemt kopi av tokenene over: menyen er
// bevisst grønnlig-mørk / varm papir med sin egen grønne aksent, og den er den
// STØRSTE flata i appen. Ble den stående utonet, ville en blå Lende hatt én blå
// halvdel og én grå — og `--am-bg` er dessuten nøyaktig samme tone som lyst
// `--color-modal` (modalene matcher menyens papir), så de to ville drevet fra
// hverandre i samme bilde.
//
// BARE FLATENE. `--am-text` og `--am-dim` er TEKST og tones ikke, av samme grunn
// som `--color-ink-*`: det er det som gjør kontrasten målbar. `--am-accent` er
// den grønne «gjør noe»-fargen og betyr det samme uansett hvilken farge
// systemet har.
//
// Lyst `--am-card` er nesten hvitt (L = 0,9934) og har derfor et tak på 0,003 —
// samme grunn som de to hvite flatene over.
export const AKSENT_MENY = {
  dark: {
    bg: { l: 0.2012, c: 0.028 },
    surface: { l: 0.2592, c: 0.028 },
    card: { l: 0.2382, c: 0.028 },
    line: { l: 0.3018, c: 0.028 },
  },
  light: {
    bg: { l: 0.9660, c: 0.015 },
    surface: { l: 0.9144, c: 0.022 },
    card: { l: 0.9934, c: 0.003 },
    line: { l: 0.8810, c: 0.022 },
  },
}

/** Menyens tekstfarger — faste, som UI-ens `--color-ink-*`. Lyst `dim` var
 *  #6d7164 til v7.9.9; se AppMenu.vue for hvorfor den ble senket. */
export const MENY_TEKST = {
  dark: { text: '#eceade', dim: '#8d9182' },
  light: { text: '#1a1d16', dim: '#616558' },
}

/** Flatene menyens TEKST står på. `--am-line` er ikke med: den er en
 *  skillelinje (`border-top`) og bærer aldri tekst, så en tekstkontrast mot den
 *  ville målt noe som ikke finnes. Den tones likevel — den er en flate. */
export const MENY_TEKSTFLATER = ['bg', 'surface', 'card']

/** Menyens flater UTONET, altså dagens verdier. Fasiten tabellen over måles mot. */
export const MENY_FLATER = {
  dark: { bg: '#151714', surface: '#22251f', card: '#1d201a', line: '#2c3026' },
  light: { bg: '#f6f4ea', surface: '#e6e3d5', card: '#fffdf5', line: '#dcd8c8' },
}

/** Flata slik nettleseren maler den når systemaksenten har kulør `h`.
 *  `tabell` er `AKSENT_FLATER` (UI-tokenene) eller `AKSENT_MENY` (hovedmenyen). */
export function aksentFlate(tema, flate, h, tabell = AKSENT_FLATER) {
  const t = tabell[tema]?.[flate]
  if (!t) throw new Error(`Ukjent flate: ${tema}/${flate}`)
  return oklchTilHex(t.l, t.c, h)
}
