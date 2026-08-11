// INNGÅENDE tur-lenke: gjenskap en delt tur fra query-parametrene.
//
// Trukket ut av MapView.vue i v5.8.0, sammen med useKartDeling (utgående side).
// Skillet mellom de to filene er ikke retning for retningens skyld: denne må
// vente på at KARTET er klart før den kan gjøre noe, og all vanskeligheten
// ligger i timingen. Selve turen legges av Stifinner-maskinen, som blir i
// MapView — den kaller vi tilbake til gjennom `gjenskapTur`.
//
// Tre ting må være på plass før en tur kan legges, og hver av dem har kostet
// en bug:
//   1. SVG-en må være rendret (Stifinner leser ruting-grafen fra DOM-en).
//   2. Detalj-passet må være ferdig — skjelett-passet har ingen sti-lag, og
//      ruting da ga et misvisende «Fant ingen sti»-banner.
//   3. Ligger punktene utenfor aktiv kartflis, må spøkelsesflisene være tegnet
//      (v4.3.0). Ellers ruter vi i et nett som ikke finnes ennå.
// Derfor prøver vi på nytt hvert halvsekund i opptil ~12 sekunder, og et token
// invaliderer ventende forsøk når en ny lenke kommer inn.

import { onUnmounted, watch } from 'vue'
import { parseTourQuery, parseTourNameQuery } from '../lib/tour3dLink.js'
import { svgToWgs84, wgs84ToSvg } from '../lib/utm.js'

const RETRY_MS = 500
const MAKS_FORSOK = 24        // ~12 sekunder

/**
 * @param {{
 *   route: object, meta: import('vue').Ref, searchIndex: import('vue').Ref,
 *   svgHostRef: import('vue').Ref, ghostRects: import('vue').Ref,
 *   fillingInDetails: import('vue').Ref, sti: object,
 *   findByName: (idx: Array, navn: string) => object|null,
 *   gjenskapTur: (tour: object, svgEl: Element) => void,
 * }} deps
 */
export function useDeltTur({
  route, meta, searchIndex, svgHostRef, ghostRects, fillingInDetails,
  sti, findByName, gjenskapTur,
}) {
  let token = 0
  let levende = true
  onUnmounted(() => { levende = false })

  function maybeRestoreRoundTripFromQuery() {
    token += 1
    restoreTourAttempt(token, 0)
  }

  // Navnebasert tur fra chatten (tfn/ttn): «lag et kart over X og gå fra A til
  // B». Kartet fantes ikke da chatten svarte, så navnene fulgte med gjennom
  // byggeflyten — nå som kartet er bygget og stiene er på plass slår vi dem opp
  // i kartets EGEN søkeindeks (samme fasit som søkefeltet) og lager en vanlig
  // koordinat-tur av dem. Returnerer null når indeksen ikke har begge navnene.
  function tourFraNavn() {
    const nav = parseTourNameQuery(route.query)
    if (!nav) return null
    const idx = searchIndex.value
    if (!idx?.length) return null
    const finn = (navn) => {
      const treff = findByName(idx, navn)   // eksakt treff foran delvis
      if (!treff || !meta.value) return null
      return svgToWgs84(treff.x, treff.y, meta.value)
    }
    const origin = finn(nav.fromName)
    const dest = finn(nav.toName)
    if (!origin || !dest) return null
    return { origin, dest, via: [], routeIdx: 0, open3d: nav.open3d, name: nav.name }
  }

  function restoreTourAttempt(minToken, forsok) {
    if (minToken !== token || !levende) return
    const tour = parseTourQuery(route.query) ?? tourFraNavn()
    if (!tour && parseTourNameQuery(route.query) && forsok < MAKS_FORSOK) {
      // Navnene venter på søkeindeksen (bygges når kartet er rendret) — prøv igjen.
      setTimeout(() => restoreTourAttempt(minToken, forsok + 1), RETRY_MS)
      return
    }
    if (!tour || !meta.value) return
    // Terreng-først: skjelett-passet har ingen sti-lag ennå — å rute nå gir et
    // misvisende «Fant ingen sti»-banner. Finalize-swappen kjører de utsatte
    // passene på nytt (scheduleDeferredMapPasses), så restore skjer da i stedet.
    if (fillingInDetails.value) return
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return

    // Kryss-flis: punkter utenfor aktiv flis kan rutes via spøkelses-flisene
    // (Stifinner-grafen leser ghost-paths, testdekket i useStifinner.test) —
    // men bare når flisene faktisk er tegnet. Vent (maks ~12 s) til ghostRects
    // dekker punktene; ved timeout prøves ruting uansett, og banneret gir da
    // ærlig «Ingen sti»-feil.
    const toSvg = (ll) => wgs84ToSvg(ll.lat, ll.lon, meta.value)
    const punkter = [tour.origin, ...(tour.dest ? [tour.dest] : []), ...tour.via].map(toSvg)
    const utenforAktiv = punkter.filter((p) =>
      p.x < 0 || p.y < 0 || p.x > meta.value.widthM || p.y > meta.value.heightM)
    if (utenforAktiv.length && forsok < MAKS_FORSOK) {
      const dekket = utenforAktiv.every((p) => ghostRects.value.some((r) =>
        p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h))
      if (!dekket) {
        setTimeout(() => restoreTourAttempt(minToken, forsok + 1), RETRY_MS)
        return
      }
    }

    gjenskapTur(tour, svg)
  }

  // Lende-chat / delte lenker: tur-params kan endres MENS kartet står åpent —
  // vis_tur_i_3d navigerer til samme kart-rute med ny query, og komponenten
  // remontes da ikke (App.vue keyer på route.path, som er uendret). Uten denne
  // watchen skjedde ingenting visuelt selv om chatten meldte suksess (v4.0.0).
  // Nullstill en ev. aktiv Stifinner-økt og kjør samme restore som ved last.
  watch(() => {
    const q = route.query
    return [q.olat, q.olon, q.dlat, q.dlon, q.rtv, q.ri, q.v3d, q.tn, q.tfn, q.ttn].join('|')
  }, () => {
    if (!parseTourQuery(route.query) && !parseTourNameQuery(route.query)) return
    if (sti.active.value) sti.cancel()
    maybeRestoreRoundTripFromQuery()
  })

  return { maybeRestoreRoundTripFromQuery }
}
