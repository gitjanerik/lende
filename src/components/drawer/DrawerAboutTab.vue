<script setup>
// Drawer-fane «Om» (innstillinger), skilt ut fra MapView v1.0.8. Kartstørrelse
// for nye kart, fulle navn, skjerm-våken, maks fliser, global relieff-standard
// og navnetetthet. Innstillingene bindes toveis via v-model; composable-
// objektet screenWake sendes inn som prop.
import {
  equidistanceForWidthKm, DEFAULT_MAP_WIDTH_KM, MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM,
} from '../../composables/useMapSizePreference.js'
import { DENSITY_PRESETS } from '../../composables/useLabelDensity.js'
import { APP_VERSION } from '../../version.js'

defineProps({
  mapSizeKm: { type: Number, default: null },
  rebuildAtChosenSize: { type: Function, required: true },
  building: { type: Boolean, default: false },
  canRebuild: { type: Boolean, default: false },
  screenWake: { type: Object, required: true },
  maxTiles: { type: Number, default: 0 },
  maxTileIndexMax: { type: Number, default: 4 },
})
const mapSizeSlider = defineModel('mapSizeSlider', { type: Number, default: 10 })
const showFullNames = defineModel('showFullNames', { type: Boolean, default: false })
const maxTileIndex = defineModel('maxTileIndex', { type: Number, default: 0 })
const globalReliefEnabled = defineModel('globalReliefEnabled', { type: Boolean, default: true })
const globalReliefMode = defineModel('globalReliefMode', { type: String, default: 'vektor' })
const densityId = defineModel('densityId', { type: String, default: 'normal' })
const densityApplyToAll = defineModel('densityApplyToAll', { type: Boolean, default: true })
</script>

<template>
  <div>
    <!-- Kartstørrelse for NYE kart (søk/GPS på forsiden). Slider 1–20 km,
         default 10 km. Ekvidistansen settes automatisk til den fineste
         tillatte for bredden (samme regel som «Flere valg»). Påvirker
         ikke kartet som vises nå, kun neste nye kart. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between mb-0.5">
        <div class="text-[13px] text-white font-medium">Kartstørrelse (nye kart)</div>
        <div class="text-[13px] text-white font-semibold tabular-nums">{{ mapSizeSlider }} × {{ mapSizeSlider }} km</div>
      </div>
      <div class="text-[11px] text-white/55 leading-snug mb-2">
        Bredde på nye kvadratiske kart fra søk/GPS. Ekvidistanse settes
        automatisk — fineste tillatte for bredden
        ({{ equidistanceForWidthKm(mapSizeSlider) }} m for {{ mapSizeSlider }} km).
        Større kart tar lengre tid å bygge.
      </div>
      <div class="flex items-center gap-2">
        <input type="range" :min="MAP_SIZE_MIN_KM" :max="MAP_SIZE_MAX_KM" step="1"
               v-model.number="mapSizeSlider"
               aria-label="Kartstørrelse i km (bredde på nye kart)"
               class="flex-1 accent-emerald-400 cursor-pointer" />
        <button @click="mapSizeSlider = DEFAULT_MAP_WIDTH_KM"
                class="shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium border transition active:scale-95"
                :class="mapSizeKm == null
                        ? 'bg-emerald-500/20 text-white border-emerald-400/50'
                        : 'bg-white/5 text-white/70 border-white/10'">
          Standard
        </button>
      </div>
      <div class="flex justify-between text-[10px] text-white/35 tabular-nums mt-1 px-0.5">
        <span>{{ MAP_SIZE_MIN_KM }} km</span>
        <span>{{ MAP_SIZE_MAX_KM }} km</span>
      </div>
      <!-- Bygg om gjeldende område i valgt størrelse — slipper å gå til
           forsiden for å teste samme sted ved en annen bredde. -->
      <button @click="rebuildAtChosenSize()" :disabled="building || !canRebuild"
              class="w-full mt-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                     active:scale-[0.98] disabled:opacity-50
                     bg-sky-500/15 border-sky-400/40 text-sky-100">
        Bygg om dette området i valgt størrelse
      </button>
    </div>
    <!-- Flerspråklige navn (norsk - samisk - finsk) i Nord-Norge.
         Default AV = vis kun det norske navnet for et renere kart.
         PÅ = vis hele det flerspråklige navnet. Søk finner alle språk
         uansett. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-white font-medium">Vis fulle navn</div>
        <div class="text-[11px] text-white/55 leading-snug">
          I Nord-Norge har mange steder navn på norsk, samisk og kvensk.
          Av: vis kun det norske navnet (renere kart). På: vis hele det
          flerspråklige navnet. Søk finner alle språk uansett.
        </div>
      </div>
      <button @click="showFullNames = !showFullNames"
              :aria-pressed="showFullNames"
              :aria-label="showFullNames ? 'Vis kun norske navn' : 'Vis fulle navn'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="showFullNames ? 'bg-emerald-500' : 'bg-white/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="showFullNames ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Innstillinger: hold skjerm våken. Default PÅ — nyttig når
         brukeren bruker kartet til orientering ute og ikke vil at
         telefonen skal låse skjermen midt i navigasjonen. -->
    <div v-if="screenWake.supported"
         class="rounded-lg bg-white/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-white font-medium">Hold skjerm våken</div>
        <div class="text-[11px] text-white/55 leading-snug">
          Hindrer at telefonen låser skjermen mens du bruker kartet. Slipper automatisk etter 2 min uten berøring så batteriet spares — tar seg igjen straks du tar på kartet. Slå av helt om du vil. <span class="text-white/70">Et aktivt nærhetsvarsel overstyrer 2-min-grensen og holder skjermen våken sammenhengende til varselet avbrytes — uavhengig av denne bryteren.</span>
        </div>
      </div>
      <button @click="screenWake.setEnabled(!screenWake.enabled.value)"
              :aria-pressed="screenWake.enabled.value"
              :aria-label="screenWake.enabled.value ? 'Slå av skjerm-våken' : 'Slå på skjerm-våken'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="screenWake.enabled.value ? 'bg-emerald-500' : 'bg-white/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="screenWake.enabled.value ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Maks kartfliser: hvor mange utsnitt mosaikk-cachen beholder.
         Trinn 4/9/16/25/36 (n×n), default 16. Påvirker mest lagring. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="flex items-center justify-between gap-3 mb-1.5">
        <div class="text-[13px] text-white font-medium">Maks kartfliser</div>
        <span class="text-white/60 text-[12px] tabular-nums">{{ maxTiles }}</span>
      </div>
      <input type="range" min="0" :max="maxTileIndexMax" step="1"
             v-model.number="maxTileIndex"
             aria-label="Maks antall kartfliser i mosaikken"
             class="w-full accent-sky-400"/>
      <div class="text-[11px] text-white/55 leading-snug mt-1.5">
        Hvor mange kart-utsnitt som beholdes i mosaikken. Flere = større sammenhengende
        område, men mer lagringsplass på enheten. De fjerneste fra der du er kappes først.
      </div>
    </div>
    <!-- Relieff av/på (GLOBAL standard — per-kart-overstyring gjøres i
         relieff-FAB-panelet via long-press): hillshade lages som ett
         bilde per kartflis og bruker minne/GPU. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-white font-medium">Relieff (terrengskygge)</div>
        <div class="text-[11px] text-white/55 leading-snug">
          Standard for alle kart. Lages som ett bilde per kartflis og bruker mer
          minne/GPU — slå av (eller senk antall fliser) på svake enheter.
          Hold relieff-knappen på kartet for å overstyre kun dette kartet.
        </div>
      </div>
      <button @click="globalReliefEnabled = !globalReliefEnabled"
              :aria-pressed="globalReliefEnabled"
              :aria-label="globalReliefEnabled ? 'Slå av relieff' : 'Slå på relieff'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="globalReliefEnabled ? 'bg-emerald-500' : 'bg-white/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="globalReliefEnabled ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Relieff-stil (global standard): vektor (skarpe tone-bånd, liten fil,
         best print) vs mjuk (myk PNG-gradient, men multi-MB i fil/eksport). -->
    <div v-if="globalReliefEnabled" class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-white font-medium mb-2">Relieff-stil</div>
      <div class="flex gap-2" role="group" aria-label="Relieff-stil">
        <button @click="globalReliefMode = 'vektor'"
                :aria-pressed="globalReliefMode === 'vektor'"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="globalReliefMode === 'vektor' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'">
          Skarp (vektor)
        </button>
        <button @click="globalReliefMode = 'mjuk'"
                :aria-pressed="globalReliefMode === 'mjuk'"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="globalReliefMode === 'mjuk' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'">
          Mjuk (bilde)
        </button>
      </div>
      <div class="text-[11px] text-white/55 leading-snug mt-1.5">
        Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
        Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
      </div>
    </div>
    <!-- Navnetetthet: rutenett-kvoten i tetthets-budsjettet. Lavere =
         roligere kart, høyere = flere navn. Byttes live (vrakes på nytt). -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-white font-medium mb-2">Navnetetthet</div>
      <div class="flex gap-2" role="group" aria-label="Navnetetthet">
        <button v-for="p in DENSITY_PRESETS" :key="p.id" @click="densityId = p.id"
                :aria-pressed="densityId === p.id"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="densityId === p.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'">
          {{ p.label }}
        </button>
      </div>
      <div class="text-[11px] text-white/55 leading-snug mt-1.5">
        Hvor mange navn som vises samtidig. Kartet avdekker flere når du zoomer inn;
        topp, vann og område prioriteres, og et søketreff vises alltid.
      </div>
      <!-- PÅ: tettheten gjelder konsekvent for alle kart. AV: valget over
           gjelder kun kartet du ser på nå (per-kart-overstyring). -->
      <label class="flex items-center justify-between gap-3 mt-3 cursor-pointer">
        <span class="text-[12px] text-white/80 leading-snug">
          Bruk på alle kart
          <span class="block text-[11px] text-white/45">
            {{ densityApplyToAll ? 'Samme tetthet overalt' : 'Gjelder kun dette kartet' }}
          </span>
        </span>
        <button type="button" role="switch" :aria-checked="densityApplyToAll"
                @click="densityApplyToAll = !densityApplyToAll"
                class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                :class="densityApplyToAll ? 'bg-emerald-500' : 'bg-white/15'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                :class="densityApplyToAll ? 'left-5' : 'left-0.5'" />
        </button>
      </label>
    </div>
    <p class="text-white/35 text-[10px] mt-1">v{{ APP_VERSION }}</p>
  </div>
</template>
