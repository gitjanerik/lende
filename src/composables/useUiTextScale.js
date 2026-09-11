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
// v6.5.43: `cycleTextScale` kommer tilbake — men BARE for infopanelene, ikke
// for hovedmenyen. Innvendingen fra v2.4.13 står fortsatt, og knappen svarer på
// den på to måter: den bærer den gjeldende verdien i klartekst på sin egen
// flate (ingen skjult tilstand), og den RUNDER (200 → 100), så veien tilbake er
// tre trykk og ikke en blindvei. Hovedmenyen beholder samtidige valg — der er
// det plass til fire knapper, og det er der man går for å velge en størrelse.
// I et infopanel er plassen én knapp, og spørsmålet er «litt større, takk».
//
// v6.5.32: 200 % kom til. Lista er den ENE kilden — `load()` validerer mot den,
// og hovedmenyens knapperad utledes av den — så et nytt hakk er én linje her.
// Tallet er ikke et rundt hopp fra 150: det er der en tekst blir lesbar for den
// som ellers må dra opp systemets egen skalering, og skuffen er testet på at den
// ikke renner over ved det.

export const UI_TEXT_SCALES = [1, 1.25, 1.5, 2]

/**
 * Skalaen speiles som `--ui-skala` på ROT-ELEMENTET (v7.6.0), og «rot» er ikke
 * en detalj. Kart-visningenes overlay-slotter (`--ovl-top` og resten, i
 * style.css) ganger med den, fordi knapperada og snarvei-raden begge vokser med
 * tekststørrelsen og en `--ovl-top` på faste 4rem da ville lagt raden oppå
 * baren. Et `var()` inne i en custom property blir substituert på elementet der
 * PROPERTYEN ER DEKLARERT — ikke der den brukes — så en `--ui-skala` satt på
 * kart-diven ville ikke nådd `--ovl-top` i `:root` i det hele tatt. Det var
 * første utgave av dette, og røyktesten målte `--ovl-top` til 64 px ved 200 %.
 */
const SKALA_VAR = '--ui-skala'
function speilTilRot(v) {
  try { document?.documentElement?.style?.setProperty(SKALA_VAR, String(v)) } catch { /* ignorer */ }
}
const LS_KEY = 'lende-ui-text-scale'
const LEGACY_LS_KEY = 'map-ui-text-scale'

function load() {
  try {
    const v = Number(localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY))
    return UI_TEXT_SCALES.includes(v) ? v : 1
  } catch { return 1 }
}

const uiTextScale = ref(load())
speilTilRot(uiTextScale.value)

// Neste hakk i lista, med runding. Ren funksjon, så regelen kan testes uten
// hverken localStorage eller en Vue-komponent. En verdi som ikke er i lista
// (skrevet av en eldre utgave, eller for hånd i localStorage) faller til
// første hakk framfor å låse knappen.
export function nesteTextScale(v, skalaer = UI_TEXT_SCALES) {
  const i = skalaer.indexOf(v)
  return i < 0 ? skalaer[0] : skalaer[(i + 1) % skalaer.length]
}

export function useUiTextScale() {
  function setTextScale(v) {
    if (!UI_TEXT_SCALES.includes(v) || v === uiTextScale.value) return
    uiTextScale.value = v
    speilTilRot(v)
    try { localStorage.setItem(LS_KEY, String(v)) } catch { /* ignorer */ }
  }
  function cycleTextScale() {
    setTextScale(nesteTextScale(uiTextScale.value))
  }
  return { uiTextScale, setTextScale, cycleTextScale }
}
