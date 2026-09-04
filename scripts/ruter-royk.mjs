#!/usr/bin/env node
// Røyktest for RUTINGEN: hver rute, hver redirect, og boot-gjenopptaket.
//
// HVORFOR den er egen: royk-mapview.mjs monterer ÉN rute (/kart/:id) og trykker
// på domenene der. Den sier ingenting om at /about lander på /om, at
// /kart/nytt?lat=… beholder query-en, eller at beforeEach-hooken som gjenopptar
// forrige kart fortsatt returnerer en gyldig location. Alt det er
// vue-router-kontrakt, og en major-oppgradering (4 → 5, v5.22.7) er nøyaktig når
// den brytes.
//
// Feilmodusen er dessuten stille: en redirect som slutter å virke gir en blank
// side eller en URL som ser rett ut mens ingenting rendret. Derfor sjekkes BÅDE
// slutt-URL og at det faktisk står noe i DOM-en.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright'

const PORT = 5188
const BASE = `http://localhost:${PORT}/lende`

// [gå til, forventet slutt-sti, en tekst/selektor som beviser at noe rendret]
const RUTER = [
  ['/',               '/lende/',               'body'],
  ['/nytt',           '/lende/nytt',           'body'],
  ['/rute',           '/lende/rute',           'body'],
  ['/fritt',          '/lende/fritt',          'text=Fritt lende'],
  ['/tegnforklaring', '/lende/tegnforklaring',  'body'],
  ['/om',             '/lende/om',             'text=Om Så i lende'],
  // Redirectene. /about er den viktigste: den er den offentlige lenka utenfra.
  ['/about',          '/lende/om',             'text=Om Så i lende'],
  ['/kart',           '/lende/',               'body'],
  // Query MÅ bevares gjennom funksjons-redirecten — den er skrevet som
  // `redirect: to => ({ name, query: to.query })`, og det er den formen en
  // major-oppgradering av ruteren typisk rører.
  ['/kart/nytt?lat=59.84&lon=10.41', '/lende/nytt?lat=59.84&lon=10.41', 'body'],
  ['/ruteplanlegger?fra=a',          '/lende/rute?fra=a',               'body'],
]

const sov = (ms) => new Promise((ok) => setTimeout(ok, ms))
const resultat = []
function sjekk(navn, ok, detalj) {
  resultat.push({ navn, ok })
  console.log(`${ok ? '✓' : '✗'} ${navn}${detalj ? ` — ${detalj}` : ''}`)
}

if (!existsSync('dist/index.html')) {
  console.log('dist/ mangler — kjør npm run build først')
  process.exit(1)
}
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', detached: false })
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(`${BASE}/`); if (r.ok) break } catch { /* ikke oppe ennå */ }
  await sov(500)
}

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
})
const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
const page = await ctx.newPage()
const jsFeil = []
page.on('pageerror', (e) => jsFeil.push(e.message))

try {
  for (const [fra, forventet, bevis] of RUTER) {
    // Nullstill lagret state FØR hver navigasjon. Uten dette forurenser løkka
    // seg selv: et besøk på /rute får GravelPlannerView til å skrive
    // `lende-last-mode`, og da sender boot-hooken en senere fersk last av «/»
    // videre til /rute. Første utgave av denne testen rapporterte det som at
    // «/kart → /» var brutt i vue-router 5. Det var riktig app-atferd og en feil
    // i testen. Boot-hooken testes for seg, lenger ned.
    //
    // v5.23.0: nullstillingen måtte hardnes. Å tømme rett etter
    // `domcontentloaded` er en KAPPESTRID mot appen som nettopp startet:
    // står det fortsatt «rute» i lageret, sender boot-hooken denne lasten
    // videre til /rute, GravelPlannerView monterer og skriver nøkkelen på
    // nytt — og gjør den det ETTER at vi tømte, overlever verdien til neste
    // navigasjon. Feilen dukket opp som «/kart → / landet på /rute» i én
    // CI-kjøring og forsvant i den neste, på identisk app-kode. Vi lar derfor
    // boot-en gjøre seg ferdig først, tømmer, og VERIFISERER at det ble tomt.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const tøm = () => page.evaluate(() => {
      try {
        localStorage.clear(); sessionStorage.clear()
        return localStorage.length
      } catch { return -1 }
    })
    for (let forsøk = 0; forsøk < 4; forsøk++) {
      await sov(250)          // la boot-hook + evt. redirect + mount fullføre
      if (await tøm() === 0) break
    }
    await page.goto(`${BASE}${fra}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await sov(600)
    const url = new URL(page.url())
    const faktisk = url.pathname + url.search
    let rendret = false
    try {
      await page.locator(bevis).first().waitFor({ state: 'attached', timeout: 6000 })
      rendret = (await page.evaluate(() => document.body.innerText.trim().length)) > 0
    } catch { /* rendret = false */ }
    sjekk(`${fra} → ${forventet}`, faktisk === forventet && rendret,
      faktisk === forventet ? (rendret ? 'rendret' : 'RIKTIG URL men TOM side') : `landet på ${faktisk}`)
  }

  // Boot-gjenopptaket: beforeEach-hooken sender brukeren til forrige kart ved
  // FERSK last på «/». Den returnerer en named location med params, som er
  // formen ruteren må fortsette å godta. Hooken kjører bare én gang per
  // sidelast (bootChecked), så det MÅ være en ny page.
  const s2 = await ctx.newPage()
  s2.on('pageerror', (e) => jsFeil.push(e.message))
  await s2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await s2.evaluate(() => {
    localStorage.setItem('lende-last-mode', 'rute')
    localStorage.removeItem('lende-boot-pending')
  })
  await s2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await sov(900)
  const bootUrl = new URL(s2.url()).pathname
  sjekk('boot-gjenopptak: «/» → forrige modus', bootUrl === '/lende/rute',
    bootUrl === '/lende/rute' ? 'sendt til /rute' : `ble stående på ${bootUrl}`)

  // Fritt lende skriver bevisst ALDRI `lende-last-mode`, så boot-hooken kan
  // ikke lande der: modusen velges alltid bevisst fra hovedmenyen. Sjekken
  // fanger at noen senere legger til en 'fritt'-gren i god tro.
  const s4 = await ctx.newPage()
  s4.on('pageerror', (e) => jsFeil.push(e.message))
  await s4.goto(`${BASE}/fritt`, { waitUntil: 'domcontentloaded' })
  await sov(900)
  const skrevet = await s4.evaluate(() => localStorage.getItem('lende-last-mode'))
  sjekk('Fritt lende skriver ikke lende-last-mode', skrevet !== 'fritt',
    skrevet === null ? 'ikke satt' : `satt til ${skrevet}`)

  // Tom-tilstanden er den ENESTE skjermen som møter en ny bruker, og den er
  // usynlig for de andre Fritt lende-sjekkene: de kjører med et seedet ark, så
  // `meta` er sann og hele denne grenen rendres aldri. Tre ting måles.
  //
  // 1. Teksten skal kunne MARKERES (v6.5.31). `select-none` lå på roten og
  //    arvet ned i hver eneste tekstflate; den hører hjemme på kart-flata, som
  //    er den som har en gest å beskytte. En bruker som vil ha teksten lest
  //    høyt må kunne ta tak i den, og regresjonen er én klasse på feil element.
  // 2. Boblen ved knappen vises til første trykk og aldri igjen.
  // 3. Trykket kvitterer den ut — og sjekken RYDDER etter seg (nøkkelen
  //    slettes), så neste kjøring møter en fersk bruker.
  const tom = await s4.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((n) => /God tur/i.test(n.textContent))
    return {
      tekst: document.body.innerText,
      markerbar: el ? getComputedStyle(el).userSelect !== 'none' : false,
    }
  })
  sjekk('Fritt lende: tom-tilstanden ber om nøyaktig posisjon og ønsker god tur',
    /nøyaktig posisjon/i.test(tom.tekst) && /God tur/i.test(tom.tekst),
    'nevner nøyaktig posisjon og god tur')
  sjekk('Fritt lende: tom-tilstandens tekst kan markeres', tom.markerbar,
    tom.markerbar ? 'user-select arves ikke fra roten' : 'select-none arves ned i teksten')
  sjekk('Fritt lende: førstegangs-boblen peker på knappen',
    /GPS på\?/.test(tom.tekst), 'boblen vises før første trykk')

  // AUTOSTARTEN (v6.5.34) og porten under den. Uten tillatelse skal skjermen
  // stå stille — den ovenfor beviser halvparten; her måles at oppslaget i seg
  // selv ikke reiser nettleserens dialog og ikke setter i gang noe.
  sjekk('Fritt lende: uten tillatelse starter ingenting av seg selv',
    !/Finner posisjonen|Bygger kart/i.test(tom.tekst),
    'ingen fremdriftschip på en tom skjerm')

  await s4.locator('button[aria-label]').first().click()
  await sov(400)
  const etterTrykk = await s4.evaluate(() => ({
    boble: /GPS på\?/.test(document.body.innerText),
    sett: localStorage.getItem('lende-fritt-tips-sett'),
  }))
  sjekk('Fritt lende: boblen kvitteres ut av første trykk',
    !etterTrykk.boble && etterTrykk.sett === '1',
    etterTrykk.boble ? 'boblen står igjen' : 'skjult og husket')
  // Nøytral tilstand: neste kjøring — og neste sjekk i denne — skal møte en
  // bruker som ikke har trykket ennå.
  await s4.evaluate(() => localStorage.removeItem('lende-fritt-tips-sett'))

  // Snarveien til Fritt lende i den tomme «Mine kart»-lista, TATT HERFRA med
  // vilje: står du allerede i modusen, er navigasjonen en no-op, og fram til
  // v6.5.33 lot snarveien rute-watchen i AppMenu om lukkingen — en watch på
  // `route.fullPath` som da aldri fyrer. Panelet ble stående oppå arket.
  await s4.locator('button[aria-label="Åpne meny"]').click()
  await sov(400)
  await s4.locator('.am-row-main').first().click()          // «Mine kart»
  await sov(600)
  const modalKom = await s4.locator('[role="dialog"]').count()
  await s4.locator('[role="dialog"] button:has-text("Prøv")').click()
  await sov(900)
  const etterSnarvei = {
    modal: await s4.locator('[role="dialog"]').count(),
    meny: await s4.locator('.am-row-main').count(),
    url: new URL(s4.url()).pathname,
  }
  sjekk('Fritt lende: snarveien lukker «Mine kart» når du alt står i modusen',
    modalKom === 1 && etterSnarvei.modal === 0 && etterSnarvei.meny === 0
      && etterSnarvei.url === '/lende/fritt',
    modalKom !== 1 ? 'fikk ikke opp panelet i det hele tatt'
      : `panel ${etterSnarvei.modal}, meny ${etterSnarvei.meny}, ${etterSnarvei.url}`)

  // AUTOSTARTEN, den andre halvdelen: har brukeren ALT gitt posisjonstillatelse
  // og finnes det ikke noe ark, skal modusen hente kartet uten et trykk
  // (v6.5.34). Egen kontekst, fordi tillatelsen gis per kontekst — og den kan
  // ikke gis i `ctx`, som resten av kjøringen bruker til å måle at ingenting
  // starter av seg selv.
  //
  // Sjekken måler at modusen SETTER I GANG, ikke at kartet blir ferdig: chipen
  // står i det GPS-en starter, altså før første nettkall. Vi avbryter straks —
  // en røyktest for RUTING skal ikke bygge et ekte ark fra Overpass, og et bygg
  // som får løpe ville tatt titalls sekunder på en kilde som kan ha en dårlig
  // dag.
  const ctxGps = await browser.newContext({
    viewport: { width: 430, height: 900 },
    permissions: ['geolocation'],
    geolocation: { latitude: 59.8425, longitude: 10.4076 },   // Vardåsen
  })
  const sGps = await ctxGps.newPage()
  sGps.on('pageerror', (e) => jsFeil.push(e.message))
  await sGps.goto(`${BASE}/fritt`, { waitUntil: 'domcontentloaded' })
  let startetSelv = false
  for (let i = 0; i < 20 && !startetSelv; i++) {
    await sov(200)
    startetSelv = await sGps.evaluate(() => /Finner posisjonen|Bygger kart/i.test(document.body.innerText))
  }
  sjekk('Fritt lende: gitt tillatelse henter modusen kartet uten et trykk',
    startetSelv, startetSelv ? 'fremdriftschipen kom av seg selv' : 'skjermen ble stående tom')
  // Boblen peker på et trykk som allerede er gjort for brukeren.
  const bobleEtterAutostart = await sGps.evaluate(() => /GPS på\?/.test(document.body.innerText))
  sjekk('Fritt lende: autostarten kvitterer ut førstegangs-boblen',
    !bobleEtterAutostart, bobleEtterAutostart ? 'boblen står igjen' : 'skjult')
  await sGps.locator('button:has-text("Avbryt")').first().click().catch(() => {})
  await ctxGps.close()

  // Modusens VIKTIGSTE invariant: arket kommer opp fra IndexedDB uten et
  // eneste eksternt kall. Telefonen kan ha drept appen mens du sto på fjellet
  // uten dekning, og da skal kartet være der når du åpner den igjen.
  //
  // Seedingen skjer fra /tegnforklaring og IKKE fra «/», og det er ikke smak:
  // sjekken over satte `lende-last-mode` til 'rute', og konteksten deles — en
  // fersk last av «/» ville derfor blitt boot-gjenopptatt til /rute, der
  // GravelPlannerView henter OSM-fliser. De flisene er fortsatt i lufta når
  // rute-avskjæringen under settes opp, og lander som «eksterne kall» i en
  // sjekk som handler om noe helt annet. Nøyaktig den forurensningen fila
  // allerede advarer mot lenger oppe, bare et hakk senere i sløyfa: den ga
  // rødt i CI på tre OSM-fliser mens testen var grønn lokalt.
  // /tegnforklaring har verken boot-hook eller fliser, og IndexedDB er per
  // opphav — så seedingen virker like godt derfra.
  const s5 = await ctx.newPage()
  s5.on('pageerror', (e) => jsFeil.push(e.message))
  await s5.goto(`${BASE}/tegnforklaring`, { waitUntil: 'domcontentloaded' })
  await s5.evaluate(() => localStorage.removeItem('lende-last-mode'))
  await s5.evaluate(async () => {
    const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000" class="isom-map">`
      + `<g data-layer="kontur"><path d="M0 0 L100 100" data-iso="101"/></g>`
      + `<g data-layer="sti"><path d="M0 0 L50 50" data-iso="505"/></g>`
      + `<g data-layer="bygning"><rect width="8" height="8"/></g>`
      + `<g data-layer="skog"><rect width="20" height="20"/></g>`
      + `<g data-layer="bymasse"><rect width="10" height="10"/></g>`
      + `<g data-layer="parkering"><rect width="5" height="5"/></g>`
      + `<g data-layer="holdeplass"><rect width="5" height="5"/></g>`
      + `<g data-layer="kulturminne"><circle r="3"/></g></svg>`
    const entry = {
      id: 'fritt', navn: 'Fritt lende', equidistanceM: 10,
      utmBbox: { minE: 250000, maxE: 252000, minN: 6630000, maxN: 6632000 },
      opprettet: Date.now(), svg: SVG, annotations: [], dem: null,
    }
    const db = await new Promise((ok, nei) => {
      const r = indexedDB.open('lende-maps'); r.onsuccess = () => ok(r.result); r.onerror = () => nei(r.error)
    })
    await new Promise((ok, nei) => {
      const t = db.transaction(['maps', 'meta'], 'readwrite')
      t.objectStore('maps').put(entry)
      const { svg, dem, annotations, ...rest } = entry
      t.objectStore('meta').put({ ...rest, hasDem: false, sizeBytes: svg.length })
      t.oncomplete = ok; t.onerror = () => nei(t.error)
    })
  })
  // Samler URL-ene og ikke bare antallet: «1 eksterne kall forsøkt» er en
  // opplysning man ikke kan gjøre noe med, og feilen dukket opp i CI mens den
  // var grønn lokalt. En sjekk som ikke sier HVA som gikk galt koster en runde
  // gjetting hver gang den slår ut.
  const eksterneUrler = []
  await s5.route('**', (r) => {
    const url = r.request().url()
    if (url.startsWith(BASE.replace('/lende', ''))) return r.continue()
    eksterneUrler.push(`${r.request().resourceType()} ${url}`)
    return r.abort()
  })
  await s5.goto(`${BASE}/fritt`, { waitUntil: 'domcontentloaded' })
  let arket = null
  try {
    await s5.waitForSelector('svg.isom-map', { timeout: 15_000 })
    await sov(500)
    arket = await s5.evaluate(() => {
      const svg = document.querySelector('svg.isom-map')
      const lag = [...svg.querySelectorAll('[data-layer]')]
      const vis = (k) => lag.find((g) => g.getAttribute('data-layer') === k)?.style.display
      return {
        // Navn-LOD kjøres ikke her, så klassen MÅ være av — ellers er hvert
        // stedsnavn usynlig for alltid, og navn er halve poenget med kartet.
        lodPending: svg.classList.contains('lod-pending'),
        // Relieff er av ved KONSTRUKSJON: useReliefRender kalles aldri.
        hillshade: !!svg.querySelector('#hillshade-layer'),
        // Uten dette laget tegner GPS-prikken seg stille bort.
        userLayer: !!svg.querySelector('#user-layer'),
        strokeScale: svg.style.getPropertyValue('--stroke-scale'),
        skjulte: ['bymasse', 'parkering', 'holdeplass', 'kulturminne'].filter((k) => vis(k) === 'none').length,
        synlige: ['kontur', 'sti', 'bygning', 'skog'].filter((k) => vis(k) !== 'none').length,
        // Ekvidistansen er BYTTET UT med avstand fra senter (v6.5.27), og
        // avstanden vises først når GPS er på — så her skal ingen av dem stå.
        ekvidistanse: /Ekvidistanse/.test(document.body.innerText),
        avstand: /fra senter/.test(document.body.innerText),
        // Negativ UI-telling som et KRAV OM ANTALL, ikke «finnes ikke X» — da
        // fanger den også en femte knapp noen legger til i god tro.
        knapper: document.querySelectorAll('button').length,
        maalestokk: !!document.querySelector('svg line'),
      }
    })
  } catch { /* arket = null */ }

  sjekk('Fritt lende: lagret ark lastes UTEN nettverk',
    !!arket && eksterneUrler.length === 0,
    arket
      ? (eksterneUrler.length ? eksterneUrler.slice(0, 3).join(' | ') : 'ingen eksterne kall')
      : 'arket kom aldri opp')
  sjekk('Fritt lende: navn er synlige (lod-pending fjernet)', arket?.lodPending === false)
  sjekk('Fritt lende: relieff er av', arket?.hillshade === false)
  sjekk('Fritt lende: #user-layer finnes', arket?.userLayer === true)
  // Tallet er flyttall (0.6 × 0.933…), så det sammenliknes numerisk — en
  // streng-sjekk her ville feilet på 0.5599999999999999.
  const strek = Number.parseFloat(arket?.strokeScale ?? 'NaN')
  sjekk('Fritt lende: strek er låst til default-hakket', Math.abs(strek - 0.56) < 1e-6,
    arket?.strokeScale)
  sjekk('Fritt lende: de fire lagene er skjult', arket?.skjulte === 4, `${arket?.skjulte ?? 0}/4`)
  sjekk('Fritt lende: terreng og stier er synlige', arket?.synlige === 4, `${arket?.synlige ?? 0}/4`)
  sjekk('Fritt lende: ekvidistansen er borte fra linjalen', arket?.ekvidistanse === false)
  sjekk('Fritt lende: avstanden vises ikke før GPS er på', arket?.avstand === false)
  sjekk('Fritt lende: nøyaktig to knapper på skjermen', arket?.knapper === 2,
    `${arket?.knapper ?? 0} knapper`)
  sjekk('Fritt lende: målestokken vises', arket?.maalestokk === true)

  // Åpningsvisningen (v6.5.2). Arket er kvadratisk og telefonen høy, så
  // «se hele arket» fylte bare bredden og la kartet bunn-nært med et tomt felt
  // over. Kartet skal DEKKE viewporten, og det man sentrerer på skal ligge i
  // midten — letterboxingen inni SVG-en er lett å glemme igjen.
  const visning = await s5.evaluate(() => {
    const svg = document.querySelector('svg.isom-map')
    const vb = svg.viewBox.baseVal
    const pt = (x, y) => {
      const p = svg.createSVGPoint(); p.x = x; p.y = y
      return p.matrixTransform(svg.getScreenCTM())
    }
    const a = pt(0, 0), b = pt(vb.width, vb.height), midt = pt(vb.width / 2, vb.height / 2)
    return {
      bredde: b.x - a.x, hoyde: b.y - a.y,
      vpB: window.innerWidth, vpH: window.innerHeight,
      midtAvvikX: Math.abs(midt.x - window.innerWidth / 2),
      midtAvvikY: Math.abs(midt.y - window.innerHeight / 2),
    }
  })
  sjekk('Fritt lende: kartet dekker hele viewporten',
    !!visning && visning.bredde >= visning.vpB && visning.hoyde >= visning.vpH,
    visning ? `kart ${Math.round(visning.bredde)}×${Math.round(visning.hoyde)} mot skjerm ${visning.vpB}×${visning.vpH}` : '')
  // Fremdrifts-chipen MÅ forsvinne når fixen lander (v6.5.3). Fram til da ble
  // flagget bare nullstilt av bygge-stien, så et trykk som bare startet GPS lot
  // «Finner posisjonen din …» stå for alltid — med posisjonen tydelig markert i
  // kartet bak. Sjekken trykker på ekte knapp og venter på ekte posisjon.
  await ctx.grantPermissions(['geolocation'])
  // Arkets EGET senter (utm32ToWgs84(251000, 6631000) for den seedede bboxen).
  // Fram til v6.5.27 sto punktet 315 km unna: prikken ble tegnet, så sjekken
  // over var grønn, men avstandsporten ville lest det som «langt utenfor arket»
  // og bygget et nytt kart mot en avskåret rute. Senteret er dessuten det
  // ærligste stedet å måle sentreringen fra.
  await ctx.setGeolocation({ latitude: 59.741969744969, longitude: 4.568121301687335 })
  await s5.locator('button[aria-label]').first().click()
  await sov(2500)
  const etterFix = await s5.evaluate(() => ({
    chipStårIgjen: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Avbryt'),
    prikk: !!document.querySelector('#user-layer circle'),
    // Avstandsteller (v6.5.27): linjalen skal bære «N m fra senter» så snart en
    // posisjon er kjent. Den er modusens ene tall og porten knappen står bak.
    avstand: (document.body.innerText.match(/[\d,.]+ (?:m|km) fra senter/) ?? [''])[0],
  }))
  sjekk('Fritt lende: fremdrifts-chipen forsvinner når fixen kommer',
    etterFix.prikk && !etterFix.chipStårIgjen,
    etterFix.prikk ? (etterFix.chipStårIgjen ? 'chipen står igjen' : 'borte') : 'fikk ingen posisjon')
  sjekk('Fritt lende: avstandstelleren står på linjalen når posisjonen er kjent',
    /fra senter/.test(etterFix.avstand), etterFix.avstand || 'ingen avstandslinje')

  // AVSTANDSPORTEN (v6.5.27). Posisjonen over ligger på arkets senter, altså
  // godt under grensa — et trykk skal da IKKE bygge, men si når det blir mulig.
  // Sjekken trykker på ekte knapp; ruta er avskåret, så en bygging her ville
  // dessuten blitt en feilmelding og ikke et nytt ark.
  //
  // Meldingen matches uten hensyn til STORE og små bokstaver og uten tallet i
  // seg: grensa er flyttet én gang (500 → 250 i v6.5.29), og setningen ble
  // samtidig skrevet om slik at «nytt utsnitt først» havnet midt i den. En
  // sjekk med versalen eller tallet bakt inn blir rød av en tekstendring og
  // grønn av feil grunn når grensa flyttes.
  await s5.locator('button[aria-label]').first().click()
  await sov(600)
  const porten = await s5.evaluate(() => ({
    melding: /nytt utsnitt først/i.test(document.body.innerText),
    // Avstanden må navngi hva den måles FRA (v6.5.29) — «du er 10 m unna»
    // leses som «10 m fra å kunne bygge», altså stikk motsatt av tallet.
    fraSenter: /fra midten av kartet/i.test(document.body.innerText),
    // Etiketten er avledet av samme tilstand som handlingen og skal ikke love
    // et nytt kart under porten.
    etikett: document.querySelector('button[aria-label]')?.getAttribute('aria-label') ?? '',
    bygger: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Avbryt'),
  }))
  sjekk('Fritt lende: porten stopper nytt ark på senteret og sier hvorfor',
    porten.melding && porten.fraSenter && !porten.bygger,
    porten.bygger ? 'bygde likevel' : (porten.melding ? (porten.fraSenter ? 'melding vist' : 'meldingen sier ikke hva avstanden måles fra') : 'ingen melding'))
  sjekk('Fritt lende: knappen lover ikke nytt kart under porten',
    !/lag .*kart/i.test(porten.etikett), porten.etikett)

  sjekk('Fritt lende: sentreringen treffer viewportens midte',
    !!visning && visning.midtAvvikX < 2 && visning.midtAvvikY < 2,
    visning ? `avvik ${Math.round(visning.midtAvvikX)}, ${Math.round(visning.midtAvvikY)} px` : '')

  // /om har tre faner fra v6.5.1. Fritt lende-fanen er den eneste dokumentasjonen
  // av modusen som finnes, og en fane er lett å miste i en refaktorering av
  // v-if/v-else-kjeden. Sjekken er nettverksfri.
  const s6 = await ctx.newPage()
  s6.on('pageerror', (e) => jsFeil.push(e.message))
  await s6.goto(`${BASE}/om`, { waitUntil: 'domcontentloaded' })
  await sov(700)
  const faner = await s6.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.textContent.trim())
    .filter((t) => ['Turkart', 'Fritt lende', 'Ruteplanlegger'].includes(t)))
  sjekk('/om har alle tre fanene', faner.length === 3, faner.join(', ') || 'fant ingen')

  await s6.locator('button', { hasText: 'Fritt lende' }).first().click()
  await sov(300)
  const frittTekst = await s6.evaluate(() => document.body.innerText)
  sjekk('/om: Fritt lende-fanen forklarer modusen',
    // Ankeret er hva fanen SIER om modusen, ikke hvilken versjon den kom i.
    // Versjonsnummeret sto her og ble fjernet fra teksten i v6.5.31: en fane
    // som forklarer modusen er poenget, og et årstall i en assertion gjør
    // sjekken rød av en helt vanlig redigering.
    /supplement/i.test(frittTekst) && /2 × 2 km/.test(frittTekst),
    'nevner supplement og arkstørrelsen')

  // Deep-lenker skal IKKE røres av hooken.
  const s3 = await ctx.newPage()
  s3.on('pageerror', (e) => jsFeil.push(e.message))
  await s3.goto(`${BASE}/tegnforklaring`, { waitUntil: 'domcontentloaded' })
  await s3.evaluate(() => localStorage.setItem('lende-last-mode', 'rute'))
  await s3.goto(`${BASE}/tegnforklaring`, { waitUntil: 'domcontentloaded' })
  await sov(700)
  const deepUrl = new URL(s3.url()).pathname
  sjekk('boot-gjenopptak rører ikke deep-lenker', deepUrl === '/lende/tegnforklaring',
    `ble på ${deepUrl}`)
} finally {
  await browser.close()
  preview.kill('SIGKILL')
}

sjekk('ingen JS-feil under navigasjonen', jsFeil.length === 0,
  jsFeil.length ? jsFeil.slice(0, 3).join(' | ').slice(0, 300) : '')

const feil = resultat.filter((r) => !r.ok)
console.log(`\n── ruter-royk ──────────────────────────────`)
for (const r of resultat) console.log(`${r.ok ? '✓' : '✗'} ${r.navn}`)
console.log(feil.length ? `\n✗ ${feil.length} sjekk(er) feilet\n` : '\n✓ all ruting svarer som den skal\n')
process.exit(feil.length ? 1 : 0)
