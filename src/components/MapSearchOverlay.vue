<script setup>
// Søke-overlay, skilt ut fra MapView v1.0.6. Rent presentasjonelt: viser
// søkefelt + treffliste (kart-treff, med Nominatim-fallback når kartet er tomt)
// og sender ut brukerintensjoner. All logikk — indeksering, sentrering, bygg
// nytt kart, highlight — blir i forelderen. Eier sin egen fade-transition og
// fokuserer feltet når overlayet åpnes.
import { ref, watch, nextTick } from 'vue'
import { useSpeechInput } from '../composables/useSpeechInput.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  query: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  indexCount: { type: Number, default: 0 },      // antall treffbare navn i kartet
  activeIndex: { type: Number, default: -1 },
  globalResults: { type: Array, default: () => [] },
  globalSearching: { type: Boolean, default: false },
  uiTextScale: { type: Number, default: 1 },     // global tekststørrelse (zoom)
})
const emit = defineEmits([
  'update:query', 'update:activeIndex',
  'close', 'select', 'selectGlobal', 'keydown',
])

const inputRef = ref(null)
watch(() => props.open, (isOpen) => {
  if (isOpen) nextTick(() => inputRef.value?.focus())
})

// Tale-til-tekst for kart-søket. Skjules der nettleseren mangler støtte
// (samme graceful mønster som forsidens og velgerens søk). Transkriptet mates
// inn som om det ble skrevet — forelderen eier query, så vi emitter update:query.
const { isSupported: micSupported, isListening: micListening, toggle: toggleMic } =
  useSpeechInput({ onResult: (t) => emit('update:query', t) })
</script>

<template>
  <Transition name="search-fade">
    <div v-if="open"
         class="absolute top-[var(--ovl-top)] left-3 right-3 z-40 rounded-2xl bg-zinc-950/95 backdrop-blur
                border border-white/10 shadow-2xl overflow-hidden flex flex-col"
         style="max-height: calc(100dvh - 6rem - var(--safe-top));">
      <div class="px-3 py-2.5 flex items-center gap-2 border-b border-white/10"
           :style="{ zoom: uiTextScale }">
        <svg viewBox="0 0 24 24" class="w-4 h-4 text-white/55 shrink-0" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="20" y1="20" x2="16.65" y2="16.65"/>
        </svg>
        <input :value="query" @input="emit('update:query', $event.target.value)"
               type="search" autocomplete="off"
               autocorrect="off" autocapitalize="off" spellcheck="false"
               placeholder="Søk i dette kartet — steder, vann, øyer …"
               ref="inputRef"
               @keydown="emit('keydown', $event)"
               role="combobox" aria-autocomplete="list"
               :aria-expanded="results.length > 0" aria-controls="mapsearch-results"
               :aria-activedescendant="activeIndex >= 0 ? `mapsearch-opt-${activeIndex}` : undefined"
               class="flex-1 bg-transparent text-[14px] text-white placeholder-white/35
                      focus:outline-none"/>
        <!-- Tale-til-tekst — vises bare når nettleseren støtter SpeechRecognition -->
        <button v-if="micSupported" type="button" @click="toggleMic"
                :aria-label="micListening ? 'Stopp diktering' : 'Diktér søk (tale til tekst)'"
                :aria-pressed="micListening"
                :class="['w-7 h-7 rounded-full flex items-center justify-center transition active:scale-95 shrink-0',
                         micListening ? 'bg-red-500/90 text-white animate-pulse' : 'text-white/65 active:bg-white/10']">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button @click="emit('close')" aria-label="Lukk søk"
                class="w-7 h-7 -mr-1 rounded-full flex items-center justify-center
                       text-white/65 active:bg-white/10">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto" id="mapsearch-results" role="listbox"
           :style="{ zoom: uiTextScale }">
        <div v-if="!query"
             class="px-4 py-4 text-[11px] text-white/45 leading-relaxed">
          Søker i navn i <span class="text-white/70">dette kartet</span> — steder, vann,
          topper og områder ({{ indexCount }} treffbare).
          Skriv «vann» for å se alle innsjøer i utsnittet.
          Skriv «parkering» for å liste utfartsparkeringene.
          Skriv «topp» for kartets ti høyeste punkter.
          Steder ellers i Norge foreslås alltid nederst — velg ett for å bygge
          nytt kart der.
        </div>
        <!-- Overskrift for kart-treffene, symmetrisk med «Andre steder i
             Norge:» under — gjør det tydelig at dette er treff INNE i det
             åpne kartet, ikke nye kart. -->
        <div v-if="results.length" class="px-4 pt-4 pb-1 text-[11px] leading-relaxed">
          <span class="text-white/40">I dette kartet:</span>
        </div>
        <button v-for="(r, index) in results" :key="r.id"
                :id="`mapsearch-opt-${index}`" role="option"
                :aria-selected="index === activeIndex"
                @click="emit('select', r)"
                @mousemove="emit('update:activeIndex', index)"
                class="w-full text-left px-3 py-2.5 transition border-b
                       border-white/8 last:border-0 flex items-center gap-2"
                :class="index === activeIndex ? 'bg-white/12' : 'active:bg-white/10'">
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-white truncate">
              {{ r.name }}<span v-if="r.kind === 'parkering'" aria-hidden="true"> *</span>
            </div>
            <div class="text-[10px] text-white/45 uppercase tracking-wide">
              {{ r.label }}<span v-if="r.ele != null"> · {{ r.ele }} moh</span>
            </div>
            <div v-if="r.kind === 'parkering'" class="text-[10px] text-white/45 leading-tight mt-0.5">
              * Navnet er utledet fra nærmeste sted, ikke et offisielt navn
            </div>
          </div>
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white/35 shrink-0" fill="none"
               stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- Andre steder (Kartverket SSR + OSM) — vises ALLTID under kart-
             treffene, ikke bare ved null treff: at søkeordet også finnes i
             kartet er uviktig, et valgt globalt treff bygger nytt kart med
             navn etter treffet. -->
        <template v-if="query && (globalSearching || globalResults.length || results.length === 0)">
          <div class="px-4 pt-4 pb-1 text-[11px] text-white/55 leading-relaxed">
            <template v-if="results.length === 0">Ingen treff i dette kartet. </template>
            <span class="text-white/40">Andre steder i Norge:</span>
          </div>
          <div v-if="globalSearching" class="px-4 py-3 text-[11px] text-white/40">
            Søker …
          </div>
          <button v-for="r in globalResults" :key="'g' + r.id"
                  @click="emit('selectGlobal', r)"
                  class="w-full text-left px-3 py-2.5 transition border-b border-white/8
                         last:border-0 flex items-center gap-2 active:bg-white/10">
            <!-- «+»-ikon (ikke kartnål): dette er en bygg-handling, ikke bare
                 enda et sted å hoppe til i det åpne kartet. -->
            <svg viewBox="0 0 24 24" class="w-5 h-5 text-sky-400 shrink-0" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-medium text-white truncate">{{ r.shortName }}</div>
              <div class="text-[10px] text-sky-300/80 uppercase tracking-wide">Bygg nytt kart her</div>
            </div>
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-white/35 shrink-0" fill="none"
                 stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div v-if="!globalSearching && globalResults.length === 0 && results.length === 0"
               class="px-4 py-6 text-center text-[12px] text-white/45">
            Ingen treff på «{{ query }}»
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Søke-overlay — kort fade + svak slide ovenfra */
.search-fade-enter-active, .search-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.search-fade-enter-from, .search-fade-leave-to {
  opacity: 0; transform: translateY(-6px);
}
</style>
