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
// rulle gjennom, så panelet er ETT tall med fire mindre under. Det gjør at det
// får plass på én linje selv på en smal telefon, og at raden ikke trenger
// plass-målingen værraden må ha (v6.3.9).
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

  <div v-else-if="nordlys?.status === 'done'"
       class="rounded-2xl bg-black/72 backdrop-blur max-w-full overflow-hidden
              flex items-stretch divide-x divide-white/10">
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

    <div class="shrink-0 flex items-center gap-2.5 px-3 py-1.5">
      <span class="flex flex-col items-center leading-none">
        <span class="text-[0.5rem] text-white/70">SJANSE</span>
        <span class="text-[0.75rem] text-white tabular-nums mt-0.5">{{ prosentTekst }}</span>
      </span>
      <span v-if="skydekke != null" class="flex flex-col items-center leading-none">
        <span class="text-[0.5rem] text-white/70">SKYER</span>
        <span class="text-[0.75rem] text-white/85 tabular-nums mt-0.5">
          {{ Math.round(skydekke) }} %
        </span>
      </span>
      <span v-if="Number.isFinite(d.kp)" class="flex flex-col items-center leading-none">
        <span class="text-[0.5rem] text-white/70">KP</span>
        <span class="text-[0.75rem] text-white/85 tabular-nums mt-0.5">
          {{ d.kp.toFixed(1) }}
        </span>
      </span>
      <span v-if="Number.isFinite(d.vindKmS)" class="flex flex-col items-center leading-none"
            :title="vindTittel">
        <span class="text-[0.5rem] text-white/70">SOLVIND</span>
        <span class="text-[0.75rem] text-white/85 tabular-nums mt-0.5">
          {{ Math.round(d.vindKmS) }}<span class="text-[0.5rem] text-white/70">km/s</span>
        </span>
      </span>
    </div>

    <!-- BARE X-EN, ingen kildetekst ved siden av (v6.5.18). Alle cellene er
         shrink-0 og pilla er overflow-hidden, så en lang kildetekst dyttet
         lukk-knappen forbi klippekanten — «Rett over hodet» i demoen hadde ingen
         X i det hele tatt. Kilden er nå ETT merke i «Nordlys»-etiketten øverst
         til venstre, i cellen som ikke vokser. 44 px er trykkmålets minimum. -->
    <div class="shrink-0 flex items-center pl-1 pr-0.5">
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
