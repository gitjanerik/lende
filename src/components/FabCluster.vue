<script setup>
// Lende-knappen som ett anker for kart-knottene (v4.8.2 — trukket ut av
// MapView, der klyngen bodde inline siden v4.3.1).
//
// Én knapp, ett gestespråk, overalt:
//   tap        = vis/skjul knottene (eller åpne chatten der det ikke er noen)
//   lang-trykk = Lende-chat (kun med invitasjonstoken)
//
// Knottene ligger BAK ankeret (z-0 mot z-10) og springer ut med gummibånd-
// animasjon. Plassene betyr klasse av ting, ikke fast inventar: nord = «legg
// kartet der jeg trenger det», nordvest = «hva kartet tegner», vest =
// «hvordan kartet ser ut». Derfor kan turkart ha tre og planleggeren to uten
// at mental-modellen brekker.
import { computed, ref, watch } from 'vue'
import { useLongPress } from '../composables/useLongPress.js'

const HOLD_MS = 600

// Lang-trykk er ellers en usynlig gest. Første gang en invitert bruker åpner
// klyngen, sier hint-boblen hva holdet gjør — én gang, så aldri mer. Egen
// nøkkel: lende-info-longpress-tip-seen gater en ANNEN tips-tekst, nådd via en
// annen vei, og å slå dem sammen ville stilnet den ene.
const HOLD_TIP_KEY = 'lende-fab-hold-tips-vist'

const props = defineProps({
  /** [{ key, slot: 'n'|'nw'|'w', label, dimmed?, hasPanel? }] — tom = ren chat-FAB. */
  satellites: { type: Array, default: () => [] },
  /** Har brukeren invitasjonstoken? Styrer hold-gesten OG hold-ringen. */
  chatEnabled: { type: Boolean, default: false },
  /** bottom-verdi fra useFloatAboveSheets. Default = fast nederst med safe-area. */
  bottom: { type: String, default: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' },
  /** { right: '12px' } — eller floatRightStyle på desktop. */
  rightStyle: { type: Object, default: () => ({ right: '12px' }) },
  positioning: { type: String, default: 'absolute' },  // 'absolute' | 'fixed'
  /** Transient hint-boble til venstre for klyngen. */
  hint: { type: String, default: '' },
  hidden: { type: Boolean, default: false },
  logoUrl: { type: String, required: true },
})

const emit = defineEmits(['tap', 'hold', 'chat'])
const open = defineModel('open', { type: Boolean, default: false })

// Én knott-plass = ett fast offset. Samme geometri i alle visninger.
const SLOT_OFFSETS = {
  n:  { '--sat-x': '0px',   '--sat-y': '-64px' },
  nw: { '--sat-x': '-45px', '--sat-y': '-45px' },
  w:  { '--sat-x': '-64px', '--sat-y': '0px'   },
}

function satStyle(sat) {
  return { ...SLOT_OFFSETS[sat.slot], '--sat-opacity': sat.dimmed ? '0.4' : null }
}

// Bare én peker er i spill av gangen, så knottene deler ett long-press-objekt
// og sporer hvilken knott trykket gjelder. Slipper å lage en composable per
// knott under render.
const activeSat = ref(null)
const satPress = useLongPress({
  holdMs: HOLD_MS,
  armed: () => !!activeSat.value?.hasPanel,
  onTap: () => { if (activeSat.value) emit('tap', activeSat.value.key) },
  onHold: () => {
    if (!activeSat.value) return
    open.value = false
    emit('hold', activeSat.value.key)
  },
})
function satDown(sat, e) {
  activeSat.value = sat
  satPress.onPointerDown(e)
}

const hasSatellites = computed(() => props.satellites.length > 0)

const anchorPress = useLongPress({
  holdMs: HOLD_MS,
  armed: () => props.chatEnabled,
  onTap: () => {
    // Uten knotter er ankeret ren chat-inngang: tap og hold gir samme
    // resultat, så den innlærte gesten aldri stopper i en blindgate.
    if (hasSatellites.value) open.value = !open.value
    else emit('chat')
  },
  onHold: () => {
    open.value = false
    emit('chat')
  },
})

let holdTipSeen = true
try { holdTipSeen = localStorage.getItem(HOLD_TIP_KEY) === '1' } catch { /* noop */ }
const coachHint = ref('')
let coachTimer = null
watch(open, (isOpen) => {
  if (!isOpen || !props.chatEnabled || holdTipSeen) return
  holdTipSeen = true
  try { localStorage.setItem(HOLD_TIP_KEY, '1') } catch { /* noop */ }
  coachHint.value = 'Hold inne for å spørre Lende'
  if (coachTimer) clearTimeout(coachTimer)
  coachTimer = setTimeout(() => { coachHint.value = '' }, 4000)
})

// Forelderens hint har forkjørsrett — det svarer på noe brukeren nettopp gjorde.
// Det avlyser samtidig coach marken for godt, så den ikke dukker opp igjen når
// det andre hintet utløper.
watch(() => props.hint, (h) => {
  if (!h || !coachHint.value) return
  if (coachTimer) clearTimeout(coachTimer)
  coachHint.value = ''
})
const shownHint = computed(() => props.hint || coachHint.value)

const anchorLabel = computed(() => {
  if (!hasSatellites.value) return 'Spør Lende'
  const base = `Lende — ${open.value ? 'skjul' : 'vis'} kartknappene.`
  return props.chatEnabled ? `${base} Hold inne for å spørre Lende.` : base
})

// Høyreklikk/Shift+F10/Menu-tasten er lang-trykkets tastatur- og mus-ekvivalent.
// .prevent står ubetinget i templaten (nettleserens «Kopier bilde» skal aldri
// opp på logoen); !hasTouch hindrer dobbelt-fyring på touch, der lang-trykk
// sender contextmenu ETTER at hold-timeren alt har åpnet chatten.
const hasTouch = typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0)
function onAnchorContextMenu() {
  if (!hasTouch && props.chatEnabled) emit('chat')
}

// Ring rundt ankeret som fyller seg over holdMs. Gjør lang-trykk selv-
// forklarende der det finnes, og svarer på «registrerte den?». Rendres kun
// mens timeren faktisk er armert, så uinviterte ser den aldri og funksjonen
// lekker ikke.
const RING_R = 22
const RING_C = 2 * Math.PI * RING_R
const ringOffset = computed(() => RING_C * (1 - anchorPress.holdProgress.value))
</script>

<template>
  <div v-if="!hidden"
       class="w-12 h-12 pointer-events-auto select-none transition-[bottom,right] duration-200"
       :class="positioning === 'fixed' ? 'fixed z-[60]' : 'absolute z-40'"
       :style="{ ...rightStyle, bottom }">

    <!-- Transient hint-boble — til venstre for vest-knotten når klyngen er
         åpen, ellers tett inntil ankeret. aria-live så knott-hakk annonseres. -->
    <Transition name="hint-fade">
      <div v-if="shownHint" role="status" aria-live="polite"
           class="absolute top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg
                  bg-overlay/95 text-ink text-[11px] font-medium leading-tight shadow-lg
                  whitespace-nowrap pointer-events-none border border-ink/10"
           :style="{ right: open ? 'calc(100% + 4.75rem)' : 'calc(100% + 0.5rem)' }">
        {{ shownHint }}
      </div>
    </Transition>

    <div id="lende-fab-knotter">
      <!-- Pointer-events (ikke @click) så et lang-trykk ikke også utløser
           tap-handlingen ved release — settled-vakten i useLongPress. -->
      <button v-for="sat in satellites" :key="sat.key"
              @pointerdown="satDown(sat, $event)"
              @pointermove="satPress.onPointerMove($event)"
              @pointerup="satPress.onPointerUp()"
              @pointercancel="satPress.onPointerCancel()"
              :aria-label="sat.label"
              :aria-hidden="!open" :tabindex="open ? 0 : -1"
              class="fab-sat w-12 h-12 rounded-full bg-overlay text-ink shadow-lg touch-none
                     flex items-center justify-center"
              :class="open ? 'fab-sat-open' : ''"
              :style="satStyle(sat)">
        <slot :name="sat.key" v-bind="sat" />
      </button>
    </div>

    <!-- Ankeret: Lende-logoen, synlig for alle brukere. Ligger over knottene
         (z-10) så de visuelt springer ut bakfra. contextmenu.prevent +
         pekerdød/callout-fri img: lang-trykk er en app-gest (chat) — «Kopier
         bilde» skal aldri opp. Mister du én av de tre, er den tilbake. -->
    <button @pointerdown="anchorPress.onPointerDown($event)"
            @pointermove="anchorPress.onPointerMove($event)"
            @pointerup="anchorPress.onPointerUp()"
            @pointercancel="anchorPress.onPointerCancel()"
            @contextmenu.prevent="onAnchorContextMenu"
            :aria-label="anchorLabel"
            :aria-expanded="hasSatellites ? open : undefined"
            :aria-controls="hasSatellites ? 'lende-fab-knotter' : undefined"
            class="relative z-10 w-12 h-12 rounded-full overflow-hidden bg-overlay
                   shadow-lg ring-1 ring-ink/15 touch-none active:scale-95 transition">
      <img :src="logoUrl" alt="" draggable="false"
           class="w-full h-full pointer-events-none select-none [-webkit-touch-callout:none]" />
      <svg v-if="anchorPress.isHolding.value" viewBox="0 0 48 48"
           class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <circle cx="24" cy="24" :r="RING_R" fill="none" stroke="#ffd84a" stroke-width="3"
                stroke-linecap="round" :stroke-dasharray="RING_C"
                :stroke-dashoffset="ringOffset" transform="rotate(-90 24 24)"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
/* FAB-klynge: knottene springer ut fra Lende-ankeret med gummibånd-animasjon
   (overshoot-bezier). translate/scale som egne CSS-properties (ikke transform)
   så ikonenes inline-transform og Tailwind-utilities ikke kolliderer. Lukket:
   stablet bak ankeret, usynlig og pekerdød. --sat-opacity dimmer en knott som
   er tilgjengelig men uten effekt akkurat nå. */
.fab-sat {
  position: absolute;
  inset: 0;
  opacity: 0;
  translate: 0 0;
  scale: 0.4;
  pointer-events: none;
  transition: translate 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              scale 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.15s ease;
}
.fab-sat-open {
  opacity: var(--sat-opacity, 1);
  translate: var(--sat-x) var(--sat-y);
  scale: 1;
  pointer-events: auto;
}
.fab-sat-open:active { scale: 0.92; }
.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.18s ease; }
.hint-fade-enter-from, .hint-fade-leave-to       { opacity: 0; }
</style>
