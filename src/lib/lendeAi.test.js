import { describe, it, expect } from 'vitest'
import { extractInviteToken, parseSseBuffer, extractText, extractToolCalls } from './lendeAi.js'

describe('extractToolCalls', () => {
  it('leser OpenAI-format med JSON-streng-argumenter', () => {
    const kall = extractToolCalls({
      choices: [{ message: { content: null, tool_calls: [
        { id: 'call_1', function: { name: 'sok_sted', arguments: '{"navn":"Håøya"}' } },
      ] } }],
    })
    expect(kall).toHaveLength(1)
    expect(kall[0].id).toBe('call_1')
    expect(kall[0].name).toBe('sok_sted')
    expect(kall[0].args).toEqual({ navn: 'Håøya' })
  })

  it('leser klassisk format med objekt-argumenter', () => {
    const kall = extractToolCalls({
      response: '',
      tool_calls: [{ name: 'mine_kart_og_ruter', arguments: {} }],
    })
    expect(kall[0].name).toBe('mine_kart_og_ruter')
    expect(kall[0].args).toEqual({})
    expect(kall[0].id).toBe('verktoey_0')
  })

  it('gir tom liste uten kall, og {} ved uparsbare argumenter', () => {
    expect(extractToolCalls({ response: 'hei' })).toEqual([])
    expect(extractToolCalls(null)).toEqual([])
    const kall = extractToolCalls({
      choices: [{ message: { tool_calls: [{ function: { name: 'x', arguments: '{ødelagt' } }] } }],
    })
    expect(kall[0].args).toEqual({})
  })
})

describe('extractText', () => {
  it('leser klassisk Workers AI-format', () => {
    expect(extractText({ response: 'Hei' })).toBe('Hei')
  })

  it('leser OpenAI-stream-format (choices[].delta.content)', () => {
    expect(extractText({ choices: [{ delta: { content: 'Hei' } }] })).toBe('Hei')
  })

  it('leser OpenAI-ikke-stream-format (choices[].message.content)', () => {
    expect(extractText({ choices: [{ message: { content: 'Hei' } }] })).toBe('Hei')
  })

  it('ignorerer resonnering uten content (GLM-tilfellet fra røyktesten)', () => {
    expect(extractText({ choices: [{ message: { content: null, reasoning: 'tenker…' } }] })).toBe('')
    expect(extractText({ choices: [{ delta: { reasoning: 'tenker…' } }] })).toBe('')
  })

  it('tåler søppel', () => {
    expect(extractText(null)).toBe('')
    expect(extractText({})).toBe('')
    expect(extractText({ choices: [] })).toBe('')
  })
})

describe('extractInviteToken', () => {
  it('plukker token og fjerner kun ai-token fra query', () => {
    const hit = extractInviteToken('?slat=59.8&ai-token=abc-123&slon=10.5')
    expect(hit.token).toBe('abc-123')
    const params = new URLSearchParams(hit.cleanedSearch)
    expect(params.get('ai-token')).toBeNull()
    expect(params.get('slat')).toBe('59.8')
    expect(params.get('slon')).toBe('10.5')
  })

  it('gir tom cleanedSearch når ai-token var eneste param', () => {
    expect(extractInviteToken('?ai-token=abc').cleanedSearch).toBe('')
  })

  it('returnerer null uten token, ved tomt token og ved tom query', () => {
    expect(extractInviteToken('?slat=59.8')).toBeNull()
    expect(extractInviteToken('?ai-token=')).toBeNull()
    expect(extractInviteToken('')).toBeNull()
    expect(extractInviteToken(undefined)).toBeNull()
  })

  it('trimmer whitespace i token', () => {
    expect(extractInviteToken('?ai-token=%20abc%20').token).toBe('abc')
  })
})

describe('parseSseBuffer', () => {
  it('parser komplette data-linjer og beholder halv linje som rest', () => {
    const buf = 'data: {"response":"Hei"}\ndata: {"response":" på deg"}\ndata: {"respo'
    const { deltas, rest, done } = parseSseBuffer(buf)
    expect(deltas).toEqual(['Hei', ' på deg'])
    expect(rest).toBe('data: {"respo')
    expect(done).toBe(false)
  })

  it('fanger [DONE]', () => {
    const { deltas, done } = parseSseBuffer('data: {"response":"Ferdig."}\ndata: [DONE]\n')
    expect(deltas).toEqual(['Ferdig.'])
    expect(done).toBe(true)
  })

  it('hopper over tomme responses, ikke-data-linjer og ugyldig JSON', () => {
    const buf = ': kommentar\n\ndata: {"response":""}\ndata: {ugyldig}\ndata: {"usage":{"total_tokens":3}}\ndata: {"response":"A"}\n'
    const { deltas, done } = parseSseBuffer(buf)
    expect(deltas).toEqual(['A'])
    expect(done).toBe(false)
  })

  it('takler norske tegn i deltas', () => {
    const { deltas } = parseSseBuffer('data: {"response":"Vardåsen er 349 møh — fint turmål."}\n')
    expect(deltas[0]).toContain('Vardåsen')
    expect(deltas[0]).toContain('møh')
  })

  it('parser OpenAI-stil stream-chunks', () => {
    const buf = 'data: {"choices":[{"delta":{"reasoning":"hm"}}]}\ndata: {"choices":[{"delta":{"content":"Ekvidistansen"}}]}\ndata: [DONE]\n'
    const { deltas, done } = parseSseBuffer(buf)
    expect(deltas).toEqual(['Ekvidistansen'])
    expect(done).toBe(true)
  })
})
