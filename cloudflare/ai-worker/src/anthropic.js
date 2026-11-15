// Oversetter chattens OpenAI-form til Anthropics Messages-form (v8.0.16).
//
// AI Gatewayen GJETTER formatet ut fra innholdet. Med verktøykall i historikken
// leser den OpenAI-formen riktig, men første runde — bare system + bruker +
// tools — tolkes som Anthropic, og da avvises `type: 'function'` i tools.0.
// Sender vi Anthropic-formen selv, er det ingenting å gjette på. Svaret kommer
// som Anthropic-blokker, og klienten (src/lib/lendeAi.js) leser dem alt.

function tekstAv(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((d) => (typeof d === 'string' ? d : d?.text ?? '')).join('')
  }
  return content == null ? '' : String(content)
}

function argumenter(tekst) {
  if (tekst && typeof tekst === 'object') return tekst
  try {
    const v = JSON.parse(tekst || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function blokker(melding) {
  if (melding.role === 'tool') {
    return [{ type: 'tool_result', tool_use_id: melding.tool_call_id, content: tekstAv(melding.content) }]
  }
  const ut = []
  const tekst = tekstAv(melding.content)
  if (tekst.trim()) ut.push({ type: 'text', text: tekst })
  for (const tc of melding.tool_calls ?? []) {
    ut.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function?.name ?? tc.name,
      input: argumenter(tc.function?.arguments ?? tc.arguments),
    })
  }
  return ut
}

export function tilAnthropic(params) {
  const system = params.messages
    .filter((m) => m.role === 'system')
    .map((m) => tekstAv(m.content))
    .join('\n\n')

  // Anthropic krever at rollene veksler, og verktøysvar er BRUKER-meldinger.
  // Påfølgende meldinger med samme rolle slås derfor sammen til én.
  const messages = []
  for (const m of params.messages) {
    if (m.role === 'system') continue
    const rolle = m.role === 'assistant' ? 'assistant' : 'user'
    const innhold = blokker(m)
    if (!innhold.length) continue
    const forrige = messages.at(-1)
    if (forrige?.role === rolle) forrige.content.push(...innhold)
    else messages.push({ role: rolle, content: innhold })
  }

  const ut = { ...params, messages }
  if (system) ut.system = system
  if (Array.isArray(params.tools)) {
    ut.tools = params.tools.map((t) => {
      const f = t.function ?? t
      return {
        name: f.name,
        description: f.description ?? '',
        input_schema: f.parameters ?? { type: 'object', properties: {} },
      }
    })
  }
  return ut
}
