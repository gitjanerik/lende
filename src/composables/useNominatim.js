import { ref, watch } from 'vue'
import { searchPlaces, kvalifiserTvetydige, reverseGeocode } from '../lib/geocode.js'

// Stedssøk som fletter Kartverket SSR (norske stedsnavn) og OpenStreetMap
// Nominatim (adresser/POI). Gratis tjenester — vi debouncer og begrenser
// Nominatim til Norge. Selve søket + flettingen bor i lib/geocode.js (delt med
// MCP-serveren).
//
// Tvetydige treff i to trinn (v5.16.0): searchPlaces legger på den GRATIS
// kvalifikatoren (SSR-objekttype) med en gang, så lista vises like raskt som før.
// Reverse-oppslaget som skiller to åser med samme navn i samme kommune —
// «Vardåsen, Asker (Dikemark)» vs «(Røyken)» — koster nettverk, så det kjøres
// ETTER første visning og oppdaterer lista når det lander. Et nytt søkeord
// underveis kaster resultatet (samme token-vakt som abort-controlleren).

export function useNominatim({ debounceMs = 350, countryCode = 'no' } = {}) {
  const query = ref('')
  const results = ref([])
  const isSearching = ref(false)
  const error = ref(null)

  let timeout = null
  let abortController = null
  let token = 0

  const harDuplikater = (liste) => {
    const sett = new Set()
    for (const r of liste) {
      const k = (r.shortName || '').toLowerCase()
      if (sett.has(k)) return true
      sett.add(k)
    }
    return false
  }

  async function search(q) {
    if (!q || q.trim().length < 2) {
      results.value = []
      return
    }
    abortController?.abort()
    abortController = new AbortController()
    isSearching.value = true
    error.value = null

    const minToken = ++token
    try {
      const signal = abortController.signal
      results.value = await searchPlaces(q, { countryCode, signal })
      // Trinn 2: bare hvis noe FORTSATT er tvetydig etter gratis-runden.
      // Hvert oppslag oppdaterer lista straks det lander (onOppdatert), fordi
      // Nominatim-pausen gjør at hele runden tar et par sekunder — brukeren skal
      // se radene bli skilt én for én, ikke vente på alle.
      if (minToken === token && harDuplikater(results.value)) {
        await kvalifiserTvetydige(results.value, {
          reverse: (lat, lon) => reverseGeocode(lat, lon, { signal }),
          onOppdatert: (liste) => { if (minToken === token) results.value = liste },
        })
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        error.value = e.message ?? 'Søk feilet'
        results.value = []
      }
    } finally {
      isSearching.value = false
    }
  }

  watch(query, (q) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => search(q), debounceMs)
  })

  return { query, results, isSearching, error, search }
}
