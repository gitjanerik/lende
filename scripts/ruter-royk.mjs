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
