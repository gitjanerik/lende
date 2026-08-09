// «Følg stien» — grådig vandring gjennom stinettets graf.
//
// Brukeren trykker på en sti i 3D og blir tatt med langs den. Problemet er
// krysset: i tett stinett kan et valg dukke opp hvert femtiende meter, og en
// dialog per kryss ville drept opplevelsen. Regelen er derfor at STIEN SOM GÅR
// RETTEST FRAM VINNER — det er også slik man går i virkeligheten når man ikke
// har bestemt seg for noe annet. Brukeren kan pause og velge en annen gren,
// men trenger ikke gjøre noe for at turen skal fortsette naturlig.
//
// Modulen er ren: ingen three, ingen DOM, ingen Vue. Den kjenner bare
// graphology-grafen fra buildRoutingGraph (noder med `pos` i SVG-meter,
// kanter med `length` og `isomCode`).

import { ISOM_COST } from '../routing.js'

// Over dette regnes «rettest fram» som en U-sving — da er stien slutt for oss
// selv om grafen har flere kanter å tilby.
const MAX_TURN_RAD = (120 * Math.PI) / 180
// Retningsforskjeller under dette er praktisk talt like rette; da avgjør
// stitypen i stedet (en tydelig sti slår et stitråkk).
const TIE_RAD = (8 * Math.PI) / 180
const DEFAULT_MAX_LENGTH_M = 25000
// En node kan passeres to ganger (en rundtur skal få lov til å lukke seg);
// tredje gang stopper vi, ellers ville en løkke gått i det uendelige.
const MAX_VISITS = 2

// Blindveier kortere enn dette er «stumper»: de VISES i kartet som før, men
// utforskeren foreslår dem ikke som stibytte i kryss, og en tur kan ikke
// startes ved å trykke i dem. En 60-meters adkomststump til en P-plass er
// ikke en tur — den er støy i kryssvalget.
export const BLIND_STUB_M = 100

const bearing = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0])

// Minste vinkelforskjell, alltid i [0, π].
export function angleDiff(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2)
  if (d > Math.PI) d = Math.PI * 2 - d
  return d
}

// Fortegnsbevart sving fra peiling `from` til `to`, i (−π, π]. Kartrommet har
// y voksende SØROVER, så positiv verdi er sving til HØYRE sett i gangretningen
// — samme konvensjon som skjermkoordinater.
export function signedTurn(from, to) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d <= -Math.PI) d += Math.PI * 2
  return d
}

function edgeInfo(rg, from, to) {
  const g = rg.graph
  const attrs = g.getEdgeAttributes(from, to)
  const posFrom = g.getNodeAttribute(from, 'pos')
  const posTo = g.getNodeAttribute(to, 'pos')
  return {
    node: to,
    pos: posTo,
    bearing: bearing(posFrom, posTo),
    length: attrs?.length ?? Math.hypot(posTo[0] - posFrom[0], posTo[1] - posFrom[1]),
    isomCode: attrs?.isomCode ?? null,
  }
}

function neighborsOf(rg, node, exclude) {
  const out = []
  rg.graph.forEachNeighbor(node, (nb) => {
    if (nb === exclude) return
    out.push(edgeInfo(rg, node, nb))
  })
  return out
}

// Følg kjeden fra `from` inn i `to` gjennom grad-2-noder, til første kryss
// (grad ≥ 3), blindvei (grad 1), løkke — eller til lengden passerer maxM.
function chaseChain(rg, from, to, maxM) {
  const g = rg.graph
  let prev = from
  let cur = to
  let lengthM = g.getEdgeAttribute(from, to, 'length')
  const seen = new Set([from, to])
  while (lengthM < maxM) {
    const deg = g.degree(cur)
    if (deg === 1) return { deadEnd: true, lengthM }
    if (deg >= 3) return { deadEnd: false, lengthM }
    let next = null
    g.forEachNeighbor(cur, (nb) => { if (nb !== prev) next = nb })
    if (!next || seen.has(next)) return { deadEnd: false, lengthM }
    seen.add(next)
    lengthM += g.getEdgeAttribute(cur, next, 'length')
    prev = cur
    cur = next
  }
  return { deadEnd: false, lengthM }
}

/** Er grenen from→to en blindvei kortere enn maxM, uten kryss underveis? */
export function isBlindStub(rg, fromNode, toNode, maxM = BLIND_STUB_M) {
  return chaseChain(rg, fromNode, toNode, maxM).deadEnd
}

/**
 * Ligger noden inne i en stump? Sant når hele kjeden noden står på — fulgt
 * i alle retninger til kryss/blindvei — har minst én blindvei-ende og er
 * kortere enn maxM totalt. Kryss-noder tilhører per definisjon hovednettet.
 */
export function isInBlindStub(rg, nodeId, maxM = BLIND_STUB_M) {
  const g = rg?.graph
  if (!g?.hasNode?.(nodeId)) return false
  const deg = g.degree(nodeId)
  if (deg === 0) return true
  if (deg >= 3) return false
  const chains = []
  // En grad-1-node er selv kjedens blindvei-ende.
  if (deg === 1) chains.push({ deadEnd: true, lengthM: 0 })
  g.forEachNeighbor(nodeId, (nb) => chains.push(chaseChain(rg, nodeId, nb, maxM)))
  if (chains.some(c => !c.deadEnd && c.lengthM >= maxM)) return false
  if (!chains.some(c => c.deadEnd)) return false
  return chains.reduce((s, c) => s + c.lengthM, 0) < maxM
}

// Rangér kandidater: rettest fram først. Ved praktisk talt lik retning vinner
// den beste stitypen (lavest ISOM-kostnad), deretter det lengste strekket —
// en lang gjennomgående sti er nesten alltid det brukeren mente.
function pickStraightest(cands, incomingBearing) {
  let best = null
  for (const c of cands) {
    const turn = angleDiff(c.bearing, incomingBearing)
    const cost = ISOM_COST[c.isomCode] ?? 1.5
    if (!best) { best = { ...c, turn, cost }; continue }
    const dTurn = turn - best.turn
    if (dTurn < -TIE_RAD) { best = { ...c, turn, cost }; continue }
    if (dTurn > TIE_RAD) continue
    if (cost < best.cost || (cost === best.cost && c.length > best.length)) {
      best = { ...c, turn, cost }
    }
  }
  return best
}

/**
 * Vandre fra en node i én retning.
 *
 * @param {ReturnType<import('../routing.js').buildRoutingGraph>} rg
 * @param {string} startNodeId
 * @param {{headingXY?: [number, number], firstNodeId?: string, maxLengthM?: number}} opts
 *   headingXY  ønsket startretning i SVG-meter (typisk kameraets blikkretning
 *              projisert ned) — den naboen som ligger nærmest denne retningen
 *              velges, altså «bort fra kamera».
 *   firstNodeId tvinger første steg (brukes når brukeren velger gren i et kryss).
 * @returns {{coordinates: Array<[number,number]>, lengthM: number,
 *            nodeIds: string[],
 *            junctions: Array<{alongM:number, nodeId:string, chosenNodeId:string,
 *                              options: Array<{nodeId:string, bearing:number,
 *                                              turn:number, isomCode:string|null,
 *                                              lengthM:number}>}>}}
 */
export function walkFromNode(rg, startNodeId, { headingXY = null, firstNodeId = null, maxLengthM = DEFAULT_MAX_LENGTH_M } = {}) {
  const empty = { coordinates: [], lengthM: 0, nodeIds: [], junctions: [] }
  if (!rg?.graph?.hasNode?.(startNodeId)) return empty

  const g = rg.graph
  const startPos = g.getNodeAttribute(startNodeId, 'pos')
  const coordinates = [[startPos[0], startPos[1]]]
  const nodeIds = [startNodeId]
  const junctions = []
  const visits = new Map([[startNodeId, 1]])

  // Første steg: den naboen som peker mest i ønsket retning. Uten heading
  // (eller uten noen match) tas det lengste strekket, som gir mest tur.
  // Stumper velges bare når ingenting annet finnes.
  let first = neighborsOf(rg, startNodeId, null)
  if (first.length > 1) {
    const open = first.filter(c => !isBlindStub(rg, startNodeId, c.node))
    if (open.length) first = open
  }
  if (!first.length) return { ...empty, coordinates, nodeIds }

  let step
  if (firstNodeId) {
    step = first.find(c => c.node === firstNodeId) ?? null
  }
  if (!step) {
    if (headingXY && Math.hypot(headingXY[0], headingXY[1]) > 1e-9) {
      const want = Math.atan2(headingXY[1], headingXY[0])
      step = pickStraightest(first, want)
    } else {
      step = first.reduce((a, b) => (b.length > a.length ? b : a))
    }
  }
  if (!step) return { ...empty, coordinates, nodeIds }

  let lengthM = 0
  let prev = startNodeId
  let current = step

  while (current) {
    coordinates.push([current.pos[0], current.pos[1]])
    nodeIds.push(current.node)
    lengthM += current.length
    const seen = (visits.get(current.node) ?? 0) + 1
    visits.set(current.node, seen)
    if (seen > MAX_VISITS) break
    if (lengthM >= maxLengthM) break

    let cands = neighborsOf(rg, current.node, prev)
    if (!cands.length) break                       // blindvei

    // Stumper (blindvei < BLIND_STUB_M) deltar ikke i kryssvalget: de verken
    // vinner «rettest fram» eller tilbys som alternativ. Er ALT som gjenstår
    // stumper, ender turen her — å gå 60 m inn i en adkomststump og stoppe
    // er ikke en fortsettelse.
    if (cands.length > 1) {
      cands = cands.filter(c => !isBlindStub(rg, current.node, c.node))
      if (!cands.length) break
    }

    const next = pickStraightest(cands, current.bearing)
    if (!next || next.turn > MAX_TURN_RAD) break   // bare skarpe tilbakesvinger igjen

    // Grad ≥ 3 (inkludert kanten vi kom fra) er et ekte kryss — meld fra så
    // UI-et kan tilby alternativene før man passerer.
    if (cands.length > 1) {
      junctions.push({
        alongM: lengthM,
        nodeId: current.node,
        chosenNodeId: next.node,
        options: cands
          .map(c => ({
            nodeId: c.node,
            bearing: c.bearing,
            turn: angleDiff(c.bearing, current.bearing),
            // Fortegn for UI-et: > 0 = til høyre, < 0 = til venstre.
            turnSigned: signedTurn(current.bearing, c.bearing),
            isomCode: c.isomCode,
            lengthM: c.length,
          }))
          .sort((a, b) => a.turn - b.turn),
      })
    }

    prev = current.node
    current = next
  }

  return { coordinates, lengthM, nodeIds, junctions }
}

/**
 * Startnode + retning for et klikkpunkt i kartet.
 * Retningen er «bort fra kamera»: kameraets blikkretning projisert ned i
 * kartplanet, slik at turen går framover i det brukeren ser.
 *
 * @param {object} rg
 * @param {[number, number]} pointXY klikkpunkt i SVG-meter
 * @param {[number, number]} cameraXY kameraets posisjon i SVG-meter
 * @param {{tolM?: number}} [opts]
 * @returns {{nodeId: string, headingXY: [number, number], distM: number} | null}
 */
export function walkStartAt(rg, pointXY, cameraXY, { tolM = 120, stubM = BLIND_STUB_M } = {}) {
  const hit = rg?.nearestNode?.(pointXY)
  if (!hit || hit.distM > tolM) return null
  // Et trykk i en stump starter ingen tur — den vises i kartet, men er ikke
  // et sted å gå fra.
  if (isInBlindStub(rg, hit.id, stubM)) return null
  const pos = rg.graph.getNodeAttribute(hit.id, 'pos')
  let hx = pos[0] - cameraXY[0]
  let hy = pos[1] - cameraXY[1]
  const len = Math.hypot(hx, hy)
  if (len < 1e-6) return { nodeId: hit.id, headingXY: [1, 0], distM: hit.distM }
  return { nodeId: hit.id, headingXY: [hx / len, hy / len], distM: hit.distM }
}

/**
 * Bygg ruta på nytt når brukeren velger en annen gren i et kryss: behold alt
 * som allerede er gått fram til krysset, og vandre videre derfra.
 * Da mister man ikke framdriften — posisjonen langs turen er den samme.
 */
export function rerouteAtJunction(rg, walk, junction, chosenNodeId, opts = {}) {
  const idx = walk.nodeIds.indexOf(junction.nodeId)
  if (idx < 0) return walk
  const tail = walkFromNode(rg, junction.nodeId, { ...opts, firstNodeId: chosenNodeId })
  if (tail.coordinates.length < 2) return walk

  const head = walk.coordinates.slice(0, idx + 1)
  const headNodes = walk.nodeIds.slice(0, idx + 1)
  let headLength = 0
  for (let i = 1; i < head.length; i++) {
    headLength += Math.hypot(head[i][0] - head[i - 1][0], head[i][1] - head[i - 1][1])
  }

  return {
    coordinates: [...head, ...tail.coordinates.slice(1)],
    nodeIds: [...headNodes, ...tail.nodeIds.slice(1)],
    lengthM: headLength + tail.lengthM,
    junctions: [
      ...walk.junctions.filter(j => j.alongM < junction.alongM),
      ...tail.junctions.map(j => ({ ...j, alongM: j.alongM + headLength })),
    ],
  }
}
