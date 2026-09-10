<script setup>
// Knott-panelet, skilt ut fra MapView v1.0.8. Bunn-ark med to sub-paneler:
// STREK (per-element strekbredde) og RELIEFF (av/på + stil). Samme drawer-UX
// som kontekst-arket: 45 dvh standard, dra i håndtaket for maksimer/standard/
// minimer; kun maksimert dimmer + sperrer kartet. Presentasjonelt — verdiene
// bindes toveis via v-model, handlinger sendes som events.
//
// DET TREDJE PANELET, «ZOOM OG KARTUTSNITT», ER SLETTET (v7.0.0). Det bar tre
// ting, og ingen av dem overlevde: «standard zoom-nivå» satte et gulv under
// dekningsskalaen som dekningen svarer bedre på selv, «maks kartfliser» er nå
// et fast tall (25), og «bygg om i valgt størrelse» sto allerede i
// Format-fanen. Panelet nås ikke lenger — inngangen var et lang-trykk på en
// FAB som ikke finnes.
import { computed } from 'vue'
import { STROKE_GROUPS } from '../lib/strokeOverrides.js'

const props = defineProps({
  panel: { type: String, default: null },          // 'stroke' | 'relief' | null
  drawer: { type: Object, required: true },        // useDraggableDrawer-objekt
  strokeEffective: { type: Object, default: () => ({}) },
  hint: { type: String, default: '' },
})
// v6.5.82: sti-fargene bor i Innstillinger → Kartstil → «Tilpass — sti-farge».
// Panelet her er strekBREDDE; fargen er et stil-valg, og de to hørte aldri
// sammen annet enn ved at begge tilfeldigvis gjaldt stien.
const emit = defineEmits(['close', 'setStrokeGroup', 'saveDefault', 'reset'])

const reliefEnabled = defineModel('reliefEnabled', { type: Boolean, default: false })
const reliefMode = defineModel('reliefMode', { type: String, default: 'vektor' })

const title = computed(() =>
  props.panel === 'stroke' ? 'Strek — dette kartet' : 'Relieff — dette kartet')
</script>

<template>
  <Transition name="overlay-fade">
    <div v-if="panel"
         class="absolute inset-0 z-50 flex items-end justify-center transition-colors duration-200"
         :class="drawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
         @click.self="emit('close')">
      <div class="drawer-shell bg-surface border-t border-ink/10 rounded-t-2xl flex flex-col pointer-events-auto"
           :style="drawer.drawerHeightStyle.value">
        <!-- Dra-håndtak: samme hit-flate og følsomhet som kontekst-arket. -->
        <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
             @pointerdown="drawer.onPointerDown($event)"
             @pointermove="drawer.onPointerMove($event)"
             @pointerup="drawer.onPointerUp($event)"
             @pointercancel="drawer.onPointerUp($event)">
          <div class="w-12 h-1.5 rounded-full bg-ink/40"
               :style="{ opacity: drawer.handleOpacity.value }"></div>
        </div>
        <div class="shrink-0 px-4 pb-2.5 border-b border-ink/8 flex items-center justify-between gap-3">
          <div class="text-ink text-[14px] font-semibold">{{ title }}</div>
          <button @click="emit('close')" aria-label="Lukk panel"
                  class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                         bg-ink/5 border border-ink/10 text-ink-3 active:scale-90 transition">
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
            <div class="text-[11px] text-ink-3 leading-snug mb-3">
              Strekbredde per element for dette kartet. Ganges med Strek-knotten,
              som fortsatt skalerer alt under ett.
            </div>
            <div v-for="g in STROKE_GROUPS" :key="g.id"
                 class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="text-[13px] text-ink font-medium">{{ g.label }}</div>
                <span class="text-ink-3 text-[12px] tabular-nums">{{ strokeEffective[g.id].toFixed(2) }}×</span>
              </div>
              <input type="range" min="0.5" max="2.5" step="0.05"
                     :value="strokeEffective[g.id]"
                     @input="emit('setStrokeGroup', g.id, Number($event.target.value))"
                     :aria-label="`Strekbredde ${g.label}`"
                     class="w-full accent-sky-400"/>
            </div>
          </template>

          <!-- RELIEFF: av/på + stil for dette kartet -->
          <template v-else>
            <div class="text-[11px] text-ink-3 leading-snug mb-3">
              Gjelder dette kartet. Standard for alle kart settes i Innstillinger-fanen
              eller med «Angi som standard» under.
            </div>
            <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-[13px] text-ink font-medium">Relieff (terrengskygge)</div>
                <div class="text-[11px] text-ink-3 leading-snug">
                  Bruker mer minne/GPU — slå av på svake enheter.
                </div>
              </div>
              <button @click="reliefEnabled = !reliefEnabled"
                      :aria-pressed="reliefEnabled"
                      :aria-label="reliefEnabled ? 'Slå av relieff for dette kartet' : 'Slå på relieff for dette kartet'"
                      class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                      :class="reliefEnabled ? 'bg-emerald-500' : 'bg-ink/15'">
                <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                      :class="reliefEnabled ? 'left-5' : 'left-0.5'" />
              </button>
            </div>
            <div v-if="reliefEnabled" class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
              <div class="text-[13px] text-ink font-medium mb-2">Relieff-stil</div>
              <div class="flex gap-2" role="group" aria-label="Relieff-stil for dette kartet">
                <button @click="reliefMode = 'vektor'"
                        :aria-pressed="reliefMode === 'vektor'"
                        class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                        :class="reliefMode === 'vektor' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
                  Skarp (vektor)
                </button>
                <button @click="reliefMode = 'mjuk'"
                        :aria-pressed="reliefMode === 'mjuk'"
                        class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                        :class="reliefMode === 'mjuk' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
                  Mjuk (bilde)
                </button>
              </div>
              <div class="text-[11px] text-ink-3 leading-snug mt-1.5">
                Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
                Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
              </div>
            </div>
          </template>

          <!-- Footer: Angi som standard / Nullstill (strek + relieff) + feedback -->
          <div class="flex gap-2 mt-3">
            <button @click="emit('saveDefault')"
                    class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                           active:scale-[0.98] bg-emerald-500/15 border-emerald-400/40 text-emerald-100">
              Angi som standard
            </button>
            <button @click="emit('reset')"
                    class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                           active:scale-[0.98] bg-ink/5 border-ink/15 text-ink-2">
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
