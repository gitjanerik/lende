#!/usr/bin/env node
// Delt Geonorge-maskineri for N50-bakene.
//
// Trukket ut av bygg-n50-sti.mjs i v5.24.0, da myr-baken trengte NØYAKTIG
// samme nedlasting. Alt her er dyrekjøpt kunnskap som ikke skal finnes i to
// kopier: hvilket format et område faktisk har, hvordan Geonorge staver
// fylkesnavn, og at ordre-API-et er et tomt skall man skal la være å bruke.
// Kommentarene under er bevart fra sti-baken fordi de forklarer feil som
// kostet flere CI-kjøringer å finne.
//
// Inneholder INGEN domenekunnskap om hva som hentes ut av dataene — det eier
// hver bake selv (sti klassifiserer på `typeveg`, areal på `objtype`).

import { execFileSync } from 'node:child_process'
import { writeFileSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { navnevarianter } from './geonorgeNavn.mjs'

const KATALOG_SOK = 'https://kartkatalog.geonorge.no/api/search'
const NEDLASTING = 'https://nedlasting.geonorge.no/api'
const DIREKTE_BASE = 'https://nedlasting.geonorge.no/geonorge/Basisdata'
const HTTP_TIMEOUT_MS = 60000

async function hentJson(url, init = {}, timeoutMs = HTTP_TIMEOUT_MS) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const tekst = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}\n${tekst.slice(0, 800)}`)
  return JSON.parse(tekst)
}

export async function finnOmrader() {
  const d = await hentJson(`${KATALOG_SOK}?text=N50%20Kartdata&limit=20`)
  const ds = (d.Results ?? []).find(r => /^n50 kartdata$/i.test(r.Title ?? ''))
  if (!ds) throw new Error('Fant ikke N50 Kartdata i katalogen')
  const cap = await hentJson(`${NEDLASTING}/capabilities/${ds.Uuid}`)
  const lenke = (rel) => (cap._links ?? []).find(l => l.rel?.endsWith(rel))?.href
  const [omrader, formater, projeksjoner] = await Promise.all(
    ['area', 'format', 'projection'].map(r => hentJson(lenke(r))))
  return { omrader, formater, projeksjoner }
}

// Format og projeksjon MÅ velges fra områdets EGEN liste: den globale lista er
// unionen over alle 373 områder, og Buskerud har f.eks. verken GML eller SOSI.
// Å bestille et format området ikke har gir en ordre som aksepteres og aldri
// blir klar — fire CI-kjøringer gikk med på å finne det ut.
export function velgFormat(omrade, formater, projeksjoner) {
  const oF = omrade.formats?.length ? omrade.formats : formater
  const format = ['FGDB', 'GML', 'GeoPackage'].map(n =>
    oF.find(f => (f.name ?? '').toUpperCase() === n.toUpperCase())).find(Boolean)
  if (!format) throw new Error(`${omrade.name}: ingen lesbart format (har ${oF.map(f => f.name).join(', ')})`)
  const fP = format.projections?.length ? format.projections : projeksjoner
  const proj = fP.find(p => String(p.code) === '25833') ?? fP[0]
  return { format, proj }
}

// Geonorge staver fylkesnavn ulikt: «Vestland» går rett inn, mens
// «Trøndelag» og «Østfold» må translittereres. Vi prøver variantene i tur —
// første bake feilet nettopp fordi vi bare erstattet mellomrom.
export function filnavnKandidater(omrade, format, proj) {
  return navnevarianter(omrade.name).map(navn =>
    `${DIREKTE_BASE}/N50Kartdata/${format.name}/Basisdata_${omrade.code}_${navn}_${proj.code}_N50Kartdata_${format.name}.zip`)
}

export async function lastNed(omrade, format, proj, dir, log = console.log) {
  const kandidater = filnavnKandidater(omrade, format, proj)
  let res = null
  for (const url of kandidater) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20 * 60 * 1000) })
    if (r.ok) { res = r; break }
    // 404 = feil skrivemåte, prøv neste. Alt annet er en ekte feil.
    if (r.status !== 404) throw new Error(`HTTP ${r.status} for ${url}`)
  }
  if (!res) {
    throw new Error(`Ingen av ${kandidater.length} filnavn-varianter fantes:\n  ` +
      kandidater.map(u => u.split('/').pop()).join('\n  '))
  }
  const zip = join(dir, 'n50.zip')
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  log(`    ${(statSync(zip).size / 1e6).toFixed(0)} MB`)
  const ut = join(dir, 'utpakket')
  execFileSync('unzip', ['-q', '-o', zip, '-d', ut], { stdio: 'inherit' })
  rmSync(zip, { force: true })
  return ut
}

export function finnGdb(bane) {
  const ut = []
  const gaa = (p) => {
    if (!existsSync(p)) return
    if (statSync(p).isDirectory()) {
      if (/\.(gdb)$/i.test(p)) { ut.push(p); return }
      for (const n of readdirSync(p)) gaa(join(p, n))
    } else if (/\.(gml|gpkg)$/i.test(p)) ut.push(p)
  }
  gaa(bane)
  return ut
}

/** Lag-navn i en kilde som matcher et mønster. */
export function lagNavn(kilde, monster) {
  return execFileSync('ogrinfo', ['-so', '-al', kilde], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n').filter(l => /^Layer name:/.test(l))
    .map(l => l.replace('Layer name:', '').trim())
    .filter(n => monster.test(n))
}

export function krevGdal() {
  execFileSync('ogr2ogr', ['--version'], { stdio: 'pipe' })
}
