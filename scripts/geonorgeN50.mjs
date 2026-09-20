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

// Datasettet er en PARAMETER fra v7.9.10, med N50 som standard. FKB-Vann går
// gjennom nøyaktig samme tre kall — katalogsøk, capabilities, så område-,
// format- og projeksjonsliste — og en egen kopi av dem ville vært den gjelden
// denne fila ble trukket ut for å unngå. Standarden gjør hvert N50-kallsted
// byte-identisk med før.
export async function finnOmrader(tittel = 'N50 Kartdata') {
  const d = await hentJson(`${KATALOG_SOK}?text=${encodeURIComponent(tittel)}&limit=20`)
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  const ds = (d.Results ?? []).find(r => norm(r.Title) === norm(tittel))
  if (!ds) {
    const sett = (d.Results ?? []).map(r => r.Title).slice(0, 20)
    throw new Error(`Fant ikke «${tittel}» i katalogen. Katalogen svarte med:\n  ${sett.join('\n  ') || '(ingenting)'}`)
  }
  const cap = await hentJson(`${NEDLASTING}/capabilities/${ds.Uuid}`)
  const lenke = (rel) => (cap._links ?? []).find(l => l.rel?.endsWith(rel))?.href
  const [omrader, formater, projeksjoner] = await Promise.all(
    ['area', 'format', 'projection'].map(r => hentJson(lenke(r))))
  // uuid og tittel følger med fordi en probe må kunne SI hva den fant. Å legge
  // til et felt er trygt: hvert kallsted destrukturerer de tre det trenger.
  return { omrader, formater, projeksjoner, uuid: ds.Uuid, tittel: ds.Title }
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
export function filnavnKandidater(omrade, format, proj, slug = 'N50Kartdata', base = DIREKTE_BASE) {
  return navnevarianter(omrade.name).map(navn =>
    `${base}/${slug}/${format.name}/Basisdata_${omrade.code}_${navn}_${proj.code}_${slug}_${format.name}.zip`)
}

// Geonorge legger ikke alt under /Basisdata: Geovekst-produserte datasett
// (FKB) har sin egen gren. Eksporteres slik at en probe kan krysse basene med
// slug-skrivemåter i stedet for å gjette ÉN URL — samme grunn som at
// `navnevarianter` finnes.
export const BASER = Object.freeze([DIREKTE_BASE, 'https://nedlasting.geonorge.no/geonorge/Geovekst'])

export async function lastNed(omrade, format, proj, dir, log = console.log, opts = {}) {
  // `kandidater` lar en kaller med et annet datasett bygge sin egen liste
  // (FKB krysser baser, slug-skrivemåter og projeksjoner). Uten den er
  // oppførselen nøyaktig som før.
  const kandidater = opts.kandidater ?? filnavnKandidater(omrade, format, proj)
  let res = null
  for (const url of kandidater) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20 * 60 * 1000) })
    if (r.ok) { res = r; opts.pa?.(url); break }
    // 404 = feil skrivemåte, prøv neste. Alt annet er en ekte feil.
    if (r.status !== 404) throw new Error(`HTTP ${r.status} for ${url}`)
  }
  if (!res) {
    throw new Error(`Ingen av ${kandidater.length} filnavn-varianter fantes:\n  ` +
      kandidater.map(u => u.split('/').pop()).join('\n  '))
  }
  const zip = join(dir, opts.zipNavn ?? 'n50.zip')
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

// Feltnavnene i ett lag. `ogrinfo -so` skriver dem som «navn: Type (bredde)».
//
// Finnes for å SLIPPE å gjette. Sti-baken brukte en CI-kjøring på å finne ut at
// feltet het `typeveg`, og areal-baken brukte en 166 MB nedlasting på å finne ut
// at laget het `N50_Arealdekke_omrade`. Et script som sier «0» er ubrukelig; ett
// som sier hva det SÅ, løser saken på neste kjøring.
export function feltNavn(kilde, lag) {
  try {
    return execFileSync('ogrinfo', ['-so', kilde, lag], { encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n')
      .map(l => l.match(/^([A-Za-zÆØÅæøå_][\wÆØÅæøå:.-]*):\s+(String|Integer64|Integer|Real|Date(?:Time)?|Binary)/))
      .filter(Boolean)
      .map(m => `${m[1]}:${m[2]}`)
  } catch { return [] }
}

export function krevGdal() {
  execFileSync('ogr2ogr', ['--version'], { stdio: 'pipe' })
}
