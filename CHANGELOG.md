# Endringslogg

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
