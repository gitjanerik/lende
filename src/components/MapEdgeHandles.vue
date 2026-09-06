<script setup>
import { ref, onBeforeUnmount } from 'vue'

// Kanthåndtak — de 8 vinklene på kartarkets kant som henter nye kartfliser
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
// v5.25.5 gjorde håndtaket til en likesidet trekant (26 px side) fylt i
// pil-grønn, og flyttet den UT av kartet: geometrien i useMapExtend skyver
// punktet halve trekant-høyden utover, så basen flukter med arkets ytterkant
// (kardinal) eller har midtpunktet i hjørnet (diagonal). Plasseringen står; det
// var fyllet som fortsatt leste som et objekt oppå kartet.
//
// v5.25.6: bare de TO sidene av trekanten som peker utover tegnes — en tykk
// vinkel («^») i blekkfargen, med runde ender og rund spiss. Basen er borte, og
// med den den siste flaten: figuren er strek, ikke form, og legger seg over
// kartet uten å dekke noe av det. Hjørnene har RETT vinkel og ikke 60°: dreid
// 45° blir beina parallelle med arkets to kanter, og merket leser som et
// hjørne-merke framfor en pil som tilfeldigvis står på skrå. Blekk framfor grønt fordi en fargeflekk uten
// flate under er den svakeste av begge verdener — den grønne trekanten trengte
// fyllet sitt for å lese som grønn. `--color-ink` snur med temaet (sort på
// papir, hvit i mørkt), så streken har alltid maks kontrast mot kartet under.
//
// Lesbarheten som glorien holdt oppe før, ligger nå i en myk skygge i MOTSATT
// tone (--color-overlay). Den er ikke en andre farge man ser; den er det som
// skiller en sort strek fra en sort stup-kant og en hvit strek fra en hvit
// kontur.
//
// Treffområdet er fortsatt 48 px og ligger sentrert på det samme punktet —
// halve boksen dekker altså kartet innenfor kanten. Det er med vilje: fingeren
// skal treffe der brukeren sikter, og en 26 px vinkel er for liten å sikte på
// med hansker.
//
// v6.5.60: MERKET ER ET KOMPASS, ikke et arkmerke — og det gjør deler av
// begrunnelsen over til historie. Arket står i hvile på sann nord (v6.5.59),
// altså litt på skrå på skjermen, og `knobDeg` trekker den korreksjonen fra så
// «Nord i lende» peker rett opp. Følgen er at BASEN IKKE LENGER FLUKTER med
// arkets ytterkant, og at hjørnemerkets bein ikke lenger er parallelle med
// arkets to kanter: begge sto det som en grunn til geometrien, og begge er nå
// betalt for bevisst. Til gjengjeld er merkene skjerm-rette på et ark i hvile,
// akkurat som de var før nord-korreksjonen fantes. ANKERET og UTSTIKKET følger
// fortsatt arkkanten — det er `knobDeg` alene som er kompass.
//
// `h.dokket` skiller de to plasseringene useMapExtend leverer — dokket til den
// trygge rammen (kort avslørings-vindu) eller på selve arkkanten (brukeren har
// panorert dit). Bare de dokkede fades inn; de på arkkanten glir inn med kartet
// og skal ikke dobbelt-animeres.

const props = defineProps({
  handles: { type: Array, default: () => [] },   // { dir, name, count, x, y, knobDeg, lx, ly, dokket, hjorne }
  hovered: { type: String, default: null },
  // KARTETS tema, ikke app-chromets. Streken ligger oppå kart-SVG-en, og
  // turkart/print/padling er lyse kart også når app-chromet står mørkt — så
  // --color-ink ville gitt hvit strek på papir. Se MapView-kallstedet.
  isDark: { type: Boolean, default: false },
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
            :class="{ 'is-on': props.hovered === h.dir, 'is-dokket': h.dokket, 'er-morkt': props.isDark }"
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
        <!-- De to sidene som peker utover, som én åpen linje: fra venstre
             endepunkt, opp i spissen, ned til høyre. Ingen Z — grunnlinja skal
             ikke tegnes. To varianter, og forskjellen er vinkelen i spissen:

             LANGSIDE (60°, likesidet, side 26): spissen 2,74 px fra toppen,
             endepunktene 25,26 px ned. Boksens senter ligger på håndtakets
             punkt, halve trekant-høyden utenfor arkkanten, så endepunktene
             lander PÅ kanten og figuren flukter med den.

             HJØRNE (90°, bein 19): en rett vinkel dreid 45° får beina
             parallelle med arkets to kanter — et hjørne-merke, ikke en pil på
             skrå. Spissen ligger 6,72 px over boksens senter, altså ~3,2 px
             utenfor selve hjørnepunktet, og beina løper da like langt utenfor
             hver av de to kantene. Samme utstikk som langsidene bruker, ingen
             egen geometri. -->
        <svg class="edge-tri" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
          <path v-if="h.hjorne" d="M0.56 20.72 14 7.28 27.44 20.72" />
          <path v-else d="M1 25.26 14 2.74 27 25.26" />
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
/* 48 px treffområde (hansker), 26 px synlig vinkel — begge sentrert på
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

/* Vinkelen roterer om sitt EGET senter, som er håndtakets punkt. Boksen er like
   stor som trekantens (28 px), så rotasjonen ikke flytter tyngdepunktet. */
.edge-knob {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  transform: rotate(var(--knob-deg, 0deg)) scale(1);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1);
}
.edge-handle.is-on .edge-knob { transform: rotate(var(--knob-deg, 0deg)) scale(1.22); }

/* Tykk vinkel i kartets blekkfarge. `fill: none` er det som gjør trekanten til
   to streker: uten den ville browseren lukket figuren med et fyll, og basen
   vært tilbake i praksis.
   Standard er SORT strek med lys glorie — lyse kart (turkart, print, padling,
   light) er normalen. `.er-morkt` snur begge for nattkartet. Glorien er
   lesbarhet, ikke pynt: en sort strek forsvinner i en stup-kant og en hvit i en
   kontur uten den. Den er myk og halvgjennomsiktig, så den leses som luft rundt
   streken og ikke som en andre farge. */
.edge-tri { display: block; overflow: visible; }
.edge-tri path {
  fill: none;
  stroke: #14110d;
  stroke-width: 4.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter:
    drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.85))
    drop-shadow(0 1px 3px rgba(255, 255, 255, 0.55));
  transition: stroke-width 0.2s;
}
.edge-handle.er-morkt .edge-tri path {
  stroke: #ffffff;
  filter:
    drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.85))
    drop-shadow(0 1px 3px rgba(0, 0, 0, 0.55));
}
.edge-handle.is-on .edge-tri path { stroke-width: 5.2; }

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
