// useHoldVaken.js — «Hold skjermen våken» som ÉN global nedtelling.
//
// Modulnivå-state (singleton, som useAppMenu): hovedmenyens slider, ringen rundt
// hamburgeren og Lende-chattens verktøy skal svare på det samme spørsmålet, og
// tre kopier av tilstanden ville kommet i utakt straks én av dem satte den.
// Derfor bor den her og ikke i en visning: funksjonen er like nyttig i
// Turplanleggeren som i kartet, og en wake-lock som dør når man bytter modus er
// en wake-lock man ikke tør stole på.
//
// NEDTELLINGEN ER EFEMER MED VILJE. Den lagres ikke i localStorage: forgjengeren
// («Hold skjerm våken»-bryteren i Format-fanen, v10.1.24 → v6.6.4) var en
// PERSISTERT av/på-bryter, og prisen var at en glemt telefon holdt skjermen
// våken på ubestemt tid — derfor den røde batteri-advarselen som sto under den.
// En nedtelling som løper ut av seg selv trenger ingen advarsel, men bare hvis
// den faktisk starter på null hver økt. En time som gjenopptar seg selv etter en
// omlasting er nøyaktig den glemte telefonen igjen.
//
// Selve låsen er `useScreenWakeLock` (persist:false) — denne fila eier BARE
// nedtellingen og lar den composablen gjøre det den alltid har gjort:
// re-request ved fane-bytte, opprydding ved slipp.

import { ref, computed } from 'vue'
import { useScreenWakeLock } from './useScreenWakeLock.js'
import { klemMinutter, minutterIgjen, andelIgjen, MS_PER_MIN } from '../lib/holdVaken.js'

// Hvor ofte ringen tegnes om. Eieren ba om ett minutt; 15 s koster ingenting og
// gjør nedtellingen jevn framfor hakkete over en time. Tallet er KUN
// oppfriskning — `gjenstaarMs` regnes alltid av `frist − Date.now()`, så en
// bakgrunnsfane som får timeren strupet tar igjen det tapte ved neste tikk i
// stedet for å telle for lite.
const TIKK_MS = 15_000

const valgteMinutter = ref(0)
const gjenstaarMs = ref(0)

let laas = null
let frist = 0
let timer = null

function sikreLaas() {
  // Lat: modulen importeres av rene tester og av chat-verktøyene, og
  // useScreenWakeLock leser `navigator` ved opprettelse.
  if (!laas) laas = useScreenWakeLock({ persist: false, defaultOn: false, idleTimeoutMs: 0 })
  return laas
}

function stoppTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

function tikk() {
  gjenstaarMs.value = Math.max(0, frist - Date.now())
  if (gjenstaarMs.value <= 0) stopp()
}

function stopp() {
  stoppTimer()
  frist = 0
  gjenstaarMs.value = 0
  valgteMinutter.value = 0
  sikreLaas().setEnabled(false)
}

// Setter nedtellingen til `n` hele minutter. 0 (eller mindre) slår av.
// Et nytt tall STARTER PÅ NYTT — sliderens verdi er «hold våken i N minutter fra
// nå», ikke et tak som teller videre fra der forrige valg sto.
function settMinutter(n) {
  const m = klemMinutter(n)
  if (m <= 0) { stopp(); return 0 }
  valgteMinutter.value = m
  frist = Date.now() + m * MS_PER_MIN
  gjenstaarMs.value = m * MS_PER_MIN
  sikreLaas().setEnabled(true)
  stoppTimer()
  if (typeof setInterval !== 'undefined') timer = setInterval(tikk, TIKK_MS)
  return m
}

const aktiv = computed(() => gjenstaarMs.value > 0)
const igjenMinutter = computed(() => minutterIgjen(gjenstaarMs.value))
const andel = computed(() => andelIgjen(gjenstaarMs.value, valgteMinutter.value * MS_PER_MIN))
// Støttes ikke Wake Lock (Safari før 16.4, eldre Android-nettlesere), skjules
// hele raden: en slider som ikke kan gjøre noe er verre enn ingen slider.
const stottes = computed(() => sikreLaas().supported)

export function useHoldVaken() {
  return {
    valgteMinutter, gjenstaarMs, igjenMinutter, andel, aktiv, stottes,
    settMinutter, stopp,
    // Testkroker: nedtellingen er global, så en test som ikke rydder etter seg
    // lekker inn i neste.
    _tikk: tikk,
  }
}
