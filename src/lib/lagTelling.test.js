import { describe, it, expect } from 'vitest'
import { lagTellinger, tellingMerke, NAVNGITTE_TELLINGER } from './lagTelling.js'
import { LAYERS } from './mapLayerCatalog.js'

describe('lagTellinger', () => {
  it('summerer flere ISOM-koder inn i samme lag', () => {
    // Skog samler 406–409, sti samler 505–507. Det er hele grunnen til at
    // tallet ikke kan leses av én kode.
    const ut = lagTellinger({ 406: 3, 407: 1, 409: 5, 505: 2, 506: 4 })
    expect(ut.skog).toBe(9)
    expect(ut.sti).toBe(6)
  })

  it('bruker den NAVNGITTE nøkkelen og ikke kodens nullstilte tvilling', () => {
    // Klassifiseringen plukker punkt-symbolene ut av hovedløkka, så 560 blir
    // stående på 0 mens det ekte tallet ligger i `holdeplass`. Leste vi koden,
    // ville hver holdeplass-telling vært 0.
    const ut = lagTellinger({ holdeplass: 12, 560: 0, kirke: 2, 532: 0 })
    expect(ut.holdeplass).toBe(12)
    expect(ut.kirke).toBe(2)
  })

  it('slår hule og gruve sammen i stein, som kartet gjør', () => {
    const ut = lagTellinger({ hule: 2, gruve: 3, 210: 40 })
    expect(ut.stein).toBe(45)
  })

  it('legger ekstra-bidrag TIL et lag som alt har et tall', () => {
    // Stupkant har både en DEM-derivert og en OSM-halvdel, og begge tegnes.
    const ut = lagTellinger({ 201: 4 }, { stupkant: 118, kontur: 903 })
    expect(ut.stupkant).toBe(122)
    expect(ut.kontur).toBe(903)
  })

  it('lar 0 stå — det er svaret «sett etter, fant ingenting»', () => {
    const ut = lagTellinger({ 560: 0, holdeplass: 0 })
    expect(ut.holdeplass).toBe(0)
    expect('holdeplass' in ut).toBe(true)
  })

  it('kaster koder uten lag, og `place` er en av dem', () => {
    // `place` deles i tre stedsnavn-lag et annet sted; ett samlet tall fordelt
    // på tre brytere ville vært feil på alle tre.
    const ut = lagTellinger({ place: 40, 999: 7, 306: 12 })
    expect(ut.other).toBeUndefined()
    expect(Object.keys(ut)).toEqual([])
  })

  it('tåler tomt, manglende og tullete inndata', () => {
    expect(lagTellinger()).toEqual({})
    expect(lagTellinger(null, null)).toEqual({})
    expect(lagTellinger({ 406: NaN, 407: -3, 505: undefined })).toEqual({})
  })

  it('hvert navngitte mål er et EKTE lag i katalogen', () => {
    // Uten denne kan et lag døpes om i katalogen mens tellingen fortsetter å
    // summere inn i en nøkkel ingen bryter leser — et tall som forsvinner
    // stille.
    const nokler = new Set(LAYERS.map((l) => l.key))
    for (const lag of Object.values(NAVNGITTE_TELLINGER)) {
      expect(nokler.has(lag), `${lag} finnes ikke i LAYERS`).toBe(true)
    }
  })
})

describe('tellingMerke', () => {
  // Tre utfall, tre tegn. Konvensjonen er kulturminne-lagets fra v4.8.6, og
  // den finnes fordi «tomt» og «vet ikke» begge var «(0)» før den.
  it('skiller «fant ingenting» fra «vet ikke»', () => {
    expect(tellingMerke(0)).toBe('(0)')
    expect(tellingMerke(null)).toBe('(–)')
    expect(tellingMerke(undefined)).toBe('(–)')
    expect(tellingMerke(NaN)).toBe('(–)')
  })
  it('viser tallet ellers', () => {
    expect(tellingMerke(7)).toBe('(7)')
    expect(tellingMerke(1203)).toBe('(1203)')
  })
})
