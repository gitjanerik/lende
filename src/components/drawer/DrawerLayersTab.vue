<script setup>
// Drawer-fane «Lag», skilt ut fra MapView v1.0.8. Enkeltlag-toggles +
// sjø/padling-gruppe. Lag-tilstanden eies av forelderen; handlinger kommer
// inn som funksjons-props så template-kroppen er uendret.
//
// v5.23.0: forhåndsvalg-raden er flyttet til Kartstil-fanen. Den satte bare
// lag-synlighet og endret ikke ett piksel-uttrykk — nå velger man en kartstil
// som også bytter palett, strek og sti-farger, og finjusterer her etterpå.

defineProps({
  resetLayers: { type: Function, required: true },
  layersDirty: { type: Boolean, default: false },
  landLayerButtons: { type: Array, default: () => [] },
  marineLayerButtons: { type: Array, default: () => [] },
  toggleLayer: { type: Function, required: true },
  toggleDepth: { type: Function, required: true },
  visibleLayers: { type: Object, required: true },   // Set
  // null = vet ikke ennå (ingen innbakte ikoner, live-hentingen har ikke svart).
  kulturminneCount: { type: Number, default: null },
  kulturminneStatus: { type: String, default: 'ukjent' },   // 'ukjent' | 'ok' | 'feilet'
  fredetLoading: { type: Boolean, default: false },
  fredetCount: { type: Number, default: null },
  hydroLoading: { type: Boolean, default: false },
  hydroCount: { type: Number, default: null },
  meta: { type: Object, default: null },
})
</script>

<template>
  <div>
    <div class="text-[11px] font-semibold text-ink/55 uppercase tracking-wide mb-1.5">
      Enkeltlag
    </div>
    <p class="text-[11px] text-ink/45 leading-snug mb-2">
      Finjustering oppå kartstilen. Vil du bytte hele uttrykket — farger,
      strek og sti-farger — ligger det under Kartstil.
    </p>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <!-- Knapp #1: Nullstill lag-synlighet. Default disabled; blir
           aktiv først når minst ett lag avviker fra default-tilstand. -->
      <button @click="resetLayers"
              :disabled="!layersDirty"
              class="px-3 py-2 rounded-lg border text-left transition"
              :class="layersDirty
                      ? 'bg-amber-400/20 border-amber-300/50 text-ink active:scale-[0.98]'
                      : 'bg-ink/5 border-ink/5 text-ink/25 cursor-default'">
        <span class="text-[12px]">↺ Nullstill</span>
      </button>
      <button v-for="lay in landLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              :aria-pressed="visibleLayers.has(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-slate-400/25 border-slate-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink/45'">
        <span class="text-[12px]">{{ lay.label }}</span>
        <!-- Tre utfall, tre tegn (v4.8.6): «(0)» betyr nå at tjenesten svarte og
             området er tomt, «(–)» at vi ennå ikke vet, og «(!)» at hentingen
             feilet. Før var alle tre «(0)», som leste som «funksjonen er borte». -->
        <span v-if="lay.key === 'kulturminne'"
              class="ml-1 text-[10px] tabular-nums"
              :title="kulturminneStatus === 'feilet'
                        ? 'Kunne ikke hente kulturminner — sjekk nettforbindelsen'
                        : kulturminneCount == null
                          ? 'Ikke hentet ennå'
                          : `${kulturminneCount} kulturminner i dette utsnittet`"
              :class="kulturminneStatus === 'feilet' ? 'text-amber-300/90'
                      : kulturminneCount ? 'text-emerald-300/80' : 'text-ink/30'">{{
                kulturminneStatus === 'feilet' ? '(!)'
                : kulturminneCount == null ? '(–)'
                : '(' + kulturminneCount + ')' }}</span>
        <span v-else-if="lay.key === 'fredet-kulturminne' && (fredetLoading || fredetCount != null)"
              class="ml-1 text-[10px] tabular-nums"
              :class="fredetCount ? 'text-emerald-300/80' : 'text-ink/30'">{{ fredetLoading ? '…' : '(' + fredetCount + ')' }}</span>
        <span v-else-if="lay.key === 'vannstasjon' && (hydroLoading || hydroCount != null)"
              class="ml-1 text-[10px] tabular-nums"
              :class="hydroCount ? 'text-sky-300/80' : 'text-ink/30'">{{ hydroLoading ? '…' : '(' + hydroCount + ')' }}</span>
      </button>
    </div>
    <!-- Gruppert seksjon: Sjø & padling -->
    <div class="mt-3 mb-1 text-[11px] font-semibold text-sky-300/80 uppercase tracking-wide">
      Sjø &amp; padling
    </div>
    <div class="grid grid-cols-2 gap-2 mb-1">
      <button v-for="lay in marineLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              :aria-pressed="visibleLayers.has(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-sky-400/25 border-sky-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink/45'">
        <span class="text-[12px]">{{ lay.label }}</span>
      </button>
      <!-- Dybde-lag: kun når kartet har ekte Sjøkart-dybde. Default av —
           løfter soundings + dybdekurver fra long-press-inset til hovedkartet. -->
      <button v-if="meta?.depthSource === 'sjokart'"
              @click="toggleDepth()"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has('dybde')
                      ? 'bg-sky-400/25 border-sky-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink/45'">
        <span class="text-[12px]">Dybde (Sjøkart)</span>
      </button>
    </div>
    <div class="text-[10px] text-ink/40 leading-snug mb-2">
      Fyr, sjømerker, skjær, småbåthavner, landingssteder, toalett og
      drikkevann. «Sjønavn» viser geografiske navn i sjøen (bukt, vik,
      sund, nes, grunne, holme, skjær). Dybdetall vises ved å holde inne
      et punkt på kartet.
    </div>
    <div class="text-[10px] text-ink/40 leading-snug mt-2">
      Reliefskygge er DEM-derivert hill-shading rendret som grayscale-
      PNG inne i SVG-en med <code>mix-blend-mode: multiply</code>.
    </div>
  </div>
</template>
