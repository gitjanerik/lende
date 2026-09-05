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
// AT DET DERFOR IKKE TRENGTE Å BRYTE VAR FEIL, og det sto her til v6.5.54.
// Fire tall får plass på én linje ved vanlig tekst; ved 200 % gjør de det ikke,
// og det som ble klippet var LUKKEKNAPPEN. Se stilblokka nederst — panelet
// bryter nå selv, i CSS, uten en eneste terskel.
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
import { computed } from 'vue'
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
// datadrevet framfor en `v-if` per kolonne i malen, så «hvilke tall finnes»
// er ett sted og ikke spredt utover markupen.
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

  <!-- PILLA BRYTER SEG SELV (v6.5.54). Ved vanlig tekst står hode, tall og X på
       én linje; når tallene ikke får plass ved siden av hodet, faller de ned på
       en egen rad under og bryter fritt der. Hele regelen bor i stilblokka
       nederst, og den har ingen terskel — se begrunnelsen der. -->
  <div v-else-if="nordlys?.status === 'done'"
       class="nordlys-pille relative rounded-2xl bg-black/72 backdrop-blur max-w-full
              overflow-hidden flex flex-wrap items-stretch">
    <!-- Hovedtallet: styrkeordet stort, sannsynligheten under. Det er det man
         leser i mørket, og det eneste som er stedsspesifikt. -->
    <div class="shrink-0 flex flex-col items-start justify-center px-3 py-1.5 min-w-[6.5rem]">
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

    <!-- TALLENE. Cella er den ENESTE som kan bryte til neste linje, og den som
         kan vokse — se `.nordlys-tall` i stilblokka. Tallene bryter dessuten
         innbyrdes (`flex-wrap`), så en rad som er blitt smal legger dem i to
         etasjer framfor å flyte utenfor. -->
    <div data-nordlys-tall
         class="nordlys-tall flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5
                border-l border-white/10">
      <span v-for="v in verdier" :key="v.id"
            class="flex flex-col items-center leading-none" :title="v.tittel">
        <span class="text-[0.5rem] text-white/70 whitespace-nowrap">{{ v.merke }}</span>
        <span class="text-[0.75rem] tabular-nums mt-0.5 whitespace-nowrap"
              :class="v.sterk ? 'text-white' : 'text-white/85'">
          {{ v.verdi }}<span v-if="v.enhet" class="text-[0.5rem] text-white/70">{{ v.enhet }}</span>
        </span>
      </span>
    </div>

    <!-- X-EN ER TATT UT AV FLYTEN, og det er det som gjør den umulig å klippe
         (v6.5.54). Ligger den i flyten etter tallene, følger den dem ned på
         neste linje når de bryter — flex-bryting tar med seg ALT etter
         brytepunktet. Absolutt plassert i pillas eget hjørne står den i ro
         uansett hvor mange linjer innholdet ble.
         Plassen hennes reserveres av `padding-inline-end` på pilla, slik at
         tallene aldri legger seg under henne. 44 px er trykkmålets minimum.
         Ingen kildetekst ved siden av (v6.5.18) — kilden er ETT merke i
         «Nordlys»-etiketten øverst til venstre, i cellen som ikke vokser. -->
    <div class="absolute top-0 right-0 flex items-center">
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
</template>

<style scoped>
/*
 * BRYTINGEN HAR INGEN TERSKEL, og det er hele poenget (v6.5.54).
 *
 * Første utgave MÅLTE med en ResizeObserver: den la tallene på én linje, spurte
 * browseren om det fløt over, og stablet hvis det gjorde det. Det virket, men
 * det er en løkke rundt et spørsmål CSS kan svare på selv — og en løkke som
 * observerer sin egen layout har en feilklasse ingen deklarativ regel har.
 * (Den slo til under arbeidet: panelet ble stående stablet når teksten ble
 * skrudd ned igjen, fordi det observerte elementet var vårt eget svar.)
 *
 * `flex-basis: max-content` sier nøyaktig det vi mener: cellas ønskede bredde er
 * tallenes naturlige bredde. Får den plass på linja etter hodet, blir den
 * stående; gjør den ikke det, bryter `flex-wrap` henne ned på neste linje, der
 * `flex-grow: 1` gir henne hele pillebredden. Ingen em-verdi, ingen container
 * query, ingen måling — og dermed ingenting som kan bomme når fonten på en annen
 * telefon er bredere enn den vi målte på.
 *
 * `min-width: 0` er det som gjør at hun kan KRYMPE i det hele tatt: uten den
 * står min-content-gulvet i veien, og innholdet flyter ut av pilla.
 */
.nordlys-tall {
  flex: 1 1 max-content;
  min-width: 0;
}

/*
 * Plassen til X-en, som er ute av flyten. Verdien er knappens egen (2,75rem)
 * pluss litt luft — altså en størrelse vi eier, ikke et brytepunkt vi gjetter.
 * `rem` og ikke `px`, så strimmelen vokser i takt med knappen når systemets
 * tekstskalering skrus opp.
 */
.nordlys-pille {
  padding-inline-end: 3.25rem;
}
</style>
