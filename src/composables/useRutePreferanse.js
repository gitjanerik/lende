import { computed, ref, watch } from 'vue'
import {
  DEFAULT_RUTE_PREF, UNDERLAG, SLAKK_MAKS_M, SLAKK_MIN_M, SLAKK_STEG_M,
  normaliserRutePref, kostnadsFaktorer, prefNokkel, prefTekst, erNoytral,
} from '../lib/rutePreferanse.js'

// UNDERLAGS-PREFERANSEN for Stifinneren og Runde (v7.8.38).
//
// Modulnivå-singleton, samme mønster som useKompassNord og useEksterneLenker:
// Preferanser-fana, Stifinneren, Lende-chatten og 3D leser og skriver SAMME
// tilstand uten en prop-kjede gjennom MapView. Den regelen er ikke kosmetikk
// her — chatten svarer på «finn en sykkelrute» og Stifinneren tegner den, og
// to kopier av valget ville betydd at de to kunne svare ulikt på samme kart.
//
// TRE NØKLER OG IKKE ÉN JSON-BLOKK. Et lagret objekt må parses, og en halvt
// skrevet blokk fra en kvote-feil gir et kast i det appen starter — mens tre
// selvstendige nøkler hver for seg faller til standarden sin. Hver skrives
// dessuten bare når den IKKE er standard (samme begrunnelse som
// `lende-kompass-nord-zoom`): en nøkkel som ikke finnes er lettere å lese som
// «standard» i en feilsøking på en telefon enn en lagret `'sti'`.
export const NOKLER = Object.freeze({
  underlag: 'lende-rute-underlag',
  krav: 'lende-rute-krav',
  slakk: 'lende-rute-slakk',
})

function les(nokkel) {
  try { return localStorage.getItem(nokkel) } catch { return null }
}

function skriv(nokkel, verdi) {
  try {
    if (verdi == null) localStorage.removeItem(nokkel)
    else localStorage.setItem(nokkel, verdi)
  } catch { /* privat modus / kvote */ }
}

const underlag = ref(les(NOKLER.underlag) === UNDERLAG.VEG ? UNDERLAG.VEG : UNDERLAG.STI)
const krav = ref(les(NOKLER.krav) === '1')
const slakkM = ref(normaliserRutePref({ slakkM: Number(les(NOKLER.slakk)) }).slakkM)

watch(underlag, (v) => skriv(NOKLER.underlag, v === UNDERLAG.VEG ? UNDERLAG.VEG : null))
watch(krav, (v) => skriv(NOKLER.krav, v ? '1' : null))
watch(slakkM, (v) => skriv(NOKLER.slakk, v === DEFAULT_RUTE_PREF.slakkM ? null : String(v)))

// ÉN normalisert verdi ut, og alt annet avledes av den. Kallstedene skal aldri
// sette de tre refene sammen selv — da er normaliseringen deres ansvar.
const pref = computed(() => normaliserRutePref({
  underlag: underlag.value, krav: krav.value, slakkM: slakkM.value,
}))

export function useRutePreferanse() {
  return {
    // Tilstand (skrivbar der fana trenger v-model).
    underlag, krav, slakkM,
    // Avledet.
    pref,
    kostnad: computed(() => kostnadsFaktorer(pref.value)),
    nokkel: computed(() => prefNokkel(pref.value)),
    tekst: computed(() => prefTekst(pref.value)),
    noytral: computed(() => erNoytral(pref.value)),
    // Konstanter fana trenger for slideren.
    UNDERLAG, SLAKK_MIN_M, SLAKK_MAKS_M, SLAKK_STEG_M,
    NOKLER,
  }
}
