<script setup>
// Status- og feil-overlays for kartet, skilt ut fra MapView v1.0.7. Samler tre
// uavhengige v-if/v-else-if-kjeder: (1) lasting/last-feil, (2) posisjons-status
// (GPS-feil / utenfor kart), (3) detalj-feil / ufullstendig kart / mosaikk-hull /
// lav GPS-nøyaktighet. Rent presentasjonelt — all tilstand kommer inn som props,
// brukerhandlinger sendes ut som events. Lasteskjelettets CSS følger med hit (scoped).
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { lastefeilPaaNorsk } from '../lib/lastefeil.js'
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
  // Hvor mange fliser som mangler for at arket skal bli rektangulært. Egen
  // teller fra mosaicGapCount, fordi de betyr forskjellige ting: et hull er noe
  // som er GALT (en avbrutt bygging), en ujevn kant er bare formen automatikken
  // gir. Derfor eget banner, lavere prioritet, og kostnaden skrevet på knappen.
  firkantAntall: { type: Number, default: 0 },
  isOffline: { type: Boolean, default: false },
  showLowAccuracy: { type: Boolean, default: false },
  accuracyM: { type: Number, default: 0 },
  fredetTruncated: { type: Boolean, default: false },
  fredetCount: { type: Number, default: 0 },
  fredetShown: { type: Number, default: 0 },
})
defineEmits([
  'retryLoad', 'dismissOutside', 'dismissDetails', 'retryDetails', 'dismissLowAccuracy',
  'retryGps', 'completePartial', 'repairMosaic', 'squareMosaic',
])

// Rå-meldingen fra pipelinen er nettleserens egen, og i den vanligste
// situasjonen er den «Failed to fetch»: engelsk, teknisk, og taus om det ene
// brukeren kan gjøre. Oversettelsen bor i lib/lastefeil.js — `isOffline` er en
// pålitelig negativ, så bare DA sier vi at nettet mangler.
const loadErrorTekst = computed(() => lastefeilPaaNorsk(props.loadError, { offline: props.isOffline }))

// Lokal «lukket for denne økta»-tilstand for reparasjons-bannerne og GPS-feil.
// De re-vises hvis tilstanden dukker opp på nytt (nytt kart / nye hull / ny feil).
const partialDismissed = ref(false)
const gapsDismissed = ref(false)
const firkantDismissed = ref(false)
const positionErrorDismissed = ref(false)
const fredetTruncDismissed = ref(false)
watch(() => props.mapIsPartial, (v) => { if (v) partialDismissed.value = false })
watch(() => props.mosaicGapCount, (v) => { if (v > 0) gapsDismissed.value = false })
watch(() => props.firkantAntall, (v) => { if (v > 0) firkantDismissed.value = false })
watch(() => props.positionError, () => { positionErrorDismissed.value = false })
// Toast «mange arkeologiske kulturminner»: vises når laget kappet utvalget,
// auto-skjules etter noen sekunder (kan også lukkes manuelt). Re-vises hver
// gang truncated-tilstanden dukker opp på nytt (nytt kart / nytt utsnitt).
let fredetTimer = null
watch(() => props.fredetTruncated, (v) => {
  if (!v) return
  fredetTruncDismissed.value = false
  clearTimeout(fredetTimer)
  fredetTimer = setTimeout(() => { fredetTruncDismissed.value = true }, 8000)
})
onBeforeUnmount(() => clearTimeout(fredetTimer))
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
         :class="isDark ? 'text-ink-2' : 'text-zinc-800/80'">
      <div class="w-8 h-8 border-2 rounded-full animate-spin mb-3"
           :class="isDark ? 'border-ink/25 border-t-ink/85' : 'border-zinc-900/20 border-t-zinc-900/80'"/>
      <div class="text-sm">Laster kart …</div>
    </div>
  </div>
  <div v-else-if="loading && loadPillVisible" role="status" aria-live="polite"
       class="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full
              bg-overlay/85 text-ink text-[12px] flex items-center gap-2 shadow-lg pointer-events-none">
    <span class="w-3.5 h-3.5 rounded-full border-2 border-ink/30 border-t-ink/85 animate-spin shrink-0"/>
    <span>Laster kart …</span>
  </div>

  <div v-else-if="loadError" role="alert"
       class="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center"
       :class="isDark ? 'text-ink-2' : 'text-zinc-700'">
    <div class="text-lg font-semibold mb-2">Kunne ikke laste kartet</div>
    <div class="text-sm opacity-80 mb-4 max-w-[22rem] leading-snug">{{ loadErrorTekst }}</div>
    <button @click="$emit('retryLoad')"
            class="mt-2 px-4 py-2 rounded-lg border text-sm active:scale-95"
            :class="isDark
                    ? 'bg-ink/10 border-ink/20 text-ink'
                    : 'bg-white border-zinc-300 text-zinc-800'">
      Prøv igjen
    </button>
  </div>

  <!-- Toast: utsnittet har flere arkeologiske kulturminner enn vi henter, så
       kartet viser et utvalg. Ren info (ingen handling) — auto-skjules. Egen
       v-if utenfor feil-kjedene: kan sameksistere, men er sjelden samtidig. -->
  <Transition name="fredet-toast">
    <div v-if="fredetTruncated && !fredetTruncDismissed && !loading" role="status" aria-live="polite"
         class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
                rounded-lg backdrop-blur bg-surface/95 border border-amber-400/30
                text-ink text-[12px] shadow-2xl flex items-start gap-2 pl-3 pr-1 py-2.5">
      <svg viewBox="0 0 24 24" class="w-4 h-4 mt-0.5 text-amber-300 shrink-0" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
        <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
      </svg>
      <span class="flex-1 leading-snug">
        {{ fredetCount }} arkeologiske kulturminner i dette utsnittet — viser
        de første {{ fredetShown }}. Zoom inn på et mindre område for å se resten.
      </span>
      <button @click="fredetTruncDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 flex items-center justify-center rounded-md
                     text-ink-2 active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  </Transition>

  <!-- Posisjons-status. GPS-feil (typisk stedstjenester av eller tillatelse
       avvist) får en «Prøv igjen»-knapp som re-utløser posisjons-forespørselen
       — nettleseren kan ikke skru på GPS selv, men et nytt forsøk trigger enten
       tillatelses-dialogen på nytt eller fanger opp at brukeren nå har slått på
       stedstjenester. -->
  <div v-if="!loading && positionError && !positionErrorDismissed" role="alert"
       class="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 max-w-[90%] pl-3 pr-1 py-2
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-slate-300/40
              text-ink text-[12px] shadow-lg
              transition-[left] duration-200"
       :style="mapCenterStyle">
    <div class="flex items-start gap-1.5">
      <span class="flex-1 min-w-0 leading-snug pt-0.5">{{ positionError }}</span>
      <button @click="positionErrorDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 flex items-center justify-center rounded-md
                     text-ink active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('retryGps')"
            class="mt-1.5 mb-0.5 w-full px-3 py-1 rounded-md bg-ink/20 border border-ink/30 text-ink
                   text-[12px] font-medium active:scale-[0.98] transition">
      Prøv igjen
    </button>
  </div>
  <div v-else-if="!loading && showOutsideMap" role="status" aria-live="polite"
       class="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 max-w-[90%]
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-slate-300/40
              text-ink text-[12px] shadow-lg flex items-center gap-1.5 pl-3 pr-1 py-2
              transition-[left] duration-200"
       :style="mapCenterStyle">
    <span>Du er utenfor dette kartet.</span>
    <button @click="$emit('dismissOutside')" aria-label="Greit, skjønner"
            class="w-6 h-6 -my-0.5 flex items-center justify-center rounded-md
                   text-ink active:scale-90 active:bg-ink/10 shrink-0">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>

  <!-- Detalj-feil-banner: bakgrunns-byggingen (stier/veier fra Overpass) feilet,
       så kartet viser bare terreng. Lesbart, med «Prøv på nytt»-knapp. -->
  <div v-if="detailsFailed && !loading" role="status" aria-live="polite"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-amber-300/40
              text-ink text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Fikk ikke lastet stier og detaljer. Kartet viser bare terreng nå.
      </div>
      <button @click="$emit('dismissDetails')" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-ink active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('retryDetails')"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-ink/15 border border-ink/25
                   text-ink text-[12px] font-medium active:scale-[0.98]">
      Prøv på nytt
    </button>
  </div>

  <!-- Ufullstendig kart (B): stored.partial = bygging avbrutt (reload/lukking)
       før OSM-detaljene ble fylt inn. Ikke-destruktivt — «Fullfør» bygger flisa
       om og erstatter den. Krever nett (knapp gråes ut offline). -->
  <div v-else-if="mapIsPartial && !partialDismissed && !loading" role="status" aria-live="polite"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-amber-300/40
              text-ink text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Dette kartet ble ikke ferdig bygd og viser bare terreng.
        <span v-if="isOffline" class="block mt-0.5 text-ink-2">Koble til nett for å fullføre det.</span>
      </div>
      <button @click="partialDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-ink active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('completePartial')" :disabled="isOffline"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-ink/15 border border-ink/25
                   text-ink text-[12px] font-medium active:scale-[0.98]
                   disabled:opacity-50 disabled:active:scale-100">
      {{ isOffline ? 'Fullfør (krever nett)' : 'Fullfør kartet' }}
    </button>
  </div>

  <!-- Mosaikk-hull (C): en avbrutt bygging etterlot manglende fliser inni det
       rektangulære bruttokartet. «Fyll hull» bygger KUN de manglende cellene,
       rører aldri eksisterende fliser. Krever nett. -->
  <div v-else-if="mosaicGapCount > 0 && !gapsDismissed && !loading" role="status" aria-live="polite"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-amber-300/40
              text-ink text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Kartet har {{ mosaicGapCount === 1 ? 'et hull' : `${mosaicGapCount} hull` }} etter en avbrutt utvidelse.
        <span v-if="isOffline" class="block mt-0.5 text-ink-2">Koble til nett for å fylle {{ mosaicGapCount === 1 ? 'det' : 'dem' }}.</span>
      </div>
      <button @click="gapsDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-ink active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('repairMosaic')" :disabled="isOffline"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-ink/15 border border-ink/25
                   text-ink text-[12px] font-medium active:scale-[0.98]
                   disabled:opacity-50 disabled:active:scale-100">
      {{ isOffline ? 'Fyll hull (krever nett)' : (mosaicGapCount === 1 ? 'Fyll hullet' : 'Fyll hullene') }}
    </button>
  </div>

  <!-- Firkant-arket: automatikken bygger ÉN flis om gangen — naboen du faktisk
       beveget deg mot — så et ark som har vokst av seg selv blir organisk formet.
       Det er ikke feil, men 3D og pan-grensa bruker arkets omsluttende rektangel,
       så hjørnene står tomme og du kan panorere ut i krem inne i ditt eget ark.
       Dette er et TILBUD med kostnaden skrevet på, aldri noe som skjer av seg
       selv — se findRectangleGaps for hvorfor det skillet er hele forskjellen. -->
  <div v-else-if="firkantAntall > 0 && !firkantDismissed && !loading" role="status" aria-live="polite"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px]
              rounded-lg backdrop-blur bg-overlay/95 border border-ink/15
              text-ink text-[12px] shadow-lg p-3">
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0 leading-snug">
        Arket har ujevn kant. Fyller du ut til firkant, dekker 3D og
        oversikts-zoom hele området.
        <span v-if="isOffline" class="block mt-0.5 text-ink-2">Koble til nett for å bygge.</span>
      </div>
      <button @click="firkantDismissed = true" aria-label="Lukk"
              class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                     text-ink-2 active:scale-90 active:bg-ink/10 shrink-0">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
    <button @click="$emit('squareMosaic')" :disabled="isOffline"
            class="mt-2 w-full px-3 py-1.5 rounded-md bg-ink/10 border border-ink/20
                   text-ink text-[12px] font-medium active:scale-[0.98]
                   disabled:opacity-50 disabled:active:scale-100">
      {{ isOffline ? 'Gjør arket firkantet (krever nett)' : `Gjør arket firkantet · +${firkantAntall} ${firkantAntall === 1 ? 'flis' : 'fliser'}` }}
    </button>
  </div>

  <!-- Advarsel ved lav GPS-nøyaktighet — peker bruker mot «Presis posisjon»-
       innstillingen, som er den vanligste rotårsaken. Full bredde (right-3) la
       lukke-krysset rett under FAB-stacken, så advarselen ble umulig å bli kvitt
       på en maskin uten ekte GPS (de fleste laptoper triangulerer på wifi og
       treffer sjelden bedre enn ±100 m, så den sto der hele tiden). Samme
       right-20 + max-w som de andre bannerne i denne filen: klar av knottene. -->
  <div v-else-if="!loading && showLowAccuracy" role="status" aria-live="polite"
       class="absolute bottom-32 left-3 right-20 z-20 max-w-[420px] px-3 py-2.5
              rounded-lg backdrop-blur on-accent bg-amber-800/95 border border-amber-300/40
              text-ink text-[12px] shadow-lg flex items-start gap-2">
    <div class="flex-1 min-w-0 leading-snug">
      <div class="font-semibold mb-0.5">
        Unøyaktig posisjon (&plusmn;{{ Math.round(accuracyM) }} m)
      </div>
      <div class="text-ink">
        Sjekk at appen har «Presis posisjon» (Android: Innstillinger →
        Apper → din nettleser → Tillatelser → Posisjon).
      </div>
    </div>
    <button @click="$emit('dismissLowAccuracy')" aria-label="Skjul advarsel"
            class="w-6 h-6 -mt-0.5 -mr-1 flex items-center justify-center rounded-md
                   text-ink active:scale-90 hover:bg-ink/10 shrink-0">
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

.fredet-toast-enter-active, .fredet-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fredet-toast-enter-from, .fredet-toast-leave-to {
  opacity: 0; transform: translateY(12px);
}
</style>
