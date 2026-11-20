// Dykket ned i innsjø-volumet: hvor man dykker, hvordan kameraet beveger seg, og
// hvor mørkt det blir. Ren regning uten three/DOM, så det kan testes i node.
//
// Dykket er en kamerapose i den virkelige (forsterkede) scenen, ikke en egen
// visning: man står fortsatt på kartet sitt, bare under vannflata. Derfor går
// bevegelsen gjennom den frie riggen (freeRig.spillSekvens) og gulvet byttes,
// ikke riggen.

import { terrainFloorY } from './cameraRigs.js'

// Mørket mettes ved 150 m: 288 m (Tyrifjorden) og 514 m (Hornindalsvatnet) skal
// være mørkeblå, ikke svarte. Ekte vann er svart lenge før det.
export const MORKE_METNING_M = 150
export const MORKE_TAK = 0.55

const GRUNN_FARGE = [0x2f, 0x7f, 0xc4]
const DYP_FARGE = [0x0b, 0x25, 0x40]

/** 0–1: hvor «dypt» det kjennes ut ved d meter (logaritmisk, mettet). */
export function dybdeGrad(d) {
  if (!(d > 0)) return 0
  return Math.min(1, Math.log1p(d) / Math.log1p(MORKE_METNING_M))
}

/** Mørke-overleggets alfa ved d meter. 5 m ≈ 0,18, 30 m ≈ 0,38, 150 m+ = 0,55. */
export function undervannsMorke(d) {
  return MORKE_TAK * dybdeGrad(d)
}

/** Dis- og bakgrunnsfargen under vann, som 0xRRGGBB. */
export function undervannsFarge(d) {
  const k = dybdeGrad(d)
  let ut = 0
  for (let i = 0; i < 3; i++) ut = (ut << 8) | Math.round(GRUNN_FARGE[i] + (DYP_FARGE[i] - GRUNN_FARGE[i]) * k)
  return ut
}

/**
 * Disen under vann, i world-meter. Rekkevidden sideveis krymper med dybden,
 * men flata over skal alltid skimtes: den er det eneste som sier hvor opp er.
 */
export function undervannsDis(d, avstandTilFlate) {
  const k = dybdeGrad(d)
  const sideveis = 400 - 300 * k
  return { near: 4, far: Math.max(sideveis, 1.6 * Math.max(0, avstandTilFlate) + 120) }
}

/** Det dypeste punktet i bunnen: gittercella og SVG-meter. */
export function dypestePunkt(bunn, { cols, transform }) {
  let best = -1
  let dybde = -Infinity
  for (let i = 0; i < bunn.maske.length; i++) {
    if (bunn.maske[i] && bunn.dybde[i] > dybde) { dybde = bunn.dybde[i]; best = i }
  }
  if (best < 0) return null
  const c = best % cols
  const r = (best - c) / cols
  return { c, r, x: c * transform.pixelWidth, y: r * transform.pixelHeight, dybde }
}

/** Ligger SVG-punktet i innsjøen (nærmeste gittercelle i masken)? */
export function iInnsjoen(bunn, { cols, rows, transform }, x, y) {
  const c = Math.round(x / transform.pixelWidth)
  const r = Math.round(y / transform.pixelHeight)
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false
  return !!bunn.maske[r * cols + c]
}

// Nålene som står I innsjøen er navnet på den; dykke-ringen tar plassen deres.
const VANN_NALER = new Set(['vann-navn', 'vann-omrade'])

/** Fjern innsjøens egne vann-nåler. Nåler på alle andre vann blir stående. */
export function utenInnsjoNaler(features, bunn, dem) {
  if (!bunn || !features?.length) return features ?? []
  return features.filter(f => !(VANN_NALER.has(f.kind) && iInnsjoen(bunn, dem, f.x, f.y)))
}

/**
 * Gulvet under vann: den SENKEDE bunnen, ikke det ekte DEM-et. Det ekte har
 * innsjøspeilet flatt, så det vanlige gulvet ville løftet kameraet rett opp
 * gjennom flata i første bilde. Taket er flata selv.
 */
export function undervannsGulv(terrengDem, coords, wx, wz, flateY) {
  const bunn = terrainFloorY(terrengDem, coords, wx, wz, 0)
  const rom = flateY - bunn
  const gulv = bunn + Math.min(8, Math.max(0, rom) * 0.3)
  return Math.min(gulv, flateY - 2)
}

const grad = (g) => (g * Math.PI) / 180

/**
 * Kamerabanen ned. Fire faser: innflyging, gjennom flata, nedstigning, ro på
 * bunnen. Hvert steg er en pose kameraet skal STÅ i når steget er ferdig.
 * Blikket er asimut (fast) og høyde, ikke et blikkpunkt — et blikkpunkt som
 * passerer gjennom kameraet når blikket snur fra ned til opp, gir et kast.
 *
 * @param {{x:number, z:number, flateY:number, bunnY:number, redusert?:boolean}} p
 *   bunnY er world-Y der kameraet skal ende (gulvet over det dypeste punktet).
 */
export function dykkSekvens({ x, z, flateY, bunnY, redusert = false }) {
  if (redusert) return [{ pos: [x, bunnY, z], hoyde: grad(55), tid: 0, fase: 'bunn' }]
  const dyp = Math.max(1, flateY - bunnY)
  const ned = 1.0 + 0.5 * Math.min(1, dyp / 300)
  return [
    { pos: [x, flateY + 60, z], hoyde: grad(-70), tid: 1.0, ease: 'inn-ut', fase: 'inn' },
    { pos: [x, flateY - Math.min(4, dyp * 0.2), z], hoyde: grad(-70), tid: 0.35, ease: 'lineaer', fase: 'flate' },
    { pos: [x, bunnY, z], hoyde: grad(40), tid: ned, ease: 'inn-ut', fase: 'ned' },
    { pos: [x, bunnY, z], hoyde: grad(55), tid: 0.6, ease: 'ut', fase: 'bunn' },
  ]
}

/** Banen opp igjen: rett opp gjennom flata, så overtar innsjø-innrammingen. */
export function oppSekvens({ x, z, flateY, redusert = false }) {
  if (redusert) return [{ pos: [x, flateY + 60, z], hoyde: grad(-70), tid: 0, fase: 'over' }]
  return [
    { pos: [x, flateY - 2, z], hoyde: grad(70), tid: 1.2, ease: 'inn-ut', fase: 'opp' },
    { pos: [x, flateY + 60, z], hoyde: grad(-60), tid: 0.8, ease: 'ut', fase: 'over' },
  ]
}

/** Dybden i meter (ekte, ikke forsterket) ved kamerahøyde camY. */
export function ekteDybde({ camY, flateY, coords, faktor }) {
  const worldPerMeter = coords.elevToWorldY(1) - coords.elevToWorldY(0)
  return Math.max(0, (flateY - camY) / (worldPerMeter * (faktor || 1)))
}
