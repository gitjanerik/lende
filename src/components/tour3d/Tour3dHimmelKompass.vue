<script setup>
// Himmelkompasset, nede til høyre i nattmodus.
//
// To ringer og en rød prikk: den flate skiva er jordas plan med øst–vest-aksen
// tvers over, den loddrette ringen bærer N og S, og prikken er der du ser.
// Ringene står STILLE — N blir liggende samme sted på skjermen — så kompasset
// er noe man leser og ikke tolker. Se himmelKompass.js for hvorfor.
//
// Fargene er nattsyn: ringene i dempet gråblått, prikken i rødt. Rødt lys er
// det som ødelegger mørkeadaptasjonen minst, og det er den ene fargen som får
// lyse her.
//
// Peker-treff er AV (pointer-events-none): gizmoen er en måler, ikke en knapp.
// Et trykk der skal gå gjennom til himmelen bak, så man kan velge et stjernebilde
// som tilfeldigvis står i det hjørnet.
import { computed } from 'vue'
import { kompassGeometri, KOMPASS_RADIUS } from '../../lib/tour3d/himmelKompass.js'

const props = defineProps({
  // Hvor brukeren ser, i GRADER: { azimut, hoyde }.
  blikk: { type: Object, default: null },
})

// viewBox-en er sentrert i origo, så all matte i modulen kan regne fra midten.
// Marginen tar labelene, som ligger utenfor ringen.
const R = KOMPASS_RADIUS
const M = 16
const viewBox = `${-(R + M)} ${-(R + M)} ${2 * (R + M)} ${2 * (R + M)}`

const g = computed(() => kompassGeometri(props.blikk))

// Himmelretningen med ord, for skjermlesere og for den som lurer. Kompasset er
// grafikk, men retningen er informasjon — den skal finnes som tekst også.
const NAVN = ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest']
const lest = computed(() => {
  const a = props.blikk?.azimut
  if (!Number.isFinite(a)) return 'Himmelkompass'
  const i = Math.round(((a % 360) + 360) % 360 / 45) % 8
  return `Du ser mot ${NAVN[i]}, ${Math.round(props.blikk?.hoyde ?? 0)}° over horisonten`
})
</script>

<template>
  <svg :viewBox="viewBox" class="w-[4.5rem] h-[4.5rem] pointer-events-none overflow-visible"
       role="img" :aria-label="lest">
    <!-- Jordas plan: den flate skiva. Bare omriss, som bestilt. -->
    <path :d="g.horisont" fill="none" stroke="#8fa6c4" stroke-width="1.2" opacity="0.55"/>
    <!-- Øst–vest-aksen tvers over skiva. -->
    <line :x1="g.ostVest.x1" :y1="g.ostVest.y1" :x2="g.ostVest.x2" :y2="g.ostVest.y2"
          stroke="#8fa6c4" stroke-width="0.9" opacity="0.35"/>
    <!-- Den loddrette ringen gjennom nord og zenit: nord–sør-aksen. -->
    <path :d="g.meridian" fill="none" stroke="#8fa6c4" stroke-width="1.2" opacity="0.4"/>

    <!-- N og S. Bare de to: fire bokstaver på 70 piksler blir grøt i mørket. -->
    <text v-for="m in g.merker" :key="m.navn" :x="m.x" :y="m.y"
          text-anchor="middle" dominant-baseline="central"
          font-size="13" font-weight="600" fill="#c3d3e8" opacity="0.8">{{ m.navn }}</text>

    <!-- Blikket. Halvgjennomsiktig når det peker bort fra oss, så man ser
         forskjell på «ser mot nord» og «ser mot sør» også når prikken tilfeldigvis
         projiserer til samme punkt. -->
    <circle :cx="g.prikk.x" :cy="g.prikk.y" :r="g.prikk.bak ? 2.6 : 4"
            fill="#ff4d3d" :opacity="g.prikk.bak ? 0.45 : 0.95"/>
    <circle v-if="!g.prikk.bak" :cx="g.prikk.x" :cy="g.prikk.y" r="7"
            fill="none" stroke="#ff4d3d" stroke-width="1" opacity="0.35"/>
  </svg>
</template>
