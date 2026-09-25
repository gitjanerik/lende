<script setup>
// Drawer-fane «Format» (innstillinger), skilt ut fra MapView v1.0.8.
// Kartstørrelse/format/høydekurver for NYE kart, pluss den globale
// relieff-standarden. Størrelsen bindes toveis via v-model (MapView eier
// slider-computeden); format- og ekvidistanse-refene er modul-singletons og
// hentes rett fra composablen.
//
// «Vis fulle navn» og «Navnetetthet» sto her til v7.8.34 og bor nå i
// Preferanser. De handlet aldri om formatet på neste kart — de handler om hvor
// mye tekst DU vil lese på et ark — og navnetettheten har i tillegg sin egen
// «bruk på alle kart», altså nettopp det skillet Preferanse-fana er tegnet
// rundt. Se DrawerPrefsTab.vue.
import { computed } from 'vue'
import {
  useMapSizePreference, resetMapPreferences,
  minEquidistanceForWidthKm, effectiveEquidistanceForWidthKm,
  MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM, DEFAULT_MAP_WIDTH_KM,
  MAP_FORMAT_OPTIONS, MAP_EQ_OPTIONS,
} from '../../composables/useMapSizePreference.js'
import { breddeHintFor } from '../../lib/equidistanceRules.js'
import { APP_VERSION } from '../../version.js'

defineProps({
  rebuildAtChosenSize: { type: Function, required: true },
  building: { type: Boolean, default: false },
  canRebuild: { type: Boolean, default: false },
})
const mapSizeSlider = defineModel('mapSizeSlider', { type: Number, default: 10 })

// Format- og høydekurve-standard for nye kart (delte singleton-refs).
const { mapFormat, mapEquidistance } = useMapSizePreference()
// Gating: samme bredde→ekvidistanse-regel som «Flere valg» i pickeren.
const minEq = computed(() => minEquidistanceForWidthKm(mapSizeSlider.value))
// Effektiv (markert) verdi: brukerens valg klampet til tillatt, auto ellers.
const effectiveEq = computed(() => effectiveEquidistanceForWidthKm(mapSizeSlider.value))
// Samme forklaring som pickeren viser — én kilde, så teksten ikke kan si noe
// annet enn tabellen gjør.
const eqHintFor = breddeHintFor
// «5 m», «5 og 10 m», «5, 10 og 20 m» — valgene bredden sperrer.
const tetteSperret = computed(() => {
  const v = MAP_EQ_OPTIONS.filter(eq => eq < minEq.value).map(eq => `${eq}`)
  return v.length > 1 ? `${v.slice(0, -1).join(', ')} og ${v.at(-1)} m` : `${v[0]} m`
})
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
const globalReliefEnabled = defineModel('globalReliefEnabled', { type: Boolean, default: true })
const globalReliefMode = defineModel('globalReliefMode', { type: String, default: 'vektor' })
</script>

<template>
  <div>
    <!-- Standarder for NYE kart (søk/GPS på forsiden): bredde-slider, format
         (kvadratisk/stående/liggende) og høydekurve-intervall — samme tre valg som
         «Flere valg» i pickeren, med samme bredde-gating for høydekurvene.
         Påvirker ikke kartet som vises nå, kun neste nye kart. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between mb-0.5">
        <div class="text-[13px] text-ink font-medium">Kartstørrelse (nye kart)</div>
        <div class="text-[13px] text-ink font-semibold tabular-nums">{{ mapSizeSlider }} × {{ mapSizeSlider }} km</div>
      </div>
      <input type="range" :min="MAP_SIZE_MIN_KM" :max="MAP_SIZE_MAX_KM" step="1"
             v-model.number="mapSizeSlider"
             aria-label="Kartstørrelse i km (bredde på nye kart)"
             class="w-full accent-emerald-400 cursor-pointer mt-1.5" />
      <div class="flex justify-between text-[10px] text-ink-4 tabular-nums mt-1 px-0.5">
        <span>{{ MAP_SIZE_MIN_KM }} km</span>
        <span>{{ MAP_SIZE_MAX_KM }} km</span>
      </div>
      <!-- Forklaringen sto som fem faste linjer mellom overskriften og
           slideren og skjøv selve kontrollen ned under skjermkanten ved 150 %
           tekst. Den er et OPPSLAG — man leser den én gang — så den ligger nå
           bak «Info», under slideren. `<details>` og ikke en egen ref: den er
           tastaturbetjent og annonsert av seg selv, og tilstanden trenger ikke
           overleve at fana lukkes. -->
      <details class="mt-1.5 group">
        <summary class="inline-flex items-center gap-1 text-[11px] text-ink-3
                        cursor-pointer select-none list-none active:opacity-70
                        [&::-webkit-details-marker]:hidden
                        focus-visible:outline-2 focus-visible:outline-offset-2
                        focus-visible:outline-emerald-400 rounded">
          <svg viewBox="0 0 24 24" class="w-3 h-3 transition-transform group-open:rotate-90"
               fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
          Info
        </summary>
        <div class="text-[11px] text-ink-3 leading-snug mt-1">
          Bredde på nye kart fra søk/GPS, {{ MAP_SIZE_MIN_KM }}–{{ MAP_SIZE_MAX_KM }} km.
          Større kart tar lengre tid å bygge, og grovere høydekurver: 5 m opp til
          og med 4 km, 10 m til og med 6 km, 20 m til og med 10 km — 25 og 50 m
          går alltid. I svært datatette områder (bykjerner) bygges kartet
          enklere og om nødvendig mindre, så det holder seg responsivt — «Flere valg»
          viser grensen på stedet, og Utvikler-fanen hva som ble justert.
        </div>
      </details>
      <!-- Kartformat: samme trippel som «Flere valg». -->
      <div class="text-[13px] text-ink font-medium mt-3 mb-1.5">Kartformat</div>
      <!-- Wrap framfor tre faste kolonner: se format-knappene i pickeren. -->
      <div class="flex flex-wrap gap-2" role="group" aria-label="Kartformat for nye kart">
        <button v-for="opt in MAP_FORMAT_OPTIONS" :key="opt.value"
                @click="mapFormat = opt.value"
                :aria-pressed="mapFormat === opt.value"
                class="flex-1 min-w-[6.5rem] rounded-md px-1 py-1.5 text-[12px] font-medium
                       transition-colors leading-tight"
                :class="mapFormat === opt.value ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
          {{ opt.label }}
        </button>
      </div>
      <!-- Høydekurver: samme valg og bredde-gating som «Flere valg»
           (≤ 4 km: alle; ≤ 6 km: min 10 m; ≤ 10 km: min 20 m; ellers min 25 m). -->
      <div class="flex items-baseline justify-between mt-3 mb-1.5">
        <div class="text-[13px] text-ink font-medium">Høydekurver</div>
        <div class="text-[12px] text-ink-3 tabular-nums">hver {{ effectiveEq }} m</div>
      </div>
      <div class="flex gap-1.5" role="group" aria-label="Høydekurve-intervall for nye kart">
        <button v-for="eq in MAP_EQ_OPTIONS" :key="eq"
                :disabled="eq < minEq"
                :title="eq < minEq ? eqHintFor(eq) : ''"
                @click="mapEquidistance = eq"
                :aria-pressed="effectiveEq === eq"
                class="flex-1 rounded-md px-1 py-1.5 text-[12px] font-medium transition-colors tabular-nums
                       disabled:opacity-35 disabled:cursor-not-allowed"
                :class="effectiveEq === eq ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
          {{ eq }} m
        </button>
      </div>
      <div v-if="minEq > 5" class="text-[10px] text-ink-4 leading-snug mt-1">
        Tette kurver ({{ tetteSperret }}) krever smalere kart
        — dra slideren ned for å låse opp.
      </div>
      <!-- Felles standard: default-bredde + auto-ekvidistanse + kvadratisk. -->
      <button @click="onReset()" :disabled="isAtDefaults"
              class="w-full mt-3 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                     active:scale-[0.98] disabled:opacity-40
                     bg-ink/5 border-ink/15 text-ink">
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
    <!-- Relieff av/på (GLOBAL standard — per-kart-overstyring gjøres bak
         tannhjulet i Relieff-snarveien): hillshade lages som ett bilde per
         kartflis og bruker minne/GPU. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Relieff (terrengskygge)</div>
        <div class="text-[11px] text-ink-3 leading-snug">
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
                :class="globalReliefMode === 'vektor' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
          Skarp (vektor)
        </button>
        <button @click="globalReliefMode = 'mjuk'"
                :aria-pressed="globalReliefMode === 'mjuk'"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="globalReliefMode === 'mjuk' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
          Mjuk (bilde)
        </button>
      </div>
      <div class="text-[11px] text-ink-3 leading-snug mt-1.5">
        Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
        Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
      </div>
    </div>
    <p class="text-ink-4 text-[10px] mt-1">v{{ APP_VERSION }}</p>
  </div>
</template>
