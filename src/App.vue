<script setup>
import { ref, computed, watch } from 'vue'
import { RouterView } from 'vue-router'
import { updateAvailable, applyUpdate, buildBusy, updateDeferred } from './lib/swUpdate.js'
import { usePwaInstall } from './composables/usePwaInstall.js'

// ── Første-gangs installasjonsvarsel ───────────────────────────────────────
// Uansett hvilken URL brukeren lander på: første gang appen åpnes uinstallert,
// og så snart nettleseren faktisk kan installere (beforeinstallprompt fyrt →
// canInstall, eller iOS), viser vi ett native dialog-varsel. Ved dismiss lagres
// et flagg i localStorage så meldingen aldri kommer igjen. Forsiden og Om-siden
// har i tillegg en permanent «Installer som app»-knapp.
const INSTALL_PROMPT_KEY = 'lende-install-prompt-dismissed'
const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()

let firstVisitHandled = false
function maybeShowFirstVisitPrompt() {
  if (firstVisitHandled || isStandalone.value) return
  if (!(canInstall.value || isIOS.value)) return
  try {
    if (localStorage.getItem(INSTALL_PROMPT_KEY)) { firstVisitHandled = true; return }
  } catch { /* privat modus e.l. — kan ikke lese, vis likevel én gang */ }
  firstVisitHandled = true
  // Marker som sett med én gang: dialogen skal vises nøyaktig én gang, uansett
  // om brukeren installerer eller avviser.
  try { localStorage.setItem(INSTALL_PROMPT_KEY, '1') } catch { /* ignorer */ }
  if (isIOS.value) {
    alert('Så i lende fungerer best som app.\n\nSlik installerer du på iPhone/iPad:\n1. Trykk Del-ikonet nederst i Safari.\n2. Velg «Legg til på Hjem-skjerm».')
    return
  }
  if (confirm('Så i lende fungerer best som installert app – raskere start og full offline-tilgang.\n\nInstaller som app nå?')) {
    promptInstall().catch(() => { /* avvist eller utilgjengelig — ingen handling */ })
  }
}
watch([canInstall, isIOS, isStandalone], maybeShowFirstVisitPrompt, { immediate: true })

const updating = ref(false)
// Trykk «Oppdater»: pågår en bygging setter applyUpdate updateDeferred i stedet
// for å reloade (unngår hull i et halvbygd kart). Da bytter banneret til en ren
// «venter»-linje med spinner; reloaden skjer automatisk når byggingen er ferdig.
function onUpdate() {
  applyUpdate()
  if (!updateDeferred.value) updating.value = true
}
// Banneret har to layouter: én ledig (tekst + grønn knapp) og én i arbeid
// (spinner + status-linje, ingen knapp). Å skjule knappen i arbeid-tilstand gir
// statusteksten full bredde i stedet for å presses til flere korte linjer.
const busy = computed(() => updating.value || updateDeferred.value)
const busyLabel = computed(() =>
  updateDeferred.value ? 'Oppdaterer straks kartet er ferdig …' : 'Oppdaterer …')
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
          <!-- I arbeid: spinner. Ledig: oppdater-ikon. -->
          <span v-if="busy"
                class="w-5 h-5 shrink-0 rounded-full border-2 border-emerald-300/30
                       border-t-emerald-300 animate-spin"/>
          <svg v-else viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-emerald-300" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/>
          </svg>
          <span class="flex-1 leading-snug">
            {{ busy ? busyLabel : 'Ny versjon tilgjengelig' }}
          </span>
          <button v-if="!busy" @click="onUpdate"
                  class="shrink-0 px-3.5 py-1.5 rounded-lg font-medium bg-emerald-500 text-white
                         active:scale-95 transition">
            Oppdater
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
