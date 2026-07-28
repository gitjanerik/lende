<script setup>
import { ref, onBeforeUnmount } from 'vue'

// Kanthåndtak — de 8 runde knappene på kartarkets kant som henter nye kartfliser
// (v2.4.13, erstatter kompassrosene i kart-rommet). Rent presentasjonslag:
// geometrien (posisjon, pil-vinkel, pille-forskyvning, «+N») kommer ferdig
// regnet fra useMapExtend.
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

const props = defineProps({
  handles: { type: Array, default: () => [] },   // { dir, name, count, x, y, knobDeg, lx, ly }
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
            :class="{ 'is-on': props.hovered === h.dir }"
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
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 19V5M6 11l6-6 6 6" />
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
/* 48 px treffområde (hansker), 38 px synlig knapp — sentrert på ankeret. */
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

.edge-knob {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.42);
  display: grid;
  place-items: center;
  transform: rotate(var(--knob-deg, 0deg)) scale(1);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1), background 0.2s, box-shadow 0.2s;
}
.edge-handle.is-on .edge-knob {
  background: rgba(12, 14, 10, 0.72);
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.55);
  transform: rotate(var(--knob-deg, 0deg)) scale(1.3);
}
/* Pila skal være lesbar også over lyse kartflater (åpent vann, dyrket mark). */
.edge-knob svg { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)); }

.edge-label {
  position: absolute;
  left: 50%;
  top: 50%;
  background: rgba(12, 14, 10, 0.9);
  color: #ede9dc;
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
.edge-count { color: #ffffff; font-weight: 700; }

@media (prefers-reduced-motion: reduce) {
  .edge-knob { transition: none; }
}
</style>
