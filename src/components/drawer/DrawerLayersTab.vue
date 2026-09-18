<script setup>
// Drawer-fane «Detaljer», skilt ut fra MapView v1.0.8. Enkeltlag-toggles +
// sjø/padling-gruppe. Lag-tilstanden eies av forelderen; handlinger kommer
// inn som funksjons-props så template-kroppen er uendret.
//
// v5.23.0: forhåndsvalg-raden er flyttet til Kartstil-fanen. Den satte bare
// lag-synlighet og endret ikke ett piksel-uttrykk — nå velger man en kartstil
// som også bytter palett, strek og sti-farger, og finjusterer her etterpå.
//
// HVERT LAG BÆRER ET TALL FRA v7.8.35, OG DET ER EN LESEHJELP OG IKKE PYNT.
// Fana var en liste brytere uten tall: slo man av «Holdeplass» og ingenting
// endret seg, var det to helt ulike ting som så identiske ut — laget er tomt
// her, eller bryteren virker ikke. Tallet svarer på det, og det svarer
// samtidig på spørsmålet man egentlig har på et ukjent ark: hva ER det her?
//
// TRE UTFALL, TRE TEGN, og konvensjonen er kulturminne-lagets fra v4.8.6 —
// den ble innført for å rette en ekte lesefeil, der «tjenesten svarte, og her
// er det ingenting» og «vi vet ikke ennå» begge var «(0)» og derfor leste som
// at funksjonen var borte. Se `lib/lagTelling.js` for hvorfor tallet kommer
// fra BYGGEREN og ikke fra en telling av elementer i SVG-en.
//
// TRE LAG FÅR TALLET FRA ET ANNET STED enn arket, fordi de ikke ligger i
// arket: kulturminner, arkeologiske kulturminner og vannmålestasjoner hentes
// live og har hatt sitt eget tall i tre år. De mates av forelderen gjennom
// sine egne props.
//
// OG ÅTTE LAG VISER IKKE TALL I DET HELE TATT — `UTEN_TELLING`, se
// `lib/lagTelling.js` for hvilke og hvorfor. Kort: sti, høydekurver og navn er
// på hvert ark i tusener, så tallet svarer ikke på noe, og tre firesifrede tall
// øverst i lista trekker øyet vekk fra de lagene tallet faktisk betyr noe for.
import { computed } from 'vue'
import { tellingMerke, UTEN_TELLING } from '../../lib/lagTelling.js'

const props = defineProps({
  resetLayers: { type: Function, required: true },
  layersDirty: { type: Boolean, default: false },
  landLayerButtons: { type: Array, default: () => [] },
  marineLayerButtons: { type: Array, default: () => [] },
  toggleLayer: { type: Function, required: true },
  toggleDepth: { type: Function, required: true },
  visibleLayers: { type: Object, required: true },   // Set
  // Antall kartobjekter per lag, bakt i arkets data-meta (meta.lagTellinger).
  // null = kart bygget før v7.8.35; da vet vi ingenting og viser «(–)».
  lagTellinger: { type: Object, default: null },
  // GPS-spor er brukerens eget og ligger ikke i arket.
  sporCount: { type: Number, default: null },
  // null = vet ikke ennå (ingen innbakte ikoner, live-hentingen har ikke svart).
  kulturminneCount: { type: Number, default: null },
  kulturminneStatus: { type: String, default: 'ukjent' },   // 'ukjent' | 'ok' | 'feilet'
  fredetLoading: { type: Boolean, default: false },
  fredetCount: { type: Number, default: null },
  hydroLoading: { type: Boolean, default: false },
  hydroCount: { type: Number, default: null },
  meta: { type: Object, default: null },
})

// Lagene som har sin EGEN kilde til tallet, og som derfor ikke skal leses av
// arket. Lista er her og ikke i `lagTelling.js` med vilje: den handler om hvem
// som MATER denne komponenten, ikke om hva et ark inneholder.
const EGEN_KILDE = new Set(['kulturminne', 'fredet-kulturminne', 'vannstasjon', 'spor'])

/**
 * Hva «(…)»-merket skal si og se ut som for ett lag.
 *
 * ÉN funksjon og ikke fire v-if-grener i malen: fram til v7.8.35 hadde tre lag
 * hver sin `<span>` med sin egen farge-logikk inline, og et fjerde lag ville
 * vært en fjerde. Nå er forskjellen mellom dem DATA — hvor tallet kommer fra —
 * og ikke markup.
 *
 * @param {string} key lag-nøkkel
 * @returns {{ tekst: string, tone: string, tittel: string }|null} null = laget
 *   skal ikke ha noe merke
 */
function merkeFor(key) {
  if (UTEN_TELLING.has(key)) return null
  // Kulturminner: tre utfall der hentingen også kan FEILE, som er et fjerde
  // svar ingen av de andre lagene kan gi.
  if (key === 'kulturminne') {
    if (props.kulturminneStatus === 'feilet') {
      return {
        tekst: '(!)',
        tone: 'text-amber-300/90',
        tittel: 'Kunne ikke hente kulturminner — sjekk nettforbindelsen',
      }
    }
    return tall(props.kulturminneCount, 'kulturminner i dette utsnittet')
  }
  if (key === 'fredet-kulturminne') {
    if (props.fredetLoading) return laster()
    return tall(props.fredetCount, 'arkeologiske kulturminner i dette utsnittet')
  }
  if (key === 'vannstasjon') {
    if (props.hydroLoading) return laster()
    return tall(props.hydroCount, 'vannmålestasjoner i dette utsnittet', 'text-sky-300/80')
  }
  if (key === 'spor') return tall(props.sporCount, 'GPS-spor lagret på dette kartet')
  return tall(props.lagTellinger?.[key], 'objekter i dette laget')
}

const laster = () => ({ tekst: '…', tone: 'text-ink-4', tittel: 'Henter …' })

function tall(n, hva, paaTone = 'text-emerald-300/80') {
  const kjent = Number.isFinite(n)
  return {
    tekst: tellingMerke(n),
    tone: kjent && n > 0 ? paaTone : 'text-ink-4',
    tittel: !kjent
      ? 'Ikke hentet ennå — bygg kartet om for å få tallet'
      : n === 0
        ? `Ingen ${hva}`
        : `${n} ${hva}`,
  }
}

const alleLag = computed(() => [...props.landLayerButtons, ...props.marineLayerButtons])

// Ett oppslag per lag og ikke tre kall per knapp: malen trenger tekst, tone OG
// setning, og `merkeFor(key)` tre steder i samme `<button>` er førti lag ×
// tre = hundre og tjue kall for hver render av fana.
const merker = computed(() => {
  const ut = {}
  for (const l of alleLag.value) {
    const m = merkeFor(l.key)
    if (m) ut[l.key] = m
  }
  return ut
})

// Er tallet i det hele tatt kjent for noe lag? På et kart bygget før
// tellingen fantes er svaret nei for alt unntatt de fire med egen kilde, og da
// står det en linje under lista som sier HVA «(–)» betyr. Uten den er tegnet
// bare støy gjentatt førti ganger.
const noeUkjent = computed(() =>
  alleLag.value.some((l) => !EGEN_KILDE.has(l.key) && !UTEN_TELLING.has(l.key)
    && !Number.isFinite(props.lagTellinger?.[l.key])))
</script>

<template>
  <div>
    <div class="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
      Enkeltlag
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <!-- Knapp #1: Nullstill lag-synlighet. Default disabled; blir
           aktiv først når minst ett lag avviker fra default-tilstand. -->
      <button @click="resetLayers"
              :disabled="!layersDirty"
              class="px-3 py-2 rounded-lg border text-left transition"
              :class="layersDirty
                      ? 'bg-amber-400/20 border-amber-300/50 text-ink active:scale-[0.98]'
                      : 'bg-ink/5 border-ink/5 text-ink-4 cursor-default'">
        <span class="text-[12px]">↺ Nullstill</span>
      </button>
      <button v-for="lay in landLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              :aria-pressed="visibleLayers.has(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-slate-400/25 border-slate-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink-4'">
        <span class="text-[12px]">{{ lay.label }}</span>
        <!-- TEGNET ER FOR ØYET, SETNINGEN FOR SKJERMLESEREN. «(84)» opplest
             blir «parentes åttifire parentes», og «(!)» blir «utropstegn» —
             begge uten å si hva tallet gjelder. Tegnet er derfor
             `aria-hidden`, og den samme setningen musa får i `title` ligger
             som `sr-only` inne i knappen, så etiketten leses «Sti, 84
             objekter i dette laget». -->
        <template v-if="merker[lay.key]">
          <span class="ml-1 text-[10px] tabular-nums" aria-hidden="true"
                :class="merker[lay.key].tone"
                :title="merker[lay.key].tittel">{{ merker[lay.key].tekst }}</span>
          <span class="sr-only">, {{ merker[lay.key].tittel }}</span>
        </template>
      </button>
    </div>
    <!-- Gruppert seksjon: Sjø & padling -->
    <div class="mt-3 mb-1 text-[11px] font-semibold text-sky-300/80 uppercase tracking-wide">
      Sjø &amp; padling
    </div>
    <div class="grid grid-cols-2 gap-2 mb-1">
      <button v-for="lay in marineLayerButtons" :key="lay.key"
              @click="toggleLayer(lay.key)"
              :aria-pressed="visibleLayers.has(lay.key)"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has(lay.key)
                      ? 'bg-sky-400/25 border-sky-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink-4'">
        <span class="text-[12px]">{{ lay.label }}</span>
        <template v-if="merker[lay.key]">
          <span class="ml-1 text-[10px] tabular-nums" aria-hidden="true"
                :class="merker[lay.key].tone"
                :title="merker[lay.key].tittel">{{ merker[lay.key].tekst }}</span>
          <span class="sr-only">, {{ merker[lay.key].tittel }}</span>
        </template>
      </button>
      <!-- Dybde-lag: kun når kartet har ekte Sjøkart-dybde. Default av —
           løfter soundings + dybdekurver fra long-press-inset til hovedkartet. -->
      <button v-if="meta?.depthSource === 'sjokart'"
              @click="toggleDepth()"
              class="px-3 py-2 rounded-lg border text-left active:scale-[0.98] transition"
              :class="visibleLayers.has('dybde')
                      ? 'bg-sky-400/25 border-sky-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink-4'">
        <span class="text-[12px]">Dybde (Sjøkart)</span>
      </button>
    </div>
    <div class="text-[10px] text-ink-4 leading-snug mb-2">
      Fyr, sjømerker, skjær, småbåthavner, landingssteder, toalett og
      drikkevann. «Sjønavn» viser geografiske navn i sjøen (bukt, vik,
      sund, nes, grunne, holme, skjær). Dybdetall vises ved å holde inne
      et punkt på kartet.
    </div>
    <!-- Hva tallet ER. Linja står alltid, for uten den er «(0)» og «(–)» to
         tegn man må gjette betydningen av — og forskjellen mellom dem er
         nettopp det fana finnes for å si. -->
    <div class="text-[10px] text-ink-4 leading-snug mb-2">
      Tallet bak hvert lag er antall kartobjekter på dette arket. «(0)» betyr at
      laget er tomt her.<span v-if="noeUkjent"> «(–)» betyr at arket ble bygget
      før tellingen fantes — bygg det om for å få tallene.</span>
    </div>
    <div class="text-[10px] text-ink-4 leading-snug mt-2">
      Reliefskygge er DEM-derivert hill-shading rendret som grayscale-
      PNG inne i SVG-en med <code>mix-blend-mode: multiply</code>.
    </div>
  </div>
</template>
