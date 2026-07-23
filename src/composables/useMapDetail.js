import { ref, computed, watch } from 'vue'

// Kartdetalj / kvalitet — brukervalg under Innstillinger (og i kart-velgeren).
// Styrer DEM-oppløsningen høydekurvene bygges fra, og om skog-nyanse (CHM)
// beregnes. Høyere detalj = mer nedlastet høydedata per kart — derfor et
// bruker-valg (tilpass mobil-type / datamengde). Valget brukes ved BYGGING
// (som ekvidistanse), så det gjelder nye kart; lagrede kart beholder sin bakte
// SVG til de bygges på nytt.
//
// Modul-nivå ref ⇒ delt singleton som overlever MapView-remount, persistert.
const KEY = 'lende-map-detail'

// demResM = ønsket fineste DEM-oppløsning (m). chm = beregn kronehøydemodell
// (DOM − DTM) → differensierte skog-grønt. mbHint = omtrentlig nedlasting per
// 3×3 km-kart (målt mot NHM_DTM/DOM WCS).
export const QUALITY_PRESETS = Object.freeze([
  { id: 'rask',      label: 'Rask',      demResM: 10, chm: false, mbHint: '~0,4 MB',
    desc: '10 m høydekurver, ingen skog-nyanse. Minst data — for treg mobil eller lite datakvote.' },
  { id: 'standard',  label: 'Standard',  demResM: 2,  chm: false, mbHint: '~9 MB',
    desc: '2 m glatte høydekurver. God balanse mellom detalj og datamengde.' },
  { id: 'detaljert', label: 'Detaljert', demResM: 2,  chm: true,  mbHint: '~18 MB',
    desc: '2 m høydekurver + skog-nyanse (åpen/normal/tett skog fra kronehøyde).' },
  { id: 'maks',      label: 'Maks',      demResM: 1,  chm: true,  mbHint: '~74 MB',
    desc: '1 m høydekurver + skog-nyanse. Skarpest mulig — tyngst å laste, best på små kart.' },
])
export const DEFAULT_QUALITY = 'standard'

const isValid = (id) => QUALITY_PRESETS.some((p) => p.id === id)

function load() {
  try { const v = localStorage.getItem(KEY); if (isValid(v)) return v } catch { /* ignore */ }
  return DEFAULT_QUALITY
}

const qualityId = ref(load())
watch(qualityId, (v) => { try { localStorage.setItem(KEY, v) } catch { /* ignore */ } })

const preset = computed(
  () => QUALITY_PRESETS.find((p) => p.id === qualityId.value) || QUALITY_PRESETS[1])

export function useMapDetail() {
  return { qualityId, preset, QUALITY_PRESETS }
}
