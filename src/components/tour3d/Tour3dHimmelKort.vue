<script setup>
// Infokort for det valgte på himmelen: stjernebilde, planet eller månen.
//
// EGEN KOMPONENT og ikke Tour3dFeatureCard, som ble vurdert: den er bundet til
// kart-feature-typer (TYPE_LABELS, TYPE_IKONER) og henter NVE-observasjoner
// lazily. Å presse en stjernehimmel inn i den ville gitt to formål i én
// komponent — og det er ingen delt logikk å spare, bare et navn.
//
// Snarveiene nederst er stjernehopping, og de er den beste grunnen til at kortet
// finnes: har man først funnet Orion, er neste steg å hoppe til naboen. Det er
// slik man lærer seg en himmel.
//
// Stilen er dempet mørk av samme grunn som søkefeltet: kortet står åpent mens
// man ser på stjerner, og et lyst kort ødelegger nattsynet det tok en halvtime
// å bygge opp.
//
// KORTET KAN MINIMERES (v6.1.0), og det er ikke bare plass: teksten dekker den
// delen av himmelen man nettopp ble bedt om å se på. Minimert står navnet og
// retningen igjen som én linje — nok til å vite hva som er fremhevet — og et
// trykk åpner det igjen.
//
// Et hopp til en NABO minimerer kortet av seg selv. Det er hele poenget med
// stjernehopping: man hopper for å SE, ikke for å lese videre. Vil man lese om
// den nye, er kortet ett trykk unna.
import { computed, ref, watch } from 'vue'
import { kompass } from '../../lib/tour3d/himmelObjekter.js'
import { GLOBE_TEKST } from '../../lib/tour3d/himmellegemer.js'
import { faktaFor, manerLinje } from '../../lib/tour3d/himmelFakta.js'

const props = defineProps({
  // Objektet fra himmelObjekter().
  objekt: { type: Object, default: null },
  // De nærmeste andre, fra naboerFor().
  naboer: { type: Array, default: () => [] },
  // Sammenslått til én linje. Eies av kalleren, som også vet at et nabo-hopp
  // skal minimere.
  minimert: { type: Boolean, default: false },
})
const emit = defineEmits(['lukk', 'velg', 'minimer', 'utvid', 'fokus'])

const GRAD = 180 / Math.PI
const komma = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '–')

const hoydeGrader = computed(() => Math.round((props.objekt?.hoyde ?? 0) * GRAD))
const retning = computed(() => kompass((props.objekt?.azimut ?? 0) * GRAD))

const IKON = { mane: '🌙', planet: '🪐', formasjon: '✦' }

// Astronomiske fakta og utforskningshistorie. Finnes for månen og alle
// planetene — også Merkur og Venus, som ikke har globe: at man ikke kan snurre
// dem er ingen grunn til å slippe å vite hva de er.
const fakta = computed(() => faktaFor(props.objekt))
const maner = computed(() => manerLinje(fakta.value?.maner))

// Utforskningslista er lang for Mars og månen. Sammenlagt viser vi de nyeste
// fire — det er dem folk har hørt om — og «vis alle» åpner resten. Rekkefølgen
// er ELDST FØRST når den er åpen, for da er den en historie.
const visAllUtforskning = ref(false)
const utforskning = computed(() => {
  const u = fakta.value?.utforskning ?? []
  return visAllUtforskning.value ? u : u.slice(-4)
})

// Prosaen for de legemene som HAR en globe. Nøkkelen er legeme-id-en: månen er
// 'mane', planetene ligger som 'planet:<id>' i himmellista.
// Nytt legeme, ny historie: en åpen liste skal ikke arves over til Saturn.
watch(() => props.objekt?.id, () => { visAllUtforskning.value = false })

const globeTekst = computed(() => {
  const o = props.objekt
  if (!o) return null
  const id = o.type === 'mane' ? 'mane' : String(o.id ?? '').replace(/^planet:/, '')
  return GLOBE_TEKST[id] ?? null
})

// Månefasen med ord. Et tall i prosent sier lite; «voksende halvmåne» er det
// man faktisk ser opp på.
const faseNavn = computed(() => {
  const o = props.objekt
  if (o?.type !== 'mane') return null
  const k = o.lysAndel ?? 0
  const voksende = o.voksende
  if (k < 0.04) return 'nymåne'
  if (k > 0.96) return 'fullmåne'
  if (k < 0.46) return voksende ? 'voksende månesigd' : 'minkende månesigd'
  if (k < 0.54) return voksende ? 'voksende halvmåne' : 'minkende halvmåne'
  return voksende ? 'voksende, nesten full' : 'minkende, nesten full'
})
</script>

<template>
  <!-- MINIMER/UTVID OG LUKK STÅR I BEGGE TILSTANDER, på samme sted og i samme
       rekkefølge, så man ikke må lete etter dem på nytt hver gang. Karet peker
       NED når kortet er minimert (trykk for å åpne) og OPP når det er åpent
       (trykk for å legge sammen).

       «SETT I FOKUS» (krysshår) STÅR BARE I DEN MINIMERTE PILLA (v6.3.5), og det
       er en presis avgrensning og ikke en halv løsning. Med kortet sammenlagt og
       legemet tilbake i normal størrelse kan man panorere fritt — og DA er dette
       veien tilbake til det man så på. I det ÅPNE kortet har den ingen jobb: både
       et valg fra lista og et trykk i himmelen retter blikket dit selv, så der
       sto den bare og tok plass i en header man leser i mørket. -->

  <!-- MINIMERT: én linje. Navnet og retningen er det man trenger for å vite hva
       som lyser der oppe; resten er lesestoff man ber om. -->
  <div v-if="objekt && minimert"
       class="rounded-full bg-black/70 backdrop-blur shadow-lg max-w-[86vw] sm:max-w-sm
              flex items-center gap-1 pl-3 pr-1 py-1">
    <button @click="emit('utvid')" :aria-label="`Vis mer om ${objekt.navn}`"
            class="flex-1 min-w-0 flex items-baseline gap-1.5 text-left active:scale-[0.98]">
      <span class="text-[0.75rem]" aria-hidden="true">{{ IKON[objekt.type] }}</span>
      <span class="text-[0.8125rem] font-medium text-white/85 truncate">{{ objekt.navn }}</span>
      <span class="text-[0.625rem] text-white/45 shrink-0">{{ retning }}, {{ hoydeGrader }}°</span>
    </button>
    <div class="shrink-0 flex items-center">
      <button @click="emit('fokus')" :aria-label="`Sett ${objekt.navn} i fokus`"
              class="w-7 h-7 flex items-center justify-center text-white/55 active:scale-90">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
      </button>
      <button @click="emit('utvid')" aria-label="Vis hele infokortet"
              class="w-7 h-7 flex items-center justify-center text-white/55 active:scale-90">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button @click="emit('lukk')" aria-label="Lukk infokortet"
              class="w-7 h-7 flex items-center justify-center text-white/45 active:scale-90">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- ÅPENT KORT: FAST HEADER, RULLBAR KROPP.
       Fram til v6.3.2 var dette én kolonne uten tak, og med fakta og
       utforskningshistorie inne vokste den rett ut av skjermen: navnet og de tre
       knappene forsvant oppover mens teksten lå igjen midt over terrenget uten
       noen måte å lukke kortet på. Headeren står nå fast — navn, retning og de
       ikonene er ALLTID synlige — og bare lesestoffet ruller.

       Taket er i vh og ikke i piksler: kortet skal ta høyst litt over halve
       skjermen, uansett om den er en telefon på høykant eller en 27-tommer. -->
  <div v-else-if="objekt"
       class="rounded-md bg-black/80 backdrop-blur shadow-lg max-w-[86vw] sm:max-w-sm
              max-h-[58vh] flex flex-col overflow-hidden">
    <!-- HEADER — shrink-0, så den aldri klemmes eller rulles bort. -->
    <div class="shrink-0 flex items-start gap-1.5 pl-3 pr-1 py-2
                border-b border-white/10">
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-1.5">
          <span class="text-[0.8125rem]" aria-hidden="true">{{ IKON[objekt.type] }}</span>
          <span class="text-[0.875rem] font-semibold text-white/90 truncate">{{ objekt.navn }}</span>
          <span v-if="objekt.latin && objekt.latin !== objekt.navn"
                class="text-[0.625rem] italic text-white/40 truncate">{{ objekt.latin }}</span>
        </div>

        <!-- Hvor det står. I HEADEREN, fordi det er det man trenger for å løfte
             blikket i riktig retning — og da skal det ikke kunne rulles bort. -->
        <div class="mt-0.5 text-[0.625rem] text-white/50">
          {{ retning }}, {{ hoydeGrader }}° over horisonten
        </div>
      </div>

      <!-- Minimer og lukk, som i den minimerte pilla og i samme rekkefølge.
           Krysshåret hører ikke hit — se kommentaren i toppen av malen. -->
      <div class="shrink-0 flex items-center">
        <button @click="emit('minimer')" aria-label="Minimer infokortet"
                class="w-7 h-7 flex items-center justify-center text-white/55 active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 15 12 9 18 15"/>
          </svg>
        </button>
        <button @click="emit('lukk')" aria-label="Lukk infokortet"
                class="w-7 h-7 flex items-center justify-center text-white/45 active:scale-90">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- KROPPEN: alt lesestoffet, og det ENESTE som ruller.
         `overscroll-contain` hindrer at et drag som treffer enden av lista
         forplanter seg til 3D-lerretet og dreier kameraet under fingeren.
         `touch-pan-y` sier til nettleseren at loddrett drag hører til kortet,
         så scrollen ikke kapres av pointer-håndtererne på canvaset. -->
    <div class="flex-1 min-w-0 overflow-y-auto overscroll-contain touch-pan-y
                pl-3 pr-3 py-2">
      <!-- Tallene, per type. -->
      <div v-if="objekt.type === 'formasjon'" class="mt-1.5 text-[0.6875rem] text-white/70">
        {{ objekt.antallStjerner }} stjerner tegnet<template v-if="objekt.lysesteStjerne">, lyseste er
        <span class="text-white/90">{{ objekt.lysesteStjerne.navn }}</span>
        ({{ komma(objekt.lysesteStjerne.mag) }})</template>.
      </div>
      <div v-else-if="objekt.type === 'planet'" class="mt-1.5 text-[0.6875rem] text-white/70">
        Lysstyrke {{ komma(objekt.mag) }} ·
        {{ komma(objekt.avstandAE, 2) }} AE unna ·
        {{ Math.round(objekt.lysAndel * 100) }} % opplyst
      </div>
      <div v-else-if="objekt.type === 'mane'" class="mt-1.5 text-[0.6875rem] text-white/70">
        {{ faseNavn }} · {{ Math.round(objekt.lysAndel * 100) }} % opplyst
      </div>

      <!-- Legemer med globe: det ene faktumet som er verdt å ta med seg. Teksten
           bor i himmellegemer.js, ikke her — den skrives om uten å røre en
           koordinat.

           BRUKSANVISNINGEN ER FJERNET (v6.3.3), etter felttest. Her sto «dra for
           å snurre Mars, og trykk én gang for å legge den tilbake på himmelen»,
           og i lukket tilstand en tilsvarende «trykk på mars for å se planeten
           som en kule». Ingen av dem trengs: trykk-ringen fra v6.3.2 sier at
           legemet kan åpnes, og at man drar i en kule for å snurre den er det man
           prøver først uansett. En instruksjon som forklarer det åpenbare stjeler
           linjer fra det man faktisk kom for å lese. -->
      <template v-if="globeTekst">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">
          {{ objekt.navn }} som globe
        </div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">
          {{ globeTekst.omtale }}
        </p>
      </template>

      <!-- Teksten for stjernebildene. -->
      <template v-if="objekt.info">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Finn den</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.finnDen }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Historien</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.mytologi }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Verdt å vite</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.funFact }}</p>
      </template>

      <!-- ASTRONOMISKE FAKTA. Månen og alle planetene, også de uten globe.
           Nøkkeltallene står som EGNE linjer og ikke som et avsnitt: de leses ett
           for ett, i mørket, på en telefon. -->
      <template v-if="fakta">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Fakta</div>
        <div class="text-[0.6875rem] leading-relaxed text-white/70">{{ fakta.type }}</div>
        <div v-if="maner" class="text-[0.6875rem] leading-relaxed text-white/70">{{ maner }}</div>
        <div class="text-[0.6875rem] leading-relaxed text-white/50">{{ fakta.oppdaget }}</div>
        <ul class="mt-1 space-y-0.5">
          <li v-for="f in fakta.fakta" :key="f"
              class="text-[0.6875rem] leading-relaxed text-white/70 flex gap-1.5">
            <span class="text-white/25 shrink-0" aria-hidden="true">·</span>
            <span>{{ f }}</span>
          </li>
        </ul>

        <!-- MENNESKETS UTFORSKNING. Årstall til venstre, hva som skjedde til
             høyre. Sammenlagt vises de fire nyeste; «vis alle» gir hele
             historien, eldst først. -->
        <div class="mt-2 flex items-baseline justify-between gap-2">
          <span class="text-[0.5625rem] uppercase tracking-wide text-white/35">Utforsket</span>
          <button v-if="fakta.utforskning.length > 4"
                  @click="visAllUtforskning = !visAllUtforskning"
                  class="text-[0.5625rem] text-white/45 active:scale-95">
            {{ visAllUtforskning ? 'vis mindre' : `alle ${fakta.utforskning.length}` }}
          </button>
        </div>
        <ul class="space-y-1">
          <li v-for="m in utforskning" :key="m.ar + m.tekst" class="flex gap-2">
            <span class="text-[0.625rem] font-medium text-white/55 shrink-0 tabular-nums
                         w-[3.4em]">{{ m.ar }}</span>
            <span class="text-[0.6875rem] leading-relaxed text-white/70">{{ m.tekst }}</span>
          </li>
        </ul>

        <!-- LES MER. Krever dekning, og derfor står faktaene over her i appen —
             lenkene er veien videre for den som vil lese mer hjemme igjen. SNL
             først: redaksjonelt og på bokmål. -->
        <div class="mt-2 flex flex-wrap gap-1">
          <a :href="fakta.snl" target="_blank" rel="noopener noreferrer"
             class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                    active:scale-95">Store norske leksikon ↗</a>
          <a :href="fakta.wikipedia" target="_blank" rel="noopener noreferrer"
             class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                    active:scale-95">Wikipedia ↗</a>
        </div>
      </template>

      <!-- Snarveier: stjernehopping. Bare de som faktisk er i nærheten. -->
      <template v-if="naboer.length">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">I nærheten</div>
        <div class="mt-1 flex flex-wrap gap-1">
          <button v-for="n in naboer" :key="n.id"
                  @click="emit('velg', n)"
                  :aria-label="`Hopp til ${n.navn}, ${Math.round(n.avstandGrader)} grader unna`"
                  class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                         active:scale-95 transition-colors">
            {{ IKON[n.type] }} {{ n.navn }}
            <span class="text-white/40">{{ Math.round(n.avstandGrader) }}°</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
