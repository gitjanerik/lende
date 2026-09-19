import { describe, it, expect } from 'vitest'
import {
  wgs84ToUtm32, wgs84ToUtm33, utm32ToWgs84, utm32BboxFromWgs84, wgs84BboxFromMeta, svgToWgs84,
  nordavvikDeg, nordavvikForMeta, sannNordRotasjonForMeta, nordavvikTekst,
  punktSkala, punktSkalaISone, punktSkalaForMeta, bakkeMeter, bakkeAreal,
} from './utm.js'

// v12.1.64: forward-projeksjonen er 6. ordens Krüger (Karney/etmerc-ekvivalent).
// Fasit generert med proj4 (+proj=utm +zone=32/33 +ellps=GRS80) — sann UTM.
// Snyder-forwarden som ble byttet ut hadde −4,0 m Ø-V-bias i Kirkenes og
// −5,4 m i Vardø: OSM-lag ble tegnet vest for Kartverket-terrenget (DEM/WCS
// ligger i sann UTM32). Kravet < 1 cm gir god margin til flyttall-støy uten
// å slippe gjennom serie-avvik.
describe('wgs84ToUtm32/33 — absolutt nøyaktighet mot proj4-fasit (v12.1.64)', () => {
  const cases = [
    // navn, lat, lon, E32, N32, E33, N33
    ['Oslo', 59.91, 10.75, 597868.381, 6642681.510, 262409.732, 6649017.749],
    ['Bergen', 60.39, 5.32, 297230.220, 6700510.175, -32253.597, 6734074.911],
    ['Trondheim', 63.43, 10.4, 569864.338, 7034263.482, 270580.083, 7041743.103],
    ['Bodø', 67.28, 14.4, 732500.397, 7472710.152, 474140.073, 7462719.171],
    ['Tromsø', 69.65, 18.96, 885075.424, 7758322.052, 653597.495, 7731821.943],
    ['Alta', 69.97, 23.27, 1041153.552, 7826247.479, 815288.897, 7783951.429],
    ['Kirkenes', 69.727, 30.045, 1299782.811, 7875158.263, 1076688.274, 7806963.356],
    ['Vardø', 70.37, 31.11, 1312917.040, 7957147.879, 1097833.050, 7886942.078],
    ['Lindesnes', 57.98, 7.05, 384682.521, 6428147.559, 30483.414, 6454170.969],
  ]
  for (const [name, lat, lon, e32, n32, e33, n33] of cases) {
    it(`${name}: sone 32 innenfor 1 cm av proj4`, () => {
      const p = wgs84ToUtm32(lat, lon)
      expect(Math.hypot(p.e - e32, p.n - n32)).toBeLessThan(0.01)
    })
    it(`${name}: sone 33 innenfor 1 cm av proj4`, () => {
      const p = wgs84ToUtm33(lat, lon)
      expect(Math.hypot(p.e - e33, p.n - n33)).toBeLessThan(0.01)
    })
  }
})

// v10.1.x: et kart som er kvadratisk i bakke-avstand skal rendres ~kvadratisk i
// UTM-meter-rom. Den gamle SW+NE-diagonal-utledningen undervurderte øst-vest pga.
// meridiankonvergens og ga portrett-kart (verre vekk fra sentralmeridianen).
// utm32BboxFromWgs84 bruker alle fire hjørner og fikser dette.

function bboxFromCenter(lat, lon, halfKm) {
  const dLat = halfKm / 111
  const dLon = halfKm / (111 * Math.cos(lat * Math.PI / 180))
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon }
}

// Gammel 2-hjørners utledning (for å vise at den var skjev).
function twoCorner(bbox) {
  const sw = wgs84ToUtm32(bbox.south, bbox.west)
  const ne = wgs84ToUtm32(bbox.north, bbox.east)
  return {
    widthM: Math.abs(ne.e - sw.e),
    heightM: Math.abs(ne.n - sw.n),
  }
}

describe('utm32BboxFromWgs84 — kvadratisk kart', () => {
  // Spredt i sone 32: nær CM (9°E), langt øst (Tromsø), vest for CM (Bergen).
  const cases = [
    ['Oslo', 59.91, 10.75],
    ['Tromsø', 69.65, 18.95],
    ['Bergen', 60.39, 5.32],
  ]

  for (const [name, lat, lon] of cases) {
    it(`${name}: fire hjørner gir ~kvadratisk (aspect ≈ 1)`, () => {
      const bbox = bboxFromCenter(lat, lon, 1.0)
      const { minE, maxE, minN, maxN } = utm32BboxFromWgs84(bbox)
      const aspect = (maxE - minE) / (maxN - minN)
      expect(aspect).toBeGreaterThan(0.98)
      expect(aspect).toBeLessThan(1.02)
    })
  }

  it('fire hjørner ⊇ to-hjørners diagonal (omslutter hele rektangelet)', () => {
    const bbox = bboxFromCenter(69.65, 18.95, 1.0)
    const four = utm32BboxFromWgs84(bbox)
    const two = twoCorner(bbox)
    // 4-hjørners øst-vest er ALDRI smalere enn diagonalen — den fanger de ekte ytter-hjørnene.
    expect(four.maxE - four.minE).toBeGreaterThanOrEqual(two.widthM - 1e-6)
    // Tromsø var grovt portrett med diagonalen; nå er den kvadratisk.
    expect(two.widthM / two.heightM).toBeLessThan(0.8)
  })
})

// v12.1.52: inversen (utm32ToWgs84) var en ren Snyder-serie som divergerer
// langt fra sentralmeridianen — roundtrip-feilen var ~310 m i Kirkenes og
// ~440 m i Vardø. Det forskjøv Terrarium-samplingen (DEM-kystlinje vs OSM-
// data som naturreservat-grenser) og Overpass-bboksen i Øst-Finnmark. Nå
// itererer inversen mot forward til < 1 mm residual, så roundtrip skal være
// meter-eksakt i HELE bruksområdet (Bergen 5°E → Vardø 31°E).
describe('utm32ToWgs84 — roundtrip-konsistens med forward (v12.1.52)', () => {
  const cases = [
    ['Oslo', 59.91, 10.75],
    ['Bergen', 60.39, 5.32],
    ['Tromsø', 69.65, 18.96],
    ['Alta', 69.97, 23.27],
    ['Kirkenes', 69.73, 30.05],
    ['Vardø', 70.37, 31.11],
  ]
  for (const [name, lat, lon] of cases) {
    it(`${name}: forward → inverse gir samme punkt (< 0.05 m)`, () => {
      const { e, n } = wgs84ToUtm32(lat, lon)
      const back = utm32ToWgs84(e, n)
      const dN = (back.lat - lat) * 111132
      const dE = (back.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180)
      expect(Math.hypot(dE, dN)).toBeLessThan(0.05)
    })
    it(`${name}: inverse → forward gir samme UTM-koordinat (< 0.05 m)`, () => {
      const { e, n } = wgs84ToUtm32(lat, lon)
      // Vilkårlig UTM-punkt i nærheten (celle-hjørner fra DEM-grid o.l.)
      const ll = utm32ToWgs84(e + 137.5, n - 262.25)
      const p2 = wgs84ToUtm32(ll.lat, ll.lon)
      expect(Math.hypot(p2.e - (e + 137.5), p2.n - (n - 262.25))).toBeLessThan(0.05)
    })
  }
})

// v5.20.0: bboksen lå i tre like kopier (kulturminne-lagene, NVE-laget) og
// måtte samles fordi offline-pakkingen må treffe NØYAKTIG samme cache-nøkkel
// som lagene slår opp på. Kravet er derfor ikke bare «riktig», men «likt».
describe('wgs84BboxFromMeta', () => {
  const meta = { minE: 590000, minN: 6640000, maxE: 592000, maxN: 6642000, widthM: 2000, heightM: 2000 }

  it('omslutter alle fire hjørnene av kart-rektangelet', () => {
    const b = wgs84BboxFromMeta(meta)
    for (const [x, y] of [[0, 0], [meta.widthM, 0], [0, meta.heightM], [meta.widthM, meta.heightM]]) {
      const c = svgToWgs84(x, y, meta)
      expect(c.lat).toBeGreaterThanOrEqual(b.south)
      expect(c.lat).toBeLessThanOrEqual(b.north)
      expect(c.lon).toBeGreaterThanOrEqual(b.west)
      expect(c.lon).toBeLessThanOrEqual(b.east)
    }
  })

  it('gir en bboks med positiv utstrekning begge veier', () => {
    const b = wgs84BboxFromMeta(meta)
    expect(b.north).toBeGreaterThan(b.south)
    expect(b.east).toBeGreaterThan(b.west)
  })

  it('er stabil — samme meta gir bit-identisk bboks (cache-nøkkelen avhenger av det)', () => {
    expect(wgs84BboxFromMeta(meta)).toEqual(wgs84BboxFromMeta({ ...meta }))
  })
})

describe('nordavvik — sann nord vs kartnord', () => {
  it('er null på sentralmeridianen (9°Ø)', () => {
    expect(nordavvikDeg(60, 9)).toBeCloseTo(0, 6)
    expect(nordavvikDeg(70, 9)).toBeCloseTo(0, 6)
  })

  // FORTEGNET ER DEN ENE TINGEN SOM KAN VÆRE SNUDD, og en snudd konvergens er
  // usynlig i alt annet enn feltet. Vest for sentralmeridianen ligger sann nord
  // ØST for kartnord (positiv), øst for den ligger den vest (negativ).
  it('har positivt avvik vest for sentralmeridianen, negativt øst for den', () => {
    expect(nordavvikDeg(60.39, 5.32)).toBeGreaterThan(0)    // Bergen
    expect(nordavvikDeg(59.91, 10.75)).toBeLessThan(0)      // Oslo
  })

  it('treffer de kjente verdiene', () => {
    expect(nordavvikDeg(60.39, 5.32)).toBeCloseTo(3.20, 1)    // Bergen
    expect(nordavvikDeg(59.91, 10.75)).toBeCloseTo(-1.51, 1)  // Oslo
    expect(nordavvikDeg(69.73, 30.05)).toBeCloseTo(-19.85, 1) // Kirkenes
    expect(nordavvikDeg(55.68, 12.57)).toBeCloseTo(-2.95, 1)  // København
  })

  // Tilnærmingen (λ − λ0)·sin φ er nær nok i sør, men bommer med 6 bueminutter
  // i Kirkenes. Vi regner gjennom vår EGEN projeksjon, og det er den forskjellen.
  it('avviker fra den sfæriske tilnærmingen der den slutter å holde', () => {
    const enkel = (lat, lon) => (lon - 9) * Math.sin(lat * Math.PI / 180)
    expect(Math.abs(nordavvikDeg(69.73, 30.05) + enkel(69.73, 30.05))).toBeGreaterThan(0.05)
    expect(Math.abs(nordavvikDeg(59.91, 10.75) + enkel(59.91, 10.75))).toBeLessThan(0.01)
  })

  it('rotasjonen er den MOTSATTE av avviket', () => {
    const meta = { widthM: 2000, heightM: 2000, minE: 1063000, minN: 7734000 }
    expect(sannNordRotasjonForMeta(meta)).toBeCloseTo(-nordavvikForMeta(meta), 9)
  })

  it('svarer 0 på meta som mangler geometri i stedet for å kaste', () => {
    expect(nordavvikForMeta(null)).toBe(0)
    expect(nordavvikForMeta({ widthM: 0, heightM: 0 })).toBe(0)
    expect(nordavvikDeg(NaN, 10)).toBe(0)
  })

  // Retningsordet bærer fortegnet — et minustegn i en kolofon på papir er
  // ikke til å tyde.
  it('skriver retningen med ord og komma', () => {
    expect(nordavvikTekst(3.2)).toBe('3,2° mot øst')
    expect(nordavvikTekst(-19.85)).toBe('19,9° mot vest')
  })
})

// ── Punktskala ─────────────────────────────────────────────────────────────
describe('punktSkala — rutemeter per bakkemeter', () => {
  it('er sekantfaktoren 0,9996 på sentralmeridianen', () => {
    expect(punktSkala(60, 9)).toBeCloseTo(0.9996, 6)
    expect(punktSkala(70, 9)).toBeCloseTo(0.9996, 6)
  })

  it('vokser med avstanden fra sentralmeridianen', () => {
    const k = [9, 15, 21, 27, 31].map(lon => punktSkala(70, lon))
    for (let i = 1; i < k.length; i++) expect(k[i]).toBeGreaterThan(k[i - 1])
  })

  it('gir 0,77 % i Vardø — tallet «Om appen» oppgir', () => {
    expect((punktSkala(70.3705, 31.1107) - 1) * 100).toBeCloseTo(0.769, 2)
  })

  // Regresjonsvakt for feilen som ble gjort da funksjonen ble skrevet: målt mot
  // en haversine (kule) kom Vardø ut på 1,18 %. Ligger tallet over 1 %, er
  // nevneren blitt sfærisk igjen.
  it('ligger IKKE på kule-verdien 1,18 %', () => {
    expect((punktSkala(70.3705, 31.1107) - 1) * 100).toBeLessThan(1)
  })

  it('er nær 1 i den sonen Kartverket ville brukt', () => {
    expect(Math.abs(punktSkalaISone(70.3705, 31.1107, 35) - 1)).toBeLessThan(0.0005)
    expect(Math.abs(punktSkalaISone(69.6492, 18.9553, 33) - 1)).toBeLessThan(0.0005)
    // ... og at sone 32 koster vesentlig mer der er hele poenget med figuren.
    expect(Math.abs(punktSkala(70.3705, 31.1107) - 1))
      .toBeGreaterThan(10 * Math.abs(punktSkalaISone(70.3705, 31.1107, 35) - 1))
  })

  // Konformitet: er k den samme i alle retninger, holder ett nord–sør-steg som
  // måling. Sjekkes mot et øst–vest-steg gjennom samme projeksjon.
  //
  // MERK at de to stegene må deles på HVER SIN bakkelengde: en breddegrad
  // spenner meridianbuen M, en lengdegrad parallellen N·cos φ, og M ≠ N på en
  // ellipsoide (0,17 % på 60°N). Sammenlikner man de rå rutelengdene, måler man
  // den forskjellen og ikke konformiteten — samme klasse feil som haversinen.
  it('er retningsuavhengig — ett steg holder', () => {
    const d = 0.0005
    const rad = Math.PI / 180
    const A = 6378137, E2 = 0.00669437999014
    for (const [lat, lon] of [[60, 10], [70, 31]]) {
      const sphi = Math.sin(lat * rad)
      const W = Math.sqrt(1 - E2 * sphi * sphi)
      const M = A * (1 - E2) / (W * W * W)     // krumningsradius i meridianen
      const N = A / W                          // i normalen
      const dLon = d / Math.cos(lat * rad)
      const a = wgs84ToUtm32(lat, lon - dLon)
      const b = wgs84ToUtm32(lat, lon + dLon)
      const kOst = Math.hypot(b.e - a.e, b.n - a.n) / (N * Math.cos(lat * rad) * 2 * dLon * rad)
      const c = wgs84ToUtm32(lat - d, lon), e = wgs84ToUtm32(lat + d, lon)
      const kNord = Math.hypot(e.e - c.e, e.n - c.n) / (M * 2 * d * rad)
      expect(kOst / kNord).toBeCloseTo(1, 4)
      expect(kNord).toBeCloseTo(punktSkala(lat, lon), 6)
    }
  })

  it('faller til 1 på tull i stedet for å kaste', () => {
    expect(punktSkala(NaN, 10)).toBe(1)
    expect(punktSkala(60, undefined)).toBe(1)
    expect(punktSkalaISone(60, 10, NaN)).toBe(1)
  })
})

describe('punktSkalaForMeta — ett tall for hele arket', () => {
  // Øst-Finnmark, 16 × 16 km — det største arket på det verste stedet.
  const stort = { minE: 1305000, minN: 7800000, widthM: 16000, heightM: 16000 }

  it('bruker arkets senter', () => {
    const c = svgToWgs84(stort.widthM / 2, stort.heightM / 2, stort)
    expect(punktSkalaForMeta(stort)).toBeCloseTo(punktSkala(c.lat, c.lon), 10)
  })

  // Påstanden i utm.js: variasjonen over arket er under en tjuedel av nivået,
  // og det er dét som gjør ÉN faktor for hele flata lovlig.
  it('spriker under 0,05 % fra hjørne til hjørne', () => {
    const ks = [[0, 0], [stort.widthM, 0], [0, stort.heightM], [stort.widthM, stort.heightM]]
      .map(([x, y]) => svgToWgs84(x, y, stort))
      .map(c => punktSkala(c.lat, c.lon))
    const spredning = Math.max(...ks) / Math.min(...ks) - 1
    expect(spredning).toBeLessThan(0.0005)
    expect(spredning).toBeLessThan((punktSkalaForMeta(stort) - 1) / 20)
  })

  it('gir 1 uten brukbar meta — uskalert slår gjettet', () => {
    expect(punktSkalaForMeta(null)).toBe(1)
    expect(punktSkalaForMeta({ widthM: 0, heightM: 0 })).toBe(1)
  })
})

describe('bakkeMeter / bakkeAreal', () => {
  it('deler lengde på k og areal på k²', () => {
    expect(bakkeMeter(1000, 1.0077)).toBeCloseTo(1000 / 1.0077, 9)
    expect(bakkeAreal(1e6, 1.0077)).toBeCloseTo(1e6 / (1.0077 ** 2), 6)
  })

  // Fortegnet er den ene tingen som kan bli snudd i en opprydning: k > 1 betyr
  // at arket TEGNER for mange meter, så bakkeavstanden er KORTERE.
  it('gir kortere bakkeavstand når k > 1', () => {
    expect(bakkeMeter(1000, 1.0077)).toBeLessThan(1000)
    expect(bakkeMeter(1000, 0.9996)).toBeGreaterThan(1000)
  })

  it('lar tallet stå på ugyldig k', () => {
    expect(bakkeMeter(500, 0)).toBe(500)
    expect(bakkeMeter(500, NaN)).toBe(500)
    expect(bakkeAreal(500, -1)).toBe(500)
    expect(bakkeMeter(NaN, 1.01)).toBe(0)
  })
})

// v7.9.7: «Om Lende» oppgir hvor lite konvergensen og punktskalaen varierer
// OVER ETT ARK — det er hele begrunnelsen for at arket kan roteres med ett
// tall og måles med ett tall. Marginene sto som «0,4°» og «0,04 %» og var
// begge gale i Finnmark (0,427° / 0,0416 % i Vardø på det største arket).
// Testen holder de nye marginene, så en framtidig innstramming må måles.
describe('ark-spredning — marginene «Om Lende» oppgir (v7.9.7)', () => {
  const STEDER = [
    ['Oslo', 59.9139, 10.7522],
    ['Bergen', 60.3913, 5.3221],
    ['Trondheim', 63.4305, 10.3951],
    ['Tromsø', 69.6492, 18.9553],
    ['Kirkenes', 69.7273, 30.0453],
    ['Vardø', 70.3705, 31.1107],
  ]

  // De fire hjørnene av et kvadratisk ark på `km` sider rundt (lat, lon).
  function hjorner(lat, lon, km) {
    const dLat = km / 2 / 111.32
    const dLon = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180))
    return [
      [lat - dLat, lon - dLon], [lat - dLat, lon + dLon],
      [lat + dLat, lon - dLon], [lat + dLat, lon + dLon],
    ]
  }

  const spenn = (v) => Math.max(...v) - Math.min(...v)

  it('konvergensen varierer under en halv grad over det største arket', () => {
    for (const [navn, lat, lon] of STEDER) {
      const v = spenn(hjorner(lat, lon, 16).map(([la, lo]) => nordavvikDeg(la, lo)))
      expect(v, navn).toBeLessThan(0.5)
      expect(v, navn).toBeGreaterThan(0) // en null-spredning ville betydd at målingen ikke måler
    }
  })

  it('punktskalaen varierer under 0,05 % over det største arket', () => {
    for (const [navn, lat, lon] of STEDER) {
      const v = spenn(hjorner(lat, lon, 16).map(([la, lo]) => punktSkala(la, lo)))
      expect(v * 100, navn).toBeLessThan(0.05)
    }
  })

  it('over et 8 km-ark er UTM32-spredningen rundt 0,02 % i Finnmark', () => {
    const v = spenn(hjorner(70.3705, 31.1107, 8).map(([la, lo]) => punktSkala(la, lo)))
    expect(v * 100).toBeCloseTo(0.021, 2)
  })
})
