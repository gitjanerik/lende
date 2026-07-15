<script setup>
// Drawer-fane «Lag», skilt ut fra MapView v1.0.8. Forhåndsvalg + enkeltlag-
// toggles + sjø/padling-gruppe. Lag-tilstanden eies av forelderen; handlinger
// kommer inn som funksjons-props så template-kroppen er uendret.
import { LAYER_PRESETS } from '../../lib/mapLayerCatalog.js'

defineProps({
  applyPreset: { type: Function, required: true },
  activePreset: { type: String, default: null },
  resetLayers: { type: Function, required: true },
  layersDirty: { type: Boolean, default: false },
  landLayerButtons: { type: Array, default: () => [] },
  marineLayerButtons: { type: Array, default: () => [] },
  toggleLayer: { type: Function, required: true },
  toggleDepth: { type: Function, required: true },
  visibleLayers: { type: Object, required: true },   // Set
  kulturminneCount: { type: Number, default: 0 },
  fredetLoading: { type: Boolean, default: false },
  fredetCount: { type: Number, default: null },
  meta: { type: Object, default: null },
})
</script>

<template>
  <div>
    <!-- Forhåndsvalg: ett trykk til en sammenhengende lag-tilstand.
         Hele toggle-listen ligger under for finjustering. -->
    <div class="text-[11px] font-semibold text-white/55 uppercase tracking-wide mb-1.5">
      Forhåndsvalg
    </div>
    <div class="grid grid-cols-4 gap-2 mb-3">
      <button v-for="p in LAYER_PRESETS" :key="p.key"
              @click="applyPreset(p)"
              :aria-pressed="activePreset === p.key"
              class="px-2 py-2 rounded-lg border text-center active:scale-[0.98] transition"
              :class="activePreset === p.key
                      ? 'bg-emerald-500/25 border-emerald-300/60 text-white font-medium'
                      : 'bg-white/5 border-white/10 text-white/65'">
        <span class="text-[12px]">{{ p.label }}</span>
      </button>
    </div>
    <div class="text-[11px] font-semibold text-white/55 uppercase tracking-wide mb-1.5">
      Enkeltlag
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <!-- Knapp #1: Nullstill lag-synlighet. Default disabled; blir
           aktiv først når minst ett lag avviker fra default-tilstand. -->
      <button @click="resetLayers"
              :disabled="!layersDirty"
              class="px-3 py-2 rounded-lg border text-left transition"
              :class="layersDirty
                      ? 'bg-amber-400/20 border-amber-300/50 text-white active:scale-[0.98]'
                      : 'bg-white/5 border-white/5 text-white/25 cursor-default'">
        <span class="text-[12px]">↺ Nullstill</span>
      </button>
      <button v-for="lay in landLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-slate-400/25 border-slate-300/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/45'">
        <span class="text-[12px]">{{ lay.label }}</span>
        <span v-if="lay.key === 'kulturminne'"
              class="ml-1 text-[10px] tabular-nums"
              :class="kulturminneCount ? 'text-emerald-300/80' : 'text-white/30'">({{ kulturminneCount }})</span>
        <span v-else-if="lay.key === 'fredet-kulturminne' && (fredetLoading || fredetCount != null)"
              class="ml-1 text-[10px] tabular-nums"
              :class="fredetCount ? 'text-emerald-300/80' : 'text-white/30'">{{ fredetLoading ? '…' : '(' + fredetCount + ')' }}</span>
      </button>
    </div>
    <!-- Gruppert seksjon: Sjø & padling -->
    <div class="mt-3 mb-1 text-[11px] font-semibold text-sky-300/80 uppercase tracking-wide">
      Sjø &amp; padling
    </div>
    <div class="grid grid-cols-2 gap-2 mb-1">
      <button v-for="lay in marineLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-sky-400/25 border-sky-300/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/45'">
        <span class="text-[12px]">{{ lay.label }}</span>
      </button>
      <!-- Dybde-lag: kun når kartet har ekte Sjøkart-dybde. Default av —
           løfter soundings + dybdekurver fra long-press-inset til hovedkartet. -->
      <button v-if="meta?.depthSource === 'sjokart'"
              @click="toggleDepth()"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has('dybde')
                      ? 'bg-sky-400/25 border-sky-300/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/45'">
        <span class="text-[12px]">Dybde (Sjøkart)</span>
      </button>
    </div>
    <div class="text-[10px] text-white/40 leading-snug mb-2">
      Fyr, sjømerker, skjær, småbåthavner, landingssteder, toalett og
      drikkevann. «Sjønavn» viser geografiske navn i sjøen (bukt, vik,
      sund, nes, grunne, holme, skjær). Dybdetall vises ved å holde inne
      et punkt på kartet.
    </div>
    <div class="text-[10px] text-white/40 leading-snug mt-2">
      Reliefskygge er DEM-derivert hill-shading rendret som grayscale-
      PNG inne i SVG-en med <code>mix-blend-mode: multiply</code>.
    </div>
  </div>
</template>
