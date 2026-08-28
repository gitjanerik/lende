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

/**
 * URL til en nedskalert utgave av en fil på Wikimedia Commons.
 *
 * HVORFOR COMMONS ER MED I JAKTEN: NASAs egne kart er hundrevis av megabyte, og
 * vi har ingen bildebehandler i pipelinen — filene MÅ være små når de hentes.
 * Commons har NASA-avledede kart i offentlig eiendom OG en thumb-tjener som gir
 * en vilkårlig bredde. Det løser nettopp problemet som gjorde at Mars, Jupiter
 * og Saturn ikke kom med i v6.2.0.
 *
 * Sti-sharden er md5 av filnavnet (med understrek for mellomrom): første tegn,
 * så de to første. Den kan altså regnes ut, ikke bare slås opp.
 */
export function commonsUrl(filnavn, bredde = 1024) {
  const f = filnavn.replace(/ /g, '_')
  const h = createHash('md5').update(f).digest('hex')
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${f}/${bredde}px-${f}`
}

/**
 * KANDIDATER TIL PROBING. Ikke i bruk av baken — dette er lista `--probe` går
 * gjennom for å FINNE ut hvilke URL-er som faktisk svarer.
 *
 * HVORFOR EN PROBE OG IKKE FLERE GJETTINGER: NASA, USGS og Wikimedia er alle
 * sperret fra utviklingsmiljøene, så en URL kan ikke prøves der den skrives. I
 * v6.2.0 ble tre URL-er gjettet, og alle tre var feil — oppdaget først i
 * deploy-loggen etter merge. Samme lærdom som skyene og knappenålene: når du
 * ikke kan se, BYGG EN MÅLING framfor en hypotese.
 *
 * Kjøres med `--probe` fra workflowen `probe-himmelkart.yml` (workflow_dispatch).
 */
const KANDIDATER = {
  mars: [
    commonsUrl('Mars_Viking_MDIM21_ClrMosaic_global_232m.jpg'),
    commonsUrl('Solarsystemscope_texture_8k_mars.jpg'),
    commonsUrl('Mars_Composite_Map.jpg'),
    commonsUrl('Marsmap.jpg'),
    commonsUrl('OSIRIS_Mars_true_color.jpg'),
    'https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.jpg',
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/mars_1k_color.jpg',
    'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
  ],
  jupiter: [
    commonsUrl('Solarsystemscope_texture_8k_jupiter.jpg'),
    commonsUrl('Jupiter_Cylindrical_Map.jpg'),
    commonsUrl('Map_of_Jupiter.jpg'),
    commonsUrl('Jupiter_map.jpg'),
    commonsUrl('PIA07782.jpg'),
    'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg',
    'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/jupiter_1k.jpg',
  ],
  saturn: [
    commonsUrl('Solarsystemscope_texture_8k_saturn.jpg'),
    commonsUrl('Saturn_Cylindrical_Map.jpg'),
    commonsUrl('Map_of_Saturn.jpg'),
    commonsUrl('Saturn_map.jpg'),
    'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg',
    'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/saturn_1k.jpg',
  ],
  maane: [
    // Månen VIRKER alt — den er med for å bevise at proben måler riktig. En probe
    // der ingenting svarer kan ikke skilles fra en probe som er ødelagt.
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
    commonsUrl('Solarsystemscope_texture_8k_moon.jpg'),
  ],
}

/** Prøv hver kandidat og skriv status, type og størrelse. Skriver ingen filer. */
async function probe() {
  for (const [navn, urler] of Object.entries(KANDIDATER)) {
    process.stderr.write(`\n── ${navn} ${'─'.repeat(40)}\n`)
    for (const url of urler) {
      try {
        // GET og ikke HEAD: Commons' thumb-tjener GENERERER bildet ved første
        // forespørsel, og en HEAD kan svare 404 på noe en GET ville laget.
        const res = await fetch(url, { redirect: 'follow' })
        const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null
        const jpeg = buf && buf[0] === 0xff && buf[1] === 0xd8
        const kB = buf ? (buf.length / 1024).toFixed(0) : '—'
        const dom = new URL(url).hostname
        process.stderr.write(
          `${res.ok ? '✓' : '✗'} ${String(res.status).padEnd(4)}`
          + `${String(kB).padStart(6)} kB  ${jpeg ? 'jpeg' : '    '}  ${dom}\n`
          + `        ${url}\n`,
        )
      } catch (e) {
        process.stderr.write(`✗ FEIL              ${e?.message ?? e}\n        ${url}\n`)
      }
    }
  }
  process.stderr.write(
    `\nVelg de som er ✓, jpeg og under ${(MAKS_BYTES / 1024).toFixed(0)} kB, `
    + 'og lim dem inn i LEGEMER.\n',
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
