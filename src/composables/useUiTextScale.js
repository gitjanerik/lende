import { ref } from 'vue'

// Global UI-tekststørrelse. Modulnivå-singleton (som useAppMenu): settes fra
// hovedmenyens «Tekststørrelse»-knapp og konsumeres som `zoom`-style på
// tekst-flatene (hjem-listene, hovedmenyen, Om-siden, Innstillinger-skuffen,
// infodrawerens tekstblokk). Bevisst IKKE på knapper/chrome eller stedsnavn i
// selve kartet. Persisteres i localStorage; leser den gamle per-kart-nøkkelen
// («map-ui-text-scale», v12-æra) som fallback ved første kjøring.

const SCALES = [1, 1.25, 1.5]
const LS_KEY = 'lende-ui-text-scale'
const LEGACY_LS_KEY = 'map-ui-text-scale'

function load() {
  try {
    const v = Number(localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY))
    return SCALES.includes(v) ? v : 1
  } catch { return 1 }
}

const uiTextScale = ref(load())

export function useUiTextScale() {
  function cycleTextScale() {
    const i = SCALES.indexOf(uiTextScale.value)
    uiTextScale.value = SCALES[(i + 1) % SCALES.length]
    try { localStorage.setItem(LS_KEY, String(uiTextScale.value)) } catch { /* ignorer */ }
  }
  return { uiTextScale, cycleTextScale }
}
