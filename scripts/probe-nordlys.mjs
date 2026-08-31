#!/usr/bin/env node
// Hva kan et nordlys-lag i Lende faktisk bygges på? EN MÅLING, IKKE EN GATE.
//
// HVORFOR DEN FINNES: services.swpc.noaa.gov er sperret fra utviklingsmiljøene
// (CONNECT 403), akkurat som api.met.no, no.wikipedia.org og NASA. Et nordlys-lag
// kan derfor ikke prøves der det skrives, og prosjektet har fire runder med
// himmelkart bak seg på at en URL man gjetter er en URL som råtner stille
// (v6.3.0). Så: mål FØRST, bygg etterpå.
//
// SPØRSMÅLENE DEN SKAL SVARE PÅ, i den rekkefølgen de avgjør designet:
//   1. Svarer endepunktene i det hele tatt, og krever de en User-Agent?
//   2. Sender de CORS-hoder? Avgjør om vi trenger en rute i lende-proxy eller
//      kan hente rett fra klienten. (MET-ruta finnes fordi User-Agent er en
//      forbudt header i nettleserens fetch — er NOAA i samme båt, er svaret gitt.)
//   3. Hva VEIER OVATION-rutenettet? Det er hele spørsmålet om vi kan hente det
//      på en telefon i felt, eller om Workeren må klippe det til arkets bbox.
//   4. Hvilken koordinat-konvensjon bruker det? 0–360 eller −180..180 er den
//      klassiske fella, og en bom på den gir sannsynligheter fra feil side av
//      jorda — et lag som ser ut til å virke og er helt galt.
//   5. Hva står det FAKTISK over Norge nå? Uten det vet vi ikke om panelet noen
//      gang viser noe interessant, eller om tallene er null hele året.
//   6. Hvilken form har Kp og solvind, og hvor FERSKE er radene? Formen må
//      leses av og ikke antas — og ferskheten kan ikke leses av rekkefølgen.
//
// ── HVA TRE RUNDER 2026-08-31 FAKTISK MÅLTE ─────────────────────────────────
// Står her og ikke bare i en commit-melding, fordi neste økt starter blind.
//
// ALT SVARER MED CORS «*» OG UTEN UA-KRAV. Nordlys trenger derfor IKKE en
// Worker-rute slik værvarselet gjør — MET-ruta finnes fordi User-Agent er en
// forbudt header i nettleserens fetch(), og NOAA stiller ikke det kravet.
// Ruter vi det likevel, er begrunnelsen DATAMENGDE og ikke CORS.
//
// OVATION (json/ovation_aurora_latest.json): 65 160 punkter, 1° × 1°,
//   897 kB rå / 152 kB gzippet, cache-control 60 s.
//   • LENGDEGRAD ER 0–360, ikke −180..180. Fella er stille: 10,4 °E sendt som
//     −349,6 gir svar fra feil side av jorda, og laget ser ut til å virke.
//   • «latest» ER ET VARSEL, ikke et nå-bilde: Observation Time 22:09,
//     Forecast Time 23:16. Panelet må si det, ellers lover vi noe om himmelen
//     i dette øyeblikket som kilden ikke sier.
//   • Norge-skive (55–85°N, −5–40°E): 1426 punkter, 3 kB gzippet. 50× mindre
//     enn hele fila — DET er argumentet for at Workeren klipper.
//   • Målt en rolig natt (Kp 0): Tromsø 10 %, Nordkapp 9 %, Trondheim 3 %,
//     Vardåsen 0 %. Altså ikke null i nord selv når sola sover.
//
// SOLVIND: BRUK summary-FILENE, IKKE rtsw. Begge er like ferske (6–9 min), men
//   /products/summary/solar-wind-speed.json      < 1 kB  {proton_speed, time_tag}
//   /products/summary/solar-wind-mag-field.json  < 1 kB  {bt, bz_gsm, time_tag}
//   /json/rtsw/rtsw_wind_1m.json              2 597 kB  3593 objekter à 26 felt
//   /json/rtsw/rtsw_mag_1m.json               1 542 kB  3726 objekter
// altså ~2 600× forskjell for de to tallene et panel viser. rtsw er riktig kilde
// den dagen vi vil TEGNE en historikk; til ett tall er den ren datamengde.
//
//   OG rtsw HAR EN FELLE SOM SER RIKTIG UT: ARRAYET ER IKKE TIDSSORTERT. Siste
//   rad i wind-fila var ACE fra 2026-08-30T22:22 med active:false — et DØGN
//   gammel — mens nyeste rad var 22:18 samme kveld, kilde SOLAR1. En klient som
//   gjør d[d.length − 1] får altså et plausibelt, men døgngammelt tall. Filtrer
//   på active og velg største time_tag. (Jeg konkluderte selv feil på dette i
//   runde 2, av nettopp den grunnen, og runde 3 rettet det.)
//
// Kp: json/planetary_k_index_1m.json (27 kB, {time_tag, kp_index, estimated_kp})
// Kp-varsel: products/noaa-planetary-k-index-forecast.json (7 kB, 3-t bolker)
//   Begge er OBJEKT-JSON og ikke tabell-JSON ([[hode],[rad],…]) som jeg antok.
//
// MÅLTE 404-ER, så ingen prøver dem igjen: products/solar-wind/plasma-1-day.json,
//   mag-1-day.json, plasma-2-hour.json, mag-2-hour.json, katalogen
//   products/solar-wind/ og products/ovation_aurora_latest.json. Det finnes
//   INGEN egen 30-minutters OVATION — «latest» er varselet.
// ────────────────────────────────────────────────────────────────────────────
//
// Skriver INGENTING og avslutter med 0 uansett — samme prinsipp som
// probe-himmellenker og probe-himmelkart. LES UTSKRIFTEN.
//
// Bruk:
//   node scripts/probe-nordlys.mjs

import { gzipSync } from 'node:zlib'

// NOAA ber om at automatiserte klienter identifiserer seg. Vi måler DESSUTEN om
// det er et krav: uten svar på det vet vi ikke om en klient-fetch kan lykkes.
const UA = 'LendeNordlysprobe/1.0 (https://github.com/gitjanerik/lende; turkart-app)'

const ENDEPUNKT = [
  {
    id: 'ovation',
    hva: 'OVATION-modellen: nordlyssannsynlighet i prosent per lat/lon',
    url: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    // Dette er DEN kilden for «ser jeg noe HER». Kp er ett globalt tall og
    // svarer på et annet spørsmål.
    viktig: true,
  },
  {
    id: 'kp-1m',
    hva: 'Kp-indeks, estimert hvert minutt',
    url: 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  },
  {
    id: 'kp-varsel',
    hva: 'Kp-varsel framover (3-timers bolker)',
    url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
  },
  // SOLVIND: FØRSTE RUNDE BOMMET PÅ BEGGE. `/products/solar-wind/plasma-1-day.json`
  // og `mag-1-day.json` ga 404 — de var skrevet etter hukommelsen, altså nøyaktig
  // den gjettingen proben finnes for å avløse. Runde to LETER i stedet: vi ber om
  // katalogene under (se KATALOGER) og prøver flere navn, så svaret kommer fra
  // NOAA og ikke fra meg.
  {
    id: 'solvind-fart',
    hva: 'KANDIDAT: solvindfart som ETT tall — det panelet faktisk trenger',
    url: 'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',
    kandidat: true,
  },
  {
    id: 'solvind-magfelt',
    hva: 'KANDIDAT: Bt/Bz som ett tall. Bz sør er det som slipper nordlyset ned',
    url: 'https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json',
    kandidat: true,
  },
  {
    id: 'rtsw-plasma',
    hva: 'KANDIDAT: sanntids solvind-plasma, 1-minutt',
    url: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
    kandidat: true,
  },
  {
    id: 'rtsw-mag',
    hva: 'KANDIDAT: sanntids magnetfelt, 1-minutt',
    url: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
    kandidat: true,
  },
  {
    id: 'plasma-2t',
    hva: 'KANDIDAT: plasma siste to timer',
    url: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json',
    kandidat: true,
  },
  {
    id: 'mag-2t',
    hva: 'KANDIDAT: magnetfelt siste to timer',
    url: 'https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json',
    kandidat: true,
  },
  {
    id: 'ovation-30min',
    hva: 'KANDIDAT: 30-minutters nordlysvarsel, om det finnes som eget produkt',
    url: 'https://services.swpc.noaa.gov/products/ovation_aurora_latest.json',
    kandidat: true,
  },
]

// KATALOGENE. Lærdommen fra Wikimedia-proben var at fritekstsøk er ubrukelig og
// KURATERTE lister er gull; her er motstykket en katalogfil. Svarer den, slipper
// vi å gjette et eneste filnavn til.
const KATALOGER = [
  'https://services.swpc.noaa.gov/products/solar-wind/',
  'https://services.swpc.noaa.gov/products/summary/',
  'https://services.swpc.noaa.gov/json/rtsw/',
]

// Steder å slå opp i rutenettet. Valgt etter BREDDEGRAD og ikke etter folketall:
// nordlysovalen ligger rundt 67°N ved rolig aktivitet og presses sørover når det
// tar av, så de fire spenner ut hele spørsmålet «hvem ser noe i kveld».
const STEDER = [
  { navn: 'Nordkapp', lat: 71.17, lon: 25.78 },
  { navn: 'Tromsø', lat: 69.65, lon: 18.96 },
  { navn: 'Trondheim', lat: 63.43, lon: 10.39 },
  { navn: 'Vardåsen (demokartet)', lat: 59.81, lon: 10.41 },
]

const pust = (ms) => new Promise((r) => setTimeout(r, ms))

async function hent(url, medUA) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: medUA ? { 'User-Agent': UA } : {},
      redirect: 'follow',
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      bytes: buf.length,
      cors: res.headers.get('access-control-allow-origin'),
      type: res.headers.get('content-type'),
      cache: res.headers.get('cache-control'),
      buf,
    }
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, feil: String(e.message ?? e) }
  }
}

const kB = (n) => `${(n / 1024).toFixed(0)} kB`

console.log('── Nordlys-probe mot NOAA SWPC ──────────────────────────\n')

const svar = new Map()

for (const e of ENDEPUNKT) {
  const r = await hent(e.url, true)
  svar.set(e.id, r)
  const merke = e.kandidat ? 'kandidat' : (e.viktig ? 'VIKTIG  ' : '        ')
  if (!r.ok) {
    console.log(`✗ ${String(r.status).padStart(3)}  ${merke} ${e.id}`)
    console.log(`        ${e.url}`)
    if (r.feil) console.log(`        ${r.feil}`)
    console.log('')
    continue
  }
  console.log(`✓ ${r.status}  ${merke} ${e.id} — ${e.hva}`)
  console.log(`        ${e.url}`)
  console.log(`        ${kB(r.bytes)} rå, ${kB(gzipSync(r.buf).length)} gzippet, ${r.ms} ms`)
  console.log(`        CORS: ${r.cors ?? 'INGEN — da må den gjennom lende-proxy'}`)
  console.log(`        cache-control: ${r.cache ?? '—'}`)
  console.log('')
  await pust(400)
}

// --- Hva LIGGER det i katalogene? -------------------------------------------
// Dette er svaret på solvind-spørsmålet om det finnes, og det er en måling og
// ikke en hypotese. Vi plukker ut .json-navn og lar utskriften vise dem.
console.log('── Kataloger ────────────────────────────────────────────')
for (const url of KATALOGER) {
  const r = await hent(url, true)
  if (!r.ok) { console.log(`✗ ${r.status || r.feil}  ${url}`); await pust(400); continue }
  const tekst = r.buf.toString('utf8')
  const filer = [...new Set([...tekst.matchAll(/href="([^"]+\.json)"/gi)].map((m) => m[1]))]
  console.log(`✓ ${r.status}  ${url} — ${filer.length} .json-filer`)
  for (const f of filer.sort()) console.log(`        ${f}`)
  console.log('')
  await pust(400)
}

// --- Krever de en User-Agent? -----------------------------------------------
// MET gjør det, og det er hele grunnen til at værvarselet går gjennom Workeren:
// User-Agent er en FORBUDT header i nettleserens fetch(), så et klient-kall kan
// ikke oppfylle vilkåret uansett hvor snill CORS-en er. Er NOAA i samme båt,
// er ruta i lende-proxy gitt — uavhengig av hva CORS-hodet sier.
console.log('── Krever endepunktene en User-Agent? ───────────────────')
for (const e of ENDEPUNKT.filter((x) => !x.kandidat)) {
  const med = svar.get(e.id)
  if (!med?.ok) { console.log(`  ${e.id}: hoppet over (svarte ikke med UA)`); continue }
  const uten = await hent(e.url, false)
  const dom = uten.ok ? 'NEI — svarer uten også' : `JA — ${uten.status || uten.feil} uten UA`
  console.log(`  ${e.id.padEnd(16)} ${dom}`)
  await pust(400)
}
console.log('')

// --- OVATION: form, vekt og hva som står over Norge -------------------------
const ov = svar.get('ovation')
if (ov?.ok) {
  console.log('── OVATION-rutenettet ───────────────────────────────────')
  let d
  try {
    d = JSON.parse(ov.buf.toString('utf8'))
  } catch (e) {
    console.log(`  KUNNE IKKE PARSES: ${e.message}`)
    d = null
  }
  if (d) {
    for (const k of Object.keys(d)) {
      if (k !== 'coordinates') console.log(`  ${k}: ${JSON.stringify(d[k])}`)
    }
    const c = d.coordinates ?? []
    console.log(`  coordinates: ${c.length} oppføringer, første: ${JSON.stringify(c[0])}`)

    // KOORDINAT-KONVENSJONEN, som er fella. Vi leser den av dataene framfor å
    // anta: er største lengdegrad over 180, er rutenettet 0–360.
    let minLon = Infinity; let maxLon = -Infinity
    let minLat = Infinity; let maxLat = -Infinity
    const lons = new Set(); const lats = new Set()
    for (const [lon, lat] of c) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      lons.add(lon); lats.add(lat)
    }
    console.log(`  lengdegrad ${minLon}..${maxLon} (${lons.size} unike) — `
      + `konvensjon: ${maxLon > 180 ? '0–360' : '−180..180'}`)
    console.log(`  breddegrad ${minLat}..${maxLat} (${lats.size} unike)`)
    console.log(`  oppløsning: ${(360 / lons.size).toFixed(2)}° lon × `
      + `${(180 / lats.size).toFixed(2)}° lat`)

    // Slå opp de fire stedene. Nærmeste rutepunkt holder — rutenettet er grovt,
    // og et nordlys-lag skal uansett ikke late som det vet mer enn kilden.
    const til360 = (lon) => (maxLon > 180 ? (lon + 360) % 360 : lon)
    console.log('\n  Nordlyssannsynlighet NÅ:')
    for (const s of STEDER) {
      const mål = til360(s.lon)
      let best = null; let bd = Infinity
      for (const rad of c) {
        const dl = Math.min(Math.abs(rad[0] - mål), 360 - Math.abs(rad[0] - mål))
        const d2 = dl * dl + (rad[1] - s.lat) ** 2
        if (d2 < bd) { bd = d2; best = rad }
      }
      console.log(`    ${s.navn.padEnd(22)} ${String(best?.[2] ?? '?').padStart(3)} %`
        + `   (rutepunkt ${best?.[0]}°, ${best?.[1]}°)`)
    }

    // HVA VEIER EN NORGE-SKIVE? Dette er tallet som avgjør om Workeren må klippe.
    // Bboksen er raus med vilje: Lende brukes fra Lindesnes til Nordkapp, og
    // ovalen man SER ligger nord for der man står.
    const iNorge = c.filter(([lon, lat]) => {
      const l = maxLon > 180 ? (lon > 180 ? lon - 360 : lon) : lon
      return lat >= 55 && lat <= 85 && l >= -5 && l <= 40
    })
    const skive = JSON.stringify(iNorge)
    console.log(`\n  Norge-skive (55–85°N, −5–40°E): ${iNorge.length} punkter, `
      + `${kB(Buffer.byteLength(skive))} rå, ${kB(gzipSync(Buffer.from(skive)).length)} gzippet`)
    console.log(`  Hele fila til sammenlikning:    ${c.length} punkter, `
      + `${kB(ov.bytes)} rå, ${kB(gzipSync(ov.buf).length)} gzippet`)
    console.log('')
  }
}

// --- Kp og solvind: feltrekkefølgen leses av, ikke antas --------------------
for (const id of ['kp-1m', 'kp-varsel', 'solvind-fart', 'solvind-magfelt',
  'rtsw-plasma', 'rtsw-mag', 'plasma-2t', 'mag-2t']) {
  const r = svar.get(id)
  if (!r?.ok) continue
  console.log(`── ${id} ────────────────────────────────────────`)
  let d
  try { d = JSON.parse(r.buf.toString('utf8')) } catch { console.log('  ikke JSON\n'); continue }
  if (Array.isArray(d) && Array.isArray(d[0])) {
    console.log(`  tabell-JSON: ${d.length} rader`)
    console.log(`  hode:  ${JSON.stringify(d[0])}`)
    console.log(`  siste: ${JSON.stringify(d[d.length - 1])}`)
  } else if (Array.isArray(d)) {
    console.log(`  ${d.length} objekter, siste: ${JSON.stringify(d[d.length - 1])}`)
    // FERSKHET, og den må måles og ikke leses av rekkefølgen: rtsw-filene fletter
    // ACE og DSCOVR, så SISTE rad er ikke nødvendigvis den nyeste — og en rad kan
    // være merket active:false. Et panel som viser «siste rad» kan derfor vise et
    // døgngammelt tall uten at noe ser galt ut.
    const tid = (o) => Date.parse(String(o?.time_tag ?? '').replace(' ', 'T')
      + (String(o?.time_tag ?? '').endsWith('Z') ? '' : 'Z'))
    const gyldige = d.filter((o) => Number.isFinite(tid(o)))
    if (gyldige.length) {
      const nyest = gyldige.reduce((a2, b2) => (tid(b2) > tid(a2) ? b2 : a2))
      const alder = (Date.now() - tid(nyest)) / 60000
      console.log(`  nyeste time_tag: ${nyest.time_tag} (${alder.toFixed(0)} min gammel)`)
      if (gyldige.some((o) => 'active' in o)) {
        const aktive = gyldige.filter((o) => o.active)
        if (aktive.length) {
          const na = aktive.reduce((a2, b2) => (tid(b2) > tid(a2) ? b2 : a2))
          console.log(`  nyeste med active:true: ${na.time_tag} `
            + `(${((Date.now() - tid(na)) / 60000).toFixed(0)} min, kilde ${na.source})`)
        } else {
          console.log('  INGEN rad har active:true — hele fila er passiv')
        }
      }
    }
  } else {
    console.log(`  ${JSON.stringify(d).slice(0, 300)}`)
  }
  console.log('')
}

console.log('── Slik leses dette ─────────────────────────────────────')
console.log('CORS «*» + ingen UA-krav  → klienten kan hente selv, ingen Worker-rute.')
console.log('UA-krav                   → må gjennom lende-proxy, som værvarselet:')
console.log('                            User-Agent er forbudt i nettleserens fetch().')
console.log('Norge-skive ≫ noen hundre kB → Workeren MÅ klippe til bbox og cache.')
console.log('Sannsynlighet 0 % overalt → kjør proben igjen en natt med aktivitet før')
console.log('                            du konkluderer; det kan være rolig sol.')
