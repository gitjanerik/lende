<script setup>
// Drawer-fane «Tema», skilt ut fra MapView v1.0.8. Tema-grid + font-par for
// kart-navn (byttes live). Tema-listen (fra isomCatalog) kommer som prop;
// font-paret bindes toveis.
import { FONT_PAIRS } from '../../composables/useLabelFonts.js'

defineProps({
  themes: { type: Array, default: () => [] },
  currentTheme: { type: String, default: null },
  onThemeTap: { type: Function, required: true },
  landFont: { type: String, default: '' },
  waterFont: { type: String, default: '' },
})
const fontPairId = defineModel('fontPairId', { type: String, default: '' })
</script>

<template>
  <div>
    <div class="grid grid-cols-3 gap-2 mb-3">
      <button v-for="t in themes" :key="t.key"
              @click="onThemeTap(t.key)"
              class="px-3 py-2 rounded-lg border text-[11px] active:scale-[0.98] transition text-center"
              :class="currentTheme === t.key
                      ? 'bg-slate-400/25 border-slate-300/50 text-white font-medium'
                      : 'bg-white/5 border-white/10 text-white/65'">
        {{ t.label }}
      </button>
    </div>

    <!-- Font-par for kart-navn (Stedsnavn-typografi). Land = sans
         (bebyggelse/topp/område), vann = kursiv serif. Byttes live. -->
    <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-white font-medium mb-2">Skrift på kart-navn</div>
      <select v-model="fontPairId" aria-label="Font-par for kart-navn"
              class="w-full rounded-md bg-white/10 text-white text-[12px] px-2 py-1.5
                     border border-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-400
                     [&>option]:text-zinc-900 [&>option]:bg-white">
        <option v-for="p in FONT_PAIRS" :key="p.id" :value="p.id">{{ p.id }}</option>
      </select>
      <div class="mt-2 flex items-baseline gap-2" aria-hidden="true">
        <span class="text-white/85 text-[14px]" :style="{ fontFamily: landFont }">Stubdalskampen</span>
        <span class="text-sky-300 text-[14px] italic" :style="{ fontFamily: waterFont }">Damtjern</span>
      </div>
      <div class="text-[11px] text-white/55 leading-snug mt-1.5">
        Bebyggelse, topp og område settes i sans; vann-navn i kursiv serif.
        Gjelder kart bygd etter denne oppdateringen — eldre kart må regenereres.
      </div>
    </div>
  </div>
</template>
