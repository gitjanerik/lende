# Endringslogg

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
