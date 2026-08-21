// Samler datalagene som ellers hentes LIVE, så de kan pakkes ned i en
// .lendekart-fil (kartPakke.js) og virke uten dekning hos mottakeren.
//
// Poenget: kulturminne-lagene og NVE-laget bygges først når brukeren slår dem
// på, og da spør de nettet. De sjekker riktignok cachen først
// (protectedAreaCache) — så hele trikset her er å FYLLE den cachen mens vi
// fortsatt har nett, ta radene med i fila, og skrive dem inn igjen hos
// mottakeren. Lag-koden selv trenger ikke å vite at noe har skjedd.
//
// Derfor må nøklene her være BIT-IDENTISKE med dem lagene slår opp på. Begge
// sider bruker wgs84BboxFromMeta (utm.js) og nøkkel-funksjonene i
// protectedAreaCache.js — ikke regn ut en bbox på egen hånd her.

import {
  cacheGet, cacheSet, ttlForKey, TTL,
  kulturminneBboxKey, kulturminneIdKey, fredetKulturminneBboxKey,
  hydroBboxKey, hydroLatestKey,
} from './protectedAreaCache.js'
import { wgs84BboxFromMeta } from './utm.js'
import { fetchKulturminnerMedStatus, fetchKulturminneById } from './kulturminneFetcher.js'
import { fetchFredaKulturminner } from './kulturminneWfs.js'
import { fetchStationsForBbox, fetchStationLatest } from './nveHydApi.js'

// Detaljene hentes ÉN PER KULTURMINNE mot api.ra.no. Et bykart kan ha flere
// hundre, og vi vil verken vente i minutter eller hamre proxyen — så et tak,
// fire om gangen, og full stopp etter fem feil på rad (typisk: nettet forsvant).
export const KULTURMINNE_DETALJ_TAK = 80
export const KULTURMINNE_SAMTIDIG = 4
export const FEIL_PAA_RAD_STOPP = 5
// Målingene er ferskvare uansett; ta med de nærmeste 25 stasjonene og la resten
// vise navn + lenke alene.
export const HYDRO_MAALING_TAK = 25

/** Kulturminne-ider som allerede er bakt inn i den lagrede SVG-en. */
export function kulturminneIderFraSvg(svg) {
  if (typeof svg !== 'string') return []
  return [...svg.matchAll(/data-kulturminne-id="([^"]+)"/g)].map((m) => m[1])
}

/**
 * Hent alt som må ligge i fila for at lagene skal virke offline.
 *
 * Hver kilde er isolert: feiler én, går de andre videre. Det er med vilje —
 * halve datalag er langt bedre enn ingen fil, og brukeren står gjerne på et
 * sted med dårlig nett når de pakker.
 *
 * @param {{ meta: object, svg?: string,
 *           onProgress?: (tekst: string) => void,
 *           signal?: AbortSignal, apiKey?: string }} arg
 * @returns {Promise<Array<{key: string, data: any, expires: number}>>}
 */
export async function samleOfflineData({ meta, svg = '', onProgress = () => {}, signal = null, apiKey = '' }) {
  const rader = []
  const sett = new Set()
  const nå = Date.now()
  const leggTil = (key, data) => {
    if (data == null || sett.has(key)) return
    sett.add(key)
    rader.push({ key, data, expires: nå + ttlForKey(key) })
  }
  // Fyll ALLTID den lokale cachen også: den som pakker har da kartet
  // offline-klart selv, uten å måtte importere sin egen fil.
  const husk = (key, data, ttl) => { leggTil(key, data); cacheSet(key, data, ttl) }
  const avbrutt = () => signal?.aborted === true

  if (!meta) return rader
  const bbox = wgs84BboxFromMeta(meta)

  // 1. Brukerminner (Kulturminnesøk) i utsnittet.
  let brukerminner = []
  try {
    onProgress('Henter kulturminner …')
    const key = kulturminneBboxKey(meta.bbox ?? bbox)
    const cached = await cacheGet(key)
    if (Array.isArray(cached)) {
      brukerminner = cached
      leggTil(key, cached)
    } else {
      const res = await fetchKulturminnerMedStatus(meta.bbox ?? bbox, { signal })
      brukerminner = res.items ?? []
      if (brukerminner.length) husk(key, brukerminner, TTL.kulturminne)
    }
  } catch { /* kilden er valgfri */ }

  // 2. Fredede kulturminner (Riksantikvaren via Geonorge WFS).
  if (!avbrutt()) {
    try {
      onProgress('Henter fredede kulturminner …')
      const key = fredetKulturminneBboxKey(bbox)
      const cached = await cacheGet(key)
      if (Array.isArray(cached)) leggTil(key, cached)
      else {
        const data = await fetchFredaKulturminner(bbox, { signal })
        if (data.length) husk(key, data, TTL.kulturminne)
      }
    } catch { /* kilden er valgfri */ }
  }

  // 3. Detaljteksten bak hvert kulturminne-ikon. Uten den viser detalj-arket
  //    offline bare tittel og kategori fra SVG-attributtene.
  if (!avbrutt()) {
    const ider = [...new Set([
      ...brukerminner.map((k) => k?.id).filter(Boolean),
      ...kulturminneIderFraSvg(svg),
    ])].slice(0, KULTURMINNE_DETALJ_TAK)
    let feilPaaRad = 0
    let ferdig = 0
    for (let i = 0; i < ider.length && feilPaaRad < FEIL_PAA_RAD_STOPP && !avbrutt(); i += KULTURMINNE_SAMTIDIG) {
      const bolk = ider.slice(i, i + KULTURMINNE_SAMTIDIG)
      onProgress(`Henter kulturminne-detaljer … ${ferdig}/${ider.length}`)
      const utfall = await Promise.all(bolk.map(async (id) => {
        const key = kulturminneIdKey(id)
        try {
          const cached = await cacheGet(key)
          if (cached) { leggTil(key, cached); return true }
          const full = await fetchKulturminneById(id, { signal })
          if (full) { husk(key, full, TTL.kulturminne); return true }
          return true   // tjenesten svarte, men kjenner ikke id-en — ikke en feil
        } catch { return false }
      }))
      ferdig += bolk.length
      feilPaaRad = utfall.every((ok) => !ok) ? feilPaaRad + bolk.length : 0
    }
  }

  // 4. NVE-vannmålestasjoner i utsnittet.
  let stasjoner = []
  if (!avbrutt()) {
    try {
      onProgress('Henter vannmålestasjoner …')
      const key = hydroBboxKey(bbox)
      const cached = await cacheGet(key)
      if (Array.isArray(cached)) {
        stasjoner = cached
        leggTil(key, cached)
      } else {
        stasjoner = await fetchStationsForBbox(bbox, { apiKey, signal })
        if (stasjoner.length) husk(key, stasjoner, TTL.hydro)
      }
    } catch { /* kilden er valgfri */ }
  }

  // 5. Siste måling per stasjon. Verdien er fra pakke-tidspunktet, og
  //    stasjons-arket viser måletidspunktet — så det er ærlig.
  if (!avbrutt() && stasjoner.length) {
    const utvalg = stasjoner.slice(0, HYDRO_MAALING_TAK)
    onProgress(`Henter vannføring … 0/${utvalg.length}`)
    for (let i = 0; i < utvalg.length && !avbrutt(); i += KULTURMINNE_SAMTIDIG) {
      const bolk = utvalg.slice(i, i + KULTURMINNE_SAMTIDIG)
      await Promise.all(bolk.map(async (st) => {
        if (!st?.stationId) return
        const key = hydroLatestKey(st.stationId)
        try {
          const cached = await cacheGet(key)
          if (cached) { leggTil(key, cached); return }
          const latest = await fetchStationLatest(st, { apiKey, signal })
          if (latest && Object.keys(latest).length) husk(key, latest, TTL.hydroMaaling)
        } catch { /* hopp over stasjonen */ }
      }))
      onProgress(`Henter vannføring … ${Math.min(i + bolk.length, utvalg.length)}/${utvalg.length}`)
    }
  }

  return rader
}

/**
 * Importens motstykke: skriv radene inn i mottakerens cache. TTL-en settes på
 * NYTT (ttlForKey) i stedet for å arve avsenderens `expires` — en fil kan ha
 * ligget en måned i en chat, og ville da vært utløpt i samme øyeblikk den ble
 * importert.
 */
export async function skrivOfflineData(rader) {
  if (!Array.isArray(rader)) return 0
  let n = 0
  for (const rad of rader) {
    if (!rad?.key || rad.data == null) continue
    await cacheSet(rad.key, rad.data, ttlForKey(rad.key))
    n++
  }
  return n
}
