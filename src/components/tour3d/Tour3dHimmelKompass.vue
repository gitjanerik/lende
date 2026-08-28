<script setup>
// Himmelkompasset, nede til høyre i nattmodus.
//
// En skive som dreier og en rød markør som står stille øverst: markøren er hvor
// du ser, og N, Ø, S, V flytter seg under den. Det er konvensjonen fra hvert
// kart-program og hvert kompass, og derfor trenger den ingen forklaring.
//
// FØRSTE UTGAVE (v6.1.0) gjorde det motsatt — ringene sto stille og en prikk
// vandret — og eieren forsto den ikke. Se himmelKompass.js for hele historien;
// den er verdt å lese før noen snur den tilbake.
//
// DEN ER EN KNAPP: trykk, og kameraet vender mot nord med samme høyde du står i.
// Det er den ene handlingen et kompass skal ha, og i mørket er det mye lettere å
// treffe et hjørne enn å dra seg rundt til man finner N. Står du alt i nord,
// sier aria-labelen det i stedet for å love en bevegelse som ikke kommer.
//
// Fargene er nattsyn: skiva i dempet gråblått, markøren i rødt. Rødt lys
// ødelegger mørkeadaptasjonen minst, og det er den ene fargen som får lyse her.
import { computed } from 'vue'
import {
  kompassGeometri, retningsNavn, KOMPASS_RADIUS,
} from '../../lib/tour3d/himmelKompass.js'

const props = defineProps({
  // Hvor brukeren ser, i GRADER: { azimut, hoyde }.
  blikk: { type: Object, default: null },
})
const emit = defineEmits(['nord'])

// viewBox-en er sentrert i origo, så all matte i modulen kan regne fra midten.
// Marginen tar bokstavene, som ligger utenfor ringen.
const R = KOMPASS_RADIUS
const M = 18
const viewBox = `${-(R + M)} ${-(R + M)} ${2 * (R + M)} ${2 * (R + M)}`

const g = computed(() => kompassGeometri(props.blikk))

// Retningen med ord. Kompasset er grafikk, men retningen er informasjon — den
// skal finnes som tekst også, og den er samtidig knappens egen merkelapp.
const lest = computed(() => {
  const a = props.blikk?.azimut
  if (!Number.isFinite(a)) return 'Himmelkompass'
  const hvor = `Du ser mot ${retningsNavn(a)}, ${Math.round(props.blikk?.hoyde ?? 0)}° over horisonten`
  return g.value.serNord ? `${hvor}. Du ser alt nordover.` : `${hvor}. Trykk for å vende mot nord.`
})
</script>

<template>
  <button type="button" @click="emit('nord')" :aria-label="lest"
          class="pointer-events-auto active:scale-95 transition-transform">
    <svg :viewBox="viewBox" class="w-[4.75rem] h-[4.75rem] overflow-visible" aria-hidden="true">
      <!-- Skiva: jordas plan sett på skrå. Bare omriss. -->
      <path :d="g.ring" fill="none" stroke="#8fa6c4" stroke-width="1.2" opacity="0.5"/>
      <!-- Et lite kryss i midten, så skiva har et senter å lese vinklene mot. -->
      <path d="M-4 0h8M0-3v6" stroke="#8fa6c4" stroke-width="0.9" opacity="0.3"/>

      <!-- Himmelretningene. Nord er lysere og litt større enn de tre andre: det
           er den man leter etter. Bokstaver på den nære sida står foran skiva og
           er tydeligst — den enkleste dybdesignalen som finnes. -->
      <text v-for="m in g.merker" :key="m.navn" :x="m.x" :y="m.y"
            text-anchor="middle" dominant-baseline="central"
            :font-size="m.erNord ? 14 : 11.5"
            :font-weight="m.erNord ? 700 : 500"
            :fill="m.erNord ? '#dbe7f7' : '#a8bcd6'"
            :opacity="m.naer ? 0.95 : 0.6">{{ m.navn }}</text>

      <!-- Markøren: hit ser du. Står fast øverst, aldri noe annet sted. En
           trekant og ikke en prikk, fordi en trekant PEKER — den sier at det er
           en retning og ikke et objekt. -->
      <path :transform="`translate(${g.markor.x}, ${g.markor.y})`"
            d="M0 2.6 L-4.4-4 L4.4-4 Z" fill="#ff4d3d" opacity="0.95"/>
    </svg>
  </button>
</template>
