#!/usr/bin/env node
// Baker N50 arealdekke-FLATER (myr, skog, isbre) til statiske fliser i
// public/data/n50-areal/, og isbre-NAVN til isbrenavn.json ved siden av dem.
//
// ── Hvorfor dette finnes ───────────────────────────────────────────────────
// Samme diagnose som stinettet, bare for arealdekke: OSM er tynt i norsk
// utmark. Ved Briskemyrputten i Drammensmarka viser UT.no en myr som dekker
// det meste av utsnittet — OSM har ingenting, og Lende tegnet bare selve
// putten. N50 har myra, men ingen live WFS, så den bakes én gang og serveres
// som filer ved siden av appen.
//
// ── Hvorfor skogen manglet, og hva det IKKE var ────────────────────────────
// v5.25.0 bakte myr nasjonalt og skrev i CHANGELOG at «baken kan alt bære
// skog (--typer myr,skog)». Den kunne det. Den ble bare aldri BEDT om det:
// `--typer` sto på sin default `myr`, og workflowen hadde ingen knott for den,
// så det fantes ingen vei til skogen fra Actions-fanen. Manifestet sa ærlig
// `typer:["myr"]` hele veien, og `arealMerge` gjorde nøyaktig som den skulle —
// lot OSM-skogen stå, siden kilden ikke leverte skog.
//
// Det var altså ALDRI en datamengde-grense som stoppet skogen. Grensa er ekte,
// men den gjelder noe annet: hvor mye vi kan legge statisk i public/ før R2
// blir uunngåelig. Derfor har hver type nå sine EGNE skruer (se under) — en
// skogflate er hundre ganger større enn en myrflate og tåler grovere
// forenkling uten at et eneste kartblad ser annerledes ut.
//
// ── Størrelsen er hele spørsmålet ──────────────────────────────────────────
// Myr ble 57,9 MB nasjonalt. Skog dekker ~4× så mye areal, og en naiv bake med
// myrens skruer ville sprengt det public/ kan bære. Derfor har scriptet
// fortsatt `--mal`: det laster ned, måler og RAPPORTERER uten å skrive noe.
// Kjør den først, les tallene per type, og dra i skruene før du baker.
//
// Skruene tar enten ÉN verdi for alt, eller en verdi per type:
//   --toleranse 4              Douglas-Peucker i meter for alle typer
//   --toleranse myr=4,skog=8   … eller per type. N50 er 1:50 000; på et kart
//                              i 1:10 000 er 8 m = 0,8 mm.
//   --minareal 2500            Minste flate i m² for alle typer
//   --minareal myr=2500,skog=5000
//
// Kjør:  node scripts/bygg-n50-areal.mjs [--fylke 33] [--typer myr,skog,isbre]
//                                        [--toleranse 4] [--minareal 2500] [--mal]

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, createReadStream, readdirSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
  kodeFlis, forenkleRinger, fliserForFlate, arealM2, VERSJON, TYPER,
} from '../src/lib/n50ArealPakke.js'
import {
  finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, feltNavn, krevGdal,
} from './geonorgeN50.mjs'

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const FYLKE = argVal('--fylke')
const BARE_MAL = args.includes('--mal')

// --typer myr,skog,isbre — hvilke objekttyper baken skal bære.
//
// Defaulten er ALT vi klassifiserer, ikke `myr`. Den gamle defaulten var et
// måle-standpunkt fra den gang vi ikke visste hva myr kostet, og den ble
// stående etter at spørsmålet var besvart — det er den ene grunnen til at
// skogen aldri kom med. En default som representerer et ferdig avklart
// mellomsteg er en felle; nå må man be om mindre, ikke om mer.
const TYPER_VALGT = new Set(
  (argVal('--typer') ?? 'myr,skog,isbre').split(',').map(t => t.trim()).filter(Boolean))
for (const t of TYPER_VALGT) {
  if (!TYPER.includes(t)) throw new Error(`Ukjent type «${t}» — gyldige: ${TYPER.join(', ')}`)
}

/**
 * Les en skrue som enten ÉN verdi for alt («4») eller per type
 * («myr=4,skog=8»). Typer som ikke nevnes får `standard`.
 *
 * Per-type finnes fordi flatene ikke ligner hverandre: en myr er noen få
 * hundre meter og bæres av hvert eneste knekkpunkt, mens en skogteig er
 * kilometervis av kant der hver meter koster byte og ingen av dem er synlige
 * på et kart i 1:10 000. Én felles skrue måtte valgt mellom å ødelegge myra
 * eller å bære skogen dyrere enn public/ tåler.
 */
export function lesSkrue(rå, standard, typer = TYPER) {
  const ut = Object.fromEntries(typer.map(t => [t, standard]))
  const tekst = String(rå ?? '').trim()
  if (!tekst) return ut
  if (!tekst.includes('=')) {
    const v = Number(tekst)
    if (!Number.isFinite(v)) throw new Error(`Ugyldig tallverdi «${tekst}»`)
    for (const t of typer) ut[t] = v
    return ut
  }
  for (const del of tekst.split(',')) {
    const [navn, verdi] = del.split('=').map(x => x.trim())
    if (!typer.includes(navn)) throw new Error(`Ukjent type «${navn}» i «${tekst}»`)
    const v = Number(verdi)
    if (!Number.isFinite(v)) throw new Error(`Ugyldig verdi for «${navn}»: «${verdi}»`)
    ut[navn] = v
  }
  return ut
}

// Standardene per type. Myrens tall står NØYAKTIG som i v5.25.0 — en bake som
// endrer dem ville skrevet 206 fliser på nytt og sendt alle brukere ut i en
// full nedlasting for en forskjell ingen kan se.
const STANDARD_TOLERANSE = { myr: 4, skog: 8, apen: 8, annet: 8, isbre: 4 }
const STANDARD_MINAREAL = { myr: 2500, skog: 5000, apen: 5000, annet: 5000, isbre: 2500 }

// `null` som standard betyr «ikke nevnt på kommandolinja» — da gjelder typens
// egen verdi over. En felles standard her ville visket ut hele poenget: en
// `--toleranse skog=12` skal treffe skogen og la myra stå.
const medStandard = (rå, standard) => Object.fromEntries(
  TYPER.map(t => [t, lesSkrue(rå, null)[t] ?? standard[t]]))
const TOLERANSE = medStandard(argVal('--toleranse'), STANDARD_TOLERANSE)
const MIN_AREAL = medStandard(argVal('--minareal'), STANDARD_MINAREAL)

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT_KATALOG = join(ROT, 'public', 'data', 'n50-areal')
const NAVN_FIL = 'isbrenavn.json'

const log = (...a) => console.log(...a)

// ── Klassifisering ─────────────────────────────────────────────────────────
// N50 Arealdekke har `objtype` per flate. Nøklene er små bokstaver; verdien
// fra kilden lowercases før oppslag, så «SnøIsbre» og «SNØISBRE» treffer likt.
//
// Isbre har FLERE kandidat-skrivemåter med vilje. Vi har ikke sett feltet fra
// denne sandkassen (Geonorge er blokkert herfra), og et bomskudd her ville
// gitt null breer og en helt taus bake — samme stillhet som lot den første
// areal-kjøringen laste ned 166 MB og melde «success» med null flater. Å ta
// med tre stavemåter koster ingenting; å ta feil koster en kjøring på 25 min.
const OBJTYPE = {
  myr: 'myr',
  skog: 'skog',
  snøisbre: 'isbre',
  snoisbre: 'isbre',
  isbre: 'isbre',
  bre: 'isbre',
  // ÅpentOmråde bæres BEVISST IKKE. Når Turkart-bakgrunnen er den nøytrale
  // åpen-tonen, ER åpenhet standardtilstanden — å bake 112 020 flater som
  // bare maler bakgrunnen på nytt er ren datamengde uten et eneste nytt
  // piksel. Samme inversjon som «bakgrunnen ER land, vann males oppå».
}

export function klassifiser(props, typer = TYPER_VALGT) {
  const t = String(props?.objtype ?? '').trim().toLowerCase()
  const type = OBJTYPE[t] ?? null
  return type && typer.has(type) ? type : null
}

// ── Isbre-navn ─────────────────────────────────────────────────────────────
// N50 Arealdekke bærer ingen navn på flatene, og en bre som Jostedalsbreen
// ville uansett fått ETT navn der kartet trenger armenes — Nigardsbreen,
// Briksdalsbreen, Austdalsbreen. Navnene er derfor PUNKTER, ikke flate-tagger,
// og de hentes fra det stedsnavn-laget N50-leveransen måtte ha.
//
// Vi vet ikke sikkert at laget finnes (Geonorge er blokkert fra utviklings-
// sandkassene), så hele passet er best-effort og logger hva det SÅ. Finner den
// ingenting, står isbre-navnene igjen på OSM alene — som dekker de store
// breene godt, og som `arealMerge` bevisst lar overleve N50-undertrykkingen.
// Alle tre er BEKREFTET mot ekte N50 (kjøring 32940204199), ikke gjettet:
//   laget heter `N50_Stedsnavn_tekstplassering` (en annotasjons-tabell),
//   navnet står i `streng`, og typen i `navneobjekttype` med SMÅ forbokstaver
//   («tjern», «ås», «fjell», «myr»).
//
// `objtype` er BEVISST IKKE en type-kandidat, selv om feltet finnes: på det
// laget er verdien «PresentasjonTekst» for titusener av rader, og med objtype
// i lista ville diagnose-logga vist den i stedet for de faktiske navnetypene —
// altså skjult nøyaktig det den finnes for å vise.
const NAVN_LAG = /(stedsnavn|navn)/i
const NAVN_FELT = ['streng', 'fulltekst', 'navn', 'name', 'stedsnavn']
const TYPE_FELT = ['navneobjekttype', 'navnetype', 'navneobjektgruppe']
const ER_BRENAVN = /(isbre|^bre$|bre$|fonn|jøkul|jokul|skavl)/i

export function erBreNavnType(verdi) {
  return ER_BRENAVN.test(String(verdi ?? '').trim())
}

function forsteFelt(props, kandidater) {
  const nøkler = Object.keys(props ?? {})
  for (const k of kandidater) {
    const treff = nøkler.find(n => n.toLowerCase() === k)
    if (treff && String(props[treff] ?? '').trim()) return String(props[treff]).trim()
  }
  return ''
}

async function lesIsbreNavn(kilde, dir) {
  const lag = lagNavn(kilde, NAVN_LAG)
  if (!lag.length) return []
  const ut = []
  for (const l of lag) {
    log(`    navnelag ${l}: ${feltNavn(kilde, l).join(', ') || '(ingen felter lest)'}`)
    const utfil = join(dir, `navn_${l.replace(/[^\w]/g, '_')}.geojsonl`)
    try {
      execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', utfil, kilde, l,
        '-t_srs', 'EPSG:4326', '-nlt', 'POINT'], { stdio: 'pipe' })
    } catch (e) {
      log(`    ⚠ ${l} lot seg ikke lese som punkt: ${String(e.message).split('\n')[0]}`)
      continue
    }
    const typeTall = new Map()
    const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
    for await (const rad of rl) {
      if (!rad.trim()) continue
      let f
      try { f = JSON.parse(rad) } catch { continue }
      const type = forsteFelt(f.properties, TYPE_FELT)
      typeTall.set(type || '(tom)', (typeTall.get(type || '(tom)') ?? 0) + 1)
      if (!erBreNavnType(type)) continue
      const navn = forsteFelt(f.properties, NAVN_FELT)
      const k = f.geometry?.coordinates
      if (!navn || !Array.isArray(k) || !Number.isFinite(k[0]) || !Number.isFinite(k[1])) continue
      ut.push({ navn, lat: Math.round(k[1] * 1e5) / 1e5, lon: Math.round(k[0] * 1e5) / 1e5 })
    }
    rmSync(utfil, { force: true })
    const topp = [...typeTall.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    log(`    navnetyper: ${topp.map(([k, v]) => `${k}=${v}`).join(', ') || '(ingen)'}`)
  }
  return ut
}

/** Ring fra GeoJSON-koordinater. Lukkepunktet dropppes — det er implisitt. */
function tilRing(koord) {
  const ut = []
  for (const [lon, lat] of koord ?? []) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    ut.push({ lat, lon })
  }
  if (ut.length >= 2) {
    const a = ut[0], b = ut[ut.length - 1]
    if (Math.abs(a.lat - b.lat) < 1e-12 && Math.abs(a.lon - b.lon) < 1e-12) ut.pop()
  }
  return ut
}

/**
 * Les arealflatene i én kilde. Forenkler STRØMMENDE, per flate.
 *
 * Rekkefølgen her er ikke stil, den er minne. Fram til v5.26.0 samlet denne
 * funksjonen RÅ ringer for hele fylket og lot kalleren forenkle etterpå. Det
 * holdt så vidt for myr alene; med skog i tillegg døde runneren midt i Finnmark
 * (522 MB kilde) etter fire minutter — og GitHubs API meldte «in_progress» i
 * halvannen time etter at den var borte, så feilen så ut som en treg jobb.
 *
 * Et `{lat, lon}`-objekt koster 50–80 byte i V8 mot 16 byte data. Douglas-
 * Peucker på 8 m fjerner mesteparten av punktene i en skogkant, så å forenkle
 * FØR flata legges i lista er forskjellen på å holde de rå ringene og å holde
 * de ferdige. Toppen ligger da på én flate om gangen, ikke på ett fylke.
 */
async function lesFlater(kilde, dir, stats) {
  // DIAGNOSTIKK FØRST. Første kjøring (32814994570) lastet ned 166 MB Buskerud
  // og fant 0 myrflater, fordi lag-filteret var GJETTET: /arealdekke.*flate/i.
  // Vi logger derfor ALLE lagnavn og hele objtype-fordelingen — samme grep som
  // sti-målingen brukte da den fant ut at feltet het `typeveg`. Et script som
  // bare sier «0» er ubrukelig; ett som sier hva det SÅ, løser saken på én
  // kjøring til.
  const alleLag = lagNavn(kilde, /./)
  const lag = lagNavn(kilde, /arealdekke.*(omrade|område|flate|polygon)/i)
  if (!lag.length) {
    log(`    ⚠ ingen arealdekke-flatelag. Lag i kilden:\n      ${alleLag.join('\n      ')}`)
    return []
  }
  log(`    arealdekke-lag: ${lag.join(', ')}`)
  const flater = []
  const objtypeTall = new Map()
  for (const l of lag) {
    // Feltlista er fasit på om flatene i det hele tatt KAN bære et navn. Den
    // koster ett ogrinfo-kall og svarer på et spørsmål vi ellers måtte gjette
    // på: må isbre-navnene komme fra et eget stedsnavn-lag, eller står de her?
    log(`    felter: ${feltNavn(kilde, l).join(', ') || '(ingen felter lest)'}`)
    // Skriv til fil og les strømmende: landsdekkende GeoJSONSeq er flere
    // hundre MB, og en stdout-buffer måtte holdt alt som ÉN streng.
    const utfil = join(dir, `${l.replace(/[^\w]/g, '_')}.geojsonl`)
    execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', utfil, kilde, l,
      '-t_srs', 'EPSG:4326', '-nlt', 'MULTIPOLYGON'], { stdio: 'pipe' })
    const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
    for await (const rad of rl) {
      if (!rad.trim()) continue
      let f
      try { f = JSON.parse(rad) } catch { continue }
      const rå = String(f.properties?.objtype ?? '(mangler)')
      objtypeTall.set(rå, (objtypeTall.get(rå) ?? 0) + 1)
      const type = klassifiser(f.properties)
      if (!type || !f.geometry) continue
      const polygoner = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates
        : f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : []
      for (const p of polygoner) {
        const rå = p.map(tilRing).filter(r => r.length >= 3)
        if (!rå.length) continue
        const stat = stats[type]
        const areal = arealM2(rå[0])
        if (areal < MIN_AREAL[type]) { stat.forkastet++; continue }
        const ringer = forenkleRinger(rå, TOLERANSE[type])
        // Forenklingen kan spise en ring under tre punkter — da er den ikke en
        // flate lenger.
        if (!ringer.length) { stat.forkastet++; continue }
        stat.km2 += areal / 1e6
        stat.n++
        flater.push({ type, ringer })
      }
    }
    rmSync(utfil, { force: true })
  }
  // Fordelingen er FASIT på klassifiseringen: står «Myr» der, eller heter den
  // noe annet? Uten denne linja måtte vi gjettet en gang til.
  const topp = [...objtypeTall.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  log(`    objtype: ${topp.map(([k, v]) => `${k}=${v}`).join(', ') || '(ingen features lest)'}`)
  return flater
}

// ── Kjør ───────────────────────────────────────────────────────────────────

if (import.meta.url === (process.argv[1] ? `file://${process.argv[1]}` : '')) {
  const dir = mkdtempSync(join(tmpdir(), 'n50areal-'))
  try {
    krevGdal()
    const { omrader, formater, projeksjoner } = await finnOmrader()
    const fylker = FYLKE
      ? omrader.filter(o => o.code === FYLKE)
      : omrader.filter(o => o.type === 'fylke')
    if (!fylker.length) throw new Error(`Fant ingen områder (--fylke ${FYLKE})`)
    const valgte = [...TYPER_VALGT]
    log(`${BARE_MAL ? 'MÅLER' : 'Bygger'} N50-arealdekke for ${fylker.length} fylke(r)`)
    for (const t of valgte) log(`  ${t}: ${TOLERANSE[t]} m forenkling, minste flate ${MIN_AREAL[t]} m²`)
    log('')

    // Akkumuler per flis over ALLE fylker før vi skriver: en flis som krysser
    // en fylkesgrense må få innhold fra begge sider i SAMME fil, ellers ville
    // fylke nr. 2 overskrevet fylke nr. 1.
    const fliser = new Map()
    const perType = Object.fromEntries(valgte.map(t => [t, { n: 0, km2: 0, forkastet: 0 }]))
    const breNavn = new Map()
    let feilet = 0

    for (const [i, omrade] of fylker.entries()) {
      const kort = String(omrade.name).split(/\s+[–—-]\s+/)[0]
      log(`[${i + 1}/${fylker.length}] ${kort}`)
      const fdir = mkdtempSync(join(dir, 'f-'))
      try {
        const { format, proj } = velgFormat(omrade, formater, projeksjoner)
        const kilder = finnGdb(await lastNed(omrade, format, proj, fdir, log))
        if (!kilder.length) throw new Error('ingen lesbar kilde i nedlastingen')
        let n = 0
        for (const kilde of kilder) {
          for (const flate of await lesFlater(kilde, fdir, perType)) {
            n++
            for (const nokkel of fliserForFlate(flate.ringer)) {
              let f = fliser.get(nokkel)
              if (!f) fliser.set(nokkel, (f = []))
              f.push(flate)
            }
          }
          if (TYPER_VALGT.has('isbre')) {
            for (const p of await lesIsbreNavn(kilde, fdir)) {
              // Samme navn på samme sted fra to fylkesfiler er ÉN bre — grensa
              // går tvers gjennom flere av dem (Folgefonna, Svartisen).
              breNavn.set(`${p.navn}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`, p)
            }
          }
        }
        log(`    ${n.toLocaleString('no')} flater beholdt`)
      } catch (e) {
        feilet++
        log(`    ⚠ ${kort} feilet: ${e.message}`)
      } finally {
        rmSync(fdir, { recursive: true, force: true })
      }
    }

    // ── Rapport ────────────────────────────────────────────────────────────
    let bytes = 0, storst = 0, storstNokkel = ''
    const pakket = new Map()
    for (const [nokkel, flater] of fliser) {
      const b = kodeFlis(flater)
      pakket.set(nokkel, b)
      bytes += b.length
      if (b.length > storst) { storst = b.length; storstNokkel = nokkel }
    }
    const gz = gzipSync(Buffer.concat([...pakket.values()].map(Buffer.from))).length
    const flaterTotal = valgte.reduce((s, t) => s + perType[t].n, 0)
    const navnListe = [...breNavn.values()].sort((a, b) => a.navn.localeCompare(b.navn, 'no'))

    log('')
    log('── N50-arealdekke ─────────────────────────')
    for (const t of valgte) {
      const s = perType[t]
      log(`  ${t.padEnd(6)} ${s.n.toLocaleString('no').padStart(9)} flater, `
        + `${Math.round(s.km2).toLocaleString('no').padStart(7)} km², `
        + `${s.forkastet.toLocaleString('no')} forkastet (< ${MIN_AREAL[t]} m² eller kollapset)`)
    }
    log(`  ${fliser.size} fliser, ${(bytes / 1e6).toFixed(1)} MB på disk (${(gz / 1e6).toFixed(1)} MB gzip)`)
    log(`  største flis ${(storst / 1e3).toFixed(0)} KB (${storstNokkel}) — det appen laster per kartrute`)
    if (TYPER_VALGT.has('isbre')) log(`  ${navnListe.length} isbre-navn`)
    if (feilet) log(`  ⚠ ${feilet} fylke(r) feilet`)

    if (BARE_MAL) {
      log('\n  --mal: ingenting er skrevet. Les tallene og bestem arkitekturen.')
    } else {
      mkdirSync(UT_KATALOG, { recursive: true })
      for (const f of readdirSync(UT_KATALOG)) {
        if (/\.bin$/.test(f) || f === 'manifest.json' || f === NAVN_FIL) {
          rmSync(join(UT_KATALOG, f), { force: true })
        }
      }
      for (const [nokkel, b] of pakket) writeFileSync(join(UT_KATALOG, `${nokkel}.bin`), b)
      if (navnListe.length) writeFileSync(join(UT_KATALOG, NAVN_FIL), JSON.stringify(navnListe))
      writeFileSync(join(UT_KATALOG, 'manifest.json'), JSON.stringify({
        versjon: VERSJON,
        // Skruene er PER TYPE. Ett tall her ville løyet om en bake der myra er
        // finere generalisert enn skogen, som er hele grunnen til at de finnes.
        toleranseM: Object.fromEntries(valgte.map(t => [t, TOLERANSE[t]])),
        minArealM2: Object.fromEntries(valgte.map(t => [t, MIN_AREAL[t]])),
        // Hvilke typer flisene faktisk bærer. Uten dette kan ikke klienten
        // skille «ingen skog i dette området» fra «skog er ikke bakt ennå»,
        // og arealMerge ville undertrykt OSM-skogen på et tomt grunnlag.
        typer: valgte.slice().sort(),
        // Om navnefila finnes. Klienten spør bare etter den når den gjør —
        // ellers ville hvert eneste kart betalt en 404 for å finne det ut.
        isbreNavn: navnListe.length,
        fliser: [...pakket.keys()].sort(),
      }))
      log(`\n  Skrev ${pakket.size} fliser${navnListe.length ? ` + ${navnListe.length} isbre-navn` : ''} til public/data/n50-areal/`)
    }
    if (feilet && feilet === fylker.length) process.exit(1)
    // En gate som ikke kan feile er verre enn ingen gate. Første kjøring
    // lastet ned 166 MB, fant 0 flater og meldte «success» — nøyaktig den
    // stillheten som lot MCP-Workeren bygge kart uten stinett i atten
    // versjoner. Lastet vi ned noe uten å finne én eneste flate, er det feil.
    if (!flaterTotal && feilet < fylker.length) {
      log('\n✗ Null flater fra en vellykket nedlasting — se lag- og objtype-linjene over.')
      process.exit(1)
    }
    // Samme gate, per type: en bake som ble BEDT om skog og kom tilbake med
    // null skogflater har enten bommet på objtype-navnet eller filtrert bort
    // alt. Begge deler er feil, og begge ville ellers gått gjennom som
    // «success» med et manifest som lover en type flisene ikke har.
    const tomme = valgte.filter(t => perType[t].n === 0)
    if (tomme.length && feilet < fylker.length) {
      log(`\n✗ Null flater for ${tomme.join(', ')} — se objtype-linjene over for hva kilden faktisk heter.`)
      process.exit(1)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
