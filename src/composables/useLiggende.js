import { ref, computed, watch } from 'vue'

// LIGGENDE FORMAT HAR ÉN DEFINISJON, OG DEN BOR I JS (v7.8.31).
//
// Regelen er `(orientation: landscape) and (max-height: 600px)`, og det er
// HØYDEN som bærer den: en telefon i liggende er ~411 CSS-px høy, og det er
// der et bunn-ark på 45 dvh legger seg over nesten hele kartet mens
// snarvei-raden bryter til fire linjer. En stor skjerm er også «landscape»
// nesten alltid, men har ingen av problemene — derfor taket.
//
// Kilden er `matchMedia` og ikke en `@media`-regel i CSS, fordi BÅDE JS og CSS
// trenger svaret: skuffene skrur av snap-punktene sine, snarvei-raden måler
// om igjen, og hovedmenyen skjuler meta-linjer. To kopier av den samme
// spørringen er to steder å glemme når terskelen endres, så CSS gater på
// `:root[data-liggende]`, som settes herfra.
export const LIGGENDE_MQ = '(orientation: landscape) and (max-height: 600px)'

const liggende = ref(false)

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia(LIGGENDE_MQ)
  liggende.value = mq.matches
  const oppdater = (e) => { liggende.value = e.matches }
  // addEventListener finnes ikke på eldre MediaQueryList (Safari < 14).
  if (mq.addEventListener) mq.addEventListener('change', oppdater)
  else mq.addListener(oppdater)
}

if (typeof document !== 'undefined') {
  const speil = (v) => {
    const rot = document.documentElement
    if (v) rot.dataset.liggende = ''
    else delete rot.dataset.liggende
  }
  speil(liggende.value)
  watch(liggende, speil)
}

export function useLiggende() {
  return { erLiggende: computed(() => liggende.value) }
}

// Bare for test: la en sjekk styre flagget uten en ekte skjermrotasjon.
export function _settLiggende(v) { liggende.value = !!v }
