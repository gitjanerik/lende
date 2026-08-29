#!/usr/bin/env node
// Baker FASIT for stjernebildefigurene: src/lib/tour3d/stjernefigurFasit.js
//
// Kilden er d3-celestials `data/constellations.lines.json` (ofrohn/d3-celestial,
// BSD-3) — standardfigurene, laget uavhengig av oss. Punktene der er rene
// koordinater, så de slås opp mot HYG for å få Bayer-betegnelser vi kan
// sammenlikne kjedene våre med.
//
// HVORFOR EN BAKE OG IKKE EN HENTING I TESTEN: en test som krever nett blir
// skrudd av. Samme resonnement som referansepunktene i planeter.test.js.
//
// HVORFOR I DET HELE TATT: en stjernebildefigur kan være helt internt konsistent
// og likevel tegne en strek som ikke finnes i noen standardframstilling. Sju av
// våre tretten hadde snarveier som hoppet over mellomliggende stjerner, og
// Karlsvogna hadde bollen åpen. Det oppdages ikke ved å se på koden.
//
// Bruk:
//   node scripts/bygg-figurfasit.mjs                 # henter begge kildene
//   node scripts/bygg-figurfasit.mjs --kilde hyg.csv # lokal HYG-kopi

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { FORMASJONER } from '../src/lib/tour3d/stjerner.js'

const HYG_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'
const LINJER_URL = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json'

// Formasjons-id → IAU-kortnavn. Fasiten er nøklet på VÅRE id-er, så en formasjon
// som døpes om må inn her også — testen feiler med vilje om noen mangler.
const KODE = {
  karlsvogna: 'UMa', 'lille-bjorn': 'UMi', kassiopeia: 'Cas', orion: 'Ori',
  svanen: 'Cyg', lyren: 'Lyr', dragen: 'Dra', persevs: 'Per',
  bjornevokteren: 'Boo', kefeus: 'Cep', kusken: 'Aur', tvillingene: 'Gem',
  loven: 'Leo', andromeda: 'And', pegasus: 'Peg',
}

const args = process.argv.slice(2)
const lokalHyg = args.indexOf('--kilde') >= 0 ? args[args.indexOf('--kilde') + 1] : null

const hygTekst = lokalHyg
  ? readFileSync(lokalHyg, 'utf8')
  : await (await fetch(HYG_URL)).text()
const rader = hygTekst.split('\n').filter((l) => l.trim())
const hode = rader[0].split(',').map((f) => f.replace(/^"|"$/g, ''))
const I = (n) => hode.indexOf(n)

// Bare navngitte stjerner et øye kan se: fasit-punktene ER stjernebildestjerner,
// og et vidåpent utvalg gjør bare oppslaget tregere og mer utsatt for bom.
const kat = []
for (let i = 1; i < rader.length; i++) {
  const f = rader[i].split(',').map((x) => x.replace(/^"|"$/g, ''))
  const mag = Number(f[I('mag')])
  if (!Number.isFinite(mag) || mag > 6.5) continue
  if (f[I('comp')] && f[I('comp')] !== '1') continue
  if (!f[I('bayer')] || !f[I('con')]) continue
  kat.push({
    ra: Number(f[I('ra')]) * 15, dek: Number(f[I('dec')]), mag,
    bayer: f[I('bayer')], con: f[I('con')],
  })
}

const nærmeste = (raDeg, dekDeg) => {
  let best = null
  let bd = Infinity
  for (const s of kat) {
    let dra = Math.abs(s.ra - raDeg)
    if (dra > 180) dra = 360 - dra
    const d = Math.hypot(dra * Math.cos(dekDeg * Math.PI / 180), s.dek - dekDeg)
    if (d < bd) { bd = d; best = s }
  }
  // 0,3° er romslig nok for avrunding i kilden og stramt nok til at en
  // nabostjerne ikke kan stjele treffet.
  return bd < 0.3 ? best : null
}

// Komponent-suffiks strippes: `Nu-2 Dra` er ÉN lysprikk for øyet, og baken slår
// opp den lyseste komponenten under det usuffikserte navnet.
const navn = (s) => `${s.bayer.replace(/-\d+$/, '')} ${s.con}`
const par = (a, b) => [a, b].sort().join(' — ')

const con = JSON.parse(await (await fetch(LINJER_URL)).text())
const ut = {}
let ukjente = 0
for (const f of FORMASJONER) {
  const kode = KODE[f.id]
  if (!kode) throw new Error(`Ingen IAU-kode for formasjonen «${f.id}» — legg den i KODE`)
  const ref = con.features.find((x) => x.id === kode)
  if (!ref) throw new Error(`Fasiten kjenner ikke ${kode}`)
  const sett = new Set()
  for (const kjede of ref.geometry.coordinates) {
    const s = kjede.map(([ra, dek]) => {
      const t = nærmeste(((ra % 360) + 360) % 360, dek)
      if (!t) ukjente++
      return t
    })
    for (let i = 0; i + 1 < s.length; i++) {
      if (s[i] && s[i + 1]) sett.add(par(navn(s[i]), navn(s[i + 1])))
    }
  }
  ut[f.id] = [...sett].sort()
}

const antall = Object.values(ut).reduce((n, a) => n + a.length, 0)
process.stderr.write(`${antall} fasit-par i ${Object.keys(ut).length} figurer`
  + `${ukjente ? `, ${ukjente} punkter uten stjerne i HYG (hoppet over)` : ''}\n`)

// Antallet skrives med bokstaver i filhodet, som ellers i prosjektet. Det er
// dynamisk fordi det var feil i det øyeblikket figur nummer fjorten kom til.
const TALLORD = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte',
  'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten',
  'sytten', 'atten', 'nitten', 'tjue']
const ANTALL_ORD = TALLORD[Object.keys(ut).length] ?? String(Object.keys(ut).length)

const js = `// GENERERT AV scripts/bygg-figurfasit.mjs — IKKE REDIGER FOR HÅND.
//
// Standardfigurene for de ${ANTALL_ORD} stjernebildene Lende tegner, hentet fra
// d3-celestials \`data/constellations.lines.json\` (ofrohn/d3-celestial, BSD-3)
// og slått opp mot HYG for Bayer-betegnelser.
//
// Fasit fra en uavhengig implementasjon bakes INN og hentes ikke: en test som
// krever nett blir skrudd av. Samme grunn som referansepunktene i
// planeter.test.js.
//
// Hvert element er et par av Bayer-betegnelser, sortert alfabetisk og skilt med
// « — ». Komponent-suffiks (\`Nu-2\` → \`Nu\`) er strippet.
//
// BRUKEN ER ENSRETTET, og det er hele poenget (se stjerner.test.js): en strek vi
// tegner MÅ finnes her. En strek her som vi IKKE tegner er greit — kjedene våre
// er bevisste forenklinger for en telefonskjerm.
/* eslint-disable */

export const FIGUR_FASIT = {
${Object.entries(ut).map(([id, p]) => `  ${JSON.stringify(id)}: [\n${p.map((x) => `    ${JSON.stringify(x)},`).join('\n')}\n  ],`).join('\n')}
}
`
const fil = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'tour3d', 'stjernefigurFasit.js')
writeFileSync(fil, js)
process.stderr.write(`Skrev ${fil} (${(js.length / 1024).toFixed(1)} kB)\n`)
