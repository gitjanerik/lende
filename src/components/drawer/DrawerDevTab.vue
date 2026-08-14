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
  // Automatisk flis-påfyll: hva triggeren ser akkurat nå. Uten denne raden er
  // «hvorfor bygde den ikke?» ikke et spørsmål man kan svare på fra en mobil.
  autoNaboStatus: { type: Object, default: () => ({}) },
  cullDisabled: { type: Boolean, default: false },
  toggleCull: { type: Function, required: true },
  sjokartStatusText: { type: String, default: '' },
  nveInnsjoStatusText: { type: String, default: '' },
  turruteStatusText: { type: String, default: '' },
  n50StiStatusText: { type: String, default: '' },
  meta: { type: Object, default: null },
  openVardasen: { type: Function, required: true },
  openPerfLog: { type: Function, required: true },
})
const metaAppVersionText = computed(() => props.meta?.appVersion ?? null)

// Tetthets-linja: «915 /km² · svært tett → sparsom · bredde 8 → 6 km».
// meta.tetthet er null på kart bygget før v5.0.0 og på kart der sonderingen
// ikke kjørte (nett nede) — da vises ingen linje i stedet for et falskt «full».
const tetthetTekst = computed(() => {
  const t = props.meta?.tetthet
  if (!t || !Number.isFinite(Number(t.indeks))) return ''
  const deler = [`${Math.round(t.indeks)} /km²`, t.klasse]
  const nivaa = props.meta?.detaljNivaa
  if (nivaa && nivaa !== 'full') deler.push(`→ ${nivaa}`)
  if (Number.isFinite(t.fraBreddeKm) && Number.isFinite(t.tilBreddeKm) &&
      t.tilBreddeKm !== t.fraBreddeKm) {
    deler.push(`bredde ${t.fraBreddeKm} → ${t.tilBreddeKm} km`)
  }
  return deler.join(' · ')
})

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
                   bg-ink/5 border-ink/10 text-ink/80">
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
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <span class="text-ink/55 text-[11px] uppercase tracking-wide">Zoom-LOD</span>
        <span class="text-[11px] tabular-nums"
              :class="{ 'text-ink/45': zoomTier === 'far', 'text-sky-300': zoomTier === 'mid', 'text-emerald-300': zoomTier === 'near' }">
          {{ (scale || 1).toFixed(2) }}× · {{ zoomTier }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-ink/55 text-[11px]">Detalj-terskel (.zoom-near)</span>
        <span class="text-ink/55 text-[11px] tabular-nums">{{ zoomNearThreshold.toFixed(1) }}×</span>
      </div>
      <input type="range" min="1.5" max="5" step="0.1" v-model.number="zoomNearThreshold"
             aria-label="Detalj-terskel" class="w-full accent-emerald-400 mb-2"/>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-ink/55 text-[11px]">Navne-budsjett (far/mid/near)</span>
        <span class="text-ink/55 text-[11px] tabular-nums">{{ nameBudgetFar }}/{{ nameBudgetMid }}/{{ nameBudgetNear }}</span>
      </div>
      <input type="range" min="20" max="150" step="10" v-model.number="nameBudgetFar"
             aria-label="Navne-budsjett oversikt" class="w-full accent-ink/40"/>
      <input type="range" min="40" max="250" step="10" v-model.number="nameBudgetMid"
             aria-label="Navne-budsjett mellomnivå" class="w-full accent-sky-400"/>
      <input type="range" min="80" max="500" step="10" v-model.number="nameBudgetNear"
             aria-label="Navne-budsjett detalj" class="w-full accent-emerald-400"/>
      <button @click="resetLodTuning"
              class="mt-1.5 w-full px-3 py-1.5 rounded-lg text-[11px] border
                     bg-ink/5 border-ink/10 text-ink/70 active:scale-[0.98]">
        Nullstill ({{ LOD_DEFAULTS.near }}× · {{ LOD_DEFAULTS.budgetFar }}/{{ LOD_DEFAULTS.budgetMid }}/{{ LOD_DEFAULTS.budgetNear }})
      </button>
    </div>

    <div class="flex items-baseline justify-between gap-2 mb-2">
      <span class="text-ink/55 text-[11px] uppercase tracking-wide">Debug</span>
      <span v-if="mapDataLabel" class="text-ink/45 text-[11px] tabular-nums">{{ mapDataLabel }}</span>
    </div>
    <!-- Tile-cache: antall auto-fliser lagret (scroll-tilbake-mosaikk). -->
    <div class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Auto-fliser i cache</span>
      <span class="text-ink/55 text-[11px] tabular-nums">{{ autoTileCount }} / {{ maxTiles }}</span>
    </div>
    <!-- Automatisk flis-påfyll: retning, akkumulert drag, kø og økt-tak. -->
    <div class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Auto-nabo</span>
      <span class="text-ink/55 text-[11px] tabular-nums">
        {{ autoNaboStatus.retning || '—' }} · {{ autoNaboStatus.dragProsent ?? 0 }} %
        · {{ autoNaboStatus.byggerNokkel ? 'bygger' : 'venter' }}
        · {{ autoNaboStatus.bygdIOkt ?? 0 }}/{{ autoNaboStatus.tak ?? 0 }}
      </span>
    </div>
    <div v-if="autoNaboStatus.sisteAvvisning" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Siste avvisning</span>
      <span class="text-ink/55 text-[11px]">{{ autoNaboStatus.sisteAvvisning }}</span>
    </div>
    <!-- Viewport-culling: hvor mange indekserte elementer som er skjult
         utenfor utsnittet akkurat nå + siste cull-beregning i ms. -->
    <div class="flex items-center justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Viewport-culling</span>
      <span v-if="!cullDisabled && cullStats.indexed" class="text-ink/55 text-[11px] tabular-nums">
        {{ cullStats.culled }} / {{ cullStats.indexed }} skjult · {{ cullStats.ms }} ms
      </span>
      <!-- Feilsøk: culling av/på uten reload. Forsvinner «borte» innhold
           tilbake når den slås AV, er culling synderen — ellers dataene. -->
      <button @click="toggleCull()"
              class="px-2 py-1 rounded-md border text-[11px] active:scale-[0.98]"
              :class="cullDisabled
                      ? 'bg-amber-400/20 border-amber-300/50 text-amber-200'
                      : 'bg-ink/5 border-ink/10 text-ink/70'">
        {{ cullDisabled ? 'AV — slå på' : 'Slå av' }}
      </button>
    </div>
    <!-- Datatetthet: hva sonderingen fant, og hva den gjorde med kartet. Eneste
         sporet av HVORFOR et kart ble lettere eller mindre enn brukeren ba om. -->
    <div v-if="tetthetTekst" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Datatetthet</span>
      <span class="text-ink/55 text-[11px] text-right">{{ tetthetTekst }}</span>
    </div>
    <!-- Sjøkart-status: WFS-hentingen feiler stille (timeout/CORS/tom) —
         her vises HVORFOR dybdetall/kai mangler på kystkart. -->
    <div v-if="sjokartStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink/45 text-[11px]">Sjøkart-WFS</span>
        <span class="text-[11px]"
              :class="meta?.sjokartStatus?.state === 'ok' ? 'text-ink/55' : 'text-amber-300/80'">
          {{ sjokartStatusText }}
        </span>
      </div>
      <div v-for="(err, i) in (meta?.sjokartStatus?.errors ?? [])" :key="i"
           class="text-ink/35 text-[10px] leading-tight break-all">
        {{ err.endpoint }}{{ err.typeName ? ` ${err.typeName}` : '' }} · {{ err.kind }}: {{ err.message }}
      </div>
    </div>
    <!-- Hvilken app-versjon ARKET ble bygd med (≠ appen som viser det).
         Avgjør på sekundet om en «kartet mangler X»-feil bare er et gammelt
         ark: bygd-med ≠ kjørende versjon → bygg kartet på nytt. -->
    <div v-if="meta" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink/45 text-[11px]">Kart bygd med</span>
      <span class="text-[11px]" :class="metaAppVersionText === appVersion ? 'text-ink/55' : 'text-amber-300/80'">
        {{ metaAppVersionText === appVersion ? `v${metaAppVersionText}` : `${metaAppVersionText ? 'v' + metaAppVersionText : 'eldre enn v1.0.47'} — app kjører v${appVersion}; bygg på nytt for ferske data` }}
      </span>
    </div>
    <!-- NVE-innsjø-status: innsjøene hentes live ved bygging — her vises
         HVORFOR innsjøer eventuelt mangler (stille nett-/CORS-feil på mobil).
         Vises ALLTID når kart-meta finnes; mangler status er det i seg selv
         diagnosen (ark bygd før v1.0.45). -->
    <div v-if="nveInnsjoStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink/45 text-[11px]">NVE-innsjø</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.nveInnsjoStatus?.state === 'ok' ? 'text-ink/55' : 'text-amber-300/80'">
          {{ nveInnsjoStatusText }}
        </span>
      </div>
    </div>
    <!-- Turrutebasen (merkede fotruter fra Kartverket). Samme grunn som raden
         over: WFS-en kan feile stille på mobil, og «nye» forteller i tillegg
         hvor mye som faktisk kom i tillegg til OSM etter uttynningen. -->
    <div v-if="turruteStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink/45 text-[11px]">Turrutebasen</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.turruteStatus?.state === 'ok' ? 'text-ink/55' : 'text-amber-300/80'">
          {{ turruteStatusText }}
        </span>
      </div>
    </div>
    <!-- N50-stinettet fra statiske fliser. «nye» viser hvor mye som kom i
         tillegg til OSM og Turrutebasen etter uttynningen. -->
    <div v-if="n50StiStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink/45 text-[11px]">N50-sti</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.n50StiStatus?.state === 'ok' ? 'text-ink/55' : 'text-amber-300/80'">
          {{ n50StiStatusText }}
        </span>
      </div>
    </div>
    <button @click="diagnose = !diagnose"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-2"
            :class="diagnose
                    ? 'bg-slate-400/20 border-slate-300/50 text-ink'
                    : 'bg-ink/5 border-ink/10 text-ink/75'">
      {{ diagnose ? 'Diagnose: AV' : 'Diagnose-modus' }}
    </button>
    <div v-if="diagnose" class="text-[10px] text-ink/55 leading-relaxed mb-3 px-1">
      Polygon-fargen viser kilden:
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(180, 80%, 55%);"></span> N50,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(140, 70%, 45%);"></span> NVE innsjø,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(220, 80%, 60%);"></span> OSM way,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(300, 80%, 60%);"></span> OSM relation,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(45, 90%, 55%);"></span> merged.
    </div>
    <!-- Byggetider (perf): viser localStorage-loggen så den kan kopieres
         og deles — mobil-konsollen er upraktisk. -->
    <button @click="openPerfLog"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]
                   bg-ink/5 border-ink/10 text-ink/75">
      Byggetider (perf-logg)
    </button>
  </div>
</template>
