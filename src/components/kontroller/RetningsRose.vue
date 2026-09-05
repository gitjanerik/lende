<script setup>
// Retningsrosa: ÉN rund flate som bærer BEGGE retningsaksene. DESKTOP-ONLY.
//
// HVORFOR ÉN PUTE OG IKKE TO SKYVER: 3D trenger zoom, tilt og rotasjon, og
// kartet trenger zoom og rotasjon. Fire loddrette skyver langs høyrekanten er
// et instrumentbord, ikke et kart. Rotasjon og tilt er dessuten ikke to
// uavhengige tall — de er ÉN retning på en kule, og en kule tegnes som en
// skive: azimut rundt, høyde innover.
//
// ROSA ER HIMMELHVELVET SETT OVENFRA. Senter er rett opp, randen er rett ned,
// og horisonten er ringen imellom. Dra pucken innover og du løfter blikket; dra
// den ut mot randen og du legger deg over kartet og ser rett ned. Regnestykket
// bor i lib/navKontroller.js, som er rent og testet.
//
// HVORFOR IKKE EN «KUBE» Å DRA I (vurdert): en akse-kube er Blender-språk. Den
// forteller om et objekt sett fra utsiden, mens man her står PÅ kartet og ser
// UT — og den har ingen naturlig tastaturbetjening. Rosa snakker språket appen
// allerede bruker: nord, retning, høyde over horisonten.
//
// TILGJENGELIGHET: puten er en peker-flate, men de to <input type="range"> under
// er EKTE og betjenes med tastatur. De ligger oppå rosa med `opacity: 0` og
// `pointer-events: none` — ikke `sr-only` — så de har en ekte størrelse, tar
// imot fokus, og et testverktøy kan sette dem. Fokusringen tegnes på rosa via
// :focus-within.
import { computed, ref } from 'vue'
import { roseTilRetning, retningTilRose, hoydeBroek, normaliserGrader } from '../../lib/navKontroller.js'

const props = defineProps({
  /** 'kart' = bare rotasjon (skiva snurrer); 'himmel' = retning + høyde (pucken flytter seg). */
  modus: { type: String, default: 'himmel' },
  /** Grader. I kart-modus: hvor nord ligger på skjermen. I himmel: blikkets azimut. */
  azimut: { type: Number, default: 0 },
  /** Grader over horisonten. Bare himmel-modus. */
  hoyde: { type: Number, default: 0 },
  minHoyde: { type: Number, default: -85 },
  maksHoyde: { type: Number, default: 74 },
  natt: { type: Boolean, default: false },
})
const emit = defineEmits(['retning', 'nord'])

const himmel = computed(() => props.modus === 'himmel')
const rosa = ref(null)

const az = computed(() => normaliserGrader(props.azimut))
const h = computed(() => Math.max(props.minHoyde, Math.min(props.maksHoyde,
  Number.isFinite(props.hoyde) ? props.hoyde : 0)))

// SVG-en har radius 46 i et 100×100-viewBox; puckens plass regnes i det samme
// rommet, så den følger uansett hvor stor rosa tegnes.
const RAD = 46
const puck = computed(() => retningTilRose(az.value, h.value, RAD, {
  minHoyde: props.minHoyde, maksHoyde: props.maksHoyde, hoyde: himmel.value,
}))
const horisontR = computed(() => RAD * hoydeBroek(0, props.minHoyde, props.maksHoyde))

const lest = computed(() => (himmel.value
  ? `Blikkretning ${Math.round(az.value)} grader, ${Math.round(h.value)} grader over horisonten`
  : `Kartet er rotert ${Math.round(az.value)} grader`))

function fraPeker(e) {
  const el = rosa.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const radius = Math.min(r.width, r.height) / 2
  if (!(radius > 0)) return
  const ut = roseTilRetning(
    e.clientX - (r.left + r.width / 2),
    e.clientY - (r.top + r.height / 2),
    radius,
    { minHoyde: props.minHoyde, maksHoyde: props.maksHoyde, hoyde: himmel.value },
  )
  // Null betyr «uendret» — i dødsonen midt på har pekeren ingen retning, og i
  // kart-modus finnes ingen høyde. Kalleren skal ikke måtte kjenne den regelen.
  emit('retning', {
    azimut: ut.azimut ?? az.value,
    hoyde: ut.hoyde ?? h.value,
  })
}

// Peker-fangst på selve rosa: draget skal fortsette også når fingeren går
// utenfor den lille skiva, ellers slipper kontrollen taket midt i en bevegelse.
function ned(e) {
  if (e.button != null && e.button > 0) return
  rosa.value?.setPointerCapture?.(e.pointerId)
  fraPeker(e)
}
function flytt(e) {
  if (!rosa.value?.hasPointerCapture?.(e.pointerId)) return
  fraPeker(e)
}
function opp(e) {
  rosa.value?.releasePointerCapture?.(e.pointerId)
}

function settAzimut(e) {
  const v = Number(e.target.value)
  if (Number.isFinite(v)) emit('retning', { azimut: v, hoyde: h.value })
}
function settHoyde(e) {
  const v = Number(e.target.value)
  if (Number.isFinite(v)) emit('retning', { azimut: az.value, hoyde: v })
}
</script>

<template>
  <div ref="rosa" class="rose" :class="natt ? 'natt' : ''"
       @pointerdown.prevent="ned" @pointermove="flytt"
       @pointerup="opp" @pointercancel="opp"
       @dblclick.prevent="emit('nord')"
       role="group" :aria-label="lest">
    <svg viewBox="-50 -50 100 100" class="w-full h-full" aria-hidden="true">
      <circle r="47" class="flate"/>
      <!-- HORISONTEN, bare i 3D. Uten en synlig horisont er det ikke til å
           gjette at innsida er himmel og utsida er bakken sett ovenfra. -->
      <circle v-if="himmel" :r="horisontR" class="horisont"/>
      <!-- Skiva snurrer i KART-modus (nåla peker mot nord, som kompass-FAB-en),
           men står stille i himmel-modus — der er det pucken som flytter seg.
           Samme regel som himmelkompasset: bokstaver som vandrer i mørket er
           noe man må tolke, ikke noe man leser. -->
      <g :transform="himmel ? undefined : `rotate(${az})`">
        <line x1="0" y1="-47" x2="0" y2="-38" class="tick nord"/>
        <line x1="0" y1="47" x2="0" y2="38" class="tick"/>
        <line x1="-47" y1="0" x2="-38" y2="0" class="tick"/>
        <line x1="47" y1="0" x2="38" y2="0" class="tick"/>
        <text x="0" y="-27" class="bokstav nord">N</text>
        <polygon v-if="!himmel" points="0,-34 7,-16 0,-21 -7,-16" class="naal"/>
      </g>
      <!-- Pucken er himmel-modusens avlesning. I kart-modus ER nåla avlesningen,
           og en puck oppå den ville bare ligget i veien for bokstaven. -->
      <template v-if="himmel">
        <circle :cx="puck.x" :cy="puck.y" r="7" class="puck-glow"/>
        <circle :cx="puck.x" :cy="puck.y" r="4" class="puck"/>
      </template>
    </svg>

    <!-- EKTE kontroller for tastatur og hjelpemidler. Se toppkommentaren:
         gjennomsiktige og uten peker-hendelser, ikke skjult. -->
    <input type="range" min="-180" max="180" step="1" :value="Math.round(az)"
           @input="settAzimut" class="usynlig-skyv"
           :aria-label="himmel ? 'Blikkets retning i grader fra nord' : 'Roter kartet'"
           :aria-valuetext="`${Math.round(az)} grader`"/>
    <input v-if="himmel" type="range" :min="minHoyde" :max="maksHoyde" step="1"
           :value="Math.round(h)" @input="settHoyde" class="usynlig-skyv blikk-skyv"
           aria-label="Blikkets høyde over horisonten"
           :aria-valuetext="`${Math.round(h)} grader`"/>
  </div>
</template>

<style scoped>
.rose {
  position: relative;
  width: 4.75rem;
  height: 4.75rem;
  cursor: grab;
  touch-action: none;
  color: var(--rose-farge, currentColor);
}
.rose:active { cursor: grabbing; }
.rose:focus-within {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
  border-radius: 9999px;
}
.usynlig-skyv {
  position: absolute;
  inset: 25% 0 auto 0;
  width: 100%;
  opacity: 0;
  /* Draget hører til rosa. Uten dette ville en gjennomsiktig skyv oppå puten
     spist hvert eneste peker-trykk. */
  pointer-events: none;
  margin: 0;
}
.flate { fill: color-mix(in srgb, currentColor 8%, transparent); stroke: currentColor; stroke-opacity: 0.3; stroke-width: 1.5; }
.horisont { fill: none; stroke: currentColor; stroke-opacity: 0.45; stroke-width: 1; stroke-dasharray: 3 3; }
.tick { stroke: currentColor; stroke-opacity: 0.7; stroke-width: 2; stroke-linecap: round; }
.tick.nord { stroke: #ef4444; stroke-opacity: 0.95; }
.bokstav {
  fill: currentColor; fill-opacity: 0.92; font-size: 15px; font-weight: 700;
  text-anchor: middle; dominant-baseline: middle;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.bokstav.nord { fill: #ef4444; fill-opacity: 0.9; }
.naal { fill: #ef4444; fill-opacity: 0.85; }
.puck-glow { fill: #38bdf8; fill-opacity: 0.25; }
.puck { fill: #38bdf8; stroke: #fff; stroke-width: 1.2; stroke-opacity: 0.75; }
/* Rødt lys ødelegger mørkeadaptasjonen minst — samme regel som himmelkompasset. */
.natt { color: #fca5a5; }
.natt .puck { fill: #ff6b5a; stroke-opacity: 0.4; }
.natt .puck-glow { fill: #ff6b5a; }
</style>
