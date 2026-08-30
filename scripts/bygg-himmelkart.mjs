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
// HVORFOR TRE AV FIRE GÅR VIA WIKIMEDIA COMMONS (v6.3.0), OG DET ER MÅLT: i
// v6.2.0 ble URL-ene til NASA SVS' Mars-, Jupiter- og Saturn-kart GJETTET, fordi
// hostene er sperret herfra. Alle tre var feil, og det viste seg først i
// deploy-loggen etter merge. Proben (`--probe`, se probe-himmelkart.yml) målte
// hva som faktisk svarer. Commons er svaret av to grunner: filnavnet slås OPP i
// stedet for å skrives av, så URL-en kan ikke råtne — og thumb-tjeneren gir en
// vilkårlig bredde, mens NASAs og USGS' egne kart er hundrevis av megabyte og vi
// har ingen bildebehandler i pipelinen. Månen beholder SVS-URL-en, for den
// svarer: den er den eneste av de fire som beviselig virket.
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
//   node scripts/bygg-himmelkart.mjs --probe sol  # leter etter kandidater, ett legeme
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
      navn: 'Solar System Scope — Mars-tekstur 2k (via Commons)',
      commons: 'File:Solarsystemscope texture 2k mars.jpg',
      lisens: 'CC BY 4.0 — Solar System Scope (INOVE), avledet av NASA-data',
    },
    {
      navn: 'Solar System Scope — Mars-tekstur 8k (via Commons)',
      commons: 'File:Solarsystemscope texture 8k mars.jpg',
      lisens: 'CC BY 4.0 — Solar System Scope (INOVE), avledet av NASA-data',
    },
  ],
  jupiter: [
    {
      navn: 'Cassini — sylindrisk Jupiter-kart, PIA07782 (via Commons)',
      commons: 'File:Jupiter Cylindrical Map - Dec 2000 PIA07782.jpg',
      lisens: 'NASA/JPL/Space Science Institute — offentlig eiendom',
    },
    {
      navn: 'Solar System Scope — Jupiter-tekstur 2k (via Commons)',
      commons: 'File:Solarsystemscope texture 2k jupiter.jpg',
      lisens: 'CC BY 4.0 — Solar System Scope (INOVE), avledet av NASA-data',
    },
  ],
  saturn: [
    {
      navn: 'Solar System Scope — Saturn-tekstur 2k (via Commons)',
      commons: 'File:Solarsystemscope texture 2k saturn.jpg',
      lisens: 'CC BY 4.0 — Solar System Scope (INOVE), avledet av NASA-data',
    },
    {
      navn: 'Solar System Scope — Saturn-tekstur 8k (via Commons)',
      commons: 'File:Solarsystemscope texture 8k saturn.jpg',
      lisens: 'CC BY 4.0 — Solar System Scope (INOVE), avledet av NASA-data',
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
 * Filene i en Commons-KATEGORI.
 *
 * Bedre enn fritekstsøk for dette formålet, og det er en målt konklusjon: søk på
 * «Mars cylindrical map» ga PDF-er fra 1834 og bilder av Saturns måne Daphnis.
 * Kategoriene er kuratert av mennesker som VET hva et sylindrisk kart er.
 */
export async function commonsKategori(kategori, antall = 30) {
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
    + `&list=categorymembers&cmtype=file&cmlimit=${antall}`
    + `&cmtitle=${encodeURIComponent(kategori)}`
  try {
    const j = await hentJson(api)
    return (j?.query?.categorymembers ?? []).map((r) => r.title)
  } catch {
    return []
  }
}

/** Vent. Commons svarte 429 da proben fyrte femti forespørsler i slengen. */
const pust = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * KATEGORIENE proben leter i. Kategori og ikke fritekstsøk: det er en MÅLT
 * konklusjon, ikke en preferanse. Søk på «Mars cylindrical map» ga PDF-er fra
 * 1834 og bilder av Saturns måne Daphnis; kategoriene er kuratert av folk som vet
 * hva et sylindrisk kart er.
 */
const KATEGORIER = {
  mars: [
    'Category:Maps of Mars',
    'Category:Cylindrical projection maps of Mars',
    'Category:Textures of Mars',
  ],
  jupiter: [
    'Category:Maps of Jupiter',
    'Category:Cylindrical projection maps of Jupiter',
    'Category:Textures of Jupiter',
  ],
  saturn: [
    'Category:Maps of Saturn',
    'Category:Cylindrical projection maps of Saturn',
    'Category:Textures of Saturn',
  ],
  maane: ['Category:Maps of the Moon'],
  // SOLA (v6.5.7). Den er annerledes enn de fire andre og det er verdt å vite
  // FØR man leser utskriften: nesten alt Commons har av sola er SKIVEBILDER —
  // SDO- og SOHO-opptak av sola sett forfra. De er ubrukelige som globe-tekstur;
  // vi trenger et EQUIREKTANGULÆRT kart, altså en utbrettet kule. Den eneste
  // familien som lager slike for sola er teksturpakkene, derav Solar System
  // Scope blant de navngitte under. Svarer ingen av dem, er riktig konklusjon å
  // BEHOLDE den lokalt tegnede overflaten — ikke å ta et skivebilde i stedet.
  sol: [
    'Category:Textures of the Sun',
    'Category:Maps of the Sun',
    'Category:Sun in visible light',
  ],
}

/**
 * EKSPLISITTE MISTENKTE, prøvd FØR kategoriene.
 *
 * Runde tre målte to ting: kategoriene virker, men taket på ti kandidater ble
 * spist opp av «Maps of Mars» alfabetisk — så «Textures of Mars», der de
 * equirektangulære teksturene faktisk ligger, ble aldri nådd. Å navngi en
 * mistenkt er billigere enn å heve taket og bli ratebegrenset igjen.
 */
const TITLER = {
  mars: [
    'File:Solarsystemscope texture 2k mars.jpg',
    'File:Solarsystemscope texture 8k mars.jpg',
    'File:Mars Viking MDIM21 ClrMosaic global 232m.jpg',
    'File:Mars albedo map.jpg',
    'File:Mars map by Askaniy.jpg',
    'File:Marte cilindrica.jpg',
  ],
  jupiter: [
    'File:Solarsystemscope texture 2k jupiter.jpg',
    'File:Jupiter Cylindrical Map - Dec 2000 PIA07782.jpg',
  ],
  saturn: [
    'File:Solarsystemscope texture 2k saturn.jpg',
    'File:OPAL Saturn Cycle 25 Map.png',
  ],
  maane: ['File:Solarsystemscope texture 2k moon.jpg'],
  // Navnemønsteret er allerede BEVIST for fire andre legemer i denne fila, så
  // dette er den sterkeste enkeltmistenkte vi har. Merk at Solar System Scope
  // sine kart er CC BY 4.0 og ikke offentlig eiendom: slår en av dem til, må
  // attribusjonen på /om utvides — det er et vilkår, ikke en høflighet.
  sol: [
    'File:Solarsystemscope texture 2k sun.jpg',
    'File:Solarsystemscope texture 8k sun.jpg',
    'File:Sun texture map.jpg',
    'File:Solar surface texture.jpg',
  ],
}

/**
 * Er tittelen i det hele tatt en kandidat? Filtrerer bort det kategoriene også
 * inneholder: PDF-er, TIFF-er (som thumbes til PNG og blir store), måne- og
 * detaljbilder. Vi vil ha JPEG eller PNG som ser ut som et globalt kart.
 */
function erKandidat(tittel) {
  if (!/\.(jpe?g|png)$/i.test(tittel)) return false
  if (/(pdf|tif|svg)/i.test(tittel)) return false
  // Månebilder havner i planetkategoriene. «Daphnis», «Tethys», «Hydra» osv.
  if (/\b(phobos|deimos|io|europa|ganymede|callisto|titan|enceladus|mimas|rhea|iapetus|tethys|dione|daphnis|hydra)\b/i.test(tittel)) return false
  return true
}

/**
 * Prøv å finne og løse opp kandidater. Skriver ingen filer.
 *
 * `bare` begrenser til ett eller flere legemer, og det er ikke en bekvemmelighet
 * (v6.5.7): kjørt for alle fem svarer Wikimedia 429 på nesten hele lista, og en
 * probe som blir ratebegrenset MÅLER INGENTING — samme lærdom som i runde to,
 * bare med flere legemer i lista denne gangen. Trenger du svar om ett legeme,
 * spør om det ene.
 */
async function probe(bare = []) {
  const valgte = Object.entries(KATEGORIER)
    .filter(([navn]) => !bare.length || bare.includes(navn))
  if (!valgte.length) {
    process.stderr.write(`Ukjent legeme. Velg blant: ${Object.keys(KATEGORIER).join(', ')}\n`)
    return
  }
  for (const [navn, kategorier] of valgte) {
    process.stderr.write(`\n── ${navn} ${'─'.repeat(46)}\n`)
    // RUNDGANG mellom kategoriene, ikke én om gangen. Én kategori alene fylte
    // hele taket alfabetisk i runde tre, og de kuraterte tekstur-kategoriene ble
    // aldri nådd. De navngitte mistenkte står først uansett.
    const lister = []
    for (const k of kategorier) {
      lister.push((await commonsKategori(k)).filter(erKandidat))
      await pust(250)
    }
    const sett = new Set(TITLER[navn] ?? [])
    for (let i = 0; lister.some((l) => i < l.length); i++) {
      for (const l of lister) if (l[i]) sett.add(l[i])
    }
    if (!sett.size) {
      process.stderr.write('  ingen kandidater i kategoriene\n')
      continue
    }
    // Taket er lavt med vilje: Commons svarte 429 på femti forespørsler i
    // slengen, og en probe som blir ratebegrenset måler ingenting.
    for (const tittel of [...sett].slice(0, 12)) {
      const r = await commonsThumb(tittel)
      await pust(400)
      if (!r) {
        process.stderr.write(`✗ kunne ikke løses   ${tittel}\n`)
        continue
      }
      let kB = '?'
      let jpeg = false
      // ETT FORSØK TIL VED 429, med en lang pause. Wikimedias ratebegrensning er
      // forbigående, og forskjellen på «filen finnes ikke» og «vi spurte for
      // fort» er hele forskjellen på en måling og en gjetning. Uten dette leste
      // en hel kjøring som om ingen kilde svarte.
      for (let forsok = 0; forsok < 2; forsok++) {
        try {
          const res = await fetch(r.url, { headers: { 'User-Agent': UA } })
          if (res.ok) {
            const b = Buffer.from(await res.arrayBuffer())
            kB = (b.length / 1024).toFixed(0)
            // Både JPEG (ff d8) og PNG (89 50) er brukbare for en tekstur.
            jpeg = (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50)
            break
          }
          kB = `HTTP ${res.status}`
          if (res.status !== 429) break
        } catch (e) { kB = e.message; break }
        await pust(5000)
      }
      await pust(400)
      process.stderr.write(
        `${jpeg ? '✓' : '✗'} ${String(kB).padStart(7)} kB  ${r.lisens}\n`
        + `        ${tittel}\n`,
      )
    }
  }
  process.stderr.write(
    `\nVelg de som er ✓, under ${(MAKS_BYTES / 1024).toFixed(0)} kB og i offentlig `
    + 'eiendom / fri lisens. Lim TITTELEN inn i LEGEMER som { commons: "File:…" }.\n',
  )
}

// KJØRT DIREKTE, ikke importert. Guarden finnes for at commonsUrl skal kunne
// enhetstestes uten at hele baken går i gang — samme mønster som
// scripts/trenger-ektekart.mjs.
const kjortDirekte = process.argv[1]?.endsWith('bygg-himmelkart.mjs')

const bareMaling = process.argv.includes('--mal')
const bare = process.argv.slice(2).filter((a) => !a.startsWith('--'))

// Etter `bare`, så `--probe sol` kan begrense seg til ett legeme. Sto den over,
// måtte proben alltid spørre om alle fem — og da svarer Wikimedia 429.
if (kjortDirekte && process.argv.includes('--probe')) {
  await probe(bare)
  process.exit(0)
}
const utKatalog = join(
  dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data',
)

/** Hent ett legeme. Returnerer true om noe ble skrevet (eller ville blitt). */
async function hent(navn, kilder) {
  const ut = join(utKatalog, `${navn}.jpg`)
  for (const k of kilder) {
    process.stderr.write(`[${navn}] prøver ${k.navn} …\n`)
    try {
      // EN COMMONS-KILDE SLÅS OPP, IKKE HARDKODES. Thumb-URL-ene inneholder en
      // md5-shard av filnavnet, og en URL man skriver av kan råtne uten at noe
      // sier fra. Tittelen er stabil; oppslaget gir både URL og lisens.
      let url = k.url
      if (k.commons) {
        const r = await commonsThumb(k.commons, k.bredde ?? 1024)
        if (!r) {
          process.stderr.write('  Commons kjente ikke tittelen\n')
          continue
        }
        url = r.url
        process.stderr.write(`  Commons: ${r.lisens}\n`)
      }
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } })
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
