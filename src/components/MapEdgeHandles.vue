<script setup>
import { ref, onBeforeUnmount } from 'vue'

// Kanthåndtak — de 8 trekantene på kartarkets kant som henter nye kartfliser
// (v2.4.13, erstatter kompassrosene i kart-rommet; runde knapper til v5.25.5).
// Rent presentasjonslag: geometrien (posisjon, retnings-vinkel,
// pille-forskyvning, «+N») kommer ferdig regnet fra useMapExtend.
//
// Overlayet er søsken av det transformerte kart-divet, så knapp, hårlinje og
// pille holder EKSAKT skjermstørrelse uansett zoom — men ankeret følger arket.
// Sitter håndtaket utenfor viewporten (zoomet langt inn) er det klippet bort;
// det er meningen — håndtakene hører til arkkanten, ikke skjermkanten.
//
// v2.4.14: forhåndsvisningen rører ikke kartflaten i det hele tatt. Den
// skalerte tidligere arket ned og tegnet mørkegrå spøkelsesceller for flisene
// som kom; begge er borte (se useMapExtend for hvorfor). Igjen står knappen som
// vokser og pilla med retningsnavn + kostnad.
//
// v5.25.2 ga knappen en flate å stå på — halvgjennomsiktig temafarge med
// backdrop-blur — fordi kart-SVG-en har for mye kontrast (svarte stup, hvite
// konturer, blått vann) for en ren kontur-knapp: ringen forsvant i konturene og
// pila i vannet. Flaten løste lesbarheten, men åtte 38 px mørke skiver oppå
// arket dominerte kartet de skulle ramme inn.
//
// v5.25.5: håndtaket ER en likesidet trekant, ikke en pil i en skive. Trekanten
// er mindre enn skiven var (26 px side), fylt i pil-grønn med en tynn glorie i
// temafargen — den samme lesbarheten som flaten ga, i en form som ikke tar
// plassen til en knapp. Og den står UTENFOR kartet: geometrien i useMapExtend
// skyver punktet halve trekant-høyden utover, så basen flukter med arkets
// ytterkant (kardinal) eller har midtpunktet i hjørnet (diagonal). Trekanten
// leser da som en kant-markør på arket framfor et objekt oppå det.
//
// Treffområdet er fortsatt 48 px og ligger sentrert på det samme punktet —
// halve boksen dekker altså kartet innenfor kanten. Det er med vilje: fingeren
// skal treffe der brukeren sikter, og en 26 px trekant er for liten å sikte på
// med hansker.
//
// `h.dokket` skiller de to plasseringene useMapExtend leverer — dokket til den
// trygge rammen (kort avslørings-vindu) eller på selve arkkanten (brukeren har
// panorert dit). Bare de dokkede fades inn; de på arkkanten glir inn med kartet
// og skal ikke dobbelt-animeres.

const props = defineProps({
  handles: { type: Array, default: () => [] },   // { dir, name, count, x, y, knobDeg, lx, ly, dokket }
  hovered: { type: String, default: null },
})
const emit = defineEmits(['preview', 'clear', 'commit'])

// Trykk-og-hold på touch: hold for å se navn og kostnad, slipp for å hente. Et
// rent tapp går rett til commit (holdet rekker ikke å fyre). pointerenter er
// upålitelig på touch — derfor egen holde-timer, og musepekeren bruker
// pointerenter/-leave.
const HOLD_MS = 220
let holdTimer = null
const holdingDir = ref(null)

function clearHold() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
  holdingDir.value = null
}
onBeforeUnmount(clearHold)

function onEnter(h, ev) {
  if (ev.pointerType && ev.pointerType !== 'mouse') return
  emit('preview', h.dir)
}
function onDown(h, ev) {
  // Kartet under lytter på pointerdown for long-press-menyen; håndtaket eier
  // trykket sitt selv.
  ev.stopPropagation()
  if (ev.pointerType === 'mouse') return
  clearHold()
  holdingDir.value = h.dir
  holdTimer = setTimeout(() => {
    holdTimer = null
    if (holdingDir.value === h.dir) emit('preview', h.dir)
  }, HOLD_MS)
}
function onLeave() {
  clearHold()
  emit('clear')
}
// Tastatur-fokus viser samme visning. :focus-visible skiller ekte tastatur-fokus
// fra fokuset et museklikk gir — uten det ville hver klikk-commit blitt etterfulgt
// av en ny visning på knappen man nettopp brukte.
function onFocus(h, ev) {
  if (ev.target?.matches?.(':focus-visible')) emit('preview', h.dir)
}
function onClick(h, ev) {
  ev.stopPropagation()
  clearHold()
  emit('commit', h.dir)
}
</script>

<template>
  <div class="absolute inset-0 z-[7] pointer-events-none overflow-hidden">
    <button v-for="h in props.handles" :key="h.dir" type="button"
            class="edge-handle pointer-events-auto"
            :class="{ 'is-on': props.hovered === h.dir, 'is-dokket': h.dokket }"
            :style="{ left: h.x + 'px', top: h.y + 'px' }"
            :aria-label="`Hent kartfliser mot ${h.name}`"
            @pointerenter="onEnter(h, $event)"
            @pointerleave="onLeave"
            @pointerdown="onDown(h, $event)"
            @pointercancel="onLeave"
            @focus="onFocus(h, $event)"
            @blur="onLeave"
            @click="onClick(h, $event)">
      <span class="edge-knob" :style="{ '--knob-deg': h.knobDeg + 'deg' }">
        <!-- Likesidet trekant, side 26 px, sentrert i en 28 px boks: spissen
             2,7 px fra toppen, basen 25,3 px ned. Boksens senter ligger på
             håndtakets punkt, og useMapExtend har alt skjøvet punktet halve
             høyden utover — derfor havner basen på arkkanten. -->
        <svg class="edge-tri" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <path d="M14 2.74 27 25.26 1 25.26 Z" />
        </svg>
      </span>
      <span class="edge-label"
            :style="{ transform: `translate(calc(-50% + ${h.lx}px), calc(-50% + ${h.ly}px))` }">
        {{ h.name }}<span class="edge-count"> +{{ h.count }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
/* 48 px treffområde (hansker), 26 px synlig trekant — begge sentrert på
   håndtakets punkt, som ligger halve trekant-høyden utenfor arkkanten. */
.edge-handle {
  position: absolute;
  width: 48px;
  height: 48px;
  margin: -24px 0 0 -24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: grid;
  place-items: center;
  -webkit-tap-highlight-color: transparent;
}
.edge-handle:focus { outline: none; }

/* Bare de DOKKEDE håndtakene fades inn. De som står på arkkanten er der fordi
   brukeren panorerte dit, og glir inn med kartet — en fade oppå den bevegelsen
   leses som flimmer. */
.edge-handle.is-dokket { animation: pil-inn 0.22s ease-out both; }
@keyframes pil-inn {
  from { opacity: 0; transform: scale(0.86); }
  to   { opacity: 1; transform: scale(1); }
}

/* Trekanten roterer om sitt EGET senter, som er håndtakets punkt. Boksen er
   like stor som trekantens (28 px), så rotasjonen ikke flytter tyngdepunktet. */
.edge-knob {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  transform: rotate(var(--knob-deg, 0deg)) scale(1);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.edge-handle.is-on .edge-knob { transform: rotate(var(--knob-deg, 0deg)) scale(1.22); }

/* Grønn fyll = «legg til», samme betydning som ellers i appen. Glorien er
   temafargen (--color-overlay, som snur i lyst tema) lagt UNDER fyllet med
   paint-order, så den ligger som en kant utenfor trekanten: det er den som gjør
   formen lesbar mot svarte stup og hvite konturer, samme jobb som den runde
   flaten gjorde før. Runde hjørner på glorien myker silhuetten. */
.edge-tri { display: block; overflow: visible; }
.edge-tri path {
  fill: var(--pil-farge);
  stroke: color-mix(in srgb, var(--color-overlay) 82%, transparent);
  stroke-width: 1.8;
  stroke-linejoin: round;
  paint-order: stroke;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.28));
  transition: fill 0.2s, stroke-width 0.2s;
}
.edge-handle.is-on .edge-tri path { stroke-width: 2.6; }

.edge-label {
  position: absolute;
  left: 50%;
  top: 50%;
  background: color-mix(in srgb, var(--color-overlay) 90%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-ink) 14%, transparent);
  color: var(--color-ink);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  padding: 5px 10px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s;
}
.edge-handle.is-on .edge-label { opacity: 1; }
.edge-count { color: var(--pil-farge); font-weight: 700; }

@media (prefers-reduced-motion: reduce) {
  .edge-knob, .edge-tri path { transition: none; }
  .edge-handle.is-dokket { animation: none; }
}
</style>
