#!/usr/bin/env node
// Baker N50 arealdekke-FLATER (myr) til statiske fliser i public/data/n50-areal/.
//
// ── Hvorfor dette finnes ───────────────────────────────────────────────────
// Samme diagnose som stinettet, bare for arealdekke: OSM er tynt i norsk
// utmark. Ved Briskemyrputten i Drammensmarka viser UT.no en myr som dekker
// det meste av utsnittet — OSM har ingenting, og Lende tegnet bare selve
// putten. N50 har myra, men ingen live WFS, så den bakes én gang og serveres
// som filer ved siden av appen.
//
// ── Størrelsen er hele spørsmålet ──────────────────────────────────────────
// Stinettet ble 12 MB over hele landet. Flater er tyngre enn linjer, og myr
// dekker ~9 % av Norge. Derfor har dette scriptet `--mal`: det laster ned,
// måler og RAPPORTERER uten å skrive noe. Kjør den først, les tallene, og
// bestem så om landsdekning kan ligge statisk i public/ eller må ha egen
// lagring. Det var nøyaktig denne rekkefølgen sti-baken brukte, og den
// sparte oss for en feilslått arkitektur.
//
// To skruer styrer størrelsen, og begge er trygge å dra i:
//   --toleranse  Douglas-Peucker i meter (standard 4). N50 er 1:50 000; på et
//                kart i 1:10 000 er 4 m = 0,4 mm.
//   --minareal   Minste myr vi bærer i m² (standard 2500). 2500 m² er 0,25 mm²
//                på trykk — under det datagrunnlaget selv skiller.
//
// Kjør:  node scripts/bygg-n50-areal.mjs [--fylke 33] [--toleranse 4]
//                                        [--minareal 2500] [--mal]

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, createReadStream, readdirSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
  kodeFlis, forenkleRinger, fliserForFlate, arealM2, VERSJON,
} from '../src/lib/n50ArealPakke.js'
import {
  finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, krevGdal,
} from './geonorgeN50.mjs'

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const FYLKE = argVal('--fylke')
const TOLERANSE = Number(argVal('--toleranse') ?? 4)
const MIN_AREAL = Number(argVal('--minareal') ?? 2500)
const BARE_MAL = args.includes('--mal')
// --typer myr,skog — hvilke objekttyper baken skal bære. Finnes for å kunne
// MÅLE én type av gangen: myr ble 57,9 MB nasjonalt, og skogens bidrag må
// kjennes før vi vet om alt kan ligge statisk i public/ eller trenger R2.
const TYPER_VALGT = new Set(
  (argVal('--typer') ?? 'myr').split(',').map(t => t.trim()).filter(Boolean))

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT_KATALOG = join(ROT, 'public', 'data', 'n50-areal')

const log = (...a) => console.log(...a)

// ── Klassifisering ─────────────────────────────────────────────────────────
// N50 Arealdekke har `objtype` per flate. Vi bærer FORELØPIG bare myr:
// skogen kommer fra Turkart-temaets grønne bakgrunn i dag (se CLAUDE.md), og
// å bake skog nå ville doblet datamengden for noe som allerede ser riktig ut.
// Formatet har plass til den (n50ArealPakke.TYPER), så dagen den skal inn er
// det en klassifiserings-endring og en ny bake — ikke et nytt filformat.
const OBJTYPE = {
  myr: 'myr',
  skog: 'skog',
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

async function lesFlater(kilde, dir) {
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
        const ringer = p.map(tilRing).filter(r => r.length >= 3)
        if (ringer.length) flater.push({ type, ringer })
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
    log(`${BARE_MAL ? 'MÅLER' : 'Bygger'} N50-arealdekke [${[...TYPER_VALGT].join(', ')}] `
      + `for ${fylker.length} fylke(r), ${TOLERANSE} m forenkling, `
      + `minste flate ${MIN_AREAL} m²\n`)

    // Akkumuler per flis over ALLE fylker før vi skriver: en flis som krysser
    // en fylkesgrense må få innhold fra begge sider i SAMME fil, ellers ville
    // fylke nr. 2 overskrevet fylke nr. 1.
    const fliser = new Map()
    let km2Total = 0, flaterTotal = 0, forkastet = 0, feilet = 0

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
          for (const flate of await lesFlater(kilde, fdir)) {
            const areal = arealM2(flate.ringer[0])
            if (areal < MIN_AREAL) { forkastet++; continue }
            const ringer = forenkleRinger(flate.ringer, TOLERANSE)
            if (!ringer.length) { forkastet++; continue }
            km2Total += areal / 1e6
            n++
            for (const nokkel of fliserForFlate(ringer)) {
              let f = fliser.get(nokkel)
              if (!f) fliser.set(nokkel, (f = []))
              f.push({ type: flate.type, ringer })
            }
          }
        }
        flaterTotal += n
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

    log('')
    log('── N50-myr ────────────────────────────────')
    log(`  ${flaterTotal.toLocaleString('no')} flater, ${Math.round(km2Total).toLocaleString('no')} km²`)
    log(`  ${forkastet.toLocaleString('no')} forkastet (< ${MIN_AREAL} m² eller kollapset)`)
    log(`  ${fliser.size} fliser, ${(bytes / 1e6).toFixed(1)} MB på disk (${(gz / 1e6).toFixed(1)} MB gzip)`)
    log(`  største flis ${(storst / 1e3).toFixed(0)} KB (${storstNokkel}) — det appen laster per kartrute`)
    if (feilet) log(`  ⚠ ${feilet} fylke(r) feilet`)

    if (BARE_MAL) {
      log('\n  --mal: ingenting er skrevet. Les tallene og bestem arkitekturen.')
    } else {
      mkdirSync(UT_KATALOG, { recursive: true })
      for (const f of readdirSync(UT_KATALOG)) {
        if (/\.bin$/.test(f) || f === 'manifest.json') rmSync(join(UT_KATALOG, f), { force: true })
      }
      for (const [nokkel, b] of pakket) writeFileSync(join(UT_KATALOG, `${nokkel}.bin`), b)
      writeFileSync(join(UT_KATALOG, 'manifest.json'), JSON.stringify({
        versjon: VERSJON, toleranseM: TOLERANSE, minArealM2: MIN_AREAL,
        // Hvilke typer flisene faktisk bærer. Uten dette kan ikke klienten
        // skille «ingen skog i dette området» fra «skog er ikke bakt ennå»,
        // og arealMerge ville undertrykt OSM-skogen på et tomt grunnlag.
        typer: [...TYPER_VALGT].sort(),
        fliser: [...pakket.keys()].sort(),
      }))
      log(`\n  Skrev ${pakket.size} fliser til public/data/n50-areal/`)
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
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
