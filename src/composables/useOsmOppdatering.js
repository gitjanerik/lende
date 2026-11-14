// Når OSM-dataene sist ble oppdatert, og når neste bake kjører — for
// hovedmenyen og «Om appen». Datoen kommer fra manifestet til flisene, så den
// følger med av seg selv når en ny bake er lastet opp. Siste kjente dato
// huskes i localStorage, så linja står også uten dekning.
//
// Singleton: menyen og Om-siden deler ett oppslag.

import { ref, computed } from 'vue'
import { hentOsmManifest } from '../lib/osmFlisFetcher.js'
import { nesteOsmBake } from '../lib/osmFlis.js'

const NOKKEL = 'lende-osm-tid'
const osmTid = ref(lesLagret())
let hentet = false

function lesLagret() {
  try { return localStorage.getItem(NOKKEL) } catch { return null }
}

function oppdater() {
  if (hentet) return
  hentet = true
  hentOsmManifest().then((m) => {
    const tid = m?.osmTid ?? m?.bakt
    if (!tid) return
    osmTid.value = tid
    try { localStorage.setItem(NOKKEL, tid) } catch { /* privat modus */ }
  }).catch(() => { hentet = false })
}

const DATO = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
const DATO_KL = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function useOsmOppdatering() {
  oppdater()
  const sistOppdatert = computed(() => {
    const d = osmTid.value ? new Date(osmTid.value) : null
    return d && !Number.isNaN(d.getTime()) ? DATO.format(d) : null
  })
  // «kl.» i stedet for Intl sitt komma: «1. desember 2026 kl. 03:23».
  const nesteKjoring = computed(() => DATO_KL.format(nesteOsmBake()).replace(/,? (\d{2}:\d{2})$/, ' kl. $1'))
  return { sistOppdatert, nesteKjoring }
}
