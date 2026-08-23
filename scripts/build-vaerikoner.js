// Bygg værsymbol-modulen → src/lib/vaerIkoner.generert.js
//
// KILDE: github.com/metno/weathericons (weather/svg + weather/legend.csv).
// Ikonene er © 2015-2017 Yr og MIT-lisensiert; de er de samme man ser på yr.no,
// men filnavnene svarer til `symbol_code` i Locationforecast. METs egen README
// sier rett ut at de er MENT å bundles med applikasjonen — «There is no need
// for an API to fetch individual icons on demand».
//
// HVORFOR ÉN MODUL OG IKKE 83 FILER: som løse .svg-filer cacher service worker-en
// dem stale-while-revalidate, altså først ETTER at hver enkelt er hentet én gang
// — 83 forespørsler, og ingen garanti for at settet er komplett neste gang. Som
// én modul er det ett hashet asset, som SW-en cacher cache-first. Modulen lastes
// lazily (src/lib/vaerIkoner.js): den trengs bare når et varsel vises, og et
// varsel krever nett uansett, så den skal ikke ligge i MapView-chunken. Målt:
// statisk import kostet 36 kB gzip for alle brukere; som eget chunk er det 0.
//
// Data-URI framfor inline SVG er et krav, ikke en smakssak: METs SVG-er definerer
// <symbol id="sun"> og <linearGradient id="…"> med GLOBALE id-er, og to inlinede
// ikoner i samme dokument ville overskrevet hverandres gradienter. I en
// <img src="data:…"> er hvert ikon sitt eget dokument.
//
// Norske navn kommer fra METs legend.csv (bokmål-kolonnen) — vi oversetter ikke
// selv, kilden har gjort det.
//
// KJØR: npm run build:vaerikoner   (krever nett; ~85 små filer fra raw.githubusercontent)

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const RAW = process.env.WEATHERICONS_RAW
  ?? 'https://raw.githubusercontent.com/metno/weathericons/main/weather'
const CONCURRENCY = 8

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../src/lib/vaerIkoner.generert.js')

const VARIANTER = ['day', 'night', 'polartwilight']

async function hent(url, { tekst = true } = {}) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return tekst ? res.text() : Buffer.from(await res.arrayBuffer())
}

// legend.csv: Symbol ID,English,Bokmål,Nynorsk,Old ID,Variants
// Feltene har ingen anførselstegn eller komma, så en split holder — men de er
// MELLOMROMS-FYLT for kolonnebredde, så hvert felt må trimmes: uten det ble
// filnavnet «lightssleetshowersandthunder _polartwilight.svg» og hentingen 404.
// Kolonnetallet sjekkes så et endret format stopper bygget i stedet for å gi en
// modul med tomme navn.
function parseLegend(csv) {
  const linjer = csv.trim().split(/\r?\n/)
  const hode = linjer[0].split(',')
  if (hode[0].trim() !== 'Symbol ID' || hode[2].trim() !== 'Bokmål') {
    throw new Error(`legend.csv har uventede kolonner: ${linjer[0]}`)
  }
  const rader = []
  for (const linje of linjer.slice(1)) {
    const f = linje.split(',')
    if (f.length !== hode.length) throw new Error(`legend.csv-rad med ${f.length} felt: ${linje}`)
    rader.push({ kode: f[0].trim(), navn: f[2].trim(), harVarianter: f[5].trim() === '1' })
  }
  return rader
}

async function iBolker(oppgaver, n) {
  const ut = []
  for (let i = 0; i < oppgaver.length; i += n) {
    ut.push(...await Promise.all(oppgaver.slice(i, i + n).map((f) => f())))
  }
  return ut
}

const legend = parseLegend(await hent(`${RAW}/legend.csv`))
console.log(`legend.csv: ${legend.length} basiskoder`)

// Filnavnene i settet: basiskode aleine når Variants = 0, ellers én per variant.
const filnavn = []
for (const { kode, harVarianter } of legend) {
  if (harVarianter) for (const v of VARIANTER) filnavn.push(`${kode}_${v}`)
  else filnavn.push(kode)
}
console.log(`henter ${filnavn.length} SVG-er …`)

const ikoner = await iBolker(filnavn.map((navn) => async () => {
  const svg = await hent(`${RAW}/svg/${navn}.svg`)
  // Komprimer lett: fjern linjeskift og doble mellomrom mellom tagger. Ikke en
  // minifier — vi rører ikke attributter eller path-data.
  const stram = svg.replace(/>\s+</g, '><').replace(/\s*\n\s*/g, ' ').trim()
  return [navn, `data:image/svg+xml;base64,${Buffer.from(stram, 'utf-8').toString('base64')}`]
}), CONCURRENCY)

const navn = Object.fromEntries(legend.map((r) => [r.kode, r.navn]))
const medVarianter = legend.filter((r) => r.harVarianter).map((r) => r.kode)

const innhold = `// GENERERT AV scripts/build-vaerikoner.js — IKKE REDIGER FOR HÅND.
// Kjør \`npm run build:vaerikoner\` for å bygge på nytt.
//
// Værsymbolene fra github.com/metno/weathericons — © 2015-2017 Yr, MIT-lisens.
// Samme ikoner som på yr.no, med filnavn som svarer til symbol_code i
// Locationforecast 2.0. Bakt inn som data-URI-er fordi METs SVG-er har globale
// <symbol>/gradient-id-er som ville kollidert om de ble inlinet i samme dokument.
// Lastes lazily via src/lib/vaerIkoner.js. Se skriptet for hele begrunnelsen.
//
// Norske navn er METs egne (legend.csv, bokmål-kolonnen) — ikke våre oversettelser.

/** symbol_code (med variant der den finnes) → data-URI. */
export const VAER_IKON = ${JSON.stringify(Object.fromEntries(ikoner), null, 0)}

/** Basiskode → norsk navn (bokmål), fra METs legend.csv. */
export const VAER_NAVN = ${JSON.stringify(navn, null, 2)}

/** Basiskodene som finnes i dag-/natt-/polartwilight-variant. */
export const VAER_MED_VARIANT = new Set(${JSON.stringify(medVarianter)})
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, innhold, 'utf-8')
const kb = (Buffer.byteLength(innhold, 'utf-8') / 1024).toFixed(0)
console.log(`✓ ${OUT} — ${ikoner.length} ikoner, ${kb} kB`)
