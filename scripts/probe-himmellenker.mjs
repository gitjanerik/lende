#!/usr/bin/env node
// Svarer hver eksterne lenke i himmelen? EN MÅLING, IKKE EN GATE.
//
// HVORFOR DEN FINNES: snl.no og no.wikipedia.org er sperret fra
// utviklingsmiljøene, så en lenke kan ikke prøves der den skrives. Jupiter sto på
// `snl.no/Jupiter_-_planet` i tre leveranser — mønsteret de fem andre planetene
// bruker — og var død hele veien. Ingenting i appen merker det: en pille som
// åpner en 404 ser helt lik ut som en som virker.
//
// Samme lærdom som himmelkartene (v6.3.0): når feilen bare finnes et sted du ikke
// kan se, bygg en måling framfor en hypotese.
//
// Skriver INGENTING. Rapporterer status per lenke og avslutter med 0 uansett —
// en PR om stjernebilder skal ikke blokkeres av at Wikipedia er nede i natt.
// LES UTSKRIFTEN: det er den eneste måten å oppdage en råtnet lenke.

import { HIMMEL_FAKTA } from '../src/lib/tour3d/himmelFakta.js'
import { STJERNEBILDE_INFO } from '../src/lib/tour3d/stjernebildeInfo.js'

// Wikipedia og SNL vil vite hvem som spør. Uten en identifiserende User-Agent
// svarer Wikimedia 400/403 — målt under himmelkart-proben.
const UA = 'LendeLenkeprobe/1.0 (https://github.com/gitjanerik/lende; turkart-app)'

// ALTERNATIVER: adresser vi IKKE har målt, men som kan være den riktige.
//
// Slik brukes den: står man med et tvetydig artikkelnavn, legg kandidatene her
// og la CI svare framfor å gjette. De prøves SAMMEN med den som er i bruk, og
// utskriften merker dem «kandidat:» så de ikke forveksles med en ekte lenke.
// Tøm lista igjen når spørsmålet er avgjort.
//
// Sola (v6.5.6) gikk gjennom nettopp dette — «Sola» er også en kommune i
// Rogaland — og svaret står nå i himmelFakta.js: snl.no/Sola er stjerna, og
// snl.no/Solen omdirigerer dit. Kandidatene er derfor tatt ut igjen.
const ALTERNATIVER = []

const lenker = []
for (const [id, f] of Object.entries(HIMMEL_FAKTA)) {
  if (f.snl) lenker.push({ hvor: `fakta:${id}`, felt: 'snl', url: f.snl })
  if (f.wikipedia) lenker.push({ hvor: `fakta:${id}`, felt: 'wikipedia', url: f.wikipedia })
}
for (const [id, i] of Object.entries(STJERNEBILDE_INFO)) {
  if (i.wikipedia) lenker.push({ hvor: `stjernebilde:${id}`, felt: 'wikipedia', url: i.wikipedia })
}

lenker.push(...ALTERNATIVER)

const pust = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Slå opp én lenke.
 *
 * GET og ikke HEAD: SNL svarer 405 på HEAD, og Wikipedia følger ikke omdirigering
 * likt for de to metodene. Vi leser ikke kroppen, bare statusen og hvor vi endte.
 *
 * EN OMDIRIGERING ER IKKE ET OK SVAR HER, og det er hele poenget: en tjeneste
 * sender et feilstavet artikkelnavn videre til en annen artikkel med 200. Vi
 * rapporterer derfor sluttadressen, så et stille bytte er synlig. Slik ble det
 * målt at snl.no/Solen egentlig er snl.no/Sola (v6.5.6).
 *
 * MERK GRENSA: dette fanger SNL, som bruker ekte HTTP-omdirigering, men ikke
 * MediaWiki — Wikipedia serverer en omdirigert artikkel som 200 på den adressen
 * man SPURTE om, med en «Omdirigert fra»-note i sida. En Wikipedia-lenke som
 * svarer ✓ her er altså bevist å FINNES og å peke på riktig emne, men ikke å
 * være det kanoniske artikkelnavnet. Det er godt nok til formålet: lenka er
 * veien videre for en leser, ikke en kilde vi siterer.
 */
async function slaOpp(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    return { status: res.status, endteI: res.url }
  } catch (e) {
    return { status: 0, feil: e?.message ?? String(e) }
  }
}

let ok = 0
let rare = 0
for (const l of lenker) {
  const r = await slaOpp(l.url)
  await pust(250)
  const flyttet = r.endteI && decodeURI(r.endteI) !== decodeURI(l.url)
  const bra = r.status >= 200 && r.status < 300 && !flyttet
  if (bra) ok++
  else rare++
  process.stdout.write(
    `${bra ? '✓' : '✗'} ${String(r.status).padStart(3)}  ${l.hvor} (${l.felt})\n`
    + `        ${l.url}\n`
    + (flyttet ? `        → endte i: ${r.endteI}\n` : '')
    + (r.feil ? `        ${r.feil}\n` : ''),
  )
}

process.stdout.write(
  `\n${ok} av ${lenker.length} lenker svarte 2xx på sin egen adresse.\n`
  + 'MERK: «kandidat:»-linjene er IKKE i bruk i appen — de er alternativer til en\n'
  + 'lenke vi ikke har målt ennå. Svarer en av dem der den brukte lenka ikke gjør\n'
  + 'det, er det den som skal inn i himmelFakta.js.\n'
  + (rare
    ? `${rare} gjorde det IKKE — se ✗-linjene over. En omdirigering teller som `
      + 'avvik: Wikipedia sender et feil artikkelnavn videre med 200, og da er '
      + 'lenka gal selv om den «virker».\n'
    : 'Ingen avvik.\n'),
)
