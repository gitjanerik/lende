<script setup>
// Drawer-fane «Preferanser» (v7.8.34) — FØRSTE fane, foran Detaljer.
//
// HVORFOR DEN FINNES: skuffa er bare innstillinger (v6.6.0), men fanene etter
// den delingen er alle KART-fliser — Detaljer velger hvilke lag arket har, Stil
// hvordan de ser ut, Format hva NESTE kart blir, Eksport hvordan det kommer ut.
// Det som ikke handler om ett ark, men om hvordan appen oppfører seg for DEG,
// hadde ingen adresse: «Åpne i ny nettleser» endte i hovedmenyen sammen med
// tekststørrelsen, «Vis fulle navn» og «Navnetetthet» i Format sammen med
// bredde-slideren for nye kart, og himmel-tvangen bak Utvikler-fana — som er
// SKJULT på demokartet, altså på det ene kartet en fersk bruker har.
//
// Regelen for hva som hører hit er derfor ikke «småting», men: gjelder valget
// MEG, eller gjelder det ARKET? Kompass-zoomen, lenke-målet og himmel-tvangen
// er alle det første. Navnetettheten har begge halvdelene i seg — den har sin
// egen «bruk på alle kart» — og det er nettopp derfor den hører her og ikke i
// en fane om formatet på neste kart.
//
// «Vis fulle navn» og «Navnetetthet» er FLYTTET, ikke kopiert: modellene er de
// samme refene i MapView, så et bytte her er samme bytte som før.
import { ref } from 'vue'
import { DENSITY_PRESETS } from '../../composables/useLabelDensity.js'
import { useEksterneLenker } from '../../composables/useEksterneLenker.js'
import { useKompassNord } from '../../composables/useKompassNord.js'

const showFullNames = defineModel('showFullNames', { type: Boolean, default: false })
const densityId = defineModel('densityId', { type: String, default: 'normal' })
const densityApplyToAll = defineModel('densityApplyToAll', { type: Boolean, default: true })

// Begge er modulnivå-singletons, så fana leser og skriver den samme tilstanden
// som kartet og hver utgående lenke. Ingen props, ingen kabling i MapView.
const { zoomUt: kompassZoomUt } = useKompassNord()
const { nyFane } = useEksterneLenker()

// Tvungne himmellegemer i 3D. Flyttet hit fra Utvikler-fana (v7.8.34), som er
// `userOnly` og derfor usynlig på demokartet — altså skjult for den som nettopp
// har åpnet appen og vil se på Saturn. Flagget leses av 3D-viseren ved MONTERING
// (samme mønster som vær-demoen), så det er en ref med egen skriving og ikke en
// delt singleton: en reaktiv kilde ville lovet et bytte midt i en 3D-økt.
const HIMMEL_TVANG_KEY = 'lende-3d-himmel-tvang'
const himmelTvang = ref((() => {
  try { return localStorage.getItem(HIMMEL_TVANG_KEY) === '1' } catch { return false }
})())
function toggleHimmelTvang() {
  himmelTvang.value = !himmelTvang.value
  try { localStorage.setItem(HIMMEL_TVANG_KEY, himmelTvang.value ? '1' : '0') } catch { /* privat modus */ }
}
</script>

<template>
  <div>
    <!-- Kompassnåla nede til høyre. Default: trykket vender arket mot nord og
         rører ikke zoomen — se useKompassNord for hvorfor. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Zoom ut når du vender mot nord</div>
        <div class="text-[11px] text-ink-3 leading-snug">
          Kompassnåla nede til høyre vender kartet mot nord. Av: zoomen står
          som den er, så du beholder nærbildet. På: kartet zoomes samtidig ut
          til hele arket vises.
        </div>
      </div>
      <button type="button" role="switch" :aria-checked="kompassZoomUt"
              @click="kompassZoomUt = !kompassZoomUt"
              :aria-label="kompassZoomUt
                           ? 'Ikke zoom ut når du vender mot nord'
                           : 'Zoom ut når du vender mot nord'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="kompassZoomUt ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="kompassZoomUt ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Flerspråklige navn (norsk - samisk - kvensk) i Nord-Norge.
         Default AV = vis kun det norske navnet for et renere kart.
         PÅ = vis hele det flerspråklige navnet. Søk finner alle språk
         uansett. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Vis fulle navn</div>
        <div class="text-[11px] text-ink-3 leading-snug">
          I Nord-Norge har mange steder navn på norsk, samisk og kvensk.
          Av: vis kun det norske navnet (renere kart). På: vis hele det
          flerspråklige navnet. Søk finner alle språk uansett.
        </div>
      </div>
      <button @click="showFullNames = !showFullNames"
              :aria-pressed="showFullNames"
              :aria-label="showFullNames ? 'Vis kun norske navn' : 'Vis fulle navn'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="showFullNames ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="showFullNames ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Navnetetthet: rutenett-kvoten i tetthets-budsjettet. Lavere =
         roligere kart, høyere = flere navn. Byttes live (vrakes på nytt). -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-ink font-medium mb-2">Navnetetthet</div>
      <div class="flex gap-2" role="group" aria-label="Navnetetthet">
        <button v-for="p in DENSITY_PRESETS" :key="p.id" @click="densityId = p.id"
                :aria-pressed="densityId === p.id"
                class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                :class="densityId === p.id ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
          {{ p.label }}
        </button>
      </div>
      <div class="text-[11px] text-ink-3 leading-snug mt-1.5">
        Hvor mange navn som vises samtidig. Kartet avdekker flere når du zoomer inn;
        topp, vann og område prioriteres, og et søketreff vises alltid.
      </div>
      <!-- PÅ: tettheten gjelder konsekvent for alle kart. AV: valget over
           gjelder kun kartet du ser på nå (per-kart-overstyring). -->
      <label class="flex items-center justify-between gap-3 mt-3 cursor-pointer">
        <span class="text-[12px] text-ink-2 leading-snug">
          Bruk på alle kart
          <span class="block text-[11px] text-ink-4">
            {{ densityApplyToAll ? 'Samme tetthet overalt' : 'Gjelder kun dette kartet' }}
          </span>
        </span>
        <button type="button" role="switch" :aria-checked="densityApplyToAll"
                @click="densityApplyToAll = !densityApplyToAll"
                class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                :class="densityApplyToAll ? 'bg-emerald-500' : 'bg-ink/15'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                :class="densityApplyToAll ? 'left-5' : 'left-0.5'" />
        </button>
      </label>
    </div>
    <!-- Eksterne lenker (flyttet fra hovedmenyen i v7.8.34). Se
         useEksterneLenker for hvorfor AV er standard: en `_blank`-åpning fra en
         installert PWA legger seg i et minimalt nettleser-lag oppå appen, og
         URL-stripa blir stående nede i hjørnet etterpå. Etiketten sier hva PÅ
         gjør, ikke hva bryteren heter — det er handlingen man velger. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-ink font-medium">Åpne i ny nettleser</div>
        <div class="text-[11px] text-ink-3 leading-snug">
          Gjelder alle lenker ut av appen — ut.no, kulturminnesok.no, NVE,
          Naturbase, Wikipedia og SNL. Av: samme fane, og telefonens
          tilbake-knapp fører rett hjem til kartet. På: eget vindu, som er
          poenget på en stor skjerm.
        </div>
      </div>
      <button type="button" role="switch" :aria-checked="nyFane"
              @click="nyFane = !nyFane"
              :aria-label="nyFane
                           ? 'Åpne eksterne lenker i samme fane'
                           : 'Åpne eksterne lenker i ny nettleser'"
              class="relative w-11 h-6 rounded-full transition-colors shrink-0"
              :class="nyFane ? 'bg-emerald-500' : 'bg-ink/15'">
        <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              :class="nyFane ? 'left-5' : 'left-0.5'" />
      </button>
    </div>
    <!-- Tvungne himmellegemer i 3D: månen, Mars, Jupiter og Saturn er under
         horisonten store deler av tida, og da kan ikke globene prøves. -->
    <button @click="toggleHimmelTvang"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-1"
            :class="himmelTvang
                    ? 'bg-amber-300/25 border-amber-300/50 text-ink'
                    : 'bg-ink/5 border-ink/10 text-ink-2'">
      {{ himmelTvang ? 'Tvungne himmellegemer i 3D: PÅ' : 'Tvungne himmellegemer i 3D' }}
    </button>
    <div v-if="himmelTvang" class="text-[10px] text-ink-3 leading-relaxed mb-3 px-1">
      Nattmodus viser månen, Mars, Jupiter og Saturn selv når de står under
      horisonten, så de fire globene kan prøves når som helst. De står i en
      stige — Mars 30°, månen 35°, Jupiter 40°, Saturn 45° — så de ikke lander
      oppå hverandre. Trykk på et av dem for nærbildet. Merkur og Venus følger de
      ekte reglene; de har ingen globe. Azimut, fase, avstand og lysstyrke er
      fortsatt de ekte — bare høyden er løftet.
      <strong class="text-ink-2">Sola løftes ikke</strong>, og det er med vilje:
      den er alltid i lista og alltid til å åpne, og står den under horisonten er
      det nettopp da den er verdt å se — under terrengarket, der den faktisk er.
      Bryteren finnes for legemer man ellers må vente på.
      Åpne 3D på nytt for at valget skal slå inn.
    </div>
  </div>
</template>
