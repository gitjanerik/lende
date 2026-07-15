<script setup>
// FAB-innstillingspanel (knob-panelet), skilt ut fra MapView v1.0.8. Bunn-ark
// med tre sub-paneler: STREK (per-element strekbredde), RELIEFF (av/på + stil)
// og ZOOM (standard zoom / maks fliser / ombygging). Samme drawer-UX som
// kontekst-arket: 45 dvh standard, dra i håndtaket for maksimer/standard/
// minimer; kun maksimert dimmer + sperrer kartet. Presentasjonelt — verdiene
// bindes toveis via v-model, handlinger sendes som events.
import { computed } from 'vue'
import { STROKE_GROUPS } from '../lib/strokeOverrides.js'
import { MAP_SIZE_MIN_KM, MAP_SIZE_MAX_KM } from '../composables/useMapSizePreference.js'

const props = defineProps({
  panel: { type: String, default: null },          // 'stroke' | 'relief' | 'zoom' | null
  drawer: { type: Object, required: true },        // useDraggableDrawer-objekt
  strokeEffective: { type: Object, default: () => ({}) },
  zoomMin: { type: Number, default: 1 },
  zoomMax: { type: Number, default: 5 },
  maxTiles: { type: Number, default: 0 },
  maxTileIndexMax: { type: Number, default: 4 },
  canRebuild: { type: Boolean, default: false },
  building: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})
const emit = defineEmits([
  'close', 'setStrokeGroup', 'saveDefault', 'reset', 'rebuild',
])

const reliefEnabled = defineModel('reliefEnabled', { type: Boolean, default: false })
const reliefMode = defineModel('reliefMode', { type: String, default: 'vektor' })
const defaultZoomScale = defineModel('defaultZoomScale', { type: Number, default: 1 })
const maxTileIndex = defineModel('maxTileIndex', { type: Number, default: 0 })
const rebuildSizeKm = defineModel('rebuildSizeKm', { type: Number, default: 4 })

const title = computed(() => (
  props.panel === 'stroke' ? 'Strek — dette kartet'
  : props.panel === 'relief' ? 'Relieff — dette kartet'
  : 'Zoom og kartutsnitt'
))
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="panel"
         class="absolute inset-0 z-50 flex items-end justify-center transition-colors duration-200"
         :class="drawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
         @click.self="emit('close')">
      <div class="w-full bg-zinc-900 border-t border-white/10 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <!-- Dra-håndtak: samme hit-flate og følsomhet som kontekst-arket. -->
        <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
             @pointerdown="drawer.onPointerDown($event)"
             @pointermove="drawer.onPointerMove($event)"
             @pointerup="drawer.onPointerUp($event)"
             @pointercancel="drawer.onPointerUp($event)">
          <div class="w-12 h-1.5 rounded-full bg-white/40"
               :style="{ opacity: drawer.handleOpacity.value }"></div>
        </div>
        <div class="shrink-0 px-4 pb-2.5 border-b border-white/8 flex items-center justify-between gap-3">
          <div class="text-white text-[14px] font-semibold">{{ title }}</div>
          <button @click="emit('close')" aria-label="Lukk panel"
                  class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                         bg-white/5 border border-white/10 text-white/60 active:scale-90 transition">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
        <div v-show="!drawer.isMinimized.value"
             class="flex-1 overflow-y-auto px-4 pt-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]">

          <!-- STREK: per-element strekbredde for dette kartet -->
          <template v-if="panel === 'stroke'">
            <div class="text-[11px] text-white/55 leading-snug mb-3">
              Strekbredde per element for dette kartet. Ganges med Strek-knotten,
              som fortsatt skalerer alt under ett.
            </div>
            <div v-for="g in STROKE_GROUPS" :key="g.id"
                 class="rounded-lg bg-white/5 px-3 py-2.5 mb-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="text-[13px] text-white font-medium">{{ g.label }}</div>
                <span class="text-white/60 text-[12px] tabular-nums">{{ strokeEffective[g.id].toFixed(2) }}×</span>
              </div>
              <input type="range" min="0.5" max="2.5" step="0.05"
                     :value="strokeEffective[g.id]"
                     @input="emit('setStrokeGroup', g.id, Number($event.target.value))"
                     :aria-label="`Strekbredde ${g.label}`"
                     class="w-full accent-sky-400"/>
            </div>
          </template>

          <!-- RELIEFF: av/på + stil for dette kartet -->
          <template v-else-if="panel === 'relief'">
            <div class="text-[11px] text-white/55 leading-snug mb-3">
              Gjelder dette kartet. Standard for alle kart settes i Innstillinger-fanen
              eller med «Angi som standard» under.
            </div>
            <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-2 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-[13px] text-white font-medium">Relieff (terrengskygge)</div>
                <div class="text-[11px] text-white/55 leading-snug">
                  Bruker mer minne/GPU — slå av på svake enheter.
                </div>
              </div>
              <button @click="reliefEnabled = !reliefEnabled"
                      :aria-pressed="reliefEnabled"
                      :aria-label="reliefEnabled ? 'Slå av relieff for dette kartet' : 'Slå på relieff for dette kartet'"
                      class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                      :class="reliefEnabled ? 'bg-emerald-500' : 'bg-white/15'">
                <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                      :class="reliefEnabled ? 'left-5' : 'left-0.5'" />
              </button>
            </div>
            <div v-if="reliefEnabled" class="rounded-lg bg-white/5 px-3 py-2.5 mb-2">
              <div class="text-[13px] text-white font-medium mb-2">Relieff-stil</div>
              <div class="flex gap-2" role="group" aria-label="Relieff-stil for dette kartet">
                <button @click="reliefMode = 'vektor'"
                        :aria-pressed="reliefMode === 'vektor'"
                        class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                        :class="reliefMode === 'vektor' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'">
                  Skarp (vektor)
                </button>
                <button @click="reliefMode = 'mjuk'"
                        :aria-pressed="reliefMode === 'mjuk'"
                        class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                        :class="reliefMode === 'mjuk' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/70'">
                  Mjuk (bilde)
                </button>
              </div>
              <div class="text-[11px] text-white/55 leading-snug mt-1.5">
                Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
                Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
              </div>
            </div>
          </template>

          <!-- ZOOM: standard zoom-nivå + kartfliser + ombygging -->
          <template v-else>
            <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="text-[13px] text-white font-medium">Standard zoom-nivå</div>
                <span class="text-white/60 text-[12px] tabular-nums">
                  {{ defaultZoomScale === 1 ? 'Hele kartet' : `${defaultZoomScale.toFixed(1)}×` }}
                </span>
              </div>
              <input type="range" :min="zoomMin" :max="zoomMax" step="0.5"
                     v-model.number="defaultZoomScale"
                     aria-label="Standard zoom-nivå for Sentrer-knappen"
                     class="w-full accent-sky-400"/>
              <div class="text-[11px] text-white/55 leading-snug mt-1.5">
                Hva Sentrer-knappen zoomer til: 1× viser hele kartet; høyere nivå
                sentrerer på GPS-posisjonen (eller kartsenteret) ved den skalaen.
              </div>
            </div>
            <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="text-[13px] text-white font-medium">Maks kartfliser</div>
                <span class="text-white/60 text-[12px] tabular-nums">{{ maxTiles }}</span>
              </div>
              <input type="range" min="0" :max="maxTileIndexMax" step="1"
                     v-model.number="maxTileIndex"
                     aria-label="Maks antall kartfliser i mosaikken"
                     class="w-full accent-sky-400"/>
              <div class="text-[11px] text-white/55 leading-snug mt-1.5">
                Hvor mange kart-utsnitt som beholdes i mosaikken. Gjelder alle kart.
              </div>
            </div>
            <div class="rounded-lg bg-white/5 px-3 py-2.5 mb-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="text-[13px] text-white font-medium">Kartstørrelse</div>
                <span class="text-white/60 text-[12px] tabular-nums">{{ rebuildSizeKm }} km</span>
              </div>
              <input type="range" :min="MAP_SIZE_MIN_KM" :max="MAP_SIZE_MAX_KM" step="1"
                     v-model.number="rebuildSizeKm"
                     aria-label="Kartstørrelse for ombygging av dette området"
                     class="w-full accent-sky-400"/>
              <div class="text-[11px] text-white/55 leading-snug mt-1.5">
                Gjelder kun dette kartet: bygger området på nytt i valgt bredde
                (nytt kart, samme senter).
              </div>
              <button @click="emit('rebuild', rebuildSizeKm)"
                      :disabled="building || !canRebuild"
                      class="w-full mt-2 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                             active:scale-[0.98] disabled:opacity-50
                             bg-sky-500/15 border-sky-400/40 text-sky-100">
                Bygg om dette området i valgt størrelse
              </button>
            </div>
          </template>

          <!-- Footer: Angi som standard / Nullstill (strek + relieff) + feedback -->
          <div v-if="panel !== 'zoom'" class="flex gap-2 mt-3">
            <button @click="emit('saveDefault')"
                    class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                           active:scale-[0.98] bg-emerald-500/15 border-emerald-400/40 text-emerald-100">
              Angi som standard
            </button>
            <button @click="emit('reset')"
                    class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                           active:scale-[0.98] bg-white/5 border-white/15 text-white/80">
              Nullstill
            </button>
          </div>
          <div v-if="hint" class="text-center text-[11px] text-emerald-300 mt-2">
            {{ hint }}
          </div>
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
