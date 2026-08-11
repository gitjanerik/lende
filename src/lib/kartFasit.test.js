import { describe, it, expect } from 'vitest'
import { DOMParser } from 'linkedom'
import {
  lesKartGeometri, kartMetrikker, sjekkInvarianter, punktIRing, andelPunkterInne,
  punkterDyptInne, stiOverVann, vannHull, arealFor, lengdeFor, avvikMotBaseline,
  usydeFlater, flaterFor, VANN_FLATER, KONTUR_LINJER,
} from './kartFasit.js'

// Fasiten leser ekte DOM (som appens egne uthentere gjør). I node kommer den
// fra linkedom — samme shim mcp/headless.js bruker.
globalThis.DOMParser = DOMParser

// Miniatyr-kart: 1000 × 1000 m. Alle koordinater er SVG-meter, som i ekte kart.
const kart = (innhold, { bredde = 1000, hoyde = 1000 } = {}) =>
  `<svg viewBox="0 0 ${bredde} ${hoyde}" width="${bredde}" height="${hoyde}">${innhold}</svg>`

const ring = (x, y, w, h) => `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`

// Ring med verteks hver 25 m — ekte vannflater er tette (Drammenselva: 2 700 m²
// per punkt), og usydd-ring-sjekken ser nettopp på vertekstettheten.
const tettRing = (x, y, w, h, steg = 25) => {
  const p = []
  for (let d = 0; d < w; d += steg) p.push(`${x + d},${y}`)
  for (let d = 0; d < h; d += steg) p.push(`${x + w},${y + d}`)
  for (let d = w; d > 0; d -= steg) p.push(`${x + d},${y + h}`)
  for (let d = h; d > 0; d -= steg) p.push(`${x},${y + d}`)
  return `M${p.join(' L')} Z`
}
const gruppe = (kode, d) => `<g data-iso="${kode}"><path d="${d}"/></g>`

// Et vann på 200 × 200 m (4 % av kartet) i øvre venstre kvadrant.
const VANN = gruppe('301', ring(100, 100, 200, 200))

describe('lesKartGeometri', () => {
  it('leser viewBox som meter og grupperer på ISOM-kode', () => {
    const geo = lesKartGeometri(kart(VANN + gruppe('505', 'M0,500 L1000,500')))
    expect(geo.widthM).toBe(1000)
    expect(geo.heightM).toBe(1000)
    expect(geo.flater.get('301')).toHaveLength(1)
    expect(geo.linjer.get('505')).toHaveLength(1)
  })

  it('hopper over spøkelsesfliser — naboflisene er kulisse, ikke kartet', () => {
    const ghost = `<svg x="1000" y="0" viewBox="0 0 1000 1000">${gruppe('301', ring(0, 0, 900, 900))}</svg>`
    const geo = lesKartGeometri(kart(VANN + ghost))
    // Bare det ekte vannet skal telle — ellers hadde arealet eksplodert.
    expect(geo.flater.get('301')).toHaveLength(1)
    expect(arealFor(geo, VANN_FLATER)).toBeCloseTo(200 * 200, 0)
  })

  it('leser enkeltstående path med data-iso (uten gruppe rundt)', () => {
    const geo = lesKartGeometri(kart(`<path data-iso="102" d="M0,0 L100,0"/>`))
    expect(lengdeFor(geo, KONTUR_LINJER)).toBeCloseTo(100, 0)
  })

  it('flere subpaths i én path blir flere ringer', () => {
    const geo = lesKartGeometri(kart(gruppe('301', `${ring(0, 0, 100, 100)} ${ring(500, 500, 100, 100)}`)))
    expect(geo.flater.get('301')).toHaveLength(2)
  })

  it('tåler tom og søppel-input', () => {
    expect(lesKartGeometri('').widthM).toBe(0)
    expect(lesKartGeometri(null).flater.size).toBe(0)
  })
})

describe('punktIRing', () => {
  const r = [[0, 0], [100, 0], [100, 100], [0, 100]]
  it('kjenner innenfor og utenfor', () => {
    expect(punktIRing([50, 50], r)).toBe(true)
    expect(punktIRing([150, 50], r)).toBe(false)
    expect(punktIRing([50, -1], r)).toBe(false)
  })
  it('degenerert ring er aldri innenfor', () => {
    expect(punktIRing([0, 0], [[0, 0], [1, 1]])).toBe(false)
  })
})

describe('andelPunkterInne — land-masken', () => {
  const flate = { ytre: [[0, 0], [100, 0], [100, 100], [0, 100]], hull: [] }

  it('måler andelen konturpunkter som ligger i vann', () => {
    // To av fire punkter ligger inne.
    const linjer = [[[50, 50], [60, 60], [500, 500], [600, 600]]]
    const { andel, inne, testet } = andelPunkterInne(linjer, [flate])
    expect(inne).toBe(2)
    expect(testet).toBe(4)
    expect(andel).toBeCloseTo(0.5, 6)
  })

  it('punkter på en ØY i vannet teller som land', () => {
    const medOy = { ytre: flate.ytre, hull: [[[40, 40], [70, 40], [70, 70], [40, 70]]] }
    expect(andelPunkterInne([[[50, 50], [55, 55]]], [medOy]).inne).toBe(0)
    expect(andelPunkterInne([[[10, 10], [20, 20]]], [medOy]).inne).toBe(2)
  })

  it('uten vannflater er andelen null', () => {
    expect(andelPunkterInne([[[1, 1]]], []).andel).toBe(0)
  })
})

describe('vannHull — øyer i innsjø (Kolstadøya-klassen)', () => {
  it('teller en indre ring som hull', () => {
    const geo = lesKartGeometri(kart(gruppe('301', `${ring(100, 100, 400, 400)} ${ring(200, 200, 80, 80)}`)))
    expect(vannHull(geo)).toBe(1)
  })

  it('to vann ved siden av hverandre er ikke hull', () => {
    const geo = lesKartGeometri(kart(gruppe('301', `${ring(0, 0, 200, 200)} ${ring(500, 500, 200, 200)}`)))
    expect(vannHull(geo)).toBe(0)
  })
})

describe('stiOverVann', () => {
  const vannRing = ring(100, 100, 400, 400)

  it('finner en sti som går tvers over et vann', () => {
    const geo = lesKartGeometri(kart(gruppe('301', vannRing) + gruppe('505', 'M150,300 L450,300')))
    expect(stiOverVann(geo).antall).toBeGreaterThan(0)
  })

  it('en bro over vannet frikjenner segmentet', () => {
    const geo = lesKartGeometri(kart(
      gruppe('301', vannRing) + gruppe('505', 'M150,300 L450,300') + gruppe('509', 'M150,300 L450,300'),
    ))
    expect(stiOverVann(geo).antall).toBe(0)
  })

  it('sti langs vannet — utenfor — teller ikke', () => {
    const geo = lesKartGeometri(kart(gruppe('301', vannRing) + gruppe('505', 'M0,600 L1000,600')))
    expect(stiOverVann(geo).antall).toBe(0)
  })

  it('segment med bare ETT endepunkt i vann teller ikke (glattet elvebredd)', () => {
    const geo = lesKartGeometri(kart(gruppe('301', vannRing) + gruppe('505', 'M300,300 L900,300')))
    expect(stiOverVann(geo).antall).toBe(0)
  })
})

describe('punkterDyptInne — skiller strandkant fra ekte maske-feil', () => {
  const vann = [{ ytre: [[0, 0], [400, 0], [400, 400], [0, 400]], hull: [] }]

  it('punkt midt i vannet er dypt inne', () => {
    expect(punkterDyptInne([[200, 200]], vann, { dybdeM: 40 }).dypere).toBe(1)
  })

  it('punkt 10 m fra kanten er strandkant, ikke dypt', () => {
    expect(punkterDyptInne([[10, 200]], vann, { dybdeM: 40 }).dypere).toBe(0)
  })

  it('punkt på land teller ikke i det hele tatt', () => {
    const r = punkterDyptInne([[900, 900]], vann, { dybdeM: 40 })
    expect(r.inne).toBe(0)
    expect(r.dypere).toBe(0)
  })

  it('en øy midt i vannet gjør punktet til land igjen', () => {
    const medOy = [{ ytre: vann[0].ytre, hull: [[[150, 150], [250, 150], [250, 250], [150, 250]]] }]
    expect(punkterDyptInne([[200, 200]], medOy, { dybdeM: 40 }).dypere).toBe(0)
  })
})

describe('kartMetrikker', () => {
  it('regner vannandel av kartarealet', () => {
    const geo = lesKartGeometri(kart(VANN))
    expect(kartMetrikker(geo).vannAndel).toBeCloseTo(0.04, 4)
  })

  it('summerer sti- og konturkilometer', () => {
    const geo = lesKartGeometri(kart(gruppe('505', 'M0,0 L1000,0') + gruppe('102', 'M0,10 L500,10')))
    const m = kartMetrikker(geo)
    expect(m.stiKm).toBeCloseTo(1, 2)
    expect(m.konturKm).toBeCloseTo(0.5, 1)
  })
})

describe('sjekkInvarianter', () => {
  it('et sunt kart gir ingen brudd', () => {
    const geo = lesKartGeometri(kart(
      VANN + gruppe('505', 'M0,600 L1000,600') + gruppe('102', 'M0,700 L1000,700'),
    ))
    const { brudd } = sjekkInvarianter(geo, { forventVann: true, forventSti: true, forventKonturer: true })
    expect(brudd).toEqual([])
  })

  it('melder når vannet er borte i et kart som skal ha vann', () => {
    const geo = lesKartGeometri(kart(gruppe('505', 'M0,600 L1000,600')))
    expect(sjekkInvarianter(geo, { forventVann: true }).brudd.join(' ')).toMatch(/ingen vannflater/)
  })

  it('godtar et kart som ER nesten bare sjø — Lofoten er 91 % vann', () => {
    // Første utgave meldte dette som feil. Henningsvær beviste at «mye vann»
    // ikke kan være et brudd i seg selv.
    const geo = lesKartGeometri(kart(gruppe('303', tettRing(0, 0, 1000, 950))))
    expect(sjekkInvarianter(geo, { forventVann: true }).brudd).toEqual([])
  })

  it('melder usydd ring: kjempeflate med en håndfull punkter', () => {
    const geo = lesKartGeometri(kart(gruppe('301', 'M0,0 L1000,0 L1000,600 Z')))
    expect(sjekkInvarianter(geo, {}).brudd.join(' ')).toMatch(/ringene er trolig ikke sydd sammen/)
  })

  it('advarer om en sti som går langt gjennom vann — men feiler ikke', () => {
    // 400 m rett gjennom et 600 m vann. Kan være en ekte isrute i OSM.
    const geo = lesKartGeometri(kart(gruppe('301', tettRing(100, 100, 600, 600)) + gruppe('505', 'M200,400 L600,400')))
    const r = sjekkInvarianter(geo, { forventVann: true })
    expect(r.brudd).toEqual([])
    expect(r.advarsler.join(' ')).toMatch(/gjennom vann uten bro/)
  })

  it('teller casing og kjerne som ÉN sti, ikke to', () => {
    // Samme d to ganger, slik stier faktisk tegnes.
    const d = 'M0,600 L1000,600'
    const geo = lesKartGeometri(kart(`<g data-iso="505"><path d="${d}"/><path d="${d}"/></g>`))
    expect(kartMetrikker(geo).stiKm).toBeCloseTo(1, 2)
  })

  it('en kort kryssing er bare en advarsel', () => {
    const geo = lesKartGeometri(kart(gruppe('301', tettRing(100, 100, 600, 600)) + gruppe('505', 'M150,400 L200,400')))
    const r = sjekkInvarianter(geo, { forventVann: true })
    expect(r.brudd).toEqual([])
    expect(r.advarsler.join(' ')).toMatch(/uten bro/)
  })

  it('melder konturer tegnet DYPT ute i vannet', () => {
    // Vannet er 200 × 200 m; kurven ligger midt i det, > 40 m fra alle kanter.
    const geo = lesKartGeometri(kart(VANN + gruppe('102', 'M150,200 L250,200')))
    expect(sjekkInvarianter(geo, { forventVann: true }).brudd.join(' ')).toMatch(/land-masken svikter/)
  })

  it('godtar konturer i strandkanten — forenklings-slark er ikke en bug', () => {
    // Samme vann, men kurven ligger 10 m inne fra kanten hele veien.
    const geo = lesKartGeometri(kart(VANN + gruppe('102', 'M110,110 L290,110')))
    expect(sjekkInvarianter(geo, { forventVann: true }).brudd).toEqual([])
  })

  it('melder vegetasjon malt ute i vannet', () => {
    const geo = lesKartGeometri(kart(VANN + gruppe('406', ring(150, 150, 100, 100))))
    expect(sjekkInvarianter(geo, { forventVann: true }).brudd.join(' ')).toMatch(/vegetasjonspunkter ligger mer enn/)
  })

  it('melder manglende konturer (syntetisk DEM)', () => {
    const geo = lesKartGeometri(kart(gruppe('505', 'M0,600 L1000,600')))
    expect(sjekkInvarianter(geo, { forventKonturer: true }).brudd.join(' ')).toMatch(/ingen høydekurver/)
  })

  it('melder tapte øy-hull', () => {
    const geo = lesKartGeometri(kart(VANN))
    expect(sjekkInvarianter(geo, { forventHull: 1 }).brudd.join(' ')).toMatch(/mistet hull/)
  })

  it('kart uten viewBox er et brudd i seg selv', () => {
    expect(sjekkInvarianter(lesKartGeometri('<svg></svg>')).brudd.join(' ')).toMatch(/ingen viewBox/)
  })
})

describe('usydeFlater — usydd multipolygon-ring', () => {
  it('en vifte over en tredel av kartet med tre punkter er usydd', () => {
    const geo = lesKartGeometri(kart(gruppe('301', 'M0,0 L1000,0 L1000,600 Z')))
    const funn = usydeFlater(geo, flaterFor(geo, VANN_FLATER))
    expect(funn).toHaveLength(1)
    expect(funn[0].punkter).toBe(3)
  })

  it('en sjøflate med grovt omriss men detaljerte HOLMER er ikke usydd', () => {
    // Henningsvær-formen: ytre ring nesten som kartrammen, all detalj i hull.
    const holmer = []
    for (let i = 0; i < 12; i++) holmer.push(tettRing(100 + i * 60, 400, 40, 40, 5))
    const geo = lesKartGeometri(kart(gruppe('303', `${ring(0, 0, 1000, 980)} ${holmer.join(' ')}`)))
    expect(usydeFlater(geo, flaterFor(geo, VANN_FLATER))).toEqual([])
  })

  it('et ekte stort vann med mange punkter er ikke usydd', () => {
    // 900 × 900 m vann med 200 verteks langs kanten: ~4 000 m² per punkt,
    // samme størrelsesorden som Drammenselva og Gjende.
    const pts = []
    const n = 50
    for (let i = 0; i < n; i++) pts.push(`${50 + (900 * i) / n},50`)
    for (let i = 0; i < n; i++) pts.push(`950,${50 + (900 * i) / n}`)
    for (let i = 0; i < n; i++) pts.push(`${950 - (900 * i) / n},950`)
    for (let i = 0; i < n; i++) pts.push(`50,${950 - (900 * i) / n}`)
    const geo = lesKartGeometri(kart(gruppe('303', `M${pts.join(' L')} Z`)))
    expect(usydeFlater(geo, flaterFor(geo, VANN_FLATER))).toEqual([])
  })

  it('en liten grovmasket flate er ikke verdt å rope om', () => {
    const geo = lesKartGeometri(kart(gruppe('301', 'M0,0 L200,0 L200,100 Z')))
    expect(usydeFlater(geo, flaterFor(geo, VANN_FLATER))).toEqual([])
  })
})

describe('avvikMotBaseline', () => {
  const fasit = { vannAndel: 0.1, stiKm: 10, konturKm: 100 }

  it('små endringer innenfor toleranse gir ingen avvik', () => {
    expect(avvikMotBaseline({ vannAndel: 0.103, stiKm: 10.8, konturKm: 103 }, fasit)).toEqual([])
  })

  it('vann som halveres er et avvik', () => {
    const a = avvikMotBaseline({ vannAndel: 0.05, stiKm: 10, konturKm: 100 }, fasit)
    expect(a).toHaveLength(1)
    expect(a[0].felt).toBe('vannAndel')
    expect(a[0].avvikPst).toBeCloseTo(-50, 1)
  })

  it('felt som mangler i målingen hoppes over', () => {
    expect(avvikMotBaseline({ vannAndel: 0.1 }, fasit)).toEqual([])
  })

  it('absolutt toleranse for små heltall (hull, broer)', () => {
    expect(avvikMotBaseline({ vannHull: 3 }, { vannHull: 4 })).toEqual([])
    expect(avvikMotBaseline({ vannHull: 0 }, { vannHull: 4 })).toHaveLength(1)
  })
})
