// GPS og sporing: posisjonering, opptak av spor, live-statistikk,
// høydeprofiler og eksport.
//
// Trukket ut av MapView.vue i v5.8.0. Selve TEGNINGEN av sporene i kartet bor
// allerede i useSymbolRenderers (renderTracks/updateUserDot) — denne fila eier
// tilstanden og handlingene, og sier fra når det må tegnes på nytt.
//
// To ting som ser overflødige ut, men ikke er det:
//   • `tracksNow`/`gpsNow` tikker hvert sekund mens opptak/GPS er på. Uten dem
//     står «gått 2,3 km · 41 min» og fix-alderen stille mellom GPS-fix, som
//     kan være minutter i skogen (v8.5.5).
//   • `startPositioning` starter GPS og kompass i SAMME bruker-gest. iOS krever
//     at DeviceOrientationEvent.requestPermission() kalles fra et tap, så det
//     kan ikke flyttes inn i en watcher.

import { ref, computed, watch, onUnmounted } from 'vue'
import { useTrackRecorder } from './useTrackRecorder.js'
import { trackLengthM, downloadGpx } from '../lib/gpxExport.js'
import { sampleProfile } from '../lib/elevationProfile.js'

/**
 * @param {{
 *   mapId: import('vue').Ref, meta: import('vue').Ref,
 *   mapTitle: import('vue').Ref, storedDem: import('vue').Ref,
 *   userPos: object, compass: object,
 *   renderTracks: () => void,
 *   bekreft?: (spm: string) => boolean,
 * }} deps
 */
export function useGpsSpor({
  mapId, meta, mapTitle, storedDem, userPos, compass, renderTracks,
  bekreft = (spm) => confirm(spm),
}) {
  const tracker = useTrackRecorder(mapId.value, userPos)

  // ---- posisjonering -------------------------------------------------------

  // Start GPS + kompass i samme bruker-gest. Kompasset driver retnings-kjegla
  // (se updateUserDot); det MÅ startes fra et klikk/tap fordi iOS krever at
  // DeviceOrientationEvent.requestPermission() kalles innenfor en bruker-gest.
  // Derfor kalles dette fra gest-handlerne, ikke fra en watcher. compass.start()
  // er idempotent-guardet på isActive så GPS-refresh ikke re-spør om tillatelse.
  function startPositioning() {
    userPos.start()
    if (!compass.isActive) compass.start()
  }

  // «Prøv igjen» fra GPS-feil-toasten. Nettleseren kan ikke skru på enhetens
  // stedstjenester, men et nytt forsøk trigger enten tillatelses-dialogen på nytt
  // eller fanger opp at brukeren nettopp slo på GPS. start() er idempotent
  // (returnerer tidlig hvis vi alt følger), så vi tvinger i tillegg en fersk fix.
  function onRetryGps() {
    startPositioning()
    userPos.refresh()
  }

  // v8.5.5: tikker hvert sekund mens GPS er på, så debug-readout (alder på
  // siste fix) oppdaterer seg jevnt uten å bero på nye GPS-events.
  const gpsNow = ref(Date.now())
  let gpsTickTimer = null
  watch(() => userPos.isWatching, (on) => {
    if (on) {
      if (!gpsTickTimer) gpsTickTimer = setInterval(() => { gpsNow.value = Date.now() }, 1000)
    } else if (gpsTickTimer) {
      clearInterval(gpsTickTimer)
      gpsTickTimer = null
    }
  })

  // ---- opptak og live-statistikk ------------------------------------------

  // Tikker hvert sekund mens opptak pågår, så live-stats (distanse/varighet)
  // i drawer-en oppdateres uten å bero på nye GPS-fix.
  const tracksNow = ref(Date.now())
  let tracksTickTimer = null
  watch(() => tracker.isRecording.value, (on) => {
    if (on) {
      if (!tracksTickTimer) tracksTickTimer = setInterval(() => { tracksNow.value = Date.now() }, 1000)
    } else if (tracksTickTimer) {
      clearInterval(tracksTickTimer)
      tracksTickTimer = null
    }
  })

  onUnmounted(() => {
    if (gpsTickTimer) clearInterval(gpsTickTimer)
    if (tracksTickTimer) clearInterval(tracksTickTimer)
  })

  const liveTrackStats = computed(() => {
    const t = tracker.activeTrack.value
    if (!t) return null
    void tracksNow.value      // forcer re-eval på hver tikk
    const meters = trackLengthM(t)
    const ms = t.points.length > 0 ? Date.now() - t.points[0].t : 0
    return { meters, ms, points: t.points.length }
  })

  function onToggleRecording() {
    if (!userPos.isWatching) { startPositioning(); return }
    if (tracker.isRecording.value) tracker.stopRecording()
    else tracker.startRecording()
  }

  async function onDeleteTrack(id) {
    if (!bekreft('Slett dette sporet?')) return
    await tracker.deleteTrack(id)
  }

  function onExportTrackGpx(tr) {
    if (!meta.value) return
    downloadGpx(tr, meta.value, mapTitle.value)
  }

  // ---- høydeprofil ---------------------------------------------------------

  // expandedTrackId holder hvilket spor som er «zoomet» i drawer-en (vises som
  // stor profil under en modal-overlay).
  const expandedTrackId = ref(null)

  const profileCache = new Map()  // trackId+pointCount → profileObj
  function profileFor(track) {
    if (!track?.points?.length || !storedDem.value) return null
    const key = `${track.id}-${track.points.length}`
    if (profileCache.has(key)) return profileCache.get(key)
    const prof = sampleProfile(track, storedDem.value)
    if (prof) profileCache.set(key, prof)
    return prof
  }
  // Når DEM endres (lazy-load), invalider caches
  watch(storedDem, () => { profileCache.clear() })

  // Sporet som vises i den store høydeprofil-modalen (TrackElevationSheet).
  const expandedTrack = computed(() =>
    tracker.tracks.value.find((t) => t.id === expandedTrackId.value) || null)

  // ---- tegning -------------------------------------------------------------

  // Spor-lista, stilen og synligheten kan endres fra drawer-en; kartet må
  // følge etter.
  watch(() => tracker.tracks.value, () => renderTracks(), { deep: true })
  watch(() => tracker.trackStyle.value, () => renderTracks())
  watch(() => tracker.visibleTrackIds.value, () => renderTracks())

  return {
    tracker,
    startPositioning, onRetryGps, gpsNow,
    liveTrackStats, onToggleRecording, onDeleteTrack, onExportTrackGpx,
    expandedTrackId, expandedTrack, profileFor,
  }
}
