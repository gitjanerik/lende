import { ref, computed, onScopeDispose } from 'vue'

// Én kilde til «er vi på nett?». Lå i tre kopier med MOTSATT FORTEGN fram til
// v6.5.0 — MapView init-et `navigator.onLine === false`, GravelPlannerView
// `!navigator.onLine` — og en migrasjon som snur et fortegn er en stille feil.
// Derfor eksponeres BEGGE retningene som computeds; ingen kaller trenger å
// negere selv.
//
// Merk hva flagget faktisk er verdt: `false` er en PÅLITELIG NEGATIV — sier
// nettleseren offline, så er du det. `true` beviser INGENTING: captive portal,
// wifi uten oppstrøm og én strek uten pakker rapporteres alle som online.
// Network Information API finnes ikke i Safari på iOS. Bruk derfor `erOffline`
// til å la være å starte noe dømt, aldri til å påstå at nettet virker.
export function useNettStatus() {
  const online = ref(navigator.onLine !== false)
  const oppdater = () => { online.value = navigator.onLine !== false }

  // Lytterne kobles STRAKS og ikke i onMounted: mellom setup og mount rakk det
  // gamle mønsteret å gå glipp av et tap, og onScopeDispose rydder både i en
  // komponent og i en frittstående effectScope — så composablen kan brukes
  // utenfor et komponent-tre og testes uten å montere noe.
  window.addEventListener('online', oppdater)
  window.addEventListener('offline', oppdater)
  onScopeDispose(() => {
    window.removeEventListener('online', oppdater)
    window.removeEventListener('offline', oppdater)
  })

  return {
    erPaaNett: computed(() => online.value),
    erOffline: computed(() => !online.value),
  }
}
