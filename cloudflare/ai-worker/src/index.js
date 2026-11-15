// Lende — KI-Worker (Cloudflare Workers AI).
//
// Fase 1 av KI-planen (docs/AI_ARKITEKTUR.md + docs/MCP_REMOTE_CHAT.md):
// ett endepunkt `POST /api/ai` som kjører chat-inferens via Workers AI-
// bindingen (`env.AI`) — ingen ekstern API-nøkkel finnes, så det er ingenting
// å lekke. Tilgang styres av per-bruker-tokens i secreten `LENDE_AI_TOKENS`
// (kommaseparert liste); kall uten gyldig `Authorization: Bearer <token>`
// avvises med 401. CORS er låst til Lende-originene, men CORS er IKKE
// tilgangskontroll (stopper bare nettlesere) — tokenet er den ekte porten,
// og det som beskytter gratiskvoten (10k neurons/dag).
//
// Modellen er en var (MODEL i wrangler.toml) så bytte er en én-linjes deploy,
// jf. leverandør-agnostisk design i AI_ARKITEKTUR.md.

const ALLOWED_ORIGINS = new Set([
  'https://gitjanerik.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const MAX_BODY_CHARS = 500_000
const MAX_OUTPUT_TOKENS = 4096

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://gitjanerik.github.io'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'X-Lende-Modell, X-Lende-Reserve',
    Vary: 'Origin',
  }
}

function json(status, obj, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Resonnerings-innsats. Feltet finnes ikke på alle modeller, og et ukjent felt
// kan avvises av skjemavalideringen — derfor kjøres kallet om igjen UTEN det
// hvis første forsøk kaster. Treffer knotten ikke, blir den bare ignorert.
async function kjor(env, modell, params) {
  const innsats = (env.REASONING_EFFORT ?? '').trim()
  if (!innsats) return env.AI.run(modell, params)
  try {
    return await env.AI.run(modell, { ...params, reasoning: { effort: innsats } })
  } catch {
    return env.AI.run(modell, params)
  }
}

function validToken(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice('Bearer '.length).trim()
  if (!token || !env.LENDE_AI_TOKENS) return false
  const tokens = env.LENDE_AI_TOKENS.split(',').map((t) => t.trim()).filter(Boolean)
  return tokens.includes(token)
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // Uautentisert helsesjekk — brenner ingen neurons, brukes til å verifisere
    // deploy uten å dele ut tokens.
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true, model: env.MODEL ?? null, reserve: env.RESERVE_MODEL || null }, cors)
    }

    if (request.method !== 'POST' || url.pathname !== '/api/ai') {
      return new Response('Not Found', { status: 404, headers: cors })
    }
    if (!env.LENDE_AI_TOKENS) {
      return json(500, { error: 'LENDE_AI_TOKENS er ikke satt i Worker-en.' }, cors)
    }
    if (!validToken(request, env)) {
      return json(401, { error: 'Ugyldig eller manglende token.' }, cors)
    }

    const raw = await request.text()
    if (raw.length > MAX_BODY_CHARS) {
      return json(413, { error: 'For stor forespørsel.' }, cors)
    }
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return json(400, { error: 'Body må være gyldig JSON.' }, cors)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json(400, { error: 'Body må ha en ikke-tom `messages`-liste.' }, cors)
    }

    const params = {
      messages: body.messages,
      max_tokens: Math.min(Number(body.max_tokens) || 1024, MAX_OUTPUT_TOKENS),
    }
    if (Array.isArray(body.tools) && body.tools.length > 0) params.tools = body.tools
    if (body.stream === true) params.stream = true

    // Hovedmodellen er en partnermodell (Anthropic via Workers AI), og den
    // kan være nede uten at Lende har gjort noe galt. Da svarer reserven, og
    // `X-Lende-Modell` sier hvem som svarte — chatten merker svaret, og
    // røyktesten feiler på det, så en feil id ikke skjules av reserven.
    let modell = env.MODEL
    let result
    try {
      result = await kjor(env, modell, params)
    } catch (err) {
      if (!env.RESERVE_MODEL || env.RESERVE_MODEL === modell) {
        return json(502, { error: `Workers AI feilet: ${err?.message ?? 'ukjent'}` }, cors)
      }
      console.warn(`[lende-ai] ${modell} feilet, prøver ${env.RESERVE_MODEL}: ${err?.message}`)
      modell = env.RESERVE_MODEL
      try {
        result = await kjor(env, modell, params)
      } catch (err2) {
        return json(502, { error: `Workers AI feilet: ${err2?.message ?? 'ukjent'}` }, cors)
      }
    }
    const modellHode = {
      'X-Lende-Modell': modell,
      ...(modell !== env.MODEL ? { 'X-Lende-Reserve': '1' } : {}),
    }

    // Streaming gir en ReadableStream med SSE-bytes; ellers et JSON-objekt.
    // Formen varierer per modell — klassisk Workers AI ({ response }),
    // OpenAI-kompatibel ({ choices }), Responses-API ({ output: [...] }, som
    // gpt-oss bruker) eller Anthropic-blokker ({ content: [...] }). Workeren
    // tolker den IKKE; den sendes rå videre, og klienten (src/lib/lendeAi.js)
    // kjenner alle fire.
    if (params.stream && result instanceof ReadableStream) {
      return new Response(result, {
        headers: { ...cors, ...modellHode, 'Content-Type': 'text/event-stream' },
      })
    }
    return json(200, result, { ...cors, ...modellHode })
  },
}
