#!/usr/bin/env node
// Cache-nøkkelen for det bygde Vardåsen-kartet i røyktesten.
//
// HVORFOR EN NØKKEL OG IKKE BARE «cache kartet»: kartet er en REN FUNKSJON av
// kart-pipelinen (`src/lib`) og byggeskriptet. Cacher man det uten å binde
// nøkkelen til de filene, kjører røyktesten mot et kart som er bygget av kode
// som ikke lenger finnes — og de sju ektekart-sjekkene blir grønne på et ark de
// ikke lenger beskriver. Det er nøyaktig samme felle som `--hoppbygg` i
// røyk-skriptet finnes for å unngå: en sikkerhetsnett som tester gammel kode er
// verre enn ingen.
//
// HVA SOM ER UTE, og hvorfor det er poenget: `src/lib/tour3d/**` er
// 3D-MOTOREN. Den leser kartet, den lager det ikke — ingen linje der kan endre
// en eneste piksel i SVG-en. Og det er nettopp 3D-PR-ene som trenger et ekte
// kart (de ni ektekart-sjekkene er i hovedsak 3D), så det er der cachen betyr
// noe. En nøkkel som tok med tour3d ville bommet på hver eneste kjøring som
// faktisk hadde nytte av den.
//
// Testene er ute av samme grunn: de kjører ikke i byggingen.
//
// `package-lock.json` er MED, men UTEN appens egen versjon — og det er ikke en
// detalj. `polygon-clipping` er eneste tredjeparts geometri-bibliotek, og en
// bump der kan flytte en kystlinje, så avhengighetstreet hører hjemme i
// nøkkelen. Men lockfila bærer også appens `version`, og prosjektet bumper den
// i HVER PR (se CLAUDE.md). Tar man fila rå, endrer nøkkelen seg hver gang og
// cachen treffer ALDRI — den ville vært ren pynt. Dette ble målt i den PR-en som
// innførte cachen: samme filtall, ny hash, uten at én kartkilde var rørt.
//
// Bruk:  node scripts/kartcache-nokkel.mjs
// Skriver én linje: nøkkelen.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// Salt. Bumpes for å tvinge fram en ny bake uten å røre en kildefil — f.eks.
// hvis en kilde har endret seg hos Kartverket og vi vil ha ferske data.
export const NOKKEL_VERSJON = 1

/**
 * Filene kartet bygges AV, målt på innhold (blob-SHA). `package-lock.json` er
 * IKKE her — den går sin egen vei gjennom `laasDigest`, fordi appens egen
 * versjon må ut av den først.
 */
export const KILDER = [
  /^scripts\/build-vardasen-svg\.js$/,
  /^src\/lib\//,
]

/** Unntakene inne i `src/lib` — se filhodet. */
export const UNNTAK = [
  /^src\/lib\/tour3d\//,
  /\.test\.js$/,
]

/** @param {string} fil repo-relativ sti */
export function erKartKilde(fil) {
  if (!fil) return false
  if (UNNTAK.some((r) => r.test(fil))) return false
  return KILDER.some((r) => r.test(fil))
}

/**
 * Avhengighetstreet i package-lock, uten appens egen versjon.
 *
 * `version` står to steder — på rota og på selve pakken (`packages[""]`) — og
 * begge bumpes av en vanlig utgivelse. Alt annet i fila er avhengigheter, som
 * er det vi faktisk vil at nøkkelen skal følge.
 *
 * Ugyldig eller manglende fil → tom streng. Nøkkelen blir da svakere, ikke gal:
 * kart-kildene bærer den fortsatt.
 *
 * @param {string} tekst innholdet i package-lock.json
 * @returns {string}
 */
export function laasDigest(tekst) {
  if (!tekst) return ''
  let obj
  try { obj = JSON.parse(tekst) } catch { return '' }
  if (!obj || typeof obj !== 'object') return ''
  delete obj.version
  if (obj.packages && obj.packages['']) delete obj.packages[''].version
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16)
}

/**
 * Nøkkel fra `git ls-files -s`-linjer («100644 <blob-sha> 0\tsti»).
 *
 * Blob-SHA-en er innholdet, så nøkkelen endrer seg nøyaktig når en kildefil
 * gjør det — ikke når en commit gjør det. Linjene SORTERES: `git ls-files` er
 * sortert i dag, men en nøkkel som avhenger av rekkefølgen ville bommet stille
 * den dagen det ikke er sant lenger.
 *
 * @param {string[]} linjer
 * @returns {string}
 */
export function nokkelFra(linjer, laas = '') {
  const rader = []
  for (const linje of linjer) {
    const delt = linje.split('\t')
    if (delt.length < 2) continue
    const fil = delt.slice(1).join('\t').trim()
    if (!erKartKilde(fil)) continue
    const sha = delt[0].trim().split(/\s+/)[1]
    if (sha) rader.push(`${sha} ${fil}`)
  }
  rader.sort()
  const sum = createHash('sha256')
    .update(rader.join('\n'))
    .update(`\nlaas:${laas}`)
    .digest('hex').slice(0, 16)
  return `royk-vardasen-v${NOKKEL_VERSJON}-${rader.length}-${sum}`
}

const kjørtDirekte = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (kjørtDirekte) {
  const ut = execFileSync('git', ['ls-files', '-s', '--', 'scripts', 'src/lib'],
    { encoding: 'utf8' })
  let laas = ''
  try { laas = laasDigest(readFileSync('package-lock.json', 'utf8')) } catch { /* uten lås */ }
  console.log(nokkelFra(ut.split('\n'), laas))
}
