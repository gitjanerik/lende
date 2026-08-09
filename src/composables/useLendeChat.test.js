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

describe('useLendeChat — merking i kartet', () => {
  beforeEach(() => {
    chat.nySamtale()
    chatOnce.mockReset()
    runTool.mockReset()
    chat.setChatContext({ kartId: 'otersjoen', kartnavn: 'Bijjie Gaajsjaevrie' })
  })

  const merkeKall = (args = { navn: 'Bijjie Gaajsjaevrie' }) => ({
    text: '',
    toolCalls: [{ id: 'c1', name: 'merk_i_kartet', args }],
    raw: null,
  })

  it('skriver bekreftelsen selv, uten koordinatene modellen dro med', async () => {
    // v4.8.9-svaret: «Vannet Bijjie Gaajsjaevrie er merket i kartet.
    // Koordinater: 64.578764, 13.221365.» — ingen markering var satt, og
    // koordinatene var svar på et annet spørsmål enn brukerens.
    runTool.mockResolvedValue({
      ok: true,
      merket: { navn: 'Bijjie Gaajsjaevrie', lat: 64.578764, lon: 13.221365 },
    })
    chatOnce
      .mockResolvedValueOnce(merkeKall())
      .mockResolvedValueOnce(svarTekst('Vannet er merket. Koordinater: 64.578764, 13.221365.'))

    await chat.send('Kan du merke det')

    expect(runTool).toHaveBeenCalledWith('merk_i_kartet', { navn: 'Bijjie Gaajsjaevrie' }, expect.anything())
    expect(sisteSvar()).toContain('Bijjie Gaajsjaevrie')
    expect(sisteSvar()).toContain('rosa')
    expect(sisteSvar()).not.toContain('64.578764')
  })

  it('avviser påstand om merking når verktøyet ikke ble kalt', async () => {
    chatOnce.mockResolvedValue(svarTekst(
      'Vannet Bijjie Gaajsjaevrie er merket i kartet. Koordinater: 64.578764, 13.221365.',
    ))

    await chat.send('Kan du merke det')

    expect(runTool).not.toHaveBeenCalled()
    expect(sisteSvar()).toContain('fikk ikke merket')
    expect(sisteSvar()).not.toContain('64.578764')
  })

  it('lar «markert med rødt»-svar stå når brukeren ikke ba om merking', async () => {
    chatOnce.mockResolvedValue(svarTekst('Stiene er markert med svart prikkelinje i kartet.'))

    await chat.send('Hvordan vises stiene')

    expect(sisteSvar()).toBe('Stiene er markert med svart prikkelinje i kartet.')
  })

  it('lar appens rangering overstyre hvilket vann modellen trodde var størst', async () => {
    // v4.8.10: modellen leste rad 1 av en ALFABETISK vann-liste og konkluderte
    // med «Andedammen» — omtrent kartets minste vann. Rangeringen skjer nå i
    // verktøyet, og svaret skal navngi vinneren, ikke modellens gjetning.
    runTool.mockResolvedValue({
      ok: true,
      merket: {
        navn: 'Storsjøen',
        lat: 59.7,
        lon: 10.1,
        rangering: { kategori: 'vann', retning: 'storst', antall: 14, storrelse: '~2,1 km²' },
      },
    })
    chatOnce
      .mockResolvedValueOnce(merkeKall({ navn: 'største innsjø' }))
      .mockResolvedValueOnce(svarTekst('Andedammen er merket i kartet.'))

    await chat.send('Marker den største innsjøen i kartet')

    expect(sisteSvar()).toContain('Storsjøen')
    expect(sisteSvar()).toContain('største av 14 vann')
    expect(sisteSvar()).not.toContain('Andedammen')
  })

  it('lar modellens svar stå når det både bekrefter og svarer på mer', async () => {
    runTool.mockResolvedValue({ ok: true, merket: { navn: 'Stordammen', lat: 64.5, lon: 13.2 } })
    chatOnce
      .mockResolvedValueOnce(merkeKall({ navn: 'Stordammen' }))
      .mockResolvedValueOnce(svarTekst('Stordammen er merket i kartet. Vannet ligger på 340 moh.'))

    await chat.send('Merk Stordammen, og hvor høyt ligger det')

    expect(sisteSvar()).toContain('340 moh')
  })

  it('sier fra når markeringen lå i en naboflis', async () => {
    runTool.mockResolvedValue({
      ok: true,
      merket: { navn: 'Kvitvatnet', lat: 64.6, lon: 13.2 },
      byttetKart: 'Otersjøen nord',
    })
    chatOnce
      .mockResolvedValueOnce(merkeKall({ navn: 'Kvitvatnet' }))
      .mockResolvedValueOnce(svarTekst('Merket.'))

    await chat.send('Merk Kvitvatnet')

    expect(sisteSvar()).toContain('Otersjøen nord')
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

  it('avviser påstanden UTEN tall når ingen tur ble sendt (v5.0.1)', async () => {
    chatOnce.mockResolvedValue(svarTekst('Turen er tegnet inn i kartet. Vil du se den i 3D?'))

    await chat.send('gå en tur fra Sørenga til Maridalsvannet')

    expect(sisteSvar()).toContain('fikk ikke tegnet turen')
    // Uten tall i løgnen skal vi heller ikke snakke om tall vi ikke har.
    expect(sisteSvar()).not.toContain('ingen tall å gi deg')
  })

  it('erstatter «er tegnet inn» med «beregner nå» når turen bare ble sendt (v5.0.1)', async () => {
    // Den faktisk observerte løgnen: verktøyet NAVIGERER bare — ruten beregnes i
    // kartvisningen etterpå og kan feile der (Sørenga → Maridalsvannet ga to
    // markører og ingen strek). Setningen har ingen tall, så begge de gamle
    // vaktene slapp den forbi.
    runTool.mockResolvedValue({ ok: true })
    chatOnce
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'c1', name: 'foreslaa_tur', args: { kartId: 'oslo', fraNavn: 'Sørenga', tilNavn: 'Maridalsvannet' } }],
        raw: null,
      })
      .mockResolvedValueOnce(svarTekst('Turen fra Sørenga til Maridalsvannet er tegnet inn i kartet. Vil du se den i 3D?'))

    await chat.send('gå en tur fra Sørenga til Maridalsvannet')

    expect(sisteSvar()).not.toContain('er tegnet inn i kartet')
    expect(sisteSvar()).toContain('beregner')
  })

  it('lar «turen er tegnet inn» stå når kartet FAKTISK har en tegnet tur', async () => {
    // Oppfølgingsspørsmål om en tur fra en tidligere melding: da er påstanden
    // sann, og vakten skal holde seg unna.
    chat.setChatContext({
      kartId: 'stormoen', kartnavn: 'Stormoen',
      aktivTur: { type: 'fottur', lengdeM: 4700, stigningM: 180 },
    })
    chatOnce.mockResolvedValue(svarTekst('Turen er tegnet inn i kartet, og den følger stien langs vannet.'))

    await chat.send('Følger turen stien')

    expect(sisteSvar()).toContain('følger stien langs vannet')
  })
})

describe('useLendeChat — vakt mot påstått nytt kart', () => {
  beforeEach(() => {
    chat.nySamtale()
    chatOnce.mockReset()
    runTool.mockReset()
    chat.setChatContext({ kartId: 'oslo', kartnavn: 'Oslo' })
  })

  it('avviser «Jeg åpner Nytt turkart» når ingen verktøy kjørte (v5.0.1)', async () => {
    // Faktisk observert: chatten ble stående åpen og ingenting skjedde, men
    // brukeren fikk kvittering på et kart som aldri ble opprettet.
    chatOnce.mockResolvedValue(svarTekst(
      'Jeg åpner «Nytt turkart» med Hurum i Asker som senter. Du kan endre '
      + 'kartnavn, størrelse og andre innstillinger senere.',
    ))

    await chat.send('lag nytt kart over hurumlandet')

    expect(runTool).not.toHaveBeenCalled()
    expect(sisteSvar()).toContain('fikk ikke opprettet kartet')
    expect(sisteSvar()).not.toContain('Nytt turkart» med Hurum')
  })

  it('lar bekreftelsen stå når kart-verktøyet faktisk kjørte', async () => {
    runTool.mockResolvedValue({ ok: true, senter: { lat: 59.6, lon: 10.4, sted: 'Hurum' } })
    chatOnce
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'c1', name: 'foreslaa_nytt_kart', args: { sted: 'Hurum' } }],
        raw: null,
      })
      .mockResolvedValueOnce(svarTekst('Jeg åpner «Nytt turkart» med Hurum som senter.'))

    await chat.send('lag nytt kart over Hurum')

    expect(sisteSvar()).toContain('Hurum')
    expect(sisteSvar()).not.toContain('fikk ikke opprettet')
  })

  it('lar tilbud om å lage kart stå', async () => {
    chatOnce.mockResolvedValue(svarTekst('Vil du at jeg skal lage et kart over Hurum?'))

    await chat.send('finnes det kart over hurumlandet')

    expect(sisteSvar()).toBe('Vil du at jeg skal lage et kart over Hurum?')
  })
})

// v5.0.2: «gå en tur fra lelangen til haratjern» ga tre bom på rad — tilbud om
// nettsøk på et oppdiktet navn («Lenglangen»), så tilbud om å MERKE stedet, og
// til slutt at det ikke fantes stier. Verktøyvalget er modellens, så vakten her
// er system-prompten: reglene MÅ stå der, ellers er det ingenting som styrer den.
describe('useLendeChat — tur fra A til B', () => {
  beforeEach(() => {
    chat.nySamtale()
    chatOnce.mockReset()
    runTool.mockReset()
    chat.setChatContext({ kartId: 'trettekollen', kartnavn: 'Trettekollen, Drammen' })
  })

  const systemInnhold = () =>
    chatOnce.mock.calls.at(-1)[0].messages.find(m => m.role === 'system').content

  it('instruerer modellen om å kalle foreslaa_tur direkte på «fra X til Y»', async () => {
    chatOnce.mockResolvedValue(svarTekst('ok'))
    await chat.send('gå en tur fra lelangen til haratjern')

    const sys = systemInnhold()
    expect(sys).toContain('TUR FRA A TIL B')
    expect(sys).toContain('FERDIG BESTILLING')
    // De tre feilveiene skal være eksplisitt stengt.
    expect(sys).toMatch(/uten å spørre om lov først/)
    expect(sys).toMatch(/uten sok_sted/)
    expect(sys).toMatch(/uten å tilby merking eller nytt kart i stedet/)
  })

  it('forbyr omskriving av stedsnavn brukeren har oppgitt', async () => {
    chatOnce.mockResolvedValue(svarTekst('ok'))
    await chat.send('gå en tur fra lelangen til haratjern')

    const sys = systemInnhold()
    expect(sys).toContain('STEDSNAVN ORDRETT')
    expect(sys).toContain('«Lelangen» skal ikke bli «Lenglangen»')
  })

  it('lar merke-regelen vike for en tur-bestilling', async () => {
    chatOnce.mockResolvedValue(svarTekst('ok'))
    await chat.send('gå en tur fra lelangen til haratjern')

    expect(systemInnhold()).toContain('har brukeren bedt om en TUR, skal du aldri tilby merking i stedet')
  })

  it('slipper gjennom svaret når foreslaa_tur faktisk kjørte', async () => {
    runTool.mockResolvedValue({
      ok: true,
      rute: { lengdeKm: 1.6, stigningM: 180, gangtidMin: 35 },
    })
    chatOnce
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{
          id: 'c1',
          name: 'foreslaa_tur',
          args: { fraNavn: 'Lelangen', tilNavn: 'Haratjern' },
        }],
        raw: null,
      })
      .mockResolvedValueOnce(svarTekst('Turen er tegnet inn: 1,6 km og 180 høydemeter, rundt 35 minutter.'))

    await chat.send('gå en tur fra lelangen til haratjern')

    // Navnene skal gå ORDRETT videre — ingen omskriving underveis.
    expect(runTool).toHaveBeenCalledWith(
      'foreslaa_tur',
      expect.objectContaining({ fraNavn: 'Lelangen', tilNavn: 'Haratjern' }),
      expect.anything(),
    )
    expect(sisteSvar()).toContain('1,6 km')
    expect(sisteSvar()).not.toContain('fikk ikke tegnet turen')
  })
})
