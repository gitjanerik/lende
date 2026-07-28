<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Kanthåndtak — de 8 runde knappene på kartarkets kant som henter nye kartfliser
// (v2.4.13, erstatter kompassrosene i kart-rommet). Rent presentasjonslag:
// geometrien (posisjon, pil-vinkel, pille-forskyvning, «+N») kommer ferdig
// regnet fra useMapExtend.
//
// Overlayet er søsken av det transformerte kart-divet, så knapp, hårlinje og
// pille holder EKSAKT skjermstørrelse uansett zoom — men ankeret følger arket.
// Sitter håndtaket utenfor viewporten (zoomet langt inn) er det klippet bort;
// det er meningen — håndtakene hører til arkkanten, ikke skjermkanten.

const props = defineProps({
  handles: { type: Array, default: () => [] },       // { dir, name, count, x, y, knobDeg, lx, ly }
  previewCells: { type: Array, default: () => [] },  // { key, x, y, w, h, rot }
  hovered: { type: String, default: null },
})
const emit = defineEmits(['preview', 'clear', 'commit'])

// Trykk-og-hold på touch: hold for å se forhåndsvisningen, slipp for å hente.
// Et rent tapp går rett til commit (holdet rekker ikke å fyre). pointerenter
// er upålitelig på touch — derfor egen holde-timer, og musepekeren bruker
// pointerenter.
const HOLD_MS = 220
let holdTimer = null
const holdingDir = ref(null)

// Håndtakene sitter PÅ arket, og forhåndsvisningen skalerer arket ned — så
// knappen flytter seg vekk under en helt stillestående peker, og tilbake igjen
// når visningen ryddes. Nettleseren fyrer pointerenter/-leave på slike
// layout-flyttinger, og en naiv hover-håndtering blinker derfor i en løkke:
// leave → arket tilbake → enter → arket ned → leave … Vi krever i stedet EKTE
// peker-bevegelse i begge retninger, målt mot én passiv window-lytter.
const MOVE_SLACK = 24   // px pekeren kan skli uten at visningen ryddes
const RECT_PAD = 8      // slakk rundt håndtakets treffområde
const overlayRef = ref(null)
let previewOrigin = null
let lastPos = null      // sist SETTE peker-posisjon (fra en ekte pointermove)

function clearHold() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
  holdingDir.value = null
}
onMounted(() => window.addEventListener('pointermove', onWindowMove, { passive: true }))
onBeforeUnmount(() => {
  clearHold()
  window.removeEventListener('pointermove', onWindowMove)
})

function onWindowMove(ev) {
  lastPos = { x: ev.clientX, y: ev.clientY }
  const dir = props.hovered
  if (!dir) return
  if (previewOrigin && Math.hypot(ev.clientX - previewOrigin.x, ev.clientY - previewOrigin.y) <= MOVE_SLACK) return
  const el = overlayRef.value?.querySelector(`[data-edge-dir="${dir}"]`)
  if (!el) return
  const r = el.getBoundingClientRect()
  const inside = ev.clientX >= r.left - RECT_PAD && ev.clientX <= r.right + RECT_PAD
              && ev.clientY >= r.top - RECT_PAD && ev.clientY <= r.bottom + RECT_PAD
  if (!inside) { clearHold(); previewOrigin = null; emit('clear') }
}

function startPreview(h, ev) {
  previewOrigin = ev ? { x: ev.clientX, y: ev.clientY } : null
  emit('preview', h.dir)
}
function onEnter(h, ev) {
  if (ev.pointerType && ev.pointerType !== 'mouse') return
  // Flyttet PEKEREN seg inn på knappen, eller kom knappen glidende inn under en
  // stillestående peker (arket som skalerer tilbake)? I det andre tilfellet er
  // koordinatene identiske med siste registrerte bevegelse — og da har brukeren
  // ikke bedt om noen forhåndsvisning.
  if (lastPos && lastPos.x === ev.clientX && lastPos.y === ev.clientY) return
  startPreview(h, ev)
}
function onDown(h, ev) {
  // Kartet under lytter på pointerdown for long-press-menyen; håndtaket eier
  // trykket sitt selv.
  ev.stopPropagation()
  if (ev.pointerType === 'mouse') return
  clearHold()
  holdingDir.value = h.dir
  const at = { x: ev.clientX, y: ev.clientY }
  holdTimer = setTimeout(() => {
    holdTimer = null
    if (holdingDir.value === h.dir) { previewOrigin = at; emit('preview', h.dir) }
  }, HOLD_MS)
}
// Tastatur-fokus viser samme forhåndsvisning. :focus-visible skiller ekte
// tastatur-fokus fra fokuset et museklikk gir — uten det ville hver klikk-
// commit blitt etterfulgt av en ny forhåndsvisning på knappen man nettopp brukte.
function onFocus(h, ev) {
  if (ev.target?.matches?.(':focus-visible')) startPreview(h, null)
}
function onBlur() {
  clearHold()
  previewOrigin = null
  emit('clear')
}
function onCancel() {
  clearHold()
  previewOrigin = null
  emit('clear')
}
function onClick(h, ev) {
  ev.stopPropagation()
  clearHold()
  previewOrigin = null
  emit('commit', h.dir)
}
</script>

<template>
  <div ref="overlayRef" class="absolute inset-0 z-[7] pointer-events-none overflow-hidden">
    <!-- Spøkelsesceller: én per flis trykket vil hente, på sin gitter-plass.
         Rotert om topp-venstre så de flukter med arket når kartet er rotert. -->
    <div v-for="c in props.previewCells" :key="c.key" class="edge-ghost"
         :style="{ left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px',
                   transform: `rotate(${c.rot}deg)` }" />

    <button v-for="h in props.handles" :key="h.dir" type="button"
            class="edge-handle pointer-events-auto"
            :class="{ 'is-on': props.hovered === h.dir }"
            :style="{ left: h.x + 'px', top: h.y + 'px' }"
            :data-edge-dir="h.dir"
            :aria-label="`Hent kartfliser mot ${h.name}`"
            @pointerenter="onEnter(h, $event)"
            @pointerdown="onDown(h, $event)"
            @pointercancel="onCancel"
            @focus="onFocus(h, $event)"
            @blur="onBlur"
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
.edge-ghost {
  position: absolute;
  transform-origin: 0 0;
  border: 1.5px dashed rgba(255, 255, 255, 0.9);
  background: rgba(24, 28, 20, 0.42);
  animation: edge-ghost-pulse 1.4s ease-in-out infinite;
}
@keyframes edge-ghost-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.85; }
}

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
  .edge-ghost { animation: none; opacity: 0.7; }
  .edge-knob { transition: none; }
}
</style>
