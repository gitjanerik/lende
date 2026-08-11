// FASIT for kart-pipelinen: mål et ferdig bygget kart, og sjekk invarianter som
// MÅ holde uansett hvilket sted vi bygger.
//
// Hvorfor dette finnes: enhetstestene dekker rene funksjoner, men de dyre feilene
// i Lende har alltid bodd i SAMMENSETNINGEN på ekte geografi — vann som forsvant
// fordi navne-LOD skjulte polygonene (v1.0.51), øyer som mistet hullene sine
// (v1.0.35–41), en elv klassifisert som innsjø (v4.8.12), konturer tegnet over
// vann, stinett som falt i fragmenter (v5.5.4), spøkelsesfliser forskjøvet en
// flisebredde (v4.3.0). Ingen av dem kunne feiles av en test på en ren funksjon.
// Nesten hver tiende utgivelse i CHANGELOG har handlet om denne stacken.
//
// Modulen er REN: den tar en SVG-streng og gir tall + brudd. Bygging (nett,
// Kartverket, Overpass) skjer i scripts/fasit-kart.js, som kjører i CI.
// Skillet er med vilje — invariantene skal kunne testes offline med syntetisk
// SVG, ellers vet vi ikke om sjekkene selv virker.

import { parsePathSubpaths, polylineLength } from './pathUtils.js'
import { ringArea } from './buildingMass.js'

// ISOM-koder gruppert etter hva de ER i denne sammenhengen. Flate vs linje
// avgjør om geometrien skal måles som areal eller lengde.
export const VANN_FLATER = new Set(['301', '302', '303', '307'])
export const VANN_LINJER = new Set(['304', '305'])
export const KONTUR_LINJER = new Set(['101', '102', '103'])
export const VEG_FLATER = new Set(['403', '405', '406', '407', '408'])
export const STI_LINJER = new Set(['505', '506', '507'])
export const VEG_LINJER = new Set(['501', '502', '503', '504'])
export const BRO = '509'

const ALLE_FLATER = new Set([...VANN_FLATER, ...VEG_FLATER, '402', '520', '521', '522'])

/**
 * Les geometri ut av en kart-SVG, gruppert på ISOM-kode.
 *
 * Flater kommer som `{ytre, hull}` — nettopp fordi HULLENE er poenget her. En
 * øy i en innsjø er et hull i vannflata, og måler man ringene uten å skille
 * ytre fra hull, blir en øy «vann»: første kjøring på Kolstadøya ga 131 %
 * vanndekning og meldte at konturene PÅ ØYA lå i vann. Hull utledes av
 * nøsting (partall dybde = ytre, oddetall = hull), som er den samme
 * regelen SVG-ens fill-rule følger.
 *
 * Ghost-fliser (nabofliser tegnet som nestede `<svg x= y=>`) hører IKKE til
 * kartet vi måler — de er en visuell kulisse rundt aktiv flis, og å ta dem med
 * ville forurenset alle arealtall. De hoppes over.
 *
 * @param {string} svgText
 * @returns {{widthM:number, heightM:number,
 *            flater: Map<string, Array<{ytre:Array<[number,number]>, hull:Array<Array<[number,number]>>}>>,
 *            linjer: Map<string, Array<Array<[number,number]>>>}}
 */
export function lesKartGeometri(svg, { parseSvg = standardParser } = {}) {
  const rot = typeof svg === 'string' ? parseSvg(svg) : svg
  const vb = (rot?.getAttribute?.('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const widthM = vb.length === 4 && Number.isFinite(vb[2]) ? vb[2] : 0
  const heightM = vb.length === 4 && Number.isFinite(vb[3]) ? vb[3] : 0

  const flater = new Map()
  const linjer = new Map()

  // Gå på PATHS, ikke på grupper: hver path knyttes til sin NÆRMESTE
  // data-iso-forelder. Første versjon leste grupper med regex og telte nestede
  // grupper to ganger — Vardåsen fikk 185 km sti i et 16 km²-kart. Samme felle
  // som mapTexture-kommentaren advarer om: `<g …>([\s\S]*?)</g>` stopper på
  // første `</g>`, og kontur-laget har nestede grupper.
  // Stier og småveger tegnes med CASING + KJERNE: to paths med identisk `d`,
  // en bred lys under en smal mørk. Målt på Vardåsen: 976 paths for ISOM 505,
  // men 488 unike — altså eksakt dobbelt, og 185 «km sti» i et 17 km²-kart.
  // Vi teller hver geometri én gang per kode.
  const sett = new Map()
  for (const p of rot?.querySelectorAll?.('path') ?? []) {
    if (iNestetSvg(p, rot)) continue        // spøkelsesflis = kulisse, ikke kartet
    const kode = naermesteIsoKode(p)
    if (!kode) continue
    const d = p.getAttribute('d') ?? ''
    const sette = sett.get(kode) ?? new Set()
    if (sette.has(d)) continue
    sette.add(d)
    sett.set(kode, sette)
    const sub = parsePathSubpaths(d).filter(r => r.length >= 2)
    if (!sub.length) continue
    if (ALLE_FLATER.has(kode)) {
      const liste = flater.get(kode) ?? []
      // Subpath-ene i ÉN path hører sammen: det er der hull bor.
      liste.push(...nostRinger(sub.filter(r => r.length >= 3)))
      flater.set(kode, liste)
    } else {
      const liste = linjer.get(kode) ?? []
      liste.push(...sub)
      linjer.set(kode, liste)
    }
  }
  return { widthM, heightM, flater, linjer }
}

function standardParser(text) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('kartFasit: ingen DOMParser — send inn parseSvg (i node: linkedom)')
  }
  return new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
}

function naermesteIsoKode(el) {
  for (let n = el; n && n.getAttribute; n = n.parentNode) {
    const kode = n.getAttribute('data-iso')
    if (kode) return kode
  }
  return null
}

// Ligger elementet inne i en NESTET <svg>? Da hører det til en nabo-flis
// (spøkelsesflis), som er en visuell kulisse rundt kartet vi måler.
function iNestetSvg(el, rot) {
  for (let n = el.parentNode; n && n !== rot; n = n.parentNode) {
    if (String(n.tagName).toLowerCase() === 'svg') return true
  }
  return false
}

/**
 * Nøst ringer til flater med hull: en ring som ligger inne i et oddetall andre
 * ringer er et hull, ellers er den en ytre ring. Hullet knyttes til den
 * MINSTE ytre ringen som omslutter det (øy i innsjø, ikke øy i havet rundt).
 *
 * @param {Array<Array<[number,number]>>} ringer
 * @returns {Array<{ytre:Array<[number,number]>, hull:Array<Array<[number,number]>>}>}
 */
export function nostRinger(ringer) {
  const info = ringer.map(ring => ({ ring, bb: bbox(ring), areal: ringArea(ring) }))
    .sort((a, b) => b.areal - a.areal)
  const omsluttere = info.map((r, i) => {
    const inne = []
    const senter = senterAv(r)
    for (let j = 0; j < i; j++) if (inneIFlate(senter, info[j])) inne.push(j)
    return inne
  })
  const flater = []
  const indeksAvYtre = new Map()
  info.forEach((r, i) => {
    if (omsluttere[i].length % 2 === 0) {
      indeksAvYtre.set(i, flater.length)
      flater.push({ ytre: r.ring, hull: [] })
    }
  })
  info.forEach((r, i) => {
    if (omsluttere[i].length % 2 === 0) return
    // Innerste omsluttende ytre ring = den siste (minste) i lista.
    for (let k = omsluttere[i].length - 1; k >= 0; k--) {
      const f = indeksAvYtre.get(omsluttere[i][k])
      if (f != null) { flater[f].hull.push(r.ring); return }
    }
  })
  return flater
}

const senterAv = (r) => {
  // Et punkt som ligger i ringen, ikke bbox-senteret: en U-formet flate har
  // bbox-senter UTENFOR seg selv, og da ville nøstingen bommet.
  const kandidater = [
    [(r.bb.minX + r.bb.maxX) / 2, (r.bb.minY + r.bb.maxY) / 2],
    ...r.ring.slice(0, 8).map((p, i) => {
      const q = r.ring[(i + 1) % r.ring.length]
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    }),
  ]
  for (const p of kandidater) if (punktIRing(p, r.ring)) return p
  return kandidater[0]
}

/** Netto areal for en kode, i m² — ytre ringer minus hull. */
export function arealFor(geo, koder) {
  let sum = 0
  for (const kode of koder) {
    for (const f of geo.flater.get(kode) ?? []) {
      sum += ringArea(f.ytre)
      for (const h of f.hull) sum -= ringArea(h)
    }
  }
  return Math.max(0, sum)
}

/** Alle flater (med hull) for et sett koder. */
export function flaterFor(geo, koder) {
  const ut = []
  for (const kode of koder) ut.push(...(geo.flater.get(kode) ?? []))
  return ut
}

/** Sum av linjelengder for en kode, i meter. */
export function lengdeFor(geo, koder) {
  let sum = 0
  for (const kode of koder) {
    for (const linje of geo.linjer.get(kode) ?? []) sum += polylineLength(linje)
  }
  return sum
}

/** Punkt i ring (ray casting). Ringen antas lukket implisitt. */
export function punktIRing(pt, ring) {
  if (!ring || ring.length < 3) return false
  const [x, y] = pt
  let inne = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne
  }
  return inne
}

// Bbox for en ring — grovsil før den dyre punkt-i-ring-testen.
function bbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Ligger punktet i en av flatene — utenom hullene? Et punkt på en øy i en
 * innsjø ligger IKKE i vannet, og det er nettopp den forskjellen som avgjør om
 * konturene på øya er en feil eller helt riktige.
 *
 * @param {[number,number]} p
 * @param {Array<{ytre:Array, hull:Array}>} flater
 */
export function punktIFlater(p, flater) {
  for (const f of flater) {
    const bb = f._bb ?? (f._bb = bbox(f.ytre))
    if (p[0] < bb.minX || p[0] > bb.maxX || p[1] < bb.minY || p[1] > bb.maxY) continue
    if (!punktIRing(p, f.ytre)) continue
    if (f.hull.some(h => punktIRing(p, h))) continue    // på en øy = på land
    return true
  }
  return false
}

/**
 * Hvor stor andel av KARTFLATEN dekkes av flatene? Målt på et rutenett, ikke
 * som sum av ringarealer — en innsjø strekker seg gjerne langt utenfor
 * utsnittet, og summen av ringareal ga da 119 % vanndekning på Kolstadøya.
 * Rutenettet er klippet til kartet ved konstruksjon, og 200 × 200 punkter gir
 * en oppløsning på 0,0025 som er mer enn nok for en fasit.
 *
 * @param {ReturnType<typeof lesKartGeometri>} geo
 * @param {Array<{ytre:Array, hull:Array}>} flater
 */
export function andelAvKartet(geo, flater, { ruter = 200 } = {}) {
  if (!flater.length || !(geo.widthM > 0) || !(geo.heightM > 0)) return 0
  let inne = 0
  for (let iy = 0; iy < ruter; iy++) {
    const y = ((iy + 0.5) / ruter) * geo.heightM
    for (let ix = 0; ix < ruter; ix++) {
      const x = ((ix + 0.5) / ruter) * geo.widthM
      if (punktIFlater([x, y], flater)) inne++
    }
  }
  return inne / (ruter * ruter)
}

/**
 * Punkter som ligger DYPT inne i flatene — mer enn `dybdeM` fra nærmeste kant.
 *
 * Dette er land-mask-invariantens skarpe kant. Å bare spørre «ligger punktet i
 * vann» gir falske treff: målt på Kolstadøya lå 2,8 % av konturpunktene inne i
 * vann, men median 6 m og maksimalt 22 m fra bredden — det er slark fra
 * DP-forenkling og Chaikin-glatting av to kurver som skal møtes, ikke en
 * sviktende maske. En ekte land-mask-feil maler konturer HUNDRE meter ut i
 * innsjøen, og det er det denne fanger.
 *
 * Segmentene indekseres i et rutenett med cellestørrelse = dybdeM, så hvert
 * punkt bare trenger å se i sine 3 × 3 naboceller.
 */
export function punkterDyptInne(punkter, flater, { dybdeM = 40 } = {}) {
  const inne = punkter.filter(p => punktIFlater(p, flater))
  if (!inne.length) return { dypere: 0, inne: 0, testet: punkter.length }

  const celle = Math.max(1, dybdeM)
  const rutenett = new Map()
  const leggInn = (a, b) => {
    const minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0])
    const minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1])
    for (let cx = Math.floor(minX / celle); cx <= Math.floor(maxX / celle); cx++) {
      for (let cy = Math.floor(minY / celle); cy <= Math.floor(maxY / celle); cy++) {
        const key = `${cx},${cy}`
        const liste = rutenett.get(key) ?? []
        liste.push([a, b])
        rutenett.set(key, liste)
      }
    }
  }
  for (const f of flater) {
    for (const ring of [f.ytre, ...f.hull]) {
      for (let i = 0; i < ring.length; i++) leggInn(ring[i], ring[(i + 1) % ring.length])
    }
  }

  let dypere = 0
  for (const p of inne) {
    const cx = Math.floor(p[0] / celle)
    const cy = Math.floor(p[1] / celle)
    let naer = false
    for (let dx = -1; dx <= 1 && !naer; dx++) {
      for (let dy = -1; dy <= 1 && !naer; dy++) {
        for (const [a, b] of rutenett.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (avstandTilSegment(p, a, b) <= dybdeM) { naer = true; break }
        }
      }
    }
    if (!naer) dypere++
  }
  return { dypere, inne: inne.length, testet: punkter.length }
}

function avstandTilSegment(p, a, b) {
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const len2 = vx * vx + vy * vy
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}

/**
 * Hvor stor andel av punktene i `linjer` ligger inne i en av `flater`?
 * Rapporteres som metrikk (baseline fanger drift), men er for grov til å være
 * et brudd i seg selv — se punkterDyptInne.
 */
export function andelPunkterInne(linjer, flater, { maksPunkter = 20000 } = {}) {
  if (!flater.length) return { andel: 0, inne: 0, testet: 0 }
  const alle = linjer.flat()
  const steg = Math.max(1, Math.ceil(alle.length / maksPunkter))
  let inne = 0
  let testet = 0
  for (let i = 0; i < alle.length; i += steg) {
    testet++
    if (punktIFlater(alle[i], flater)) inne++
  }
  return { andel: testet ? inne / testet : 0, inne, testet }
}

/**
 * Hvor mange sti-/veg-segmenter krysser en vannflate uten at det finnes en bro
 * (509) i nærheten? Klassen «ruter tvers over innsjøer» (Gjende, Verkensvannet).
 * Vi teller segmenter der BEGGE endepunkter ligger inne i samme vannflate — en
 * bro over en elv har endepunktene på land og skal ikke telles.
 */
export function stiOverVann(geo, { broRadiusM = 60 } = {}) {
  const vann = flaterFor(geo, VANN_FLATER)
  if (!vann.length) return { antall: 0, lengsteM: 0, traverseringer: [] }

  const broPunkter = (geo.linjer.get(BRO) ?? []).flat()
  const naerBro = (p) => broPunkter.some(b => Math.hypot(b[0] - p[0], b[1] - p[1]) <= broRadiusM)

  // Sammenhengende segmenter i vann slås sammen til ÉN traversering, og det er
  // LENGDEN som betyr noe: 20 m er en glattet elvebredd, 3,5 km er en sti
  // tegnet rett over innsjøen (målt ved Rondvatnet).
  const traverseringer = []
  for (const kode of [...STI_LINJER, ...VEG_LINJER]) {
    for (const linje of geo.linjer.get(kode) ?? []) {
      let lopende = null
      for (let i = 0; i + 1 < linje.length; i++) {
        const a = linje[i]
        const b = linje[i + 1]
        // BEGGE endepunkter i vann: en bro over en elv har dem på land.
        const iVann = punktIFlater(a, vann) && punktIFlater(b, vann)
          && !naerBro(a) && !naerBro(b)
        if (iVann) {
          const d = Math.hypot(b[0] - a[0], b[1] - a[1])
          if (lopende) lopende.lengdeM += d
          else lopende = { kode, lengdeM: d, punkt: [a[0], a[1]] }
        } else if (lopende) {
          traverseringer.push(lopende)
          lopende = null
        }
      }
      if (lopende) traverseringer.push(lopende)
    }
  }
  traverseringer.sort((a, b) => b.lengdeM - a.lengdeM)
  return {
    antall: traverseringer.length,
    lengsteM: Math.round(traverseringer[0]?.lengdeM ?? 0),
    traverseringer: traverseringer.slice(0, 10),
  }
}

function inneIFlate(p, { ring, bb }) {
  if (p[0] < bb.minX || p[0] > bb.maxX || p[1] < bb.minY || p[1] > bb.maxY) return false
  return punktIRing(p, ring)
}

/**
 * Hull i vannflater = øyer. Kolstadøya-klassen (v1.0.35–41): forsvinner
 * hullene, er øyene malt over med vann.
 */
export function vannHull(geo) {
  let hull = 0
  for (const f of flaterFor(geo, VANN_FLATER)) hull += f.hull.length
  return hull
}

/**
 * Alle målene vi sammenligner mot baseline. Tallene er bevisst grove — de skal
 * fange «forsvant», «eksploderte» og «byttet klasse», ikke små forbedringer.
 *
 * @param {ReturnType<typeof lesKartGeometri>} geo
 */
export function kartMetrikker(geo) {
  return {
    breddeM: Math.round(geo.widthM),
    hoydeM: Math.round(geo.heightM),
    vannAndel: rund(andelAvKartet(geo, flaterFor(geo, VANN_FLATER)), 4),
    vannFlater: flaterFor(geo, VANN_FLATER).length,
    vannHull: vannHull(geo),
    elvKm: rund(lengdeFor(geo, VANN_LINJER) / 1000, 2),
    vegetasjonAndel: rund(andelAvKartet(geo, flaterFor(geo, VEG_FLATER)), 4),
    konturKm: rund(lengdeFor(geo, KONTUR_LINJER) / 1000, 1),
    stiKm: rund(lengdeFor(geo, STI_LINJER) / 1000, 2),
    vegKm: rund(lengdeFor(geo, VEG_LINJER) / 1000, 2),
    broer: (geo.linjer.get(BRO) ?? []).length,
  }
}

const rund = (x, d) => Number(x.toFixed(d))

// Invarianter som MÅ holde uansett sted. Terskler er satt slik at de tåler
// normal variasjon i kartdata, men fanger de historiske feilklassene.
export const INVARIANT_TERSKLER = Object.freeze({
  // Hvor langt inn i vannet et punkt må ligge før det ikke kan forklares av
  // forenkling og glatting av strandlinja. Målt slark på Kolstadøya: maks
  // 22 m. 40 m gir god margin, og en ekte maske-feil ligger langt over.
  dybdeIVannM: 40,
  // Andel av punktene som får ligge dypt i vann før det er en bug. Ingenting
  // er idealet; 0,5 % tåler en enkelt rar geometri uten å rope.
  maksAndelDyptIVann: 0.005,
  // Sti tvers over vann uten bro, målt i METER sammenhengende. Glattede
  // elvebredder og strandkanter gir titalls meter; en sti tegnet over
  // innsjøen gir hundrevis. Rondvatnet-tilfellet: 3 467 m.
  maksStiIVannM: 250,
})

/**
 * Sjekk invariantene. Brudd = «dette skal aldri skje». Advarsler = «se på det».
 *
 * @param {ReturnType<typeof lesKartGeometri>} geo
 * @param {{forventVann?: boolean, forventSti?: boolean, forventHull?: number}} forventet
 */
export function sjekkInvarianter(geo, forventet = {}) {
  const brudd = []
  const advarsler = []
  const m = kartMetrikker(geo)

  if (!(geo.widthM > 0 && geo.heightM > 0)) {
    brudd.push('kartet har ingen viewBox i meter')
    return { brudd, advarsler, metrikker: m }
  }

  const vannFlater = flaterFor(geo, VANN_FLATER)

  // 1) Vann skal finnes der vi vet det finnes (kyst, innsjø). Klassen «vannet
  //    forsvinner» — CORS-fallback, LOD som skjulte polygonene.
  if (forventet.forventVann && m.vannAndel <= 0) {
    brudd.push('ingen vannflater i et kart som skal ha vann')
  }
  // 2) … men «mye vann» kan ikke være et brudd i seg selv: Henningsvær i
  //    Lofoten ER 91 % sjø, og første utgave av denne sjekken meldte det som
  //    feil. Wedge-artefakten (en multipolygon-ring som ikke ble sydd sammen)
  //    har en annen signatur: en flate som spenner over hele kartet, men bare
  //    fyller en flis av sitt eget omriss.
  for (const u of usydeFlater(geo, vannFlater)) {
    brudd.push(`vannflate dekker ${u.andelPst} % av kartet med bare ${u.punkter} punkter (${u.arealPerPunkt} m² per punkt) — ringene er trolig ikke sydd sammen`)
  }
  // 3) Land-mask: konturer og vegetasjon skal ikke tegnes UTE I vannet.
  //    Strandkant-slark er greit; hundre meter ut i innsjøen er det ikke.
  const dybde = INVARIANT_TERSKLER.dybdeIVannM
  const konturPunkter = [...KONTUR_LINJER].flatMap(k => geo.linjer.get(k) ?? []).flat()
  const kontur = punkterDyptInne(konturPunkter, vannFlater, { dybdeM: dybde })
  if (andelAv(kontur) > INVARIANT_TERSKLER.maksAndelDyptIVann) {
    brudd.push(`${kontur.dypere} konturpunkter ligger mer enn ${dybde} m ute i vannet (land-masken svikter)`)
  }
  // Vegetasjonsflatenes ringpunkter: ligger de dypt i vann, er flata malt over.
  const vegPunkter = flaterFor(geo, VEG_FLATER).flatMap(f => f.ytre)
  const veg = punkterDyptInne(vegPunkter, vannFlater, { dybdeM: dybde })
  if (andelAv(veg) > INVARIANT_TERSKLER.maksAndelDyptIVann) {
    brudd.push(`${veg.dypere} vegetasjonspunkter ligger mer enn ${dybde} m ute i vannet`)
  }
  // 4) Sti tvers over vann uten bro. ADVARSEL, ikke brudd: den lengste vi
  //    fant (3 467 m over Rondvatnet) er OSM-way 781607225 — highway=path,
  //    source=Strava heatmap, fixme=resurvey. Altså en isrute noen har gått
  //    om vinteren, ærlig gjengitt av Lende. Vi kan ikke feile CI på
  //    kvaliteten i OSM; men tallet ligger i fasiten, så en ENDRING synes.
  const overVann = stiOverVann(geo)
  if (overVann.lengsteM > INVARIANT_TERSKLER.maksStiIVannM) {
    advarsler.push(`sti/veg går ${overVann.lengsteM} m gjennom vann uten bro (ISOM ${overVann.traverseringer[0]?.kode}) — sjekk om kilden er en isrute`)
  } else if (overVann.antall > 0) {
    advarsler.push(`${overVann.antall} kryssing(er) av vann uten bro, lengste ${overVann.lengsteM} m`)
  }
  // 5) Stinett der vi vet det finnes.
  if (forventet.forventSti && m.stiKm + m.vegKm <= 0) {
    brudd.push('ingen sti eller veg i et kart som skal ha stinett')
  }
  // 6) Øyer i vann: forsvinner hullene, er det Kolstadøya-klassen på nytt.
  if (Number.isFinite(forventet.forventHull) && m.vannHull < forventet.forventHull) {
    brudd.push(`bare ${m.vannHull} hull i vannflatene, ventet minst ${forventet.forventHull} (øyer mistet hull)`)
  }
  // 7) Konturer skal finnes i terreng med relieff.
  if (forventet.forventKonturer && m.konturKm <= 0) {
    brudd.push('ingen høydekurver — DEM-en er trolig syntetisk eller mangler')
  }

  return {
    brudd,
    advarsler,
    metrikker: {
      ...m,
      konturIVann: rund(andelAv(kontur), 4),
      konturDyptIVann: kontur.dypere,
      vegDyptIVann: veg.dypere,
      stiIVannM: overVann.lengsteM,
      stiOverVann: overVann.antall,
    },
  }
}

const andelAv = ({ dypere, testet }) => (testet ? dypere / testet : 0)

/**
 * Usydde ringer: en KJEMPEFLATE MED FÅ PUNKTER.
 *
 * Når en OSM-multipolygon ikke ring-sys (assembleRelationRings i mapBuilder),
 * blir resultatet en vifte tvers over kartet — stor flate, en håndfull
 * verteks. Ekte vann er motsatt: Drammenselva måler 3,37 km² på 1 242 punkter
 * (2 700 m² per punkt), Gjende og Lofoten-skjærgården har tusenvis. Terskelen
 * på 20 000 m² per punkt ligger godt mellom de to.
 *
 * Dette er FJERDE forsøk på denne sjekken, og de tre første er lærdommen —
 * hver av dem ble avslørt av et ekte sted:
 *   1. «vann dekker > 90 %» feilet Henningsvær, som ER 91 % sjø.
 *   2. «spenner kartet men fyller lite av omrisset» feilet Drammenselva,
 *      fordi en elv er lang og tynn.
 *   3. «få punkter i ytre ring» feilet Henningsvær igjen: den autoritative
 *      sjøgeometrien har et grovt ytre omriss (nesten kartrammen) og all
 *      detaljen i 241 HULL — holmene. Derfor telles hele flata, hull inkludert.
 */
export function usydeFlater(geo, flater, { minAndel = 0.05, maksArealPerPunkt = 20000 } = {}) {
  const kartAreal = geo.widthM * geo.heightM
  if (!(kartAreal > 0)) return []
  const funn = []
  for (const f of flater) {
    const areal = ringArea(f.ytre)
    if (areal / kartAreal < minAndel) continue
    const punkter = f.ytre.length + f.hull.reduce((n, h) => n + h.length, 0)
    const perPunkt = areal / Math.max(1, punkter)
    if (perPunkt <= maksArealPerPunkt) continue
    funn.push({
      andelPst: Math.round((areal / kartAreal) * 100),
      punkter,
      arealPerPunkt: Math.round(perPunkt),
    })
  }
  return funn
}

/**
 * Sammenlign mot lagret baseline. Toleransen er per felt: tall som skal være
 * stabile (vann, konturer) får stram toleranse, tall som endrer seg med
 * datakilder får løsere.
 *
 * @returns {Array<{felt:string, fasit:number, naa:number, avvikPst:number}>}
 */
export function avvikMotBaseline(metrikker, baseline, toleranser = STANDARD_TOLERANSER) {
  const avvik = []
  for (const [felt, fasit] of Object.entries(baseline ?? {})) {
    if (typeof fasit !== 'number') continue
    const naa = metrikker[felt]
    if (typeof naa !== 'number') continue
    const tol = toleranser[felt] ?? toleranser.standard
    // Toleranse ≥ 1 leses som ANTALL (hull, broer — der ett opp eller ned er
    // datastøy, men fem er en bug); under 1 som andel, med et lite gulv så
    // 0 → 0,001 ikke leses som uendelig avvik.
    const slakk = tol >= 1 ? tol : Math.max(Math.abs(fasit) * tol, 0.001)
    if (Math.abs(naa - fasit) <= slakk) continue
    avvik.push({
      felt,
      fasit,
      naa,
      avvikPst: fasit === 0 ? Infinity : rund(((naa - fasit) / Math.abs(fasit)) * 100, 1),
    })
  }
  return avvik
}

export const STANDARD_TOLERANSER = Object.freeze({
  standard: 0.1,        // 10 %
  vannAndel: 0.05,
  konturKm: 0.05,
  breddeM: 0.001,
  hoydeM: 0.001,
  vannHull: 1,          // absolutt: ett hull opp eller ned er datastøy
  broer: 2,
  stiKm: 0.15,
  vegKm: 0.15,
  elvKm: 0.2,
  vannFlater: 0.25,
  vegetasjonAndel: 0.15,
})
