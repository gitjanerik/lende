import { ref, computed } from 'vue'

// Delt kartkontekst for hovedmenyen. Den aktive kartvisningen (MapView eller
// GravelPlannerView) registrerer en provider-funksjon som returnerer synlig
// kartsenter som { lat, lon, zoom } — hovedmenyens eksterne karttjeneste-panel
// (Google Maps, UT.no, Vegkart …) bruker den til å åpne tjenesten på samme
// sted. Modulnivå-singleton, som useAppMenu. Ingen provider = ikke inne i et
// kart → panelet skjules.

const providerRef = ref(null)

export function useMapContext() {
  function register(fn) { providerRef.value = fn }
  function unregister(fn) { if (providerRef.value === fn) providerRef.value = null }
  const hasMapContext = computed(() => !!providerRef.value)
  function getPoint() {
    try { return providerRef.value?.() ?? null } catch { return null }
  }
  return { register, unregister, hasMapContext, getPoint }
}
