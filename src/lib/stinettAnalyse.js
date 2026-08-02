// Stinett-analyse — «hvor mange km sti er det her, og hva er den lengste
// turen?». Ren modul (ingen DOM/fs/nett) delt av Lende-chatten
// (lendeAiTools), MCP-serveren (mcp/server.js) og Cloudflare-MCP-speilet.
//
// Modellen:
//  • Sti = ISOM 505/506/507 + skogsbilvei 504. Småveg 503 (og bro 509) er
//    BINDELEDD: korte strekk (≤ maksKoblerM per sammenhengende løp) kan koble
//    to stinett sammen og inngå i turlengder, men teller aldri i sti-summen.
//  • Grafen bygges med componentBridgeM: 0 — Stifinnerens 80 m-komponentbroer
//    ville forfalsket konnektiviteten analysen skal måle ærlig.
//  • Komponenter under en dynamisk minstelengde (tettere stinett → høyere
//    krav) ekskluderes fra summen — korte, isolerte stumper støyer bare.
//  • «Lengste vandring» er graf-diameteren per komponent (dobbel Dijkstra) —
//    en ærlig heuristikk; eksakt lengste enkle sti er NP-hard.
//  • Tur-kandidater: per komponent diameterstien (A→B) og lengste påviste
//    sløyfe (rundtur), begge kun når de er ≥ minTurM. 0 treff er et gyldig,
//    ærlig svar når nettet bare har korte fragmenter.

import { buildRoutingGraph } from './routing.js'
import { parsePathSubpaths, polylineLength } from './pathUtils.js'
import { sampleProfile } from './elevationProfile.js'

export const STI_KODER = new Set(['505', '506', '507', '504'])
export const KOBLER_KODER = new Set(['503', '509', 'bridge'])

const MAKS_TURER = 6
const MAKS_SLOYFE_KANTER = 40   // maks kanter som prøves ved sløyfe-søk
const MIN_SEGMENT_M = 100       // minste segmentlengde for bratthetsmåling

/**
 * Trekk sti-/bindeledd-geometri ut av en kart-SVG. Fungerer både med
 * browser-DOMParser og linkedom — leser kun `d`-attributter, aldri getBBox,
 * så SVG-en trenger ikke monteres.
 * @param {Element} svgRootEl
 * @returns {Array<{coordinates: Array<[number,number]>, isomCode: string}>}
 */
export function stinettFeaturesFromSvgEl(svgRootEl) {
  const features = []
  if (!svgRootEl?.querySelectorAll) return features
  for (const el of svgRootEl.querySelectorAll('[data-iso]')) {
    const code = el.getAttribute('data-iso')
    if (!STI_KODER.has(code) && !KOBLER_KODER.has(code)) continue
    const paths = el.tagName.toLowerCase() === 'path' ? [el] : el.querySelectorAll('path')
    for (const p of paths) {
      const d = p.getAttribute('d')
      if (!d) continue
      for (const sub of parsePathSubpaths(d)) {
        if (sub.length >= 2) features.push({ coordinates: sub, isomCode: code })
      }
    }
  }
  return features
}

/**
 * Dynamisk minstelengde (meter) for at en komponent skal telle med, som
 * funksjon av sti-tetthet d = stiKm per kart-km². Ved lav tetthet (øyer,
 * fjell) teller alt ≥ 300 m; i tette nett stiger kravet mot 500 m. Taket lå
 * først på 2 km, men brukertest (Stormoen, 1:10 000) viste at det kuttet så
 * mange ekte småstier fra summen at totalinntrykket ble misvisende.
 */
export function minKomponentM(stiKm, arealKm2) {
  const d = arealKm2 > 0 ? stiKm / arealKm2 : 0
  return Math.min(Math.max(300 * Math.sqrt(Math.max(d, 1)), 300), 500)
}

// --- liten binærhaug for Dijkstra --------------------------------------

function heapPush(h, item) {
  h.push(item)
  let i = h.length - 1
  while (i > 0) {
    const p = (i - 1) >> 1
    if (h[p][0] <= h[i][0]) break
    ;[h[p], h[i]] = [h[i], h[p]]
    i = p
  }
}

function heapPop(h) {
  const top = h[0]
  const last = h.pop()
  if (h.length) {
    h[0] = last
    let i = 0
    for (;;) {
      const l = 2 * i + 1, r = l + 1
      let m = i
      if (l < h.length && h[l][0] < h[m][0]) m = l
      if (r < h.length && h[r][0] < h[m][0]) m = r
      if (m === i) break
      ;[h[m], h[i]] = [h[i], h[m]]
      i = m
    }
  }
  return top
}

/**
 * Dijkstra over en adjasens-map (node → [{to, e}]), valgfritt avgrenset til
 * maxDist og med én ekskludert kant (til sløyfe-søket). Returnerer dist- og
 * forgjenger-mapper — grafene her er små nok til at Map-er er raske.
 */
function dijkstraFrom(adj, source, { maxDist = Infinity, excludeKey = null } = {}) {
  const dist = new Map([[source, 0]])
  const prevNode = new Map()
  const prevEdge = new Map()
  const heap = [[0, source]]
  while (heap.length) {
    const [d, u] = heapPop(heap)
    if (d > dist.get(u)) continue
    for (const { to, e } of adj.get(u) ?? []) {
      if (excludeKey != null && e.key === excludeKey) continue
      const nd = d + e.length
      if (nd > maxDist) continue
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd)
        prevNode.set(to, u)
        prevEdge.set(to, e)
        heapPush(heap, [nd, to])
      }
    }
  }
  return { dist, prevNode, prevEdge }
}

function addAdj(map, a, rec) {
  const arr = map.get(a)
  if (arr) arr.push(rec)
  else map.set(a, [rec])
}

function tracePath(prevNode, source, target) {
  const path = [target]
  let cur = target
  while (cur !== source) {
    cur = prevNode.get(cur)
    if (cur == null) return null
    path.push(cur)
  }
  return path.reverse()
}

function fjernest(dist) {
  let best = null, bestD = -1
  for (const [n, d] of dist) {
    if (d > bestD) { bestD = d; best = n }
  }
  return { node: best, distM: bestD }
}

/** Punktet `targetM` meter inn langs en polyline (klemt til endene). */
function pointAtDistance(coords, targetM) {
  let acc = 0
  for (let i = 1; i < coords.length; i++) {
    const seg = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1])
    if (acc + seg >= targetM && seg > 0) {
      const t = (targetM - acc) / seg
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      ]
    }
    acc += seg
  }
  return coords[coords.length - 1]
}

// Bratteste/slakeste parti over høydeprofil-samples: to-peker-vindu med
// minst MIN_SEGMENT_M utstrekning, på 5-punkts-glattede høyder (samme
// glatting som sampleProfile bruker for stigning/fall, så DEM-støy på
// desimeter-nivå ikke gir fantasi-bratthet).
function segmentHelninger(samples) {
  const elev = movingAverage(samples.map((s) => s.elev), 5)
  let maxPct = null, minPct = null
  let j = 0
  for (let i = 0; i < samples.length; i++) {
    if (elev[i] == null) continue
    if (j <= i) j = i + 1
    while (j < samples.length && samples[j].distM - samples[i].distM < MIN_SEGMENT_M) j++
    if (j >= samples.length || elev[j] == null) continue
    const distM = samples[j].distM - samples[i].distM
    const pct = (Math.abs(elev[j] - elev[i]) / distM) * 100
    if (maxPct == null || pct > maxPct) maxPct = pct
    if (minPct == null || pct < minPct) minPct = pct
  }
  return maxPct == null ? null : { maxPct, minPct }
}

function movingAverage(arr, window) {
  const half = Math.floor(window / 2)
  const out = new Array(arr.length).fill(null)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
      if (arr[j] != null) { sum += arr[j]; n++ }
    }
    if (n > 0) out[i] = sum / n
  }
  return out
}

/**
 * Analyser stinettet i et sett features (fra stinettFeaturesFromSvgEl eller
 * mcp/headless.routableFeaturesFromSvg — koder utenfor STI/KOBLER ignoreres).
 *
 * @param {Array<{coordinates: Array<[number,number]>, isomCode: string}>} features
 * @param {{ dem?: object|null, arealKm2: number, minTurM?: number,
 *           maksKoblerM?: number, snapM?: number }} opts
 * @returns {{ stinett: object, lengsteVandringM: number, turer: Array<object> }}
 */
export function analyserStinett(features, opts = {}) {
  const { dem = null, arealKm2 = 0, minTurM = 500, maksKoblerM = 300, snapM = 6 } = opts

  const brukbare = (features ?? []).filter(
    (f) => STI_KODER.has(f.isomCode) || KOBLER_KODER.has(f.isomCode),
  )
  const rg = buildRoutingGraph(brukbare, { snapM, componentBridgeM: 0 })
  const g = rg.graph

  const stiKanter = []
  const koblerKanter = []
  g.forEachEdge((key, attr, u, v) => {
    const e = { key, u, v, length: attr.length, code: attr.isomCode }
    if (STI_KODER.has(attr.isomCode)) stiKanter.push(e)
    else koblerKanter.push(e)
  })

  // 1. Sti-komponenter (kun sti-kanter i DFS-en).
  const stiAdj = new Map()
  for (const e of stiKanter) {
    addAdj(stiAdj, e.u, { to: e.v, e })
    addAdj(stiAdj, e.v, { to: e.u, e })
  }
  const compOf = new Map()
  let compCount = 0
  for (const start of stiAdj.keys()) {
    if (compOf.has(start)) continue
    const cid = compCount++
    const stack = [start]
    compOf.set(start, cid)
    while (stack.length) {
      const u = stack.pop()
      for (const { to } of stiAdj.get(u) ?? []) {
        if (!compOf.has(to)) { compOf.set(to, cid); stack.push(to) }
      }
    }
  }

  // 2. Bindeledd-fletting: fra hver «port» (node med både sti- og koblerkant)
  //    søkes det avgrenset over KUN koblerkanter; porter i en annen komponent
  //    innen maksKoblerM gir flette-kandidater. Korteste par først + union-
  //    find = minste-utspennende flette-skog (samme mønster som
  //    bridgeComponents i routing.js). Koblerkantene langs en vellykket
  //    fletting blir med i vandringsgrafen — lange 503-omveier gjør ikke.
  const koblerAdj = new Map()
  for (const e of koblerKanter) {
    addAdj(koblerAdj, e.u, { to: e.v, e })
    addAdj(koblerAdj, e.v, { to: e.u, e })
  }
  const kandidater = []
  for (const port of koblerAdj.keys()) {
    const ca = compOf.get(port)
    if (ca == null) continue
    const { dist, prevNode, prevEdge } = dijkstraFrom(koblerAdj, port, { maxDist: maksKoblerM })
    for (const [node, d] of dist) {
      const cb = compOf.get(node)
      if (cb == null || cb === ca || node === port) continue
      const sti = tracePath(prevNode, port, node)
      if (!sti) continue
      const kanter = []
      for (const n of sti.slice(1)) kanter.push(prevEdge.get(n))
      kandidater.push({ a: ca, b: cb, d, kanter })
    }
  }
  kandidater.sort((x, y) => x.d - y.d)

  const parent = Array.from({ length: compCount }, (_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  const brukteKoblere = new Map()   // edgeKey → kant (unike brukbare bindeledd)
  for (const k of kandidater) {
    const ra = find(k.a), rb = find(k.b)
    if (ra === rb) continue
    parent[ra] = rb
    for (const e of k.kanter) brukteKoblere.set(e.key, e)
  }

  // 3. Lengderegnskap per flettet gruppe. Hver kant telles nøyaktig én gang
  //    (grafen er undirected og enkel). Tettheten regnes av ALT sti-nett før
  //    ekskludering — terskelen skal reflektere hvor mylder-aktig kartet er.
  const gruppeStiM = new Map()
  let altStiM = 0
  for (const e of stiKanter) {
    const rot = find(compOf.get(e.u))
    gruppeStiM.set(rot, (gruppeStiM.get(rot) ?? 0) + e.length)
    altStiM += e.length
  }
  const terskelM = minKomponentM(altStiM / 1000, arealKm2)

  const inkluderte = new Set()
  let totalStiM = 0
  let ekskludertM = 0
  let ekskluderte = 0
  for (const [rot, m] of gruppeStiM) {
    if (m >= terskelM) { inkluderte.add(rot); totalStiM += m }
    else { ekskluderte++; ekskludertM += m }
  }

  const koblerVedGruppe = new Map()
  let koblerM = 0
  for (const e of brukteKoblere.values()) {
    // Etter flettingen har begge endene samme rot — bruk den enden som
    // ligger i en sti-komponent (kanten kan gå via rene kobler-noder).
    const cu = compOf.get(e.u) ?? compOf.get(e.v)
    if (cu == null) continue
    const rot = find(cu)
    if (!inkluderte.has(rot)) continue
    addAdj(koblerVedGruppe, rot, e)
    koblerM += e.length
  }

  // 4. Vandringsgraf per inkludert gruppe: sti-kanter + brukte bindeledd.
  const posOf = (n) => g.getNodeAttribute(n, 'pos')
  let lengsteVandringM = 0
  const kandidatTurer = []

  for (const rot of inkluderte) {
    const adj = new Map()
    const kanter = []
    for (const e of stiKanter) {
      if (find(compOf.get(e.u)) !== rot) continue
      addAdj(adj, e.u, { to: e.v, e })
      addAdj(adj, e.v, { to: e.u, e })
      kanter.push(e)
    }
    for (const e of koblerVedGruppe.get(rot) ?? []) {
      addAdj(adj, e.u, { to: e.v, e })
      addAdj(adj, e.v, { to: e.u, e })
      kanter.push(e)
    }
    if (!adj.size) continue

    // Diameter: dobbel Dijkstra (lengste av de korteste veiene).
    const noder = [...adj.keys()]
    const d1 = dijkstraFrom(adj, noder[0])
    const a = fjernest(d1.dist)
    if (!a.node) continue
    const d2 = dijkstraFrom(adj, a.node)
    const b = fjernest(d2.dist)
    if (b.node && b.distM > lengsteVandringM) lengsteVandringM = b.distM
    if (b.node && b.distM >= minTurM) {
      const nodeSti = tracePath(d2.prevNode, a.node, b.node)
      if (nodeSti) {
        kandidatTurer.push({
          type: 'AtilB',
          lengdeM: b.distM,
          coordinates: nodeSti.map(posOf),
        })
      }
    }

    // Sløyfe: sykler finnes ⇔ E − V + 1 > 0 (gruppen er sammenhengende).
    // Kandidat-søk: fjern én kant om gangen (jevnt samplet, maks 40) og mål
    // korteste alternative vei mellom endene — sløyfen er veien + kanten.
    if (kanter.length - noder.length + 1 > 0) {
      let besteSloyfe = null
      const steg = Math.max(1, Math.ceil(kanter.length / MAKS_SLOYFE_KANTER))
      for (let i = 0; i < kanter.length; i += steg) {
        const e = kanter[i]
        const rundt = dijkstraFrom(adj, e.u, { excludeKey: e.key })
        const dv = rundt.dist.get(e.v)
        if (dv == null) continue
        const lengde = dv + e.length
        if (lengde < minTurM) continue
        if (!besteSloyfe || lengde > besteSloyfe.lengdeM) {
          const nodeSti = tracePath(rundt.prevNode, e.u, e.v)
          if (nodeSti) besteSloyfe = { lengdeM: lengde, nodeSti }
        }
      }
      if (besteSloyfe) {
        const coords = besteSloyfe.nodeSti.map(posOf)
        coords.push(coords[0])
        kandidatTurer.push({ type: 'rundtur', lengdeM: besteSloyfe.lengdeM, coordinates: coords })
      }
    }
  }

  // 5. Sortér, avgrens, og legg på stigning + hand-off-punkter.
  kandidatTurer.sort((x, y) => y.lengdeM - x.lengdeM)
  const turer = kandidatTurer.slice(0, MAKS_TURER).map((t) => {
    const c = t.coordinates
    const tur = {
      type: t.type,
      lengdeM: t.lengdeM,
      coordinates: c,
      startXY: c[0],
      sluttXY: c[c.length - 1],
      viaXY: pointAtDistance(c, t.lengdeM / 2),
    }
    if (dem) {
      const profil = sampleProfile({ points: c.map(([x, y]) => ({ x, y })) }, dem)
      if (profil) {
        tur.stigningM = Math.round(profil.totalAscent)
        tur.fallM = Math.round(profil.totalDescent)
        const seg = segmentHelninger(profil.samples)
        if (seg) {
          tur.brattesteSegmentPst = Math.round(seg.maxPct)
          tur.slakesteSegmentPst = Math.round(seg.minPct)
        }
      }
    }
    return tur
  })

  return {
    stinett: {
      totalStiM,
      koblerM,
      inkluderteKomponenter: inkluderte.size,
      ekskluderteKomponenter: ekskluderte,
      ekskludertM,
      minKomponentM: terskelM,
      tetthetKmPerKm2: arealKm2 > 0 ? altStiM / 1000 / arealKm2 : null,
      arealKm2: arealKm2 > 0 ? arealKm2 : null,
    },
    lengsteVandringM,
    minTurM,
    turer,
  }
}

// Gangtid etter Naismith — samme konstanter som useStifinner.estWalkMinutes
// og mcp/server.js.
function estGangtidMin(lengdeM, stigning = 0, fall = 0) {
  return Math.max(1, Math.round(lengdeM / (4000 / 60) + stigning / 10 + fall / 30))
}

const kmTekst = (m) => (m / 1000).toFixed(1).replace('.', ',')

/**
 * Formater analysen til det kompakte norske JSON-svaret som går tilbake til
 * modellen — identisk på chat-, MCP- og worker-flatene. `toWgs84(x, y)` må
 * returnere {lat, lon}.
 */
export function formatStinettSvar(analyse, { toWgs84 }) {
  const ll = ([x, y]) => {
    const p = toWgs84(x, y)
    return { lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5) }
  }

  let tNr = 0, rNr = 0
  const turer = analyse.turer.map((t) => {
    const erRundtur = t.type === 'rundtur'
    const id = erRundtur ? `R${++rNr}` : `T${++tNr}`
    const o = {
      id,
      type: t.type,
      navn: erRundtur
        ? `Rundtur ${kmTekst(t.lengdeM)} km`
        : `${tNr === 1 ? 'Lengste stitur' : 'Stitur'} ${kmTekst(t.lengdeM)} km`,
      lengdeKm: +(t.lengdeM / 1000).toFixed(1),
      estimertGangtidMin: estGangtidMin(t.lengdeM, t.stigningM ?? 0, t.fallM ?? 0),
    }
    if (t.stigningM != null) {
      o.stigningM = t.stigningM
      o.fallM = t.fallM
    }
    if (t.brattesteSegmentPst != null) {
      o.brattesteSegmentPst = t.brattesteSegmentPst
      o.slakesteSegmentPst = t.slakesteSegmentPst
    }
    if (erRundtur) {
      o.origo = ll(t.startXY)
      o.via = ll(t.viaXY)
    } else {
      o.start = ll(t.startXY)
      o.slutt = ll(t.sluttXY)
      o.via = ll(t.viaXY)
    }
    return o
  })

  const s = analyse.stinett
  // Over 30 km er én desimal falsk presisjon (OSM-dekning varierer) — rund
  // NED til nærmeste tier og lever en ferdig frase («mer enn 370 km»).
  const totalKm = s.totalStiM / 1000
  const rundetNed = totalKm > 30 ? Math.floor(totalKm / 10) * 10 : null

  const svar = {
    minTurKm: analyse.minTurM != null ? +(analyse.minTurM / 1000).toFixed(1) : undefined,
    totalStiTekst: rundetNed != null ? `mer enn ${rundetNed} km` : undefined,
    stinett: {
      totalStiKm: rundetNed ?? +totalKm.toFixed(1),
      arealKm2: s.arealKm2 != null ? +s.arealKm2.toFixed(1) : null,
      koblerKm: +(s.koblerM / 1000).toFixed(1),
      inkluderteKomponenter: s.inkluderteKomponenter,
      ekskluderteKomponenter: s.ekskluderteKomponenter,
      ekskludertKm: +(s.ekskludertM / 1000).toFixed(1),
      minKomponentKm: +(s.minKomponentM / 1000).toFixed(1),
      tetthetKmPerKm2: s.tetthetKmPerKm2 == null ? null : +s.tetthetKmPerKm2.toFixed(1),
    },
    lengsteVandringKm: +(analyse.lengsteVandringM / 1000).toFixed(1),
    treff: turer.length,
    turer,
  }

  const medStigning = turer.filter((t) => t.stigningM != null)
  if (medStigning.length) {
    const mest = medStigning.reduce((a, b) => (b.stigningM > a.stigningM ? b : a))
    const minst = medStigning.reduce((a, b) => (b.stigningM < a.stigningM ? b : a))
    svar.hoydepunkter = { mestStigning: mest.id, minstStigning: minst.id }
    const medSeg = medStigning.filter((t) => t.brattesteSegmentPst != null)
    if (medSeg.length) {
      const bratt = medSeg.reduce((a, b) => (b.brattesteSegmentPst > a.brattesteSegmentPst ? b : a))
      const slak = medSeg.reduce((a, b) => (b.brattesteSegmentPst < a.brattesteSegmentPst ? b : a))
      svar.hoydepunkter.brattesteSegment = { tur: bratt.id, prosent: bratt.brattesteSegmentPst }
      svar.hoydepunkter.slakesteSegment = { tur: slak.id, prosent: slak.brattesteSegmentPst }
    }
  }

  const merknader = [
    'Sti = ISOM 505/506/507 + skogsbilvei 504; småveg-bindeledd (503) teller i turlengder men ikke i sti-summen.',
    'ekskludertKm er ekte, men korte og frakoblede stistumper — nevn dem når totalinntrykket av området er poenget.',
    '«Slakeste segment» = turen med det slakeste bratteste-partiet.',
    'Turene kan tegnes inn: start/slutt/via → foreslaa_tur (MCP: planlegg_rute), origo/via → foreslaa_rundtur (MCP: planlegg_rundtur).',
  ]
  if (rundetNed != null) {
    merknader.push('Bruk totalStiTekst i svaret («mer enn … km turstier») og nevn kartets areal — desimaler over 30 km er falsk presisjon.')
  }
  if (!medStigning.length && turer.length) {
    merknader.push('Kartet mangler ekte høydedata — stigning og bratthet kan ikke oppgis.')
  }
  if (!turer.length) {
    merknader.push('Ingen sammenhengende sti-strekninger nådde minstekravet — si det ærlig i stedet for å foreslå en tur.')
  }
  svar.merknad = merknader.join(' ')
  return svar
}
