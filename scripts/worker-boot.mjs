#!/usr/bin/env node
// Booter Cloudflare-Workerne i den EKTE runtimen (workerd) og sjekker at de
// svarer. Gaten som mangler mellom «bygget går» og «deployen går».
//
// HVORFOR: mcp-Workeren bundler inn `mcp/headless.js`, som er skrevet for Node.
// Fra v5.0.16 regnet den ut en katalogsti på modulnivå med
// `fileURLToPath(import.meta.url)`. I workerd er `import.meta.url` undefined, så
// Workeren kastet i det den startet — og HVER ENESTE deploy til Cloudflare
// feilet, i dagevis, mens alle PR-sjekker sto grønne. Feilen dukket først opp
// ETTER merge, i en workflow ingen leser før den har feilet mange nok ganger.
//
// Verken `npm run build`, `npm run test` eller `wrangler deploy --dry-run`
// fanger dette: de bygger og bundler, men kjører aldri modulen i workerd.
// `wrangler check startup` gjør det heller ikke — den profilerer oppstarten og
// returnerer 0 selv når Workeren kaster. Det som fanger det er å faktisk starte
// den, og det er det denne gjør: `wrangler dev --local` (workerd, ingen
// Cloudflare-konto, ingen nett-avhengighet) + ett HTTP-kall.
//
//   node scripts/worker-boot.mjs [katalog ...]
//
// Uten argumenter sjekkes alle Workerne under cloudflare/.
//
// Sjekken er «svarer runtimen?», ikke «finnes ruta?»: ETHVERT HTTP-svar teller
// som en vellykket oppstart. lende-proxy returnerer 404 på alt annet enn sine
// to ruter — med vilje, den skal ikke være en åpen proxy — og et krav om 200
// ville gjort den evig rød uten at noe var galt.

import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HELSE_STI = '/health'
const BOOT_TIMEOUT_MS = 120_000
const POLL_MS = 500

// Feil-signaturer fra workerd/wrangler som betyr «denne kommer aldri opp».
// Å oppdage dem med en gang sparer to minutter timeout per Worker.
const DØDS_MØNSTER = /Uncaught \w*Error|runtime failed to start|\[ERROR\]/i

function alleWorkere() {
  const base = join(ROT, 'cloudflare')
  if (!existsSync(base)) return []
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(base, d.name, 'wrangler.toml')))
    .map((d) => join(base, d.name))
    .sort()
}

function ledigPort() {
  return new Promise((ok, nei) => {
    const s = createServer()
    s.on('error', nei)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => ok(port))
    })
  })
}

// node:http snakker rett til 127.0.0.1 og bryr seg ikke om HTTPS_PROXY —
// global fetch ville ellers sendt loopback-kallet ut på proxyen.
function hentHelse(port) {
  return new Promise((ok) => {
    const req = request(
      { host: '127.0.0.1', port, path: HELSE_STI, method: 'GET', timeout: 4000 },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => ok({ status: res.statusCode, body }))
      },
    )
    req.on('error', () => ok(null))
    req.on('timeout', () => { req.destroy(); ok(null) })
    req.end()
  })
}

const sov = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function bootEnWorker(katalog) {
  const navn = (readFileSync(join(katalog, 'wrangler.toml'), 'utf8')
    .match(/^name\s*=\s*"([^"]+)"/m) ?? [])[1] ?? katalog
  const port = await ledigPort()

  // `detached` gir barnet sin egen prosessgruppe. npx starter wrangler, som
  // starter workerd — et SIGTERM til npx alene lar barnebarna leve videre, og
  // da avsluttes aldri dette scriptet.
  const barn = spawn(
    'npx',
    ['wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port)],
    { cwd: katalog, detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
  )

  let logg = ''
  let døde = null
  const samle = (buf) => { logg += buf.toString() }
  barn.stdout.on('data', samle)
  barn.stderr.on('data', samle)
  barn.on('exit', (kode) => { døde = kode ?? 0 })

  const rydd = () => {
    try { process.kill(-barn.pid, 'SIGKILL') } catch { /* gruppa er alt borte */ }
    try { barn.kill('SIGKILL') } catch { /* likeså */ }
  }
  const frist = Date.now() + BOOT_TIMEOUT_MS
  try {
    while (Date.now() < frist) {
      const svar = await hentHelse(port)
      if (svar) {
        const kropp = svar.body.trim().slice(0, 150)
        return {
          navn,
          ok: true,
          detalj: `HTTP ${svar.status}${kropp ? ` · ${kropp}` : ''}`,
        }
      }
      if (døde !== null || DØDS_MØNSTER.test(logg)) {
        return { navn, ok: false, detalj: kortLogg(logg) }
      }
      await sov(POLL_MS)
    }
    return { navn, ok: false, detalj: `svarte ikke på ${HELSE_STI} innen ${BOOT_TIMEOUT_MS / 1000} s\n${kortLogg(logg)}` }
  } finally {
    rydd()
  }
}

// Wrangler skriver mye banner; vi vil ha linjene som forklarer feilen.
function kortLogg(logg) {
  const linjer = logg.split('\n').map((l) => l.replace(/\[[0-9;]*m/g, '').trimEnd())
  const interessante = linjer.filter((l) => l.trim() && /error|uncaught|failed|at /i.test(l))
  return (interessante.length ? interessante : linjer.filter((l) => l.trim())).slice(-14).join('\n')
}

const kataloger = process.argv.slice(2).map((p) => resolve(p))
const mål = kataloger.length ? kataloger : alleWorkere()
if (!mål.length) {
  console.log('worker-boot: fant ingen Workere å sjekke')
  process.exit(0)
}

console.log(`worker-boot: starter ${mål.length} Worker(e) i workerd\n`)
let feil = 0
for (const k of mål) {
  // Workerne har egne avhengigheter; uten dem er dette ikke en ekte sjekk.
  if (!existsSync(join(k, 'node_modules'))) {
    console.log(`⊘ ${k} — node_modules mangler, kjør npm install der først`)
    feil++
    continue
  }
  const r = await bootEnWorker(k)
  if (r.ok) {
    console.log(`✓ ${r.navn} — runtimen startet og svarte`)
    console.log(`  ${r.detalj}\n`)
  } else {
    feil++
    console.log(`✗ ${r.navn} — startet IKKE`)
    console.log(`${r.detalj}\n`)
  }
}

if (feil) {
  console.log(`✗ ${feil} Worker(e) starter ikke — deployen ville feilet`)
} else {
  console.log('✓ alle Workere starter i workerd')
}
// Eksplisitt: workerd kan ha etterlatt håndtak som ellers holder løkka i live.
process.exit(feil ? 1 : 0)
