<script setup>
import { computed, ref } from 'vue'
import isomCatalog from '../lib/isomCatalog.json'
import { buildIsomDefs, buildIsomCss } from '../lib/symbolizer.js'
import { listThemes, THEME_GROUPS } from '../lib/mapSettingsApply.js'


// Bygg pattern-defs + CSS som mapBuilder gjør, så samples i tegnforklaringen
// får eksakt samme visuelle uttrykk som ekte kart
const { defs: isomDefs, patternIds, symbolIds } = buildIsomDefs(isomCatalog)
const isomCss = buildIsomCss(isomCatalog, patternIds)

// Tegnforklaringen bruker det samme tema-systemet som kartet (isomCatalog.themes
// via listThemes), delt i de samme to seksjonene som drawer-en. Tidligere hadde
// den en egen Lys/Mørk-bryter mot en duplisert `darkMode`-blokk i katalogen, som
// bare dekket ett av åtte temaer og drev ut av sync med themes.dark.
const THEMES = listThemes(isomCatalog)
const sections = computed(() => THEME_GROUPS
  .map((g) => ({ ...g, themes: THEMES.filter((t) => (t.group ?? 'hoved') === g.key) }))
  .filter((g) => g.themes.length))

const currentTheme = ref('light')
const themeObj = computed(() => isomCatalog.themes?.[currentTheme.value])
const bgColor = computed(() => themeObj.value?.background ?? isomCatalog.background.color)

// UI-et rundt prøvene (kort, overskrifter) følger temaets bakgrunnsluminans —
// samme terskel som relieffets blend-valg i useReliefRender.
function hexLuminance(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? '')
  if (!m) return 1
  const n = parseInt(m[1], 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
const isDark = computed(() => hexLuminance(bgColor.value) < 0.4)

// Grupper koder i tematiske seksjoner for hjelp til lesing
const SECTIONS = [
  { title: 'Høydekurver', codes: ['101', '102'], category: 'contour' },
  { title: 'Stupkanter & blokker', codes: ['201', '203', '210', '213', '215', '216'], category: 'rock' },
  { title: 'Innlandsvann', codes: ['301', '302', '303', '304', '305', '308', '309'], category: 'water',
    note: 'Innsjø, tjern, bekk, myr. 303 saltvann der OSM tagger fjord.' },
  { title: 'Strand', codes: ['556'], category: 'manmade',
    note: 'OSM natural=beach tegnes som sand-flate i strandens faktiske form og størrelse (eget lag, default på).' },
  { title: 'Vegetasjon & terreng', codes: ['401', '403', '404', '405', '406', '407', '408', '409', '410'], category: 'terrain',
    note: '410 isbre er ikke en ISOM-kode — ISOM 2017-2 har ingen bre, fordi sportskart ikke '
      + 'tegnes på is. Norske turkart gjør det, og konvensjonen der er hvit flate med en svak '
      + 'blågrå kant. Flatene kommer fra Kartverkets N50 Arealdekke, navnene fra N50 Stedsnavn '
      + 'og OSM. Merk at ISOM har omvendt vegetasjonslogikk av andre norske kart: 405 løpbar '
      + 'skog er HVIT og 401 åpen mark er GUL. Turkart-stilen snur det tilbake.' },
  { title: 'Veier & stier', codes: ['501', '502', '503', '504', '505', '506', '507'], category: 'manmade' },
  { title: 'Jernbane', codes: ['515'], category: 'manmade' },
  { title: 'Vinter & ski', codes: ['510', '511', '512'], category: 'manmade' },
  { title: 'Bygninger', codes: ['521', '522', '532', '525', '528'], category: 'manmade',
    note: 'Bygg under 500 m² tegnes som et standardisert kvadrat på bygningens sentrum — '
      + 'faktiske småpolygoner er irregulære og forsvinner mot nærliggende stier. Fra v5.23.0 '
      + 'skilles tre slag: HYTTE (fylt kvadrat) er hytter, koier og turisthytter — landemerker '
      + 'og mulig ly; BOLIG (hvitt kvadrat med omriss) er hus og alt OSM ikke sier noe nærmere '
      + 'om; UTHUS (mindre og dempet) er garasjer, boder, låver og carporter, som er støy på et '
      + 'turkart. Kirker og kapell får korsmarkør i stedet for kvadrat.' },
  { title: 'Parkering & service', codes: ['534', '534u', '560'], category: 'manmade',
    note: 'Utfartsparkering (P med sti eller skogsbilvei innen 50 m) får fire sorte hjørne-braketter rundt det blå P-skiltet — en sannsynlig god kandidat for turstart. Vanlig/privat parkering er blå uten braketter. (Sorte braketter framfor grønn ramme: grønt mot blått er vanskelig for fargeblinde.) I kart-søket dukker disse opp som «Utfartsparkering ‹sted›» med en * etter navnet, der ‹sted› er nærmeste fjelltopp/ås/elv/vann (f.eks. «Utfartsparkering Knivåsen»). * betyr at navnet er utledet fra kart-data — ikke et offisielt navn eller en garantert turstart.' },
  { title: 'Verneområder', codes: ['520'], category: 'manmade',
    note: 'Naturreservat, nasjonalpark og landskapsvernområde hentet fra OSM (leisure=nature_reserve / boundary=protected_area). Lett grønn overlay matcher Kartverkets konvensjon.' },
]

function defForCode(category, code) {
  return isomCatalog.categories?.[category]?.[code]
}

function catFor(section, code) {
  if (section.categoryMap) return section.categoryMap[code] ?? section.category
  return section.category
}

// Temaets overstyring for en kode. Fyll: en tema-farge ERSTATTER et mønster
// (samme som --iso-<kode>-fill gjør i kartet), så pattern-nøkkelen droppes.
// Strek: temaet oppgir kun farge, så bredde/dasharray/linecap må bevares fra
// katalogen — ellers rendres prøvene med feil strek i alle temaer unntatt lys.
function themedFill(code, def) {
  const c = themeObj.value?.categories?.[code]?.fill?.color
  return c ? { color: c } : def.fill
}
function themedStroke(code, def, key = 'stroke') {
  const base = def[key]
  const c = themeObj.value?.categories?.[code]?.[key]?.color
  if (!c) return base
  return { ...(base ?? {}), color: c }
}

// Sample-rendering: bredt SVG (mm-basert) som viser ISOM-koden eksakt slik
// den blir tegnet i kartet — samme stroke-bredder, dasharrays og linecap.
// Container er 120×32 px så 1mm ≈ 3.78px (samme som print ved 96 dpi).
function sampleSvg(category, code) {
  const def = defForCode(category, code)
  if (!def) return ''
  const bg = bgColor.value
  const W = 120, H = 32
  const fill = themedFill(code, def)
  const stroke = themedStroke(code, def)

  // Bygg stroke-attributter som MATCHER det mapBuilder/symbolizer
  // produserer — mm-units, eksplisitt linecap/linejoin og dasharray.
  const strokeAttrs = (s) => {
    if (!s) return ''
    const parts = [`stroke="${s.color}"`, `stroke-width="${s.widthMm ?? 0.2}mm"`]
    if (s.linecap) parts.push(`stroke-linecap="${s.linecap}"`)
    if (s.linejoin) parts.push(`stroke-linejoin="${s.linejoin}"`)
    if (s.dasharray) parts.push(`stroke-dasharray="${s.dasharray.map(d => `${d}mm`).join(' ')}"`)
    return parts.join(' ')
  }

  if (def.point) {
    const symId = symbolIds.get(def.point.symbol)
    const s = (def.point.scaleMm ?? 1.0) * 6
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="isom-map" style="background:${bg}">
      <defs>${isomDefs}</defs>
      <rect width="${W}" height="${H}" fill="${bg}"/>
      ${symId ? `<use href="#${symId}" x="${W/2 - s/2}" y="${H/2 - s/2}" width="${s}" height="${s}"/>` : ''}
    </svg>`
  }
  if (stroke && !fill) {
    // Linje — bruk mm-units og inkluder linecap/linejoin slik kartet gjør.
    // Hvis def har overlayStroke (f.eks. jernbane med ladder-stripes),
    // rendres en ekstra linje på toppen for å matche kartet.
    const overlay = themedStroke(code, def, 'overlayStroke')
    const overlayLine = overlay
      ? `<line x1="4" y1="${H/2}" x2="${W-4}" y2="${H/2}" fill="none" ${strokeAttrs(overlay)}/>`
      : ''
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="background:${bg}">
      <rect width="${W}" height="${H}" fill="${bg}"/>
      <line x1="4" y1="${H/2}" x2="${W-4}" y2="${H/2}" fill="none" ${strokeAttrs(stroke)}/>
      ${overlayLine}
    </svg>`
  }
  if (fill) {
    // Polygon
    let fillAttr = fill.color ?? '#ccc'
    if (fill.type === 'pattern') {
      const pid = patternIds.get(fill.pattern)
      if (pid) fillAttr = `url(#${pid})`
    }
    const strokeStr = stroke ? strokeAttrs(stroke) : ''
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="isom-map" style="background:${bg}">
      <defs>${isomDefs}</defs>
      <style>${isomCss}</style>
      <rect width="${W}" height="${H}" fill="${bg}"/>
      <rect x="3" y="3" width="${W-6}" height="${H-6}" fill="${fillAttr}" ${strokeStr}/>
    </svg>`
  }
  return ''
}
</script>

<template>
  <!-- Innholdet i Tegnforklaringen — delt mellom ruten /tegnforklaring
       (LegendView, for deep-lenker) og modalen hovedmenyen åpner. Flaten maler
       seg selv fordi prøvene skal vises i KARTETS tema, ikke UI-temaet. -->
  <div class="min-h-full" :class="isDark ? 'bg-zinc-950 text-white/85' : 'bg-stone-100 text-zinc-900'">
    <!-- Tema-velgeren wrapper ved 200 % tekst: etiketten og nedtrekket får hver
         sin linje framfor at nedtrekket klippes av arkkanten. `min-w-0` er
         nødvendig — et <select> har en egen minstebredde og krymper ikke uten. -->
    <div class="px-4 pt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="text-sm font-semibold uppercase tracking-wide"
            :class="isDark ? 'text-white/75' : 'text-zinc-500'">Tema</span>
      <select v-model="currentTheme" aria-label="Tema for tegnforklaringen"
              class="min-w-0 max-w-full rounded-lg text-xs px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-emerald-400
                     [&>option]:text-zinc-900 [&>option]:bg-white"
              :class="isDark ? 'bg-white/10 text-white border-white/10' : 'bg-white text-zinc-800 border-zinc-300'">
        <optgroup v-for="s in sections" :key="s.key" :label="s.label">
          <option v-for="t in s.themes" :key="t.key" :value="t.key">{{ t.label }}</option>
        </optgroup>
      </select>
    </div>
    <p class="px-4 pt-2 text-xs leading-snug" :class="isDark ? 'text-white/75' : 'text-zinc-600'">
      ISOM 2017-2 inspirerte symboler brukt i turkartene. Print-kvalitet, 1:10000.
      Prøvene vises i valgt tema, akkurat som i kartet.
    </p>

    <div class="px-4 py-4 space-y-6">
      <section v-for="section in SECTIONS" :key="section.title">
        <h2 class="text-sm font-semibold uppercase tracking-wide mb-2"
            :class="isDark ? 'text-white/75' : 'text-zinc-500'">
          {{ section.title }}
        </h2>
        <p v-if="section.note" class="text-[11px] mb-2 leading-relaxed"
           :class="isDark ? 'text-white/70' : 'text-zinc-500'">
          {{ section.note }}
        </p>
        <div class="space-y-1.5">
          <!-- RADEN MÅ TÅLE 200 % TEKST (v6.5.43). Prøven var `w-30 shrink-0` og
               teksten `flex-1 min-w-0`: ved 200 % ble tekstspalta så smal at
               etiketten sto som «Hø-/kur-» i én bokstavs bredde, og på en smal
               telefon rant den ut av arket. Nå wrapper raden — prøven beholder
               sine 120 px som BASIS men får krympe til 72, og blir det for
               trangt, legger teksten seg på egen linje under i full bredde.
               Ingen fast bredde noe sted er derfor et tak lenger. -->
          <div v-for="code in section.codes" :key="code"
               class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2"
               :class="isDark ? 'bg-white/5' : 'bg-white border border-zinc-200'">
            <div class="basis-30 min-w-18 grow-0 h-8 rounded overflow-hidden ring-1"
                 :class="isDark ? 'ring-white/10' : 'ring-zinc-200'"
                 v-html="sampleSvg(catFor(section, code), code)" />
            <div class="flex-1 basis-40 min-w-0">
              <div class="text-sm leading-tight">
                {{ defForCode(catFor(section, code), code)?.label ?? '—' }}
              </div>
              <div class="text-[10px] mt-0.5"
                   :class="isDark ? 'text-white/70' : 'text-zinc-500'">
                ISOM {{ code }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <p class="text-[11px] pt-4 pb-8" :class="isDark ? 'text-white/70' : 'text-zinc-500'">
        Tegnforklaring er datadrevet fra <code>isomCatalog.json</code>. Endringer i katalogen reflekteres her automatisk.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Tailwind har ingen ferdig klasse for disse pikselverdiene; de er prøvens
   naturlige bredde (120 px), dens gulv, og tekstspaltas ønskede minstebredde
   før raden heller wrapper. */
.basis-30 { flex-basis: 120px; }
.min-w-18 { min-width: 72px; }
.basis-40 { flex-basis: 160px; }
</style>
