#!/usr/bin/env node
// Kjører MCP-PROTOKOLLEN mot lende-mcp i workerd: initialize → tools/list →
// tools/call. Gaten mellom «runtimen starter» og «verktøyene virker».
//
// HVORFOR den er en egen gate ved siden av worker-boot: `worker-boot` beviser at
// modulen laster og at /health svarer. Verktøyenes zod-skjemaer fyrer ikke der —
// de serialiseres først i `tools/list` og brukes til validering i `tools/call`.
// Ved agents 0.2 → 0.21 (v5.22.3) gikk BÅDE MCP-SDK-en (1.29 → 1.30), zod
// (3 → 4) og handler-stien (sessionful legacy, nå eksplisitt) samtidig. Et
// verktøy som kommer ut med tomt skjema, eller en validering som plutselig
// avviser gyldige argumenter, ville vist seg som et ubrukelig verktøy i en fjern
// klient — ikke som en Worker som ikke starter.
//
// Den deployede workflowen (deploy-mcp-worker.yml) gjør det samme mot ekte
// Cloudflare, men det skjer ETTER merge. Det er samme feilklasse som ga oss
// atten deploys på rad i rødt fra v5.0.16 til v5.18.2: PR-en var grønn fordi
// ingen gate kjørte koden.
//
// Kjøres offline: bare verktøy som ikke trenger nett velges for tools/call.

import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER = join(ROT, 'cloudflare/mcp-worker')
const BOOT_TIMEOUT_MS = 120_000
const TOKEN = 'protokoll-royk-token'
const DØDS_MØNSTER = /Uncaught \w*Error|runtime failed to start|\[ERROR\]/i

function ledigPort() {
  return new Promise((ok, nei) => {
    const s = createServer()
    s.on('error', nei)
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)) })
  })
}

// node:http, ikke fetch: fetch respekterer HTTPS_PROXY og ville sendt et
// loopback-kall ut på proxyen. Samme grunn som i worker-boot.mjs.
function http(port, { sti = '/mcp', metode = 'POST', kropp = null, headere = {} }) {
  return new Promise((ok) => {
    const data = kropp == null ? null : JSON.stringify(kropp)
    const req = request({
      host: '127.0.0.1', port, path: sti, method: metode, timeout: 60_000,
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: `Bearer ${TOKEN}`,
        ...headere,
        ...(data ? { 'content-length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let b = ''
      res.on('data', (c) => { b += c })
      res.on('end', () => ok({ status: res.statusCode, headere: res.headers, tekst: b }))
    })
    req.on('error', (e) => ok({ status: 0, tekst: String(e.message) }))
    req.on('timeout', () => { req.destroy(); ok({ status: 0, tekst: 'timeout' }) })
    if (data) req.write(data)
    req.end()
  })
}

/**
 * Streamable HTTP svarer med `text/event-stream` når klienten godtar det, og
 * SDK-en gjør det som standard. Én JSON-parse av kroppen ville derfor feilet på
 * et helt korrekt svar — vi må plukke `data:`-linjene ut først.
 */
function lesJsonRpc(svar) {
  const t = (svar.tekst ?? '').trim()
  if (!t) return null
  if (/^event:|^data:/m.test(t)) {
    for (const linje of t.split('\n')) {
      if (!linje.startsWith('data:')) continue
      try { return JSON.parse(linje.slice(5).trim()) } catch { /* prøv neste */ }
    }
    return null
  }
  try { return JSON.parse(t) } catch { return null }
}

const sov = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function start(port) {
  const barn = spawn('npx', [
    'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port),
    // Secreten settes ALDRI i wrangler.toml (deploy-workflowen pusher den fra
    // en GitHub-secret), så den må inn her — ellers svarer alt 401 og gaten
    // ville «bestått» ved å aldri komme til verktøyene.
    '--var', `LENDE_AI_TOKENS:${TOKEN}`,
  ], { cwd: WORKER, detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })

  let logg = ''
  let døde = null
  const samle = (b) => { logg += b.toString() }
  barn.stdout.on('data', samle)
  barn.stderr.on('data', samle)
  barn.on('exit', (k) => { døde = k ?? 0 })

  const frist = Date.now() + BOOT_TIMEOUT_MS
  while (Date.now() < frist) {
    const h = await http(port, { sti: '/health', metode: 'GET' })
    if (h.status) return { barn, logg: () => logg }
    if (døde !== null || DØDS_MØNSTER.test(logg)) throw new Error(`Workeren døde:\n${logg.slice(-1200)}`)
    await sov(500)
  }
  throw new Error(`Workeren svarte ikke innen ${BOOT_TIMEOUT_MS / 1000} s:\n${logg.slice(-1200)}`)
}

const resultat = []
function sjekk(navn, ok, detalj) {
  resultat.push({ navn, ok, detalj })
  console.log(`${ok ? '✓' : '✗'} ${navn}${detalj ? ` — ${detalj}` : ''}`)
}

const port = await ledigPort()
console.log(`mcp-protokoll: starter lende-mcp i workerd på ${port} …\n`)
let barn = null
try {
  ({ barn } = await start(port))

  // 1. initialize. Sesjons-IDen herfra MÅ følge med på alt videre — den
  //    sessionful transporten avviser ellers kallene med «No valid session».
  const init = await http(port, {
    kropp: {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2025-06-18', capabilities: {},
        clientInfo: { name: 'lende-protokoll-royk', version: '1.0' },
      },
    },
  })
  const initSvar = lesJsonRpc(init)
  const sesjon = init.headere?.['mcp-session-id']
  const versjon = initSvar?.result?.serverInfo?.version
  sjekk('initialize svarer med serverInfo', Boolean(versjon),
    versjon ? `versjon ${versjon}${sesjon ? `, sesjon ${sesjon.slice(0, 8)}…` : ''}` : `HTTP ${init.status}: ${init.tekst.slice(0, 200)}`)
  if (!versjon) throw new Error('initialize feilet — resten er meningsløst')

  const sesjonsHode = sesjon ? { 'mcp-session-id': sesjon } : {}
  await http(port, {
    kropp: { jsonrpc: '2.0', method: 'notifications/initialized' },
    headere: sesjonsHode,
  })

  // 2. tools/list. DETTE er zod-gaten: SDK-en serialiserer hvert inputSchema
  //    til JSON Schema her, så et ugyldig skjema slår ut nå.
  const liste = await http(port, {
    kropp: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    headere: sesjonsHode,
  })
  const l = lesJsonRpc(liste)
  const verktoy = l?.result?.tools ?? []
  sjekk('tools/list gir verktøy med skjema', verktoy.length > 0,
    verktoy.length ? `${verktoy.length} verktøy` : `HTTP ${liste.status}: ${liste.tekst.slice(0, 300)}`)

  // Et verktøy uten `properties` er et verktøy ingen klient kan kalle. Zod 4
  // ville ikke KASTET på `z.record(v)` — det er `z.record` som er strengere,
  // og feilen viser seg som et skjema som mangler felt. Derfor sjekkes formen,
  // ikke bare at kallet gikk gjennom.
  const utenSkjema = verktoy.filter((t) => !t.inputSchema || t.inputSchema.type !== 'object')
  sjekk('alle verktøy har et object-inputSchema', utenSkjema.length === 0,
    utenSkjema.length ? `mangler: ${utenSkjema.map((t) => t.name).join(', ')}` : `${verktoy.length}/${verktoy.length} ok`)

  // `juster_kart` bruker z.record (`lag` og `strek`) — den skjematypen som er
  // vanskeligst å få riktig gjennom en JSON Schema-serialisering, siden nøklene
  // er ukjente. Den skal komme ut som `type: object` med `additionalProperties`
  // som beskriver VERDItypen. Blir den stående tom, har klienten et felt den
  // ikke kan fylle, uten at noe kastet noe sted.
  //
  // Merk for ettertiden: zod 4.4 godtar fortsatt `z.record(v)` med ett argument
  // (målt, ikke antatt — jeg trodde først den var blitt strengere). Vi skriver
  // nøkkeltypen eksplisitt fordi det er den dokumenterte signaturen, ikke fordi
  // migreringen krevde det.
  const juster = verktoy.find((t) => t.name === 'juster_kart')
  const felt = juster?.inputSchema?.properties ?? {}
  const recordOk = ['lag', 'strek'].every((k) =>
    felt[k]?.type === 'object' && felt[k].additionalProperties?.type)
  sjekk('z.record-feltene kom ut som objekt-skjema', recordOk,
    recordOk
      ? `lag → ${felt.lag.additionalProperties.type}, strek → ${felt.strek.additionalProperties.type}`
      : `juster_kart: ${JSON.stringify({ lag: felt.lag ?? null, strek: felt.strek ?? null }).slice(0, 220)}`)

  // 3. tools/call med GYLDIGE argumenter til et verktøy som ikke trenger nett.
  //    Beviser at valideringen slipper riktige argumenter GJENNOM, ikke bare at
  //    kallet gikk. `hoydeprofil` krever kartRef OG punkter — første utgave av
  //    denne sjekken sendte bare kartRef, fikk en valideringsfeil, og REGNET
  //    DEN SOM BESTÅTT fordi svaret kom som et `result`. Det er verdt å kjenne:
  //    SDK-en pakker valideringsfeil inn i `result` med en isError-tekst, ikke
  //    bare i `error`, så «fikk jeg et result?» er ikke et svar på om
  //    valideringen godtok noe.
  const kall = await http(port, {
    kropp: {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'hoydeprofil',
        arguments: {
          kartRef: 'finnes-ikke',
          punkter: [{ lat: 59.84, lon: 10.41 }, { lat: 59.85, lon: 10.42 }],
        },
      },
    },
    headere: sesjonsHode,
  })
  const k = lesJsonRpc(kall)
  const kallTekst = JSON.stringify(k?.result ?? k ?? kall.tekst)
  // Vi forventer at verktøyet svarer «det kartet finnes ikke» — altså at
  // argumentene nådde verktøyets EGEN kode. En zod-avvisning nevner
  // validation/-32602; det er signaturen vi ikke vil se her.
  const avvistAvZod = k?.error?.code === -32602 || /validation error|-32602/i.test(kallTekst)
  const nåddeKoden = Boolean(k?.result) && !avvistAvZod
  sjekk('gyldige argumenter slipper gjennom til verktøyet', nåddeKoden,
    nåddeKoden
      ? `hoydeprofil nådde koden: ${kallTekst.slice(0, 90)}…`
      : `${avvistAvZod ? 'AVVIST av valideringen' : `HTTP ${kall.status}`}: ${kallTekst.slice(0, 300)}`)

  // 4. Og at et FEIL argument faktisk avvises — en validering som slipper alt
  //    gjennom er ingen validering. `halvKm` er et tall med min/max.
  const ugyldig = await http(port, {
    kropp: {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'sok_sted', arguments: { sok: 'Håøya', antall: 'ikke-et-tall' } },
    },
    headere: sesjonsHode,
  })
  const u = lesJsonRpc(ugyldig)
  const uTekst = JSON.stringify(u?.result ?? u ?? ugyldig.tekst)
  const avvist = u?.error?.code === -32602 || /validation error|-32602/i.test(uTekst)
  sjekk('ugyldig argument blir avvist', avvist,
    avvist ? 'sok_sted nektet en streng der tallet skal stå' : uTekst.slice(0, 240))
} catch (err) {
  sjekk('protokoll-røyk', false, err.message)
} finally {
  if (barn) {
    try { process.kill(-barn.pid, 'SIGKILL') } catch { /* gruppa er borte */ }
    try { barn.kill('SIGKILL') } catch { /* likeså */ }
  }
}

const feil = resultat.filter((r) => !r.ok)
console.log(`\n── mcp-protokoll ────────────────────────────`)
for (const r of resultat) console.log(`${r.ok ? '✓' : '✗'} ${r.navn}`)
console.log(feil.length ? `\n✗ ${feil.length} sjekk(er) feilet\n` : '\n✓ protokollen svarer som den skal\n')
process.exit(feil.length ? 1 : 0)
