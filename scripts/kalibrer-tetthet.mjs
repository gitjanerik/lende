// Kalibrerings-skript for tetthets-reglene (src/lib/mapDensityRules.js).
//
// Tersklene i mapDensityRules SKAL settes fra måling, ikke fra magefølelse.
// Skriptet sonderer et sett referanseområder som spenner fra åpent til svært
// tett, og skriver en tabell med tetthet per km², utledet klasse/detaljnivå og
// anbefalt maksbredde. Kjør det på nytt hvis tersklene justeres.
//
//   node scripts/kalibrer-tetthet.mjs
//
// Med --bygg bygges også kartet headless per område (treg, men gir ekte
// SVG-størrelse ved siden av tetthets-tallet):
//
//   node scripts/kalibrer-tetthet.mjs --bygg
import { bboxFromCenter } from '../src/lib/mapBuilder.js'
import { probeDensity } from '../src/lib/densityProbe.js'
import {
  tetthetsIndeks, tetthetsBeslutning, kostnad, KOSTNADSBUDSJETT,
} from '../src/lib/mapDensityRules.js'

const OMRAADER = [
  { navn: 'Oslo sentrum',   lat: 59.9245, lon: 10.7465 },
  { navn: 'Asker/Bondi',    lat: 59.8339, lon: 10.4358 },
  { navn: 'Vardåsen',       lat: 59.8404, lon: 10.4479 },
  { navn: 'Lierne/Stormoen', lat: 64.4419, lon: 13.7000 },
]

const HALF_KM = 4   // 8 km — dagens standardbredde
const byggOgsaa = process.argv.includes('--bygg')

const pad = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)

console.log(`Tetthets-kalibrering — ${HALF_KM * 2} km kvadrat, KOSTNADSBUDSJETT = ${KOSTNADSBUDSJETT}\n`)
console.log(
  pad('område', 18) + padL('km²', 6) + padL('indeks', 8) + padL('klasse', 13) +
  padL('nivå', 9) + padL('kostnad', 9) + padL('maks km', 9) + padL('bredde', 8) +
  (byggOgsaa ? padL('SVG KB', 9) : ''),
)
console.log('-'.repeat(byggOgsaa ? 89 : 80))

for (const o of OMRAADER) {
  const bbox = bboxFromCenter(o.lat, o.lon, HALF_KM, 1)
  const probe = await probeDensity(bbox, { timeoutMs: 30000 })
  if (!probe) {
    console.log(pad(o.navn, 18) + padL('— sondering feilet —', 30))
    continue
  }
  const indeks = tetthetsIndeks(probe.counts, probe.arealKm2)
  const b = tetthetsBeslutning(probe, { breddeKm: HALF_KM * 2, aspect: 1 })
  let svgKb = ''
  if (byggOgsaa) {
    const { buildMapHeadless } = await import('../mcp/headless.js')
    try {
      const r = await buildMapHeadless({ lat: o.lat, lon: o.lon, halfKm: HALF_KM, navn: o.navn })
      svgKb = padL(Math.round((r?.svg?.length ?? 0) / 1024), 9)
    } catch (e) { svgKb = padL('feil', 9) }
  }
  console.log(
    pad(o.navn, 18) + padL(probe.arealKm2.toFixed(0), 6) + padL(Math.round(indeks), 8) +
    padL(b.klasse, 13) + padL(b.detaljNivaa, 9) +
    padL(Math.round(kostnad(indeks, probe.arealKm2, b.detaljNivaa)), 9) +
    padL(b.maksBreddeKm.toFixed(1), 9) +
    padL(b.breddeJustert ? `${b.breddeKm} ⚠` : String(b.breddeKm), 8) + svgKb,
  )
  console.log('   ' + Object.entries(probe.counts).map(([k, v]) => `${k}=${v}`).join(' '))
}

console.log(
  '\nRegresjonskrav: Vardåsen og Lierne skal ha nivå «full» og uendret bredde\n' +
  '(automatikken skal ikke røre områder som oppleves greie i dag).',
)
