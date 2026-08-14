import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  cellenokkel, ventendeSenter, ventendePaaArket, VENTENDE_RADIUS_TILES,
  VENTENDE_KEY, VENTENDE_MAKS,
  lesVentende, skrivVentende, leggTilVentende, fjernVentende,
} from './ventendeFliser.js'

// Et 1000×1000 m ark med kjent UTM-forankring. Naboer uttrykkes som (kol, rad)
// der rad vokser SØROVER, akkurat som SVG-y — hele poenget med fortegns-testene.
const ARK = { widthM: 1000, heightM: 1000, minE: 500000, maxN: 6600000 }
const naboBbox = (col, row, w = 1000, h = 1000) => {
  const minE = ARK.minE + col * ARK.widthM
  const maxN = ARK.maxN - row * ARK.heightM
  return { minE, maxE: minE + w, minN: maxN - h, maxN }
}
const spek = (utmBbox) => ({ utmBbox, opts: { navn: 'Tur' } })

describe('cellenokkel', () => {
  it('samme celle → samme nøkkel uansett kilde (avrunder til meter)', () => {
    expect(cellenokkel({ minE: 500000, maxN: 6600000 }))
      .toBe(cellenokkel({ minE: 500000.4, maxN: 6599999.6 }))
  })
  it('ulike celler → ulike nøkler', () => {
    expect(cellenokkel(naboBbox(1, 0))).not.toBe(cellenokkel(naboBbox(0, 1)))
  })
  it('null/undefined → tom streng', () => {
    expect(cellenokkel(null)).toBe('')
    expect(cellenokkel(undefined)).toBe('')
  })
})

describe('ventendeSenter — absolutt UTM → aktiv-flisas meter-rom', () => {
  it('aktiv flis selv → senter i (W/2, H/2)', () => {
    expect(ventendeSenter(naboBbox(0, 0), ARK)).toEqual({ x: 500, y: 500 })
  })
  it('øst er positiv x', () => {
    expect(ventendeSenter(naboBbox(1, 0), ARK)).toEqual({ x: 1500, y: 500 })
  })
  // Fortegnet i y er det som er lett å snu: SVG-y vokser SØROVER, og toppkanten
  // er (m.maxN − ub.maxN). En nabo i NORD har HØYERE maxN → negativ y.
  it('nord er NEGATIV y', () => {
    expect(ventendeSenter(naboBbox(0, -1), ARK)).toEqual({ x: 500, y: -500 })
  })
  it('sør er positiv y', () => {
    expect(ventendeSenter(naboBbox(0, 1), ARK)).toEqual({ x: 500, y: 1500 })
  })
  it('sørvest → negativ x, positiv y', () => {
    expect(ventendeSenter(naboBbox(-1, 1), ARK)).toEqual({ x: -500, y: 1500 })
  })
  it('null-bbox eller ark uten UTM-forankring → null', () => {
    expect(ventendeSenter(null, ARK)).toBe(null)
    expect(ventendeSenter(naboBbox(1, 0), { widthM: 1000, heightM: 1000 })).toBe(null)
    expect(ventendeSenter({ minE: NaN, maxE: NaN, minN: 0, maxN: 0 }, ARK)).toBe(null)
  })
})

describe('ventendePaaArket', () => {
  it('nabo med samme flisestørrelse → senteret', () => {
    expect(ventendePaaArket(spek(naboBbox(1, 1)), ARK)).toEqual({ x: 1500, y: 1500 })
  })
  it('annen flisestørrelse → null (spesifikasjonen hører til et annet kart)', () => {
    expect(ventendePaaArket(spek(naboBbox(1, 0, 500, 500)), ARK)).toBe(null)
  })
  it('tåler 1 m avrundings-slark i flisestørrelsen', () => {
    expect(ventendePaaArket(spek(naboBbox(1, 0, 1001, 999)), ARK)).not.toBe(null)
  })
  it('utenfor radiusTiles → null', () => {
    expect(ventendePaaArket(spek(naboBbox(VENTENDE_RADIUS_TILES + 1, 0)), ARK)).toBe(null)
    expect(ventendePaaArket(spek(naboBbox(0, -(VENTENDE_RADIUS_TILES + 1))), ARK)).toBe(null)
  })
  it('innenfor radiusTiles → senteret', () => {
    expect(ventendePaaArket(spek(naboBbox(VENTENDE_RADIUS_TILES - 1, 0)), ARK)).not.toBe(null)
  })
  it('radiusTiles kan strammes inn av kalleren', () => {
    expect(ventendePaaArket(spek(naboBbox(3, 0)), ARK, 1)).toBe(null)
    expect(ventendePaaArket(spek(naboBbox(3, 0)), ARK, 4)).not.toBe(null)
  })
  it('mangler spek/ark → null', () => {
    expect(ventendePaaArket(null, ARK)).toBe(null)
    expect(ventendePaaArket({}, ARK)).toBe(null)
    expect(ventendePaaArket(spek(naboBbox(1, 0)), null)).toBe(null)
  })
})

// ── Lager-rundturen ──────────────────────────────────────────────────────────
// Modulen snakker med `localStorage` som global, så testene stubber globalen med
// en Map i stedet for å injisere et lager — det er nettopp den koden vi vil
// dekke (inkludert JSON-runden og at ødelagte verdier ikke kaster).
function lagerStub() {
  const m = new Map()
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
  }
}

describe('bokføringen — legg til, les, fjern', () => {
  let lager
  beforeEach(() => {
    lager = lagerStub()
    vi.stubGlobal('localStorage', lager)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('tomt lager → tom liste', () => {
    expect(lesVentende()).toEqual([])
  })
  it('rundtur: skrevet plan leses tilbake', () => {
    const plan = [spek(naboBbox(1, 0)), spek(naboBbox(0, 1))]
    leggTilVentende(plan)
    expect(lesVentende()).toEqual(plan)
  })
  it('fjernVentende stryker på celle-identitet, ikke på objekt-likhet', () => {
    leggTilVentende([spek(naboBbox(1, 0)), spek(naboBbox(0, 1))])
    // Samme celle, men et nytt bbox-objekt med float-slark.
    const ub = naboBbox(1, 0)
    fjernVentende({ ...ub, minE: ub.minE + 0.3, maxN: ub.maxN - 0.2 })
    expect(lesVentende().map(s => cellenokkel(s.utmBbox)))
      .toEqual([cellenokkel(naboBbox(0, 1))])
  })
  it('siste flis strøket → nøkkelen fjernes helt', () => {
    leggTilVentende([spek(naboBbox(1, 0))])
    fjernVentende(naboBbox(1, 0))
    expect(lager.map.has(VENTENDE_KEY)).toBe(false)
    expect(lesVentende()).toEqual([])
  })
  it('samme celle to ganger → én oppføring (den nyeste vinner)', () => {
    leggTilVentende([{ utmBbox: naboBbox(1, 0), opts: { navn: 'gammel' } }])
    leggTilVentende([{ utmBbox: naboBbox(1, 0), opts: { navn: 'ny' } }])
    const ut = lesVentende()
    expect(ut).toHaveLength(1)
    expect(ut[0].opts.navn).toBe('ny')
  })
  it('halvferdige oppføringer (uten utmBbox/opts) filtreres bort ved lesing', () => {
    lager.setItem(VENTENDE_KEY, JSON.stringify([
      { utmBbox: naboBbox(1, 0), opts: {} },
      { utmBbox: naboBbox(2, 0) },
      { opts: {} },
      null,
    ]))
    expect(lesVentende()).toHaveLength(1)
  })
  it('ødelagt JSON eller feil type → tom liste, ingen kast', () => {
    lager.setItem(VENTENDE_KEY, '{ikke json')
    expect(lesVentende()).toEqual([])
    lager.setItem(VENTENDE_KEY, '{"nei":1}')
    expect(lesVentende()).toEqual([])
  })
  it('kappingen beholder de NYESTE — lista er «hva mangler nå», ikke en logg', () => {
    const mange = Array.from({ length: VENTENDE_MAKS + 5 }, (_, i) => spek(naboBbox(i, 0)))
    skrivVentende(mange)
    const ut = lesVentende()
    expect(ut).toHaveLength(VENTENDE_MAKS)
    expect(cellenokkel(ut[0].utmBbox)).toBe(cellenokkel(naboBbox(5, 0)))
    expect(cellenokkel(ut.at(-1).utmBbox)).toBe(cellenokkel(naboBbox(VENTENDE_MAKS + 4, 0)))
  })
  it('lager som kaster (privat modus) → skriving svelges, lesing gir tom liste', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('nei') },
      setItem() { throw new Error('nei') },
      removeItem() { throw new Error('nei') },
    })
    expect(() => leggTilVentende([spek(naboBbox(1, 0))])).not.toThrow()
    expect(lesVentende()).toEqual([])
  })
})

describe('bokføringen uten localStorage i det hele tatt (node/SSR)', () => {
  it('lesing og skriving er fail-safe', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(lesVentende()).toEqual([])
    expect(() => fjernVentende(naboBbox(1, 0))).not.toThrow()
    vi.unstubAllGlobals()
  })
})
