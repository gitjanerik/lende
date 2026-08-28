#!/usr/bin/env node
// Baker overflatekart for 3D-globene: public/data/{maane,mars,jupiter,saturn}.jpg
//
// HVORFOR ET BAKE-SKRIPT OG IKKE EN RUNTIME-HENTING: samme grunn som stjernene
// og N50-flisene. Kartene endrer seg aldri, og natthimmelen skal virke offline på
// et fjell. En globe som må laste ned et bilde for å vise Mars er ubrukelig
// nettopp der man står og ser på den.
//
// HVORFOR IKKE COMMITET FOR HÅND: lisensen. NASAs og USGS' bilder er offentlig
// eiendom, men en kopi funnet i et tilfeldig repo er ikke dokumentert som det.
// Skriptet henter fra kilden, så opphavet står i koden og ikke i hukommelsen.
//
// KJØRES I CI, IKKE HERFRA. Utviklingsmiljøet har en nettverkspolicy som sperrer
// både svs.gsfc.nasa.gov og planetarymaps.usgs.gov — bekreftet i proxy-loggen.
// Klarer skriptet ikke å hente et kart, skriver det INGENTING for det legemet og
// avslutter med 0: globen tegnes i legemets egenfarge (se himmellegemer.js), og
// en tom fil ville vært verre enn ingen fil. Ett legeme som feiler stopper ikke
// de andre.
//
// Bruk:
//   node scripts/bygg-himmelkart.mjs            # henter og skriver alle
//   node scripts/bygg-himmelkart.mjs --mal      # prøver kildene, skriver ikke
//   node scripts/bygg-himmelkart.mjs mars       # bare ett legeme

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Kildene, per legeme, i prioritert rekkefølge. Alle er offentlig eiendom
// (NASA/USGS). Equirektangulært, sentrert på lengdegrad 0 — som himmelGlobe
// forventer.
//
// Taket er lavt med vilje: bildene går i nettleser-bunten til alle brukere, og en
// globe tegnes maks en tredjedel av skjermen. ~1k bredde er rikelig.
const LEGEMER = {
  maane: [
    {
      navn: 'NASA SVS — CGI Moon Kit, fargekart 1k',
      url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
      lisens: 'NASA/GSFC/Arizona State University — offentlig eiendom',
    },
    {
      navn: 'USGS Astrogeology — LRO LROC WAC global mosaikk',
      url: 'https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.jpg',
      lisens: 'USGS/NASA — offentlig eiendom',
    },
  ],
  mars: [
    {
      navn: 'NASA SVS — Mars fargekart (MOLA + Viking)',
      url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/mars_1k_color.jpg',
      lisens: 'NASA/JPL/USGS — offentlig eiendom',
    },
    {
      navn: 'USGS Astrogeology — Viking MDIM 2.1 fargemosaikk',
      url: 'https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.jpg',
      lisens: 'USGS/NASA — offentlig eiendom',
    },
  ],
  jupiter: [
    {
      navn: 'NASA SVS — Jupiter sylindrisk kart (Cassini)',
      url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/jupiter_1k.jpg',
      lisens: 'NASA/JPL/Space Science Institute — offentlig eiendom',
    },
    {
      navn: 'NASA Photojournal — Cassini Jupiter-kart',
      url: 'https://photojournal.jpl.nasa.gov/jpeg/PIA07782.jpg',
      lisens: 'NASA/JPL/Space Science Institute — offentlig eiendom',
    },
  ],
  saturn: [
    {
      navn: 'NASA SVS — Saturn sylindrisk kart (Cassini)',
      url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/saturn_1k.jpg',
      lisens: 'NASA/JPL/Space Science Institute — offentlig eiendom',
    },
  ],
}

const MAKS_BYTES = 900 * 1024

// WIKIMEDIA KREVER EN IDENTIFISERENDE User-Agent. Uten den svarer de 400/403, og
// det var trolig hele grunnen til at første probe fikk 400 på hver eneste
// Commons-URL. Å oppgi hvem man er, er dessuten deres uttrykte vilkår.
const UA = 'LendeHimmelkart/1.0 (https://github.com/gitjanerik/lende; turkart-app)'
const hentJson = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * URL til en nedskalert utgave av en fil på Wikimedia Commons — REGNET UT.
 *
 * Sti-sharden er md5 av filnavnet (med understrek for mellomrom): første tegn, så
 * de to første. Beholdt fordi den er ren og testbar, men BRUK HELLER
 * `commonsThumb`: den spør Commons om URL-en i stedet for å gjette, og et
 * filnavn som ikke finnes er den svake lenken her. Første probe gjettet ti
 * filnavn og traff ingen.
 */
export function commonsUrl(filnavn, bredde = 1024) {
  const f = filnavn.replace(/ /g, '_')
  const h = createHash('md5').update(f).digest('hex')
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${f}/${bredde}px-${f}`
}

/**
 * SPØR Commons om en nedskalert utgave, framfor å gjette URL-en.
 *
 * HVORFOR DETTE ER RIKTIG VEI: NASAs og USGS' egne kart er hundrevis av megabyte,
 * og vi har ingen bildebehandler i pipelinen — filene MÅ være små når de hentes.
 * Commons har NASA-avledede kart i offentlig eiendom OG en thumb-tjener som gir
 * en vilkårlig bredde. Men filnavnet må være RIKTIG, og det er det API-et vet.
 * Da råtner heller ikke URL-en: den slås opp på nytt ved hver bake.
 *
 * @returns {Promise<{url: string, lisens: string, bytes: number}|null>}
 */
export async function commonsThumb(tittel, bredde = 1024) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + `&titles=${encodeURIComponent(tittel)}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${bredde}`
  try {
    const j = await hentJson(api)
    const side = Object.values(j?.query?.pages ?? {})[0]
    const info = side?.imageinfo?.[0]
    if (!info?.thumburl) return null
    const lis = info.extmetadata?.LicenseShortName?.value
      ?? info.extmetadata?.License?.value ?? 'ukjent lisens'
    return { url: info.thumburl, lisens: lis, bytes: info.size ?? 0 }
  } catch {
    return null
  }
}

/**
 * Søk Commons etter filer som kan være et overflatekart. Brukt av proben til å
 * FINNE kandidater, så neste runde ikke er gjetting.
 */
export async function commonsSok(sok, antall = 8) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + `&list=search&srnamespace=6&srlimit=${antall}`
    + `&srsearch=${encodeURIComponent(sok)}`
  try {
    const j = await hentJson(api)
    return (j?.query?.search ?? []).map((r) => r.title)
  } catch (e) {
    process.stderr.write(`  søk feilet: ${e.message}\n`)
    return []
  }
}

/**
 * SØK som proben bruker for å FINNE kandidater på Commons. Ikke filnavn — søk.
 *
 * Første probe gjettet ti filnavn og traff ingen; alle ga 400. Lærdommen er den
 * samme som ellers i dette prosjektet: når du ikke kan se, spør noen som kan.
 * Commons' API vet både hvilke filer som finnes, hva de heter, hvor store de er
 * og hvilken lisens de har.
 */
const SOK = {
  mars: ['Mars cylindrical map', 'Mars surface map equirectangular', 'Mars albedo map'],
  jupiter: ['Jupiter cylindrical map', 'Jupiter map equirectangular', 'Jupiter surface texture'],
  saturn: ['Saturn cylindrical map', 'Saturn map equirectangular', 'Saturn surface texture'],
  maane: ['Moon LROC color map', 'Moon cylindrical map'],
}

/** Prøv å finne og løse opp kandidater. Skriver ingen filer. */
async function probe() {
  for (const [navn, sokene] of Object.entries(SOK)) {
    process.stderr.write(`\n── ${navn} ${'─'.repeat(46)}\n`)
    const sett = new Set()
    for (const q of sokene) {
      for (const t of await commonsSok(q)) sett.add(t)
    }
    if (!sett.size) {
      process.stderr.write('  ingen treff — er commons.wikimedia.org nåbar herfra?\n')
      continue
    }
    for (const tittel of sett) {
      const r = await commonsThumb(tittel)
      if (!r) {
        process.stderr.write(`✗ kunne ikke løses   ${tittel}\n`)
        continue
      }
      // Vi laster ned for å se hva thumben FAKTISK veier: `size` fra API-et er
      // originalens størrelse, ikke nedskaleringens.
      let kB = '?'
      let jpeg = false
      try {
        const res = await fetch(r.url, { headers: { 'User-Agent': UA } })
        if (res.ok) {
          const b = Buffer.from(await res.arrayBuffer())
          kB = (b.length / 1024).toFixed(0)
          jpeg = b[0] === 0xff && b[1] === 0xd8
        } else {
          kB = `HTTP ${res.status}`
        }
      } catch (e) { kB = e.message }
      process.stderr.write(
        `${jpeg ? '✓' : '✗'} ${String(kB).padStart(7)} kB  ${jpeg ? 'jpeg' : '    '}  `
        + `${r.lisens}\n        ${tittel}\n        ${r.url}\n`,
      )
    }
  }
  process.stderr.write(
    `\nVelg de som er ✓, jpeg, under ${(MAKS_BYTES / 1024).toFixed(0)} kB og i `
    + 'offentlig eiendom / fri lisens. Lim TITTELEN inn i LEGEMER som '
    + '{ commons: "File:…" }.\n',
  )
}

// KJØRT DIREKTE, ikke importert. Guarden finnes for at commonsUrl skal kunne
// enhetstestes uten at hele baken går i gang — samme mønster som
// scripts/trenger-ektekart.mjs.
const kjortDirekte = process.argv[1]?.endsWith('bygg-himmelkart.mjs')

if (kjortDirekte && process.argv.includes('--probe')) {
  await probe()
  process.exit(0)
}

const bareMaling = process.argv.includes('--mal')
const bare = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const utKatalog = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data',
)

/** Hent ett legeme. Returnerer true om noe ble skrevet (eller ville blitt). */
async function hent(navn, kilder) {
  const ut = join(utKatalog, `${navn}.jpg`)
  for (const k of kilder) {
    process.stderr.write(`[${navn}] prøver ${k.navn} …\n`)
    try {
      const res = await fetch(k.url, { redirect: 'follow' })
      if (!res.ok) {
        process.stderr.write(`  ${res.status} ${res.statusText}\n`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (!buf.length) {
        process.stderr.write('  tomt svar\n')
        continue
      }
      // JPEG-signatur. Et HTML-feilside-svar med status 200 er en reell felle.
      if (buf[0] !== 0xff || buf[1] !== 0xd8) {
        process.stderr.write('  svaret er ikke en JPEG\n')
        continue
      }
      process.stderr.write(`  ${(buf.length / 1024).toFixed(0)} kB, ${k.lisens}\n`)
      if (buf.length > MAKS_BYTES) {
        process.stderr.write(`  for stor (taket er ${(MAKS_BYTES / 1024).toFixed(0)} kB) — `
          + 'skaler den ned før den commites\n')
        continue
      }
      if (bareMaling) {
        process.stderr.write('  --mal: skriver ikke\n')
        return true
      }
      mkdirSync(utKatalog, { recursive: true })
      writeFileSync(ut, buf)
      process.stderr.write(`  skrev ${ut}\n`)
      return true
    } catch (e) {
      process.stderr.write(`  ${e?.message ?? e}\n`)
    }
  }
  process.stderr.write(
    existsSync(ut)
      ? `[${navn}] ingen kilde svarte — beholder den som alt ligger der\n`
      : `[${navn}] ingen kilde svarte. Globen tegnes i egenfargen, som den er `
        + 'laget for å tåle.\n',
  )
  return false
}

if (kjortDirekte) {
  const valgte = Object.entries(LEGEMER)
    .filter(([navn]) => !bare.length || bare.includes(navn))
  if (!valgte.length) {
    process.stderr.write(`Ukjent legeme. Velg blant: ${Object.keys(LEGEMER).join(', ')}\n`)
    process.exit(1)
  }

  let ok = 0
  for (const [navn, kilder] of valgte) {
    if (await hent(navn, kilder)) ok++
  }

  // AVSLUTTER MED 0 UANSETT. Globene virker uten teksturene, og en jobb som
  // feiler på at NASA er nede ville blitt skrudd av innen en måned — samme
  // resonnement som for de tredjeparts røyktestene i deploy-proxy.yml.
  //
  // LES DENNE LINJA. Den er den eneste måten å oppdage en råtnet URL, siden alt
  // annet fortsetter å virke.
  process.stderr.write(`\n${ok} av ${valgte.length} kart på plass.\n`)
}
