import { ref, watch } from 'vue'

// HVA KOMPASSKNAPPEN GJØR. Modulnivå-singleton som useEksterneLenker og
// useUiTextScale, slik at Preferanse-fana og kartet leser SAMME tilstand.
//
// KNAPPEN GJORDE TO TING PÅ ETT TRYKK, OG BARE DET ENE STÅR PÅ ETIKETTEN.
// Nåla er et kompass — den sier hvor nord ligger, og trykket vender arket dit.
// Men handleren bak den var «nullstill visningen»: den vred arket til nord OG
// zoomet ut til dekning OG satte tekstskalaen tilbake. Den som bare hadde
// mistet retningen mens de leste et nærbilde, mistet nærbildet også, og det er
// ikke noe aria-label kan advare om — det er to handlinger i én knapp.
//
// DEFAULT ER DERFOR BARE ROTASJONEN. Den er billig å angre (to fingre vrir
// tilbake) og den er det knappen ser ut som den gjør. Zoom-ut er beholdt som
// et VALG for dem som brukte den som en «tilbake til hele arket»-knapp — det
// var tross alt oppførselen til v7.8.33 — og bryteren bor i Preferanser.
//
// Nøkkelen skrives bare når verdien er PÅ: en `null` fra localStorage og en
// lagret `'0'` betyr det samme, og et flagg som ikke finnes er lettere å lese
// som «standard» i en feilsøking på en telefon.
const STORAGE_KEY = 'lende-kompass-nord-zoom'

function load() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

const zoomUt = ref(load())

watch(zoomUt, (v) => {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* privat modus / kvote */ }
})

export function useKompassNord() {
  function settZoomUt(på) { zoomUt.value = !!på }
  return { zoomUt, settZoomUt, STORAGE_KEY }
}
