// String-basert påføring av visnings-innstillinger på en kart-SVG — den
// statiske ekvivalenten til det en ekspert-bruker gjør i MapViews drawer
// (Kartstil-fanen, Kartlag-fanen, Strek-knotten og Strek-FAB-panelet). Appen endrer
// live-DOM (style.display, --stroke-scale, injisert override-CSS); denne
// modulen gjør NØYAKTIG samme valg om til en <style>-blokk som bakes inn i
// SVG-teksten, så MCP-serveren kan levere ferdig justerte kart uten DOM.
//
// Vokabularet deles med UI-et: kartstiler fra kartStiler.js, lag-nøkler fra
// mapLayerCatalog.js,
// strek-grupper fra strokeOverrides.js. Kall er idempotente — en eksisterende
// innstillings-blokk byttes ut, den stables ikke.

import {
  LAYERS, DEFAULT_VISIBLE_LAYER_KEYS,
} from './mapLayerCatalog.js'
import { KARTSTILER, kartStil, STI_PALETTER, stiPalett, utvidKartStil } from './kartStiler.js'
import { buildStrokeOverrideCss, STROKE_GROUPS } from './strokeOverrides.js'
import { buildTrailColorCss, isTrailColor } from './trailColors.js'
import isomCatalogDefault from './isomCatalog.json' with { type: 'json' }

export const SETTINGS_STYLE_ID = 'kart-innstillinger'

// Temaene fra isomCatalog.themes i presentabel form (nøkkel, etikett,
// beskrivelse fra katalogens $comment, seksjon i tema-menyen, om temaet er
// monokromt — og om det auto-skjuler lag slik Curves gjorde). Delt kilde for
// MapViews tema-knapper, tegnforklaringen og MCP-ens juster_kart.
export function listThemes(catalog = isomCatalogDefault) {
  return Object.entries(catalog.themes ?? {}).map(([key, t]) => ({
    key,
    label: t.label ?? key,
    beskrivelse: t.$comment ?? '',
    group: t.group ?? 'hoved',
    monochrome: !!t.monochrome,
    autoHideLayers: !!t.autoHideLayers,
  }))
}

// Seksjonene tema-menyen deles i — rekkefølgen her er visningsrekkefølgen.
export const THEME_GROUPS = Object.freeze([
  // 'kartstil' eies av Kartstil-fanen (lib/kartStiler.js) og rendres IKKE som
  // løse tema-knapper — ellers ville samme utseende hatt to kontroller, som er
  // nettopp forvirringen kartstil-begrepet finnes for å fjerne.
  { key: 'kartstil', label: 'Kartstiler', beskrivelse: 'Velges under Kartstil.' },
  {
    key: 'monokrom',
    label: 'Monokrom',
    beskrivelse: 'Ensfargede kart. Relieff slås av automatisk — trykk på relieff-knotten for å hente det tilbake.',
  },
])

/**
 * CSS-variablene et tema setter, som [navn, verdi]-par — kilden både for
 * MapViews applyTheme() (live-DOM, style.setProperty) og buildThemeCss()
 * (statisk SVG): --bg, --bg-apen, --iso-<kode>-fill/stroke/overlay-stroke,
 * --iso-depth-1..5, --label-*-fill/halo og --art-fill-opacity. 'light' er
 * katalog-defaultene → tom liste. Casing-streker følger med gratis: bakt CSS
 * faller tilbake på var(--bg).
 */
export function themeVarEntries(temaKey, catalog = isomCatalogDefault) {
  const themes = catalog.themes ?? {}
  const t = themes[temaKey]
  if (!t) {
    throw new Error(`Ukjent tema «${temaKey}» — gyldige: ${Object.keys(themes).join(', ')}`)
  }
  const vars = []
  if (typeof t.fillOpacity === 'number' && t.fillOpacity < 1) {
    vars.push(['--art-fill-opacity', String(t.fillOpacity)])
  }
  if (temaKey !== 'light') {
    if (t.background) vars.push(['--bg', t.background])
    // Åpen-mark-tonen arket bytter til når det HAR ekte N50-skog å male oppå
    // (symbolizer: `.isom-map[data-areal~="skog"]`). Settes for ALLE temaer,
    // også de som ikke har noen egen — der er den lik den vanlige bakgrunnen,
    // og byttet blir en no-op. Alternativet, å utelate den, ville sendt hvert
    // slikt tema til katalogens kremgule fallback: mørke temaer med lyst ark.
    if (t.background || t.backgroundApen) {
      vars.push(['--bg-apen', t.backgroundApen ?? t.background])
    }
    for (const [code, def] of Object.entries(t.categories ?? {})) {
      if (def.fill?.color) vars.push([`--iso-${code}-fill`, def.fill.color])
      if (def.stroke?.color) vars.push([`--iso-${code}-stroke`, def.stroke.color])
      if (def.overlayStroke?.color) vars.push([`--iso-${code}-overlay-stroke`, def.overlayStroke.color])
      // Stipling per tema. Katalogens dasharray er ISOM-spec for trykk i
      // 1:10 000; på skjerm leses [0.36, 0.3] mm som heltrukket. Turkart
      // setter kortere strek og tettere luft, uten å røre ISOM-temaet.
      // Casing-fargen (den kontinuerlige underlinja på stier). symbolizer
      // faller tilbake på var(--bg), som er riktig for mørke temaer der stien
      // skal viske til bakgrunnen — men Turkart har GRØNN bakgrunn, og en
      // grønn casing under en grønn skog gjør stien usynlig. Da må temaet få
      // si «hvit» eksplisitt.
      if (def.casingStroke?.color) vars.push([`--iso-${code}-casing-stroke`, def.casingStroke.color])
      if (Array.isArray(def.stroke?.dash)) {
        vars.push([`--iso-${code}-dash`, def.stroke.dash.map((d) => `${d}mm`).join(' ')])
      }
    }
    if (Array.isArray(t.depthScale)) {
      t.depthScale.forEach((c, i) => vars.push([`--iso-depth-${i + 1}`, c]))
    }
    for (const [name, def] of Object.entries(t.labels ?? {})) {
      if (def.color) vars.push([`--label-${name}-fill`, def.color])
      if (def.haloColor) vars.push([`--label-${name}-halo`, def.haloColor])
    }
    // Mønster-farger: lar et tema endre rasterets STREKFARGE uten å flate ut
    // mønsteret. Nødvendig for myra, der 308 fast og 309 utrygg skilles kun av
    // rastertettheten — et flatt fyll ville gjort dem identiske.
    for (const [name, def] of Object.entries(t.patterns ?? {})) {
      if (def.stroke) vars.push([`--pattern-${name}-stroke`, def.stroke])
      if (def.fill) vars.push([`--pattern-${name}-fill`, def.fill])
    }
    // Punktsymbol-blekket (currentColor på roten) — de rene sort-på-hvitt
    // markene. Semantiske symbolfarger themes IKKE, se buildIsomCss.
    if (t.symbols?.ink) vars.push(['--sym-ink', t.symbols.ink])
    if (t.symbols?.paper) vars.push(['--sym-paper', t.symbols.paper])
  }
  return vars
}

// Unionen av alle variabel-navn noe tema kan sette — MapViews applyTheme
// bruker den til å rydde forrige temas variabler før nye settes.
export function allThemeVarNames(catalog = isomCatalogDefault) {
  const names = new Set()
  for (const key of Object.keys(catalog.themes ?? {})) {
    for (const [name] of themeVarEntries(key, catalog)) names.add(name)
  }
  return [...names]
}

export function buildThemeCss(temaKey, catalog = isomCatalogDefault) {
  const vars = themeVarEntries(temaKey, catalog)
  if (!vars.length) return ''
  return `.isom-map { ${vars.map(([n, v]) => `${n}: ${v}`).join('; ')}; }`
}

const LAYER_KEY_SET = new Set(LAYERS.map((l) => l.key))
// 'dybde' er MapViews spesial-toggle (Sjøkart-dybde på hovedkartet) — ikke et
// LAYERS-lag, men gyldig i kartstiler (Padling) og som lag-overstyring.
const EXTRA_KEYS = new Set(['dybde'])

/**
 * Regn ut hvilke lag som er synlige gitt tema + kartstil + per-lag-
 * overstyringer — samme semantikk som drawer-en: kartstilen (eller default-
 * synligheten) er utgangspunktet, `lag` skrur enkelt-lag av/på oppå det.
 * Et autoHideLayers-tema (Curves) speiler appens onThemeChange: basen blir
 * KUN høydekurver — en eksplisitt kartstil vinner over det, og `lag` justerer
 * til slutt.
 *
 * @param {{tema?: string, kartstil?: string, lag?: Record<string, boolean>}} settings
 * @param {object} [catalog]
 * @returns {Set<string>} synlige lag-nøkler
 */
export function resolveVisibleLayers(settings = {}, catalog = isomCatalogDefault) {
  const { tema, kartstil, lag = {} } = settings
  let visible
  if (kartstil) {
    const s = kartStil(kartstil)
    if (!s) {
      const known = KARTSTILER.map((x) => x.key).join(', ')
      throw new Error(`Ukjent kartstil «${kartstil}» — gyldige: ${known}`)
    }
    visible = new Set(s.lag)
  } else if (tema && catalog.themes?.[tema]?.autoHideLayers) {
    visible = new Set(['kontur'])
  } else {
    visible = new Set(DEFAULT_VISIBLE_LAYER_KEYS)
  }
  for (const [key, on] of Object.entries(lag)) {
    if (!LAYER_KEY_SET.has(key) && !EXTRA_KEYS.has(key)) {
      const known = [...LAYER_KEY_SET, ...EXTRA_KEYS].join(', ')
      throw new Error(`Ukjent lag «${key}» — gyldige: ${known}`)
    }
    if (on) visible.add(key)
    else visible.delete(key)
  }
  return visible
}

/**
 * Bygg CSS-en som realiserer innstillingene. Skjulte lag får display:none
 * (også spøkelses-fliser via data-ghost-layer, som i applyLayerVisibility);
 * 'navn' av skjuler i tillegg tall-labels inne i andre lag (kontur-tall,
 * vann-moh) — samme spesialtilfelle som drawer-en. 'dybde' på tvinger frem de
 * skjulte detalj-lagene (dybdepunkt/dybdekurve har inline display:none fra
 * bygging, derfor !important + display:inline).
 *
 * @param {{
 *   tema?: string,
 *   kartstil?: string,
 *   lag?: Record<string, boolean>,
 *   strekSkala?: number,
 *   strek?: Record<string, number>,
 *   stiPalett?: string,
 *   stiFarger?: {fg?: string, bg?: string},
 * }} settings
 * @returns {string} CSS (kan være tom — nøytrale innstillinger gir ingen regler)
 */
export function buildSettingsCss(rawSettings = {}) {
  // Kartstilen utvides FØRST: den fyller tema, strek-profil og sti-palett der
  // brukeren ikke har sagt noe selv. Skjer her, ett sted, så MCP-verktøyet,
  // headless-byggingen og appens eksport arver det uten å vite om det.
  const settings = utvidKartStil(rawSettings)
  const rules = []
  if (settings.tema) {
    const themeCss = buildThemeCss(settings.tema)
    if (themeCss) rules.push(themeCss)
  }
  const visible = resolveVisibleLayers(settings)

  for (const l of LAYERS) {
    if (visible.has(l.key)) continue
    rules.push(
      `.isom-map [data-layer="${l.key}"], .isom-map [data-ghost-layer="${l.key}"] { display: none !important; }`,
    )
  }
  if (!visible.has('navn')) {
    rules.push('.isom-map [data-label]:not([data-label="stedsnavn"]) { display: none !important; }')
  }
  if (visible.has('dybde')) {
    rules.push('.isom-map [data-layer="dybdepunkt"], .isom-map [data-layer="dybdekurve"] { display: inline !important; }')
  }

  // Sti-palett: den navngitte veien til det `stiFarger` gjør med rå hex.
  // Rå farger vinner når begge er oppgitt — en eksplisitt hex er et mer
  // spesifikt ønske enn et palett-navn.
  if (settings.stiPalett && !settings.stiFarger) {
    const pal = stiPalett(settings.stiPalett)
    if (!pal) {
      const known = STI_PALETTER.map((x) => x.key).join(', ')
      throw new Error(`Ukjent sti-palett «${settings.stiPalett}» — gyldige: ${known}`)
    }
    if (pal.farger) {
      const palCss = buildTrailColorCss(pal.farger)
      if (palCss) rules.push(palCss)
    }
  }

  if (settings.stiFarger) {
    const { fg, bg } = settings.stiFarger
    for (const [navn, v] of [['fg', fg], ['bg', bg]]) {
      if (v != null && !isTrailColor(v)) {
        throw new Error(`Ugyldig sti-farge «${navn}: ${v}» — bruk 6-sifret hex, f.eks. #7a4fa3`)
      }
    }
    const trailCss = buildTrailColorCss(settings.stiFarger)
    if (trailCss) rules.push(trailCss)
  }

  const { strekSkala, strek } = settings
  if (Number.isFinite(strekSkala) && strekSkala > 0 && strekSkala !== 1) {
    rules.push(`.isom-map { --stroke-scale: ${Number(strekSkala.toFixed(3))}; }`)
  }
  if (strek) {
    const known = new Set(STROKE_GROUPS.map((g) => g.id))
    for (const id of Object.keys(strek)) {
      if (!known.has(id)) {
        throw new Error(`Ukjent strek-gruppe «${id}» — gyldige: ${[...known].join(', ')}`)
      }
    }
    const overrideCss = buildStrokeOverrideCss(strek)
    if (overrideCss) rules.push(overrideCss)
  }
  return rules.join('\n')
}

const STYLE_BLOCK_RE = new RegExp(
  `<style id="${SETTINGS_STYLE_ID}">[\\s\\S]*?</style>\\n?`, 'g',
)

/**
 * Påfør innstillinger på en kart-SVG-streng: injiser (eller bytt ut)
 * <style id="kart-innstillinger"> rett før </svg>. Nøytrale innstillinger
 * fjerner en eventuell eksisterende blokk og returnerer ellers uendret SVG.
 *
 * @param {string} svgText
 * @param {Parameters<typeof buildSettingsCss>[0]} settings
 * @returns {string}
 */
export function applyMapSettings(svgText, settings = {}) {
  const css = buildSettingsCss(settings)
  const stripped = svgText.replace(STYLE_BLOCK_RE, '')
  if (!css) return stripped
  const block = `<style id="${SETTINGS_STYLE_ID}">\n${css}\n</style>\n`
  const idx = stripped.lastIndexOf('</svg>')
  if (idx === -1) return stripped + block
  return stripped.slice(0, idx) + block + stripped.slice(idx)
}

/**
 * Fargene en kartstil-knapp skal vise seg fram med. Hentes fra temaet
 * kartstilen peker på, med katalogens ISOM-defaults som fallback — så en
 * knapp aldri står tom fordi et tema lot en kode være.
 *
 * Poenget er at velgeren skal VISE forskjellen, ikke påstå den. Fem knapper
 * med bare tekst er nøyaktig det gamle forhåndsvalg-problemet i ny drakt.
 *
 * @param {string} kartstilKey
 * @param {object} [catalog]
 * @returns {{bg: string, kontur: string, sti: string, vann: string, skog: string}|null}
 */
export function kartStilForhandsvisning(kartstilKey, catalog = isomCatalogDefault) {
  const stil = kartStil(kartstilKey)
  if (!stil) return null
  const t = catalog.themes?.[stil.tema] ?? {}
  const cat = t.categories ?? {}
  const base = (code) => {
    for (const defs of Object.values(catalog.categories ?? {})) {
      if (defs[code]) return defs[code]
    }
    return null
  }
  const fill = (code, fallback) => cat[code]?.fill?.color ?? base(code)?.fill?.color ?? fallback
  const stroke = (code, fallback) => cat[code]?.stroke?.color ?? base(code)?.stroke?.color ?? fallback
  return {
    bg: t.background ?? catalog.background?.color ?? '#fefae0',
    kontur: stroke('101', '#dc2626'),
    sti: stroke('505', '#000000'),
    vann: fill('301', '#a8d4e8'),
    skog: fill('406', '#cae8a3'),
  }
}

/**
 * Er dette temaet mørkt? Avledes av temaets EGEN bakgrunnsluminans, ikke av
 * en liste over nøkler.
 *
 * Fram til v5.23.0 sto det `currentTheme !== 'light'` i MapView, altså «alt
 * som ikke er ISOM er mørkt». Det holdt så lenge de sju andre temaene var
 * mørke, men Turkart, Padling og Print er lyse — og en hardkodet liste ville
 * måttet huskes på nytt for hvert tema noen legger til senere.
 *
 * Terskelen er relativ luminans (WCAG-koeffisientene, uten gamma-korreksjon
 * — vi trenger en grov lys/mørk-avgjørelse, ikke en kontrastberegning).
 *
 * @param {string} temaKey
 * @param {object} [catalog]
 * @returns {boolean}
 */
export function erMorktTema(temaKey, catalog = isomCatalogDefault) {
  const bg = catalog.themes?.[temaKey]?.background ?? catalog.background?.color
  if (typeof bg !== 'string') return false
  const m = /^#([0-9a-f]{6})$/i.exec(bg.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return lum < 128
}
