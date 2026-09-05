<script setup>
// Kulturminne-detalj-skuff (Kulturminnesøk brukerminner), skilt ut fra MapView
// v1.0.8. Tittel/kategori vises straks fra kart-ikonets data-*, beskrivelse/
// sted/bilde hentes lazy av forelderen (som eier fetch + cache). Komponenten
// eier presentasjonen: kategori-etiketter/-farger og lenken til
// kulturminnesok.no. Dra-håndteringen kommer inn som drawer-objektet
// (useDraggableDrawer) — samme .value-idiom som ellers i appen.
import { computed, ref, watch } from 'vue'
import { buildKulturminnesokUrl } from '../lib/externalMapLinks.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import TekstStorrelseKnapp from './TekstStorrelseKnapp.vue'

const { uiTextScale } = useUiTextScale()

const props = defineProps({
  open: { type: Boolean, default: false },
  detail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  drawer: { type: Object, required: true },
  // Stjernemerking (v6.5.52). `nokkel` er null når kilden ikke ga minnet en
  // brukbar id — da har vi ingenting stabilt å feste merkingen til, og knappen
  // skal være borte framfor å lagre noe som ikke finnes igjen neste gang.
  stjerneNokkel: { type: String, default: null },
  stjernet: { type: Boolean, default: false },
  kanStjerne: { type: Boolean, default: false },
})
defineEmits(['close', 'veksle-stjerne'])

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

// Bildet er en lenke til Kulturminnesøks eget opphav — det er IKKE pakket med i
// offline-fila, så uten dekning (eller når opphavet har fjernet bildet) står det
// en brukket ramme midt i teksten. En ramme uten innhold leses som at kortet er
// ødelagt, så vi tar hele figuren bort i stedet. `bildeFeilet` nullstilles når
// detaljen byttes, ellers ville neste kulturminne arvet feilen fra forrige.
const bilde = computed(() => props.detail?.bilder?.[0] ?? null)
const bildeFeilet = ref(false)
watch(() => bilde.value?.url, () => { bildeFeilet.value = false })
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
      <div class="drawer-shell bg-surface border-t border-ink/10 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
             @pointerdown="drawer.onPointerDown($event)"
             @pointermove="drawer.onPointerMove($event)"
             @pointerup="drawer.onPointerUp($event)"
             @pointercancel="drawer.onPointerUp($event)">
          <div class="w-12 h-1.5 rounded-full bg-ink/40"
               :style="{ opacity: drawer.handleOpacity.value }"></div>
        </div>
        <!-- Header: kategori-merke + tittel + lukk -->
        <div class="shrink-0 px-4 pb-2.5 bg-surface/95 border-b border-ink/8 flex items-start justify-between gap-3">
          <div class="min-w-0 flex items-start gap-2.5">
            <span class="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-sm" :style="{ background: katColor }"></span>
            <div class="min-w-0">
              <div class="text-ink text-[15px] font-medium leading-snug break-words">{{ detail.tittel }}</div>
            </div>
          </div>
          <!-- Stjerne + tekststørrelse + lukk, utenfor den zoomede kroppen under. -->
          <div class="shrink-0 flex items-center gap-1.5 -mr-1 -mt-0.5">
            <!-- Merkingen hører hjemme HER og ikke i en egen rad: det er den ene
                 handlingen kortet har på selve minnet, og den skal være på
                 samme sted enten skuffen er minimert eller åpen. -->
            <button v-if="kanStjerne && stjerneNokkel"
                    type="button"
                    @click="$emit('veksle-stjerne', stjerneNokkel)"
                    :aria-pressed="stjernet"
                    :aria-label="stjernet
                      ? `Fjern stjernemerket fra ${detail.tittel}`
                      : `Stjernemerk ${detail.tittel}`"
                    class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                           border active:scale-90 transition"
                    :class="stjernet
                      ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                      : 'bg-ink/5 border-ink/10 text-ink-3'">
              <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true"
                   :fill="stjernet ? 'currentColor' : 'none'"
                   stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
              </svg>
            </button>
            <TekstStorrelseKnapp />
            <button @click="$emit('close')"
                    aria-label="Lukk"
                    class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                           bg-ink/5 border border-ink/10 text-ink-2 active:scale-90">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <!-- Kropp: beskrivelse/sted/bilde + lenke -->
        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pt-3"
             :style="{ zoom: uiTextScale, paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
          <!-- Fakta om selve funnet, før beskrivelse/bilder. To-kolonners
               definisjons-grid; kun felt med verdi vises (kildene har ulike felt). -->
          <dl v-if="facts.length"
              class="grid grid-cols-2 gap-x-4 gap-y-2.5 pb-3 mb-3 border-b border-ink/8">
            <div v-for="f in facts" :key="f.label" class="min-w-0">
              <dt class="text-[10px] uppercase tracking-wide text-ink-4">{{ f.label }}</dt>
              <dd class="text-[12.5px] text-ink leading-snug break-words">{{ f.value }}</dd>
            </div>
          </dl>

          <div v-if="loading && !detail.beskrivelse"
               class="text-[12px] text-ink-4 py-3">Henter detaljer …</div>

          <p v-if="detail.beskrivelse"
             class="text-[13px] text-ink leading-relaxed whitespace-pre-line break-words">{{ detail.beskrivelse }}</p>

          <!-- Sekundær kontekst: felles beskrivelse for hele lokaliteten
               (f.eks. «Oscarsborg festning»), skilt fra den unike enkeltminne-
               teksten over. -->
          <div v-if="detail.lokalitetInfo" class="mt-3">
            <div class="text-[10px] uppercase tracking-wide text-ink-4 mb-0.5">Om lokaliteten</div>
            <p class="text-[12px] text-ink-3 leading-relaxed whitespace-pre-line break-words">{{ detail.lokalitetInfo }}</p>
          </div>

          <figure v-if="bilde && !bildeFeilet" class="mt-3">
            <img :src="bilde.url" :alt="detail.tittel"
                 loading="lazy" referrerpolicy="no-referrer"
                 @error="bildeFeilet = true"
                 class="w-full rounded-lg border border-ink/10 bg-black/20" />
            <figcaption class="mt-1 text-[10px] text-ink-4">
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

          <p class="mt-3 text-[10px] text-ink-4 leading-relaxed">
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
