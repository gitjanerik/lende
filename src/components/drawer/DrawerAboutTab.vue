<script setup>
// Drawer-fane «Om» (innstillinger), skilt ut fra MapView v1.0.8. Kartstørrelse/
// format/høydekurver for nye kart, fulle navn, skjerm-våken, maks fliser,
// global relieff-standard og navnetetthet. Størrelsen bindes toveis via
// v-model (MapView eier slider-computeden); format- og ekvidistanse-refene er
// modul-singletons og hentes rett fra composablen.
import { computed } from 'vue'
import {
  useMapSizePreference, resetMapPreferences,
  minEquidistanceForWidthKm, effectiveEquidistanceForWidthKm,
  MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM, DEFAULT_MAP_WIDTH_KM,
  MAP_FORMAT_OPTIONS, MAP_EQ_OPTIONS,
} from '../../composables/useMapSizePreference.js'
import { DENSITY_PRESETS } from '../../composables/useLabelDensity.js'
import { APP_VERSION } from '../../version.js'

defineProps({
  rebuildAtChosenSize: { type: Function, required: true },
  building: { type: Boolean, default: false },
  canRebuild: { type: Boolean, default: false },
  screenWake: { type: Object, required: true },
  maxTiles: { type: Number, default: 0 },
  maxTileIndexMax: { type: Number, default: 4 },
})
const mapSizeSlider = defineModel('mapSizeSlider', { type: Number, default: 10 })
const showFullNames = defineModel('showFullNames', { type: Boolean, default: false })

// Format- og høydekurve-standard for nye kart (delte singleton-refs).
const { mapFormat, mapEquidistance } = useMapSizePreference()
// Gating: samme bredde→ekvidistanse-regel som «Flere valg» i pickeren.
const minEq = computed(() => minEquidistanceForWidthKm(mapSizeSlider.value))
// Effektiv (markert) verdi: brukerens valg klampet til tillatt, auto ellers.
const effectiveEq = computed(() => effectiveEquidistanceForWidthKm(mapSizeSlider.value))
function eqHintFor(value) {
  if (value === 2.5) return 'Krever bredde ≤ 2 km'
  if (value === 5)  return 'Krever bredde < 4 km'
  if (value === 10) return 'Krever bredde < 6 km'
  return ''
}
// Felles «Nullstill»: default-bredde + auto-ekvidistanse + kvadratisk. Slider-
// modellen settes via MapView-computeden (som lagrer null når verdien er default).
const defaultEq = computed(() => minEquidistanceForWidthKm(DEFAULT_MAP_WIDTH_KM))
function onReset() {
  resetMapPreferences()
  mapSizeSlider.value = DEFAULT_MAP_WIDTH_KM
}
const isAtDefaults = computed(() =>
  mapSizeSlider.value === DEFAULT_MAP_WIDTH_KM &&
  mapFormat.value === 'square' &&
  mapEquidistance.value == null
)
const maxTileIndex = defineModel('maxTileIndex', { type: Number, default: 0 })
const globalReliefEnabled = defineModel('globalReliefEnabled', { type: Boolean, default: true })
const globalReliefMode = defineModel('globalReliefMode', { type: String, default: 'vektor' })
const autoNaboPa = defineModel('autoNaboPa', { type: Boolean, default: true })
const densityId = defineModel('densityId', { type: String, default: 'normal' })
const densityApplyToAll = defineModel('densityApplyToAll', { type: Boolean, default: true })
</script>

<template>
  <div>
    <!-- Standarder for NYE kart (søk/GPS på forsiden): bredde-slider, format
         (kvadrat/portrett/A4) og høydekurve-intervall — samme tre valg som
         «Flere valg» i pickeren, med samme bredde-gating for høydekurvene.
         Påvirker ikke kartet som vises nå, kun neste nye kart. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between mb-0.5">
        <div class="text-[13px] text-ink font-medium">Kartstørrelse (nye kart)</div>
        <div class="text-[13px] text-ink font-semibold tabular-nums">{{ mapSizeSlider }} × {{ mapSizeSlider }} km</div>
      </div>
      <div class="text-[11px] text-ink/55 leading-snug mb-2">
        Bredde på nye kart fra søk/GPS. Større kart tar lengre tid å bygge. I
        svært datatette områder (bykjerner) bygges kartet enklere og om nødvendig
        mindre, så det holder seg responsivt — «Flere valg» viser grensen på
        stedet, og Utvikler-fanen hva som ble justert.
      </div>
      <input type="range" :min="MAP_SIZE_MIN_KM" :max="MAP_SIZE_MAX_KM" step="1"
             v-model.number="mapSizeSlider"
             aria-label="Kartstørrelse i km (bredde på nye kart)"
             class="w-full accent-emerald-400 cursor-pointer" />
      <div class="flex justify-between text-[10px] text-ink/35 tabular-nums mt-1 px-0.5">
        <span>{{ MAP_SIZE_MIN_KM }} km</span>
        <span>{{ MAP_SIZE_MAX_KM }} km</span>
      </div>
      <!-- Kartformat: samme trippel som «Flere valg». -->
      <div class="text-[13px] text-ink font-medium mt-3 mb-1.5">Kartformat</div>
      <div class="flex gap-2" role="group" aria-label="Kartformat for nye kart">
        <button v-for="opt in MAP_FORMAT_OPTIONS" :key="opt.value"
                @click="mapFormat = opt.value"
                :aria-pressed="mapFormat === opt.value"
                class="flex-1 rounded-md px-1 py-1.5 text-[12px] font-medium transition-colors leading-tight"
                :class="mapFormat === opt.value ? 'bg-emerald-500 text-white' : 'bg-ink/10 text-ink/70'">
          {{ opt.label }}
          <span v-if="opt.sub" class="block text-[10px] font-normal opacity-75">{{ opt.sub }}</span>
        </button>
      </div>
      <!-- Høydekurver: samme valg og bredde-gating som «Flere valg»
           (< 4 km: alle; 4–6 km: min 10 m; ≥ 6 km: min 20 m). -->
      <div class="flex items-baseline justify-between mt-3 mb-1.5">
        <div class="text-[13px] text-ink font-medium">Høydekurver</div>
        <div class="text-[12px] text-ink/60 tabular-nums">hver {{ effectiveEq }} m</div>
      </div>
      <div class="flex gap-1.5" role="group" aria-label="Høydekurve-intervall for nye kart">
        <button v-for="eq in MAP_EQ_OPTIONS" :key="eq"
                :disabled="eq < minEq"
                :title="eq < minEq ? eqHintFor(eq) : ''"
                @click="mapEquidistance = eq"
                :aria-pressed="effectiveEq === eq"
                class="flex-1 rounded-md px-1 py-1.5 text-[12px] font-medium transition-colors tabular-nums
                       disabled:opacity-35 disabled:cursor-not-allowed"
                :class="effectiveEq === eq ? 'bg-emerald-500 text-white' : 'bg-ink/10 text-ink/70'">
          {{ eq }} m
        </button>
      </div>
      <div v-if="minEq > 5" class="text-[10px] text-ink/40 leading-snug mt-1">
        Tette kurver ({{ minEq === 20 ? '5 og 10 m' : '5 m' }}) krever smalere kart
        — dra slideren ned for å låse opp.
      </div>
      <!-- Felles standard: default-bredde + auto-ekvidistanse + kvadratisk. -->
      <button @click="onReset()" :disabled="isAtDefaults"
              class="w-full mt-3 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                     active:scale-[0.98] disabled:opacity-40
                     bg-ink/5 border-ink/15 text-ink/85">
        Nullstill til standard ({{ DEFAULT_MAP_WIDTH_KM }} km · {{ defaultEq }} m · kvadratisk)
      </button>
      <!-- Bygg om gjeldende område i valgt størrelse — slipper å gå til
           forsiden for å teste samme sted ved en annen bredde. -->
      <button @click="rebuildAtChosenSize()" :disabled="building || !canRebuild"
              class="w-full mt-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                     active:scale-[0.98] disabled:opacity-50
                     bg-sky-500/15 border-sky-400/40 text-sky-100">
        Bygg om dette området med valgte innstillinger
      </button>
    </div>
    <!-- Flerspråklige navn (norsk - samisk - finsk) i Nord-Norge.
         Default AV = vis kun det norske navnet for et renere kart.
         PÅ = vis hele det flerspråklige navnet. Søk finner alle språk
         uansett. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Vis fulle navn</div>
        <div class="text-[11px] text-ink/55 leading-snug">
          I Nord-Norge har mange steder navn på norsk, samisk og kvensk.
          Av: vis kun det norske navnet (renere kart). På: vis hele det
          flerspråklige navnet. Søk finner alle språk uansett.
        </div>
      </div>
      <button @click="showFullNames = !showFullNames"
              :aria-pressed="showFullNames"
              :aria-label="showFullNames ? 'Vis kun norske navn' : 'Vis fulle navn'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="showFullNames ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="showFullNames ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Innstillinger: hold skjerm våken. Default AV (opt-in, v10.1.24) —
         nyttig når brukeren bruker kartet til orientering ute og ikke vil at
         telefonen skal låse skjermen midt i navigasjonen. Fra v2.4.2 holdes
         skjermen våken sammenhengende (ingen 2-min idle-slipp), så GPS ikke
         dør — derfor batteri-advarselen under. -->
    <div v-if="screenWake.supported"
         class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[13px] text-ink font-medium">Hold skjerm våken</div>
          <div class="text-[11px] text-ink/55 leading-snug">
            Hindrer at telefonen låser skjermen mens du bruker kartet, så GPS-posisjonen ikke stopper. Skjermen holdes våken sammenhengende så lenge dette er på. <span class="text-ink/70">Et aktivt nærhetsvarsel holder skjermen våken uansett — uavhengig av denne bryteren.</span>
          </div>
        </div>
        <button @click="screenWake.setEnabled(!screenWake.enabled.value)"
                :aria-pressed="screenWake.enabled.value"
                :aria-label="screenWake.enabled.value ? 'Slå av skjerm-våken' : 'Slå på skjerm-våken'"
                class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                :class="screenWake.enabled.value ? 'bg-emerald-500' : 'bg-ink/15'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                :class="screenWake.enabled.value ? 'left-5' : 'left-0.5'" />
        </button>
      </div>
      <!-- Batteri-advarsel: skjermen slipper ikke lenger automatisk, så en
           glemt mobil med kartet oppe tapper batteri. -->
      <div v-if="screenWake.enabled.value"
           class="mt-2.5 flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/25 px-2.5 py-2">
        <svg viewBox="0 0 24 24" class="w-4 h-4 text-red-400 shrink-0 mt-px" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div class="text-[11px] text-red-200/90 leading-snug">
          Bruk med varsomhet: skjermen slås ikke av av seg selv og tapper batteri raskt. Slå av her når du er ferdig, eller lås mobilen manuelt når du legger den fra deg.
        </div>
      </div>
    </div>
    <!-- Maks kartfliser: hvor mange utsnitt mosaikk-cachen beholder.
         Trinn 4/9/16/25/36 (n×n), default 16. Påvirker mest lagring. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-center justify-between gap-3 mb-1.5">
        <div class="text-[13px] text-ink font-medium">Maks kartfliser</div>
        <span class="text-ink/60 text-[12px] tabular-nums">{{ maxTiles }}</span>
      </div>
      <input type="range" min="0" :max="maxTileIndexMax" step="1"
             v-model.number="maxTileIndex"
             aria-label="Maks antall kartfliser i mosaikken"
             class="w-full accent-sky-400"/>
      <div class="text-[11px] text-ink/55 leading-snug mt-1.5">
        Hvor mange kart-utsnitt som beholdes i mosaikken. Flere = større sammenhengende
        område, men mer lagringsplass på enheten. De fjerneste fra der du er kappes først.
      </div>
    </div>
    <!-- Automatisk påfyll av nabofliser. Står rett under «Maks kartfliser» fordi
         de to hører sammen: den ene sier hvor mange fliser vi beholder, den
         andre hvordan de kommer inn. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Hent nabokart automatisk</div>
        <div class="text-[11px] text-ink/55 leading-snug">
          Når du drar kartet jevnt i én retning og stopper opp, hentes utsnittet du
          er på vei mot i bakgrunnen. Kartet står stille — flisa dukker opp når den
          er klar, og relieffet kommer sist når alt er ferdig.
        </div>
      </div>
      <button type="button" role="switch" :aria-checked="String(autoNaboPa)"
              @click="autoNaboPa = !autoNaboPa"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="autoNaboPa ? 'bg-emerald-500' : 'bg-ink/20'"
              aria-label="Hent nabokart automatisk">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
              :class="autoNaboPa ? 'translate-x-5' : ''"></span>
      </button>
    </div>
    <!-- Relieff av/på (GLOBAL standard — per-kart-overstyring gjøres i
         relieff-FAB-panelet via long-press): hillshade lages som ett
         bilde per kartflis og bruker minne/GPU. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Relieff (terrengskygge)</div>
        <div class="text-[11px] text-ink/55 leading-snug">
          Standard for alle kart. Lages som ett bilde per kartflis og bruker mer
          minne/GPU — slå av (eller senk antall fliser) på svake enheter.
          Hold relieff-knappen på kartet for å overstyre kun dette kartet.
        </div>
      </div>
      <button @click="globalReliefEnabled = !globalReliefEnabled"
              :aria-pressed="globalReliefEnabled"
              :aria-label="globalReliefEnabled ? 'Slå av relieff' : 'Slå på relieff'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="globalReliefEnabled ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="globalReliefEnabled ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Relieff-stil (global standard): vektor (skarpe tone-bånd, liten fil,
         best print) vs mjuk (myk PNG-gradient, men multi-MB i fil/eksport). -->
    <div v-if="globalReliefEnabled" class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-ink font-medium mb-2">Relieff-stil</div>
      <div class="flex gap-2" role="group" aria-label="Relieff-stil">
        <button @click="globalReliefMode = 'vektor'"
                :aria-pressed="globalReliefMode === 'vektor'"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="globalReliefMode === 'vektor' ? 'bg-emerald-500 text-white' : 'bg-ink/10 text-ink/70'">
          Skarp (vektor)
        </button>
        <button @click="globalReliefMode = 'mjuk'"
                :aria-pressed="globalReliefMode === 'mjuk'"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="globalReliefMode === 'mjuk' ? 'bg-emerald-500 text-white' : 'bg-ink/10 text-ink/70'">
          Mjuk (bilde)
        </button>
      </div>
      <div class="text-[11px] text-ink/55 leading-snug mt-1.5">
        Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
        Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
      </div>
    </div>
    <!-- Navnetetthet: rutenett-kvoten i tetthets-budsjettet. Lavere =
         roligere kart, høyere = flere navn. Byttes live (vrakes på nytt). -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-ink font-medium mb-2">Navnetetthet</div>
      <div class="flex gap-2" role="group" aria-label="Navnetetthet">
        <button v-for="p in DENSITY_PRESETS" :key="p.id" @click="densityId = p.id"
                :aria-pressed="densityId === p.id"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="densityId === p.id ? 'bg-emerald-500 text-white' : 'bg-ink/10 text-ink/70'">
          {{ p.label }}
        </button>
      </div>
      <div class="text-[11px] text-ink/55 leading-snug mt-1.5">
        Hvor mange navn som vises samtidig. Kartet avdekker flere når du zoomer inn;
        topp, vann og område prioriteres, og et søketreff vises alltid.
      </div>
      <!-- PÅ: tettheten gjelder konsekvent for alle kart. AV: valget over
           gjelder kun kartet du ser på nå (per-kart-overstyring). -->
      <label class="flex items-center justify-between gap-3 mt-3 cursor-pointer">
        <span class="text-[12px] text-ink/80 leading-snug">
          Bruk på alle kart
          <span class="block text-[11px] text-ink/45">
            {{ densityApplyToAll ? 'Samme tetthet overalt' : 'Gjelder kun dette kartet' }}
          </span>
        </span>
        <button type="button" role="switch" :aria-checked="densityApplyToAll"
                @click="densityApplyToAll = !densityApplyToAll"
                class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                :class="densityApplyToAll ? 'bg-emerald-500' : 'bg-ink/15'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                :class="densityApplyToAll ? 'left-5' : 'left-0.5'" />
        </button>
      </label>
    </div>
    <p class="text-ink/35 text-[10px] mt-1">v{{ APP_VERSION }}</p>
  </div>
</template>
