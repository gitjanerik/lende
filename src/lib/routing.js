// Routing-graph fra OSM/N50-features. Bygger en undirected graf der
// noder er koordinater snappet på 2m toleranse, og kanter er sti-/vei-
// segmenter med vekt = lengde × ISOM-kostnadsfaktor.
//
// Brukes til løypeplanlegging (Dijkstra fra graphology-shortest-path).
//
// API:
//   buildRoutingGraph(features, options) → { graph, nodeAt, projectToSvg }
//   findRoute(graph, fromPos, toPos) → { coordinates, lengthM, costM }

import Graph from 'graphology'
import { dijkstra } from 'graphology-shortest-path'
import RBush from 'rbush'
import { polylineLength } from './pathUtils.js'

// Kostnadsfaktor pr ISOM-kode. Større = mindre attraktiv som rute.
//
// PRIORITERING (v11.0.27): «kortest mulig» skal telle høyere enn «sti over
// vei». Vi beholder rekkefølgen fra mest til minst foretrukket —
//   Sti (505/506/507) → Skogsbilvei (504) → Småveg (503) → Veg (502/501)
// — men STRAMMER båndet kraftig. Tidligere (v11.0.13) lå natur-korridoren
// på ≤1.6 og kjørevei på 2.6–4.0; det HOPPET gjorde at en kort, direkte
// rute som måtte ta en liten vei-/skogsbilvei-stump tapte mot en mye lengre
// ren-sti-omvei (kostnaden av vei-stumpen oversteg en hel æresrunde på sti).
// Det var nettopp dette som skjedde ved Verkensvannet: ingen rute tok
// skogsbilvei-stumpen, alle svingte østover. Nå er forskjellen mellom
// klassene en mild tie-breaker (maks ~1.7× fra sti til motorvei), så
// avstand dominerer: en litt lengre sti slår fortsatt en kortere kjørevei,
// men en stor omvei på sti taper mot en kort, direkte rute med litt vei.
// Eksportert fordi 3D-utforskerens sti-vandring (tour3d/pathWalk.js) bryter
// uavgjort i kryss på samme rangering: en tydelig sti slår et stitråkk.
export const ISOM_COST = {
  '505': 1.0,                              // sti — godt løp (mest foretrukket)
  '506': 1.05,                             // sti — uklar
  '507': 1.12,                             // stitråkk — vanskelig, men fortsatt sti
  '504': 1.15,                             // skogsbilvei
  '509': 1.0,                              // bro — nøytral (nødvendig kryssing)
  '503': 1.3,                              // småveg (tertiary/residential/service)
  '502': 1.5,                              // hovedvei
  '501': 1.7,                              // motorvei — minst foretrukket å gå
}

// Snap-avstand fra et valgt punkt til nærmeste graf-node, i to trinn:
// innen MAX_SNAP_M er treffet stille, mellom MAX_SNAP_M og FAR_SNAP_M godtas
// det med merknad (et mål plukket fra kartets navn er ofte en flate-sentroide
// — «Stordammen» lander midt på vannet), utenfor FAR_SNAP_M er det ærlig feil.
// Delt av Stifinneren og chattens forhåndsberegning, som MÅ bruke samme
// terskler for at tallene i chatten skal stemme med ruten kartet tegner.
// Graf-opsjonene ruteren faktisk kjører med — Stifinner, MCP-serveren,
// chatten, 3D-utforskeren og Cloudflare-speilet deler dem. ÉN kilde til
// sannhet: stinett-diagnosen (stinettBrudd.js) må bygge samme graf som
// ruteren, ellers rapporterer den hull som ikke finnes (eller motsatt).
export const RUTE_GRAF_OPTS = Object.freeze({
  snapM: 6, gapBridgeM: 30, componentBridgeM: 80,
  gapMaxSlopePct: 60, gapSlopeMinM: 8,
})

export const MAX_SNAP_M = 150
export const FAR_SNAP_M = 400

// Routbare ISOM-koder = nøklene i ISOM_COST. Eksportert som ÉN kilde til
// sannhet: useStifinner og mcp/headless har historisk hver sin kopi, og en
// kode som legges til her men glemmes der gir stille frakoblet stinett.
export const ROUTABLE_CODES = new Set(Object.keys(ISOM_COST))

// Sentinel-lengde for `lengthNoMw`-vekten: motorvei-kanter får denne i stedet
// for ekte lengde, så en ren-lengde-Dijkstra unngår dem (større enn noen ekte
// kartavstand). Brukes til «kortest mulig»-ruta, som ikke skal gå på motorvei.
const MOTORWAY_BLOCK = 1e9

// Kostnadsfaktor for en komponent-bro (se bridgeComponents). Litt over småveg
// (1.3) så ruteren foretrekker ekte sti/vei når den finnes, men broen brukes
// villig når den er eneste forbindelse til et fragment.
const BRIDGE_COST = 1.4

// Hull-broing (bridgeGaps): et hull broes bare når omveien i dagens graf er
// minst GAP_DETOUR_FACTOR × hullet OG minst GAP_DETOUR_MIN_M. Tallene skiller
// «nettet er brutt her» fra «stien svinger». En U-formet sti med 20 m mellom
// endene og 300 m rundt bunnen skal IKKE få en snarvei; en sti som ender 13 m
// fra hovedstien med 5,5 km rundt skal kobles.
const GAP_DETOUR_FACTOR = 25
const GAP_DETOUR_MIN_M = 500

// Sample-avstand langs et hull når hellingen måles (meter). Tettere enn DEM-ens
// egen oppløsning er greit — bilinear interpolasjon gjør profilen glatt.
const GAP_SLOPE_STEP_M = 2

/**
 * Bratteste stigning/fall over et hull, i prosent (høydeforskjell delt på
 * vannrett avstand × 100). Sampler terrenget langs strekket a→b.
 *
 * Målt fra BEGGE ender mot hvert sample, ikke bare ende til ende: et hull som
 * starter og slutter i samme høyde kan krysse en kløft, og den skal telle. Men
 * bare samples minst `minStegM` fra enden vi måler fra — to nabo-samples på en
 * 10 m DEM er ren interpolasjonsstøy — og hele hullet teller alltid, uansett
 * hvor kort det er.
 *
 * Returnerer null når terrengdata mangler (ingen sampler, eller noData i
 * strekket). Da skal kallstedet oppføre seg som om regelen ikke finnes —
 * kart uten DEM (WCS blokkert av CORS) skal rute som før.
 *
 * @param {(x:number,y:number)=>number} elevationAt  høyde i meter, NaN = ingen data
 * @param {[number,number]} a
 * @param {[number,number]} b
 * @param {{ minStegM?: number }} [opts]
 * @returns {number|null} prosent
 */
export function gapSlopePct(elevationAt, a, b, opts = {}) {
  const { minStegM = 10 } = opts
  if (typeof elevationAt !== 'function') return null
  const L = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (!(L > 0)) return null

  const n = Math.max(1, Math.ceil(L / GAP_SLOPE_STEP_M))
  const samples = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const h = elevationAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    if (!Number.isFinite(h)) return null
    samples.push({ d: t * L, h })
  }

  let verste = 0
  let maalt = false
  for (const ende of [samples[0], samples[samples.length - 1]]) {
    for (const s of samples) {
      const d = Math.abs(s.d - ende.d)
      if (d === 0) continue
      // Hele hullet teller alltid; mellom-samples bare når de er langt nok unna.
      if (d < minStegM && Math.abs(d - L) > 1e-9) continue
      maalt = true
      verste = Math.max(verste, (Math.abs(s.h - ende.h) / d) * 100)
    }
  }
  return maalt ? verste : null
}

/**
 * Projiser punkt p ned på linjestykket a→b. Returnerer fotpunktet (klemt til
 * segmentet), parameteren t∈[0,1] og avstanden. Ren geometri-hjelper for
 * T-kryss-broing i grafen.
 */
export function projectPointOnSegment(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1]
  const len2 = vx * vx + vy * vy
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const px = a[0] + t * vx, py = a[1] + t * vy
  return { point: [px, py], t, dist: Math.hypot(p[0] - px, p[1] - py) }
}

// Bruker en rute en gitt ISOM-kode på noen av kantene sine?
function pathUsesCode(g, nodeIds, code) {
  for (let i = 0; i + 1 < nodeIds.length; i++) {
    const e = g.edge(nodeIds[i], nodeIds[i + 1])
    if (e != null && g.getEdgeAttribute(e, 'isomCode') === code) return true
  }
  return false
}

/**
 * @typedef {Object} RoutingGraph
 * @property {Graph} graph
 * @property {(pos: [number,number], toleranceM?: number) => string|null} nodeAt
 * @property {(from: string, to: string) => RouteResult} route
 */

/**
 * Bygg routing-graph fra et sett ISOM-klassifiserte features.
 * Features må ha `geometry: [{lat,lon},...]` (OSM-aktig) eller
 * `coordinates: [[x,y],...]` i UTM, og `isomCode`.
 *
 * @param {Array} features
 * @param {{ snapM?: number, projectFn?: Function, bridgeM?: number,
 *          gapBridgeM?: number, componentBridgeM?: number,
 *          gapMaxSlopePct?: number, gapSlopeMinM?: number,
 *          elevationAt?: (x:number,y:number)=>number }} opts
 * @returns {RoutingGraph}
 */
export function buildRoutingGraph(features, opts = {}) {
  const { snapM = 2, projectFn } = opts
  const g = new Graph({ multi: false, type: 'undirected' })
  const nodeIndex = new RBush()

  function getOrCreateNode(pos) {
    const hits = nodeIndex.search({
      minX: pos[0] - snapM, minY: pos[1] - snapM,
      maxX: pos[0] + snapM, maxY: pos[1] + snapM,
    })
    if (hits[0]) return hits[0].id
    const id = `n${g.order}`
    g.addNode(id, { pos })
    nodeIndex.insert({
      id, pos,
      minX: pos[0], minY: pos[1], maxX: pos[0], maxY: pos[1],
    })
    return id
  }

  // Legg til en kant u→v med vekter avledet av ISOM-koden. lengthNoMw =
  // ekte lengde, unntatt motorvei som blokkeres (MOTORWAY_BLOCK) så
  // «kortest mulig» aldri går der.
  function linkNodes(u, v, code) {
    if (u === v || g.hasEdge(u, v)) return false
    const pu = g.getNodeAttribute(u, 'pos'), pv = g.getNodeAttribute(v, 'pos')
    const length = Math.hypot(pu[0] - pv[0], pu[1] - pv[1])
    if (length === 0) return false
    const cost = ISOM_COST[code] ?? 1
    g.addEdge(u, v, {
      length, cost: length * cost, isomCode: code,
      lengthNoMw: code === '501' ? MOTORWAY_BLOCK : length,
    })
    return true
  }

  for (const f of features) {
    const code = f.isomCode ?? f.tags?.isomCode
    if (!code) continue
    if (ISOM_COST[code] == null) continue   // ikke routbar
    let coords = f.coordinates
    if (!coords && f.geometry && projectFn) {
      coords = f.geometry.map(p => projectFn(p.lat, p.lon))
    }
    if (!coords || coords.length < 2) continue
    let prev = getOrCreateNode(coords[0])
    for (let i = 1; i < coords.length; i++) {
      const here = getOrCreateNode(coords[i])
      linkNodes(prev, here, code)
      prev = here
    }
  }

  // T-kryss / dangler: et sti-/vei-segment som ender NÆR (men ikke på en node
  // av) et annet segment ble tidligere stående frakoblet, fordi grafen bare
  // slår sammen SAMMENFALLENDE endepunkter (innen snapM). DP-forenkling og
  // Chaikin-glatting i mapBuilder kan flytte selve krysspunktet noen meter, og
  // et T-kryss der en sti ender midt på en annen sti har uansett ingen node å
  // snappe til. Resultat: «snarveier» (f.eks. skogsbilvei-stumpen ved
  // Verkensvannet) havner i sin egen frakoblede komponent og kan aldri rutes
  // gjennom. Vi broer derfor hver dangle (node med grad 1) til nærmeste segment
  // innen bridgeM ved å splitte det segmentet og koble på. Kun dangler broes —
  // gjennomgående stier (begge ender koblet) røres ikke, så vi lager ikke
  // falske kryss der en sti faktisk går i bro/kulvert over en annen.
  const bridgeM = opts.bridgeM ?? snapM * 2
  if (bridgeM > 0) bridgeDangles(bridgeM)

  // Komponent-broing: etter dangle-broingen kan kartet fortsatt ha mange små,
  // frakoblede fragmenter (rendering/DP-drift, adkomst-stumper, T-kryss lengre
  // unna enn bridgeM). Et start-/målpunkt som snapper til et slikt fragment gir
  // «fant ingen rute» selv om hovednettet ligger noen titalls meter unna
  // (Bondivann-tilfellet: en 4-node-stump 65 m fra marka-nettet, ett av 272
  // fragmenter på et 5 km-kart). Vi kobler adskilte komponenter langs deres
  // korteste innbyrdes gap — men KUN opp til `componentBridgeM` og KUN mellom
  // ULIKE komponenter (Kruskal/MST-skog): en allerede sammenhengende komponent
  // får aldri en intern snarvei, og vann har ingen rutbare noder så vi bygger
  // sjelden falske vann-kryssinger. Default av (0) — reine lib-tester og gamle
  // kall er byte-identiske; Stifinner og MCP-serveren slår den på.
  const componentBridgeM = opts.componentBridgeM ?? 0
  if (componentBridgeM > 0) bridgeComponents(componentBridgeM)

  // Hull-broing — SIST, så den måler omveien i den grafen ruteren faktisk får.
  // Dangle-broen over dekker bare de minste hullene (bridgeM = 12 m), og
  // komponent-broen rører kun ADSKILTE komponenter. Imellom ligger det verste
  // tilfellet: en sti som ender noen titalls meter fra en hovedsti, men som
  // teknisk sett henger sammen med den — flere kilometer rundt. Grafen er da
  // «sammenhengende», så komponent-broen holder fingrene fra fatet, mens
  // brukeren står ved et 13 m hull og får en 8 km omvei. Narverudgruvene
  // (Strykenåsen): stien sørover fra gruvene ender 12,9 m fra hovedstien, og
  // Stifinneren svarte med ruter på 14–18 km for en luftlinje på 676 m.
  //
  // Vi broer derfor et dangle-hull ≤ gapBridgeM NÅR omveien i dagens graf er
  // så stor at nettet i praksis er brutt (se GAP_DETOUR_*). Gaten er poenget:
  // uten den ville en U-formet sti fått en snarvei over åpningen.
  //
  // OG når terrenget over hullet er slakt nok å krysse: `elevationAt` +
  // gapMaxSlopePct gjør stup til et ekte hinder i stedet for noe ruteren
  // dikter seg forbi. Uten DEM (WCS blokkert av CORS) faller regelen bort og
  // vi ruter som før. Default av (0) — Stifinner, MCP og chatten slår den på.
  const gapBridgeM = opts.gapBridgeM ?? 0
  const gapMaxSlopePct = opts.gapMaxSlopePct ?? 0
  const gapSlopeMinM = opts.gapSlopeMinM ?? 8
  const elevationAt = opts.elevationAt
  if (gapBridgeM > 0) bridgeGaps(gapBridgeM)

  // Merk hver node med sin sammenhengende komponent (DFS).
  function labelComponents() {
    const compOf = new Map()
    let cid = 0
    g.forEachNode((n) => {
      if (compOf.has(n)) return
      const id = cid++
      const stack = [n]
      compOf.set(n, id)
      while (stack.length) {
        const u = stack.pop()
        g.forEachNeighbor(u, (v) => { if (!compOf.has(v)) { compOf.set(v, id); stack.push(v) } })
      }
    })
    return { compOf, count: cid }
  }

  function bridgeComponents(tol) {
    const { compOf, count } = labelComponents()
    if (count < 2) return

    // Kandidat-broer: for hver node, nærmeste node(r) i en ANNEN komponent
    // innen tol. rbush-vindu holder dette billig selv på tette kart.
    const cands = []
    g.forEachNode((n, attr) => {
      const p = attr.pos
      const hits = nodeIndex.search({
        minX: p[0] - tol, minY: p[1] - tol, maxX: p[0] + tol, maxY: p[1] + tol,
      })
      const myComp = compOf.get(n)
      for (const h of hits) {
        if (h.id === n || compOf.get(h.id) === myComp) continue
        const d = Math.hypot(h.pos[0] - p[0], h.pos[1] - p[1])
        if (d <= tol) cands.push({ a: n, b: h.id, d })
      }
    })
    cands.sort((x, y) => x.d - y.d)

    // Union-find over komponent-id'er: legg en bro kun når den forener to ennå
    // adskilte komponenter (korteste par først → minste-utspennende bro-skog).
    const parent = new Array(count)
    for (let i = 0; i < count; i++) parent[i] = i
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
    for (const c of cands) {
      const ra = find(compOf.get(c.a)), rb = find(compOf.get(c.b))
      if (ra === rb) continue
      if (addBridgeEdge(c.a, c.b, c.d)) parent[ra] = rb
    }
  }

  function addBridgeEdge(u, v, length) {
    if (u === v || length === 0 || g.hasEdge(u, v)) return false
    g.addEdge(u, v, { length, cost: length * BRIDGE_COST, isomCode: 'bridge', lengthNoMw: length })
    return true
  }

  function bridgeDangles(tol) {
    const segs = []
    g.forEachEdge((edge, attr, s, t) => {
      const ap = g.getNodeAttribute(s, 'pos'), bp = g.getNodeAttribute(t, 'pos')
      segs.push({
        s, t, ap, bp, code: attr.isomCode,
        minX: Math.min(ap[0], bp[0]), minY: Math.min(ap[1], bp[1]),
        maxX: Math.max(ap[0], bp[0]), maxY: Math.max(ap[1], bp[1]),
      })
    })
    const segIndex = new RBush()
    segIndex.load(segs)

    const dangles = []
    g.forEachNode((id, attr) => { if (g.degree(id) === 1) dangles.push({ id, pos: attr.pos }) })

    for (const d of dangles) {
      if (!g.hasNode(d.id) || g.degree(d.id) !== 1) continue
      const hits = segIndex.search({
        minX: d.pos[0] - tol, minY: d.pos[1] - tol,
        maxX: d.pos[0] + tol, maxY: d.pos[1] + tol,
      })
      let best = null, bestD = tol
      for (const seg of hits) {
        if (seg.s === d.id || seg.t === d.id) continue   // egen kant
        if (!g.hasEdge(seg.s, seg.t)) continue           // allerede splittet
        const proj = projectPointOnSegment(d.pos, seg.ap, seg.bp)
        if (proj.dist < bestD) { bestD = proj.dist; best = { seg, proj } }
      }
      if (best) bridgeToSegment(d, best.seg, best.proj)
    }
  }

  function bridgeToSegment(d, seg, proj) {
    const eps = Math.max(snapM, 0.5)
    const segLen = Math.hypot(seg.bp[0] - seg.ap[0], seg.bp[1] - seg.ap[1])
    const distFromA = proj.t * segLen
    // Nær et eksisterende endepunkt → koble dit, ikke splitt.
    if (distFromA <= eps) { linkNodes(d.id, seg.s, seg.code); return }
    if (segLen - distFromA <= eps) { linkNodes(d.id, seg.t, seg.code); return }

    // Splitt segmentet i fotpunktet og koble dangle på.
    const splitNode = getOrCreateNode(proj.point)
    if (splitNode !== seg.s && splitNode !== seg.t && g.hasEdge(seg.s, seg.t)) {
      g.dropEdge(seg.s, seg.t)
      linkNodes(seg.s, splitNode, seg.code)
      linkNodes(splitNode, seg.t, seg.code)
    }
    if (splitNode !== d.id) linkNodes(d.id, splitNode, seg.code)
  }

  // Bygg et ferskt rbush over grafens kanter. bridgeDangles splitter segmenter
  // underveis, så hull-broen MÅ indeksere på nytt — ellers ser den bare de
  // foreldede kantene og hopper over dem («allerede splittet»).
  function segmentIndex() {
    const segs = []
    g.forEachEdge((edge, attr, s, t) => {
      const ap = g.getNodeAttribute(s, 'pos'), bp = g.getNodeAttribute(t, 'pos')
      segs.push({
        s, t, ap, bp, code: attr.isomCode,
        minX: Math.min(ap[0], bp[0]), minY: Math.min(ap[1], bp[1]),
        maxX: Math.max(ap[0], bp[0]), maxY: Math.max(ap[1], bp[1]),
      })
    })
    const index = new RBush()
    index.load(segs)
    return index
  }

  // Korteste vei fra `from` til nærmeste node i `targets`, i meter — men vi gir
  // opp så snart alt innen `limit` er utforsket og returnerer Infinity. Dijkstra
  // med binærheap; søket er lokalt (limit er noen hundre meter), så det koster
  // lite selv om vi kaller det én gang per dangle.
  function distanceWithin(from, targets, limit) {
    if (targets.has(from)) return 0
    const dist = new Map([[from, 0]])
    const heap = [[0, from]]
    const push = (d, n) => {
      heap.push([d, n])
      let i = heap.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p][0] <= heap[i][0]) break
        const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p
      }
    }
    const pop = () => {
      const top = heap[0]
      const last = heap.pop()
      if (heap.length) {
        heap[0] = last
        let i = 0
        for (;;) {
          const l = 2 * i + 1, r = l + 1
          let m = i
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === i) break
          const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m
        }
      }
      return top
    }
    while (heap.length) {
      const [d, u] = pop()
      if (d > limit) return Infinity
      if (d > (dist.get(u) ?? Infinity)) continue
      if (targets.has(u)) return d
      g.forEachNeighbor(u, (v) => {
        const nd = d + g.getEdgeAttribute(u, v, 'length')
        if (nd > limit) return
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); push(nd, v) }
      })
    }
    return Infinity
  }

  // Hull-broing: koble en dangle til nærmeste segment innen `tol`, men BARE når
  // omveien i dagens graf er stor nok til at nettet i praksis er brutt der.
  // Danglene tas i stigende hull-rekkefølge, og grafen muteres underveis, så
  // det tetteste hullet vinner og et allerede reparert brudd ikke får en bro
  // til (den andre dangle-en ser da en kort omvei og faller på gaten).
  function bridgeGaps(tol) {
    const segIndex = segmentIndex()
    const dangles = []
    g.forEachNode((id, attr) => { if (g.degree(id) === 1) dangles.push({ id, pos: attr.pos }) })

    // Nærmeste kant til `pos` innen tol, lest fra den LEVENDE indeksen (den
    // holdes i synk når vi splitter, så vi ser aldri en kant som er borte).
    const nearestSegment = (pos, ownId) => {
      const hits = segIndex.search({
        minX: pos[0] - tol, minY: pos[1] - tol, maxX: pos[0] + tol, maxY: pos[1] + tol,
      })
      let best = null, bestD = tol
      for (const seg of hits) {
        if (seg.s === ownId || seg.t === ownId) continue
        const proj = projectPointOnSegment(pos, seg.ap, seg.bp)
        if (proj.dist < bestD) { bestD = proj.dist; best = { seg, proj, gap: bestD } }
      }
      return best
    }

    // Sorter på hullets størrelse så det tetteste bruddet repareres først; da
    // ser en nabo-dangle over samme brudd en kort omvei og faller på gaten i
    // stedet for å legge nok en bro.
    const kandidater = []
    for (const d of dangles) {
      const best = nearestSegment(d.pos, d.id)
      if (best) kandidater.push({ d, gap: best.gap })
    }
    kandidater.sort((a, b) => a.gap - b.gap)

    for (const k of kandidater) {
      if (!g.hasNode(k.d.id) || g.degree(k.d.id) !== 1) continue
      const best = nearestSegment(k.d.pos, k.d.id)
      if (!best) continue
      const limit = Math.max(best.gap * GAP_DETOUR_FACTOR, GAP_DETOUR_MIN_M)
      const omvei = distanceWithin(k.d.id, new Set([best.seg.s, best.seg.t]), limit)
      if (omvei <= limit) continue                 // stien svinger bare — ingen snarvei
      if (forBratt(k.d.pos, best.proj.point, best.gap)) continue
      bridgeGapToSegment(k.d, best.seg, best.proj, segIndex)
    }
  }

  // Er terrenget over hullet for bratt å krysse? Regelen gjelder bare hull som
  // er store nok til at kryssingen er en ekte beslutning: under gapSlopeMinM er
  // hullet forenklings-støy, ikke en traversering, og en sti som ender to meter
  // fra en annen i en 60 %-li skal fortsatt kobles. Mangler DEM (eller har
  // noData i strekket) er svaret nei — vi ruter som før.
  function forBratt(a, b, gap) {
    if (!(gapMaxSlopePct > 0) || typeof elevationAt !== 'function') return false
    if (gap < gapSlopeMinM) return false
    const pct = gapSlopePct(elevationAt, a, b)
    return pct !== null && pct > gapMaxSlopePct
  }

  // Som bridgeToSegment, men selve forbindelsen legges som 'bridge': den er en
  // antatt kobling over et hull i kartdataene, ikke kartlagt sti. Da prises den
  // som en komponent-bro, og stinett-analysen teller den ikke som sti.
  // Splitter vi et segment, oppdateres `segIndex` med de to halvdelene.
  function bridgeGapToSegment(d, seg, proj, segIndex) {
    const eps = Math.max(snapM, 0.5)
    const segLen = Math.hypot(seg.bp[0] - seg.ap[0], seg.bp[1] - seg.ap[1])
    const distFromA = proj.t * segLen
    // Broens lengde er den EKTE avstanden til noden vi lander på — og gulvet på
    // 0.1 m fordi grafen ikke tar nullengde-kanter; et hull på 0 m er likevel
    // et hull som skal kobles.
    const koble = (til) => {
      const p = g.getNodeAttribute(til, 'pos')
      addBridgeEdge(d.id, til, Math.max(Math.hypot(p[0] - d.pos[0], p[1] - d.pos[1]), 0.1))
    }
    // Nær et eksisterende endepunkt → koble dit, ikke splitt.
    if (distFromA <= eps) { koble(seg.s); return }
    if (segLen - distFromA <= eps) { koble(seg.t); return }

    // Splitt når fotpunktet gir en NY node, eller når det snapper til selve
    // dangle-en (ligger den under snapM fra stien, ER den krysset — å tre den
    // inn i kanten er nettopp reparasjonen, og bøyen den lager er hullet). Men
    // faller getOrCreateNode tilbake på en TREDJE node inntil 6 m utenfor
    // linja, ville s→X→t bøyd en gjennomgående sti rundt den og gjort hver rute
    // over den litt lengre — da kobler vi heller dangle rett på X.
    const before = g.order
    const splitNode = getOrCreateNode(proj.point)
    const kanSplitte = g.order > before || splitNode === d.id
    if (kanSplitte && splitNode !== seg.s && splitNode !== seg.t && g.hasEdge(seg.s, seg.t)) {
      g.dropEdge(seg.s, seg.t)
      linkNodes(seg.s, splitNode, seg.code)
      linkNodes(splitNode, seg.t, seg.code)
      segIndex.remove(seg)
      const mid = g.getNodeAttribute(splitNode, 'pos')
      for (const [a, b] of [[seg.s, splitNode], [splitNode, seg.t]]) {
        const ap = a === seg.s ? seg.ap : mid, bp = b === seg.t ? seg.bp : mid
        segIndex.insert({
          s: a, t: b, ap, bp, code: seg.code,
          minX: Math.min(ap[0], bp[0]), minY: Math.min(ap[1], bp[1]),
          maxX: Math.max(ap[0], bp[0]), maxY: Math.max(ap[1], bp[1]),
        })
      }
    }
    if (splitNode !== d.id) koble(splitNode)
  }

  function nodeAt(pos, tol = snapM) {
    const hits = nodeIndex.search({
      minX: pos[0] - tol, minY: pos[1] - tol,
      maxX: pos[0] + tol, maxY: pos[1] + tol,
    })
    return hits[0]?.id ?? null
  }

  // Nærmeste node UANSETT avstand. Brukervalgte start/mål-punkter ligger
  // sjelden på en sti-node, så vi snapper dem til grafen. rbush-søk med
  // voksende vindu; faller tilbake til lineær scan hvis grafen er glissen.
  function nearestNode(pos) {
    if (g.order === 0) return null
    let best = null, bestD = Infinity
    let r = Math.max(snapM, 8)
    for (let tries = 0; tries < 12 && !best; tries++) {
      const hits = nodeIndex.search({
        minX: pos[0] - r, minY: pos[1] - r,
        maxX: pos[0] + r, maxY: pos[1] + r,
      })
      for (const h of hits) {
        const dx = h.pos[0] - pos[0], dy = h.pos[1] - pos[1]
        const d = dx * dx + dy * dy
        if (d < bestD) { bestD = d; best = h }
      }
      r *= 2
    }
    if (!best) {
      g.forEachNode((id, attr) => {
        const dx = attr.pos[0] - pos[0], dy = attr.pos[1] - pos[1]
        const d = dx * dx + dy * dy
        if (d < bestD) { bestD = d; best = { id, pos: attr.pos } }
      })
    }
    return best ? { id: best.id, pos: best.pos, distM: Math.sqrt(bestD) } : null
  }

  function route(fromId, toId, weight = 'cost') {
    if (!fromId || !toId || !g.hasNode(fromId) || !g.hasNode(toId)) return null
    const path = dijkstra.bidirectional(g, fromId, toId, weight)
    if (!path) return null
    const coords = path.map(id => g.getNodeAttribute(id, 'pos'))
    const lengthM = polylineLength(coords)
    let costM = 0
    for (let i = 0; i + 1 < path.length; i++) {
      costM += g.getEdgeAttribute(path[i], path[i + 1], 'cost')
    }
    return { coordinates: coords, lengthM, costM, nodeIds: path }
  }

  return {
    graph: g, nodeAt, nearestNode, route, distanceWithin,
    edges: g.size, nodes: g.order,
  }
}

// Sett med kant-id'er en rute bruker (undirected — graphology gir samme
// edge-id uansett retning).
function routeEdgeSet(graph, nodeIds) {
  const set = new Set()
  for (let i = 0; i + 1 < nodeIds.length; i++) {
    const e = graph.edge(nodeIds[i], nodeIds[i + 1])
    if (e != null) set.add(e)
  }
  return set
}

function shareOf(aSet, bSet) {
  if (!aSet.size) return 0
  let common = 0
  for (const e of aSet) if (bSet.has(e)) common++
  return common / aSet.size
}

/**
 * 1–k alternative ruter A→B via edge-penalty-metoden: finn korteste,
 * straff dens kanter, finn neste, osv. Nye ruter beholdes kun hvis de er
 * tilstrekkelig forskjellige (deler < `minShare` av kantene med en allerede
 * valgt rute) OG ikke uforholdsmessig lange (≤ `maxLengthRatio` × korteste
 * rute). Alle cost-mutasjoner reverseres til slutt.
 *
 * `maxLengthRatio` finnes fordi edge-penalty-metoden, etter at de korte
 * rutene er straffet, gjerne presser den k-te ruta ut på en absurd omvei
 * («æresrunde» — f.eks. 9 km der korteste er 4 km) bare for å være distinkt
 * nok. Slike ruter ville ingen valgt; vi dropper dem heller og returnerer
 * færre alternativer. 1.8 = en omvei på opptil +80 % godtas, mer ikke.
 *
 * @param {ReturnType<typeof buildRoutingGraph>} rg
 * @param {string} fromId
 * @param {string} toId
 * @param {{ k?: number, penalty?: number, minShare?: number, maxLengthRatio?: number }} opts
 * @returns {Array<{coordinates:Array<[number,number]>, lengthM:number, costM:number, nodeIds:string[]}>}
 *          sortert på lengthM stigende
 */
export function kShortestRoutes(rg, fromId, toId, opts = {}) {
  const { k = 3, penalty = 2.5, minShare = 0.6, maxLengthRatio = 1.8 } = opts
  const { graph: g, route } = rg
  if (!fromId || !toId || !g.hasNode(fromId) || !g.hasNode(toId)) return []

  const chosen = []
  const chosenSets = []
  const penalized = new Map()   // edgeId → original cost
  const maxAttempts = k * 4
  let shortestLen = Infinity    // settes av første (= globalt korteste) rute

  try {
    for (let attempt = 0; attempt < maxAttempts && chosen.length < k; attempt++) {
      const r = route(fromId, toId)
      if (!r) break
      if (r.lengthM < shortestLen) shortestLen = r.lengthM
      const eset = routeEdgeSet(g, r.nodeIds)
      const tooSimilar = chosenSets.some(s => shareOf(eset, s) >= minShare)
      // Korteste ruta godtas alltid; alternativer kun hvis de ikke er en
      // uforholdsmessig lang omvei.
      const tooLong = chosen.length > 0 && r.lengthM > shortestLen * maxLengthRatio
      if (!tooSimilar && !tooLong) {
        chosen.push(r)
        chosenSets.push(eset)
      }
      // Straff denne rutens kanter slik at neste søk vrir unna.
      for (const e of eset) {
        if (!penalized.has(e)) penalized.set(e, g.getEdgeAttribute(e, 'cost'))
        g.setEdgeAttribute(e, 'cost', g.getEdgeAttribute(e, 'cost') * penalty)
      }
    }
  } finally {
    for (const [e, cost] of penalized) g.setEdgeAttribute(e, 'cost', cost)
  }

  chosen.sort((a, b) => a.lengthM - b.lengthM)
  return chosen
}

/**
 * Rute-forslag for Stifinner. GARANTERER alltid en «kortest mulig»-rute
 * (ren geometrisk korteste vei, uavhengig av sti-/veitype), og fyller på
 * med flate-vektede alternativer som foretrekker natur-korridoren
 * (sti → skogsbilvei → småveg → veg).
 *
 * Bakgrunn: flate-vektingen alene kan svinge unna en kort vei-/skogsbilvei-
 * stump til fordel for en lengre rute på «finere» underlag (Verkensvannet-
 * tilfellet). Ved alltid å tilby den rene korteste ruta ser brukeren alltid
 * det faktisk korteste alternativet — og de vektede rutene gir de
 * triveligere variantene når de finnes og er distinkte nok.
 *
 * Den korteste ruta merkes `shortest: true`. Resultatet er sortert på
 * lengthM stigende (så korteste ligger først).
 *
 * Motorvei (501) ekskluderes fra ALLE forslag — en fotgjenger skal ikke
 * sendes ut på motorvei, og «kortest mulig» skal i hvert fall ikke gjøre det.
 *
 * @param {ReturnType<typeof buildRoutingGraph>} rg
 * @param {string} fromId
 * @param {string} toId
 * @param {{ k?: number, penalty?: number, minShare?: number, maxLengthRatio?: number }} opts
 * @returns {Array<{coordinates:Array<[number,number]>, lengthM:number, costM:number, nodeIds:string[], shortest?:boolean}>}
 */
export function planRoutes(rg, fromId, toId, opts = {}) {
  const { k = 3, minShare = 0.6 } = opts
  const { graph: g, route } = rg
  if (!fromId || !toId || !g.hasNode(fromId) || !g.hasNode(toId)) return []

  // 1. Garantert kortest mulig — ren lengde, men UTEN motorvei: 'lengthNoMw'
  //    blokkerer 501-kanter. Skulle motorvei likevel være uunngåelig, forkast
  //    ruta helt (ingen «Kortest» som går på motorvei).
  let shortest = route(fromId, toId, 'lengthNoMw')
  if (shortest && pathUsesCode(g, shortest.nodeIds, '501')) shortest = null

  // 2. Flate-vektede alternativer (foretrekker sti → skogsbilvei → ...),
  //    også uten motorvei.
  const weighted = kShortestRoutes(rg, fromId, toId, opts)
    .filter(r => !pathUsesCode(g, r.nodeIds, '501'))

  const out = []
  let shortestSet = null
  if (shortest) {
    out.push({ ...shortest, shortest: true })
    shortestSet = routeEdgeSet(g, shortest.nodeIds)
  }
  for (const r of weighted) {
    if (out.length >= k) break
    // Hopp over en vektet rute som i praksis er den samme som korteste.
    if (shortestSet) {
      const eset = routeEdgeSet(g, r.nodeIds)
      if (shareOf(eset, shortestSet) >= minShare && shareOf(shortestSet, eset) >= minShare) continue
    }
    out.push(r)
  }

  out.sort((a, b) => a.lengthM - b.lengthM)
  return out
}

/**
 * Rute gjennom en ordnet liste noder [start, ...via, maal] (≥2). Leddene FØR
 * det siste rutes som korteste vei (fast prefiks som må innom hvert via-punkt);
 * det siste leddet gir 1–k alternativer via planRoutes, så hvert forslag deler
 * samme vei innom via-punktene men kan variere på siste strekk. Uten via-punkter
 * (nodeIds.length === 2) er resultatet identisk med planRoutes.
 *
 * Delt av MCP-serverens tegn_rute_svg og appens Stifinner (useStifinner).
 *
 * @param {ReturnType<typeof buildRoutingGraph>} rg
 * @param {string[]} nodeIds  [startNode, ...viaNodes, maalNode]
 * @param {object} opts        videresendes til planRoutes for siste ledd
 * @returns {Array<{coordinates:Array<[number,number]>, lengthM:number, costM:number, shortest?:boolean}>}
 */
export function planRoutesThrough(rg, nodeIds, opts = {}) {
  if (!Array.isArray(nodeIds) || nodeIds.length < 2) return []
  const { route } = rg

  let prefix = []
  let prefixLen = 0
  for (let i = 0; i < nodeIds.length - 2; i++) {
    const leg = route(nodeIds[i], nodeIds[i + 1], 'lengthNoMw')
    if (!leg) return []   // et via-ledd er ikke naabart → ingen gjennomgående rute
    prefix = prefix.concat(i === 0 ? leg.coordinates : leg.coordinates.slice(1))
    prefixLen += leg.lengthM
  }

  const last = planRoutes(rg, nodeIds[nodeIds.length - 2], nodeIds[nodeIds.length - 1], opts)
  if (!prefix.length) return last

  return last.map(r => ({
    coordinates: prefix.concat(r.coordinates.slice(1)),
    lengthM: prefixLen + r.lengthM,
    costM: r.costM,
    shortest: r.shortest,
    nodeIds: r.nodeIds,
  }))
}

// Kostnads-multiplikator på utturens kanter mens hjemveien søkes: sterk nok til
// at ruteren velger en annen sti tilbake (ekte sløyfe, ikke retrace), men et
// straff — ikke forbud — så en blindvei fortsatt kan gå samme vei tilbake.
const LOOP_OUTBOUND_PENALTY = 4

/**
 * Rundtur (sløyfe) fra `originId` innom `viaIds` og tilbake til `originId`.
 * Utturen origin → via1 → … → viaN rutes som korteste vei (uten motorvei);
 * hjemveien viaN → origin søkes på en graf der utturens kanter er straffet, så
 * den velger en ANNEN sti tilbake — resultatet er en ekte runde, ikke tur/retur.
 *
 * Hvorfor ikke `planRoutes` for hjemveien: dens garanterte «kortest»-ledd bruker
 * `lengthNoMw` (ustraffet) og ville retrace utturen. `kShortestRoutes` leser
 * `cost`, så utturs-straffen slår inn og gir distinkte hjemveier.
 *
 * Blindvei / ingen distinkt hjemvei → retrace utturen som eneste alternativ
 * (bedre å vise en tur/retur enn ingenting). Motorvei (501) ekskluderes fra
 * alle ledd, som i `planRoutes`.
 *
 * @param {ReturnType<typeof buildRoutingGraph>} rg
 * @param {string} originId  start = mål (sløyfens origo)
 * @param {string[]} viaIds  ≥1 vendepunkt, i rekkefølge
 * @param {{ k?: number, penalty?: number, minShare?: number, maxLengthRatio?: number }} opts
 * @returns {Array<{coordinates:Array<[number,number]>, lengthM:number, costM:number, loop:true, shortest?:boolean}>}
 *          sortert på lengthM stigende
 */
export function planLoop(rg, originId, viaIds, opts = {}) {
  const { k = 3 } = opts
  const { graph: g, route } = rg
  if (!originId || !g.hasNode(originId)) return []
  const vias = (viaIds || []).filter(id => id && g.hasNode(id))
  if (!vias.length) return []

  // Uttur: kjed korteste-vei-ledd origin → via1 → … → viaN (motorvei blokkert).
  let outCoords = []
  let outLen = 0
  const outEdges = new Set()
  let prev = originId
  for (const v of vias) {
    const leg = route(prev, v, 'lengthNoMw')
    if (!leg) return []   // et vendepunkt er ikke naabart → ingen sløyfe
    for (const e of routeEdgeSet(g, leg.nodeIds)) outEdges.add(e)
    outCoords = outCoords.length ? outCoords.concat(leg.coordinates.slice(1)) : leg.coordinates.slice()
    outLen += leg.lengthM
    prev = v
  }
  const lastVia = vias[vias.length - 1]

  // Straff utturens kanter, finn hjemvei-kandidater, gjenopprett alltid.
  const saved = new Map()
  let returns = []
  try {
    for (const e of outEdges) {
      saved.set(e, g.getEdgeAttribute(e, 'cost'))
      g.setEdgeAttribute(e, 'cost', g.getEdgeAttribute(e, 'cost') * LOOP_OUTBOUND_PENALTY)
    }
    returns = kShortestRoutes(rg, lastVia, originId, { k, ...opts })
      .filter(r => !pathUsesCode(g, r.nodeIds, '501'))
  } finally {
    for (const [e, c] of saved) g.setEdgeAttribute(e, 'cost', c)
  }

  // Behold hjemveier som faktisk skiller seg fra utturen (ekte sløyfe). Straffen
  // er kostnad, ikke forbud, så `kShortestRoutes` kan fortsatt returnere en
  // retrace av utturen som «alternativ» — den deler nesten alle kantene med
  // utturen og faller ut her.
  let chosen = returns.filter(r => shareOf(routeEdgeSet(g, r.nodeIds), outEdges) < 0.5)

  // Blindvei-fallback: ingen distinkt hjemvei → retrace utturen (tur/retur er
  // bedre enn ingen rute). Foretrekk korteste kandidat; ellers ren korteste vei.
  if (!chosen.length) {
    const back = returns[0] ?? route(lastVia, originId, 'lengthNoMw')
    if (back && !pathUsesCode(g, back.nodeIds, '501')) chosen = [back]
  }
  if (!chosen.length) return []

  const loops = chosen.map(r => ({
    coordinates: outCoords.concat(r.coordinates.slice(1)),
    lengthM: outLen + r.lengthM,
    costM: r.costM,
    loop: true,
    nodeIds: r.nodeIds,
  }))
  loops.sort((a, b) => a.lengthM - b.lengthM)
  if (loops[0]) loops[0].shortest = true
  return loops
}
