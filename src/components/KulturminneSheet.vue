<script setup>
// Kulturminne-detalj-skuff (Kulturminnesøk brukerminner), skilt ut fra MapView
// v1.0.8. Tittel/kategori vises straks fra kart-ikonets data-*, beskrivelse/
// sted/bilde hentes lazy av forelderen (som eier fetch + cache). Komponenten
// eier presentasjonen: kategori-etiketter/-farger og lenken til
// kulturminnesok.no. Dra-håndteringen kommer inn som drawer-objektet
// (useDraggableDrawer) — samme .value-idiom som ellers i appen.
import { computed } from 'vue'
import { buildKulturminnesokUrl } from '../lib/externalMapLinks.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'

const { uiTextScale } = useUiTextScale()

const props = defineProps({
  open: { type: Boolean, default: false },
  detail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  drawer: { type: Object, required: true },
})
defineEmits(['close'])

const KAT_LABEL = {
  fangst: 'Fangstminne',
  gravminne: 'Gravminne',
  stein: 'Stein / bergkunst',
  bygning: 'Bygning / anlegg',
  annet: 'Kulturminne',
}
const katLabel = computed(() => KAT_LABEL[props.detail?.kategori] ?? 'Kulturminne')
// Samme farger som kart-ikonene (buildIsomCss g[data-kat]).
const KAT_COLOR = {
  fangst: '#b8730f', gravminne: '#7d3c98', stein: '#5d6d7e', bygning: '#b03a2e', annet: '#6d4c41',
}
const katColor = computed(() => KAT_COLOR[props.detail?.kategori] ?? KAT_COLOR.annet)

// Strukturert fakta-blokk øverst (før beskrivelse/bilder). Datadrevet: kun
// felt med faktisk verdi vises. Kildene har ulike felt — brukerminner
// (api.ra.no) har kategori/sted/«lagt inn av», mens fredede minner (WFS) har
// vernestatus. Datering leveres ikke av noen av kildene ennå, men taes med her
// så den dukker opp automatisk om feltet fylles senere.
const beliggenhet = computed(() => {
  // Fredet-WFS gir kommune som SOSI-tallkode («0301») — ikke lesbart, så den
  // hoppes over. Brukerminner gir stedsnavn («Oslo»), som vises.
  const komm = props.detail?.kommune
  const readableKomm = komm && !/^\d+$/.test(String(komm).trim()) ? komm : null
  return [readableKomm, props.detail?.fylke].filter(Boolean).join(', ')
})
const facts = computed(() => {
  const d = props.detail
  if (!d) return []
  return [
    { label: 'Kategori', value: d.kategoriLabel || katLabel.value },
    { label: 'Type', value: d.art || null },
    { label: 'Datering', value: d.datering || null },
    { label: 'Vernestatus', value: d.vernestatus || null },
    { label: 'Beliggenhet', value: beliggenhet.value || null },
    { label: 'Lagt inn av', value: d.opprettetAv || null },
  ].filter((r) => r.value)
})

const bilde = computed(() => props.detail?.bilder?.[0] ?? null)
const link = computed(() => {
  const d = props.detail
  if (!d) return null
  return d.link || buildKulturminnesokUrl(d.id)
})
function onOpenKulturminnesok() {
  if (link.value) window.open(link.value, '_blank', 'noopener')
}
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="open && detail"
         class="absolute inset-0 z-40 flex items-end justify-center transition-colors duration-200"
         :class="drawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
         @click.self="$emit('close')">
      <div class="w-full bg-zinc-900 border-t border-white/10 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
             @pointerdown="drawer.onPointerDown($event)"
             @pointermove="drawer.onPointerMove($event)"
             @pointerup="drawer.onPointerUp($event)"
             @pointercancel="drawer.onPointerUp($event)">
          <div class="w-12 h-1.5 rounded-full bg-white/40"
               :style="{ opacity: drawer.handleOpacity.value }"></div>
        </div>
        <!-- Header: kategori-merke + tittel + lukk -->
        <div class="shrink-0 px-4 pb-2.5 bg-zinc-900/95 border-b border-white/8 flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-start gap-2.5">
            <span class="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-sm" :style="{ background: katColor }"></span>
            <div class="min-w-0">
              <div class="text-white text-[15px] font-medium leading-snug break-words">{{ detail.tittel }}</div>
            </div>
          </div>
          <button @click="$emit('close')"
                  aria-label="Lukk"
                  class="w-8 h-8 -mr-1 -mt-0.5 shrink-0 rounded-full flex items-center justify-center
                         bg-white/5 border border-white/10 text-white/70 active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
        <!-- Kropp: beskrivelse/sted/bilde + lenke -->
        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pt-3"
             :style="{ zoom: uiTextScale, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
          <!-- Fakta om selve funnet, før beskrivelse/bilder. To-kolonners
               definisjons-grid; kun felt med verdi vises (kildene har ulike felt). -->
          <dl v-if="facts.length"
              class="grid grid-cols-2 gap-x-4 gap-y-2.5 pb-3 mb-3 border-b border-white/8">
            <div v-for="f in facts" :key="f.label" class="min-w-0">
              <dt class="text-[10px] uppercase tracking-wide text-white/40">{{ f.label }}</dt>
              <dd class="text-[12.5px] text-white/85 leading-snug break-words">{{ f.value }}</dd>
            </div>
          </dl>

          <div v-if="loading && !detail.beskrivelse"
               class="text-[12px] text-white/50 py-3">Henter detaljer …</div>

          <p v-if="detail.beskrivelse"
             class="text-[13px] text-white/85 leading-relaxed whitespace-pre-line break-words">{{ detail.beskrivelse }}</p>

          <!-- Sekundær kontekst: felles beskrivelse for hele lokaliteten
               (f.eks. «Oscarsborg festning»), skilt fra den unike enkeltminne-
               teksten over. -->
          <div v-if="detail.lokalitetInfo" class="mt-3">
            <div class="text-[10px] uppercase tracking-wide text-white/40 mb-0.5">Om lokaliteten</div>
            <p class="text-[12px] text-white/55 leading-relaxed whitespace-pre-line break-words">{{ detail.lokalitetInfo }}</p>
          </div>

          <figure v-if="bilde" class="mt-3">
            <img :src="bilde.url" :alt="detail.tittel"
                 loading="lazy" referrerpolicy="no-referrer"
                 class="w-full rounded-lg border border-white/10 bg-black/20" />
            <figcaption class="mt-1 text-[10px] text-white/40">
              © Kulturminnesøk{{ bilde.fotograf ? ' / ' + bilde.fotograf : '' }}{{ bilde.lisens ? ', ' + bilde.lisens : ', CC BY' }}
            </figcaption>
          </figure>

          <button @click="onOpenKulturminnesok"
                  :disabled="!link"
                  class="mt-4 w-full px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                         flex items-center gap-2.5 transition
                         bg-amber-500/[0.12] border-amber-400/35 text-amber-100
                         disabled:opacity-40 disabled:active:scale-100">
            <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span class="flex-1 text-left font-medium">Åpne på kulturminnesok.no</span>
          </button>

          <p class="mt-3 text-[10px] text-white/35 leading-relaxed">
            Data: Kulturminnesøk (Riksantikvaren) ·
            <a href="https://data.norge.no/nlod" target="_blank" rel="noopener" class="underline">NLOD</a>
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.22s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }
.overlay-fade-leave-active { pointer-events: none; }
</style>
