import { ref } from 'vue'

// Global UI-tekststørrelse. Modulnivå-singleton (som useAppMenu): settes fra
// hovedmenyens slider og konsumeres som `zoom`-style på tekst-flatene
// (hjem-listene, Om-siden, Innstillinger-skuffen, infodrawerens tekstblokk) —
// hovedmenyen selv skalerer via sin egen em-baserte rot-font. Bevisst IKKE på
// knapper/chrome eller stedsnavn i selve kartet. Persisteres i localStorage;
// leser den gamle per-kart-nøkkelen («map-ui-text-scale», v12-æra) som
// fallback ved første kjøring.
//
// SKALAEN ER ET SPENN, IKKE EN LISTE (v7.8.4). Fram til nå var de fire hakkene
// 100/125/150/200 de ENESTE lovlige verdiene: `setTextScale` avviste alt annet,
// og `load()` falt til 100 % for en verdi utenfor lista. Eieren ba om fri
// justering, og det er en bedre modell for nettopp denne innstillingen — den
// som må ha 135 % for å lese uten briller, har ikke 125 og 150 å velge mellom.
// Spennet er 100–200 %: under 100 er ikke en tilgjengelighets-innstilling, og
// 200 er taket flatene er MÅLT på å tåle (se snarvei-raden og værraden).
//
// DE FIRE HAKKENE STÅR LIKEVEL, og det er ikke en rest: A-knappen i arkene har
// plass til ETT trykk, ikke et spenn, og «litt større, takk» er fortsatt fire
// stasjoner. Knappen VISER den satte prosenten nøyaktig — også 137 — men
// flytter til neste hakk OVER den. Det er hele forskjellen fra før: lista er
// knappens trinn, ikke skalaens lovlige verdier.
export const UI_TEXT_SCALES = [1, 1.25, 1.5, 2]
export const UI_TEXT_MIN = 1
export const UI_TEXT_MAKS = 2

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

/**
 * Klemmer til spennet og runder til hele prosent. Rundingen er ikke pynt:
 * slideren gir hele prosenter, og en flyttall-hale ville gjort «er dette
 * hakket valgt?» til en tilnærming — og skrevet en ny verdi til localStorage
 * for hver piksel brukeren dro.
 */
export function klemTextScale(v, min = UI_TEXT_MIN, maks = UI_TEXT_MAKS) {
  const n = Number(v)
  if (!Number.isFinite(n)) return min
  return Math.round(Math.min(maks, Math.max(min, n)) * 100) / 100
}

function load() {
  try {
    const raa = localStorage.getItem(LS_KEY) ?? localStorage.getItem(LEGACY_LS_KEY)
    const v = Number(raa)
    return Number.isFinite(v) && v > 0 ? klemTextScale(v) : UI_TEXT_MIN
  } catch { return UI_TEXT_MIN }
}

const uiTextScale = ref(load())
speilTilRot(uiTextScale.value)

/**
 * Neste hakk i A-knappens liste, med runding. Ren funksjon, så regelen kan
 * testes uten hverken localStorage eller en Vue-komponent.
 *
 * FRA EN VERDI MELLOM HAKKENE GÅR DEN TIL DET FØRSTE OVER (v7.8.4) — 137 %
 * blir 150 %, ikke 100 %. Tidligere falt en ukjent verdi til første hakk, og
 * den regelen fantes fordi ingenting kunne SETTE en verdi mellom hakkene:
 * bare en eldre utgave eller en håndskrevet localStorage-nøkkel. Nå gjør
 * slideren nettopp det, og en knapp som kastet brukeren fra 137 til 100 ville
 * lest som at den nullstilte innstillingen.
 */
export function nesteTextScale(v, skalaer = UI_TEXT_SCALES) {
  const n = Number(v)
  if (!Number.isFinite(n)) return skalaer[0]
  return skalaer.find(s => s > n + 1e-9) ?? skalaer[0]
}

export function useUiTextScale() {
  function setTextScale(v) {
    const n = klemTextScale(v)
    if (n === uiTextScale.value) return
    uiTextScale.value = n
    speilTilRot(n)
    try { localStorage.setItem(LS_KEY, String(n)) } catch { /* ignorer */ }
  }
  function cycleTextScale() {
    setTextScale(nesteTextScale(uiTextScale.value))
  }
  return { uiTextScale, setTextScale, cycleTextScale }
}
