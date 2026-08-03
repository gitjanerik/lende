import { describe, it, expect } from 'vitest'
import {
  extractInviteToken, parseSseBuffer, extractText, extractToolCalls, parseTextToolCalls,
} from './lendeAi.js'

describe('parseTextToolCalls', () => {
  const NAVN = ['foreslaa_tur', 'foreslaa_rundtur', 'sok_i_kartet']

  // v4.8.4: navnelista ble utledet fra `tools`, som er undefined i den siste
  // runden. Da falt tolkingen ut nøyaktig der den trengtes mest, og kallet ble
  // stående som rå tekst i chatten uten å bli utført — brukeren fikk «ingen
  // rute, ingen 3D» og oppdiktede tall. Faktisk observert svar.
  const LEKKASJE = 'Jeg finner flere steder som heter Vardåsen i dette kartet. '
    + 'Jeg velger toppen Vardåsen 349 moh som mål for turen din. '
    + '[foreslaa_tur(kartId="kart_hdcl67j9msdffotk", fraNavn="Bondivann stasjon", tilNavn="Vardåsen")]'

  it('tolker kallet når navnelista finnes — prosaen beholdes, klammen fjernes', () => {
    const { toolCalls, text } = parseTextToolCalls(LEKKASJE, NAVN)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].name).toBe('foreslaa_tur')
    expect(toolCalls[0].args).toEqual({
      kartId: 'kart_hdcl67j9msdffotk',
      fraNavn: 'Bondivann stasjon',
      tilNavn: 'Vardåsen',
    })
    expect(text).toBe('Jeg finner flere steder som heter Vardåsen i dette kartet. '
      + 'Jeg velger toppen Vardåsen 349 moh som mål for turen din.')
  })

  it('uten navneliste lekker klammen ordrett — derfor MÅ chatOnce få toolNames', () => {
    const { toolCalls, text } = parseTextToolCalls(LEKKASJE, [])
    expect(toolCalls).toHaveLength(0)
    expect(text).toContain('[foreslaa_tur(')
  })

  it('tolker Llamas bracket-form som ekte verktøykall og fjerner den fra teksten', () => {
    // Faktisk observert svar (v4.4.0, «se ruta i 3D»): kallet havnet i teksten.
    const raa = '[foreslaa_tur(fraLat=59.747514, fraLon=10.139189, tilLat=59.750295, ' +
      'tilLon=10.146311, kartId=kart_ufqmh9dcmsbzpijv, navn=Stormoen–Stordammen, vis3d=true)]'
    const { toolCalls, text } = parseTextToolCalls(raa, NAVN)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].name).toBe('foreslaa_tur')
    expect(toolCalls[0].args.fraLat).toBeCloseTo(59.747514, 6)
    expect(toolCalls[0].args.kartId).toBe('kart_ufqmh9dcmsbzpijv')
    expect(toolCalls[0].args.vis3d).toBe(true)
    expect(text).toBe('')
  })

  it('tolker JSON-blob-formen', () => {
    const raa = 'Let us find the coordinates.{"type": "function", "name": "foreslaa_tur", ' +
      '"parameters": {"fraLat": "60.213333", "fraLon": "10.45", "vis3d": "false"}}'
    const { toolCalls, text } = parseTextToolCalls(raa, NAVN)
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].args.fraLat).toBeCloseTo(60.213333, 6)
    expect(toolCalls[0].args.vis3d).toBe(false)
    expect(text).not.toContain('"name"')
  })

  it('rører ikke vanlig prosa, ukjente navn eller tom tekst', () => {
    for (const t of [
      'Turen er 4,7 km lang. Si fra hvis du vil se den i 3D.',
      // Parenteser i prosa er urørt — det er KLAMMEformen som er et kall.
      'Se avsnitt (2) i tegnforklaringen',
      'Kartet dekker Sirikjerke (Øvre Eiker) og litt til.',
      '',
    ]) {
      const res = parseTextToolCalls(t, NAVN)
      expect(res.toolCalls, t).toHaveLength(0)
      expect(res.text, t).toBe(t)
    }
  })

  it('uten kjente navn gjøres ingen tolking (runde uten verktøy)', () => {
    const res = parseTextToolCalls('[foreslaa_tur(fraLat=1)]', [])
    expect(res.toolCalls).toHaveLength(0)
  })

  it('fjerner oppdiktet klammeform (ukjent «verktøy») fra teksten', () => {
    // Faktisk observert (v4.5.1): modellen ville bytte kart-tema, fant ikke
    // noe verktøy, og fant opp [vis3d(false)] av et parameternavn.
    const { toolCalls, text } = parseTextToolCalls('[vis3d(false)]', NAVN)
    expect(toolCalls).toHaveLength(0)
    expect(text).toBe('')
  })

  it('fjerner oppdiktet klammeform, men beholder prosaen rundt', () => {
    const { text } = parseTextToolCalls('Jeg bytter tema. [sett_tema(dark)]', NAVN)
    expect(text).toBe('Jeg bytter tema.')
  })

  it('tolker kall uten argumenter midt i prosa', () => {
    // Faktisk observert (v4.4.2): modellen gjorde ett ekte kall og skrev det
    // neste som tekst i samme svar.
    const { toolCalls, text } = parseTextToolCalls(
      'Jeg åpner listen over dine kart og ruter.[mine_kart_og_ruter()]',
      ['mine_kart_og_ruter'],
    )
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].name).toBe('mine_kart_og_ruter')
    expect(toolCalls[0].args).toEqual({})
    expect(text).toBe('Jeg åpner listen over dine kart og ruter.')
  })
})

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
