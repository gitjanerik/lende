// Klient for Lende-KI-Workeren (cloudflare/ai-worker/ — Fase 2 av KI-planen).
//
// Tilgang er invitasjonsbasert: eieren deler en lenke med `?ai-token=<guid>`,
// appen plukker opp parameteren ved oppstart (pickupInviteTokenFromLocation i
// main.js), lagrer den i localStorage og stripper den fra URL-en. Uten token
// finnes ingen chat-UI (LendeChatButton rendrer ingenting), og Workeren
// avviser uansett kall uten gyldig token (401).
//
// Streaming: Workers AI svarer med SSE (`data: {"response":"…"}`-linjer,
// terminert av `data: [DONE]`). parseSseBuffer er ren og testes i
// lendeAi.test.js; streamChat leser fetch-body-en inkrementelt og kaller
// onDelta per tekstbit, med JSON-fallback hvis Workeren ikke streamer.

export const AI_TOKEN_KEY = 'lende-ai-token'

export const AI_URL =
  import.meta.env?.VITE_LENDE_AI_URL ??
  'https://lende-ai.jepedersen73.workers.dev/api/ai'

/**
 * Stoppet svaret fordi max_tokens var brukt opp? En resonnerings-modell bruker
 * av samme budsjett til tenkingen, så et kappet svar kan være helt TOMT.
 * Responses-API (gpt-oss) sier `status: 'incomplete'`, OpenAI-formen
 * `finish_reason: 'length'`, Anthropic-formen `stop_reason: 'max_tokens'`.
 */
export function erKappet(obj) {
  if (!obj || typeof obj !== 'object') return false
  if (obj.status === 'incomplete') return true
  if (obj.incomplete_details?.reason === 'max_output_tokens') return true
  if (obj.stop_reason === 'max_tokens') return true
  return obj.choices?.[0]?.finish_reason === 'length'
}

export const MAX_SVAR_TOKENS = 4096

export function getAiToken() {
  try {
    return localStorage.getItem(AI_TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function hasAiToken() {
  return !!getAiToken()
}

// Leverandør og visningsnavn for en modell-id, så teksten som forteller
// brukeren hvor meldingene går følger modellen Workeren faktisk kjører.
const LEVERANDORER = {
  anthropic: 'Anthropic', openai: 'OpenAI', 'zai-org': 'Zhipu AI',
  meta: 'Meta', mistralai: 'Mistral AI', google: 'Google', moonshotai: 'Moonshot AI',
}
export function modellInfo(id) {
  if (!id || typeof id !== 'string') return null
  const [forste, ...rest] = id.replace(/^@cf\//, '').split('/')
  const lev = rest.length ? forste : null
  const navn = (rest.join('/') || forste)
    .split('-')
    .map((d) => (/^\d/.test(d) ? d : d.charAt(0).toUpperCase() + d.slice(1)))
    .join(' ')
    .replace(/^Gpt /, 'GPT ')
    .replace(/ Oss /, '-OSS ')
  return { id, leverandor: lev ? (LEVERANDORER[lev] ?? lev) : null, navn }
}

export async function hentAiModell({ signal } = {}) {
  const res = await fetch(AI_URL.replace(/\/api\/ai$/, '/health'), { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return modellInfo(data?.model)
}

/**
 * Ren parsing av `?ai-token=`-parameteren: returnerer token + query-strengen
 * uten den (øvrige params beholdes — delingslenker kan ha slat/slon osv.).
 */
export function extractInviteToken(search) {
  const params = new URLSearchParams(search ?? '')
  const token = params.get('ai-token')?.trim()
  if (!token) return null
  params.delete('ai-token')
  const rest = params.toString()
  return { token, cleanedSearch: rest ? `?${rest}` : '' }
}

/**
 * Kalles fra main.js før mount: plukk opp invitasjonstoken fra URL-en, lagre,
 * og skriv URL-en tilbake uten parameteren (så den ikke blir liggende i
 * historikk/bokmerker). Returnerer true hvis et token ble lagret.
 */
export function pickupInviteTokenFromLocation() {
  const hit = extractInviteToken(window.location.search)
  if (!hit) return false
  try {
    localStorage.setItem(AI_TOKEN_KEY, hit.token)
  } catch {
    return false
  }
  try {
    const url = window.location.pathname + hit.cleanedSearch + window.location.hash
    history.replaceState(history.state, '', url)
  } catch {
    /* URL-vask er kosmetikk — tokenet er allerede lagret */
  }
  return true
}

/**
 * Trekk svar-tekst ut av én chunk/ett svar-objekt fra Workers AI. Modellene
 * der svarer i TRE ulike former, og klienten kjenner alle tre fordi Workeren
 * med vilje sender svaret rått videre (modellbytte skal være én linje i
 * wrangler.toml, ikke en klientendring):
 *  • klassisk Workers AI:  { response: "…" }
 *  • OpenAI-kompatibel:    { choices: [{ delta: { content: "…" } }] } (stream)
 *                          { choices: [{ message: { content: "…" } }] } (ikke-stream)
 *  • Responses-API:        { output: [{ type: 'message', content: [
 *                            { type: 'output_text', text: "…" } ] }] }, og i
 *                          strømmen TYPEDE hendelser (v6.5.80, gpt-oss)
 *  • Anthropic-blokker:    { content: [{ type: 'text', text: "…" }, { type:
 *                            'tool_use', … }] } (v8.0.11, Claude Haiku)
 * Resonnering ignoreres bevisst i alle fire — `delta.reasoning`, `output`-poster
 * av typen `reasoning` og `response.reasoning_*.delta` er modellens interne
 * tenking og skal aldri vises i chatten. Det er ikke pynt: det var nettopp
 * engelsk «tenking» lekket inn i svaret som gjorde GLM-4.7-flash ubrukelig.
 */
export function extractText(obj) {
  if (!obj || typeof obj !== 'object') return ''
  if (typeof obj.response === 'string') return obj.response
  // Responses-strømmen er typede hendelser: bare output_text-deltaene er svar.
  if (typeof obj.type === 'string') {
    return obj.type.endsWith('output_text.delta') && typeof obj.delta === 'string'
      ? obj.delta
      : ''
  }
  if (typeof obj.output_text === 'string') return obj.output_text
  if (Array.isArray(obj.output)) return tekstFraOutput(obj.output)
  if (Array.isArray(obj.content)) {
    return obj.content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('')
  }
  const valg = obj.choices?.[0]
  const tekst = valg?.delta?.content ?? valg?.message?.content
  return typeof tekst === 'string' ? tekst : ''
}

// Responses-API-ens `output` er en LISTE av poster, og bare `message`-postene
// er svaret — `reasoning` og `function_call` ligger i samme liste.
function tekstFraOutput(output) {
  let ut = ''
  for (const post of output) {
    if (post?.type !== 'message') continue
    for (const del of post.content ?? []) {
      if (del?.type === 'output_text' && typeof del.text === 'string') ut += del.text
    }
  }
  return ut
}

/**
 * Ren SSE-parsing: tar en tekstbuffer, returnerer ferdige tekst-deltas, resten
 * av bufferen (siste ufullstendige linje) og om strømmen meldte [DONE].
 * Workers AI sender én `data: <json>`-linje per chunk; teksten hentes med
 * extractText (begge svarformater), og uparsbare payloads hoppes over i
 * stedet for å knekke strømmen.
 */
export function parseSseBuffer(buffer) {
  const lines = buffer.split('\n')
  const rest = lines.pop() ?? ''
  const deltas = []
  let done = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') {
      done = true
      continue
    }
    try {
      const delta = extractText(JSON.parse(payload))
      if (delta) deltas.push(delta)
    } catch {
      /* halvkvedet chunk — ignorer */
    }
  }
  return { deltas, rest, done }
}

/**
 * Trekk verktøykall ut av et svar-objekt, normalisert til { id, name, args }.
 * Håndterer alle tre Workers AI-formene:
 *  • OpenAI-stil:   choices[0].message.tool_calls[] med function.arguments som
 *    JSON-STRENG
 *  • klassisk:      tool_calls[] med { name, arguments } som OBJEKT
 *  • Responses-API: output[]-poster av typen `function_call`, med `call_id`
 *    som id (v6.5.80, gpt-oss)
 *  • Anthropic:     content[]-blokker av typen `tool_use`, med `input` som
 *    OBJEKT (v8.0.11, Claude Haiku)
 * Uparsbare argumenter gir {} i stedet for å knekke kjeden.
 */
export function extractToolCalls(obj) {
  const raa = obj?.choices?.[0]?.message?.tool_calls
    ?? obj?.tool_calls
    ?? (Array.isArray(obj?.output)
      ? obj.output.filter((p) => p?.type === 'function_call')
      : null)
    ?? (Array.isArray(obj?.content)
      ? obj.content.filter((b) => b?.type === 'tool_use')
      : null)
  if (!Array.isArray(raa) || raa.length === 0) return []
  return raa
    .map((tc, i) => {
      const name = tc?.function?.name ?? tc?.name
      if (!name) return null
      let args = tc?.function?.arguments ?? tc?.arguments ?? tc?.input ?? {}
      if (typeof args === 'string') {
        try { args = JSON.parse(args) } catch { args = {} }
      }
      return { id: tc?.id ?? tc?.call_id ?? `verktoey_${i}`, name, args: args ?? {}, raw: tc }
    })
    .filter(Boolean)
}

// Tolk en argument-verdi fra et tekst-verktøykall: tall → number,
// true/false → boolean, ellers streng (med fnutter strippet).
function tolkVerdi(raa) {
  const s = String(raa).trim().replace(/^["'](.*)["']$/s, '$1')
  if (/^(true|false)$/i.test(s)) return /^true$/i.test(s)
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s)
  return s
}

/**
 * Llama-modellene faller av og til tilbake til å SKRIVE verktøykallet i
 * svarteksten i stedet for å bruke tool-kanalen. To former er observert:
 *
 *   [foreslaa_tur(fraLat=59.747514, tilLon=10.146311, vis3d=true)]
 *   {"type": "function", "name": "foreslaa_tur", "parameters": {"fraLat": …}}
 *
 * Uten tolking havnet dette rått i chatten («[foreslaa_tur(fraLat=…)]») og
 * handlingen ble aldri utført. Vi parser begge formene til ekte verktøykall og
 * fjerner dem fra teksten. `kjenteNavn` (fra tools-lista) gjør parsingen trygg:
 * bare deklarerte verktøy godtas, så vanlig prosa med klammer ikke misforstås.
 *
 * @returns {{ toolCalls: Array<{id,name,args}>, text: string }}
 */
export function parseTextToolCalls(tekst, kjenteNavn = []) {
  const navn = new Set(kjenteNavn)
  const s = String(tekst ?? '')
  if (!s || !navn.size) return { toolCalls: [], text: s }

  const toolCalls = []
  let rest = s

  // Klammeformen med et navn vi IKKE kjenner er ikke et kall vi kan utføre,
  // men det er heller ikke tekst brukeren skal se: modellen finner av og til
  // opp et «verktøy» av et parameternavn ([vis3d(false)] da den ville bytte
  // kart-tema). Fjern den stille — står det ingenting igjen, håndterer
  // useLendeChat det tomme svaret ærlig.
  rest = rest.replace(/\[\s*[a-z_][a-z0-9_]*\s*\([^()]*\)\s*\]/gi, (treff) => {
    const fn = treff.replace(/^\[\s*/, '').match(/^[a-z_][a-z0-9_]*/i)?.[0]
    return fn && navn.has(fn) ? treff : ''
  })

  // Form 1: [navn(k=v, k2=v2)] — også uten klammer rundt.
  rest = rest.replace(/\[?\s*([a-z_][a-z0-9_]*)\s*\(([^()]*)\)\s*\]?/gi, (treff, fn, argStr) => {
    if (!navn.has(fn)) return treff
    const args = {}
    for (const bit of argStr.split(',')) {
      const m = bit.match(/^\s*([a-z_][a-z0-9_]*)\s*[=:]\s*(.+?)\s*$/is)
      if (m) args[m[1]] = tolkVerdi(m[2])
    }
    toolCalls.push({ id: `tekst_${toolCalls.length}`, name: fn, args })
    return ''
  })

  // Form 2: JSON-blob med name + parameters/arguments.
  if (!toolCalls.length) {
    for (const m of s.matchAll(/\{[^{}]*"name"\s*:\s*"([a-z_][a-z0-9_]*)"[\s\S]*?\}\s*\}?/gi)) {
      if (!navn.has(m[1])) continue
      let args = {}
      try {
        const blob = JSON.parse(m[0])
        args = blob.parameters ?? blob.arguments ?? {}
        if (typeof args === 'string') args = JSON.parse(args)
        for (const k of Object.keys(args)) args[k] = tolkVerdi(args[k])
      } catch { /* halvkvedet blob — kall uten args, modellen får prøve igjen */ }
      toolCalls.push({ id: `tekst_${toolCalls.length}`, name: m[1], args })
      rest = rest.replace(m[0], '')
    }
  }

  // rest !== s betyr at noe ble fjernet (ekte kall ELLER oppdiktet klammeform).
  return { toolCalls, text: rest === s ? s : rest.trim() }
}

/**
 * Ett ikke-strømmende chat-kall — brukes i verktøy-runder (Workers AI støtter
 * ikke streaming + tools pålitelig). Returnerer { text, toolCalls }.
 *
 * `toolNames` er navnene tekst-tolkingen godtar, og er BEVISST skilt fra
 * `tools` (v4.8.4). Utledet vi navnene fra `tools`, mistet vi tolkingen i
 * nøyaktig de rundene der vi med vilje ikke tilbyr verktøy — og da lakk et
 * tekst-skrevet kall ordrett ut i chatten uten å bli utført. Se
 * parseTextToolCalls.
 */
export async function chatOnce({ messages, tools, toolNames, maxTokens = 1024, signal }) {
  let { data } = await postChat({ messages, tools, maxTokens, signal })
  let tekst = extractText(data)
  let strukturerte = extractToolCalls(data)
  // Tomt og kappet: tenkingen spiste budsjettet. Ett nytt forsøk med taket
  // Workeren tillater — et forsøk til koster mindre enn et svar som ikke kom.
  let kappet = erKappet(data)
  if (kappet && !tekst.trim() && !strukturerte.length && maxTokens < MAX_SVAR_TOKENS) {
    ;({ data } = await postChat({ messages, tools, maxTokens: MAX_SVAR_TOKENS, signal }))
    tekst = extractText(data)
    strukturerte = extractToolCalls(data)
    kappet = erKappet(data)
  }
  // Tekst-tolkingen kjører ALLTID, ikke bare når tool-kanalen er tom: modellen
  // kan gjøre ett ekte kall og skrive det NESTE som tekst i samme svar (sett
  // v4.4.1: «… Vent litt. Jeg åpner listen over dine kart og ruter.
  // [mine_kart_og_ruter()]»). Ellers blir klammeteksten stående i chatten og
  // det andre kallet aldri utført.
  // Navnelista: eksplisitt `toolNames` når kalleren oppgir den (gjelder ALLE
  // runder, også de uten tools), ellers utledet fra tools som før.
  const kjenteNavn = Array.isArray(toolNames) && toolNames.length
    ? toolNames
    : (tools ?? []).map((t) => t?.function?.name).filter(Boolean)
  const fraTekst = parseTextToolCalls(tekst, kjenteNavn)
  const sett = new Set(strukturerte.map((t) => `${t.name}:${JSON.stringify(t.args)}`))
  const ekstra = fraTekst.toolCalls.filter((t) => !sett.has(`${t.name}:${JSON.stringify(t.args)}`))
  return { text: fraTekst.text, toolCalls: [...strukturerte, ...ekstra], raw: data, kappet }
}

async function postChat({ messages, tools, maxTokens, signal }) {
  let res
  try {
    res = await fetch(AI_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${getAiToken() ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        max_tokens: maxTokens,
        ...(Array.isArray(tools) && tools.length ? { tools } : {}),
      }),
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new Error('Fikk ikke kontakt med KI-tjenesten. Sjekk nettforbindelsen.')
  }
  if (!res.ok) {
    let serverText = ''
    try {
      const feil = await res.json()
      serverText = feil?.error ?? ''
      if (feil?.detalj) {
        console.warn('[lende-ai] modellen feilet:', feil.detalj)
        serverText = ikkeTilgjengeligTekst(feil.detalj) ?? serverText
      }
    } catch { /* ikke JSON */ }
    throw new Error(feilmelding(res.status, serverText))
  }
  return { data: await res.json() }
}

// Kjente årsaker fra AI Gatewayen, sagt rett ut i chatten. Ukjente gir null,
// og da står Workerens generelle «ikke tilgjengelig» — vi gjetter ikke.
const KJENTE_AARSAKER = [
  [/\b2021\b|insufficient[^.]*credits/i, 'kreditten for chatten er brukt opp.', false],
  [/spend(ing)? limit|budget|limit exceeded|payment_defaulted|\b402\b/i, 'månedsgrensen eller betalingen for chatten stopper den.', false],
  [/\b7007\b|not eligible for unified billing/i, 'betalingsoppsettet for chatten er ikke i orden.', false],
  [/\b429\b|rate.?limit|too many requests/i, 'det er for mange forespørsler akkurat nå.', true],
  [/overloaded|\b529\b|\b503\b/i, 'modellen er overbelastet.', true],
  [/time(d)? ?out|deadline/i, 'modellen svarte ikke i tide.', true],
]

export function ikkeTilgjengeligTekst(detalj) {
  const treff = KJENTE_AARSAKER.find(([re]) => re.test(String(detalj ?? '')))
  if (!treff) return null
  const [, aarsak, forbigaaende] = treff
  return `Lende-chatten er ikke tilgjengelig: ${aarsak}`
    + (forbigaaende ? ' Prøv igjen om litt.' : '')
}

function feilmelding(status, serverText) {
  if (status === 401) return 'Invitasjonen din er ikke gyldig lenger. Be om en ny lenke.'
  if (status === 429) return 'KI-tjenesten har nådd dagskvoten. Prøv igjen i morgen.'
  if (serverText) return serverText
  return `KI-tjenesten svarte med feil (${status}).`
}

/**
 * Send en chat-runde til Workeren og strøm svaret. `onDelta(tekst)` kalles per
 * tekstbit; returverdien er hele svaret. Kaster Error med norsk melding ved
 * feil (401/429/5xx/nett).
 */
export async function streamChat({ messages, maxTokens = 1024, signal, onDelta }) {
  let res
  try {
    res = await fetch(AI_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${getAiToken() ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, stream: true, max_tokens: maxTokens }),
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new Error('Fikk ikke kontakt med KI-tjenesten. Sjekk nettforbindelsen.')
  }

  if (!res.ok) {
    let serverText = ''
    try {
      serverText = (await res.json())?.error ?? ''
    } catch {
      /* ikke JSON — bruk statusbasert melding */
    }
    throw new Error(feilmelding(res.status, serverText))
  }

  const contentType = res.headers.get('Content-Type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    const data = await res.json()
    const text = extractText(data)
    if (text) onDelta?.(text)
    return text
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseBuffer(buffer)
    buffer = parsed.rest
    for (const delta of parsed.deltas) {
      full += delta
      onDelta?.(delta)
    }
    if (parsed.done) break
  }
  return full
}

// Det modellen leser av et verktøysvar eller konteksten: tomme felt ut (null,
// '', [], {}), og desimaler kappet til det som betyr noe — 5 for grader
// (~1 m), 1 for alt over 100 (meter, sekunder). Hver token koster, og et
// felt uten innhold sier ingenting modellen kan svare med.
export function kompaktForModell(verdi) {
  if (typeof verdi === 'number') {
    if (!Number.isFinite(verdi) || Number.isInteger(verdi)) return verdi
    return Math.abs(verdi) >= 100 ? Math.round(verdi * 10) / 10 : Math.round(verdi * 1e5) / 1e5
  }
  if (Array.isArray(verdi)) {
    return verdi.map(kompaktForModell).filter((v) => v !== undefined)
  }
  if (verdi && typeof verdi === 'object') {
    const ut = {}
    for (const [k, v] of Object.entries(verdi)) {
      const kv = kompaktForModell(v)
      if (kv === undefined || kv === null || kv === '') continue
      if (Array.isArray(kv) && kv.length === 0) continue
      if (typeof kv === 'object' && !Array.isArray(kv) && Object.keys(kv).length === 0) continue
      ut[k] = kv
    }
    return ut
  }
  return verdi
}
