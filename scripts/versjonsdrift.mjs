// Samme pakke, ulik versjon i to av de fire katalogene.
//
// Hvorfor den finnes: de fire package.json-ene er separate trær som deployes
// hver for seg, så de driver fra hverandre uten at noe sier fra. Det er ikke en
// hypotese — `@modelcontextprotocol/sdk` sto på 1.29 i rot (dev-bare, uten
// betydning) og på 1.23 nestet inne i `agents` i den DEPLOYEDE MCP-Workeren, og
// det ble oppdaget ved at noen leste to filer i samme økt. Dependabot ser hver
// katalog for seg og kan derfor per konstruksjon ikke se dette.
//
// Modulen er REN: ingen fs, ingen nett. Kallerne leser filene.

/** Rangering av flatene, lavest tall = veier tyngst. Se KATALOGER i vedlikehold.mjs. */
const FLATE_VEKT = { 'DEPLOYERT (token-gatet)': 0, DEPLOYERT: 1 }
const vekt = (flate) => FLATE_VEKT[flate] ?? 2

/**
 * Deklarerte områder fra én package.json. `optionalDependencies` er med fordi de
 * havner i treet når plattformen passer; `peerDependencies` er det IKKE — de er
 * et krav til omgivelsene, ikke en versjon vi har valgt.
 */
export function deklarerteVersjoner(pkg) {
  const ut = new Map()
  for (const felt of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [navn, omraade] of Object.entries(pkg?.[felt] ?? {})) {
      if (typeof omraade !== 'string') continue
      ut.set(navn, { omraade, dev: felt === 'devDependencies' })
    }
  }
  return ut
}

/**
 * Låste versjoner fra én package-lock.json, transitivt. Navnet er alt etter
 * SISTE `node_modules/` i stien, så `node_modules/agents/node_modules/zod`
 * teller som `zod` — det er nettopp den nestede kopien som er poenget.
 *
 * Rot-noden (`""`) hoppes over: dens `version` er prosjektets egen, ikke en
 * avhengighet. Uten det ville hver katalog levert seg selv som «pakke 1.0.0» og
 * de tre Workerne kollidert på et navn de ikke har.
 */
export function laasteVersjoner(lock) {
  const ut = new Map()
  for (const [sti, node] of Object.entries(lock?.packages ?? {})) {
    if (!sti || typeof node?.version !== 'string') continue
    if (node.link === true) continue
    const i = sti.lastIndexOf('node_modules/')
    if (i < 0) continue
    const navn = sti.slice(i + 'node_modules/'.length)
    if (!navn) continue
    if (!ut.has(navn)) ut.set(navn, new Set())
    ut.get(navn).add(node.version)
  }
  return ut
}

/**
 * Finner pakker som finnes i minst to kataloger med ulik versjon.
 *
 * Deklarert og låst sammenliknes ALDRI mot hverandre: `^4.0.0` og `4.125.3` er
 * ikke et avvik, de er to ulike spørsmål. En katalog uten lockfile bidrar derfor
 * bare til den deklarerte lista.
 *
 * @param {{navn:string, flate?:string, deklarert?:Map, laast?:Map}[]} kataloger
 */
export function finnDrift(kataloger) {
  return {
    deklarert: samle(kataloger, 'deklarert', (v) => [v.omraade]),
    laast: samle(kataloger, 'laast', (v) => [...v]),
  }
}

function samle(kataloger, felt, verdier) {
  /** @type {Map<string, {katalog:string, flate:string, versjoner:string[]}[]>} */
  const perPakke = new Map()
  for (const k of kataloger) {
    for (const [navn, v] of k[felt] ?? new Map()) {
      const versjoner = verdier(v).filter(Boolean).sort()
      if (!versjoner.length) continue
      if (!perPakke.has(navn)) perPakke.set(navn, [])
      perPakke.get(navn).push({ katalog: k.navn, flate: k.flate ?? '', versjoner })
    }
  }

  const ut = []
  for (const [navn, rader] of perPakke) {
    if (rader.length < 2) continue
    const alle = new Set(rader.flatMap((r) => r.versjoner))
    if (alle.size < 2) continue
    ut.push({ navn, rader, antallVersjoner: alle.size, vekt: Math.min(...rader.map((r) => vekt(r.flate))) })
  }
  // Tyngste flate først, så navn — så en drift som treffer noe deployet aldri
  // havner under en som bare treffer verktøykjeden.
  ut.sort((a, b) => a.vekt - b.vekt || a.navn.localeCompare(b.navn))
  return ut
}
