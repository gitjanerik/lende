<script setup>
// Nordlyspanel i nattmodus: står det noe på himmelen i kveld, og kan man se det?
//
// SPEILBILDET AV VÆRRADEN, med vilje. Været er en dagting og ligger øverst i
// dagmodus; nordlyset er en nattting og ligger samme sted om natta. Samme
// pilleform, samme svarte bakgrunn med backdrop-blur, samme X helt til høyre med
// kilden ved siden av, samme «henter …»- og «ikke tilgjengelig»-linjer. En bruker
// som har lært seg den ene har lært seg den andre.
//
// ÉN FORSKJELL FRA VÆRRADEN, OG DEN ER BESTILT: nordlyset har ingen timer å
// rulle gjennom, så panelet er ETT tall med fire mindre under.
//
// AT DET DERFOR IKKE TRENGTE PLASS-MÅLING VAR FEIL, og det sto her til v6.5.54.
// Fire tall får plass på én linje ved vanlig tekst; ved 200 % gjør de det ikke.
// Se `stablet` under for hva som skjedde og hva som gjøres i stedet.
//
// TALLENE ER FIRE, og de er valgt fordi de svarer på fire ULIKE spørsmål:
//   sannsynlighet  ser jeg noe HER?           (OVATION, det eneste stedsspesifikke)
//   skydekke       er himmelen i veien?       (MET — vi har det allerede)
//   Kp             hvor uroligt er feltet?    (globalt, det folk kjenner)
//   solvind        hva er på vei?             (fart; Bz i tittelen)
// Uten skydekket ville panelet meldt «Sterk» gjennom et tett skylag og sendt folk
// ut i kulda for ingenting.
//
// TEKSTEN SIER AT DET ER ET VARSEL. OVATION-fila heter «latest», men bærer både
// Observation Time og Forecast Time, og de lå 67 minutter fra hverandre da det
// ble målt (probe-nordlys, 2026-08-31). Å presentere den som «nå» ville vært den
// ene feilen værvarselet lærte oss: at utdatert ser ut som sant.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { alderMinutter, seForhold } from '../../lib/nordlys.js'

const emit = defineEmits(['lukk'])

const props = defineProps({
  // { status: 'loading'|'done'|'error', ... } — samme form som vaer i 2D og 3D.
  nordlys: { type: Object, default: null },
  // Fra MET-varselet vi allerede henter for arket. Null = vi vet ikke, og da
  // sier panelet ingenting om skyer framfor å gjette.
  skydekke: { type: Number, default: null },
  erNatt: { type: Boolean, default: true },
  // Demoen i Utvikler-fanen skriver over tallene, og panelet skal SI det.
  demo: { type: String, default: '' },
})

const d = computed(() => props.nordlys ?? {})

const forhold = computed(() => seForhold({
  prosent: d.value.prosent ?? null,
  skydekke: props.skydekke,
  erNatt: props.erNatt,
}))

const prosentTekst = computed(() => (
  Number.isFinite(d.value.prosent) ? `${Math.round(d.value.prosent)} %` : '–'
))

// Fargen følger styrken, og den er den samme grønnfargen gardinene bruker
// (FARGER.gronn) — panelet og himmelen skal ikke ha hver sin nordlysgrønn.
const styrkeFarge = computed(() => {
  const p = d.value.prosent
  if (!Number.isFinite(p) || p < 5) return 'text-white/72'
  if (p < 15) return 'text-emerald-300/80'
  if (p < 35) return 'text-emerald-300'
  return 'text-emerald-400'
})

const alder = computed(() => alderMinutter(d.value.observert))

/**
 * Bz-tittelen er ikke pynt. Feltet som peker SØR (negativ Bz) er det som kobler
 * seg til jordas eget og slipper energien inn — Kp 5 med Bz nord gir lite. Det er
 * for detaljert for hovedlinja, men det hører hjemme i et tooltip for den som
 * lurer på hvorfor et høyt Kp ikke ga noe.
 */
/**
 * KILDEMERKET ER KORT MED VILJE. Det står i den lille «Nordlys»-etiketten, som er
 * i cellen som ikke vokser — en kildetekst i X-cellen dyttet lukk-knappen forbi
 * pillas klippekant (v6.5.18). Full attribusjon ligger i tittelen for den som
 * holder fingeren nede.
 */
const kildeMerke = computed(() => {
  if (props.demo) return 'DEMO'
  if (alder.value != null) return `${alder.value} min`
  return 'NOAA'
})

const kildeTittel = computed(() => {
  if (props.demo) return `Demo fra Utvikler-fanen: ${props.demo}`
  if (alder.value != null) return `NOAA SWPC OVATION — observert for ${alder.value} min siden`
  return 'NOAA SWPC OVATION'
})

const vindTittel = computed(() => {
  const v = d.value.vindKmS
  const bz = d.value.bz
  const bt = d.value.bt
  const deler = []
  if (Number.isFinite(v)) deler.push(`Solvindfart ${Math.round(v)} km/s`)
  if (Number.isFinite(bt)) deler.push(`Magnetfelt ${bt} nT`)
  if (Number.isFinite(bz)) {
    deler.push(bz < 0
      ? `Bz ${bz} nT — peker sør, som slipper nordlyset inn`
      : `Bz +${bz} nT — peker nord, som holder det ute`)
  }
  return deler.join(' · ')
})

// Tallene i prioritert rekkefølge — det som ryker først står sist. Lista er
// datadrevet fordi målingen teller på den: en `v-if` per kolonne i malen ville
// gjort «hvor mange vises» til noe man må lese ut av DOM-en.
const verdier = computed(() => {
  const rader = [
    { id: 'sjanse', merke: 'SJANSE', verdi: prosentTekst.value, sterk: true },
  ]
  if (props.skydekke != null) {
    rader.push({ id: 'skyer', merke: 'SKYER', verdi: `${Math.round(props.skydekke)} %` })
  }
  if (Number.isFinite(d.value.kp)) {
    rader.push({ id: 'kp', merke: 'KP', verdi: d.value.kp.toFixed(1) })
  }
  if (Number.isFinite(d.value.vindKmS)) {
    rader.push({
      id: 'solvind', merke: 'SOLVIND', verdi: `${Math.round(d.value.vindKmS)}`,
      enhet: 'km/s', tittel: vindTittel.value,
    })
  }
  return rader
})

const tallRef = ref(null)
const hodeRef = ref(null)

/**
 * STABLET ELLER PÅ ÉN LINJE — og det MÅLES, det gjettes ikke (v6.5.54).
 *
 * Fram til nå sto hode, tall og X på én linje med `shrink-0` på alle tre, i en
 * pille med `overflow-hidden`. Ved 200 % tekst fikk ikke tallene plass, og det
 * som ble klippet var LUKKEKNAPPEN ytterst: panelet viste to av fire tall og
 * ingen X, altså et varsel man ikke kunne bli kvitt. Samme feil som v6.5.18,
 * med tekststørrelse som årsak i stedet for en lang kildetekst.
 *
 * Svaret er ikke å fjerne tall — alle fire svarer på hvert sitt spørsmål — men å
 * gi dem en linje til når de trenger den: over et visst tekstnivå faller tallene
 * ned på egen rad under hodet og X-en, og bryter fritt der. Da er det ingen
 * tekststørrelse der de to radene kan ta plassen fra hverandre.
 *
 * Målingen spør browseren om det FAKTISK flyter over, framfor å regne på
 * kolonnebredder som er ulike («KP» mot «SOLVIND 337 km/s»). Den prøver ALLTID
 * én linje først, så panelet faller tilbake av seg selv når teksten skrus ned
 * igjen.
 */
const stablet = ref(false)
let maaler = false
let ro = null
// Hva målingen SÅ sist. Uten den ville observeren fyrt av vår egen omlegging:
// pilla blir høyere når tallene faller ned på egen rad, og en ny måling på den
// endringen er en løkke uten ende.
let sisteMaal = ''

// Mora til PILLA, altså tre nivåer opp fra hode-cella: hode → rad → pille →
// mor. Den er full bredde uansett hva vi velger, mens pilla selv er
// innholdsbred og dermed et speil av vårt eget svar.
function pilleMor() {
  return hodeRef.value?.parentElement?.parentElement?.parentElement ?? null
}

function maalSignatur() {
  const hode = hodeRef.value
  const mor = pilleMor()
  if (!hode || !mor) return null
  // Bredden vi har å gå på, og hvor stor teksten er. Ingen av de to følger
  // resultatet vårt.
  return `${mor.clientWidth}|${hode.offsetWidth}|${hode.offsetHeight}`
}

async function maalPlass() {
  if (maaler) return
  const sig = maalSignatur()
  if (!sig || sig === sisteMaal) return
  maaler = true
  try {
    sisteMaal = sig
    stablet.value = false
    await nextTick()
    const t = tallRef.value
    if (!t) return
    // `scrollWidth`/`clientWidth` er begge LOKALE piksler, så `zoom`-laget over
    // panelet påvirker ikke sammenlikningen (samme felle som værraden i v6.5.51).
    if (t.scrollWidth > t.clientWidth + 1) stablet.value = true
  } finally {
    maaler = false
  }
}

// KOBLES PÅ NÅR PILLA FINNES, ikke ved montering (samme felle som værraden i
// v6.3.12): ved montering står varselet på «loading», og da rendres en enkel
// linje uten pille. En observer koblet på i `onMounted` ville aldri blitt koblet
// på i det hele tatt. Watchen fyrer også når tallene endrer seg — et nytt varsel
// kan gi bredere tall (Kp 10.0, solvind 1 100 km/s) eller en kolonne mer, og da
// er forrige måling ikke lenger sann.
watch(
  () => `${props.nordlys?.status}|${verdier.value.map((v) => v.merke + v.verdi).join('|')}`,
  async () => {
    await nextTick()
    if (!ro && typeof ResizeObserver !== 'undefined' && hodeRef.value) {
      // TO SIGNALER, og de svarer på hvert sitt spørsmål. Mora til pilla fanger
      // at skjermen blir smalere; hode-cella fanger at TEKSTEN blir større. Det
      // siste er ikke det samme: mora har ingen rem-basert polstring, så bredden
      // hennes er den samme ved 100 % og 200 % systemtekst, og en observer på
      // den alene ville aldri fyrt på nettopp den endringen målingen finnes for.
      // Pilla SELV observeres ikke: hun er innholdsbred og innholdshøy, altså et
      // speil av vårt eget svar.
      const mor = pilleMor()
      if (mor) {
        ro = new ResizeObserver(() => { maalPlass() })
        ro.observe(mor)
        ro.observe(hodeRef.value)
      }
    }
    sisteMaal = ''
    maalPlass()
  },
  { immediate: true },
)
onBeforeUnmount(() => { ro?.disconnect(); ro = null })

</script>

<template>
  <div v-if="nordlys?.status === 'loading'"
       class="rounded-full bg-black/72 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/78">
    Henter nordlysvarsel …
  </div>
  <!-- Ærlig svar framfor et oppdiktet nordlys. Samme regel som værraden. -->
  <div v-else-if="nordlys?.status === 'error'"
       class="rounded-full bg-black/72 backdrop-blur px-3 py-1.5 text-[0.6875rem] text-white/78">
    Nordlysvarsel ikke tilgjengelig
  </div>

  <!-- PILLA ER EN KOLONNE MED ÉN ELLER TO RADER (v6.5.54). Ved vanlig tekst er
       det bare den ene, og panelet ser ut som før: hode, tall og X på linje.
       Ved stor tekst faller tallene ned på en rad under, der de har hele
       pillebredden å bryte over — se `stablet` i skriptet. Skillelinjene er
       skrevet på hver celle framfor `divide-x`, fordi retningen på dem nå følger
       hvilken rad de står i. -->
  <div v-else-if="nordlys?.status === 'done'"
       class="rounded-2xl bg-black/72 backdrop-blur max-w-full overflow-hidden
              flex flex-col">
    <div class="flex items-stretch">
      <!-- Hovedtallet: styrkeordet stort, sannsynligheten under. Det er det man
           leser i mørket, og det eneste som er stedsspesifikt. -->
      <div ref="hodeRef"
           class="shrink-0 flex flex-col items-start justify-center px-3 py-1.5 min-w-[6.5rem]">
        <span class="text-[0.5rem] uppercase tracking-wide text-white/70 leading-none"
              :title="kildeTittel">
          Nordlys<span v-if="kildeMerke" class="text-white/70"> · {{ kildeMerke }}</span>
        </span>
        <span class="text-[0.9375rem] font-semibold leading-tight" :class="styrkeFarge">
          {{ forhold.styrke ?? 'Ukjent' }}
        </span>
        <!-- HVORFOR man ikke ser noe, når man ikke gjør det. «Sterk» over et tett
             skylag er verre enn ingen melding. -->
        <span v-if="forhold.hvorfor"
              class="text-[0.5625rem] text-white/70 leading-none">{{ forhold.hvorfor }}</span>
      </div>

      <!-- TALLENE PÅ LINJE. `min-w-0` er det som gjør at cella kan krympe i det
           hele tatt — uten den står min-content-gulvet i veien, og det er da
           X-en havner utenfor klippekanten. Målingen leser overflyten HER. -->
      <div v-if="!stablet" ref="tallRef" data-nordlys-tall
           class="min-w-0 flex items-center gap-2.5 px-3 py-1.5 overflow-hidden
                  border-l border-white/10">
        <span v-for="v in verdier" :key="v.id"
              class="shrink-0 flex flex-col items-center leading-none" :title="v.tittel">
          <span class="text-[0.5rem] text-white/70 whitespace-nowrap">{{ v.merke }}</span>
          <span class="text-[0.75rem] tabular-nums mt-0.5 whitespace-nowrap"
                :class="v.sterk ? 'text-white' : 'text-white/85'">
            {{ v.verdi }}<span v-if="v.enhet" class="text-[0.5rem] text-white/70">{{ v.enhet }}</span>
          </span>
        </span>
      </div>

      <!-- BARE X-EN, ingen kildetekst ved siden av (v6.5.18). Pilla er
           overflow-hidden, så en lang kildetekst dyttet lukk-knappen forbi
           klippekanten — «Rett over hodet» i demoen hadde ingen X i det hele
           tatt. Kilden er ETT merke i «Nordlys»-etiketten øverst til venstre, i
           cellen som ikke vokser. 44 px er trykkmålets minimum.
           `ml-auto` holder X-en mot høyre kant også når tallene har falt ned på
           egen rad og denne raden bare har hodet i seg. -->
      <div class="shrink-0 ml-auto flex items-center pl-1 pr-0.5"
           :class="stablet ? '' : 'border-l border-white/10'">
        <button @click="emit('lukk')" aria-label="Skjul nordlysvarselet og nordlyset"
                class="w-11 h-11 shrink-0 flex items-center justify-center text-white/70
                       active:scale-90 transition-transform">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- RAD 2: tallene, over HELE pillebredden og med fri bryting. Den finnes
         bare når rad 1 ikke rakk — se `stablet`. -->
    <div v-if="stablet" data-nordlys-tall
         class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5
                border-t border-white/10">
      <span v-for="v in verdier" :key="v.id"
            class="flex flex-col items-center leading-none" :title="v.tittel">
        <span class="text-[0.5rem] text-white/70 whitespace-nowrap">{{ v.merke }}</span>
        <span class="text-[0.75rem] tabular-nums mt-0.5 whitespace-nowrap"
              :class="v.sterk ? 'text-white' : 'text-white/85'">
          {{ v.verdi }}<span v-if="v.enhet" class="text-[0.5rem] text-white/70">{{ v.enhet }}</span>
        </span>
      </span>
    </div>
  </div>
</template>
