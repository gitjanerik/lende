#!/usr/bin/env node
// Baker N50-stinettet til statiske fliser i public/data/n50-sti/.
//
// ── Hvorfor dette finnes ───────────────────────────────────────────────────
// OSM er tynt i norsk utmark: målt på Trettekollen (Drammens høyeste punkt)
// ligger nærmeste OSM-linje 478 m fra toppen, mens N50 har et fullt stinett.
// Turrutebasen (v5.0.2) tok de MERKEDE rutene, men ikke resten. N50 Samferdsel
// har ingen live WFS, så dataene må bakes én gang og serveres selv.
//
// Faktisk bake (kjøring 31314795103) over alle fylker:
//   179 706 km sti/traktorveg → 208 fliser, 12 MB på disk (9,7 MB gzip) ved
//   3 m forenkling. Største enkeltflis 356 KB — det appen laster per kartrute.
//   (Landsmålingen 31312847690 anslo 200 KB fra et utvalg; baken ble større.)
// Det er godt under det som trenger egen lagring, derfor statiske filer ved
// siden av appen: ingen R2, ingen worker, ingen hemmeligheter, og service
// worker-en cacher flisene offline på kjøpet.
//
// Kjøres MANUELT (workflow_dispatch). N50-stier er stabile data — Kartverket
// publiserer ukentlig, men et stinett flytter seg ikke, og OSM (som hentes
// live ved hver kart-bygging) er det som fanger opp nye stier raskt.
//
// Kjør:  node scripts/bygg-n50-sti.mjs [--fylke 33] [--toleranse 3]

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, createReadStream,
} from 'node:fs'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { forenkleLinje, kodeFlis, delPaaFliser, lengdeM, VERSJON } from '../src/lib/n50StiPakke.js'
// Nedlastings-maskineriet er delt med myr-baken (v5.24.0). Alt der er
// dyrekjøpt: hvilket format et område faktisk har, hvordan Geonorge staver
// fylkesnavn, og at ordre-API-et er et tomt skall. Det skal ikke ha to kopier.
import {
  finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, krevGdal, filnavnKandidater,
} from './geonorgeN50.mjs'

export { filnavnKandidater }

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const FYLKE = argVal('--fylke')
const TOLERANSE = Number(argVal('--toleranse') ?? 3)

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT_KATALOG = join(ROT, 'public', 'data', 'n50-sti')


const log = (...a) => console.log(...a)

// Klassifisering. N50 har INGEN «Sti»-objekttype — alt er `Veglenke`, og sti
// skilles ut på attributtet `typeveg` (bekreftet i CI: Buskerud har
// sti=17568, traktorveg=8531, enkelBilveg=62271). `gangOgSykkelveg` holdes
// UTE, samme linje som symbolizer trekker for OSM footway/cycleway (v8.9.24).
const TYPEVEG = { sti: 'sti', traktorveg: 'traktorveg', barmarksløype: 'barmarksloype', barmarksloype: 'barmarksloype' }

export function klassifiser(props) {
  const t = String(props?.typeveg ?? '').trim().toLowerCase()
  const type = TYPEVEG[t]
  if (!type) return null
  // `rutemerking` er JA/NEI i N50 (Buskerud: JA=5908, NEI=11660) og er
  // nøyaktig skillet mellom ISOM 506 (merket) og 507 (umerket).
  const merket = String(props?.rutemerking ?? '').trim().toUpperCase() === 'JA'
  return { type, merket }
}

async function lesStier(kilde, dir) {
  const lag = lagNavn(kilde, /samferdsel.*senterlinje/i)
  const linjer = []
  for (const l of lag) {
    // Skriv til fil og les strømmende: landsdekkende GeoJSONSeq er flere
    // hundre MB, og en stdout-buffer måtte holdt alt som ÉN streng.
    const utfil = join(dir, `${l.replace(/[^\w]/g, '_')}.geojsonl`)
    execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', utfil, kilde, l,
      '-t_srs', 'EPSG:4326', '-nlt', 'MULTILINESTRING'], { stdio: 'pipe' })
    const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
    for await (const rad of rl) {
      if (!rad.trim()) continue
      let f
      try { f = JSON.parse(rad) } catch { continue }
      const k = klassifiser(f.properties)
      if (!k || !f.geometry) continue
      const deler = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates
        : f.geometry.type === 'LineString' ? [f.geometry.coordinates] : []
      for (const d of deler) {
        if (d.length < 2) continue
        linjer.push({ ...k, geometry: d.map(([lon, lat]) => ({ lat, lon })) })
      }
    }
    rmSync(utfil, { force: true })
  }
  return linjer
}

// ── Kjør ───────────────────────────────────────────────────────────────────

if (import.meta.url === (process.argv[1] ? `file://${process.argv[1]}` : '')) {
  const dir = mkdtempSync(join(tmpdir(), 'n50bygg-'))
  try {
    krevGdal()
    const { omrader, formater, projeksjoner } = await finnOmrader()
    const fylker = FYLKE
      ? omrader.filter(o => o.code === FYLKE)
      : omrader.filter(o => o.type === 'fylke')
    if (!fylker.length) throw new Error(`Fant ingen områder (--fylke ${FYLKE})`)
    log(`Bygger N50-sti for ${fylker.length} fylke(r), ${TOLERANSE} m forenkling\n`)

    // Akkumuler per flis over ALLE fylker før vi skriver: en flis som krysser
    // en fylkesgrense må få innhold fra begge sider i SAMME fil, ellers ville
    // fylke nr. 2 overskrevet fylke nr. 1.
    const fliser = new Map()
    let kmTotal = 0, linjerTotal = 0, feilet = 0

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
          for (const linje of await lesStier(kilde, fdir)) {
            const g = forenkleLinje(linje.geometry, TOLERANSE)
            if (g.length < 2) continue
            kmTotal += lengdeM(g) / 1000
            n++
            for (const d of delPaaFliser({ ...linje, geometry: g })) {
              let f = fliser.get(d.nokkel)
              if (!f) fliser.set(d.nokkel, (f = []))
              f.push(d)
            }
          }
        }
        linjerTotal += n
        log(`    ${n.toLocaleString('no')} stilinjer`)
      } catch (e) {
        feilet++
        console.error(`    FEIL: ${e.message.split('\n')[0]}`)
      } finally {
        rmSync(fdir, { recursive: true, force: true })
      }
    }

    if (feilet) {
      console.error(`\n${feilet} av ${fylker.length} fylker feilet — skriver IKKE ufullstendige fliser.`)
      process.exit(1)
    }
    if (!fliser.size) throw new Error('ingen fliser å skrive')

    rmSync(UT_KATALOG, { recursive: true, force: true })
    mkdirSync(UT_KATALOG, { recursive: true })
    let bytes = 0, storst = 0
    const nokler = [...fliser.keys()].sort()
    for (const nokkel of nokler) {
      const pakket = kodeFlis(fliser.get(nokkel))
      writeFileSync(join(UT_KATALOG, `${nokkel}.bin`), pakket)
      bytes += pakket.length
      if (pakket.length > storst) storst = pakket.length
    }
    // Manifestet lar klienten vite hvilke fliser som FINNES, så den slipper å
    // be om fliser over hav og utland og få 404 i konsollen for hvert kart.
    writeFileSync(join(UT_KATALOG, 'manifest.json'), JSON.stringify({
      versjon: VERSJON, toleranseM: TOLERANSE, fliser: nokler,
    }))

    log(`\n${linjerTotal.toLocaleString('no')} stilinjer · ${Math.round(kmTotal).toLocaleString('no')} km`)
    log(`${nokler.length} fliser · ${(bytes / 1e6).toFixed(1)} MB · største ${(storst / 1024).toFixed(0)} KB`)
    log(`→ ${UT_KATALOG}`)
  } catch (e) {
    console.error(`\nFEILET: ${e.message}`)
    process.exit(1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
