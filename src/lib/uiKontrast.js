// UI-kontrast: WCAG-regnestykket + tabellen over UI-ens teksttokens.
//
// Hvorfor dette finnes: hierarkiet i UI-en var skrevet som OPASITET
// (`text-ink/55` og slektningene). Opasitet er ikke tema-nøytral — den samme
// klassen komponerer mot ulik bunn i mørkt og lyst tema, så «tredje nivå» var
// 6,1:1 på #0e1116 og 3,8:1 på papirtonen. Én klasse, bestått i det ene temaet
// og strøket i det andre, uten at noe i koden skiller dem.
//
// Fra v6.5.48 er nivåene FASTE farger per tema (`--color-ink-2/-3/-4` i
// style.css), og denne fila er fasiten de måles mot. Testen ved siden av leser
// BÅDE tabellen og style.css, så en verdi som endres ett sted og ikke det andre
// feller bygget — ellers hadde tokenene og målingen drevet fra hverandre i det
// stille, som er nøyaktig den feilen de finnes for.
//
// Ren modul: ingen DOM, ingen fs, ingen nett.

const kanal = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** #rrggbb → { r, g, b } i 0–255. Kaster på alt annet, så en skrivefeil i
 *  tabellen blir en feil og ikke en stille NaN-kontrast. */
export function hexTilRgb(hex) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex).trim())
  if (!m) throw new Error(`Ugyldig hex: ${hex}`)
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** Relativ luminans etter WCAG 2.x. */
export function relativLuminans(hex) {
  const { r, g, b } = hexTilRgb(hex)
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b)
}

/** Kontrastforhold mellom to ugjennomsiktige farger, 1–21. */
export function kontrast(a, b) {
  const x = relativLuminans(a)
  const y = relativLuminans(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Farge med alfa lagt over en ugjennomsiktig bunn. Nettleseren komponerer i
 *  sRGB ved tegning, så det er der vi regner — ikke i oklab, der `color-mix`
 *  bare BLANDER fargen som Tailwind-opasiteten skriver ut. */
export function overBunn(hex, alfa, bunn) {
  const f = hexTilRgb(hex)
  const b = hexTilRgb(bunn)
  const k = (x, y) => Math.round(alfa * x + (1 - alfa) * y)
  const t = (n) => n.toString(16).padStart(2, '0')
  return `#${t(k(f.r, b.r))}${t(k(f.g, b.g))}${t(k(f.b, b.b))}`
}

// Flatene UI-tekst faktisk står på, per tema. Speiler style.css.
export const UI_FLATER = {
  dark: { app: '#0e1116', surface: '#18181b', 'surface-2': '#27272a', overlay: '#09090b', modal: '#09090b' },
  light: { app: '#efeae0', surface: '#faf8f3', 'surface-2': '#ffffff', overlay: '#ffffff', modal: '#f6f4ea' },
}

// Teksthierarkiet. Nivå 1 er `text-ink`; 2–4 er `text-ink-2/-3/-4`.
export const UI_TEKST = {
  dark: { ink: '#ffffff', 'ink-2': '#d4d4d8', 'ink-3': '#a1a1aa', 'ink-4': '#90909a' },
  light: { ink: '#1c1917', 'ink-2': '#44403c', 'ink-3': '#57534e', 'ink-4': '#6b645d' },
}

/** Minstekravet vi holder oss til: WCAG 2.2 AA for normal tekst. Alle fire
 *  nivåene skal klare det mot ALLE flatene i sitt tema — et nivå som bare
 *  virker på hovedbakgrunnen er et nivå som svikter i en modal. */
export const AA_NORMAL = 4.5

/** Alle (tema, nivå, flate)-kombinasjoner med sitt målte forhold. */
export function maalUiTekst() {
  const rader = []
  for (const tema of Object.keys(UI_TEKST)) {
    for (const [nivaa, farge] of Object.entries(UI_TEKST[tema])) {
      for (const [flate, bunn] of Object.entries(UI_FLATER[tema])) {
        rader.push({ tema, nivaa, flate, farge, bunn, forhold: kontrast(farge, bunn) })
      }
    }
  }
  return rader
}
