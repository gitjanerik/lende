#!/usr/bin/env node
// Avhengighets-status for alle fire katalogene i én tabell.
//
// Hvorfor den finnes: `npm audit` i rot-treet svarer på et annet spørsmål enn du
// tror. Rot-treet er APPEN og verktøykjeden; de tre Workerne har hver sin
// package.json som deployes for seg, og kan ha andre versjoner av samme pakke.
// I august 2026 sto `@modelcontextprotocol/sdk` på 1.29 i rot (dev-bare) og på
// 1.23 nestet inne i `agents` i den DEPLOYEDE MCP-Workeren. Ett `npm audit` fra
// rota ville aldri vist det som betyr noe.
//
// Skriptet SORTERER derfor etter hva funnet treffer, ikke etter alvorsgrad:
// nettleser-bunten først, så det som er deployet, så dev-bare. En «high» i
// wrangler er ikke verre enn en «moderate» i noe brukerne laster ned.
//
// Rapporten svarer på TO spørsmål, og de er ulike: `npm audit`/`npm outdated`
// spør «er denne katalogen i orden?», mens versjonsdriften nederst spør «svarer
// de fire katalogene likt om samme pakke?». Dependabot ser hver katalog for seg
// og kan per konstruksjon ikke stille det andre spørsmålet.
//
// Bruk:
//   npm run vedlikehold             # audit + outdated + drift, alle kataloger
//   npm run vedlikehold -- --json   # maskinlesbart: { kataloger, drift }
//   npm run vedlikehold -- --audit  # bare sårbarheter + drift (raskere)

import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { deklarerteVersjoner, laasteVersjoner, finnDrift } from './versjonsdrift.mjs'

const kjør = promisify(execFile)
const ROT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const JSON_UT = process.argv.includes('--json')
const BARE_AUDIT = process.argv.includes('--audit')

// `flate` = hvor et funn her faktisk kan gjøre skade. Rekkefølgen i denne lista
// er rekkefølgen i rapporten.
const KATALOGER = [
  {
    navn: 'app (rot)',
    sti: '.',
    flate: 'nettleser + verktøykjede',
    merk: 'runtime-avhengigheter havner i bunten brukerne laster ned; '
      + 'devDependencies gjør det ikke',
  },
  {
    navn: 'mcp-worker',
    sti: 'cloudflare/mcp-worker',
    flate: 'DEPLOYERT (token-gatet)',
    merk: 'står på nett bak LENDE_AI_TOKENS — funn her veier tyngst',
  },
  { navn: 'proxy', sti: 'cloudflare/proxy', flate: 'DEPLOYERT', merk: 'ingen runtime-deps' },
  { navn: 'ai-worker', sti: 'cloudflare/ai-worker', flate: 'DEPLOYERT', merk: 'ingen runtime-deps' },
]

const ALVOR = ['critical', 'high', 'moderate', 'low', 'info']

/**
 * `npm audit` og `npm outdated` returnerer BEGGE exit-kode ulik 0 når de finner
 * noe. Det er ikke en feil — det er svaret. Fanges det ikke, ser et helt normalt
 * funn ut som at skriptet krasjet.
 */
async function npmJson(args, cwd) {
  try {
    const { stdout } = await kjør('npm', args, { cwd, maxBuffer: 64 * 1024 * 1024 })
    return { ok: true, data: stdout.trim() ? JSON.parse(stdout) : {} }
  } catch (err) {
    if (err.stdout?.trim()) {
      try { return { ok: true, data: JSON.parse(err.stdout) } } catch { /* faller gjennom */ }
    }
    return { ok: false, feil: (err.stderr || err.message || '').split('\n')[0].slice(0, 160) }
  }
}

async function sePåKatalog(k) {
  const cwd = join(ROT, k.sti)
  if (!existsSync(join(cwd, 'package.json'))) return { ...k, hoppet: 'ingen package.json' }

  const ut = { ...k, sårbarheter: [], utdaterte: [], oppsummering: null }

  const a = await npmJson(['audit', '--json'], cwd)
  if (!a.ok) ut.auditFeil = a.feil
  else {
    ut.oppsummering = a.data.metadata?.vulnerabilities ?? null
    for (const [navn, v] of Object.entries(a.data.vulnerabilities ?? {})) {
      // `via` er enten strenger (transitivt: navnet på pakka som drar det inn)
      // eller objekter (direkte: selve rådgivningen). Skillet er hele grunnen
      // til at vi kan si «transitiv» uten å gjette.
      const titler = (v.via ?? []).filter((x) => typeof x === 'object').map((x) => x.title)
      const via = (v.via ?? []).filter((x) => typeof x === 'string')
      const fa = v.fixAvailable
      ut.sårbarheter.push({
        navn,
        alvor: v.severity,
        direkte: v.isDirect === true,
        via,
        titler,
        // isSemVerMajor er det ENESTE feltet som skiller «bump og glem» fra
        // «dette trenger en egen PR med testing».
        fiks: fa === true ? 'patch tilgjengelig'
          : fa && typeof fa === 'object'
            ? `${fa.name}@${fa.version}${fa.isSemVerMajor ? ' (MAJOR)' : ''}`
            : 'ingen fiks',
      })
    }
    ut.sårbarheter.sort((x, y) => ALVOR.indexOf(x.alvor) - ALVOR.indexOf(y.alvor))
  }

  if (!BARE_AUDIT) {
    const o = await npmJson(['outdated', '--json'], cwd)
    if (!o.ok) ut.outdatedFeil = o.feil
    else {
      for (const [navn, v] of Object.entries(o.data ?? {})) {
        const siste = v.latest ?? '?'
        // `current` er UNDEFINED når pakka ikke er installert i den katalogen —
        // og i CI er den ikke det for Workerne, som bare får `npm install` i sin
        // egen jobb. Uten denne grenen ble «? → 1.30.0» lest som et
        // major-sprang, og CI-loggen for #300 meldte tre major der det var to.
        // Vi kan ikke si noe om spranget uten å vite hvor vi står; da sier vi
        // det, framfor å gjette.
        if (v.current == null) {
          ut.utdaterte.push({ navn, nå: 'ikke installert', ønsket: v.wanted ?? '?', siste, ukjent: true })
          continue
        }
        const nå = v.current
        // Noen pakker har en `latest`-tag som peker BAKOVER (geotiff sto på
        // 3.0.17 mens latest var 3.0.5). Å rapportere det som «utdatert» ville
        // sendt neste økt på leting etter en oppgradering som ikke finnes.
        if (nå === siste) continue
        ut.utdaterte.push({
          navn, nå, ønsket: v.wanted ?? '?', siste,
          major: erBrytende(nå, siste),
          bakover: erNyereEnn(nå, siste),
        })
      }
      ut.utdaterte.sort((x, y) => Number(y.major) - Number(x.major) || x.navn.localeCompare(y.navn))
    }
  }
  return ut
}

/**
 * Leser de to filene versjonsdriften trenger. Feiler ALDRI hardt: en katalog
 * uten lockfile skal bidra til den deklarerte lista og ikke til den låste, og en
 * ødelagt fil skal ikke ta ned en rapport som ellers har noe å si.
 */
function lesVersjoner(k) {
  const cwd = join(ROT, k.sti)
  const les = (fil) => {
    try {
      return existsSync(join(cwd, fil)) ? JSON.parse(readFileSync(join(cwd, fil), 'utf-8')) : null
    } catch { return null }
  }
  const pkg = les('package.json')
  const lock = les('package-lock.json')
  return {
    navn: k.navn,
    flate: k.flate,
    deklarert: pkg ? deklarerteVersjoner(pkg) : new Map(),
    laast: lock ? laasteVersjoner(lock) : new Map(),
  }
}

/**
 * Er spranget BRYTENDE? Under semver er 0.x et eget regime: der er MINOR-feltet
 * det brytende, ikke major. `agents` 0.2.35 → 0.21.0 er et brudd som endrer API,
 * men en naiv major-sammenlikning leser begge som «0» og legger det i
 * samle-PR-en med fontene. npm audit visste dette (isSemVerMajor), rapporten
 * gjorde det ikke — den bommet på nøyaktig den ene oppgraderingen i treet som
 * trenger en egen gjennomgang.
 */
function erBrytende(fra, til) {
  const p = (v) => String(v).replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const [a, b] = [p(fra), p(til)]
  if ((a[0] ?? 0) !== (b[0] ?? 0)) return true
  if ((a[0] ?? 0) === 0) return (a[1] ?? 0) !== (b[1] ?? 0)
  return false
}

function erNyereEnn(a, b) {
  const p = (v) => String(v).replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const [x, y] = [p(a), p(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

function skrivDrift(drift) {
  console.log('\n── versjonsdrift mellom katalogene ──────────────────')
  console.log('   Samme pakke, ulik versjon i to av de fire trærne. Dependabot')
  console.log('   ser hver katalog for seg og kan ikke se dette.')

  const del = (tittel, funn, forklaring) => {
    if (!funn.length) { console.log(`   ✓ ${tittel}: ingen drift`); return }
    console.log(`\n   ${tittel} (${funn.length})`)
    console.log(`   ${forklaring}`)
    for (const f of funn) {
      console.log(`     ${f.navn}`)
      for (const r of f.rader) console.log(`       ${r.katalog.padEnd(14)} ${r.versjoner.join(', ')}`)
    }
  }

  // De to listene sammenliknes ALDRI mot hverandre: `^4.0.0` og `4.125.3` er
  // ikke et avvik, de er to ulike spørsmål. Se versjonsdrift.mjs.
  del('deklarert (package.json)', drift.deklarert,
    'To package.json ber om ulikt. Dette er et VALG som har drevet fra hverandre.')
  del('låst (package-lock.json)', drift.laast,
    'Trærne har fått ulikt. Ofte uunngåelig og ofte uten betydning — les flata.')
}

function skrivTekst(rader) {
  let funnTotalt = 0
  let majorTotalt = 0
  for (const r of rader) {
    console.log(`\n── ${r.navn}  ·  ${r.flate} ${'─'.repeat(Math.max(2, 52 - r.navn.length - r.flate.length))}`)
    console.log(`   ${r.merk}`)
    if (r.hoppet) { console.log(`   ⊘ ${r.hoppet}`); continue }

    if (r.auditFeil) console.log(`   ⚠ audit feilet: ${r.auditFeil}`)
    else if (!r.sårbarheter.length) console.log('   ✓ ingen kjente sårbarheter')
    else {
      const s = r.oppsummering ?? {}
      const sum = ALVOR.filter((a) => s[a]).map((a) => `${s[a]} ${a}`).join(', ')
      console.log(`   sårbarheter: ${sum || r.sårbarheter.length}`)
      for (const v of r.sårbarheter) {
        funnTotalt++
        if (/MAJOR/.test(v.fiks)) majorTotalt++
        const opphav = v.direkte ? 'DIREKTE' : v.via.length ? `via ${v.via.join(', ')}` : 'transitiv'
        console.log(`     ${v.alvor.padEnd(8)} ${v.navn.padEnd(30)} ${opphav}`)
        if (v.titler[0]) console.log(`              ${v.titler[0].slice(0, 96)}`)
        console.log(`              fiks: ${v.fiks}`)
      }
    }

    if (BARE_AUDIT) continue
    if (r.outdatedFeil) console.log(`   ⚠ outdated feilet: ${r.outdatedFeil}`)
    else if (!r.utdaterte.length) console.log('   ✓ alt på siste versjon')
    else {
      const ukjent = r.utdaterte.filter((u) => u.ukjent)
      const major = r.utdaterte.filter((u) => u.major && !u.bakover && !u.ukjent)
      const små = r.utdaterte.filter((u) => !u.major && !u.bakover && !u.ukjent)
      const bakover = r.utdaterte.filter((u) => u.bakover && !u.ukjent)
      if (major.length) {
        console.log(`   major tilgjengelig (${major.length}) — hver sin PR:`)
        for (const u of major) console.log(`     ${u.navn.padEnd(34)} ${u.nå} → ${u.siste}`)
      }
      if (små.length) {
        console.log(`   patch/minor (${små.length}) — Dependabot samler disse:`)
        for (const u of små) console.log(`     ${u.navn.padEnd(34)} ${u.nå} → ${u.siste}`)
      }
      if (bakover.length) {
        console.log(`   registerets «latest» peker BAKOVER (${bakover.length}) — ikke utdatert:`)
        for (const u of bakover) console.log(`     ${u.navn.padEnd(34)} ${u.nå} (latest-tag: ${u.siste})`)
      }
      if (ukjent.length) {
        console.log(`   ikke installert her (${ukjent.length}) — spranget kan ikke bedømmes:`)
        for (const u of ukjent) console.log(`     ${u.navn.padEnd(34)} range ${u.ønsket} · siste ${u.siste}`)
      }
    }
  }

  console.log(`\n── sum ─────────────────────────────────────────────`)
  console.log(`   ${funnTotalt} sårbarhetsfunn, ${majorTotalt} av dem krever et major-sprang`)
  console.log('   Rekkefølgen over er etter FLATE, ikke alvorsgrad: en high i')
  console.log('   wrangler er dev-bare, en moderate i nettleser-bunten er ikke.')
  console.log('   npm audit fix dekker patch-nivået; major-ene trenger en PR hver.\n')
}

const rader = []
for (const k of KATALOGER) rader.push(await sePåKatalog(k))

// Drift leser BARE filer på disk — ingen nett, ingen npm — så den kjører også
// med `--audit`, som er der for å slippe unna `npm outdated`s round-trips.
const drift = finnDrift(KATALOGER.filter((k) => existsSync(join(ROT, k.sti, 'package.json'))).map(lesVersjoner))

if (JSON_UT) console.log(JSON.stringify({ kataloger: rader, drift }, null, 2))
else { skrivTekst(rader); skrivDrift(drift) }

// Alltid 0. Dette er en RAPPORT, ikke en gate — samme begrunnelse som
// tredjeparts-røyktestene i deploy-proxy.yml: en PR om skyene skal ikke
// blokkeres av at wrangler har en dårlig dag.
process.exit(0)
