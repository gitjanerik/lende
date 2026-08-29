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

  // Modusens VIKTIGSTE invariant: arket kommer opp fra IndexedDB uten et
  // eneste eksternt kall. Telefonen kan ha drept appen mens du sto på fjellet
  // uten dekning, og da skal kartet være der når du åpner den igjen.
  const s5 = await ctx.newPage()
  s5.on('pageerror', (e) => jsFeil.push(e.message))
  await s5.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
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
        ekvidistanse: /Ekvidistanse 10 m/.test(document.body.innerText),
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
  sjekk('Fritt lende: ekvidistansen står på linjalen', arket?.ekvidistanse === true)
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
    /supplement/i.test(frittTekst) && /versjon 6\.5/i.test(frittTekst),
    'nevner supplement og versjon')

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
