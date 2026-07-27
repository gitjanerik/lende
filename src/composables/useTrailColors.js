import { ref, computed } from 'vue'
import { isTrailColor } from '../lib/trailColors.js'

// Sti-farger (Strek-FAB-panelet, v2.4.0). Samme lagringsmodell som
// useStrokeTuning: PER KART med en GLOBAL standard som fallback.
//   - fargevelger → per-kart-overstyring for kartet som vises nå
//   - «Angi som standard» → gjeldende farger løftes til global standard
//   - «Nullstill farger» → overstyringen SLETTES (ikke satt til svart/hvit),
//     så kartet igjen følger temaets egne sti-farger. I Lys (ISOM) er det
//     nøyaktig svart stiplet strek på krem casing; i mørke og monokrome
//     temaer unngår vi at en svart strek blir sittende på mørk bakgrunn.
// undefined = «følg tema» — samme sentinel som useReliefSettings bruker.
// Modul-nivå refs ⇒ delt singleton som overlever MapView-remount.

const GLOBAL_KEY = 'lende-trail-colors'        // { fg?, bg? }
const BYMAP_KEY = 'lende-trail-colors-bymap'   // { [mapId]: { fg?, bg? } }

function sanitize(obj) {
  const out = {}
  if (!obj || typeof obj !== 'object') return out
  for (const key of ['fg', 'bg']) {
    if (isTrailColor(obj[key])) out[key] = obj[key].toLowerCase()
  }
  return out
}

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

const globalColors = ref(sanitize(loadJson(GLOBAL_KEY)))
const byMap = ref(Object.fromEntries(
  Object.entries(loadJson(BYMAP_KEY)).map(([id, v]) => [id, sanitize(v)]),
))
const currentMapId = ref(null)

// Effektive farger for kartet som vises nå: per-kart > global > {} (følg tema).
const effective = computed(() => ({
  ...globalColors.value,
  ...(byMap.value[currentMapId.value] ?? {}),
}))

const isOverridden = computed(() => Object.keys(effective.value).length > 0)

function setCurrentMap(id) { currentMapId.value = id || null }

function setColor(role, value) {
  if (role !== 'fg' && role !== 'bg') return
  if (!isTrailColor(value) || !currentMapId.value) return
  byMap.value = {
    ...byMap.value,
    [currentMapId.value]: { ...effective.value, [role]: value.toLowerCase() },
  }
  persist(BYMAP_KEY, byMap.value)
}

function saveAsDefault() {
  globalColors.value = { ...effective.value }
  if (currentMapId.value) {
    const next = { ...byMap.value }
    delete next[currentMapId.value]
    byMap.value = next
    persist(BYMAP_KEY, byMap.value)
  }
  persist(GLOBAL_KEY, globalColors.value)
}

// Nullstill = fjern overstyringen på begge nivåer, så temaet bestemmer igjen.
// Uten å tømme den globale ville et kart «nullstilt» til den globale fargen.
function resetColors() {
  if (currentMapId.value) {
    const next = { ...byMap.value }
    delete next[currentMapId.value]
    byMap.value = next
    persist(BYMAP_KEY, byMap.value)
  }
  globalColors.value = {}
  persist(GLOBAL_KEY, globalColors.value)
}

export function useTrailColors() {
  return { effective, isOverridden, setCurrentMap, setColor, saveAsDefault, resetColors }
}
