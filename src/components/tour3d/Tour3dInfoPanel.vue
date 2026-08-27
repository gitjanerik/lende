<script setup>
// «Info» — hjelpen i 3D, minimert til en liten pille øverst til venstre, på
// samme linje som POI-filteret til høyre.
//
// Grunnen til at den finnes: navigering i 3D er gester, ikke knapper, og
// gester er usynlige. Én finger gjør én ting og to fingre noe annet, og det
// er ikke til å gjette. Teksten tilpasses derfor pekeren — berøring får
// finger-forklaringen, mus får sin — så ingen leser om noe de ikke har.
//
// Stilen er mørk glass, ikke grønn: grønt betyr «dine valg» (filteret), mørkt
// betyr visningens eget maskineri. Det skillet gjør at de to pillene ikke
// leses som to av samme sort.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  // 'utforsk' = fritt kamera over kartet. 'tur' = kameraet følger en tur, og
  // løsner når turen står stille.
  modus: { type: String, default: 'utforsk' },
  // Knappene som faktisk finnes i denne visningen: [{ navn, tekst }]
  knapper: { type: Array, default: () => [] },
  // Korte «slik gjør du»-tips, f.eks. «Trykk på en sti for å følge den».
  tips: { type: Array, default: () => [] },
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
      ['Høyre-dra videre ned', 'løfter blikket opp i himmelen'],
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
    ['Dra videre nedover', 'når kartet står vannrett, løftes blikket opp i himmelen'],
  ]
})
</script>

<template>
  <div class="max-w-[78vw] sm:max-w-sm">
    <button v-if="!expanded" @click="expanded = true"
            aria-label="Vis hjelp for 3D-visningen"
            class="flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur
                   text-white/85 text-[0.6875rem] font-medium shadow-lg pl-2.5 pr-3 py-1.5
                   active:scale-[0.97]">
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
        <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
      </svg>
      Info
    </button>

    <div v-else
         class="rounded-md bg-black/70 backdrop-blur text-white/90 text-[0.6875rem] shadow-lg
                flex items-start gap-1.5 pl-3 pr-1 py-2">
      <div class="flex-1 min-w-0">
        <div class="text-[0.5625rem] uppercase tracking-wide text-white/50">Slik beveger du deg</div>
        <ul class="mt-1 flex flex-col gap-0.5">
          <li v-for="[hva, gjor] in gester" :key="hva" class="leading-snug">
            <span class="font-semibold">{{ hva }}</span>
            <span class="text-white/70"> — {{ gjor }}</span>
          </li>
        </ul>

        <template v-if="knapper.length">
          <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/50">Knappene</div>
          <ul class="mt-1 flex flex-col gap-0.5">
            <li v-for="k in knapper" :key="k.navn" class="leading-snug">
              <span class="font-semibold">{{ k.navn }}</span>
              <span class="text-white/70"> — {{ k.tekst }}</span>
            </li>
          </ul>
        </template>

        <template v-if="tips.length">
          <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/50">Tips</div>
          <ul class="mt-1 flex flex-col gap-0.5">
            <li v-for="t in tips" :key="t" class="leading-snug text-white/70">{{ t }}</li>
          </ul>
        </template>
      </div>

      <button @click="expanded = false" aria-label="Minimer"
              class="w-7 h-7 shrink-0 flex items-center justify-center active:scale-90">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 15 12 9 18 15"/>
        </svg>
      </button>
    </div>
  </div>
</template>
