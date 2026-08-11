// GPS-status og de tre tipsene/varslene som hører til den.
//
// Trukket ut av MapView.vue i v5.12.0. Selve posisjoneringen bor i useGpsSpor og
// useUserPosition; her er lesbarheten for brukeren: debug-linja, «kopier
// koordinater» som en Google Maps-lenke, og de tre avvisbare meldingene
// (GPS-tips, lav nøyaktighet, utenfor kartet).
//
// Hver «dismiss» er bevisst kortlivet: de nullstilles når tilstanden de gjelder
// forsvinner, så meldingen kommer tilbake neste gang problemet er reelt. Et
// varsel om lav nøyaktighet som er avvist for godt er et varsel som ikke virker.

import { ref, computed, watch } from 'vue'

/**
 * @param {{
 *   userPos: object,
 *   gpsNow: import('vue').Ref,   // tikker hvert sekund mens GPS er på
 * }} deps
 */
export function useGpsTips({ userPos, gpsNow }) {

  const gpsDebugLine = computed(() => {
    if (!userPos.isWatching) return ''
    if (userPos.error) return 'Ingen GPS-posisjon'
    if (userPos.latRaw == null || userPos.lonRaw == null) return 'Venter på GPS-signal …'
    const lat = userPos.latRaw.toFixed(6)
    const lon = userPos.lonRaw.toFixed(6)
    const acc = userPos.accuracyM != null ? `±${Math.round(userPos.accuracyM)} m` : '±? m'
    const ageS = Math.max(0, Math.round((gpsNow.value - userPos.lastFixAt) / 1000))
    const src = userPos.lastFixSource === 'poll' ? 'P' : 'W'
    const rej = userPos.rejectedCount ? ` · ${userPos.rejectedCount} avvist` : ''
    return `${lat}, ${lon} · ${acc} · ${ageS}s · ${src}${rej}`
  })

  // v8.5.6: kopier raw lat/lng som Google Maps-URL. Universelt format —
  // blir tappable lenke i meldinger og åpner Maps-appen direkte.
  const copyState = ref('idle') // 'idle' | 'copied' | 'failed'
  async function copyGpsCoords() {
    if (userPos.latRaw == null || userPos.lonRaw == null) return
    const lat = userPos.latRaw.toFixed(6)
    const lon = userPos.lonRaw.toFixed(6)
    const url = `https://www.google.com/maps?q=${lat},${lon}`
    try {
      await navigator.clipboard.writeText(url)
      copyState.value = 'copied'
    } catch {
      copyState.value = 'failed'
    }
    setTimeout(() => { copyState.value = 'idle' }, 1500)
  }

  // v8.5.6: førstegangs-tips om «Presis posisjon» (Android 12+). Vi gikk i
  // fella selv — `enableHighAccuracy: true` gir 2000 m fallback hvis appen
  // kun har «Omtrentlig» lokasjon. Vis i drawer første gang GPS aktiveres,
  // dismissible. localStorage husker dismissal på tvers av sesjoner.
  const GPS_TIP_KEY = 'lende-gps-tip-seen'
  const gpsTipDismissed = ref(false)
  try { gpsTipDismissed.value = localStorage.getItem(GPS_TIP_KEY) === '1' } catch {}
  const showGpsTip = computed(() => userPos.isWatching && !gpsTipDismissed.value)
  function dismissGpsTip() {
    gpsTipDismissed.value = true
    try { localStorage.setItem(GPS_TIP_KEY, '1') } catch {}
  }

  // v8.5.6: in-map advarsels-banner når accuracy er dårlig (>100m).
  // Synlig over kartet uten at brukeren må åpne drawer. Dismissable
  // per sesjon — resettes når GPS toggles off→on.
  const LOW_ACCURACY_THRESHOLD_M = 100
  const lowAccuracyDismissed = ref(false)
  const showLowAccuracyBanner = computed(() =>
    userPos.isWatching &&
    userPos.accuracyM != null &&
    userPos.accuracyM > LOW_ACCURACY_THRESHOLD_M &&
    !lowAccuracyDismissed.value &&
    !userPos.error &&
    !userPos.isOutsideMap
  )
  function dismissLowAccuracy() { lowAccuracyDismissed.value = true }
  watch(() => userPos.isWatching, (on) => { if (on) lowAccuracyDismissed.value = false })

  // v9.1.2: «Du er utenfor dette kartet» kan dismisses med en X. Resettes
  // hver gang brukeren går tilbake innenfor kart-bounds — så hvis hen
  // forlater kartet på nytt, dukker meldingen opp igjen.
  const outsideMapDismissed = ref(false)
  const showOutsideMapBanner = computed(() =>
    userPos.isOutsideMap && !outsideMapDismissed.value
  )
  function dismissOutsideMap() { outsideMapDismissed.value = true }
  watch(() => userPos.isOutsideMap, (out) => { if (!out) outsideMapDismissed.value = false })

  // Screen Wake Lock — holder skjermen våken når brukeren bruker kartet til
  // orientering ute. Persisteres i localStorage (default PÅ). Re-requestes
  // automatisk når fanen blir synlig igjen siden browseren alltid slipper
  // wake-locks ved fane-bytte.
  return {
    gpsDebugLine, copyState, copyGpsCoords,
    showGpsTip, showLowAccuracyBanner, showOutsideMapBanner,
    gpsTipDismissed, dismissGpsTip,
    lowAccuracyDismissed, dismissLowAccuracy,
    outsideMapDismissed, dismissOutsideMap,
  }
}
