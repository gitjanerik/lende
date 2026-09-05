<script setup>
import { ref, computed } from 'vue'
import { APP_VERSION } from '../version.js'
import { usePwaInstall } from '../composables/usePwaInstall.js'

// Innholdet i «Om Så i lende» — delt mellom ruten /om (AboutView, som holder
// deep-lenker og offline-kravet i live) og AboutModal, som hovedmenyen åpner
// oppå seg selv. Verten eier ramme, padding og tekst-skalering; her ligger bare
// seksjonene.

// To faner — én per hovedfunksjon. Innholdet beskriver hva som er laget,
// hvilken teknikk som brukes og hvilke datakilder/rammeverk som ligger bak.
const tab = ref('turkart')

// ── «Installer som app» ───────────────────────────────────────────────────
// Tilbys rett under innledningen. Knappen vises når nettleseren har fyrt av
// beforeinstallprompt (Chrome/Edge/Android → canInstall) eller på iOS (der
// install er manuell via Del-menyen). Skjules når appen alt kjører installert.
const { canInstall, isIOS, isStandalone, promptInstall } = usePwaInstall()
const showInstallButton = computed(() => !isStandalone.value && (canInstall.value || isIOS.value))

async function onInstallClick() {
  if (isIOS.value) {
    alert('Slik installerer du Lende på iPhone/iPad:\n\n1. Trykk Del-ikonet nederst i Safari.\n2. Velg «Legg til på Hjem-skjerm».')
    return
  }
  if (!canInstall.value) return
  if (!confirm('Installer Lende som webapp?')) return
  try {
    await promptInstall()
  } catch { /* avvist eller utilgjengelig — ingen handling */ }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Innledning: logoen + symbolikk + navnets språklige opphav. -->
    <section class="flex flex-col items-center text-center gap-4">
      <div class="w-24 h-24 rounded-[22px] overflow-hidden shadow-lg ring-1 ring-ink/10">
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
      <h2 class="text-2xl font-semibold text-ink">Så i lende</h2>
      <p class="text-[13px] leading-relaxed text-ink-3">
        Turkart og ruteplanlegging bygget fra
        <strong class="font-semibold text-ink-2">ymse kartdata</strong>.
        Turkartene bygges som print-kvalitets vektorkart rett i nettleseren,
        og ruteplanleggeren tar deg
        <strong class="font-semibold text-ink-2">ut i lende</strong>
        med stil – med mest mulig grusvei fra A til B.
      </p>

      <!-- «Installer som app»: rett under innledningen, vises kun når appen
           ikke alt kjører installert (standalone) og nettleseren tilbyr
           install (Chrome/Edge/Android → canInstall) eller på iOS (manuell
           veiledning). Samme diskrete outline-stil og tekst som forsiden. -->
      <button v-if="showInstallButton"
              @click="onInstallClick"
              class="w-full mt-1 py-3 rounded-xl bg-ink/[0.06] border border-ink/20
                     text-ink text-[14px] font-medium flex items-center justify-center gap-2
                     active:bg-ink/[0.1] active:scale-[0.99] transition">
        <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>
        </svg>
        <span>Installer som app</span>
      </button>
    </section>

    <!-- Symbolikk: hva ikonet betyr. -->
    <section class="rounded-2xl bg-ink/5 border border-ink/10 p-4 space-y-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-3">Ikonet</h3>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Merket er en <strong class="text-ink">høydekurve</strong> — kartets
        eldste språk. Hver gule ring binder sammen punkter i samme høyde, slik at
        konsentriske ringer tegner en ås eller topp sett rett ovenfra: jo tettere
        ringene ligger, desto brattere er lia. Prikken øverst er selve toppunktet.
        Det samme prinsippet bærer hele turkartet — terrengets form leses ut av
        kurvene, ikke ut av skygge eller bilde.
      </p>
    </section>

    <!-- Navnets opphav. -->
    <section class="rounded-2xl bg-ink/5 border border-ink/10 p-4 space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-3">Navnet</h3>
      <p class="text-[13px] leading-relaxed text-ink-2">
        «Så i lende» er et gammelt norsk uttrykk som betyr omtrent
        <em>så langt øyet rekker</em> eller <em>vidt omkring</em> — brukt i
        landskapsskildringer, som i «det var skog så i lende».
      </p>
      <p class="text-[13px] leading-relaxed text-ink-2">
        <strong class="text-ink">Lende</strong>
        betyr terreng eller landstrekning, beslektet med norrønt <em>lendi</em> —
        «land», «jordstykke». Opprinnelig beskrev uttrykket noe som strakte seg
        utover landskapet; etter hvert ble det et fast idiom for <em>overalt</em>,
        <em>så langt man kan se</em>.
      </p>
      <blockquote class="border-l-2 border-[#ffd84a]/70 pl-3 text-[13px] leading-relaxed
                         text-ink-2 italic">
        Det er altså et uttrykk med røtter i norrønt språk, der lende viser til
        terrenget, og hele uttrykket maler et bilde av noe som brer seg utover
        landskapet.
      </blockquote>
    </section>

    <!-- Mer enn bare kart: long-press-oppslagene. -->
    <section class="rounded-2xl bg-ink/5 border border-ink/10 p-4 space-y-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-3">Mer enn bare kart</h3>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Hold fingeren på et punkt på kartet, så henter Lende fakta om stedet fra
        åpne kilder: stedsnavn og leksikon-ingress fra
        <strong class="text-ink">Store norske leksikon</strong> og
        <strong class="text-ink">Wikipedia</strong>, arter og rødliste-status
        fra <strong class="text-ink">Artsdatabanken</strong>, naturtyper og
        verneområder, vann-data fra <strong class="text-ink">NVE</strong>, og
        værvarsel fra <strong class="text-ink">MET Norway</strong>.
        Kulturminne-markørene (fra <strong class="text-ink">Kulturminnesøk</strong>)
        og fredede minner kan trykkes for detaljer og lenker videre.
      </p>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Slår du på kartlaget <strong class="text-ink">Vannmålestasjoner</strong>,
        dukker NVEs hydrologiske stasjoner opp som blå medaljonger med hvite bølger. Trykk på en, så
        henter Lende siste <strong class="text-ink">vannføring, vannstand og
        vanntemperatur</strong> fra NVE HydAPI, med lenke videre til stasjonens side.
      </p>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Det gjør turen til litt av en oppdagelsesferd — hva heter tjernet, hva
        slags skog går du gjennom, hvor kaldt er elva? En morsom måte å orientere
        seg og bli kjent med landskapet du beveger deg i.
      </p>
      <p class="text-[12px] leading-relaxed text-sky-100/70 border-t border-ink/10 pt-2.5 mt-1">
        <strong class="text-ink">Fungerer offline:</strong> kartene du lager
        lagres på enheten og virker uten dekning. Å bygge et <em>nytt</em> kart
        krever nett — så last ned områdene du skal til mens du har mobildata,
        før du drar dit dekningen tar slutt.
      </p>
    </section>

    <!-- Skjermen: rotasjon + tekststørrelse. Begge er tilgjengelighet, og
         begge er ting man ikke finner uten at noen sier det. -->
    <section class="rounded-2xl bg-ink/5 border border-ink/10 p-4 space-y-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-3">Skjermen</h3>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Lende kan brukes både <strong class="text-ink">stående og liggende</strong>,
        også som installert app. Kartarket er kvadratisk (2 × 2 km), så liggende
        gir deg mer av det i bredden — nyttig på sykkelstyret, i bilholderen, i
        3D-visningen og på høydeprofilen. Stående gir mest plass til lange
        infokort og til tastaturet når du søker.
      </p>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Prisen for at rotasjon er skrudd på, er at telefonen kan snu når du ikke
        vil — typisk når du går med den i hånda. Vil du unngå det, lås
        skjermretningen i telefonens egne hurtiginnstillinger; Lende følger
        låsen. Vi lar altså <em>deg</em> bestemme framfor å bestemme for deg:
        en app som er låst til én retning stenger ute den som ikke kan holde
        telefonen den veien.
      </p>
      <p class="text-[13px] leading-relaxed text-ink-2">
        <strong class="text-ink">Tekststørrelse</strong> settes i hovedmenyen
        (100–200 %), og fra <strong class="text-ink">A-knappen</strong> i
        toppen av hvert infopanel — den viser hvilken størrelse du står på og går
        ett hakk opp for hvert trykk, med runding tilbake til 100 %.
      </p>
    </section>

    <!-- Faner: én per hovedfunksjon. -->
    <section class="space-y-4">
      <!-- flex-wrap fra v6.5.1: med tre faner er «Ruteplanlegger» for bred til
           at raden holder på én linje ved 150 % tekstskalering. Da er det bedre
           at raden brytes enn at etikettene forkortes. -->
      <div class="flex flex-wrap gap-1 p-1 rounded-xl bg-ink/5 border border-ink/10">
        <button @click="tab = 'turkart'"
                class="flex-1 min-w-[6rem] py-2 rounded-lg text-[13px] font-medium transition"
                :class="tab === 'turkart' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink-3 active:text-ink'">
          Turkart
        </button>
        <button @click="tab = 'fritt'"
                class="flex-1 min-w-[6rem] py-2 rounded-lg text-[13px] font-medium transition"
                :class="tab === 'fritt' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink-3 active:text-ink'">
          Fritt lende
        </button>
        <button @click="tab = 'rute'"
                class="flex-1 min-w-[6rem] py-2 rounded-lg text-[13px] font-medium transition"
                :class="tab === 'rute' ? 'bg-[#ffd84a] text-zinc-900' : 'text-ink-3 active:text-ink'">
          Ruteplanlegger
        </button>
      </div>

      <!-- Turkart-fanen. -->
      <div v-if="tab === 'turkart'" class="space-y-4">
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Hva det er</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Et ISOM 2017-2-inspirert sportskart som bygges på sekunder for et
            hvilket som helst punkt i Norge. Terreng, vann, vegetasjon, stier og
            veier settes sammen til ett lesbart turkart i print-kvalitet — og
            hele kartet er <strong class="text-ink">vektor</strong> (SVG),
            så det er knivskarpt uansett zoom og klar for utskrift i 1:10 000.
          </p>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Teknikken</h3>
          <ul class="text-[13px] leading-relaxed text-ink-2 space-y-1.5 list-disc pl-5">
            <li><strong class="text-ink">Høydekurver</strong> beregnes fra Kartverkets
              høydemodell (WCS DTM) med d3-contour, glattet med Chaikin og forenklet
              med Douglas–Peucker.</li>
            <li><strong class="text-ink">Vegetasjon</strong> klassifiseres fra
              canopy-høyden (DOM − DTM) — skog, åpen mark og tett vegetasjon skilles
              ut av selve trehøyden, ikke bare av kart-tags.</li>
            <li><strong class="text-ink">Stier, veier og bygg</strong> hentes fra
              OpenStreetMap (Overpass), <strong class="text-ink">vann og kyst</strong>
              fra DEM-en, N50 og Sjøkart.</li>
            <li>Alt symboliseres via en datadrevet ISOM-katalog og rendres som ett
              skalerbart SVG med zoom-trappet detaljnivå og togglebare kartlag.</li>
          </ul>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Kartet i 3D</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Trykk <strong class="text-ink">3D</strong> i snarvei-raden, og hele
            kartet reiser seg som terreng: du ser utsnittet fra sentrum med utsyn
            nordover, i sakte rotasjon til du tar over med fingeren. Slår du på
            <strong class="text-ink">Sti</strong>, lyser stinettet opp så du
            ser hvor det går an å gå, og
            <strong class="text-ink">trykker du på en sti, følger kameraet
            den</strong> — i kryss fortsetter turen automatisk rett fram, eller du
            velger en annen gren når krysset meldes. Topper, vann, hytter,
            kulturminner og NVEs målestasjoner står som fargekodede knappenåler
            (lilla for automatisk fredede kulturminner, grått for uavklarte —
            samme farger som i kartet); trykk på en nål og kameraet flyr dit.
            Hvilke nåler som vises styrer du fra panelet oppe til høyre, og tette
            klynger tynnes automatisk så kartet aldri oversvømmes.
          </p>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Natthimmelen — og stjernekikkeren</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Sol/måne-knappen oppe til venstre har to stillinger: dag og natt.
            3D-visningen <strong class="text-ink">åpner i den himmelen som
            faktisk er ute</strong> — står sola under horisonten der kartet
            ligger, starter du i natt. Om dagen vises alltid værvarselet.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            <strong class="text-ink">Natt er stjernekikkeren.</strong> Blikket
            løftes opp i himmelen av seg selv, kurver, stier og knappenåler tas
            bort, og alt overlegget forsvinner — igjen står sol/måne-knappen,
            X-en, og mellom dem et søkefelt som også er en nedtrekksliste over det
            som virkelig er over horisonten her og nå: 18 stjernebilder, de
            synlige planetene og månen. Velg ett, eller trykk rett på det i
            himmelen, og stjernene og strekene lyser opp mens kameraet retter
            blikket dit. Infokortet gir navn, latinsk navn, hvor mange stjerner
            figuren har, hvordan du finner den, mytologien bak — og snarveier til
            naboene, som er den beste måten å lære seg en himmel. Kortet kan
            legges sammen til én linje når teksten dekker det du vil se på, og et
            hopp til en nabo legger det sammen av seg selv. Sammenlagt får du et
            <strong class="text-ink">krysshår</strong> som retter blikket
            tilbake dit, om du har panorert bort.
            <strong class="text-ink">Trykk på sola, månen, Mars, Jupiter
            eller Saturn</strong> — de fem har et tynt omriss som sier at de kan
            åpnes — og skiva blir en kule du kan snurre, med navngitte steder,
            ekte aksehelling og kveldens virkelige skyggelinje. Saturn har
            ringene sine, med Cassini-delinga. Dra nedover når du vil se
            landskapet igjen.
            <strong class="text-ink">Sola er med hele døgnet</strong>, og står
            der den faktisk står: om natta er den under føttene dine, så Lende
            tegner den under terrengarket. Velger du den derfra, senker
            visningen seg og ser ned etter den. Sola har ingen skyggelinje å
            vise — den er lyskilden — så kula er jevnt opplyst, og de navngitte
            stedene er breddegrader og ikke flekker: solflekker lever noen uker
            og driver med rotasjonen, mens beltene de kommer i står.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Sola, månen og alle de fem synlige planetene har
            <strong class="text-ink">astronomiske fakta</strong> i infokortet:
            hvor mange måner de har og hva de største heter, hvor langt unna de
            er, hvor lange døgnene og årene er — og en kort liste over
            <strong class="text-ink">menneskets utforskning</strong>, fra
            Galileis fire Jupiter-måner i 1610 til roverne som står på Mars i dag.
            Alt er bakt inn i appen, så det virker uten dekning; lenkene videre
            til <strong class="text-ink">Store norske leksikon</strong> og
            <strong class="text-ink">Wikipedia</strong> er for når du er hjemme
            igjen.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            <strong class="text-ink">Er det nordlys ute, står det på
            himmelen.</strong> I nattmodus henter Lende nordlysvarselet fra
            <strong class="text-ink">NOAA</strong>s OVATION-modell og legger
            grønne gardiner over den nordlige himmelen — loddrette stråler som
            folder seg langsomt, slik nordlyset gjør fordi det følger jordas
            magnetfeltlinjer. Fargene er de virkelige utslippslinjene: grønt fra
            oksygen rundt 120 km, rødfiolett høyere oppe, og en blå frynse
            nederst når det tar av. Stjernene skinner gjennom, som de skal.
            Panelet øverst sier <strong class="text-ink">hvor sterkt det er,
            sjansen akkurat der du står, skydekket, Kp-indeksen og
            solvindfarten</strong> — og X-en tar bort både panelet og gardinene,
            akkurat som i værraden.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            To ting er verdt å vite. Nordlyset står
            <strong class="text-ink">der det faktisk står</strong>: hvor høyt
            over horisonten gardinene henger regnes ut av hvor langt nord
            nordlysovalen ligger i kveld og av at lyset kommer fra rundt 120 km
            høyde. Fra Tromsø kan det stå rett over hodet; fra Sør-Norge ligger
            det lavt i nord — og er ovalen for langt unna, tegnes ingenting,
            framfor et nordlys som ikke er der. Og
            <strong class="text-ink">skydekket står ved siden av styrken</strong>,
            fordi det er det som avgjør: et kraftig nordlys bak et tett skylag er
            ingenting, og et panel som melder «Sterk» i den situasjonen sender
            deg ut i kulda for ingenting.
          </p>
          <p class="text-[12px] leading-relaxed text-ink-3">
            Nordlysvarselet er det ene datalaget som
            <strong class="text-ink-2">ikke</strong> pakkes med i en offline-fil,
            og det er med vilje — samme regel som for værvarselet. For alt annet
            betyr et gammelt tall bare «litt mindre presist»; for et varsel betyr
            det feil. Modellen ser dessuten omtrent en time fram, så panelet
            oppgir hvor gammel målingen er.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Nede til høyre står et <strong class="text-ink">himmelkompass</strong>:
            en skive som viser jordas plan, med N, Ø, S og V, og en rød markør
            øverst som er blikkretningen din. Skiva dreier når du snur deg — som
            på et vanlig kompass. <strong class="text-ink">Trykk på det, og
            kameraet vender mot nord</strong> i den høyden du står i. Uten kartet
            i bildet er det lett å miste himmelretningene, og rødt er den fargen
            som ødelegger nattsynet minst.
          </p>
          <ul class="text-[13px] leading-relaxed text-ink-2 space-y-1.5 list-disc pl-5">
            <li><strong class="text-ink">Det finnes ingen stjerne-API her.</strong>
              Alt regnes ut på telefonen din, av samme grunn som kartene lagres
              lokalt: en klar natt på fjellet har sjelden dekning. Stjernene er en
              bakt katalog på 191 av de klareste fra
              <strong class="text-ink">HYG</strong> (Hipparcos + Yale), flyttet
              fra J2000 til i kveld med presesjon.</li>
            <li>Sol, måne, månefase og lyssidens retning kommer fra Meeus'
              <em>Astronomical Algorithms</em>; planetene fra
              <strong class="text-ink">JPL</strong>s baneelementer løst med
              Keplers likning. Alt er sammenliknet mot uavhengige
              implementasjoner — stjernene til under ett buesekund, planetene til
              noen få bueminutter.</li>
            <li>Globene bruker overflatekart fra
              <strong class="text-ink">NASA</strong> og
              <strong class="text-ink">USGS</strong>, og lyses opp av et ekte
              lys fra solas virkelige retning, så skyggelinja ikke er en tegning.
              Mangler et bilde, tegnes kula i legemets egen farge med samme lys og
              samme stedsnavn — og gassplanetenes bånd tegnes lokalt, så Jupiter
              er Jupiter uansett.</li>
          </ul>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">3D-visning av tur</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Velg en rute med stifinneren eller en rundtur, og trykk
            <strong class="text-ink">3D-knappen ved startpunktet</strong>:
            turen spilles av som en flytur over ekte terreng. Det er samme
            3D-visning som kartet åpner — turen står bare klar i kameraet fra
            start. Kameraet følger turpunktet mens den ruller, og du styrer
            blikket selv med fingeren.
            <strong class="text-ink">Pauser du, er kameraet ditt</strong>: fly
            dit du vil, eller trykk på en knappenål så flyr det dit for deg. Play
            fester kameraet til turen igjen — med utsikten du nettopp valgte.
            Tjern, topper, naturreservater, kulturminner og NVEs vannmålestasjoner
            langs veien løftes fram med infokort, og du kan dra i tidsaksen for å
            spole fram og tilbake. Start, mål og delmål vises som grønne, røde og
            gule punkter, nærmeste utfartsparkering med et P-skilt, og høydekurver
            kan legges i terrenget med «Kurver»-knappen. Slik kan du
            <strong class="text-ink">oppleve turen før du går den</strong>.
          </p>
          <ul class="text-[13px] leading-relaxed text-ink-2 space-y-1.5 list-disc pl-5">
            <li>Terrenget bygges i sanntid med <strong class="text-ink">Three.js</strong>
              (WebGL) fra samme Kartverket-høydemodell som turkartet — og selve
              kartet drapes over som tekstur, så 3D-landskapet ser ut som kartet
              du kjenner, under en himmel med drivende skyer.</li>
            <li>Severdighetene langs ruta hentes fra kartets egen navneindeks
              (virker offline), <strong class="text-ink">NVE HydAPI</strong> og
              Riksantikvarens kulturminnedata.</li>
            <li>3D-modulen lastes først når du trenger den, så appen er like lett
              som før — har du åpnet et kart på nett, ligger den klar også uten
              dekning.</li>
          </ul>
        </div>
      </div>

      <!-- Fritt lende-fanen (v6.5.1). -->
      <div v-else-if="tab === 'fritt'" class="space-y-4">
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Hva det er</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            En avkledd turkartmodus, et <strong class="text-ink">supplement</strong>
            til turkartet — ikke en
            erstatning. Små, kvadratiske ark på 2 × 2 km som lages på farta: nærtur i
            skog og mark, der du har dekning og bare vil se et kart. Ett kart, én
            knapp, ingen innstillinger.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Alt annet er borte fra skjermen. Ingen faner, ingen søk, ingen måling,
            ingen 3D — bare menyknappen øverst og knappen nede til høyre. Kartet er
            alltid nord opp, i ISOM-uttrykk, tegnet for
            <strong class="text-ink">1:10 000</strong> med
            <strong class="text-ink">10 meters ekvidistanse</strong>. Begge deler
            er faste i denne modusen — det er ingenting å stille på. Nede til venstre
            står avstanden fra midten av arket så snart posisjonen din er kjent:
            arket rekker en kilometer ut til hver kant, så tallet sier hvor mye kart
            du har igjen foran deg.
          </p>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Knappen og «deg i sentrum»</h3>
          <ul class="text-[13px] leading-relaxed text-ink-2 space-y-1.5 list-disc pl-5">
            <li>Første trykk etter at du har åpnet modusen <strong class="text-ink">starter
              bare GPS</strong>. Da er det alltid ett trykk mellom å komme inn og å
              bytte ark — nyttig, siden du som regel står et helt annet sted i dag
              enn da forrige ark ble laget.</li>
            <li>Nærmere enn <strong class="text-ink">250 meter</strong> fra midten
              sentrerer et trykk kartet på deg, og sier når et nytt utsnitt blir
              tilgjengelig. Der ville et nytt ark vært nesten det samme arket, hentet
              på nytt.</li>
            <li>Har du gått <strong class="text-ink">250 meter eller mer</strong> —
              tallet nede til venstre skifter farge — lager neste trykk et nytt ark
              med deg i midten, og telleren starter på null igjen. Det gamle blir
              liggende til det nye er ferdig tegnet, så et feiltrykk kan ikke
              etterlate deg uten kart.</li>
            <li><strong class="text-ink">Angre</strong> henter forrige ark tilbake, og
              trenger ikke nett.</li>
          </ul>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Ferskvare — med vilje</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Arket har ikke navn, det neste erstatter det, og det havner aldri i
            «Mine kart». Det er ikke en mangel: det er nettopp fordi ingen ark er
            verdt å ta vare på at modusen slipper å spørre deg om noe som helst.
            Vil du ha et kart som varer, lager du det under
            <strong class="text-ink">Turkart</strong>.
          </p>
          <p class="text-[13px] leading-relaxed text-ink-2">
            Modusen trenger dekning for å <em>lage</em> et ark, men ikke for å vise
            det den har. Går nettet mens du er ute, ligger kartet der fortsatt — du
            kan bare ikke bytte det før du har dekning igjen.
          </p>
        </div>
      </div>

      <!-- Ruteplanlegger-fanen. -->
      <div v-else class="space-y-4">
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Hva det er</h3>
          <p class="text-[13px] leading-relaxed text-ink-2">
            En planlegger for grus- og stiruter: sett start og mål, få et forslag
            langs sti- og grusnettet med <strong class="text-ink">høydeprofil</strong>,
            cue-liste og lengde — og eksporter hele turen som
            <strong class="text-ink">GPX</strong> til klokke eller GPS.
          </p>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-ink">Teknikken</h3>
          <ul class="text-[13px] leading-relaxed text-ink-2 space-y-1.5 list-disc pl-5">
            <li>Sti- og veinettet bygges til en graf med <strong class="text-ink">graphology</strong>
              og korteste vei beregnes over den.</li>
            <li><strong class="text-ink">BRouter</strong> gir grus-vennlig ruting der
              nettet er godt kartlagt, med et grus-overlegg som farger underlaget.</li>
            <li>Høydeprofilen leses ut av samme DEM som turkartet, og hele ruten kan
              gjøres om til et turkart sentrert på strekket.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Rammeverk, kilder og copyright. -->
    <section class="rounded-2xl bg-ink/5 border border-ink/10 p-4 space-y-3">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-ink-3">
        Rammeverk &amp; kilder
      </h3>
      <p class="text-[13px] leading-relaxed text-ink-2">
        Bygget med <strong class="text-ink">Vue 3</strong>, <strong class="text-ink">Vite</strong>
        og <strong class="text-ink">Tailwind CSS</strong>. Kartgeometri behandles med
        d3-contour, polygon-clipping og graphology. Appen kjører fullt og helt i
        nettleseren som en installerbar PWA — ingen egen server, ingen konto.
      </p>
      <div class="text-[12px] leading-relaxed text-ink-3 space-y-1 pt-1 border-t border-ink/10">
        <p>Kartdata © <strong class="text-ink-2">OpenStreetMap</strong>-bidragsytere (ODbL).</p>
        <p>Høydemodell, N50 og sjøkart: <strong class="text-ink-2">Kartverket</strong> (NLOD / CC BY 4.0).</p>
        <p>Værvarsel: <strong class="text-ink-2">MET Norway</strong> (NLOD 2.0 / CC BY 4.0).</p>
        <p>Nordlysvarsel, Kp-indeks og solvind:
          <strong class="text-ink-2">NOAA Space Weather Prediction Center</strong>
          (OVATION-modellen; offentlig eiendom).</p>
        <p>Værvarsel: <strong class="text-ink-2">Meteorologisk institutt</strong> (MET Norway) — NLOD 2.0 / CC BY 4.0.
          Værsymbolene er © 2015–2017 Yr, MIT-lisens.</p>
        <p>Verneområder og artsdata: Naturbase, NVE og GBIF.</p>
        <p>Stjernekatalog: <strong class="text-ink-2">HYG</strong> (David Nash / astronexus,
          fra Hipparcos, Yale BSC og Gliese) — CC BY-SA 4.0. Bane­elementer for
          planetene: <strong class="text-ink-2">JPL</strong>, <em>Approximate Positions
          of the Major Planets</em>. Sol, måne og presesjon etter Jean Meeus,
          <em>Astronomical Algorithms</em>. Overflatekart: månen og Jupiter fra
          <strong class="text-ink-2">NASA</strong> (GSFC, JPL, Space Science
          Institute) — offentlig eiendom; sola, Mars og Saturn fra
          <strong class="text-ink-2">Solar System Scope</strong> (INOVE), avledet
          av NASA-data — CC BY 4.0, via
          <strong class="text-ink-2">Wikimedia Commons</strong>. Fakta og
          utforskningshistorie er satt sammen fra NASA/JPL Solar System Dynamics,
          IAU og oppdragsoversiktene til NASA, ESA, ISRO, CNSA og Roskosmos.
          Alle beregninger skjer i appen, uten nett.</p>
        <p class="pt-1">Privat, ikke-kommersielt hobbyprosjekt. Kart fra appen er
          ikke godkjent for navigasjon til sjøs eller i nødsituasjoner.</p>
      </div>
      <p class="text-[11px] text-ink-4 pt-1">Versjon {{ APP_VERSION }}</p>
    </section>
  </div>
</template>
