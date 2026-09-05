<script setup>
// «Info» — hjelpen i 3D, en liten pille øverst til venstre, på samme linje som
// POI-filteret til høyre.
//
// Grunnen til at den finnes: navigering i 3D er gester, ikke knapper, og
// gester er usynlige. Én finger gjør én ting og to fingre noe annet, og det
// er ikke til å gjette. Teksten tilpasses derfor pekeren — berøring får
// finger-forklaringen, mus får sin — så ingen leser om noe de ikke har.
//
// Stilen er mørk glass, ikke grønn: grønt betyr «dine valg» (filteret), mørkt
// betyr visningens eget maskineri. Det skillet gjør at de to pillene ikke
// leses som to av samme sort.
//
// v6.5.44: HEADEREN BLIR STÅENDE, OG KROPPEN ER ET NEDTREKK. Fram til nå
// BYTTET pilla seg ut med den utvidede boksen, og boksen sto i FLYTEN i en
// `justify-between`-rad — så en åpnet hjelp dyttet POI-filteret ut av skjermen
// og tok med seg sin egen lukkeknapp ut av syne. To ting følger, og begge er
// lette å «rydde» bort:
//   1. Pilla er den ENESTE bryteren, og den står i flyten alene. Raden er
//      derfor like bred åpen som lukket, og filteret flytter seg aldri.
//      Lukkeknappen inne i boksen er borte — den var en andre vei ut av noe
//      man kom inn i med ett trykk, og det er headeren som er den veien.
//   2. Kroppen er ABSOLUTT plassert under pilla. Da må den bære sitt eget tak
//      og sin egen rulling: kallstedet kan ikke pakke den i en `overflow`-boks,
//      for en slik boks ville klippet nedtrekket bort.
// Målene kommer som CSS-lengder fra kallstedet, som `Tour3dHimmelKort` — det er
// DER `zoom` settes, og `vw`/`vh` skaleres ikke ned av den (se v6.3.12).
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  // 'utforsk' = fritt kamera over kartet. 'tur' = kameraet følger en tur, og
  // løsner når turen står stille.
  modus: { type: String, default: 'utforsk' },
  // Knappene som faktisk finnes i denne visningen: [{ navn, tekst }]
  knapper: { type: Array, default: () => [] },
  // Korte «slik gjør du»-tips, f.eks. «Trykk på en sti for å følge den».
  tips: { type: Array, default: () => [] },
  maksBredde: { type: String, default: '78vw' },
  maksHoyde: { type: String, default: '60vh' },
})

const expanded = ref(false)
const bererer = ref(true)

function maalPeker() {
  try {
    bererer.value = !window.matchMedia('(pointer: fine)').matches
  } catch {
    bererer.value = true
  }
}
onMounted(() => {
  maalPeker()
  window.addEventListener('resize', maalPeker)
})
onBeforeUnmount(() => window.removeEventListener('resize', maalPeker))

const gester = computed(() => {
  if (!bererer.value) {
    return [
      ['Dra', 'flytter kartet'],
      ['Høyre-dra', 'snurrer og vipper'],
      ['Hjul', 'zoomer inn og ut'],
      ['Høyre-dra videre opp', 'løfter blikket opp i himmelen'],
    ]
  }
  if (props.modus === 'tur') {
    return [
      ['Mens turen går', 'én finger ser deg rundt, to fingre knipes for nær og fjern'],
      ['Når turen er pauset', 'kameraet er ditt: dra for å snurre, to fingre for å flytte'],
      ['Play', 'fester kameraet til turen igjen, med utsikten du valgte'],
    ]
  }
  return [
    ['Én finger', 'dra for å snurre kartet'],
    ['To fingre', 'knip for å zoome, dra for å flytte'],
    // Gesten er usynlig uten denne linja: den er en FORTSETTELSE av draget, og
    // ingen prøver å dra videre når kartet har sluttet å bevege seg.
    ['Dra videre oppover', 'når kartet står vannrett, løftes blikket opp i himmelen'],
  ]
})
</script>

<template>
  <div class="relative">
    <button type="button" @click="expanded = !expanded"
            :aria-expanded="expanded" aria-controls="tour3d-info-kropp"
            :aria-label="expanded ? 'Skjul hjelp for 3D-visningen' : 'Vis hjelp for 3D-visningen'"
            class="flex items-center gap-1.5 rounded-full backdrop-blur text-white/85
                   text-[0.6875rem] font-medium shadow-lg pl-2.5 pr-2 py-1.5
                   active:scale-[0.97] transition-colors"
            :class="expanded ? 'bg-black/75' : 'bg-black/72'">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
        <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
      </svg>
      Info
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 shrink-0 transition-transform"
           :class="expanded ? 'rotate-180' : ''" fill="none" stroke="currentColor"
           stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Kroppen henger UNDER pilla og er ute av flyten, så raden beholder
         bredden sin. `touch-pan-y` + `overscroll-contain`: uten dem forplanter
         et drag som treffer enden av lista seg til 3D-lerretet og dreier
         kameraet under fingeren (samme grep som infokortet i himmelen). -->
    <div v-if="expanded" id="tour3d-info-kropp"
         class="absolute left-0 top-full mt-1.5 w-max overflow-y-auto overscroll-contain
                touch-pan-y rounded-md bg-black/75 backdrop-blur text-white/90
                text-[0.6875rem] shadow-lg px-3 py-2"
         :style="{ maxWidth: props.maksBredde, maxHeight: props.maksHoyde }">
      <div class="text-[0.5625rem] uppercase tracking-wide text-white/72">Slik beveger du deg</div>
      <ul class="mt-1 flex flex-col gap-0.5">
        <li v-for="[hva, gjor] in gester" :key="hva" class="leading-snug">
          <span class="font-semibold">{{ hva }}</span>
          <span class="text-white/70"> — {{ gjor }}</span>
        </li>
      </ul>

      <template v-if="knapper.length">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/72">Knappene</div>
        <ul class="mt-1 flex flex-col gap-0.5">
          <li v-for="k in knapper" :key="k.navn" class="leading-snug">
            <span class="font-semibold">{{ k.navn }}</span>
            <span class="text-white/70"> — {{ k.tekst }}</span>
          </li>
        </ul>
      </template>

      <template v-if="tips.length">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/72">Tips</div>
        <ul class="mt-1 flex flex-col gap-0.5">
          <li v-for="t in tips" :key="t" class="leading-snug text-white/70">{{ t }}</li>
        </ul>
      </template>
    </div>
  </div>
</template>
