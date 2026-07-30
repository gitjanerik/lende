import { describe, it, expect } from 'vitest'
import { extractInviteToken, parseSseBuffer } from './lendeAi.js'

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
})
