import { ref, computed, watch } from 'vue'

// Kartdetalj — brukervalg under Innstillinger (og i kart-velgeren). Tre uavhengige
// valg, brukt ved BYGGING (som ekvidistanse), så de gjelder nye kart:
//
//   1. Oppløsning (data-aksen): hvor fint DEM-rutenett høydekurvene bygges fra.
//      Rask (10 m, minst data) eller Standard (2 m, glatte kurver ≈ UT.no).
//   2. Hjelpekurver: stiplede 2,5 m-kurver mellom 5 m-hovedkurvene. Bygges fra
//      SAMME 2 m-data som Standard ⇒ nesten gratis (bare flere linjer i SVG-en).
//      Vises fra .zoomed-in — mer terrengform når du zoomer inn.
//   3. Skog-nyanse (CHM): henter i tillegg overflate-modellen (DOM) og deler
//      skog i differensierte grønt. DETTE dobler nedlastingen — eneste tunge valg.
//
// Modul-nivå refs ⇒ delt singleton som overlever MapView-remount, persistert.
const RES_KEY = 'lende-map-detail'         // 'rask' | 'standard'
const FORMLINES_KEY = 'lende-map-formlines' // '1' | '0'
const CHM_KEY = 'lende-map-chm'             // '1' | '0'

export const QUALITY_PRESETS = Object.freeze([
  { id: 'rask',     label: 'Rask',     demResM: 10, mbHint: '~0,4 MB',
    desc: '10 m høydekurver. Minst data — for treg mobil eller lite datakvote.' },
  { id: 'standard', label: 'Standard', demResM: 2,  mbHint: '~9 MB',
    desc: '2 m glatte høydekurver. God balanse — matcher detaljnivået på UT.no.' },
])
export const DEFAULT_QUALITY = 'standard'

const isValid = (id) => QUALITY_PRESETS.some((p) => p.id === id)
const loadStr = (k, def) => { try { const v = localStorage.getItem(k); if (isValid(v)) return v } catch { /* ignore */ } return def }
const loadBool = (k) => { try { return localStorage.getItem(k) === '1' } catch { /* ignore */ } return false }

const qualityId = ref(loadStr(RES_KEY, DEFAULT_QUALITY))
const formLines = ref(loadBool(FORMLINES_KEY))
const chm = ref(loadBool(CHM_KEY))

watch(qualityId, (v) => { try { localStorage.setItem(RES_KEY, v) } catch { /* ignore */ } })
watch(formLines, (v) => { try { localStorage.setItem(FORMLINES_KEY, v ? '1' : '0') } catch { /* ignore */ } })
watch(chm, (v) => { try { localStorage.setItem(CHM_KEY, v ? '1' : '0') } catch { /* ignore */ } })

const preset = computed(
  () => QUALITY_PRESETS.find((p) => p.id === qualityId.value) || QUALITY_PRESETS[1])

export function useMapDetail() {
  return { qualityId, preset, QUALITY_PRESETS, formLines, chm }
}
