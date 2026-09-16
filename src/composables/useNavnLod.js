// Navn-LOD: hvilke stedsnavn som får plass i utsnittet.
//
// Trukket ut av MapView.vue i v5.9.0. Selve algoritmen har alltid bodd i
// lib/labelDeclutter.js (ren og enhetstestet); det som lå i MapView — og som er
// her nå — er skjermrom-transformen, boks-målingen og DOM-togglingen.
//
// Kontrakten mot resten av appen, i tre punkter som hver har kostet en bug:
//   1. Alle navn forblir SØKBARE. Søkeindeksen (useMapSearch) leser hele SVG-en
//      uavhengig av denne visnings-LOD-en, og et valgt treff tvinges synlig via
//      `forcedVisibleNameEls`.
//   2. Vi toggler ALDRI geometri. Navngitte polygoner står i søkeindeksen med
//      selve polygonet som `el`; skjuler man dem forsvinner innsjøen, ikke
//      navnet. Se guarden på `path` under.
//   3. Skjulingen skjer med klassen `name-lod-off` (CSS i MapView, IKKE i
//      symbolizer-CSS-en inni SVG-en) — så eksport og print alltid viser alt.
//   4. OVERLEGG SOM LIGGER PÅ ARKET ER HINDRINGER (v7.8.23). Snarvei-raden er
//      turkartets største overlegg, og et stort mørkt stedsnavn som glir inn
//      under den slår knappeteksten ut — meldt fra felt med skjermbilder. Raden
//      måles i skjermrom og sås inn i declutterens R-tre som en opptatt boks, så
//      navnet ikke plasseres der i det hele tatt. Det er KARTET som viker, ikke
//      raden som blir tyngre: alternativene var en uskarphet eller en tettere
//      flate, og begge koster det luftige uttrykket raden nettopp fikk.
//      Prisen er at navn under raden FORSVINNER framfor å flytte seg. De er
//      fortsatt søkbare (punkt 1), og et valgt søketreff er `forced` og står
//      over budsjettet — altså kan et treff fortsatt havne under raden.
//   5. HØYDETALLENE FØLGER SAMME REGEL, men gjennom en EGEN, enklere vei
//      (v7.8.24). En navnløs topp rendres som `<text data-label="peak-ele">472`,
//      og den teksten står ikke i søkeindeksen i det hele tatt: `SKIP_LABELS`
//      og `NUMERIC_RE` i useMapSearch kaster den, og toppens egen indeks-rad
//      får `el = null` fordi det ikke finnes noen navne-tekst å toggle. Derfor
//      sto «472» igjen under raden i full størrelse etter at navnene begynte å
//      vike — meldt fra felt. De er IKKE tatt inn i budsjettet: et høydetall
//      har verken score, rutenett-kvote eller hysterese å bli målt mot, og å
//      gi det en ville endret hvilke NAVN som får plass. Spørsmålet for dem er
//      bare «står den under overlegget?».
//   6. OG DEN VEIEN BÆRER TRE TING TIL FRA v7.8.25: veinummer-skilt,
//      parkerings-P og holdeplass-symboler. Cellene i raden er
//      HALVGJENNOMSIKTIGE, så et hvitt skilt og et blått P leses tvers gjennom
//      knappeteksten — meldt fra felt med skjermbilde. De har verken navn eller
//      indeks-rad, altså nøyaktig høydetallets situasjon. BYGG (ISOM 521, ikke
//      bymassen) er med i samme pass, men med en STRENGERE regel: de merges av
//      `mapBuilder` til én path per rutenett-celle, så de må være HELT dekket —
//      se `heltUnderHindring`. Konsekvensen er ærlig og verdt å kjenne: på et
//      kart der bygningene er merget, viker de først når hele cella ligger under
//      raden, altså i praksis sjelden. Skal de vike hus for hus, må `mapBuilder`
//      dele dem finere — det er en endring i BYGGET og treffer bare nye kart.
//   7. EN BOKS MÅLT PÅ ET SKJULT ELEMENT ER NULL, OG GJETNINGEN VAR FOR LITEN
//      (v7.8.28). Målingen skjer ÉN gang per kart, og stedsnavn-lagene ligger
//      `display:none` i arket til Kartlag-fana slår dem på — så navnene med
//      STØRST skrift på hele kartet (4,8–7,2 mm mot områdenavnets 3,0) var
//      nettopp de som fikk en gjettet boks på seks user-units i høyden. Den
//      rørte ikke snarvei-radens hindring i det hele tatt, og «Grend / gård»
//      ble stående og lese tvers gjennom knappeteksten mens alt annet vek.
//      To ting følger, og de løser hver sin halvdel: gjetningen leser den
//      BEREGNEDE skriftstørrelsen i stedet for å gange navnelengden med fire,
//      og en gjettet boks OPPGRADERES til den ekte i det elementet blir
//      målbart. Den siste er den generelle: et lag kan være av i Kartlag-fana,
//      men et stedsnavn kan også være CSS-gatet på zoom-trinn (`stedsnavn`
//      rank=minor utenfor `.zoom-near`), og et kart kan lastes i begge
//      tilstandene. Å tømme cachen fra hvert kallsted som kan endre dem er å
//      holde en liste vedlike; å måle på nytt når det er noe å måle er ikke.
//   8. NABOFLISENES NAVN VEK IKKE I DET HELE TATT (v7.8.30). Spøkelsesflisene
//      BEHOLDER navnene sine siden v12.0.11 — en nybygd naboflis skal vise
//      stedsnavn med én gang — men de holdes bevisst UTENFOR søkeindeksen, og
//      indeksen er hele inngangen til budsjettet. Regelen over
//      («naboflisene har ingen navn-LOD») var derfor sann i to betydninger der
//      bare den ene var ment: de skal ikke ta plass i budsjettet, men de skal
//      vike for et overlegg som ligger oppå dem. På et mosaikk-ark leste
//      nabofliseens navn tvers gjennom snarvei-raden — meldt fra felt med et
//      brenavn ved Illåbrean.
//      De hører hjemme i den ENKLE veien (punkt 5–6), og av nøyaktig samme
//      grunn som høydetallene: uten indeks-rad har de verken score, kvote eller
//      hysterese å bli målt mot, og spørsmålet for dem er bare «står den under
//      overlegget?». To ting skiller dem fra alt annet i det passet:
//      koordinatene er FLIS-LOKALE (`nestedSvgOffset` — samme regnestykke
//      Stifinneren og 3D bruker), og `useGhostTiles` døper om `data-layer` til
//      `data-ghost-layer` ved kloning, så velgerne må skrives om i takt. Den
//      omskrivingen er derfor AVLEDET av `SKJUL_VELGERE` og ikke en andre liste
//      — en kopi ville stått stille neste gang noen legger til et symbol.

import { ref, watch, onUnmounted } from 'vue'
import {
  declutter, heltUnderHindring, hindringsBoks, makeMinZoomOf, underHindring,
} from '../lib/labelDeclutter.js'
import { elementPosition } from './useMapSearch.js'
import { nestedSvgOffset } from '../lib/svgNestedOffset.js'

const DEBOUNCE_MS = 120
const MARGIN_PX = 80        // slingringsmonn så navn rett utenfor kanten teller med

// Hindringene krymper litt inn mot sin egen midte: raden er en RAMME med
// gjennomsiktig innmat, så et navn som så vidt stikker under ytterkanten er
// fortsatt lesbart, og en boks på nøyaktig ytterkanten ville ryddet et bredere
// felt enn det man ser. Negativ verdi ville gitt luft rundt — det er ikke det
// samme problemet, og skal i så fall begrunnes for seg.
const HINDRING_KRYMP_PX = 4

// Høydetall på navnløse topper. BARE `<text>`: på en NAVNGITT topp ligger
// høyden som en inline `<tspan data-label="peak-ele">` inni navne-teksten, og
// den teksten eies allerede av navn-LOD-en — skjules navnet, følger tallet med.
// Kontur-tallene er bevisst utenfor: de er små, røde og står langs kurvene, og
// et hull i ekvidistanse-lesingen er et annet problem enn det som ble meldt.
// TING SOM IKKE ER NAVN, MEN SOM VIKER SOM OM DE VAR DET (v7.8.25).
//
// Høydetallene var den første (v7.8.24), og de tre neste kom av samme melding
// fra felt med et skjermbilde: raden er en RAMME med halvgjennomsiktige celler,
// så et hvitt veinummer-skilt, et blått P og en holdeplass leses TVERS GJENNOM
// knappeteksten. De har det høydetallet har — ingen plass i søkeindeksen, altså
// verken score, budsjett eller rutenett-kvote — og spørsmålet for dem er bare
// «står den under overlegget?».
//
// `helt` skiller de to reglene, og skillet er GEOMETRIENS: se `heltUnderHindring`
// i labelDeclutter.js for hvorfor bygningene må ha full dekning og punkt-
// symbolene ikke skal ha det.
//
// BYGG ER 521 OG IKKE 522: «tett bebyggelse» er bymassens egen flate, og den er
// bakgrunn i samme forstand som skogen — tar man den bort under raden, får man
// et hull i arket i stedet for et renere overlegg. (På kart bygget før v9.1.31
// ligger 522 under `data-layer="bygning"`, så koden i selektoren er det som
// skiller dem der også.)
// ET SYMBOL SOM ER SKJULT VED MÅLETID HAR INGEN BOKS, og da må vi gjette.
// Målingen skjer én gang per kart, mens BÅDE våre egne klasser og Kartlag-fanas
// lag-brytere kan ha et lag slått av akkurat da — så «ingen boks» betyr ikke
// «ingenting her». Punkt-symbolene er alle ~6–7 mm i katalogen, og 7 mm er
// 26 user-units (mm er en CSS-absolutt enhet; se enhets-merknaden i CLAUDE.md).
// Bygningene har ingenting å gjette fra og hoppes over i stedet: en gjettet
// boks der ville med full-dekning-regelen skjult en hel rutenett-celle.
const SYMBOL_RESERVE_M = 26

// Punkt-symbolenes egen translate i `transform`, med mellomrom eller komma. Samme
// form som `TRANSLATE_RE` i useMapSearch, men den er ikke eksportert — og her
// leses BARE elementets eget attributt, ikke forfedrenes kjede, fordi lag-
// gruppene over dem ikke har transform.
const EGEN_TRANSLATE_RE = /translate\s*\(\s*([-0-9.eE]+)[\s,]+([-0-9.eE]+)\s*\)/
function egenTranslate(el) {
  const m = EGEN_TRANSLATE_RE.exec(el.getAttribute('transform') || '')
  if (!m) return null
  const x = parseFloat(m[1]); const y = parseFloat(m[2])
  return (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : null
}

// GJETNINGEN NÅR DET IKKE ER NOE Å MÅLE (se punkt 7 i filhodet).
//
// `getComputedStyle` svarer også for et `display:none`-element — den løser opp
// mm og calc() uten å rendre noe — og inne i viewBoxen er 1 CSS-px = 1
// user-unit, så tallet er i arkets eget rom uten omregning (se enhets-
// merknaden i CLAUDE.md). Det er hele grunnen til at skriftstørrelsen kan
// leses der boksen ikke kan.
const TEGNBREDDE = 0.55    // middels tegnbredde delt på skriftstørrelse
const FALLBACK_PX = 12     // ≈ 3,2 mm — områdenavnets størrelse, brukt når selv
                           // den beregnede stilen ikke er å få tak i (test/SSR).

/** Boks-estimat i user-units fra skriftstørrelse og tekstlengde. Ren. */
export function gjettetBoks(fontPx, tekstLengde) {
  const fs = fontPx > 0 ? fontPx : FALLBACK_PX
  const n = Math.max(1, tekstLengde || 0)
  return { bw: n * fs * TEGNBREDDE, bh: fs }
}

function skriftPx(el) {
  try {
    if (typeof getComputedStyle !== 'function') return 0
    const px = parseFloat(getComputedStyle(el).fontSize)
    return Number.isFinite(px) && px > 0 ? px : 0
  } catch { return 0 }
}

/** Den EKTE boksen hvis elementet rendres nå, ellers null. */
function maaltBoks(el) {
  if (typeof el?.getBBox !== 'function') return null
  let bw = 0, bh = 0
  try { const bb = el.getBBox(); bw = bb.width; bh = bb.height } catch { /* display:none → 0 */ }
  return (bw > 0 || bh > 0) ? { bw, bh } : null
}

const SKJUL_VELGERE = [
  // BARE `<text>`: på en NAVNGITT topp ligger høyden som en inline
  // `<tspan data-label="peak-ele">` inni navne-teksten, og den teksten eies
  // allerede av navn-LOD-en — skjules navnet, følger tallet med. Kontur-tallene
  // er bevisst utenfor: de er små, røde og står langs kurvene, og et hull i
  // ekvidistanse-lesingen er et annet problem enn det som ble meldt.
  { sel: 'text[data-label="peak-ele"]', helt: false, reserve: null },
  // Skiltet er `<g transform>` med rect + tekst; skjuler man bare teksten står
  // det hvite rektangelet igjen og er verre enn før.
  { sel: 'g[data-layer="veinummer"] > g', helt: false, reserve: SYMBOL_RESERVE_M },
  { sel: 'g[data-layer="parkering"] > g', helt: false, reserve: SYMBOL_RESERVE_M },
  { sel: 'g[data-layer="holdeplass"] > g', helt: false, reserve: SYMBOL_RESERVE_M },
  { sel: 'g[data-layer="bygning"][data-iso="521"] > path', helt: true, reserve: null },
]

// NABOFLISENE: SAMME SPØRSMÅL, ANNET KOORDINATROM (se punkt 8 i filhodet).
const GHOST_ROT = '#ghost-tiles'

/**
 * Skriv en aktiv-flis-velger om til den samme tingen i en naboflis. Ren.
 *
 * `useGhostTiles` døper om `data-layer` → `data-ghost-layer` på hver klonet
 * flis (så lag-toggling når dem, men perf-regelen `[data-layer] path` ikke
 * gjør det). En velger på `data-layer` treffer derfor ALDRI inne i en naboflis,
 * og det feiler stille: symbolet blir bare stående. Avledningen står her, i ÉN
 * funksjon, i stedet for som en parallell liste — en kopi ville stått stille
 * neste gang noen legger til et symbol i `SKJUL_VELGERE`.
 */
export function spokelsesVelger(sel) {
  return `${GHOST_ROT} ${sel.split('data-layer=').join('data-ghost-layer=')}`
}

// NAVNENE i en naboflis. Ett bredt uttrykk og ikke en liste over `data-label`-
// verdier: de rene tall-etikettene (kontur-, vann-, dybde-tall, dem-topp) er
// alt fjernet av `useGhostTiles` ved kloning, så det som står igjen ER navn —
// og en liste her ville vært et tredje sted å huske en ny etikett-type.
// Veinummeret er unntaket, og det er geometriens: skiltet er `<g>` med rect +
// tekst, så skjules bare teksten står det hvite rektangelet igjen. Det tas av
// den avledede `data-ghost-layer`-velgeren, som eier hele skiltet.
const GHOST_NAVN = {
  sel: `${GHOST_ROT} text[data-label]:not([data-label="veinummer"])`,
  helt: false, reserve: null,
}

// Klassegruppe for tetthets-budsjettet: topp/vann/område er PRIORITET (utenom
// rutenett-kvoten, men kollisjonssjekkes); bebyggelse/hytte er kvote-styrt.
const PRIORITY_NAME_KINDS = new Set(['vann-navn', 'peak', 'omrade-navn', 'naturreservat-navn'])

function nameGroup(e) {
  if (PRIORITY_NAME_KINDS.has(e.kind)) return 'priority'
  if (e.categories && e.categories.includes('vann')) return 'priority'
  return 'quota'   // stedsnavn, hytte-navn
}

// Score 0–100: les data-score (bakt ved bygging i mapBuilder.labelScore). Fallback
// for eldre kart uten attributtet, utledet fra kind/rank så de fortsatt vrakes ok.
function nameScore(e) {
  if (e._score != null) return e._score
  const raw = e.el?.getAttribute?.('data-score')
  let s = raw != null ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(s)) {
    if (e.kind === 'peak') s = 60
    else if (e.kind === 'vann-navn') s = 55
    else if (e.kind === 'stedsnavn') {
      const r = e.el?.getAttribute('data-rank')
      s = r === 'major' ? 70 : r === 'mid' ? 55 : 35
    } else if (e.kind === 'hytte-navn') s = 20
    else s = 45
  }
  e._score = s
  return s
}

/**
 * @param {{
 *   svgHostRef: import('vue').Ref, wrapperRef: import('vue').Ref,
 *   meta: import('vue').Ref,
 *   scale: import('vue').Ref, rotation: import('vue').Ref,
 *   translateX: import('vue').Ref, translateY: import('vue').Ref,
 *   searchIndex: () => Array|null,          // getter: useMapSearch sin indeks
 *   zoomNearThreshold: import('vue').Ref, zoomedInThreshold: number,
 *   nameBudgetFar: import('vue').Ref, nameBudgetMid: import('vue').Ref,
 *   nameBudgetNear: import('vue').Ref,
 *   nameCellPx: import('vue').Ref, nameK: import('vue').Ref,
 *   hindringSelektorer?: string[],   // overlegg navn ikke skal havne under
 * }} deps
 */
export function useNavnLod({
  svgHostRef, wrapperRef, meta,
  scale, rotation, translateX, translateY,
  searchIndex,
  zoomNearThreshold, zoomedInThreshold,
  nameBudgetFar, nameBudgetMid, nameBudgetNear,
  nameCellPx, nameK,
  hindringSelektorer = [],
}) {
  // v11.0.34: budsjettet er zoom-trappet — få navn på oversikt (ren bakgrunn),
  // gradvis flere når man zoomer inn. Tidligere var det fast 200 uansett zoom.
  // v11.0.37: terskel + budsjetter er live-justerbare (useLodTuning, Utvikler-fanen).
  function nameBudgetForZoom() {
    const s = scale.value || 1
    if (s >= zoomNearThreshold.value) return nameBudgetNear.value
    if (s >= zoomedInThreshold) return nameBudgetMid.value
    return nameBudgetFar.value
  }

  const forcedVisibleNameEls = new Set()

  // Label-boks (user-units) måles én gang når labels er synlige, cachet pr element.
  // Re-måles ved kart-load, tekst-skala- og font-bytte (alle endrer boks-bredden).
  const labelBoxCache = new Map()
  function measureLabelBoxes() {
    skjulbare = null  // samme livssyklus: kart-load, tekst-skala, font-bytte.
                      // Står FØR idx-guarden — et tomt søkeindeks-svar skal
                      // ikke etterlate dem målt mot forrige kart.
    const idx = searchIndex()
    if (!idx) return
    labelBoxCache.clear()
    for (const e of idx) {
      if (!e.el || typeof e.el.getBBox !== 'function') continue
      // Skjult ved måletid → estimat fra skrift og navnlengde, MERKET som
      // gjettet så et senere pass kan bytte det ut med den ekte boksen.
      const maalt = maaltBoks(e.el)
      labelBoxCache.set(e.el, maalt ?? {
        ...gjettetBoks(skriftPx(e.el), e.name?.length || 4), gjettet: true,
      })
    }
  }

  // De måles én gang per kart, som navnene. Posisjonen leses med
  // `elementPosition` — den samme funksjonen søkeindeksen bruker, så et tall og
  // et navn på samme topp havner i nøyaktig samme punkt. For en <text> er den
  // rene attributt-lesing pluss forfedrenes translate; ingen layout.
  let skjulbare = null
  let skjulbareSvg = null
  let skjulbareGhostN = -1
  // Aktiv flis + de samme tingene i hver naboflis (punkt 8). Spøkelses-jobbene
  // AVLEDES av lista over; bare de `data-layer`-baserte, siden GHOST_NAVN alt
  // dekker all tekst og en andre peak-ele-velger bare ville målt den to ganger.
  const SKJUL_JOBBER = [
    ...SKJUL_VELGERE.map((v) => ({ ...v, spokelse: false })),
    ...SKJUL_VELGERE
      .filter((v) => v.sel.includes('data-layer='))
      .map((v) => ({ ...v, sel: spokelsesVelger(v.sel), spokelse: true })),
    { ...GHOST_NAVN, spokelse: true },
  ]

  // Hvor mange fliser ligger i spøkelses-containeren nå? Målingen caches per
  // kart, men naboflisene kommer og går mens SVG-en står — en ny flis som ikke
  // utløser en ommåling er en flis med navn som aldri viker. Tellingen er ett
  // DOM-oppslag per pass og trenger ingen ny kontrakt mot `useGhostTiles`.
  const ghostAntall = (svg) => svg.querySelector(GHOST_ROT)?.childElementCount ?? 0

  function maalSkjulbare(svg) {
    skjulbare = []
    skjulbareSvg = svg
    skjulbareGhostN = ghostAntall(svg)
    for (const { sel, helt, reserve, spokelse } of SKJUL_JOBBER) {
      for (const el of svg.querySelectorAll(sel)) {
        // Aktiv-flis-jobbene skal ikke plukke opp en naboflis på veien:
        // `text[data-label="peak-ele"]` har ingen `data-layer` å skille på.
        if (!spokelse && el.closest(GHOST_ROT)) continue
        // `elementPosition` gir null for en DEGENERERT boks, og et lag som er
        // slått av i Kartlag-fana er nettopp det ved måletid. Punkt-symbolene
        // bærer hele posisjonen sin i sin EGEN transform-translate, så
        // for dem kan den leses uten layout i det hele tatt — og da overlever
        // målingen at laget var av akkurat da kartet ble lastet.
        const pos = elementPosition(svg, el)
          ?? (reserve ? egenTranslate(el) : null)
        if (!pos) continue
        // Skjult ved måletid. Et høydetall er 2–4 sifre, så et estimat fra
        // teksten er nær nok til en hindrings-test; et symbol får sin
        // katalog-størrelse, og et bygg hoppes over (se SYMBOL_RESERVE_M).
        let { bw, bh } = maaltBoks(el) ?? { bw: 0, bh: 0 }
        if (!(bw > 0) && !(bh > 0)) {
          const txt = (el.textContent || '').trim()
          if (txt) ({ bw, bh } = gjettetBoks(skriftPx(el), txt.length))
          else if (reserve) { bw = reserve; bh = reserve }
          else continue
        }
        // Koordinatene inne i en naboflis er FLIS-LOKALE — se
        // lib/svgNestedOffset.js. (Flisas halvmeters bleed tas ikke med; den er
        // under én meter og hindringene krympes alt fire piksler.)
        const { dx, dy } = spokelse ? nestedSvgOffset(el, svg) : { dx: 0, dy: 0 }
        skjulbare.push({ el, x: pos.x + dx, y: pos.y + dy, bw, bh, helt })
      }
    }
  }

  // Forrige passs synlige navn — hysterese (hindrer blinking ved pan/zoom rundt
  // en LOD-grense). minZoom-tabellen gjenbruker .zoom-near-terskelen.
  let prevShownNames = new Set()
  // Kalles av loadMap (useMapLoadPipeline) ved nytt kart — reassignment kan
  // ikke gjøres gjennom en destrukturert dep.
  function resetPrevShownNames() { prevShownNames = new Set() }
  const nameMinZoomOf = (score) => makeMinZoomOf(zoomNearThreshold.value)(score)

  // Overleggene måles i WRAPPER-LOKALE piksler, samme rom som kandidatenes
  // sx/sy. `getBoundingClientRect` leser den EKTE skjermboksen, altså inklusive
  // `zoom` på knappene og hva enn draget har gjort med høyden — det er hele
  // grunnen til at boksen leses av DOM-en og ikke regnes ut av tilstanden.
  // Selektorene slås opp på nytt hvert pass: overlegget står bak en `v-if`, så
  // et element-referanse ville vært foreldet i det modusen byttet.
  const hindringObs = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => scheduleNameLOD())
    : null
  onUnmounted(() => hindringObs?.disconnect())

  function hindringsBokser(wrap) {
    if (!hindringSelektorer.length || typeof document === 'undefined') return []
    const ut = []
    for (const sel of hindringSelektorer) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect()
        if (!(r.width > 0) || !(r.height > 0)) continue
        // Draget endrer høyden uten at noe annet fyrer — observeren er det som
        // gjør at navnene viker mens skuffa åpnes. `observe` er idempotent.
        hindringObs?.observe(el)
        const b = hindringsBoks(r, wrap, HINDRING_KRYMP_PX)
        if (b) ut.push(b)
      }
    }
    return ut
  }

  // Tetthets-budsjett: score → LOD (m/hysterese) → grådig kollisjon (rbush) +
  // rutenett-kvote → synlig-sett. Ren algoritme i lib/labelDeclutter.js; her står
  // kun skjermrom-transformen og DOM-toggling.
  function applyNameLOD() {
    const svg = svgHostRef.value?.querySelector('svg')
    const m = meta.value
    const idx = searchIndex()
    if (!svg || !m || !idx || !idx.length) return
    const wrap = wrapperRef.value?.getBoundingClientRect()
    if (!wrap || !wrap.width || !wrap.height) return
    if (!labelBoxCache.size) measureLabelBoxes()
    if (!skjulbare || skjulbareSvg !== svg || skjulbareGhostN !== ghostAntall(svg)) {
      maalSkjulbare(svg)
    }

    // Forward-transform viewBox-koordinat → wrapper-lokal skjermpiksel, samme
    // matte som usePinchZoom.panTo: SVG-en fyller wrapperen med
    // preserveAspectRatio="xMidYMid meet", deretter T(tx,ty)∘R(rot)∘S(s).
    const w = wrap.width, h = wrap.height
    const fit = Math.min(w / m.widthM, h / m.heightM)
    const offX = (w - m.widthM * fit) / 2
    const offY = (h - m.heightM * fit) / 2
    const s = scale.value || 1
    const rot = (rotation.value || 0) * Math.PI / 180
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const tx = translateX.value, ty = translateY.value
    const px2 = fit * s // user-units → skjerm-px

    const candidates = []
    for (const e of idx) {
      if (!e.el) continue   // unavngitte vann-polygoner har ingen tekst å toggle
      // ALDRI toggle GEOMETRI: navngitte polygoner (data-name på <path>) står i
      // søkeindeksen med selve polygonet som el. NVE-innsjøer fikk ingen egen
      // vann-navn-tekst (navn-taggen ble ikke lest av lakeLabels) → indeksen
      // beholdt POLYGONET som toggle-mål, og navn-LOD-en skjulte hele innsjøen
      // når navnet tapte declutter-budsjettet. Det var «vannet forsvinner ved
      // zoom/pan»-saken (2026-07-21): blått ved 200 m (raust budsjett), borte i
      // oversikt, flimret ved panorering. Navn-LOD skal kun styre etiketter
      // (<text>/<g>-grupper) — geometri er alltid synlig.
      if ((e.el.tagName ?? '').toLowerCase() === 'path') continue
      const px = offX + e.x * fit
      const py = offY + e.y * fit
      const sx = tx + s * (px * cos - py * sin)
      const sy = ty + s * (px * sin + py * cos)
      if (sx < -MARGIN_PX || sx > w + MARGIN_PX || sy < -MARGIN_PX || sy > h + MARGIN_PX) {
        continue   // utenfor synlig utsnitt — teller ikke, rør ikke klassen
      }
      let box = labelBoxCache.get(e.el)
      if (!box || box.gjettet) {
        // Gjettet boks: elementet var skjult da kartet ble målt — et lag som
        // sto av i Kartlag-fana, eller et zoom-trinn som ennå ikke var nådd.
        // Nå kan det være synlig, og da er den ekte boksen å foretrekke. Det
        // som fortsatt er skjult svarer 0 og beholder gjetningen.
        const ferskt = maaltBoks(e.el)
        if (ferskt) { box = ferskt; labelBoxCache.set(e.el, ferskt) }
      }
      if (!box) box = { bw: 8, bh: 6 }
      // Skjerm-AABB av (kart-rotert) label-boks.
      const hw = (box.bw * px2) / 2
      const hh = (box.bh * px2) / 2
      candidates.push({
        id: e.name || `${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`,
        el: e.el,
        score: nameScore(e),
        sx, sy,
        halfW: Math.abs(hw * cos) + Math.abs(hh * sin),
        halfH: Math.abs(hw * sin) + Math.abs(hh * cos),
        group: nameGroup(e),
        forced: forcedVisibleNameEls.has(e.el),
      })
    }

    const hindringer = hindringsBokser(wrap)

    const visible = declutter(candidates, {
      cellPx: nameCellPx.value,
      K: nameK.value,
      scale: s,
      minZoomOf: nameMinZoomOf,
      prevShown: prevShownNames,
      maxVisible: nameBudgetForZoom(),   // globalt tak (Utvikler-budsjett)
      hindringer,
    })

    // Høydetall, skilt, symboler og bygg: ingen kø, ingen kvote — bare
    // hindrings-testen. Uten hindringer er svaret nei for alle, og da skal
    // klassen likevel FJERNES: raden kan nettopp ha blitt lagt sammen, og et
    // element som ble stående skjult ville vært et hull i kartet ingen
    // mekanisme lenger eier.
    for (const hp of skjulbare) {
      const px = offX + hp.x * fit
      const py = offY + hp.y * fit
      const sx = tx + s * (px * cos - py * sin)
      const sy = ty + s * (px * sin + py * cos)
      const hw = (hp.bw * px2) / 2
      const hh = (hp.bh * px2) / 2
      const halfW = Math.abs(hw * cos) + Math.abs(hh * sin)
      const halfH = Math.abs(hw * sin) + Math.abs(hh * cos)
      const boks = { minX: sx - halfW, minY: sy - halfH, maxX: sx + halfW, maxY: sy + halfH }
      const test = hp.helt ? heltUnderHindring : underHindring
      const under = hindringer.length && test(boks, hindringer)
      hp.el.classList.toggle('name-lod-off', !!under)
    }

    for (const c of candidates) {
      c.el.classList.toggle('name-lod-off', !visible.has(c.id))
    }
    prevShownNames = visible
  }

  let nameLodTimer = null
  function scheduleNameLOD() {
    if (nameLodTimer) clearTimeout(nameLodTimer)
    nameLodTimer = setTimeout(applyNameLOD, DEBOUNCE_MS)
  }

  // Re-beregn LOD når utsnittet endrer seg (zoom/pan/rotasjon, gest eller
  // programmatisk). Debouncet så en pågående gest ikke beregner per frame.
  watch([scale, translateX, translateY, rotation], scheduleNameLOD)
  // Budsjett-knottene i Utvikler-fanen skal virke live.
  watch([nameBudgetFar, nameBudgetMid, nameBudgetNear], scheduleNameLOD)

  // Vinduet endret størrelse → andre navn får plass.
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleNameLOD)
    onUnmounted(() => window.removeEventListener('resize', scheduleNameLOD))
  }
  onUnmounted(() => { if (nameLodTimer) clearTimeout(nameLodTimer) })

  return {
    forcedVisibleNameEls, labelBoxCache,
    resetPrevShownNames, applyNameLOD, scheduleNameLOD,
  }
}

// Eksponert for test: budsjett-gruppering og score-fallback er de to stedene en
// endring i katalogen kan gi stille feil valg av navn — og `SKJUL_VELGERE` er
// et tredje, av en annen grunn: en velger som slutter å matche det `mapBuilder`
// emitterer feiler STILLE. Ingenting kaster, ingenting ser rart ut, symbolet blir
// bare stående under raden igjen. Testen bygger derfor et ekte ark og spør om
// velgerne treffer.
export const _internals = {
  nameGroup, nameScore, PRIORITY_NAME_KINDS, SKJUL_VELGERE, GHOST_NAVN,
}
