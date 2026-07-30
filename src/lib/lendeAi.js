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
