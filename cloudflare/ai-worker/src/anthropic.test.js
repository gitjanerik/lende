import { describe, it, expect } from 'vitest'
import { tilAnthropic } from './anthropic.js'

const verktoy = [{
  type: 'function',
  function: { name: 'sok_sted', description: 'Søk', parameters: { type: 'object', properties: { navn: { type: 'string' } } } },
}]

describe('tilAnthropic', () => {
  it('første runde: system løftes ut, og tools får Anthropic-formen', () => {
    const ut = tilAnthropic({
      messages: [{ role: 'system', content: 'Du er Lende.' }, { role: 'user', content: 'Høyeste punkt?' }],
      max_tokens: 1024,
      tools: verktoy,
    })
    expect(ut.system).toBe('Du er Lende.')
    expect(ut.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Høyeste punkt?' }] }])
    expect(ut.tools).toEqual([{ name: 'sok_sted', description: 'Søk', input_schema: verktoy[0].function.parameters }])
    expect(ut.max_tokens).toBe(1024)
  })

  it('verktøyrunder blir tool_use og tool_result, og rollene veksler', () => {
    const ut = tilAnthropic({
      messages: [
        { role: 'user', content: 'Hvor er Håøya?' },
        { role: 'assistant', content: '', tool_calls: [
          { id: 'a', type: 'function', function: { name: 'sok_sted', arguments: '{"navn":"Håøya"}' } },
          { id: 'b', type: 'function', function: { name: 'sok_sted', arguments: 'ødelagt' } },
        ] },
        { role: 'tool', tool_call_id: 'a', name: 'sok_sted', content: '{"lat":59.68}' },
        { role: 'tool', tool_call_id: 'b', name: 'sok_sted', content: '{"feil":"x"}' },
      ],
    })
    expect(ut.system).toBeUndefined()
    expect(ut.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(ut.messages[1].content).toEqual([
      { type: 'tool_use', id: 'a', name: 'sok_sted', input: { navn: 'Håøya' } },
      { type: 'tool_use', id: 'b', name: 'sok_sted', input: {} },
    ])
    expect(ut.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'a', content: '{"lat":59.68}' },
      { type: 'tool_result', tool_use_id: 'b', content: '{"feil":"x"}' },
    ])
  })
})
