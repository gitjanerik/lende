// Kart-knottene: strek, relieff, tekst-skala, font — og FAB-panelene som
// finjusterer dem.
//
// Trukket ut av MapView.vue i v5.10.0. Én ting å vite før du endrer noe her:
// dette er tre lag oppå hverandre, og de er IKKE det samme.
//   1. KNOTTEN (strokeStepIndex / reliefStepIndex) er en global, persistert
//      grov-innstilling — samme for alle kart.
//   2. PANELET (strokeTuning / trailColors / reliefSettings) er per-kart
//      finjustering med global standard som fallback.
//   3. TEMAET kan slå relieffet av uten å persistere noe (reliefAutoOff), fordi
//      monokrom-temaene mister uttrykket sitt med en gråtone-gradient oppå.
// `reliefActive` er det render-koden skal se på; `reliefEnabled` er brukerens
// egen innstilling og den UI-et skriver til.
//
// Hvorfor `hooks` i stedet for importer: å dra en knott skal regenerere
// hillshade, oppdatere spøkelses-flisene, invalidere relieff-bånd og vekke
// navne-LOD-en. Alle fire eies av composables som opprettes LENGER NED i
// MapView, så de kommer inn som tilbakekall (TDZ-regelen i CLAUDE.md).

import { ref, computed, watch } from 'vue'
import { buildStrokeOverrideCss } from '../lib/strokeOverrides.js'
import { buildTrailColorCss, normalizeHex } from '../lib/trailColors.js'
import isomCatalog from '../lib/isomCatalog.json'
import { useStrokeTuning } from './useStrokeTuning.js'
import { useTrailColors } from './useTrailColors.js'
import { useReliefSettings } from './useReliefSettings.js'

// Delt med MapView: maks-fliser-slideren leser samme trinn-modell fra
// localStorage, men hører til mosaikk-lagringen og ikke til knottene.
export function loadKnobStep(key, def, len) {
  try {
    const v = parseInt(localStorage.getItem(key), 10)
    if (Number.isInteger(v) && v >= 0 && v < len) return v
  } catch { /* noop */ }
  return def
}

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, meta: import('vue').Ref,
 *   currentTheme: import('vue').Ref,
 *   fontPairId: import('vue').Ref, landFont: import('vue').Ref,
 *   waterFont: import('vue').Ref,
 *   labelBoxCache: () => Map,        // getter: eies av useNavnLod
 *   hooks: {
 *     applyHillshade: () => void, updateGhostReliefOpacity: () => void,
 *     renderGhostTiles: () => Promise|void, invalidateReliefBands: () => void,
 *     scheduleNameLOD: () => void, onResetAndRefreshGps: () => void,
 *     closeDrawer: () => void, knobDrawerReset: () => void,
 *   },
 * }} deps
 */
export function useKartKnotter({
  svgHostRef, meta, currentTheme,
  fontPairId, landFont, waterFont,
  labelBoxCache, hooks,
}) {
  // ---- knott-trinn, localStorage og kartstørrelse-basis ------------
  // ── Strek- og relieff-knotter (FAB) ──────────────────────────────────
  // To «volum-knotter» som har overtatt de gamle zoom-inn/ut-knappenes plass
  // (zoom dekkes av pinch + dobbel-tap). Tap = ett hakk opp (wrapper til min
  // etter max), lang-trykk = nullstill. «Sentrer»-knappen nullstiller begge.
  // Verdiene huskes globalt i localStorage (gjelder alle kart).
  //  • Strek-knotten skalerer all kartlinje-tykkelse via CSS-var --stroke-scale
  //    (se symbolizer.js). Senter-glyfen tegnes i faktisk valgt tykkelse.
  //  • Relieff-knotten styrer hillshade-opacity 0 → 0.72 og er nå eneste
  //    kontroll for relieff (lag-toggle fjernet). Blend-modus velges per tema
  //    (multiply på lyse, screen på mørke/art-tema) så relieffet «gløder» i
  //    Curves istedenfor å bli gjørmete.
  //  • Strek-hakkene er relative multiplikatorer; den effektive --stroke-scale
  //    ganges i tillegg med en kartstørrelse-basis (strokeSizeBase) fordi store
  //    kart har langt tettere kontur-tetthet — samme mm-strek blir et svart rot
  //    ved zoom. Et 10 km-kart får derfor hele skalaen skjøvet tynnere enn et
  //    1 km-kart, mens hint-boblen viser den faktiske effektive ×-verdien.
  // v10.2.38 — hele skalaen senket 30% (× 0.7 fra [0.4, 0.6, 0.85, 1.2, 1.6, 2.2]).
  // Maks-hakket × strokeSizeBase var litt for voldsomt (effektiv ~1.3–1.5×);
  // 30%-kuttet lander effektiv maks på drøyt 1 på både små og store kart.
  const STROKE_STEPS = [0.28, 0.42, 0.6, 0.84, 1.12, 1.54]
  const STROKE_DEFAULT_IDX = 2  // 0.6× (var 0.85×) etter 30%-nedjustering
  // v11.0.44: default-relieff senket fra 0.42 → 0.35 (idx 3 → 2). Flåten av
  // kart-eksperter (orientering + tilgjengelighet) fant at sterkt relieff drukner
  // brune koter i skyggesidene der landform-detalj bor. idx 2 = 0.35 ≈ «35 %».
  const RELIEF_STEPS = [0, 0.18, 0.35, 0.48, 0.60, 0.72]
  const RELIEF_DEFAULT_IDX = 2
  // Ferske kart får minst dette relieff-nivået («litt relieff») hvis relieffet er
  // skrudd HELT av (idx 0) — så et globalt persistert «av» ikke gjør alle nye
  // kart blast. Et bevisst lavt nivå (idx 1 = 0.18) respekteres.
  const FRESH_RELIEF_MIN_IDX = 2
  const STROKE_LS_KEY = 'lende-mapview-stroke-step'
  const RELIEF_LS_KEY = 'lende-mapview-relief-step'
  const LABEL_SCALE_LS_KEY = 'lende-mapview-label-scale'

  // Kartstørrelse-basis: 1 km → 1.0, 10 km → 0.4 (lineær mellom). Klam utenfor.
  // Gjør at samme knott-hakk gir tynnere streker på store kart der konturene
  // ligger tett, så maks ikke blir et svart rot og default matcher ~1 km-følelsen.
  function strokeSizeBase(widthM) {
    if (!Number.isFinite(widthM) || widthM <= 0) return 1
    const t = Math.min(1, Math.max(0, (widthM - 1000) / 9000))
    return 1 - 0.6 * t
  }
  const strokeStepIndex = ref(loadKnobStep(STROKE_LS_KEY, STROKE_DEFAULT_IDX, STROKE_STEPS.length))
  const reliefStepIndex = ref(loadKnobStep(RELIEF_LS_KEY, RELIEF_DEFAULT_IDX, RELIEF_STEPS.length))

  // ---- relieff-innstillinger, auto-av og reliefActive --------------
  // Relieff (terrengskygge) av/på + stil — fra v12.0.18 PER KART med global
  // standard som fallback (useReliefSettings). `reliefEnabled`/`reliefMode` er de
  // EFFEKTIVE verdiene for kartet som vises (leses av applyHillshade, buildGhostSvg
  // og FAB-en); Innstillinger-fanen binder de GLOBALE. Relieff-FAB-panelet
  // (long-press) redigerer per-kart-verdiene. 'vektor' (default) = diskrete
  // tone-bånd som rene SVG-polygoner; 'mjuk' = myk gradient-PNG (<image>).
  const RELIEF_BANDS = 5
  const reliefSettings = useReliefSettings()
  const reliefEnabled = reliefSettings.reliefEnabled
  const reliefMode = reliefSettings.reliefMode
  const globalReliefEnabled = reliefSettings.globalReliefEnabled
  const globalReliefMode = reliefSettings.globalReliefMode

  // Monokrom-temaene slår relieffet av automatisk — hillshade legger en
  // gråtone-gradient over flatene og bryter nettopp det ensfargede uttrykket de
  // er laget for. Dette er en TREDJE, IKKE-PERSISTERT bryter, med vilje: både
  // reliefEnabled (per kart) og reliefStepIndex (globalt) lagres i localStorage,
  // og temaet gjør IKKE det (det faller tilbake til 'light' ved reload). Et
  // auto-av lagret i en av dem ville blitt liggende igjen etter at temaet var
  // borte. Brukeren overstyrer via relieff-knotten, FAB-panelet eller
  // Innstillinger-fanen — alle tre nullstiller flagget.
  const reliefAutoOff = ref(false)
  // Det render-koden faktisk skal se på. reliefEnabled beholdes som brukerens
  // egen innstilling (og er den v-model-en UI-et skriver til).
  const reliefActive = computed(() => reliefEnabled.value && !reliefAutoOff.value)
  function clearReliefAutoOff() {
    if (!reliefAutoOff.value) return
    reliefAutoOff.value = false
    hooks.applyHillshade()
    void hooks.renderGhostTiles()
  }

  // ---- per-element strek-tuning og sti-farger ----------------------
  // Per-element strek-tuning (Strek-FAB-panelet, v12.0.18) — per kart med global
  // standard. Effektive multiplikatorer injiseres som override-CSS i kart-SVG-en
  // (applyStrokeOverrides) og ganges med den globale --stroke-scale-knotten.
  const strokeTuning = useStrokeTuning()
  // Top-level ref → auto-unwrap i template (nested refs unwrappes ikke).
  const strokeEffective = strokeTuning.effective

  // Sti-farger (Strek-FAB-panelet) — per kart med global standard, samme modell
  // som strek-tuningen over. Tom overstyring = følg temaets sti-farger.
  const trailColors = useTrailColors()
  const trailColorsEffective = trailColors.effective
  const trailColorsOverridden = trailColors.isOverridden

  // ---- tekst-skala og utledede knott-verdier -----------------------
  // Tekststørrelse-slider (desktop) — søsken til rotasjons-sliden. Verdien er
  // −100…100 med 0 = «normal» (midtstilt); skala = 2^(v/100) → 0.5×…2.0×, så
  // brukeren både kan øke og minske størrelsen på alle kart-etiketter. Lagres i
  // localStorage, men nullstilles av «Sentrer/Nullstill»-FAB (onResetAndRefreshGps).
  const LABEL_SCALE_MIN = -100
  const LABEL_SCALE_MAX = 100
  function loadLabelScaleSlider() {
    try {
      const v = parseInt(localStorage.getItem(LABEL_SCALE_LS_KEY), 10)
      if (Number.isInteger(v) && v >= LABEL_SCALE_MIN && v <= LABEL_SCALE_MAX) return v
    } catch { /* noop */ }
    return 0
  }
  const labelScaleSlider = ref(loadLabelScaleSlider())
  const userLabelScale = computed(() => Math.pow(2, labelScaleSlider.value / 100))
  const labelScalePct = computed(() => Math.round(userLabelScale.value * 100))
  const strokeScale = computed(() => STROKE_STEPS[strokeStepIndex.value] * strokeSizeBase(meta.value?.widthM))
  const reliefOpacity = computed(() => RELIEF_STEPS[reliefStepIndex.value])
  const strokeFrac = computed(() => strokeStepIndex.value / (STROKE_STEPS.length - 1))
  const reliefFrac = computed(() => reliefStepIndex.value / (RELIEF_STEPS.length - 1))

  // ---- gauge-geometri og hint-boble --------------------------------
  // Gauge-geometri: 270° sveip med gap nederst, i et 24×24 viewBox.
  const KNOB_R = 8.5
  function knobPolar(deg, r) {
    const a = deg * Math.PI / 180
    return [12 + r * Math.cos(a), 12 + r * Math.sin(a)]
  }
  function knobArc(frac, r = KNOB_R) {
    if (frac <= 0) return ''
    const sweep = 270 * frac
    const [x0, y0] = knobPolar(135, r)
    const [x1, y1] = knobPolar(135 + sweep, r)
    const large = sweep > 180 ? 1 : 0
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }
  const knobTrackD = knobArc(1)
  const strokeArcD = computed(() => knobArc(strokeFrac.value))
  const reliefArcD = computed(() => knobArc(reliefFrac.value))
  // Senter-strek tegnes i faktisk valgt tykkelse — selv-demonstrerende ikon.
  const strokeGlyphW = computed(() => (0.9 + 3.0 * strokeFrac.value).toFixed(2))
  const reliefGlyphOpacity = computed(() => (0.18 + 0.7 * reliefFrac.value).toFixed(2))

  // Transient hint-boble ved justering.
  const knobHint = ref('')
  let knobHintTimer = null
  function flashKnobHint(text) {
    knobHint.value = text
    if (knobHintTimer) clearTimeout(knobHintTimer)
    knobHintTimer = setTimeout(() => { knobHint.value = '' }, 1500)
  }

  // ---- applisering: strek, overstyring, sti-farger -----------------
  function applyStrokeScale() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (svg) svg.style.setProperty('--stroke-scale', String(strokeScale.value))
  }

  // Per-element strek-overstyring (Strek-FAB-panelet): injiserer !important-regler
  // som slår kartets bakede symbolizer-CSS. Nøytrale sliders → tom CSS → identisk
  // rendering med i dag. Ghost-fliser og detalj-inset arver reglene siden de
  // nestes/klones inn under samme SVG-rot; eksport klones fra live-DOM → WYSIWYG.
  function applyStrokeOverrides() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    let el = svg.querySelector('#stroke-override-style')
    const css = buildStrokeOverrideCss(strokeTuning.effective.value)
    if (!css) { el?.remove(); return }
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      el.setAttribute('id', 'stroke-override-style')
      svg.appendChild(el)
    }
    el.textContent = css
  }
  watch(strokeTuning.effective, applyStrokeOverrides)

  // Sti-farger: samme injeksjons-mønster som strek-overstyringen over, i en egen
  // <style> så de to kan settes uavhengig. Ingen overstyring → blokken fjernes og
  // temaets egne sti-farger gjelder igjen.
  function applyTrailColors() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    let el = svg.querySelector('#trail-color-style')
    const css = buildTrailColorCss(trailColors.effective.value)
    if (!css) { el?.remove(); return }
    if (!el) {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      el.setAttribute('id', 'trail-color-style')
      svg.appendChild(el)
    }
    el.textContent = css
  }
  watch(trailColors.effective, applyTrailColors)

  // ---- sti-farge-swatches (hva velgerne VISER) ---------------------
  // Fargen velgerne skal VISE når brukeren ikke har overstyrt: temaets sti-farge,
  // ellers katalogens ISOM-default (svart strek, krem casing). Casingen faller i
  // CSS tilbake på var(--bg), altså temaets bakgrunn — speiles her.
  const trailColorSwatches = computed(() => {
    const t = isomCatalog.themes?.[currentTheme.value]
    const def = isomCatalog.categories?.manmade?.['505']
    return {
      fg: normalizeHex(trailColorsEffective.value.fg
        ?? t?.categories?.['505']?.stroke?.color ?? def?.stroke?.color, '#000000'),
      bg: normalizeHex(trailColorsEffective.value.bg
        ?? t?.background ?? def?.casingStroke?.color, '#fbf7ec'),
    }
  })

  // ---- applisering: tekst-skala og fonter --------------------------
  // Tekst-skala — settes som CSS-var på kart-SVG-en; alle [data-label]-font-sizes
  // ganges med den via calc() i symbolizer-CSS-en (se `fs()` der). Sanntid, ingen
  // re-render.
  function applyLabelScale() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (svg) svg.style.setProperty('--label-scale', String(userLabelScale.value))
  }
  watch(labelScaleSlider, () => {
    applyLabelScale()
    try { localStorage.setItem(LABEL_SCALE_LS_KEY, String(labelScaleSlider.value)) } catch { /* noop */ }
    flashKnobHint(`Tekst ${Math.round(userLabelScale.value * 100)}%`)
    labelBoxCache().clear(); hooks.scheduleNameLOD()   // tekst-skala endrer boks-bredden
  })

  // Font-par — settes som CSS-vars på kart-SVG-en; symbolizer-CSS-en bruker
  // var(--land-font) på roten og var(--water-font) på vann-navn. Sanntid bytte.
  // (Persistens skjer i useLabelFonts; her bare appliseringen.)
  function applyLabelFonts() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    svg.style.setProperty('--land-font', landFont.value)
    svg.style.setProperty('--water-font', waterFont.value)
  }
  watch(fontPairId, () => {
    applyLabelFonts()
    flashKnobHint(`Font: ${fontPairId.value}`)
    labelBoxCache().clear(); hooks.scheduleNameLOD()   // ny font endrer boks-bredden
  })
  // Navnetetthet-bytte (eller bytte mellom global/per-kart) → re-vrak straks
  // (rutenett-kvoten kan endres; boks uendret).
  // ---- watch: strek- og relieff-trinn ------------------------------
  watch(strokeStepIndex, () => {
    applyStrokeScale()
    try { localStorage.setItem(STROKE_LS_KEY, String(strokeStepIndex.value)) } catch { /* noop */ }
    flashKnobHint(`Strek ${strokeScale.value.toFixed(2)}×`)
  })
  watch(reliefStepIndex, () => {
    hooks.applyHillshade()
    hooks.updateGhostReliefOpacity()   // hold mosaikk-spøkelsene i takt med relieff-nivået
    try { localStorage.setItem(RELIEF_LS_KEY, String(reliefStepIndex.value)) } catch { /* noop */ }
    flashKnobHint(reliefOpacity.value === 0 ? 'Relieff av' : `Relieff ${Math.round(reliefOpacity.value * 100)}%`)
  })

  // ---- watch: relieff av/på og stil --------------------------------
  // Relieff av/på (effektiv verdi — reagerer på både per-kart- og global-endring):
  // regenerer aktiv-flisas hillshade og re-render mosaikken (spøkelses-relieff
  // opprettes/fjernes i buildGhostSvg etter reliefEnabled). Persistering skjer i
  // useReliefSettings.
  // En bruker som rører av/på-bryteren (FAB-panelet eller Innstillinger-fanen)
  // har uttalt seg om relieffet, og skal vinne over temaets auto-av.
  watch(reliefEnabled, () => {
    reliefAutoOff.value = false
    hooks.applyHillshade()
    void hooks.renderGhostTiles()
    flashKnobHint(reliefEnabled.value ? 'Relieff på' : 'Relieff av')
  })

  // Relieff-stil bytte: fjern eksisterende relieff-lag (kan være feil element-type),
  // nullstill bånd-cachen, bygg på nytt, og re-render mosaikken (spøkelses-relieff
  // gates på modus i buildGhostSvg).
  watch(reliefMode, () => {
    svgHostRef.value?.querySelector('svg #hillshade-layer')?.remove()
    hooks.invalidateReliefBands()
    hooks.applyHillshade()
    void hooks.renderGhostTiles()
    flashKnobHint(reliefMode.value === 'vektor' ? 'Skarpt relieff (vektor)' : 'Mjukt relieff (bilde)')
  })

  // ---- tap og hold på knottene -------------------------------------
  // Tap = step (wrap) / sentrer, lang-trykk (600 ms) = åpne FAB-ens innstillings-
  // panel (v12.0.18 — erstattet lang-trykk-nullstill; nullstilling bor nå som
  // egen knapp i panelene). Selve gest-håndteringen — settled-vakten,
  // Samsung-pointercancel-en og avstands-avbruddet — bor i useLongPress via
  // FabCluster fra v4.8.2. Her står bare hva et tap og et hold BETYR.
  const knobPanel = ref(null)   // 'stroke' | 'relief' | 'zoom' | null

  function onFabKnobTap(kind) {
    if (kind === 'stroke') {
      strokeStepIndex.value = (strokeStepIndex.value + 1) % STROKE_STEPS.length
    } else if (kind === 'relief') {
      // Auto-av fra et monokrom-tema er ment å være lett å angre: ett tap skrur
      // relieffet på igjen i stedet for å telle et hakk. Brukerens eget «av»
      // (reliefEnabled) beholder derimot dagens hold-for-innstillinger-vakt.
      if (reliefAutoOff.value) {
        clearReliefAutoOff()
        flashKnobHint('Relieff på')
        return
      }
      if (!reliefEnabled.value) { flashKnobHint('Relieff er av — hold for innstillinger'); return }
      reliefStepIndex.value = (reliefStepIndex.value + 1) % RELIEF_STEPS.length
    } else {
      hooks.onResetAndRefreshGps()
    }
  }

  function onFabKnobHold(kind) {
    hooks.closeDrawer()        // hovedmeny-skuffen viker for panelet (som ved long-press på kart)
    hooks.knobDrawerReset()   // alltid åpne i standard-høyde (45 dvh)
    knobPanel.value = kind === 'center' ? 'zoom' : kind
  }

  // ---- panel-handlinger: standard og nullstill ---------------------

  // Panel-handlinger: «Angi som standard» løfter kartets verdier til global
  // standard; «Nullstill» setter kartet tilbake (strek → 1× + knott-default,
  // relieff → på + vektor + knott-default). Feedback vises i panel-footeren
  // (panelHint) — knobHint-bobla ligger bak panelet.
  const panelHint = ref('')
  let panelHintTimer = null
  function flashPanelHint(text) {
    panelHint.value = text
    if (panelHintTimer) clearTimeout(panelHintTimer)
    panelHintTimer = setTimeout(() => { panelHint.value = '' }, 2000)
  }
  function strokePanelSaveDefault() {
    strokeTuning.saveAsDefault()
    trailColors.saveAsDefault()
    flashPanelHint('Lagret som standard for alle kart')
  }
  function trailColorsReset() {
    trailColors.resetColors()
    flashPanelHint('Sti-farger følger temaet igjen')
  }
  function strokePanelReset() {
    strokeTuning.resetToNeutral()
    strokeStepIndex.value = STROKE_DEFAULT_IDX
    flashPanelHint('Strek nullstilt')
  }
  function reliefPanelSaveDefault() {
    reliefSettings.saveReliefAsDefault()
    flashPanelHint('Lagret som standard for alle kart')
  }
  function reliefPanelReset() {
    reliefSettings.resetRelief()
    reliefStepIndex.value = RELIEF_DEFAULT_IDX
    flashPanelHint('Relieff nullstilt')
  }
  function closeKnobPanel() {
    knobPanel.value = null
    panelHint.value = ''
  }
  // Per-kart-binding: alle tre overstyrings-lagene (strek-tuning, sti-farger,
  // relieff) må følge kartet som vises. Én funksjon i stedet for tre kall fra
  // MapView, så det ikke er mulig å glemme det tredje ved neste kartbytte.
  function bindKartId(id) {
    strokeTuning.setCurrentMap(id)
    trailColors.setCurrentMap(id)
    reliefSettings.setCurrentMap(id)
  }

  return {
    bindKartId,
    // knott-tilstand og utledede verdier
    strokeStepIndex, reliefStepIndex, strokeScale, reliefOpacity,
    labelScaleSlider, userLabelScale, labelScalePct,
    LABEL_SCALE_MIN, LABEL_SCALE_MAX, STROKE_STEPS, RELIEF_STEPS, RELIEF_BANDS,
    FRESH_RELIEF_MIN_IDX, RELIEF_LS_KEY, RELIEF_DEFAULT_IDX,
    // gauge-geometri for FAB-ene
    knobTrackD, strokeArcD, reliefArcD, strokeGlyphW, reliefGlyphOpacity,
    knobHint, flashKnobHint,
    // relieff
    reliefEnabled, reliefMode, reliefActive, reliefAutoOff,
    globalReliefEnabled, globalReliefMode, clearReliefAutoOff,
    // panel-innhold
    strokeTuning, strokeEffective, trailColors, trailColorsEffective,
    trailColorsOverridden, trailColorSwatches,
    knobPanel, panelHint, flashPanelHint, closeKnobPanel,
    strokePanelSaveDefault, strokePanelReset, trailColorsReset,
    reliefPanelSaveDefault, reliefPanelReset,
    // gest-betydning
    onFabKnobTap, onFabKnobHold,
    // applisering (kalles også ved kart-bytte fra useMapLoadPipeline)
    applyStrokeScale, applyStrokeOverrides, applyTrailColors,
    applyLabelScale, applyLabelFonts,
  }
}
