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
//
// FASIT (v6.3.9): kjedene er MÅLT mot d3-celestials `constellations.lines.json`
// — standardfigurene, uavhengig av oss. Regelen som kom ut av det er at vi kan
// utelate en strek som finnes i fasiten (forenkling), men ALDRI tegne en som
// ikke finnes der (oppfunnet geometri). Sju av de tretten hadde snarveier som
// hoppet over mellomliggende stjerner, og Karlsvogna hadde bollen åpen.
// Invarianten står i stjerner.test.js mot en innbakt fasit-tabell —
// stjernefigurFasit.js — så en ny kjede ikke kan smugle inn en strek igjen.
const ASTERISMER = [
  // Karlsvogna: bollen er en FIRKANT. Fram til v6.3.9 sto kjeden som
  // Alp→Bet→Gam→Del→…, altså med bollen ÅPEN på oversida — δ Dubhe-linja manglet,
  // og himmelens mest gjenkjennelige figur var en krok og ikke en vogn.
  { navn: 'Karlsvogna', latin: 'Ursa Major', kjeder: [['Del UMa', 'Alp UMa', 'Bet UMa', 'Gam UMa', 'Del UMa', 'Eps UMa', 'Zet UMa', 'Eta UMa']] },
  {
    navn: 'Lille bjørn',
    latin: 'Ursa Minor',
    kjeder: [
      ['Alp UMi', 'Del UMi', 'Eps UMi', 'Zet UMi', 'Bet UMi', 'Gam UMi', 'Eta UMi', 'Zet UMi'],
    ],
  },
  { navn: 'Kassiopeia', latin: 'Cassiopeia', kjeder: [['Eps Cas', 'Del Cas', 'Gam Cas', 'Alp Cas', 'Bet Cas']] },
  // Andromeda og Pegasus henger sammen i ÉN stjerne: Alpheratz er hjørnet i
  // Pegasus-firkanten og samtidig hodet i Andromeda-kjeden. Den står derfor i
  // begge figurene — det er ikke en dublett, det er slik himmelen ser ut.
  //
  // Bakgrunnen for at de kom inn (v6.4.0): de var det eieren så på skjermen som
  // «løse stjerner uten stjernebilde» — kjeden Almach–Mirach–Alpheratz og
  // firkanten under den er noe av det mest gjenkjennelige på høsthimmelen, og
  // det var bare vi som ikke tegnet dem.
  {
    navn: 'Andromeda',
    latin: 'Andromeda',
    kjeder: [
      // Kjeden fra Pegasus-firkanten og utover: Alpheratz → δ → Mirach → Almach.
      ['Alp And', 'Del And', 'Bet And', 'Gam And'],
      // Beinet ut fra Mirach. Det er pekestokken til Andromedagalaksen — μ og ν
      // står på linje fra Mirach, og galaksen ligger like over ν.
      ['Bet And', 'Mu And', 'Nu And'],
    ],
  },
  {
    navn: 'Pegasus',
    latin: 'Pegasus',
    kjeder: [
      // Firkanten, LUKKET. Den er hele figuren for de fleste, og et åpent
      // hjørne ville vært samme feil som Karlsvognas åpne bolle (v6.3.9).
      ['Alp And', 'Bet Peg', 'Alp Peg', 'Gam Peg', 'Alp And'],
      // Halsen ned til Enif, hestens mule. Den går via ξ og ζ — en rett strek
      // fra Markab til θ finnes ikke i standardfiguren.
      ['Alp Peg', 'Xi Peg', 'Zet Peg', 'The Peg', 'Eps Peg'],
    ],
  },
  {
    navn: 'Orion',
    latin: 'Orion',
    kjeder: [
      ['Alp Ori', 'Gam Ori'],
      ['Alp Ori', 'Zet Ori'],
      ['Gam Ori', 'Del Ori'],
      ['Del Ori', 'Eps Ori', 'Zet Ori'],
      ['Zet Ori', 'Kap Ori'],
      // Rigel henger på beltet via η Ori, ikke rett på δ: benet er BØYD.
      ['Del Ori', 'Eta Ori', 'Bet Ori'],
      // Hodet (λ Ori) mellom skuldrene — med i enhver standardframstilling.
      ['Gam Ori', 'Lam Ori', 'Alp Ori'],
    ],
  },
  {
    navn: 'Svanen',
    latin: 'Cygnus',
    kjeder: [
      ['Alp Cyg', 'Gam Cyg', 'Eta Cyg', 'Bet Cyg'],
      ['Del Cyg', 'Gam Cyg', 'Eps Cyg'],
    ],
  },
  { navn: 'Lyren', latin: 'Lyra', kjeder: [['Alp Lyr', 'Zet Lyr', 'Del Lyr', 'Gam Lyr', 'Bet Lyr', 'Zet Lyr']] },
  {
    navn: 'Dragen',
    latin: 'Draco',
    kjeder: [
      // Hodet er en FIRKANT med ν Dra, ikke en trekant: β–ξ finnes ikke i noen
      // standardfigur, og hodet er det ene ved Dragen man kjenner igjen.
      ['Xi Dra', 'Gam Dra', 'Bet Dra', 'Nu Dra', 'Xi Dra'],
      // Kroppen svinger via φ og θ. Uten dem gikk streken tvers over svingene.
      ['Xi Dra', 'Del Dra', 'Phi Dra', 'Zet Dra', 'Eta Dra', 'The Dra', 'Iot Dra', 'Alp Dra', 'Kap Dra', 'Lam Dra'],
    ],
  },
  {
    navn: 'Persevs',
    latin: 'Perseus',
    kjeder: [
      // Buen går gjennom ψ og ν; Algol henger på η via τ, ι og κ — ikke rett på
      // δ, som var en strek vi hadde funnet opp selv.
      ['Eta Per', 'Gam Per', 'Alp Per', 'Psi Per', 'Del Per', 'Nu Per', 'Eps Per'],
      ['Eta Per', 'Tau Per', 'Iot Per', 'Kap Per', 'Bet Per'],
    ],
  },
  { navn: 'Bjørnevokteren', latin: 'Boötes', kjeder: [['Alp Boo', 'Eps Boo', 'Del Boo', 'Bet Boo', 'Gam Boo', 'Rho Boo', 'Alp Boo']] },
  {
    navn: 'Kefeus',
    latin: 'Cepheus',
    // Huset: taket α–β–γ–ι med β–ι som bjelke, og veggen tilbake via δ, ζ, ε, μ.
    kjeder: [
      ['Alp Cep', 'Bet Cep', 'Gam Cep', 'Iot Cep', 'Del Cep', 'Zet Cep', 'Eps Cep', 'Mu Cep', 'Alp Cep'],
      ['Bet Cep', 'Iot Cep'],
    ],
  },
  // Femkanten lukkes via η Aur, ikke med en rett α–ι-strek.
  { navn: 'Kusken', latin: 'Auriga', kjeder: [['Alp Aur', 'Bet Aur', 'The Aur', 'Bet Tau', 'Iot Aur', 'Eta Aur', 'Alp Aur']] },
  {
    navn: 'Tvillingene',
    latin: 'Gemini',
    // ÉN kjede fra Kastors fot til Pollux' fot. Fire av de fem gamle strekene
    // var snarveier vi hadde funnet opp; ingen av dem finnes i standardfiguren.
    kjeder: [
      ['Eta Gem', 'Mu Gem', 'Eps Gem', 'Tau Gem', 'Alp Gem', 'Bet Gem', 'Ups Gem', 'Del Gem', 'Zet Gem', 'Gam Gem', 'Xi Gem'],
    ],
  },
  {
    navn: 'Løven',
    latin: 'Leo',
    kjeder: [
      ['Eps Leo', 'Mu Leo', 'Zet Leo', 'Gam Leo', 'Eta Leo', 'Alp Leo'],
      ['Gam Leo', 'Del Leo', 'Bet Leo'],
      // Bakparten er en trekant β–θ–α. Vi hadde δ–θ, som ikke er figuren.
      ['Bet Leo', 'The Leo', 'Alp Leo'],
    ],
  },
  {
    navn: 'Tyren',
    latin: 'Taurus',
    // ÉN kjede: horntupp ζ → Aldebaran → V-en → horntupp β. V-en er Hyadene,
    // altså oksens ansikt, med Aldebaran som det røde øyet i den ene enden og
    // ε i den andre; γ er spissen. Hele det gjenkjennelige dyret i seks streker.
    //
    // Halsen (γ–λ–ξ–ν) finnes i standardfiguren og er BEVISST utelatt: den er
    // fire stjerner på 3,4–3,9 som legger seg tett inntil V-en, og på en
    // telefonskjerm gjør de figuren grumsete uten å gjøre den mer gjenkjennelig.
    //
    // Elnath (β Tau) står ALLEREDE i Kusken. Det er ikke en dublett — stjerna er
    // oksens ene horn og kuskens hjørne samtidig, akkurat som Alpheratz deles av
    // Pegasus og Andromeda (v6.4.0).
    kjeder: [
      ['Zet Tau', 'Alp Tau', 'The-2 Tau', 'Gam Tau', 'Del-1 Tau', 'Eps Tau', 'Bet Tau'],
    ],
  },
  {
    navn: 'Ørnen',
    latin: 'Aquila',
    // Altair er det tredje hjørnet i Sommertriangelet, og fram til nå var det
    // eneste av de tre uten en figur: Lyren og Svanen sto tegnet, Ørnen var én
    // løs prikk.
    kjeder: [
      // Raden av tre — Tarazed, Altair, Alshain — er det man kjenner den på.
      ['Gam Aql', 'Alp Aql', 'Bet Aql'],
      // Vingespennet gjennom Altair.
      ['Zet Aql', 'Alp Aql', 'Del Aql', 'Lam Aql'],
      // Kroppen, som lukker figuren. Uten den er ørna et kryss.
      ['Bet Aql', 'The Aql', 'Eta Aql', 'Del Aql'],
    ],
  },
  {
    navn: 'Nordlige krone',
    latin: 'Corona Borealis',
    // Halvsirkelen, med Alphecca som den lyseste perlen. Den er ÅPEN, og det er
    // riktig — dette er et diadem og ikke en ring. Sammenlikn Karlsvognas bolle,
    // som var åpen ved en feil (v6.3.9); her er åpningen selve figuren.
    kjeder: [
      ['The CrB', 'Bet CrB', 'Alp CrB', 'Gam CrB', 'Del CrB', 'Eps CrB', 'Iot CrB'],
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
  // Bayer-betegnelsen er et FELT og ikke bare en kommentar (v6.0.0): 21 av de
  // 147 mangler egennavn i HYG, og «#74» duger ikke i et infopanel.
  bayer: nokkel(r),
}))

// Slug til bruk som id: små bokstaver, æøå gjort om, mellomrom til bindestrek.
// Den er nøkkelen stjernebildeInfo.js indekseres på, så den må være stabil —
// endrer du et norsk navn, endrer du en id, og infoteksten mister formasjonen sin.
// Testen fanger det.
const slug = (navn) => navn.toLowerCase()
  .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
  .replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const linjer = []
const formasjoner = []
for (const a of ASTERISMER) {
  const egne = []
  const brukte = new Set()
  for (const kjede of a.kjeder) {
    for (let i = 0; i + 1 < kjede.length; i++) {
      const a1 = indeks.get(slot.get(kjede[i]))
      const a2 = indeks.get(slot.get(kjede[i + 1]))
      if (a1 == null || a2 == null) throw new Error(`Uoppløst linje: ${kjede[i]} → ${kjede[i + 1]}`)
      linjer.push([a1, a2])
      egne.push([a1, a2])
      brukte.add(a1)
      brukte.add(a2)
    }
  }
  // Senterpunktet brukes til å rette blikket mot formasjonen og til å finne
  // naboene. Middelverdi av retningsvektorene, ikke av tallene: et snitt av
  // rektascensjoner som spenner over 0h gir midt på motsatt side av himmelen.
  let vx = 0
  let vy = 0
  let vz = 0
  for (const i of brukte) {
    const s2 = stjerner[i]
    const ra = s2.ra * 15 * Math.PI / 180
    const dek = s2.dek * Math.PI / 180
    vx += Math.cos(dek) * Math.cos(ra)
    vy += Math.cos(dek) * Math.sin(ra)
    vz += Math.sin(dek)
  }
  const n = brukte.size || 1
  vx /= n; vy /= n; vz /= n
  const senterRa = ((Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360) / 15
  const senterDek = Math.atan2(vz, Math.hypot(vx, vy)) * 180 / Math.PI
  formasjoner.push({
    id: slug(a.navn),
    navn: a.navn,
    latin: a.latin,
    stjerner: [...brukte].sort((x, y) => x - y),
    linjer: egne,
    senterRa: Number(senterRa.toFixed(4)),
    senterDek: Number(senterDek.toFixed(4)),
  })
}
formasjoner.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'))
const dupe = formasjoner.map((f) => f.id).find((id, i, arr) => arr.indexOf(id) !== i)
if (dupe) throw new Error(`To formasjoner fikk samme id: ${dupe}`)

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
${stjerner.map((s) => `  { ra: ${s.ra}, dek: ${s.dek}, mag: ${s.mag}, navn: ${s.navn ? JSON.stringify(s.navn) : 'null'}, bayer: ${JSON.stringify(s.bayer)} },`).join('\n')}
]

/** Stjernebilde-linjer som indekspar inn i STJERNER. */
export const LINJER = [
${linjer.map(([a, b]) => `  [${a}, ${b}],`).join('\n')}
]

/**
 * Formasjonene som VALGBARE objekter — det er denne stjernekikkeren bruker.
 * Sortert alfabetisk på norsk navn, som er rekkefølgen nedtrekkslista viser.
 * Feltene stjerner og linjer er indekser inn i STJERNER; senterRa/senterDek er
 * middelretningen, brukt til å rette blikket dit og til å finne naboer.
 */
export const FORMASJONER = [
${formasjoner.map((f) => `  {
    id: ${JSON.stringify(f.id)}, navn: ${JSON.stringify(f.navn)}, latin: ${JSON.stringify(f.latin)},
    senterRa: ${f.senterRa}, senterDek: ${f.senterDek},
    stjerner: [${f.stjerner.join(', ')}],
    linjer: [${f.linjer.map(([a, b]) => `[${a}, ${b}]`).join(', ')}],
  },`).join('\n')}
]

/** Navnene på stjernebildene linjene tegner — for kommentar og test. */
export const STJERNEBILDER = ${JSON.stringify(formasjoner.map((f) => f.navn))}
`
writeFileSync(ut, js)
process.stderr.write(`Skrev ${ut} (${(js.length / 1024).toFixed(1)} kB)\n`)
