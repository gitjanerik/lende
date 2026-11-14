// Hvor OSM-dataene til et kart kommer fra. Flisene først — de er bakt, ligger
// i R2 og svarer på sekunder — og Overpass når flisene ikke kan leses (Workeren
// nede, en bake som feilet, et manifest i en versjon klienten ikke kjenner).
// Svaret har samme form uansett; `meta.kilde` sier hvem som svarte.
//
// `kilde`: 'auto' (fliser, så Overpass), 'fliser' (bare fliser — kaster) eller
// 'overpass' (bare Overpass). Fasit og probene som MÅLER Overpass-pipelinen
// skal be om 'overpass' eksplisitt.

import { fetchOverpass } from './mapBuilder.js'
import { hentOsmFraFliser } from './osmFlisFetcher.js'

// Lenger enn en normal flis-henting (et 8 km-kart i Oslo er ~10 MB gzip), men
// kort nok til at Overpass fortsatt rekker fristen for N50-arket når flisene
// henger i stedet for å feile.
export const FLIS_FRIST_MS = 15000

function medFrist(signal, ms) {
  const tid = AbortSignal.timeout?.(ms)
  if (!tid) return signal
  if (!signal) return tid
  return AbortSignal.any?.([signal, tid]) ?? signal
}

export async function fetchOsm(bbox, { signal, onProgress, kilde = 'auto', flisBase } = {}) {
  if (kilde === 'overpass') return merk(await fetchOverpass(bbox, { signal, onProgress }), 'overpass')
  try {
    onProgress?.('Henter kartdata …')
    return await hentOsmFraFliser(bbox, { signal: medFrist(signal, FLIS_FRIST_MS), base: flisBase })
  } catch (e) {
    if (kilde === 'fliser' || signal?.aborted) throw e
    console.warn(`[OSM] fliser utilgjengelige (${e?.message ?? e}) — henter fra Overpass`)
    const ut = merk(await fetchOverpass(bbox, { signal, onProgress }), 'overpass')
    ut.meta.flisFeil = String(e?.message ?? e)
    return ut
  }
}

function merk(svar, kilde) {
  if (svar) svar.meta = { ...(svar.meta ?? {}), kilde }
  return svar
}
