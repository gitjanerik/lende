<script setup>
// Drawer-fane «Preferanser» (v7.8.34) — FØRSTE fane, foran Detaljer.
//
// HVORFOR DEN FINNES: skuffa er bare innstillinger (v6.6.0), men fanene etter
// den delingen er alle KART-faner — Detaljer velger hvilke lag arket har, Stil
// hvordan de ser ut, Format hva NESTE kart blir, Eksport hvordan det kommer ut.
// Det som ikke handler om ett ark, men om hvordan appen oppfører seg for DEG,
// hadde ingen adresse: «Åpne i ny nettleser» endte i hovedmenyen sammen med
// tekststørrelsen, «Vis fulle navn» og «Navnetetthet» i Format sammen med
// bredde-slideren for nye kart, og de tre 3D-flaggene bak Utvikler-fana — som
// er SKJULT på demokartet, altså på det ene kartet en fersk bruker har.
//
// Regelen for hva som hører hit er derfor ikke «småting», men: gjelder valget
// MEG, eller gjelder det ARKET? Kompass-zoomen, lenke-målet og de tre
// demo-flaggene er alle det første. Navnetettheten har begge halvdelene i seg
// — den har sin egen «bruk på alle kart» — og det er nettopp derfor den hører
// her og ikke i en fane om formatet på neste kart.
//
// «Vis fulle navn» og «Navnetetthet» er FLYTTET, ikke kopiert: modellene er de
// samme refene i MapView, så et bytte her er samme bytte som før.
//
// ALLE BRYTERNE ER SAMME KOMPONENT (`PrefBryterRad`) FRA v7.8.35. Himmel-
// tvangen kom hit som en full-bredde flate med etiketten «… : PÅ» og en
// forklaring som bare sto når den var på — formen Utvikler-fana bruker på alt.
// I en liste med vippebrytere leses den som noe annet enn den er, og en tekst
// man først ser ETTER at man har trykket, kan ikke leses før man bestemmer seg.
import { computed } from 'vue'
import { DENSITY_PRESETS } from '../../composables/useLabelDensity.js'
import { useEksterneLenker } from '../../composables/useEksterneLenker.js'
import { useKompassNord } from '../../composables/useKompassNord.js'
import { useDemoFlagg, DEMO_NOKLER } from '../../composables/useDemoFlagg.js'
import PrefBryterRad from './PrefBryterRad.vue'

const showFullNames = defineModel('showFullNames', { type: Boolean, default: false })
const densityId = defineModel('densityId', { type: String, default: 'normal' })
const densityApplyToAll = defineModel('densityApplyToAll', { type: Boolean, default: true })

// Begge er modulnivå-singletons, så fana leser og skriver den samme tilstanden
// som kartet og hver utgående lenke. Ingen props, ingen kabling i MapView.
const { zoomUt: kompassZoomUt } = useKompassNord()
const { nyFane } = useEksterneLenker()

// De tre 3D-flaggene. Flyttet hit fra Utvikler-fana (v7.8.34/35), som er
// `userOnly` og derfor usynlig på demokartet — altså skjult for den som nettopp
// har åpnet appen og vil se på Saturn eller på et nordlys. Flaggene leses av
// 3D-viseren ved MONTERING, så et bytte slår inn neste gang 3D åpnes; det står
// i hver forklaring.
const { pa: himmelTvang } = useDemoFlagg(DEMO_NOKLER.himmelTvang)
const { pa: vaerDemo } = useDemoFlagg(DEMO_NOKLER.vaer)
const { pa: nordlysDemo } = useDemoFlagg(DEMO_NOKLER.nordlys)

// Står noen av demoene på, overstyrer de det ekte værvarselet. Det er verdt ÉN
// samlet linje under seksjonen framfor å gjenta «overstyrer varselet» i to
// forklaringer: den som har glemt en demo på, lurer på hvorfor været er feil.
const demoAktiv = computed(() => vaerDemo.value || nordlysDemo.value)
</script>

<template>
  <div>
    <!-- Kompassnåla nede til høyre. Default: trykket vender arket mot nord og
         rører ikke zoomen — se useKompassNord for hvorfor. -->
    <PrefBryterRad v-model="kompassZoomUt"
                   tittel="Zoom ut når du vender mot nord"
                   aria-av="Ikke zoom ut når du vender mot nord"
                   aria-pa="Zoom ut når du vender mot nord">
      Kompassnåla nede til høyre vender kartet mot nord. Av: zoomen står som den
      er, så du beholder nærbildet. På: kartet zoomes samtidig ut til hele arket
      vises. Hold nåla inne for å gjøre det motsatte av valget her, én gang.
    </PrefBryterRad>
    <!-- Flerspråklige navn (norsk - samisk - kvensk) i Nord-Norge.
         Default AV = vis kun det norske navnet for et renere kart. -->
    <PrefBryterRad v-model="showFullNames"
                   tittel="Vis fulle navn"
                   aria-av="Vis kun norske navn"
                   aria-pa="Vis fulle navn">
      I Nord-Norge har mange steder navn på norsk, samisk og kvensk. Av: vis kun
      det norske navnet (renere kart). På: vis hele det flerspråklige navnet.
      Søk finner alle språk uansett.
    </PrefBryterRad>
    <!-- Navnetetthet: rutenett-kvoten i tetthets-budsjettet. Lavere =
         roligere kart, høyere = flere navn. Byttes live (vrakes på nytt).
         IKKE en `PrefBryterRad`: den bærer et VALG av tre og ikke av/på, og
         har sin egen bryter inni. -->
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
         URL-stripa blir stående nede i hjørnet etterpå. -->
    <PrefBryterRad v-model="nyFane"
                   tittel="Åpne i ny nettleser"
                   aria-av="Åpne eksterne lenker i samme fane"
                   aria-pa="Åpne eksterne lenker i ny nettleser">
      Gjelder alle lenker ut av appen — ut.no, kulturminnesok.no, NVE,
      Naturbase, Wikipedia og SNL. Av: samme fane, og telefonens tilbake-knapp
      fører rett hjem til kartet. På: eget vindu, som er poenget på en stor
      skjerm.
    </PrefBryterRad>

    <!-- ── 3D-demoer, NEDERST ─────────────────────────────────────────────
         Egen seksjon fordi de tre ikke stiller inn appen — de viser fram noe
         man ellers må vente på: månen og planetene er under horisonten store
         deler av året, været er det været er, og et synlig nordlys over
         Sør-Norge er noen netter i året. De hører i Preferanser fordi de
         gjelder DEG og ikke arket, men nederst fordi man ikke rører dem ofte. -->
    <div class="mt-4 mb-1.5 text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
      Demo i 3D
    </div>
    <PrefBryterRad v-model="himmelTvang"
                   tittel="Tvungne himmellegemer"
                   aria-av="Slå av tvungne himmellegemer i 3D"
                   aria-pa="Slå på tvungne himmellegemer i 3D">
      Nattmodus viser månen, Mars, Jupiter og Saturn selv når de står under
      horisonten, så de fire globene kan prøves når som helst. De står i en
      stige — Mars 30°, månen 35°, Jupiter 40°, Saturn 45° — så de ikke lander
      oppå hverandre. Trykk på et av dem for nærbildet. Merkur og Venus følger
      de ekte reglene; de har ingen globe. Azimut, fase, avstand og lysstyrke er
      fortsatt de ekte — bare høyden er løftet.
      <strong class="text-ink-2">Sola løftes ikke</strong>, og det er med vilje:
      den er alltid i lista og alltid til å åpne, og står den under horisonten
      er det nettopp da den er verdt å se — under terrengarket, der den faktisk
      er. Bryteren finnes for legemer man ellers må vente på.
    </PrefBryterRad>
    <PrefBryterRad v-model="vaerDemo"
                   tittel="Vær-demo"
                   aria-av="Slå av vær-demo i 3D"
                   aria-pa="Slå på vær-demo i 3D">
      Værtypene spilles i rekkefølge, 10 s hver, med «neste» for å hoppe videre.
      Finnes fordi flere av uttrykkene er ren bevegelse — vinddrift, lyn-blink,
      fallende nedbør — og ikke kan vurderes på et stillbilde.
    </PrefBryterRad>
    <PrefBryterRad v-model="nordlysDemo"
                   tittel="Nordlys-demo"
                   aria-av="Slå av nordlys-demo i 3D"
                   aria-pa="Slå på nordlys-demo i 3D">
      Slå på NATT i 3D: styrkene spilles i rekkefølge, 14 s hver, fra et svakt
      slør lavt i nord til et som fyller himmelen. Siste steg viser samme styrke
      lenger nord, så du ser at høyden over horisonten faktisk regnes ut. Finnes
      fordi et synlig nordlys over Sør-Norge er noen netter i året.
    </PrefBryterRad>
    <p class="text-[10px] text-ink-4 leading-snug mb-2 px-1">
      Alle tre leses når 3D åpnes, så et bytte slår inn neste gang du går inn i
      3D-visningen.<span v-if="demoAktiv" class="text-amber-300/90">
      Vær- og nordlys-demoen overstyrer det ekte varselet så lenge de står på.</span>
    </p>
  </div>
</template>
