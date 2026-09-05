<script setup>
// Infokort for det valgte på himmelen: stjernebilde, planet, månen — eller én
// enkelt stjerne (v6.4.0), som er den halvparten av himmelen som fram til nå
// ikke kunne svare for seg.
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
import TekstStorrelseKnapp from '../TekstStorrelseKnapp.vue'
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
  // Taket på det åpne kortet, som en CSS-lengde. Kalleren eier det fordi den
  // eier `zoom`: en `vh` inne i et zoom-lag er absolutt mot viewporten og blir
  // så ganget med skalaen, så et tak skrevet her ville vokst med tekstvalget og
  // dekket hele skjermen på 200 %.
  maksHoyde: { type: String, default: '58vh' },
})
const emit = defineEmits(['lukk', 'velg', 'minimer', 'utvid', 'fokus'])

const GRAD = 180 / Math.PI
const komma = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '–')

// SOLA KAN STÅ UNDER HORISONTEN, og da er «−42°» og «over horisonten» begge
// gale. Fortegnet bæres av ORDET og ikke av et minustegn: «42° under
// horisonten» leses av en som står ute i mørket, «−42° over horisonten» gjør
// det ikke. Alle andre legemer i lista er filtrert på høyde > 0, så dette
// gjelder i praksis bare sola (v6.5.6).
const hoydeGrader = computed(() => Math.abs(Math.round((props.objekt?.hoyde ?? 0) * GRAD)))
const underHorisonten = computed(() => (props.objekt?.hoyde ?? 0) < 0)

// Klokkeslett i telefonens egen tidssone, som Yr og METs tabeller leses.
const klokke = (d) => (d instanceof Date && !Number.isNaN(d.getTime())
  ? d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  : '—')
const retning = computed(() => kompass((props.objekt?.azimut ?? 0) * GRAD))

// FYLT stjerne for en figur, ÅPEN for én enkelt stjerne. To tegn fra samme
// familie, så raden leses som én liste og ikke som to — men forskjellen er der
// når man leter etter «det jeg trykket på i himmelen».
const IKON = { mane: '🌙', planet: '🪐', formasjon: '✦', stjerne: '✧' }

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
//
// KRYSSHÅRET BLINKER NÅR KORTET BYTTER OBJEKT (v6.5.51), og det er et svar på
// at kortet nesten alltid står MINIMERT: ethvert valg legger det sammen
// (v6.3.11), så et trykk i himmelen, et søketreff og et nabo-hopp ender alle i
// den samme lille pilla — og på en natthimmel er det ikke gitt at man ser at
// den ene tekstlinja i den ble en annen. Blinket er den kvitteringen.
//
// TELLER OG IKKE ET FLAGG: `:key` på ikonet gjør at elementet bygges på nytt,
// og da starter CSS-animasjonen forfra. Et flagg + timer måtte ha nullstilt seg
// selv mellom to raske bytter, og et halvferdig blink som ikke starter om er
// nøyaktig den kvitteringen som ikke kommer.
//
// FYRER IKKE VED FØRSTE ÅPNING (`gammel` må finnes): da har man nettopp bedt om
// kortet selv, og en blinkende knapp ville vært en beskjed om noe man alt vet.
const blinkNr = ref(0)
watch(() => props.objekt?.id, (ny, gammel) => {
  visAllUtforskning.value = false
  if (ny && gammel && ny !== gammel) blinkNr.value += 1
})

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
       class="rounded-full bg-black/70 backdrop-blur shadow-lg max-w-full sm:max-w-sm
              flex items-center gap-1 pl-3 pr-1 py-1">
    <button @click="emit('utvid')" :aria-label="`Vis mer om ${objekt.navn}`"
            class="flex-1 min-w-0 flex items-baseline gap-1.5 text-left active:scale-[0.98]">
      <span class="text-[0.75rem]" aria-hidden="true">{{ IKON[objekt.type] }}</span>
      <!-- NAVNET FØR RETNINGEN når det blir trangt: retningen er en detalj man
           kan miste, navnet er hele grunnen til at pilla står der. Fram til nå
           var det motsatt — retningen var `shrink-0` og navnet det eneste som
           kunne krympe, så «Mars» ble stående som «M». -->
      <span class="text-[0.8125rem] font-medium text-white/85 shrink-0 max-w-[60%] truncate">{{ objekt.navn }}</span>
      <span class="text-[0.625rem] text-white/70 min-w-0 truncate">{{ retning }}, {{ hoydeGrader }}°</span>
    </button>
    <!-- Tekststørrelse hører til det ÅPNE kortet og ikke hit: pilla er én linje
         som sier hva som er valgt, og en fjerde knapp på den linja spiser navnet
         den finnes for. -->
    <div class="shrink-0 flex items-center">
      <button @click="emit('fokus')" :aria-label="`Sett ${objekt.navn} i fokus`"
              class="w-7 h-7 flex items-center justify-center text-white/75 active:scale-90">
        <!-- `:key` er blinkets motor: en ny nøkkel bygger ikonet på nytt, og da
             starter animasjonen forfra også midt i et pågående blink. -->
        <svg :key="blinkNr" viewBox="0 0 24 24" class="w-4 h-4"
             :class="blinkNr ? 'kryss-blink' : ''"
             fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
      </button>
      <button @click="emit('utvid')" aria-label="Vis hele infokortet"
              class="w-7 h-7 flex items-center justify-center text-white/75 active:scale-90">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button @click="emit('lukk')" aria-label="Lukk infokortet"
              class="w-7 h-7 flex items-center justify-center text-white/70 active:scale-90">
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

       Taket er i vh og ikke i piksler: kortet skal ta høyst to tredjedeler av
       skjermen, uansett om den er en telefon på høykant eller en 27-tommer. Det
       kommer fra kalleren (`maksHoyde`), som er den som kjenner tekstskalaen —
       se prop-en. Og det MÅ bite her og ikke på en rullbar forelder: er det
       forelderen som klipper, ruller headeren bort, og da er vi tilbake til
       feilen v6.3.2 rettet. -->
  <div v-else-if="objekt"
       :style="{ maxHeight: maksHoyde }"
       class="rounded-md bg-black/80 backdrop-blur shadow-lg max-w-full sm:max-w-md
              flex flex-col overflow-hidden">
    <!-- HEADER — shrink-0, så den aldri klemmes eller rulles bort.

         KNAPPENE OG TEKSTEN ER STABLET, ikke satt opp mot hverandre (v6.5.54).
         Fram til nå delte navnet rad med de tre knappene: knappene var
         `shrink-0` og navnekolonnen `flex-1 min-w-0`, altså basis 0 uten
         min-content-gulv. Det er en kolonne som får DET SOM BLIR TIL OVERS — og
         ved 200 % app-tekst oppå Androids egen tekstskalering ble det ingenting.
         Målt i Chromium ved 200 % zoom og 200 % rot-font: navnet 0 px bredt over
         28 linjer, altså «Bjørnevokteren» én bokstav om gangen.

         Et gulv på navnekolonnen ville bare flyttet spørsmålet: for smalt og
         feilen står, for bredt og knappene klippes bort av kortets
         `overflow-hidden` — nøyaktig feilen v6.3.2 rettet. To ting som skal
         vokse uavhengig av hverandre hører ikke hjemme på samme rad. Nå har hver
         sin: knappene er én rad som ALDRI trenger å krympe, navnet en rad som
         alltid har hele kortbredden å bryte over. Da finnes det ingen
         tekststørrelse der de kan ta plassen fra hverandre. -->
    <div class="shrink-0 px-3 py-2 border-b border-white/10">
      <!-- RAD 1: knappene. Øverst til høyre, samme sted og samme rekkefølge som
           i den minimerte pilla, så man ikke må lete etter dem på nytt når
           kortet åpnes. Krysshåret hører ikke hit — se kommentaren i toppen av
           malen. Merk at HELE kortet er én zoomet boks her (Viewer3D's
           `tekstBoks`), i motsetning til ark-panelene der bare kroppen zoomes —
           så knappene vokser med sin egen effekt, og det er riktig: de skal være
           like lette å treffe ved 200 %.

           De negative margene trekker den 28 px høye trykkflata ut i kortets
           polstring, så ikonene står optisk i hjørnet og raden koster nesten
           ingen ekstra høyde. -->
      <div data-himmel-knapper class="flex items-center justify-end -mt-1 -mr-2 -mb-0.5">
        <TekstStorrelseKnapp tema="natt" />
        <button @click="emit('minimer')" aria-label="Minimer infokortet"
                class="w-7 h-7 flex items-center justify-center text-white/75 active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 15 12 9 18 15"/>
          </svg>
        </button>
        <button @click="emit('lukk')" aria-label="Lukk infokortet"
                class="w-7 h-7 flex items-center justify-center text-white/70 active:scale-90">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- RAD 2: navnet, over HELE kortbredden. -->
      <div class="flex items-baseline gap-1.5">
        <span class="text-[0.8125rem] shrink-0" aria-hidden="true">{{ IKON[objekt.type] }}</span>
        <!-- Ikke `truncate`: navnet er det man kom hit for, og med stor tekst
             ble «Cassiopeia» til «Cas…». Det får heller bryte over to linjer.
             `data-himmel-navn` er et målepunkt for røyktesten: bredden her er
             invarianten stablingen finnes for, og den kan ikke leses av markup
             alene. -->
        <span data-himmel-navn
              class="min-w-0 text-[0.875rem] font-semibold text-white/90
                     leading-tight break-words">{{ objekt.navn }}</span>
      </div>

      <!-- RAD 3: det latinske navnet, på EGEN LINJE (v6.5.51). Det sto før inne
           i navnelinja, og der var det det første som ble klemt: tre tekster og
           tre knapper på én rad ga «Cas… Cas…» ved stor tekst. Det står bevisst
           IKKE i den minimerte pilla — der er én linje hele poenget. -->
      <div v-if="objekt.latin && objekt.latin !== objekt.navn"
           class="mt-0.5 text-[0.625rem] italic text-white/70 break-words">
        {{ objekt.latin }}
      </div>

      <!-- RAD 4: hvor det står. I HEADEREN, fordi det er det man trenger for å
           løfte blikket i riktig retning — og da skal det ikke kunne rulles
           bort. FULL BREDDE (v6.5.51): som en kolonne ved siden av knappene
           brøt «nord, 79° over horisonten» over fire linjer ved 200 % tekst. -->
      <div class="mt-0.5 text-[0.625rem] text-white/72">
        {{ retning }}, {{ hoydeGrader }}°
        {{ underHorisonten ? 'under horisonten' : 'over horisonten' }}
      </div>
    </div>

    <!-- KROPPEN: alt lesestoffet, og det ENESTE som ruller.
         `overscroll-contain` hindrer at et drag som treffer enden av lista
         forplanter seg til 3D-lerretet og dreier kameraet under fingeren.
         `touch-pan-y` sier til nettleseren at loddrett drag hører til kortet,
         så scrollen ikke kapres av pointer-håndtererne på canvaset. -->
    <div class="flex-1 min-w-0 overflow-y-auto overscroll-contain touch-pan-y
                px-3 py-2">
      <!-- SOLA: OPP OG NED ØVERST. Det er det man vil vite på vei ut, og det er
           regnet for ARKET som er åpnet — ikke for der telefonen står. Tidene
           kommer FØR prosaen fordi de er et tall man slår opp, mens resten er
           noe man leser.

           Nord for polarsirkelen finnes ingen av dem deler av året, og da sier
           linja hva som er tilfelle i stedet for å stå tom. -->
      <div v-if="objekt.type === 'sol' && objekt.soltilstand"
           class="mt-1.5 flex items-baseline gap-3 text-[0.75rem] text-white/85">
        <template v-if="objekt.soltilstand === 'normal'">
          <span v-if="objekt.oppgang" class="tabular-nums">
            <span class="text-white/70 text-[0.625rem] uppercase tracking-wide mr-1">Opp</span>{{ klokke(objekt.oppgang) }}
          </span>
          <span v-if="objekt.nedgang" class="tabular-nums">
            <span class="text-white/70 text-[0.625rem] uppercase tracking-wide mr-1">Ned</span>{{ klokke(objekt.nedgang) }}
          </span>
        </template>
        <span v-else-if="objekt.soltilstand === 'midnattssol'">
          Midnattssol — sola går ikke ned i dag.
        </span>
        <span v-else>Mørketid — sola står ikke opp i dag.</span>
      </div>

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
      <!-- SOLA. Under horisonten er det ikke nok å si HVOR den er — man må få
           vite hvorfor man ser den under landskapet, ellers leses den som en
           tegnefeil. Over horisonten trenger linja ingen forklaring. -->
      <div v-else-if="objekt.type === 'sol'" class="mt-1.5 text-[0.6875rem] text-white/70">
        <template v-if="underHorisonten">
          Under horisonten nå, altså under føttene dine — Lende tegner den der den
          faktisk står, nedenfor terrenget.
        </template>
        <template v-else>
          Over horisonten nå. Se aldri på sola gjennom kikkert eller kamera uten
          godkjent solfilter.
        </template>
      </div>
      <div v-else-if="objekt.type === 'stjerne'" class="mt-1.5 text-[0.6875rem] text-white/70">
        Lysstyrke {{ komma(objekt.mag) }}<template v-if="objekt.stjernebilde">
        · hører til {{ objekt.stjernebilde.norsk }}
        <span class="italic text-white/70">{{ objekt.stjernebilde.latin }}</span></template>.
      </div>

      <!-- HVORFOR STÅR DEN ALENE? Dette er spørsmålet som ga hele funksjonen
           (v6.4.0): en skjerm med prikker uten streker leses som en feil. Svaret
           er at katalogen er lysstyrke-styrt mens figurene er håndplukket, og det
           skal stå i kortet — ikke bare i en CHANGELOG. -->
      <template v-if="objekt.type === 'stjerne' && objekt.stjernebilde && !objekt.tegnesFigur">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">
          Uten streker
        </div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">
          Lende tegner ikke figuren for {{ objekt.stjernebilde.norsk }}, så
          {{ objekt.navn }} står alene på himmelen. Stjerna er like fullt en av de
          sterkeste vi viser — himmelen her er valgt etter lysstyrke, mens
          stjernebildene er tegnet ett for ett.
        </p>
      </template>

      <!-- Det ene som er verdt å vite om stjerna. Teksten bor i stjerneFakta.js. -->
      <template v-if="objekt.type === 'stjerne' && objekt.fakta">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">Verdt å vite</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.fakta }}</p>
      </template>

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
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">
          {{ objekt.navn }} som globe
        </div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">
          {{ globeTekst.omtale }}
        </p>
      </template>

      <!-- Teksten for stjernebildene. -->
      <template v-if="objekt.info">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">Finn den</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.finnDen }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">Historien</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.mytologi }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">Verdt å vite</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.funFact }}</p>

        <!-- LES MER. Samme pille som legemene har, og samme resonnement: teksten
             over står i appen fordi bruksområdet er en kveld uten dekning, og
             lenka er veien videre for den som vil lese mer hjemme igjen.
             Stjernebildene har bare Wikipedia — SNL har ikke en artikkel per
             stjernebilde, så en pille dit ville vært et løfte vi ikke kan holde. -->
        <div v-if="objekt.info.wikipedia" class="mt-2 flex flex-wrap gap-1">
          <a :href="objekt.info.wikipedia" target="_blank" rel="noopener noreferrer"
             class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                    active:scale-95">Wikipedia ↗</a>
        </div>
      </template>

      <!-- ASTRONOMISKE FAKTA. Månen og alle planetene, også de uten globe.
           Nøkkeltallene står som EGNE linjer og ikke som et avsnitt: de leses ett
           for ett, i mørket, på en telefon. -->
      <template v-if="fakta">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">Fakta</div>
        <div class="text-[0.6875rem] leading-relaxed text-white/70">{{ fakta.type }}</div>
        <div v-if="maner" class="text-[0.6875rem] leading-relaxed text-white/70">{{ maner }}</div>
        <div class="text-[0.6875rem] leading-relaxed text-white/72">{{ fakta.oppdaget }}</div>
        <ul class="mt-1 space-y-0.5">
          <li v-for="f in fakta.fakta" :key="f"
              class="text-[0.6875rem] leading-relaxed text-white/70 flex gap-1.5">
            <span class="text-white/70 shrink-0" aria-hidden="true">·</span>
            <span>{{ f }}</span>
          </li>
        </ul>

        <!-- MENNESKETS UTFORSKNING. Årstall til venstre, hva som skjedde til
             høyre. Sammenlagt vises de fire nyeste; «vis alle» gir hele
             historien, eldst først. -->
        <div class="mt-2 flex items-baseline justify-between gap-2">
          <span class="text-[0.5625rem] uppercase tracking-wide text-white/70">Utforsket</span>
          <button v-if="fakta.utforskning.length > 4"
                  @click="visAllUtforskning = !visAllUtforskning"
                  class="text-[0.5625rem] text-white/70 active:scale-95">
            {{ visAllUtforskning ? 'vis mindre' : `alle ${fakta.utforskning.length}` }}
          </button>
        </div>
        <ul class="space-y-1">
          <li v-for="m in utforskning" :key="m.ar + m.tekst" class="flex gap-2">
            <span class="text-[0.625rem] font-medium text-white/75 shrink-0 tabular-nums
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
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/70">I nærheten</div>
        <div class="mt-1 flex flex-wrap gap-1">
          <button v-for="n in naboer" :key="n.id"
                  @click="emit('velg', n)"
                  :aria-label="`Hopp til ${n.navn}, ${Math.round(n.avstandGrader)} grader unna`"
                  class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                         active:scale-95 transition-colors">
            {{ IKON[n.type] }} {{ n.navn }}
            <span class="text-white/70">{{ Math.round(n.avstandGrader) }}°</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* BLINKENDE KRYSSHÅR NÅR KORTET BYTTER OBJEKT (v6.5.51).
   Fargen er `#ffe9a3` — nøyaktig den himmelen selv fremhever med (VALGT_LINJE i
   skyDome). Det er ikke pynt: kvitteringen skal peke på det som nettopp ble
   gult der oppe, og en fjerde farge ville bare vært en fjerde farge.

   Tre pulser og så slutt. Animasjonen er endelig med vilje — et krysshår som
   pulser videre ville lest som en varsling, ikke som «se her, dette er nytt».
   Restarten kommer fra `:key` og ikke fra en klasse som skrus av og på: en
   CSS-animasjon starter ikke forfra av at klassen settes på nytt i samme frame. */
@keyframes kryss-blink {
  0%, 100% { color: rgb(255 255 255 / 0.75); transform: scale(1); }
  50%      { color: #ffe9a3; transform: scale(1.22); }
}
.kryss-blink { animation: kryss-blink 0.52s ease-in-out 3; }

/* Redusert bevegelse: skalaen faller bort, fargen blir stående et øyeblikk.
   Kvitteringen er informasjon, så den skal ikke forsvinne helt — det er
   bevegelsen som er problemet, ikke beskjeden. */
@media (prefers-reduced-motion: reduce) {
  @keyframes kryss-blink-rolig {
    0%, 80% { color: #ffe9a3; }
    100%    { color: rgb(255 255 255 / 0.75); }
  }
  .kryss-blink { animation: kryss-blink-rolig 1.6s ease-out 1; }
}
</style>
