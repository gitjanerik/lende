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
  ['/tegnforklaring', '/lende/tegnforklaring',  'body'],
  ['/om',             '/lende/om',             'text=Om Så i lende'],
  // Redirectene. /about er den viktigste: den er den offentlige lenka utenfra.
  ['/about',          '/lende/om',             'text=Om Så i lende'],
  ['/kart',           '/lende/',               'body'],
  // Fritt lende (v6.5.0–v7.8.14). Modusen er slettet, og stien er en redirect
  // til forsiden — den kan stå i et bokmerke eller på en hjemskjerm, og en
  // modus som er borte skal lande et sted og ikke på ingenting.
  ['/fritt',          '/lende/',               'body'],
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

  // «NYTT TURKART» I HOVEDMENYEN (v7.8.14), raden som avløste Fritt lende.
  // Tre ting måles, og alle tre er nettverksfrie — byggingen som følger etter
  // en vellykket fix er MapLibrarys og hører ikke hjemme i en ruting-røyktest.
  //
  //   1. Raden finnes og sier hva man får FØR man trykker. Meta-linja er
  //      brukerens egen standardbredde, ikke en konstant, så sjekken matcher
  //      formen («N × N km · fra din posisjon») og ikke tallet.
  //   2. En NEKTET tillatelse sier fra, RETT UNDER raden. Det var hele
  //      bestillingen: en knapp som ikke gjør noe og ikke sier hvorfor er
  //      identisk med en ødelagt knapp.
  //   3. Varselet kan X-es ut. Uten det blir boksen stående til man lukker
  //      hele menyen — og den dytter alt under seg nedover imens.
  //
  // `getCurrentPosition` overstyres i sida framfor å nekte tillatelsen i
  // konteksten: Playwright har ingen «avslå»-tilstand, bare «ikke gitt», og den
  // gir en prompt som aldri besvares i stedet for kode 1.
  const sM = await ctx.newPage()
  sM.on('pageerror', (e) => jsFeil.push(e.message))
  await sM.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await sov(900)
  await sM.locator('button[aria-label="Åpne meny"]').click()
  await sov(500)
  const menyRader = await sM.evaluate(() => [...document.querySelectorAll('.am-row-main')]
    .map((b) => b.innerText.replace(/\n/g, ' · ')))
  const nyttRad = menyRader.find((t) => /^Nytt turkart/.test(t)) ?? ''
  sjekk('hovedmenyen har «Nytt turkart» med størrelse og kilde',
    /^Nytt turkart · \d+ × \d+ km · fra din posisjon$/.test(nyttRad),
    nyttRad || menyRader.join(' / ') || 'fant ingen rader')
  sjekk('hovedmenyen har ingen Fritt lende-rad igjen',
    !menyRader.some((t) => /Fritt lende/.test(t)), menyRader.length + ' rader')

  await sM.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, feil) => feil({ code: 1, message: 'denied' })
  })
  await sM.locator('.am-row-main').nth(2).click()
  await sov(400)
  const varsel = await sM.evaluate(() => {
    const el = document.querySelector('[role="alert"]')
    if (!el) return null
    const rader = [...document.querySelectorAll('.am-row')]
    const sisteRad = rader[rader.length - 1].getBoundingClientRect()
    return {
      tekst: el.innerText.trim(),
      underRaden: el.getBoundingClientRect().top >= sisteRad.top,
      harX: !!el.querySelector('button'),
    }
  })
  sjekk('avvist GPS gir et varsel rett under raden, med en X',
    varsel?.tekst === 'GPS-tillatelse avvist' && varsel.underRaden && varsel.harX,
    varsel ? `«${varsel.tekst}», under=${varsel.underRaden}, X=${varsel.harX}` : 'ingen boks')

  await sM.locator('[role="alert"] button').click().catch(() => {})
  await sov(300)
  const borte = await sM.evaluate(() => !document.querySelector('[role="alert"]'))
  sjekk('X-en skjuler varselet', borte, borte ? 'borte' : 'står igjen')

  // TEKSTEN I VARSELET MÅ FØLGE TEKSTSKALAEN (v7.8.16). Boksen sto med
  // `text-[13px]`, altså en ABSOLUTT piksel-verdi, og hovedmenyen skalerer ved å
  // sette en rot-font på `16px × skalaen` og måle alt annet i `em` — så varselet
  // var det ene i menyen som IKKE vokste. Den er nå `em`, og det er nettopp den
  // typen verdi som «ryddes» tilbake til px av en som måler den i modalen, der
  // `zoom` skjuler forskjellen. Sjekken måler derfor i MENYEN, og måler
  // FORHOLDET mellom to skalaer i stedet for et tall: et tall ville vært en
  // påstand om nettleserens rot-font.
  const fontVed = async (skala) => {
    await sM.evaluate((v) => localStorage.setItem('lende-ui-text-scale', String(v)), skala)
    await sM.reload({ waitUntil: 'domcontentloaded' })
    await sov(700)
    await sM.locator('button[aria-label="Åpne meny"]').click()
    await sov(400)
    await sM.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (_ok, feil) => feil({ code: 1, message: 'denied' })
    })
    await sM.locator('.am-row-main').nth(2).click()
    await sov(400)
    return sM.evaluate(() => {
      const el = document.querySelector('[role="alert"] span')
      return el ? parseFloat(getComputedStyle(el).fontSize) : 0
    })
  }
  const font100 = await fontVed(1)
  const font150 = await fontVed(1.5)
  const vekst = font100 ? font150 / font100 : 0
  sjekk('varselteksten vokser med tekstskalaen i hovedmenyen',
    font100 > 0 && Math.abs(vekst - 1.5) < 0.06,
    `${font100.toFixed(1)} px → ${font150.toFixed(1)} px (×${vekst.toFixed(2)})`)
  await sM.evaluate(() => localStorage.removeItem('lende-ui-text-scale'))
  await sM.close()

  // UTSNITTS-VELGEREN VISER SAMME BOKS (v7.8.16). Den sto igjen med den lange
  // varianten — etikett PLUSS «Trykk på låsikonet i adressefeltet …» — og uten
  // X, med den begrunnelsen at flata der har plass. Eieren ba om den korte
  // overalt. Sjekken måler nøyaktig det som var forskjellen: teksten er
  // etiketten alene, og boksen har en vei ut.
  const sV = await ctx.newPage()
  sV.on('pageerror', (e) => jsFeil.push(e.message))
  await sV.goto(`${BASE}/nytt`, { waitUntil: 'domcontentloaded' })
  await sov(900)
  await sV.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, feil) => feil({ code: 1, message: 'denied' })
  })
  await sV.locator('button[aria-label*="GPS"]').first().click().catch(() => {})
  await sov(500)
  const vVarsel = await sV.evaluate(() => {
    const el = document.querySelector('[role="alert"]')
    return el ? { tekst: el.innerText.trim(), harX: !!el.querySelector('button') } : null
  })
  sjekk('utsnitts-velgeren viser etiketten alene, med X',
    vVarsel?.tekst === 'GPS-tillatelse avvist' && vVarsel.harX,
    vVarsel ? `«${vVarsel.tekst}», X=${vVarsel.harX}` : 'ingen boks')
  await sV.locator('[role="alert"] button').click().catch(() => {})
  await sov(300)
  const vBorte = await sV.evaluate(() => !document.querySelector('[role="alert"]'))
  sjekk('X-en skjuler varselet i utsnitts-velgeren', vBorte, vBorte ? 'borte' : 'står igjen')
  await sV.close()

  // /om har TO faner fra v7.8.14 (Fritt lende-fana falt med modusen). En fane
  // er lett å miste i en refaktorering av v-if/v-else-kjeden, og den som blir
  // stående må fortsatt kunne velges — en `v-else` som aldri nås ser helt
  // normal ut i koden. Sjekken er nettverksfri.
  const s6 = await ctx.newPage()
  s6.on('pageerror', (e) => jsFeil.push(e.message))
  await s6.goto(`${BASE}/om`, { waitUntil: 'domcontentloaded' })
  await sov(700)
  const faner = await s6.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.textContent.trim())
    .filter((t) => ['Turkart', 'Fritt lende', 'Ruteplanlegger'].includes(t)))
  sjekk('/om har begge fanene, og ingen Fritt lende-fane',
    faner.length === 2 && !faner.includes('Fritt lende'),
    faner.join(', ') || 'fant ingen')

  await s6.locator('button', { hasText: 'Ruteplanlegger' }).first().click()
  await sov(300)
  const ruteTekst = await s6.evaluate(() => document.body.innerText)
  sjekk('/om: Ruteplanlegger-fanen kan velges og forklarer seg',
    /grus/i.test(ruteTekst), 'fanen byttet innhold')

  // TEGNFORKLARINGEN MÅ TÅLE 200 % TEKST (v6.5.43). Raden var en fast
  // 120 px-prøve med `shrink-0` og en tekstspalte som fikk resten: ved 200 % på
  // en telefon ble spalta så smal at etiketten sto som én bokstav pr linje, og
  // arket rant ut til høyre. Sjekken TRYKKER på den nye A-knappen framfor å
  // seede localStorage — det er knappen som er ny, og en seedet verdi ville
  // målt layouten uten å si om knappen virker.
  const sL = await ctx.newPage()
  sL.on('pageerror', (e) => jsFeil.push(e.message))
  await sL.setViewportSize({ width: 360, height: 780 })   // smal telefon = verste fall
  await sL.goto(`${BASE}/tegnforklaring`, { waitUntil: 'domcontentloaded' })
  await sL.evaluate(() => localStorage.removeItem('lende-ui-text-scale'))
  await sL.reload({ waitUntil: 'domcontentloaded' })
  await sov(600)
  const aKnapp = sL.locator('button[aria-label^="Tekststørrelse i grensesnittet"]').first()
  const startEtikett = await aKnapp.getAttribute('aria-label')
  // Fra 100 % til 200 %: tre trykk. Fjerde trykk skal RUNDE tilbake til 100 %.
  for (let i = 0; i < 3; i++) { await aKnapp.click(); await sov(250) }
  const paa200 = await aKnapp.getAttribute('aria-label')
  const flyt = await sL.evaluate(() => {
    const d = document.documentElement
    // Bredeste synlige element mot viewporten — samme spørsmål som
    // «renner arket ut», men det peker på HVEM som gjør det.
    let verst = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      const ut = Math.round(r.right - innerWidth)
      if (ut > 2 && (!verst || ut > verst.ut)) {
        verst = { ut, hvem: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` }
      }
    }
    return { doc: d.scrollWidth - d.clientWidth, verst }
  })
  sjekk('Tegnforklaringen renner ikke ut ved 200 % tekst',
    flyt.doc <= 1 && !flyt.verst,
    flyt.verst ? `${flyt.verst.hvem} stikker ${flyt.verst.ut} px utenfor` : `doc-overflyt ${flyt.doc} px`)
  sjekk('A-knappen i Tegnforklaringen bærer sin egen tilstand',
    /100 prosent/.test(startEtikett || '') && /200 prosent/.test(paa200 || ''),
    `${startEtikett} → ${paa200}`)
  await aKnapp.click(); await sov(250)
  const rundet = await aKnapp.getAttribute('aria-label')
  sjekk('A-knappen runder tilbake til 100 %', /100 prosent/.test(rundet || ''), rundet || '')
  // NØYTRAL TILSTAND: skalaen er global og persistert, så en sjekk som lar den
  // stå på 200 % måler neste sjekk på en helt annen layout.
  await sL.evaluate(() => localStorage.removeItem('lende-ui-text-scale'))
  await sL.close()

  // «Nytt turkart» ved 200 % tekst (v6.5.45). To ting brakk der, og begge er
  // usynlige ved 100 %: forhåndsvisningens 50 px-renne på hver side spiste den
  // halverte logiske bredden, så kartet kollapset til en 24 px firkant; og
  // «Lag turkart» var festet til bunnen i dobbel høyde og etterlot knapt plass
  // til én rad i trefflista.
  // MÅLES I MODALEN, ikke på /nytt: `zoom` settes av AppModal, mens
  // MapPickerView ikke skalerer i det hele tatt — en måling på ruta ville stått
  // grønn uansett hva koden gjorde, som den gjorde i første utgave av sjekken.
  const sN = await ctx.newPage()
  sN.on('pageerror', (e) => jsFeil.push(e.message))
  await sN.setViewportSize({ width: 360, height: 780 })   // smal telefon = verste fall
  await sN.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await sN.evaluate(() => localStorage.setItem('lende-ui-text-scale', '2'))
  await sN.reload({ waitUntil: 'domcontentloaded' })
  await sov(700)
  await sN.locator('button[aria-label="Åpne meny"]').click()
  await sov(400)
  await sN.locator('.am-row-main').first().click()          // «Mine kart»
  await sov(700)
  await sN.locator('[role="dialog"] button', { hasText: 'Flere valg' }).first().click()
  await sov(900)
  const nytt200 = await sN.evaluate(() => {
    const rute = [...document.querySelectorAll('[role="dialog"] div.aspect-square')]
      .find((n) => n.getBoundingClientRect().width > 0)
    const knapp = [...document.querySelectorAll('[role="dialog"] button')]
      .find((n) => /Lag turkart/.test(n.textContent))
    // Format-knappene: ett ord hver, og ingen av dem skal klippes. Med tre
    // faste kolonner ble «Kvadratisk» delt midt i ordet ved stor tekst — det
    // er nettopp den overflyten `scrollWidth > clientWidth` fanger.
    const fmt = [...document.querySelectorAll('[role="dialog"] button')]
      .filter((n) => /^(Kvadratisk|Stående|Liggende)$/.test(n.textContent.trim()))
    return {
      bredde: rute ? Math.round(rute.getBoundingClientRect().width) : -1,
      festet: knapp ? getComputedStyle(knapp.parentElement).position : 'fant-ingen',
      formater: fmt.map((n) => n.textContent.trim()),
      formatSol: Math.max(0, ...fmt.map((n) => n.scrollWidth - n.clientWidth)),
    }
  })
  // Terskelen er FYSISKE piksler: `zoom: 2` gjør 120 logiske til 240 på skjermen.
  sjekk('Nytt turkart: forhåndsvisningen overlever 200 % tekst',
    nytt200.bredde >= 120, `preview ${nytt200.bredde} px`)
  sjekk('Nytt turkart: tre formater med ett ord hver',
    nytt200.formater.join(',') === 'Kvadratisk,Stående,Liggende', nytt200.formater.join(',') || 'fant ingen')
  sjekk('Nytt turkart: formatknappene klippes ikke ved 200 % tekst',
    nytt200.formatSol === 0, `overflyt ${nytt200.formatSol} px`)
  sjekk('Nytt turkart: «Lag turkart» slipper bunnen over 125 %',
    nytt200.festet === 'static', `position: ${nytt200.festet}`)
  await sN.evaluate(() => localStorage.removeItem('lende-ui-text-scale'))
  await sN.close()

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
