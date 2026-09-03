import { ref } from 'vue'

// Global UI-tekststørrelse. Modulnivå-singleton (som useAppMenu): settes fra
// hovedmenyens 100/125/150/200-segmentbryter og konsumeres som `zoom`-style på
// tekst-flatene (hjem-listene, Om-siden, Innstillinger-skuffen, infodrawerens
// tekstblokk) — hovedmenyen selv skalerer via sin egen em-baserte rot-font.
// Bevisst IKKE på knapper/chrome eller stedsnavn i selve kartet. Persisteres i
// localStorage; leser den gamle per-kart-nøkkelen («map-ui-text-scale», v12-æra)
// som fallback ved første kjøring.
//
// v2.4.13: syklus-knappen er erstattet av samtidige valg — ingen skjult
// tilstand, og man kan gå rett tilbake. Derfor setTextScale i stedet for
// cycleTextScale.
//
// v6.5.32: 200 % kom til. Lista er den ENE kilden — `load()` validerer mot den,
// og hovedmenyens knapperad utledes av den — så et nytt hakk er én linje her.
// Tallet er ikke et rundt hopp fra 150: det er der en tekst blir lesbar for den
// som ellers må dra opp systemets egen skalering, og skuffen er testet på at den
// ikke renner over ved det.

export const UI_TEXT_SCALES = [1, 1.25, 1.5, 2]
const LS_KEY = 'lende-ui-text-scale'
const LEGACY_LS_KEY = 'map-ui-text-scale'

function load() {
  try {
    const v = Number(localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY))
    return UI_TEXT_SCALES.includes(v) ? v : 1
  } catch { return 1 }
}

const uiTextScale = ref(load())

export function useUiTextScale() {
  function setTextScale(v) {
    if (!UI_TEXT_SCALES.includes(v) || v === uiTextScale.value) return
    uiTextScale.value = v
    try { localStorage.setItem(LS_KEY, String(v)) } catch { /* ignorer */ }
  }
  return { uiTextScale, setTextScale }
}
