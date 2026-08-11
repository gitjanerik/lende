// UTGÅENDE deling: kartutsnittet, et markert sted, eller den aktive turen som
// en lenke mottakeren kan åpne.
//
// Trukket ut av MapView.vue i v5.8.0. Mottaker-siden — å gjenskape en tur fra
// en lenke — bor i useDeltTur.js; de to har helt ulike avhengigheter (denne
// kjenner bare kartet og turens punkter, den andre må drive Stifinner-maskinen).
//
// Delings-modellen: SVG-en bor i IndexedDB hos avsender og kan ikke deles. Vi
// deler derfor OPPSKRIFTEN — utsnitt, ekvidistanse og aspekt — så mottakeren
// bygger sin egen, identiske kopi. Innebygde kart deles som direkte view-URL.

import { ref, computed } from 'vue'
import { svgToWgs84 } from '../lib/utm.js'
import { shareTourParams } from '../lib/tour3dLink.js'

/**
 * @param {{
 *   meta: import('vue').Ref, mapTitle: import('vue').Ref,
 *   kartId: () => string, erInnebygd: (id: string) => boolean,
 *   highlightedFeature: import('vue').Ref, contextMenuInfo: import('vue').Ref,
 *   closeContextMenu: () => void, sti: object,
 * }} deps
 */
export function useKartDeling({
  meta, mapTitle, kartId, erInnebygd,
  highlightedFeature, contextMenuInfo, closeContextMenu, sti,
}) {
  const shareInfo = computed(() => {
    if (!meta.value) return null
    const m = meta.value
    const lat = (m.bbox.south + m.bbox.north) / 2
    const lon = (m.bbox.west + m.bbox.east) / 2
    const sizeKm = m.widthM ? +(m.widthM / 1000).toFixed(2) : 4
    const equidistanceM = m.equidistance ?? 20
    return { lat, lon, sizeKm, equidistanceM }
  })

  function buildShareUrl(place = null, extraParams = null) {
    if (!shareInfo.value) return null
    const base = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
    const id = kartId()
    const params = new URLSearchParams()
    if (place && Number.isFinite(place.lat) && Number.isFinite(place.lon)) {
      if (place.name) params.set('hl', place.name)
      params.set('slat', place.lat.toFixed(6))
      params.set('slon', place.lon.toFixed(6))
    }
    // Ekstra params (f.eks. rundtur: olat/olon/rtv/ri) — appendes både på
    // innebygd-kart-URL-en og lagret-kart-URL-en, så mottaker-parsingen er lik.
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v != null && v !== '') params.set(k, String(v))
      }
    }
    if (erInnebygd(id)) {
      // Built-in: del direkte view-URL — mottaker ser nøyaktig samme kart.
      const qs = params.toString()
      return `${base}/kart/${id}${qs ? `?${qs}` : ''}`
    }
    // Stored map: del bbox + ekvidistanse. Mottaker lander i picker (låst
    // utsnitt); etter generering navigeres til MapView med ?hl=&slat=&slon=.
    const s = shareInfo.value
    params.set('lat', s.lat.toFixed(5))
    params.set('lon', s.lon.toFixed(5))
    // Aspekt (høyde/bredde) så mottakeren bygger SAMME utsnitt-form. Uten den
    // falt mottakeren tilbake til sitt eget skjermaspekt — en mobil (~2.1) kunne
    // få over dobbelt så stort areal som avsenderens kart, og klient-side-
    // byggingen frøs telefonen (rapportert for 10 km-kart).
    if (meta.value?.heightM && meta.value?.widthM) {
      params.set('asp', (meta.value.heightM / meta.value.widthM).toFixed(3))
    }
    params.set('km', String(s.sizeKm))
    params.set('eq', String(s.equidistanceM))
    return `${base}/kart/nytt?${params.toString()}`
  }

  const shareState = ref('idle')  // idle | sharing | copied | error
  let shareResetTimer = null

  // Felles dele-mekanikk: native share-sheet (iOS/Android) med clipboard-fallback
  // på desktop. `shareState` driver knapp-teksten i alle dele-knappene.
  async function performShare(url, title, text) {
    if (!url) return
    const shareData = { title, text, url }
    // navigator.share åpner native iOS/Android-dialog der brukeren velger
    // app (Meldinger, WhatsApp, Mail, AirDrop osv). canShare() finnes på
    // moderne browsere men ikke alltid — try/catch dekker resten.
    if (typeof navigator.share === 'function') {
      shareState.value = 'sharing'
      try {
        if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
          throw new Error('share-data-rejected')
        }
        await navigator.share(shareData)
        shareState.value = 'idle'
        return
      } catch (err) {
        // AbortError = bruker lukket sheet — det er ikke en feil
        if (err && err.name === 'AbortError') {
          shareState.value = 'idle'
          return
        }
        // Fall through til clipboard-fallback under
      }
    }
    // Fallback: kopier til utklippstavle. Brukes på desktop (uten share-sheet)
    // og når native share-API ikke aksepterer data (sjeldne tilfeller).
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch { /* ignore */ }
        document.body.removeChild(ta)
      }
      shareState.value = 'copied'
    } catch {
      shareState.value = 'error'
    }
    if (shareResetTimer) clearTimeout(shareResetTimer)
    shareResetTimer = setTimeout(() => { shareState.value = 'idle' }, 2200)
  }

  // «Del kart» — bare utsnittet, ingen markering.
  function onShareMap() {
    performShare(buildShareUrl(), mapTitle.value || 'Lende — turkart', mapTitle.value)
  }

  // «Del kart og sted» fra drawer-en — bruker den aktive rosa søke-/POI-
  // markeringen. SVG-punktet regnes om til WGS84 så mottakeren får eksakt
  // samme punkt.
  function onShareMapWithPlace() {
    const h = highlightedFeature.value
    if (!h || !meta.value) return
    const { lat, lon } = svgToWgs84(h.x, h.y, meta.value)
    performShare(
      buildShareUrl({ name: h.name, lat, lon }),
      mapTitle.value || 'Lende — turkart',
      `${mapTitle.value} — sted: ${h.name}`,
    )
  }

  // «Del kart og sted» fra long-press-punktet (PUNKT-arket): deler det
  // brukeren akkurat trykket på — f.eks. et badevann eller utsiktspunkt.
  function onShareMapWithContextPlace() {
    const info = contextMenuInfo.value
    if (!info) return
    const name = info.place?.name || 'Markert sted'
    performShare(
      buildShareUrl({ name, lat: info.lat, lon: info.lon }),
      mapTitle.value || 'Lende — turkart',
      `${mapTitle.value} — sted: ${name}`,
    )
    closeContextMenu()
  }

  // «Del sti» / «Del rundtur» — turen beregnes deterministisk av punktene, så vi
  // deler bare dem + valgt rute-indeks (eksakte WGS84-koordinater oppå det
  // vanlige kart-utsnittet): origo, mål (A→B) eller vendepunkt(er) (rundtur,
  // der origo == mål). Mottakeren re-planlegger mot sitt eget (identiske) kart
  // og lander i samme følge-modus.
  //
  // A→B-turen manglet her fram til v5.6.3: uten vendepunkt falt funksjonen ut i
  // en tom return, og knappen gjorde ingenting. Kravene til de to turformene bor
  // nå i shareTourParams, sammen med lenkeformatet og testene.
  function onShareRoundTrip() {
    if (!meta.value) return
    const erRundtur = sti.isLoop.value
    const extra = shareTourParams({
      isLoop: erRundtur,
      start: sti.start.value,
      destination: sti.destination.value,
      via: sti.via.value,
      routeIdx: sti.selectedRouteIdx.value,
      // Kartnavnet (tn) så mottakerens kart ikke bygges som «Uten navn».
      name: mapTitle.value && mapTitle.value !== 'Uten navn' ? mapTitle.value : null,
      toWgs84: (p) => svgToWgs84(p.svgX, p.svgY, meta.value),
    })
    if (!extra) return
    performShare(
      buildShareUrl(null, extra),
      mapTitle.value || 'Lende — turkart',
      `${mapTitle.value} — ${erRundtur ? 'rundtur' : 'tur langs stien'}`,
    )
  }

  return {
    shareInfo, shareState,
    buildShareUrl, performShare,
    onShareMap, onShareMapWithPlace, onShareMapWithContextPlace, onShareRoundTrip,
  }
}
