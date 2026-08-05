import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chat-flyten mot modellen og verktøyene er mocket: testen handler om HVILKET
// svar brukeren ender opp med — særlig vaktene som overskriver modellens tekst.
const chatOnce = vi.fn()
const runTool = vi.fn()

vi.mock('../lib/lendeAi.js', () => ({ chatOnce: (...a) => chatOnce(...a) }))
vi.mock('../lib/lendeAiTools.js', async (importOriginal) => ({
  ...(await importOriginal()),
  runTool: (...a) => runTool(...a),
}))

const { useLendeChat } = await import('./useLendeChat.js')
const chat = useLendeChat()

const svarTekst = (text) => ({ text, toolCalls: [], raw: null })

const STINETT = {
  stinett: { totalStiKm: 372.4 },
  totalStiTekst: 'mer enn 370 km',
  kartKm: { bredde: 12, hoyde: 12 },
  arealKm2: 144,
  lengsteVandringKm: 18.4,
  treff: 2,
  turer: [{ type: 'tur', lengdeKm: 12.1, stigningM: 340 }],
}

const sisteSvar = () => chat.messages.value.at(-1).content

describe('useLendeChat — stinett-spørsmål', () => {
  beforeEach(() => {
    chat.nySamtale()
    chatOnce.mockReset()
    runTool.mockReset()
    chat.setChatContext({ kartId: 'stormoen', kartnavn: 'Stormoen' })
  })

  it('beholder tallene fra stinett-analysen i svaret', async () => {
    // v4.8.8-feilen: analysen kjørte, modellen formulerte et korrekt svar, og
    // vakten mot oppdiktede turtall byttet det ut med «Jeg fikk ikke tegnet
    // turen …» — bare fordi svaret inneholdt et tall.
    runTool.mockResolvedValue(STINETT)
    chatOnce.mockResolvedValue(svarTekst(
      'Det er mer enn 370 km turstier i kartet, som er 12 × 12 km. '
      + 'Den lengste sammenhengende strekningen er 18,4 km.',
    ))

    await chat.send('Hvor mange kilometer sti i kartet')

    expect(runTool).toHaveBeenCalledWith('analyser_stinett', {}, expect.anything())
    expect(sisteSvar()).toContain('370 km')
    expect(sisteSvar()).not.toContain('fikk ikke tegnet turen')
  })

  it('bytter hermetisk engelsk mot deterministisk norsk sammendrag', async () => {
    runTool.mockResolvedValue(STINETT)
    chatOnce.mockResolvedValue(svarTekst('Your input is lacking necessary details.'))

    await chat.send('Hvor mange kilometer tursti er det i dette kartet')

    expect(sisteSvar()).toContain('mer enn 370 km')
    expect(sisteSvar()).not.toContain('fikk ikke tegnet turen')
  })
})

describe('useLendeChat — vakt mot oppdiktede turtall', () => {
  beforeEach(() => {
    chat.nySamtale()
    chatOnce.mockReset()
    runTool.mockReset()
    chat.setChatContext({ kartId: 'stormoen', kartnavn: 'Stormoen' })
  })

  it('avviser tall når svaret påstår en tur som aldri ble sendt', async () => {
    chatOnce.mockResolvedValue(svarTekst(
      'Turen er tegnet inn i kartet ditt. Den er 11,9 km lang, med 349 m stigning '
      + 'og en gangtid på 3 timer 11 minutter.',
    ))

    await chat.send('Lag en tur fra Bondivann til Vardåsen')

    expect(sisteSvar()).toContain('fikk ikke tegnet turen')
  })

  it('lar et ærlig svar med tall stå når ingen tur ble påstått', async () => {
    chatOnce.mockResolvedValue(svarTekst('Otersjøen ligger 612 moh.'))

    await chat.send('Hvor høyt ligger Otersjøen')

    expect(sisteSvar()).toBe('Otersjøen ligger 612 moh.')
  })
})
