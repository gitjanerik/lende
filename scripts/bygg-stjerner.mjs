#!/usr/bin/env node
// Baker stjernekatalogen for 3D-natthimmelen: src/lib/tour3d/stjerner.js
//
// Kilden er HYG-databasen (Hipparcos + Yale BSC + Gliese, sammenstilt av
// astronexus), som gir J2000-koordinater i timer/grader og visuell magnitude.
// Vi tar de stjernene et øye faktisk ser — mag ≤ MAG_GRENSE — pluss hver
// stjerne som er navngitt i ASTERISMER, uansett hvor svak den er: et
// stjernebilde med hull i er ikke til å kjenne igjen.
//
// HVORFOR EN BAKE OG IKKE EN RUNTIME-HENTING: katalogen er 34 MB, den endrer
// seg aldri (J2000 er en fast epoke), og natthimmelen skal virke offline på et
// fjell. Samme resonnement som N50-flisene og værikonene.
//
// HVORFOR IKKE SKREVET FOR HÅND: koordinatene er det eneste i denne funksjonen
// som kan være FEIL uten at noe ser rart ut — en stjerne 2° på skeive er en
// stjerne, bare på feil plass. Da skal de komme fra en kilde, ikke fra hukommelsen.
//
// Bruk:
//   node scripts/bygg-stjerner.mjs                 # henter kilden over nett
//   node scripts/bygg-stjerner.mjs --kilde hyg.csv # bruker en lokal kopi
//   node scripts/bygg-stjerner.mjs --mal           # måler uten å skrive

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HYG_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv'

// Grensa er valgt etter hva som LESES som en stjernehimmel, ikke etter hva som
// er synlig i mørke: 6,5 er øyets grense og gir 9 000 stjerner, som blir en grå
// støymatte på en telefonskjerm. 2,6 gir ~100 — omtrent det man ser fra en by,
// og nok til at stjernebildene bærer.
const MAG_GRENSE = 2.6

// Stjernebilde-linjene. Hvert element er en kjede av Bayer-betegnelser i ETT
// stjernebilde-kortnavn; skriptet gjør dem om til indekspar i den bakte lista og
// FEILER hardt på et navn som ikke finnes. Det er med vilje: en tapt linje ville
// ellers bare vært et stjernebilde som stille mistet en arm.
//
// Utvalget er nordlig og gjenkjennelig — dette er et norsk turkart. Kjedene er
// forenklede figurer, ikke IAU-grensene.
const ASTERISMER = [
  { navn: 'Karlsvogna', kjeder: [['Alp UMa', 'Bet UMa', 'Gam UMa', 'Del UMa', 'Eps UMa', 'Zet UMa', 'Eta UMa']] },
  {
    navn: 'Lille bjørn',
    kjeder: [
      ['Alp UMi', 'Del UMi', 'Eps UMi', 'Zet UMi', 'Bet UMi', 'Gam UMi', 'Eta UMi', 'Zet UMi'],
    ],
  },
  { navn: 'Cassiopeia', kjeder: [['Eps Cas', 'Del Cas', 'Gam Cas', 'Alp Cas', 'Bet Cas']] },
  {
    navn: 'Orion',
    kjeder: [
      ['Alp Ori', 'Gam Ori'],
      ['Alp Ori', 'Zet Ori'],
      ['Gam Ori', 'Del Ori'],
      ['Del Ori', 'Eps Ori', 'Zet Ori'],
      ['Zet Ori', 'Kap Ori'],
      ['Del Ori', 'Bet Ori'],
    ],
  },
  {
    navn: 'Svanen',
    kjeder: [
      ['Alp Cyg', 'Gam Cyg', 'Eta Cyg', 'Bet Cyg'],
      ['Del Cyg', 'Gam Cyg', 'Eps Cyg'],
    ],
  },
  { navn: 'Lyren', kjeder: [['Alp Lyr', 'Zet Lyr', 'Del Lyr', 'Gam Lyr', 'Bet Lyr', 'Zet Lyr']] },
  {
    navn: 'Dragen',
    kjeder: [
      ['Gam Dra', 'Xi Dra', 'Bet Dra', 'Gam Dra'],
      ['Xi Dra', 'Del Dra', 'Zet Dra', 'Eta Dra', 'Iot Dra', 'Alp Dra', 'Kap Dra', 'Lam Dra'],
    ],
  },
  {
    navn: 'Perseus',
    kjeder: [
      ['Eta Per', 'Gam Per', 'Alp Per', 'Del Per', 'Eps Per'],
      ['Del Per', 'Bet Per'],
    ],
  },
  { navn: 'Bjørnevokteren', kjeder: [['Alp Boo', 'Eps Boo', 'Del Boo', 'Bet Boo', 'Gam Boo', 'Rho Boo', 'Alp Boo']] },
  { navn: 'Cepheus', kjeder: [['Alp Cep', 'Bet Cep', 'Gam Cep', 'Iot Cep', 'Zet Cep', 'Alp Cep']] },
  { navn: 'Kjøresvennen', kjeder: [['Alp Aur', 'Bet Aur', 'The Aur', 'Bet Tau', 'Iot Aur', 'Alp Aur']] },
  {
    navn: 'Tvillingene',
    kjeder: [
      ['Alp Gem', 'Bet Gem', 'Del Gem', 'Gam Gem'],
      ['Alp Gem', 'Eps Gem', 'Eta Gem'],
    ],
  },
  {
    navn: 'Løven',
    kjeder: [
      ['Eps Leo', 'Mu Leo', 'Zet Leo', 'Gam Leo', 'Eta Leo', 'Alp Leo'],
      ['Gam Leo', 'Del Leo', 'Bet Leo'],
      ['Del Leo', 'The Leo', 'Alp Leo'],
    ],
  },
]

const args = process.argv.slice(2)
const flagg = (navn) => {
  const i = args.indexOf(navn)
  return i >= 0 ? (args[i + 1] ?? true) : null
}
const bareMaling = args.includes('--mal')

async function lesKilde() {
  const lokal = flagg('--kilde')
  if (typeof lokal === 'string') return readFileSync(lokal, 'utf8')
  process.stderr.write(`Henter ${HYG_URL} …\n`)
  const res = await fetch(HYG_URL)
  if (!res.ok) throw new Error(`HYG svarte ${res.status}`)
  return res.text()
}

// Minimal CSV-leser. HYG er maskingenerert og bruker anførselstegn rundt hvert
// felt uten innebygde komma, så en full parser er ikke nødvendig — men den må
// tåle anførselstegnene, ellers blir hvert tall en streng med hermetegn i.
function lesCsv(tekst) {
  const linjer = tekst.split('\n').filter((l) => l.trim())
  const skill = (l) => l.split(',').map((f) => f.replace(/^"|"$/g, ''))
  const hode = skill(linjer[0])
  return linjer.slice(1).map((l) => {
    const felt = skill(l)
    const rad = {}
    for (let i = 0; i < hode.length; i++) rad[hode[i]] = felt[i]
    return rad
  })
}

const rader = lesCsv(await lesKilde())
process.stderr.write(`${rader.length} rader i kilden\n`)

// Sola står i HYG som id 0 med avstand 0 — den hører ikke i en stjernehimmel.
// Doble komponenter (comp ≠ 1) er den samme lysprikken sett to ganger; vi tar
// primærkomponenten, som er den katalogen selv peker på.
const kandidater = rader.filter((r) => r.id !== '0' && r.mag && Number.isFinite(Number(r.mag))
  && (!r.comp || r.comp === '1'))

const nokkel = (r) => (r.bayer && r.con ? `${r.bayer} ${r.con}` : null)

// Slå opp én Bayer-betegnelse. Finnes flere rader (ulike komponenter eller
// dobbeltoppføringer), tar vi den lyseste — det er den man ser.
const etterNokkel = new Map()
for (const r of kandidater) {
  const k = nokkel(r)
  if (!k) continue
  const forrige = etterNokkel.get(k)
  if (!forrige || Number(r.mag) < Number(forrige.mag)) etterNokkel.set(k, r)
}

// Visuelle doble bærer suffiks i HYG: Albireo står som «Bet-1 Cyg», ikke
// «Bet Cyg». Øyet ser ÉN stjerne, så vi slår opp den LYSESTE komponenten når
// den usuffikserte ikke finnes. Uten dette manglet Svanen halen sin og Løven
// hodet, og skriptet hadde ingen måte å si det.
//
// «Lyseste», ikke «-1»: δ¹ Lyr er 5,58 og δ² er 4,30, så en blind førstevalg
// hadde satt en stjerne man ikke ser i Lyrens parallellogram.
const finn = (navn) => {
  if (etterNokkel.has(navn)) return etterNokkel.get(navn)
  const [bayer, con] = navn.split(' ')
  let best = null
  for (const [k, r] of etterNokkel) {
    if (!k.startsWith(`${bayer}-`) || !k.endsWith(` ${con}`)) continue
    if (!best || Number(r.mag) < Number(best.mag)) best = r
  }
  return best
}

const valgte = new Map()   // nøkkel eller id → rad
const leggTil = (r) => {
  const id = nokkel(r) ?? `id:${r.id}`
  if (!valgte.has(id)) valgte.set(id, r)
  return id
}

for (const r of kandidater) {
  if (Number(r.mag) <= MAG_GRENSE) leggTil(r)
}
const lysteAntall = valgte.size

// Stjernebilde-stjernene hentes inn i tillegg om de er svakere enn grensa.
// `slot` er nøkkelen stjerna FAKTISK ligger under (som kan bære et
// dobbelt-suffiks), og det er den linjene må indekseres med.
const slot = new Map()
const manglende = []
for (const a of ASTERISMER) {
  for (const kjede of a.kjeder) {
    for (const navn of kjede) {
      if (slot.has(navn)) continue
      const r = finn(navn)
      if (!r) { manglende.push(`${a.navn}: ${navn}`); continue }
      slot.set(navn, leggTil(r))
    }
  }
}
if (manglende.length) {
  throw new Error(`Fant ikke disse stjernene i kilden:\n  ${manglende.join('\n  ')}`)
}

// Sortert på rektascensjon: gir en stabil, diffbar fil der en ny stjerne havner
// på sin plass i stedet for å skyve alle indekser etter seg.
const sortert = [...valgte.entries()].sort((a, b) => Number(a[1].ra) - Number(b[1].ra))
const indeks = new Map(sortert.map(([k], i) => [k, i]))

const stjerner = sortert.map(([, r]) => ({
  ra: Number(Number(r.ra).toFixed(5)),
  dek: Number(Number(r.dec).toFixed(5)),
  mag: Number(Number(r.mag).toFixed(2)),
  navn: (r.proper || '').trim() || null,
  bayer: nokkel(r),
}))

const linjer = []
for (const a of ASTERISMER) {
  for (const kjede of a.kjeder) {
    for (let i = 0; i + 1 < kjede.length; i++) {
      const a1 = indeks.get(slot.get(kjede[i]))
      const a2 = indeks.get(slot.get(kjede[i + 1]))
      if (a1 == null || a2 == null) throw new Error(`Uoppløst linje: ${kjede[i]} → ${kjede[i + 1]}`)
      linjer.push([a1, a2])
    }
  }
}

process.stderr.write(
  `${stjerner.length} stjerner (${lysteAntall} lysere enn ${MAG_GRENSE}, `
  + `${stjerner.length - lysteAntall} hentet inn for stjernebildene), `
  + `${linjer.length} linjer i ${ASTERISMER.length} stjernebilder\n`,
)

if (bareMaling) process.exit(0)

const ut = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'tour3d', 'stjerner.js')
const js = `// GENERERT AV scripts/bygg-stjerner.mjs — IKKE REDIGER FOR HÅND.
//
// Stjernekatalog for 3D-natthimmelen. Kilde: HYG-databasen (Hipparcos + Yale
// BSC + Gliese), epoke J2000. ${stjerner.length} stjerner: alle lysere enn
// magnitude ${MAG_GRENSE}, pluss dem stjernebildene under trenger.
//
//   ra   rektascensjon i TIMER (0–24)
//   dek  deklinasjon i grader (−90–90)
//   mag  visuell magnitude — lavere er lysere
//
// Kjør skriptet på nytt for å endre utvalget eller legge til et stjernebilde;
// LINJER peker med indekser inn i STJERNER, så de to må bakes sammen.
/* eslint-disable */

export const STJERNER = [
${stjerner.map((s) => `  { ra: ${s.ra}, dek: ${s.dek}, mag: ${s.mag}, navn: ${s.navn ? JSON.stringify(s.navn) : 'null'} },   // ${s.bayer}`).join('\n')}
]

/** Stjernebilde-linjer som indekspar inn i STJERNER. */
export const LINJER = [
${linjer.map(([a, b]) => `  [${a}, ${b}],`).join('\n')}
]

/** Navnene på stjernebildene linjene tegner — for kommentar og test. */
export const STJERNEBILDER = ${JSON.stringify(ASTERISMER.map((a) => a.navn))}
`
writeFileSync(ut, js)
process.stderr.write(`Skrev ${ut} (${(js.length / 1024).toFixed(1)} kB)\n`)
