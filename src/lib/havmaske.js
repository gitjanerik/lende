// Havmasken: «finnes det sjø i dette utsnittet?» uten å spørre Overpass.
//
// Kyst-gaten i createMapFlow krever to ting: havflate-piksler i DEM-et OG bevis
// for saltvann. Det siste kom fra en kystlinje-probe mot Overpass — og Overpass
// er nettopp tjenesten docs/PLAN_OSM_UAVHENGIG.md tar ut av den kritiske stien.
// Uten svar ble N50-arket bygget som innland, uten sjø, på hvert kystkart.
//
// Masken er N50 Arealdekke «Havflate» rasterisert til et rutenett på ~1 km
// (scripts/bygg-havmaske.mjs), én bit per celle, «all touched» — en celle der
// sjøen så vidt når inn er sjø. Den svarer bare på SALTVANN-halvdelen; DEM-et
// avgjør fortsatt om det er havflate-piksler i arket. Mangler masken (ikke
// bakt, offline, utenfor rutenettet) svarer den null, og kalleren faller
// tilbake til Overpass som før.

import { medFlisNokkel, settFlisNokkel } from './n50FlisNokkel.js'

export const MASKE_VERSJON = 1

const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_N50_HAV_URL) ||
  `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}data/n50-hav/`

const TIMEOUT_MS = 8000

/**
 * Pakk et rutenett av bytes (0 = land, ≠0 = sjø), rad for rad fra NORD, til
 * én bit per celle. Bit `k % 8` i byte `k >> 3`, der k = rad·kolonner + kol.
 */
export function pakkMaske(celler, kolonner, rader) {
  const ut = new Uint8Array(Math.ceil((kolonner * rader) / 8))
  for (let k = 0; k < kolonner * rader; k++) if (celler[k]) ut[k >> 3] |= 1 << (k & 7)
  return ut
}

/**
 * Er noen celle i bbox-en sjø? true/false, eller null når bbox-en ligger helt
 * utenfor rutenettet — da vet masken ingenting, og «nei» ville vært en påstand.
 *
 * @param {{vest:number, sor:number, dLon:number, dLat:number,
 *          kolonner:number, rader:number, biter:Uint8Array}} maske
 * @param {{south:number, west:number, north:number, east:number}} bbox
 */
export function havIBbox(maske, bbox) {
  const { vest, sor, dLon, dLat, kolonner, rader, biter } = maske
  const nord = sor + rader * dLat
  const ost = vest + kolonner * dLon
  if (bbox.east <= vest || bbox.west >= ost || bbox.north <= sor || bbox.south >= nord) return null
  const k0 = Math.max(0, Math.floor((bbox.west - vest) / dLon))
  const k1 = Math.min(kolonner - 1, Math.floor((bbox.east - vest) / dLon))
  // Rad 0 er NORD — rasteret er skrevet ovenfra og ned.
  const r0 = Math.max(0, Math.floor((nord - bbox.north) / dLat))
  const r1 = Math.min(rader - 1, Math.floor((nord - bbox.south) / dLat))
  for (let r = r0; r <= r1; r++) {
    for (let k = k0; k <= k1; k++) {
      const i = r * kolonner + k
      if (biter[i >> 3] & (1 << (i & 7))) return true
    }
  }
  return false
}

const lover = new Map()
export function nullstillHavmaske() { lover.clear() }

/**
 * Hent masken én gang per økt og katalog. Feiler aldri hardt: null betyr «vet
 * ikke», og da spør kalleren Overpass.
 */
export function hentHavmaske({ basePath = BASE, hentTekst, hentBytes } = {}) {
  if (!lover.has(basePath)) {
    lover.set(basePath, (async () => {
      try {
        const tekst = hentTekst
          ? await hentTekst(`${basePath}manifest.json`)
          : await (async () => {
            const res = await fetch(`${basePath}manifest.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
            return res.ok ? res.text() : null
          })()
        if (!tekst) return null
        const m = JSON.parse(tekst)
        if (m.versjon !== MASKE_VERSJON) return null
        settFlisNokkel(basePath, tekst)
        const url = `${basePath}${m.fil}`
        const biter = hentBytes
          ? await hentBytes(url)
          : await (async () => {
            const res = await fetch(medFlisNokkel(url, basePath), { signal: AbortSignal.timeout(TIMEOUT_MS) })
            return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
          })()
        if (!biter || biter.length < Math.ceil((m.kolonner * m.rader) / 8)) return null
        return { ...m, biter }
      } catch {
        return null
      }
    })())
    // Et feilet forsøk skal ikke låse økta: neste kart prøver igjen.
    lover.get(basePath).then(m => { if (!m) lover.delete(basePath) })
  }
  return lover.get(basePath)
}

/** Saltvann i bbox-en ifølge masken: true/false, eller null = vet ikke. */
export async function havmaskeSvar(bbox, opts) {
  const maske = await hentHavmaske(opts)
  return maske ? havIBbox(maske, bbox) : null
}
