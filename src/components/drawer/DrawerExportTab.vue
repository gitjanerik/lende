<script setup>
// Drawer-fane «Eksport», skilt ut fra MapView v1.0.8. Del kart (Web Share API
// med clipboard-fallback), del med markert sted, og SVG/PNG/PDF/print-eksport.
// All eksportlogikk blir i forelderen (den eier SVG-markupen).
defineProps({
  shareState: { type: String, default: 'idle' },
  highlightedFeature: { type: Object, default: null },
  exporting: { type: String, default: null },
  onShareMap: { type: Function, required: true },
  onShareMapWithPlace: { type: Function, required: true },
  onExportSvg: { type: Function, required: true },
  onExportPng: { type: Function, required: true },
  onExportPdf: { type: Function, required: true },
  onPrint: { type: Function, required: true },
})
</script>

<template>
  <div>
    <!-- Del kart — bruker Web Share API på iOS/Android med fallback
         til clipboard. Inkluderer ?hl=<navn> hvis et søkeresultat er
         highlightet, slik at mottaker ser samme markering. -->
    <button @click="onShareMap"
            class="w-full mb-3 px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                   flex items-center justify-center gap-2 transition"
            :class="shareState === 'copied'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                    : 'bg-sky-500/15 border-sky-400/40 text-sky-100'">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="shareState === 'copied'">
          <polyline points="20 6 9 17 4 12"/>
        </template>
        <template v-else>
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </template>
      </svg>
      <span class="font-medium">
        <template v-if="shareState === 'copied'">Lenke kopiert ✓</template>
        <template v-else-if="shareState === 'sharing'">Åpner delings-dialog …</template>
        <template v-else-if="shareState === 'error'">Kunne ikke dele — prøv igjen</template>
        <template v-else>Del kart</template>
      </span>
    </button>
    <!-- Del kart og sted — vises kun når et sted er markert (rosa puls).
         Mottakeren får utsnittet låst + samme rosa markering på stedet. -->
    <button v-if="highlightedFeature" @click="onShareMapWithPlace"
            class="w-full mb-2 px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                   flex items-center justify-center gap-2 transition
                   bg-pink-500/15 border-pink-400/40 text-pink-100">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span class="font-medium">Del kart og sted</span>
    </button>
    <div v-if="highlightedFeature"
         class="text-[10px] text-white/55 leading-snug mb-3 px-1 -mt-1">
      Markert sted: <span class="text-pink-300 font-medium">{{ highlightedFeature.name }}</span>.
      Mottakeren ser samme markering, og utsnittet er låst så stedet ikke går tapt.
    </div>

    <div class="grid grid-cols-2 gap-2 mb-3">
      <button @click="onExportSvg" :disabled="!!exporting"
              class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/75
                     text-[11px] active:scale-[0.98] disabled:opacity-50
                     flex items-center justify-center gap-1.5">
        <span v-if="exporting === 'svg'"
              class="w-3 h-3 rounded-full border-2 border-white/25 border-t-white/80 animate-spin shrink-0"></span>
        {{ exporting === 'svg' ? 'Lagrer …' : 'Lagre .svg' }}
      </button>
      <button @click="onExportPng" :disabled="!!exporting"
              class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/75
                     text-[11px] active:scale-[0.98] disabled:opacity-50
                     flex items-center justify-center gap-1.5">
        <span v-if="exporting === 'png'"
              class="w-3 h-3 rounded-full border-2 border-white/25 border-t-white/80 animate-spin shrink-0"></span>
        {{ exporting === 'png' ? 'Lager PNG …' : 'Lagre .png (300 dpi)' }}
      </button>
      <button @click="onExportPdf" :disabled="!!exporting"
              class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/75
                     text-[11px] active:scale-[0.98] disabled:opacity-50
                     flex items-center justify-center gap-1.5">
        <span v-if="exporting === 'pdf'"
              class="w-3 h-3 rounded-full border-2 border-white/25 border-t-white/80 animate-spin shrink-0"></span>
        {{ exporting === 'pdf' ? 'Lager PDF …' : 'Lagre som PDF' }}
      </button>
      <button @click="onPrint" :disabled="!!exporting"
              class="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/75
                     text-[11px] active:scale-[0.98] disabled:opacity-50
                     flex items-center justify-center gap-1.5">
        <span v-if="exporting === 'print'"
              class="w-3 h-3 rounded-full border-2 border-white/25 border-t-white/80 animate-spin shrink-0"></span>
        {{ exporting === 'print' ? 'Forbereder …' : 'Skriv ut' }}
      </button>
    </div>
  </div>
</template>
