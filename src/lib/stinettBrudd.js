// Stinett-brudd — «hvor kommer Stifinneren til å oppføre seg rart, og hvorfor?»
// Ren modul (ingen DOM/fs/nett) delt av MCP-serveren, Cloudflare-speilet og
// Lende-chatten.
//
// Bakgrunn (v5.5.4, Narverudgruvene): et hull på 12,9 m mellom en sti og
// hovedstien ga ruteforslag på 14–18 km for en luftlinje på 676 m. Å finne det
// tok en time med engangsskript. Denne modulen gjør det til ett kall.
//
// Modellen:
//  • Grafen bygges med NØYAKTIG de samme opsjonene som ruteren bruker
//    (RUTE_GRAF_OPTS). Det er poenget: vi rapporterer hullene som ER der etter
//    at alle reparasjonspassene har kjørt, ikke hull i rådataene.
//  • Et brudd er en stiende (dangle) som ligger ≤ maksHullM fra en annen sti,
//    men som ruteren må gå ≥ minOmveiM for å nå. Da ser kartet sammenhengende
//    ut mens ruteren sender deg rundt.
//  • Omveien måles i to trinn: en billig gate med avstandstak per dangle, så
//    en full Dijkstra bare for de få som overlever. Ellers ville et 6 km kart
//    kostet 1600 fulle søk.
//  • Ingen omvei finnes (helt frakoblet) rapporteres som omveiM: null — det er
//    det verste tilfellet, ikke det mildeste, så det sorteres øverst.

import RBush from 'rbush'
import { buildRoutingGraph, projectPointOnSegment, RUTE_GRAF_OPTS } from './routing.js'

// Over dette taket slutter vi å lete etter den EKTE omveien og rapporterer
// «ingen praktisk vei» — en omvei på 20 km er uansett ikke en rute noen går.
const MAKS_MAALT_OMVEI_M = 20000

/**
 * Finn steder der stinettet ser sammenhengende ut, men ruteren må ta en stor
 * omvei (eller ikke kommer fram i det hele tatt).
 *
 * @param {Array<{coordinates: Array<[number,number]>, isomCode: string}>} features
 *        Routbare sti-/vei-features i SVG-meter (som buildRoutingGraph tar).
 * @param {{ maksHullM?: number, minOmveiM?: number, maksTreff?: number,
 *           grafOpts?: object }} opts
 * @returns {{ noder:number, kanter:number, komponenter:number, dangler:number,
 *             antallBrudd:number, treff:Array<object> }}
 *          `treff` er sortert verst først (frakoblet, så synkende omvei).
 */
export function finnStinettBrudd(features, opts = {}) {
  const {
    maksHullM = 60,
    minOmveiM = 500,
    maksTreff = 25,
    grafOpts = RUTE_GRAF_OPTS,
  } = opts

  const rg = buildRoutingGraph(features || [], grafOpts)
  const g = rg.graph
  const tom = {
    noder: g.order, kanter: g.size, komponenter: antallKomponenter(g),
    dangler: 0, antallBrudd: 0, treff: [],
  }
  if (g.order === 0) return tom

  // Kantindeks for «nærmeste sti som ikke er min egen».
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

  const dangler = []
  g.forEachNode((id, attr) => { if (g.degree(id) === 1) dangler.push({ id, pos: attr.pos }) })
  tom.dangler = dangler.length

  const brudd = []
  for (const d of dangler) {
    const hits = segIndex.search({
      minX: d.pos[0] - maksHullM, minY: d.pos[1] - maksHullM,
      maxX: d.pos[0] + maksHullM, maxY: d.pos[1] + maksHullM,
    })
    let best = null, bestD = maksHullM
    for (const seg of hits) {
      if (seg.s === d.id || seg.t === d.id) continue
      const proj = projectPointOnSegment(d.pos, seg.ap, seg.bp)
      if (proj.dist < bestD) { bestD = proj.dist; best = { seg, proj } }
    }
    if (!best) continue

    // Billig gate: er den andre stien innen minOmveiM, er ikke dette et brudd.
    const maal = new Set([best.seg.s, best.seg.t])
    if (rg.distanceWithin(d.id, maal, minOmveiM) <= minOmveiM) continue

    // Overlevende: mål den ekte omveien (taket gir null = ingen praktisk vei).
    const ekte = rg.distanceWithin(d.id, maal, MAKS_MAALT_OMVEI_M)
    brudd.push({
      hullM: rund(bestD, 1),
      omveiM: Number.isFinite(ekte) ? Math.round(ekte) : null,
      forholdstall: Number.isFinite(ekte) && bestD > 0 ? Math.round(ekte / bestD) : null,
      x: d.pos[0], y: d.pos[1],
      naboX: best.proj.point[0], naboY: best.proj.point[1],
      naboKode: best.seg.code,
    })
  }

  // Verst først: frakoblede (omveiM null) øverst, så synkende omvei.
  brudd.sort((a, b) => (b.omveiM ?? Infinity) - (a.omveiM ?? Infinity))

  return {
    noder: g.order,
    kanter: g.size,
    komponenter: antallKomponenter(g),
    dangler: dangler.length,
    antallBrudd: brudd.length,
    treff: brudd.slice(0, maksTreff),
  }
}

function rund(v, d) {
  const f = 10 ** d
  return Math.round(v * f) / f
}

function antallKomponenter(g) {
  const sett = new Set()
  let n = 0
  g.forEachNode((start) => {
    if (sett.has(start)) return
    n++
    const stack = [start]
    sett.add(start)
    while (stack.length) {
      const u = stack.pop()
      g.forEachNeighbor(u, (v) => { if (!sett.has(v)) { sett.add(v); stack.push(v) } })
    }
  })
  return n
}

/**
 * Formatér resultatet til MCP-svar: SVG-meter → WGS84, og en kort tekst som
 * sier hva som må til for å tette hvert hull.
 *
 * @param {ReturnType<typeof finnStinettBrudd>} res
 * @param {{ toWgs84: (x:number,y:number) => {lat:number,lon:number},
 *           gapBridgeM?: number }} ctx
 */
export function formatBruddSvar(res, { toWgs84, gapBridgeM = RUTE_GRAF_OPTS.gapBridgeM }) {
  return {
    graf: {
      noder: res.noder, kanter: res.kanter,
      komponenter: res.komponenter, stiender: res.dangler,
    },
    antallBrudd: res.antallBrudd,
    treff: res.treff.map((b) => {
      const her = toWgs84(b.x, b.y)
      const nabo = toWgs84(b.naboX, b.naboY)
      return {
        hullM: b.hullM,
        omveiM: b.omveiM,
        forholdstall: b.forholdstall,
        stiende: { lat: +her.lat.toFixed(6), lon: +her.lon.toFixed(6) },
        naermesteSti: { lat: +nabo.lat.toFixed(6), lon: +nabo.lon.toFixed(6), isomKode: b.naboKode },
        // Det handlingsrettede: hullet er større enn dagens toleranse, så
        // ruteren lot det stå. Tallet sier hva som skulle til.
        tetteMed: b.hullM > gapBridgeM
          ? `gapBridgeM ≥ ${Math.ceil(b.hullM)} (nå ${gapBridgeM})`
          : 'innenfor toleransen — sjekk om omveien er ekte (motorvei, elv, vernegrense)',
      }
    }),
    tolkning: res.antallBrudd === 0
      ? 'Ingen brudd funnet: hver stiende når nærmeste sti uten vesentlig omvei.'
      : `${res.antallBrudd} steder der stinettet ser sammenhengende ut, men ruteren må ` +
        'gå langt rundt. Et brudd med lite hull og stor omvei er nesten alltid et hull i ' +
        'kartdataene; et brudd med stor omvei OG stor hull kan være ekte (motorvei eller ' +
        'elv mellom stiene).',
  }
}
