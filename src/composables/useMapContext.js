import { ref, computed } from 'vue'

// Delt kartkontekst for hovedmenyen. Den aktive kartvisningen (MapView eller
// GravelPlannerView) registrerer en provider-funksjon som returnerer synlig
// kartsenter som { lat, lon, zoom } — hovedmenyens eksterne karttjeneste-panel
// (Google Maps, UT.no, Vegkart …) bruker den til å åpne tjenesten på samme
// sted. Modulnivå-singleton, som useAppMenu. Ingen provider = ikke inne i et
// kart → panelet skjules.

const providerRef = ref(null)
// Stedsnavnet for det åpne kartet, satt av kartvisningen. Hovedmenyens
// snarvei-blokk skriver «Åpne <sted> i» over chip-ene; tomt navn faller
// tilbake til «Åpne stedet i» (ruteplanleggeren har ikke ett stedsnavn).
const placeName = ref('')

export function useMapContext() {
  // Navnet settes ved registrering (ikke bare via setPlaceName) fordi Vue kan
  // montere den nye visningen FØR den gamle demonteres: registrerer
  // ruteplanleggeren seg mens kartvisningen ennå ikke har ryddet, ville
  // kartnavnet ellers hengt igjen over planleggerens snarvei-chips.
  function register(fn, name = '') {
    providerRef.value = fn
    placeName.value = (name ?? '').trim()
  }
  function unregister(fn) {
    if (providerRef.value === fn) {
      providerRef.value = null
      placeName.value = ''
    }
  }
  const hasMapContext = computed(() => !!providerRef.value)
  function getPoint() {
    try { return providerRef.value?.() ?? null } catch { return null }
  }
  function setPlaceName(name) { placeName.value = (name ?? '').trim() }
  return { register, unregister, hasMapContext, getPoint, placeName, setPlaceName }
}
