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
// ── Vegene (fase 1 av docs/PLAN_OSM_UAVHENGIG.md) ───────────────────────────
// `--lag veg` baker bilveger og jernbane fra SAMME lag til en EGEN katalog,
// public/data/n50-veg/. Egen katalog av samme grunn som n50-vann: manifestet
// er klientens cache-nøkkel, og en bake som skrev veger inn i n50-sti/ ville
// sendt hver bruker ut i full nedlasting av et stinett som ikke hadde endret
// seg. Vegene brukes bare i N50-arket (kartet før OSM er inne) — OSM er
// autoritativ for veger, så de blandes ikke inn i det ferdige arket.
//
// Attributtene er målt i CI (kjøring 43561057253, Buskerud):
//   vegkategori: P=42628, K=11042, F=7057, R=1067, E=642
//   medium: T=88990, L=859 (bru), U=170 (tunnel), B=7
//   vegfase: V=62435   · Bane: anleggstype J=450/M=17, banestatus I=390/N=77
//
// `--mal` måler uten å skrive: kjør den FØRST, størrelsen avgjør om baken kan
// ligge i git.
//
// Kjør:  node scripts/bygg-n50-sti.mjs [--lag sti|veg] [--fylke 33] [--toleranse 3] [--mal]

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, createReadStream,
} from 'node:fs'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { gzipSync } from 'node:zlib'
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
const LAG = argVal('--lag') ?? 'sti'
const MAL = args.includes('--mal')
if (!['sti', 'veg'].includes(LAG)) {
  console.error(`Ukjent --lag ${LAG} (sti eller veg)`)
  process.exit(1)
}

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT_KATALOG = join(ROT, 'public', 'data', LAG === 'veg' ? 'n50-veg' : 'n50-sti')


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

// Bilveg per vegkategori. S (skogsbilveg) og ukjente kategorier regnes som
// privat veg — det er den svakeste veg-klassen vi tegner.
const VEGKATEGORI = { E: 'veg-e', R: 'veg-r', F: 'veg-f', K: 'veg-k', P: 'veg-p' }
const BILVEG = new Set(['enkelbilveg', 'kanalisertveg', 'rampe', 'rundkjøring', 'rundkjoring'])

export function klassifiserVeg(props) {
  const objtype = String(props?.objtype ?? '').trim()
  const medium = String(props?.medium ?? '').trim().toUpperCase()
  const flagg = {}
  if (medium === 'U') flagg.tunnel = true
  if (medium === 'L') flagg.bru = true
  if (objtype === 'Bane') {
    // Bare jernbane i drift: M er ikke jernbane, og en nedlagt bane er ikke
    // noe man navigerer etter.
    const anlegg = String(props?.anleggstype ?? '').trim().toUpperCase()
    const status = String(props?.banestatus ?? '').trim().toUpperCase()
    if (anlegg !== 'J' || status !== 'I') return null
    return { type: 'bane', ...flagg }
  }
  const t = String(props?.typeveg ?? '').trim().toLowerCase()
  if (!BILVEG.has(t)) return null
  const fase = String(props?.vegfase ?? 'V').trim().toUpperCase()
  if (fase && fase !== 'V') return null
  const kat = String(props?.vegkategori ?? '').trim().toUpperCase()
  return { type: VEGKATEGORI[kat] ?? 'veg-p', ...flagg }
}

const KLASSIFISER = LAG === 'veg' ? klassifiserVeg : klassifiser

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
      const k = KLASSIFISER(f.properties)
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
    log(`Bygger N50-${LAG} for ${fylker.length} fylke(r), ${TOLERANSE} m forenkling${MAL ? ' (bare måling)' : ''}\n`)

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
        log(`    ${n.toLocaleString('no')} ${LAG}linjer`)
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

    if (!MAL) {
      rmSync(UT_KATALOG, { recursive: true, force: true })
      mkdirSync(UT_KATALOG, { recursive: true })
    }
    let bytes = 0, gzBytes = 0, storst = 0
    const nokler = [...fliser.keys()].sort()
    for (const nokkel of nokler) {
      // Vegene bærer tunnel/bru og bakes som v3; stiene er v2, byte-identisk.
      const pakket = kodeFlis(fliser.get(nokkel), { medFlagg: LAG === 'veg' })
      if (!MAL) writeFileSync(join(UT_KATALOG, `${nokkel}.bin`), pakket)
      bytes += pakket.length
      gzBytes += gzipSync(pakket).length
      if (pakket.length > storst) storst = pakket.length
    }
    if (MAL) {
      log(`\n${linjerTotal.toLocaleString('no')} ${LAG}linjer · ${Math.round(kmTotal).toLocaleString('no')} km`)
      log(`${nokler.length} fliser · ${(bytes / 1e6).toFixed(1)} MB (${(gzBytes / 1e6).toFixed(1)} MB gzip) · største ${(storst / 1024).toFixed(0)} KB`)
      log('--mal: ingenting skrevet')
      process.exit(0)
    }
    // Manifestet lar klienten vite hvilke fliser som FINNES, så den slipper å
    // be om fliser over hav og utland og få 404 i konsollen for hvert kart.
    writeFileSync(join(UT_KATALOG, 'manifest.json'), JSON.stringify({
      versjon: VERSJON, toleranseM: TOLERANSE, fliser: nokler,
    }))

    log(`\n${linjerTotal.toLocaleString('no')} ${LAG}linjer · ${Math.round(kmTotal).toLocaleString('no')} km`)
    log(`${nokler.length} fliser · ${(bytes / 1e6).toFixed(1)} MB (${(gzBytes / 1e6).toFixed(1)} MB gzip) · største ${(storst / 1024).toFixed(0)} KB`)
    log(`→ ${UT_KATALOG}`)
  } catch (e) {
    console.error(`\nFEILET: ${e.message}`)
    process.exit(1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
