<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { APP_VERSION } from '../version.js'

const router = useRouter()

// To faner — én per hovedfunksjon. Innholdet beskriver hva som er laget,
// hvilken teknikk som brukes og hvilke datakilder/rammeverk som ligger bak.
const tab = ref('turkart')
</script>

<template>
  <div class="kart-ui min-h-screen bg-zinc-950 text-white/85">
    <!-- Header med tilbake-knapp (samme drakt som Tegnforklaring). -->
    <header class="sticky top-0 z-10 backdrop-blur bg-zinc-950/85 border-b border-white/10">
      <div class="px-4 py-3 flex items-center gap-3">
        <button @click="router.back()" aria-label="Tilbake"
                class="w-9 h-9 rounded-full flex items-center justify-center bg-white/10
                       text-white/80 active:scale-95 transition shrink-0">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 class="text-lg font-semibold flex-1">Om Så i lende</h1>
      </div>
    </header>

    <div class="px-4 py-6 max-w-2xl mx-auto space-y-8 pb-24">

      <!-- Innledning: logoen + symbolikk + navnets språklige opphav. -->
      <section class="flex flex-col items-center text-center gap-4">
        <div class="w-24 h-24 rounded-[22px] overflow-hidden shadow-lg ring-1 ring-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-full h-full">
            <rect width="512" height="512" fill="#1b1e24"/>
            <defs>
              <path id="om-blob" d="M0,-100 C58,-100 100,-58 97,-4 C94,50 58,99 2,97 C-54,95 -99,52 -97,-2 C-99,-56 -58,-100 0,-100 Z"/>
            </defs>
            <g fill="none" stroke="#ffd84a" stroke-linejoin="round">
              <use href="#om-blob" transform="translate(252,272) scale(1.55)" stroke-width="5.81"/>
              <use href="#om-blob" transform="translate(255,263) scale(1.18)" stroke-width="7.63"/>
              <use href="#om-blob" transform="translate(259,252) scale(0.84)" stroke-width="10.7"/>
              <use href="#om-blob" transform="translate(266,240) scale(0.50)" stroke-width="18"/>
            </g>
            <circle cx="272" cy="231" r="13" fill="#ffd84a"/>
          </svg>
        </div>
        <h2 class="text-2xl font-semibold text-white">Så i lende</h2>
        <p class="text-[13px] leading-relaxed text-white/60">
          Turkart og ruteplanlegging bygget fra ekte kartdata, rendret som
          print-kvalitets vektorkart rett i nettleseren.
        </p>
      </section>

      <!-- Symbolikk: hva ikonet betyr. -->
      <section class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-white/55">Ikonet</h3>
        <p class="text-[13px] leading-relaxed text-white/70">
          Merket er en <strong class="text-white/90">høydekurve</strong> — kartets
          eldste språk. Hver gule ring binder sammen punkter i samme høyde, slik at
          konsentriske ringer tegner en ås eller topp sett rett ovenfra: jo tettere
          ringene ligger, desto brattere er lia. Prikken øverst er selve toppunktet.
          Det samme prinsippet bærer hele turkartet — terrengets form leses ut av
          kurvene, ikke ut av skygge eller bilde.
        </p>
      </section>

      <!-- Navnets opphav. -->
      <section class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-white/55">Navnet</h3>
        <p class="text-[13px] leading-relaxed text-white/70">
          «Så i lende» er et gammelt norsk uttrykk som betyr omtrent
          <em>så langt øyet rekker</em> eller <em>vidt omkring</em> — brukt i
          landskapsskildringer, som i «det var skog så i lende».
        </p>
        <p class="text-[13px] leading-relaxed text-white/70">
          <strong class="text-white/90">Lende</strong>
          betyr terreng eller landstrekning, beslektet med norrønt <em>lendi</em> —
          «land», «jordstykke». Opprinnelig beskrev uttrykket noe som strakte seg
          utover landskapet; etter hvert ble det et fast idiom for <em>overalt</em>,
          <em>så langt man kan se</em>.
        </p>
        <blockquote class="border-l-2 border-[#ffd84a]/70 pl-3 text-[13px] leading-relaxed
                           text-white/80 italic">
          Det er altså et uttrykk med røtter i norrønt språk, der lende viser til
          terrenget, og hele uttrykket maler et bilde av noe som brer seg utover
          landskapet.
        </blockquote>
      </section>

      <!-- Mer enn bare kart: long-press-oppslagene. -->
      <section class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-white/55">Mer enn bare kart</h3>
        <p class="text-[13px] leading-relaxed text-white/70">
          Hold fingeren på et punkt på kartet, så henter Lende fakta om stedet fra
          åpne kilder: stedsnavn og leksikon-ingress fra
          <strong class="text-white/90">Store norske leksikon</strong> og
          <strong class="text-white/90">Wikipedia</strong>, arter og rødliste-status
          fra <strong class="text-white/90">Artsdatabanken</strong>, naturtyper og
          verneområder, og vann-data fra <strong class="text-white/90">NVE</strong>.
          Kulturminne-markørene (fra <strong class="text-white/90">Kulturminnesøk</strong>)
          og fredede minner kan trykkes for detaljer og lenker videre.
        </p>
        <p class="text-[13px] leading-relaxed text-white/70">
          Slår du på kartlaget <strong class="text-white/90">Vannmålestasjoner</strong>
          dukker NVEs hydrologiske stasjoner i området opp som blå dråper — trykk
          for sanntids vannføring, vannstand og temperatur, med lenke videre til
          <strong class="text-white/90">NVE</strong>.
        </p>
        <p class="text-[13px] leading-relaxed text-white/70">
          Det gjør turen til litt av en oppdagelsesferd — hva heter tjernet, hva
          slags skog går du gjennom, hvor kaldt er elva? En morsom måte å orientere
          seg og bli kjent med landskapet du beveger deg i.
        </p>
        <p class="text-[12px] leading-relaxed text-sky-100/70 border-t border-white/10 pt-2.5 mt-1">
          💾 <strong class="text-white/90">Fungerer offline:</strong> kartene du lager
          lagres på enheten og virker uten dekning. Å bygge et <em>nytt</em> kart
          krever nett — så last ned områdene du skal til mens du har mobildata,
          før du drar dit dekningen tar slutt.
        </p>
      </section>

      <!-- Faner: én per hovedfunksjon. -->
      <section class="space-y-4">
        <div class="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          <button @click="tab = 'turkart'"
                  class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
                  :class="tab === 'turkart' ? 'bg-[#ffd84a] text-zinc-900' : 'text-white/60 active:text-white/90'">
            Turkart
          </button>
          <button @click="tab = 'rute'"
                  class="flex-1 py-2 rounded-lg text-[13px] font-medium transition"
                  :class="tab === 'rute' ? 'bg-[#ffd84a] text-zinc-900' : 'text-white/60 active:text-white/90'">
            Ruteplanlegger
          </button>
        </div>

        <!-- Turkart-fanen. -->
        <div v-if="tab === 'turkart'" class="space-y-4">
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-white/85">Hva det er</h3>
            <p class="text-[13px] leading-relaxed text-white/70">
              Et ISOM 2017-2-inspirert sportskart som bygges på sekunder for et
              hvilket som helst punkt i Norge. Terreng, vann, vegetasjon, stier og
              veier settes sammen til ett lesbart turkart i print-kvalitet — og
              hele kartet er <strong class="text-white/90">vektor</strong> (SVG),
              så det er knivskarpt uansett zoom og klar for utskrift i 1:10 000.
            </p>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-white/85">Teknikken</h3>
            <ul class="text-[13px] leading-relaxed text-white/70 space-y-1.5 list-disc pl-5">
              <li><strong class="text-white/90">Høydekurver</strong> beregnes fra Kartverkets
                høydemodell (WCS DTM) med d3-contour, glattet med Chaikin og forenklet
                med Douglas–Peucker.</li>
              <li><strong class="text-white/90">Vegetasjon</strong> klassifiseres fra
                canopy-høyden (DOM − DTM) — skog, åpen mark og tett vegetasjon skilles
                ut av selve trehøyden, ikke bare av kart-tags.</li>
              <li><strong class="text-white/90">Stier, veier og bygg</strong> hentes fra
                OpenStreetMap (Overpass), <strong class="text-white/90">vann og kyst</strong>
                fra DEM-en, N50 og Sjøkart.</li>
              <li>Alt symboliseres via en datadrevet ISOM-katalog og rendres som ett
                skalerbart SVG med zoom-trappet detaljnivå og togglebare kartlag.</li>
            </ul>
          </div>
        </div>

        <!-- Ruteplanlegger-fanen. -->
        <div v-else class="space-y-4">
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-white/85">Hva det er</h3>
            <p class="text-[13px] leading-relaxed text-white/70">
              En planlegger for grus- og stiruter: sett start og mål, få et forslag
              langs sti- og grusnettet med <strong class="text-white/90">høydeprofil</strong>,
              cue-liste og lengde — og eksporter hele turen som
              <strong class="text-white/90">GPX</strong> til klokke eller GPS.
            </p>
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-white/85">Teknikken</h3>
            <ul class="text-[13px] leading-relaxed text-white/70 space-y-1.5 list-disc pl-5">
              <li>Sti- og veinettet bygges til en graf med <strong class="text-white/90">graphology</strong>
                og korteste vei beregnes over den.</li>
              <li><strong class="text-white/90">BRouter</strong> gir grus-vennlig ruting der
                nettet er godt kartlagt, med et grus-overlegg som farger underlaget.</li>
              <li>Høydeprofilen leses ut av samme DEM som turkartet, og hele ruten kan
                gjøres om til et turkart sentrert på strekket.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Rammeverk, kilder og copyright. -->
      <section class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-white/55">
          Rammeverk &amp; kilder
        </h3>
        <p class="text-[13px] leading-relaxed text-white/70">
          Bygget med <strong class="text-white/90">Vue 3</strong>, <strong class="text-white/90">Vite</strong>
          og <strong class="text-white/90">Tailwind CSS</strong>. Kartgeometri behandles med
          d3-contour, polygon-clipping og graphology. Appen kjører fullt og helt i
          nettleseren som en installerbar PWA — ingen egen server, ingen konto.
        </p>
        <div class="text-[12px] leading-relaxed text-white/55 space-y-1 pt-1 border-t border-white/10">
          <p>Kartdata © <strong class="text-white/75">OpenStreetMap</strong>-bidragsytere (ODbL).</p>
          <p>Høydemodell, N50 og sjøkart: <strong class="text-white/75">Kartverket</strong> (NLOD / CC BY 4.0).</p>
          <p>Verneområder og artsdata: Naturbase, NVE og GBIF.</p>
          <p class="pt-1">Privat, ikke-kommersielt hobbyprosjekt. Kart fra appen er
            ikke godkjent for navigasjon til sjøs eller i nødsituasjoner.</p>
        </div>
        <p class="text-[11px] text-white/35 pt-1">Versjon {{ APP_VERSION }}</p>
      </section>

    </div>
  </div>
</template>
