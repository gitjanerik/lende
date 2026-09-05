## 2026-09-05 — v6.5.53: Stjernemerkene er kuratering, og følger med fila

Stjernemerkede kulturminner har fulgt med i `.lendekart`-fila siden de kom, fordi
`kartPakke` sprer hele kart-posten og bare stripper markeringer, GPS-spor og
strekstil. Det var riktig, men utilsiktet — og et felt som ser personlig ut, men
ikke står i lista over personlige felt, er nøyaktig den slags som ryddes inn dit i
god tro. Beslutningen står nå skrevet begge steder: en stjerne er kuratering,
«disse er verdt å se på denne turen», og det er det som har verdi for den som får
fila, mens markeringer og spor er en dagbok. Ingen atferd er endret.

---

## 2026-09-05 — v6.5.52: Stjernemerkede kulturminner, og ikonene vekk på mobil

Kulturminner og fredede lokaliteter kan nå stjernemerkes fra infopanelet, og merkingen
bor i kart-recorden og ikke i et eget bibliotek: slettes turkartet, forsvinner
merkene med det, uten noen forelder-løs rad å rydde etterpå. I selve kartet får
et merket minne den samme svake ripple-ringen som et himmellegeme har i
stjernehimmelen — to pulser i utakt rundt et fast omriss, i to valører så den
holder kontrasten på både lyst og mørkt ark, og borte i eksporten fordi en
frossen puls på papir bare leses som en feil i kartet. I «Mine kart» står antallet
som en gul pille foran kartnavnet, og bare når det er noe å telle. Innebygde kart
har ingen record å skrive til, så der tilbys ikke knappen i det hele tatt. I
tillegg skjules det venstrestilte ikonet per lagret kart og rute på små skjermer:
det bar ingen informasjon, og ved 200 % tekst spiste det bredden de to tekstlinjene
trengte.

---

## 2026-09-05 — v6.5.51: Stjernekikker, lesbart infokort i natta, og en toast som ikke lover for mye

Natthimmelens infokort tåler nå stor tekst: det latinske navnet er flyttet ned på
egen linje, posisjonslinja («nord, 79° over horisonten») fyller full bredde i
stedet for å brekke i en smal kolonne ved siden av knappene, og navnet får bryte
framfor å bli klippet til «Cas…». Bytter kortet objekt, blinker krysshåret i den
minimerte pilla tre ganger i himmelens egen fremhevingsfarge — kortet står nesten
alltid sammenlagt, og da er det ikke gitt at man ser at den ene tekstlinja ble en
annen. Værraden og nordlyspanelet følger nå tekstvalget fra hovedmenyen, som Info
og POI-filteret alt gjorde; værradens plassmåling er lagt om fra ramme til
`offsetWidth`, siden de to enhetene spriker inne i et `zoom`-lag. Pilla i
himmelsøket ellipserer i stedet for å brekke «Finn på himmelen» over ti linjer.
«Stargazer» heter Stjernekikker. Og toasten om kappede kulturminner krever nå at
taket faktisk bet: den sa «97 i dette utsnittet — viser de første 96, zoom inn for
å se resten», der ingenting var kappet og ingen zoom kunne hentet det siste.

---

## 2026-09-05 — v6.5.50: «Se etter oppdatering», og den automatiske sjekken som kunne kjøre seg fast

`checkForUpdateNow()` i `lib/swUpdate.js` ble skrevet for en «Se etter
oppdatering»-knapp, men knappen ble igjen i svg-insights da Lende ble skilt ut:
funksjonen sto med null kallere, og appen hadde ingen manuell vei til en ny
versjon i det hele tatt. Den er nå én komponent, `VersjonSjekk.vue`, delt av de
to stedene versjonen står — hovedmenyen og Om-siden — fordi en knapp bare det
ene stedet er en knapp halve appen ikke vet om. Den har sin egen «Oppdater
nå»-knapp selv om App.vue alt viser et banner ved treff: banneret ligger på
z-100 og hovedmenyen på z-201, så et treff funnet fra menyen ville svart med en
knapp bak menyen man står i. Samtidig går den automatiske sjekken i `main.js`
gjennom samme funksjon i stedet for rå `reg.update()`. Det siste kunne kjøre seg
fast for godt: `reg.waiting` ble lest bare én gang, ved registrering, og bare
hvis en gammel service worker kontrollerte siden da. Sto en ny worker allerede og
ventet uten at banneret rakk å bli satt — hard reload, eller `controller` ennå
null — ga `update()` ingen `updatefound`, for skriptet på serveren er identisk
med det som alt venter, og appen kunne foregrunnes hver time i en uke uten at
banneret dukket opp. `checkForUpdateNow()` leser `reg.waiting` på nytt etter hver
sjekk og er dermed den ene av de to som kommer seg løs igjen. En ubrukt eksport
er helt gyldig kode og et manglende kallsted er nettopp ingenting, så ingen
enhetstest kunne se dette; røyktesten åpner nå menyen og krever at knappen
svarer.

---

## 2026-09-05 — v6.5.49: Zoom-knappene ned og inn i Fritt lende, ruteliste, punkt-ark og 3D-filter tåler 200 % tekst

Zoom-pilla på høyre kant lå på `--ovl-rose` og dermed oppå snarvei-raden
(Stifinner/Runde/Måling/3D/Info), som står på `--ovl-top` og er 56 px høy — på en
telefon når raden helt ut i kanten. Søyla har fått sin egen slot, `--ovl-nav`,
som er radens underkant pluss luft. Selve pilla er flyttet ut i
`kontroller/ZoomKnapper.vue` og tatt i bruk i Fritt lende, der zoom fram til nå
bare fantes som pinch — altså en fleirpunkts-gest uten enkeltpeker-alternativ
(WCAG 2.5.2) i den ene modusen som er laget for votter og kaldt vær. Uten
`azimut` faller nord-knappen bort av seg selv, så modusens rotasjonslås står
urørt; røyktesten for ruter teller nå fire knapper i stedet for to.

«Mine ruter» har fått samme oppdeling som «Mine kart» (v6.5.47): teksten får hele
bredden, stjernene ligger under den, og del/slett står i motsatt ende av en egen
rad nederst. Del og slett satt før til høyre for navnet og spiste den bredden de
to tekstlinjene trengte, og stjernene lå som 28 px-mål rett ved siden av en
slette-knapp — en vurdering man endrer ofte, vegg i vegg med noe endelig.
Trykkflatene er 36 px, og åpne-knappen omslutter ikke lenger de andre.

Punkt-arket brakk ved 200 % tekst. Hele kroppen ligger i en `zoom`-blokk, så den
effektive bredden halveres — og med faste `grid-cols-2`/`grid-cols-3` fikk «Del
kart og sted» rundt 100 px og ble fire ord under hverandre, «Parkering» ble
«Par-ke-ring», og annoteringene ble klippet til «Kn…». Rutenettene brekker nå
etter plass (`auto-fit` + `minmax`), som gir det vante antallet kolonner ved
100 % og færre når plassen tar slutt, uten et eneste mediespørsmål. Meta-linjene
i headeren brekker i stedet for å klippes, og kopier-knappen følger første linje
når koordinatparet går over to.

POI-filteret i 3D har fått samme grep som Info-pilla fikk i v6.5.44. Fram til nå
byttet den grønne pilla seg ut med den utvidede boksen, og boksen sto i FLYTEN i
en `justify-between`-rad: den vokste mot venstre til den nådde Info-pilla og rant
så ut over høyre skjermkant, med sin egen minimer-knapp utenfor skjermen. Pilla
er nå den eneste bryteren og står i flyten alene, så raden er nøyaktig like bred
åpen som lukket, og kroppen henger som et nedtrekk forankret i høyre kant med
eget tak og egen rulling. Merkelappene brekker i stedet for å klippes — «Kn…»
sier ikke hvilket lag man skrur av. Røyk-sjekken måler nå begge retninger: at
verken hjelpen eller filteret flytter den andre, og at filterkroppen holder seg
innenfor skjermen.

---

## 2026-09-05 — v6.5.48: Universell utforming — hele appen gjennom WCAG 2.2

Fem grupper i én leveranse, i den rekkefølgen de betaler seg. Byggingen på forsiden og i kart-utvidelsen kan nå AVBRYTES (`AbortController` hele veien ned i `buildMapFromCenter`), `/nytt` har fått hovedmenyknappen tilbake, Utvikler-fanen er `userOnly`, og lang-trykk på FAB-knottene har samme fyllring som ankeret — gesten sto bare i en `aria-label`. Lyst tema remapper nå også aksentskyggene 300/400: førti tekststeder skrevet som `text-amber-300/80` sto igjen som lys aksent på lys papir, målt 1,29:1. Alle interaktive elementer har fått en global `:focus-visible`-ring, og de ni `focus:outline-none`-ene som slo den i hjel er borte. `user-scalable=no` er ute av viewporten (SC 1.4.4). Skjemaer, faner og brytere har fått navn, roller og live-regioner: forsidens og skuffens fanerader er ekte `tablist`-er med piltaster og roving tabindex, 3D-ens knapperad er `aria-pressed`-brytere med tempo som `radiogroup`, tur-scrubberen er en `role="slider"` med piltaster, og statusbannere skiller `role="status"` fra `role="alert"`.

Teksthierarkiet er ikke lenger skrevet som opasitet. `text-ink/55` og slektningene komponerte mot ulik bunn i de to temaene — 6,1:1 i mørkt og 3,8:1 i lyst, altså én klasse som besto i det ene og strøk i det andre. 555 kallsteder er byttet til `--color-ink-2/-3/-4`, faste toner per tema, og `uiKontrast.test.js` måler hvert nivå mot hver flate i CI og feiler både på et gulv under 4,5:1 og på drift mellom tabellen og `style.css`. Grønne knapper med hvit tekst målte 2,5:1 og er nå emerald-700; de gule toastene er amber-800 med `on-accent`; GPS-prikken har fått en mørk ytterkontur, siden den hvite ringen målte 1,05:1 mot kartets kremgule bunn. Til sist tastaturet: FAB-ankeret og -knottene svarer på Enter og mellomrom (og Meny-tasten for holdet), skuffa er en `role="dialog"` med Escape og fokus inn og ut, hovedmenyen og 3D har fokusfelle (`lib/fokusFelle.js`, ren og testet), håndtakene er ekte kontroller med piltaster, kartflata kan panoreres og zoomes med tastatur, og berøring har fått zoom og nord-knapp med én finger — pinch og to-finger-vri var eneste vei, som SC 2.5.2 ikke tillater. Alle fokusflyttinger bruker `preventScroll` — MapViews rot er `overflow-hidden`, men en slik boks kan fortsatt rulles programmatisk, og uten flagget dro fokuseringen av skuffas første knapp flata 465 px opp så de åtte lende-pilene havnet utenfor viewporten. Røyktesten har fått tre nye sjekker som måler nettopp dette: tastatur på kartflata, fokus inn og Escape ut av skuffa (og at flata ikke rullet), og at fokusringen faktisk males.

---

## 2026-09-05 — v6.5.47: Nedlasting rett fra kartlista

Kart-radene i «Mine kart» har fått handlingene på egen linje, og en ny
nedlastings-knapp ved siden av «gi nytt navn» og «slett». Knappene sto før til
høyre for kartnavnet og stjal bredden fra de to metadatalinjene under det, som
dermed ble kuttet med «…» på en vanlig telefon; nå får teksten hele bredden.
Nedlastingen gir samme `.lendekart`-fil som «Del som offline-fil» inne i
kart-visningen — importen sto allerede rett over lista, så eksport og import
henger nå sammen på samme side.

Selve pakke- og leveringsveien er flyttet til `lib/kartFilDeling.js` og DELT av
de to knappene. Det er poenget med uttrekket: en snarvei som pakket «nesten det
samme» ville gitt turkameraten et kart uten kulturminner eller verneområder,
uten at noe i UI-et sa hvilken knapp som ga hvilken fil. Kart-raden er dessuten
blitt en ekte `<button>` med egen fokusring, og de tre ikonknappene ligger nå
utenfor den — en knapp i en knapp er ugyldig markup, og `@click.stop` er en
avtale man må huske hver gang det kommer en knapp til.

---

## 2026-09-05 — v6.5.46: Kvadratisk, stående, liggende — og kompasset dekker skjermen

Formatvelgeren har tre valg med ett ord hver. «Portrett (mobilskjerm)» og
«Utskrift (A4)» er slått sammen til STÅENDE, og LIGGENDE er ny — begge er
A-format, samme ark snudd. Skjerm-aspektet var aldri et format: det var
telefonens tilfeldige forhold, altså et annet ark på hver enhet og et som ikke
lar seg skrive ut. Undertekstene var dessuten det som brakk ved 150 % tekst,
der tre kolonner delte ordene midt i seg («Kvad-ratisk»); knapperaden bryter nå
i stedet for å dele. Lagrede valg fra før migreres — begge de gamle var høye
ark, så begge blir stående. Og «Sentrer»-knappen skalerer nå til DEKNING og
ikke bare til brukerens standard-zoom: regelen om at kartet fyller skjermen med
god margin gjaldt bare ved åpning, og med et liggende ark på en høy skjerm ble
letterboxen to kremgule felt over halve visningen.

---

## 2026-09-05 — v6.5.45: Den grønne knappen gjør det lista gjør, og skjemaet tåler 200 % tekst

Hjelpeteksten under søkefeltet — «Søk etter et sted — eller trykk den grønne knappen …» — er fjernet begge steder den sto. Den forklarte en pin som står rett ved siden av feltet den snakket om, og ved stor tekst spiste den plassen til det den forklarte. Den grønne knappen er samtidig skrumpet fra 40 til 36 piksler, altså lik mikrofonen ved siden av; høyre-paddingen og spinner-plasseringen i begge søkefeltene følger de nye målene.

Knappen betyr nå det samme som lista over den, men bare der lista bygger. På «Mine kart» — forsiden og modalen — lager et trykk et kart der du står, nøyaktig som et valg fra trefflista gjør: posisjon, stedsnavnoppslag, og så samme `byggKartFra` som søket bruker. I «Flere valg» er ingenting endret: der VELGES stedet bare, og brukeren gjør resten av innstillingene før kartet lages. Det er hele skillet mellom de to flatene, og nå sier knappen det. Følgen er at `open-picker { gps: true }` → `pickerGps` → `start-gps` / `?gps=1` ikke har noen avsender igjen, og hele den kjeden er borte.

En nektet tillatelse blir sagt. Både mikrofonen og posisjonen var helt stille når nettleseren sa nei — `useSpeechInput` fanget koden i en `error`-ref ingen leste, og knappen slo seg av igjen med det samme, så det så ut som om den var i stykker. `lib/mikrofonFeil.js` er ny og er søsteren til `lib/gpsFeil.js`: én kilde til teksten, delt av begge søkefeltene. Begge modulene har fått et RÅD ved siden av etiketten, for en tillatelse man har avvist én gang spørres ikke om på nytt — brukeren må vite hvor den slås på igjen, og at man alltid kan skrive søket i stedet.

To ting som brakk ved 200 % tekst er rettet. Forhåndsvisningen hadde en fingerbred renne på 50 piksler på hver side som alltid skal kunne rulle siden; inne i et `zoom`-lag halveres den logiske bredden, så rennen spiste 100 av 168 piksler og kartet kollapset til en 24 pikslers firkant med sin egen km-merkelapp og Kartverket-kreditering brettet over seg. Rennen er nå `clamp(0px, (100% - 160px) / 2, 50px)`: uendret der det er plass, og den viker for kartet når det blir trangt. Begge merkelappene har fått `whitespace-nowrap`. Og «Lag turkart» er festet til bunnen bare opp til 125 %: over det er baren dobbelt så høy som den er tegnet for og spiste nesten hele den synlige delen av skjemaet, så det var knapt plass til én rad i trefflista. Ved 150 og 200 % ruller den med som siste rad, og trefflista maler nå uansett over den. To røyk-sjekker i `royk:ruter` holder begge fast, og de måler i MODALEN og ikke på `/nytt`: `zoom` settes av `AppModal`, mens `MapPickerView` ikke skalerer i det hele tatt — første utgave av sjekken sto grønn uansett hva koden gjorde. Verifisert i begge retninger: 72 piksler uten fiksen, 272 med.

---

## 2026-09-05 — v6.5.44: Stargazer i himmelen, og en hjelp som ikke dytter

Løfter man blikket i dagmodus, er himmelen tom — blå flate og noen skyer — mens det ene stedet i appen der det faktisk er noe å se opp på, nattmodus, nås fra en sol/måne-knapp nede i venstre hjørne som ikke handler om himmelen man nettopp så opp i. «Stargazer» står nå midtstilt der blikket er, og bare der: den vises på `serOpp` og forsvinner i det man drar seg ned igjen, så den koster ingen kartflate. Den ligger under resten av overlegget i stablingen, og raden den står i slipper pekeren gjennom — ellers ville den svelget nettopp det draget nedover som er veien tilbake til kartet.

Infopanelet i 3D byttet fram til nå pilla si ut med den utvidede boksen, og boksen sto i flyten i en `justify-between`-rad. En åpnet hjelp dyttet derfor det grønne POI-filteret ut av skjermen og tok med seg sin egen lukkeknapp ut av syne — man satt igjen med en tekstblokk uten noen synlig vei ut. Headeren blir nå stående og er selve bryteren, med en chevron som sier hvilken vei neste trykk går, og kroppen henger under som et nedtrekk utenfor flyten. Raden er dermed like bred åpen som lukket, og filteret flytter seg aldri. Kroppen bærer sitt eget tak og sin egen rulling, siden kallstedet ikke lenger kan pakke den i en `overflow`-boks uten å klippe nedtrekket bort. To røyk-sjekker holder begge delene fast: Stargazer må dukke opp når blikket er løftet og faktisk åpne natta når man trykker, og POI-filteret måles til å stå stille og innenfor skjermen med hjelpen åpen.

Kommentaren over `HALF_KM` i `scripts/build-vardasen-svg.js` hevdet samtidig at demokartets 4 km var «samme utsnitt som app-standarden». Det stemte da den ble skrevet, men app-standarden er siden blitt 8 km med 20 m ekvidistanse (`DEFAULT_MAP_WIDTH_KM`) mens demokartet ble stående — så kommentaren pekte på en binding som ikke lenger fantes. Utsnittet er likevel ikke vilkårlig, og kommentaren sier nå hvorfor det er som det er: røyktesten avviser et kart under `EKTE_KART_MIN_BYTES` som mistenkelig lite og cacher det ikke, så et halvert ark ville sendt hver eneste kjøring tilbake til Overpass; 16 av 36 røyk-sjekker krever ekte kart og blir grønne fordi de er tomme om stier, vann og navn forsvinner; og kartet er et produkt-artefakt som service-workeren forhåndshenter for flymodus. En nabo-kommentar med samme feil er rettet i samme slengen: DEM-en sto oppført som 1000 × 1000 celler for et 5 × 5 km-ark og er i virkeligheten 800 × 800 for 4 × 4 km.

---

## 2026-09-05 — v6.5.43: Skjermen din, ikke vår — rotasjon og en A-knapp i hvert panel

Manifestet låste den installerte appen til høykant. Det er borte: `orientation`
er `any`, så Lende roterer med telefonen på Android slik den alltid har gjort på
iOS (som aldri har støttet feltet). Kartarket er kvadratisk, så liggende gir mer
av det i bredden — på sykkelstyret, i bilholderen, i 3D og på høydeprofilen — og
WCAG 2.1 SC 1.3.4 sier at innhold ikke skal være bundet til én retning uten at
retningen er vesentlig. Prisen er at telefonen kan snu når man går med den i
hånda, og svaret på det er telefonens egen retningslås, som appen nå følger.
Røyktesten måler liggende mot stående framfor mot null: kart-SVG-en og de dokkede
lende-pilene stikker utenfor i begge retninger med vilje, så spørsmålet er om
rotasjonen gjorde det verre. Samtidig fikk hvert infopanel en A-knapp som går ett
hakk opp i hovedmenyens egen skala og runder tilbake til 100 %. Syklus-knappen
ble fjernet i v2.4.13 fordi tilstanden var skjult; den innvendingen er besvart
ved at knappen bærer verdien i klartekst på sin egen flate. Tegnforklaringens
rader er samtidig gjort fleksible — prøven har 120 px som basis og ikke som lov,
og teksten legger seg på egen linje når det blir trangt, i stedet for å stå som
én bokstav per linje og renne ut av arket ved 200 %.

---

## 2026-09-04 — v6.5.42: Et valg på natthimmelen kvitteres der man ser

Trykker man på en løs stjerne, står blikket der fingeren var — mens hele svaret kommer et helt annet sted på skjermen, i en pille som kanskje alt sto der fra forrige valg. Stjerna løftes 1,6× i størrelse, og det er for lite til å fange et øye som ikke visste at det skulle se etter noe. Nå slippes to røde bølger ut fra legemet, ett skudd på drøyt et sekund, som ripplen i turkartets søketreff. De skiller seg fra den permanente trykk-ringen på globene med vilje: ringen sier «dette kan du åpne» og blir stående, bølgene sier «det skjedde» og dør. De starter innenfor ringens 46 px og vokser ut til 104, og de er røde fordi rødt er den ene fargen som får lyse i nattmodus. Regelen for hvor bølgene står bor i en ren modul med tester; shaderen får ferdige tall. Kvitteringen gis til det som ER et punkt og ikke har noen annen bekreftelse — løse stjerner, pluss Merkur og Venus, som verken har ring eller globe. En formasjon får den ikke: middelretningen ligger i tom himmel for en figur som spenner 40°, og figuren lyser uansett opp selv.

---

## 2026-09-04 — v6.5.41: Demokartet virker i flymodus, ikke bare hvis du var heldig

Det innebygde Vardåsen-kartet lot seg ikke åpne uten nett. Kartdata fikk sin
egen uversjonerte cache i v6.5.39, men den fylles av kart-ruta i
service-workeren, som er network-first — altså først når kartet FAKTISK hentes
over nett. Hadde man aldri åpnet demokartet mens man var på nett etter siste
deploy, sto cachen tom, og flymodus ga «kartet finnes ikke» på det ene kartet
som ikke kan mangle: det ligger ferdig bygget i bundelen. Kartet hentes nå ved
INSTALLASJON av service-workeren, altså ved hver deploy — som også er det som
holder det ferskt, siden `lende-data` er uversjonert og den første kopien ellers
ville blitt liggende for alltid. Hentingen går forbi HTTP-cachen, ellers kunne
forrige deploys kart blitt skrevet inn som ferskt, og den kan ikke blokkere
installasjonen.

Klienten dro i motsatt retning av seg selv. `fetchBuiltinSvg` henter med
`cache: 'reload'` og prøver på nytt med en `?v=`-URL — begge grep for å komme
forbi en gammel stale-while-revalidate-service-worker som kunne svare med en
avkuttet kopi. Uten nett peker de bort fra de eneste kildene som kan svare: den
cache-bustede URL-en har hverken kart-cachen eller HTTP-cachen sett, og `reload`
går forbi dem begge. Vet nettleseren at vi er offline, spørres det derfor én
gang, uten busting og med `force-cache`. Begge retningene er enhetstestet, og
installasjons-regelen måles på `public/sw.js` selv.

---

## 2026-09-04 — v6.5.40: Tre trefflater — kula, stjernene og kulturminnene

Planetvisningen i 3D lukkes av et trykk utenfor kula, men gesten er ikke å
gjette på: uten en synlig utvei trykket brukerne X-en oppe til høyre, som lukker
hele 3D-visningen. «Tilbake til natthimmel» står nå midtstilt under kula og gjør
nøyaktig det trykket gjør — legger kula tilbake og legger infokortet SAMMEN, ikke
lukker det (v6.3.5). Den forklarende teksten i kortet er fortsatt fjernet (v6.3.3);
en knapp er en affordanse, en bruksanvisning er ord man må lese i mørket.
Stjerner som ikke er med i noen figur var nesten umulige å treffe rett over
horisonten, og årsaken var ikke terskelen på 46 px: `handleTap` spurte himmelen
BARE når terrengstrålen bommet, så silhuetten under stjerna spiste hele nedre
halvdel av trefflata. Himmelen konsulteres nå også etter et terrengtreff, gatet
på NATTMODUS — der er nåler, stier og kurver skjult, så et terrengtapp har ingen
konkurrerende betydning, og porten kan ikke stjele fra en nål, et veipunkt eller
GPS-en fordi de avgjøres tidligere i kjeden. I turkartet får kulturminner,
fredete minner og vannmålestasjoner en trefflate på 44 px: symbolene er 3,2 mm
fordi ISOM-print krever det, så flaten måles i SKJERMROM (`lib/markorTreff.js`)
framfor å tegnes inn i SVG-en, som eksporteres til PNG, PDF og `.lendekart`.

---

## 2026-09-04 — v6.5.39: Flymodus startet appen i v6.5.17, og tre andre kanter

Service-workeren har ikke slettet en gammel cache siden v6.5.16. Den utgaven
droppet `lende-`-prefikset fra cache-navnene, mens opprydningen i `activate`
fortsatte å lete etter nettopp det prefikset — så filteret traff ingenting, og
hver utgave etter den la igjen sitt eget skall for alltid. Uten nett svarte
`caches.match()` fra den ELDSTE av dem, siden den søker cachene i
opprettelsesrekkefølge, og flymodus bootet derfor appen i v6.5.17 mens
nettleseren hadde v6.5.38 på disk. Prefikset er tilbake (opprydningen tar med
seg de prefiksløse restene fra v6.5.16–v6.5.38), oppslaget av `index.html` er
scopet til gjeldende skall som et gjerde under opprydningen, og kartdata har
fått en egen UVERSJONERT cache: et bygget kart-SVG endres ikke av at appen får
en ny versjon, og lå det i det versjonerte skallet ville hver deploy tatt
offline-kartet til brukeren var på nett igjen. Regelen er enhetstestet mot
`public/sw.js` SELV — en kopi i testen ville stått grønn gjennom hele feilen.

«Mine kart» ble stående oppå kartet når man valgte kartet man allerede sto i.
AppMenu lukker modalen på en rute-watch, og en push til gjeldende rute er en
no-op: `route.fullPath` endrer seg aldri, og watchen fyrer aldri. Med ETT lagret
kart traff det hver gang — boot-gjenopptaket sender deg rett inn i det ene
kartet du har, så raden i lista ER kartet du står i — mens man med to kart
vanligvis traff det andre og aldri så feilen. Samme lærdom som Fritt
lende-snarveien i v6.5.33, og løsningen er den samme: all navigasjon ut av
panelet melder seg med `navigert`, og verten lukker på hendelsen framfor på
ruta. Gaten er en røyk-sjekk med ett kart i basen, verifisert i begge retninger.

Samme kart kunne importeres om og om igjen, og kopi nummer to fikk navnet
«(importert)». Identiteten til et importert kart er nå avsenderens navn OG
opprettelsestidspunkt, notert ved importen — så en ny import av det samme kartet
åpner det du har, også om du har døpt om kopien din eller avsenderen har
eksportert fila på nytt. Kart importert før denne versjonen mangler notatet og
kjennes bare igjen på samme FIL, som er nøyaktig tilfellet feilen ble meldt for.
Navnekollisjonen står urørt for to kart som faktisk ER ulike, og cache-radene
skrives om selv ved en dublett — den ferske TTL-en er hele poenget med fila.

Og «Failed to fetch» er ute av kartets feilskjerm. Den var engelsk, teknisk, og
taus om det ene brukeren kan gjøre noe med. Oversettelsen bor i
`lib/lastefeil.js`, som holder to ting fra hverandre: vet nettleseren at vi er
offline, er det en pålitelig negativ og vi sier det rett ut, ellers påstår vi
ingenting om nettet — captive portal og wifi uten oppstrøm rapporteres begge som
online — og sier i stedet hva kartet KREVER. Våre egne norske meldinger
(«Ugyldig SVG») slipper gjennom uendret.

---

## 2026-09-04 — v6.5.38: Vedlikeholdsrapporten ser nå på tvers av de fire katalogene

`npm run vedlikehold` har hele tida svart på «er denne katalogen i orden?», én
katalog om gangen. Den svarer nå også på «svarer de fire likt om samme pakke?».
Det er et spørsmål ingenting stilte før: Dependabot ser hver katalog for seg og
kan per konstruksjon ikke se drift mellom dem, og det var nettopp slik
`@modelcontextprotocol/sdk` fikk stå på 1.29 i rot og 1.23 nestet inne i den
deployede MCP-Workeren til noen tilfeldigvis leste to filer i samme økt.
Regelen bor i `scripts/versjonsdrift.mjs`, som er ren og enhetstestet — ingen
fs, ingen nett; kallerne leser filene. Deklarerte områder og låste versjoner
sammenliknes ALDRI mot hverandre: `^4.0.0` og `4.125.3` er ikke et avvik, de er
to ulike spørsmål, og en katalog uten lockfile bidrar derfor bare til den
deklarerte lista. Navnet leses etter SISTE `node_modules/` i stien, så en nestet
kopi er nettopp det som telles. Lista sorteres etter FLATE og ikke etter navn,
av samme grunn som resten av rapporten. Første kjøring fant én deklarert drift
(`wrangler` ^4.125.0 i mcp-worker mot ^4.0.0 i proxy og ai-worker) og 22 låste —
og den siste lista viser samtidig at rot-lockfila har fem noder der `version`
ikke stemmer med tarballen i `resolved`, alle stemplet med appens egen versjon
fra den gang. Installasjonen er likevel riktig, siden npm installerer fra
`resolved` + `integrity`; reparasjonen står igjen som en egen sak.

---

## 2026-09-04 — v6.5.37: Fritt lende-snarveien slutter å selge mot hovedveien

Snarveien i den tomme kart-lista spurte «Vil du bare ha et turkart uten noe mer
fuzz?». Låneordet var det som var hørbart, men feilen lå under: setningen påstår
at hovedveien er tungvint, mens hele grunnen til at knappen er tonet og ikke en
grønn CTA er at skjemaet over fortsatt skal være hovedveien. Overskriften sier nå
forskjellen — «Ett kart, ingen innstillinger» — og ikke stedet, for «der du står»
er nøyaktig hva den grønne pin-knappen rett over gjør. «Krever nett» blir
stående: dette er det ene stedet i appen der premisset snus, og den som står i en
tom liste har aldri sett hovedmenyens rad som sier det.

Den gule flata er borte. Mot kortet den ligger i målte `bg-amber-400/[0.08]`
1,02:1 i lyst tema — den kostet en fjerde betydning for gult i denne fila (valgt
fane, FAB-ring, varselpanelet hundre linjer opp, favoritt-stjerna) og leverte
nesten ingen flate-kontrast. Grønt var utelukket av samme grunn som i v6.5.28:
Fritt lende ER «lag kart der jeg står». Raden er nøytral nå, og gjenkjennelsen
bæres av kompass-glyfen fra hovedmenyens egen Fritt lende-rad, så de to
inngangene til modusen ser ut som samme sted.

De to småtekstene lå på 4,08 og 2,70 mot WCAG AAs 4,5 i lyst tema. De to linjene
som står igjen måler 12,26 og 5,42.

---

## 2026-09-04 — v6.5.36: Ingen grafikk bak hamburgeren

Toppbaren på forsiden hadde fire kontur-ringer fra logoen som bakgrunn. De var
ment som et diskret ekko, men de ligger under den ENE knappen i baren og bryter
opp silhuetten hennes. I lyst tema, der ringfargen var mest mettet mot den varme
papirtonen, leses det som et grafisk element knappen har falt oppå — en
dekorasjon som konkurrerer med en kontroll om det samme hjørnet, taper.

`--logo-ring` var toppbarens eneste bruker og er tatt med. Et tema-token uten
konsument er en invitasjon til å sette dekorasjonen tilbake i god tro.

---

## 2026-09-04 — v6.5.35: Hovedmenyen er tre likeverdige inngangar, og fanene er borte

Modus-segmentet øverst i hovedmenyen så ut som faner over et innhold som ikke
var faner. Det er fjernet, og navigasjonen er flyttet inn i radene under som en
grønn pil høyre — «gå til funksjonen» — der «+» sto. For Turplanleggeren var
«+ Ny rute» dessuten nøyaktig samme navigasjon som segmentet, altså to knapper
med én handling; for Turkart åpnet «+» en modal som «Mine kart» uansett åpner
selv. Fritt lende har fått samme pil, så menyen har tre likeverdige inngangar.

Rekkefølgen er fast: Turkart øverst, alltid. Den fulgte modusen, og en meny som
stokker om på seg selv etter hvor du står er en meny man må lese hver gang
framfor å treffe på muskelminne. Hvor du er, sies av kort-markeringen, som ikke
flytter noe. Fritt lende-raden var av samme grunn gatet på modus; nå står den
fast som de to andre.

Fane-raden «Turkart / Ruteplanlegger» er borte fra menyens modaler. «Mine kart»
og «Mine ruter» har hver sin tittel, og en fane-rad der er en snarvei til den
andre halvdelen av appen midt inne i den ene — to funksjoner som aldri brukes
samtidig. Hjem-siden beholder den: der er `?tab=` en ekte rute-kontrakt, og
siden er per definisjon fellessiden.

Ledeteksten over Tegnforklaring og Spør Lende er nå «Hjelp i lende». Den sa «På
kartet» eller «Ruteplanlegging» etter modus, mens radene under er de samme i
begge halvdeler — en overskrift som skifter uten at innholdet gjør det, får
leseren til å tro at innholdet gjorde det.

Og den tomme «Mine turkart»-lista forklarer ikke lenger søkefeltet og
pin-knappen som står synlige rett over den. Teksten står igjen der geolokasjon
mangler: der finnes ikke pin-knappen, og søket er det eneste som er å gjøre.

Nyhetsbanneret nederst i menyen er borte, og `lib/nyheter.js` med det. Det var
laget for å presentere Fritt lende, og den modusen har nå en fast rad med egen
pil to skjermlinjer lenger opp — et banner som peker på noe man allerede ser er
støy i en meny hvis hele poenget denne runden var å bli enklere. Kommer det en
ny modus som må annonseres, er banneret én fil å skrive om igjen; å la det stå
tomt i mellomtida er ikke gratis.

---

## 2026-09-04 — v6.5.34: Fritt lende henter kartet selv, og sier mindre

Tom-tilstanden var fem avsnitt: hva knappen gjør, hvor stort arket blir, at man
må svare ja i nettleserens dialog, og til slutt det ene som ikke sier seg selv.
Knappen er den eneste kontrollen på skjermen og boblen peker rett på den, så nå
står bare det ene igjen — «Nøyaktig posisjon» ligger ikke i dialogen nettleseren
viser, men i nettleserens egne innstillinger, og uten den er dette den stille
feilen: en omtrentlig plassering svarer med en fix, arket bygges, og det ser like
ekte ut selv om det er sentrert kilometer unna.

Har du alt gitt posisjonstillatelse, og har du ikke noe ark, henter modusen
kartet uten et trykk. Porten er «ingen ark», og det er invariant 1: med et ark på
skjermen er et bygg en erstatning, og da skal det fortsatt ligge et trykk mellom
det å åpne modusen og det å miste arket. Oppslaget spør aldri om en tillatelse
det ikke har — bare `granted` teller, `prompt` ville reist en dialog brukeren
ikke ba om, og Safari som ikke svarer på spørsmålet gir den gamle oppførselen.
Uten dekning bygges det ingenting.

Blokka kan dessuten rulles. Med 200 % tekst er den høyere enn skjermen, og roten
er `overflow-hidden` — så både overskriften og siste linje ble klippet bort uten
noen vei til dem, i nettopp den innstillingen modusen finnes for å tåle.
Sentreringen er flyttet fra `place-items-center` til auto-marger: `place-items`
skyver et for høyt barn ut over rullestartkanten, og den overflyten er unåbar.

«Fritt lende» er dessuten en ekte `h1` og ikke en fet `p`. Det er sidens eneste
overskrift, og en skjermleser som lister overskriftene fant ingenting å liste.

Om-siden beskrev dessuten en ekvidistanse-linje på linjalen som ble tatt bort i
v6.5.27. Den sier nå det som faktisk gjelder: 1:10 000 med 10 meters
ekvidistanse, fast i denne modusen.

---

## 2026-09-03 — v6.5.33: Snarveien til Fritt lende lukker panelet den står i

Snarveien i den tomme «Mine kart»-lista navigerte selv, med
`router.push('/fritt')`, og lot eieren om å rydde bort panelet. Det så riktig ut
fordi rute-byttet uansett river modalen med seg — men står du ALLEREDE i Fritt
lende, er navigasjonen en no-op. `route.fullPath` endrer seg ikke, watchen i
AppMenu som nullstiller `sheet` fyrer aldri, og «Mine kart» ble stående oppå
arket etter at menyen bak den forsvant.

Knappen emitter nå i stedet, og kalleren eier både lukkingen og ruta: i
hovedmenyen er det `goFrittLende`, som allerede er den ene som kjenner
`replace`-regelen — modusen er en bryter og ikke en drill-down, så
tilbake-knappen skal ikke lande i det vanlige kartet. Forsiden har fått samme
regel; snarveien brukte `push` og var uenig med hovedmenyens egen rad.

Røyktesten tar den nå fra `/fritt`, altså nettopp der navigasjonen ikke gjør
noe, og sjekken er verifisert i begge retninger.

---

## 2026-09-03 — v6.5.32: Et hold på en lende-pil åpner ikke punkt-arket lenger, og teksten skalerer videre

Nettleserens EGEN long-press var problemet begge veier. Kanthåndtakene eier
holdet sitt selv og stopper `pointerdown`, så vår egen long-press-timer fyrte
aldri på dem — men Androids `contextmenu` bobler opp fra hva som helst under
fingeren, og kart-wrapperen åpnet punkt-arket på den. Et hold på en kantpil ga
dermed både pilla med retning og kostnad OG et punkt-ark ingen hadde bedt om.
`onContextMenuEvent` har nå den samme vakten `onPointerDownLongPress` alltid har
hatt: et element med egen klikk-handler eier trykket.

Den samme nabo-effekten markerte teksten i arket. Åpner du et punkt med et hold,
ligger arket under fingeren i det nettleseren starter sitt eget tekstutvalg — og
kartflaten er `select-none`, men arket er det ikke, for teksten SKAL kunne
markeres for opplesing. Vakten står nå fra vår timer fyrer til fingeren slippes
og dreper `selectstart` og `contextmenu` i nøyaktig den luka. Ingen
`user-select: none`, ingen `pointer-events: none` på teksten: utenfor holdet er
den helt vanlig.

Headeren i punkt-arket følger dessuten hovedmenyens tekstvalg, som kroppen under
alltid har gjort — det samme gjør tips-kortet og DETALJER-etiketten. Koordinatene
er det man åpner arket for å lese, og de sto igjen på 13 px mens alt annet vokste.
Zoomen ligger på tekst-kolonnen og ikke på header-raden — en zoomet
`justify-between`-rad skalerer polstringen og dytter lukkeknappen ut av skjermen.

Hovedmenyen har fått et fjerde tekstvalg: 200 %. Lista i `useUiTextScale` er den
ene kilden — menyen utleder knappene sine av den — så et femte valg er én linje.
Etiketten ligger nå på sin egen linje over knappene, for fire knapper og en
etikett på samme rad får ikke plass på en telefon.

I 3D er stedsnavnene på globene større (12 px mot 9), og de følger tekstvalget
som resten av overlegget. Taket på navnet er i `vw` og ikke i rem, så det er et
ekte tak på SKJERMEN: blir teksten stor nok, brekker «Hellasbassenget» over to
linjer med bindestrek i stedet for å legge seg utover halve planeten. Infokortet
i natthimmelen er samtidig blitt høyere — to tredjedeler av skjermen mot drøyt
halve — og taket er flyttet fra den rullbare forelderen og inn i kortet selv, der
det må ligge for at headeren skal bli stående når kroppen ruller. Og den
minimerte pilla klipper ikke lenger navnet til «M»: retningen er detaljen som
kan krympe, navnet er grunnen til at pilla står der.

Med 200 % blir plassholderne i inputfeltene lengre enn feltene, og de ble klippet
midt i et ord. Regelen om ellipse må stå på selve inputen og ikke på
`::placeholder` — målt i Chromium gir den siste hard klipping, fordi
overflow-boksen er inputens. Ved fokus får plassholderen dessuten inputens egen
tekstfarge i full styrke, altså hvit på mørk flate og blekk på lys: den er der
for å bli lest i det øyeblikket man skal skrive. `currentColor` og ikke `white`,
for hele UI-en snur `--color-ink` mellom temaene.

Og feltet for kartnavnet gjentok overskriften sin ordrett: «Navn på kart» sto
både over feltet og inni det. Plassholderen spør nå om det man faktisk skriver
inn — «Hvor i lende?».

Alt er dekket av røyktesten, og de tre feilrettingene er verifisert i begge
retninger.

---

## 2026-09-03 — v6.5.31: Fritt lende får én tekststørrelse, markerbar tekst og en knapp som sier hva den gjør

Oppdaterings-banneret sto i full bredde mens det ventet på et halvbygd kart.
Teksten var riktig, men en boks over hele skjermen leses som et modalt lag — den
ser ut til å sperre hovedmenyen og Lende-knappen, som den aldri gjorde. I arbeid
er den nå en chip like bred som innholdet; ledig, med knapp, står den som før.

Tomtilstanden i Fritt lende hadde tre tekststørrelser, og et hint i 12 px er det
ingen som leser på en skjerm der det er det eneste som står. Nå er alt i modusen
én størrelse, overskriften bærer forskjellen med vekt alene, og teksten følger
hovedmenyens 100/125/150-valg — noe den som eneste tekstflate i appen ikke gjorde.
Hintet om «Nøyaktig posisjon» sier nå HVOR innstillingen bor: under tillatelser
for nettstedet i nettleserens egne innstillinger, som en engangsinnstilling.
Eieren fant den ikke selv, og uten den er dette den stille feilen — omtrentlig
plassering svarer med en fix, arket bygges, og det ser like ekte ut selv om det
er sentrert kilometer unna. Til slutt et «God tur i fritt lende».

`select-none` er flyttet fra roten til kart-flata. Den er der for gestene, men på
roten arvet hver eneste tekst i modusen den, og da kan ingen markere noe for
opplesing eller oversettelse. Overleggene er ren tekst over et ark og har ingen
gest å beskytte.

Knappen — modusens eneste kontroll — står nå i logoens egen gul med en myk glød
fram til første trykk, og har fått en bue innenfor sikteringen som ekko av
høydekurvene i merket. Over den peker en boble ned på knappen med teksten «GPS
på? Trykk her for å hente kart», én gang, til første trykk. Et siktekors i
chrome-grått leses som «vis hvor jeg er», ikke som «hent et kart».

En tom «Mine kart» får en snarvei til Fritt lende. Modusen bor bare i
hovedmenyen, og en tom liste er nøyaktig der noen står som ville hatt et kart
uten skjemaet over. På /om er versjonsnummeret ute av Fritt lende-fanen, og de to
avsnittene som fortsatt sa 500 meter er rettet til 250 — de ble glemt i v6.5.29.

---

## 2026-09-03 — v6.5.30: Tomtilstanden i Fritt lende ber om posisjon, ikke om nett

Under «Trykk knappen nede til høyre» sto det «Krever nett.» i kursiv. Eieren
leste plasseringen som rar, og den er det: nett er implisitt for et ark som
bygges av Overpass og Kartverket i det du trykker, og hovedmenyen sier det
allerede. Det brukeren faktisk må gjøre for at knappen skal virke, sto ikke
noe sted — slippe til posisjonen, og velge «Nøyaktig posisjon» framfor
omtrentlig. Den siste er den stille feilen: omtrentlig plassering svarer med en
fix, arket bygges, og det ser like ekte ut selv om det er sentrert kilometer
fra der du står.

Samtidig er røyk-sjekken for avstandsporten rettet. Den lette etter «Nytt
utsnitt først» med versal N, mens setningen i v6.5.29 ble skrevet om slik at
frasen havnet midt i den. Porten virket, sjekken bommet. Den matcher nå uten
hensyn til store og små bokstaver og uten grensa i seg, og krever i tillegg at
meldingen navngir hva avstanden måles fra — en sjekk med tallet bakt inn blir
grønn av feil grunn neste gang grensa flyttes.

---

## 2026-09-03 — v6.5.29: Flisene får sin fulle bredde igjen, og porten er 250 m

Forhåndsvisningen i «Nytt turkart» fikk loddrette svarte renner mellom
flisekolonnene på en 360 px-telefon. Årsaken er Tailwinds preflight, som setter
`img { max-width: 100% }`: flisene er absolutt plassert 256 px fra hverandre, og
er containeren smalere enn det — 204 px etter modalens polstring, seksjonens og
previewens nye `mx-[50px]` — klemmes hver flis inn til containerbredden mens
posisjonene blir stående. Høyden er inline og uberørt, og det er nettopp derfor
båndene var loddrette og bare loddrette. Målt i Chromium på 360 px: 226 px flis i
en 228 px boks før, 256 px etter. `max-w-none` på begge fliselagene retter det.
Samtidig er avstandsporten i Fritt lende senket fra 500 til 250 m, og teksten når
porten er stengt sier nå hva avstanden måles fra — «du er 10 m unna» ble lest som
«10 m fra å kunne bygge», altså stikk motsatt av det tallet betyr.

---

## 2026-09-03 — v6.5.28: Én vei inn til et nytt kart, og forhåndsvisningen står først

Forsiden hadde to grønne knapper som gjorde nøyaktig det samme — den store
«Lag kart der du står» i tom-tilstanden og pin-knappen i søkefeltet — og to
identiske primærhandlinger på samme skjerm er ikke et valg, det er en gjetning
om hvilken som er den ekte. Den store er borte. Pin-knappen bygger ikke lenger
selv: den henter posisjonen og åpner det samme skjemaet som «Flere valg»,
sentrert der du står, så begge inngangene ender på samme sted og forskjellen er
bare om senteret er søkt opp eller målt. Kan ikke posisjonen hentes, sier
skjemaet fra i en egen boks i lesbar størrelse i stedet for elleve piksler grå
tekst. I skjemaet heter navnefeltets overskrift nå «Navn på kart», som er det
feltet alltid har vært — den gamle overskriften beskrev koordinatlinja under,
og den er fjernet: senteret velges i forhåndsvisningen, ikke i fire desimaler.
Forhåndsvisningen er flyttet opp rett under navnet, foran Bredde, Høydekurver
og Format, fordi utsnittet er hovedvalget og de tre andre justerer noe man da
allerede ser. Og gest-flaten har fått en port: en bryter under overskriften,
av som standard, med den gamle overskriftsteksten som label. Uten den traff
hvert drag forbi previewen kartet i stedet for siden, og utsnittet flyttet seg
uten at noen ba om det. Previewen har i tillegg 50 piksler luft på hver side,
så det finnes en renne som alltid ruller siden.

Røyktestens stjernekikker-sjekk fikk samtidig rettet en tidsavhengig rød som
ikke hadde noe med denne endringen å gjøre. Globe-halvdelen krevde at ett av
månen/Mars/Jupiter/Saturn sto over horisonten, med begrunnelsen «praktisk talt
alltid ett av de fire oppe» — og det er ikke sant: 3. september 17:39 UTC sto
månen 3° UNDER horisonten over Vardåsen og ingen av de tre planetene var oppe.
Bare Venus, som ikke har globe. Alle grønne kjøringer fram til da lå mellom 06
og 15 UTC. Sjekken slår nå på utvikler-bryteren `lende-3d-himmel-tvang`, som
finnes for nøyaktig dette, og rydder den bort igjen i en `finally`. Halvdelen
som tester et stjernebilde hopper samtidig over legemene, siden tvangen legger
dem foran formasjonene i lista.

---

## 2026-09-03 — v6.5.27: Fritt lende måler avstanden fra senter, og porten er 500 m

Linjalen bærer nå «N m fra senter» i stedet for ekvidistansen så snart en
posisjon er kjent. Ekvidistansen er fast 10 m i denne modusen og leses én gang;
avstanden er tallet man trenger mens man går, fordi arket rekker 1 000 m ut til
hver kant og det er avstanden som sier når det tar slutt. Ved 500 m skifter
tallet til aksentfarge, og det er samme grense knappen står bak: over den bygger
et trykk et nytt ark der du står, under den sentrerer det og sier når et nytt
utsnitt blir tilgjengelig. Det avløser regelen om at et tap aldri fikk bygge
innenfor arkkanten — den var bygget rundt samme frykt, men målte det gale, for
«utenfor arket» er en grense man krysser én gang mens «har jeg nok kart foran
meg?» er spørsmålet man faktisk stiller. Lang-trykket er derfor borte: med
porten på plass gjør et hold nøyaktig det tapet gjør, eller nøyaktig ingenting.
Og en nektet posisjon sier det nå: modusen var helt stille når tillatelsen ble
avvist, med en chip som lette etter en fix som aldri kunne komme — den samme
alerten som «Lag kart der jeg er» viser, fra en delt kilde (`lib/gpsFeil.js`) så
de tre stedene som melder GPS-feil ikke kan drive fra hverandre.

---

## 2026-09-02 — v6.5.26: Kart-cachen var aldri i rekkevidde — røyktesten kjører nå også på master

Cachen fra v6.5.24 virket, men ingen andre enn PR-en som skrev den kunne lese
den. Et kjørende workflow henter bare caches fra sin egen gren eller fra
standardgrena, og røyktesten kjørte bare på `pull_request` — så hver PR skrev
kartet til sin egen gren og fikk det slettet i det PR-en ble merget. Målt på
PR #373, den første etter at cachen kom inn: full bygging fra Overpass og
Kartverket, og så «Cache saved with key: royk-vardasen-v1-123-…» til en gren
som forsvant minutter senere. Testen kjører derfor nå også på push til master,
som er det ene omfanget alle grener kan lese fra. Uten paths-filter, fordi
GitHub Actions ikke støtter YAML-ankere og en kopiert sti-liste ville driftet
fra originalen første gang noen la til en sti bare ett sted. På master avbrytes
heller ingen kjøring lenger av en nyere push: der er jobben å FYLLE cachen, og
en avbrutt kjøring skriver ingen.

---

## 2026-09-02 — v6.5.25: Stedsnavn følger kartet mens du roterer

Counter-rotasjonen av tekst hoppet over hele rotasjons-gesten: navnene lå på
skrå så lenge fingrene var nede og snappet vannrett først når man slapp. Nå står
de opp hele veien.

Begrunnelsen for hoppet var ekte, og den er ikke fjernet — den er MÅLT. Under en
gest er kart-diven et composited lag, så selve rotasjonen er gratis; i det vi
skriver en ny transform på tekstene, må hele SVG-en rasteriseres på nytt hver
frame, og kostnaden vokser med arket. Tre grep gjør at det nå går: én
rAF-koalescert skriving per frame i stedet for én per touchmove, et snapshot
bygget ÉN gang per gest (all querySelectorAll, closest og baseVal ut av
frame-løkka, og alt som er cullet eller LOD-skjult ut av settet), og et
frame-budsjett som tar tida på hvert pass. Sprenger passene budsjettet, faller
den tilbake til den gamle oppførselen for resten av kartets levetid og skriver
hvorfor i perf-loggen — vi gjetter ikke på hva telefonen tåler. Et nytt kart gir
en ny sjanse, så ett tungt ark låser ikke resten av økta.

Reglene bor i `lib/mykRotasjon.js` (ren og enhetstestet), og bryteren «Myk
tekstrotasjon» i Utvikler-fanen slår den av for sammenlikning i felt.
Røyk-sjekken måler MIDT I gesten med syntetiske to-finger-eventer — det er det
eneste øyeblikket forskjellen finnes, og den er verifisert i begge retninger.

---

## 2026-09-01 — v6.5.24: Røyktesten cacher Vardåsen-kartet — ingen nettbygging på 3D-PR-er

Kart-byggingen er både den dyreste delen av røyktesten (~2 av jobbens ~6
minutter) og den eneste som kan feile fordi en tredjepart har en dårlig dag:
den henter Overpass og Kartverket WCS. Kartet er samtidig en ren funksjon av
kart-pipelinen og byggeskriptet — det trenger bare bygges når en av dem endrer
seg.

`--kartcache=<sti>` gjør at røyk-skriptet bruker et lagret kart hvis det finnes,
og ellers bygger som før og legger resultatet der. I CI er stien en
`actions/cache`-sti, og nøkkelen er hashet over nøyaktig de filene kartet lages
av: `scripts/build-vardasen-svg.js`, `src/lib/**` og avhengighetstreet i
`package-lock.json`.

**Lockfila må inn UTEN appens egen versjon, og det er ikke en detalj.** Første
utgave hashet fila rå, og CI-kjøringen avslørte det med en gang: samme filtall,
ny hash, uten at én kartkilde var rørt. Prosjektet bumper versjonen i hver PR,
så nøkkelen ville endret seg hver gang og cachen aldri truffet — den ville vært
ren pynt. `laasDigest` fjerner `version` begge stedene den står og hasher
resten, så en `polygon-clipping`-bump (som kan flytte en kystlinje) fortsatt
tvinger en ny bake.

`src/lib/tour3d/**` er UTE av nøkkelen med vilje — 3D-motoren leser kartet, den
lager det ikke, og det er nettopp 3D-PR-ene som trenger et ekte kart. En nøkkel
som tok med tour3d ville bommet på hver eneste kjøring som har nytte av cachen.
Logikken bor i `scripts/kartcache-nokkel.mjs` med tester, og det finnes ingen
`restore-keys`: en delvis treff ville gitt et kart bygget av kode som ikke
lenger finnes, altså sju grønne sjekker på et ark de ikke beskriver.

Cachen sanitetssjekkes før bruk — størrelse og at det faktisk er et SVG. Tallene
er målt: demo-kartet i repoet er 75 kB, det ekte arket 691 kB, og gulvet står på
150. En avbrutt jobb kan ha lagret en halvskrevet fil, og et trunkert kart ville
gitt sju sjekker som feiler på noe som ikke er kodens feil. To huller i
workflowens `paths` er tettet samtidig: `scripts/build-vardasen-svg.js` og det
nye nøkkel-skriptet sto ikke der, så en PR som rørte dem kunne lande uten at
røyktesten så kartet den lagde.

---

## 2026-09-01 — v6.5.23: Kameraet står aldri under terrenget — heller ikke i utforskermodus

Følge-riggen har alltid løftet kameraet over bakken; det er den som gjør at man
ikke plutselig står bak eller inne i et fjell når stien går bratt. Den frie
riggen — 3D åpnet uten tur — hadde ikke noe gulv i det hele tatt. Blikkpunktet
beholder høyden sin når man panorerer, og med polarvinkelen nesten vannrett står
kameraet omtrent i blikkpunktets høyde, så panorerte man inn i en fjellside
eller bare langt nok ut, havnet man under arket og kunne bevege seg fritt på
undersida av kartet.

Gulvet bor nå ett sted, `terrainFloorY` i `cameraRigs`, og begge riggene måler
mot det: terrenget under kameraet pluss 12 meter klaring. Samplingen klemmes til
arket, og det er selve poenget utenfor kanten — en fallback på havnivå der ville
gitt fritt leide under skjørtet, mens kantens egen høyde som gulv lar deg komme
helt ut og se arket fra sida uten å komme under det. Å zoome ut til kantene
vises er fortsatt meningen: gulvet er en høyde, ikke en lenke i planet.

I den frie riggen er løftet en stiv forflytning av HELE orbiten, kamera og
blikkpunkt sammen. Det er det som gjør at det ikke slåss med noe annet der inne:
polarvinkel, asimut og avstand er uendret, så himmelvippens polarlås klemmer
ikke imot og zoomen driver ikke — bildet er det samme, bare et stykke høyere. Å
klemme polarvinkelen i stedet ville slåss med nettopp den låsen, og å klemme
bare kameraets Y ville endret både avstand og tilt bak ryggen på brukeren.
Løftet er hardt oppover og mykt nedover: å stå inne i et fjell i ett eneste
bilde er feilen dette finnes for, mens et hardt fall når man panorerer ut over
en kant ville lest som et rykk i bildet.

---

## 2026-09-01 — v6.5.22: Automatisk påfyll av nabofliser er fjernet — pilene er veien, ikonet ble med

Automatikken lovet det de store kartappene gjør, og gjorde det dårligere. Et
kontinuerlig kart betyr sømløse fliser i alle retninger i det du drar; her betyr
det ett 2 × 2 km-ark til, bygget på 5–30 sekunder fra Overpass og Kartverket, i
den ene retningen dvele-triggeren gjettet på. Avstanden mellom løftet og
leveransen er nettets og kildenes, ikke kodens, så den kunne ikke tunes bort.
De åtte lende-pilene på arkkanten er nå den eneste veien til en ny flis: de sier
hvor, de sier hva det koster, og de bygger ingenting uten et trykk.

Borte er `useAutoNabo` med bryterne «Hent nabokart automatisk» og «Gjør arket
firkantet» (automatikk-varianten), pan-intensjonssporingen, økt-gjerdet og
status-raden i Utvikler-fanen — til sammen fem filer og en røyk-sjekk. «Gjør
arket firkantet» og «Fyll hullene» står igjen som det de alltid var utenfor
automatikken: bannere med kostnaden skrevet på. Kanthåndtakene er ikke lenger
gated på at automatikken er av, så de står nå alltid framme når kartet er
relevant. Gamle nøkler i localStorage (`lende-auto-nabo`, `-firkant`) blir
liggende ubrukt på enheter som har dem; de leses ikke lenger av noe.

Det ene som overlevde er den fine loaderen: flis-ikonet som viser arket i
miniatyr med rutene som bygges blinkende — én, to eller fire, avhengig av
retning og hvor stort arket er. Det ble laget for automatikken og kom aldri inn
i den manuelle utvidelsen, som er der retningen ikke er gjettet men trykket.
Ikonet bor nå i `components/FlisIkon.vue` og fôres av `byggerFlisRetning` fra
`useMapExtend`. Bygginger uten retning — nytt kart ved et søketreff, ombygging i
ny størrelse — beholder spinneren, for der finnes det ingen naboflis og et
ark-ikon ville lovet noe annet enn det som skjer.

---

## 2026-09-01 — v6.5.21: Nordlyset er dempet — det er summen av gardiner som teller

Eieren kjørte demoen i felt og meldte at alle seks stegene ble voldsomme, med
for kraftige bånd. Diagnosen er at styrken er regnet PER GARDIN mens det man ser
er SUMMEN: blandingen er additiv, et sterkt nordlys tegner sju gardiner over en
bue på 150°, og de overlapper. Ved full styrke lå toppen av én enkelt gardin på
alfa ≈ 0,55, så to som krysset klippet i alle tre kanalene — og et klippet grønt
er hvitt. Det er derfor «Svært sterkt» kom ut som en flat lysvegg i stedet for
et draperi med struktur.

Fire skruer, alle i samme retning. Grunnivået i fragment-shaderen er halvert
(0,48 → 0,24). Styrkekurven har fått komprimert topp (`0,34 + 0,50·p/65` mot
`0,30 + 0,70·…`) — gulvet fra v6.5.16 står urørt, for det svakeste steget skal
fortsatt være synlig, og det er hellingen som er slakere. Sidekantene på hver
gardin er lange: platået er nede fra 56 % til 32 % av bredden, så nabogardiner
møtes kant mot kant framfor full styrke mot full styrke. Og strålene og
lysbølgen har mindre utslag, fordi de er struktur og ikke styrke — toppene deres
kom oppå både hverandre og naboen. Forskjellen mellom svakt og sterkt bæres
fortsatt av farge, høyde, buebredde og antall, som er lettere å lese enn
lysstyrke. Taket er pinnet i en test med begrunnelsen, så ingen skrur det opp
igjen uten å møte den.

---

## 2026-09-01 — v6.5.20: Overlegget i 3D holder seg unna navigasjonssøyla

Røyktesten i CI kjørte de nye kontrollene mot det ekte Vardåsen-arket for første
gang og fant to ting. Den ene er ekte: navigasjonssøyla ligger absolutt plassert
på høyre kant, og flyt-innholdet i 3D-overlegget la seg under den — infokortet
er sentrert med inntil 86 vw, så på et smalt vindu havnet «alle N» i et
stjernebildekort under zoom-skyven og var ikke til å trykke på. Polstringen er
lagt på ROTEN av overlegget og ikke på hver rad: absolutt plasserte barn
(lerretet, himmelkompasset, søyla selv) måler mot padding-boksen og står stille,
mens hver flyt-rad rykker inn i én operasjon — også de som ikke kolliderer i dag,
som POI-panelet, der 60 vh med nålegrupper vokser rett inn i søylas bånd. Den
andre var sjekken selv: den fylte zoom-skyven med et fast «0,8», men hvor skyven
STÅR ved start følger arkets størrelse og hva forrige sjekk etterlot, og på det
ekte arket sto den allerede på 0,757. Skyven virket; sjekken målte et lite steg
opp og kalte det stillstand. Den går nå fra ende til ende, som ikke antar noe om
utgangspunktet.

---

## 2026-09-01 — v6.5.19: Zoom-skyv og retningsrose for desktop, i både kart og 3D

Uten hjul fantes det ingen enkel vei til å zoome, og i 3D fantes det ingen vei i
det hele tatt til å tilte landskapet — `settBlikkHoyde` bor i vippe-regimet og
rekker bare fra horisonten og opp. To kontroller er lagt til langs høyrekanten,
begge bak `(hover: hover) and (pointer: fine)`: en loddrett `ZoomSkyv` med
pluss/minus, og en `RetningsRose` som bærer BEGGE retningsaksene i én rund flate.
Rosa er himmelhvelvet sett ovenfra — senter er rett opp, randen er rett ned,
horisonten er den stiplede ringen imellom — så azimut og høyde er ikke to skyver,
men én retning på en kule. I kart-modus faller høyden bort og skiva snurrer i
stedet, med nåla mot nord og dobbelttrykk som nullstiller. En «kube» à la Blender
ble vurdert og forkastet: den snakker om et objekt sett utenfra, mens man her står
PÅ kartet og ser ut, og den har ingen naturlig tastaturbetjening. Regnestykket bor
i `lib/navKontroller.js`, som er rent og har fjorten tester — zoomen er
logaritmisk, så hver dobling får like mye vei. `freeRig` har fått
`settBlikkRetning`, som velger regime selv og setter polarlåsen FØR vinklene, samt
`settAvstand`/`avstandsGrenser`; `usePinchZoom` har fått `zoomTil`/`zoomGrenser`.
De to `<input type="range">`-ene under rosa er ekte og betjenes med tastatur — de
ligger oppå med `opacity: 0` og `pointer-events: none`, ikke `sr-only`, så de
beholder en ekte boks. `Tour3dBlikkSkyv.vue` er erstattet av rosa, som arver
`blikk-skyv`-klassen slik at røyk-sjekken fortsatt måler noe. Tekstskala-skyven i
kartet er lagt bak en «A»-knapp, så høyrekanten ikke blir et instrumentbord. Og
søyla står 34 px innenfor viewportkanten: de åtte lende-pilene dokker i et bånd
der ute, og den høye søyla dekket nordøst-dokka. Røyktesten fanget det med
elementFromPoint — «1 av 8 lende-piler ligger under noe annet» — som er nøyaktig
det den sjekken ble laget for.

---

## 2026-09-01 — v6.5.18: Mindre farge i det sterke nordlyset, og en lukk-knapp som blir stående

Rødt og fiolett er halvert i de to sterkeste trinnene. Andelene ble skrudd opp i
v6.5.16 fordi utoningen i fragment-shaderen maskerte dem bort, og da den
maskeringen forsvant i v6.5.17 traff de fullt ut: felttest meldte at «Sterkt» og
«Svært sterkt» ble voldsomme. Rødt står nå på 0,21 ved 45 % og 0,45 ved 72 %,
fiolett på 0,18 og 0,30 — nok til å fortelle at nordlyset står høyt, ikke nok til
å overta det. Terskelene er urørt: et svakt nordlys er fortsatt grønt og bare
grønt. Kildeteksten ved siden av X-en i nordlyspanelet er dessuten fjernet. Alle
cellene i pilla er `shrink-0` og pilla er `overflow-hidden`, så en lang
demo-tekst dyttet lukk-knappen forbi klippekanten — «Rett over hodet» hadde ingen
X i det hele tatt. Merket er nå ett kort ord i «Nordlys»-etiketten øverst til
venstre, i cellen som ikke vokser, med full NOAA-attribusjon i tittelen.
Demo-merkingen står fortsatt, som røyktesten krever. Til sist er nordlyspanelet
og den grønne demolinja flyttet ØVERST i nattoverlegget, rett under søkefeltet, i
stedet for under infokortet. De sto der værraden står om dagen, men et
stjernebildekort er en høy, rullbar tekstflate — nordlyset havnet derfor midt på
skjermen med demolinja klemt inn foran seg. Sammenlikningen med værraden holdt
ikke: værraden er skjult i nattmodus og nordlyset finnes bare der, så de to deler
ikke plass i praksis, og da skal varselet stå først.

---

## 2026-09-01 — v6.5.17: Nordlyset springer ikke lenger ut av ett punkt

Med ovalen rett over hodet ble den øvre kanten av gardinene eksakt 90 grader, og
der er radien i asimutretningen cos(h) altså null: hele toppkanten kollapset til
ett og samme punkt i senit, uansett hvilken asimut gardinen sto i. Alle sju
strålte derfor ut av ett felles perspektivpunkt, som leses som en tegnefeil
fordi det er en. Et ekte nordlys i magnetisk senit gir riktignok en korona med
stråler som peker mot betrakteren, men den koronaen har spredning og struktur —
ett matematisk punkt har ingen av dem. Taket står nå på 74 grader, og
forskjellen mellom «rett over hodet» og «nesten rett over hodet» er ikke lesbar
på en skjerm.

Samtidig har båndene fått mer spill. Foldene forplanter seg nå oppover gardinen
i stedet for å svinge som en stiv plate, og utslaget vokser med aktiviteten. Det
som faktisk leses som dansende nordlys er likevel lagt i LYSET og ikke i formen:
to lysbølger løper langs båndet i motsatt retning, med en periode på noen
sekunder. En gardin som fysisk svinger så fort ville sett ut som en
animasjonsfeil, mens en lysstyrke som bølger langs den er nettopp det man ser i
et kraftig utbrudd — og derfor dempes den bort i svake bånd, som står nesten
stille.

---

## 2026-09-01 — v6.5.16: Nordlyset kan faktisk ses

Nordlyset fra v6.5.15 var teknisk riktig og praktisk usynlig. Fire feil dro i
samme retning, og den viktigste var en blandingsfeil: fargen ble premultiplisert
med alfaen i shaderen samtidig som three sin additive blanding ganger med den én
gang til, så et bånd med alfa 0,07 kom ut på 0,005 — altså ingenting. I tillegg
lå portene for rødt og fiolett nøyaktig der utoningen var null, slik at begge
fargene ble multiplisert bort og nordlyset var grønt uansett styrke;
strålefrekvensen ga tretti striper over en gardin på 31 grader, som leses som
skanlinjer og ikke som stråler; og styrken var lineær fra null, så de svakeste
stegene i demoen aldri kom over terskelen for hva et øye ser på en skjerm.
Styrken har nå et gulv, og forskjellen mellom svakt og sterkt bæres av farge,
høyde, buebredde og antall gardiner i stedet. Et svakt nordlys tegnes som en
diffus bue uten stråler, som er det et svakt nordlys faktisk er, og hver gardin
har fått sin egen topphøyde og en bølget underkant så de sju ikke står som en
mur. Demoteksten sier nå hvor på himmelen båndet står, siden et svakt nordlys
lavt i nord ligger under blikket nattmodus åpner med.

---

## 2026-08-31 — v6.5.15: Nordlys på natthimmelen

Slår du på natt i 3D, henter Lende nordlysvarselet fra NOAAs OVATION-modell og
legger grønne gardiner over den nordlige himmelen. Formen er loddrette stråler
som folder seg langsomt — nordlyset følger jordas magnetfeltlinjer, og det er
derfor strålene er parallelle — med fargene lagt etter høyde: grønt fra oksygen
rundt 120 km, rødfiolett over 200, blåfiolett frynse nederst i sterke bånd.
Additiv og gjennomsiktig, så stjernene skinner gjennom. Ikke fotorealisme; det
er samme mål som med puff-skyene, en form som er gjenkjennelig i BEVEGELSE.

Gardinene står der nordlyset faktisk står. Hvor høyt over horisonten de henger
regnes ut av hvor langt nord ovalen ligger i kveld — lest av selve målingen og
ikke av Kp — og av at lyset kommer fra rundt 120 km. Fra Tromsø kan det fylle
senit; fra Sør-Norge ligger det lavt i nord; og er ovalen så langt unna at
jordkrumningen skjuler den, tegnes ingenting. Første utgave lot gardinen
kollapse til null høyde når ovalen sto rett over hodet, fordi nedre og øvre kant
ble regnet fra samme avstand; testen fant det, og ovalen har nå bredde.

Panelet øverst er speilbildet av værraden, med samme pilleform og samme X: styrke,
sjanse der du står, skydekke, Kp og solvindfart. Skydekket er med fordi det
avgjør — «Sterk» gjennom et tett skylag sender folk ut i kulda for ingenting — og
det tas fra MET-varselet vi allerede har, uten et nytt kall. Alle fire
endepunktene er MÅLT (`npm run probe:nordlys`), ikke gjettet: CORS «*» og ingen
User-Agent-krav, så ingen Worker-rute trengs; solvinden hentes fra
summary-filene på under 1 kB framfor rtsw på 2,6 MB; og rtsw-arrayet er ikke
tidssortert, så siste rad kan være et døgn gammel. Varselet pakkes IKKE offline,
av samme grunn som værvarselet: utdatert betyr feil, ikke bare mindre presist.

Nordlys-demo i Utvikler-fanen går gjennom styrkene, 14 s hver, og finnes av en
sterkere grunn enn vær-demoen: et synlig nordlys over Sør-Norge er noen netter i
året, så uten den kan laget i praksis ikke prøves — og aldri i CI.

---

## 2026-08-31 — v6.5.14: Tyren, Ørnen og Nordlige krone på natthimmelen

Tre nye stjernebilder, valgt etter hva som faktisk står høyt nok over en norsk
horisont. Tyren fordi Orions eget infokort allerede pekte på Aldebaran uten at
det fantes en figur å peke på; Ørnen fordi Sommertriangelet manglet sitt tredje
hjørne mens Lyren og Svanen sto tegnet; Nordlige krone fordi den er en liten,
tydelig halvsirkel som kulminerer på 57° i Oslo og 48° i Tromsø. Store hund ble
vurdert og forkastet i samme runde: Sirius er himmelens lyseste stjerne, men
figuren kulminerer på 13° i Oslo og 4° i Tromsø, og med 60 %-regelen i
`MIN_ANDEL_OPPE` ville lista lovet noe man ikke kan se.

Magnitudegrensa var ikke til hinder — baken henter figurstjerner uansett
lysstyrke — så Hyadene og ørnevingene kom inn av seg selv; katalogen vokste fra
173 til 191 stjerner. Figurene er hentet ut av den innbakte fasiten framfor å
tegnes på frihånd, og Tyrens hals er bevisst utelatt som telefonskjerm-
forenkling. Elnath deles med Kusken, slik Alpheratz deles av Pegasus og
Andromeda. Kryss-lenkene er skrevet inn begge veier — Orion peker på Tyren,
Lyren og Svanen på Ørnen, Bjørnevokteren på kronen — mens snarveiene i
infokortet ordner seg selv, siden `naboerFor` måler vinkelavstand: kronen og
Bjørnevokteren finner hverandre på 14°. Aldebaran, Altair og Alphecca er ikke
lenger løse stjerner, så teksten om dem er flyttet inn i figurene og Tau, Aql og
CrB er ute av `STJERNEBILDE_NAVN`. Wikipedia-adressene kunne ikke prøves herfra
— no.wikipedia er sperret fra utviklingsmiljøene — og er bekreftet av eieren.
Tyren var innom astrologi-artikkelen «Tyren (stjernetegn)» underveis, og det er
notert i lenke-proben: adressen svarte, så en probe som bare måler status ville
godtatt den. En lenke som svarer er ikke det samme som en lenke som er riktig.

---

## 2026-08-31 — v6.5.13: «Orions belte» finner Orion

Orions belte er ikke en egen konstellasjon — det er δ Mintaka, ε Alnilam og
ζ Alnitak, altså én av kjedene inne i Orion, og Lende har tegnet den siden
figuren kom inn. Men himmelsøket kjente bare «Orion», stjernenavnene og
Bayer-betegnelsene, så nettopp det ordet folk flest bruker om den delen av
himmelen de kjenner best ga null treff. Et søk som ikke svarer ser ut som at
figuren mangler. `FOLKENAVN` i `stjernebildeInfo.js` er en kort tabell med
navn på FIGUREN som ikke er figurens eget navn, nøklet på formasjons-id-en som
resten av prosaen: «Orions belte» og de nordiske folkenavnene Jakobsstaven og
Frøyas rokk peker på Orion, «Store bjørn» på Karlsvogna, som er asterismen
inne i Ursa Major. Ingen data er bakt om, og lista lover fortsatt bare det som
faktisk tegnes — Orion er en vinterfigur og dukker opp i søket først når den
står over horisonten.

---

## 2026-08-30 — v6.5.12: HTML strippes ut av kulturminne-tekstene

Kulturminnesøk-tekstene er skrevet av brukere i et felt som slipper gjennom markup, og API-et leverer den rått — beskrivelsen av Charlottenborg gård på Jeløy kom ut med et synlig «<br />» på hver eneste linje, altså uleselig uten at noe var galt med hentingen. `lib/htmlTekst.js` er nå den ene stripperen: `<br>` og blokk-tagger blir ekte linjeskift (avsnitt får tom linje, listepunkter ett skift), `<img>` forsvinner sammen med linja den sto på, og all annen formatering — fet, kursiv, farger, fontstørrelse, lenker — mistes stille mens teksten består. Entiteter dekodes først, så en dobbeltkodet kilde ikke slipper unna. Begge kildene går gjennom den: brukerminnene (`cleanBeskrivelse`, titler og bildetekster) og de fredede minnene fra WFS-en (`splitInformasjon`, navn).

Rute-røyktesten fikk samtidig en fiks som ikke handler om kulturminner: «Fritt lende: lagret ark lastes UTEN nettverk» seedet IndexedDB fra «/», og siden sjekken rett før setter `lende-last-mode` til 'rute', ble den lasten boot-gjenopptatt til ruteplanleggeren — som henter OSM-fliser. Flisene var fortsatt i lufta når rute-avskjæringen ble satt opp og lander som «eksterne kall» i en sjekk om noe helt annet: rødt i CI, grønt lokalt. Seedingen skjer nå fra /tegnforklaring, som verken har boot-hook eller fliser.

Bildet i detalj-skuffen er en lenke til Kulturminnesøks eget opphav og pakkes ikke med i offline-fila, så uten dekning sto det en brukket ramme midt i kortet og leste som at kortet var ødelagt. Figuren fjernes nå i sin helhet når bildet ikke lastes, og flagget nullstilles når skuffen bytter kulturminne så neste minne ikke arver feilen fra forrige.

---

## 2026-08-30 — v6.5.11: Den døde DOM10-fallbacken er ute

`hoyde_dom10_33` — appens tredje DEM-endepunkt, DOM 10 m som siste utvei — er
fjernet fra `WCS_ENDPOINTS`. Den svarer «*** UKJENT APPLIKASJON *** Applikasjon
'/skwms1/wcs.hoyde-dom10_33' er ukjent», målt av Svalbard-proben som spurte den
underveis. Den lå serielt ETTER de to hedgede DTM-ene, så hvert kart-bygg der
begge feilet betalte en ekstra round-trip og et 15 s klient-tak på nøyaktig den
stien der brukeren allerede venter lengst — samme kostnad som de tre gjettede
DTM-1m-coveragene som ble trimmet i v8.10.18, bare med en tjeneste som en gang
faktisk fantes. Det er lærdommen som er skrevet inn over lista: et endepunkt er
ikke sant fordi det var sant en gang, så både tillegg og trimminger skal måles
først, og proben er verktøyet.

Sletting uten en test er en sletting som blir angret i god tro, så
`demFetcher.timeout.test.js` låser at fetch treffer nøyaktig to endepunkter og
at ingen av URL-ene inneholder «dom10». Den er verifisert i BEGGE retninger:
grønn på riktig kode, rød når endepunktet settes tilbake. Fallback-testen teller
nå 25 s i stedet for 40, siden de to gjenværende kjører hedget og er avgjort
innen 19. Det andre funnet fra Svalbard-undersøkelsen — at pipelinen fabrikkerer
et syntetisk ark i stillhet utenfor Kartverket-dekning — står bevisst igjen som
et eget valg, ikke som et biprodukt av en opprydning; CLAUDE.md-seksjonen sier
hvorfor og hva de to veiene koster.

---

## 2026-08-30 — v6.5.10: Svalbard-undersøkelsen skrevet ned og lagt død

Proben fra v6.5.9 kjørte, og svaret er skrevet inn i CLAUDE.md framfor å bli
liggende i en Actions-logg som ruller ut av rekkevidde. Hovedfunnet er at det
IKKE finnes noen WCS for Svalbards høydedata: Geonorge har «Svalbard DTM 5/20/50»
og «Høydereferansemodell på Svalbard», men alle fire som GEONORGE:DOWNLOAD. Det
betyr at `demFetcher.js` ikke kan få en fjerde linje i `WCS_ENDPOINTS` — dette er
en bake, som N50-flisene, og mekanismen finnes allerede i `geonorgeN50.mjs`. To
antakelser fra utredningen ble dessuten motbevist av målingen: Terrarium over
Svalbard har ekte detalj ned til minste piksel og er ikke GMTED2010, og UTM32 er
ikke sperren jeg trodde — 0,31 % skalafeil ved Longyearbyen er på linje med det
Øst-Finnmark allerede lever med, så de 35 kallstedene til `wgs84ToUtm32` trenger
ikke røres. Seksjonen bærer også de målte negativene, så ingen prøver de samme
fire gjettede tjenestenavnene om igjen.

Eieren har lagt ønsket dødt inntil videre, så ingenting er bygget og ingen kode i
kart-pipelinen er rørt. To funn står igjen som åpne og gjelder uansett om
Svalbard blir noe av: `hoyde_dom10_33`, appens tredje DEM-fallback, er død og
svarer «UKJENT APPLIKASJON» — hvert kartbygg som når den betaler en round-trip
til en tjeneste som ikke finnes — og utenfor Kartverket-dekning fabrikkerer
pipelinen i stillhet, fordi WCS-feil gir syntetisk DEM og Terrarium-fyllet
eksplisitt hopper over syntetiske kilder. Proben beholdes med resultatene i
filhodet og med sin egen kjente svakhet notert: den rapporterer ✓ for et
HTTP 200-svar som bærer en feil-XML i kroppen.

---

## 2026-08-30 — v6.5.9: En probe som spør hvem som har høydedata for Svalbard

`demFetcher.js` kan tre endepunkter, og alle tre er fastlands-Norge. Over
Svalbard faller pipelinen derfor gjennom til `buildSyntheticDEM` — én gaussisk
haug på 100 m — og `createMapFlow` hopper eksplisitt over Terrarium-fyllet for
kilder som starter med «synthetic». Feilen er altså ikke en feilmelding, men et
kart som ser ekte ut og er oppdiktet. Kildene kan ikke prøves der spørsmålet
stilles: kartkatalog-, wcs-, wms-geonorge og geodata.npolar.no svarer alle 403
fra utviklings-sandkassene. Derfor en MÅLING og ikke en hypotese, etter mønster
av `probe-himmelkart.yml`: `npm run probe:svalbard` spør Geonorges kartkatalog
og NPIs ArcGIS-katalog om hva som FINNES, prøver GetCapabilities mot hver
kandidat, og gjør så én ekte GetCoverage over 2 × 2 km ved Longyearbyen gjennom
appens egen `fetchWCSDtm` — ikke en parallell klient, så det som måles er det
pipelinen faktisk ville gjort. Den rapporterer celler, oppløsning, høydespenn og
noData-andel, for et 200-svar er ikke dekning: en tjeneste kan svare pent med et
rutenett der hver celle er noData. Vinneren får to oppfølgingsspørsmål —
`RESPONSE_CRS=25832`, som avgjør om Svalbard kan mates gjennom dagens
UTM32-rør uten å røre de 35 kallstedene til `wgs84ToUtm32`, og et andrepunkt ved
Ny-Ålesund, som ligger i sone 32 der Longyearbyen ligger i 33. Proben skriver
ingenting og feiler aldri; utskriften er hele leveransen.

Siste trinn måler Terrarium på 78°N, og det trinnet gikk gjennom to forkastede
utgaver som begge er verdt å kjenne. Å telle bit-identiske nabopiksler fanger
bare nearest-neighbour-oppskalering — resamples en grov modell bilineært, får
hver piksel sin egen lille verdi og målingen melder «ekte detalj» om en modell
som ikke har noen. Å lete etter perioden i andrederiverte var riktig idé med
ubrukelig estimator: den maksimerer over k, og med 16 grupper vinner støyen, så
den landet på taket i søket for hver eneste flis. Det som virker er
variogrammet, altså RMS-høydeforskjell ved økende avstand: ekte terreng er
omtrent fraktalt med stigning 0,5–0,8 i log–log helt ned til én piksel, mens
interpolerte data er stykkevis lineære under blokkstørrelsen og derfor
brattere. Målt fra sandkassa — AWS er ikke sperret — gir Svalbard-flisene
stigning 0,53 ved 16 m og 0,56 ved 4 m, altså ingen interpolasjonsknekk i det
hele tatt. Det motsier antakelsen om at Terrarium bare har GMTED2010 (~230 m)
der oppe, og gjør den til en reell kandidat framfor bare en nødløsning. Ingen
kode i kart-pipelinen er rørt.

---

## 2026-08-30 — v6.5.8: Sol opp og sol ned, øverst i solkortet

Infokortet for sola sier nå når hun står opp og når hun går ned, og det gjelder
ARKET som er åpnet — lat/lon er kartets midtpunkt, ikke der telefonen tilfeldigvis
befinner seg. Tidene står øverst, før prosaen, fordi de er noe man slår opp mens
resten er noe man leser.

METs Sunrise-API ble ikke brukt, og begrunnelsen er sterkere her enn den var for
`erNatt` i v6.1.0: tidene er akkurat det man vil vite på vei ut, altså ofte etter
at dekningen tok slutt. Et oppslag som feiler på fjellet er verdiløst nettopp der
spørsmålet stilles. Vi har solas posisjon lokalt fra før (Meeus), og tidene er
bare det tidspunktet den posisjonen krysser en høyde vi allerede har definert.

METODEN ER Å SØKE OG IKKE Å LØSE LIKNINGEN. Den lukkede formelen (Meeus 15.1)
antar at solas deklinasjon står stille gjennom døgnet, og bryter sammen nær
polarsirkelen der den nettopp ikke gjør det. `solTider` sampler i stedet høyden
gjennom døgnet og halverer seg inn på hvert fortegnsskifte. Det koster noen
hundre evalueringer — ingenting for et kort som tegnes én gang — og polardøgnet
faller ut av seg selv: finnes ingen kryssing, er sola enten oppe eller nede hele
døgnet, og høyden ved midnatt sier hvilken. Kortet skriver da «midnattssol» eller
«mørketid» framfor å stå tomt. Overgangsdøgnene, der bare den ene kryssingen
finnes, viser det ene som er sant.

MÅLT MOT YR: eieren leste av Stormoen i Drammen 30. august — opp 06:10, ned
20:28. Vi gir 06:09 og 20:28. Det ene minuttet er avstanden mellom Yrs punkt og
arkets midtpunkt, og det tallet er ankeret i testen. Resten av testene er
invarianter som holder uansett sted og dato: at tidene FAKTISK er kryssingene,
at sola er nede før oppgang og oppe etter, at dagen er lengst ved solverv, og at
Tromsø får ti uker midnattssol og sju uker mørketid. Et enkelt anker kan treffe
ved flaks; en invariant over hele året fra Oslo til Tromsø kan ikke.

Merk at døgnvinduet er det LOKALE, altså telefonens tidssone — som er sånn Yr og
METs tabeller leses. Første utgave av polardøgn-testen pinnet datoen for
overgangsdøgnet og var derfor grønn i Oslo og rød i CI, som kjører i UTC.

---

## 2026-08-30 — v6.5.7: Solkartet er målt, og proben spør om ett legeme om gangen

Sola fikk et ekte overflatekart, og veien dit avdekket en feil i proben som
gjorde den ubrukelig. Første kjøring med sola i kandidatlista ble ratebegrenset:
nesten alt fra Jupiter og nedover kom tilbake som HTTP 429. Det er nøyaktig det
skriptets egne kommentarer advarer om fra runde to — en probe som blir
ratebegrenset måler ingenting — bare med fem legemer i lista i stedet for fire.
`--probe sol` begrenser nå til ett legeme, som tar spørsmålene fra rundt seksti
til rundt åtte, og en 429 gir ett forsøk til etter fem sekunder. Forskjellen på
«filen finnes ikke» og «vi spurte for fort» er hele forskjellen på en måling og
en gjetning, og uten den leste hele kjøringen som om ingen kilde svarte.
Workflowen har fått en legeme-input, så den kan kjøres for ett legeme fra
Actions-fanen — også fra mobil.

Med den rene kjøringen kom svaret: Solar System Scopes sol-tekstur svarer på
213 kB under CC BY 4.0, og navnemønsteret som er bevist for Mars, Jupiter, Saturn
og månen holder også her. «Sun texture map» og «Solar surface texture» finnes
ikke, og ingen av de tre sol-kategoriene ga kandidater. Attribusjonen på /om er
utvidet — det er et vilkår for CC BY, ikke en høflighet.

Det er verdt å si hva kartet ER: et STILISERT solkart, ikke et fotografi. Commons
har rikelig med SDO- og SOHO-opptak, men de er alle skivebilder av sola sett
forfra, og en globe trenger et equirektangulært kart. Den lokalt tegnede
granulasjonen står derfor fortsatt i tabellen, og det er ikke en rest: sola har
ingen lyssetting å falle tilbake på, så uten den er den en flat skive i én farge
den dagen fila mangler. Testen holder den invarianten fast, siden feltet nå ser
overflødig ut ved siden av en `tekstur` som er satt.

---

## 2026-08-30 — v6.5.6: Sola er det femte legemet, og den står under terrenget

Eieren savnet sola som noe man kan åpne som nærbilde i nattmodus, og spurte om
den kunne ligge under landskapet — som i skjermbildet, der arket er en stripe
midt på skjermen med tomt mørke over og under. Svaret er at den gjør det helt av
seg selv: om natta ER sola under horisonten, altså under føttene dine, og
terrengarket er endelig. Vi tegner den derfor der den faktisk står, og da havner
den nedenfor landskapet uten at noe må jukses. Åpner du nattmodus midt på dagen,
står den derimot oppe i øst, og det er den samme regelen. Invarianten som gjør
3D til å stole på — alt du ser står der det faktisk står — er altså ikke rørt.

Det krevde én ny ting av kamerariggen. `seMot` kunne bare rette blikket fra én
grad under horisonten og oppover: over horisonten er det HIMMELVIPPEN som bærer
høyden, og den går bare én vei. Under horisonten er det i stedet ORBITEN som må
bære den, ved å heve kameraet og se ned — nøyaktig den bevegelsen man gjør når
man drar for å se kartet ovenfra. `polarForHoyde` er den regelen, og de to
regimene kan aldri være i bruk samtidig: enten står orbiten på taket og vippen
bærer høyden, eller så er vippen null og orbiten bærer den.

Sola er med i søkelista HELE DØGNET, og er det ene legemet som er det. Den står
øverst, den er merket med et strøket SVG-ikon i stedet for ☀️ — emojien tegnes av
systemets font i full farge, og i en liste man leser i mørket ville den vært det
eneste som lyste — og undertittelen sier hvilken side av horisonten den er på.
«42° under horisonten» og ikke «−42° over horisonten»: fortegnet bæres av ordet,
for det er det som leses av en som står ute.

Globen bryter mønsteret på to måter, og begge er skrevet inn i tabellen framfor i
en ny fil. Den LYSER SELV: det finnes ingen nattside, så retningslyset er av og
teksturen tegnes som egenlys. Det holdt ikke å skru ambient til fullt — den
diffuse BRDF-en i MeshStandardMaterial deler på π, og målt i Chromium kom en lys
gul sol ut sennepsbrun. Randmørkningen (Eddingtons 0,4 + 0,6·μ) er lagt på i
samme slengen; den er ikke pynt, men det ene trekket som skiller sola fra en
lampe. Og den har INGEN FASTE TREKK: en solflekk lever noen uker og driver med
rotasjonen, så de navngitte stedene er BREDDEGRADER — flekkbeltene rundt ±16°,
ekvator og polområdene — som er der differensiell rotasjon er å se, altså akkurat
det en kule kan vise og en skive ikke kan.

Fotografiet mangler med vilje: kilde-URL-er skal måles og ikke gjettes (v6.3.0),
og hostene er sperret fra utviklingsmiljøene. Overflaten tegnes derfor lokalt.
Av samme grunn er SNL- og Wikipedia-lenkene for sola et FORSLAG og ikke en
måling — «Sola» er også en kommune i Rogaland — og `probe-himmellenker` har fått
kandidatene inn så CI kan si hvilken som er artikkelen om stjerna.

Utvikler-bryteren løfter fortsatt bare de fire andre. En tvungen sol ville vært
selvmotsigende: hele poenget med den er at den står der den står.

---

## 2026-08-30 — v6.5.5: De røde båndene i 3D var siste strek i hvert linjebuffer

Eieren meldte høydekurver som ikke følger terrenget — snorrette røde bånd tvers
over arket, fra Stormoen i Drammen og fra Stetind i Narvik, og i ett tilfelle
svevende i lufta over horisonten. Det avgjørende i bildene var ikke hvor linjene
lå, men hvor MANGE det var: nøyaktig to, i alle fire skjermbildene, og med hver
sin strektykkelse. `contourLines` bygger nøyaktig to `LineSegments2` — én for
vanlige kurver (2,2 px, opasitet 0,55) og én for tellekurver (3,2 px, 0,9) — og
tykkelsene i bildene stemte med begge. Én bom per buffer, ikke en feil i dataene:
en void-rampe eller et flatt platå i DEM-en ville gitt mange spøkelseslinjer
spredt utover, ikke to.

Det er den samme driver-feilen som ble funnet i v6.3.11, i en fil som ikke fikk
fiksen. `LineSegmentsGeometry` legger start og ende i samme interleavede buffer,
24-byte stride med `instanceEnd` 12 byte inn, så for den SISTE instansen slutter
`instanceEnd` nøyaktig på bufferets siste byte. Spesifikasjonen tillater det; en
driver som regner kravet som `offset + stride·n` finner 12 byte for lite og
leverer nuller — og null i tre floats ER world-origo, altså midt på kartet i
havnivå. Siste kurvestrek blir derfor en rett linje fra der kurven sluttet og
tvers over arket. Det forklarer samtidig hvorfor v6.3.11 leste symptomet som at
en strek MANGLET: i stjernehimmelen er origo kuppelens sentrum, altså kameraets
egen posisjon, så den bomme streken peker rett mot betrakteren og kollapser til
ingenting. Samme feil, to helt ulike symptomer, fordi origo betyr noe forskjellig
i de to scenene.

Regelen bor nå i `lib/tour3d/linjeSegmenter.js` og ikke i én kommentar ett sted:
den gjaldt fire buffere, og bare ett av dem hadde den. Kurvene, stinettet, vegene
og de svake stjernebilde-strekene går alle gjennom den, og `instanceCount` settes
til de ekte segmentene så slacken aldri tegnes — en strek fra origo til origo er
ikke ingenting når `LineMaterial` har bredde i piksler. Feilen er per
konstruksjon usynlig i CI, i enhetstester og i røyktesten, siden SwiftShader og
desktop leser innenfor spesifikasjonen; testene holder derfor fast mekanikken, og
en egen sjekk feiler om et nytt buffer kaller `setPositions` direkte igjen.

---

## 2026-08-30 — v6.5.4: Fotografiet ligger der navnene står, og Saturn har ringene sine

Eieren meldte to ting fra natthimmelen, og de viste seg å ha samme rot i den ene
og samme fil: «Den store røde flekken» sto midt på Jupiter uten noen flekk under
seg, og Saturn sto uten ringer selv om Om-siden lover dem. Det første var ikke en
tekst-feil, men en tekstur-feil. `SphereGeometry` legger u = 0,25 på den vertexen
som vender mot kameraet, mens et equirektangulært kart har nullmeridianen sin på
u = 0,5 — så kula viste kartets lengdegrad −90 der merkelappene sa 0. Hele
overflaten lå en kvart omdreining ved siden av navnene sine, på alle fire
globene. Månen bar den samme feilen uten at noen så den: en måne dreid 90° er
fortsatt en måne. Teksturen forskyves nå 0,25 i u, og målt i det bakte kartet
ligger den røde flekken på lat −21,7 / lon −47,5 — merkelappen er flyttet dit,
med et notat om at tallet er målt i FOTOGRAFIET og må måles på nytt om
teksturkilden byttes. Flekken er for øvrig lakse-oransje og ikke rød i Cassinis
mosaikk fra 2000; den bleknet gjennom 1990-tallet, og «rød» er et navn fra
1800-tallet.

Ringene manglet av en beslektet grunn: aksehellingen sto på holderens Z-akse,
altså en RULL om synslinja. En rull kan per konstruksjon ikke åpne et plan man
ser inn i kanten på — ringnormalen fikk z-komponent 0,000 uansett hvilken helling
tabellen oppga, så shaderen kjørte, `harRinger` var sann, og på skjermen sto en
blek Jupiter. Hellingen tipper nå polen MOT betrakteren (holderens X), og
åpningsvinkelen blir lik hellingen: Saturns 26,7° gir ellipsen alle kjenner igjen.
Hvilken vei aksen lener seg i forhold til synslinja følger av årstiden på
planeten, og den modellerer vi ikke — da er «mot betrakteren» det ene valget som
gjør tallet i tabellen synlig, av samme slag som at måneskiva på himmelen tegnes
tre ganger for stor. Brukerens breddegrads-drag flyttet samtidig fra kula til
holderen, ellers ville Saturn vridd seg ut av ringer som sto stille. Begge
invariantene er låst i testene, og aksen — ikke bare vinkelen — holdes fast.

---

## 2026-08-29 — v6.5.3: Chipen forsvinner når posisjonen er funnet

«Finner posisjonen din …» ble stående etter at GPS-prikken var tegnet i kartet.
Flagget ble bare nullstilt av bygge-stien, så et trykk som BARE startet GPS —
altså den vanligste handlingen i modusen — lot chipen bli liggende for alltid,
med posisjonen tydelig markert bak den. Nå nullstilles den når fixen faktisk
lander. Unntaket er mens `byggNaarFix` venter på en god nok fix: da eier den
flagget, og chipen skal stå til den har bestemt seg, ellers ser skjermen ferdig
ut midt i en vurdering.

**Og en layout-feil med en lærdom i seg.** Teksten brakk midt i ordet —
«Finner posisjo-nen din». Chipen var `left-1/2` med `-translate-x-1/2`, og for et
absolutt posisjonert element er tilgjengelig bredde alt fra venstrekanten og ut.
`left: 50%` gir derfor shrink-to-fit bare HALVE skjermen å regne med — 215 px på
en vanlig telefon — og `max-w` slo aldri inn, fordi den halve plassen var den
bindende begrensningen hele tiden. Med `left-0 right-0 mx-auto w-fit` er hele
bredden tilgjengelig. Målt på 360, 412 og 430 px: teksten står på én linje overalt,
chipen er 233 px og sentrert.

Røyk-sjekken er verifisert i BEGGE retninger — den er rød med fiksen skrudd av,
med meldingen «chipen står igjen».

---

## 2026-08-29 — v6.5.2: Fritt lende åpner på kartet, ikke på arket

Arket i Fritt lende er kvadratisk, og en telefon er høy og smal. Visningen la
seg etter BREDDEN — «se hele arket» — så kartet ble en firkant med et stort tomt
felt over og under, og posisjonen din lå under midten. Man så mindre kart enn
skjermen hadde plass til, på et ark som er 2 × 2 km nettopp fordi det skal leses
i farta.

**Åpningsvisningen dekker nå viewporten i stedet.** `dekningsSkala` i
`lib/frittLende.js` er forholdet cover/contain pluss litt margin, så en arkkant
ikke dukker opp av at man panorerer et lite stykke. Nullpunktet er contain og
ikke 1:1, fordi SVG-en står på 100 % med `preserveAspectRatio="xMidYMid meet"` —
scale = 1 ER contain. På en vanlig telefon viser arket nå omtrent en kilometer på
tvers i stedet for to.

**Og så var det en ekte feil under, som forklarer «bunnjustert».** `panTil`
regnet skjermposisjonen uten letterboxingen: SVG-elementet fyller hele verten,
men det kvadratiske kartet tegnes sentrert inni det rektangelet, så kartets øvre
kant ligger et par hundre piksler ned i elementet. Punktet man «sentrerte» på
havnet dermed alltid en halv letterbox for lavt. Målt i Chromium på tre
skjermstørrelser: avviket var 91–578 px, og er nå 0.

**Kartet legger seg om deg når fixen lander**, ikke bare når du trykker. Det er
en ENGANGS-sentrering og ikke en følg-meg-modus: panorerer du bort, skal ikke
neste GPS-oppdatering rykke kartet tilbake under fingeren din.

To nye røyk-sjekker holder begge deler fast — at kartet dekker viewporten, og at
sentreringen treffer midten på piksel.

---

## 2026-08-29 — v6.5.1: Fritt lende låner turkartets loader, og får sin egen side i Om

Felttest av v6.5.0 ga to ting. Fremdrifts-chipen i Fritt lende var ren tekst med
en Avbryt-knapp ved siden av, mens turkartet har et animert «landmåler»-ikon —
og på en smal skjerm ble knappen klemt så «Avbryt» delte seg til «Av-bryt» over
to linjer. En knapp som ser ødelagt ut leses som at appen er det, og dette er
knappen man trykker for å komme seg ut av en bygging.

**Ikonet er trukket ut til `KartLaster.vue` og brukes nå begge steder.** Markupen
er flyttet ordrett, så turkartets chip ser nøyaktig lik ut som før — det var
kravet. En kopi ville drevet fra originalen, og de skal være samme ikon fordi de
betyr det samme. I Fritt lende står det i ALLE fasene, også «finner posisjonen
din», som var den eneste uten noe som beveget seg og dermed den som mest så ut
som om appen hadde hengt seg.

**`/om` har fått en tredje fane.** Fritt lende var udokumentert, og teksten
plasserer den der den hører hjemme: et supplement til turkartet og ikke en
erstatning — små, kvadratiske ark som lages på farta, på nærtur der du har
dekning og bare vil se et kart. Fanen forklarer de tre knappe-tilstandene og
hvorfor arket er ferskvare, siden det er den ene tingen ved modusen som ser ut
som en mangel og er et valg.

Fane-raden er `flex-wrap` fra nå: «Ruteplanlegger» er bredt nok til at tre faner
ikke får plass på én linje ved 150 % tekstskalering. Da er en rad som brytes
bedre enn etiketter som forkortes.

---

## 2026-08-29 — v6.5.0: Fritt lende — ett kart, én knapp

En ny, avkledd turkartmodus. Alt UI er borte unntatt hovedmenyknappen øverst,
linjalen nede til venstre og én knapp nede til høyre. Kartet er fast 2 × 2 km med
10 m ekvidistanse i ISOM-uttrykk, bygget der du står. Modusen velges fra
hovedmenyen og har ingen vei tilbake til det vanlige turkartet uten om den —
`router.replace` og ikke `push`, ellers ville tilbake-knappen vært en snarvei
rundt regelen.

**Egen view og ikke et flagg i MapView.** Bestillingen var at moduler og lyttere
ikke skal starte i det hele tatt. MapView kaller ~50 composables ubetinget på
toppnivå i en rekkefølge som er løsbærende (TDZ- og hoisting-reglene), så et
betinget kall er ikke lov — alternativet ville vært en `enabled`-ref tredd inn i
tjue composables, med regresjonsflate på alle brukere og en feilmodus Vue ikke
kaster på. Fritt lende kaller seks. Prisen er drift mellom de to visningene, og
den dempes av at den delte koden er ekte: fire nye rene moduler brukes av begge.

**Knappen har ett begrep — «hent meg hit» — og tre invarianter som gjør den
trygg uten en eneste bekreftelsesdialog.** Første tap etter en fersk last starter
bare GPS og bygger aldri, så det er alltid nøyaktig ett trykk mellom å åpne
modusen og å erstatte arket; det er svaret på at posisjonen din er et helt annet
sted i dag enn da arket ble bygget. Mens du står på arket er bygging utilgjengelig
for tap i det hele tatt — å gå av et 2 km-ark er hovedsløyfa her, ikke et unntak,
og en dialog i hovedsløyfa blir blindtrykket. Og det gamle arket slettes aldri før
det nye er ferdig bygget og tegnet, med en angre-slot ved siden av. Det er dette
siste som faktisk gjør et feiltrykk ufarlig, ikke gestespråket.

**Uttrykket er låst, og relieffet er av ved konstruksjon** — `useReliefRender`
kalles aldri, i stedet for å skrus av etterpå. Lagsettet er orientering-stilen
minus tett bebyggelse, parkering og holdeplass, definert som et fratrekk så et
nytt lag i katalogen kommer med av seg selv. Rotasjonen er låst til nord: kompasset
er borte i denne modusen, og et rotert kart uten kompass og uten noen kontroll som
nullstiller er en ekte navigasjonsfelle. Ekvidistansen står på linjalen, siden
punkt-skuffen den ellers bor i ikke finnes her — et kart med høydekurver uten
oppgitt ekvidistanse er ikke et topografisk kart.

**Arket lagres under ett fast id og overlever reload uten nett.** Modusen krever
dekning for å LAGE et kart, men ikke for å vise det den har; telefonen kan ha
drept appen mens du sto på fjellet. Arkene er skjult fra «Mine kart» via et filter
i `listMaps` og ikke hos kallerne, og gjenbruker bevisst ikke `isAuto`-flagget,
som ville gjort dem til kandidater for mosaikk-promotering. Boot-gjenopptaket
rører dem ikke: `lende-last-mode` får aldri verdien `fritt`.

**Nettet håndteres ærlig.** `navigator.onLine === false` er en pålitelig negativ
og en verdiløs positiv — en captive portal svarer 200 med HTML — så det finnes
ingen probe. Byggingen er sin egen probe, og et tap under bygging avbryter den.
Etter at arket er bygget sies det ingenting: tapt dekning endrer ikke ett piksel
av det du ser på, og et falskt alarmerende banner på et fjell er verre enn ingen.

**Fire sømmer ble trukket ut først, uten atferdsendring:** `lib/maalestokk.js`,
`lib/strekSkala.js`, `lib/brukerPrikk.js` og `lib/kartVert.js`, pluss
`useNettStatus` som avløser tre kopier av `navigator.onLine` med motsatt fortegn.
`buildMapFromCenter` tar nå en valgfri `id` og `demResolutionM`, begge med dagens
default. DEM-en tvinges til 10 m: regelen ser bare på ekvidistansen og ikke på
arkets størrelse, så et lite ark fikk unødig grov DEM og kotene trappet seg i
bratt terreng.

**`royktest.yml` trigget bare på `src/views/MapView.vue` og ikke på `src/views/**`.**
Det var en reell luke — samme klasse som `src/lib/**` var fram til v6.0.0 — og en
PR som bare rørte den nye viewen ville ikke kjørt røyktesten i det hele tatt. Nå
dekkes også Gravel, Home og Picker, som var udekket. Modusen har elleve egne
sjekker i `royk:ruter`, blant dem at et lagret ark kommer opp uten et eneste
eksternt nettverkskall, og at det står nøyaktig to knapper på skjermen — skrevet
som et krav om antall og ikke som «finnes ikke X», så den også fanger en femte
knapp noen legger til i god tro.

---

## 2026-08-29 — v6.4.0: Natta åpner mot nord, og de løse stjernene svarer for seg

Eieren sendte et skjermbilde fra nattmodus: en nesten tom himmel med Kassiopeia
oppe i hjørnet og seks–sju løse prikker under, uten en strek mellom seg. To
spørsmål fulgte med, og begge var gode.

**Det første var orienteringen.** Man går nesten alltid inn i natta fra dagmodus,
etter å ha panorert rundt i terrenget — og da lå blikket der turen tilfeldigvis
endte. Inngangen til stjernemodus stiller nå kameraet tilbake til oversikten
først, akkurat som «Oversikt»-knappen nede til venstre, og løfter så blikket opp
i himmelen derfra. Hver kveld starter dermed likt: midt over kartet, med nesa mot
NORD. Resetten er UMIDDELBAR og løftet er det som animeres — de to kan ikke begge
være flyturer, for `seMot` avbryter en pågående pose og ville dessuten lest av
asimuten kameraet sto i FØR den. Røyktesten leser himmelkompassets aria-label
rett etter inngangen og krever «nord»; enhetstestene kan bare se at asimuten ikke
endres, ikke hvilken asimut riggen faktisk sto i.

**Det andre var prikkene: er det en feil?** Nei — det er to ting som møtes.
Katalogen tar ALT som er lysere enn magnitude 2,6, mens figurene er håndplukket
én for én, så Sirius, Aldebaran, Altair, Antares og femti andre har aldri hatt en
strek å høre til. Svaret er delt i to. **Andromeda og Pegasus er tegnet inn** —
det var nettopp dem eieren så, kjeden Almach–Mirach–Alpheratz og den store
firkanten under, og de er noe av det mest gjenkjennelige på høsthimmelen.
Alpheratz står i begge figurene, som på ekte himmel. **Og de 57 stjernene som
fortsatt står alene er blitt valgbare**: de er med i himmelsøket, kan trykkes på i
himmelen, fremheves som en formasjon gjør, og har et infokort som sier hva de
heter, hvilket stjernebilde de hører til — og hvorfor de står uten streker. Der
det er verdt å vite noe, står det: Sirius' hvite dverg, Aldebaran som ikke er en
del av Hyadene, Pegasus-firkanten som målestokk for hvor mørk himmelen er.

Kjedene til de to nye figurene er målt mot d3-celestials standardfigurer, som de
tretten andre, og fasiten er bakt på nytt. Betegnelsene skrives ut som «α Tauri»
og ikke «Alp Tau», og et søk på «Tyren» finner nå Aldebaran selv om vi ikke
tegner Tyren.

---

## 2026-08-29 — v6.3.12: Værraden, tipset, tekststørrelsen og nålene som var vanskelige å treffe

Fem ting fra morgenens felttest. **Værraden** målte aldri hvor mange timer som
passer: raden står bak `v-else-if="timer.length"`, og ved montering er varselet
ikke hentet — da rendres «Henter værvarsel …», som ikke bærer ref-en, så
målingen returnerte og ResizeObserveren ble aldri koblet på. Antallet sto på
startverdien for alltid; med vanlig rot-font passet den tilfeldigvis, men på smal
skjerm eller med stor systemtekst fløt raden ut og `overflow-hidden` klippet bort
X-en. Målt i Chromium: 48 px for mye på 360 px bredde, 200 px med 150 % tekst.
Nå måles det når raden finnes, mot forelderens innholdsbredde, med en ettersjekk
mot den ekte layouten — og MET-attribusjonen og X-en ligger i samme celle.

**Tipset i infopanelet** kan ikke lenger lukkes, bare legges sammen, og valget
huskes: Info-snarveien er den eneste veien dit, så «borte for alltid» var en
avgjørelse man ikke kunne angre. **Hjelpeboksen og POI-filteret i 3D** følger nå
tekstvalget fra hovedmenyen (100/125/150) — de to flatene man faktisk LESER i
dagmodus. Der lærte vi en ny felle, og den er målt: `vw` inne i et `zoom`-lag
skaleres ikke ned, så en boks med `max-width: 78vw` dekker 117 % av skjermen ved
150 %.

**Kusken sto med «Ligger rett nord for Orion».** Det er astronomisk riktig —
deklinasjon +39° mot Orions 0°, samme rektascensjon — men himmelkompasset i 3D
viser N på HORISONTEN, så de to leses som en selvmotsigelse. Retningene i
`finnDen` beskriver nå det man SER: Kusken står rett over Orion, Tvillingene opp
til venstre for ham. Samtidig er en gammel feil rettet: Persevs' tekst pekte på
«Kjøresvennen», navnet som ble forkastet i v6.3.7, altså på et stjernebilde som
ikke finnes i lista. Begge er dekket av tester nå.

**CI hadde to gratis kutt, og én gate som ikke kunne bestås.** `navnediff` leste
bare `--ok` fra kommandolinja, mens CI kjører den uten argumenter — en villet
sletting var altså grønn lokalt og ALLTID rød i CI. Kvitteringen leses nå også
fra en `Navnediff-ok:`-trailer i en commit på grenen, som hører til endringen og
forsvinner når den merges. I tillegg avbryter begge workflowene nå en kjøring når
det pushes på nytt til samme gren (tre pushes ga tre parallelle røyktester, og de
to første målte kode som alt var erstattet), og Chromium caches på den pinnede
Playwright-versjonen — til sammen rundt et minutt og to bortkastede kjøringer per
runde.

**Knappenålene** var vrient å treffe, fordi trykket krevde et geometrisk treff på
en liten kule eller en tynn stamme. Bommer strålen, spør vi nå i skjermrom etter
nærmeste nålehode innen 34 px — samme grep som stjernebildene fikk i v6.3.11. Og
X-en på nålekortet angrer hele trykket: den gule ringen tas bort og kameraet flyr
tilbake dit det sto, i stedet for å etterlate en ring på en nål ingenting lenger
forteller om.

---

## 2026-08-28 — v6.3.11: Dragens siste strek, en trefflate på figuren, og alltid sammenlagt kort

Tre ting fra samme felttest. Halens siste strek manglet fordi et
`LineSegmentsGeometry` legger start og ende i samme buffer med 24-byte stride:
den siste instansens `instanceEnd` slutter nøyaktig på bufferets siste byte, og
en driver som regner plassbehovet som `offset + stride·n` finner tolv byte for
lite og dropper instansen. Ett segment slack løser det — og modellen forklarer
også de tre gamle målingene som `_maxInstanceCount` alene ikke dekket. Feilen er
usynlig i CI, for SwiftShader tegner alle tretten. Dernest var det vrient å
trykke på et stjernebilde, og grunnen var ikke størrelsen: trykket ble målt mot
formasjonens SENTER, som for en figur på 40° ligger i tom himmel. Nå måles det mot
stjernene og strekene, så du treffer figuren der den er — uten å gjøre noe
større eller legge ringer på himmelen. Til sist gir ethvert valg nå den
sammenlagte pilla, også et trykk i himmelen; det avløser tre regler som alle
prøvde å gjette om man ville lese eller se.

---

## 2026-08-28 — v6.3.10: Et valg fra søkelista minimerer infopanelet

Å plukke et navn fra nedtrekkslista er NAVIGASJON — man har alt bestemt seg for
hva man vil se — så kortet skal ikke legge seg over halve himmelen på veien dit.
Søkelista og nabo-snarveiene deler nå én funksjon (`velgOgSe`) som alltid
minimerer, mens trykk i himmelen beholder den motsatte regelen: første trykk
åpner, fordi der har man pekt på noe og spurt hva det er. Det gjør skillet
skarpere enn det var: tidligere delte lista trykkets regel, så det første valget
fra nedtrekkslista åpnet kortet i full høyde selv om man bare skulle se dit.
Røyk-sjekken måler den nye retningen — et listevalg skal gi pille, og lesestoffet
skal komme først når man utvider.

---

## 2026-08-28 — v6.3.9: Fremhevingen ble klippet, og sju figurer hadde streker vi hadde funnet opp

Eieren meldte at streker manglet når et stjernebilde var markert, og at det ikke
var til å vurdere uten hjelp — så begge halvdelene ble MÅLT i stedet for gjettet.
Den første er en ren feil: fremhevings-geometrien ble reallokert ved hvert valg,
og three låser `_maxInstanceCount` til bufferets lengde FØRSTE gang geometrien
bindes og fjerner det aldri. Tegnetallet er `min(instanceCount, _maxInstanceCount)`,
så taket ble satt av det første valget i økta — målt i Chromium: valgte man
Kassiopeia (4 streker) først, fikk Dragen (10) bare de fire første. Nå er det ETT
buffer på den største formasjonens størrelse, og `instanceCount` styrer hvor mange
som submitteres — samme regel som knappenålene. Den andre halvdelen er
kartografi: kjedene er sammenliknet mot d3-celestials standardfigurer, og elleve
streker i sju stjernebilder fantes ikke i noen standardframstilling — snarveier
som hoppet over mellomliggende stjerner, som Algol rett på δ Per og Dragens hode
som trekant der infoteksten vår alt sa «firkant». Karlsvogna hadde dessuten
bollen ÅPEN. Fasiten er bakt inn som `stjernefigurFasit.js`, og testen er
ensrettet: vi kan utelate en strek, men aldri tegne en som ikke finnes. Katalogen
vokser fra 147 til 166 stjerner og fra 79 til 101 streker. Til sist er X-en i
værraden 48 px bred i stedet for 36 — den var under trykkmålets minimum.

---

## 2026-08-28 — v6.3.8: En X i værraden tar bort været — og raden slutter å rulle

Værraden i dagmodus har fått en liten X til høyre. Et trykk fjerner både raden og værhimmelen — regn, torden, tåke og skyene. Den erstatter det tredje steget sol/måne-knappen hadde fram til v6.1.0, og hører bedre her: knappen svarer på «dag eller natt», mens dette er «vis meg været eller ikke». To spørsmål på én bryter var nettopp det som gjorde tri-staten uklar.

Tilstanden lagres bevisst ikke. Dag og natt avgjøres av klokka, så neste gang 3D åpnes er været med igjen. Vil man ha det tilbake i samme økt, går man innom natt og tilbake — og det er den ene veien, dokumentert i koden.

Og samtidig: **værraden ruller ikke lenger.** Den var en rulleflate med åtte faste timer, og på en 430 px-telefon fikk seks plass — to timer lå gjemt bak en gest ingenting antydet. Eieren oppdaget rullingen først da X-en ble omtalt, og det er den avgjørende observasjonen: en skjult gest er ikke en affordanse. Raden fyller nå bredden og viser bare timene som faktisk passer, målt i piksler fra DOM-en og ikke regnet fra rem — kolonnene er rem-baserte, og en bruker med 150 % tekstskalering har bredere kolonner, så et hardkodet tall ville brakt rullingen tilbake for nettopp den brukeren. Antallet varierer med skjermen, og det er riktig bytte: en turgåer trenger de nærmeste timene, ikke et fast tall.

X-en ligger derfor ikke lenger utenfor en rulleflate, men som en fast kolonne til høyre. Røyk-sjekken måler begge retninger — at trykket faktisk fjerner raden, og at en runde om natta gir den tilbake. Uten den andre halvparten kunne X-en vært en enveisbillett ut av været for hele økta og sjekken likevel stått grønn.

---

## 2026-08-28 — v6.3.7: Et bytte av stjernebilde beholder kortet sammenlagt

Har man lagt infokortet sammen, er man i «se på himmelen»-modus — og da skal et nytt stjernebilde flytte kameraet uten å skyve lesestoffet tilbake i ansiktet. Fram til nå åpnet hvert valg kortet på nytt, så man måtte legge det sammen igjen for hvert hopp.

Regelen er «behold», ikke «lås»: første valg åpner fortsatt kortet, for der har man nettopp spurt hva noe er, og et sammenlagt kort ville skjult svaret. Etter et bytte kan kortet åpnes som før. Nabo-hoppet minimerer fortsatt av seg selv, som er den motsatte handlingen — man hopper for å se.

Den bor i én funksjon fordi TO steder leser den: valget fra søkelista og trykket i himmelen. Handleren for trykk setter tilstanden direkte og går ikke gjennom `velgHimmel`, så to kopier ville kommet i utakt — og da oppfører de to veiene til samme valg seg ulikt. Det var nøyaktig feilen som ble rettet i v6.1.1, bare speilvendt.

Røyk-sjekken dekker begge halvdeler: at et bytte med sammenlagt kort holder det sammenlagt og at navnet følger med, og at kortet fortsatt lar seg åpne etterpå. Rekkefølgen i sjekken måtte flyttes — den nye delen bytter bort fra naboen, så nabo-hoppets egen kontroll må komme først.

---

## 2026-08-28 — v6.3.6: Wikipedia-lenker til stjernebildene, norske navn og fire døde SNL-adresser

Alle tretten stjernebilder har fått en Wikipedia-pille i infokortet, med samme form legemene har. Teksten står fortsatt i appen fordi bruksområdet er en kveld uten dekning; lenka er veien videre for den som vil lese mer hjemme igjen. Stjernebildene får bare Wikipedia — SNL har ikke en artikkel per stjernebilde, og en pille dit ville vært et løfte vi ikke kan holde.

Fire navn er blitt norske. Cassiopeia og Cepheus sto med latinsk navn i et bokmåls-UI der `latin`-feltet alt bærer latinen — norsk Wikipedia skriver dem Kassiopeia og Kefeus. Kjøresvennen heter Kusken, og Perseus heter Persevs. Navnet er kilden og id-en en slug av det, så endringen er gjort tre steder i takt: i `bygg-stjerner.mjs` som neste bake reproduserer den fra, i den genererte `stjerner.js`, og i nøklene i `stjernebildeInfo.js`. Ingen koordinat er rørt, og testen som binder id til infotekst holder de tre sammen.

Og fire SNL-adresser var gale. Jupiter pekte på `snl.no/Jupiter_-_planet`, som er mønsteret de andre planetene bruker — men Jupiter bor på `snl.no/Jupiter`. Da eieren fant den, ble det bygget en probe framfor en hypotese, og den fant tre til: Merkur, Venus og Saturn omdirigerte alle til det korte navnet. Mars gjør det **ikke** — den bor faktisk på `Mars_-_planet`, så mønsteret er ikke ensartet, og det er nettopp derfor gjettingen feilet. Begrunnelsen står nå i fila.

`npm run probe:lenker` slår opp hver eksterne lenke i himmelen og rapporterer status. Den kjører i CI (`probe-himmellenker.yml`) fordi snl.no og no.wikipedia.org er sperret fra utviklingsmiljøene — en lenke kan ikke prøves der den skrives. En omdirigering teller som avvik, og det er poenget: Wikipedia sender et feilstavet artikkelnavn videre med 200, så en gal lenke «virker». Målingen ga 21 av 24 på første forsøk, og verifiserte samtidig de to adressene jeg ellers ville gjettet på.

---

## 2026-08-28 — v6.3.5: Krysshåret der det gjør nytte, og kortet lukkes ikke av en exit

To feltfunn i infokortet i nattmodus, og de henger sammen.

«Sett i fokus» sto i headeren i begge tilstander, og i det ÅPNE kortet gjorde den ingenting man trengte: både et valg fra søkelista og et trykk i himmelen retter blikket dit av seg selv. Men sammenlagt er saken en annen — da er legemet tilbake i normal størrelse og man kan panorere fritt, og krysshåret er veien tilbake til det man så på. Knappen står derfor nå BARE i den minimerte pilla. Røyk-sjekken måler begge sider: borte i åpent kort, til stede i pilla.

Og et trykk ut av nærbildet lukket hele infokortet. Det var `handleTap` som kalte `velgHimmel(null)` mens globen sto åpen — som nullstiller alt — så kortet forsvant i det man la kula tilbake på himmelen. Man er fortsatt på Saturn; bare nærbildet er forlatt. Nå lukkes globen alene, og kortet LEGGES SAMMEN, med navnet stående og krysshåret klart. Hendelsen er egen (`globe-avsluttet`) og ikke `globe {apen:false}`, med vilje: den siste fyres også når man velger et legeme uten globe — Merkur eller Venus — og der har man nettopp spurt hva noe er, så kortet skal stå åpent. To grunner til at globen lukkes er ikke samme grunn til at kortet skal legges sammen.

---

## 2026-08-28 — v6.3.4: Terrenget skjærer ikke gjennom globen

Mars sto 3° over horisonten, og da havnet kula delvis under terrengnivå: kartflisa skar rett gjennom planeten, med Marinerdalene tegnet nede under en grønn skråning. Globen henger 4 km foran kameraet i legemets virkelige himmelretning, og det er invarianten som gjør 3D til å stole på — så plasseringen skal ikke røres.

To nærliggende utveier ble forkastet. Å løfte globen ville løyet om hvor legemet står. Og `depthTest = false` på materialene ville lagt Saturns ringer foran planeten også der de går bak den.

Løsningen er standardmønsteret for et «alltid øverst»-objekt: hovedscenen tegnes først, dybdebufferet tømmes, og globen tegnes i en andre pass i sitt eget render-lag. Da er dybden fortsatt korrekt inne i globen — ringene ligger riktig — men ingenting i landskapet kan skjære den. Globen er en objekt-inspektør, og en inspektør hører øverst.

Regelen bor i globen selv og ikke på kallstedet, fordi den har to stille feller. Lysene må også bestå lagtesten: et DirectionalLight som ikke gjør det bidrar ikke i passen, og kula blir kullsvart uten en feilmelding. Og laget arves ikke av barna, så `group.layers.set` alene etterlater alt innholdet på lag 0. `settRenderLag` traverserer derfor hele gruppa, og fire nye tester dekker begge fellene pluss Saturns ringer. `autoClear` må av rundt den andre passen — med den på ville `render` tømt fargebufferet og vasket bort landskapet vi nettopp tegnet.

---

## 2026-08-28 — v6.3.3: Bruksanvisningen ut av infokortet

Infokortet for månen, Mars, Jupiter og Saturn åpnet med en instruksjon — «dra for å snurre Mars, og trykk én gang for å legge den tilbake på himmelen» — og i lukket tilstand med en tilsvarende «trykk på mars for å se planeten som en kule du kan snurre». Begge er borte etter felttest.

Grunnen er at gesten ikke trenger ord. Trykk-ringen fra v6.3.2 sier at legemet kan åpnes, globe-merket i søkelista sier hvem som kan det, og at man drar i en kule for å snurre den er det man prøver først uansett. En instruksjon som forklarer det åpenbare stjeler linjer fra det man faktisk kom for å lese — og i et kort som nå bærer fakta, månetall og utforskningshistorie er linjer en knapp ressurs. `omtale` står igjen: det ene faktumet om legemet som er verdt å ta med seg.

To ting fulgte av det, og begge er ryddet i samme slengen. `globeAapen`-propen på kortet ble død — den fantes bare for å velge mellom de to bruksanvisningene — og en prop ingen leser er nettopp den stille gjelden navnediff finnes for. Og i røyktesten sto «Månegloben» som et alternativ i regexen som avgjør om kortet er utvidet; ordet finnes bare i kodekommentarer og har aldri stått i UI-et, så det kunne ikke matche noe. Et alternativ som aldri kan treffe skjuler at de andre ikke traff heller.

Testen håndhever nå at `bruk` IKKE finnes i `GLOBE_TEKST`. En tekst er lett å legge tilbake i god tro.

---

## 2026-08-28 — v6.3.2: Trykkbare planeter, rullbart infokort og et blikk man kan løfte med mus

Tre feltfunn fra v6.3.1, og de henger sammen i at 3D-visningen var laget for en finger på en telefon.

Infokortet vokste rett ut av skjermen. Med fakta og utforskningshistorie inne ble kortet høyere enn viewporten, og siden det var én kolonne uten tak forsvant navnet og de tre knappene oppover mens teksten lå igjen midt over terrenget — uten noen måte å lukke kortet på. Headeren står nå fast med navn, retning og ikoner alltid synlige, og bare lesestoffet ruller, med et tak på 58 % av skjermhøyden. `overscroll-contain` og `touch-pan-y` hindrer at et drag som treffer enden av lista forplanter seg til lerretet og dreier kameraet under fingeren.

Trykk-ringen rundt månen, Mars, Jupiter og Saturn var sub-piksel tynn, og det er hele grunnen til at planetene «ikke vistes». Ringen var `RING_FAKTOR` × legemets VINKELSTØRRELSE: for månen på 1,6° ga det et brukbart omriss, men for en planet på 0,45° ble ringen 17 piksler i diameter med en strek under én piksel bred. Den var der; den var bare usynlig. Nå er den fast i CSS-PIKSLER og lik for alle fire — 46 px, som er nøyaktig samme terskel `plukkHimmel` bruker, så det man ser er det man kan treffe — og den pulserer som en radar-ping: et svakt fast omriss man alltid kan sikte på, pluss to ripples som utvider seg utover og dør ut, et halvt omløp i utakt. På en natthimmel er bevegelse det eneste øyet finner av seg selv. Legemet inni beholder sin ekte vinkelstørrelse, med et gulv på fem piksler så det ikke forsvinner helt på en liten skjerm; det var uttrykkelig bestillingen at planeten ikke skal blåses uproporsjonalt opp. Ringene regnes om ved hver resize, siden de er i piksler og ikke i grader.

Søkelista har fått et globe-merke: en liten trådklode på radene for de fire legemene som kan åpnes som kule. Uten det er det ingenting i lista som skiller Mars fra Venus, og man må trykke seg gjennom for å finne ut hvem som gjør mer enn å lyse. Merket er en trådklode og ikke en emoji fordi 🪐 alt er type-ikonet for planetene til venstre i raden — en emoji her ville sagt «planet» to ganger og ingenting om at den kan åpnes. Det står bak samme port som trykk-ringen (`harGlobe`), og finnes som tekst for skjermlesere.

Og på desktop kunne man ikke løfte blikket i det hele tatt. Himmelvippen drives av et drag, men venstre museknapp er satt om til panorering, så bare høyre knapp roterer — og ingenting på skjermen sier det. Stjernekikkeren var dermed utilgjengelig på en stor skjerm uten berøring. En skyveknapp på høyre kant setter nå blikkets høyde direkte, i både dag og natt, og den vises bare ved fin peker med hover. Området leses av riggen (`blikkHoydeGrenser`) framfor å skrives av, så håndtaket ikke har dødt slark i endene, og den setter vippen rett i stedet for å starte en 0,9-sekunders animasjon per piksel fingeren flytter seg. Himmelvippen har fortsatt én eier: `freeRig`.

---

## 2026-08-28 — v6.3.1: Utvikler-bryteren løfter alle fire globe-legemene

«Tvungen måne i 3D» løftet bare månen, og det var en luke fra det øyeblikket Mars, Jupiter og Saturn fikk globe i v6.2.0: de tre er under horisonten store deler av året, så globene deres kunne bare prøves når himmelen tilfeldigvis stilte seg riktig. Bryteren heter nå «Tvungne himmellegemer i 3D» og løfter alle fire som HAR en globe. Merkur og Venus følger de ekte reglene — et omriss som lover en globe som ikke finnes er verre enn ingen ring, og av samme grunn er et legeme som dyttes opp på himmelen uten at man kan gjøre noe med det en ren løgn om hva som står der. Porten er `harGlobe`, ETT sted.

Tvangen bor i én kilde per legemetype: månen i `astronomi.himmelFor`, planetene i `planeter.synligePlaneter`. Det er samme regel som mosaikken — to steder som svarer på «hva ser jeg nå?» må svare likt — og her betyr et brudd at søkefeltet tilbyr en planet trykk ikke finner. For planetene må BEGGE gatene vike, både høyden og elongasjonen: en Jupiter i konjunksjon er like utestengt av nærheten til sola som av høyden, og en bryter som virker halve tida er verre enn ingen bryter. De fire står i en stige — Mars 30°, månen 35°, Jupiter 40°, Saturn 45° — så to legemer med nesten samme azimut ikke lander oppå hverandre og blir umulige å skille med en finger. Alt annet er fortsatt ekte: azimut, fase, lysside, avstand og lysstyrke, og et legeme som alt står høyere enn sin verdi røres ikke.

Flagget heter `tvingHimmel` gjennom hele kjeden, og localStorage-nøkkelen er `lende-3d-himmel-tvang`. Nøkkelen er byttet framfor migrert fordi bryteren er utvikler-bare, og et navn som lyver om hva flagget gjør er verre enn å slå den på én gang til — så den må slås på igjen etter denne oppdateringen.

---

## 2026-08-28 — v6.3.0: Astronomiske fakta, utforskningshistorie og tre overflatekart som faktisk kommer

Infokortet i 3D gir nå astronomiske fakta for månen og alle fem synlige planeter: antall måner og navn på de største, avstander, døgn- og årslengder — og en kort liste over menneskets utforskning, fra Galileis fire Jupiter-måner i 1610 til roverne som står på Mars nå (Sojourner, Spirit, Opportunity, Curiosity, Perseverance og Zhurong, med Ingenuity som fløy 72 ganger). Sammenlagt vises de fire nyeste milepælene; «alle N» gir hele historien. Nederst går lenker til Store norske leksikon og Wikipedia. Alt er bakt inn i appen og virker uten dekning — lenkene er for når man er hjemme igjen, og det er hele grunnen til at faktaene ikke ER lenkene.

Overflatekartene for Mars, Jupiter og Saturn kommer nå på plass. I v6.2.0 ble URL-ene til dem gjettet, fordi NASA og USGS er sperret fra utviklingsmiljøene, og alle tre var feil — oppdaget først i deploy-loggen etter merge, der bake-steget brukte to sekunder og ikke skrev en fil. Denne runden ble det bygget en måling i stedet for en ny hypotese: en probe-workflow som spør Wikimedia Commons' API om kandidater, løser opp thumb-URL-en, leser lisensen og laster ned bildet for å se hva det faktisk veier. Fire runder med målte funn — Wikimedia krever en identifiserende User-Agent, fritekstsøk ga PDF-er fra 1834, femti forespørsler i slengen gir 429, og kategoriene må plukkes i rundgang eller så spises taket alfabetisk — endte med tre verifiserte kilder: Cassinis sylindriske Jupiter-kart (offentlig eiendom, 154 kB) og Solar System Scopes Mars- og Saturn-teksturer (CC BY 4.0, 191 og 60 kB). En Commons-kilde oppgis nå som en TITTEL og slås opp ved hver bake, så URL-en ikke kan råtne uten at noe sier fra. Attribusjonen står på /om, som CC BY krever.

Og sol-ikonet i 3D har mistet skya si. Det er dag-stillingen på modus-knappen, og en sol med sky der betydde ingenting — været vises alltid i dagmodus nå.

---

## 2026-08-28 — v6.2.0: Glober for Mars, Jupiter og Saturn

Månen har kunnet åpnes som en roterbar kule siden v6.0.0. Nå kan Mars, Jupiter og
Saturn det samme — og de fire har fått et **tynt omriss rundt seg på himmelen**,
slik at det er til å se at de kan trykkes på.

**Én modul med en tabell, ikke fire kuler.** Da de tre planetene skulle ha det
månen hadde, var spørsmålet prosjektets egen regel tvinger fram: er den nye
varianten egentlig en opsjon på originalen? Den er det. `himmellegemer.js` bærer
farge, tekstur, aksehelling, stedsnavn og eventuelle ringer; `himmelGlobe.js`
bygger kula. Fire filer med hver sin nesten like sfære er nøyaktig den gjelden som
lot to 3D-scener leve side om side i månedsvis.

**Hva du finner på dem:** Olympus Mons, Marinerdalene, Hellasbassenget og
polkalottene på Mars. Den store røde flekken og beltene på Jupiter. Sekskanten
ved nordpolen på Saturn — som har ringene sine, med Cassini-delingen der den skal
være. En Saturn uten ringer er ikke Saturn, den er en blek Jupiter.
Aksehellingen er ekte for alle fire, fordi den er synlig: Mars står 25° skjevt og
Saturn 27°, og en kule som står rett opp ser feil ut for den som har sett et bilde.

**Overflatekartene hentes fra NASA og USGS**, i CI, som månens. To ting om det:
teksturene kan ikke verifiseres fra utviklingsmiljøet (begge hostene er sperret),
så bake-steget skriver nå «N av 4 kart på plass» — les den linja. Og fordi «uten
fotografi» er den normale tilstanden lokalt, tegnes gassplanetenes bånd på
klienten: Jupiter er Jupiter selv om bildet aldri kommer.

**Merkur og Venus får verken globe eller ring.** Merkur er en grå kule på en
telefonskjerm, og Venus er et ugjennomtrengelig skydekke — en globe av dem ville
vært en påstand om at det er noe å se. Og et omriss som lover en globe som ikke
finnes, er verre enn ingen ring.

Til sist: setningen om at ingen på jorda har sett månens bakside med egne øyne er
fjernet fra infokortet, etter ønske.

---

## 2026-08-28 — v6.1.1: Kompasset dreier, og infokortet kommer åpent

Tre ting fra felttesten av v6.1.0.

**Infokortet kom sammenlagt når det skulle vært åpent.** Trykket man på månen —
eller på et hvilket som helst himmellegeme i himmelen — arvet kortet minimeringen
fra forrige nabo-hopp. Årsaken er verdt å kjenne: trykk i himmelen går gjennom
motorens `himmel-valgt`-hendelse, som setter det valgte direkte og altså hopper
over den funksjonen som nullstiller minimeringen. Nå nullstiller den også.

**Infokortet har tre ikoner i samme rekkefølge i begge tilstander:** fokus,
minimer/utvid, lukk. Karet manglet i den minimerte pilla, og knappene skal ligge
på samme sted enten kortet er sammenlagt eller åpent — ellers må man lete etter
dem på nytt hver gang. Karet peker ned når kortet er minimert og opp når det er
åpent.

**Og himmelkompasset er snudd — det var feil vei.** Første utgave hadde to
ringer som sto stille, med N alltid på samme sted på skjermen, og en rød prikk
som vandret rundt for å si hvor man så. Begrunnelsen var at bokstaver som står
stille er lettere å lese i mørket. Eieren prøvde den og forsto den ikke, og det er
den avgjørende observasjonen: en gizmo man må tolke er ingen gizmo.

Nå følger den konvensjonen alle kjenner. Den røde markøren står fast øverst og
betyr «hit ser du», og skiva med N, Ø, S og V dreier under den — som på ethvert
kompass og i ethvert kartprogram. **Og den er en knapp:** trykk, og kameraet
vender mot nord i den høyden du står i. Står du og ser på stjerner 50° oppe, skal
et trykk snu deg om, ikke også dra blikket ned i bakken.

Den loddrette ringen er borte. Den viste blikkets høyde, men var også det som
gjorde bildet til en armillarsfære man måtte studere. Høyden står i infokortet og
er dessuten åpenbar av hva man ser. Én ring man forstår slår to man ikke forstår.

---

## 2026-08-28 — v6.1.0: Nattmodus er stjernekikkeren

v6.0.0 ga 3D-visningen en stjernekikker med en egen maksimer-knapp foran den.
Felttesten viste at knappen var i veien for sin egen hensikt: den som slår på
natt gjør det for å se stjerner, og da er hver hvite flate på skjermen en feil —
inkludert knappen man må finne for å bli kvitt dem. **Natt går derfor rett inn i
det bildet.** Ett trykk løfter blikket opp i himmelen av seg selv (ease-out over
halvannet sekund, samme bevegelse man ellers gjør med fingeren), tar bort kurver,
stier og knappenåler, og fjerner hele overlegget. Igjen står sol/måne-knappen,
X-en, og mellom dem søkefeltet. Ett drag nedover tar deg tilbake til landskapet,
og det står ingen forklaring på skjermen — bevegelsen er den man nettopp så bli
kjørt. Lag-valgene dine huskes og gis tilbake når du går ut av natta.

**Modusvelgeren har to stillinger, ikke fire.** Dag uten vær og natt med vær er
begge borte. Været vises nå ALLTID om dagen: varselet er ett oppslag med en
halvtimes cache, og en skyfri dagshimmel er ikke mer nøytral enn en riktig — bare
mindre sann. Natt med vær skjulte stjernene som er hele grunnen til å slå på
natt. Knappen har også flyttet helt til venstre, foran nålene: den skifter hele
bildet, og i nattmodus er den den eneste som blir igjen på venstresida.

**3D åpner i den himmelen som faktisk er ute.** Fram til nå fulgte dag/natt
kart-temaet — altså om KARTET sto i mørk drakt, som er et helt annet spørsmål:
man kan godt lese et mørkt kart midt på dagen. Nå regnes solas høyde for arkets
senterpunkt og sammenliknes med den offisielle grensa −0°50′ (øvre rand ved
horisonten pluss refraksjon — samme definisjon MET og Yr regner tidene sine fra).
METs Sunrise-API ble vurdert og forkastet: hele bruksområdet er en kveld ute uten
dekning, og vi trenger ikke tidene, vi trenger solas høyde NÅ — som er det tidene
er regnet ut FRA, og den har vi lokalt. Merk at grensa er solnedgang og ikke
skumring: rett etter solnedgang er himmelen fortsatt lys.

**Et himmelkompass nede til høyre.** Uten kartet i bildet mister man
himmelretningene helt; man kan stå og se på Karlsvogna uten å vite at man ser
nordover. Kompasset er to ringer i omriss — jordas plan med øst–vest-aksen, og en
loddrett ring med N og S — pluss en rød prikk som viser hvor du ser. Ringene står
stille og prikken flytter seg, så det er noe man leser framfor noe man må tolke.
Ren matte og SVG, ikke en andre 3D-scene: det er et HUD på sytti piksler, og et
andre kamera-regime er den gjelden prosjektet advarer sterkest mot. Rødt er ikke
pynt — rødt lys ødelegger mørkeadaptasjonen minst.

**Infokortet kan legges sammen**, fordi teksten dekker nettopp den delen av
himmelen man ble bedt om å se på. Minimert står navnet og retningen igjen som én
linje. Et hopp til en nabo legger kortet sammen av seg selv — man hopper for å
SE, ikke for å lese videre — og «Sett i fokus» retter blikket tilbake til det som
er fremhevet når man har sett seg bort.

Teksten i nattmodus følger hovedmenyens 100/125/150-valg. Resten av
3D-overlegget følger systemets tekstskalering, men nattmodus' søkefelt og
infokort er det eneste man faktisk LESER i 3D, og den som har satt større tekst
har gjort det fordi hun trenger den.

Til sist en utvikler-bryter i Utvikler-fanen: **Tvungen måne i 3D.** Månen står
under horisonten store deler av døgnet, og da kan verken månegloben eller
trykk-plukkingen av den prøves — man må vente på at himmelen stiller seg riktig.
Med bryteren på løftes månen til 35°, og alt annet ved den er fortsatt ekte: fase,
lysside og retning. Den bor i `himmelFor`, som er den ene kilden både skiva på
himmelen og lista i søkefeltet bygges av — ellers ville søket tilbudt en måne
trykk ikke finner.

---

## 2026-08-28 — v6.1.0: Nattmodus er stjernekikkeren

v6.0.0 ga 3D-visningen en stjernekikker med en egen maksimer-knapp foran den.
Felttesten viste at knappen var i veien for sin egen hensikt: den som slår på
natt gjør det for å se stjerner, og da er hver hvite flate på skjermen en feil —
inkludert knappen man må finne for å bli kvitt dem. **Natt går derfor rett inn i
det bildet.** Ett trykk løfter blikket opp i himmelen av seg selv (ease-out over
halvannet sekund, samme bevegelse man ellers gjør med fingeren), tar bort kurver,
stier og knappenåler, og fjerner hele overlegget. Igjen står sol/måne-knappen,
X-en, og mellom dem søkefeltet. Ett drag nedover tar deg tilbake til landskapet,
og det står ingen forklaring på skjermen — bevegelsen er den man nettopp så bli
kjørt. Lag-valgene dine huskes og gis tilbake når du går ut av natta.

**Modusvelgeren har to stillinger, ikke fire.** Dag uten vær og natt med vær er
begge borte. Været vises nå ALLTID om dagen: varselet er ett oppslag med en
halvtimes cache, og en skyfri dagshimmel er ikke mer nøytral enn en riktig — bare
mindre sann. Natt med vær skjulte stjernene som er hele grunnen til å slå på
natt. Knappen har også flyttet helt til venstre, foran nålene: den skifter hele
bildet, og i nattmodus er den den eneste som blir igjen på venstresida.

**3D åpner i den himmelen som faktisk er ute.** Fram til nå fulgte dag/natt
kart-temaet — altså om KARTET sto i mørk drakt, som er et helt annet spørsmål:
man kan godt lese et mørkt kart midt på dagen. Nå regnes solas høyde for arkets
senterpunkt og sammenliknes med den offisielle grensa −0°50′ (øvre rand ved
horisonten pluss refraksjon — samme definisjon MET og Yr regner tidene sine fra).
METs Sunrise-API ble vurdert og forkastet: hele bruksområdet er en kveld ute uten
dekning, og vi trenger ikke tidene, vi trenger solas høyde NÅ — som er det tidene
er regnet ut FRA, og den har vi lokalt.

**Og et himmelkompass nede til høyre.** Uten kartet i bildet mister man
himmelretningene helt; man kan stå og se på Karlsvogna uten å vite at man ser
nordover. Kompasset er to ringer i omriss — jordas plan med øst–vest-aksen, og en
loddrett ring med N og S — pluss en rød prikk som viser hvor du ser. Ringene står
stille og prikken flytter seg, så det er noe man leser framfor noe man må tolke.
Ren matte og SVG, ikke en andre 3D-scene: det er et HUD på sytti piksler, og et
andre kamera-regime er den gjelden prosjektet advarer sterkest mot. Rødt er ikke
pynt — rødt lys ødelegger mørkeadaptasjonen minst.

Til sist: teksten i nattmodus følger hovedmenyens 100/125/150-valg. Resten av
3D-overlegget følger systemets tekstskalering, men nattmodus' søkefelt og
infokort er det eneste man faktisk LESER i 3D, og den som har satt større tekst
har gjort det fordi hun trenger den.

---

## 2026-08-27 — v6.0.0: Stjernekikkeren — utforsk himmelen fra kartet

3D-visningen har hatt en astronomisk riktig natthimmel siden v5.27.0, og et
kamera som kan se opp i den. Nå kan man UTFORSKE den. I nattmodus uten vær, når
blikket er løftet mot himmelen, kommer et søkefelt som også er en nedtrekksliste
over det som FAKTISK står over horisonten her og nå: 13 stjernebilder, de
synlige planetene og månen. Velg ett — fra lista, ved å skrive, eller ved å
trykke rett på det i himmelen — og stjernene og strekene lyser opp mens kameraet
retter blikket dit. Infokortet gir navn, latinsk navn, antall stjerner, hvordan
du finner figuren, mytologien bak, en fun fact — og snarveier til de nærmeste
naboene, som er den beste måten å lære seg en himmel. Trykker du på månen, blir
skiva en kule du kan snurre, med navngitte hav og krater og kveldens ekte
skyggelinje. Alt regnes ut på telefonen: stjernene er en bakt katalog fra HYG,
planetene JPLs baneelementer løst med Keplers likning, sol og måne Meeus'
serier. En klar natt på fjellet har sjelden dekning, og et stjerne-API ville
gjort funksjonen ubrukelig nettopp der man står og ser opp.

**Månegloben er en objekt-inspektør, ikke en reise.** Eieren ba opprinnelig om
en tur TIL månen. Det ble forkastet i samråd: det bryter invarianten som gjør
3D-visningen til å stole på — *alt du ser står der det faktisk står, sett fra din
posisjon på kartet* — og det ville krevd et andre kamera-regime, som er den
gjelden CLAUDE.md advarer sterkest mot. Kula henger derfor i månens virkelige
himmelretning, et fast stykke foran kameraet, og ruller like mye som den
parallaktiske vinkelen slik at skyggelinja står som sigden du nettopp så.
Terminatoren er ET EKTE LYS fra solas virkelige retning, ikke en shader-effekt:
en skive KAN ikke skygges av et lys, en kule kan.

**Nattsynet, etter felttest i mørket.** Stjernene og strekene var nesten
usynlige på telefon, og årsaken var ikke smak: `gl_PointSize` og
`LineMaterial`-bredder er i FRAMEBUFFER-piksler, og med `setPixelRatio` opptil 2
ble alt halv størrelse. `LineBasicMaterial.linewidth` ignoreres dessuten helt av
WebGL. Begge er rettet, og størrelsene er nå i CSS-piksler. I tillegg skjuler en
ny maksimer-knapp alt UI unntatt himmelsøket, som flytter seg helt øverst:
hvite flater koster de 20–30 minuttene et øye bruker på å mørkeadaptere.

**En ekte feil i denne PR-en, fanget av røyktesten:** `seMot` kalte
`controls.setPolarAngle(...)`, og OrbitControls i three 0.185 har GETTERE for
polar- og asimutvinkel men ingen settere. Alle 2 738 enhetstester og bygget sto
grønne — 3D krever WebGL, så ingenting som ikke kjører en nettleser kan se det.
Vinklene settes nå slik kontrollen selv leser dem, ved å plassere kameraet i
sfæriske koordinater rundt blikkpunktet. Konvensjonen er three sin egen og er
testet mot `Spherical`, for et ombyttet fortegn ville sendt kameraet til motsatt
side av himmelen uten å kaste. Røyktesten er samtidig strammet
inn på et sted taket pr sjekk ikke dekket: `page.screenshot` etter hver sjekk
sto utenfor det, og et skjermbilde mot en frossen renderer venter i det
uendelige — da henger jobben likevel, og uten at noe navn er skrevet. Nå har
begge tak, hvert `page.evaluate` i stjerne-sjekkene har sitt eget, og jobben og
røyktest-steget har hver sin bakstopper.

**Og en gate-luke som var reell:** røyktesten trigget ikke på `src/lib/**`, så
3D-motorens egne røyk-sjekker kunne hoppes helt over. Denne endringen falt
gjennom den. Den er tettet.

---

## 2026-08-27 — v5.28.0: Stjernehimmelen sto 16 bueminutter feil

Grunnlaget for stjernekikkeren som kommer i 6.0.0. Ingenting nytt å se ennå —
men himmelen står riktigere enn den gjorde, og det var en feil vi shippet i går.

**Presesjonen manglet.** Stjernekatalogen er J2000, mens `lokalStjernetid`
gjelder i kveld. Blander man de to, mangler hele himmelen 26 års rotasjon:
målt til **16 bueminutter i snitt og 22′ på det verste**. Det er en halv
fullmånebredde — usynlig på en telefonskjerm, og likevel galt. En stjernekikker
der man peker på himmelen og sammenlikner med virkeligheten hever terskelen, så
`presesserTilDato` (Meeus 21.3) er nå på plass. Den rigorøse formen og ikke
tilnærmingen, fordi tilnærmingen sprenger nær polene — og Polstjerna er den ene
stjerna alle sjekker.

Fella står dokumentert tre steder, for den er ikke til å gjette: stjerner og
planeter skal presesseres, sol og måne skal IKKE — Meeus' serier gir dem
allerede i middeljevndøgn for datoen. To himmelobjekter i ulike rammer er en
feil ingen test fanger uten at man vet å se etter den.

Polstjerne-testen er verdt en merknad. Første utgave forventet 28′ over hundre
år, fordi det var tallet jeg mente å huske. Riktig svar er 33,4′, og koden hadde
rett. Testen er nå ankret i GEOMETRIEN i stedet: presesjon er en rotasjon om
ekliptikkens pol, så forskyvningen er `rate × sin(avstand fra den polen)`. Et
anker man kan regne seg til er verdt mer enn et anker man husker.

**Stjernene er verifisert mot en uavhengig kilde.** Eieren ba om bekreftelse på
at Lende viser ekte stjerner. Alle 147 er krysssjekket mot `d3-celestial` — en
annen forfatter, en annen pipeline, koordinater i grader istedenfor timer:
median 0,19 buesekund, 95-persentil 0,70″, magnitude-avvik 0,00. Verste treff er
16,3″ på Rigil Kentaurus, som er ekte astronomi (α Centauri har himmelens
største egenbevegelse) og ikke en feil.

**Planetene kan nå regnes ut, uten API.** `lib/tour3d/planeter.js` er JPL-ens
baneelementer pluss en Kepler-løsning: posisjon, avstand, fase, elongasjon og
magnitude for de fem man ser med øyet. Det finnes API-er for dette (JPL
Horizons, astronomyapi.com), og de er utelukket med vilje — hele bruksområdet er
en natt på fjellet uten dekning.

Krysssjekket mot `astronomy-engine`, en uavhengig MIT-implementasjon med full
VSOP87: verste avvik 5,1 bueminutt på Saturn, under ett bueminutt på Merkur,
Venus og Mars. Saturn er verst fordi lineære middel-elementer ikke modellerer
Jupiters perturbasjoner, og det er den kjente prisen for tabellen. De 25
referansepunktene er BAKT INN i testen framfor å hentes: en test som krever nett
er en test som blir skrudd av.

Magnitudene tok en runde til. Et lineært fase-ledd ga Venus −5,9, og Venus kan
ikke bli lysere enn −4,9 — altså en påstand vi ikke kunne innfri om «det lyseste
på himmelen». Almanakkens polynomer fanger sigden, og nå ligger alle fem
innenfor sine virkelige spenn.

**Formasjonene er blitt data det går an å velge.** Baken skriver nå
`FORMASJONER` med id, latinsk navn, stjerne- og linje-indekser og senterretning,
i tillegg til den flate `LINJER`. Senteret regnes av retningsvektorer og ikke av
tall: et snitt av rektascensjoner som spenner over 0h peker midt på motsatt side
av himmelen. Bayer-betegnelsen er dessuten blitt et FELT og ikke bare en
kommentar — 24 av de 147 stjernene mangler egennavn i HYG, og «#74» duger ikke i
et infopanel.

`stjernebildeInfo.js` er den håndskrevne halvparten: mytologi, én fun fact og en
praktisk «finn den» for hver av de tretten. Egen fil fordi `stjerner.js` er
generert og bærer «IKKE REDIGER FOR HÅND». Testen som krever at hver tekst
navngir minst én av sine EGNE stjerner fant tre reelle hull med en gang —
Cassiopeia, Cepheus og Lille bjørn navnga ingen.

**Og en gate-lekkasje ble oppdaget på veien.** Røyktesten trigges på stier, og
`src/lib/**` sto ikke blant dem — bare views, composables og components. Men
`src/lib/tour3d/` ER 3D-motoren de tre 3D-sjekkene trykker på, så en ren
lib-endring kunne lande uten at røyktesten kjørte. Denne PR-en falt gjennom
hullet selv, som er hvordan det ble funnet. `scripts/trenger-ektekart.mjs` har
hatt `^src/lib/` på MÅ-lista hele tida, så gaten som avgjør *om* det bygges et
ekte kart var enig — det var gaten som avgjør *om testen kjører* som manglet
stien.

---

## 2026-08-27 — v5.27.0: Sju justeringer i 3D — og en himmel man kan se opp i

Eieren kom tilbake fra felt med en liste. Sju punkter, og de henger sammen mer
enn lista antyder.

**Skyene er nå en del av værvarselet.** Før sto de på i all dagvisning, og da
var himmelen den samme enten man hadde slått på været eller ikke — skyene sa
altså ingenting. Nå vises de bare med været på, og bare om dagen.
Skyskyggene følger med: flekker på bakken uten skyer over leses som en feil i
kartteksturen, ikke som skygge. Regelen bor i ÉN funksjon
(`oppdaterSkySynlighet`), fordi den avhenger av to uavhengige brytere, og to
steder som setter `visible` etter hver sin halvdel av sannheten kommer i utakt
straks den ene kalles alene.

**Værraden er flyttet over Info og POI-filteret.** Under dem måtte man lese seg
forbi to piller for å komme til det man slo på værmodus for.

**Månen er ikke lenger en tekstur, og natthimmelen er ekte.** Månen var en
`THREE.Sprite` med en 128 px radiell gradient, og eieren meldte at den ikke var
sirkelformet. Det er samme klasse feil som puff-skyene brukte åtte forsøk på:
formen kan ikke reddes i teksturen når det er teksturveien som er problemet. Så
teksturen er ute. En shader som forkaster alt utenfor `r = 1` KAN ikke tegne noe
annet enn en sirkel — uansett driver, mipmap-generering eller fargerom. Og fasen
falt ut som en gratis bonus, siden vi nå eier hvert piksel i skiva.

Med det på plass ble resten mulig: ny ren modul `lib/tour3d/astronomi.js`
(Meeus' korte serier) regner ut hvor sola og månen står, hvor stor del av månen
som er belyst, og hvilken VEI den er skåret — dreid fra zenit og ikke fra
himmelpolen, for det er zenit som er «opp» på en skjerm. Stjernene kommer fra
en bakt katalog (`scripts/bygg-stjerner.mjs` → 147 stjerner fra HYG-databasen,
J2000) og står der de faktisk står over dette kartet i kveld, med
størrelse etter magnitude. Tretten stjernebilder tegnes med svake linjer —
uten dem er 147 riktige punkter ikke til å skille fra 160 tilfeldige.

Koordinatene er bakt og ikke skrevet for hånd, fordi de er det eneste her som
kan være FEIL uten at noe ser rart ut: en stjerne 2° på skeive er en stjerne,
bare på feil plass. Formlene er verifisert mot Meeus' egne gjennomregnede
eksempler (månens lengde innenfor 0,003°, lyssidens posisjonsvinkel 285,04° mot
bokas 285,0°), og Polstjerna står i nord i en høyde lik breddegraden.
Sol-retningen som skyggelegger terrenget er IKKE rørt: den er låst til
hillshade-azimuten som er bakt inn i karteksturen.

**Stiene faller ikke lenger ut av visningen.** Manglet DEM-en en høyde, ble den
0 — havnivå — og stinettet plunget rett ned fra fjellsida og løp videre langs et
sjøplan hundrevis av meter under terrenget. Det er de røde strekene i eierens
nattbilde. Nå brytes linja der terrenget mangler; resten av stien tegnes som
før. Nålene beholder havnivå-fallbacken med vilje, og det står nå hvorfor:
`terrainGrid` flater noData til havnivå, så der DEM-en mangler ER det tegnede
terrenget på 0. En nål på 0 står altså PÅ bakken som vises. En sti er en
sammenhengende strek fra ekte terreng og NED dit, og det er streken man ser.
I tillegg melder viseren nå fra når en stor del av utsnittet mangler
høydedata — en nødløsning man ikke kan se at man ser på, er verre enn
nødløsningen selv.

**Man kan se opp.** Det var ikke mulig før: OrbitControls ser alltid PÅ
blikkpunktet, så 85° fra senit var et blikk nesten vannrett, og videre kom man
ikke. Nå er gesten en FORTSETTELSE av draget — står orbiten på taket og fingeren
dras videre oppover, løftes blikket opp i himmelen, og samme finger nedover
lander deg i kartet igjen. Ingen ny knapp; topprada har alt fem-seks.

Fortegnet var snudd i første utgave, og det er verdt å merke seg HVEM som fanget
det: enhetstestene sto grønne hele veien, fordi de tester regelen og ikke
retningen. `OrbitControls.rotateUp` gjør `phi -= dy`, så et drag OPPOVER er det
som senker blikket mot horisonten — retningen som fortsetter forbi den er altså
opp, ikke ned. Det var røyktesten i Chromium som sa det, og den fanget samtidig
at et venstre-drag i denne appen panorerer og ikke roterer.

Det avdekket en ekte feil: kuppelen, stjernene og månen sto i ORIGO, mens den
frie riggen slipper kameraet 3 × arkets største mål unna. På et 3×3-ark av 5 km
er det 45 km — altså utenfor sin egen himmel på 25 km. Himmelen følger nå
kameraet, så den ligger i det uendelige uansett hvor man flyr, og månen vokser
ikke lenger når man nærmer seg den.

**Og teksten i 3D-overlegget er lagt om fra px til rem**, så telefonens egen
tekststørrelse-innstilling slår gjennom. Chrome på Android skalerer
rot-fontstørrelsen etter Tilgjengelighet → Tekstskalering; faste px gjør det
aldri. Tailwinds avstandsskala er også rem-basert, så polstring og knappehøyder
vokser i takt av seg selv. Resten av appen er fortsatt px — 3D er første flate
som følger systemet, og det er en bevisst start.

---

## 2026-08-26 — v5.26.3: Høyfjellet var fortsatt grønt — gaten spurte om feil ting

Eieren så på et Turkart over høyfjell og meldte at det fremdeles var grønt.
Han hadde rett, og det var ikke gamle kart: det var en feil i gaten fra
v5.26.1.

Gaten spurte **«bærer arket N50-skog?»**. Over tregrensa er svaret legitimt
nei — og da ble arket stående med Turkarts «her er skog»-påstand. Målt:
Hardangervidda kom ut med 151 myrflater og null skogflater. Flisene lastet
altså helt fint; vi VISSTE at det ikke var skog der. Arket ble malt grønt
likevel. Jo mer alpint arket var, jo sikrere ble det grønt — stikk motsatt av
hensikten. Rondvassbu og Besseggen slapp unna bare fordi utsnittene fanget litt
bjørkeskog i dalsidene.

**Riktig spørsmål er DEKNING, ikke innhold.** «Ingen skog» er et svar når
flisene er lest, og et ikke-svar når de ikke er det — og de to ser like ut fra
mapBuilder, siden `n50ArealFetcher` aldri feiler hardt. Fetcheren rapporterer
derfor `dekning` i statusen sin: vi ba om de flisene manifestet sa fantes, og
fikk lest dem. `createMapFlow` og `mcp/headless` sender flagget videre til
`buildSvg` — begge to, fordi et sprik mellom app og headless er nøyaktig det
vann-stacken brukte månedsvis på.

Skog på arket merker det fortsatt av seg selv, som reserve for kallere som ikke
sender flagget (MCP-verktøy, tester, eldre kallsteder): finnes det skog, er
dekningen uansett bevist.

Verifisert i begge retninger mot de ekte flisene: Hardangervidda og Rondvassbu
får nå åpen bakgrunn, Nordmarka likeså — og et ark utenfor det bakte området
beholder påstanden, som det skal.

Fire nye tester, blant dem den som betyr mest: et HELT tomt ark med dekning
skal merkes. Bart fjell uten myr, skog eller bre er et svar, ikke et hull.

---

## 2026-08-26 — v5.26.2: Historikken skal ryddes ved neste bake

Ikke en kode-endring — en beslutning skrevet ned der den blir lest.

v5.26.1 la 117 MB bakte fliser i repoet. `.git` er nå 200 MB pack, og
**gh-pages har 323 commits** som hver bærer et helt `dist/`. Flisene er
GENERERTE — de kan bakes på nytt fra Geonorge når som helst — så gamle utgaver
har null verdi, men de blir liggende i git for alltid. Hver bake som endrer
flisene legger ~117 MB på toppen.

Notatet står tre steder, fordi det er tre steder man er når det blir relevant:
arealdekke-seksjonen i CLAUDE.md, toppen av `bygg-n50-areal.yml` (der man står
rett før man kjører en bake), og ved gh-pages-steget i
`build-vardasen-map.yml`.

Rekkefølgen er med vilje: **gh-pages først**, fordi den er gratis. Grenen er ren
generert output, ingen har noe der å miste, og en orphan-branch med force-push
fjerner 323 utgaver av nettstedet i én operasjon. **master etterpå**, som en
egen bevisst `git filter-repo` — den omskriver delt historikk, og selv med én
eier skal det ikke skje som biprodukt av en bake.

GitHubs grenser for kontekst: 100 MB per fil er hard sperre (største flis er
2,4 MB), 5 GB repo er der GitHub tar kontakt, og 1 GB er hard grense for det
publiserte Pages-nettstedet (`dist/` er 133 MB). Ingen er nære — men
gh-pages-veksten er monoton, og den løper først.

---

## 2026-08-26 — v5.26.1: Skogen, myra og breene er på kartet — landsdekkende

Rørene sto ferdige i v5.26.0. Nå er dataene der: **207 fliser, 117 MB, 883 903
flater** bakt fra Kartverkets N50 Arealdekke og servert statisk ved siden av
appen — 648 577 myrflater, 232 652 skogflater og 2 674 breflater, hvorav
115 755 har hull. Største flis er 2,4 MB; det er det appen laster per kartrute.

**Størrelsen traff anslaget.** Buskerud-målingen ga 6,0 MB mot myrens 3,1, og
framskrivingen sa 110–120 MB nasjonalt. Fasiten ble 117. Det er innenfor det
`public/` bærer, så R2-omveien er fortsatt unødvendig — og vi beholder det
`public/` gir gratis: samme opprinnelse som appen, ingen CORS, ingen nøkler,
ett deploy som holder app og dataformat i synk, og service worker-en som
cacher flisene offline.

**Skruene er per type, og det er derfor det går opp.** Myr står på 4 m
forenkling og 2 500 m² minsteflate, uendret fra v5.25.0 — de flisene skulle
ikke skrives om. Skog står på 8 m og 5 000 m²: en skogteig er kilometervis av
kant der hver meter koster byte og ingen av dem er synlige i 1:10 000, mens en
myr bæres av hvert eneste knekkpunkt. Isbre har myrens fine tall, fordi breene
er få og formen deres er poenget.

**Bre-navnene tok to runder, og den andre er verdt å skrive ned.** Første bake
ga 608 navn, og de store var riktige — Jostedalsbreen, Hardangerjøkulen,
Svartisen, Folgefonna, Okstindbreen, Blåmannsisen, alle med plausible
koordinater. Men blant dem sto «Adels-», «breen», «breene» og «skavlen» som
selvstendige navn. `N50_Stedsnavn_tekstplassering` er en annotasjons-tabell der
en lang etikett deles over FLERE rader, én per tekstlinje: `streng` er radens
fragment, `fulltekst` er hele navnet og står på hver rad. Kandidatlista hadde
begge, i feil rekkefølge. Uten fiksen ville «breen» stått alene på kartet.

Dedupe-nøkkelen er samtidig gjort grovere, fra tre desimaler til to (~1 km):
med `fulltekst` gir en flerlinjet etikett N like navn på nesten samme sted, og
Okstindbreen sto uansett med tre rader innenfor to kilometer. Resultatet er 548
navn, «Adelsbreen» hel, Okstindbreen som én — og Jostedalsbreen med to, tjue
kilometer fra hverandre, som er riktig for en bre av den størrelsen.

**Den andre baken beviste noe verdt å vite: flisene er byte-identiske.** Bare
`isbrenavn.json` og `manifest.json` endret seg mellom de to kjøringene. Baken
er deterministisk, så en re-kjøring for å rette navnene koster ikke brukerne en
ny nedlasting av 117 MB.

Fra nå slår `data-areal="skog"` inn på hvert nybygd ark i dekningsområdet:
Turkarts «her er skog»-påstand viker for kilden, bakgrunnen blir åpen-tonen, og
skogen males oppå fra N50. Høyfjellet skiller seg fra granskogen. Kart bygget
før dette, eller uten dekning, beholder påstanden — merkelappen står på arket.

---

## 2026-08-26 — v5.26.0: Skogen ble aldri utelatt — den ble aldri bedt om. Og breene er på kartet

**Diagnosen først, fordi den er kortere enn man skulle tro.** Skogen manglet ikke
av en datamengde-grunn. Bake-scriptet klassifiserte `Skog` fra første dag,
flis-formatet hadde plass til den, klienten hadde taggen klar, og `arealMerge`
sto ferdig til å la OSM-skogen vike. Det som manglet var én streng: `--typer`
sto på sin default `myr`, og `bygg-n50-areal.yml` hadde ingen knott for flagget.
Det fantes altså ingen vei fra Actions-fanen til skogen, uansett hvor mange
ganger jobben ble kjørt. Manifestet sa ærlig `typer:["myr"]` hele veien.

En default som representerer et ferdig avklart mellomsteg er en felle, og denne
sto i to leveranser. Nå er defaulten `myr,skog,isbre` — man må be om mindre, ikke
om mer — og workflowen har feltet, dokumentert der man ser det.

**Størrelses-grensa er ekte, men den gjelder noe annet.** Myr ble 57,9 MB med
4 m forenkling og 2 500 m² minsteflate. En skogteig er kilometervis av kant der
hver meter koster byte og ingen av dem er synlige på et kart i 1:10 000; en myr
bæres av hvert eneste knekkpunkt. Én felles skrue måtte derfor valgt mellom å
ødelegge myra eller å bære skogen dyrere enn `public/` tåler. Skruene er nå
**per type** — `--toleranse myr=4,skog=8`, `--minareal myr=2500,skog=5000` — og
manifestet skriver dem per type, fordi ett tall der ville løyet. Myrens tall står
uendret med vilje: en bake som rørte dem ville skrevet 206 fliser på nytt og
sendt hver bruker ut i en full nedlasting for en forskjell ingen kan se.

**Isbre er en ny kode, 410, og den er ikke ISOM.** ISOM 2017-2 har ingen bre —
sportskart tegnes ikke på is. Norske turkart gjør det, og konvensjonen er hvit
flate med en svak blågrå kant. Kanten er ikke pynt: hvitt mot en lys
åpen-mark-tone har nesten ingen flate-kontrast, så uten den forsvinner breen
nøyaktig i det terrenget der breer finnes. Egen lag-bryter («Isbre»), egen farge
i alle elleve temaer, og en test som håndhever at hvert tema skiller breen fra
sin egen bakgrunn på flate ELLER kant.

**Bre-navnene er punkter, ikke flate-tagger.** N50 Arealdekke bærer ingen navn,
og Jostedalsbreen ville uansett fått ETT navn der kartet trenger armenes —
Nigardsbreen, Briksdalsbreen, Austdalsbreen. Baken henter dem derfor fra
N50s stedsnavn-lag til en egen `isbrenavn.json`, og mapBuilder etiketterer dem på
punktet. To kilder som ikke er avhengige av hverandre: `arealMerge` lar en
NAVNGITT OSM-bre overleve N50-undertrykkingen, siden et navngitt OSM-polygon er
den eneste navnekilden vi har der bake-navnene ikke rekker. Navne-passet i baken
er best-effort og logger hva det SÅ — Geonorge er blokkert fra utviklings-
sandkassene, og et gjettet feltnavn er nøyaktig feilen som lot den første
areal-kjøringen laste ned 166 MB og melde «success» med null flater.

**Høyfjellet skiller seg nå fra granskogen.** Turkart hevdet skog gjennom
bakgrunnsfargen — en bevisst kartografisk påstand, og riktig så lenge vi ikke
visste bedre. Med ekte data gjaldt påstanden fortsatt over alt, og rett over
tregrensa var arket like grønt som skogen under. CLAUDE.md sa hva som måtte
skje: den grønne bakgrunnen skal vike for kilden. Det gjør den nå — men **per
ark, ikke per tema.** `mapBuilder` setter `data-areal="skog"` på rot-SVG-en når
arket faktisk bærer N50-skog, og arkets eget stilark bytter da `--bg` til temaets
`--bg-apen`. Et kart bygget offline, med feilende fliser, eller før baken fantes,
har ingen skog å vike for og beholder påstanden. `n50ArealFetcher` feiler aldri
hardt, så «ingen fliser» ser ut som «ingen skog her» — uten den gaten ville en
mislykket henting gitt nøyaktig det tomme arket Turkart-temaet finnes for å
unngå. `--bg-apen` settes for ALLE temaer (lik den vanlige bakgrunnen der det
ikke er noe skille), fordi fallbacken i regelen er katalogens kremgule og et
mørkt tema uten variabelen ville fått lyst ark. Verdien må være en ren farge, og
en test håndhever det: `--bg: var(--bg-apen, var(--bg, …))` er en syklus, og CSS
gjør da hele deklarasjonen ugyldig.

Haloene i Turkart følger den lyse tonen nå, ikke den grønne. En blek halo er
lesbar mot BÅDE grønn skog og lys åpen mark; en grønn virker bare mot det ene.

**Én felle i flis-formatet er verdt å skrive ned.** `isbre` er lagt BAKERST i
`TYPER`, aldri i midten: rekkefølgen ER kodingen, så de fire første indeksene må
stå. Og `n50ArealTilElementer` faller ikke lenger tilbake på myr for en ukjent
type — den dropper flata. Fallbacken var ufarlig så lenge formatet ikke kunne
utvides; i det øyeblikket det kan, betyr den at en klient som ikke kjenner
`isbre` maler Jostedalsbreen som myr. Å droppe flata er feil på en måte man ser.

Gater: 2 579 tester (29 nye), `npm run build`, `npm run boot:workers`,
`npm run mcp:protokoll`. Kontrast-testene er verifisert i BEGGE retninger —
grønne på riktig kode, røde når `backgroundApen` settes tilbake til den grønne
tonen — for en sjekk som ikke kan feile er verre enn ingen sjekk.

**Flisene er ikke bakt i denne PR-en.** Koden er klar; kjør «Bygg
N50-arealdekke» med `bare mål` først og les tallene per type, som myr-baken
gjorde. Fram til den kjøringen er `typer:["myr"]` fortsatt sannheten i
manifestet, og kartet oppfører seg nøyaktig som før — det er hele poenget med at
merkelappen står på arket.

---

## 2026-08-26 — v5.25.6: Kanthåndtakene er strek, ikke form — og hjørnene har rett vinkel

De åtte utvidelses-håndtakene tegnes nå som bare de TO sidene av trekanten som
peker utover: en tykk vinkel med runde ender og rund spiss, uten grunnlinje og
uten fyll. Figuren er strek og ikke form, og legger seg over kartet uten å dekke
noe av det — den grønne fyllte trekanten fra v5.25.5 leste fortsatt som et objekt
oppå arket. Hjørne-håndtakene har fått RETT vinkel i stedet for 60°: dreid 45°
blir beina parallelle med arkets to kanter, så merket leser som et hjørne-merke
framfor en pil som tilfeldigvis står på skrå. Beinet er 19 px mot langsidenes 26,
fordi hjørne-merket ligger langs kanten og ikke på tvers av den. Utstikket er
uendret, så plasseringen fra v5.25.5 står: langsidene flukter med arkkanten, og
hjørne-merket havner ~3 px utenfor hver av de to kantene det favner.

Fargen er sort på lyse kart og hvit på mørke, og den avgjørelsen kommer fra
KARTETS tema (`isDark`) og ikke app-chromets. Det er ikke en detalj: turkart,
print og padling er lyse kart som normalt vises med mørkt app-chrome, så
`--color-ink` — det opplagte valget — ga åtte nesten usynlige hvite vinkler på
kremgul bakgrunn. Lesbarheten mot svarte stup og hvite konturer, som den runde
flaten holdt oppe før, ligger nå i en myk skygge i motsatt tone.

Den nye sjekken står SIST i lista, og det er ikke tilfeldig: den setter
kart-temaet, og kart-temaet er inngangsverdien for 3D-visningens dag/natt.
Første plassering var midt i lista, og da arvet sol/måne-sjekken et lyst kart
der den før arvet Curves — dag→natt-trykket re-baket 4096²-teksturen og
blokkerte hovedtråden forbi klikkets timeout. Sjekken var riktig, plasseringen
var feil, og røyktesten fanget det i CI.

Fargefeilen kan ikke fanges av en enhetstest — valget bor i en CSS-klasse mot en
computed — så røyktesten har fått en ny sjekk som setter et lyst og et mørkt
kart-tema selv og måler den FAKTISKE luminansen av streken mot kartets `--bg` i
begge. Den er verifisert i to retninger: grønn på riktig kode, rød på nettopp
`--color-ink`-varianten. Den setter dessuten temaene sine selv i stedet for å
måle det den arver — sjekken foran slutter på et mørkt tema, og en arvende
utgave ville bestått den lyse målingen uten å ha sett feilen den finnes for.

---

## 2026-08-26 — v5.25.5: Kanthåndtakene er trekanter utenfor kartkanten

De åtte utvidelses-knappene var runde, mørke skiver på 38 px som sto oppå
arkkanten, og de dominerte kartet de skulle ramme inn. Nå er hvert håndtak en
likesidet trekant på 26 px — fylt i pil-grønn med en tynn glorie i temafargen,
som gjør samme lesbarhets-jobb mot svarte stup og hvite konturer som den runde
flaten gjorde, i en form som ikke tar plassen til en knapp. Trekanten er dessuten
flyttet UT av kartet: geometrien skyver håndtakets punkt halve trekant-høyden
utover langs den roterte retningsaksen, så basen flukter med arkets ytterkant på
langsidene og har midtpunktet i hjørnet på diagonalene. Utover-vektoren regnes
fra retningen og ikke fra «anker minus arkets senter» — for et avlangt ark går
senter→hjørne ikke i 45°, og et senter-avledet utstikk ville skjøvet
hjørne-trekantene på skrå av sin egen spiss. Treffområdet er uendret på 48 px og
sentrert på det samme punktet: fingeren skal treffe der brukeren sikter, og en
26 px trekant er for liten å sikte på med hansker.

---

## 2026-08-25 — v5.25.4: sti-prikkene sto for spredt

507 «stitråkk — vanskelig» er den vanligste stien i norsk utmark: umerket
N50-sti og umerket turrute havner der. Den rendres som prikker, og lufta mellom
dem var for stor — mot ut.no leste den som spredte flekker mer enn som en sti.
Årsaken var at 505 og 506 ble strammet i v12.0.15 mens 507 ble stående: 0,2 mm
luft i ISOM-basen og 0,3 mm i Turkart, Padling, Natt og Print. Landets vanligste
sti var dermed den svakeste på kartet, og feilen var usynlig i kode fordi tallene
ser små og like ut uansett hva de betyr.

Enhetene er verdt å skrive ned, for de er ikke opplagte: `1mm` i en SVG med
viewBox i METER blir 96/25,4 = 3,7795 brukerenheter, altså 3,78 m på bakken.
Målt i nettleseren, ikke utledet. Stiplingen har derfor fast bakke-størrelse, og
forholdet dash:gap er det samme ved enhver zoom — det er forholdet, ikke tallene,
som avgjør om linja leses som en sti.

Målet som nå håndheves er BLEKK-ANDELEN, altså hvor stor del av linja som er
mark: `(dash + widthMm) / (dash + gap)`, siden round linecap legger en halv
strekbredde i hver ende. Under ~50 % leses linja som flekker. Basen gikk fra
45 % til 62 % (periode 0,83 → 0,60 m) og temaene fra 33 % til 54 %
(1,25 → 0,98 m).

Merk hva som IKKE er gjort, og hvorfor: 507 er ikke satt like tett som 505.
`kartStiler.test.js` håndhever at periode(507) > periode(505) i hvert tema,
fordi 507 SKAL lese glisnere — «vanskelig å følge» er hele betydningen. Første
forsøk satte temaene til periode 0,15 mm og brøt den invarianten i fire temaer.
Tettheten er derfor hentet ut ved å gjøre marken lengre (0,03 → 0,06 mm)
samtidig som lufta ble kortere (0,30 → 0,20 mm), som holder seg under taket.

Én kobling er kjent og urørt: `strek.sti`-multiplikatoren i kartstilene (Turkart
1,3, Natt 1,4, Print 1,45) skalerer strekBREDDEN men ikke stiplingen, så
blekk-andelen holder eksakt bare ved multiplikator 1. Prikkene blir fetere uten å
komme nærmere. Egen sak.

---

## 2026-08-25 — v5.25.3: røyktesten hentet hele historikken for én blob

Røyk-jobben brukte 5 min 29 s, og stegtidene fra v5.25.2-PR-en peker på et sted
ingen hadde mistenkt: `actions/checkout` med `fetch-depth: 0` sto for 2 min 39 s
av dem, mens CI-jobbens grunne checkout av samme commit tok 3 sekunder. Repoet
har bare rundt 51 commits, men et `.git` på 100 MB — genererte kart-SVG-er ligger
i historikken — så «kort historikk» er ikke det samme som «billig å hente».
Hypotesen før målingen var at Chromium-nedlastingen var synderen; den er 20
sekunder, og en cache der ville spart omtrent ingenting netto. Derfor er det
checkout som er fikset, ikke den.

`fetch-depth: 0` sto der fordi navnediff måler MapView.vue mot `origin/master`,
og den trenger nøyaktig ÉN blob: fila på master-tippen. Den hentes nå i sitt eget
steg. Merk formen: `git fetch origin master` er IKKE nok på en grunn klone — der
lagrer den bare i FETCH_HEAD og avvises i tillegg med «shallow roots are not
allowed to be updated», så `refs/remotes/origin/master` blir aldri opprettet og
navnediff feiler på at den ikke finner fila. Med full historikk var det checkout
som skaffet refen, så linja som allerede sto der var i praksis en no-op — den
feilen ville først vist seg i det øyeblikket noen gjorde klonen grunn. Riktig form
er eksplisitt refspec: `git fetch --depth=1 origin
+refs/heads/master:refs/remotes/origin/master`, verifisert mot en ekte grunn
klone i begge retninger.

Deploy-workflowen har samme `fetch-depth: 0` og er bevisst urørt: den pusher
`dist/` til gh-pages fra et git-worktree, og en grunn klone der er en risiko som
ikke kan prøves utenfor en ekte deploy. Gevinsten er to minutter på en jobb som
kjører etter merge og ikke blokkerer noen.

Den nest største posten er kart-byggingen: `--ektekart` henter et ferskt
Vardåsen-kart fra Kartverket + OSM og koster ~2 av jobbens ~3 minutter. Sju av
tjue sjekker krever det, og de gates nå på hva endringen faktisk rører. Merk hva
gaten IKKE er: «rører endringen kart-pipelinen» var den første formuleringen, og
den er feil. De sju sjekkene dekker useNavnLod, useViewportCull, useGhostTiles,
useKartSok, useKartEksport, useGestPerf og Viewer3D + vaerHimmel — composables og
komponenter, ikke pipelinen. En ren pipeline-gate ville hoppet stille over
navn-LOD-sjekken på en PR som endrer nettopp useNavnLod. Lista er derfor de sju
domenenes egne filer pluss `src/lib/**`, `MapView.vue` (den komponerer alle sju)
og testen selv. Logikken bor i `scripts/trenger-ektekart.mjs` med tolv
enhetstester, og ukjente stier faller til den dyre siden med vilje: et nytt
domene er dekket av seg selv, og det er kjente-men-ulistede stier som er fella —
derfor står det en påminnelse i røyktesten der `krever: 'ektekart'` leses.

---

## 2026-08-25 — v5.25.2: kanthåndtakene viker for chromet

De åtte lende-pilene var siden v5.19.2 alltid synlige og klampet 28 px inn fra
viewportens ytterkant, så de fulgte skjermen framfor arket. De var dermed
tilgjengelige, men landet under toppbaren, modus-chip-raden, målestokken og
FAB-klyngen — og en knapp man ser men ikke kan trykke er verre enn en knapp som
ikke er der. Klampen er nå erstattet av en TRYGG RAMME (`edgeSafeFrame`):
rektangelet i kart-wrapperen der ingen annen kontroll bor. Innenfor den gjelder
to regler. Er arkkanten en retning utvider på nær nok rammen, står håndtaket PÅ
kanten og følger den gjennom pan, zoom og rotasjon — panorerer du mot nord,
kommer nord-håndtaket til syne av seg selv, og bare det. Hvilke akser som teller
følger retningsvektoren, så nord kommer fram når nordkanten er på skjermen
uansett hvor langt øst man har panorert, mens nordøst krever at hjørnet er nært.
Er kanten derimot ikke på skjermen, dokker håndtaket til en fast plass på rammen
(hjørne eller kant-midtpunkt — det statiske åtte-knapp-oppsettet), og dokkede
håndtak vises bare i et fem sekunders vindu etter en handling som viser formatet:
kartet blir klart, «Sentrer» trykkes, en utvidelse er ferdig, eller man holder
inne et håndtak. Knappen har samtidig fått en flate å stå på — halvgjennomsiktig
`--color-overlay` med backdrop-blur — i stedet for bare en hvit ring, som
forsvant i konturene og stupene, og pila er grønn (`--pil-farge`, egen token
fordi den må snu i lyst tema) i samme betydning som ellers i appen: dette legger
noe til.

---

## 2026-08-25 — v5.25.1: Myra fikk en bunnflate

Eieren bygde et kart ved Rakkesetermyr i Nordmarka og meldte at han ikke så myr. Målingen viste at den var der hele tiden — flisene har 1 571 myrflater i Nordmarka, og klienten leste dem — men på Turkarts grønne bakgrunn leste de blå stripene som «litt striper» der UT.no viser en tydelig egen overflate. Han fant det selv ved å se nærmere: «mulig myra er der likevel, men den forsvinner litt på lysegrønn bakgrunnsfarge».

Årsaken er at myra tegnes som blå streker rett på underlaget, uten noe under. På ISOMs kremgule bakgrunn har stripene nok kontrast alene; på grønt har de det ikke. UT.no løser det med en lysere bunn under stripene, og det er nå mulig: mønsterets bunnflate emitteres alltid og er themebar (`--pattern-<navn>-fill`), lagt som inline style fordi `var()` ikke virker i SVG-presentasjonsattributter — samme felle punktsymbolene gikk i i v2.4.29. Uten tema-variabel og uten katalog-bakgrunn blir den `none`, så **Lys (ISOM) er byte-identisk med før**.

Turkart, Padling, Print og Natt gir nå myra en lys blåhvit bunn med kraftigere strek. To nye tester verner grepet: hvert kartstil-tema MÅ sette bunnflaten, og bunnen får ALDRI være samme farge som stripene — faller de sammen, blir mønsteret en flat flate, og da er fast myr (308) umulig å skille fra utrygg (309), som kun skilles av strektettheten. Det er samme regresjon den eksisterende «INGEN tema flater ut myra»-testen verner mot, bare gjennom en annen dør.

---

## 2026-08-25 — v5.25.0: Myra er på kartet

Ved Briskemyrputten i Drammensmarka viser UT.no en myr som dekker det meste av utsnittet. Lende tegnet bare selve putten. Nå er myra der: **206 fliser, 56 MB, 643 274 flater over 20 699 km²** bakt fra Kartverkets N50 Arealdekke og servert statisk ved siden av appen. I det aktuelle utsnittet finner klienten 26 myrflater, seks av dem med hull.

**Størrelsen ble avgjort på tall, ikke antakelse.** Buskerud alene ga 3,1 MB, og en naiv framskriving landet på 80–100 MB — over grensa der stinettet konkluderte at data må ha egen lagring. Landsmålingen viste 57,9 MB. Buskerud er myrrikt; snittet er lavere. Hadde vi gjettet, ville vi flyttet hele settet til R2 uten grunn og mistet det `public/` gir gratis: samme opprinnelse som appen, ingen CORS, ingen nøkler, ett deploy som holder app og dataformat i synk, og service worker-en som cacher flisene offline.

**Lag-navnet ble også målt.** Første kjøring lastet ned 166 MB Buskerud, fant null myrflater og meldte «success» — filteret `/arealdekke.*flate/i` var gjettet, og N50 heter `N50_Arealdekke_omrade`. Baken logger nå alle lagnavn når filteret bommer og hele objtype-fordelingen når det treffer, og en nedlasting uten en eneste flate gir `exit 1`. En gate som ikke kan feile er verre enn ingen gate; det er samme stillhet som lot MCP-Workeren bygge kart uten stinett i atten versjoner.

Fra samme måling: N50 har `Skog=88517` og `ÅpentOmråde=112020` nasjonalt i samme lag. Baken kan alt bære skog (`--typer myr,skog`), og manifestet lister hvilke typer flisene faktisk inneholder, så `arealMerge` ikke undertrykker OSM-skogen på tomt grunnlag. `ÅpentOmråde` bæres bevisst ikke: når Turkart-bakgrunnen blir den nøytrale åpen-tonen, ER åpenhet standardtilstanden, og 112 020 flater som maler bakgrunnen på nytt er datamengde uten et eneste nytt piksel.

To feller ved nasjonale bakes er skrevet inn i workflowen, begge som følge av feil gjort her: kjør ÉN nasjonal jobb om gangen (to samtidige nedlastinger av 2,5 GB kvelte hverandre — 19 min alene ble 40+ sammen), og push ikke til grenen mens en bake kjører (jobben sjekker ut én commit og pusher flisene tilbake til slutt).

---

## 2026-08-25 — v5.24.0: N50-myr — rørene er lagt, dataene mangler ennå

Eieren sammenlignet Briskemyrputten i Drammensmarka med UT.no: der UT viser en myr som dekker det meste av utsnittet, tegnet Lende bare selve putten. Årsaken er den samme som for stinettet i sin tid — OSM er tynt i norsk utmark, og `natural=wetland` finnes rett og slett ikke der. N50 har myra.

Denne leveransen bygger **hele røropplegget** for N50 arealdekke, etter nøyaktig samme oppskrift som stinettet: et kompakt flis-format (`n50ArealPakke.js`, varint-pakkede ringer med hull, ~5× mindre enn GeoJSON før gzip), et bake-script som laster ned fra Geonorge og skriver fliser (`scripts/bygg-n50-areal.mjs`), en klient som leser dem (`n50ArealFetcher.js`), og en delt sammenslåing (`arealMerge.js`). Nedlastings-maskineriet som sti-baken hadde alene er trukket ut til `scripts/geonorgeN50.mjs` og deles nå av begge — det er dyrekjøpt kunnskap om Geonorges API som ikke skal finnes i to kopier.

**Sammenslåingen er delt mellom app og headless FRA FØRSTE LINJE.** Vann-stacken lærte oss hva to varianter koster: headless hadde sin egen grovere versjon i månedsvis, og MCP-bygde kart mistet elvene sine uten at noen gate så det. Prinsippet er også arvet derfra — en kilde er autoritativ for DET DEN LEVERER. N50-baken bærer i dag myr og ingenting annet, så `arealKildeFlagg` avleder undertrykkelsen av hva flisene faktisk inneholder. Legger noen skog til baken senere, blir `harSkog` sann av seg selv, og OSM-skogen viker uten at `arealMerge.js` må røres. Formatet har allerede plass til den.

**Flatene klippes ikke på flisgrensene, de dupliseres.** En linje kan deles på grensa; en flate ville krevd ekte polygon-klipping med hull-håndtering, og gevinsten er null når en myr er noen få km mot en flis på ~55 × 35 km. Leseren dedupliserer i stedet — nødvendig, siden myr-mønsteret er halvgjennomsiktig og en dobbelt-tegnet flate ville lest som «utrygg myr».

**Dataene er IKKE med ennå, og det er med vilje.** Flater er tyngre enn linjer, og myr dekker ~9 % av Norge; stinettet ble 12 MB, men vi vet ikke hva dette blir. Bake-workflowen har derfor «bare mål» som standard: den laster ned, måler og skriver ingenting, så arkitekturvalget — statiske filer i `public/` eller egen lagring — tas på tall. Det var rekkefølgen sti-baken brukte, og den sparte oss for et feilvalg. Hele klient-siden tåler at flisene ikke finnes: uten dem får kartet bare OSM-myra, som før.

Alt er verifisert med 2 496 tester, `npm run build` og `npm run boot:workers`. Workeren får `N50_AREAL_BASE` av samme grunn som den fikk `N50_STI_BASE`: uten den bygger skyen kart uten myr, helt stille.

---

## 2026-08-25 — v5.23.1: Sti-stiplingen leses som stiplet

Eieren tok v5.23.0 med ut og meldte at stiene fortsatt så heltrukne ut: strekene var «alt for lange, de bør være en tredjedel så lange, altså mye tettere — nesten prikkeform». Stiplingen er derfor kortet fra 0,36 mm (ISOM-spec) til **0,12 mm strek og 0,11 mm luft** — nøyaktig en tredjedel av spec-en, og en rytme som er nesten tre ganger tettere. Stitråkk (507) er samtidig gjort glisnere, ikke tettere, så «vanskelig å følge» fortsatt skiller seg fra en tydelig sti nå som begge er korte.

**Papir viste seg IKKE å være unntaket vi antok.** v5.23.0 ga Print bevisst lengre strek, med den plausible begrunnelsen at fin stipling flyter ut i blekk-spredning ved 1:10 000. Eieren så på et ekte Print-kart at det er nettopp der problemet er verst: lange strek smelter sammen med det øvrige svarte linjeverket, og stien slutter å være en sti. Alle fire kartstilene — Turkart, Padling, Natt og Print — deler nå samme rytme. Orientering er urørt; der ER ISOM-spec-en poenget.

Fire nye tester per kartstil verner tettheten mot å drive tilbake: strek på høyst en tredjedel av spec-lengden, minst dobbelt så tett rytme, 507 fortsatt glisnere enn 505, og Print identisk med Turkart. Den siste finnes fordi antakelsen om papir var plausibel nok til å bli gjort én gang, og da bør den ikke kunne gjøres stille en gang til.

---

## 2026-08-24 — v5.23.0: Kartstil — ett valg som setter hele uttrykket

Eieren sammenlignet Lende over Tverken med UT.no og Vegkart og pekte på tre ting: skogen manglet, en stor myr manglet, og de fire forhåndsvalgene skilte seg for lite fra hverandre. Utforskingen viste at han hadde rett på en mer grunnleggende måte enn klagen antydet. **Forhåndsvalgene endret ikke ett eneste piksel-uttrykk** — de var rene lag-lister, og «Detaljert» skilte seg fra «Tur» på ni lag-nøkler hvorav seks sjelden har data i innlandsterreng. I praksis var hele forskjellen gårdsnavn og gjerder. Og av åtte temaer var bare to faktiske kartstiler; de seks andre var monokrome stemninger.

**Kartstil er nå ett begrep som binder de fire aksene som aldri visste om hverandre** — tema, lag, strektykkelse og sti-farger. Fem stiler med reell visuell kontrast: Turkart (grønn grunntone, brune høydekurver, tydelig stiplede stier), Orientering (dagens ISOM urørt), Padling (sjøen i forgrunnen, land dempet), Natt og Print (blekk på papirtone, relieff og GPS-spor av). Tre av temaene er nye. **«Detaljert» er fjernet, ikke omdøpt:** et navn som lover detaljrikdom og leverer to lag er verre enn ingen knapp. De frie knottene er ikke borte — de ligger under «Tilpass» og seedes fra kartstilen, så man justerer fra et designet utgangspunkt i stedet for fra ingenting. Sti-fargene har fått fem navngitte paletter; to fargevelgere med 16 millioner verdier hver er ikke et valg, det er en oppgave, og den frie velgeren står fortsatt i Strek-panelet for den som vil noe eget.

**Rotårsaken til det kremgule arket var ikke feilfarging — skogen hentes ikke.** `canopyHeight.js` (CHM = DOM − DTM) ble slettet i v2.3.0 med begrunnelsen «Ga aldri synlig skog-nyanse», men sto oppført i CLAUDE.md som kjernefil helt til nå. All vegetasjon kommer fra OSM alene, og OSM er tynt i norsk utmark — samme diagnose `n50StiFetcher.js` selv åpner med for stier. I tillegg har ISOM omvendt vegetasjonslogikk av alle andre norske kart: `405` løpbar skog er HVIT og `401` åpen mark er GUL, så selv der skogen fantes rendret den nesten usynlig mot kremgult. Turkart-temaet snur dette med samme grep som vann-stacken bruker mot land: **bakgrunnen ER skog, og åpenhet males oppå.** Det flytter databyrden fra skogpolygoner over hele Norge til unntakene, og unntakene er nettopp det OSM dekker godt. Prisen er en bevisst kartografisk påstand — vi hevder skog der vi ikke vet bedre, slik papirkart alltid har gjort — og den står skrevet både i temaets `$comment` og i CLAUDE.md, sammen med hva som må skje den dagen en ekte arealdekke-kilde kommer inn.

Stiplingen er gjort themebar (`--iso-<kode>-dash`), fordi ISOM-spec-ens 0,36 mm er regnet for trykk i 1:10 000 og leses som heltrukket på skjerm; det samme gjelder casing-fargen, som ellers ville falt tilbake på Turkarts grønne bakgrunn og gjort stien usynlig. **Små bygg er ikke lenger alle det samme hvite kvadratet:** hytter og koier tegnes fylt (landemerke og mulig ly), garasjer og boder mindre og dempet, resten som før — klassifisert fra OSM-tagger vi allerede henter, og forklart i tegnforklaringen. Lag-knappene har fått `aria-pressed`, som både er riktig for skjermlesere og gir røyktesten en ærlig krok.

**Standarden for nye installasjoner er Turkart, ikke ISOM.** Et lagret temavalg vinner, så ingen våkner til et annet kart enn de la seg med.

**Myra er IKKE løst i denne PR-en, og det skal sies rett ut.** OSM-myr hentes og rendres nå tydelig (blå striper i Turkart), men det som mangler ved Tverken er N50 Arealdekke — og den baken kunne verken gjøres eller verifiseres herfra: Overpass, Geonorge og Miljødirektoratet er alle blokkert fra utviklings-sandkassen. Oppskriften ligger i `n50StiPakke.js`, og CLAUDE.md sier hva som må endres i Turkart-temaet den dagen kilden finnes.

Gater: 2 455 tester, `npm run royk` (ny sjekk som trykker seg gjennom kartstil-velgeren og verifiserer at BÅDE palett og lag flyttet seg, med opprydding i `finally` så en feilende sjekk koster én sjekk og ikke resten), `npm run navnediff` (`activePreset`/`applyPreset` kvittert ut som villet), `npm run mcp:protokoll` (14 verktøy — `juster_kart` og `styr_kartlag` har byttet `preset` mot `kartstil`) og `npm run boot:workers`.

---

## 2026-08-23 — v5.22.12: Retur fra bakgrunn, gul måne, og riktig symbol til riktig time

Fire ting etter kveldens feiljakt, og alle er meldt fra felt.

**3D sto frosset etter en tur i en annen app.** Var man i 3D-visningen og byttet
til en annen app i noen minutter, var visningen død ved retur — ingen zoom, ingen
panorering, og knappene gjorde ingenting. Eneste utvei var å lukke 3D og gå inn
igjen. Det er minst tre uavhengige årsaker, og de kan ikke skilles fra hverandre
herfra: `visibilitychange` kommer ikke alltid når Android har fryst siden (Chrome
sender `resume` i stedet), GL-contexten kan være tapt uten at
`webglcontextrestored` noen gang fires, og — den verste — et unntak i `onFrame`
hoppet over linja rett under, som er den som ber om neste frame. ÉN feil drepte
altså loopen for godt, og en tapt context eller en tekstur som forsvant i
bakgrunnen er nok til å kaste.

`engineLoop` ber nå ALLTID om neste frame (feilen logges én gang), lytter på
`visibilitychange`, `resume`, `pageshow` og `focus`, og — det som gjør det
robust — VERIFISERER oppvåkningen: kom det ingen frame innen 1,5 s med synlig
side, prøves én omstart, og hjelper ikke det heller, sier den fra via `onDead`.
Viseren bygger da motoren om, som er nøyaktig det brukeren ellers gjorde for hånd.
Fem nye tester dekker dette; den viktigste er at en frame som kaster koster én
frame og ikke økta.

**Sol midt på natta i værraden.** Symbolvarianten fulgte dag/natt-knappen i 3D,
med begrunnelsen «ser man en natthimmel, skal symbolet vise natt». Konsekvensen
var sol i raden klokka 00 så snart man sto i dagmodus. Raden er et VARSEL, ikke
en illustrasjon av himmelen man har valgt — og MET setter allerede varianten selv
i `symbol_code`, regnet ut for tidspunktet og stedet. Overstyringen er fjernet;
2D gjorde det riktig hele tiden.

**Månen var grå og forsvant.** METs måne er `#686e73` og laget for hvit
bakgrunn; værraden i Lende ligger på et halvgjennomsiktig felt oppå kartet, og
der var den nesten usynlig. Byggeskriptet bytter den nå til solas egne gulfarger
fra samme sett (`MAANE_FARGER`), med en gate som sier fra hvis MET endrer
paletten. Gråtonene finnes bare i de 21 natt- og polartwilight-ikonene, og bare i
himmellegemet — kontrollert mot hele settet. Det er vårt eneste avvik fra kildens
palett, og det står i toppen av den genererte fila.

**Nåle-diagnosen i Info-panelet er tatt ut.** Den ble lagt inn i v5.22.10 for å
måle i stedet for å gjette, den løste saken i v5.22.11, og da er den ferdig.
Lærdommen står i CLAUDE.md — sammen med regelen om at en instans som ikke skal
ses, ikke skal submitteres, og med hvordan man leser en farge ut av et
skjermbilde og slår den opp i paletten.

---
## 2026-08-23 — v5.22.11: Skjulte nåler sendes ikke til GPU-en i det hele tatt

Målingen fra v5.22.10 avgjorde saken, og den avgjorde den mot min egen hypotese.
Fra eierens telefon, med artefakten på skjermen:

```
34 vist / 693 parkert / 0 utelatt av 727
største hode 0.8 % av synsfeltet (tak 12 %)
```

Altså: hver matrise vi skrev var riktig — det største hodet dekket 0,8 % mot et
tak på 12 % — mens vi likevel sendte **693 instanser vi ikke skulle se** til
GPU-en hver frame og ba den klippe dem bort. Det er den eneste tingen som var
felles for alle tre rundene med feilsøking, og det var den vi ikke hadde rørt.

Formen på det parkerte har vandret, og begge variantene var inndata en
desktop-GPU forkaster stille mens en mobil-driver står fritt: først skala 0 —
en singulær matrise med alle 260 verteksene i kula i ett punkt — og etter
v5.22.9 kuler 200 km under bakken, altså langt utenfor guard-bandet en
tile-basert GPU regner med. Det den gjorde med dem var heldekkende, flimrende
flater i nålenes egne farger.

Nå ligger de tegnede instansene fremst i bufferet (`slots[k]` peker på nåla i
slot k), og `count` settes til antallet som faktisk vises. En instans som ikke
submitteres kan ingen driver tegne feil. Det er samtidig 20× mindre arbeid:
34 instanser i stedet for 727 — eller 79 i stedet for 218 på Vardåsen, målt.

To ting kompakteringen tvinger fram, og som begge er dekket av tester:
`instanceColor` følger SLOTEN og ikke nåla, så fargene skrives om når
declutteren bytter sammensetning (maks ~4,5 ganger i sekundet, ikke når kameraet
flytter seg) — ellers får en nål naboens farge. Og `InstancedMesh` cacher en
bounding sphere som three IKKE invaliderer når matrisene endres; den brukes av
raycast, så uten å nulle den ville et trykk kunne bomme på nåla som nettopp
flyttet inn i sloten. Den fella ble faktisk fanget av en eksisterende
pinLayer-test.

Info-panelets nåletall står igjen. Det var det som gjorde denne runden mulig, og
det koster ingenting å beholde.

---
## 2026-08-23 — v5.22.10: Instans-bufferet er dynamisk, og nålene kan måles

Tredje runde på de flimrende flatene i 3D. To ting er nå etablert som fakta og
ikke antakelser: feilen kommer KUN når knappenålene er på, og fargen er konstant
gjennom en økt — grå `#7f8c8d` på dette kartet, lilla `#8e44ad` og blå `#1d4ed8`
på to andre. At fargen er stabil per kart, og ikke tilhører den nåla kameraet er
nær, er det avgjørende sporet: det peker bort fra geometri og mot innholdet i
instans-bufferet.

Og der er det én ting som skiller seg ut. `instanceMatrix` skrives om HVER frame
— avstandsskalaen følger kameraet — mens bufferet lå på three sin standard
`StaticDrawUsage`. Det er en beskjed til driveren om at innholdet lastes opp én
gang; når vi likevel sender `bufferSubData` 60 ganger i sekundet, har driveren
lov til å skrive rett inn i minnet GPU-en fortsatt leser forrige frame fra i
stedet for å lage en ny kopi. Flere mobil-GPU-er gjør nettopp det. Utfallet er
revne matriser for enkeltinstanser — heldekkende, flimrende flater i nålas egen
farge, som aldri viser seg på desktop eller i SwiftShader. Begge nålefeltets
matrise-buffere er nå merket `DynamicDrawUsage`, som er den dokumenterte måten å
si at et buffer skrives ofte.

I tillegg skrives ikke matrisene om i det hele tatt når de ikke trenger det:
står kameraet stille (under 25 cm flyttet) og declutteren er uendret, hopper
`update` ut. Det fjerner selve vinduet der GPU-en kan lese et buffer vi skriver
i, for det tilfellet man faktisk står og ser på artefakten.

Om det ikke holder, skal neste runde ikke bli en ny gjetning. Feilen finnes bare
på eierens telefon, og feilsøkingen har gått i ring fordi de eneste
observasjonene har vært skjermbilder. Info-panelet i 3D viser nå målingen som
skiller de to mulighetene fra hverandre: hvor mange nåler som vises, er parkert
og er utelatt, hvilken nål som er STØRST på skjermen, og hvor stor andel av
synsfeltet det hodet dekker. Taket fra v5.22.8 er 12 %. Står det et tall over
det, er matrisene i bufferet ikke de vi skrev — og da er det ikke lenger en
hypotese. Står det under, er artefakten ikke et nålehode, og letingen flytter
seg.

---
## 2026-08-23 — v5.22.9: Parkerte nåler er ikke lenger nullflater

Oppfølging til v5.22.8. Vinkel-taket fjernet de heldekkende flatene, men det kom
nye skjermbilder fra felt: knivtynne, flimrende kiler med spissen langt oppe i
himmelen og kilden bortenfor horisonten — fortsatt i nålefargene (målt `#7f8c8d`,
altså `FREDET_KAT_COLOR.annet`), og fortsatt borte når nålene skrus av.

Endret karakter, samme kilde. Skjulte nåler ble parkert ved å sette skala 0 og la
dem stå på plassen sin, og det er en SINGULÆR matrise: alle 260 verteksene i kula
faller sammen i ett punkt. Declutteren slipper gjennom 120 nåler, så på et kart
med 272 POI-er skrev hver frame over 150 slike nullflater inn i instans-bufferet.
Desktop-GPU-er og SwiftShader forkaster dem stille — en mobil-GPU tegnet dem som
vilkårlige kiler. Det forklarer også et spor som ikke stemte tidligere: fargen på
båndet tilhørte flere ganger en nåletype man ikke så noe annet sted i bildet,
altså nettopp en PARKERT nål. Og det forklarer hvorfor v5.22.8 endret uttrykket
uten å fjerne det: taket gir skala 0 når kameraet står oppå en nål, så nære hoder
gikk fra å være heldekkende flater til å bli parkerte nullflater.

Parkerte nåler flyttes nå 200 km rett ned (`PARK_Y`) i full størrelse. Det er en
helt vanlig kule med en gyldig matrise, som havner utenfor far-planet på 60 km og
klippes bort etter spec. Indeksene står stille, som før — de brukes både av
raycast og av `instanceColor`. De to nålene som ikke er instansert (start/mål/via
og GPS-nåla) skrus av med `visible = false` i stedet, som er den riktige måten for
et vanlig Object3D.

I samme runde: nåler uten troverdig bakkepunkt parkeres og utelates helt, med en
`console.warn` som navngir dem. To kilder er realistiske — POI-lag som projiseres
med `wgs84ToSvg` (én WFS-post med byttet akserekkefølge er nok), og DEM-en, der en
fyllverdi som IKKE er lik `noData` (f.eks. 3,4e38) blir Infinity i det øyeblikket
den lagres i `bases`, som er en Float32Array. Kulturminne-dataene for både Drammen
og Vardåsen er sjekket og er rene (439 og 344 poster, ingen NaN, ingen byttede
akser), så dette er en gate og ikke en observert feil — men den koster ingenting,
og alternativet er at ÉN dårlig rad ødelegger bildet for alle de andre.

Merk hva som ikke kan verifiseres herfra: en Infinity-instans skrevet rett inn i
bufferet ga null utslag i SwiftShader, akkurat som forventet. Denne feilklassen
finnes bare på tile-baserte mobil-GPU-er, så testene håndhever INNDATA — at ingen
matrise noen gang er singulær eller ikke-endelig, uansett kameraposisjon og
declutter-tilstand — ikke bildet.

---

## 2026-08-23 — v5.22.8: Nålehodet som svelget hele skjermen

Rapportert fra felt: 3D-visningen viste flimrende, heldekkende bånd i rødt,
blått, lilla og grått som skiftet flere ganger i sekundet. Fargene var nøkkelen —
målt i skjermbildene var de eksakt `#8e44ad`, `#7f8c8d` og `#1d4ed8`, altså
`FREDET_KAT_COLOR.automatisk`, `.annet` og `POI_KIND_COLOR.nve` fra
`poiColors.js`. Ingen annet objekt i 3D-scenen har de fargene: en dump av hele
scenegrafen (37 objekter) fant dem bare i knappenålenes `instanceColor`. Og
båndene var ugjennomsiktige, helt flate og rette i kanten — altså ÉN primitiv
blåst opp i skjermrommet, ikke blending eller z-fighting.

Feilen: skalaen ble regnet fra nålas BAKKEPUNKT, men hodet sitter 60 m OVER det.
Flyr man i nålehøyde er foten 60 m unna — «hold naturlig størrelse, skala 1,
hode-radius 9 m» — mens hodet kan ligge én meter foran linsa. Da dekker det ene
hodet hele bildet i sin egen flate farge, og idet kameraet krysser kuleflata
forsvinner det helt (baksideflatene klippes bort). Det er flimringen: én nål av
og på i frame-tempo. Reprodusert i Chromium mot Vardåsen med ekte DEM — ett hode
fylte 100 % av bildet på 10 m avstand.

`pinScaleForCamera` erstatter `pinScaleAt` på alle fire kallstedene (nålefeltet,
declutter-boksen i pinLayer, start/mål/via-nålene og GPS-nåla) og legger et tak
på hodets VINKELSTØRRELSE, målt fra hodet og ikke foten. Taket må løses og ikke
gjettes: hodet står `HODE_LOFT·s` over bakken, så avstanden til hodet er en
funksjon av skalaen man leter etter, og ett gjett bommer med opptil 25 % fordi et
lavere hode kommer NÆRMERE et kamera som står under det. Andregradsligningen står
utledet i koden. Over ~75 m binder taket ikke i det hele tatt, så nålene ser ut
akkurat som før på all normal avstand; nærmere holder hodet konstant vinkel og
krymper i stedet for å vokse.

Merk at «etter dependabot-oppdateringene» var et rødt spor: `git diff
6d44bd4..HEAD -- src/ public/` viser at ingen 3D-kode er endret siden v5.22.3, og
`three` har stått på `^0.185.1` siden v5.8.0. Feilen har ligget der siden nålene
fikk avstandsoverdrivelse — den krever bare at kameraet kommer nær nok, og det
gjør frikameraet.

Testen som ville tatt den: `pinField.test.js` går nå over et rutenett av
kameraposisjoner (0–400 m i høyde og vannrett avstand) og krever at hodet aldri
dekker mer enn taket. Den gamle «nær kamera»-testen sto tilfeldigvis OPPÅ nåla,
der taket nå binder, og er flyttet ut til 600 m.

---
## 2026-08-23 — v5.22.7: vue-router 5

Major-oppgraderingen fra 4.6.4. API-flata vi bruker er liten og konvensjonell —
`createRouter`, `createWebHistory`, `useRouter`, `useRoute`, `RouterView`,
`push`/`replace`/`back`/`beforeEach`, `scrollBehavior` og funksjons-redirects — og
alt finnes uendret i 5. Ingen kodeendring var nødvendig.

Det som var verdt arbeidet er verifiseringen. `npm run royk` monterer ÉN rute og
sier ingenting om at `/about` lander på `/om`, at `/kart/nytt?lat=…` beholder
query-en, eller at boot-hooken som gjenopptar forrige kart fortsatt returnerer en
gyldig location. Ny `npm run royk:ruter` går gjennom alle ni ruter og redirects
pluss boot-gjenopptaket i Chromium, og sjekker BÅDE slutt-URL og at det faktisk
står noe i DOM-en — en død redirect gir ellers en URL som ser riktig ut over en
blank side. Den er kjørt grønn på BEGGE versjoner, så den måler ruteren og ikke
tilfeldigheter, og verifisert rød ved å fjerne `/about`-redirecten.

Første utgave av testen rapporterte at `/kart → /` var brutt i vue-router 5. Det
var feil: et tidligere besøk på `/rute` i samme løkke fikk GravelPlannerView til
å skrive `lende-last-mode`, og boot-hooken sendte da `/` videre til `/rute` — helt
riktig app-atferd. Testen nullstiller nå lagret state før hver navigasjon.
## 2026-08-23 — v5.22.6: @napi-rs/canvas 1.0 — og et ikon som forsvant stille

Major-bumpen (0.1.100 → 1.0.7) avdekket at 1.0 ikke løser `href` på `<use>`, bare
den gamle `xlink:href`-formen. Ikonet vårt brukte `<defs>` + `<use href="#blob">`
for de fire høydekurvene, så alle fire forsvant fra de genererte PWA-ikonene —
igjen sto bakgrunnen og midtprikken. Scriptet skrev fire glade «Wrote …»-linjer
og returnerte 0. PNG-er er binære i git-diffen, så ingenting så det; det ble bare
oppdaget fordi filene krympet fra 31 til 3 kB og tallet var for merkelig å la
ligge.

Path-en er nå gjentatt fire ganger framfor `<use>`. Det er mindre pent, men det
avhenger ikke av at en renderer støtter `<use>` i det hele tatt — og begrunnelsen
står i SVG-en, så den ikke blir «ryddet» tilbake. `gen-icons.mjs` teller nå gule
piksler og feiler under 3 % av flaten: et riktig ikon ligger på ~8 %, en
bare-prikken-variant på ~0,2 %. Verifisert i begge retninger.

---

## 2026-08-23 — v5.22.5: Siste to sårbarhetene i MCP-Workeren

`fast-uri` 3.1.4 → 3.1.6 og `hono` 4.12.32 → 4.13.3, begge transitive via
MCP-SDK-en, begge i den deployede Workerens runtime-tre. Lockfile-alene, ingen
versjonsrange rørt. Workeren er nå på null kjente sårbarheter, og hele treet —
app, MCP-Worker, proxy, ai-worker — er rent.

Verdt å merke seg hvorfor dette nå var trivielt: i v5.22.2 ble Workerens
`npm audit fix` bevisst utsatt fordi den dro inn `miniflare` 5.x-alpha og fjernet
`@cloudflare/workers-types`. Begge var symptomer på wrangler-versjonen, ikke på
fiksen. Da v5.22.4 tok wrangler til 4.125 — som har miniflare 5-alpha som sin
EGEN avhengighet — forsvant hele konflikten, og `audit fix` gjør nå to rene
lockfile-bumps. Lærdommen er at «utsett fiksen» var riktig avgjørelse av feil
grunn: den skulle vært utsatt til wrangler var oppdatert, ikke fordi fiksen var
uansvarlig.

---

## 2026-08-23 — v5.22.4: De tre grupperte Dependabot-oppdateringene

Første runde fra vedlikeholdsrutinen i v5.22.2. Tre grupperte Dependabot-PR-er
(#301, #302, #304) tatt inn som én endring på fersk master, med versjons-bump,
framfor tre merger uten. Grunnen er `CACHE_VERSION` i `public/sw.js`: vite og vue
endrer bunten, og en dependency-merge uten bump ville latt mobil-klienten sitte
på gamle assets. Dependabot bumper ikke appens egen versjon.

Innholdet: sju fontpakker til 5.3.0, MCP-SDK-en til 1.30, vue 3.5.41,
vite 8.2.2, vitest 4.1.11, tailwind 4.3.3; wrangler til 4.125 i MCP-Workeren; og
actions/checkout, setup-node og upload-artifact fra v4 til v7 i alle tolv
workflows — det siste rydder også Node 20-deprecation-advarselen som lå i hver
CI-logg.

To ting verdt å notere. Wrangler 4.125 drar inn `miniflare` 5.x-**alpha** som sin
egen avhengighet, så den var ikke til å unngå ved å avstå fra `npm audit fix` —
den kommer med bumpen. Både `boot:workers` og `mcp:protokoll` er grønne på den,
som er den eneste målingen som betyr noe her. Og Dependabot re-serialiserer
`package.json`, som ville escapet æ/ø/å i MCP-Workerens beskrivelse til
`\u00f8` — én grunn til at det er verdt å ta oppdateringene inn selv framfor å
merge robotens gren rått.

Actions-bumpen avdekket dessuten et latent kappløp: `build-redlist` og
`build-nasjonalparker` trigger begge på push når sin egen workflow-fil endres, og
en actions-oppdatering rører alltid BEGGE. De pusher til samme gren, og den som
tapte fikk «non-fast-forward» og feilet — uten at noe var galt med dataene. Begge
har nå en push-retry som tar vare på artefakten, flytter til den nye tippen og
legger den på igjen. Ikke rebase: `actions/checkout` gir en grunn klone, og en
rebase over shallow-grensa er upålitelig. Kappløpet er simulert lokalt med to
grunne kloner, og begge datasett overlever det — og bekreftet i CI på selve
PR-en, der redlist-jobben tapte kappløpet igjen og denne gangen kom seg gjennom
på andre forsøk.

---

## 2026-08-23 — v5.22.3: agents 0.21 i MCP-Workeren, og en gate som ser verktøyene

De to siste sårbarhetsfunnene i den deployede MCP-Workeren er lukket. `agents`
0.21 krever `zod` ^4 og MCP-SDK-en eksakt 1.30, så tre biblioteker gikk samtidig
— og den nestede sdk 1.23 inne i `agents`, som var den som faktisk bar
cross-client-lekkasjen, er borte. `createMcpHandler` finnes fortsatt, men tar nå
både en SDK v1-server (legacy, sessionful) og en SDK v2-fabrikk (stateless), og
v1-grenen er deprecated. Vi kaller derfor `createLegacyMcpHandler` eksplisitt:
samme atferd som overlast-oppløsningen ville valgt, men det står skrevet.
Migrering til v2-fabrikken rører hvordan hvert verktøy registreres og får sin
egen jobb.

Selve oppgraderingen er liten. Det som var verdt arbeidet er gaten:
`npm run mcp:protokoll` starter Workeren i workerd og kjører MCP-protokollen —
initialize, tools/list, tools/call med både gyldige og ugyldige argumenter.
`worker-boot` beviser bare at runtimen svarer på /health; verktøyenes skjemaer
serialiseres først i tools/list, så en Worker kan starte fint og likevel levere
verktøy ingen klient kan bruke. Den deployede røyktesten dekket dette, men først
etter merge — samme blindsone som ga atten røde deploys fra v5.0.16. Gaten er
verifisert i begge retninger: den er grønn på riktig kode og rød på en ødelagt
handler-import.

Underveis: `npm run vedlikehold` meldte «3 major» der det var 2, fordi
`npm outdated` utelater `current` for pakker som ikke er installert i katalogen —
og i CI er de ikke det for Workerne. De rapporteres nå som «ikke installert her»
framfor å bli gjettet på.

---

## 2026-08-23 — v5.22.2: Vedlikehold av avhengigheter, satt i system

Ingen funksjonsendring. Prosjektet hadde tolv workflows og ingen av dem så på
avhengigheter: ingen Dependabot, ingen Renovate, ingen `npm audit`. Nå finnes
`npm run vedlikehold`, som kjører audit + outdated i alle fire katalogene og
sorterer funnene etter FLATE framfor alvorsgrad — nettleser-bunten først, så det
som er deployet, så dev-bare. Det skillet er poenget: et `npm audit` fra rota
svarer på et annet spørsmål enn man tror, for de tre Workerne har hver sin
`package.json` og kan ha andre versjoner av samme pakke. Dependabot kjører
ukentlig over de fire katalogene pluss GitHub Actions, med patch/minor gruppert
og major alene. CI fikk to steg: rapporten, som aldri feiler, og
`npm audit --omit=dev --audit-level=high`, som feiler — det er kode vi sender til
nettleseren. Underveis ble alle sju sårbarhetsfunnene i rot-treet lukket
lockfile-alene (dompurify, postcss, nanoid, hono, fast-uri, ip-address,
@hono/node-server), og en ubrukt `ai`-avhengighet fjernet fra MCP-Workeren. De to
som står igjen krever `agents` 0.21, et API-brudd som får sin egen PR.

---

## 2026-08-23 — v5.22.1: Lyn inne i skya, skygger på bakken, og vind man ser

Fem etterslep fra værhimmelen, og ett av dem var en ren feil. Vinden var
DEMPET der den skulle vært forsterket: 2 m/s og 18 m/s flyttet skyene 1,9 %
mot 7,1 % av synsfeltet på ti sekunder, altså en ratio som fantes men som
ingen kunne se. Faktoren er nå snudd, og forskjellen er 4,2 % mot 25,8 %.
Tåke var heller ikke tåke — den la bare på skyer og så ut som overskyet;
`siktFaktor` skalerer nå dis-avstandene, så tåke er redusert sikt slik det
skal være. Regn og sludd faller som streker (`LineSegments`) som legger seg
etter vindretningen, mens snø fortsatt er runde punkt. Torden fikk en
sikk-sakk-strek under skya, og — etter eierens ønske om at Tor skal få vise
vreden sin — et LYSGLIMT INNE I skya: puff-shaderen har et kjernevektet,
additivt ledd som lar fargen gå forbi hvitt, så det blømmer framfor å bli lys
grått. Kurven er to topper, en forglimt og et hovedslag. Til sist kaster
skyene nå skygge på terrenget, analytisk (`skyskygge.js`) siden terrenget
ikke har noen lyssetting å modulere — sol-retningen tas fra skyene, som igjen
er rettet til å stemme med relieffet i karttekstur (nordvest, 45°). Den var
speilvendt før.

---

# Endringslogg

## 2026-08-23 — v5.22.0: Skyer med volum

Skyene i 3D er ikke lenger flate plater. Hver sky er en klynge av 13 puffer med
hver sin posisjon i rommet, og hver puff skyggelegges som en kule — normalen
regnes ut av firkantens egne koordinater, og sol-retningen oversettes til
view-space hver frame så lyset står stille i verden når kameraet dreier.

Det løser tre ting ingen teksturendring kunne: toppen buler i stedet for å være
flat, silhuetten endrer seg når man flyr rundt, og puffene passerer forbi én for
én når man flyr inn i en sky. Kostnaden er uendret — én draw call per sky, fjorten
totalt, som sprites hadde.

Grunnen til at det tok så lang tid å komme hit er verdt å skrive ned. Eieren meldte
at skyene så «kuttet» ut og var flate i toppen, og det ble forsøkt rettet åtte
ganger i teksturen: radius-klipping, høyere lerret, alfa-vignett, `fog: false`,
materiale per sprite, `alphaTest`, større skyfelt, nær-kamera-demping. Alle var
feil sted å lete. En GPU-måling fra eierens egen telefon frikjente hele
teksturveien — sRGB, mipmap-generering, NPOT, tømt kildelerret og ufullstendig
tekstur var alle rene. Da sto billboardet selv igjen som eneste forklaring, og det
var eieren som satte ord på det: en `THREE.Sprite` er en flat plate som alltid
vender mot betrakteren, så toppen er flat uansett hva teksturen inneholder.

De fire tallene som styrer uttrykket (`radiusFaktor`, `kantMyk`, `tetthet`,
`lysKontrast`) står samlet i toppen av `buildPuffClouds`, fordi de er smak og ikke
mekanikk. Tre innstillinger ble rendret fra fire kameravinkler og lagt fram til
valg framfor at én ble gjettet fram. `puffSkyer.test.js` håndhever det som ikke er
smak: utstrekning i alle tre akser — testen feiler med «klyngen er en plate» hvis
dybden forsvinner — og at puffene overlapper nok til at man ser skya og ikke kulene.

Sprite-skyene og skyteksturen er fjernet fra `skyDome.js`, som nå bare eier
himmelkuppelen, natthimmelen, nedbøren og disen. Værmodus virker som før:
`setVaer` justerer antall synlige skyer, farge, tetthet og driftretning, og
`setVaer(null)` gir bit-identisk utgangstilstand.

Utvikler-fanen har fått **Vær-demo i 3D**: en runde gjennom tolv værtyper, 10 s
hver, med «forrige/neste» og navnet synlig. Den finnes fordi flere av uttrykkene
er ren BEVEGELSE og ikke kan vurderes på et stillbilde — vinden er bare
driftretning og fart, lyn-blinket varer 0,16 s, og nedbøren faller. Det var
nettopp den blindsonen som gjorde at sky-arbeidet gikk i ring: uttrykk ble endret
og vurdert på skjermbilder, én runde av gangen.

Rekkefølgen i runden er en del av verktøyet og ikke tilfeldig: skydekket trappes
opp først, så nedbør i økende styrke, torden rett etter regnet den skal skille seg
fra, og til slutt vind som TO steg med samme skydekke og ulik fart — den eneste
måten å se en egenskap som ikke har noe eget utseende. `vaerDemo.test.js`
håndhever den rekkefølgen, så den ikke blir «ryddet» alfabetisk i god tro.

---

## 2026-08-23 — v5.21.4: Skyene rullet tilbake — jeg gjorde dem verre

Eieren meldte at skyene i 3D så «kuttet» ut. Over tre runder ble det gjort åtte
endringer i `skyDome.js` for å rette det: klipping av blob-radier, et høyere
lerret, en alfa-vignett, `fog: false`, materiale pr sprite, `alphaTest`, større
skyfelt og nær-kamera-demping. Resultatet var harde hvite firkanter — klart
dårligere enn utgangspunktet. Alt er nå rullet tilbake til koden fra før
v5.20.2. Den eneste tilføyelsen som står er `setVaer`, som værmodus trenger, og
den rører bare synlighet, farge, opasitet og driftretning. Verifisert at
`setVaer(null)` gir bit-identisk utgangstilstand: tre delte materialer,
opasitet 0,85, `alphaTest: 0`, `fog: true`, tekstur 256 × 128.

Grunnen til at det gikk galt er verdt å skrive ned, for den handler ikke om
skyer. Artefakten finnes bare på eierens telefon — aldri på skrivebordet, aldri i
CI. Hver runde var derfor et gjett, sendt ut for felttesting, og gjettene
akkumulerte. Den ene runden som faktisk MÅLTE noe (tekstur-alfa langs alle
kanter, rendret enkeltsprite på fire avstander, mipmap av/på) avkreftet tre
hypoteser og fant en ekte regresjon jeg selv hadde innført — et lerret på 256 ×
160, som ikke er en toerpotens — men fikset ikke det brukeren så.

Regelen står nå i CLAUDE.md: en visuell feil som bare finnes på én enhet kan
ikke rettes ved å endre kode og spørre om det ble bedre. Skal dette tas opp
igjen, må det starte med en måling fra enheten — en WebGL-capability-dump
(webgl1 vs webgl2, NPOT-håndtering, maks tekstur) og gjerne en `readPixels`-prøve
— ikke med en ny kodeendring.

`skyDome.test.js` er fjernet sammen med koden den vernet.

---

## 2026-08-23 — v5.21.3: Skyene ble kuttet av en toerpotens jeg selv brøt

v5.20.2 skulle rette at skyene ble klippet, og rettet en ekte feil — men innførte
en ny. For å gi blobbene luft ble lerretet 256 × **160**, og 160 er ikke en
toerpotens. På WebGL1, som en del Android-webviews fortsatt gir, resampler
three.js NPOT-teksturer til toerpotens og genererer mipmaps på resultatet, og det
kan smøre alfa ut til kanten. Da males HELE sprite-quaden som et blekt rektangel
i himmelen — nøyaktig det eieren fortsatte å se etter «fiksen». Feilen var ikke
synlig på skrivebordet, bare på telefon.

Lerretet er tilbake på 256 × 128, som også gir skyene de opprinnelige
proporsjonene igjen (sprite-høyden avledes av tekstur-sideforholdet). Luften
blobbene trengte kommer fra radius-klippingen i `skyDotter`, ikke fra et høyere
lerret — den delen av v5.20.2 var riktig og står.

I tillegg har skymaterialene fått `alphaTest: 0.02`. Det er ikke finpuss:
symptomet var en LAV, JEVN alfa over hele quaden, og den kan komme av
mip-gjennomsnitt, driver-resampling eller presisjon. Vi kan ikke vite hvilken på
en telefon vi ikke har, så terskelen treffer symptomklassen framfor årsaken. Målt
er største pikselsprang i skykanten 7 av 255 — formen er uendret.

Diagnosen ble gjort med målinger og ikke med øyet, etter at forrige runde bommet:
tekstur-alfa langs alle fire kanter (0 på alle tre seeds), en rendret enkeltsprite
på svart bakgrunn på fire avstander (myk profil, 0 ved quad-kanten), og en
mipmap-av-sammenligning som avkreftet mipmapping. Rektangelet i skjermbildet ble
målt opp: skarp vannrett toppkant, nær-loddrett venstrekant, og med
sprite-sideforholdet 0,4375 stemte høyden 285 px mot en full quad-bredde på
651 px — altså en quad som gikk utenfor skjermkanten.

Testen som ville fanget det står nå der: begge tekstur-målene må være
toerpotenser, og lerretet må være romslig nok til at dottene ikke klippes ned til
ingenting (så kravet ikke «løses» med 256 × 16). Testene leser målene fra koden i
stedet for å gjenta dem — den hardkodede 160-en i forrige test ville ellers målt
et lerret som ikke fantes.

---

## 2026-08-23 — v5.21.2: Vind pr time i 3D, og vinden er til å finne i infopanelet

Værsymbolraden i 3D viser nå vindstyrke for hver time, ved siden av temperaturen
framfor under den. Plasseringen er et bevisst valg: raden ligger over kartet, og
en femte stablet linje ville kostet kartflate, mens bredde bare koster litt
rulling. Høyden er derfor uendret. Vinden vises ALLTID når MET har tallet — i
motsetning til nedbøren, som bare vises når det finnes nedbør. Forskjellen er
tilsiktet: 0 mm er ingen informasjon, mens 0–2 m/s er nettopp det turgåeren vil
vite. En liten pil peker dit vinden går; mangler MET retningen, står det et
nøytralt ≈ i stedet, for «8° 8» er to tall uten enhet og leses ikke som vind.

I infopanelet har vinden fått sin EGEN merkede rad. Den fantes fra v5.21.0, men
sto dempet bak et «·» på vær-linja sammen med nedbøren, og var i praksis ikke til
å finne — eieren testet i felt og så den ikke. Nå har den samme form som
Vannstand og Vanntemp: merkelapp til venstre, verdi i full styrke, og
himmelretningen vinden kommer fra skrevet ut («fra sør-sørvest») siden «210°»
ikke er noe man leser i farten. Gradene ligger i title for den som vil ha tallet.

Under panseret er én dublett fjernet før den fikk gjøre skade: snuingen fra METs
`wind_from_direction` (retningen vinden KOMMER FRA) til retningen den GÅR fantes
nå i to kopier — skydriften i `vaerHimmel.vindVektor` og den nye vindpila. Hadde
noen rettet fortegnet i den ene, ville pila pekt motsatt vei av skyene på samme
skjerm. Regnestykket bor nå i `vindMotGrader` i `vaerFetcher.js`, brukt av begge
og enhetstestet — inkludert grader utenfor 0–360, som ville rotert pila feil vei
uten å se galt ut i koden.

Himmelretningene er `bearingToCompass` fra `mapContext.js`, den samme tabellen
«Fra deg»-raden bruker, så nord-nordøst heter det samme begge steder.

Røyktesten fikk samtidig et TAK PR SJEKK (120 s, overstyrbart pr sjekk). Det er
en FORHOLDSREGEL, ikke en feilretting: ingen sjekk har hengt. Grunnen til at den
kom med nå er at `page.evaluate` er det eneste Playwright-kallet i skriptet uten
egen timeout — alle `waitForFunction` og `click` har tak — så er sidas hovedtråd
travel kan et evaluate-kall i prinsippet vente i det uendelige. En sjekk som
HENGER er verre enn en som feiler: den blokkerer jobben til GitHub dreper den
etter timer, uten logg og uten skjermbilde, og dermed hver framtidige PR. Taket
gjør et slikt tilfelle til en lesbar feil med skjermbildet ved siden av.

Fire-stegs-sjekken venter dessuten på at 3D-motorens tekstur-skjerping til 4096²
er ferdig («Skjerper kartbildet …») før den trykker. Passet starter rett ETTER at
knappene dukker opp, og rasteriseringen blokkerer hovedtråden i sekunder på en
runner uten GPU — å klikke inn i det vinduet er nettopp der et evaluate-kall
kunne blitt stående.

---

## 2026-08-23 — v5.21.1: Vær i 3D — fire steg på sol/måne, og en himmel som følger varselet

Sol/måne-knappen i 3D bærer nå fire tilstander i stedet for to: dag, dag med vær,
natt, natt med vær. Brukeren velger selv om værsymbolene vises, og i hvilken
lysmodus. En egen vær-knapp ble vurdert og forkastet — topprada har allerede
fem-seks knapper, og kommentaren over den forteller hva som skjedde sist den
vokste. Vær-valget huskes mellom øktene; dag/natt gjør det bevisst ikke, for den
skal fortsette å følge lys/mørk-valget i kartet slik den alltid har gjort.

Med været på legger en tynn symbolrad seg på en egen linje under Info-raden:
timene framover for arkets senterpunkt, med klokketime, symbol, temperatur og
nedbør når det er noen. Symbolvarianten følger MODUSEN og ikke klokka — står du i
natthimmelen, viser symbolet natt. Raden skjules under en gående tur, der HUD-en
og kryssvalgene alt konkurrerer om plassen. Varselet hentes én gang per ark, for
senterpunktet; kameraet kan fly hvor det vil uten å koste MET et kall.

Himmelen speiler nå været. Klarvær gir nesten skyfri himmel, overskyet fyller
den, og nedbør gjør skyene mørkere og tyngre. Skyene drifter dit vinden faktisk
går — METs `wind_from_direction` er retningen vinden KOMMER fra, så vektoren
snus, og farten er dempet så et 5 km ark ikke ser ut som en tidsforkortet film.
Nedbør er ett `Points`-objekt med regn, sludd eller snø, og torden er et kort løft
av dis- og bakgrunnsfargen — ingen geometri, ingen lyskilde, rate-begrenset og av
ved `prefers-reduced-motion`. Et lyn som blinker uventet over et kart man leser er
en tilgjengelighetssak, ikke en effekt.

Alt dette er bygget som en OPSJON på skyene som alt fantes, ikke som et lag ved
siden av: `setVaer(null)` gir nøyaktig standard-himmelen igjen. Oversettelsen fra
symbolkode til «skypreg» bor i en ren, enhetstestet fil, fordi det er der feilen
kan bo — rekkefølgen på reglene bestemmer hvilken værfamilie som vinner, og en
regel plassert for høyt stjeler treff fra dem under. Takene på opasitet og
partikkeltall er lesbarhet og ikke smak: 3D-visningen har ingen adaptiv
kvalitets-nedtrapping å skru ned senere.

To ting fanget av tester underveis: `driftFart` blandet UKJENT vind med STILLE
vind, så en måling på 0 m/s ga samme drift som ingen måling i det hele tatt. Og
`setVaerModus(_natt, vaer)` hadde en parameter som skygget for `vaer`-ref-en —
rettet før den fikk bite.

Røyktesten har fått en sjekk som trykker knappen gjennom hele runden og krever at
syklusen er LUKKET: fire trykk skal føre tilbake dit den startet, uansett hvilket
steg den sto på. Den leser tilstanden framfor å anta den, siden valget huskes.
Mangler kartet høydedata, melder sjekken fra og hopper — som 3D-sjekken over den.

---

## 2026-08-23 — v5.21.0: Ekte værvarsel fra MET Norway

Langtrykk på kartet gir nå en værlinje i infopanelet: symbol, temperatur, vind og
nedbør for punktet, fra METs Locationforecast 2.0. Symbolene er METs egne
(github.com/metno/weathericons — de samme man ser på yr.no), og de norske
værnavnene er hentet fra METs `legend.csv` framfor oversatt av oss.

Kallet går gjennom `lende-proxy`, ikke rett fra nettleseren, og det er ikke
valgfritt: MET krever en identifiserende `User-Agent` med kontaktinfo og svarer
403 Forbidden på en generisk eller manglende en — mens `User-Agent` er en forbudt
header i nettleserens `fetch()`. Et direkte klient-kall kan altså ikke oppfylle
METs vilkår, uansett hvor snill CORS-en deres er. Workeren setter headeren, runder
`lat`/`lon` til METs maks 4 desimaler (flere ødelegger cachingen deres og vil
etter hvert gi 400), og cacher i inntil 30 minutter — kortere hvis METs eget
`Expires` sier så. Bonusen er at tjue turgåere på samme fjell koster MET ett kall.

Klienten slår opp i IndexedDB-cachen først, på et ~100 m rutenett. Det ER
debouncingen: to trykk i samme skogholt innen halvtimen går ikke på nettet, og
oppslaget henger på langtrykk-punktet framfor på panorering. `ttlForKey` fikk en
`vaer1:`-gren FØRST i rekka — uten den ville nøkkelen falt gjennom til
kulturminne-TTL-en på 30 dager, og en 30 dager gammel værmelding er ikke en
degradering, den er en løgn.

Værvarsel pakkes med vilje IKKE i offline-fila. Importen setter fersk TTL på hver
rad, så en prognose fra en fil som har ligget en måned i en chat ville blitt vist
som om den gjaldt nå. Begrunnelsen står i CLAUDE.md, slik at det ikke blir
«rettet» som en glemt kilde.

To ting fanget av tester underveis: en manglende `lat` ville blitt et varsel for
0,0000 / 0,0000 (Guineabukta), fordi `Number(null)` er 0 og ikke NaN — proxyen
svarer nå 400. Og METs egne symbolkoder har understrek inni seg
(`lightssleetshowersandthunder_day`, med METs kjente skrivefeil de har valgt å
beholde), så variant-splittingen måtte skje på siste understrek og bare på en
kjent variant — en naiv split ville gitt feil ikon for hele torden-familien.

Ikonsettet (83 filer, 26 kB gzip) lastes som et eget chunk først når et symbol
skal tegnes. Statisk import kostet 36 kB gzip for alle brukere, også de som aldri
åpner vær. Ikonene tegnes som `<img src="data:…">` og ikke inline, fordi METs
SVG-er definerer `<symbol id="sun">` og gradienter med globale id-er — to
inlinede ikoner i samme dokument ville overskrevet hverandres farger.

---

## 2026-08-23 — v5.20.2: Skyene i 3D var klippet av lerret-kanten

Skyene i 3D-visningen hadde knivrette kanter og leste som lyse firkanter i
himmelen framfor myke dotter. Årsaken var en tegnefeil som hadde ligget siden
skyene ble laget: `cloudTexture()` tegnet radielle gradienter på et 256 × 128
lerret, men målte radiene mot BREDDEN. En dott på y = 47 med r = 54 stakk 7 px
over toppkanten, `fillRect` klippet den, og det sto igjen ~10 % alfa i øverste
teksel-rad — som med ClampToEdge-wrapping males som en rett strek tvers over
billboardet. Bare seed 29 brakk ordentlig, og siden materialene fordeles med
`i % 3` var det bare hver tredje sky, noe som gjorde feilen lett å tvile på.
Radien klippes nå mot avstanden til nærmeste kant (en dott nær kanten blir
mindre, aldri kuttet), lerretet er 256 × 160, og en elliptisk alfa-maske tvinger
alfa til null langs alle fire kanter uansett hva fordelingen gir seinere.
Plasseringen er skilt ut som `skyDotter()` og enhetstestet mot alle tre seedene,
så feilklassen ikke kan komme tilbake med en ny seed.

To feil ved siden av, funnet i samme kode: skymaterialene manglet `fog: false`,
så de fjerneste skyene ble malt i flat tåkefarge mot en blå senit — nøyaktig
samme feil som ble rettet for stjernene og månen i v5.3.0, der begrunnelsen
allerede sto i koden rett over. Og skyfeltet var bare 1,6 × arket, mens
åpningsposen legger kameraet omtrent 0,63 × span meter opp: sett ovenfra-og-ned
sluttet spredningen av billboards midt i bildet. Feltet er nå 2,6 × og
resirkulerer langs begge akser, klart for vinddrevet drift. Skyene demper seg
dessuten selv når de kommer nærmere kameraet enn sin egen bredde — ett billboard
på nært hold la et hvitt vask over kartet.

---

## 2026-08-21 — v5.20.1: Importen sier hva som er galt når fila ligger i skyen

Første ekte forsøk på å importere en delt kartfil på mobil ga «A requested file
or directory could not be found at the time an operation was processed» — i lys
grå 11 px nederst på skjermen. Det er nettleserens egen engelske DOMException, og
den forteller verken hva som skjedde eller hva man skal gjøre. Årsaken er at
Filer-appen VISER en fil som bare ligger i iCloud eller Google Drive og ikke er
lastet ned; nettleseren finner ingenting å lese. Nå oversettes de tre lesefeilene
(`NotFoundError`, `NotReadableError`, `SecurityError`) til norsk med handlingen
brukeren mangler — «Ligger den i iCloud eller Google Drive? Åpne Filer-appen,
last den ned til telefonen, og prøv igjen» — og meldingen står i en egen rød boks
i samme skriftstørrelse som resten av lista i stedet for å hviske i kanten.
Importer-knappen ble litt større samtidig. Originalfeilen følger med som `cause`
og logges, så feilsøking ikke mister noe.

---

## 2026-08-21 — v5.20.0: Del hele kartet som fil — turkameraten trenger ikke dekning

Dagens «Del kart» sender en LENKE med oppskriften — utsnitt, ekvidistanse og
aspekt — og mottakeren bygger sin egen kopi mot Kartverket, Overpass, N50, NVE og
Sjøkart. Det er lett og riktig når begge har nett, og helt ubrukelig på fjellet.
Denne versjonen legger til den andre veien: «Del som offline-fil» i Eksport-fanen
pakker HELE kartet — den ferdige SVG-en, høyderutenettet, kulturminnene
(både brukerminner og de fredede, med detaljtekst) og NVE-vannmålestasjonene med
siste måling — i én gzip-et `.lendekart`-fil. Fila går rett i delings-arket, så
den kan sendes med AirDrop, Nearby Share, Bluetooth eller minnepinne uten et
eneste nettverkskall. Mottakeren trykker «Importer delt kart (fil)» på forsiden
og får kartet i sin egen liste; er appen installert, kan de også bare trykke på
fila i Filer-appen. Trikset som gjør datalagene levende offline er at de allerede
sjekker cachen før nettet — så eksporten fyller cachen mens den har dekning, tar
radene med i fila, og importen skriver dem inn igjen med fersk levetid. Lag-koden
merker ingenting. Nye NVE-stasjoner fikk samtidig varig cache (de lå bare i
sesjonsminnet), og bbox-utregningen som lagene og pakkingen MÅ være enige om ble
samlet ett sted (`utm.js`) i stedet for tre kopier. Det som fortsatt krever nett,
og som står i knappeteksten: punkt-oppslag ved langtrykk (verneområde, naturtype,
arter, Wikipedia), ruteplanlegging og stedssøk.

---

## 2026-08-15 — v5.19.11: Auto-kart sier ikke lenger at arket er firkantet når det ikke er det

Kvitteringen etter en automatisk utfylling leste hvilken FASE løkka var i, ikke
hva arket faktisk ble. Var siste flis av typen «firkant», sto det «Arket er
firkantet» — også når utfyllingen ga seg halvveis. Og den gir seg på fire andre
måter enn å bli ferdig: økt-taket på tolv fliser, tapt nett, en flis som feilet,
og runde-vakta. Verre var dødpunktet etterpå: banneret «Gjør arket firkantet»
var skjult så lenge auto-bryteren sto på, så brukeren satt igjen med et synlig
ujevnt ark, ingen knapp, og en melding som påsto det motsatte. Nå teller
`fyllUtArket` opp på nytt når den er ferdig og lagrer hva som står igjen
(`firkantRest`) og hvorfor (`firkantStopp`). Chipen bruker tallet — «Auto-pause
· 3 fliser igjen», «Uten nett · 1 flis igjen» — og banneret kommer tilbake så
snart automatikken har gitt opp, så veien videre finnes igjen.

---

## 2026-08-15 — v5.19.10: Måleverktøyet viser høydeforskjell mellom første og siste punkt

Måler du en strekning på kartet, sa den grønne readout-en bare hvor langt det
var — ikke om det gikk oppover. Stifinneren og ruteplanleggeren har vist høyde
A, høyde B og differansen lenge; måling manglet det samme tallet. Nå sampler
`useMaaling` DEM-en i første og siste målepunkt (samme svg-meter-rom som
punktene ligger i, samme `sampleElevation` som `stiElevationDiffM` bruker) og
legger `eleA`, `eleB` og `eleDiffM` inn i `measureStats`. Både den grønne boksen
på kartet og Måling-fanen i drawer-en viser dem. Målingen starter en lazy
DEM-henting, så tallene dukker opp når høydedataene lander; mangler kartet DEM
— eller faller et punkt på noData — står linja bare ikke der, og distanse og
areal er uendret.

---

## 2026-08-15 — v5.19.9: Lende-chatten ser hele arket, ikke bare den nærmeste ringen

Chatten svarte «Jeg fant ingen treff på Stormoen i dette kartet» på et navn
søkefeltet listet i samme øyeblikk, med merkelappen «i naboflis». Verktøyet
`sok_i_kartet` SØKTE i nabofliser — det var rekkevidden som var feil.
`mosaikkFliser` tok bare kart hvis WGS84-bbox lå innen 0,3 km av den aktive
flisa, altså bare fliser som RØRER den. Kartflaten (`useGhostTiles`) modellerer
tre flis-bredder ut, opptil tolv fliser. Med 8 km-fliser ligger flis nummer to
nordover 8,00 km unna — 27 ganger utenfor terskelen — så den sto på skjermen,
var søkbar i søkefeltet, og fantes ikke for chatten. Nå bruker chatten samme
regel som mosaikken: `utmBbox` fra den lette meta-projeksjonen,
gitter-kompatibilitet, radius tre fliser, tak på tolv naboer, sortert nærmest
først så et tidlig treff slipper å laste resten. Det siler samtidig bort
overlappende kart som IKKE er fliser i samme ark — den gamle bbox-regelen slapp
dem inn og lot dem spise plasser i nabolista. Eldre lagrede kart uten `utmBbox`
faller tilbake til den gamle regelen og legges bakerst. Endringen gjelder alle
fire verktøyene som spør om mosaikken: `sok_i_kartet`, `merk_i_kartet`,
`foreslaa_tur` og `foreslaa_rundtur`.

---

## 2026-08-15 — v5.19.8: Kartbildet i 3D sluttet å skli, og ruta gikk i land igjen

En rute fra Stormoen til Skimten så ut til å gå midt ute i Drammenselva i
3D-visningen, mens den lå pent på sørsiden i 2D. Ruta var aldri feil — det var
kartbildet under den som hadde flyttet seg. 3D rasteriserer arket flis for flis
inn i et kvadratisk lerret, og pikselboksen hver flis får er regnet av
UTSNITTETS sider (`t.w / widthM`, `t.h / heightM`). De to nevnerne er ulike så
snart arket ikke er kvadratisk, så boksen har en annen fasong enn flisas
viewBox. Den levende kart-SVG-en arver `preserveAspectRatio="xMidYMid meet"` fra
useMapLoadPipeline, og «meet» svarer da med å krympe kartografien uniformt og
midtstille den: bildet ble riktig midt i flisa og skled mot kantene. Målt i
Chromium bommet en 8×8 km flis i et 12×9 km ark med 870 meter ytterst — mer enn
nok til å legge en elv der ruta gikk. Naboflisene satte `preserveAspectRatio="none"`
selv (useGhostTiles), så det var bare den aktive flisa som fikk letterbox, og et
vanlig kvadratisk enkeltkart gikk fritt — derfor lå feilen upåaktet til
mosaikk-utsnittene ble vanlige. `withPixelSize` tvinger nå `none`, slik flisa
fyller ruta si eksakt.

---

## 2026-08-15 — v5.19.7: Auto-kart er av som standard, og kan fylle ut arket selv

Tre ting som henger sammen.

**Automatikken er AV som standard.** Den var på, med den begrunnelsen at en
opt-in aldri ville blitt slått på nok til at vi fikk måletall å justere tersklene
etter. Det holdt ikke i praksis: den kontinuerlige panoreringen må kunne kjøres
side om side med den manuelle for å kunne sammenlignes, og en automatikk som er
på fra første kartåpning gjør nettopp det umulig. Standardene bor nå i
`src/lib/autoNaboValg.js` med tester på seg — det er den slags avgjørelse ingen
tester manuelt, fordi den bare gjelder enheter som aldri har rørt bryteren.

**«Gjør arket firkantet» er blitt en innstilling.** Automatikken henter én flis
om gangen, så arket får ujevn kant — og 3D og pan-grensa bruker likevel arkets
omsluttende rektangel. Er valget på, fyller automatikken ut hjørnene i halen av
flisa du panorerte fram: like stille, samme gater, samme økt-tak. Den ligger
under auto-bryteren i drawer-en og er bare synlig når automatikken er på, for
uten den er det kanthåndtakene som utvider, og de holder arket rektangulært selv.

Dette er ikke automatikken v1.0.28 døde av. Den leste FORM og bygde utsnitt ingen
hadde bedt om. Denne henger på en bryter brukeren har slått på, og fyrer bare
etter en flis brukeren nettopp panorerte fram. Celle-lista er den samme som
knappen bygger (`firkantCeller`), så banneret og automatikken kan ikke bli uenige
om hva «firkantet» betyr.

**Banneret på kartet gjelder nå bare når automatikken er av.** Med automatikk på
bygges det fliser hele tida, og et banner etter hver av dem ville vært mas om noe
brukeren allerede har tatt stilling til i innstillingene. Med automatikk av er
banneret fortsatt den eneste veien til en firkant, og står som før.

Chipen sier hva som faktisk skjer: «Fyller ut arket … (3 igjen)» i stedet for
retnings-teksten, ikonet blinker med hele arket i stedet for én side, og
kvitteringen kommer først når alt er ferdig — «Arket er firkantet».

---

## 2026-08-15 — v5.19.6: Bygge-ikonet peker faktisk dit flisa hentes

v5.19.4 skrev retnings-logikken for bygge-chipens ikon, men koblet den aldri
til. `lib/flisIkon.js` og `ikonRuter`-computeden fantes og var testet, mens SVG-en
i `MapModeChips.vue` sto igjen med fire hardkodede `<rect>` — de to til høyre
animerte uansett om chipen sa «Vest i lende» eller «Nord i lende». Ingen test så
det, fordi den eneste testen var på funksjonen ingen kalte. Nå tegnes rutene med
`v-for` over `ikonRuter`, så «Vest i lende» blinker de to til venstre, «Nord i
lende» de to øverste, og en diagonal bare hjørnet sitt.

Ikonet har heller ikke lenger fast 2×2. Rutenettet er arket slik det blir ETTER
utvidelsen, klemt til maks to ganger to: er arket én flis bredt og vokser
nordover, står ikonet som en stående stripe med to ruter oppå hverandre, og bare
den øverste blinker. Det er ikke kosmetikk — arket har ingen side-om-side å vokse
i der, så to ruter ved siden av hverandre ville vist en utvidelse som ikke
skjer. Samme regel motsatt vei for et ark som er én flis høyt. `useMapExtend`
eksponerer arkets størrelse som den nye computeden `arkRutenett`, som gjenbruker
nøyaktig samme cols/rows-regning som `extendMapGeometry` — én kilde til hva
arket er, ikke to som kan gli fra hverandre.

---

## 2026-08-15 — v5.19.5: ELI5-svarstil for korte, enkle rapporter

Ny output-style i `.claude/output-styles/ELI5.md`, satt som `outputStyle` i
både `.claude/settings.json` og `.claude/settings.local.json`. Stilen ber Claude
rapportere på norsk klarspråk: vanlige ord, aktiv form, én tanke per setning, og
tre faste punkter — hva ble gjort, virket det, hva gjør jeg nå. Må jeg velge noe,
får jeg maks to valg med en anbefaling. Filstier og kommandoer skal stå eksakt.

Forbildet er ASD-STE100 Simplified Technical English, men det finnes ikke noe
norsk motstykke: ASD-STE100 er et kontrollert språk med en fast godkjent ordliste
på rundt 900 ord, mens norsk klarspråk (Språkrådet, NS-ISO 24495-1) er
prinsipper uten ordliste. Reglene lot seg overføre, ordlista ikke.

Stilfila ligger i repoet med vilje. Lå den bare i `~/.claude/output-styles/`,
forsvant den med sandkassen mens `outputStyle`-nøkkelen ble stående igjen som en
peker til ingenting — og stilen falt stille tilbake til standard. Ingen app-kode
er rørt; `CACHE_VERSION` bumpes bare for å holde de fire versjonsfilene i takt.

---

## 2026-08-15 — v5.19.4: Søket dekker hele arket, zoom-ut mister ikke utsnittet

Fire ting fra testrunden på det kontinuerlige kartet.

**Søket fant bare treff i aktiv flis.** Nå dekker det hele arket. Det var mindre
rett fram enn det høres ut: naboflisene får `data-name` strippet med vilje, og
det er nettopp det attributtet søkeindeksen bygger på — så det holdt ikke å
fjerne et filter, dataene fantes ikke i DOM-en. Navnene leses derfor rett ut av
tekst-labelene i mosaikken, med det delte flis-offsetet, i en EGEN nabo-indeks.
At den er egen er poenget: aktiv-flis-indeksen driver også navne-declutteren, og
den håndterer ikke nestede `<svg>`. Treff dedupliseres på navn og posisjon, så et
sted i overlapp-sonen vises én gang.

**Zoom-ut mistet utsnittet.** Zoomet du ut for oversikt, gled skjermsenteret inn
på en naboflis og auto-promoteringen fyrte etter 1,5 s. Den navigerer, MapView
remonteres, hele mosaikken tegnes på nytt — det synlige flimmeret — og i vinduet
før mosaikken er tegnet tror zoom-gulvet at arket er én flis og klamper deg opp
til 0,5. Promotering gir uansett bare mening når du ser på ÉN flis; nå er den av
når mer enn én får plass på skjermen.

**«Gjør arket firkantet».** Automatikken bygger én flis om gangen — naboen du
faktisk beveget deg mot — så et ark som har vokst av seg selv blir organisk
formet. Det er med vilje, men det koster: 3D og pan-grensa bruker arkets
omsluttende rektangel, så hjørnene står tomme og du kan panorere ut i krem inne i
ditt eget ark. Nå tilbys utfyllingen som et valg med kostnaden skrevet på
knappen. Regelen bak den er den samme bounding-box-varianten som ble forkastet i
v1.0.28 — forskjellen som gjør den trygg er ikke geometrien, men at den henger på
et trykk i stedet for å dukke opp av seg selv.

**Bygge-ikonet peker dit flisa hentes.** De fire små rutene er arket i miniatyr,
og de som animerer er de som ligger i retningen: nord blinker begge de øverste,
nordøst bare hjørnet øverst til høyre. Når flisa er klar står alle fire fylt.
Nord er opp uansett kart-rotasjon — chipen ligger utenfor kartflaten og sier
«Nord i lende» ved siden av seg.

---

## 2026-08-15 — v5.19.3: Bygge-chipen la seg oppå snarvei-raden

Chipen som melder «Henter Nord i lende …» delte topp-slot med snarvei-raden
(Stifinner / Runde / Måling / 3D / Info) og la seg rett oppå den. Raden skjuler
seg allerede for de andre chipene i den sloten — kommentaren i malen sier
eksplisitt at de ville kollidert — men bakgrunnsflis-chipen kom til i v5.19.0
uten å bli lagt til i lista. Nå er den det, og notatet er utvidet så neste chip
i samme slot ikke gjentar feilen.

---

## 2026-08-15 — v5.19.2: Kartet fyller skjermen, og pilene viker for automatikken

Et kart åpnet med hele arket synlig og kremgul letterbox rundt. Det ser ut som et
ark som svever i tomrom, og kanten leser som verdens ende — særlig rart nå som
kartet fyller seg selv mens du panorerer. Nå åpner det på DEKNING: arket dekker
hele viewporten, med omtrent 10 % liggende utenfor skjermkanten. Da avslører et
drag mer KART, ikke mer krem, og kartet føles kontinuerlig fra første frame.

Prisen er ærlig nok at oversikten ikke lenger er det første du møter. Den er ett
trykk unna — «Sentrer» og zoom-ut-gulvet er begge bygget for å vise hele arket —
men den er ikke gratis lenger.

**Kanthåndtakene skjules når automatisk påfyll er på.** Åtte permanente knapper
for noe appen gjør selv er dobbelt opp, og de konkurrerer med kartet om
oppmerksomheten. Slår du auto av, er de der igjen.

Og siden arkkanten normalt ligger utenfor skjermen etter dekningsendringen,
**klamper håndtakene seg til viewporten** når kanten er utenfor synsfeltet. Uten
det ville den ene mekanismen du har med auto AV vært usynlig til du zoomet ut.
Knappene er DOM-knapper i skjermrommet, så de kan trygt gli inn til kanten:
retningen er den samme, og «Nord i lende» betyr det samme enten den står på
arkkanten eller øverst på skjermen.

---

## 2026-08-15 — v5.19.1: Auto-kartet kunne aldri fyre, og «Mine kart» løy om størrelsen

Testrunden på v5.19.0 fant at automatisk flis-påfyll ikke virket i det hele
tatt — ingen chip, ingenting bygd, uansett zoom-nivå. Årsaken er en ren
tidsfeil: intensjons-sporingen kjører fra transform-watchen, altså MENS fingeren
er nede. Intensjonen ble moden midt i draget, `moden`-hendelsen fyrte den ene
gangen den kan fyre, gaten avviste den på `isGesturing` — og når fingeren slapp,
endret ikke transformen seg mer, så sporingen kjørte aldri igjen. Hendelsen var
brukt opp. Det som sto igjen var «veggen»: pan-grensa slipper deg en halv flis
utenfor arket, men der bygges det ingenting.

Nå handler vi på TILSTANDEN «moden» i stedet for hendelsen, og dvele-timeren
restartes ved hver prøve. Da fyrer den først når prøvene stopper — som er
nøyaktig det «brukeren har stoppet» betyr — og gatene kjøres ved fyring, når
`isGesturing` er falsk.

To terskler var dessuten satt for stramt til å nås i praksis. `MAKS_PAUSE_MS`
var 2,5 s, men folk panorerer ved å dra, stoppe og se, og dra videre — så
akkumulatoren ble nullstilt mellom hvert drag og reisen mot arkkanten ble aldri
moden. Den er nå 8 s. `MODEN_DRAG_FRAC` var 0,40, altså 3,2 km på et 8 km-ark,
og det er mye når man er zoomet inn og en full skjermbredde med drag flytter
senteret noen hundre meter. Den er nå 0,25. Det er ikke terskelen som beskytter
mot utilsiktet bygging uansett — det gjør kravet om at du faktisk er på vei UT
av arket.

**«Mine kart» viste flisas størrelse, ikke arkets.** Et kart utvidet til 3×3 sto
oppført som 8 × 8 km, fordi naboflisene er egne poster som skjules i lista. Det
var ikke et galt tall, det svarte bare på et annet spørsmål enn det brukeren
stiller. Siden hver post nå bærer sin egen `utmBbox`, kan unionen regnes ut fra
lista alene, uten å parse en eneste SVG: raden viser «24,0 × 24,0 km · 9 fliser».
Eldre kart uten feltet viser som før.

---

## 2026-08-14 — v5.19.0: Kartet fyller seg selv, og relieffet er kvitteringen

Drar du kartet jevnt i én retning og blir stående, hentes utsnittet du er på vei
mot i bakgrunnen. Kartflaten står bom stille mens det skjer — ingen
full-skjerm-loader, ingen navigasjon, ingen zoom som rykker. Flisa glir inn i
periferien når den er klar, og **relieffet toner inn til slutt**: er det der, er
flisa 100 % ferdig. En chip over kartet sier «Henter Nord i lende …» og så «Nord
i lende er klar», så kvitteringen finnes også for deg som har relieff av.

Funksjonen fantes en gang og ble fjernet, så det er verdt å si hva som er
annerledes. Den gamle SLETTET forrige flis, så det var umulig å scrolle tilbake;
mosaikk-cachen løste det for lenge siden, og her navigerer vi aldri og sletter
aldri. Og den gamle utledet «her mangler det noe» av GEOMETRIEN, som ikke kan
skille en avbrutt bygging fra en diagonal panorering — den bygde utsnitt ingen
hadde bedt om. Triggeren nå leser INTENSJON: retning, akkumulert drag på 40 % av
en flisbredde i samme oktant, og 1,2 sekunder ro. Snur du underveis, avbrytes
byggingen — og bokføringen strykes, for et retningsskifte er et valg, ikke et
hull. Maks tolv fliser per økt, og telleren nullstilles når du trykker et
kanthåndtak selv.

**Relieffet er flyttet ut av tegneløkka, og det er den største ytelsesendringen
her.** Det ble laget synkront, per naboflis, inne i mosaikk-renderingen —
interleavet med opptil tolv DOMParser-kall på 1–5 MB hver. Nå kjører det som et
eget pass i ledige stunder. Samtidig bruker **nabofliser alltid vektor-relieff**,
uansett hva du har valgt for den aktive flisa: raster er den eneste kostnaden som
skalerer med flisetallet, og den gamle data-URL-cachen ble aldri tømt. Vektor er
uansett standardvalget i appen.

**Fliser utenfor utsnittet demonteres nå fra kart-SVG-en** og festes igjen når du
nærmer deg, med hysterese så ingenting flakser på grensa. Gevinsten er ikke
rasterminne — den er at to fullt-dokument-traverseringer skalerer med antall
fliser i DOM: gest-perf-modusen setter en inline strekstil på hver eneste path
ved både start og slutt av hver gest, og lag-synligheten gjør 35 spørringer over
hele dokumentet. Fra tolv festede fliser til typisk fire–ni er det et merkbart
kutt akkurat der fingeren treffer. Fire konsumenter leser geometri rett ut av den
levende SVG-en — 3D-teksturen, brukerminnene i 3D, Stifinneren og
navne-lesingen — og de går nå gjennom en brakett som fester alt midlertidig.

På kjøpet er en latent feil rettet: mosaikk-modellen var kappet til tolv fliser
selv når du hadde bygd seksten, så kanthåndtakene satt for langt inn, du fikk
ikke zoomet ut til hele arket, og pan-grensa stoppet deg for tidlig. Modellen
speiler nå det som faktisk er bygd. Den lagrede kart-posten bærer også sin egen
`utmBbox`, så mosaikken kan plassere en flis uten å parse den først.

**Og en stille produksjonsfeil er borte:** MCP-Workeren bygde HVERT kart uten
N50-stinettet — 179 706 km sti og traktorveg — fordi katalogen leses fra disk og
workerd ikke har noe filsystem. Uthentingen feiler aldri hardt, så ingenting sa
fra. Workeren henter nå de samme flisene over HTTPS fra GitHub Pages, utfallet
returneres fra `bygg_kart`, og deploy-røyktesten feiler hvis stinettet mangler.
Den sjekket før at `totalStiKm` fantes — men det tallet får bidrag fra OSM også,
så det sto grønt hele veien.

`docs/R2_FLISLAGER.md` er en utredning av om Cloudflare og R2 burde bygge fliser
for oss. Konklusjonen er nei, ikke nå: gevinsten er radio-bytes og ikke CPU,
klienten er nettopp gjort vesentlig billigere, og to målinger må foreligge først.

---

## 2026-08-14 — v5.18.6: Hullene i Otersjøen var 0 meter, ikke innsjø

Et nybygd kart over Otersjøen i Lierne hadde to rektangulære hull i innsjøene:
høydekurver stablet i tette rammer under vannlaget i 2D, og i 3D falt
innsjøflata rett ned til havnivå i to sjakter. Kilden er NHM-mosaikken, som
leverer 0 m der den mangler LiDAR-retur — her to felt på 1480×260 m og
840×300 m med 352 m høy kant hele veien rundt. Reparasjonen fantes allerede
(Terrarium-fyllet, laget for grensekart), men gaten spurte om andelen av arket:
2 % kreves, hullene utgjorde 1,1 % av et 6,4×6,4 km-ark, og ingenting skjedde.
Et hull koster like mye uansett hvor stort arket rundt det er, så gaten spør nå
om FORMEN i stedet — en ~0 m-klynge der hver nabo utenfor er minst 30 m høyere
er et datahull, for et ekte terreng når aldri 0 m uten å gå gjennom
mellomhøydene.

To andre veier inn til et DEM hoppet dessuten over reparasjonen helt. 3D hentet
sitt eget gitter gjennom flis-cachen — det er grunnen til at hullene var
tydeligst nettopp der — og headless (MCP-serveren og fasiten) kjørte aldri
fyllet i det hele tatt, så MCP-bygde kart beholdt hullene appen var ferdig med.
Begge kjører nå det samme fyllet med den samme trygge degraderingen. Målt på
Otersjøen: DEM-minimum 0 → 317 m, og høydekurvene i hull-området faller fra 152
til 118 features fordi stabelen fra havnivå og opp langs hullkanten forsvinner.

Fasiten står uendret — ingen brudd, ingen avvik, og ingen av de seks kartene
trigger fyllet i det hele tatt. Det er den beste målingen vi har på at klausulen
er presis: Henningsvær er 90,8 % vann og leser ~0 m over hele havflata, men der
skråner terrenget opp fra vannkanten gjennom mellomhøydene, så kanten er lav og
klyngen er ikke et hull. Bare klynger som ligger i bunnen av en klippe fanges.

---

## 2026-08-13 — v5.18.5: Avbrutt kart-utvidelse bokføres, ikke gjettes

En kart-utvidelse som ble avbrutt — reload, app-lukking, eller en nabo-flis som
feilet midt i løkka — etterlot et ark med hakk i ytterkanten, og «Fyll hullene»
dukket ikke opp. Reparasjons-mekanikken var verken fjernet eller ødelagt: den
leter etter INNELUKKEDE hull, med vilje, fordi en bounding-box-variant en gang
rapporterte fantom-hull under vanlig panorering og bygde utsnitt ingen hadde bedt
om. Men en utvidelse fyller nettopp perimeteret, og et hakk i ytterkanten ser
identisk ut enten det kommer av avbrutt bygging eller av at brukeren panorerte
diagonalt. Informasjonen finnes ikke i formen.

Den finnes i intensjonen. `extendMap` vet nøyaktig hvilke fliser den satte seg
fore å bygge, men holdt det bare i minne — så det var borte etter reload. Planen
skrives nå ned i localStorage før byggingen starter og strykes flis for flis
etter hvert som de lykkes. Et avbrudd etterlater dermed en presis liste over det
som mangler, uten terskler og uten falske positive. Banneret leser begge kilder:
bokføringen for hakk i kanten, geometrien for innelukkede hull og for fliser som
ble kappet ut av cachen lenge etterpå. De slås sammen på celle-identitet, så en
flis begge finner tilbys én gang.

To detaljer på veien: `finally` i `extendMap` tegner nå mosaikken og teller på
nytt selv når løkka feilet, så banneret kommer med en gang i stedet for ved neste
tilfeldige mosaikk-endring — og lista har et tak på 24 fliser, siden den ikke er
en logg, men et svar på «hva mangler nå».

---

## 2026-08-13 — v5.18.4: X-en i 3D-viseren var synlig, men død

Feilet 3D-visningen — for eksempel etter en ufullstendig kart-utvidelse — sto man
igjen i et svart bilde med en lukkeknapp som ikke gjorde noe. Escape virket, og
Android-tilbakeknappen virket, men ingen av dem finnes som knapp på skjermen.

Årsaken er ren stabling: laste- og feilmeldingene er fullskjerms lag på z-20,
altså OVER topprada på z-10 der X-en sitter. Overlayene er nesten helt
gjennomsiktige, så X-en var fullt synlig — trykket havnet bare i laget foran den.
Begge overlayene er nå `pointer-events-none`; de er ren informasjon og trenger
ingen treff selv.

**Røyktesten kunne ikke fange dette, og gjør det nå.** Den lukket viseren med
`el.click()` fra `page.evaluate`, som sender hendelsen rett på elementet og ikke
bryr seg om hva som ligger over det — en død knapp ser identisk ut med en levende.
Sjekken bruker nå et ekte Playwright-klikk, som treffer det øverste elementet i
punktet og feiler hvis noe dekker knappen. Verifisert begge veier: rød uten
fiksen, grønn med.

**Om hull-reparasjonen: den er ikke fjernet, og den er ikke ødelagt.** Banneret
«Kartet har N hull etter en avbrutt utvidelse» med «Fyll hullene»-knapp er fullt
kablet fra `useMapExtend` gjennom `MapStatusOverlays`. Men `findGridGaps` krever
at en manglende celle er OMSLUTTET — flis på begge sider langs minst én akse — og
det er et bevisst valg som står dokumentert i `tileCache.js`: en tidligere
bounding-box-variant rapporterte fantom-hull under vanlig panorering og bygde
utsnitt ingen hadde bedt om. Prisen er at et hakk i YTTERKANTEN ikke fanges, og
det er nettopp det en avbrutt utvidelse etterlater. Målt: et innelukket hull
finnes (`["1,0"]`), mens en avbrutt utvidelse med én eller to manglende celler
gir `[]`. Ingenting er endret her — geometri alene kan ikke skille «avbrutt
bygging» fra «diagonal panorering», så en ekte løsning må bokføre hva utvidelsen
SATTE SEG FORE å bygge. Det er en ny mekanisme, ikke en feilretting.

---

## 2026-08-13 — v5.18.3: Én kilde til vann, og bekkene kommer tilbake

Fasit-suiten meldte 26 avvik på alle seks kart, og de handlet alle om vann.
Rondvassbu hadde falt fra 72,7 til 14,6 km elv, Kolstadøya fra 7,5 til 0, Gjende
fra 119 til 44 vannflater. Ingen hadde rørt vann-koden. Det som hadde endret seg
var at NVE svarte.

**Én kilde, to feil.** `fetchN50Water` hentet en gang HELE N50-vannstacken —
Havflate, Innsjø og ElvBekk. I juli ble den lagt om til NVE Innsjødatabasen, som
leverer innsjøer og ingenting annet: ingen elveløp, ingen bekker, ingen sjø.
Flaggene som styrer hva OSM-vann som skal undertrykkes beholdt både navnene og
oppførselen sin. Så `n50HasFreshwater` — sant så snart kilden returnerte én
innsjø — fortsatte å undertrykke OSM sine bekke- og grøfte-LINJER, som ingenting
lenger erstattet. Flagget avledes nå av hva kilden FAKTISK inneholder: en
innsjø-kilde undertrykker innsjøer, en kilde med bekker undertrykker bekker.

**Og de to pipelinene sprikte.** Appen har hele tiden gjort per-flate
dekningstester (NVE er autoritativ DER den har en innsjø, OSM fyller hullene) og
beholdt elveflater uansett. Den headless kart-byggingen — som MCP-serveren og
fasit-suiten bygger gjennom — hadde sin egen, grovere variant: fikk den én eneste
innsjø fra kilden, kastet den ALT OSM-vann og beholdt bare kildens innsjøer. Det
er den som forklarer de største tallene. Sammenslåingen bor nå i én fil,
`lib/vannMerge.js`, som begge bruker.

Appen var altså delvis rammet (bekkene) og MCP-bygde kart fullt ut (bekker,
elveflater og halvparten av innsjøene). Fasiten er ikke oppdatert med
`--oppdater` — den skulle ikke gjøres grønn, den hadde rett.

**Fasit-baselinen er målt i CI, ikke her.** `--oppdater` er bare korrekt der
alle kildene svarer. På en utviklingsmaskin — eller i en sandkasse der NVE gir
403 — måler man en degradert pipeline og skriver de tallene inn som sannhet,
stikk motsatt av hva fasiten er til for. Oppdateringen er derfor en knapp på
fasit-workflowen (`workflow_dispatch` med `oppdater`), som commiter den nye
baselinen etter at diffen er lest i en vanlig kjøring. De 11 avvikene som sto
igjen etter fiksen var alle konsekvenser av at NVE-geometrien nå FAKTISK brukes:
flere ekte øy-hull (Vardåsen 0 → 3), 7 % mer vannareal fordi NVE-innsjøene er
N50-avledet og litt rausere enn OSM sine, og et par korte strekk der en sti
klipper NVE-strandlinja — den siste advarselen sto i CI-loggen allerede før noen
av endringene her, altså fra NVE og ikke fra koden. Gjende gikk motsatt vei og
mistet 236 m sti gjennom vann.

**Fasiten måler nå koden den beskytter.** Vann-sammenslåingen sto i
`createMapFlow.js`, som ikke var blant filene som utløser fasit-kjøringen — så
ingen gate så at de to pipelinene drev fra hverandre. Både `vannMerge.js` og
`createMapFlow.js` er lagt inn nå.

---

## 2026-08-13 — v5.18.2: Den røde deployen som har stått rød siden 9. august

Hver merge til master ga «Run failed». Det var ikke PR-sjekkene — de har vært
grønne hele veien — men **Deploy MCP-worker**, som feiler på hver eneste push som
rører `src/lib/**`, altså nesten alle. Den har feilet siden 9. august (v5.0.16),
og feilmeldingen sto i en workflow ingen leser før den har feilet mange nok
ganger.

**Hva som var galt.** `mcp/headless.js` bundles inn i Cloudflare-Workeren. Den er
skrevet for Node, og v5.0.16 la til en katalogsti regnet ut på modulnivå:
`fileURLToPath(import.meta.url)`. I workerd er `import.meta.url` undefined, så
Workeren kastet `TypeError: The "path" argument must be of type string` i det den
startet — og Cloudflare avviser en versjon som ikke kommer opp. Stien regnes nå
ut lazily, og bare der det finnes et filsystem. Uten disk hopper headless over
N50-sti-flisene i stedet for å be om en URL den ikke kan slå opp.

**Hvorfor ingen gate fanget det.** `npm test` kjører i Node. `npm run build`
bygger appen, ikke Workeren. `wrangler deploy --dry-run` bundler, men kjører
aldri modulen. Og `wrangler check startup` — som høres ut som akkurat denne
sjekken — profilerer oppstarten og returnerer 0 selv når Workeren kaster. Det
eneste som fanger det er å faktisk STARTE den.

**Så det er det vi gjør nå.** `npm run boot:workers` starter alle tre Workerne i
den ekte runtimen (`wrangler dev --local` → workerd, ingen Cloudflare-konto,
ingen nett-avhengighet) og spør dem. Den kjører på PR-er som rører
`cloudflare/`, `mcp/`, `src/lib/` eller `src/composables/`. Sjekken er «svarer
runtimen?», ikke «finnes ruta?» — lende-proxy svarer 404 på alt annet enn sine
to ruter, med vilje, og et krav om 200 ville gjort den evig rød uten at noe var
galt. Gaten er verifisert begge veier: den feiler på den gamle koden og passerer
på den nye.

---

## 2026-08-13 — v5.18.1: Kartbildet kommer på terrenget også med ni fliser

To ting fra testrunden på v5.18.0. Begge er fra samme sted: 3D dekker nå hele
arket, og to antakelser som holdt for én flis holder ikke for ni.

**Månelandskapet.** Med ni fliser ble terrenget en gråhvit gipsmodell uten
kartografi. Årsaken var at hele arket ble serialisert til ÉN SVG-streng og
dekodet som ett bilde: det gikk med to og fire fliser og brakk ved ni — bildet
lastet ikke, og motoren falt til gråtone-relieffet, som er akkurat det
månelandskapet. Nå rasteriseres flisene HVER FOR SEG og tegnes inn i sin egen
rute av lerretet. Kostnaden per dekoding er en niendedel, strengen vi bygger er
aldri større enn ett kart, og en flis som feiler koster bare sin egen rute i
stedet for hele kartbildet. Samtidig strippes alt relieff ut av flisene og bakes
fra utsnittets egen DEM: én sømløs belysning over hele arket i stedet for ett
base64-PNG per flis, hver med sin egen kant — og det er megabyte mindre å dekode.
Skulle det likevel gå galt, sier visningen fra i stedet for å la deg stå med et
månelandskap uten forklaring, og røyktesten feiler nå på den meldingen; et grønt
«canvas 1080×2000» sa ingenting om hva canvas-en faktisk viste.

**«Du er utenfor dette kartet.»** Varselet måltes mot den aktive flisa alene, så
det slo inn med GPS på i det du utvidet kartet — selv om du sto midt i arket du
nettopp hadde bygd, og posisjonen din var tegnet riktig oppå naboflisa hele
tiden. Nå måles det mot hele arket, og det oppdateres i det en ny naboflis er på
plass i stedet for å vente på neste GPS-fiks. Det retter to ting til på kjøpet:
«Sentrer» finner deg når du står på en naboflis, og turfremdrift langs en rute
slutter ikke å regne når ruta krysser en flisekant.

---

## 2026-08-12 — v5.18.0: 3D viser hele kartet, og turen er noe du kan se deg rundt i

Fem ting fra testrunden i 3D, og den største er at 3D-visningen nå bygger HELE
arket. Har du utvidet kartet med kanthåndtakene, var det bare flisa i midten som
ble terreng — et 3×3-ark mistet åtte niendedeler i det du trykket «3D». Nå regnes
utsnittet av mosaikk-kanten (samme union pan-grensa bruker) sammen med rutas
bounding-boks, DEM hentes for hele utsnittet, og kartteksturen tar med
naboflisene. Ytelsen holder seg fordi taket ikke er antall fliser men det som
allerede finnes: terrengmeshen desimeres til 512 celler uansett størrelse, og
mosaikken tegner maks 12 nabofliser. Det du BETALER er oppløsning — teksturen er
det samme 4096²-lerretet uansett hvor stort området er, så et 3×3-ark får
kartbildet i en tredjedel av detaljen per meter, og rasteriseringen av SVG-en tar
noe lenger tid ved åpning. Med utvidelsen kom tre feil fram som hadde ligget der
hele tiden: naboflisenes stinett, brukerminner og navn ble lest ut med
flis-LOKALE koordinater og lagt oppå den aktive flisa, forskjøvet med hele
flisebredder. Regnestykket som retter det bodde i tre nesten like kopier og bor
nå i én fil, `lib/svgNestedOffset.js`. Naboflisenes navn (topper, vann, steder,
hytter) blir nå nåler de også — de står ikke i søkeindeksen, som med vilje bare
dekker aktiv flis, så de leses rett ut av navnelabelene i mosaikken.

**Turen er ikke lenger noe du bare ser på.** Kameraet lå låst til ruta under
avspilling, og det opplevdes rart når resten av visningen inviterer til å
utforske. Nå ligger kameraet litt lenger ute og høyere (35° over horisonten i
stedet for 32°, 40 % lengre bak), du kan dra og pinche fritt mens turen ruller —
kameraet FØLGER fortsatt ruta hele tiden — og legger du fingeren stille et lite
øyeblikk, blir kameraet stående der det er så du kan se rundt deg, opp og ned,
mens turen går videre uten deg. Slipper du, glir det mykt tilbake bak ruta.
Play og «start på nytt» setter kameraet tilbake i standardposen skrått bakfra, i
stedet for å arve utsikten du sto i — når utforsking er poenget underveis, må det
finnes ÉN forutsigbar vei tilbake til «vis meg ruta».

**To nåler tett i tett.** Nåler blåses opptil 5× opp med avstanden så de kan
lokaliseres i horisonten, men declutteren regnet med en fast boks for en nær nål
— så to fjerne nåler kunne stå med hodene delvis oppå hverandre. Boksen måles nå
i skjermrommet, fra fot til hode, og av to som konkurrerer om samme flekk vinner
den nærmeste betrakteren.

**Og to småting.** Knappen på infokortet het «Videre →», et arvestykke fra den
første 3D-visningen der kortene bare var severdigheter langs en valgt sti; nå er
det en X som lukker. Og visningen åpner med kun nålene på — kurvene sto på før,
men sammen med stinettet, nålene og en rute ble det fire lag over hverandre i det
første sekundet, og førsteinntrykket er det eneste som ikke kan slås på igjen.

---

## 2026-08-12 — v5.17.0: Søketreffene blir faktisk skilt, og eksporten lar visningen stå

To ting fra testrunden. Kvalifikatoren fra v5.16.0 virket i logikken men ga
INGENTING i praksis, og eksporten nullstilte en rotasjon den ikke burde røre.

**Hvorfor ingen kvalifikator kom fram.** Målt mot Nominatim (2026-08-12): funksjonen vi
gjenbrukte, `nearestPlaceLabel`, er laget for GPS-posisjonen din og velger med
vilje det mest LOKALE navnet — «Hauger», «Rød», «Grimsrud», altså gårdsnavn. Til
å skille søketreff vil man ha motsatt prioritet, det mest GJENKJENNELIGE. I
tillegg gjorde tre raske reverse-kall rett etter søket at Nominatim svarte 429, og
feilen ble svelget i stillhet — treffene sto ukvalifiserte, som er nøyaktig det
som ble observert. Nå: `stedsnavnKandidater` rangerer tettsted/bydel/grend foran
gård, kalleren tar første kandidat som TILFØRER noe (så «Asker» hoppes over til
fordel for «Rønningen»), det er 1,1 s mellom oppslagene, og hvert treff
oppdaterer lista straks det er skilt i stedet for at alle venter på alle.

**Og et gratis skille vi kastet.** SSR vinner dedupliseringen med god grunn
(autoritativ norsk skrivemåte), men Nominatim-tvillingen på samme koordinat kan
vite mer: «Vardåsen, Tofte» mot SSR-ens «Vardåsen, Asker». Nå plukkes det
sted-leddet opp før dubletten forkastes — helt uten nettverkskall.

Resultatet for de tre Asker-treffene, målt: «(Rønningen)», «(Tofte)» og
«(Grimsrud)». Merk at tettsted-nivået eieren håpet på — «Dikemark», «Røyken» —
IKKE finnes i Nominatims reverse-svar for disse punktene; det største som
finnes er en bydel, ellers en gård. Det står dokumentert i `geocode.js` med
måledata, så ingen leter etter det på nytt.

**Eksporten lar visningen stå.** v5.16.0 nullstilte rotasjonen før eksport.
Det virket, men zoom, rotasjon og utsnitt er noe brukeren har lagt til rette
med vilje. Fila blir nord-opp uansett, og labelene rettes i klonen —
skjermen forblir urørt.

Bonusfunn: det er minst FIRE topper som heter Vardåsen i Asker, ikke to. Etter
kommunesammenslåingen i 2020 er Asker, Røyken og Hurum én kommune.
## 2026-08-12 — v5.16.1: Hvorfor kryss-domene-kode hører hjemme i MapView

Ingen kodeendring. Gjeldsseksjonen i CLAUDE.md har fått eierens begrunnelse for
at Stifinner-glue-en skal bli liggende, og den er bedre enn min egen: jeg
argumenterte med at 23 avhengigheter er for mange, altså at uttrekket ville bli
stygt. Han peker på at kode som møtes på tvers av domener HJELPER orienteringen
når den ligger samlet i det sentrale viewet — Claude leser aldri hele kodebasen,
men leser alltid noe av MapView, så et kryss som er synlig der er lettere å
forstå enn ett som er skjult i en composable ingen oppgave tvinger fram.

Forskjellen betyr noe for neste økt: målet er ikke færrest mulig linjer i
MapView, det er at det som står der skal fortjene å stå der.

---

## 2026-08-12 — v5.16.0: Fem like søketreff, og eksport som viser det du får

**Søk: «Vardåsen, Asker» ga fem identiske rader.** Årsaken er ikke en bug i
dedupliseringen — den er at SSR registrerer NAVNEOBJEKTER, ikke topper. Etter
kommunesammenslåingen i 2020 er Røyken, Hurum og gamle Asker én kommune, så to
åser OG det som er oppkalt etter dem (alpinanlegg, boligfelt, kirke) deler både
navn og kommunenavn. Etiketten vår var bare «skrivemåte, kommune», så alt så
likt ut.

Treffene fjernes ikke — de er forskjellige steder, og du skal kunne velge. De
kvalifiseres i stedet, med det billigste som skiller: først navneobjekttypen,
som vi allerede fikk gratis fra SSR men aldri viste («Vardåsen, Asker
(alpinanlegg)»), og for de som fortsatt er tvetydige ett reverse-oppslag som gir
nærmeste stedsnavn — «Vardåsen, Asker (Dikemark)» mot «(Røyken)». Typen legges
på med én gang, så lista kommer like raskt som før; oppslaget skjer etter første
visning og oppdaterer lista når det lander. Typen settes bare når den VARIERER i
gruppa: «(ås)» bak to åser hjelper ingen.

**Eksport nullstiller nå rotasjonen på skjermen først.** Den eksporterte SVG-en
er alltid nord-opp, så det du ser skal være det du får. Rettelsen i v5.14.0
gjorde labelene vannrette i fila; denne gjør at kartet på skjermen også snapper
til nord når du trykker Lagre, i stedet for at fila ser annerledes ut enn kartet
du nettopp la til rette.

---

## 2026-08-12 — v5.15.1: Kart over MapView, og to punkter målt og forkastet

Opprydningen er ferdig: 4 897 → 3 150 linjer over åtte leveranser, sytten
domener ute i egne composables. Denne siste posten legger ikke til kode — den
legger til et KART øverst i MapView.vue: hva som bor der, hva som er flyttet ut
og hvor, hvilke kall som ikke kan flyttes, og hva du skal kjøre før du endrer
noe. Problemet med fila har hele tiden vært at ingen leser den i sin helhet;
tretti linjer med oversikt er verdt mer enn de neste hundre linjene som kunne
flyttes.

To gjenstående punkter ble målt og forkastet, og begrunnelsen står i CLAUDE.md
så de ikke tas opp på nytt uten nye argumenter. **Stifinner-glue-en** (212
linjer) har 23 avhengigheter — en composable med 23 deps er MapView med et
lengre kallsted, og koden er ikke en søm men et kryss der fire domener møtes.
**Drawer-ens 111 props** ville spart ~60 mal-linjer (2 % av fila) mot å endre
prop-kontrakten i åtte barn-komponenter, der feilmodusen er en feilstavet
prop-sti → stille død funksjon. Vue kaster ikke på udefinerte props, og det er
nettopp der verktøyene mine er svakest.

---

## 2026-08-12 — v5.15.0: Gest-perf og pan-grensene ut av MapView

To composables til: `useGestPerf.js` (hva som slås av under pan/pinch/rotasjon,
pluss jank-måleren) og `usePanGrenser.js` (hvor langt kartet kan dras, hvor langt
ut det kan zoomes). MapView er 3 153 linjer.

`useGestPerf` er den mest sårbare av alle uttrekkene så langt, og toppkommentaren
sier hvorfor: hvert tiltak der er usynlig når det virker. Fjerner du
`.is-zooming`, relieff-skjulingen eller dash-overstyringen, brekker ingenting
visuelt — kartet blir bare hakkete igjen på mobil, og ingen test hadde sagt fra.
Derfor har den nå en røyk-sjekk som krever at modusen slås PÅ midt i en gest og
ryddes bort etterpå. Den utsatte gjenopprettingen (120 ms) er også dokumentert:
snap-back-repainten skal ikke lande på samme frame som compositorens siste
re-raster.

Sjekken avslørte en svakhet i røyktesten selv: hjul-gestene pekte midt i SVG-ens
bounding box, som etter tidligere dyp-zoom-sjekker ligger utenfor vinduet — så
musen havnet i tomrommet og eventet traff ingenting. Alle hjul-gester peker nå
midt i viewporten. `frie-variabler` lærte samtidig å se flere deklaratorer per
setning (`let minX = 0, minY = 0`), som ga fire falske treff.

---

## 2026-08-12 — v5.14.0: Vannrette navn i eksport av rotert kart

Har du rotert kartet på skjermen og så eksportert til PDF, SVG eller PNG, kom
alle navnene ut på skrå — mens selve kartet var riktig nord-opp. Målt på et
40°-rotert Vardåsen: 179 skjeve labels i fila.

Årsaken er at de to tingene bor på hver sin side av samme problem. Rotasjonen
ligger som en CSS-transform på wrapper-diven, ikke på SVG-en, så den eksporterte
SVG-en er ALLTID nord-opp. Skjermen counter-roterer hvert navn (`rotate(-40)`)
for at de skal stå vannrett mens kartet står på skrå — og den counter-rotasjonen
fulgte med ut i klonen, der det ikke lenger var noe å motvirke.

`applyUprightLabels` tar nå en rotasjons-overstyring, og eksporten kaller
`applyUprightLabels(0)` rett før den kloner og uten argument etterpå. Begge
kallene er synkrone med kloningen imellom, så mellomtilstanden rekker aldri å
tegnes på skjermen. Gjelder PDF, SVG, PNG, print — og 3D-teksturen, som bruker
samme markup.

Feilen er eldre enn nattens opprydning; eksporten har aldri rørt
label-rotasjonen. Ny røyk-sjekk vokter hele kontrakten, inkludert at skjermen
kommer tilbake til brukerens rotasjon: «179 skjeve på skjerm → 0 i fil → 179
tilbake på skjerm».

---

## 2026-08-12 — v5.13.0: Kartsøket ut av MapView

`useKartSok.js` overtar fritekst-søket i kartet: treff-lista, highlight-ringen,
tastaturnavigasjonen og `panToSettled` — den som sentrerer et treff robust mot
mobil-tastaturet. Kommentaren om HVORFOR den er skrevet som den er (layout-
viewporten er krympet mens tastaturet står oppe, og Android blurrer søkefeltet
før click-handleren rekker å kjøre) følger med inn i fila. MapView er 3 283
linjer, ned fra 4 897.

Det GLOBALE stedssøket ble stående med vilje: å velge et treff fra «Andre
steder» BYGGER ET NYTT KART, og hører til bygge-domenet, ikke til søket.
Composable-en kaller bare `clearGlobalSearch()`.

Ny røyk-sjekk som gjør begge halvdelene av jobben: den finner et stedsnavn som
faktisk står i kartet, søker på fire bokstaver av det, velger treffet og krever
BÅDE at highlight-ringen dukker opp OG at kartet panorerer dit (målt: «Bondi» →
4 ring-noder, transform endret). Den avdekket samtidig at highlight-chippen
erstatter fane-raden mens den står — så sjekken fjerner markeringen etterpå.
Nøytral-tilstand-regelen har nå kostet to sjekker; den er verdt å huske.

---

## 2026-08-12 — v5.12.0: Eksport, tema og GPS-tips ut av MapView

Tre uavhengige uttrekk: `useKartEksport.js` (SVG/PNG/PDF/print, med
markup-byggingen som baker inn temaet og klipper bort spøkelses-flisene),
`useTemaBytte.js` (tema-variabler + diagnose-modus) og `useGpsTips.js`
(debug-linja, «kopier koordinater» og de tre avvisbare meldingene). MapView er
3 356 linjer — ned fra 4 897 der opprydningen startet.

Denne runden ga tre lærdommer verdt å skrive ned, alle funnet av verktøyene og
ikke av flaks:

**Hoisting-fella.** `function applyTheme()` er hoistet, så `useMapLoadPipeline`
kunne motta den som verdi selv om den sto lenger ned i fila. Som composable-retur
er den en `const` fra en destrukturering — ikke hoistet — og appen krasjet med
«Cannot access applyTheme before initialization». Kallet måtte flyttes over
pipelinen. Sjekk hvem som mottar en funksjon før du flytter den ut.

**Verktøyene så bare én retning.** navnediff finner navn som forsvant fra
MapView, men ikke at en fersk composable refererer noe som ble STÅENDE. Det
skjedde to ganger på rad (`withColophon`, og `wrapperRef` + `visibleLayers` +
`DEFAULT_VISIBLE_LAYER_KEYS`) og ble begge ganger funnet av røyktesten — altså
først etter et bygg og en nettleser-start. Nå finnes `npm run frie -- <fil>`,
som finner dem på et sekund.

**En sjekk kan lyve i min favør.** Første versjon av tema-sjekken leste `--bg`
fra et element som ikke fantes, sammenlignet «» med «» og var fornøyd. Nå leses
den fra `[data-map-inner]` og krever at verdien faktisk endrer seg
(«» → «#14181c»). Eksport-sjekken hadde samme slag feil i motsatt retning: den
leste 4 kB av en 77 kB SVG og meldte «mangler ISOM-lag».

---

## 2026-08-12 — v5.11.0: Nærhetsvarsel og måleverktøy ut av MapView

To små, rene uttrekk: `useNaerhetsvarsel.js` (inngangen fra PUNKT-arket —
config-panel, arming, gjenoppretting etter reload, skjermlåsen som holder
alarmen i live) og `useMaaling.js` (distanse langs linje, areal av lukket
polygon). MapView er 3 573 linjer. Måleverktøyet måtte opprettes FØR
useSymbolRenderers, som trenger vertices-refene — `renderMeasure` kommer
tilbake som tilbakekall.

Denne runden ga også en regel til røyktesten: **en sjekk skal forlate appen i
nøytral tilstand.** Måle-sjekken lot appen stå i måle-modus, som bytter ut
fane-raden, og neste sjekk fant ikke 3D-knappen. Nå avslutter den målingen selv.

---

## 2026-08-11 — v5.10.0: Kart-knottene ut av MapView

341 linjer flyttet til `useKartKnotter.js`: strek- og relieff-knottene,
tekst-skala, font-bytte, sti-farger og FAB-panelene som finjusterer dem. MapView
er 3 673 linjer. Tre lag som lett forveksles bor nå i samme fil med forskjellen
skrevet ned: knotten er global og persistert, panelet er per kart, og temaet kan
slå relieffet av uten å lagre noe (`reliefAutoOff`) fordi monokrom-temaene mister
uttrykket sitt av en gråtone-gradient. Per-kart-bindingen ble samlet i én
`bindKartId(id)` — tidligere tre separate kall der det var mulig å glemme det
tredje ved neste kartbytte.

Estimatet mitt for denne blokka var 518 linjer og «ett domene». Ved gjennomlesing
var det fire: knottene, standarder for nye kart, maks-fliser og navnespråk lå
flettet i hverandre. De tre siste ble stående — et uttrekk skal følge en søm, ikke
et linjetall.

Røyktesten fant to ting underveis. Skuffens ✕-knapp hadde verken tekst eller
`aria-label` (nå rettet — den var usynlig for skjermlesere). Og FAB-knottene
styres av `pointerdown`/`pointerup` via useLongPress, ikke `@click`, så et
programmatisk klikk gjør bokstavelig talt ingenting på dem — verdt å vite neste
gang noe skal testes eller automatiseres der.

---

## 2026-08-11 — v5.9.0: Navn-LOD og viewport-culling ut av MapView

Første uttrekk med sikkerhetsnettet under seg, og det merkes: 328 linjer flyttet
til `useNavnLod.js` og `useViewportCull.js` uten en eneste runde med
feilsøking i nettleseren. MapView er nå 3 975 linjer. De to hører sammen fordi de
utløses av det samme — endret utsnitt — men gjør motsatte ting: LOD-en velger
hvilke navn som får plass, culling skjuler vektorer utenfor synsfeltet. Begge
har fått en røyk-sjekk med ekte tall: seks hjul-tikk tar navne-LOD-en fra 95 til
55 skjulte navn, og 16 tikk culler 701 elementer. Sjekkene krever et ekte kart
(`--ektekart`) fordi demo-kartet i repoet har sju labels og ingen bbokser — CI
bygger derfor et ferskt Vardåsen-kart, og hopper synlig over sjekkene hvis
kildene er nede. Navnediff-en fikk også en rettelse den fortjente: den så ikke
utrackede filer, så nye composable-er ble rapportert som «uforklart borte».

---

## 2026-08-11 — v5.8.1: Sikkerhetsnett før neste uttrekk

Tre monteringsfeil i v5.8.0 passerte 1 978 enhetstester og produksjonsbygget
uten en lyd, og ble bare funnet fordi jeg tilfeldigvis startet en nettleser.
Skal 2 300 linjer til flyttes ut av MapView, må det ikke være tilfeldig.
`npm run royk` monterer `/kart/vardasen` i Chromium og TRYKKER på hvert
uttrukket domene — lag-toggle, deling, GPS, 3D-inngangen — og feiler på enhver
JS-feil i konsollen. `npm run navnediff` dekker den andre feilklassen: hva
forsvant ut av MapView i denne endringen, hvem overtok det, og hva som er borte
uten forklaring. Begge er verifisert mot den ekte feilen: sletter man
`useReliefRender`- og `useGhostTiles`-blokkene på nytt, sier navnediff «tre
composable-kall forsvant, sju navn er fortsatt brukt» og røyktesten svarer
`ReferenceError: ghostRects is not defined`. Egen CI-jobb på PR-er som rører
MapView, composable-ene eller komponentene. Under arbeidet fanget røyktesten
også seg selv: første versjon gjenbrukte en eksisterende `dist/` og rapporterte
altså på kode som ikke lenger sto i `src` — den bygger alltid nå.

Første kjøring i CI fant med en gang en ekte feil ingen hadde sett: det sporede
demo-kartet `public/maps/vardasen.svg` er bygget FØR v2.4.17 og har fortsatt
`points="1.25mm,…"` i Blokkmark-mønsteret. `points` tar ikke enheter, så
nettleseren forkastet attributtet og ISOM 210 var et tomt mønster i demo-kartet
(det ekte kartet bygges av CI ved deploy og er upåvirket). Mønsteret er nå
konvertert til bruker-enheter i den sporede fila.

---

## 2026-08-11 — v5.8.0: Fem domener ut av MapView

MapView.vue er appens største risiko fordi alt møtes der og ingen — verken
menneske eller Claude — ser hele fila om gangen. Fem domener er nå flyttet ut i
egne composables: 3D-inngangen (`use3dEntry`), utgående deling
(`useKartDeling`), innkommende tur-lenker (`useDeltTur`), lag-styringen
(`useLagStyring`) og GPS/sporing (`useGpsSpor`). Fila går fra 4 897 til 4 281
linjer, og hver ny fil har toppkommentaren som forklarer hvorfor den finnes og
hva som er farlig i den — timing-kravene for tur-restore, iOS-gesten som må
starte kompasset, hvorfor lag-styringen har tilbakekall i stedet for importer.
Ingen atferd er endret; uttrekket er rent flytting pluss avhengighetene gjort
eksplisitte. Verdt å merke: tre monteringsfeil oppsto under flyttingen, og
ingen av dem ble fanget av 1 978 enhetstester eller av produksjonsbygget —
kun av en ekte nettleser. Det er argumentet for at røyktesten hører til
verktøykassa når MapView røres.

---

## 2026-08-11 — v5.7.1: Fasit for kart-pipelinen, og gjelden skrevet ned

Nesten hver tiende utgivelse i denne loggen har handlet om vann, sjø, kyst eller
DEM. Ikke fordi koden er dårlig, men fordi feilene bor i SAMMENSETNINGEN av fem
autoritative kilder på ekte geografi — og enhetstestene tester rene funksjoner.
`npm run fasit` bygger nå seks ekte kart og sjekker invarianter mot en lagret
fasit: Vardåsen (referanse), Kolstadøya (øyer = hull i vann), Strykenåsen (brutt
stinett, elv, hovedvei), Gjende (stor innsjø, DEM-nedskalering), Henningsvær
(skjærgård), Rondvassbu (høyfjell). Stedene er valgt etter feilklasse, ikke
utsikt — hvert av dem er et åsted fra denne loggen. Kjøres i CI ved endring i
pipelinen og ukentlig, siden kildene endrer seg under oss.

Invariantene sjekker at vann finnes der det skal, at øyer beholder hullene
sine, at konturer og vegetasjon ikke males ute i vannet, at ingen ring er så
grovmasket at den må være en usydd multipolygon, og at stinettet finnes.
Sjekkene er enhetstestet offline med syntetisk SVG — en sjekk som ikke virker
er verre enn ingen sjekk.

Fasiten fant fire feil under bygging, alle i MÅLINGENE, og hver av dem ble
avslørt av et ekte sted: øy-hull som ble regnet som vann (Kolstadøya, 131 %
vanndekning), ringarealer utenfor kartutsnittet (samme sted, 119 %), casing +
kjerne telt som to stier (Vardåsen, 185 km sti i 17 km²), og tre forsøk på å
kjenne igjen en usydd ring — «mye vann» feilet Henningsvær, som ER 91 % sjø;
«tynn flate over hele kartet» feilet Drammenselva; «få punkter i ytre ring»
feilet Henningsvær igjen, fordi den autoritative sjøgeometrien har grovt omriss
og all detaljen i 241 hull. Den som holder er areal per punkt over hele flata.

Den ene ekte funnet er datakvalitet, ikke kode: en 3,5 km «sti» tvers over
Rondvatnet er OSM-way 781607225 — `highway=path`, `source=Strava heatmap`,
`fixme=resurvey`. En isrute noen har gått om vinteren, ærlig gjengitt av Lende.
Slikt rapporteres som advarsel og feiler ikke bygget, men tallet ligger i
fasiten, så en endring synes.

`CLAUDE.md` har fått en seksjon om arkitektur-gjeld og kjente duplikater. Den
finnes fordi to nesten identiske 3D-scener levde side om side i månedsvis uten
å bli oppdaget: en assistent som starter hver økt blind ser bare det oppgaven
tvinger fram, og gjeld som ikke er skrevet ned er gjeld ingen ser.

---

## 2026-08-11 — v5.7.0: Én 3D-visning, og kameraet kan løsne fra turen

POI-klikk virket ikke i 3D-visningen av en tur, og grunnen var to: turvisningen
hadde ingen trefftesting i det hele tatt (severdigheter var en tidslinje, ikke
klikkbare nåler), og selv om den hadde hatt det, skrev følge-riggen kameraet på
nytt hver frame — samme grunn til at utforskerens POI-klikk under en sti-tur var
en stille no-op. Løsningen er å slå de to nesten like scenene sammen til én:
`scene3d.js` med tre innganger (kartet, et trykk i stinettet, en planlagt rute),
og ett kamera med to tilstander. Spiller turen, følger kameraet den; står den
stille, er kameraet ditt — panorér, zoom, eller trykk på en nål så flyr det dit.
Play fester kameraet tilbake til turen og ARVER perspektivet du sto i
(`deriveFollowView` regner blikk-offsetet ut av kameraposen). Følg/Utforsk-
knappene er borte; de var en manuell bryter for noe avspillingen nå sier selv.

Turvisningen har med det fått nåler for severdighetene langs veien, filteret
som hører til, og klikkbare start-/mål-/vendepunkt- og P-nåler. Utforskerens
sti-turer har fått stigning og «tid igjen» (høydeprofilen måles langs kurven).
En planlagt rute kan ikke lenger byttes ut av et trykk i stinettet — den er
turen din, og et trykk sier det i stedet for å stille og rolig legge en annen.
POI-stopp langs turen er fortsatt valgfritt, nå på egen «Stopp»-knapp.

Testet i ekte nettleser (WebGL) i tillegg til enhetstestene: begge inngangene,
løsning og festing av kameraet, nåletrykk, kryssvalg og «Til ruta».

---

## 2026-08-11 — v5.6.3: «Del sti» virker — og heter det den deler

Delingsknappen i Stifinnerens følge-banner het «Del rundtur» også når turen var
en vanlig A→B-tur langs stien, og den gjorde ingenting: delefunksjonen krevde
vendepunkter, som bare en rundtur har, så et trykk falt rett ut i en tom return.
Knappen heter nå «Del sti» for A→B og «Del rundtur» for rundturen, og deler
turen med mål (dlat/dlon) — samme lenkeformat mottaker-siden og MCP-ens tur3dUrl
alltid har brukt. Param-byggingen er flyttet til `shareTourParams` i
tour3dLink.js, der begge turformene er testet, i stedet for å ligge håndskrevet
i MapView.

---

## 2026-08-11 — v5.6.2: 3D-turen stopper ikke på et lite brudd i stien

En påbegynt sightseeing-tur i 3D-utforskeren ble avblåst hver gang stinettet
hadde et brudd på tjue meter — og kartdata er full av dem, siden N50 og OSM ikke
slutter på samme meter. Ruteren broer bare slike hull når omveien er absurd, for
der er «gå rundt» et gyldig svar; en tur uten mål har ingenting å gå rundt til.
Vandringen leter derfor nå etter fortsettelsen innen 60 m i en kjegle framover
og hopper over bruddet. Turen ender fortsatt der stien faktisk slutter: i
kartutsnittets ytterkant, eller foran et ekte hinder — vann, hovedvei, jernbane,
bygning, stup eller for bratt terreng, samme regel ruteren bruker. Målt på
Vardåsen-kartet: snittturen vokste fra 2,7 til 3,4 km, og andelen turer som dør
under 500 m falt fra 41 til 24 av 200.

Samtidig starter 3D-visningen med Sti AV og Kurver PÅ — førsteinntrykket skal
være terrenget, ikke et rødt nett over alt. Med stinettet skjult starter et
trykk heller ingen tur; man skal ikke bli tatt med langs en sti man ikke ser,
og traff trykket likevel en sti, sier appen hvorfor. Den grønne kryss-boksen
nederst er strammet inn til innholdets bredde i stedet for å legge et teppe
over kartet.

---

## 2026-08-11 — v5.6.1: Hull-broen krysser ikke hovedvei, jernbane, hus eller elv

Terreng-regelen fra forrige versjon fanger stup, men en jernbane i flatt lende
er null prosent bratt. Hull-broen sjekker nå også om forbindelses-streken
KRYSSER noe en fotgjenger ikke bare går tvers over: motorvei, hovedvei,
jernbane, bygning, innsjø, tjern, sjø, bekk og upassérbart stup. Gjør den det,
er hullet et ekte hinder og omveien er svaret.

Utvalget er målt på Strykenåsen-kartet, ikke gjettet. Tett bebyggelse ble
vurdert og forkastet: det er areal-dekke, ikke et hinder — stier går gjennom
boligfelt hele tiden, og å ta den ville avvist trettito av hundreogtrettien
hull på feil grunnlag. Bygning er det ekte hinderet der. Gjerde er også utenfor,
siden gjerder krysses ved grinder og klyv, og Lende har bom som egen passérbar
barriere. Liten bekk stepper du over, og naturreservat er en juridisk grense,
ikke terreng.

Minstegrensen for hull som hinder-reglene i det hele tatt vurderer heter nå
gapObstacleMinM og deles av begge reglene. Den fanget en ekte falsk positiv:
et hull på ti centimeter der veilinja tilfeldigvis gikk imellom ble meldt som
en veikryssing. Det er ingen veikryssing, det er tegnerekkefølge.

På Strykenåsen-kartet avviser barriere-regelen seksten broer, og seksten av
førtifire brudd er nå merket med hva som faktisk står i veien — tolv hovedveier,
to jernbaner, to hus, en bekk og et stup. Rutene til Narverudgruvene er
uendret. Chatten bygger grafen med samme to regler, så tallene der fortsetter
å stemme med ruten kartet tegner.

---

## 2026-08-11 — v5.6.0: Hull-broen spør terrenget før den krysser

Hull-broen koblet stier på hver side av et hull uten å se på hva som ligger
imellom. Et hull på tretti meter kan være en sti som nesten når fram — eller
kanten av et stup. Nå sampler broen DEM-en langs hullet og nekter når terrenget
er brattere enn seksti prosent. Hellingen måles fra begge ender mot hvert
sample, ikke bare ende til ende, for et hull som starter og slutter i samme
høyde kan krysse en kløft, og den skal telle. Hull under åtte meter er unntatt:
der er hullet forenklings-støy, ikke en traversering, og en sti som ender to
meter fra en annen i en bratt li skal fortsatt kobles.

Mangler kartet høydedata — WCS blokkert av CORS, eller syntetisk DEM — faller
regelen bort og ruteren oppfører seg som før. I appen hentes DEM-en asynkront,
så Stifinneren bygger grafen på nytt når den lander og reberegner en rute som
alt vises. Det ville ellers vært mulig å få vist en rute over et stup bare
fordi høydedataene ikke hadde kommet ennå.

`finn_stinett_brudd` rapporterer nå hellingen for hvert brudd og skiller de to
tilfellene i klartekst: et brudd med slakt terreng er et hull i kartdataene som
kan tettes ved å heve toleransen, mens et brudd med bratt terreng er et ekte
hinder ruteren nekter med vilje. På Strykenåsen-kartet er tre av trettifem
brudd ekte hindre, og de gjenstående trettito har terreng under førti prosent
— altså er de trygge å tette. Rutene til Narverudgruvene er uendret; hullet der
er tolv komma ni meter over trettisju prosents helling.

---

## 2026-08-11 — v5.5.5: finn_stinett_brudd — ett kall i stedet for en times detektivarbeid

Å finne hullet bak Narverudgruvene-saken tok en time med engangsskript: bygg
kartet, bygg grafen, mål omvei mot luftlinje, finn stedene der forholdstallet
eksploderer. Det er nå et MCP-verktøy. `finn_stinett_brudd` lister steder der
en sti ender noen få meter fra en annen sti, men der ruteren må gå langt rundt
— eller ikke kommer fram i det hele tatt. Hvert treff gir hullets størrelse,
omveien det koster, forholdstallet mellom dem, koordinater for både stienden og
nærmeste sti, og hva som skulle til for å tette hullet. Poenget er at grafen
bygges med nøyaktig de samme opsjonene som ruteren bruker, så det verktøyet
melder er hull som faktisk står igjen etter alle reparasjonspassene. De
opsjonene bor nå ett sted, `RUTE_GRAF_OPTS` i routing.js, i stedet for som fem
kopier av samme objekt-literal.

Verktøyet fant en feil i forrige versjon med det samme. Hull-broen hoppet over
stiender som ligger under seks meter fra stien de skulle koble til, fordi
fotpunktet da snapper til selve stienden og koden tolket det som «ingen ny node
å splitte i». Men det er nettopp der krysset er — stienden skal tres inn i
kanten. To slike steder på Strykenåsen-kartet kostet halvannen til to
kilometer omvei for et hull på under en meter. Antall brudd på det kartet falt
fra 70 til 33 da den ble rettet.

---

## 2026-08-11 — v5.5.4: Stifinneren broer hull der stinettet er brutt i praksis

Stifinneren fant ingen fornuftig vei til Narverudgruvene i Strykenåsen: en
luftlinje på 676 meter ga ruteforslag på 14–18 kilometer, uansett hvor mange
via-punkter som ble lagt inn. Årsaken lå i grafbyggingen. Stien sørover fra
gruvene ender 12,9 meter fra hovedstien uten å møte den, og de to henger bare
sammen via en fem og en halv kilometer lang omvei. Dangle-broen tålte den gang
bare 12 meter, og komponent-broen holder seg med vilje unna stier som allerede
er formelt sammenhengende — så hullet ble stående, og ruteren sendte brukeren
rundt hele åsen. Kartet på skjermen viste tydelig at stien nesten når fram.

Grafen har fått en hull-bro som kobler en stiende inntil 30 meter fra en annen
sti, men bare når omveien i dagens graf er minst 25 ganger hullet og minst 500
meter — altså når nettet er brutt i praksis, ikke når stien bare svinger. En
U-formet sti får fortsatt ingen snarvei over åpningen, og en sti som går i bro
over en annen får fortsatt ikke noe falskt kryss. Forbindelsen legges som
«bro», så den prises som antatt kobling og teller ikke som kartlagt sti i
stinett-analysen. Målt på et 6 km kart over Strykenåsen og Konnerud falt
gruve-til-sti-sør fra 4965 til 598 meter og gruve-til-Langmyrdammen fra 5286
til 1884 meter, mens ruter uten hull i seg er uendret.

---

## 2026-08-10 — v5.5.3: Tekstene i 3D-raden overlever en 384 px-skjerm

Terskelen fra forrige versjon var satt til 400 piksler, og en Galaxy S22+ har
384 piksler bred viewport — altså skjulte den «Sti», «Kryss» og «Kurver»
nøyaktig på den telefonen de var ment for. Knappene er strammet for å kjøpe
plassen tekstene trenger: gapet mellom dem fra 6 til 4 piksler, litt mindre
sidepolstring og tettere mellom ikon og tekst. Målt på 384 piksler slutter
knapperaden nå på 311 med 17 piksler luft foran X-en, på én linje. Terskelen er
senket tilsvarende, så tekstene faller først bort under 379 piksler, der de
uansett ikke kan stå på én linje. Turvisningen har fått samme knappemål, så de
to 3D-modusene ser like ut når man bytter mellom dem.

---

## 2026-08-10 — v5.5.2: Sti-knappen i 3D får teksten sin

Etter at knapperaden ble venstrestilt er det ledig plass til høyre, og den
brukes nå på å skrive «Sti» ved siden av det s-formede ikonet — slik «Kryss» og
«Kurver» alt gjør. Et ikon aleine er ikke til å gjette, og av de tre togglene
var stinettet den eneste som ikke sa hva den gjorde. På skjermer smalere enn
400 piksler faller de tre tekstene bort igjen og knappene blir runde: der er
det ikke plass til fem merkelapper, og en knapperad som bryter til tre linjer
er verre enn tre ikoner.

---

## 2026-08-10 — v5.5.1: Knapperaden i 3D venstrestilles, og 3D-pin i begge ruteender

Topplinja i begge 3D-visningene var høyrestilt, så raden vokste mot venstre — og
med seks knapper i utforskeren falt den første, nåleknappen, delvis utenfor
skjermen på en smal telefon med buet kant (Galaxy S22+). Nå er knappene
venstrestilte med X-en aleine helt til høyre, gapet mellom dem er strammet inn
fra 8 til 6 piksler, og tekstknappene («Kryss», «Kurver») har litt mindre
sidepolstring. Det gir margin i begge ender istedenfor overløp i den ene.
Samtidig fikk den lille svarte «3D»-knappen som flyter over en valgt rute en
tvillling i målenden: før sto den bare ved startpunktet, så hadde man panorert
til andre enden av turen måtte man tilbake til starten for å komme inn i
3D-visningen. Ved rundtur er start og mål samme punkt, og der vises fortsatt
bare den ene.

---

## 2026-08-10 — v5.5.0: De to 3D-modusene får samme hjelp og samme filter

Navigering i 3D er gester, og gester er usynlige: én finger gjør én ting og to
fingre noe annet, og det er ikke til å gjette. Begge 3D-visningene har derfor
fått en «Info»-pille øverst til venstre som forklarer bevegelsene og kort hva
knappene i toppen gjør — minimert til en liten pille, og med finger-tekst på
berøringsskjerm og mus-tekst på desktop, så ingen leser om noe de ikke har.
Samtidig er de to modusene samkjørt: POI-filteret ligger nå i begge, på samme
linje til høyre og med samme lagrede valg (slår du av brukerminner i
utforskeren, er de av i turvisningen også), og tidsaksen man drar i for å hoppe
fram og tilbake finnes nå også i utforskerens sti-turer. For å holde
knappeflaten nede er kartnavnet fjernet fra turvisningens topplinje — det er
2D-kartet man kommer fra, og plassen brukes bedre av Info-pilla. Utforskeren
viser tre fakta-bokser mens man følger en sti (gått, igjen, høyde) i stedet for
turvisningens fem, siden en sti-tur verken har høydeprofil eller gangtid-anslag
å fylle de to siste med.

---

## 2026-08-10 — v5.4.0: Korte, isolerte stistumper luftes ut av 3D

Stinettet i 3D var strødd med små røde streker som ikke førte noe sted — en
femtimeters rest ved en snuplass, et fragment kartdataene har mistet
forbindelsen til. De er verken nyttige å se eller å trykke på.

Filteret måler HELE den sammenhengende komponenten et strekk tilhører, ikke
strekket for seg. Det er hele poenget: en åtti meter lang sidegren inn i en
lang sti blir stående, fordi komponenten den er del av er lang, mens et
tilsvarende strekk uten forbindelse forsvinner. Grensa er 500 meter samlet
komponentlengde. Dangle-broingen i graf-byggingen er beholdt, så en stump som
ender noen meter fra en annen sti — et T-kryss der forenklingen flyttet
krysspunktet — regnes som tilkoblet og består. På Asker-kartet forsvant 88 av
511 strekk, altså 11 av 401 km, på 49 millisekunder.

Analysen av stinettet er urørt: den skal fortsatt telle alt som finnes i
området og rapportere de korte fragmentene for seg.

En flakete test er også ute av veien, og den hadde to årsaker.
`createMapFlow.flow.test.js` mocket alle kildene sine bortsett fra
Turrutebasen og N50-stinettet, som ble lagt til flyten senere. De gjorde
dermed ekte nettkall som feilet, og retry-backoffen la variabel tid til en
test som ikke handler om stier i det hele tatt. Med dem mocket falt testen fra
fem sekunder til ett — men den feilet fortsatt i full suite. Grunnen er at de
to testene bygger et helt kart hver, og når vitest kjører filene i parallell
konkurrerer de om kjernene. Der var timeouten den ekte begrensningen, ikke
noe som skjulte en feil, så de to har fått tretti sekunder hver. Fem
suite-kjøringer på rad går nå grønt.

---

## 2026-08-10 — v5.3.1: 3D viser stinettet slik kartet gjør

Slår man av veier og bebyggelse i kartet for å rydde, og åpner 3D, møtte man
likevel et tett vev av brune og røde linjer over hele terrenget. Det var ikke
caching — teksturen bygges fra en klone av live-DOM-en, og der ligger
lag-avslåingen som inline `display: none`, så kartbildet på terrenget var helt
riktig hele tiden. Feilen satt i 3D-visningens eget stinett-lag: det leste
`[data-iso]`-gruppene rått ut av SVG-en og brydde seg ikke om at de var
skjult. På Asker-kartet ga det 511 linjer der kartet viste 276.

Uttrekket kan nå hoppe over skjulte lag, og 3D bruker det. Analysen av
stinettet skal fortsatt se alt som finnes i området, uansett hva som er slått
av i visningen, så den beholder gammel oppførsel — valget er eksplisitt hos
kalleren.

Knappenålene følger derimot fortsatt sitt eget filterpanel, ikke kartlagene.
Det er med vilje: panelet er der nettopp for å styre dem.

---

## 2026-08-10 — v5.3.0: Svart terreng etter dvale, og stjerner som var tåkelagt bort

To ekte feil i 3D-visningen, funnet ved bruk.

**Terrenget ble helt svart etter noen minutter i bakgrunnen.** Stiene og
himmelen sto igjen, og det var nettopp sporet: de bruker ingen tekstur.
Nettleseren frigjør backing-store for store lerret når appen ligger nede — et
4096²-lerret er 64 MB — og lerretet består, men innholdet er borte. three
laster teksturen opp på nytt fra den kilden etter et kontekst-tap, og en tom
kilde blir en gjennomsiktig tekstur: svart terreng. Kontekst-tap alene er
altså ikke problemet; det er tapt kilde-innhold. Nå kjenner visningen igjen et
tømt lerret (kart-SVG-en har dekkende bakgrunn, så et gyldig lerret er
ugjennomsiktig overalt) og rasteriserer kartet på nytt — både når konteksten
kommer tilbake og når appen kommer i forgrunnen. Nattmodus var dessuten helt
uten dekning før: gjenopprettingen rørte bare dag-teksturen, mens det er
natt-teksturen som ligger på terrenget da.

**Stjernene og månen var usynlige i mørk modus.** De respekterte scene-tåka,
og `makeFog` setter tåke-far til kartbredden × 2,6 — på et 8 km-kart er det
20 800, mens stjerneskallet ligger på 22 500 og månen på 20 500. Begge lå
utenfor tåka og ble malt i ren tåkefarge, altså borte. Himmelkuppelen slapp
unna fordi den bruker en egen shader uten fog-chunk; nå sier stjernene og
månen det samme eksplisitt.

I tillegg viser visningen hva den holder på med under bygging, og åpner på en
1024-tekstur som skjerpes til full oppløsning i bakgrunnen. Her er en måling
verdt å skrive ned, siden den avkreftet antakelsen bak arbeidet: det er
rasteriseringen av kart-SVG-en som koster (11 544 elementer, ~7 s i
programvare-render), ikke lerret-størrelsen — første `drawImage` rasteriserer,
resten leser fra cache. Forhåndsvisningen gjør derfor ikke åpningen raskere.
Den er beholdt fordi den halverer noe annet som betyr mer: 4 MB i stedet for
64 MB tekstur i det mest utsatte øyeblikket, altså mindre av det minnepresset
som tømmer lerretet i utgangspunktet. Dekodingen deles nå mellom de to
oppløsningene, så skjerpingen er bare en ny tegning og ikke en ny
rasterisering.

---

## 2026-08-10 — v5.2.3: Musa panorerer kartet

3D-visningene virket fine på mobil, men på desktop lot kameraposisjonen seg
ikke flytte — bare rotere. Grunnen var OrbitControls' standardoppsett:
venstre musetast roterer, og panorering ligger gjemt på høyre tast, der ingen
leter. For et kart er forventningen motsatt — man drar i kartet og kartet
flytter seg.

Venstre-drag panorerer nå, høyre-drag roterer, hjulet zoomer — i både
3D-utforskeren og turvisningens Utforsk-modus. Panoreringen går langs
bakkeplanet, ikke skjermplanet, så kartet glir under kameraet i stedet for å
drive opp i himmelen, og blikkpunktet klampes til utsnittet med litt margin
så man ikke kan panorere seg bort fra kartet. Touch-oppsettet er urørt —
mobil fungerer som før.

---

## 2026-08-10 — v5.2.2: GPS-nål med rippel, og farvel til retningskjegla

Retningskjegla på 2D-posisjonsprikken er fjernet. Den drev hit og dit når
man sto stille — og stille står man som oftest når kartet faktisk leses.
En retningsindikator som bare er pålitelig når man ikke trenger den, er
støy, ikke informasjon.

I 3D er posisjonsmarkøren gjort om til en knappenål med samme form som
POI-nålene — hvit stamme, kulehode — men hodet er sky-blått som 2D-prikken,
og ved foten går konsentriske rippel-ringer utover, 3D-svaret på 2D-prikkens
pulserende nøyaktighetsring. Ytterste rippel-radius er fortsatt
GPS-nøyaktigheten i ekte meter.

I utforskeren er nåla klikkbar: ett trykk flyr kameraet til der du står. Har
du forflyttet deg nylig — netto over 30 meter siste fem minutter — legges
kameraet bak posisjonen i bevegelsesretningen, så du ser terrenget du er på
vei inn i. Netto forflytning er valgt med vilje: enkeltfikser hopper flere
meter når man står i ro, men netto går mot null, og da skal kameraet ikke
late som om man er på vei noe sted. Står man stille, beholdes kameravinkelen
man alt har, som en ren innzooming.

---

## 2026-08-09 — v5.2.1: Du er også med i 3D

Har man posisjonering på når 3D åpnes, står man nå selv i terrenget — i både
turvisningen og utforskeren. Markøren snakker samme språk som 2D-kartets
posisjonsprikk: sky-blå kule med hvit kant, og en pulserende ring på bakken
som viser GPS-nøyaktigheten i ekte meter (klampet, så en dårlig fix i tett
skog ikke drukner terrenget). Kula har samme avstandsoverdrivelse som
knappenålene, så man finner seg selv også fra full oversikt. Posisjonen
oppdateres live mens visningen står åpen, og utenfor kartutsnittet skjules
markøren i stedet for å klistres til kanten.

Én detalj var lett å trå feil på: turvisningen kan utvide utsnittet når ruta
går utenfor kartflisa, og da forskyves hele koordinatrommet. GPS-posisjonen
forskyves nå med samme offset, så prikken står der du står — ikke 250 meter
utenfor. Markøren er én delt modul for begge visningene, i tråd med resten av
3D-arkitekturen: neste justering av den treffer begge samtidig.

---

## 2026-08-09 — v5.2.0: Stumper er ikke turmål, og turen venter på deg

Stinettet er fullt av korte blindveier — adkomststumper til parkeringsplasser,
snuplasser og hyttestikk. De hører hjemme i kartbildet og tegnes som før, men
i 3D-utforskeren var de støy: et kryssvalg som tilbyr en 60-meters stump er
ikke et valg, og en tur som starter i en slik stump er over før den begynner.
Nå holder utforskeren dem utenfor. En blindvei kortere enn 100 meter — målt
langs kjeden fram til nærmeste kryss — foreslås ikke som stibytte i kryss,
vinner aldri «rettest fram», og kan ikke starte en tur ved trykk. Et kryss
der eneste alternativ er en stump, meldes ikke som kryss i det hele tatt, så
krysspausen stopper heller ikke der. Er alt som gjenstår i et kryss stumper,
ender turen der. Blindveier på 100 meter eller mer regnes fortsatt som ekte
stier og oppfører seg som før.

Å trykke på en sti starter heller ikke avspillingen lenger. Kameraet glir inn
i følge-posisjonen ved stistart som før, men turen står stille til man trykker
play — og play-knappen pulserer rolig for å si «trykk meg». Det samme gjelder
i krysspausen. Brukere med redusert bevegelse i systeminnstillingene slipper
pulseringen.

Kryssvalgene skriver nå «til høyre» og «til venstre» i stedet for grader.
«Sti 90° av» var teknisk presist og praktisk ubrukelig — særlig når to grener
begge var 90° av, hver sin vei. Retningen regnes relativt til gangretningen,
og svinger over 100° merkes «skarpt», så to grener på samme side også kan
skilles.

---

## 2026-08-09 — v5.1.2: Kryss-knappen inn i raden, og død når stinettet er av

Gaffel-knappen som styrer krysspausen sto alene øverst til venstre. Nå ligger
den i samme knapperad som resten, med teksten «Kryss» ved siden av ikonet —
til venstre for «Kurver», slik at raden leses Pin · Sol/måne · Stier · Kryss ·
Kurver · Lukk. Én detalj er viktigere enn flyttingen: knappen deaktiveres når
stinettet er slått av. Å stoppe i kryss på stier man ikke ser gir ingen
mening, så motoren følger samme regel — pausen gjelder bare når «Stier» er på,
uansett hva Kryss-valget står i. Selve valget huskes som før, så skrur man
stinettet på igjen, er krysspausen tilbake slik man forlot den.

---

## 2026-08-09 — v5.1.1: Krysspause, tempo og tre småting fra første test

Første brukertest av 3D-utforskeren ga tre justeringer. Den viktigste gjaldt
stikryssene: valg-chipen dukket opp og forsvant igjen før man rakk å ta
stilling — ved 128× tempo varer et 150-metersvindu under et sekund. Løsningen
er en krysspause: turen stopper 25 meter før hvert stikryss, og står til man
velger en gren eller trykker play for å fortsette rett fram. Pausen styres av
en egen gaffel-knapp øverst til venstre (en pil som deler seg i to), er på som
standard, og valget huskes mellom økter. Hvert kryss pauser bare én gang, så
play etterpå betyr «rett fram» uten at samme kryss stopper turen på nytt.

Tempoet ble også utilgjengelig i praksis — turen langs en sti gikk i fast
128×. Nå ligger de samme tre trinnene som turvisningen bruker (64×, 128× og
256×) nede til høyre mens en tur pågår, og valget overlever både gren-bytte i
kryss og neste tur i samme økt.

Kartnavnet øverst til venstre er fjernet — det sto der uten å gjøre nytte, og
plassen trengtes til gaffel-knappen.

---

## 2026-08-09 — v5.1.0: Kartet i 3D, ikke bare turen

3D-visningen har vært låst til én planlagt tur siden den kom. Nå åpner den fra
snarvei-raden også, uten rute: hele kartet sett fra sentrum mot nord, i sakte
rotasjon til man tar over. Sporings-snarveien måtte vike for plassen — selve
sporingen er uendret og ligger som før i «Sporing»-fanen under innstillinger.

Det viktige valget ligger under overflaten. Terreng, karttekstur med aktivt
tema, himmel, natt og render-loopen er trukket ut i en delt kjerne som begge
modusene bygger på, i stedet for at utforskeren fikk sin egen kopi. Alle de
gamle 3D-testene går uendret gjennom, og det er nettopp kvitteringen: neste
gang terrenget eller himmelen forbedres, treffer det begge visningene uten at
noen må huske det.

Trykker man på en sti, bygges en tur av stinettet og mates rett inn i det
eksisterende turmaskineriet — samme rutekurve, samme avspilling, samme
følgekamera. Turen starter bort fra kameraet, altså framover i det man ser, og
i kryss vinner stien som går rettest fram. Det er regelen man selv følger når
man ikke har bestemt seg for noe annet, og den gjør at et tett stinett ikke
blir en dialog hver femtiende meter. Er to grener like rette, vinner den
tydeligste stitypen. Krysset meldes likevel i god tid, så man kan velge en
annen vei — da beholdes det man alt har gått, og turen fortsetter derfra.

POI-ene står som knappenåler i fargene de har i kartet. Kulturminne-fargene lå
to steder fra før, i kulturminne-laget og i symboliseringen, og en tredje kopi
til 3D ville betydd at lilla og grått kunne bety ulike ting i to visninger.
Begge leser nå fra én tabell, og en test vokter at ingen skriver hex-verdiene
tilbake inn i kildene. Nålene filtreres i to trinn: sammenfallende nåler slås
sammen én gang ved bygging, og resten går gjennom det samme
skjermrom-budsjettet som kartnavnene bruker — det er hysterese-stabilt, så
nålene slutter å blinke når kameraet beveger seg. Hva som vises styres fra et
minimerbart panel oppe til høyre, og valgene huskes.

---

## 2026-08-09 — v5.0.16: Stinettet er bakt, og MCP fikk lese det

Baken gikk gjennom alle femten fylker denne gangen: 179 706 km sti og traktorveg ligger nå som 208 fliser i repoet, 12 MB på disk. Rundt Trettekollen gir det 161 linjer i kartutsnittet, 44 av dem merkede — området der OSM ikke hadde noen sti i det hele tatt. Med det er stiløftet fullført, og Lende viser stinettet uten tilleggskart.

Underveis dukket det opp en feil verdt å skrive ned: MCP- og headless-bygde kart fikk null N50-stier, helt stille. Node sin `fetch` støtter ikke `file:`-URL-er — den svarer «not implemented... yet...» — og headless pekte nettopp på en fil-URL. Siden uthentingen aldri feiler hardt, så et kart uten stinettet nøyaktig ut som et kart der flisene ikke var bakt ennå. All fillesing går nå gjennom én funksjon som kalleren kan bytte ut, og headless leser flisene rett fra disk. Testen går gjennom hele lesekjeden med ekte fliser, så den fanger regresjonen.

Tallene i kommentarene er rettet mot den faktiske baken. Landsmålingen anslo 200 KB for største flis ut fra et utvalg; den ble 356 KB. Fortsatt godt innenfor, men anslag og målt resultat bør ikke stå og påstå det samme når de ikke gjør det. En test vokter nå størrelsen, så den ikke vokser stille forbi det mobilbrukeren tåler.

---

## 2026-08-09 — v5.0.15: Trøndelag skrives Trondelag

Første bake av stinettet kom gjennom tolv av femten fylker og stoppet på tre: Trøndelag, Østfold og Møre og Romsdal ga alle 404. Grunnen er triviell og selvforskyldt — Geonorge translittererer ø og å i filnavnene, og bake-scriptet erstattet bare mellomrom. Måleskriptet hadde løst dette for lenge siden med flere navnevarianter, men jeg gjenbrukte ikke logikken da jeg skrev baken.

Navnevariantene er nå en delt modul begge bruker, og bake-scriptet prøver dem i tur. En 404 betyr feil skrivemåte og går videre til neste kandidat; alt annet er en ekte feil som stopper.

Vakten oppførte seg som den skulle, og det er verdt å merke seg: tre fylker feilet, og da ble ingenting skrevet. Et stinett uten Trøndelag og Østfold ville sett komplett ut i kartet, og feilen ville først dukket opp den dagen noen gikk tur der. Det er nettopp derfor regelen er alt-eller-ingenting.

De tre fylkene har fått hver sin regresjonstest, så en variant som mangler blir fanget av testene i stedet for av en firemminutters CI-kjøring.

---

## 2026-08-09 — v5.0.14: Trettekollen får stien sin

N50-stinettet er nå koblet inn i kartet. Der Turrutebasen tok de merkede rutene, tar N50 resten — 179 706 km sti og traktorveg, som ligger som statiske fliser ved siden av appen og hentes over samme opprinnelse. Ingen proxy, ingen nøkler, ingen ny driftsflate, og service worker-en cacher flisene offline på kjøpet.

Pakkeformatet bærer merkingen. N50 har `rutemerking` som JA eller NEI per lenke, og det er nettopp skillet mellom ISOM 506 og 507 — samme skille Turrutebasen bruker. Det er pakket inn i høyeste bit av type-byten vi likevel skriver, så det koster ingenting. Traktorveg får 504, samme kode som OSM sin `highway=track`, fordi det er samme slags objekt.

Bake-scriptet laster ned alle fylkene, trekker ut sti og traktorveg fra `typeveg`, forenkler til tre meter, deler i fliser og skriver til `public/data/n50-sti/`. To detaljer er verdt å nevne. Flisene akkumuleres over alle fylker før noe skrives — ellers ville fylke nummer to overskrevet fylke nummer én i en flis som krysser fylkesgrensa. Og feiler ett eneste fylke, skrives ingenting: et halvt stinett ser komplett ut, og det er verre enn ingen endring. Workflowen kjøres manuelt, uten fast tidsplan; N50-stier er stabile data, og OSM er det som fanger opp nye stier raskt.

Uttynningen er trukket ut som delt modul. N50 legges oppå både OSM og Turrutebasen og overlapper begge kraftig, så uten filtrering ville hovedstiene blitt tegnet to og tre ganger med noen meters forskyvning. Underveis kom en feil fram som er verdt å notere: `travelLineGeometries` filtrerte bare på OSM sin `highway`, så Turrutebasens egne tagger falt utenfor og N50 ville tegnet de samme stiene på nytt. Den har nå en egen regresjonstest.

To feil til ble fanget av tester i stedet for av brukeren. `export { x } from …` binder ikke navnet lokalt, så turrutebasenFetcher sin egen bruk av uttynningen ble en ReferenceError ved kjøring — usynlig for enhetstestene, som importerer funksjonene direkte, men integrasjonstesten av kart-flyten tok den. Og klienten filtrerer linjer mot kartutsnittet med både verteks- og segmenttest, fordi en flis er større enn kartet og en lang rett strekning kan krysse utsnittet uten at noe punkt ligger inni.

Klienten feiler aldri hardt: er flisene ikke bakt ennå, eller er man offline, blir kartet som før. Utvikler-fanen viser hvor mange fliser som ble lest og hvor mange strekk som faktisk kom i tillegg etter uttynningen — null nye av mange linjer betyr at OSM allerede dekket området, ikke en feil.

---

## 2026-08-09 — v5.0.12: Landsmåling, ett fylke om gangen

Buskerud landet på 0,8 MB pakket. For å få landstallet må alle fylkene med, og da er spørsmålet hvordan. Å samle geometrien for hele Norge i minnet først ville blitt titalls millioner punkt-objekter uten grunn, for pakket størrelse er additiv: scriptet tar derfor ett fylke om gangen, måler det, kaster dataene og summerer tallene.

Én detalj er verdt å være presis på. Byte og punkter summeres, men flis-tallet må være unionen av flis-nøkler — nabofylker deler grensefliser, og å summere dem ville talt de samme flisene flere ganger. Største enkeltflis er tilsvarende et maksimum, ikke en sum. Fliser som krysser en fylkesgrense får derimot innhold fra begge sider talt hver for seg, så landstallet er en liten overestimering. Det er riktig retning når tallet skal brukes til å dimensjonere.

Format- og projeksjonsvalget er trukket ut så det gjøres per fylke. Det er ikke kosmetikk: Buskerud har verken GML eller SOSI, og et fylkes tilbud kan avvike fra det neste. Samme lærdom som ga fire tomme ordrer, nå håndhevet i koden i stedet for i hodet. Kandidat-URL-ene for landsdekkende fil gates dessuten på områdets egen type, ikke på kommandolinje-flagget, slik at landsmålingen ikke prøver Norge-URL-en én gang per fylke.

Summeringen og formatvalget er rene funksjoner med tester: at unionen av fliser regnes riktig, at største flis ikke blir en sum, at forenklingsnivåene holdes fra hverandre, og at Buskerud får FGDB og ikke GML.

---

## 2026-08-09 — v5.0.11: Feltet heter typeveg

Felt-histogrammet ga fasit på første forsøk. Sti ligger i `typeveg`, med små forbokstaver, og Buskerud alene har 17 568 sti-lenker og 8 531 traktorveger — mot en håndfull i OSM for samme område. Verdi-mønstrene traff riktig, så uttrekket gikk gjennom som det skulle.

Kjøringen krasjet likevel, på et sted som er pinlig enkelt: da jeg fjernet den gamle `STI_TYPER`-konstanten, ble én referanse til den stående igjen i utskriften av objtype-histogrammet. `node --check` validerer syntaks, ikke at navn finnes, så den slapp gjennom. Referansen er borte nå, og feilmeldingene peker på felt-histogrammene i stedet — de er den faktiske fasiten.

Histogrammet ga også to felt vi får bruk for når laget skal bygges: `rutemerking` med JA og NEI, og `vedlikeholdsansvarlig` der DNT står for 2 317 lenker i Buskerud. Det er nøyaktig skillet mellom ISOM 506 og 507, hentet fra dataene i stedet for gjettet. `gangOgSykkelveg` holdes utenfor, som i appen ellers.

---

## 2026-08-09 — v5.0.10: N50 har ingen «Sti»

Format-fiksen virket, og kjøringen kom helt gjennom for første gang: direkte nedlasting svarte 200, 165,7 MB på tretten sekunder, GDAL leste geodatabasen. URL-mønsteret jeg trodde var feil, hadde vært riktig hele tiden — det var formatet som ikke fantes for Buskerud, og GML-URL-en ga derfor 404. Ordre-API-et trengs ikke i det hele tatt.

Så avlivet kjøringen den siste antakelsen. N50 har ingen objekttype som heter «Sti»: av 89 839 features i `N50_Samferdsel_senterlinje` er 89 372 `Veglenke`, og resten Vegsperring, Bane og Stasjon. Sti skilles fra bilveg på et attributt, ikke på objekttypen — og jeg filtrerte på objekttypen.

I stedet for å gjette hvilket attributt det er, klassifiserer scriptet nå på verdien: en feature er sti hvis et hvilket som helst strengfelt har verdien «Sti», traktorveg ved «Traktorveg» eller «TraktorvegSti», barmarksløype ved «Barmarksløype». Mønstrene krever hele verdien, ikke delstreng, slik at «Stikkveg» ikke blir en sti. Samtidig logges verdi-histogram for alle lavkardinalitetsfelt, så neste kjøring viser svart på hvitt hvilket felt det faktisk var — og logges alltid, ikke bare ved feil.

Klassifiseringen er ren og testdekket: sti gjenkjennes uansett feltnavn, bilveg og baneinfrastruktur går fri, og delstreng-fellen er pinnet fast.

---

## 2026-08-09 — v5.0.9: Buskerud har ikke GML

Fire kjøringer på rad la inn en ordre som ble akseptert, fikk referansenummer og forble tom for alltid. Å logge hele område-objektet i stedet for et utdrag avslørte hvorfor på første forsøk: den globale formatlista — FGDB, GML, PostGIS, SOSI — er unionen over alle 373 områder. Per område er utvalget smalere. Buskerud tilbyr bare PostGIS og FGDB.

Vi bestilte GML. Geonorge svarte ikke «ugyldig kombinasjon», men tok imot ordren, ga den et referansenummer og lot den stå tom i det uendelige. Derfor så det ut som en treg kø i to kjøringer, og som et gåtefullt tomt skall i to til.

Formatet velges nå fra områdets egen liste, og projeksjonen fra det valgte formatets liste. FGDB foretrekkes fordi GDAL 3.8 leser File Geodatabase med den innebygde OpenFileGDB-driveren, uten ekstra avhengigheter; PostGIS er en SQL-dump som trenger en database og er siste utvei. Scriptet logger nå også hva som faktisk er tilgjengelig for det området det bestiller, så en tilsvarende mismatch blir synlig med én gang.

Lærdommen er verdt å skrive ned: en union presentert som en liste ser ut som et løfte om at alt i den er gyldig. Det var det ikke, og API-et sa ikke fra. Ordre-taket er samtidig hevet tilbake til ti minutter — nå som kombinasjonen er gyldig, er venting igjen meningsfull.

---

## 2026-08-09 — v5.0.8: Slutt å gjette, be tjenesten om fasit

Fjerde måle-kjøring bommet på alle direkte-URL-kandidatene og falt tilbake til ordre-API-et, som fortsatt svarte med tom fil-liste. To gjettinger på rad som ikke traff er ett signal om at framgangsmåten er feil, ikke bare detaljene.

Så jeg slutter å gjette. Det er én ting jeg aldri har sett på: capabilities' område-objekter logges bare som `type/code — name`, og resten av objektet har jeg antatt bort. Ordren returnerer `files: []` uten å kvittere for ordrelinja i det hele tatt, og den klart mest sannsynlige forklaringen er at område-, format- og projeksjons-objektene bærer nestede felt som ordrelinja må matche — felt jeg aldri har sett fordi jeg logget et utdrag. Nå skrives hele objektet ut for alle tre.

I tillegg kalles `can-download`, tjenesten capabilities peker på. Svarer den nei, er den tomme ordren ikke en feil i forespørselen vår, men en tilgangssperre — og da slutter vi å lete etter feil på vår side.

Ordre-fallbacken er samtidig kuttet til ett minutt. Den er bekreftet død to ganger; den skal bare rekke å vise at den fortsatt er det, ikke koste mer tid.

---

## 2026-08-09 — v5.0.7: Ordren blir aldri klar, så vi går utenom den

Tredje måle-kjøring ga endelig et rent svar, og det var ikke det jeg håpet på: Geonorges ordre-API er en blindvei for N50. 69 polle-runder over 12 minutter, byte-identisk svar hver eneste gang, og responsen kvitterer ikke for ordrelinja i det hele tatt — den echoer bare tilbake e-post og referansenummer. Ordren blir altså akseptert som et tomt skall og blir aldri klar. Det er ikke en kø som jobber seg gjennom, og mer venting hjelper ikke.

Kjøringen ga samtidig det vi trengte for å gå utenom. N50 Kartdata har uuid `ea192681-d039-42ec-b1bc-f3ce04c189ac`, datasettet tilbys i 373 områder på formen `fylke/33 — Buskerud`, og capabilities peker på en `can-download`-tjeneste. Geonorge publiserer åpne data som statiske filer under `/geonorge/Basisdata/`, og det er den veien vi nå prøver først: scriptet prober et sett kandidat-URL-er med HEAD, logger status for hver, og går rett på nedlasting når én svarer. Ordre-API-et står igjen som fallback med et kort tak på fire minutter — nok til å bekrefte at det fortsatt er dødt, ikke nok til å kaste bort en formiddag.

Vi kjenner ikke Geonorges nøyaktige normalisering av fylkesnavn i filnavnene, så scriptet prøver flere varianter: med og uten diakritikk, med understrek og sammenskrevet, og med samiske parallellnavn strippet bort («Nordland – Nordlánnda» blir «Nordland»). Den logikken er ren og eksportert, og nå dekket av tester — inkludert at Værøy blir Vaeroy, at Møre og Romsdal gir alle fire skrivemåtene, og at et enkelt navn som Buskerud ikke blåser opp settet med duplikater.

Underveis kom en bivirkning fram: scriptet kjørte hele nedlastings-flyten ved import, så testfila kollapset på `process.exit` før første test rakk å kjøre. Hovedblokken er nå gatet på at scriptet faktisk startes direkte.

---

## 2026-08-09 — v5.0.6: Et tidstak som ikke kan håndheves er ikke et tidstak

Andre måle-kjøring måtte avbrytes etter 50 minutter uten å ha gitt fra seg én linje diagnostikk — altså forbi sitt eget 45-minutters tak på ordre-klargjøringen. Årsaken er lærerik: ingen av `fetch`-kallene hadde timeout. Polle-loopen sjekker tiden MELLOM rundene, så en forespørsel som henger blokkerer inne i `await fetch` og taket blir aldri evaluert. Grensa fantes på papiret og var virkningsløs i praksis.

Nå har hvert eneste nettkall sin egen frist: 60 sekunder på JSON-kallene, 20 minutter på selve nedlastingen (stor fil, men aldri uten tak). Mekanismen er verifisert mot en TCP-server som aksepterer forbindelsen og så tier — den avbrytes på sekundet med `TimeoutError`, som feilhåndteringen oversetter til en lesbar melding.

Taket på ordre-klargjøringen er samtidig senket fra 45 til 12 minutter, og jobbens bakstopper fra 90 til 45. Et tak som er så langt at ingen orker å vente på det gir ingen diagnostikk; det gir bare en jobb noen må avbryte manuelt. Blir 12 minutter for kort, er det i seg selv funnet vi trenger, og da hever vi det bevisst. I samme slengen logges hele ordre-svaret hver sjette runde, ikke bare den første, så en status som endrer seg underveis blir synlig i stedet for å måtte gjettes i ettertid.

Til slutt en forberedelse på plan B: hele `_links`-lista fra capabilities skrives nå ut. For åpne datasett har Geonorge ofte en direkte nedlastingsrute ved siden av ordre-API-et, og finnes den for N50, slipper vi hele klargjørings-ventingen. Vi vet ikke ennå om den er der — derfor logges alt, og fasit leses ut av loggen i stedet for å gjettes.

---

## 2026-08-09 — v5.0.5: Geonorges ordre-API er asynkront

Første måle-kjøring i CI kom lenger enn ventet og stoppet på ett punkt: bestillingen ble akseptert, men svarte med tom fil-liste. Skriptet antok at nedlastingslenkene fulgte med i POST-svaret. Det gjør de ikke — Geonorge svarer med et referansenummer og en self-lenke, klargjør pakken i bakgrunnen, og filene dukker opp på `GET /api/order/{referanse}` etter hvert. Scriptet poller nå den lenken med romslig tak, tåler forbigående feil underveis, og venter på at hver fil faktisk har fått en nedlastingslenke før den går videre.

Kjøringen bekreftet samtidig resten av antakelsene, som var det den var til for: katalogsøket finner datasettet, capabilities gir områder på formen `fylke/33 — Buskerud`, formatene er FGDB, GML, PostGIS og SOSI, og projeksjonene 25832/25833/25835. Alt dette var gjetninger skrevet i blinde fra en sandkasse uten tilgang til tjenesten, og de holdt.

Det som fortsatt er ubekreftet er hva objekttypene i N50 Samferdsel faktisk heter — `Sti`, `TraktorvegSti` og resten er fremdeles kvalifisert gjetning. Histogrammet scriptet skriver ut vil avsløre dem så snart en nedlasting kommer helt gjennom, og da rettes lista etter fasit i stedet for etter hukommelse.

---

## 2026-08-09 — v5.0.4: Måleverktøy og pakkeformat for N50-stiene

Turrutebasen (v5.0.2) tok en del av hullet, men ikke stien over Trettekollen. Den ligger i N50 Samferdsel, som ikke har noen live WFS — et systematisk søk gjennom Geonorges WFS-applikasjoner bekrefter at N50-vektortjenesten er borte for godt. Dataene må derfor bakes én gang og serveres selv, og da er størrelsen alt: den avgjør om stiene kan ligge som statiske fliser ved siden av appen, eller trenger egen lagring bak proxy-workeren.

Derfor måler vi før vi velger. Dette er ikke selve løftet, men grunnlaget for å ta det riktige arkitekturvalget.

Pakkeformatet er den ekte delen. GeoJSON er sløsing for et stinett: koordinatparet «[10.080351,59.839867]» er 22 tegn, mens samme punkt er et par byte når det kvantiseres til ~1 m, deltakodes mot forrige punkt og varint-pakkes. Målt på syntetiske linjer lander det på 2,06 byte per punkt før gzip, altså over 5× mindre enn GeoJSON. Kvantiseringen til 1e-5 grader er usynlig i praksis: det er ~1,1 m, mens N50 er 1:50 000 der en meter er 0,02 mm på papiret. Formatet deler linjene i fliser på 0,5° × 1,0°, og segmenter som krysser en flisgrense legges i begge nabofliser så det aldri blir en glipe i skjøten når appen tegner to fliser side om side.

Måleskriptet laster ned N50 fra Geonorge, trekker ut sti- og traktorveg-geometrien med GDAL, og rapporterer pakket størrelse ved fem forenklingsnivåer — inkludert største enkeltflis, som er det appen faktisk laster per rute. Det publiserer ingenting.

En ærlig merknad om modenhet: utviklings-sandkassa når ikke nedlasting.geonorge.no, så Geonorges nedlastings-API og N50s objekttype-navn er IKKE verifisert mot ekte tjeneste. Skriptet er derfor skrevet påfallende pratsomt — det logger hva det finner i hvert trinn og dumper hele svaret ved feil, slik at første CI-kjøring blir like mye en kartlegging av API-et som en måling. Feilstien er verifisert: mot den blokkerte verten navngir den både verten og svaret. Pakkeformatet er derimot fullt dekket av tester, inkludert rundtur, kvantiseringspresisjon, korrupt input og skjøtene mellom fliser.

---

## 2026-08-09 — v5.0.3: Meta-hvitelisten spiste diagnose-feltene igjen

Brukeren kjørte v5.0.2 og fikk likevel «ingen status — kartet er bygd før v5.0.2» i Utvikler-fanen. Kartet var ikke gammelt; feltet ble strippet ved lasting. `useMapLoadPipeline` bygger MapViews `meta` fra SVG-ens `data-meta` gjennom en eksplisitt hviteliste, og `turruteStatus` ble aldri lagt til der da Turrutebasen kom. Kommentaren rett over hvitelisten advarte mot nøyaktig dette — den ble skrevet da `appVersion` og `nveInnsjoStatus` forsvant på samme måte i v1.0.45/47 — men en kommentar er ikke en vaktpost.

Under opprydningen viste det seg at feilen hadde skjedd én gang til, ubemerket. `tetthet` og `detaljNivaa` ble innført med tetthets-automatikken i v5.0.0 og heller aldri lagt inn i hvitelisten, så hele tetthets-linja i Utvikler-fanen (`915 /km² · svært tett → sparsom · bredde 8 → 6 km`) har vært tom på alle kart siden den ble laget. Begge feltene er nå med.

Symptomet er lumsk fordi det ser ut som et dataproblem og ikke en kodefeil: kartet er nybygget, appen er oppdatert, og fanen sier likevel «bygd med eldre versjon». Merk at kart bygget med v5.0.2 ikke trenger ombygging — feltet har ligget i `data-meta` hele tiden, det var bare lesingen som kastet det.

Derfor er hvitelisten nå trukket ut som en ren funksjon, `metaFromSvgMeta`, med en test som fanger den neste forglemmelsen automatisk: hvert felt `buildSvg` faktisk sender må enten være med i resultatet eller stå oppført i `META_BEVISST_UTELATT`, og feilmeldingen navngir feltet som mangler. En andre test holder utelatelses-lista ærlig, så et felt ikke kan gjemme seg der etter at det er fjernet fra `buildSvg`. Vaktposten er verifisert ved å fjerne `turruteStatus` igjen og se testen falle.

---

## 2026-08-09 — v5.0.2: Merkede fotruter fra Turrutebasen, og en chat som forstår «gå en tur fra A til B»

Utgangspunktet var en tur mellom Lelangen og Haratjern, opp om Trettekollen (608 moh, Drammens høyeste punkt). UT.no viser en sti der; Lende viste ingenting. Målingen forklarer hvorfor: OSM har 31 linjer i utsnittet, men den nærmeste ligger 478 m fra toppen — det går rett og slett ingen sti til Trettekollen i OSM. Overpass-spørringen vår var ikke problemet; den henter allerede `path`, `track`, `bridleway` og `steps`. Stien finnes derimot i Kartverkets N50 Samferdsel «Sti», som er det UT.no sitt bakgrunnskart tegner, og som ikke har noen live vektor-WFS.

Det vi derimot kan hente live, er Turrutebasen — Kartverkets «Tur- og friluftsruter». WFS-en svarer per bbox med `Access-Control-Allow-Origin: *`, altså CORS-trygg fra GitHub Pages, i motsetning til Sjøkart- og N50-tjenestene. Merkede fotruter hentes nå parallelt med Overpass og legges inn som ISOM 506 når ruta er merket og 507 når den ikke er det — bevisst ikke 505, siden dette er en rute-trasé og ikke nødvendigvis et tydelig tråkk. Kodene er allerede routbare, så rutene kan brukes av Stifinneren.

Uttynningen er det som gjør laget brukbart. 72 % av Turrutebasen ligger oppå stier vi allerede tegner, og uten filtrering ville hver merket rute blitt tegnet to ganger med et par meters forskyvning — en dobbel, uskarp strek langs alle hovedstiene. Ruter som følger en eksisterende ferdselslinje nærmere enn 30 m fjernes derfor, delvis overlappende ruter deles og bare de nye partiene beholdes, og biter kortere enn 60 m droppes så det ikke blir konfetti. Begge sider densifiseres til 10 m før sammenligningen, ellers ville en OSM-way med to fjerne punkter sett ut som fravær av sti. I Trettekollen-utsnittet gir dette 4 nye strekk på 2,6 km av 10,8 km hentet rute. Turrutebasen fyller altså en del av hullet, men den løser ikke Trettekollen — nærmeste nye strekk ligger fortsatt 1,4 km unna toppen. Det krever N50 Sti, som blir et eget løft.

Chatten fikk to nye regler etter en samtale der den bommet tre ganger på rad på en helt entydig bestilling. «Gå en tur fra lelangen til haratjern» ga først tilbud om å søke på nett etter «Lenglangen» — et navn ingen hadde skrevet — så tilbud om å MERKE stedet i stedet for å gå turen, og til slutt at det ikke fantes stier der. Verktøyet den skulle brukt, `foreslaa_tur`, har ligget der hele tiden. Nå står det eksplisitt at «fra X til Y» er en ferdig bestilling som skal utføres med én gang, uten å spørre om lov, uten nettsøk og uten å tilby merking i stedet; og at stedsnavn skal sendes videre ordrett, aldri omskrives fordi de virker ukjente. Merke-regelen viker nå for en tur-bestilling. Det siste svaret i den samtalen var forresten datamessig riktig — nærmeste OSM-linje til Haratjern er ~346 m — så den delen var ærlig, den kom bare etter to bom.

---

## 2026-08-05 — v5.0.1: Chatten kvitterer ikke lenger for handlinger som ikke skjedde

To løgner i samme samtale, begge av klassen «modellen skriver at den har gjort noe». Først «Turen fra Sørenga til Maridalsvannet er tegnet inn i kartet» — men bare den røde og den grønne markøren kom fram, ingen strek. Så «Jeg åpner «Nytt turkart» med Hurum i Asker som senter», uten at det ble opprettet noe kart i det hele tatt; chatten ble stående åpen, og ingenting hadde skjedd. Vaktene fra v4.8.3 og v4.8.9 så ingen av dem, og grunnen er den samme i begge tilfellene: de krevde at svaret inneholdt TALL. Kravet kom av at tall-detektoren alene var altfor grov og spiste ærlige stinett-svar, men bivirkningen var at en påstand uten tall gikk rett igjennom — og det var nettopp den formen som dukket opp her.

Tur-vakten krever ikke lenger tall. `paastaarTegnetTur` er smal nok alene (rute-ord pluss et fullført-verb, med tilbud eksplisitt unntatt), så nå fanges «er tegnet inn» enten det står tall i setningen eller ikke. To presiseringer følger med. For det første: når turverktøyet HAR kjørt, men uten forhåndsberegnet rute, har det bare navigert — ruten regnes ut i kartvisningen etterpå og kan feile der, som den gjorde her. Enhver påstand om at turen er ferdig tegnet byttes derfor ut med den deterministiske teksten, som bare lover det vi vet: at kartet åpnes og ruten beregnes nå. For det andre: vakten står av når kartet faktisk HAR en tegnet tur (`context.aktivTur`), slik at «turen er tegnet inn» fortsatt er et gyldig svar på et oppfølgingsspørsmål.

Den andre løgnen fikk sin egen vakt. Bare `foreslaa_nytt_kart` og `lag_kart` kan opprette et kart eller åpne byggeskjemaet, og begge navigerer bort og lukker chatten — så påstår svaret at et nytt kart er på vei uten at ett av dem har svart ok, er det usant per konstruksjon. Underveis ble en felle avdekket som er verdt å merke seg: JavaScripts `\b` i regulære uttrykk er ASCII-basert, så æ, ø og å teller som ikke-ord-tegn. `/\båpnet\b/` matcher derfor ALDRI « åpnet» — mellomrom og «å» er begge non-word, og da finnes det ingen ordgrense mellom dem. Første utgave av vakten slapp av den grunn gjennom både «Jeg åpner «Nytt turkart» …» og «Byggeskjemaet er åpnet». Ordmatchingen bruker nå `\p{L}`, som kjenner hele alfabetet.

Til slutt to linjer i system-prompten, siden vaktene er et nett og ikke en kur. Den ene forbyr å skrive at en tur er tegnet, et kart opprettet eller en innstilling endret uten ok fra verktøyet som gjør det. Den andre retter noe brukeren så i samme samtale: modellen forsto ikke «Hurumlandet» og ba gjentatte ganger brukeren om å søke opp stedet selv — enda den har `sok_sted` og `sok_i_kartet`. Nå skal den søke selv, og si hva den søkte på hvis navnet måtte tolkes.

---

## 2026-08-05 — v5.0.0: Kartet tilpasser seg datamengden i området

Et 8 km standardkart var 448 KB i Lierne og 5,2 MB i Oslo sentrum — samme innstilling, elleve ganger så mye data, og lagging på mobil i byen. Målingen som satte retningen var likevel en overraskelse: 79 % av filen er `d=`-koordinater, og det suverent største enkeltlaget er `bymasse` (ISOM 522) med 32 % — i Oslo én path med 126 151 punkter. Bymassen bygges som union av akse-justerte, buffer-de bygnings-bbox-er, og unionen av tusenvis av rektangler gir en trappelinje med et hjørne for hver kant-krysning. Trinnene er 1–15 m, altså 0,1–1,5 mm ved 1:10 000, og renderes som en rett strek uansett. Den detaljen er ren kostnad, så den er borte nå: DP-forenkling på 3 m (samme toleranse vegetasjonsgrensene bruker), 200 m² minsteareal som fjerner slivers og mikro-hull, og heltalls-koordinater — flaten har verken strek eller mønster som kan avsløre avrundingen. Det alene tar Oslo fra 5 166 til 4 178 KB og Vardåsen fra 2 711 til 2 224 KB, uten at ett element forsvinner. Bygninger var forresten aldri problemet: laget er 2,1 % av filen.

Oppå det kommer selve automatikken, i to trinn der arealet brukeren ba om er det siste vi gir opp. En billig Overpass-sondering (`out count`, ingen geometri, noen hundre byte) måler datatettheten FØR hentingen starter, og en vektet indeks — bygninger billig, punktsymboler og navn dyrt, fordi hvert av dem blir sin egen DOM-node — plasserer stedet: Lierne 4, Vardåsen 255, Asker 252, Oslo sentrum 915 kostnadsenheter per km². Trinn 1 velger det letteste detaljnivået som holder budsjettet: tette punktlag klynges hardere (bom og bro tynnes for første gang — 1 519 og 845 av dem i Oslo, mot 1 og 1 i Lierne), og støy på et turkart i by droppes (kraftlinjer, `highway=service`-innkjørsler, bygningsnavn, grend-navn, dybdepunkt). Først hvis selv det letteste nivået sprekker, klampes bredden. Oslo 8 km ender dermed på 1 756 KB og 6 km, mot 5 166 KB og 8 km — og **Vardåsen og Lierne beholder full detalj og full bredde**, som er hele poenget: automatikken skal ikke røre områder som oppleves greie i dag. En enhetstest holder «full» innholdsmessig identisk med å ikke ha reglene i det hele tatt, og feiler sonderingen (nett nede), bygges kartet akkurat som før.

Forutsigbarheten ligger i at grensen er synlig og kan overstyres. «Flere valg» sonderer stedet og markerer sonen over anbefalt bredde på slideren med en begrunnelse («Svært tett område — anbefalt inntil 6 km»), men sperrer ingenting: har du sett taket og valgt bredde selv, respekteres valget, og bare detaljnivået justeres. Snarvei-flyten (søk/GPS/«Bygg om») bruker en lagret preferanse på et sted du ikke har vurdert, og får begge trinnene. Utvikler-fanen viser hva som faktisk skjedde («915 /km² · svært tett → sparsom · bredde 8 → 6 km»), MCP-ens `bygg_kart` rapporterer det samme i `tetthetJustert`, og reglene er delt mellom app og MCP i én modul, som ekvidistanse-reglene. Tersklene er kalibrert mot fire ekte områder med `scripts/kalibrer-tetthet.mjs`, som ligger i repoet for å kunne kjøres om igjen.

Til slutt Sjøkart-feilen som dukket opp i samme feilsøking: «wfs.dybdedata app:Lanterne · network-or-cors: Failed to fetch» var ikke CORS. Koden har siden v7.1.9 hatt kommentaren om at lanterner ikke finnes i wfs.dybdedata, men spurte likevel — mot alle endepunkter. Geonorge svarer med en ServiceException uten CORS-header, nettleseren avviser før koden ser status, og feilen ble stemplet `network-or-cors`. Kategorier er nå knyttet til endepunktene de faktisk finnes på, så den permanente feillinja er borte. Tre relaterte fikser fulgte: de elleve kategoriene ble fyrt av samtidig mot samme origin (nettleseren tillater seks), som forklarer hvorfor Sjøkart-feil var *sporadiske* — nå kjøres fire i gangen; `signal` sendes inn, så avbrutt bygging ikke lenger etterlater levende requests som okkuperer tilkoblinger; og `COUNT=5000` uten paginering kunne kutte stille, så statusen sier nå «TRUNKERT» med tallene i stedet for et blankt «OK».

---

## 2026-08-05 — v4.8.12: En elv er ikke en innsjø

Rangeringen fra v4.8.11 gjorde jobben sin, men vinneren i Stormoen ble «Innsjø uten navn (~3,4 km²)» — som er Drammenselva. En bred elv mappes i OSM som `natural=water` + `water=river`, og classifyToIsom gir alt ferskvann som ikke er salt kode 301 «Innsjø». Visuelt er det helt riktig, blått er blått, og ISOM har ingen egen arealkode for elveflate — men semantisk het elva altså innsjø, både i søkeindeksen og for chatten. Elveflater merkes nå `data-vanntype="elv"` i SVG-en (samme predikat som alt hindret N50/NVE fra å undertrykke dem), søket kaller dem «Elveflate uten navn» i stedet, og de holdes utenfor rangeringen av innsjøer — svaret sier hvor mange som ble holdt utenfor, så det ikke ser ut som en feil. Kartet ser identisk ut; merkelappen er det eneste nye. Kart bygget før denne versjonen må bygges på nytt for at elva skal slutte å telle som innsjø — merkelappen skrives ved bygging.

---

## 2026-08-05 — v4.8.11: «Den største innsjøen» er nå faktisk den største

«Største innsjø i kartet» ga Andedammen — omtrent det minste vannet i Stormoen-kartet. Årsaken var at kartsøkets vann-oversikt sorterer navngitte treff alfabetisk, og navngitte vann manglet areal i søkeindeksen helt: bare de navnløse polygonene fikk beregnet flate. Chatten hadde altså ingen størrelse å rangere på, leste rad 1 av en alfabetisk liste, og «A» vant. Nå leses arealet rett fra polygon-geometrien for navngitte vann også (største ring, så øyer og hull ikke blåser tallet opp), oversikten chatten får er sortert på ekte kvadratmeter med største først, og et superlativ tolkes som en rangering i stedet for som et stedsnavn: «marker den største innsjøen» rangerer kartets vann på areal, «høyeste topp» rangerer på moh, mens «Andedammen» fortsatt er et navneoppslag. Svaret sier hvilket sted som vant og hvor mange det ble målt mot, så feilen ikke kan gjenta seg usett.

---

## 2026-08-05 — v4.8.10: Chatten kan merke steder i kartet — på ordentlig

«Kan du merke det» ble besvart med «Vannet Bijjie Gaajsjaevrie er merket i kartet. Koordinater: 64.578764, 13.221365.» — men ingenting var merket. Chatten hadde ikke noe verktøy for markering, så modellen fant på at den hadde gjort det og dumpet koordinatene den satt igjen med fra søket. Nå finnes verktøyet: `merk_i_kartet` setter den rosa, blinkende ringen gjennom akkurat samme kode som når du velger et treff i søkefeltet — navne-LOD-en låses opp, utsnittet panner dit, og ringen pulserer. Oppgi bare stedsnavnet; appen slår det opp i kartets egne navn, søker naboflisene i mosaikken også, og åpner den flisen stedet ligger i om nødvendig. «Fjern markeringen» virker like godt, og modellen tilbyr merking selv etter at den har navngitt et sted. Bekreftelsen skrives deterministisk, så koordinat-dumpen er borte — og påstår modellen merking uten at verktøyet kjørte, blir svaret ærlig i stedet.

---

## 2026-08-05 — v4.8.9: Stinett-svaret får beholde tallene sine

Vakten mot oppdiktede turtall fra v4.8.3 var for grovmasket: den byttet ut ethvert svar som inneholdt et tall med «Jeg fikk ikke tegnet turen, så jeg har ingen tall å gi deg» når chatten ikke hadde sendt en tur til kartet i samme runde. Det rammet nettopp de svarene som var ærlige og korrekte — «Hvor mange kilometer sti i kartet» kjørte stinett-analysen, fikk ekte tall tilbake, og fikk dem kastet på vei ut, uansett hvor mange ganger brukeren spurte. Høyder, kartstørrelser og andre tallsvar gikk samme vei. Vakten krever nå BÅDE tall og en påstand om at turen faktisk er tegnet inn (vurdert setning for setning, så tilbudet «si fra hvis du vil ha turen tegnet inn» ikke gjør hele svaret til en løgn), og den holder seg unna svar der en fersk stinett-analyse ligger til grunn.

---

## 2026-08-03 — v4.8.8: Målingen er inne — api.ra.no er nede, og deployen skal ikke velte av det

Røyktesten i v4.8.7 gjorde jobben sin: fra CI, med rent nett, svarte `api.ra.no` vekselvis 404 og 502 gjennom tolv forsøk. Det avkrefter både CORS og mobilnettet — tjenesten selv er ustabil eller på vei ned. Kulturminne-laget viser `(!)` til Riksantikvaren er tilbake, og ingenting på klient-siden kan endre det.

Men røyktesten hadde to feil, og begge er rettet. Den **feilet hele deployen** når en tredjepart var nede, noe som ville blokkert enhver framtidig endring i Workeren så lenge `api.ra.no` er ute. Kulturminne-steget rapporterer nå utfallet som warnings og lar jobben gå videre; NVE-ruta og «er det vår worker som svarer»-sjekken feiler fortsatt hardt, for de er våre.

Den andre feilen var at meldingen «Kunne ikke nå api.ra.no (502 fra Workeren)» var direkte gal. 502-en kom *fra* `api.ra.no`, som selv ligger bak Cloudflare og returnerer feilsider som ligner Workerens egne — kroppen var Cloudflares `error code: 502`, ikke vår norske tekst. Workeren skiller nå de to: får den ikke opp forbindelse i det hele tatt svarer den **599** med `X-Lende-Upstream: unreachable`, mens en speilet feil får opphavets status og `X-Lende-Upstream: <status>`. Årsakene er helt ulike og skal ikke se like ut.

Samtidig var 404-sjekken i røyktesten ikke diagnostisk: Cloudflare gir sin egen 404 for et workers.dev-navn uten worker, og den er ikke til å skille fra vår på statuskode alene. Den sjekker nå at CORS-headeren er med, som bare vår kode setter.

Verdt å merke: `wrangler deploy` lyktes hele veien i v4.8.7 — Workeren ble opprettet, secreten lastet opp og `workers_dev` slått på. Det var bare røyktesten som konkluderte feil.

---

## 2026-08-03 — v4.8.7: Kulturminner går via proxyen, som nå deployer seg selv

Diagnostikken fra v4.8.6 svarte: Håøya ga **«Kulturminner (!)»**, altså at ingen side kunne hentes i det hele tatt. Utropstegnet skiller ikke nedetid, endret path, mobilnett eller CORS — så kulturminne-hentingen går nå via Cloudflare-proxyen, som dekker alle fire. En tidligere kommentar i `kulturminneFetcher.js` slo fast at CORS var verifisert (`access-control-allow-origin: *`); det kan ha vært sant da, men holdt ikke, og et CORS-avvist `fetch` ser ut som en helt vanlig nettfeil fra JavaScript.

Proxyen er den eksisterende NVE-Workeren, ikke en ny: ruting på path, `/api/v1/Stations|Observations` → HydAPI og `/brukerminner/*` → `api.ra.no`, alt annet 404. Rutene er uavhengige — `NVE_HYDAPI_KEY` sjekkes kun på NVE-ruta, så en manglende nøkkel stopper ikke kulturminner og omvendt. Siden den nå speiler mer enn NVE, er den døpt om fra `lende-nve-proxy` til `lende-proxy`, og mappa fra `cloudflare/nve-proxy/` til `cloudflare/proxy/`. Eldre CHANGELOG-poster bruker det gamle navnet.

To detaljer som måtte løses. OGC API Features paginerer med **absolutte** `links[rel=next]`-URL-er mot `api.ra.no`, og klienten følger dem — uten omskriving hadde side 1 gått via proxyen og side 2 rett til opphavet, altså feilet igjen. Workeren skriver derfor om `links[].href`, men bare dem: bilde-URL-er og `linkkulturminnesok` skal peke dit de peker. Og opphavets statuskode speiles i stedet for å bli maskert som 502, så en 404 fortsatt leses som «endepunktet er flyttet». Svar caches i ett døgn — datasettet er brukerregistrerte kulturminner som endrer seg over dager, og cachen er det som faktisk fjerner mobil-timeoutene som bakte 0 kulturminner inn i kartene.

Viktigst for vedlikeholdet: Workeren har fått **egen deploy-workflow** (`deploy-proxy.yml`), slik `ai-worker` og `mcp-worker` alt hadde. Den ble tidligere satt ut ved å lime kode inn i Cloudflare-dashbordet — tungt når man jobber fra mobil, og nødvendig på nytt ved hvert navnebytte. Nå er git push eneste steg, og NVE-nøkkelen bor i GitHub-secreten `NVE_HYDAPI_KEY` i stedet for å måtte tastes inn manuelt. Røyktesten sjekker at ukjente stier gir 404, at NVE-ruta svarer, og at kulturminne-ruta slår opp Håøya — og skriver utfallet som en notice i loggen. Det siste er selve målingen vi ikke fikk gjort fra sandkasse eller mobil, siden CI har full nettverkstilgang: står det `numberMatched > 0`, var feilen CORS eller mobilnettet; står det 0, har Håøya rett og slett ingen brukerminner.

---

## 2026-08-03 — v4.8.6: Kulturminne-badgen slutter å lyve om hva den vet

«Kulturminner (0)» på Håøya leste som om funksjonen var fjernet fra appen. Den var ikke det — laget, det rektangulære tempelfasade-symbolet, detalj-skuffen og en live runtime-fallback ligger alle der de skal. Problemet var at badgen ikke kunne skille tre helt ulike utfall, og viste «(0)» for alle: at kartet ble bygget uten innbakte ikoner (bygge-tids-hentingen glipper rutinemessig på mobil), at tjenesten svarte og området faktisk er tomt, og at hentingen feilet.

Roten satt i `kulturminneFetcher.js`: `safeFetchJson` svelger enhver feil og gir `null`, så `fetchKulturminner` returnerte `[]` både for et tomt område og for en død tjeneste. Ny `fetchKulturminnerMedStatus()` returnerer `{ items, status, truncated }` der status er `ok`, `feilet`, `avbrutt` eller `ugyldig-bbox` — «svarte tjenesten i det hele tatt» avgjøres av om vi fikk minst én side. `fetchKulturminner` er beholdt som en tynn wrapper, så bygge-flyten er urørt.

Badgen har nå tre tegn for tre utfall: `(–)` betyr «ikke hentet ennå», `(0)` at tjenesten svarte og området er tomt, og `(!)` i ravgult at hentingen feilet — med forklarende tooltip på alle tre. Antallet innbakte ikoner settes til `null` framfor `0` når kartet ikke har noen, siden runtime-fallbacken kan fylle det inn etterpå.

Verdt å vite: feil-tilstanden bruker opp til ~38 sekunder på å slå inn, fordi hentingen prøver tre ganger med 12 s timeout og 600 ms backoff. Den tålmodigheten er tilsiktet — et enkelt timeout ved bygging bakte tidligere 0 kulturminner inn i kartet — men det betyr at `(–)` kan stå en stund på dårlig nett før den blir `(!)`.

Ingen endring i hva som hentes eller vises. Dette gjør bare appen ærlig om hva den vet, så neste kartlast på Håøya svarer på om tjenesten er nede eller om øya rett og slett ikke har registrerte brukerminner.

---

## 2026-08-03 — v4.8.5: 3D-visningen ser utover landskapet, og natthimmelen får måne

Slo man på POI etter at avspillingen var ferdig, spilte visningen seg gjennom hele severdighets-lista mens posisjonen låg på mål — kameraet rammet inn et sted, returnerte til punkt B, rammet inn neste. Årsaken var at direktørens peker-indeks aldri hadde flyttet seg: `tick()` returnerer før den avanserer når POI er avslått, så indeksen sto på 0 gjennom hele turen. Nå gjør to ting det umulig. Direktøren synkes til faktisk posisjon når POI slås på, så bare severdigheter man ennå ikke har passert kan utløses — slås POI på midt i turen, gjelder det resten av den. Og direktøren kjører bare mens turen faktisk spiller, så en pauset eller fullført visning trigger ingenting. Tar turen slutt midt i et POI-stopp, avsluttes holdet så kortet ikke står igjen. Scrubbing viser POI-kort som før, via sin egen vei.

Følg-kameraet ligger nå mye lenger unna: 420 m bak og 260 m opp mot 220/140, altså rundt 490 m fra turpunktet mot 260 før. Poenget er å se UTOVER landskapet med posisjonen og av og til mål-nåla i bildet, i stedet for å ligge tett på den røde streken uten oversikt. Avstanden tilpasser seg dessuten bratthet: høydespennet i et 700 m vindu rundt posisjonen skalerer avstanden opp mot 1,8× der ruta bretter seg mye opp og ned, dempet mykt så den ikke rykker. Dempingen er samtidig løsnet fra λ 3/5 til 1,5/2,5 — med kameraet så langt bak trengs ikke tett sporing, og ved 256× rykket bildet før i hver sving fordi blikkpunktet nådde fram nesten momentant. Nå glir det.

I nattmodus henger det en dus måne på himmelen og 160 bitte små gule stjerner. Stjernene er ett `Points`-objekt uten tekstur og med `sizeAttenuation` av, så de holder samme pikselstørrelse uansett hvor kuppelen er og koster én draw call. Månen er en myk radiell gradient uten skarp kant. Samtidig er en gammel feil rettet: `Immersive3DViewer` manglet `isDark` i prop-deklarasjonen selv om MapView har sendt den hele tiden, så nattmodus startet aldri av seg selv i mørkt tema slik den skulle. Nå gjør den det — og da er det månen man møter.

---

## 2026-08-03 — v4.8.4: Verktøykallet på siste runde blir utført, ikke skrevet ut

«lag tur fra Bondivann stasjon til Vardåsen 349 meter over havet» ga verken rute eller 3D-visning, men et selvsikkert svar om at turen var 11,9 km med 349 høydemeter og 3 timer 11 minutters gangtid. Ingenting av det var sant, og hele kjeden hang i én spiker: verktøykallet ble skrevet ut som tekst i chatten i stedet for å bli utført — `[foreslaa_tur(kartId="…", fraNavn="Bondivann stasjon", tilNavn="Vardåsen")]` sto der ordrett.

Årsaken var at `chatOnce` utledet navnelista til tekst-tolkingen fra `tools`-argumentet. Vi slutter med vilje å tilby verktøy på siste runde, og da ble lista tom — hvorpå `parseTextToolCalls` returnerte umiddelbart og lot teksten stå. Tolkingen falt altså ut nøyaktig der den trengtes mest. Navnelista er nå en egen `toolNames`-parameter som sendes i ALLE runder, uavhengig av hva modellen tilbys.

Runde-budsjettet er hevet fra 4 til 6. Å skille navnebrødre koster runder: «Vardåsen» finnes flere steder i Asker, så modellen brukte opp budsjettet på `sok_i_kartet` før den rakk `foreslaa_tur`. Neurons koster lite (10 000 per døgn gratis, deretter $0,011 per 1000), så taket koster ventetid framfor penger — 6 gir rom for et par oppslag før handlingen uten at en løkke lar brukeren vente et halvt minutt. Viktigere er at taket ikke lenger kan svelge en handling: har modellen ett kall på bordet når taket nås, blir det utført og samtalen avsluttet, i stedet for at kallet forsvinner stille. Taket verner mot at modellen går i løkke, og et allerede formulert kall er ingen ny runde.

Til sist er løgn-vakten utvidet. `harOppdiktedeTurtall()` kjente setningen igjen hele tiden, men var gatet på at en tur FAKTISK var sendt — så da ingen tur ble sendt, slapp tallene rett gjennom. Nevner svaret nå lengde, stigning eller gangtid uten at en tur er beregnet, erstattes det med en ærlig beskjed som samtidig tipser om at flere steder kan hete det samme. Bonus: 3D-oppfølgingen virker igjen av seg selv, siden «Ja» krever et `sisteTur` som bare settes når kallet kjøres.

---

## 2026-08-03 — v4.8.3: Menyen viker for modalen, og slettknappen slutter å skrike

«Mine kart» åpnet som modal *oppå* den åpne hovedmenyen, så du satt igjen med to lag og to lukke-kryss samtidig: menyens hamburger-X øverst til venstre og modalens X øverst til høyre. Ingenting sa hvilket som gjorde hva, og menyens innhold skinte gjennom bak modalen. Nå lukker menyen seg når en modal åpnes — ett lag, ett kryss. Det gjelder alle menyens modaler (Mine kart, Mine ruter, Nytt turkart, Tegnforklaring, Om), ikke bare «Mine kart»: å fikse én ville gitt halvparten den ene oppførselen og halvparten den andre. Modalen var før gatet på `menuOpen`, så gaten er fjernet og rute-endring rydder nå modalen i tillegg til menyen — den kan stå åpen på egen hånd.

«Slett alle kart» var en solid `bg-red-600`-flate med hvit skrift over full bredde, og ble dermed det mest dominante elementet i hele panelet — en sjelden og destruktiv handling som ropte høyere enn «Lag nytt kart». Den er nå tonet rød med kant og et søppelbøtte-ikon, samme mønster som resten av appens aksentknapper (`bg-*-500/15` + `border-*-400/40` + `text-*-100`, der 100-skyggen remappes til mørk rød i lyst tema av `style.css`). Fortsatt utvetydig destruktiv, men den tar ikke lenger blikket først. Samme behandling på «Slett alle ruter». Feil-toasten i kartvisningen beholder solid rød — den *skal* fange blikket.

---

## 2026-08-03 — v4.8.2: Én Lende-knapp, ett anker, én ark-regel

Lende-knappen lå nede til høyre i alle visninger, men var i praksis tre forskjellige knapper: turkartet hadde sin egen 48 px-klynge som ble løftet til `calc(45dvh + 0.75rem)` når Innstillinger åpnet, ruteplanleggingen fikk den globale 56 px chat-FAB-en som la seg rett oppå «Finn grusrute» i skuffens footer, og innholdssidene en tredje variant. Samme knapp byttet altså størrelse, posisjoneringsmodell og gestespråk mens du navigerte. Nå er den én komponent (`FabCluster`) med ett gestespråk overalt: tap viser kart-knottene, lang-trykk åpner Lende-chatten. Knott-plassene betyr klasse av ting og ikke fast inventar — nord «legg kartet der jeg trenger det», nordvest «hva kartet tegner», vest «hvordan kartet ser ut» — så turkartets tre (Sentrer/Strek/Relieff) og planleggerens to (Vis hele ruten eller Sentrer på min posisjon, og Kartlag) deler samme mentale modell uten å måtte være like mange.

Ark-regelen er nå én setning: knappen står fast nederst, dokker rett over en minimert peek-kant, og forsvinner når arket er dratt opp. Det fjernet to feil på én gang. `45dvh`-løftet var galt i to av tre ark-tilstander — ved 138 px peek løftet det knappen langt over skuffkanten, og midt i et drag flyttet den seg ikke i det hele tatt — og infopanelet dekket klyngen helt stille, fordi begge lå på `z-40` og arket kom senere i DOM-en uten at noen kode sa det. `useFloatAboveSheets` mates nå med alle arkene, også Kulturminne og Vannmålestasjon som aldri var med i den ad hoc-e gjensidige utelukkelsen, og avleser `visibleHeightPx` kontinuerlig i stedet for `isMinimized` (som bare settes ved snap). Er vinduet bredt nok til at det står ≥ 132 px kart ved siden av den 700 px brede skuffen, står knappen fast nederst i margen og vandrer ikke i det hele tatt.

Ruteplanleggingen ble ryddigere av det: fit-rute-FAB-en er nå nord-knotten, Kartlag-knappen nede til venstre er nordvest-knotten, og den globale chat-FAB-en er borte derfra — to hjørner tømt, mer kart. Kartlag-panelet blir liggende nede til venstre, siden det er 194 px bredt og ville lagt seg under klyngen. Zoom `+`/`−`/`z11` står bevisst igjen øverst til høyre: det er visningens mest gjentatte handling, zoomen her er elleve diskrete nivåer uten dobbelt-tap-zoom-ut, og å bruke to av tre knott-plasser på én funksjon ville brutt symmetrien med turkartet framfor å skape den. Er grusvei-laget zoom-gatet, dimmes Kartlag-knotten i stedet for å forsvinne, og et tap sier hvorfor.

Gest-håndteringen er samlet i `useLongPress`, som bevarer de to tingene som var lært av ekte enheter: `pointercancel` er en release og ikke en abort (Samsung Internet sender den i stedet for `pointerup` når knappen krymper — uten dette hoppet relieff-knotten over et hakk), og `settled`-vakten gjør committen idempotent. Nytt er at et drag forbi 10 px avbryter trykket, så et lite skli på ankeret ikke lenger veksler klyngen. Lang-trykk var ellers en usynlig gest: ankeret får nå en ring som fyller seg over de 600 ms, en engangs-boble som sier «Hold inne for å spørre Lende», og et «Spør Lende»-valg i hovedmenyen — den ruten en skjermleser-bruker faktisk finner. Alt tre er gatet på invitasjonstokenet, så uinviterte ser fortsatt ingenting. Uten token armeres ingen hold-timer, ingen ring vises, og chat-setningen faller ut av `aria-label` — men ankeret blir stående, for det eier kart-knottene og har alltid en funksjon.

---

## 2026-08-03 — v4.8.1: Kartlag-knapp og attribusjon ligger fast nederst på desktop

I Ruteplanleggeren red Kartlag-knappen nede til venstre og attribusjonen nede til høyre på overkanten av planlegg-skuffen, så de hoppet oppover hver gang skuffen ble dratt eller åpnet. Skuffen er maks 700 px bred og midtstilt, så på desktop står det igjen synlig kart på hver side av den — der skal disse elementene ligge fast nederst, slik linjalen og OSM-kreditten gjør i turkartet. Terskelen er per element: hvert element ligger fast først når det får plass i kartmargen ved siden av skuffen, ellers følger det overkanten som før, så ingenting kan havne under skuffen. Målt i nettleser trenger knappen 60 px marg (fra ~820 px vindusbredde), attribusjonen 108 px (fra ~915 px) og det åpne lag-panelet 214 px (fra ~1130 px). Attribusjonen får kartmargen som maks-bredde når den ligger fast og brytes høyrestilt over et par linjer i stedet for å bli klippet av skuffen. På mobil er margen null, og alt oppfører seg akkurat som før.

---

## 2026-08-03 — v4.8.0: Toppdekket avgjør hvilket ruteforslag som er forhåndsvalgt

Etter tilbakemelding om at planleggeren «velger fast dekke dersom det finnes mellom A og B» er to ting rettet. Forhåndsvalget var låst til «balansert»-profilen — den av de to egne profilene som straffer asfalt minst — så på strekninger der forslagene skilte seg fikk brukeren asfaltruta servert som standard i en grusruteplanlegger (målt Vikersund–Kongsberg: 5 % grus forhåndsvalgt mens «mest grus»-forslaget lå på 35 %). Nå velges forslaget med høyest grusandel, uavhengig av lengde og tid; de andre er fortsatt ett trykk unna. I tillegg var `nosurface` i begge BRouter-profilene skrevet slik at den betydde «surface finnes, men er verken fast dekke eller grus» — altså sand og gress — i stedet for «mangler surface-tag». Hele distrikts-Norge-heuristikken for umerkede småveier var derfor død kode siden v4; målt på ekte OSM-data i Modum/Sigdal/Flesberg/Kongsberg mangler 69 % av 6091 km kjørbar vei surface-tag. Rabatten er nå gatet på «Inkluder antatt grusvei», fordi den ubetinget utkonkurrerer BEKREFTET grus (en kort umerket vei til 1.8 slår en lengre tagget grusvei til 1.0): med avhukingen av er oppførselen uendret, med den på gir «Mest grus» 43,6 % bekreftet grus mot 39,4 % før. Profilversjonen er bumpet til 8, så cachede profil-id-er lastes på nytt.

Målingene er gjort ved å bygge veigrafen fra Overpass og kjøre profilenes kostfunksjon som Dijkstra lokalt, siden brouter.de ikke er nåbar fra CI-sandkassen. Et sidefunn derfra er notert i profil-toppteksten: å skru asfalt-straffen opp fra 4.5 til 6.5–9 ga ikke mer grus, bare lengre ruter — grusandelen begrenses av hvor mye grus som finnes og er tagget, ikke av vektene.

---

## 2026-08-02 — v4.7.1: Tema-bytte skjer nå faktisk — deterministisk ruting

«Bytt til curves» ga «Karttema endret til curves.» uten at kartet skiftet farge. Verktøyet og tolkingen var i orden (alle nøkler og etiketter treffer, også Petrol → mono-slate), men modellen bekreftet uten å kalle det — samme mønster som «Dark mode er aktivert» i v4.6.0, bare vanskeligere å oppdage fordi svaret så riktig ut. En klar bestilling av et bestemt tema håndteres derfor nå deterministisk i klienten, som stinett-spørsmål (v4.3.9) og 3D-oppfølging (v4.4.1): temaet byttes før modellen spørres, og svaret skrives fra det som faktisk skjedde. Spørsmål om hvilke temaer som finnes rutes bevisst IKKE hit — der svarer modellen med verktøyets liste, som den allerede gjorde riktig.

---

## 2026-08-02 — v4.7.0: Chatten styrer kartlagene

Nytt verktøy styr_kartlag lar chatten skru lag av og på enkeltvis («skjul navnene», «slå på parkering»), vise bare et utvalg («vis bare stier og høydekurver»), bytte forhåndsvalg (Tur, Padling, Detaljert, Print) eller nullstille til standard. Kalt uten argumenter svarer det med hele laglista og hva som er synlig akkurat nå, så modellen kan spørre i stedet for å gjette. Lagnavn tolkes norsk-tolerant: både nøkkel («kontur»), etikett («Høydekurver») og omtrentligheter («hus» → Hus og hytter) treffer, og myke bindestreker i etikettene ignoreres.

I motsetning til kart-temaet er lag-synligheten eid av kartvisningen — den nullstilles per kart, kan komme fra init-prefs, og monokrome temaer skrur den om automatisk. Tilstanden er derfor ikke flyttet: MapView publiserer gjeldende lag til en liten bro (useMapLayerControl) og plukker opp ferdig utregnede kommandoer derfra, så alle de eksisterende reglene står urørt. Er ingen kartvisning åpen, sier verktøyet ærlig fra i stedet for å late som.

---

## 2026-08-02 — v4.6.0: Chatten kan bytte kart-tema — og dikter ikke lenger opp verktøy

«Bytt til Dark mode» ga «Dark mode er aktivert» uten at noe skjedde, og andre forsøk ga «[vis3d(false)]» rått i chatten. Modellen hadde ikke noe verktøy for kartets farger, så den påsto først at den hadde gjort jobben og fant deretter opp et «verktøy» av et parameternavn. Begge deler er rettet: nytt verktøy bytt_kart_tema kobler chatten til appens tema-singleton (samme tilstand som menyens mørk-bryter og Tema-fanen), med norsk-tolerant tolking av ønsket («mørkt», «dark mode», «nattkart», «tilbake til vanlige farger») og listing av alternativene når temaet ikke er oppgitt.

Tekst-tolkingen fra v4.4.1 fjerner nå også klammeformen når navnet IKKE er et kjent verktøy — den er uansett aldri noe brukeren skal se. Prosa med vanlige parenteser er urørt; det er klammene som markerer et kall. Systemprompten sier i tillegg at en innstilling aldri skal meldes endret uten at et verktøy har svart ok.

---

## 2026-08-02 — v4.5.1: Infopanelets tips peker riktig, og frister med chatten

Oppdagbarhets-tipset i infopanelet sa at de tre knottene ligger «nede til høyre» — de åpner nå fra Lende-knappen (FAB-klyngen, v4.3.1), så teksten er rettet til å beskrive den veien. Inviterte får i tillegg et eget Chat-avsnitt under, med tre konkrete eksempler på hva de kan spørre om («Hvor mange km sti er det her?», «gå en tur fra parkeringa til toppen», «lag et kart over Sirikjerke») — poenget er å vise at chatten faktisk gjør noe i kartet, ikke bare svarer med ord. Avsnittet er gatet på chat-tokenet, samme gate som Lende-FAB-en, så uinviterte ser fortsatt ingenting om funksjonen.

---

## 2026-08-02 — v4.5.0: «Lag et kart over X og gå en tur fra A til B» — i én setning

Chatten kan nå ta hele bestillingen i ett jafs: lag_kart tar turFraNavn og turTilNavn, og turen tegnes inn av seg selv så snart kartet er ferdig bygget. Nøtten var at kartet ikke finnes når chatten svarer, så koordinatene kan ikke slås opp på forhånd — i stedet følger NAVNENE med som tfn/ttn gjennom byggeflyten (kartvelgeren videreformidler dem til det nye kartet), og MapView løser dem mot kartets egen søkeindeks med findByName når stiene er tegnet. Terreng-først-bygging gjør at indeksen kommer sent, så gjenskapingen prøver på nytt hvert halve sekund i inntil 12 sekunder — samme tålmodighet som kryss-flis-ruting allerede hadde. Er brukeren ute etter 3D også, åpnes den til slutt.

Virker både med lag_kart (bygger med én gang) og foreslaa_nytt_kart (brukeren trykker bygg selv) — bestillingen overlever i begge tilfeller.

---

## 2026-08-02 — v4.4.3: Kartbygging geokoder selv, og verktøykall lekker ikke lenger ut i teksten

«Lag et kart over Sirikjerke i Øvre Eiker» åpnet byggeskjemaet på Stormoen — modellen gjenbrukte koordinatene fra kartet den nettopp hadde snakket om. Samme rotårsak som Krokekra-turen i v4.4.2, og samme kur: lag_kart og foreslaa_nytt_kart tar nå imot «sted» (stedsnavnet slik brukeren sa det, gjerne med kommune) og geokoder det selv. Koordinater er ikke lenger påkrevd, og kartnavnet arves fra stedsnavnet.

Samme skjermbilde viste «[mine_kart_og_ruter()]» som synlig chat-tekst. Tekst-tolkingen fra v4.4.1 kjørte bare når tool-kanalen var tom, og her gjorde modellen ett ekte kall OG skrev det neste som tekst i samme svar. Nå kjører tolkingen alltid, og de to settene slås sammen (duplikater lukes ut).

Til slutt: modellen forsøkte å bygge kart og tegne tur i samme svar. Kartet finnes ikke før byggingen er ferdig, så både verktøybeskrivelsen og systemprompten sier nå at dette er to steg — chatten skal starte byggingen, si fra at den tar 15–60 sekunder, og tegne turen når kartet er oppe.

---

## 2026-08-02 — v4.4.2: Turverktøyene slår opp stedsnavn selv

«Jeg fant Krokekra i dette kartet, men det ligger veldig langt utenfor kartet» — en selvmotsigelse som avslørte hva som skjedde: modellen fant stedet med sok_i_kartet, men sendte deretter koordinater fra et annet oppslag (sok_sted treffer navnebrødre i hele Norge) til foreslaa_tur, og mosaikk-vaktposten stanset turen. Begge stedene lå i samme kart hele tiden. Nå tar foreslaa_tur og foreslaa_rundtur imot STEDSNAVN (fraNavn/tilNavn, origoNavn/viaNavn) og slår dem opp i kartets egne navn med samme søkeindeks som søkefeltet — koordinater er ikke lenger påkrevd, og modellen kan ikke lenger blande inn feil punkt. Oppgitte koordinater brukes fortsatt når navn mangler eller ikke finnes, og vaktposten står som før. Vaktpostens feilmelding ber nå eksplisitt om et nytt forsøk med stedsnavn i stedet for å foreslå et nytt kart.

Søket i én kartflis er samtidig løftet ut av sok_i_kartet til en delt hjelper, så navneoppslaget i turverktøyene bruker nøyaktig samme kodevei.

---

## 2026-08-02 — v4.4.1: «Se ruta i 3D» virker — verktøykall i teksten tolkes

«Se ruta i 3D» ga `[foreslaa_tur(fraLat=59.747514, …, vis3d=true)]` som synlig chat-tekst, mens «se ruten i 3D» virket. Årsaken var ikke ordformen: Llama-modellene faller av og til tilbake til å SKRIVE verktøykallet i svaret i stedet for å bruke tool-kanalen, og da ble handlingen aldri utført. Klienten tolker nå begge de observerte tekstformene — bracket-formen `[navn(k=v)]` og JSON-bloben `{"name": …, "parameters": …}` — til ekte verktøykall og fjerner dem fra teksten. Bare deklarerte verktøynavn godtas, så vanlig prosa med parenteser er urørt.

I tillegg er 3D-oppfølgingen gjort deterministisk: chatten husker turen den nettopp sendte til kartet, så «se ruta i 3D», «vis løypa i 3-D» eller bare «ja takk» rett etter tilbudet åpner nøyaktig den turen i 3D — uten at modellen må gjenskape koordinatene fra historikken. Systemprompten nevner nå også at bokmål har flere bestemte former (ruta/ruten, løypa/løypen).

---

## 2026-08-02 — v4.4.0: Ekte rutetall i chatten — turen beregnes før den tegnes

v4.3.12 stanset oppdiktede rutetall ved å nekte modellen å nevne tall i det hele tatt. Nå får chatten de ekte i stedet: foreslaa_tur og foreslaa_rundtur beregner ruten mot kartets egen lagrede SVG FØR de navigerer — samme graf-parametre, samme snap-terskler og samme rutevalg (indeks 0) som Stifinneren bruker i kartvisningen, og stigning fra kartets eget DEM med samme sampleProfile. Svaret blir «Turen er 4,7 km, 180 høydemeter stigning og omtrent 1 t 14 min gangtid. Den tegnes inn i kartet nå.» — skrevet deterministisk fra tallene, så modellen ikke kan forskyve dem. Ligger målet 150–400 m fra stinettet følger merknaden med i samme setning.

Bonus: forhåndsberegningen fanger «ingen sti i nærheten» før navigering, så chatten sier det ærlig i stedet for å åpne kartet til en feilmelding. Kan den ikke gjøres trygt (punkt i en naboflis, kart uten geodata) faller vi tilbake til v4.3.12-oppførselen uten tall. Snap-tersklene og de routbare ISOM-kodene er samlet i routing.js som én kilde til sannhet — MCP-verktøyene planlegg_rute/planlegg_rundtur har returnert samme tall hele tiden, så chatten tar igjen MCP-flaten.

---

## 2026-08-02 — v4.3.12: Turer til vann og topper uten sti — og ingen oppdiktede rutetall

«Tur fra Stormoen til Stordammen» feilet med «Ingen sti eller vei i nærheten av målet — nærmeste 158 m (maks 150)»: et mål plukket fra kartets egne navn er ofte en flate-sentroide, og for en innsjø lander den midt på vannet. Snappingen er nå to-trinns — innen 150 m er treffet stille som før, mellom 150 og 400 m rutes det dit stinettet kommer nærmest MED en merknad i Stifinner-banneret («Ruten går så nær som stinettet kommer — målet 158 m fra nærmeste sti»), og først over 400 m er det ærlig feil. Connector-streken viste alltid gapet; nå blir turen faktisk tegnet. Samme mekanikk fanger topper uten sti og holmer.

Samtidig: chatten påsto «Turen er tegnet inn … 4,7 km … 180 høydemeter … 1 time 14 minutter» for en tur som aldri ble beregnet. Turverktøyene navigerer bare — ruten beregnes i kartvisningen etterpå — så verktøysvaret KAN ikke inneholde slike tall. Nevner modellen dem likevel, er de diktet opp, og svaret erstattes nå med en ærlig bekreftelse («Jeg åpner kartet og beregner turen nå — lengde, stigning og gangtid vises i kartet»). Samme deterministiske mønster som stinett-svarene i v4.3.10.

---

## 2026-08-02 — v4.3.11: Lende-chat bytter modell til Llama 4 Scout

Llama 3.3 70B viste seg beviselig upålitelig på funksjonskalling — samme spørsmål ga korrekt verktøykall den ene gangen og hermetisk engelsk avvisning den neste, og til slutt dumpet den verktøykall som råtekst med hallusinerte koordinater. Chatten bytter til @cf/meta/llama-4-scout-17b-16e-instruct: nyere funksjonskalling, samme chat-completions+tools-form (drop-in, ingen klientendring), og omtrent halvert neurons-forbruk per melding siden output-prisen er ~1/3 ($0,66 vs $2,25 per M tokens). Byttet er én linje i ai-workerens wrangler.toml; deploy-røyktesten verifiserer modellen fra samme fil og tester et norsk svar. Sikkerhetsnettene fra v4.3.9/v4.3.10 beholdes uendret.

---

## 2026-08-02 — v4.3.10: Stinett-svar kan aldri mer bli «Your input is lacking …»

To harde stengsler oppå v4.3.9-rutingen: (1) når forhåndsanalysen er kjørt, sendes FØRSTE modellrunde uten verktøy — de hermetiske engelske avvisningene er artefakter av funksjonskall-grammatikken og forsvinner når modellen bare skal formatere tekst; (2) svarer modellen likevel hermetisk engelsk (eller tomt), erstattes svaret med et deterministisk norsk sammendrag bygget rett fra analysen (stinettSvarTekst: total med «mer enn»-avrunding, kartstørrelse, lengste strekning, lengste turforslag). Brukeren skal aldri se de meldingene når tallene faktisk foreligger.

---

## 2026-08-02 — v4.3.9: Deterministisk stinett-ruting i chatten

Modellens verktøyvelging viste seg uforutsigbar: samme spørsmål («Hvor mange kilometer tursti i kartet») kunne gi et korrekt analyser_stinett-kall den ene gangen og «Your input is lacking necessary details» den neste — og for hver prompt-utvidelse flyttet skjørheten seg bare. Nå ruter chatten deterministisk: gjenkjennes et stinett-spørsmål (km sti, lengste tur, bratteste/slakeste tur, stinett) mens brukeren står i et kart, kjører klienten analysen selv FØR modellen spørres, og resultatet legges i systemprompten — modellen skal bare formulere svaret på norsk, ikke velge verktøy. Gjenkjenningen (erStinettSporsmaal) er testet på varierte formuleringer; feiler analysen faller chatten stille tilbake til vanlig verktøy-loop.

---

## 2026-08-02 — v4.3.8: Stinett-svaret runder ned og oppgir kartstørrelsen

Brukertest ga «414,7 km sti» — som viste seg å være reelt: GPS-kart er 8 km brede med høyden strukket til skjermformatet (~8×13 km ≈ 105 km²), og Stormoen-området har 3,6 km sti per km² i OSM. Problemet var presentasjonen, ikke beregningen (casing-tvillingene i SVG-en dedupliseres allerede av grafen). Nå: over 30 km droppes desimalene og summen rundes NED til nærmeste tier, med ferdig frase i totalStiTekst («mer enn 410 km»); svaret oppgir kartKm (bredde×høyde) og arealKm2 så modellen kan gi tallet kontekst («på dette 8×13 km store kartet»); og systemprompten ber om norsk svar med totalStiTekst-frasen. Worker 2.3.1 + røyktest-pinne.

---

## 2026-08-02 — v4.3.7: Stinett-analysen kutter mindre — 500 m-terskler

Brukertest på Stormoen (1:10 000, tett stinett) viste at analysens terskler kuttet så mye ekte sti at «4 km i kartet» ga et misvisende inntrykk av området. To justeringer: (1) den dynamiske komponent-terskelen for totalsummen klemmes nå til maks 500 m (før 2 km) — korte men ekte småstier teller med i tette nett; (2) standard minste turlengde for tur-kandidater senkes fra 2 km til 500 m (justerbar med minTurKm, som før, på alle tre flater). Svaret oppgir nå også minTurKm som ble brukt, og merknaden ber modellen nevne ekskludertKm (frakoblede stumper) når totalinntrykket er poenget. Cloudflare-MCP-workeren bumpes til 2.3.0 med matchende røyktest-pinne.

---

## 2026-08-02 — v4.3.6: Chatten forstår «kartet» og spørsmål uten stedsnavn

Brukertest: «Hvor mange kilometer sti i kartet» på et GPS-basert kart ga «Your input is lacking necessary details» — modellen ba om mer info i stedet for å bruke kartet fra konteksten. Systemprompten har nå en eksplisitt IMPLISITT STED-regel øverst: spørsmål uten stedsnavn («kartet», «her», «dette området») gjelder alltid kartet brukeren står i (aktiv kartflis), og modellen skal aldri be om flere detaljer da — den skal kalle riktig verktøy direkte. I tillegg gjentas kartnavn og kartId som klartekst etter kontekst-JSON-en, siden svake modeller gjerne overser felter inne i JSON.

---

## 2026-08-02 — v4.3.5: analyser_stinett kallbart uten kartId i chatten

Brukertest på Røst-kart viste at chatten fortsatt svarte «Your function definitions are not comprehensive enough for this task» — llama-modellens hermetiske klage når et verktøys påkrevde argument ikke er direkte tilgjengelig. analyser_stinett hadde kartId som required, men for stinett-spørsmål finnes det ikke noe tidligere verktøysvar som gir kartId — modellen måtte plukke den ut av kontekst-JSON-en, og det nekter den når feltet er påkrevd. Skjemaet har nå required: [] (losKart faller uansett tilbake til kontekstens kart), beskrivelsen og systemprompten sier eksplisitt «kall uten argumenter når brukeren står i kartet», og feilmeldingen uten noe kart er blitt veiledende i stedet for «Fant ikke kart med id "undefined"».

---

## 2026-08-02 — v4.3.4: Deploy-røyktest i synk med MCP-worker 2.2.0

v4.3.3 bumpet Cloudflare-MCP-workeren til 2.2.0 men glemte versjonspinnen i deploy-workflowens røyktest, som fortsatt ventet på 2.1.0 — den besto ved flaks mot en gammel edge-node, og NESTE deploy ville gått rød når alle noder svarer 2.2.0. Pinnen er nå 2.2.0, `analyser_stinett` kreves i tools/list, og røyktesten kjører et ekte analyser_stinett-kall mot røyk-kartet så det nye verktøyet verifiseres ende-til-ende ved hver deploy.

---

## 2026-08-02 — v4.3.3: Stinett-analyse i chatten og MCP

Nytt verktøy `analyser_stinett` svarer på «hvor mange km sti er det her?» for et lagret kart: total km sti (sti 505/506/507 + skogsbilvei 504, hvert segment telt én gang), lengste sammenhengende turstrekning, og tur-kandidater (A→B eller rundtur, minst 2 km) med gangtid, stigning/fall og bratteste/slakeste parti — med koordinater som kan sendes rett videre til foreslaa_tur/foreslaa_rundtur. Korte småveg-strekk (≤ 300 m) regnes som bindeledd mellom stinett men teller ikke i sti-summen, korte isolerte stumper ekskluderes med dynamisk minstelengde etter sti-tetthet, og 0 treff er et ærlig svar der nettet bare har fragmenter (som på Røst). Kjernen er den rene modulen `src/lib/stinettAnalyse.js` (komponentanalyse uten Stifinnerens 80 m-broer, dobbel-Dijkstra for lengste vandring, sløyfedeteksjon), delt av chatten, den lokale MCP-serveren og Cloudflare-MCP-speilet (v2.2.0).

---

## 2026-08-01 — v4.3.2: FAB-klynge-finpuss etter brukertest

To justeringer av den nye FAB-klyngen: (1) Trykk i kartet lukker ikke lenger knottene — på/av-togglingen på Lende-knappen holdt fint i praksis, og kart-trykk-lukkingen gjorde at klyngen forsvant utilsiktet ved panorering. (2) Lang-trykk på Lende-knappen trigget nettleserens «Kopier bilde»-dialog (logoen er en img); den blokkeres nå med contextmenu.prevent på ankeret pluss pekerdød og callout-fri logo, så lang-trykk er en ren app-gest (Lende-chat).

---

## 2026-08-01 — v4.3.1: FAB-klynge — Lende-knappen som anker for kart-knottene

Fire knotter nederst til høyre ble for voldsomt etter at chat-FAB-en kom til. Nå er Lende-knappen (app-logoen) eneste synlige knott i kartvisningen — for alle brukere. Sentrer-, strek- og relieff-knottene er skjult som standard og springer ut fra ankeret med gummibånd-animasjon (overshoot-bezier): sentrer mot nord (rett over), strek mot nordvest og relieff mot vest. Et vanlig tap viser/skjuler knottene — likt for alle brukere; lang-trykk åpner Lende-chatten (kun med invitasjonstoken). Et trykk hvor som helst i kartet lukker klyngen igjen. Knottene beholder sin gamle oppførsel (tap = steg, lang-trykk = innstillingspanel), og hint-bobla følger klyngens åpne/lukkede tilstand. LendeChatFab er forenklet til kun global (fixed) modus — kartvisningens inline-variant er erstattet av ankeret.

---

## 2026-08-01 — v4.3.0: Sømløs kryss-flis-ruting fra chatten + data-meta-fiksen

Milepælen: turer og rundturer fra Lende-chat kan nå gå PÅ TVERS av kartfliser i en mosaikk. To brikker: (1) vaktposten i foreslaa_tur/foreslaa_rundtur godtar punkter i hele mosaikken (nabofliser via bbox-nærhet, ny `bboxAvstandKm`), ikke bare aktiv flis; (2) MapView-gjenopprettingen venter (maks ~12 s, token-invalidert ved navigasjon) på at spøkelses-flisene som dekker turpunktene er tegnet før ruting — Stifinner-grafen leser ghost-paths (testdekket fra før), så ruta beregnes sømløst over grensen. Verifisert ende-til-ende i ekte Chromium: to ekte nabofliser (Kartverket-data) seedet i IndexedDB, tur-query med mål i naboflisa → spøkelses-flis lastet og rute tegnet på 1,4 s. Underveis ble en alvorlig v4.2.8-bug avdekket: lagrede app-kart har IKKE noe meta-felt (kun MCP-bygde har det) — sok_i_kartet leste `kart.meta.utmBbox` og feilet dermed på alle ekte app-kart (den faktiske rot-årsaken til Stordammen-savnet). Kartets UTM-forankring leses nå fra SVG-ens eget `data-meta`-attributt (`metaFraSvgEl`), samme kilde som spøkelses-flisene bruker.

---

## 2026-08-01 — v4.2.11: Kartverktøyene faller tilbake til kartet brukeren står i (kartId-løser)

Stordammen-mysteriet løst: et headless-bygd kart over samme utsnitt (Stormoen/Konnerud) beviste at søket finner Stordammen fint — feilen lå i kart-id-en verktøyet fikk. Verktøybeskrivelsene sier «utelat kartId når brukeren står i kartet», men koden falt aldri tilbake til kontekstens kartId: utelatt eller utdatert id (fra tidligere i samtalen — modellen gjenbruker gjerne gamle id-er fra historikken) ga «fant ikke kart»/tomt søk. Ny felles løser (`losKart`) i sok_i_kartet/foreslaa_tur/foreslaa_rundtur: prøv oppgitt id, fall tilbake til kontekstens kartId hvis den ikke finnes — kartet brukeren ser på vinner alltid over samtale-historikk. Prompten sier nå også eksplisitt at id-er fra tidligere i samtalen kan være utdatert. (v4.2.10-endringen — brukerPosisjon i konteksten — var reell nok: «min posisjon» var tidligere kartsenteret, nå er det GPS-prikken; men den var ikke årsaken til dette søke-feilslaget.)

---

## 2026-08-01 — v4.2.10: Chatten kjenner GPS-posisjonen din («fra min posisjon»)

Felt-test: «gå en tur fra min posisjon til Stordammen» — chatten hadde ikke brukerens GPS-punkt i det heletatt (konteksten bar kartsenteret, ikke den blå prikken). MapView legger nå `brukerPosisjon` (userPos.latRaw/lonRaw, den blå GPS-prikken) inn i chat-konteksten når GPS er aktiv, og systemprompten definerer: «min posisjon» = brukerPosisjon; mangler den skal chatten be brukeren aktivere GPS eller oppgi startsted — aldri gjette. Dermed virker «fra min posisjon»-turer sammen med naboflis-søket fra v4.2.9.

---

## 2026-08-01 — v4.2.9: Kartsøket i chatten dekker hele mosaikken + field-sizing på meldingsfeltet

To brukerønsker: (1) `sok_i_kartet` søker nå i aktiv kartflis PLUSS alle grid-kompatible nabofliser (samme kompatibilitets-sjekk som spøkelses-flisene i MapView, `tilesAreGridCompatible`), så det viste kartet oppleves som ett søkbart kart — hvert treff merkes med hvilken flis det ligger i (kartId/kartnavn), og prompten instruerer chatten: treff i en naboflis → tilby å åpne den flisa eller bygge ett større kart, siden turer foreløpig bare kan tegnes innenfor én flis (sømløs ruting på tvers av fliser via chat er neste milepæl — Stifinneren kan det allerede manuelt når naboflisene er tegnet). (2) Meldingsfeltets auto-høyde bruker nå CSS `field-sizing: content` (min 2, maks 4 rader, vokser oppover fra den bunnforankrede raden) i stedet for JS — nettlesere uten støtte får fast 2 rader.

---

## 2026-08-01 — v4.2.8: Chatten søker i kartets egne navn (sok_i_kartet) + større meldingsfelt

Felt-test nr. 5: «tur til Stordammen» endte et tilfeldig sted på åssiden — chatten geokodet på nett (sok_sted) og traff feil navnebror, enda kartet har Stordammen navngitt. Nytt klient-verktøy `sok_i_kartet`: søker i det lagrede kartets egne stedsnavn/tjern/topper/parkeringer med samme buildSearchIndex/filterIndex som appens søkefelt, og returnerer kartets eksakte koordinater. Implementasjonsdetalj: getBBox() kaster på urendrede SVG-er, så den parsede SVG-en monteres usynlig i DOM-en mens indeksen bygges — verifisert i ekte Chromium mot vite dev (navngitt vann-polygon funnet på eksakt posisjon, «vann»-nøkkelord virker). Systemprompten er snudd: til start/mål/vendepunkt i turverktøyene brukes ALLTID sok_i_kartet først (kartets navn er fasit); sok_sted er for steder utenfor kartene og nye kart, og finner ikke kartsøket stedet skal chatten si det ærlig og tilby lag_kart. I tillegg: meldingsfeltet i chat-modalen er nå to rader som utgangspunkt og vokser med innholdet opp til fire (bunnforankret — vokser oppover), med auto-reset etter sending og etter diktering.

---

## 2026-07-31 — v4.2.7: Kritisk fiks — kartvisningen krasjet ved åpning (v4.2.5-regresjon)

Alle kart ga svart skjerm og redirect til forsiden: aktivTur-watcheren fra v4.2.5 refererte `stiSelectedClimb` som deklareres ~770 linjer lenger ned i MapView — en immediate-watch som kastet «Cannot access before initialization» (TDZ) ved mount, fanget av den globale feilhåndtereren i main.js som rydder kart-tilstand og sender brukeren hjem. Watcheren er flyttet ned etter stiSelectedClimb-deklarasjonen (med kommentar om hvorfor den MÅ stå der). Verifisert i ekte Chromium (Playwright mot bygget app): /kart/vardasen monterer uten pageerror, ingen redirect, SVG-en rendres. Enhetstestene fanget ikke dette (MapView har ingen mount-test) — nettleser-røyk er nå en del av sjekklisten for MapView-endringer.

---

## 2026-07-31 — v4.2.6: Taleinput i Lende-chat

Chatten har fått mikrofonknapp i meldingsfeltet — samme `useSpeechInput`-komposable og knappemønster som søkefeltene (norsk tale til tekst, rød pulserende knapp mens den lytter, skjult i nettlesere uten støtte). Transkriptet legges i feltet og brukeren sender selv, akkurat som i søket; diktering stoppes automatisk hvis chatten lukkes. Velkomstteksten i tom chat er samtidig oppdatert — den påsto fortsatt at chatten «bare kan svare», men nå kan den jo bygge kart, tegne turer/rundturer og vise 3D.

---

## 2026-07-31 — v4.2.5: Chatten kjenner turens nøkkeltall (aktivTur i konteksten)

Felt-test nr. 4: «hvor mange høydemeter har denne turen?» etter en tegnet rundtur — chatten hadde ingen data om ruta og famlet (ærlig «kan ikke beregne», men også et nytt verktøykall som dro i gang 3D). Nå legger MapView den aktive Stifinner-/Runde-ruta inn i chat-konteksten: `aktivTur` med type (fottur/rundtur), lengde, stigning/fall (fra samme DEM-profil som «Valgt rute»-linja) og estimert gangtid (Naismith) — oppdatert reaktivt når ruta endres eller velges bort. Systemprompten har fått regelen: spørsmål om den tegnede turen besvares fra aktivTur — aldri nye verktøykall eller 3D for å svare på et spørsmål, og mangler aktivTur skal modellen si at ingen tur er tegnet inn.

---

## 2026-07-31 — v4.2.4: 3D i chatten er opt-in — tegn ruta først, tilby 3D etterpå

Felt-test nr. 3: rundturen ble tegnet perfekt, men chatten hoppet rett i 3D-visningen uten at brukeren hadde bedt om det (modellen satte vis3d selv). Nå er 3D strengt opt-in i BEGGE turverktøyene: `vis_tur_i_3d` er døpt om til `foreslaa_tur` (gammelt navn består som alias for pågående samtaler) og åpner ikke lenger 3D automatisk — buildTourQuery setter v3d kun når vis3d er eksplisitt satt, samme som foreslaa_rundtur. Verktøybeskrivelsene og systemprompten sier nå tydelig: sett ALDRI vis3d uten at brukeren har bedt om 3D, og tilby heller 3D-visning som et oppfølgingsspørsmål etter at turen er tegnet. Verktøyets merknad til modellen speiler valget (med/uten 3D), så bekreftelsen i chatten stemmer med det som faktisk skjer.

---

## 2026-07-31 — v4.2.3: Lende-chat kan foreslå rundturer i kartet (foreslaa_rundtur)

Felt-test nr. 2: «kan du foreslå en rundtur?» i Stormoen-kartet fikk chatten til å åpne «Nytt turkart» i delingsmodus — den hadde rett og slett ikke noe rundtur-verktøy og grep til det nærmeste den fant. Nytt klient-verktøy `foreslaa_rundtur` (kartId + origo + vendepunkt): navigerer i det lagrede kartet med rundtur-dyplenke-parametrene (olat/olon + rtv uten mål — samme format som «Del rundtur» og MCP-serverens tur3dUrl), så MapView tegner sløyfen med Runde-maskineriet (beginLoop). 3D åpnes bare på forespørsel (vis3d) — standard er å tegne ruten i kartet. Samme bbox-vaktpost som vis_tur_i_3d (punkter utenfor kartet avvises før navigering), og systemprompten har fått en tydelig regel: turer/rundturer til steder som ligger i et lagret kart bruker tur-verktøyene — nytt kart er KUN for områder brukeren ikke har kart over — og mangler startpunkt skal modellen spørre (ikke gjette). Ren query-bygging (`buildRundturQuery`) er skilt ut og rundtrip-testet mot parseTourQuery.

---

## 2026-07-31 — v4.2.2: Lende-chat starter ikke turer utenfor kartet

Feilrapport fra felt: «lag sti fra Stormoen til kulturminnet ved Narverudgruvene» i Konnerudkollen-kartet geokodet feil navnebror (mange steder heter Stormoen), startet turen med punkter 20+ km utenfor kartet (Stifinner-feilen «Ingen sti eller vei i nærheten», rød målprikk i kartet), lukket chatten — og påsto etterpå at ruta var på plass. Tre fikser: (1) vaktpost i vis_tur_i_3d — punkter utenfor kartets bbox (ny `kmUtenforBbox`, testet mot Stormoen-scenarioet) avvises med forklarende feil FØR navigering, så chatten forblir åpen og ingen prikk settes; (2) sok_sted oppgir nå `avstandKmFraKartet` per treff (nærmest først) når et kart er åpent, så modellen kan velge riktig navnebror — chat-konteksten sendes inn i verktøykjøringen; (3) skjerpet systemprompt: velg treffet nærmest kartet eller spør, og gjengi verktøyfeil ærlig — aldri påstå at en handling er utført når verktøyet feilet.

---

## 2026-07-31 — v4.2.1: Lende-chat kan bygge nye turkart (lag_kart)

Chatten i appen kan nå lage kart selv: nytt klient-verktøy `lag_kart` («lag et kart over Håøya») som gjenbruker akkurat samme byggeflyt som «Nytt turkart». Verktøyet navigerer til `/nytt` med senter/størrelse/navn i URL-en pluss ny `auto=1`-param — MapPickerContent gjenbruker del-lenke-parsingen (parseShareInvite) for feltene og starter byggingen automatisk med det eksisterende progress-UI-et; kartet åpnes når det er ferdig. Invitasjonsbanneret droppes (dette er brukerens egen bestilling, ikke en delt lenke), og ved byggefeil slippes felt-låsen så brukeren kan justere og prøve igjen i skjemaet. `foreslaa_nytt_kart` består som den forsiktige varianten (utfylt skjema, brukeren trykker bygg selv) — systemprompten skiller: lag_kart når brukeren eksplisitt ber om å lage/bygge, foreslå-varianten ellers, og modellen er instruert om å ikke love at byggingen lykkes. Ren query-bygging (`buildLagKartQuery`, km clampet 1–16, default 4) er skilt ut og testet.

---

## 2026-07-31 — v4.2.0: Remote MCP fase C — turrapport, kartjustering og rute-beriking

Siste porteringsetappe: de tre gjenværende stdio-verktøyene kjører nå på `lende-mcp`-Workeren, som dermed har alle 12 verktøy. `berik_rute` planlegger en rute på et bygget kart (kartRef) og finner det som ligger langs den — fredede kulturminner (Riksantikvaren), verneområder (Naturbase), rødlistede arter (GBIF × norsk rødliste, med rødlista bundlet inn fra `public/data` siden Workeren ikke har filsystem) og NVE-vannstasjoner. `turrapport_svg` lager den komplette samle-rapporten (kartutsnitt med rute, høydeprofil, funn, veibeskrivelse med sti-kryss-varsler) og skriver både SVG og Markdown til R2 med hentbare URL-er. `juster_kart` gir drawer-innstillingene (tema/lag/preset/strek/sti-farger) per kartRef: de lagres i R2 (`innstillinger.json`), en justert kartkopi returneres som URL, og innstillingene påføres alle senere SVG-utdata — verifisert ved at turrapporten arvet dark-tema og strek-skala fra et tidligere juster_kart-kall. Røyktesten er i tillegg hardnet mot edge-propagering (fase B attempt 2-feilen): både /health- og initialize-pollen venter nå på riktig server-versjon (2.1.0) før verktøykallene starter, og kjeden er utvidet med juster_kart → hent justert SVG. Hele fase C verifisert lokalt i workerd mot ekte kilder (318 GBIF-observasjoner, 23 rødlistede, 4 veibeskrivelse-steg). berik_rute/turrapport_svg kjøres ikke i CI-røyken (eksterne kilder er for trege/flakete for hver deploy).

---

## 2026-07-31 — v4.1.1: MCP-deploy installerer rot-avhengigheter

Fase B-deployen feilet i bundlingen: wrangler fant ikke `src/lib` sine avhengigheter (d3-contour, geotiff, polygon-clipping, graphology, rbush, simplify-js m.fl.) fordi workflowen bare kjørte `npm install` i `cloudflare/mcp-worker/` — pakkene bor i rot-`package.json`, og esbuild leter oppover fra fila som importerer. Lokalt fantes alltid rot-`node_modules`, i CI aldri; fase A slapp unna fordi geocode/NVE bare bruker `fetch`. Workflowen installerer nå rot-avhengighetene før deploy (verifisert med `wrangler deploy --dry-run`), og trigger-stiene er utvidet til hele `src/lib/**` + `mcp/headless.js` siden Workeren nå bundler alt dette. Ren workflow-endring.

---

## 2026-07-31 — v4.1.0: Remote MCP fase B — bygg komplette turkart fra Claude Chat

Den store porteringen: hele kart-kjeden fra stdio-MCP-serveren kjører nå på `lende-mcp`-Workeren, så eksterne MCP-klienter (Claude Chat, Claude Code) kan bygge komplette turkart over internett. Sju nye verktøy: `bygg_kart` (headless bygging med ekte Kartverket DTM/DOM, OSM og N50 — samme buildMapHeadless som stdio-serveren, linkedom bundles fint av wrangler), `planlegg_rute` og `planlegg_rundtur` (ISOM-vektet Dijkstra på kartets stinett, med stigning/gangtid og tur3dUrl-dyplenke), `hoydeprofil`, `eksporter_gpx`, `finn_poi_paa_kart` og `sok_kart`. Tilstandsmodellen fra utredningen landet på den tilstandsløse varianten med R2 som bærer (nytt `kartlager.js`): bygg_kart returnerer en kartRef, alle senere kall laster SVG + DEM (Float32Array binært) + meta fra R2-bucketen `lende-mcp`, og utdata (kart-SVG, GPX, rundtur-SVG) serveres token-gatet via `GET /fil/…` med kallerens token i lenken. Remote-taket for halfKm er 10 (CPU-forsiktighet; Workers Paid gir 30 s). Alt verifisert lokalt i workerd: ekte Vardåsen-bygg (Kartverket-terreng 99–348 moh, 178 KB SVG), sok_kart fant toppen (349 moh), planlegg_rute ga tre alternativer med stigningstall, GPX validert, filserving 200/401. Deploy-workflowen oppretter R2-bucketen idempotent og røyktesten kjører hele kjeden bygg→søk→hent mot produksjon. Turrapport/juster_kart/berik_rute gjenstår som fase C.

---

## 2026-07-31 — v4.0.2: MCP-røyktestens sok_sted-sjekk matcher escapet JSON

Andre kjøring av MCP-røyktesten viste at alt virker i produksjon — initialize, tools/list og et ekte sok_sted-kall (Kartverket SSR fant «Håøya, Porsgrunn» fra den deployede Workeren) — men selve sjekken feilet: MCP-svar er JSON-i-JSON der verktøyets utdata ligger escapet i en text-blokk (`\"treff\"`), så grep-mønsteret med rene anførselstegn matchet aldri. Mønsteret er løsnet til å matche selve nøkkelordet. Første kjøring feilet i tillegg på 404 under initialize — det var aller første utrulling av en helt ny Worker, og noen edge-noder hadde den ikke ennå; re-kjøringen bekreftet at protokollen svarte. Ren workflow-endring.

---

## 2026-07-31 — v4.0.1: Remote MCP-server (Spor 1, fase A) — Lende-verktøy for eksterne MCP-klienter

Spor 1 fra MCP-utredningen er i gang: ny Cloudflare Worker (`cloudflare/mcp-worker/`, deployes som `lende-mcp`) eksponerer Lendes MCP-verktøy over MCP-standardens Streamable HTTP-transport, så eksterne klienter — Claude Chat (custom connectors), Claude Code, Claude Desktop — kan bruke dem over internett. Fase A er tilstandsløs (Agents-SDK-ens `createMcpHandler`, ingen Durable Objects) med de to verktøyene som ikke trenger et bygget kart: `sok_sted` (Kartverket SSR + Nominatim, med utstrekning og anbefalt kartstørrelse) og `vannmalestasjoner` (NVE HydAPI via nve-proxyen, nå med påkrevd senter/bbox). Verktøy-logikken er portert fra stdio-serveren (`mcp/server.js`) og bruker samme `src/lib`. Tilgang: samme per-bruker-GUID-er som lende-ai — `Authorization: Bearer` eller `?token=` i URL-en (Claude Chat-connectors tar kun en ren URL). Alt er verifisert lokalt med wrangler dev (initialize-håndtrykk, tools/list, ekte Håøya-oppslag, 401-port), og deploy-workflowen kjører samme MCP-protokoll-røyktest mot den deployede Workeren. Viktig implementasjonsfunn nedfelt i README: handler/server må bygges per forespørsel (én McpServer-instans tåler bare én transport), og `agents`-pakken krever `ai` som peer-avhengighet — begge pinnet i lockfile. Fase B (bygg_kart + rute-/rapportverktøy med kart-tilstand i R2) er neste; Workers Paid (30 s CPU) er aktivert og klart.

---

## 2026-07-31 — v4.0.0: Lende-chat — og 3D-turer fra chat virker også i det åpne kartet

Ny hovedversjon (avtalt): v3.0.30–v3.0.35 bygde Lende-chat — KI-assistent med invitasjonstilgang, logo-FAB, kartkontekst og fem klient-side verktøy på gratis Cloudflare Workers AI — og 4.0.0 markerer at helheten nå er i drift. Selve endringen i denne versjonen fikser den siste brukertest-feilen: «vis turen i 3D» mens man allerede sto i målkartet gjorde ingenting synlig, selv om chatten meldte suksess. Årsak: `vis_tur_i_3d` navigerer til samme kart-rute med nye tur-parametre i URL-en, men komponenten remontes ikke (App.vue keyer visningen på route.path, som er uendret), og tur-parametrene ble bare lest ved kartlast. MapView har nå en watcher på tur-parametrene (olat/dlat/rtv/ri/v3d/tn) som nullstiller en eventuell aktiv Stifinner-økt og kjører samme gjenoppretting som ved last — rute tegnes, og 3D åpnes når ruta finnes. I tillegg er verktøysvaret gjort ærlig: modellen instrueres om å ikke love 3D-visning, men si at appen prøver — punkter utenfor kartet eller uten sti i nærheten gir feilmelding i kartet (trolig medvirkende i testen: Stormoen ligger utenfor et 3 km Konnerudkollen-kart). CLAUDE.md-merknaden om 4.0.0-bumpen er fjernet, som avtalt.

---

## 2026-07-31 — v3.0.35: Verktøy-runde 2 fungerer — sanert meldingsform mot Workers AI

Første test av Fase 3 («lag et kart over Håøya») stoppet med skjemafeil 5006 fra Workers AI i runde 2 — modellen valgte riktig verktøy, men da chatten sendte modellens egen assistent-melding tilbake i rå OpenAI-form, ble den avvist: `content` var `null` (skjemaet krever streng), og meldingen bar en hale av null-felter (refusal, annotations, …). Chatten bygger nå en sanert assistent-melding selv — `content` alltid streng, `tool_calls` rekonstruert deterministisk fra de normaliserte kallene — og tool-svaret følger Cloudflares dokumenterte form (`role:"tool"` + name + content, pluss tool_call_id). Røyktesten i deploy-workflowen har fått en verktøy-rundtur som sender nøyaktig denne meldingsformen (hardkodet sok_sted-kall + resultat) og krever tekstsvar tilbake — så denne feilklassen fanges deterministisk i CI ved fremtidige modell- eller skjemaendringer, uavhengig av om modellen selv velger å kalle verktøy.

---

## 2026-07-31 — v3.0.34: Lende-chat kan nå gjøre ting — fem verktøy (Fase 3, MVP)

Chatten er ikke lenger bare svar: modellen har fått fem klient-side verktøy den kan kalle, og appen utfører dem lokalt i nettleseren (Spor 2 fra MCP-utredningen — samme funksjoner som appen allerede har, intet nytt server-maskineri). Verktøyene: `sok_sted` (stedsnavn → koordinater via geocode), `mine_kart_og_ruter` (lagrede kart og grusruter fra IndexedDB — «favorittruta mi» fungerer nå), `apne_kart`, `foreslaa_nytt_kart` (åpner «Nytt turkart» med senter/størrelse/navn ferdig utfylt — brukeren bekrefter og bygger selv, chatten kan aldri starte bygging på egen hånd) og `vis_tur_i_3d` (fottur A→B i 3D på et lagret kart, via samme dyplenke-params som delte turlenker). «Lag et kart over Håøya» blir dermed: sok_sted → foreslaa_nytt_kart → byggeskjema klart til bekreftelse. Løkka i `useLendeChat` tar maks 4 verktøy-runder per melding, viser norsk statuslinje per kall («Søker etter 'Håøya' …»), og verktøy som navigerer lukker chat-modalen så man ser hva som skjer. Verktøy-runder kjører ikke-strømmende (Workers AI støtter ikke streaming+tools pålitelig) — svaret kommer samlet, med pulserende status imens. Kartvisningens chat-kontekst inkluderer nå kartId, så «vis turen i 3D her» virker uten oppslag. Nye tester for verktøykall-parsing (begge Workers AI-formatene), tur-query-roundtrip mot parseTourQuery og liste-projeksjonen.

---

## 2026-07-31 — v3.0.33: Lende-chat kjenner nå appens funksjoner — fotturer henvises til Stifinneren

Første brukertest avdekket at chatten sendte alle tur-spørsmål til «Turplanlegger» — også fotturer i det åpne kartet, som hører til Stifinneren. Årsaken var en for fattig system-prompt: modellen kjente bare til «Nytt turkart» og «Turplanlegger». Prompten har nå en funksjonsguide som skiller riktig: fottur i kartet → Stifinneren (snarveis-knappen eller «Naviger hit» via long-press, 1–3 ruteforslag med via-punkter), rundtur → «Runde»-knappen, avstand → «Måling», stedsinfo → long-press/«Informasjon», grus-/sykkelruter → Turplanleggeren, nytt område → «Nytt turkart» — med eksplisitt regel om at fotturer aldri skal henvises til Turplanleggeren. Kun prompt-endring i `useLendeChat.js`; ingen Worker- eller UI-endringer.

---

## 2026-07-31 — v3.0.32: Worker-deployen gjort utrullings-robust

Modellbyttet i v3.0.31 var korrekt (wrangler lastet opp Llama-versjonen), men røyktesten feilet likevel: den traff en gammel Worker-versjon som fortsatt lå på Cloudflare-kanten — edge-propagering kan ta opp mot et minutt, og `secret put`-steget lagde dessuten sin egen versjon *etter* deployen, så «siste versjon» ikke var wrangler.tomls. To endringer i workflowen: (1) secret-pushen kjører nå FØR deployen (tolerant ved aller første kjøring), så siste deployede versjon alltid er den wrangler.toml beskriver; (2) røyktesten poller `/health` til den rapporterer modellen fra wrangler.toml (maks ~2 min) i stedet for en fast `sleep 5`, og feiler med tydelig melding hvis en gammel versjon blir hengende. Ingen endringer i Worker-koden eller appen.

---

## 2026-07-31 — v3.0.31: Modellbytte til Llama 3.3 70B + robust svarformat-parsing

Røyktesten i deploy-workflowen gjorde jobben sin ved første ekte kjøring: GLM-4.7-flash viste seg å være en resonneringsmodell som brukte hele token-budsjettet på intern «tenking» (på engelsk) uten å levere svar, og den svarer dessuten i OpenAI-format (`choices[].message.content`) i stedet for klassisk Workers AI-format (`{response}`) — chat-klienten ville fått tomme svar. To fikser: (1) Worker-modellen er byttet til `@cf/meta/llama-3.3-70b-instruct-fp8-fast` — svarer direkte uten tenke-omvei (raskere chat), klassisk svarformat og solid norsk; bytte tilbake er fortsatt én linje i wrangler.toml. (2) Klienten (`lendeAi.js`) har fått en `extractText`-funksjon som forstår begge svarformatene (både stream- og ikke-stream-varianten) og bevisst ignorerer resonnerings-felter, så fremtidige modellbytter — f.eks. tilbake til en tool-calling-modell i Fase 3 — ikke kan knekke chatten. Røyktesten godtar nå begge formatene (men krever fortsatt faktisk svartekst) og har fått større token-budsjett. Nye tester for begge formater og GLM-tilfellet fra loggen.

---

## 2026-07-31 — v3.0.30: Lende-chat — KI-assistent i appen (Fase 2)

Appen har fått Lende-chat: en KI-assistent som vet hvilket kart du ser på. Inngangen er en klassisk FAB nederst til høyre med app-logoen — alltid ett trykk unna på forsiden og i planleggeren (globalt montert i App.vue), og i kartvisningen som nederste knott i den eksisterende knott-kolonnen (sentrer/strek/relieff), der den arver panel-transisjonene. Knappen finnes kun for inviterte: eieren deler en lenke med `?ai-token=<guid>`, appen plukker opp parameteren ved oppstart (før ruting), lagrer den som `lende-ai-token` i localStorage og vasker URL-en. Chatten åpnes i en global modal (AppModal-skallet) med strømmende svar, stopp-knapp, «Ny samtale» og historikk som overlever både lukking og navigasjon. Konteksten følger visningen: i kartvisningen sendes kartnavn, senter, størrelse og ekvidistanse med i system-prompten (`setChatContext`), i planleggeren visningstypen — så «hva er dette for et område?» handler om kartet på skjermen. Fase 2 er ren spørsmål/svar; modellen sier ærlig fra at kartbygging/ruteplanlegging via chat kommer senere (Fase 3, samme modal). Klienten (`lendeAi.js`) snakker med lende-ai-Workeren fra v3.0.29 (Workers AI, per-bruker-tokens), med SSE-parsing testet i `lendeAi.test.js` og norske feilmeldinger for 401/kvote/nettfeil. Deploy-workflowen har i tillegg fått en røyktest som verifiserer /health, 401-porten og et ekte norsk modellsvar ved hver deploy.

---

## 2026-07-30 — v3.0.29: Fase 1 av KI-planen — lende-ai-Worker med per-bruker-tokens

Første byggestein i KI-chatten: en ny Cloudflare Worker (`cloudflare/ai-worker/`, deployes som `lende-ai`) som kjører chat-inferens via Workers AI-bindingen — ingen ekstern API-nøkkel finnes, og gratiskvoten på 10k neurons/dag dekker normal bruk. Tilgang styres av per-bruker-GUID-er i secreten `LENDE_AI_TOKENS` (kommaseparert liste); kall uten gyldig `Authorization: Bearer`-token avvises, siden CORS alene ikke er tilgangskontroll. Én bruker kan trekkes tilbake uten at de andre bytter kode. Workeren eksponerer kun `POST /api/ai` (meldinger + valgfrie verktøy, streaming støttes) og en uautentisert `GET /health`, begrenser body og max_tokens, og har modellen som var (`@cf/zai-org/glm-4.7-flash` som start — bytte er én linje). Deploy skjer automatisk via ny GitHub Actions-workflow (`deploy-ai-worker.yml`) med tre repo-secrets; token-lista pushes til Workeren ved hver deploy, så brukeradministrasjon er å redigere GitHub-secreten. Utredningen i `docs/MCP_REMOTE_CHAT.md` har fått en «Tilgangskontroll»-seksjon som nedfeller designet, og `.gitignore` dekker nå `.dev.vars`/`.wrangler` (README-en til nve-proxyen antok dette allerede). Ingen endringer i selve appen ennå — klient-siden kommer i Fase 2.

---

## 2026-07-30 — v3.0.28: MCP/chat-utredningen oppdatert med personlig kontekst og Workers AI

Ren dokumentasjonsendring i `docs/MCP_REMOTE_CHAT.md`. To nye seksjoner: (1) «Personlig kontekst» spesifiserer hvordan chat-en skal kunne relatere til brukerens eget innhold — et klient-side verktøy over lagrede kart/ruter i IndexedDB, gjenbruk av den eksisterende 3D-dyplenken (`tour3dLink.js`/`tur3dUrl`), og valgfri favoritt-markering + søkehistorikk; alt lokalt og dermed automatisk per bruker uten backend. (2) «Modellvalg og kostnad» nedfeller konklusjonen fra kostnadsutredningen juli 2026: Cloudflare Workers AI ser ut til å holde for chat-funksjonen — `env.AI`-bindingen fjerner hele nøkkel-problemet, katalogen har fått dedikerte tool-calling-modeller (GLM-4.7-flash, Kimi K2), og gratiskvoten på 10k neurons/dag dekker normal bruk med 5 brukere; forbeholdene (norsk-kvalitet, verktøykjeder på norsk) og fallback-veien til Gemini Flash/Claude står også der. Ingen kodeendringer.

---

## 2026-07-30 — v3.0.27: Kart-tekstur med vannstasjoner, faste turnåler og lengdestyrt tempo

Tre 3D-forbedringer. (1) Kart med NVE-vannstasjoner (f.eks. Grefsenkollen ved Maridalsvannet) mistet hele kart-teksturen i 3D: hydro-laget har nestede grupper per stasjon, og runtime-lag-strippingen brukte en non-greedy regex som kuttet ved første lukke-tag — ubalansert XML fikk hele SVG-rasteriseringen til å feile, og terrenget falt til grå hillshade uten kartografi. Strippingen er nå balansert (ny delt svgLayerStrip.js), som også fikser SVG/PNG/PDF-eksport av kart med annoteringer eller spor. (2) POI-knappen i 3D er default AV og styrer kun severdigheter og hjem-skiltet — knappenålene for start (grønn), vendepunkt/via (oransje) og mål (rød) er alltid synlige. (3) Standard avspillingstempo følger turens lengde: under 3 km = 64×, 3–12 km = 128×, over 12 km = 256×.

---

## 2026-07-30 — v3.0.26: 3D-turen viser aldri fantasi-terreng

Når en tur gikk utenfor aktiv kartflise og Kartverket-WCS ikke svarte (mobilnett/CORS), kunne DEM-fallbacken levere det syntetiske testterrenget — en Gauss-topp midt i utsnittet med sinus-støy. 3D-visningen rendret da konsentriske, bølgete kurve-ringer rundt et ikke-eksisterende fjell, prikke-klynge på «toppen» og diagonalstripete relieff, i stedet for det ekte terrenget. fetchDEMWithCache kan nå avvise syntetisk DEM (rejectSynthetic), og 3D-forberedelsen bruker det: ved nettfeil faller den i stedet tilbake til flisas ekte lagrede høydedata blittet inn i union-utsnittet (utenfor flisa = havnivå). Kartbyggingens egen syntetiske fallback er uendret.

---

## 2026-07-30 — v3.0.25: FAB-knottene bunnjustert

De tre FAB-knottene til høyre i kartet (sentrer, strek, relieff) hang 5 rem over bunnen — plass som var reservert til attribusjonsboksen nede til høyre, fjernet i v2.4.26. Stabelen er nå bunnjustert med skalalinjalen (bottom-3 + safe-area). Løftet når bunn-arket er åpent på mobil er uendret.

---

## 2026-07-30 — v3.0.24: Beige modaler i lyst tema og røde slettknapper

Modalvinduene («Mine kart», «Nytt turkart», «Om», «Tegnforklaring») var rene hvite i lyst tema og stakk seg ut mot hovedmenyens varme papirtone. Nytt tema-token --color-modal gir dem nå samme beige som menyen (#f6f4ea) i lyst tema — mørkt tema er uendret. «Slett alle kart»/«Slett alle ruter» er samtidig gjort om til solide røde knapper med hvit skrift (fast farge i begge tema), den destruktive motparten til de grønne handlingsknappene; lagringstelleren ligger fortsatt som linje 2.

---

## 2026-07-30 — v3.0.23: Slettknappene lesbare i lyst tema

«Slett alle kart»/«Slett alle ruter» brukte rose-300-tekst på rosa tone — i lyst tema remappes ikke 300-skyggen, så knappen ble blek rosa på nesten hvit bunn og så disabled ut. Knappene bruker nå samme nøytrale kort-flate som resten av lista (lys beige på papirtonen) og rose-200-tekst, som i lyst tema remappes til kraftig rød — samme styrke som de grønne handlingsknappene. Mørkt tema ser ut som før.

---

## 2026-07-30 — v3.0.22: Delte lenker klampes mot ekvidistanse-regelen

Mottakersiden av en delt lenke stolte på watch(minEquidistance) for å bumpe en for fin ekvidistanse — men med 8 km som default-bredde står minimumet allerede på 20 m ved mount, watchen fyrer aldri, og en lenke med eq=5 og km=14 slapp gjennom (ISOM-tette kurver + knauser på mottakerens kart). Pickeren klamper nå invite-ekvidistansen deterministisk mot den delte bredde-regelen (equidistanceRules) når lenken parses.

---

## 2026-07-30 — v3.0.21: MCP følger appens ekvidistanse-regler

MCP-serverens bygg_kart arvet mapBuilder-defaulten på 5 m ekvidistanse — et 14 km bredt turkart fikk ISOM-tette høydekurver og knauser, og mottakeren av en delt turlenke måtte vente unødvendig lenge på byggingen. Bredde-regelen fra pickeren er trukket ut i en delt modul (equidistanceRules): default er nå turkart-standarden 20 m, finere kurver må bes om eksplisitt (ISOM-sprint o.l.) og justeres uansett opp til bredde-minimumet (>2 km → 5 m, ≥4 km → 10 m, ≥6 km → 20 m). MCP-en kan fortsatt bygge større kart enn appens 16 km-tak for å dekke fra/til i én flis; en justert ekvidistanse rapporteres i svaret.

---

## 2026-07-30 — v3.0.20: Ryddigere topp i Turkart-fanen

Lag-nytt-flyten (søkefelt med GPS- og mikrofonknapp) vises nå alltid øverst i Turkart-fanen — det gamle «+ Nytt kart»-utfoldingssteget og «Mine kart»-labelen er fjernet, så kartlista følger rett under søket. Lagringstelleren (antall kart + samlet plass) er flyttet fra toppraden ned til «Slett alle kart»-knappen nederst, som egen tekstlinje («8 kart · 45.0 MB») — den vises når det finnes minst ett kart.

---

## 2026-07-30 — v3.0.19: Turnavn i delte turlenker

Delte turlenker bygde mottakerens kart som «Uten navn» — både toppbaren og 3D-visningen manglet et meningsfullt navn. Tur-lenkeformatet har fått en ny tn-parameter: MCP-serveren setter den automatisk fra vendepunktet («Rundtur Høgevarde») eller målet («Tur til …», nytt valgfritt maalNavn-felt i planlegg_rute), appens «Del rundtur» sender kartnavnet videre, og mottakerens kart bygges med navnet ferdig utfylt. Eldre lenker uten tn virker som før.

---

## 2026-07-30 — v3.0.18: Ikke rut delt tur mot terrengskjelettet

Delte turlenker (tur3dUrl fra MCP / «Del rundtur») gjenskapte ruten allerede på terreng-først-skjelettet, før «Tegner inn stier og detaljer»-fasen hadde lagt sti-lagene inn i kartet. Stifinner rutet da mot en tom graf og viste et misvisende «Fant ingen sti»-banner som ble hengende til finalize-swappen kjørte restore på nytt. Gjenskapingen hopper nå over skjelett-passet (gates på fillingInDetails) og kjører kun når det ferdige kartet med OSM-detaljer er på plass.

---

## 2026-07-30 — v3.0.17: Bredere kulturminne-korridor og strammere hastighetsvalg

Kulturminnene langs 3D-turer hentes live fra Riksantikvarens WFS på alle kart (de er ikke bakt inn i Vardåsen-kartet), men kilden dekker kun fredede arkeologiske minner — spredte data, og trigger-korridoren på 150 m mistet legitime treff like utenfor stien. Korridoren er utvidet til 250 m, samme som hentebufferen, så flere reelle kulturminner dukker opp på brukergenererte kart. Hastighetsvelgeren er samtidig strammet til tre trinn — 64×, 128× og 256× — med 128× som ny standard; 8× og 32× viste seg ubrukte i praksis.

---

## 2026-07-30 — v3.0.16: Fjellet kommer ikke lenger i veien for Følg-kameraet

Med turmål oppunder en bratt fjellside (Stetinden-testen) kunne blikkstyring i Følg-modus svinge kameraet bak fjellet — hele bildet ble fylt av baksiden og turpunktet forsvant. Klaringssjekken så bare på terrenget rett under kameraet, ikke på fjellet mellom kamera og blikkpunkt. Nå sjekkes hele siktlinjen: terrenget samples langs strekket kamera→blikkpunkt, og bryter en fjellside synslinjen løftes kameraet akkurat så høyt at den går klar — det går «brått opp» over kanten i stedet for bak fjellet, og den eksisterende kameradempingen gjør løftet mykt. Marginen tapres inn mot målet (terrenget der er rutas eget underlag), og samme klaring gjelder feature-innramming og fugleperspektiv-åpningen i Utforsk. Fri utforsking med fingeren er bevisst urørt — der styrer brukeren kameraet helt selv.

---

## 2026-07-30 — v3.0.15: Roligere Følg-kamera, samlet POI-bryter og hjem-pil ved vannet

Tre justeringer i 3D-visningen. Nål-knappen styrer nå både turpunkt-nålene OG severdighets-stoppene: slått av gir uavbrutt avspilling — ingen nedbremsing, markering eller infokort underveis, heller ikke ved scrubbing (default fortsatt på). Følg-kameraet ligger på omtrent dobbel avstand fra underlaget (220 m bak / 140 m over, nær fugleperspektiv) — raske vinkelskift i skarpe svinger ga «bilsyke» på nært hold, og høyere kamera senker vinkelfarten; pinch-zoom kan nå også trekkes lenger ut (4×). P-skiltet vises dessuten bare når start (eller mål på A→B) faktisk ER en utfartsparkering (≤ 50 m — større radius traff parkeringer turen ikke utgikk fra), og vendepunkt ved tjern eller vann får et nytt «hjem»-skilt: en 180-graders pil i bue over den oransje nåla — her snur turen, og her tar man gjerne rasten og badet.

---

## 2026-07-30 — v3.0.14: Tekst-hastigheter tilbake og Flyover-modus fjernet

Kjøretøy-emojiene fra forrige versjon brøt med appens øvrige ikonspråk og er byttet tilbake til tekst-knapper, nå med fem trinn: 8×, 32×, 64× (standard), 128× og 256× av virkelig gangfart. Flyover-modusen er samtidig fjernet fra 3D-visningen — Følg (med fingerstyrt blikk) og Utforsk dekker behovet, og tre kameravalg var ett for mye. Dronesplinen ligger igjen i motoren om modusen skulle gjenoppstå, men knappen og omtalen i Om-siden er tatt bort.

---

## 2026-07-30 — v3.0.13: Følg-modus som standard, kjøretøy-hastigheter og oransje nåler

Tre justeringer fra siste testrunde. 3D-visningen åpner nå i Følg-modus (kameraet bak turpunktet) i stedet for Utforsk — fugleperspektiv-oversikten står klar første gang man bytter til Utforsk. Hastighetsvalget er byttet fra fem talltrinn til tre kjøretøy-ikoner, siden vi holder oss «på hjul»: moped (16×), bil (64×, standard) og racerbil (256× av virkelig gangfart) — en 10 km tur spilles av på ~8, ~2 eller et halvt minutt. Og delmål/vendepunkter er nå oransje knappenåler på lik linje med start og mål, med samme avstandsoverdrivelse, i stedet for lave prikker som forsvant i terrenget.

---

## 2026-07-30 — v3.0.12: 3D dekker utvidede kart — turen går ikke i tomme lufta

På utvidede mosaikk-kart kunne en rute som gikk inn i en nabo-flise sveve i løse lufta i 3D: terrenget og teksturen dekket bare den opprinnelige flisa. Nå oppdages det når turen (med margin) går utenfor aktiv flise, og 3D-verdenen utvides til unionen av flisa og rutas utstrekning: høydedata hentes for hele utsnittet via DEM-flis-cachen (10 m-grid-alignet med kartets UTM-forankring, så alt fortsatt stemmer på centimeteren), kart-teksturen rasteriseres MED nabo-flisene (viewBoxen utvides i stedet for at ghost-flisene strippes), og rute, delmål og POI-er forskyves inn i det nye koordinatrommet. Uten nett faller utvidelsen tilbake til å plassere flisas høydedata i union-gridet — området utenfor flater til havnivå, men ruta svever aldri. Nattmodus stripper også nabo-flisenes dag-tonede relieff-bilder før mørk rasterisering.

---

## 2026-07-30 — v3.0.11: Kurver valgfrie også i 3D-nattmodus

Kurve-tvangen i nattmodus er fjernet: natt-teksturen gjenskaper det mørke temaets eget relieff (screen-blend som lysner solsidene), så terrenget er lesbart også uten vektorkurvene. «Kurver»-knappen er dermed like togglebar i natt som i dag — låsingen og tilstands-gjenopprettingen ved dag/natt-bytte er tatt bort, og kurvevalget ditt står urørt gjennom modusbytter.

---

## 2026-07-30 — v3.0.10: 3D-visningen kan åpnes fra MCP-planlagte turer

MCP-verktøyene planlegg_rute og planlegg_rundtur returnerer nå `tur3dUrl` — en dyplenke som bygger samme kartutsnitt hos mottakeren og lander rett i den immersive 3D-visningen med turen gjenskapt og valgt. Agenten kan dermed foreslå «se turen i 3D» hver gang en rute eller runde er planlagt. Lenkeformatet (ny delt modul `tour3dLink.js`, brukt av både app og MCP) utvider den eksisterende rundtur-delelenken: A→B-ruter bæres med `dlat/dlon` (pluss eventuelle via-punkter), og `v3d=1` åpner 3D-visningen automatisk etter gjenskaping — eldre rundtur-lenker parses uendret. MapView-restoren håndterer nå også A→B (spiller inn mål → start → via gjennom stifinnerens ekte tilstandsmaskin), og kartbygger-siden videresender de nye parametrene gjennom bygge-flyten. Basis-URL-en kan overstyres med `LENDE_APP_URL` for lokal utvikling.

---

## 2026-07-30 — v3.0.9: Knappenåler for start/mål og nattmodus i 3D

Start (grønn) og mål (rød, for A→B-ruter) er nå knappenåler som stikker opp fra terrenget — lavere enn POI-strålen, men med avstandsavhengig overdrivelse (opptil 5× langt unna) så de kan lokaliseres helt i horisonten. Delmål forblir gule prikker. Nålene toggles med en egen pin-knapp ved siden av «Kurver» (default på). Ny sol/måne-knapp gir nattmodus: kartet rasteriseres på nytt med appens ekte mørke tema (samme skilt- og bymasse-filtrering som ellers), himmelen blir nattemørk med mørk dis, skyene skjules, og relieffet bakes med screen-blend som lysner solsidene i stedet for å mørkne skyggene. Måne er forvalgt når appen står i mørkt tema, og høydekurvene er obligatoriske i nattmodus (kurve-knappen låses) — på nesten svart terreng er de selve lesbarheten. Dagmodus er som før standard ellers.

---

## 2026-07-30 — v3.0.8: 3D-teksturen rydder vekk flate skilt og bymasse

Kartets punktskilt ble liggende som store flate «klistremerker» på 3D-terrenget — tydeligst de blå P-skiltene på Vardåsen-testen. Nå strippes parkering (P-skiltene, ISOM 534/534u), buss- og togholdeplasser (560), toaletter (554) og bymasse-fyllet «tett bebyggelse» (522) fra SVG-en før den rasteriseres til terrengtekstur. Andre sjø-POI-er som marinaer og drikkevann beholdes, og som før gjelder ryddingen kun 3D-visningen — 2D-kartet, print og eksport er urørt. Nærmeste utfartsparkering vises fortsatt i 3D, men som den stående P-billboarden ved start/mål, ikke som flatt kartsymbol.

---

## 2026-07-30 — v3.0.7: Ærlige avspillingshastigheter i 3D

Hastighetsknappene i 3D-visningen sa 1×/2×/4×/8×, men tallene var multiplikatorer av en allerede skalert basis — «1×» var i virkeligheten 15 ganger sanntid, og ekte 1:1 gir uansett ingen mening for en virtuell tur. Nå viser knappene ærlige multiplikatorer av virkelig gangfart (4,5 km/t): fem trinn — 4×, 8×, 16×, 32× og 64× — med 16× som standard. Det spenner fra rolig gjennomgang av korte kveldsrunder til rask forhåndsvisning av lange fjellturer; en 10 km tur spilles av på ~8 minutter ved 16× og ~2 minutter ved 64×. Statistikk og gjenværende tid er upåvirket — de regnes fortsatt av ekte gangfart.

---

## 2026-07-30 — v3.0.6: Vogn-kameraene i 3D panorerer ut og lar deg styre blikket

Følg og Flyover er nå ekte «vogn-kameraer»: de følger ruta automatisk mens turen spilles av, men brukeren styrer blikket selv underveis. Én-finger-drag vrir kameravinkelen — i Følg orbiterer kameraet rundt turpunktet (sfærisk parametrisering rundt den rullende «vogna»), i Flyover snur man hodet fra dronen — og pinch justerer nær/fjern. Blikk-offsetene nullstilles ved modusbytte, og den eksisterende dempingen glatter alle justeringer. Begge modusene er også panorert lenger ut som standard, så omgivelsene rundt ruta synes: Følg-kameraet ligger på 110 m avstand / 70 m høyde (fra 60/35), og Flyover-dronen flyr på 130 m med 55 m sideforskyvning og romsligere terrengklaring, med blikkpunkt lenger fram. Om-sidens 3D-avsnitt er oppdatert med fugleperspektiv-åpningen, blikkstyringen, tidsakse-spoling, turmarkørene og kurve-knappen.

---

## 2026-07-30 — v3.0.5: 3D åpner i Utforsk-modus med fugleperspektiv

3D-visningen åpnet tidligere i Følg-modus med kameraet lavt bak startpunktet — man så terreng, men ikke turen. Nå er Utforsk standardmodus, og åpningsposen er et nesten-fugleperspektiv: kameraet plasseres høyt bak startpunktet, vendt mot rutas tyngdepunkt, med avstand skalert etter rutas utstrekning og klaring mot terrenget under. Dermed ligger hele ruta og terrenget foran deg idet visningen åpner — full oversikt før du trykker Play, drar i tidsaksen eller bytter til Følg/Flyover. Ved svært kompakte rundturer (tyngdepunkt oppå startpunktet) brukes startretningen på ruta i stedet, så posen aldri degenererer.

---

## 2026-07-30 — v3.0.4: 3D bruker alltid mykt relieff uansett 2D-stil

Relieff-stilen «Skarp (vektor)» tegner relieffet som diskrete tone-bånd-polygoner i 2D-kartet — rasterisert til 3D-terrengtekstur ble båndene til flate grå flekker utover terrenget (tydelig på Rondvassbu-testen). Nå strippes vektor-relieffet fra SVG-en før teksturen bygges, og det myke bilde-relieffet bakes inn i stedet: 3D-visningen bruker altså alltid «Mjuk (bilde)»-stilen, uansett hva brukeren har valgt for 2D-kartet. Valget i 2D er uendret — byttet gjelder kun 3D-teksturen. De to stilene deler element-id i kartet (`hillshade-layer`), så strippingen skiller på elementtype: vektor-varianten er en gruppe med polygoner og fjernes, bilde-varianten er et enkelt `<image>` og beholdes som før.

---

## 2026-07-30 — v3.0.3: 3D-teksturen slipper kartets innbakte høydekurver

Høydekurvene vistes dobbelt i 3D: én gang uskarpt som del av den rasteriserte kartteksturen, og én gang som skarpe vektorlinjer — og «Kurver»-knappen påvirket bare vektorlaget, så terrenget hadde kurver selv når laget var slått av. Nå strippes kartets `kontur`-lag (inkludert de nestede kurve- og kurvetall-gruppene, som krever balansert skanning i stedet for non-greedy regex) fra SVG-en før den rasteriseres til terrengtekstur. Vektorkurve-laget er dermed eneste kurvekilde i 3D: knappen styrer faktisk kurvene, og terrenget står renere med bare relieff, vann, vegetasjon og stier når laget er av. 2D-kartet og eksportene er uberørt.

---

## 2026-07-30 — v3.0.2: Dra-bar tidsakse i 3D og tydeligere høydekurver

Tidsaksen i 3D-visningen er nå en slider: dra fingeren fram og tilbake langs turen, så følger kameraet med (i Følg- og Flyover-modus), posisjonsmarkøren og statistikken oppdateres fortløpende, og severdigheter du drar deg forbi dukker opp som infokort med markering i terrenget. Når du slipper, forblir avspillingen pauset — Play fortsetter derfra. Høydekurve-laget er samtidig gjort tydeligere: siden kurvene uansett ligger bakt inn i kartteksturen var effekten av å slå på vektorkurvene knapt synlig, så laget er nå PÅ som standard, og linjene tegnes tykkere (ekte pikselbredde via three sitt Line2-linjesystem — vanlig WebGL-linje er låst til 1 px) med kraftigere indekskurver. «Kurver»-knappen skrur fortsatt laget av og på.

---

## 2026-07-30 — v3.0.1: 3D-terrenget får kartet, himmel og turmarkører

3D-visningen så ut som et grått månelandskap fordi kart-teksturen aldri ble rasterisert: vieweren fikk SVG-strengen fra en variabel som aldri ble tilordnet, rasteriseringen feilet stille og reserveløsningen (grå hillshade) tok over. Nå gjenbrukes eksport-markupen (tema baket inn, uten kolofon), så terrenget drapes med selve ISOM-kartet — blå innsjøer og fjorder, kremfarget mark, stier og hovedveier. Rundt kartet er det kommet atmosfære: gradient-himmel fra lys horisont til blå senit, drivende prosedurale skyer og avstandsdis som mykner horisonten. Startpunktet vises som grønn prikk, målet som rød (A→B-ruter), delmål/vendepunkter som gule, og nærmeste utfartsparkering ved start — og ved mål for A→B-ruter — markeres med et «P»-skilt i terrenget. I tillegg kan høydekurver legges som vektorlinjer i terrenget via en «Kurver»-knapp i toppraden (default av, bygges først når den slås på).

---

## 2026-07-29 — v3.0.0: Immersiv 3D-visning av tur

Ny hovedfunksjon: når en rute er valgt med stifinneren eller en rundtur er planlagt, dukker en «3D»-knapp opp ved startpunktet (og i rutepanelet) som åpner turen som en fullskjerm 3D-opplevelse. Terrenget bygges i sanntid med Three.js fra kartets lagrede Kartverket-høydemodell, og selve ISOM-kartet rasteriseres og drapes over som tekstur — 3D-landskapet ser altså ut som kartet du kjenner, uten ortofoto. Turen spilles av langs ruta med play/pause, hastighetsvalg og tre kameramoduser: Følg (kamera bak turpunktet), Flyover (filmatisk lavtflyvende drone langs en glattet kameraspline med terrengklaring) og Utforsk (fri rotasjon/zoom). Underveis fungerer severdigheter som hendelser på tidslinjen: tjern, topper, naturreservater og steder fra kartets egen navneindeks (virker offline), pluss NVEs vannmålestasjoner med siste vannføring/-temperatur og Riksantikvarens fredede kulturminner over nett — kameraet bremser, svever ved featuren og viser et infokort før turen fortsetter. Et HUD viser høyde, kilometer gått og igjen, stigning og gjenværende tid (Naismith), i både portrett og landskap. 3D-modulen (inkl. three) ligger i en egen lazy chunk som varmes i service worker-cachen ved første kartåpning på nett, så funksjonen virker offline etterpå; kart uten ekte høydedata får en forklarende tom-tilstand. Om-siden har fått et eget avsnitt om funksjonen.

---

## 2026-07-29 — v2.4.30: Utrygg myr kan skilles fra fast i alle temaer

De seks monokrome temaene flatet myra til én solid farge. Fast myr (308) og utrygg myr (309) skilles KUN av rastertettheten, så et flatt fyll gjorde dem praktisk talt identiske — de to fargene lå så nær hverandre at forskjellen bare var en knapt merkbar valørendring. På et turkart betyr det at utrygg myr ikke kunne skilles fra fast, som er nettopp den regresjonen den eksisterende testen verner Mørk mot. Nå bruker alle temaene rasteret, med strekfargen hentet fra temaets egen vann-kulør på omtrent to tredjedeler av åpent vanns valør, slik Mørk fikk i forrige versjon. Tettheten er urørt, så forskjellen mellom fast og utrygg er tilbake i alle åtte temaer.

Testen som vernet Mørk er utvidet til å gjelde alle temaer: ingen tema får sette flatt fyll på 308 eller 309, og hvert tema må sette en myr-strekfarge som ikke er lys-modus' cyan. Verifisert visuelt ved å rendre fast og utrygg side om side i alle åtte temaer gjennom den ekte `data-iso`-CSS-veien.

---

## 2026-07-29 — v2.4.29: Punktsymboler og myr-raster følger mørke temaer

Bom, bro/klopp, steinblokk, hule og gruve var hardkodet `#000` og forsvant derfor helt i alle mørke temaer — markene lå der, men var usynlige mot bakgrunnen. Kirkekorset hadde samme problem i dobbel forstand: sort kors bak en hvit halo, altså akkurat samme idiom som stedsnavnene hadde før forrige versjon. De seks rene blekk-markene tegner nå med `currentColor` og arver `color` fra kartroten, som hvert tema setter via `--sym-ink`; kirkekorset følger blekket mens haloen følger `--sym-paper` og smelter inn i temaets bakgrunn i stedet for å gløde. Farger som er semantiske og ikke dekorative er bevisst holdt utenfor: de blå skiltbrikkene med hvite piktogrammer (P, buss, WC), IALA-kodingen på sjømerker (sort/gult) og veiskilt-fargene er konstante på tvers av temaer, som ekte skilt.

Myr-rasteret i Mørk var låst til lys-modus' skarpe cyan (`#0099cc`), som lyste kaldt mot den mørke bakgrunnen. Mønster-farger kan nå themes per mønster, og Mørk setter en dempet myrblå som ligger tydelig under åpent vann i valør. Poenget med å farge streken og ikke fyllet er at fast myr (308) og utrygg myr (309) skilles KUN av rastertettheten — et flatt fyll ville gjort utrygg myr umulig å skille fra fast, som er en sikkerhetsregresjon på et turkart. Den eksisterende testen som verner om det står urørt, og har fått et motstykke som krever at strekfargen themes.

Teknisk detalj som er verdt å vite for senere: `var()` virker ikke i SVG-presentasjonsattributter. Mønster- og symbolfarger som skal kunne themes legges derfor som inline `style`, med fallback-fargen igjen i attributtet. For punktsymboler plassert med `<use>` er `currentColor` den pålitelige veien, siden innholdet klones til et shadow-tre der arvede egenskaper slipper gjennom. Begge veier er verifisert ved å lese faktiske malte piksler i Chromium, ikke bare beregnet CSS. Lys tema er bit-identisk som før.

---

## 2026-07-29 — v2.4.28: Lesbare navn og dempede hytter i mørke temaer

Stedsnavn i mørke kart-temaer var nesten-sort skrift (`#161616`) under en 1,2 mm hvit halo. Halogloen er tykk nok til å dominere bokstavene, så navnene leste som hvit skrift med mørk kjerne — og alle 55 stedsnavnene på et typisk kart lyste som klistremerker oppå det mørke underlaget. Årsaken var at `stedsnavn` aldri lå i katalogens `labels`-liste i det hele tatt, så ingen av de sju mørke temaene kunne nå den, selv om `symbolizer.js` hadde variablene klare nettopp for at temaene skulle overstyre dem. Samme hull gjaldt `omrade-navn`, `hytte-navn` og `naturreservat-navn`. Alle fire er nå farget per tema med nær-hvit skrift og halo i temaets egen bakgrunnsfarge, slik at gloen smelter inn i stedet for å ramme inn. Toppnavn og høydekurver beholder den gule/røde skriften si urørt.

Vann-labels er målt mot hver sin bakgrunn i stedet for gjettet. Bare Curves faller under 4,5:1 (innsjønavn 4,09:1, moh-tall 3,19:1, dybdetall 3,63:1); de er løftet i lyshet innenfor samme blå kulør, mens de øvrige seks temaene ligger på 5,05–11,46:1 og er urørt. Områdenavn holdes bevisst dempet rundt 5:1 og ikke nær-hvit: de er uppercase med letter-spacing, og i lys-katalogen er de den svakeste labelen av alle — feilen var gloen, ikke mørkheten.

Små bygg under 500 m² — hytter, uthus, garasjer — ble tegnet med Kartverket-stil hvitt fyll og sort omriss også i mørke temaer, fordi de to variablene `--iso-521-small-fill/stroke` ikke er ISOM-kodenavn og derfor aldri ble satt av noe tema. På et hyttekart ga det et teppe av lysende hvite ruter. Hvert tema setter dem nå i sin egen bygnings-idiom, med omtrent halve den visuelle vekten av et stort bygg. To nye tester krever full label- og småbygg-dekning i alle temaer, så samme hull ikke kan oppstå stille igjen.

Til sist blinket kratt, hugstfelt og strand tilbake til lys-modus-farger i ~200 ms under hver pinch-zoom: gest-regelen bakte inn en flat lys farge som var mer spesifikk enn den tema-styrte regelen. Den går nå gjennom samme tema-variabel. Myra i Mørk er bevisst rørt: 308 fast og 309 utrygg skilles kun av mønster-tettheten, og en flat farge på begge ville gjort utrygg myr umulig å skille fra fast.

---

## 2026-07-29 — v2.4.27: Hamburgeren blir liggende — og animerer

Meny-knappen skifter nå faktisk fra tre streker til et kryss når hovedmenyen åpnes, i stedet for å hoppe rett til krysset. To ting sto i veien, og ingen av dem var z-index. Knappen ble flyttet fra toppraden til `<body>` i samme øyeblikk som menyen åpnet — og å flytte et element i DOM-en kobler det fra dokumentet og kansellerer alle løpende CSS-transisjoner, så animasjonen ble avlyst før den fikk begynne. Nå monteres knappen én gang i `<body>` og blir liggende der, alltid `fixed` på koordinatene til en plassholder som holder plassen i toppraden. Åpning endrer da bare klasser på strekene, og siden knappen permanent bor utenfor toppradenes stacking contexts virker z-[205] som tenkt: over backdrop og skuff, under modalene.

Selve animasjonen er også skrevet om. Den gamle CSS-en byttet `top`/`bottom` momentant og animerte bare rotasjonen, så øverste strek teleporterte til midten og roterte etterpå. Nå er alle tre strekene sentrert og spredt med `translateY` i samme transform-liste som rotasjonen, så spredning og rotasjon interpoleres sammen til et rent kryss. Midtstreken fader og krymper. `prefers-reduced-motion` hopper over hele bevegelsen.

---

## 2026-07-29 — v2.4.26: Ryddet i info-elementene over turkartet

Den svarte attribusjons-boksen nede til høyre i turkartet er borte. Den holdt fire linjer med provenens — ISOM-variant, DEM-kilde og -oppløsning og dybde-kilde — som ingen leser mens de går, men som lå og dekket kartet hele tiden. ODbL-kreditten «© OpenStreetMap-bidragsytere» må stå på kartet, og ligger nå som en egen liten linje under linjalen nede til venstre, i samme boks.

Resten av provenensen er flyttet øverst i infopanelet (langtrykk i kartet, eller Info-knappen), rett under målestokk og ekvidistanse som allerede står der: én linje med ISOM-variant og DEM-kilde. Dybde-advarselen har fortsatt sin egen uthevede linje — når Sjøkart-WFS faller stille tilbake til DEM-estimatet, skal det ikke være mulig å overse at dybden er gjettet og ikke kan navigeres etter.

---

## 2026-07-29 — v2.4.25: Snarvei til mørkt turkart i hovedmenyen

Hovedmenyen har fått bryteren «Turkart i mørkt tema» rett under Lyst/Mørkt/Auto, av som default. De tre knappene styrer appens chrome — menyer, skuffer, knapper — mens den nye bryteren gjelder kartflaten, og gjør det samme som å velge «Mørk» under Innstillinger → Tema. Det er én og samme tilstand: velger du Mørk i Tema-fanen, står bryteren på, og slår du den av i menyen, hopper Tema-fanen tilbake til Lys (ISOM). Bryteren er to-tilstands, så «av» betyr alltid kartets standardpalett — også om du sto på Sepia eller Petrol.

Kart-temaet bor nå i en delt `useMapTheme` (localStorage `lende-map-theme`) i stedet for i MapViews lokale tilstand. Det er en bevisst utvidelse: valget overlever at appen lukkes, som alle andre innstillinger i appen gjør, og bryteren i menyen ville ellers ikke betydd noe fra forsiden der ingen kart er åpnet. Foretrekker du at kartet alltid starter lyst, si fra — da gjør vi tilstanden økt-lokal i stedet.

---

## 2026-07-29 — v2.4.24: Én grønn boks, ikke to

Nasjonalpark-faktaboksen fra v2.4.23 dupliserte informasjon: trykker du inne i en nasjonalpark, svarer Naturbase-oppslaget med samme park, og da sto to grønne bokser med samme navn, vernedato og forvaltningsmyndighet rett over hverandre. Naturbase-kortet er det rikeste av de to — det har observerte rødlistearter og leksikon-lenke i tillegg — så det er faktaboksen som viker. Parken lukes bort på Naturbase-ID (VV…) når den finnes, ellers på normalisert navn, siden Naturbase kaller parken «Rondane» med verneform «nasjonalpark» der OSM kaller den «Rondane nasjonalpark».

Faktaboksen er beholdt for de to tilfellene den er alene om: kartet dekker en park, men punktet du trykket på ligger utenfor parkgrensa — og Naturbase er utilgjengelig, altså offline på tur, der det bundlede datasettet er eneste kilde. Under selve Naturbase-oppslaget holdes boksen igjen, så den ikke blinker forbi og blir byttet ut et sekund senere.

---

## 2026-07-29 — v2.4.23: Nasjonalpark-faktaboks, og verneområde-kortet slutter å forsvinne

Nasjonalparker vises nå som en faktaboks i infoskuffen — parkens navn (med samisk parallellnavn der det finnes), verneform, vernedato, forvaltningsmyndighet og lenke til Naturbase faktaark, i samme grønne drakt som verneområde-kortet. Boksen henger på ARKET, ikke på long-press-punktet: dekker en park hele eller deler av kartet, står den der. Parken tegnes bevisst ikke — de er 20–3400 km², så en overlay ville enten dekket hele arket i flatt grønt eller (som før) blitt kuttet av areal-vakten på 200 km² uten at noen fikk vite det. Nasjonalparker er dermed heller ikke lenger ISOM 520, og får ingen navne-label i kartet.

Oppslaget er lokalt. `scripts/build-nasjonalparker.js` henter alle 43 norske parker fra OSM (Naturbase-importen bærer `ref:naturvern`, `naturbase:url`, `operator` og `start_date`) i CI, forenkler grensene til ~150 m og skriver `public/data/nasjonalparker.json` — 35 kB gzip, lastet ved behov. Alternativet, et Overpass-oppslag ved kartbygging, ble forkastet: bbox-filteret treffer ikke en park man står midt inne i (Rondvassbu i Rondane ga null treff), `is_in` retter det men konkurrerer om klientens Overpass-slots (1–3 s alene, over 12 s i skyggen av hovedspørringen) og får speilet openstreetmap.fr til å svare 504. Lokalt oppslag virker i tillegg offline og gjelder kart som allerede er bygget.

Verneområde-kortet hadde en egen feil: `identify`-kallet hentet HELE polygonet, og for detaljrike områder som Grunnvatnet naturreservat (3600+ grensepunkter, og punktet treffer både reservat, Ramsar-område og restriksjonssone) kunne svaret bli så tungt at 7 s-taket løp ut — da forsvant hele den grønne boksen, selv om punktet lå midt i reservatet. Kortet hentes nå uten geometri; ringene kommer etterpå i bakgrunnen, der de faktisk brukes (GBIF-artstellingen, som uansett faller tilbake på en bbox). Taket er hevet til 12 s, og tjeneste-feil logges i stedet for å bli slukt. Samtidig fikk ID-mønsteret med `naturvernId`, Naturbase sitt eget feltnavn — uten det falt faktaark-lenka bort på alle verneområder.

Boksen bruker et eget fjell-ikon, ikke det offisielle nasjonalpark-merket: merket er varemerkebeskyttet og kan ikke brukes i Lende.

---

## 2026-07-29 — v2.4.22: Veitunneler tegnes som stiplet rød linje

Veier i tunnel ble tegnet nøyaktig som veier i dagen — full farge med sort casing — så en fjelltunnel så ut som en vei over toppen, og kartet fortalte ikke hvor traseen faktisk går under bakken. Nå følger tunnelene UT.no-/Norgeskart-konvensjonen: `mapBuilder` skiller tunnel-segmenter (`tunnel`-tag ≠ `no`) ut i egne path-buckets merket `data-tunnel="yes"`, og symbolizeren skjuler den sorte casingen og stipler veifargen. Resultatet er en stiplet rød/oransje linje i veiens egen vekt, akkurat som overflateveien den henger sammen med, bare åpenbart underjordisk.

Gjelder motorvei (501), hovedvei (502), småvei (503) og skogsbilvei (504); jernbane (515) har fra før sin egen tunnel-stil med fantomlinje og portal-streker. Dash-lengden utledes fra strekbredden med et gulv på 0,7 mm, godt over sti-stiplingen (505 = 0,36 mm), så en tunnel aldri forveksles med en sti ved utzoom. Bucket-nøkkelen bærer tunnel-flagget, så sammenslåingen per grid-celle er intakt og DOM-tallet uendret.

---

## 2026-07-28 — v2.4.21: Kolofonen vokser med arket

Kolofonen fra v2.4.20 var lagt ut i faste print-mm, og det gjorde den til en flekk på store kart: samme boks som dekker 16 % av bredden på et 4 km ark er nede på 5 % på et 9 km ark, for arket blir større mens boksen står stille. I PNG-eksport, der hele arket vises på én skjerm, var den knapt synlig. Kolofonen skalerer nå med kartstørrelsen etter samme kurve som symbolizeren bruker på stedsnavn — `clamp(widthM / 4000, 1, 3)` — så den holder omtrent konstant andel av arket uansett kartstørrelse: målt i Chromium er boksen 18,3 % av bredden både på et 4,1 km og et 9,2 km kart, mot 16 % og 5 % før. Grunnstørrelsen er samtidig hevet ~40 % (hovedtekst 2,4 → 3,4 mm), siden den var i det minste laget også på referanse-kartet.

Selve linjalen er unntaket som ikke skaleres: den ER avstanden. Streken tegnes alltid nøyaktig `groundM` bruker-enheter lang (1 enhet = 1 m), og skalering skjer ved å velge en LENGRE rund bakke-avstand — vinduet for akseptabel strek-lengde vokser med `k`, så et større ark får «1 km» der et lite får «500 m». En egen test slår fast at strekens bredde er lik den oppgitte avstanden for fire kartstørrelser, så dekor-skalering aldri kan snike seg inn i målestokken. For små kart går en sikkerhetsventil andre veien: boksen får aldri legge beslag på mer enn 45 % av kartbredden, og krymper typografien om nødvendig.

---

## 2026-07-28 — v2.4.20: Linjalen er bare en linjal — og PDF-en får en kolofon

Linjal-boksen nederst til venstre på kartet bar to tekstlinjer den ikke trengte: «print 1:10 000» og «Høydekurver pr 5 m». Det er tall du slår opp én gang, ikke tall du følger mens du går, og de gjorde boksen nesten tre ganger så høy som selve linjalen. Nå står boksen med bare strek og lengde, og de to opplysningene har flyttet til punkt-skuffen — på linjen rett under koordinatene og kopier-knappen, der resten av kart-fakta allerede bor. Samtidig tegnes linjalen i `currentColor` istedenfor hardkodet hvit; på lyst tema er boksens bakgrunn hvit, så den hvite streken var usynlig.

En eksportert fil har ingen app rundt seg, og der er de samme tallene tvert imot nødvendige. Ny `src/lib/mapColophon.js` baker en kolofon nederst til venstre i kart-SVG-en: linjal med kvart-tikker, størrelsesforhold, ekvidistanse og «Så i lende · <kartnavn> · <dato>». Den ligger i den DELTE eksport-markupen, så alle fire utgangene får den — .svg, .png, PDF og «Skriv ut». Alt er lagt ut i print-mm som regnes om til bruker-enheter med `scaleDenom / 1000`, så boksen får samme fysiske størrelse på arket uansett kartstørrelse og målestokk — verifisert i Chromium: 4 mm marg er 4 mm, og en 25 mm linjal er 25 mm. Merk at CSS-`mm` IKKE kan brukes til dette: en mm inne i SVG-innhold er 96 dpi-basert (1 mm = 3,78 bruker-enheter) og blir 0,378 mm på papiret ved 1:10 000, så kolofonen bruker utelukkende unitless tall. Datoen er `meta.generated` (da kartet ble bygd), med eksport-tidspunktet som fallback — de innebygde kartene har ikke feltet, og et udatert ark er dårligere enn et datert. Kolofonen legges inn rett før siste `</svg>` og lar markupen være urørt hvis viewBox-en mangler — en eksport skal ikke kunne feile på grunn av en kolofon.

---

## 2026-07-28 — v2.4.19: Bunn-skuffene deler maksbredden med modalvinduene

Skuffene som glir opp fra bunnen av viewporten strakte seg fortsatt i full bredde, så på en bred skjerm ble kulturminne-info, målestasjons-info, punkt-menyen, høydeprofilen, FAB-panelene, kart-innstillingene og hele ruteplanleggerens skuff liggende som en stripe over hele skjermen — samme lesbarhetsproblemet som modalvinduene fikk løst forrige økt, og i tillegg dekket de unødig mye kart. Alle skuffene bruker nå én felles regel, `.drawer-shell` i `style.css`: full bredde på mobil og stående nettbrett, men aldri bredere enn 700 px, midtstilt. Regelen virker også for skuffene som er ankret med `absolute inset-x-0` (ruteplanleggeren og kart-innstillingene på mobil), fordi auto-margininene deler restplassen når posisjonen er over-bestemt. Over 700 px får skuffen også sidekanter (1 px, farge arvet fra dens egen `border-<farge>`-klasse) så panelet leses som en avgrenset spalte når det ikke lenger går fra kant til kant — under 700 px er de utelatt, der ville de bare blitt hårstreker ute i skjermkanten. Kart-innstillingene på desktop (≥768 px) er urørt — den er et høyrestilt side-panel med dragbar bredde, ikke en bunn-skuff.

---

## 2026-07-28 — v2.4.18: Hamburger-animasjonen blir ikke lenger dekket av skuffen

Hamburger-knappens streker→kryss-animasjon forsvant midtveis, fordi hovedmenyen glir inn OVER knappen. En høyere z-index på knappen alene hjelper ikke: den ligger inne i visningenes topprader, som har sine egne z-index-er og dermed sine egne stacking contexts — et barn kan ikke klatre ut av forelderens kontekst. Mens menyen er åpen flyttes derfor SAMME knapp-element til `<body>` med fixed posisjon (Vue `Teleport` med `disabled`), målt til plassen den sto på rett før åpningen, så den ser ut til å stå helt stille mens panelet glir inn under den — og CSS-transisjonen på strekene fortsetter uavbrutt gjennom flyttingen, siden elementet gjenbrukes. Plassholderen holder plassen i toppraden i mellomtiden. Skuffens egen X er fjernet: hamburgeren ER lukkekontrollen, og to kryss ved siden av hverandre var uansett en for mye. Laget er z-205 — over skuffen (201) og backdropen, men under modalene (210/211), ellers hadde knappen flytt oppå «Om Så i lende» og dekket tittelen på mobil.

---

## 2026-07-28 — v2.4.17: Skjøtene mellom kartfliser, blokkmark-mønsteret og midtstilt forside

Relieffet spratt i styrke fra flis til flis, og det hadde en konkret årsak: DEM-oppløsning velges PER FLIS. Proben er 10 m (fine konturer) eller 20 m, og for fine kart forsøkes en oppgradering til 2/3/5 m som faller tilbake til proben når nettet svikter — så to nabofliser bygget på ulikt tidspunkt kunne ende på f.eks. 10 m og 20 m over samme terreng (synlig i «Mine kart»: «DEM 10 m» ved siden av «DEM 20 m»). Et grovt rutenett glatter terrenget, så skråningen målt over ÉN celle blir systematisk mindre, og relieffet flatere. Skyggingen måler nå skråningen over en fast basislinje på 20 m bakke uansett rutenett, så begge fliser er enige der terrenget er det. Samtidig er en gammel kant-feil rettet: gradienten ble alltid delt på to celler, også der kant-klampingen bare ga én, så ytterste rad og kolonne fikk halvert skråning — en systematisk lysere stripe rundt hver flis, og en dobbel lys stripe der to fliser møttes. Nå deles det på faktisk avstand mellom prøvene. Den hårfine søm-streken i vektor-innholdet er angrepet med at hver spøkelses-flis blør 0,5 m ut over cellen sin (0,05 mm på trykk): en nested `<svg>` klipper på nøyaktig samme koordinat som naboen, og ved ikke-heltallig zoom havner klippekanten midt i en enhetspiksel som ingen av sidene dekker helt — nå overlapper de i stedet, og flisas egen bakgrunn er strukket med så sonen ikke står transparent. I tillegg: ISOM 210 «Blokkmark» har vært et HELT TOMT mønster, fordi trianglet — mønsterets eneste element — fikk «mm»-enheter i `points`, som SVG ikke tillater der; koordinatene konverteres nå til bruker-enheter, og trianglet tegnes. Til slutt er forsiden lagt i en midtstilt spalte med samme maksbredde som modalene (700 px) med scroll i siden, og «Flere valg» i Mine kart-modalen åpner Nytt turkart som modal i stedet for å navigere bort og lukke menyen.

---

## 2026-07-28 — v2.4.16: Alle menyens sider er modalvinduer

Fortsettelsen av v2.4.15: nå åpner hele hovedmenyen modalvinduer i stedet for å navigere bort. «Mine kart», «Mine ruter» og «Nytt kart» er med — så menyen aldri lukker seg, og du slipper å finne veien tilbake. Det krevde at innholdet ble skilt fra siden det bodde i: `MapLibrary` (fane-veksler, Mine kart med lag-nytt-flyten, Mine ruter med del/stjerne/sortering) er trukket ut av MapHomeView, og `MapPickerContent` (søk/GPS, senter, bredde, ekvidistanse, format, forhåndsvisning) ut av MapPickerView. Begge deles nå mellom ruten og modalen, så det finnes én implementasjon — ikke to som glir fra hverandre. Forsiden består som før: den er boot-målet ved app-start, og fanen speiles fortsatt mot `?tab=kart|rute` så delte lenker og refresh lander riktig. Ruten `/nytt` består også, fordi den er inngangen for delte kart-lenker (`?share=…`). Til slutt fikk forsidens toppbar en tittel — «Så i lende» — så stripen leses som en header i stedet for en rest: hamburgeren sto alene i et tomt felt, men kan ikke bare fjernes, siden den ER inngangen til menyen på forsiden.

---

## 2026-07-28 — v2.4.15: Menyens sider er modalvinduer, og GPS-varselet er klikkbart

«Om appen» og «Tegnforklaring» var egne ruter. Å åpne dem lukket hovedmenyen, veien tilbake gikk via nettleserens tilbake-knapp, og sidene arvet en vestigial header med et hamburger-ikon øverst til venstre som ikke hørte til noe sted. Nå er de modalvinduer oppå den åpne menyen: ESC eller X lukker, og du lander i menyen slik du forlot den — uten rute-endring. Begge deler et nytt modal-skall (`AppModal`) med felles ramme, fokus-håndtering og bredde: full bredde på mobil og stående nettbrett, men aldri bredere enn 700 px, siden en tekstspalte over hele en bred skjerm er ulesbar. Innholdet er trukket ut til `AboutContent`/`LegendContent` og deles med rutene `/om` og `/tegnforklaring`, som består for deep-lenker og offline-kravet. Escape håndteres av menyen, som eier begge lagene og derfor lukker det øverste først — to uavhengige lyttere ville lukket både modalen og menyen på samme tastetrykk. Samtidig: GPS-varselet «Unøyaktig posisjon» gikk i full bredde, så lukke-krysset lå rett under FAB-knottene og advarselen var umulig å bli kvitt på en maskin uten ekte GPS (de fleste laptoper triangulerer på wifi og treffer sjelden bedre enn ±100 m, så den sto der hele tiden). Det følger nå samme `right-20` + maksbredde som de tre andre bannerne i samme fil, og krysset er klar av knottene.

---

## 2026-07-28 — v2.4.14: Kanthåndtakene rører ikke kartet lenger

Flise-utvidelsen føltes som hopp og sprett. To ting i forhåndsvisningen sto for det, og begge er fjernet. Den skalerte kartet ned for å få hele det kommende arket inn i viewporten, og satte det tilbake ved slipp — med åtte håndtak langs arkkanten ble hver stryking over kanten en serie zoom-ut/zoom-inn. Og den tegnet mørkegrå spøkelsesceller for flisene trykket ville hente: kart-transformen animeres over 200 ms mens de cellene er absolutt-posisjonerte og hopper rett til sluttkoordinatene, så på mobil — der trykk-og-hold ER hele interaksjonen — lå de grå feltene oppå det ennå ikke ferdig-animerte kartet i stedet for utenfor det. Nå står kartflaten helt stille: forhåndsvisningen er knappen som vokser og pilla «Vest i lende +1», ingenting males i kartet, og «+N» sier fortsatt presist hva trykket koster. Fjerningen tok med seg et helt problemkompleks — da arket flyttet seg, gled håndtaket vekk under en stillestående peker, nettleseren fyrte pointerenter/-leave på layout-flyttingen, og visningen blinket i en løkke; det krevde peker-sporing som nå er borte og erstattet av vanlig pointerenter/-leave.

---

## 2026-07-28 — v2.4.13: Kanthåndtak i stedet for kompassroser, og ryddet hovedmeny

To design-endringer fra samme handoff. **Kanthåndtakene**: de åtte kompassrosene som utvidet kartet lå som SVG inne i kartflaten, med permanente «Nord i lende»-etiketter som konkurrerte med terrenget. De er nå åtte runde, gjennomsiktige knapper med pilikon som sitter på ARKETS kant utenfor kart-transformen — knapp, hårlinje og pille holder ekte skjermstørrelse uansett zoom, mens ankeret følger arket når det vokser, panoreres eller roteres (pila roterer med, så den alltid peker mot kanten den utvider). Treffområdet er 48 px for hansker. Ved hover, tastaturfokus eller trykk-og-hold vokser knappen, retningsnavnet og den faktiske kostnaden vises («Vest i lende +1» — samme filtrering som byggingen bruker, så allerede bygde fliser er ikke med), spøkelsesceller markerer hver flis trykket henter, og arket skalerer ned så hele det kommende utsnittet er synlig før du slipper. Nedskaleringen settes tilbake når du slipper. **Hovedmenyen** er ryddet i tre nivåer: modus (Turkart / Turplanlegger) er en segmentbryter helt øverst i stedet for et menyvalg midt i lista, og innholdet under følger modusen; primærvalgene er kort med antall og undertekst («12 lagrede · sist Håøya i går»); de fire kartsnarveiene er blitt chips som bare finnes når et kart er åpent; og tekststørrelsen er tre samtidige valg (100/125/150) som skalerer skuffen umiddelbart i stedet for en usynlig syklus. Menyen har fått handoffens egen varmere palett — grønt brukes kun til aktivt valg og «legg til».

---

## 2026-07-28 — v2.4.12: Gang- og hengebroer vises nå

Fotgjenger- og sykkelbroer (inkludert hengebroer) dukket ikke opp på kartet — f.eks. brua over Bondivannet ved Vardåsen manglet helt. Årsak: ordinære `footway`/`cycleway` er bevisst filtrert bort fra turkartet (v8.9.24, for å unngå fortaus-rot), men det tok også med seg bro-spennene, som aldri ble hentet fra Overpass og dermed aldri tegnet. Nå hentes footway/cycleway som ETT unntak når de er broer (`bridge` satt og ≠ `no`), og spennet klassifiseres som sti (505) så det leses som en stiplet kryssing med bro-parapetene (509) — akkurat som sti-broer alltid har blitt tegnet. Hengebroer (`bridge=suspension`) dekkes av samme regel. Ordinære fortau/sykkelstier faller fortsatt bort, så kartet forblir rent. Gjenbruker det eksisterende «Bro»-laget — ingen ny toggle.

---

## 2026-07-28 — v2.4.11: Fjernet trigonometriske punkter

Trigpunkter (ISOM 113) er fjernet helt fra Lende. Bakgrunn: OSM har nesten ingen `man_made=survey_point` i Norge (~1 pr 75 km²), og Kartverkets fastmerke-data finnes bare som WMS-raster — ingen live vektortjeneste som lar seg koble inn i den vektorbaserte kart-pipelinen uten en egen bake-jobb. Symbolet dukket derfor praktisk talt aldri opp, så vi slutter å reklamere for det. Fjernet: klassifiseringen (`isTrigPoint` + ISOM 113 i symbolizer), Overpass-henting av survey/geodesic-noder, trig-bucket/render/lag-wiring i kartbyggeren, peak/trig-overlappen (topper som også var fastmerker viste trekant — nå alltid vanlig topp-prikk), «Trigpunkter»-laget i kartlag-menyen, katalog- og symboldefinisjonen, og trigpunkt-prøven fra Tegnforklaring-siden. Ingen andre symboler påvirkes.

---

## 2026-07-28 — v2.4.10: Veiramper ut av rundkjøringer + ryddet tegnforklaring

Rundkjøringer og planskilte kryss i OSM kobler til hovedveien via `*_link`-ramper (f.eks. `primary_link`), og Lende hverken hentet eller tegnet disse — så avkjøringen ut av rundkjøringen forsvant og veien så ut til å stoppe i ringen (rapportert Jarlsberg-krysset fv300/fv308 i Tønsberg). Nå hentes `motorway_link/trunk_link/primary_link/secondary_link/tertiary_link` i Overpass-spørringen og tegnes som sin foreldre-klasse (ISOM 501/502/503). Samtidig er hjelpekurve (ISOM 103) og skråstrek (ISOM 104) fjernet fra Tegnforklaring-siden — Lende genererer dem ikke, så prøvene var villedende. Merknad om trigpunkter: de rendres korrekt når data finnes, men OSM har nesten ingen `man_made=survey_point` i Norge (~1 pr 75 km²), så de dukker sjelden opp — det er en dekningssak i kildedata, ikke en feil i kartbyggeren.

---

## 2026-07-27 — v2.4.9: «Installer som app» i hovedmenyen

Lagt en «Installer som app»-knapp nederst i hovedmenyen, vist kun når appen ikke
alt kjører installert (standalone) og nettleseren støtter install — Chrome/Edge/
Samsung via `beforeinstallprompt`, eller iOS med manuell «Legg til på Hjem-skjerm»-
veiledning. Fra før lå install-knappen bare på forsiden og i del-kart/rute-flyten;
nå er den tilgjengelig fra hvor som helst i appen. Bruker samme `usePwaInstall`-
singleton som resten.

---

## 2026-07-27 — v2.4.8: Boot-loop-vern mot blank/fanget app

Appen gjenopptar sist brukte kart ved oppstart (`/` → `/kart/:id`). Havnet den
rutas kartvisning blank — f.eks. et ødelagt lagret kart eller et stale service-
worker-skall — sendte hver ny last brukeren rett tilbake i fella, uten synlig
vei ut. Lagt inn et boot-loop-vern: rett før gjenopptak settes et
«pending»-flagg for kartet, og MapView fjerner det så snart visningen har
montert. Kommer man tilbake til `/` med flagget fortsatt satt (forrige forsøk
fullførte aldri), hoppes gjenopptaket over, pekerne ryddes og man havner trygt
på forsiden — én reload er nok. I tillegg fanger en global feilhåndterer nå en
ukjent render-/oppstartsfeil på en kart-rute, rydder gjenopptaks-pekerne og
sender brukeren til forsiden. Ingen endring for normal bruk der kartet laster
som det skal.

---

## 2026-07-27 — v2.4.7: Riktig skriftfarge på fargede paneler i lyst tema

Fikset kontrast i lyst tema for paneler med farget bakgrunn. De grønne
toast/banner-panelene (Stifinner, Rundtur, Måling, nærhetsvarsel, «Følger
rute», markerings-chip) og «Bekreft»-knappen fikk feilaktig mørk tekst fordi
den globale `white → ink`-snuingen antok mørk bunn — men bakgrunnen er grønn i
begge tema. Innført en `.on-accent`-hjelpeklasse som pinner ink til hvit og
aksent-skyggene til pale på slike solide flater, så teksten forblir lys-på-
farge i begge tema (mørkt uendret). Info-panelene (blå tips-/Wikipedia-kort,
verne-/naturtype-kort) og den rosa GPS-boksen i Sporing hadde nesten-hvit
tekst på lys tone; de får nå mørk skrift i lyst tema — blå info-tekst blir
mørkeblå, den rosa boksen mørkegrå (likt de andre rosa boksene). Aksent-
skyggene 50/100/200 remappes nå til mørke toner i lyst tema for alle tonede
paneler.

---

## 2026-07-27 — v2.4.6: Snarvei-raden følger tema i lyst modus

Snarvei-raden over kartet (Stifinner, Runde, Måling, Sporing, Info) hadde
hardkodet hvit ikon- og tekstfarge i den scopede CSS-en, så på den hvite
pillen i lyst tema ble ikonene og etikettene usynlige (hvitt på hvitt). Byttet
til `var(--color-ink)` så raden følger temaet — mørk tekst i lyst, hvit i mørkt
(uendret).

---

## 2026-07-27 — v2.4.5: Lyst/mørkt/automatisk UI-tema

Ny «Utseende»-velger i hovedmenyen med tre valg — Lyst (sol), Mørkt (halvmåne)
og Automatisk (lyn, følger telefonens systemtema). Default er mørkt, som er
dagens utseende, så ingenting endres før man aktivt velger noe annet. Valget
lagres i localStorage og settes før første paint (ingen blink), og alle sider,
skuffer og paneler følger temaet via et nytt semantisk token-lag (`--color-app`,
`--color-surface`, `--color-ink` m.fl.). Lyst tema bruker en varm papirtone som
ekko av kartet. Kartets egne ISOM-farger er uavhengige og styres fortsatt i
«Tema»-skuffen, og Tegnforklaringen beholder sin egen tema-velger. «Om appen» er
flyttet nederst i menyen. App-ikonet, favicon og iOS-ikonet er uendret (mørk
bakgrunn, gule ringer); logo-motivet i forsidens topplinje tegnes med røde
konsentriske ringer i lyst tema. PWA-ens `theme-color` følger nå aktivt tema.

---

## 2026-07-27 — v2.4.4: Riktig zoom-fiks i kart-søket + GPS-navn i kartvelgeren

Rettet overflow-feilen i kart-søkefeltet på ordentlig ved 125/150 %
tekststørrelse. Forrige forsøk (width-kompensasjon) var feil — den krympet raden
til 66 % OG ikonene forsvant fortsatt ut. Rotårsaken var en klassisk flexbox-
felle: input-feltet manglet `min-width: 0`, så det holdt sin innholdsbaserte
min-bredde og skjøv kontroll-ikonene utenfor skjermen. Verifisert med Chromium på
begge tekststørrelser. I «Nytt turkart» fyller den grønne GPS-pinnen nå «Navn på
kart» automatisk med nærmeste stedsnavn (revers-geokoding, samme flyt som
forsiden). Finnes ingen navngitt plass, skjules hele «Sentrum av kart»-boksen —
kartet får uansett navn og dato fra byggeflyten.

---

## 2026-07-27 — v2.4.3: Søke-UI-finpuss og GPS-pin i kartvelgeren

Gruppe-overskriftene i kart-søket er nå fargekodede og fremhevet: «I dette
kartet» i grønt, «Andre steder i Norge» i blått (samme blå som bygg-radene),
begge som tydelige seksjons-etiketter i stedet for svak grå tekst. Rettet en
GUI-feil der kontroll-ikonene i søkefeltet ble skjøvet ut av skjermen ved 125/150
% tekststørrelse — `zoom` skalerte også bredden, så feltet får nå width-
kompensasjon og holder seg innenfor skjermen. I «Nytt turkart» er den separate
«Sentrer kartet på meg (GPS)»-knappen under søkefeltet fjernet; GPS-snarveien
ligger nå som en grønn pin ytterst i søkefeltet, likt forsiden.

---

## 2026-07-27 — v2.4.2: Tydeligere søketreff og stabil GPS

Kart-søket skiller nå gruppene tydelig: treff inne i det åpne kartet får
overskriften «I dette kartet:», symmetrisk med «Andre steder i Norge:» under.
Bygg-nytt-kart-radene har fått et «+»-ikon (ikke kartnål) og aksentfarget
«Bygg nytt kart her», så det leser som en handling i stedet for enda et sted å
hoppe til. «Hold skjerm våken» slipper ikke lenger locken automatisk etter to
minutter — når bryteren er på, holdes skjermen våken sammenhengende til du slår
av eller forlater kartet, slik at GPS-posisjonen ikke dør mens du orienterer
ute. Siden bryteren er en bevisst opt-in, viser Om-fanen nå en tydelig rød
batteri-advarsel mens den er på.

---

## 2026-07-27 — v2.4.1: Stifinner-snarveien plukker startpunkt før mål

Snarvei-inngangen til Stifinner sikter nå inn punktene i naturlig rekkefølge:
FØRST startpunktet (A), så målet (B) — motsatt av før, der målet ble valgt
først. Modus-maskinen er snudd tilsvarende (pickingStart → pickingDest →
showing), og modus-banneret viser et eget «Velg mål»-steg. Long-press-
inngangen «Naviger hit» er urørt — der er det trykkede punktet fortsatt målet,
siden «hit» nettopp betyr destinasjonen.

---

## 2026-07-27 — v2.4.0: Ryddet fargepalett, ekte høykontrast-mørk og sti-farger

Tema-menyen er delt i to: «Lys (ISOM)» og «Mørk» står som hovedtemaer, mens
Sepia, Indigo, Petrol, Mocha, Forest og Curves er samlet under «Monokrom».
Mørk er skrevet om fra bunnen til et reelt høykontrast-tema for svaksynte —
mørk nøytral bakgrunn, vegetasjonstetthet som stiger i valør i stedet for å
drukne, vann under hele landrampen og halo på alle navn, med WCAG AA–AAA på
alt navigasjonskritisk. Monokrom-familien er bygget etter én felles oppskrift
der hvert tema er én farge i en fast valørtrapp, brutt bare av røde
høydekurver som felles signatur og et kjølig vann som motvekt; Curves beholder
sine gule kurver, men har nå resten av kartet med seg i en hviskende valør i
stedet for å vise høydekurver alene. Fordi relieff visker ut nettopp det
ensfargede uttrykket, slås det av automatisk når et monokrom-tema velges — ett
trykk på relieff-knotten henter det tilbake, og valget lagres ikke, så din egen
relieff-innstilling er urørt så snart du bytter tema igjen.

Utviklerknappen «Lilla stier» er erstattet av noe du faktisk kan styre: i
panelet «Strek — dette kartet» har Stier-kortet fått to fargevelgere under
tykkelse-slideren, for den stiplede streken og for den lyse underlinja, med en
nullstill-knapp som gir temaets egne farger tilbake. Fargene lagres per kart,
følger med i eksport og utskrift, og kan settes fra MCP med `stiFarger`.
Samtidig følger eksport og utskrift nå temaet i det hele tatt — før falt SVG,
PNG, PDF og print alltid tilbake på de lyse ISOM-fargene. Tegnforklaringen er
koblet på det ekte tema-systemet og viser alle temaene i stedet for sin egen
Lys/Mørk-bryter mot en duplisert fargekilde, som nå er slettet. To gamle feil
er rettet på veien: høydetallene manglet halo helt, og dybdetallene fikk haloen
malt oppå sifrene.

---

## 2026-07-26 — v2.3.11: Eget invitt-banner for delt rundtur

Når noen åpner en delt rundtur i kart-pickeren, viste banneret samme tekst som
for et vanlig delt kart («Noen har delt et kart med deg!»). Nå fremhever
banneret at det er et turforslag som er delt («Noen har delt et turforslag med
deg!») og at kartet kommer med rundturen tegnet inn og klar til å følges.
Stedsdeling og vanlig kartdeling beholder sine egne tekster.

---

## 2026-07-26 — v2.3.10: Del rundtur

«Gå en runde herfra» kunne ikke deles slik man deler «Del kart og sted». Nå har
den grønne «Følger rundtur»-boksen en liten «Del rundtur»-knapp som lager en
delings-lenke via samme mekanikk som stedsdeling (native share-sheet på mobil,
kopier-til-utklippstavle på desktop). Lenken bærer kart-utsnittet pluss
rundturens origo og vendepunkt(er) som eksakte koordinater, så mottakeren får
opp samme kart og lander i samme modus — rundturen er tegnet inn og markert.
Ruten deles parametrisk (origo + vendepunkt + valgt rute-indeks) og re-planlegges
hos mottakeren, akkurat som kart-utsnittet regenereres, så URL-en holder seg liten.

---

## 2026-07-25 — v2.3.9: Rett slider-skala i «Nytt kart» til 16 km

Skala-etikettene under bredde-slideren i kart-pickeren (`/nytt`) viste fortsatt
det gamle taket (1 / 4,5 / 8 km) etter at maks ble hevet til 16 km i v2.3.8.
Nå viser de 1 / 8,5 / 16 km, i tråd med det slideren faktisk tillater.
«Innstillinger»-slideren var allerede riktig (den leser MAP_SIZE_MAX_KM).

---

## 2026-07-25 — v2.3.8: Større standardkart (8 km) og høyere maks (16 km)

Default kartstørrelse for nye kart er hevet fra 5 til 8 km, og maks bredde fra
8 til 16 km — appen er nå responsiv nok, også på eldre mobil (testet på Samsung
S22+), til å tåle større standardkart. Både «Innstillinger»-slideren (nye kart
fra søk/GPS) og «Flere valg»-pickeren (`/nytt`) går nå opp til 16 km, og pickeren
starter på 8 km. 8 km-standarden gir 20 m auto-ekvidistanse (tabellen ≥ 6 km →
20 m), som «Nullstill»-teksten nå viser dynamisk. 16 km-kart avvises aldri — de
faller tilbake til grovere DEM via celletaket i `createMapFlow`. Justeres ned
igjen hvis 16 km viser seg for tregt i praksis.

---

## 2026-07-24 — v2.3.7: Bedre plassering av kulturminne-toasten

Toasten «N arkeologiske kulturminner i dette utsnittet» lå for lavt (`bottom-20`)
og strakte seg helt ut til høyre kant (`right-3`), så den kolliderte med kompass-,
zoom- og fjell-kontrollene og klemte seg inntil målestokken. Nå bruker den samme
plassering som «ikke ferdig bygd»-boksen — `bottom-32 left-3 right-20` — løftet
over målestokken og med plass til kontroll-stabelen på høyre side.

---

## 2026-07-24 — v2.3.6: «Mine ruter»-flyten samlet i hjem-fanen

Stjernesetting, sortering, stjernefilter og dele-flyten for lagrede ruter
bodde i planleggerens «Mine ruter»-ark — som mistet inngangen sin da FAB-en
røk i v1.0.75 (arket ble utilgjengelig dødkode). Nå bor hele flyten ETT sted:
hjem-sidens Ruteplanlegger-fane. Radene har trykkbare stjerner (1–5, samme
stjerne igjen = fjern), verktøylinja har sortering (Dato/Lengde/Km grus/
% grus/Stjerner, persistert med samme localStorage-nøkkel som før) og eksakt
stjernefilter, og deling finnes både per rute og som «Del …»-velgemodus der
inntil 5 ruter pakkes i én lenke (?r=token — mottaker-parseren er uendret).
«Slett alle» er også på plass. Det gamle arket + tilhørende tilstand er
slettet fra planleggeren (som beholder lagring, aktiv-rutens Del/GPX og
?open=-dyplenken), og stjerne-visningsbuggen i hjem-lista (leste `stars`,
feltet heter `stjerner`) er borte på kjøpet.

---

## 2026-07-24 — v2.3.5: Bredere stedssøk — flere treff, alltid globale forslag

Stedssøket var i praksis kappet på 8 treff (SSR treffPerSide=8, Nominatim
limit=8, flette-tak 8) — nå hentes og vises inntil 20 fra hver kilde (fortsatt
flettet, deduplisert og rangert; MCP-verktøyet sok_sted kan be om inntil 20).
Viktigere: i kartvisningen ble globale treff (Kartverket SSR + OSM) bare vist
når kartets interne søk ga NULL treff — fantes søkeordet i kartet, så brukeren
aldri andre steder. Gaten er fjernet: «Andre steder i Norge»-seksjonen vises
nå alltid nederst i trefflista, under kart-treffene, med «Bygg nytt kart
her»-handling per treff. At søkeordet også finnes i kartet er uviktig — det
nye kartet får uansett navn etter treffet som velges.

---

## 2026-07-24 — v2.3.4: Kirke-symbol — rent kors, alltid rettvendt

Kirke-symbolet (ISOM 532) er endret fra den gamle hytte-stil rammen-med-kors til et rent, sort latinsk kors med hvit halo. Haloen (en litt bredere hvit «casing» bak korset) gir lesbarhet også oppå brun bygnings-fyll og veier, uten en boks rundt. Symbolet er nå også `data-upright` i kartet, så MapView mot-roterer det ved kart-rotasjon — korset står alltid rettvendt mot skjermens topp (samme mekanikk som topper, parkerings-P og fredet-markørene) i stedet for å vippe med kartet. Symbolene bakes inn i hvert lagrede kart-SVG ved bygging, så endringen gjelder kart som bygges fra nå av; eksisterende kart viser det gamle symbolet til de bygges på nytt.

---

## 2026-07-24 — v2.3.3: Orddeling-finpuss — snarveiene bryter ikke, myke bindestreker på lag-knapper

To finjusteringer av orddelingen fra v2.3.1. Snarvei-raden på kartet (Stifinner / Runde / Måling / Sporing / Info) er nå unntatt det globale `hyphens: auto` — etikettene er ett kort ord hver og skal aldri deles («Stifin-ner»); de holdes på én linje (`hyphens: manual` + `white-space: nowrap`). På de trange lag-knappene i Innstillinger sprakk de lengste ordene ut av knappen fordi et flex-ledd ikke krymper under sitt lengste ord — så automatisk orddeling aldri fikk et bruddpunkt. Vi har lagt inn en myk bindestrek (`&shy;`, U+00AD) i «Kultur­minner» og «Vannmåle­stasjoner», som gir et eksplisitt, usynlig bruddpunkt slik at ordene deler seg pent i stedet for å flyte over.

---

## 2026-07-24 — v2.3.2: Arkeologiske kulturminner — filtrert kilde, ærlig antall, toast ved mange

«Fredede kulturminner»-laget viste ingenting i tette utsnitt (Oslo: 16 421 → tomt kart). Årsaken var ikke en bevisst sperre: badge-tallet hentes med en pytteliten `hits`-spørring (virker alltid), mens selve laget dro ~1,9 MB features som timet ut på mobil og bakte inn en tom liste. I tillegg var «fredet» misvisende — datasettet domineres av SEFRAK-bygg med kommunal/plan-status, ikke arkeologiske funn. Nå filtrerer vi **server-side** (WFS FES-filter) til de arkeologiske kategoriene — arkeologiske funn (E-ARK), bergkunst (E-BER) og kulturminner under vann (E-MAR) — så både badge-tallet og laget blir ærlige og små (Oslo: 16 421 → 825). Laget er døpt om til **«Arkeologiske kulturminner»**. Når utsnittet fortsatt har flere enn vi henter (tak på 600), viser vi en toast rett etter lasting: «825 arkeologiske kulturminner i dette utsnittet — viser de første 600. Zoom inn …», som auto-skjules. Turrapporten bruker samme, ærlige overskrift. Henting har fått lengre timeout (20 s) siden geometri-payloaden er stor på tette utsnitt.

---

## 2026-07-24 — v2.3.1: UU — utvidet tekststørrelse-støtte, bindestrek og luftigere kart-rader

Videreført arbeidet med brukerens valgte tekststørrelse. **Innstillinger-skuffen** følger den nå fullt ut: de tre hurtigvalg-knappene (Tegnforklaring / Start GPS / Kompass) og fane-raden (Kartlag, Tema, …) skaleres nå med samme zoom som fane-innholdet allerede gjorde. **Kart-søket** (søkefelt, hjelpetekst og trefflista inne i et kart) følger nå også valgt tekststørrelse. Generelt har UI-et fått `hyphens: auto` (norsk orddeling via `html lang="no"`), så lange ord som «Vannmålestasjoner» og «Fredede kulturminner» deler seg pent med bindestrek på trange knapper i stedet for å flyte stygt over — kartets egne stedsnavn er holdt utenfor. Den gule «mange kart»-advarselen på forsiden har fått en klikkbar «slett alle kart»-lenke. Og på Mine kart-lista hopper «blyant»- og «søppel»-knappene ned på egen linje under kartnavnet når tekststørrelsen er større enn 100 %, så navnet får plass.

---

## 2026-07-24 — v2.3.0: Forenklet kartdetalj — 2,5 m ekvidistanse, fjernet Kartdetalj + canopy

Detalj-oppsettet er kraftig forenklet etter testing viste at ekstra-funksjonene ikke bar sin egen kompleksitet. **«Kartdetalj»-seksjonen er fjernet** (Rask/Standard-nivåene, hjelpekurve-bryteren og skog-nyanse-bryteren). **Hjelpekurver er erstattet av en ren ekvidistanse-knapp «2,5 m»** — for hjelpekurver *er* egentlig bare finere ekvidistanse — som tegnes som vanlige heltrukne røde høydekurver (ikke stiplet), tilgjengelig kun på kart ≤ 2 km bredde (der finere kurver er lesbare). Fine kart (≤ 5 m, inkl. 2,5 m) henter fortsatt automatisk et 2 m-rutenett med glatte kurver, og bygger nå raskt takket være topp-fiksen i v2.2.3. **Canopy/skog-nyanse (CHM/DOM) er fjernet helt** — fra interaktiv app, headless-bygg og Vardåsen-scriptet — siden den aldri ga synlig verdi. Auto-ekvidistanse (søk/GPS-kart) tar aldri 2,5 m uoppfordret; det er et bevisst manuelt valg. Standard-kartkvaliteten (glatte 2 m-kurver ved fin ekvidistanse) er uendret.

---

## 2026-07-24 — v2.2.3: Fikset treg bygging på fine kart (topp-deteksjon)

Fine kart (≤ 5 m ekvidistanse → 2 m DEM) tok minutter å bygge på mobil. Profilering avslørte at `detectSummits` alene sto for ~48 av ~52 sekunder på et 3 km-kart: topp-søket bruker et 250 m vindu, som på et 2 m-rutenett blir 125 celler i radius → ~1,5·10¹¹ operasjoner. Fiksen kjører topp-deteksjonen på et ~10 m-nedskalert DEM (topper trenger ikke 2 m-presisjon; verifisert at samme topper finnes, ±2 m høyde). `summits` faller fra ~48 000 ms til ~100 ms, og total byggetid for et 3 km/2 m-kart fra ~52 s til ~4 s. Kontur-kvaliteten er uendret (konturene bygges fortsatt fra fullt 2 m-rutenett). Dette er en ren ytelsesfiks; ingen UI-endring.

---

## 2026-07-24 — v2.2.2: Hjelpekurver virker ved alle ekvidistanser

«Hjelpekurver»-bryteren var en stille no-op på default-ekvidistansen (20 m): hjelpekurver bygges bare fra et fint DEM, og det fine DEM-et ble hentet KUN ved ≤ 5 m ekvidistanse — så et 20 m-kart med bryteren på fikk aldri hjelpekurver (uansett zoom). To fikser: (1) `createMapFlow` henter nå fint DEM når hjelpekurver er på, uansett ekvidistanse; (2) `mapBuilder`-porten er løsnet fra `demResM ≤ 3,5` til `≤ 5,5` så hjelpekurver bygges fra både 2 m- og 5 m-rutenett (men fortsatt ikke fra 10/20 m, som ville blitt trappetrinn). Hjelpekurve-intervallet er halve ekvidistansen (2,5 m ved 5 m-kart, 10 m ved 20 m-kart). Ny regresjonstest dekker default-fella (grov ekvidistanse + bryter på → hjelpekurver til stede). Tekstene i velger/innstillinger er oppdatert (ikke lenger «vises ved innzoom»).

---

## 2026-07-24 — v2.2.1: Hjelpekurver vises uten zoom-krav

Hjelpekurvene (v2.2.0) ble bygget riktig, men var gated bak innzoom (`.zoomed-in`, 1,3×), så et kart bygget med bryteren på så tomt ut ved vanlig zoom — forvirrende når man nettopp har skrudd dem på. Zoom-gatingen er fjernet: når «Hjelpekurver»-bryteren er på (og kartet er bygget på nytt), vises de på alle zoom-nivåer. De er fortsatt tynne/stiplede så de leser som en bratthets-/form-indikasjon uten å overdøve hovedkurvene.

---

## 2026-07-24 — v2.2.0: Hjelpekurver + ærlige detaljvalg

Kartdetalj er ryddet opp etter at «Maks» (1 m) viste seg å koste 40× filstørrelse og ~10 minutters bygging for et praktisk talt identisk kart — ved 5 m ekvidistanse gir finere DEM enn 2 m ingen synlige ekstra kurver. Nå er det to uavhengige valg under Innstillinger (og i kart-velgeren): en oppløsnings-akse (Rask 10 m / Standard 2 m ≈ UT.no) og to av/på-brytere. **Hjelpekurver** tegner stiplede 2,5 m-kurver (ISOM 103) mellom 5 m-hovedkurvene, bygget fra det samme 2 m-rutenettet Standard alt bruker — altså nesten gratis (bare flere linjer i SVG-en, ingen ekstra nedlasting) — og vises fra `.zoomed-in` så oversiktsbildet holdes rolig mens innzoom avdekker mer terrengform, à la UT.no. **Skog-nyanse** (CHM) er nå en egen bryter, tydelig merket som det eneste valget som dobler nedlastingen (henter DOM). Rå-1 m «Maks» er fjernet. I tillegg kappes det innebygde høyde-rutenettet som lagres i kartet til ~10 m (nok for høyde-ved-trykk og ruteprofil): det alene fjernet 4 MB-blåsingen og den lange byggetiden. Konturene selv bakes fortsatt med full oppløsning.

---

## 2026-07-23 — v2.1.0: Bruker-valgt kartdetalj (opptil 1 m) + skog-nyanse

Detaljgraden er nå et bruker-valg under Innstillinger (og i kart-velgeren), så man kan tilpasse etter mobil og datamengde. Fire nivåer: Rask (10 m, ~0,4 MB/kart), Standard (2 m — som før, default), Detaljert (2 m + skog-nyanse) og Maks (1 m + skog-nyanse, ~74 MB/kart). Oppløsnings-trappa er utvidet til å inkludere 1 m (`NHM_DTM` er nativt 1 m på samme geonorge-endepunkt vi alt bruker); et eget, romsligere celletak lar 3×3 km @ 1 m gå, mens større kart degraderes automatisk. «Skog-nyanse» henter i tillegg overflate-modellen (`NHM_DOM`, også nativt 1 m) og beregner kronehøyde (CHM = DOM − DTM) for å dele skog i differensierte ISOM-grønt (åpen/normal/tett) — samme motor som headless/CI alt bruker, nå tilgjengelig interaktivt. DOM-hentingen følger DTM-ens faktiske oppløsning og dobler dermed nedlastingen på nivåene der den er på. Valget brukes ved bygging, så det gjelder nye kart; lagrede kart beholder sin detalj til de bygges på nytt. Default er uendret fra v2.0.0.

---

## 2026-07-23 — v2.0.0: 1 m-detaljerte, glatte høydekurver

Høydekurvene bygges nå fra et mye finere høyde-rutenett. Kartverkets NHM_DTM-dekning er nativt 1 m, men vi har historisk under-bestilt WCS-rutenettet (10/20 m) og latt serveren nedskalere — det ga kantete, 10 m-fasetterte kurver. For fine-ekvidistanse-kart (≤ 5 m) henter interaktiv app nå et 2 m-rutenett (konservativt celletak-gated: 2 m for kart opp til ~3 km, 5 m for større, aldri finere enn 2 m for å holde mobil-nedlastingen nede; typisk 3×3 km ≈ 9 MB, flis-cachet). Hentingen er en oppgradering oppå den billige 10 m-proben med fallback til proben, så et kart aldri blir dårligere enn før hvis fin-hentingen feiler. Samme CORS-trygge geonorge-endepunkt som før — ingen ny datakilde. Et lett gaussisk lavpass legges på rutenettet før marching squares, så ekte 1 m-mikrorelieff (grøfter, steinblokker) ikke lager bølgete «spaghetti»-kurver: resultatet er kartografisk glatte kurver som samtidig er mer nøyaktige, og som faktisk får litt færre path-punkter enn dagens 10 m-kurver. Grove kart (≥ 10 m ekvidistanse) og headless/CI-bygg (5 m) er uendret.

---

## 2026-07-23 — v1.0.87: Fjernet Posisjonsnøyaktighet fra kulturminne-arket

Posisjonsnøyaktighet-raden er fjernet fra fakta-blokka. Verdien kom fra Askeladdens nominelle posisjonskvalitet (ofte ±200 m eller mer), som i kartsammenheng er misvisende grovt og ikke tilførte reell verdi. Datering, Type, Kategori, Vernestatus, Beliggenhet og «Lagt inn av» står igjen.

---

## 2026-07-23 — v1.0.86: Datering og type på fredede kulturminner

Fakta-blokka for fredede kulturminner viser nå **Datering** (f.eks. «Yngre steinalder», «Vikingtid», «1800–1899») og **Type** (f.eks. «Gravrøys», «Tuft», «Kokegrop»), i tillegg til full **Kategori**-dekning (alle seks E-koder). Manglet et enkeltminne eget navn, brukes nå typen som tittel i stedet for et generisk «Fredet kulturminne». Verdiene kommer fra Riksantikvarens offisielle SOSI-kodelister, bakt inn som statiske, verifiserte tabeller (datering, enkeltminneart, enkeltminnekategori) — så dekodingen fungerer offline uten ekstra nettverkskall. Ukjente koder faller trygt tilbake i stedet for å vise en gjettet etikett.

---

## 2026-07-23 — v1.0.85: Rikere fakta for fredede kulturminner (Askeladden)

Fredede kulturminner (Geonorge/Askeladden-WFS-en vi allerede henter) viser nå flere felt i fakta-blokken: **Kategori** (E-ARK → «Arkeologisk minne», E-BYG → «Bygning»), **Lagt inn av** (opphav, f.eks. «Byantikvaren i Oslo») og **Posisjonsnøyaktighet** (f.eks. «±500 m» — nyttig for å vite hvor presist punktet er plassert). Vernestatus vises som før. Kommune-koden («0301») skjules i «Beliggenhet» siden den er en tallkode og ikke lesbar; brukerminner viser fortsatt stedsnavn.

Bevisst utelatt: **Datering** og finkornet minnetype er SOSI-tallkoder (f.eks. datering «072») hvis offisielle kodelister ligger bak `register.geonorge.no`, som ikke er tilgjengelig fra byggemiljøet — og de lot seg ikke rekonstruere trygt fra dataene. Vi viser heller ingenting enn feil datering. Datering-feltet er allerede kodet inn i visningen, så det dukker opp automatisk når vi får en pålitelig kodeliste (kan hentes i nettleseren i en senere runde).

---

## 2026-07-23 — v1.0.84: Fakta-blokk øverst i kulturminne-arket

Kulturminne-arket viser nå en strukturert fakta-blokk øverst — før beskrivelse og bilder — med et to-kolonners oppsett à la kulturminnesok.no: Kategori, Vernestatus, Beliggenhet, Datering og «Lagt inn av». Blokken er datadrevet og viser kun felt som faktisk har verdi, siden de to kildene har ulike felt: brukerminner (api.ra.no) gir kategori, sted og hvem som la det inn, mens fredede minner (WFS) gir vernestatus. Datering leveres ikke av kildene ennå, men feltet er med så det dukker opp automatisk om det fylles senere. Den spredte kommune/«registrert av»-teksten lenger nede er fjernet siden den nå ligger i fakta-blokken.

---

## 2026-07-23 — v1.0.83: Tekststørrelse i Tegnforklaring og kulturminne, wrap på forhåndsvalg

Tegnforklaring-siden og kulturminne-POI-arket følger nå den globale tekststørrelse-innstillingen fra hovedmenyen (samme zoom-mekanikk som forsiden og info-panelet). Forhåndsvalg-knappene i lag-fanen bruker nå flex-wrap i stedet for en fast 4-kolonners grid: ved stor tekststørrelse ble fire på rad for trangt, så knappene bryter nå pent til flere linjer (typisk 2 × 2), mens de fortsatt ligger fire på rad ved normal størrelse.

---

## 2026-07-23 — v1.0.82: Grønne «Nytt kart»/«Ny rute» og plussknapper i hovedmenyen

«Nytt kart»- og «Ny rute»-knappene på forsiden er nå grønne (emerald), i tråd med de store lag-nytt-CTA-ene. I hovedmenyen (slide-in fra venstre) er det lagt til to små grønne, kvadratiske plussknapper på linjene for «Mine kart» og «Mine ruter» — en rask snarvei til å starte et nytt kart eller en ny rute uten å åpne lista først.

---

## 2026-07-23 — v1.0.81: Oppdagbarhets-tips for long-press i info-panelet

Long-press på kartet er lite oppdagbart. Nå vises et blått tips øverst i info-panelet når det åpnes via Info-knappen i snarveiene: det forklarer at man kan trykke-og-holde et par sekunder i kartet for å åpne panelet, og at det samme fungerer på de tre knottene nede til høyre for å finjustere kantlinjer, relieff og zoom. Tipset kan lukkes med en X og huskes globalt i localStorage, så det ikke dukker opp igjen. Det vises bevisst ikke ved faktisk long-press — da kan brukeren allerede grepet.

---

## 2026-07-23 — v1.0.80: Lukkeknapp på GPS-feil og tydeligere posisjons-readout

Den oransje «GPS er blokkert for Lende»-varselboksen manglet en måte å lukkes på — nå har den en X-knapp ved siden av teksten, i tråd med de andre varselboksene, og «Prøv igjen» ligger under. Varselet dukker opp igjen hvis en ny GPS-feil oppstår. I Sporing-fanen fikk koordinat-feltet en tydelig etikett («Din GPS-posisjon»), og den kryptiske teksten «Venter på fix …» er byttet til «Venter på GPS-signal …» — og når GPS er blokkert vises «Ingen GPS-posisjon» i stedet for en villedende venter-melding.

---

## 2026-07-23 — v1.0.79: Global tekststørrelse i hovedmenyen

Tekststørrelse-knappen (AA) satt gjemt i headerne på Innstillinger-skuffen og
info-arket, og virket bare der. Den er nå én global innstilling i hovedmenyen
(«Tekststørrelse», sykler 100 % → 125 % → 150 %, persistert på tvers av økter
via ny delt `useUiTextScale`; gammel per-kart-verdi migreres). Skalaen
påvirker nå det meste av lese-UI-et: hjem-fanene (kart-/rutelistene), selve
hovedmenyen (så effekten vises umiddelbart), Om-siden, Innstillinger-skuffen
og info-arket som før, og ruteplanleggerens planlegg-/resultatskuff. Knapper,
flytende chrome og stedsnavn i selve kartet er bevisst uberørt inntil videre.

---

## 2026-07-23 — v1.0.78: «Sporing» tilbake i snarvei-raden

Etter at kompass-FAB-en forsvant (v1.0.77) har snarvei-raden plassen for seg
selv — «Sporing»-snarveien (fjernet i v1.0.75 pga. plassmangel) er tilbake,
plassert nest lengst til høyre (før «Info»). Samme oppførsel som før: ett
trykk starter GPS + sporingsopptak, nytt trykk stopper opptaket (GPS forblir
på). Ikonet er play-trekanten, som blir blått stopp-ikon mens opptak pågår.

---

## 2026-07-23 — v1.0.77: Kompass-FAB slått sammen med Sentrer-knappen

Kompass-FAB-en øverst til høyre var funksjonelt ~50 % overlappende med
«Sentrer»-knappen nederst (som allerede nullstiller både zoom og rotasjon) —
og kolliderte visuelt med snarvei-raden på smale skjermer. Den er fjernet, og
kompassnåla bor nå som ikon PÅ Sentrer-knappen: nåla roterer med kompass-
heading/kartrotasjon som før, og knappen er flyttet øverst av de tre FAB-ene
nede til høyre (over strek- og relieff-knottene). Tap = sentrer + nord opp
(+ GPS-refresh); lang-trykk = zoom-panelet som før. Sentrer-handlingen slår
også av kompass-følge først (samme semantikk som den gamle kompass-FAB-en).
Desktop-sliderne for rotasjon/tekststørrelse ligger igjen der rosen satt.

---

## 2026-07-23 — v1.0.76: Hjem-fanene ryddet — lista eier siden

Oppfølging av fane-hjemmen (v1.0.75): layouten var rotete med søkefelt,
hjelpetekst, install-knapp og stor grønn CTA stablet FØR listene. Nå eier
listene fanene: «Mine kart» og «Mine ruter» ligger øverst, og lag-nytt-flyten
er foldet bak et lite «+ Nytt kart»/«+ Ny rute» oppe til høyre (plussen
roterer til × når blokka er utfoldet). Unntak: når lista er tom vises
lag-nytt/CTA-en direkte, så førstegangsbrukeren sparer et klikk — kart-fanen
viser søk/GPS-flyten, rute-fanen den grønne «Åpne ruteplanleggeren»-knappen i
tom-tilstanden. «Installer som app»-knappen er flyttet nederst på siden så den
ikke konkurrerer med innholdet. I turkartet skjules snarvei-raden også når den
rosa highlight-pillen (søketreff/nærmeste-POI) vises — samme overlay-slot.

---

## 2026-07-23 — v1.0.75: Hjem med faner, ryddet infodrawer og meny-finpuss

UX-oppfølging av hovedmenyen (v1.0.74) basert på bruk på mobil. Hjem-siden er
nå fellesside for begge modusene med to faner — «Turkart (N)» og
«Ruteplanlegger (N)» — der rute-fanen lister lagrede ruter (åpne/slett) og
turkart-fanen har alt fra før; hovedmenyens to øverste valg «Mine kart» og
«Mine ruter» åpner riktig fane, med modus-vekslingen som valg #3. Lagrede-
ruter-FAB-en i planleggeren (kolliderte med zoom-knappene) er fjernet.
Infodraweren er ryddet: «Åpne ruteplanlegger»-knappen, «Kopier koordinater» og
«Del koordinater» er fjernet (kopiering finnes ved koordinatene; deling dekkes
av Del kart-knappene), farge-bakgrunnene på «Del kart og sted»/«Naviger hit»/
«Gå en runde herfra» er nøytralisert, «Nærhetsvarsel» ligger nå rett etter
«Start måling her», og minikartet vises kun når draweren er maksimert (unngår
dobbelt crosshair-utsnitt). De fire eksterne karttjeneste-lenkene (Google
Maps, Street View, UT.no, Vegkart) er flyttet til et eget panel i hovedmenyen
som kun vises inne i et kart (ny delt `useMapContext`). Snarvei-raden i
turkartet skjules mens kartet bygges/utvides (kolliderte med bygge-chipen) og
«Sporing»-snarveien er fjernet (plassmangel mot kompasset). Hovedmenyen glir
nå inn under meny-knappen — hamburgeren→X-en selv er lukkekontrollen, uten
egen X i panelet.

---

## 2026-07-22 — v1.0.74: Global hovedmeny + flytende kart-chrome

Appen manglet en felles meny — hver visning hadde sin egen mørkegrå header-bar
med «Så i lende: …»-tittel og sprikende knapper. Nå finnes én global slide-in-
meny (hamburger→X-animasjon) på forsiden, i turkartet og i ruteplanleggeren, med
veksling turkart↔ruteplanlegger, Hjem/Mine kart, Tegnforklaring og Om appen
(versjon). De grå header-barene og titlene er fjernet; kontrollene flyter nå oppå
kartet. Info-ikonet er flyttet inn i menyen. I turkartet er innstillinger-
hamburgeren erstattet av et tannhjul-ikon (skiller den fra meny-hamburgeren), og
det er lagt til en snarvei-rad med de mest brukte funksjonene: Stifinner, Gå en
runde, Måling, Sporing og Info om stedet. Stifinner/rundtur fra snarveien lar deg
velge både mål og startpunkt med kikkertsiktet (nye `pickingDest`/`pickingOrigin`-
steg i `useStifinner`), mens long-press-inngangen består. Nye delte komponenter:
`useAppMenu`, `AppMenu` (montert i `App.vue`) og `AppMenuButton`.

---

## 2026-07-22 — v1.0.73: Kartverket SSR i stedssøket

Stedssøket gikk før utelukkende mot OpenStreetMap Nominatim, som har mangelfull
og inkonsekvent dekning av norske stedsnavn — «Bøseter» fantes f.eks. ikke, kun
«Bøsetra». Vi legger til Kartverkets SSR (Sentralt stedsnavnregister, via
Geonorge) som autoritativ kilde for norske stedsnavn (fjell, setre, gårder,
grender, vann) med fuzzy-søk, og fletter det sammen med Nominatim (som fortsatt
dekker adresser og POI-er). `src/lib/geocode.js` får `geocodeKartverket` +
`normalizeKartverket` og en `searchPlaces`-orkestrator som kjører begge kilder
parallelt med `Promise.allSettled` (blokkeres/feiler den ene — f.eks. SSR ved
CORS i nettleser — brukes den andre alene), dedupliserer på navn + koordinat
(SSR foretrekkes for korrekt norsk skrivemåte) og rangerer etter match-kvalitet,
kilde og importance. UI-composablen `useNominatim` og MCP-verktøyene `sok_sted`
og `bygg_kart` bruker nå `searchPlaces`. SSR-treff er punkt uten bounding box, som
`extentInfo()` allerede tåler (`anbefaltHalfKm` blir null → 2 km-default).

---

## 2026-07-22 — v1.0.72: Topp-ankrede kart-overlays klarer iOS-statuslinja

Følgefiks etter v1.0.69 (toppbaren fikk sikker-sone-margin på iOS). De topp-
ankrede overlayene på kartflaten — Stifinner/Rundtur-boksen, måle-readouten,
highlight-/feature-pillene, «tegner inn detaljer»-chippen, nærhetsvarselet,
kompassrosen, søke-panelet og bygge-toasten — lå på faste `top-16`/`top-20`-
offset som var stilt inn mot den GAMLE (kortere) toppbaren. Etter at baren ble
skjøvet ned med `env(safe-area-inset-top)` havnet de bak knapperaden på iPhone
(den grønne Stifinner-boksen fikk øverste linje gjemt under tilbake-/meny-
knappene). Vi introduserer én CSS-variabel `--safe-top` (= statuslinje-høyden)
og avledede `--ovl-*`-offset i `style.css`, og lar alle overlayene bruke
`top-[var(--ovl-*)]` i stedet for de bakte tallene. Calc-en bor i CSS-fila
(Tailwind-klasse-tokens kan ikke ha mellomrom, som calc krever rundt «+»). I
vanlig nettleser er `--safe-top` 0, så plasseringen er uendret der.

---


Rotårsaken bak «Stifinner finner ingen stier» på iPhone: long-press-punktet
(mål i Stifinner, via-punkt, måle-/annoterings-tapp) ble regnet ut med
`svg.getScreenCTM()`, som på iOS/Safari ikke tar med CSS-transformen (pan/zoom/
rotasjon) på kartets forelder-wrapper. Når kartet var panorert havnet punktet
kilometer på avveie — diagnosen fra v1.0.70 viste en frisk graf (824 features,
~3000 noder) men mål snappet 11,5 km unna og luftlinje A→B på 16,4 km. Start-
punktet var upåvirket fordi det bruker skjermsenteret via `visibleCenterSvg`,
som allerede regnet ren aritmetikk. Vi erstatter getScreenCTM-veiene med den
samme browser-uavhengige matte-inversen: nye eksporterte kjerner
`screenToViewBox`/`viewBoxToScreen` i useMapExtend, eksponert som
`clientToSvg`/`svgToClient` og brukt av long-press, kart-tapp og pin-plassering.
Enhetstester dekker round-trip (pan+zoom+rotasjon+letterbox) og at pan faktisk
tas med. Gjaldt også måle- og annoteringstapp på iOS.

---


Feilsøkingshjelp for en rapport der Stifinner/«Gå en runde» ikke fant ruter på
iPhone (Safari) selv om stiene vises på kartet, mens samme punkter fungerte på
Android. Ruteberegningen er ren klientside-graf-logikk lest fra kart-SVG-en —
GPS er ikke involvert — så feilen måtte lokaliseres på selve enheten (uten
devtools på mobil). Stifinner eksponerer nå en `diag`-streng som vises under
feilmeldingen i modus-chipen: antall `data-iso`-grupper, hvor mange som er
routbare (501–509), antall parsede features, og graf-noder/kanter — pluss
nærmeste snap-avstand når et punkt ligger for langt fra nettet. Da ser man med
det samme om det er et kode-mismatch (grupper>0, routbare 0), en path-parse-feil
(routbare>0, features 0) eller et koordinat-avvik (features>0 men snap-avstanden
er urimelig stor). Ingen endring i selve rute-logikken.

---


Toppbaren i kartvisningen (tilbake-/spor-knapp, tittel-badge og meny-/søk-knappene
til høyre) lå limt til `top-0` og havnet under iOS-statuslinja i frittstående
app-modus — klokka og batteriindikatoren overlappet knappene («i clinch med
OS-et»). Med `apple-mobile-web-app-status-bar-style: black-translucent` tegnes
innholdet bak statuslinja, så toppbaren trenger sikker-sone-margen selv. Vi
bytter det statiske toppmarget mot `max(env(safe-area-inset-top, 0px), 0.75rem)`,
samme mønster som bunn-UI-et allerede bruker for `safe-area-inset-bottom`, så
baren skyves ned under notch/statuslinje på iPhone og beholder 0.75rem i vanlig
nettleser.

---


Nytt beslutningsnotat `docs/AI_ARKITEKTUR.md` fryser retningen for KI i Lende
(serverless Cloudflare-proxy etter NVE-proxy-malen, «Spør KI om dette
stedet»-knapp, gjenbruk av eksisterende MCP-verktøy, og bevisst *ingen*
hosting-migrering) slik at tråden kan tas opp senere uten å re-derivere alt.
Samtidig er den evige `package-lock.json`-diff-en løst: lockfile-ens
`"version"` lå på 1.0.63 mens `package.json` for lengst var bumpet, så
`npm install` re-synket den ved hver sesjons-oppstart. Lockfile-en er nå i
sync, og `package-lock.json` er lagt inn som fjerde fil i bump-ritualet i
CLAUDE.md så det ikke driver ut av sync igjen.

---

Søke-overlayet i kartet (`MapSearchOverlay`) har fått en mikrofon-knapp for
diktering, slik forsidesøket og kartvelgeren allerede har. Den gjenbruker
`useSpeechInput`-komposabelen — gjenkjenning skjer i nettleseren (nb-NO), ingen
lyd lastes opp — og mater transkriptet inn i søkefeltet via `update:query`, som
om det ble skrevet. Knappen skjules automatisk der nettleseren mangler
SpeechRecognition (samme graceful mønster som geolokasjon), og lyser rødt med
puls mens den lytter.

---


Kart med detalj-inset og turrapporter nester et kart-`<svg>` med egen viewBox
inne i det ytre SVG-et. Nettleseren viser dette riktig på skjerm, men Chromiums
print-sti («Lagre som PDF» og `window.print()`) håndterer ikke nestede
SVG-viewporter — kartet flommet utover eller skaleres feil. Ny `flattenNestedSvg`
erstatter hvert nestede element med en klippet `<g transform>` som reproduserer
viewBox- og preserveAspectRatio-avbildningen selv, slik at ingen nestet viewport
står igjen. `printDocument` bruker den nå, så vektor-PDF via nettleseren blir
korrekt. Resultatet er visuelt identisk for skjerm/canvas og forblir ren vektor.

---

## 2026-07-22 — v1.0.65: Rettet Om-teksten for vannmålestasjon-ikonet

Beskrivelsen på Om-siden sa fortsatt at NVEs hydrologiske stasjoner dukker opp
som «blå vanndråper», men ikonet ble byttet til en rund blå medaljong med to
hvite bølger. Teksten er nå oppdatert til å matche det ikonet brukeren faktisk
ser i kartet.

---

## 2026-07-22 — v1.0.64: MCP tetter hull mot appen + tale-til-tekst i søk

MCP-serveren har fått tre nye evner som lukker gapet mot appens nyutvikling.
Nytt verktøy `vannmalestasjoner` henter NVE-målestasjoner (siste vannføring,
vannstand og vanntemperatur, pluss nedbørfelt/moh/kommune/eier og Sildre-lenke)
for kartutsnittet, et senterpunkt med radius eller en eksplisitt bbox — via
Cloudflare-proxyen, uten nøkkel siden Node ignorerer CORS. Samme hydrologi er
lagt til som en fjerde funn-seksjon i `berik_rute` og `turrapport_svg`. Nytt
verktøy `planlegg_rundtur` planlegger ekte sløyfer (utturen straffes så hjemveien
blir en annen sti) via den ferdig testede `planLoop`, og `planlegg_rute` tar nå
valgfrie via-punkter for paritet med de andre rute-verktøyene. I appen kan de tre
stedssøk-feltene (forsiden, Nytt turkart, ruteplanleggerens Fra/Til) dikteres med
tale-til-tekst via et nytt `useSpeechInput`-composable (Web Speech API, nb-NO);
mikrofon-knappen vises kun der nettleseren støtter det (feature-detect), så iOS
faller pent tilbake til tastatur. Ny utredning `docs/MCP_REMOTE_CHAT.md` veier
remote-MCP mot et chat-view uten å bygge noe ennå.

---

## 2026-07-21 — v1.0.63: Default kartstørrelse hevet fra 4 til 5 km

Målet for hele mobil-ytelse-sporet: standard-kartet (søk/GPS-flyten på
forsiden, «Bygg om» og «Nullstill») er nå et 5 km-kvadrat i stedet for 4 km —
56 % mer areal. 5 km er bevisst valgt som største bredde som beholder 10 m
auto-ekvidistanse (tabellen gir 20 m fra 6 km), så terrenget er like detaljert
som før. Grunnlaget ble lagt i v1.0.59 (gest-arbeid ut av frames), v1.0.61
(content-visibility dropper av-skjerm-geometri) og v1.0.62 (åpnings-/jank-
måling i perf-loggen — sammenlign gjerne «åpne»-linjene før/etter). «Flere
valg»-pickeren starter også på 5 km, og Nullstill-knappen viser nå bredden fra
konstanten så teksten aldri kan drifte igjen. Kyst-DEM-taket er verifisert:
5 km kvadrat = 1M celler, verste portrett (5 × 11 km) = 2,2M — begge under
2,6M-taket, så 5 m-oppgraderingen virker fortsatt på alle formater. En lagret
størrelse-preferanse påvirkes ikke (den overstyrer defaulten som før).

---

## 2026-07-21 — v1.0.62: Perf-loggen måler nå åpning og gest-jank, ikke bare bygging

Tredje steg i mobil-ytelse-sporet: måling. Perf-loggen (Utvikler-fanen →
Byggetider) har til nå kun vist byggetider fra createMapFlow — nå logges også
selve ÅPNINGEN av et kart: én linje per last med tid til første malte frame,
brutt ned i hent (IndexedDB/nett), parse (DOMParser over hele SVG-strengen),
DOM-innsetting, apply-passene og de utsatte indeks-passene (søk/navn-LOD/
culling), pluss node-tall og SVG-størrelse. I tillegg måles gester: en lett
rAF-teller under pinch/pan/rotasjon logger snitt-fps og verste enkelt-frame —
men KUN når gesten faktisk hakket (< 45 fps over ≥ 0,4 s), så jevne gester
ikke fyller ring-bufferen. Dette er datagrunnlaget for å vurdere hvor mye
større default-kart mobilen tåler: bygg/åpne kart på 4/6/8 km og sammenlign
linjene. Også rettet: utdatert status-kommentar i demTileCache.js (cachen er
PÅ, headeren sa fortsatt AV).

---

## 2026-07-21 — v1.0.61: content-visibility — nettleseren dropper av-skjerm-geometri selv

Andre steg i mobil-ytelse-sporet, og forberedelse til å kunne heve default
kartstørrelse. De merge-de bucket-pathene (skog, myr, konturer, veier osv. —
tyngden av kart-geometrien) får `content-visibility: auto`, så nettleseren
hopper over layout og maling av det som ligger utenfor utsnittet — helt selv,
kontinuerlig og fra første paint, uten JS. Dette utfyller den eksisterende
viewport-cullingen: cullingen gir det harde `display:none`-kuttet ved gest-slutt,
mens content-visibility tar det løpende arbeidet imellom og gjør større kart
lettere å rendre og panne. Verifisert empirisk i Chromium at egenskapen faktisk
engasjerer på SVG-paths, skjuler når pan/zoom-transformen skyver geometrien ut av
utsnittet, og at synlige paths rendres piksel-identisk (den impliserte
`contain: paint` klipper ingenting). Regelen treffer kun ren, unavngitt
bucket-geometri: navngitte (søkbare) vann-paths og tekst-labels er utelatt fordi
søkeindeksen måler dem med `getBBox` (en skippet node ville gitt (0,0)). Den bor
i app-CSS-en, ikke i SVG-ens egen `<style>`, så SVG-/PDF-eksport fortsatt rendrer
HELE kartet. Ukjent i eldre Safari (< 18) → egenskapen ignoreres, trygt no-op.

---

## 2026-07-21 — v1.0.60: Opprydding etter vann-jakten — probefiler fjernet

«Vannet forsvinner»-saken er bekreftet løst på enhet (v1.0.51), så de
midlertidige feilsøkingsfilene ryddes: NVE-helseproben (`scripts/probe-nve.mjs`)
og E2E-proben mot deployet app (`scripts/probe-e2e.mjs`) — begge med sine
GitHub-workflows — er fjernet fra repoet. Ingen endringer i appens oppførsel;
culling-bryteren i Utvikler-fanen (v1.0.50) beholdes som permanent
feilsøkingsverktøy. (Denne oppryddingen lå i en gammel PR fra før v1.0.53–59
landet; gjenskapt oppå fersk master med korrekt versjons-bump.)

---

## 2026-07-21 — v1.0.59: Snappere pinch/rotasjon — tungt arbeid ut av gest-frames

Første steg i mobil-ytelse-sporet før default kartstørrelse eventuelt heves.
Tre watchere i MapView kjørte tungt arbeid på HVER pinch-/rotasjons-frame i
stedet for ved gest-slutt. Verst: `watch(scale)` bygde GPS-prikk, alle spor og
alle annoteringer helt om (`layer.replaceChildren()`) per frame — merkbar jank
under zoom med aktivt spor-opptak. Nå hoppes de tunge om-byggingene over mens en
gest pågår (symbolene følger kart-transformen som streker/relieff allerede gjør)
og snapper til riktig skjerm-størrelse straks gesten slipper. `applyUprightLabels`
(itererer 1000+ tekst-noder for å holde dem loddrett) gates likt: labels vippes
med kartet under rotasjon og snapper opp ved gest-slutt. Til slutt fikk
`applyZoomTierClasses` en tidlig-retur så den slipper `querySelector` + klasse-
toggle på frames der zoom-trinnet ikke faktisk krysser terskelen. Ingen ny
arkitektur, ingen endring i hva som vises når gesten er over — kun mindre arbeid
underveis. Regresjonsvakt beholdt: navn-LOD toggler fortsatt aldri geometri
(v1.0.51), og GPS-prikk/ring/kjegle + spor holder konstant skjerm-størrelse i ro.

---

## 2026-07-21 — v1.0.58: Vannmålestasjoner default på

Kartlaget «Vannmålestasjoner» er nå på som standard (fjernet fra
`DEFAULT_OFF_LAYERS`). Det er også tatt inn i «Tur»-presetet — ellers ville
«Tur»-knappen slått laget av igjen, i strid med at det nå er et standard-lag.
Laget vises dermed rett fra start på nye kart.

---

## 2026-07-21 — v1.0.57: Fjernet ikonet i målestasjon-skuffen

Det lille stasjons-ikonet ved siden av navnet i detalj-skuffen er fjernet —
overskriften «Målestasjon · NVE» sier allerede hva det er, så merket var
overflødig. Kartmarkøren (ikonet på selve kartet) er uendret.

---

## 2026-07-21 — v1.0.56: Vannstand er lokal peilehøyde, ikke moh

Vannstand-raden i målestasjon-skuffen var merket «moh», men HydAPI-verdien
(parameter 1000) er vannstand relativt til stasjonens lokale nullpunkt — ikke
meter over havet. En verdi som −0,02 er altså peilehøyden over/under nullpunktet,
og Sildre må legge til en stasjonsspesifikk offset for å få NN2000-høyde. Enheten
er rettet til «m» med en liten merknad «rel. lokalt nullpunkt». Stasjonens egen
høyde i «Om stasjonen» er fortsatt moh (det er korrekt der).

---

## 2026-07-21 — v1.0.55: Nytt målestasjon-ikon + nedbørfelt-info

Vannmålestasjonene fikk et nytt kartikon: en rund blå medaljong med to hvite
bølger, i stedet for vanndråpen. Den gamle dråpen ble tegnet med en for trang
`viewBox` slik at nedre spiss ble klippet bort på enkelte skjermer; den runde
formen er symmetrisk og klippes aldri, og leses like godt uansett rotasjon.
Detalj-skuffen viser nå også en «Om stasjonen»-seksjon med nedbørfeltets areal,
elvelengde, høyde, kommune, stasjonstype og eier. Dataene ligger allerede i
stasjonsobjektet fra NVE, så seksjonen krever ingen ekstra API-kall, og hvert
felt vises kun når NVE faktisk har verdien.

---

## 2026-07-21 — v1.0.54: NVE-proxyens produksjons-URL bakt inn

Standard-URL-en i `nveHydApi.js` pekte på en placeholder (`<SUBDOMENE>`) i påvente
av at Cloudflare Worker-en ble deployet. Worker-en er nå oppe, og den faktiske
produksjons-URL-en (`lende-nve-proxy.jepedersen73.workers.dev`) er bakt inn som
standard. Kartlaget «Vannmålestasjoner» og sanntids vannstand/temperatur ved
long-press virker dermed for alle brukere uten ekstra oppsett — så lenge secret-en
`NVE_HYDAPI_KEY` er satt i Worker-en. Fortsatt overstyrbar med `VITE_NVE_HYDAPI_URL`.

---

## 2026-07-21 — v1.0.53: Cloudflare-proxy vekker NVE-målestasjonene fra dvale

Kartlaget «Vannmålestasjoner» og sanntids vannstand/temperatur ved long-press har
ligget i dvale fordi NVE HydAPI krever en API-nøkkel som ikke kan bakes inn i den
offentlige, statiske bundelen på GitHub Pages. Nå finnes en frittstående Cloudflare
Worker (`cloudflare/nve-proxy/`) som speiler de to HydAPI-endepunktene appen bruker,
injiserer nøkkelen server-side (som en kryptert Cloudflare-secret `NVE_HYDAPI_KEY`)
og legger på CORS. Klienten (`nveHydApi.js`) peker som standard mot proxyen —
overstyrbar med `VITE_NVE_HYDAPI_URL` — og sender ingen nøkkel selv; dvale-portene i
komposablene er fjernet. Nøkkelen forlater dermed aldri Cloudflare. Worker-en er
bevisst ingen åpen proxy (kun `GET` mot `/Stations` og `/Observations`, CORS låst til
Lende-originene). Se `cloudflare/nve-proxy/README.md` for oppsett fra
Cloudflare-dashbordet (mobilvennlig, ingen kommandolinje).

---

## 2026-07-21 — v1.0.52: «Bruk rute» — følg valgt rundtur med fritt kart

Stifinner/rundtur får en «Bruk rute»-knapp i den grønne boksen. Den tar valgt
rute inn i en ny følge-modus: boksen minimeres til en liten pill, kun den
valgte ruta blir stående på kartet (samme farge som forslaget, litt kraftigere,
under GPS-prikken), og kartet slippes helt fri igjen — long-press, POI-tapp og
måling virker som normalt mens du går ruta. Pillen kan utvides til et panel med
distanse, estimert tid og høydemeter, og med GPS aktiv (startes automatisk ved
«Bruk rute») vises fremdrift langs ruta: «Gått X av Y · Z igjen», eller
«Utenfor ruta (NN m unna)» om du har forvillet deg bort. «Til forslag» går
tilbake til rutelisten; X avslutter. Rundtur-tvetydigheten der start == mål
løses med et monotont fremdrifts-anker (ny ren util `routeProgress.js`, testet)
så turen starter på 0 m og ikke «full runde». Kjente begrensninger: bytte/
utvidelse av kart avslutter ruta, og den overlever ikke en sideoppfriskning.

---

## 2026-07-21 — v1.0.51: LØST — «vannet forsvinner»: navn-LOD skjulte NVE-innsjøpolygonene

Gåten er løst, og vannet var aldri borte fra kartet. NVE-innsjøer bærer navnet
i `navn`-feltet (ArcGIS), ikke `name` — så `lakeLabels` ga dem aldri en egen
vann-navn-tekst. Søkeindeksen registrerte da SELVE POLYGONET som navnebærer,
og navn-LOD-en (declutter-budsjettet) satte `display:none` på hele innsjøen
når navnet tapte plasskampen: synlig ved 200 m-zoom (raust budsjett), borte i
oversikt (budsjett 60), flimrende ved panorering. Utvidelses-fliser viste
vannet fordi spøkelses-fliser stripper `data-name` og står utenfor indeksen —
nøkkelobservasjonen som løste saken. To fikser: (1) navn-LOD toggler ALDRI
geometri-paths, kun tekst-/gruppe-etiketter; (2) `lakeLabels` leser nå
`navn`-fallback, så NVE-innsjøer får ekte navnetekster som OSM-innsjøer.
E2E-bekreftet at Setten/Nesøytjernet lå i SVG-en med `display:none` fra
`name-lod-off`. Viewport-culling og NVE-hentingen var uskyldige hele veien.

---

## 2026-07-21 — v1.0.50: Slett-alle + hard refresh fikset, culling-bryter og eldre-ark-varsel

Tre ting i vann-jakten. (1) «Slett alle kart» + hard refresh ga «Kart ikke
funnet i lagring»: app-start gjenopptok sist viste kart via `lende-last-map`,
men slett-alle ryddet aldri nøkkelen. Nå ryddes gjenopptaks-nøklene ved
slett-alle, og lander appen likevel på et slettet kart, går den stille til
forsiden i stedet for feilsiden. (2) Utvikler-fanen har fått en
viewport-culling-bryter (av/på uten reload): forsvinner vann på telefonen,
slå culling AV — kommer vannet tilbake, er culling synderen; hvis ikke, er
det arkets data. Bygge-siden og cull-matematikken er verifisert konsistente
lokalt og i CI-E2E, så bryteren avgjør saken på telefonen. (3) Sømløs
auto-promotering til et ark bygd med en ELDRE app-versjon sier nå fra med en
toast — før så byttet ut som at innsjøer plutselig «forsvant». Midlertidige
E2E-probefiler er fjernet fra branchen.

---

## 2026-07-20 — v1.0.49: Meta-hviteliste fikset — versjonsstempel og NVE-status var usynlige

`useMapLoadPipeline` kopierer kart-metaen fra SVG-ens `data-meta` inn i appen
via en eksplisitt hviteliste — og feltene fra v1.0.45/47 (`appVersion`,
`nveInnsjoStatus`) manglet i den. Konsekvens: Utvikler-fanen viste «bygd med
eldre versjon» og «ingen status» på ALLE kart, også splitter ferske — hele
kveldens feilsøking gikk i blinde. Nå følger feltene med, og radene er endelig
til å stole på. E2E-verifisert i ekte Chromium mot deployet app: ferskbygd
Setten-kart har 29 innsjø-pather i både lagret SVG og DOM, synlige med ISOM
301-blått (skjermbilde-artefakt i CI). Nye meta-felter MÅ legges til i
hvitelisten — det står nå en advarsel i koden.

---

## 2026-07-20 — v1.0.48: Auto-flis-cachen versjons-gates (gamle fliser i «nye» kart)

Siste brikke i «innsjøer borte»-saken: selv HELT NYE kart viste gamle data.
Årsak: auto-flis-mosaikk-cachen i IndexedDB overlever app-oppdateringer —
`centerOverExistingTile` undertrykker nybygging der en spøkelses-flis alt
finnes («Allerede bygd — flytter dit»), og promotering gjør gamle fliser til
aktivt ark. Fliser bygd med ødelagt kode tidligere på kvelden ble dermed
servert på nytt i ferske kart. Nå stemples hver lagret flis med app-versjonen
(`appVersion` i lagringsposten), og auto-fliser bygd med en ANNEN versjon
usynliggjøres (gjenbrukes aldri, blokkerer aldri nybygging, kan aldri
promoteres) og ryddes fra IndexedDB i bakgrunnen. Brukerens egne lagrede kart
røres aldri — de har «Kart bygd med»-merkingen fra v1.0.47.

---

## 2026-07-20 — v1.0.47: Kart stemples med byggeversjon; NVE-rad alltid synlig

Kveldens feilsøking av «innsjøer borte» strandet gjentatte ganger på samme
spørsmål: hvilken app-versjon ble DETTE arket bygd med? Et kart bygd med gammel
kode ser identisk ut med et ferskt — og NVE-innsjø-raden fra v1.0.45 var
usynlig på gamle ark, som var umulig å skille fra «alt ok». Nå: (1) hvert kart
stemples med app-versjonen i metaen (`meta.appVersion`), og Utvikler-fanen
viser «Kart bygd med vX» — i gult med «bygg på nytt for ferske data» når den
avviker fra kjørende app; (2) NVE-innsjø-raden vises alltid når kart-meta
finnes — mangler status, står det eksplisitt at arket er bygd før v1.0.45 og
må bygges på nytt.

---

## 2026-07-20 — v1.0.46: Robust NVE-paginering, verifisert mot 33 400 innsjøer

NVE-pagineringen antok sidestørrelse («fikk færre enn forespurt → siste
side») — skjørt mot enhver server-konfigurasjon. Nå pagineres det på serverens
eget `exceededTransferLimit`-flagg med objectid-dedup (en server som ignorerer
`resultOffset` gir stopp, ikke dobling), og eventuell avkutting rapporteres i
NVE-innsjø-statusen («AVKUTTET»). CI-verifisert mot ekte NVE: gigantisk bbox
(halve Østlandet) ga 33 400 innsjøer over 17 sider på 66 s, med flagget
bekreftet til stede i geojson-svar. Merk: «innsjøer borte»-kartene fra tidligere
i kveld skyldtes IKKE paginering, men kart-fliser bygd i overgangsvinduet rett
etter v1.0.44-deployen (gammel klient lette etter FGB-filer som var fjernet fra
gh-pages) — kart bygd HELT på nytt med oppdatert app henter alt live fra NVE.

---

## 2026-07-20 — v1.0.45: NVE-innsjø-status i Utvikler-fanen + retry

Etter v1.0.44 manglet innsjøer på kart bygd rett etter deployen (Nesøytjern,
Setten). CI-verifisering viser at hele NVE-løypa er frisk (query gir Setten
med 38 øy-hull, CORS ok, full headless-bygging gir vann) — feilen skjer stille
på enheten i hente-øyeblikket. To sannsynlige årsaker: klienten kjørte fortsatt
v1.0.43 (som leter etter FGB-filene som ble fjernet fra gh-pages), eller et
forbigående nett-/NVE-glipp. Nå: (1) `fetchN50Water` prøver to ganger før den
gir opp, og (2) utfallet rapporteres i kart-metaen og vises i Utvikler-fanen
som «NVE-innsjø: OK — N innsjøer» eller «FEILET: <melding>» — samme grep som
Sjøkart-WFS-statusen, så mobil-feil ikke lenger er usynlige. Kart som mangler
innsjøer må bygges på nytt (SVG-en er lagret uten dem).

---

## 2026-07-20 — v1.0.44: Innsjøer live fra NVE — full detalj, bake-apparatet fjernet

v1.0.43s ~5 m-forenkling gjorde små øyer/skjær komisk kantete (Munkeskjæra i
Setten: hytter «utenfor» øya). Rot-årsaken til hele det statiske apparatet var
at N50 vektor-WFS ble avviklet — men CI-diagnose viste at NVE Innsjødatabasen,
spurt via ArcGIS REST `query` på bbox (ikke `identify`, som mister hull),
leverer innsjø-polygoner med øy-hullene intakte i FULL N50-detalj
(Setten-ringen: 1861 punkter, identisk med uforenklet N50) og med CORS.
`fetchN50Water` henter nå innsjøene live ved kart-bygging (som Overpass og DEM
allerede gjør). Hele FGB-bake-apparatet er fjernet: bake-script, workflows og
~408 MB statiske data ut av repoet, `flatgeobuf`-avhengigheten droppet. Ingen
forenkling, ingen terskler — og kartet virker i hele landet uten bakte filer.

---

## 2026-07-20 — v1.0.43: N50-innsjøer for hele landet (per-fylke)

N50-vann-datasettet dekket bare Akershus (én FlatGeobuf). Nå bakes hele landet:
CI-scriptet laster ned N50 for alle fylker og skriver ÉN FlatGeobuf per fylke
(`public/data/n50-water/<fylkeskode>.fgb`) pluss et manifest (`index.json`) med
hver fils bbox. Klienten leser manifestet, velger fila(ene) som overlapper
kart-bboxen, og spør hver på bbox via HTTP Range — så bare relevante utsnitt
lastes. Datasettet er KUN innsjøer (Innsjø + InnsjøRegulert): elve-/bekkeflater
tegnes fra OSM-linjer som før, og sjøen kommer autoritativt fra DEM
(`seaFromDem.js`) + Sjøkart. Innsjøene er selve tyngden (Norge er ekstremt
innsjø-tett), så omrissene forenkles til ~5 m — sub-piksel i kartskala, men
halverer datasettet til ~350 MB. Ekte øyer (Kolstadøya i Setten) beholdes som
ekte hull i hele landet, uten terskler eller heuristikk; kun holmer < ~5 m
glattes bort. Skulle et innsjø-tett fylke likevel bli > 95 MB, deles fila i
bbox-fliser (`<fylke>-<n>.fgb`) — hele innsjøflater tas med i hver flis (ingen
klipping), så øy-hull forblir intakte.

---

## 2026-07-20 — v1.0.42: Behold kartnavn ved ombygging

«Bygg om dette området i valgt størrelse» (long-press på nullstill-knotten)
døpte kartet om til «Kart». Årsaken: koden leste navnet fra `meta` (som ikke
har det), ikke fra `mapTitle` (lagringen). Nå beholdes kartets navn — stedsnavn
+ dato, f.eks. «Mjøsa 19. juli» — ved ombygging.

## 2026-07-20 — v1.0.41: N50-vann vinner over OSM/NVE der det finnes (Kolstadøya)

Kolstadøya i Setten manglet fortsatt selv om N50-datasettet har øya som et ekte
hull. Årsaken: OSM (og NVE) leverer SAMME innsjø uten de riktige hullene, og
siden hvert vann-polygon males opakt kunne en slik hull-løs kopi males OPPÅ og
dekke øya igjen (Landøya/Bolstadøya traff tilfeldigvis ikke). Nå er N50-vann
autoritativt der det har dekning: `createMapFlow` samler N50-vannets ytre ringer
og undertrykker overlappende OSM- (også navngitte) og NVE-ferskvann per flate,
så bare N50-polygonet med de korrekte øy-hullene rendres. Utenfor N50-dekning
beholdes OSM/NVE som før.

## 2026-07-20 — v1.0.40: N50-vann fra eget statisk datasett (øyer som ekte hull)

Innsjø-øyer (Kolstadøya i Setten) kommer nå fra autoritativ N50-geometri der
øya er et ekte hull i vannet — ingen terskler eller DEM-gjetting. Siden
Kartverkets N50 vektor-WFS er avviklet, bakes N50-vann i CI
(`scripts/build-n50-water.mjs` + workflow) fra Geonorges Nedlasting-API: vann-
flatene (Innsjø/InnsjøRegulert/ElvBekk/Havflate) trekkes ut med `ogr2ogr`,
reprojiseres til EPSG:4326 og skrives til `public/data/n50-water.fgb`
(FlatGeobuf). `fetchN50Water` leser fila på bbox via `flatgeobuf` (HTTP Range,
laster bare utsnittet) og konverterer gjennom den hull-bevarende
`geojsonToWays` → relation(outer+inner) → mapBuilder klipper øyene via evenodd.
Første datasett dekker Akershus (~4,5 MB); flere fylker kan bakes ved å kjøre
workflowen med annen `--area`. Den avviklede WFS-koden er fjernet.

## 2026-07-20 — v1.0.39: Fjernet DEM-basert øy-gjetting

Reverterer den DEM-avledede øy-karvingen fra v1.0.38. Den løste ikke Kolstadøya
i praksis, og den hvilte på terskelverdier («meter over vann», «minimum
øystørrelse») som er skjøre og feil verktøy for å avgjøre om en øy finnes — en
øy skal komme fra autoritativ vektor-geometri, ikke gjettes fra høydemodellen.
Fjernet `lib/lakeIslands.js` og krokene i `mapBuilder`. Øy-problemet løses i
stedet ved å gi den eksisterende pipelinen ekte N50-vann-geometri (der øyer er
indre ringer) fra et eget, statisk hostet datasett — se plan.

## 2026-07-20 — v1.0.38: Øyer i innsjøer karves ut fra høydemodellen

Innsjøer med øyer (Kolstadøya i Setten) ble malt som én solid blå flate over
øyene. Kartverkets N50 vektor-WFS — som modellerte innsjø-øyer som hull — er
avviklet, og verken NVE-innsjødatabasen eller OSM leverer øyene pålitelig. Men
øyene stiger over vannflaten, og det ser høydemodellen (DEM) vi allerede
henter. Ny `lib/lakeIslands.js` (`islandHolesForLake`) detekterer terreng som
stikker opp over innsjøens vannivå innenfor innsjø-polygonet — robust mot både
«vann leses som en flat høyde» og «vann er nodata» i NHM_DTM — og mapBuilder
karver de områdene ut som hull (fill-rule=evenodd) i innsjø-flaten (ISOM 301).
Da skinner land, relieff og høydekurver under vannet gjennom der øya ligger.
Kun ekte DEM, kun innsjøer over ~5 ha, og kun der kilden ikke allerede har
øy-hull. Løser øyene uten runtime-avhengighet til Kartverkets vektortjenester.

## 2026-07-20 — v1.0.37: Behold øy-hull fra NVE-innsjøer

NVE-innsjøer med øyer (f.eks. Kolstadøya i Setten) kunne miste øya og bli malt
som én solid vannflate. Årsaken: NVEs `identify?layers=all` returnerer samme
innsjø fra flere lag — noen generalisert uten øy-hull, andre med — og dedup-en
beholdt alltid den FØRSTE varianten. Kom den hull-løse først, ble øya forkastet.
Nå beholdes varianten med FLEST ringer (dvs. med øy-hull) når duplikater slås
sammen, uansett rekkefølge; navnet løftes fortsatt med fra et duplikat-lag.

Merk: dette forutsetter at NVE faktisk leverer øya som hull i minst ett lag.
Bakgrunn: N50-vektor-WFS-en (`wfs.n50_kartdata`) er avviklet av Kartverket, så
NVE er nå eneste autoritative vektorkilde for innlands-innsjøer med øyer.

---

## 2026-07-20 — v1.0.36: Kraftlinjer som eget kartlag

Kraftlinjer er nå et eget kartlag («Kraftlinjer», default PÅ) og tegnes som på
ut.no/Norgeskart — en tynn svart strek med jevne, tverrgående kryssmerker — så
laget skiller seg ut og fungerer som orienterings-landemerke. Tidligere lå
kraftlinjer sammen med gjerder i «Gjerde / kraft»-laget, som er skrudd av i
Tur-forhåndsvalget, så de forsvant på vanlige turkart. Overpass-spørringen
henter nå både `power=line` og `power=minor_line` (distribusjonslinjer), så alle
kraftlinjer kommer med, ikke bare de store transmisjonslinjene. «Gjerde / kraft»
heter nå bare «Gjerde».

---

## 2026-07-20 — v1.0.35: Øyer i innsjøer forsvant ikke lenger

Innsjøer med øyer (f.eks. Kolstadøya og Bolstadøya i Setten) ble malt som én
solid vannflate der øyene manglet helt, sammenlignet med ut.no. Årsaken var at
N50-vann-konverteringen (`geojsonToWays`) bare tok ytre ring og forkastet
hull-ringene i GeoJSON-polygonene — øyene er nettopp hull i vannet. Nå
emitteres polygoner med hull som en relation med `outer`- og `inner`-ringer,
slik at mapBuilder klipper øy-hullene via evenodd (samme vei som OSM-
multipolygoner). Polygoner uten hull forblir `way` så navn-baserte
sammenslåinger (Hestesund-splittede innsjøer) fungerer som før.

---

## 2026-07-19 — v1.0.34: Stedsnavn på «lag kart der jeg står»

Nye kart laget fra egen GPS-posisjon får nå navn etter nærmeste stedsnavn i
stedet for «Din posisjon». Et reverse-geokall (Nominatim) slår opp koordinaten
og velger det mest lokale leddet — grend/gård før tettsted før kommune — så
kartet blir f.eks. «Stormoen 19. juli». Oppslaget er best-effort: feiler det
(offline eller tjeneste nede) faller vi tilbake til «Min posisjon» som før.
Lagt til `reverseGeocode` og `nearestPlaceLabel` i `lib/geocode.js`.

---

## 2026-07-19 — v1.0.33: Gi kart nytt navn

Kart kan nå døpes om — både fra «Mine kart» på forsiden og inne i et åpent kart.
På forsiden har hvert kort fått en blyant-knapp ved siden av søppelbøtta; i kart-
visningen er navne-chipen i toppbaren blitt trykkbar (innebygde kart som Vardåsen
kan ikke gis nytt navn siden de ikke ligger i lagringen). Begge åpner det samme
bunn-arket (`RenameMapDialog`) med feltet forhåndsutfylt. Lagringen fikk en ny
`renameMap(id, navn)` som oppdaterer både `maps` (kilden) og det lette `meta`-
storet i samme transaksjon, så lista og det åpne kartet viser samme navn straks.

---

## 2026-07-19 — v1.0.32: «Installer som app»-knappen dukker nå faktisk opp

Knappen manglet i Chrome/Edge på Android. Årsaken var timing: `beforeinstallprompt`
fyres nøyaktig én gang og ofte før Vue er montert, mens `usePwaInstall` festet
lytteren sin i `onMounted` og holdt privat state per kall. Fyrte eventet før
mount — eller navigerte du til en side (som Om) som ble montert etter at eventet
alt var fyrt — mistet vi det og `canInstall` ble aldri sann. Nå fanges eventet av
en tidlig inline-lytter i `index.html` (før bundelen lastes) og stashes på
`window`, og `usePwaInstall` er gjort om til en delt singleton som leser stashen
ved oppstart og deler samme reaktive state på tvers av alle sider.

---

## 2026-07-19 — v1.0.31: Bedre iPad-deteksjon for installasjonsveiledning

iPad på iPadOS 13+ melder seg som «Macintosh» i user agent-strengen, så den
rene `/iPad|iPhone|iPod/`-sjekken i `usePwaInstall` bommet på iPad — brukeren
fikk verken «Installer som app»-knappen eller iOS-veiledningen. Deteksjonen
fanger nå også opp en «Macintosh»-UA med flerpunkts-touch (`maxTouchPoints > 1`),
som i praksis er en iPad, mens ekte pekeskjerm-frie Mac-er (0 touch-punkter)
holdes utenfor.

---

## 2026-07-19 — v1.0.30: Installasjonsknapp på Om-siden + første-gangs varsel

Å installere Så i lende som app er nå gjort mer intuitivt. Om-siden har fått en
«Installer som app»-knapp rett under innledningsteksten — samme diskrete drakt
og tekst som forsiden — som kun vises når appen ikke alt kjører installert
(standalone) og nettleseren faktisk tilbyr install (Chrome/Edge/Android) eller
på iOS med manuell veiledning. I tillegg viser appen ett native dialog-varsel
første gang den åpnes uinstallert, uansett hvilken URL brukeren lander på; ved
avvisning lagres et flagg i localStorage (`lende-install-prompt-dismissed`) så
meldingen aldri kommer igjen.

---

## 2026-07-18 — v1.0.29: Fjernet omtale av Vannmålestasjoner i Om-siden

Om-siden («Mer enn bare kart») reklamerte for kartlaget Vannmålestasjoner med
sanntids vannføring, vannstand og temperatur fra NVE HydAPI. Laget ligger
imidlertid i dvale i produksjon fordi HydAPI krever en API-nøkkel som ikke bør
bakes inn i den offentlige, statiske bundelen på GitHub Pages — så funksjonen
gir ingenting for vanlige brukere ennå. Avsnittet er fjernet inntil en
server-side proxy er på plass som holder nøkkelen skjult. Innsjø-fakta ved
long-press (NVE Innsjødatabase, virker uten nøkkel) er ikke berørt.

---

## 2026-07-17 — v1.0.28: Slutt på fantom-«hull» ved utvidelse og scrolling

«Fyll hullene»-banneret dukket stadig opp med hull som ikke fantes — også når
ingen utvidelse var avbrutt. Årsaken var hull-deteksjonen: den regnet ENHVER
tom celle inni mosaikkens omsluttende rektangel som et hull. Etter en avbrutt
utvidelse, eller bare ved fri panorering (der en nabo-flis auto-promoteres til
aktiv og cachen kappes), blir flis-settet ikke-rektangulært — og en diagonal
rekke fliser (f.eks. tre fliser på skrå) ga da flere «hull» for celler brukeren
aldri bygde. «Fyll hullene» prøvde så å bygge utsnitt ingen ba om. Nå regnes en
celle kun som hull hvis den er OMSLUTTET av bygde fliser på en hel akse (flis i
vest OG øst, eller nord OG sør) — genuint innelukkede hull midt i kartet fanges
fortsatt, mens diagonale/L-formede perimeter-celler ikke lenger utløser
banneret.

---

## 2026-07-17 — v1.0.27: Kartformat og høydekurver i Innstillinger + felles Nullstill

Innstillinger-fanen har nå de samme format-knappene som «Flere valg» i byggeren
(Kvadratisk / Portrett / Utskrift A4) og høydekurve-knappene (5–50 m, med samme
bredde-gating: tette kurver krever smalere kart), plassert rett under
størrelse-slideren. Valgene gjelder alle nye kart fra søk/GPS, «Lag kart der du
er» og «Bygg om»-knappen. En felles «Nullstill»-knapp setter standarden:
4 km bredde, 10 m høydekurver og kvadratisk format — app-standarden for nye
kart er samtidig endret fra 8 til 4 km (raskere bygging). Vardåsen-demokartet
bygges nå i samme standardutsnitt (4 km kvadrat, 10 m).

---

## 2026-07-17 — v1.0.26: Utheving i Om-teksten + CI på pull requests

Innledningsteksten på Om-siden fremhever nå «ymse kartdata» og «ut i lende» i
halvfet, litt lysere skrift, så nøkkelordene (og lende-ordspillet) bærer
setningen ved rask lesing. I tillegg er CI aktivert: en ny GitHub-workflow
kjører testsuiten og produksjonsbygget på hver pull request mot master, så
regresjoner fanges før merge.

---

## 2026-07-17 — v1.0.25: Fikser oppdatering, kartbygging og hull-fylling

Tre feil fra forrige runde rettet. (1) Kartbygging feilet av og til med
«buildSvg-worker-feil» — typisk en transient modul-last i web-workeren rett etter
en deploy; nå faller vi tilbake til synkron bygging i stedet for å feile hardt, så
kartet blir bygd uansett. (2) «Fyll hullene» startet, men fullførte ikke og lot
den oransje meldingen komme tilbake: reparasjonen håndterer nå hver flis for seg,
tegner mosaikken på nytt selv ved delvis feil, og teller hull på nytt etterpå.
(3) «Oppdater» kunne henge på «Oppdaterer …» uten å laste ny versjon (ingen/stale
ventende service worker); nå garanterer vi alltid en reload etter kort tid. Selve
oppdaterings-banneret er dessuten ryddet opp — i arbeid vises én ren linje med
spinner i stedet for en trang knapp med tekst på flere linjer.

---

## 2026-07-17 — v1.0.24: Fullfør ufullstendige kart og fyll mosaikk-hull

To ikke-destruktive reparasjons-verktøy for kart der en bygging ble avbrutt
(reload eller app-lukking midt i flisleggingen). Åpner du et kart som aldri ble
ferdig bygd (kun terreng, `partial`-flagget satt), tilbyr et banner nå «Fullfør
kartet» som bygger det om og fyller inn stier og detaljer. Har mosaikken et hull
— en manglende flis inni det rektangulære bruttokartet — oppdages det ved åpning
og et banner tilbyr «Fyll hullene», som bygger kun de manglende cellene uten å
røre eksisterende fliser. Begge krever nett (knappen gråes ut offline) og sletter
aldri noe. About-teksten er også oppdatert.

---

## 2026-07-17 — v1.0.23: «Oppdater» venter til kartbygging er ferdig

Trykket man «Oppdater» på ny-versjon-banneret mens en flis ble bygd eller
utvidet, reloadet appen midt i byggingen og etterlot et hull i den halvbygde
mosaikken. Nå settes en reload på vent så lenge en bygging pågår: banneret viser
«Ny versjon klar — venter på at kartet blir ferdig», og reloaden utføres
automatisk straks flisleggingen er komplett. Byggestatusen deles mellom MapView
og oppdaterings-banneret via et lite signal i swUpdate.

---

## 2026-07-17 — v1.0.22: Kompassnåla i FAB pekte 180° feil ved rotasjon

Kompass-FAB-en oppe til høyre roterte nåla med feil fortegn (`rotate(-rotation)`)
i forhold til kart-transformen (`rotate(+rotation)`). Ved nullstilt kart så det
riktig ut, men så snart kartet ble rotert speilet nåla seg og pekte motsatt vei
av de trykte «i lende»-kompassrosene — nøyaktig 180° feil ved 90°-rotasjoner.
Nåla bruker nå samme fortegn som kartet, så den peker mot skjerm-nord i takt med
rosene. Heading-modus (enhetskompass) var uendret korrekt og er ikke rørt.

---

## 2026-07-16 — v1.0.21: Kompassrose på «Utvid kart»-knappene

De åtte «Utvid kart»-knappene rundt kartet var store, dominerende blå «+»-sirkler.
De er nå små, diskrete kompassroser — én per himmelretning — der den ene armen
peker retningen knappen utvider og males rød, med teksten «Nord i lende»,
«Nordøst i lende» osv. ved siden (en flørt med app-navnet). Rosene ligger i
kart-rommet og roterer med kartet, så den røde armen alltid viser rett vei i
terrenget, mens teksten mot-roteres til vannrett av samme mekanikk som stedsnavn.
Knappenes funksjon er uendret (bygger ny kartflis i valgt retning), aria-label er
fortsatt «Utvid mot <retning>», og laget fjernes ved print/eksport som før.

---

## 2026-07-16 — v1.0.20: Øy-navn dupliseres ikke lenger (blått + brunt)

Navngitte øyer og holmer (place=island/islet) ble tidligere skrevet ut to
ganger: ett blått, kursivt sjø-navn (sjo-navn-laget) OPPÅ ett brunt, versal
land-navn (omrade-navn-laget). Øyer er land, så navnet hører hjemme i det brune
land-navn-laget — de er nå tatt ut av det blå sjø-navn-laget. Holme-noder uten
egen flate får fortsatt navnet sitt (nå som brunt land-navn på selve punktet),
så ingen øy mister etiketten. Bukt/sund/nes/grunne/skjær er uendret i sjø-navn.

---

## 2026-07-16 — v1.0.19: Nytt kartlag «Vannmålestasjoner» (NVE HydAPI)

Nytt togglebart lag som viser NVEs hydrologiske målestasjoner i kartutsnittet
som blå vanndråper. Trykk på en dråpe for siste vannføring (m³/s), vannstand og
vanntemperatur, med lenke til stasjonens side hos NVE (Sildre). Bygger på den
eksisterende HydAPI-integrasjonen (nveHydApi.js): stasjonslista hentes og caches
per sesjon, filtreres til utsnittet, og markørene tegnes runtime som fredet-
kulturminne-laget. Default av; henter data live og krever en gratis NVE HydAPI-
nøkkel (`VITE_NVE_HYDAPI_KEY`). Laget er i dvale til nøkkelen er satt — og siden
Vite inliner `VITE_`-variabler i det offentlige bundle-t, er aktivering i deploy
en bevisst avgjørelse som ikke er gjort her ennå. Blått tema med egen detalj-skuff.

---

## 2026-07-16 — v1.0.18: «Mer enn bare kart» på Om-siden

Ny infoboks på Om-siden som forklarer long-press-oppslagene: hold på et punkt
og få fakta om stedet fra Store norske leksikon, Wikipedia, Artsdatabanken,
naturtyper/verneområder og NVE — pluss trykkbare kulturminne- og fredet-markører
fra Kulturminnesøk. Vinkler det som en morsom måte å orientere seg og bli kjent
med landskapet på tur.

---

## 2026-07-16 — v1.0.17: Strammet inn Om-teksten

To presiseringer på Om-siden. Navne-forklaringen tar nå bare for seg «lende»
(terreng/landstrekning, av norrønt «lendi») og dropper utgreiingen om «så».
Innledningen sier «bygget fra ekte kartdata» i stedet for «ekte norske
kartdata» — kartdataene kommer fra flere kilder (bl.a. OpenStreetMap, som er
global), så «norske» overdrev opphavet.

---

## 2026-07-16 — v1.0.16: Om-siden virker offline

Om-siden var lazy-lastet, så JS-chunken lå ikke i offline-cachen før man hadde
åpnet `/om` mens man var på nett — resultatet var at info-knappen «ikke gjorde
noe» uten nettforbindelse. Om-siden importeres nå eagerly (bakt inn i oppstarts-
grafen som service-workeren cacher), så den alltid er tilgjengelig offline.
Versjonsnummeret vises fortsatt nederst på siden.

---

## 2026-07-16 — v1.0.15: Ryddet rute-ikonet på turkart-forsiden

Den siste gjenværende forekomsten av det gamle krusedull-rute-ikonet (buet
linje med grønn/rød endepunkt-prikk) satt fortsatt på «Bytt til ruteplanlegger»-
knappen øverst til venstre på turkart-forsiden. Byttet ut med samme rene pil-
venstre-i-sirkel som resten av modus-navigasjonen bruker, så knappen speiler
tilbake-knappen i ruteplanleggerens header.

---

## 2026-07-16 — v1.0.14: Appnavn «Så i lende», Om-side og ryddede headere

Appen har fått sitt egentlige navn i bruk: skrivebordsikonet og alle titler
heter nå «Så i lende» (uttrykket for noe som brer seg utover landskapet — der
«lende» er terrenget), og PWA-snarveien «Rute» heter nå «Ruteplanlegger».
Begge modus-headere viser «Så i lende: turkart» og «Så i lende: ruteplanlegger».
Ny Om-side (`/om`) nås fra en høyrestilt info-knapp i begge headere; i
ruteplanleggeren er lagringsknappen flyttet ett hakk inn for å gi plass. Om-siden
åpner med logoen og forklarer høydekurve-symbolikken og navnets norrøne opphav,
og har to faner — Turkart og Ruteplanlegger — som beskriver hva som er laget,
hvilken teknikk (Kartverket-DEM → d3-contour-høydekurver, canopy-høyde til
vegetasjon, OSM/N50/Sjøkart, graphology/BRouter-ruting, vektor-SVG) og hvilke
rammeverk og datakilder/lisenser som ligger bak.

---

## 2026-07-16 — v1.0.13: Flyplass-kartlag, ryddet rute-snarvei og bedre GPS-hint

Turkartet har fått et nytt togglebart lag «Flyplass» (ISOM-utvidelse 514):
flyplass-areal, apron og helikopterplass (OSM aeroway=aerodrome/apron/helipad)
males som en dempet, nøytral grå flate i terrenget — konvensjonen for asfaltert
flyplass — som stier, konturer og veier legger seg lesbart oppå. Rullebane/
taxebane utelates bevisst siden de som regel er linje-ways som ville blitt
degenererte slivere i polygon-rendereren; aerodrome-flaten dekker uansett hele
feltet. «Åpne ruteplanlegger»-snarveien i turkartets long-press-ark hadde et
rotete rute-glyf-ikon; det er byttet ut med samme «pil venstre i sirkelformet
knapp» som Ruteplanleggerens header-navigasjon, så de to modus-snarveiene deler
samme visuelle kontroll. Til slutt er GPS-feilmeldingen gjort handlingsrettet:
når posisjon ikke finnes (typisk fordi Stedstjenester/GPS er slått av på
enheten) eller tillatelsen er avvist, forklarer toasten hva som må gjøres og gir
en «Prøv igjen»-knapp som re-utløser forespørselen — nettleseren kan ikke skru
på enhetens GPS selv, men et nytt forsøk fanger opp at brukeren nettopp slo den
på.

---

## 2026-07-15 — v1.0.12: Gjenoppta ved app-start, ny ikon-drakt og UI-polering

Appen starter nå der du slapp: sist brukte modus (turkart eller ruteplanlegger)
gjenopptas ved fersk start, og i turkart-modus åpnes sist brukte kart med
gjenopprettet utsnitt (senter/zoom/rotasjon — lagres debounced per kart og
gjenopprettes via samme mekanisme som mosaikk-promoteringen). Deep-lenker og
navigasjon inne i appen berøres ikke. Forsiden fikk modus-knapp i headeren
(snarvei til Ruteplanleggeren, speiler tilbake-knappen der), og headerne heter
nå «Lende: Turkart» og «Lende: Ruteplanlegger» med diskrete kontur-ringer fra
logoen spredt fra øvre venstre hjørne. «Lag turkart»-knappen er grønn.
Logo/favicon/PNG-ikoner er tegnet om: mørkegrå bakgrunn (header-grå) med
høydekurver i Curves-temaets varme gul — PNG-ene er rasterert på nytt fra
icon.svg, og manifestets background_color matcher.

---

## 2026-07-15 — v1.0.11: Edge-mørkemodus-fiks + delings-frys på mottakersiden

To feilrettinger. (1) Edge på Android («Dark mode for nettsteder») og Chromiums
Auto Dark Theme tvangs-inverterte kart-SVG-en: svarte stedsnavn og stiplede
stier ble hvite/usynlige. Siden deklarerer nå `color-scheme: only light`
(meta i index.html + CSS på :root) — den dokumenterte opt-out-en; appens egen
mørke UI bruker eksplisitte farger og er upåvirket. (2) «Del kart og sted»-
lenker manglet avsenderens kart-aspekt, så mottakerens picker falt tilbake til
eget skjermaspekt: en mobil-mottaker av et 10 km-kart ville bygget 8,0 × 17,1
km (137 km²) — klient-side-byggingen av det frøs telefonen. Delingslenken
bærer nå `asp=` (høyde/bredde), og mottakeren bygger samme utsnitt-form
(verifisert i browser: 8,0 × 4,4 km med aspektet, mot 17,1 uten). Gamle lenker
uten `asp` beholder dagens oppførsel.

---

## 2026-07-15 — v1.0.10: Opprydning fullført — renderere, kontekst-oppslag og laste-pipeline i composables

Siste etappe av MapView-oppdelingen: de tre bevisst utsatte blokkene er nå
skilt ut. `useSymbolRenderers` samler alle de imperative SVG-rendererne
(søke-highlight, nærhetsvarsel-markør, måling, stifinner-ruter, annoteringer
med stedsmerke-animasjon, opp-rettede etiketter, GPS-spor, bruker-prikk og
pxToUserUnits). `useContextLookups` eier long-press-gesten, punkt-geometrien
og alle datakilde-oppslagene (NVE, Naturbase/GBIF, NiN, SNL/Wikipedia) med
sine watches. `useMapLoadPipeline` bærer selve orkestreringen — loadMap,
setupHostSvg, terreng-finalize, retry og reveal-animasjonen. `MapView.vue` er
nå 3714 linjer (fra 9123 ved starten — −59 %) og er redusert til skall:
refs, composable-sammenkobling, watch-tabellen og kart-verten. I tillegg til
lint/bygg/testsuite er endringene verifisert med en Playwright-røyktest i
ekte Chromium mot dev-serveren: kart-lasting, alle åtte drawer-faner, søk og
kontekstmenyen (inkl. detalj-inset) kjøres gjennom uten konsollfeil — testen
fanget og fikset to TDZ-feil underveis.

---

## 2026-07-15 — v1.0.9: Hurtigfiks — «autoMapArmed is not defined» ved kart-lasting

v1.0.8-oppdelingen etterlot fire referanser i `MapView.vue` til variabler som
var flyttet inn i composables: `autoMapArmed` (re-armering i loadMap — ga
«Kunne ikke laste kartet» på alle kart), `extendZonesBounds` (mosaikk-
minsteskala), `cachedBandsKey` (relieff-stil-bytte) og timer-oppryddingen i
onUnmounted. Composablene eksponerer nå `armAutoMap`, `extendZonesBounds`,
`invalidateReliefBands` og `teardownMapExtend`, og forelder-scriptet er
verifisert med samme ESLint `no-undef`-sjekk som composablene (den forrige
revisjonen dekket kun template-siden — det var blindsonen).

---

## 2026-07-15 — v1.0.8: Stor opprydning — MapView delt i komponenter og composables

Hoveddelen av den planlagte oppdelingen av `MapView.vue`, samlet i én stor
endring: hele fila er redusert fra 8756 til ca. 5550 linjer uten funksjonelle
endringer. Template-siden er skilt ut i egne komponenter — skalabar/attribusjon,
modus-chips og -bannere, FAB-innstillingspanelet, kulturminne-arket, alle åtte
drawer-fanene (`src/components/drawer/`) og hele long-press-kontekstmenyen
(`src/components/context-menu/`). Script-siden har fått fem nye composables som
mottar forelderens refs destrukturert med uendrede funksjonskropper:
`useDetailInset` (detalj-lupen), `useHeritageLayers` (fredet/kulturminne-WFS),
`useReliefRender` (hillshade), `useGhostTiles` (mosaikk-naboer) og
`useMapExtend` (kant-soner + auto-promotering). Kart-SVG-verten, transform-
eierskapet, watchene og laste-pipelinen ligger fortsatt i `MapView.vue`;
kontekst-oppslagene, symbol-rendererne og laste-pipelinen er kandidater for
senere oppdeling. Alle komponent-grensesnitt er verifisert med automatisk
identifikator-revisjon, og bygg + hele testsuiten er grønn.

---

## 2026-07-15 — v1.0.7: Opprydning — status/feil-overlays skilt ut

Fjerde steg i oppdelingen av `MapView.vue`: de transiente status- og feil-
overlayene (kart-skjelett/laste-pille, «kunne ikke laste», posisjons-status,
«utenfor kartet», detalj-feil og lav GPS-nøyaktighet) er samlet i
`src/components/MapStatusOverlays.vue`. Komponenten tar imot all tilstand som
props og sender ut handlinger (`retry-load`, `retry-details`, `dismiss-*`),
og reproduserer de tre uavhengige v-if/v-else-if-kjedene internt.
Lasteskjelettets scoped-CSS følger med til komponenten. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.6: Opprydning — søke-overlay skilt ut

Tredje steg i oppdelingen av `MapView.vue`: søke-overlayet (søkefelt +
treffliste med Nominatim-fallback) er trukket ut til
`src/components/MapSearchOverlay.vue`. Komponenten er presentasjonell — den
tar imot søketilstand som props (`open`, `query`, `results`, `active-index`,
globale treff) og sender ut intensjoner (`select`, `select-global`, `close`,
`keydown`), mens all logikk (indeksering, sentrering, bygg nytt kart,
highlight) blir i forelderen. `query` og `active-index` er toveis via
`v-model`. Komponenten eier sin egen fade-transition og fokuserer feltet når
det åpnes, så `searchInputRef` er borte fra `MapView.vue`. Ingen funksjonell
endring.

---

## 2026-07-15 — v1.0.5: Opprydning — perf-logg-modal skilt ut

Andre steg i oppdelingen av `MapView.vue`: perf-logg-modalen (byggetider fra
localStorage, kun tilgjengelig fra Utvikler-fanen) er trukket ut til
`src/components/PerfLogModal.vue`. Komponenten eier hele perf-logg-konseptet —
den henter og tømmer loggen selv — og forelderen styrer bare synligheten via
`v-model:open`. Både `getPerfLog`/`clearPerfLog`-importen og de fire
hjelpefunksjonene er dermed borte fra `MapView.vue`. Ingen funksjonell endring.

---

## 2026-07-15 — v1.0.4: Opprydning — høydeprofil-modal skilt ut

Første steg i å bryte den massive `MapView.vue` (9000+ linjer) i mindre biter:
den store høydeprofil-modalen som åpnes ved tap på en turs sparkline er trukket
ut til en egen presentasjonskomponent, `src/components/TrackElevationSheet.vue`.
Komponenten tar imot valgt spor og en ferdig beregnet profil som props og
sender ut `close`; forelderen eier fortsatt DEM-en og profil-cachen. Ingen
funksjonell endring — ren strukturell opprydning som etablerer props-inn/
emit-ut-mønsteret for videre oppdeling.

---

## 2026-07-15 — v1.0.3: Nytt ikon — «Høydekurve»

Lende fikk et eget ikon tegnet i kartets eget språk: konsentriske høydekurver i
ISOM-konturbrun på kremgul land (ISOM 001), med toppen forskjøvet opp mot høyre
for en ekte terreng-følelse. Det erstatter det arvede svg-insights-ikonet (gul
topplinje på skifergrå), som var laget for tegneverktøyet, ikke et turkart. Hele
merket ligger innenfor maskable-sirkelen, så ingenting klippes på Android. Nye
`icon.svg` og `favicon.svg` (ren SVG) er kilden; PNG-ene (192/512/maskable-512
og apple-touch 180) er rasterisert fra `icon.svg`.

---

## 2026-07-15 — v1.0.2: «Installer som app» på forsiden

Forsiden (`MapHomeView`) fikk en «Installer som app»-knapp. Den kobler på den
eksisterende composablen `usePwaInstall` (samme som `MapPickerView` og
`GravelPlannerView` bruker), så ingen ny install-logikk er skrevet. Knappen
vises kun når nettleseren faktisk tilbyr PWA-install (Chrome/Edge/Android) eller
på iOS (der den viser en kort manuell veiledning via Del-menyen), og skjules når
appen allerede kjører installert. Klikk gir først en bekreftelses-dialog
(«Installer Lende som webapp?») før nettleserens egen install-prompt utløses.

---

## 2026-07-15 — v1.0.1: Automatisk root-sjekk etter deploy

Deploy-workflowen (`build-vardasen-map.yml`) fikk et nytt steg som poller
`https://gitjanerik.github.io/lende/` etter push til `gh-pages` og feiler
bygget hvis root ikke svarer 200 innen ~200 sekunder. Bakgrunn: innholdet
deployes korrekt til `gh-pages` (index.html, assets, `.nojekyll`, `404.html`),
men en manglende Pages-aktivering ga 404 på selve siden uten at noe fanget det.
Sjekken gjør slike konfigurasjonsbrudd synlige i CI med en tydelig feilmelding
som peker på Settings → Pages. CI har full nettverkstilgang, så dette
verifiseres faktisk der (det kan ikke sjekkes fra sandkassen).

---

## 2026-07-15 — v1.0.0: Lende fødes — kart og ruteplanlegging skilt ut fra svg-insights

Lende er en rendyrket turkart- og ruteplanleggingsapp, skilt ut fra
`gitjanerik/svg-insights` (v12.1.67). Kart-sporet — hele ISOM-pipelinen
(Kartverket WCS DTM/DOM, OSM Overpass, N50, Sjøkart, NVE, Naturbase, GBIF),
ruteplanleggeren med GPX-eksport, MCP-serveren og ~75 testfiler — er flyttet
over uendret i funksjon. Tegne- og font-sporene ble igjen i svg-insights, og
CurveBall-spillet er fjernet. Nytt: forenklede URL-er (`/` er kart-hjem,
`/nytt`, `/rute`), egne lagringsnavn (`lende-*` for IndexedDB og
localStorage — kart fra svg-insights følger ikke med), og `base: /lende/` på
GitHub Pages. Historikk før v1.0.0 ligger i svg-insights sin git-logg.

---
