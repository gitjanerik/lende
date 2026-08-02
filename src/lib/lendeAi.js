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
 * der svarer i to ulike former (oppdaget i røyktesten, v3.0.31):
 *  • klassisk Workers AI:  { response: "…" }
 *  • OpenAI-kompatibel:    { choices: [{ delta: { content: "…" } }] } (stream)
 *                          { choices: [{ message: { content: "…" } }] } (ikke-stream)
 * Resonnerings-felter (delta.reasoning o.l.) ignoreres bevisst — de er
 * modellens interne tenking og skal aldri vises i chatten.
 */
export function extractText(obj) {
  if (!obj || typeof obj !== 'object') return ''
  if (typeof obj.response === 'string') return obj.response
  const valg = obj.choices?.[0]
  const tekst = valg?.delta?.content ?? valg?.message?.content
  return typeof tekst === 'string' ? tekst : ''
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
 * Håndterer begge Workers AI-formene:
 *  • OpenAI-stil: choices[0].message.tool_calls[] med function.arguments som
 *    JSON-STRENG
 *  • klassisk:    tool_calls[] med { name, arguments } som OBJEKT
 * Uparsbare argumenter gir {} i stedet for å knekke kjeden.
 */
export function extractToolCalls(obj) {
  const raa = obj?.choices?.[0]?.message?.tool_calls ?? obj?.tool_calls
  if (!Array.isArray(raa) || raa.length === 0) return []
  return raa
    .map((tc, i) => {
      const name = tc?.function?.name ?? tc?.name
      if (!name) return null
      let args = tc?.function?.arguments ?? tc?.arguments ?? {}
      if (typeof args === 'string') {
        try { args = JSON.parse(args) } catch { args = {} }
      }
      return { id: tc?.id ?? `verktoey_${i}`, name, args: args ?? {}, raw: tc }
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

  return { toolCalls, text: toolCalls.length ? rest.trim() : s }
}

/**
 * Ett ikke-strømmende chat-kall — brukes i verktøy-runder (Workers AI støtter
 * ikke streaming + tools pålitelig). Returnerer { text, toolCalls }.
 */
export async function chatOnce({ messages, tools, maxTokens = 1024, signal }) {
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
      serverText = (await res.json())?.error ?? ''
    } catch { /* ikke JSON */ }
    throw new Error(feilmelding(res.status, serverText))
  }
  const data = await res.json()
  const tekst = extractText(data)
  const strukturerte = extractToolCalls(data)
  // Tekst-tolkingen kjører ALLTID, ikke bare når tool-kanalen er tom: modellen
  // kan gjøre ett ekte kall og skrive det NESTE som tekst i samme svar (sett
  // v4.4.1: «… Vent litt. Jeg åpner listen over dine kart og ruter.
  // [mine_kart_og_ruter()]»). Ellers blir klammeteksten stående i chatten og
  // det andre kallet aldri utført.
  const fraTekst = parseTextToolCalls(tekst, (tools ?? []).map((t) => t?.function?.name).filter(Boolean))
  const sett = new Set(strukturerte.map((t) => `${t.name}:${JSON.stringify(t.args)}`))
  const ekstra = fraTekst.toolCalls.filter((t) => !sett.has(`${t.name}:${JSON.stringify(t.args)}`))
  return { text: fraTekst.text, toolCalls: [...strukturerte, ...ekstra], raw: data }
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
