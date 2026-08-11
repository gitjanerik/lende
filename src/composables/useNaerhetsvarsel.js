// Nærhetsvarsel: «si fra når jeg er 10 m fra dette punktet».
//
// Trukket ut av MapView.vue i v5.11.0. Selve alarmen (avstandsmåling, lyd,
// vibrasjon, persistering) bor i useProximityAlert; her er inngangen fra
// PUNKT-arket — config-panelet, arming, gjenoppretting etter reload, og
// skjerm-låsen som holder alarmen i live.
//
// To grenser som ser vilkårlige ut, men ikke er det:
//   • 2 km maks avstand ved arming. Lenger unna er sjansen stor for at
//     nettleseren eller GPS-en lukker seg før ankomst (en time på 5 km), og da
//     ville alarmen aldri fyrt. Bedre å nekte enn å love noe vi ikke holder.
//   • Gjenoppretting etter reload krever at varselet hører til DETTE kartet.
//     Punktet er lagret som lat/lon og re-projiseres mot gjeldende meta — et
//     varsel fra et annet kart ville landet på et tilfeldig sted her.

import { ref, computed, watch } from 'vue'
import { getPersistedAlert } from './useProximityAlert.js'
import { useScreenWakeLock } from './useScreenWakeLock.js'
import { wgs84ToSvg } from '../lib/utm.js'

const MAX_ARM_DISTANCE_M = 2000

/**
 * @param {{
 *   meta: import('vue').Ref, mapId: import('vue').Ref,
 *   userPos: object, proximity: object,
 *   contextMenuPoint: import('vue').Ref, contextMenuInfo: import('vue').Ref,
 *   proximityPanelOpen: import('vue').Ref,
 *   closeContextMenu: () => void,
 *   startPositioning: () => void,   // tilbakekall: eies av useGpsSpor
 * }} deps
 */
export function useNaerhetsvarsel({
  meta, mapId, userPos, proximity,
  contextMenuPoint, contextMenuInfo, proximityPanelOpen,
  closeContextMenu, startPositioning,
}) {
  // Inline config-panel i kontekst-draweren. Lokal redigerings-state speiler
  // proximity.prefs (sist brukte valg) til brukeren bekrefter med «Aktiver».
  const proximityCfg = ref({ distanceM: 10, sound: true, vibration: true })

  function toggleProximityPanel() {
    if (!proximityPanelOpen.value) {
      proximityCfg.value = {
        distanceM: proximity.prefs.distanceM,
        sound: proximity.prefs.sound,
        vibration: proximity.prefs.vibration,
      }
    }
    proximityPanelOpen.value = !proximityPanelOpen.value
  }

  function armProximityAlert() {
    const p = contextMenuPoint.value
    if (!p) return
    const cfg = proximityCfg.value
    // Minst én varseltype må være på.
    if (!cfg.sound && !cfg.vibration) cfg.vibration = true
    proximity.arm({
      svgX: p.svgX,
      svgY: p.svgY,
      lat: contextMenuInfo.value?.lat,
      lon: contextMenuInfo.value?.lon,
      label: contextMenuInfo.value?.place?.name ?? 'punktet',
      distanceM: cfg.distanceM,
      useSound: cfg.sound,
      useVibration: cfg.vibration,
      mapId: mapId.value,
    })
    proximityPanelOpen.value = false
    closeContextMenu()
  }

  // Avstand fra brukeren til long-press-punktet (for 2 km-gaten i config-panelet).
  const ctxDistFromUser = computed(() => contextMenuInfo.value?.fromUser?.distM ?? null)
  const ctxTooFarToArm = computed(() =>
    ctxDistFromUser.value != null && ctxDistFromUser.value > MAX_ARM_DISTANCE_M)

  // Gjenopprett et persistert varsel etter reload: re-projiser lat/lon mot
  // gjeldende kart-meta og re-arm, men kun hvis varselet hører til DETTE kartet.
  // Starter GPS automatisk så alarmen fungerer videre (krever allerede gitt
  // tillatelse — ingen ny prompt hvis avvist).
  function restoreProximityAlert() {
    if (proximity.active.value) return            // allerede aktivt i denne økten
    const d = getPersistedAlert()
    if (!d || !meta.value) return
    if (d.mapId !== mapId.value) return           // hører til et annet kart
    const { x, y } = wgs84ToSvg(d.lat, d.lon, meta.value)
    proximity.arm({
      svgX: x, svgY: y,
      lat: d.lat, lon: d.lon,
      label: d.label,
      distanceM: d.distanceM,
      useSound: d.useSound,
      useVibration: d.useVibration,
      mapId: d.mapId,
    })
    if (!userPos.isWatching) startPositioning()
  }

  // Skjermlås mens et varsel er aktivt: alarmen skal fyre selv om telefonen
  // ligger i lomma. Egen lås (ikke kart-låsen) fordi den ikke skal persisteres
  // og ikke ha idle-timeout — den følger varselet, ikke bruken av kartet.
  const alarmWake = useScreenWakeLock({ persist: false, idleTimeoutMs: 0 })
  watch(() => !!proximity.active.value, (on) => alarmWake.setEnabled(on))

  return {
    proximityCfg, toggleProximityPanel, armProximityAlert,
    ctxDistFromUser, ctxTooFarToArm, restoreProximityAlert,
  }
}
