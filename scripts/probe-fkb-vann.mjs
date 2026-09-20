#!/usr/bin/env node
// Hva koster FKB-Vann, og bærer den elvene N50 ikke har? EN MÅLING, IKKE EN GATE.
//
// ── Hvorfor den finnes ─────────────────────────────────────────────────────
// Eieren så at UT.no tegner Askerelva som en FYLT vannflate der Lende bare har
// en blå strek. Målt i vårt eget bakte datasett (public/data/n50-vann/, flisa
// 59.5_10.0) er svaret entydig: det finnes NULL elveflater i Asker-utsnittet,
// og nærmeste flate ligger 4,1 km unna. Filteret er ikke synderen — den minste
// flata i samme flis er 382 m², så en elv på 5 × 200 m ville passert med god
// margin. N50 Arealdekke er 1:50 000, og der bæres et løp på fem–åtte meter
// bare som senterlinje.
//
// Neste kilde oppover er FKB-Vann, som er Geovekst-produsert i 1:1 000–1:5 000
// og åpen på Geonorge. Spørsmålet er ikke om den HAR Askerelva som flate —
// det gjør den nesten sikkert. Spørsmålet er hva den koster, og det er det
// eneste spørsmålet som avgjør arkitekturen: `public/` bærer 129 MB bakte
// fliser fra før, og FKB er en helt annen størrelsesorden enn N50.
//
// Og spørsmålet kan ikke stilles der svaret skal skrives: kartkatalog.geonorge.no
// og nedlasting.geonorge.no er BEGGE sperret fra utviklings-sandkassene (målt
// 2026-09-20: «Host not in allowlist»). Samme situasjon som himmelkartene i
// v6.2.0, der tre URL-er ble skrevet på gjetning og alle tre var feil — oppdaget
// først i deploy-loggen etter merge. Lærdommen derfra er hele grunnen til at
// denne fila finnes: BYGG EN MÅLING, IKKE EN HYPOTESE.
//
// Den skriver INGENTING i public/ og avslutter ALLTID med 0. Rapporten går til
// probe-ut/. LES UTSKRIFTEN — den er hele leveransen.
//
// ── Seks trinn ─────────────────────────────────────────────────────────────
//   1. katalog   Geonorges kartkatalog + capabilities: finnes «FKB-Vann», og
//                hvilke OMRÅDER, formater og projeksjoner har den? FKB deles
//                per kommune, ikke per fylke som N50 — så område-lista er
//                selve svaret på hva neste kjøring kan be om. Den skrives ut i
//                sin helhet til probe-ut/omrader.json.
//   2. last      Nedlasting av de valgte kommunene. URL-en er IKKE kjent: N50
//                ligger under /Basisdata/N50Kartdata/, mens FKB er Geovekst-
//                produsert og kan ligge under /Geovekst/. Vi krysser derfor
//                baser × slug-skrivemåter × navnevarianter × projeksjoner og
//                LOGGER hvert forsøk. Et script som sier «404» er ubrukelig;
//                ett som sier hva det prøvde, løser saken på én kjøring til.
//   3. lag       Alle lagnavn med geometritype, alle feltnavn, og hele
//                objtype-fordelingen. Samme grep som areal-baken brukte da den
//                fant ut at laget het `N50_Arealdekke_omrade` — etter å ha
//                lastet ned 166 MB og meldt «success» med null flater.
//   4. mal       Pakking gjennom VÅRT EGET flis-format (kodeFlis), i et sveip
//                over forenkling × minsteareal. FKB er 1:1 000; myrens 4 m
//                kan godt spise detalj som er hele grunnen til å bytte kilde,
//                så sveipet går ned til 1 m.
//   5. jamfor    FKB mot de BAKTE N50-flisene i samme bbox: flater, km² og
//                byte. Forholdstallet er det som gjør et nasjonalt anslag
//                ærlig — vi kjenner N50 elv nasjonalt (22 052 flater, 3,9 MB),
//                så FKB nasjonalt ≈ 3,9 MB × forholdet. Å skalere på
//                kommunetall eller bbox-areal ville vært en gjetning med et
//                tall på.
//   6. asker     Selve utgangsspørsmålet: finnes Askerelva som flate, hvor
//                bred er den, og hva sier N50 om samme utsnitt? Forventet svar
//                er «FKB: ja, N50: null» — og blir det noe annet, er det DET
//                som må forklares før noen baker noe.
//
// ── Kjør ───────────────────────────────────────────────────────────────────
//   npm run probe:fkbvann
//   PROBE_OMRADER=Asker,Oslo,Bykle npm run probe:fkbvann
//
// Kjør den IKKE samtidig med en nasjonal N50-bake: begge laster ned fra
// Geonorge, og to samtidige nedlastinger kvelte hverandre (v5.24.x).

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, createReadStream, readdirSync, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import {
  kodeFlis, lesFlis, forenkleRinger, fliserForFlate, arealM2, bboxForRinger,
} from '../src/lib/n50ArealPakke.js'
import {
  finnOmrader, velgFormat, lastNed, finnGdb, lagNavn, feltNavn, krevGdal,
  filnavnKandidater, BASER, katalogUrl,
} from './geonorgeN50.mjs'

// ── Rene hjelpere (enhetstestet i probe-fkb-vann.test.js) ──────────────────

// Slug-skrivemåtene vi prøver i URL-en. Geonorge er ikke konsekvent: N50 er
// «N50Kartdata» (uten bindestrek), mens katalogtittelen er «N50 Kartdata».
// FKB-Vann kan derfor være hvilken som helst av disse tre, og å prøve alle
// koster tre HEAD-forespørsler mot å koste en CI-kjøring.
export const SLUGGER = Object.freeze(['FKB-Vann', 'FKBVann', 'FKB_Vann'])

// Filnavn-prefiksene. MÅLT i første CI-kjøring: alle seks kandidater bommet,
// og fellesnevneren var at de bar «Basisdata_». Geonorge navngir fila etter
// PRODUSENTEN, og FKB er Geovekst. «Geovekst» står først fordi det er den
// forklaringen målingen peker på.
export const PREFIKSER = Object.freeze(['Geovekst', 'Basisdata'])

/**
 * Alle URL-kandidater for ett område, i prøve-rekkefølge.
 *
 * Krysser base × slug × projeksjon × navnevariant. Projeksjonene krysses fordi
 * FKB leveres i kommunens EGEN sone — Asker er 25832, Finnmark 25835 — mens
 * `velgFormat` foretrekker 25833 for N50. En enkelt projeksjon ville gitt 404
 * på halve landet, og 404 fra Geonorge ser nøyaktig ut som «datasettet finnes
 * ikke».
 */
export function fkbKandidater(omrade, format, projeksjoner, slugger = SLUGGER, baser = BASER,
                              prefikser = PREFIKSER) {
  const ut = []
  for (const base of baser) {
    for (const slug of slugger) {
      for (const proj of projeksjoner) {
        for (const prefiks of prefikser) {
          for (const url of filnavnKandidater(omrade, format, proj, slug, base, prefiks)) ut.push(url)
        }
      }
    }
  }
  return [...new Set(ut)]
}

/**
 * Siste utvei når hver eneste filnavn-kandidat bommet: SE hva som ligger i
 * katalogen i stedet for å gjette en runde til.
 *
 * Dumper rå svar fra hver base × slug × format — en blob-liste, en 404-side,
 * hva som helst — for en 404 fra Geonorge ser nøyaktig ut som «datasettet
 * finnes ikke», og det er det den første kjøringen gikk på. Kaster ALDRI:
 * dette er en måling som kjøres når noe allerede har feilet.
 */
export async function speidKatalog(format, slugger = SLUGGER, baser = BASER, hent = fetch) {
  const ut = []
  for (const base of baser) {
    for (const slug of slugger) {
      const url = katalogUrl(base, slug, format)
      try {
        const r = await hent(url, { signal: AbortSignal.timeout(30000) })
        const tekst = (await r.text()).slice(0, 1500)
        ut.push({ url, status: r.status, utdrag: tekst })
      } catch (e) {
        ut.push({ url, status: 0, utdrag: String(e?.message ?? e) })
      }
    }
  }
  return ut
}

// FKB-Vann sine flate-objekttyper. Nøklene er små bokstaver; verdien fra kilden
// lowercases før oppslag. FLERE skrivemåter med vilje, av samme grunn som
// isbre i areal-baken: vi har ikke sett feltet fra denne sandkassen, og et
// bomskudd her ville gitt null flater og en helt taus måling.
export const FKB_OBJTYPE = Object.freeze({
  elv: 'elv',
  elvbekk: 'elv',
  elvelop: 'elv',
  elveløp: 'elv',
  kanal: 'elv',
  innsjø: 'innsjo',
  innsjo: 'innsjo',
  innsjøregulert: 'innsjo',
  innsjoregulert: 'innsjo',
})

export function klassifiserFkb(props) {
  const rå = String(props?.objtype ?? props?.OBJTYPE ?? '').toLowerCase().replace(/\s+/g, '')
  return FKB_OBJTYPE[rå] ?? null
}

export function bboxOverlapper(a, b) {
  if (!a || !b) return false
  return !(a.north < b.south || a.south > b.north || a.east < b.west || a.west > b.east)
}

/**
 * Omtrentlig bredde i meter for en lang, smal flate: 2·A/P.
 *
 * For et rektangel L × B med L ≫ B gir formelen nøyaktig B. Den er hele
 * grunnen til at målingen kan si noe om HVORFOR N50 mangler elva — er FKB-
 * flata 6 m bred, er den under N50s generaliseringsgrense, og da er det ikke
 * et hull i N50 men en egenskap ved målestokken.
 */
export function ringBredde(ring) {
  const a = arealM2(ring)
  if (!a) return 0
  const lat0 = ring[0].lat
  const cos = Math.cos(lat0 * Math.PI / 180)
  let p = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const dx = (ring[i].lon - ring[j].lon) * cos * 111320
    const dy = (ring[i].lat - ring[j].lat) * 111320
    p += Math.hypot(dx, dy)
  }
  return p > 0 ? (2 * a) / p : 0
}

/**
 * Nasjonalt anslag for FKB, forankret i N50 målt i SAMME utsnitt.
 *
 * `n50Nasjonalt` er det vi allerede har på disk (3,9 MB elv). Forholdet måles
 * lokalt og ganges opp. Alternativene — å skalere på kommunetall eller på
 * bbox-areal — ville vært en gjetning med et tall på: kommuner er ulikt store,
 * og en bbox er mest luft. Kommer N50 ut med null byte i utsnittet, finnes det
 * ikke noe forhold å gange med, og funksjonen sier det i stedet for å dele på
 * null.
 */
export function nasjonaltAnslag({ fkbBytes, n50Bytes, n50Nasjonalt }) {
  if (!n50Bytes) return { forhold: null, anslagBytes: null, grunn: 'N50 har null byte i utsnittet — ingen forankring' }
  const forhold = fkbBytes / n50Bytes
  return { forhold, anslagBytes: Math.round(n50Nasjonalt * forhold), grunn: null }
}

/** Lagnavn med geometritype, lest av `ogrinfo -so -al`. */
export function lesLagTyper(tekst) {
  const ut = []
  let navn = null
  for (const rad of String(tekst).split('\n')) {
    const n = rad.match(/^Layer name:\s*(.+?)\s*$/)
    if (n) { navn = n[1]; continue }
    const g = rad.match(/^Geometry:\s*(.+?)\s*$/)
    if (g && navn) { ut.push({ navn, geometri: g[1] }); navn = null }
  }
  return ut
}

export const erFlateLag = (g) => /polygon|surface/i.test(String(g))

// ── Oppsett ───────────────────────────────────────────────────────────────

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UT = join(ROT, 'probe-ut')
const N50_VANN = join(ROT, 'public', 'data', 'n50-vann')

const DATASETT = String(process.env.PROBE_DATASETT || 'FKB-Vann')
const OMRADER = String(process.env.PROBE_OMRADER || 'Asker')
  .split(',').map(s => s.trim()).filter(Boolean)
const HOPP = new Set(String(process.env.PROBE_HOPP || '').split(',').map(s => s.trim()).filter(Boolean))
// Askerelva ved Sem/Seheim — utsnittet der N50 måler null elveflater.
const PUNKT = (() => {
  const m = String(process.env.PROBE_PUNKT || 'Askerelva@59.81,10.40,59.86,10.48')
    .match(/^(.*?)@(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)$/)
  return m
    ? { navn: m[1].trim() || 'utsnittet', south: +m[2], west: +m[3], north: +m[4], east: +m[5] }
    : { navn: 'Askerelva', south: 59.81, west: 10.40, north: 59.86, east: 10.48 }
})()
// Sveipet. Forenkling ned til 1 m fordi FKB er 1:1 000 — myrens 4 m kan spise
// nettopp den detaljen som er grunnen til å bytte kilde.
const TOLERANSER = (process.env.PROBE_TOLERANSER || '1,2,4,8').split(',').map(Number).filter(Number.isFinite)
const MINAREALER = (process.env.PROBE_MINAREALER || '100,400,1000').split(',').map(Number).filter(Number.isFinite)

const log = (...a) => console.log(...a)
const mb = (b) => `${(b / 1e6).toFixed(2)} MB`
const tall = (n, d = 0) => Number(n).toLocaleString('no', { maximumFractionDigits: d, minimumFractionDigits: d })
const rapport = { datasett: DATASETT, omrader: OMRADER, punkt: PUNKT, kjort: new Date().toISOString() }

async function trinn(navn, nokkel, fn) {
  log(`\n━━ ${navn} ━━`)
  if (HOPP.has(nokkel)) { log('  hoppet over (PROBE_HOPP)'); return null }
  try { return await fn() } catch (e) {
    log(`  ⚠ hoppet over: ${e?.message ?? e}`)
    rapport[`${nokkel}Feil`] = String(e?.message ?? e)
    return null
  }
}

const norm = (s) => String(s ?? '').toLowerCase()
  .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').trim()

/** Områder som matcher et ønske, på kode eller navn. */
export function velgOmrader(omrader, onsker) {
  const ut = []
  for (const o of onsker) {
    const n = norm(o)
    const treff = omrader.filter(a => String(a.code) === o || norm(a.name).includes(n))
    if (!treff.length) { ut.push({ onske: o, omrade: null }); continue }
    // Minste område først: «Asker» treffer både kommunen og et eventuelt
    // fylke/landsdekkende sett, og vi vil ha den minste nedlastingen.
    for (const t of treff.slice(0, 1)) ut.push({ onske: o, omrade: t })
  }
  return ut
}


/** Pakk et sett flater med gitte skruer og rapporter hva det veier. */
export function malFlater(flater, toleranseM, minArealM2) {
  const fliser = new Map()
  let n = 0, km2 = 0, forkastet = 0
  for (const f of flater) {
    const areal = arealM2(f.ringer[0])
    if (areal < minArealM2) { forkastet++; continue }
    const ringer = forenkleRinger(f.ringer, toleranseM)
    if (!ringer.length) { forkastet++; continue }
    n++; km2 += areal / 1e6
    const flate = { type: f.type, ringer }
    for (const nokkel of fliserForFlate(ringer)) {
      let l = fliser.get(nokkel)
      if (!l) fliser.set(nokkel, (l = []))
      l.push(flate)
    }
  }
  let bytes = 0, storst = 0, storstNokkel = ''
  const pakket = []
  for (const [nokkel, liste] of fliser) {
    const b = kodeFlis(liste)
    pakket.push(Buffer.from(b))
    bytes += b.length
    if (b.length > storst) { storst = b.length; storstNokkel = nokkel }
  }
  const gz = pakket.length ? gzipSync(Buffer.concat(pakket)).length : 0
  return { n, km2, forkastet, fliser: fliser.size, bytes, gz, storst, storstNokkel }
}

// Eksportene over er RENE og enhetstestes. Kjøringen under må derfor ikke skje
// når fila importeres — samme vakt som bygg-n50-areal.mjs bruker. Uten den
// ville `npm run test` lastet ned fra Geonorge.
const ER_HOVED = import.meta.url === (process.argv[1] ? `file://${process.argv[1]}` : '')
if (ER_HOVED) {
  mkdirSync(UT, { recursive: true })

  // ── 1. Katalog ────────────────────────────────────────────────────────────

  const katalog = await trinn(`Katalog — finnes «${DATASETT}», og hvilke områder har den?`, 'katalog', async () => {
    const { omrader, formater, projeksjoner, uuid, tittel } = await finnOmrader(DATASETT)
    log(`  ${tittel} — ${uuid}`)
    log(`  ${omrader.length} områder, ${formater.length} formater, ${projeksjoner.length} projeksjoner`)
    const typer = new Map()
    for (const o of omrader) typer.set(o.type, (typer.get(o.type) ?? 0) + 1)
    log(`  områdetyper: ${[...typer].map(([k, v]) => `${k}=${v}`).join(', ')}`)
    log(`  formater: ${formater.map(f => f.name).join(', ')}`)
    log(`  projeksjoner: ${projeksjoner.map(p => p.code).join(', ')}`)
    log(`  første 10 områder: ${omrader.slice(0, 10).map(o => `${o.code}:${o.name}`).join(', ')}`)
    writeFileSync(join(UT, 'omrader.json'), JSON.stringify({ uuid, tittel, omrader, formater, projeksjoner }, null, 2))
    log('  → hele lista i probe-ut/omrader.json')
    rapport.katalog = { uuid, tittel, antallOmrader: omrader.length, typer: Object.fromEntries(typer) }
    return { omrader, formater, projeksjoner }
  })

  // ── 2–3. Nedlasting + laginnhold ──────────────────────────────────────────

  /**
   * Les FKB-flater ut av én kilde. Diagnostikk FØRST: alle lag med geometritype,
   * alle felter, hele objtype-fordelingen. Et script som bare sier «0» er
   * ubrukelig; ett som sier hva det SÅ, løser saken på én kjøring til.
   */
  async function lesFlater(kilde, dir) {
    const alle = lesLagTyper(execFileSync('ogrinfo', ['-so', '-al', kilde], { encoding: 'utf8', maxBuffer: 1 << 28 }))
    log(`    lag: ${alle.map(l => `${l.navn} [${l.geometri}]`).join(', ') || '(ingen)'}`)
    const flateLag = alle.filter(l => erFlateLag(l.geometri)).map(l => l.navn)
    if (!flateLag.length) {
      log('    ⚠ ingen flatelag i kilden — les lagnavnene over')
      return { flater: [], objtype: new Map() }
    }
    const flater = []
    const objtype = new Map()
    for (const l of flateLag) {
      log(`    ${l}: felter ${feltNavn(kilde, l).join(', ') || '(ingen lest)'}`)
      const utfil = join(dir, `${l.replace(/[^\w]/g, '_')}.geojsonl`)
      try {
        execFileSync('ogr2ogr', ['-f', 'GeoJSONSeq', utfil, kilde, l,
          '-t_srs', 'EPSG:4326', '-nlt', 'MULTIPOLYGON'], { stdio: 'pipe' })
      } catch (e) {
        log(`    ⚠ ${l}: ogr2ogr feilet (${String(e.message).split('\n')[0]})`)
        continue
      }
      const rl = createInterface({ input: createReadStream(utfil), crlfDelay: Infinity })
      for await (const rad of rl) {
        if (!rad.trim()) continue
        let f
        try { f = JSON.parse(rad) } catch { continue }
        const rå = String(f.properties?.objtype ?? f.properties?.OBJTYPE ?? '(mangler)')
        objtype.set(rå, (objtype.get(rå) ?? 0) + 1)
        const type = klassifiserFkb(f.properties)
        if (!type || !f.geometry) continue
        const polygoner = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates
          : f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : []
        for (const p of polygoner) {
          const ringer = p.map(r => r.map(([lon, lat]) => ({ lat, lon }))).filter(r => r.length >= 3)
          if (ringer.length) flater.push({ type, ringer })
        }
      }
      rmSync(utfil, { force: true })
    }
    const topp = [...objtype.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    log(`    objtype: ${topp.map(([k, v]) => `${k}=${v}`).join(', ') || '(ingen features lest)'}`)
    return { flater, objtype }
  }

  const dir = mkdtempSync(join(tmpdir(), 'fkbvann-'))
  let raFlater = []

  await trinn('Nedlasting + laginnhold', 'last', async () => {
    if (!katalog) throw new Error('katalog-trinnet ga ingenting — ingenting å laste ned')
    krevGdal()
    let speidBehov = null
    const valgte = velgOmrader(katalog.omrader, OMRADER)
    for (const { onske, omrade } of valgte) {
      if (!omrade) { log(`  ⚠ «${onske}»: ingen treff i område-lista (se probe-ut/omrader.json)`); continue }
      log(`  ${omrade.code} ${omrade.name}`)
      const fdir = mkdtempSync(join(dir, 'o-'))
      try {
        const { format } = velgFormat(omrade, katalog.formater, katalog.projeksjoner)
        const projeksjoner = omrade.projections?.length ? omrade.projections : katalog.projeksjoner
        const kandidater = fkbKandidater(omrade, format, projeksjoner)
        log(`    prøver ${kandidater.length} URL-kandidater (${format.name}, proj ${projeksjoner.map(p => p.code).join('/')})`)
        const utpakket = await lastNed(omrade, format, null, fdir, (...a) => log(...a), {
          kandidater,
          zipNavn: 'fkb.zip',
          pa: (url) => { log(`    ✓ ${url}`); rapport.nedlastingsUrl = url },
        })
        const kilder = finnGdb(utpakket)
        if (!kilder.length) throw new Error('ingen lesbar kilde i nedlastingen')
        for (const kilde of kilder) {
          const { flater } = await lesFlater(kilde, fdir)
          log(`    ${tall(flater.length)} vannflater klassifisert`)
          raFlater.push(...flater)
        }
      } catch (e) {
        log(`    ⚠ ${omrade.name} feilet: ${e.message}`)
        speidBehov ??= velgFormat(omrade, katalog.formater, katalog.projeksjoner).format
      } finally {
        rmSync(fdir, { recursive: true, force: true })
      }
    }
    log(`\n  til sammen ${tall(raFlater.length)} vannflater`)
    rapport.flaterRa = raFlater.length

    // Bommet ALLE kandidatene, er neste spørsmål ikke «hvilken skrivemåte nå?»
    // men «hva ligger der egentlig?». Uten dette koster hver gjetning en ny
    // CI-kjøring — og en 404 sier ingenting om hvilken av base, slug, prefiks
    // eller projeksjon som var feil.
    if (!raFlater.length && speidBehov) {
      log('\n  ingen treff — speider katalogen for å se hva som FAKTISK ligger der:')
      const speid = await speidKatalog(speidBehov)
      rapport.speid = speid
      for (const s of speid) log(`    HTTP ${s.status}  ${s.url}`)
      writeFileSync(join(UT, 'speid.json'), JSON.stringify(speid, null, 2))
      log('    → hele svarene i probe-ut/speid.json')
    }
  })


  const sveip = await trinn('Pakking — hva veier FKB i vårt eget flis-format?', 'mal', async () => {
    if (!raFlater.length) throw new Error('ingen flater å måle')
    const rader = []
    log('  tol  minareal   flater      km²     disk     gzip  største flis')
    for (const tol of TOLERANSER) {
      for (const min of MINAREALER) {
        const m = malFlater(raFlater, tol, min)
        rader.push({ toleranseM: tol, minArealM2: min, ...m })
        log(`  ${String(tol).padStart(3)}  ${String(min).padStart(8)}  ${tall(m.n).padStart(7)}  `
          + `${tall(m.km2, 1).padStart(7)}  ${mb(m.bytes).padStart(8)}  ${mb(m.gz).padStart(8)}  `
          + `${(m.storst / 1e3).toFixed(0)} KB (${m.storstNokkel})`)
      }
    }
    rapport.sveip = rader
    log('\n  Til sammenlikning: N50 elv nasjonalt er 4,2 MB på disk i 4 m / 400 m².')
    return rader
  })

  // ── 5. FKB mot de bakte N50-flisene, i samme bbox ─────────────────────────

  /** Les de bakte N50-elveflatene som overlapper en bbox. */
  async function n50IBbox(bbox) {
    if (!existsSync(N50_VANN)) return []
    const ut = []
    const sett = new Set()
    for (const f of readdirSync(N50_VANN)) {
      if (!f.endsWith('.bin')) continue
      const flater = lesFlis(new Uint8Array(await readFile(join(N50_VANN, f))))
      for (const flate of flater) {
        const b = bboxForRinger(flate.ringer)
        if (!bboxOverlapper(b, bbox)) continue
        // Flatene ligger HELE i hver flis bboxen berører (se n50ArealPakke), så
        // samme flate kan komme flere ganger. Dedupliser på geometri-signatur.
        const sig = `${flate.type}|${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)}`
        if (sett.has(sig)) continue
        sett.add(sig)
        ut.push(flate)
      }
    }
    return ut
  }

  await trinn('FKB mot bakt N50 i samme utsnitt — og hva det betyr nasjonalt', 'jamfor', async () => {
    if (!raFlater.length) throw new Error('ingen FKB-flater å jamføre')
    const bbox = (() => {
      const b = bboxForRinger(raFlater.flatMap(f => f.ringer))
      return b
    })()
    log(`  utsnitt: ${bbox.south.toFixed(3)}–${bbox.north.toFixed(3)} N, ${bbox.west.toFixed(3)}–${bbox.east.toFixed(3)} Ø`)
    const fkbElv = raFlater.filter(f => f.type === 'elv')
    const n50 = (await n50IBbox(bbox)).filter(f => f.type === 'elv')
    // Samme skruer på begge sider, ellers måler forholdet forenklingen og ikke
    // kilden.
    const mFkb = malFlater(fkbElv, 4, 400)
    const mN50 = malFlater(n50, 4, 400)
    log(`  FKB elv: ${tall(mFkb.n)} flater, ${tall(mFkb.km2, 1)} km², ${mb(mFkb.bytes)}`)
    log(`  N50 elv: ${tall(mN50.n)} flater, ${tall(mN50.km2, 1)} km², ${mb(mN50.bytes)}`)
    const N50_NASJONALT = 4_200_000
    const { forhold, anslagBytes, grunn } = nasjonaltAnslag({
      fkbBytes: mFkb.bytes, n50Bytes: mN50.bytes, n50Nasjonalt: N50_NASJONALT,
    })
    if (grunn) log(`  ⚠ ingen nasjonalt anslag: ${grunn}`)
    else {
      log(`  forhold FKB/N50: ${forhold.toFixed(1)}×`)
      log(`  → nasjonalt anslag for FKB elv: ${mb(anslagBytes)} (N50 elv er 4,2 MB)`)
      log(`    public/data veier 129 MB fra før. Over ~50 MB hører dette hjemme i R2.`)
    }
    rapport.jamfor = { bbox, fkb: mFkb, n50: mN50, forhold, anslagBytes }
  })

  // ── 6. Selve utgangsspørsmålet ────────────────────────────────────────────

  await trinn(`${PUNKT.navn} — finnes elva som flate, og hvor bred er den?`, 'punkt', async () => {
    const iBbox = (flater) => flater.filter(f => bboxOverlapper(bboxForRinger(f.ringer), PUNKT))
    const fkb = iBbox(raFlater)
    const n50 = await n50IBbox(PUNKT)
    log(`  bbox: ${PUNKT.south}–${PUNKT.north} N, ${PUNKT.west}–${PUNKT.east} Ø`)
    log(`  FKB: ${tall(fkb.length)} vannflater (${tall(fkb.filter(f => f.type === 'elv').length)} elv)`)
    log(`  N50 (bakt): ${tall(n50.length)} vannflater (${tall(n50.filter(f => f.type === 'elv').length)} elv)`)
    const bredder = fkb.filter(f => f.type === 'elv')
      .map(f => ({ bredde: ringBredde(f.ringer[0]), areal: arealM2(f.ringer[0]) }))
      .sort((a, b) => b.areal - a.areal).slice(0, 15)
    for (const b of bredder) log(`    elveflate ${tall(b.areal)} m², ≈ ${b.bredde.toFixed(1)} m bred`)
    if (bredder.length) {
      const smal = bredder.filter(b => b.bredde < 15).length
      log(`  ${smal} av ${bredder.length} er smalere enn 15 m — det er dem N50 generaliserer bort.`)
    }
    rapport.punktTreff = { fkb: fkb.length, fkbElv: fkb.filter(f => f.type === 'elv').length, n50: n50.length, bredder }
  })

  rmSync(dir, { recursive: true, force: true })
  writeFileSync(join(UT, 'rapport.json'), JSON.stringify(rapport, null, 2))
  log('\nSkrev probe-ut/rapport.json. Ingenting i public/ er endret.')

}
