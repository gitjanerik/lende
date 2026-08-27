#!/usr/bin/env node
// Baker månens albedokart for 3D-globen: public/data/maane.jpg
//
// HVORFOR ET BAKE-SKRIPT OG IKKE EN RUNTIME-HENTING: samme grunn som stjernene
// og N50-flisene. Kartet endrer seg aldri, og natthimmelen skal virke offline på
// et fjell. En globe som må laste ned et bilde for å vise månen er ubrukelig
// nettopp der man står og ser på den.
//
// HVORFOR IKKE COMMITET FOR HÅND: lisensen. NASAs og USGS' bilder er offentlig
// eiendom, men en kopi funnet i et tilfeldig repo er ikke dokumentert som det.
// Skriptet henter fra kilden, så opphavet står i koden og ikke i hukommelsen.
//
// KJØRES I CI, IKKE HERFRA. Utviklingsmiljøet har en nettverkspolicy som sperrer
// både svs.gsfc.nasa.gov og planetarymaps.usgs.gov — bekreftet i proxy-loggen.
// Klarer skriptet ikke å hente noe, skriver det INGENTING og avslutter med 0:
// globen virker uten teksturen (se maneGlobe.js), og en tom fil ville vært verre
// enn ingen fil.
//
// Bruk:
//   node scripts/bygg-maanekart.mjs            # henter og skriver
//   node scripts/bygg-maanekart.mjs --mal      # prøver kildene, skriver ikke

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Kilder i prioritert rekkefølge. Alle er offentlig eiendom (NASA/USGS).
// Equirektangulært, forsida sentrert på lengdegrad 0 — som maneGlobe forventer.
const KILDER = [
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
]

// Taket er lavt med vilje: bildet går i nettleser-bunten til alle brukere, og
// månen tegnes maks en tredjedel av skjermen. 1024×512 er rikelig.
const MAKS_BYTES = 900 * 1024

const bareMaling = process.argv.includes('--mal')
const ut = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'maane.jpg',
)

let skrevet = false
for (const k of KILDER) {
  process.stderr.write(`Prøver ${k.navn} …\n`)
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
      skrevet = true
      break
    }
    mkdirSync(dirname(ut), { recursive: true })
    writeFileSync(ut, buf)
    process.stderr.write(`Skrev ${ut}\n`)
    skrevet = true
    break
  } catch (e) {
    process.stderr.write(`  ${e?.message ?? e}\n`)
  }
}

if (!skrevet) {
  // AVSLUTTER MED 0. Globen virker uten teksturen, og en jobb som feiler på at
  // NASA er nede ville blitt skrudd av innen en måned — samme resonnement som
  // for de tredjeparts røyktestene i deploy-proxy.yml.
  process.stderr.write(
    existsSync(ut)
      ? '\nIngen kilde svarte — beholder den som alt ligger der.\n'
      : '\nIngen kilde svarte. Globen tegnes i månegrå uten fotografi, '
        + 'som den er laget for å tåle.\n',
  )
}
