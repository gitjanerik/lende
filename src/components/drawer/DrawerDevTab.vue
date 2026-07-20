<script setup>
// Drawer-fane «Utvikler» (debug-hjelp), skilt ut fra MapView v1.0.8.
// Vardåsen-referansekart, Zoom-LOD-tuning (runtime-parametre), debug-tellere
// (fliser, viewport-culling, Sjøkart-WFS), diagnose-modus, lilla-stier-A/B og
// perf-logg-åpner.
import { computed } from 'vue'
import { LOD_DEFAULTS } from '../../composables/useLodTuning.js'
import { APP_VERSION } from '../../version.js'

const appVersion = APP_VERSION

const props = defineProps({
  scale: { type: Number, default: 1 },
  zoomTier: { type: String, default: 'far' },
  resetLodTuning: { type: Function, required: true },
  mapDataLabel: { type: String, default: '' },
  autoTileCount: { type: Number, default: 0 },
  maxTiles: { type: Number, default: 0 },
  cullStats: { type: Object, default: () => ({ indexed: 0, culled: 0, ms: 0 }) },
  sjokartStatusText: { type: String, default: '' },
  nveInnsjoStatusText: { type: String, default: '' },
  meta: { type: Object, default: null },
  purpleTrails: { type: Boolean, default: false },
  togglePurpleTrails: { type: Function, required: true },
  openVardasen: { type: Function, required: true },
  openPerfLog: { type: Function, required: true },
})
const metaAppVersionText = computed(() => props.meta?.appVersion ?? null)

const zoomNearThreshold = defineModel('zoomNearThreshold', { type: Number, default: 2.5 })
const nameBudgetFar = defineModel('nameBudgetFar', { type: Number, default: 60 })
const nameBudgetMid = defineModel('nameBudgetMid', { type: Number, default: 130 })
const nameBudgetNear = defineModel('nameBudgetNear', { type: Number, default: 250 })
const diagnose = defineModel('diagnose', { type: Boolean, default: false })
</script>

<template>
  <div>
    <!-- Vardåsen-referansekartet: bygges fra ekte Kartverket-data i CI og er
         nyttig som fast fasit ved feilsøk. -->
    <button @click="openVardasen"
            class="w-full mb-3 px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                   flex items-center justify-center gap-2 transition
                   bg-white/5 border-white/10 text-white/80">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
        <path d="M9 4 V18 M15 6 V20"/>
      </svg>
      <span class="font-medium">Åpne Vardåsen-referansekart</span>
    </button>

    <!-- Zoom-LOD: live-indikator + justerbare terskler. Endrer kun
         RUNTIME-parametre (når .zoom-near settes + navne-budsjett). Hvilke
         lag som gates er bakt inn i kartets CSS ved bygging. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <span class="text-white/55 text-[11px] uppercase tracking-wide">Zoom-LOD</span>
        <span class="text-[11px] tabular-nums"
              :class="{ 'text-white/45': zoomTier === 'far', 'text-sky-300': zoomTier === 'mid', 'text-emerald-300': zoomTier === 'near' }">
          {{ (scale || 1).toFixed(2) }}× · {{ zoomTier }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-white/55 text-[11px]">Detalj-terskel (.zoom-near)</span>
        <span class="text-white/55 text-[11px] tabular-nums">{{ zoomNearThreshold.toFixed(1) }}×</span>
      </div>
      <input type="range" min="1.5" max="5" step="0.1" v-model.number="zoomNearThreshold"
             aria-label="Detalj-terskel" class="w-full accent-emerald-400 mb-2"/>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-white/55 text-[11px]">Navne-budsjett (far/mid/near)</span>
        <span class="text-white/55 text-[11px] tabular-nums">{{ nameBudgetFar }}/{{ nameBudgetMid }}/{{ nameBudgetNear }}</span>
      </div>
      <input type="range" min="20" max="150" step="10" v-model.number="nameBudgetFar"
             aria-label="Navne-budsjett oversikt" class="w-full accent-white/40"/>
      <input type="range" min="40" max="250" step="10" v-model.number="nameBudgetMid"
             aria-label="Navne-budsjett mellomnivå" class="w-full accent-sky-400"/>
      <input type="range" min="80" max="500" step="10" v-model.number="nameBudgetNear"
             aria-label="Navne-budsjett detalj" class="w-full accent-emerald-400"/>
      <button @click="resetLodTuning"
              class="mt-1.5 w-full px-3 py-1.5 rounded-lg text-[11px] border
                     bg-white/5 border-white/10 text-white/70 active:scale-[0.98]">
        Nullstill ({{ LOD_DEFAULTS.near }}× · {{ LOD_DEFAULTS.budgetFar }}/{{ LOD_DEFAULTS.budgetMid }}/{{ LOD_DEFAULTS.budgetNear }})
      </button>
    </div>

    <div class="flex items-baseline justify-between gap-2 mb-2">
      <span class="text-white/55 text-[11px] uppercase tracking-wide">Debug</span>
      <span v-if="mapDataLabel" class="text-white/45 text-[11px] tabular-nums">{{ mapDataLabel }}</span>
    </div>
    <!-- Tile-cache: antall auto-fliser lagret (scroll-tilbake-mosaikk). -->
    <div class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-white/45 text-[11px]">Auto-fliser i cache</span>
      <span class="text-white/55 text-[11px] tabular-nums">{{ autoTileCount }} / {{ maxTiles }}</span>
    </div>
    <!-- Viewport-culling: hvor mange indekserte elementer som er skjult
         utenfor utsnittet akkurat nå + siste cull-beregning i ms. -->
    <div v-if="cullStats.indexed" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-white/45 text-[11px]">Viewport-culling</span>
      <span class="text-white/55 text-[11px] tabular-nums">
        {{ cullStats.culled }} / {{ cullStats.indexed }} skjult · {{ cullStats.ms }} ms
      </span>
    </div>
    <!-- Sjøkart-status: WFS-hentingen feiler stille (timeout/CORS/tom) —
         her vises HVORFOR dybdetall/kai mangler på kystkart. -->
    <div v-if="sjokartStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-white/45 text-[11px]">Sjøkart-WFS</span>
        <span class="text-[11px]"
              :class="meta?.sjokartStatus?.state === 'ok' ? 'text-white/55' : 'text-amber-300/80'">
          {{ sjokartStatusText }}
        </span>
      </div>
      <div v-for="(err, i) in (meta?.sjokartStatus?.errors ?? [])" :key="i"
           class="text-white/35 text-[10px] leading-tight break-all">
        {{ err.endpoint }}{{ err.typeName ? ` ${err.typeName}` : '' }} · {{ err.kind }}: {{ err.message }}
      </div>
    </div>
    <!-- Hvilken app-versjon ARKET ble bygd med (≠ appen som viser det).
         Avgjør på sekundet om en «kartet mangler X»-feil bare er et gammelt
         ark: bygd-med ≠ kjørende versjon → bygg kartet på nytt. -->
    <div v-if="meta" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-white/45 text-[11px]">Kart bygd med</span>
      <span class="text-[11px]" :class="metaAppVersionText === appVersion ? 'text-white/55' : 'text-amber-300/80'">
        {{ metaAppVersionText === appVersion ? `v${metaAppVersionText}` : `${metaAppVersionText ? 'v' + metaAppVersionText : 'eldre enn v1.0.47'} — app kjører v${appVersion}; bygg på nytt for ferske data` }}
      </span>
    </div>
    <!-- NVE-innsjø-status: innsjøene hentes live ved bygging — her vises
         HVORFOR innsjøer eventuelt mangler (stille nett-/CORS-feil på mobil).
         Vises ALLTID når kart-meta finnes; mangler status er det i seg selv
         diagnosen (ark bygd før v1.0.45). -->
    <div v-if="nveInnsjoStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-white/45 text-[11px]">NVE-innsjø</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.nveInnsjoStatus?.state === 'ok' ? 'text-white/55' : 'text-amber-300/80'">
          {{ nveInnsjoStatusText }}
        </span>
      </div>
    </div>
    <button @click="diagnose = !diagnose"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-2"
            :class="diagnose
                    ? 'bg-slate-400/20 border-slate-300/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/75'">
      {{ diagnose ? 'Diagnose: AV' : 'Diagnose-modus' }}
    </button>
    <div v-if="diagnose" class="text-[10px] text-white/55 leading-relaxed mb-3 px-1">
      Polygon-fargen viser kilden:
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(180, 80%, 55%);"></span> N50,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(140, 70%, 45%);"></span> NVE innsjø,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(220, 80%, 60%);"></span> OSM way,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(300, 80%, 60%);"></span> OSM relation,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(45, 90%, 55%);"></span> merged.
    </div>
    <!-- Lilla stier: live A/B-test av CD-forslaget (#7a4fa3) uten rebuild.
         Svart er default; knotten overstyrer via --iso-505/506/507-stroke. -->
    <button @click="togglePurpleTrails"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-2"
            :class="purpleTrails
                    ? 'bg-purple-400/20 border-purple-300/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/75'">
      {{ purpleTrails ? 'Lilla stier: PÅ' : 'Lilla stier (test)' }}
    </button>
    <!-- Byggetider (perf): viser localStorage-loggen så den kan kopieres
         og deles — mobil-konsollen er upraktisk. -->
    <button @click="openPerfLog"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]
                   bg-white/5 border-white/10 text-white/75">
      Byggetider (perf-logg)
    </button>
  </div>
</template>
