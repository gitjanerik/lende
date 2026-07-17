<script setup>
// Status- og feil-overlays for kartet, skilt ut fra MapView v1.0.7. Samler tre
// uavhengige v-if/v-else-if-kjeder: (1) lasting/last-feil, (2) posisjons-status
// (GPS-feil / utenfor kart), (3) detalj-feil / ufullstendig kart / mosaikk-hull /
// lav GPS-nøyaktighet. Rent presentasjonelt — all tilstand kommer inn som props,
// brukerhandlinger sendes ut som events. Lasteskjelettets CSS følger med hit (scoped).
import { ref, watch } from 'vue'
const props = defineProps({
  loading: { type: Boolean, default: false },
  hasMeta: { type: Boolean, default: false },
  skeletonVisible: { type: Boolean, default: false },
  isDark: { type: Boolean, default: false },
  loadPillVisible: { type: Boolean, default: false },
  loadError: { type: String, default: null },
  positionError: { type: String, default: null },
  mapCenterStyle: { type: Object, default: () => ({}) },
  showOutsideMap: { type: Boolean, default: false },
  detailsFailed: { type: Boolean, default: false },
  mapIsPartial: { type: Boolean, default: false },
  mosaicGapCount: { type: Number, default: 0 },
  isOffline: { type: Boolean, default: false },
  showLowAccuracy: { type: Boolean, default: false },
  accuracyM: { type: Number, default: 0 },
})
defineEmits([
  'retryLoad', 'dismissOutside', 'dismissDetails', 'retryDetails', 'dismissLowAccuracy',
  'retryGps', 'completePartial', 'repairMosaic',
])

// Lokal «lukket for denne økta»-tilstand for de to reparasjons-bannerne. De
// re-vises hvis tilstanden dukker opp på nytt (nytt kart / nye hull oppdaget).
const partialDismissed = ref(false)
const gapsDismissed = ref(false)
watch(() => props.mapIsPartial, (v) => { if (v) partialDismissed.value = false })
watch(() => props.mosaicGapCount, (v) => { if (v > 0) gapsDismissed.value = false })
</script>

<template>
  <!-- Lasting / feil. Kart-aktig skjelett ved FØRSTE last (ingen kart ennå).
       Når et kart allerede vises (bytte/promotering av flis) dekker vi IKKE
       kartet med et opakt skjelett — da ville «Laster kart»-teksten bli nesten
       usynlig oppå kremgult kart. Vis i stedet en liten lesbar pille i hjørnet. -->
  <div v-if="loading && !hasMeta && skeletonVisible" class="absolute inset-0 z-10 overflow-hidden">
    <div class="cb-skeleton absolute inset-0" :class="isDark ? 'cb-skeleton-dark' : 'cb-skeleton-light'">
      <div class="cb-skeleton-shimmer absolute inset-0"/>
    </div>
    <!-- Tekst + spinner er tema-bevisste: hvitt på kremgult lyst skjelett ble
         nesten usynlig. Mørk på lyst tema, lys på mørkt. -->
    <div class="absolute inset-0 flex flex-col items-center justify-center"
         :class="isDark ? 'text-white/70' : 'text-zinc-800/80'">
      <div class="w-8 h-8 border-2 rounded-full animate-spin mb-3"
           :class="isDark ? 'border-white/25 border-t-white/85' : 'border-zinc-900/20 border-t-zinc-900/80'"/>
      <div class="text-sm">Laster kart …</div>
    </div>
  </div>
  <div v-else-if="loading && loadPillVisible"
       class="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full
              bg-zinc-950/85 text-white/90 text-[12px] flex items-center gap-2 shadow-lg pointer-events-none">
    <span class="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white/85 animate-spin shrink-0"/>
    <span>Laster kart …</span>
  </div>

  <div v-else-if="loadError"
       class="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center"
       :class="isDark ? 'text-white/80' : 'text-zinc-700'">
    <div class="text-lg font-semibold mb-2">Kunne ikke laste kartet</div>
    <div class="text-sm opacity-70 mb-4">{{ loadError }}</div>
    <button @click="$emit('retryLoad')"
            class="mt-2 px-4 py-2 rounded-lg border text-sm active:scale-95"
            :class="isDark
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white border-zinc-300 text-zinc-800'">
      Prøv igjen
    </button>
  </div>

  <!-- Posisjons-status. GPS-feil (typisk stedstjenester av eller tillatelse
       avvist) får en «Prøv igjen»-knapp som re-utløser posisjons-forespørselen
       — nettleseren kan ikke skru på GPS selv, men et nytt forsøk trigger enten
       tillatelses-dialogen på nytt eller fanger opp at brukeren nå har slått på
       stedstjenester. -->
  <div v-if="!loading && positionError"
       class="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 max-w-[90%] px-3 py-2
              rounded-lg backdrop-blur bg-amber-600/95 border border-slate-300/40
              text-white text-[12px] shadow-lg text-center flex flex-col items-center gap-2
              transition-[left] duration-200"
       :style="mapCenterStyle">
    <span>{{ positionError }}</span>
    <button @click="$emit('retryGps')"
            class="px-3 py-1 rounded-md bg-white/20 border border-white/30 text-white
                   text-[12px] font-medium active:scale-95 transition">
      Prøv igjen
    </button>
  </div>
  <div v-else-if="!loading && showOutsideMap"
       class="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 max-w-[90%]
              rounded-lg backdrop-blur bg-amber-600/95 border border-slate-300/40
              text-white text-[12px] shadow-lg flex items-center gap-1.5 pl-3 pr-1 py-2
              transition-[left] duration-200"
       :style="mapCenterStyle">
    <span>Du er utenfor dette kartet.</span>
    <button @click="$emit('dismissOutside')" aria-label="Greit, skjønner"
            class="w-6 h-6 -my-0.5 flex items-center justify-center rounded-md
                   text-white/90 active:scale-90 active:bg-white/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Detalj-feil-banner: bakgrunns-byggingen (stier/veier fra Overpass) feilet,
       så kartet viser bare terreng. Lesbart, med «Prøv på nytt»-knapp. -->
  <div v-if="detailsFailed && !loading"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur bg-amber-600/95 border border-amber-300/40
              text-white text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Fikk ikke lastet stier og detaljer. Kartet viser bare terreng nå.
      </div>
      <button @click="$emit('dismissDetails')" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-white/90 active:scale-90 active:bg-white/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('retryDetails')"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-white/15 border border-white/25
                   text-white text-[12px] font-medium active:scale-[0.98]">
      Prøv på nytt
    </button>
  </div>

  <!-- Ufullstendig kart (B): stored.partial = bygging avbrutt (reload/lukking)
       før OSM-detaljene ble fylt inn. Ikke-destruktivt — «Fullfør» bygger flisa
       om og erstatter den. Krever nett (knapp gråes ut offline). -->
  <div v-else-if="mapIsPartial && !partialDismissed && !loading"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur bg-amber-600/95 border border-amber-300/40
              text-white text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Dette kartet ble ikke ferdig bygd og viser bare terreng.
        <span v-if="isOffline" class="block mt-0.5 text-white/80">Koble til nett for å fullføre det.</span>
      </div>
      <button @click="partialDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-white/90 active:scale-90 active:bg-white/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('completePartial')" :disabled="isOffline"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-white/15 border border-white/25
                   text-white text-[12px] font-medium active:scale-[0.98]
                   disabled:opacity-50 disabled:active:scale-100">
      {{ isOffline ? 'Fullfør (krever nett)' : 'Fullfør kartet' }}
    </button>
  </div>

  <!-- Mosaikk-hull (C): en avbrutt bygging etterlot manglende fliser inni det
       rektangulære bruttokartet. «Fyll hull» bygger KUN de manglende cellene,
       rører aldri eksisterende fliser. Krever nett. -->
  <div v-else-if="mosaicGapCount > 0 && !gapsDismissed && !loading"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur bg-amber-600/95 border border-amber-300/40
              text-white text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Kartet har {{ mosaicGapCount === 1 ? 'et hull' : `${mosaicGapCount} hull` }} etter en avbrutt utvidelse.
        <span v-if="isOffline" class="block mt-0.5 text-white/80">Koble til nett for å fylle {{ mosaicGapCount === 1 ? 'det' : 'dem' }}.</span>
      </div>
      <button @click="gapsDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-white/90 active:scale-90 active:bg-white/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('repairMosaic')" :disabled="isOffline"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-white/15 border border-white/25
                   text-white text-[12px] font-medium active:scale-[0.98]
                   disabled:opacity-50 disabled:active:scale-100">
      {{ isOffline ? 'Fyll hull (krever nett)' : (mosaicGapCount === 1 ? 'Fyll hullet' : 'Fyll hullene') }}
    </button>
  </div>

  <!-- Advarsel ved lav GPS-nøyaktighet — peker bruker mot «Presis posisjon»-
       innstillingen, som er den vanligste rotårsaken. -->
  <div v-else-if="!loading && showLowAccuracy"
       class="absolute bottom-32 left-3 right-3 z-20 px-3 py-2.5 rounded-lg backdrop-blur
              bg-amber-600/95 border border-amber-300/40 text-white text-[12px] shadow-lg
              flex items-start gap-2">
    <div class="flex-1 leading-snug">
      <div class="font-semibold mb-0.5">
        Unøyaktig posisjon (&plusmn;{{ Math.round(accuracyM) }} m)
      </div>
      <div class="text-white/90">
        Sjekk at appen har «Presis posisjon» (Android: Innstillinger →
        Apper → din nettleser → Tillatelser → Posisjon).
      </div>
    </div>
    <button @click="$emit('dismissLowAccuracy')" aria-label="Skjul advarsel"
            class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                   text-white/85 active:scale-90 hover:bg-white/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* Kart-aktig lasteskjelett: rolig grunnfarge med svake «kurve»-bånd og et
   lysstrøk som sveiper over. Antyder et kart under bygging. */
.cb-skeleton-light {
  background:
    repeating-linear-gradient(115deg, rgba(140,110,70,.05) 0 2px, transparent 2px 26px),
    #ece3cf;
}
.cb-skeleton-dark {
  background:
    repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 2px, transparent 2px 26px),
    #20242b;
}
.cb-skeleton-shimmer {
  background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.10) 50%, transparent 70%);
  transform: translateX(-100%);
  animation: cb-shimmer 1.5s ease-in-out infinite;
}
@keyframes cb-shimmer { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) {
  .cb-skeleton-shimmer { animation: none; }
}
</style>
