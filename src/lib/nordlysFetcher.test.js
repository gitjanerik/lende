import { describe, it, expect } from 'vitest'
import { nyesteRad, OVATION_URL, KP_URL, VIND_URL, MAGFELT_URL } from './nordlysFetcher.js'

describe('nyesteRad', () => {
  it('velger STØRSTE tidsstempel, ikke siste rad', () => {
    // DETTE ER FELLA SOM SER RIKTIG UT, og den er målt (probe-nordlys, runde 3):
    // rtsw-filene fletter ACE og DSCOVR, og arrayet er IKKE tidssortert. Siste
    // rad var en passiv ACE-rad fra dagen før, mens nyeste rad var samme kveld.
    // En klient som gjør d[d.length − 1] får et helt plausibelt, men døgngammelt
    // tall — uten at noe ser galt ut.
    const rader = [
      { time_tag: '2026-08-31T22:18:00', proton_speed: 411 },
      { time_tag: '2026-08-30T22:22:00', proton_speed: 449 },
    ]
    expect(nyesteRad(rader).proton_speed).toBe(411)
  })

  it('filtrerer på active når feltet finnes', () => {
    const rader = [
      { time_tag: '2026-08-31T22:18:00', active: false, proton_speed: 999 },
      { time_tag: '2026-08-31T22:16:00', active: true, proton_speed: 411 },
    ]
    // Den nyeste er passiv; da er den nest nyeste AKTIVE det riktige svaret.
    expect(nyesteRad(rader).proton_speed).toBe(411)
  })

  it('bruker alle radene når ingen bærer active', () => {
    const rader = [
      { time_tag: '2026-08-31T21:00:00', kp_index: 1 },
      { time_tag: '2026-08-31T22:00:00', kp_index: 4 },
    ]
    expect(nyesteRad(rader).kp_index).toBe(4)
  })

  it('tolker tid uten Z som UTC', () => {
    // NOAA blander «…T22:18:00» og «…Z». Uten dette ville Date.parse tolket den
    // første som LOKAL tid, og alderen ville spratt med brukerens tidssone —
    // altså vist «for 120 minutter siden» i Norge om sommeren.
    const utc = nyesteRad([{ time_tag: '2026-08-31T22:18:00Z', v: 1 }])
    const uten = nyesteRad([{ time_tag: '2026-08-31T22:18:00', v: 2 }])
    expect(Date.parse(`${utc.time_tag}`)).toBe(Date.parse('2026-08-31T22:18:00Z'))
    expect(uten.v).toBe(2)
    // Begge skal velges likt i en blandet liste.
    const blandet = nyesteRad([
      { time_tag: '2026-08-31T22:18:00', v: 'uten' },
      { time_tag: '2026-08-31T22:00:00Z', v: 'med' },
    ])
    expect(blandet.v).toBe('uten')
  })

  it('svarer null på tomt og på søppel framfor å kaste', () => {
    expect(nyesteRad([])).toBeNull()
    expect(nyesteRad(null)).toBeNull()
    expect(nyesteRad([{ ingen: 'tid' }])).toBeNull()
    // Alle rader passive: da finnes det ikke noe gyldig svar.
    expect(nyesteRad([{ time_tag: '2026-08-31T22:00:00Z', active: false }])).toBeNull()
  })
})

describe('URL-ene', () => {
  it('peker på det som ble MÅLT å svare', () => {
    // Runde 1 av proben brukte /products/solar-wind/plasma-1-day.json og
    // mag-1-day.json — begge skrevet etter hukommelsen, begge 404. Disse fire er
    // målt (2026-08-31): 200, CORS «*», ingen User-Agent-krav.
    expect(OVATION_URL).toMatch(/\/json\/ovation_aurora_latest\.json$/)
    expect(KP_URL).toMatch(/\/json\/planetary_k_index_1m\.json$/)
    // SUMMARY og ikke rtsw: like ferske, men < 1 kB mot 2 597 kB for de to
    // tallene panelet viser.
    expect(VIND_URL).toMatch(/\/products\/summary\/solar-wind-speed\.json$/)
    expect(MAGFELT_URL).toMatch(/\/products\/summary\/solar-wind-mag-field\.json$/)
    for (const u of [OVATION_URL, KP_URL, VIND_URL, MAGFELT_URL]) {
      expect(u).toMatch(/^https:\/\//)
    }
  })
})
