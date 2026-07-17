<script setup>
import { ref, computed } from 'vue'
import { RouterView } from 'vue-router'
import { updateAvailable, applyUpdate, buildBusy, updateDeferred } from './lib/swUpdate.js'

const updating = ref(false)
// Trykk «Oppdater»: pågår en bygging setter applyUpdate updateDeferred i stedet
// for å reloade (unngår hull i et halvbygd kart). Da byttes knappe-teksten til
// en ventende status; reloaden skjer automatisk når byggingen er ferdig.
function onUpdate() {
  applyUpdate()
  if (!updateDeferred.value) updating.value = true
}
const updateLabel = computed(() => {
  if (updateDeferred.value) return 'Oppdaterer når kartet er ferdig …'
  if (updating.value) return 'Oppdaterer …'
  return 'Oppdater'
})
</script>

<template>
  <div class="min-h-[100dvh] bg-[#0e1116] text-white/90 antialiased">
    <RouterView v-slot="{ Component, route }">
      <Transition
        :name="route.meta.transition || 'fade'"
        mode="out-in"
      >
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>

    <!-- «Ny versjon tilgjengelig»-banner. Vises når service workeren har en ny,
         ventende versjon (se lib/swUpdate.js). Brukerstyrt — vi reloader ikke
         stille midt i bruk. -->
    <Transition name="sw-toast">
      <div v-if="updateAvailable"
           class="fixed inset-x-0 z-[100] flex justify-center px-3 pointer-events-none"
           :style="{ bottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
        <div class="pointer-events-auto w-full max-w-[420px] flex items-center gap-3
                    rounded-xl px-4 py-3 bg-zinc-800/95 backdrop-blur border border-white/15
                    shadow-2xl text-[13px]">
          <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-emerald-300" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
          </svg>
          <span class="flex-1 leading-snug">
            {{ updateDeferred ? 'Ny versjon klar — venter på at kartet blir ferdig'
                              : 'Ny versjon tilgjengelig' }}
          </span>
          <button @click="onUpdate" :disabled="updating || updateDeferred"
                  class="shrink-0 px-3 py-1.5 rounded-lg font-medium bg-emerald-500 text-white
                         active:scale-95 transition disabled:opacity-60">
            {{ updateLabel }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.sw-toast-enter-active,
.sw-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.sw-toast-enter-from,
.sw-toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
