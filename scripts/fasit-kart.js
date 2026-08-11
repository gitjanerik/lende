// FASIT-suiten: bygg ekte kart for et fast sett steder, mål dem, og sjekk
// invarianter + avvik mot lagret baseline.
//
// Dette er sikkerhetsnettet enhetstestene ikke kan være: de dyre feilene i
// kart-pipelinen oppstår når fem autoritative kilder settes sammen på ekte
// geografi. Suiten krever nett (Overpass, Kartverket WCS, N50, Sjøkart,
// Turrutebasen) og kjører derfor i CI, ikke i `npm run test`.
//
// Kjør:
//   node scripts/fasit-kart.js                    # alle steder, sjekk mot fasit
//   node scripts/fasit-kart.js vardasen gjende    # bare noen
//   node scripts/fasit-kart.js --oppdater         # skriv ny fasit (etter en
//                                                 # BEVISST endring — les diffen)
//   node scripts/fasit-kart.js --json rapport.json
//
// Exit-kode 1 = brudd på en invariant eller avvik fra fasit. Exit 2 = bygging
// feilet (nett), som IKKE er en kode-regresjon.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMapHeadless } from '../mcp/headless.js'
import { lesKartGeometri, sjekkInvarianter, avvikMotBaseline } from '../src/lib/kartFasit.js'
import { STEDER } from './fasit/steder.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FASIT_FIL = resolve(__dirname, 'fasit', 'baseline.json')

const argv = process.argv.slice(2)
const oppdater = argv.includes('--oppdater')
const jsonIdx = argv.indexOf('--json')
const jsonUt = jsonIdx >= 0 ? argv[jsonIdx + 1] : null
const valgte = argv.filter((a, i) => !a.startsWith('--') && !(jsonIdx >= 0 && i === jsonIdx + 1))
const steder = valgte.length ? STEDER.filter(s => valgte.includes(s.id)) : STEDER

if (!steder.length) {
  console.error(`Ingen steder matchet. Gyldige: ${STEDER.map(s => s.id).join(', ')}`)
  process.exit(2)
}

const fasit = lesFasit()
const rapport = []
let brudd = 0
let byggFeil = 0

for (const sted of steder) {
  console.log(`\n${'─'.repeat(66)}\n▶ ${sted.navn}  (${sted.halfKm * 2} km)  — ${sted.hvorfor}`)
  let svg = null
  const t0 = Date.now()
  try {
    const bygget = await buildMapHeadless({
      lat: sted.lat, lon: sted.lon, halfKm: sted.halfKm,
      // Fast detaljnivå: tetthets-sonderingen kan ellers justere bredden mellom
      // kjøringer, og da måler vi ikke samme kart som fasiten.
      detaljNivaa: 'full',
      tetthetAv: true,
    })
    svg = bygget.svg
  } catch (e) {
    console.error(`  ✗ bygging feilet: ${e.message}`)
    byggFeil++
    rapport.push({ id: sted.id, byggFeil: e.message })
    continue
  }
  const sekunder = ((Date.now() - t0) / 1000).toFixed(0)

  const geo = lesKartGeometri(svg)
  const { brudd: invariantBrudd, advarsler, metrikker } = sjekkInvarianter(geo, sted.forvent)
  const avvik = oppdater ? [] : avvikMotBaseline(metrikker, fasit[sted.id])

  console.log(`  bygget i ${sekunder} s · ${(svg.length / 1024).toFixed(0)} KB`)
  console.log(`  ${formatterMetrikker(metrikker)}`)

  for (const b of invariantBrudd) console.log(`  ✗ BRUDD: ${b}`)
  for (const a of advarsler) console.log(`  ⚠ ${a}`)
  for (const a of avvik) {
    console.log(`  ✗ AVVIK ${a.felt}: fasit ${a.fasit} → nå ${a.naa} (${a.avvikPst > 0 ? '+' : ''}${a.avvikPst} %)`)
  }
  if (!invariantBrudd.length && !avvik.length) console.log('  ✓ alt innenfor fasit')

  brudd += invariantBrudd.length + avvik.length
  rapport.push({ id: sted.id, navn: sted.navn, metrikker, invariantBrudd, advarsler, avvik, sekunder: Number(sekunder) })
  if (oppdater) fasit[sted.id] = metrikker
}

if (oppdater) {
  mkdirSync(dirname(FASIT_FIL), { recursive: true })
  writeFileSync(FASIT_FIL, `${JSON.stringify(fasit, null, 2)}\n`)
  console.log(`\nSkrev ny fasit: ${FASIT_FIL}`)
}
if (jsonUt) writeFileSync(jsonUt, `${JSON.stringify(rapport, null, 2)}\n`)

console.log(`\n${'═'.repeat(66)}`)
if (byggFeil) console.log(`${byggFeil} sted(er) kunne ikke bygges (nett?) — ikke regnet som regresjon`)
if (brudd) {
  console.log(`✗ ${brudd} brudd/avvik. Er endringen bevisst: les diffen, og kjør --oppdater.`)
  process.exit(1)
}
console.log(oppdater ? '✓ fasit oppdatert' : '✓ ingen brudd, ingen avvik')
if (byggFeil) process.exit(2)

function lesFasit() {
  try {
    return JSON.parse(readFileSync(FASIT_FIL, 'utf8'))
  } catch {
    console.log('(ingen lagret fasit ennå — kjør med --oppdater for å opprette)')
    return {}
  }
}

function formatterMetrikker(m) {
  return [
    `vann ${(m.vannAndel * 100).toFixed(1)} % (${m.vannFlater} flater, ${m.vannHull} hull)`,
    `elv ${m.elvKm} km`,
    `veg ${(m.vegetasjonAndel * 100).toFixed(1)} %`,
    `kontur ${m.konturKm} km`,
    `sti ${m.stiKm} km`,
    `vei ${m.vegKm} km`,
    `broer ${m.broer}`,
  ].join(' · ')
}
