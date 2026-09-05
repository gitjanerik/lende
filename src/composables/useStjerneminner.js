// Stjernemerkede kulturminner på ETT turkart: lagringen, og ringen som viser
// dem i kartet.
//
// Reglene (nøkkel, veksling, telling, farge) bor i lib/stjerneminner.js og er
// rene. Det som er her er de to tingene som ikke kan være rene: IndexedDB og
// SVG-DOM-en.
import { ref, computed } from 'vue'
import { updateMap } from '../lib/mapStorage.js'
import {
  KILDE_BRUKER, KILDE_FREDET,
  minneNokkel, harStjerne, veksleStjerne, stjerneAntall, stjerneRingFarge,
} from '../lib/stjerneminner.js'

const NS = 'http://www.w3.org/2000/svg'
// Ringen er 8 mm mot ikonets 3,2–3,6 mm: den skal leses som en markering RUNDT
// symbolet og ikke som en del av det, og pulsen vokser utover herfra.
const RING_MM = 8

export function useStjerneminner({ svgHostRef, mapId, isDark }) {
  const stjerner = ref([])
  const antall = computed(() => stjerneAntall(stjerner.value))

  const kartId = () => (typeof mapId === 'function' ? mapId() : mapId?.value ?? mapId)
  // Vardåsen og de andre innebygde kartene har ingen record i IndexedDB, så en
  // stjerne der ville forsvunnet ved neste last uten at noe sa fra. Da er det
  // ærligere å ikke tilby den.
  const kanLagre = computed(() => {
    const id = kartId()
    return !!id && !id.startsWith('vardasen')
  })

  function load(preloaded) {
    stjerner.value = Array.isArray(preloaded?.stjerneminner) ? [...preloaded.stjerneminner] : []
  }

  function erStjernet(nokkel) {
    return harStjerne(stjerner.value, nokkel)
  }

  async function veksle(nokkel) {
    if (!nokkel || !kanLagre.value) return
    // Skriv til skjermen FØR disken: ringen er svaret på trykket, og en
    // IndexedDB-transaksjon er raskere enn et øye, men ikke garantert.
    stjerner.value = veksleStjerne(stjerner.value, nokkel)
    merkAlle()
    try {
      await updateMap(kartId(), { stjerneminner: [...stjerner.value] })
    } catch (e) {
      console.warn('[stjerneminne] kunne ikke lagre:', e?.message ?? e)
    }
  }

  function ensureRingDef(svg) {
    if (svg.querySelector('#stjerne-ring-sym')) return
    let defs = svg.querySelector('defs')
    if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild) }
    const sym = document.createElementNS(NS, 'symbol')
    sym.setAttribute('id', 'stjerne-ring-sym')
    sym.setAttribute('viewBox', '-1 -1 2 2')
    const c = document.createElementNS(NS, 'circle')
    c.setAttribute('cx', '0'); c.setAttribute('cy', '0'); c.setAttribute('r', '0.86')
    c.setAttribute('fill', 'none')
    c.setAttribute('stroke', 'currentColor')
    c.setAttribute('stroke-width', '0.13')
    sym.appendChild(c)
    defs.appendChild(sym)
  }

  function byggRing() {
    // Tre lag, samme oppskrift som trykk-ringen på himmelen (v6.2.0): ett svakt
    // FAST omriss så det alltid er noe å se når pulsene er på sitt svakeste,
    // pluss to pulser et halvt omløp i utakt. Bevegelse er det øyet finner selv
    // på et tett kart.
    //
    // Pulsen skaleres på en NESTET <g> og ikke på <use>: en gruppe uten egen
    // transform har origo i markørens eget (0,0), altså midt i symbolet, så
    // `scale()` vokser fra sentrum uten `transform-box`.
    const ring = document.createElementNS(NS, 'g')
    ring.setAttribute('class', 'stjerne-ring')
    ring.setAttribute('aria-hidden', 'true')
    // Ringen er en trykkflate-fri dekorasjon: uten dette stjeler den 8 mm
    // treff fra stien og nabomarkørene under seg.
    ring.style.pointerEvents = 'none'
    const halv = RING_MM / 2
    const lagUse = () => {
      const u = document.createElementNS(NS, 'use')
      u.setAttribute('href', '#stjerne-ring-sym')
      u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#stjerne-ring-sym')
      u.setAttribute('x', `-${halv}mm`); u.setAttribute('y', `-${halv}mm`)
      u.setAttribute('width', `${RING_MM}mm`); u.setAttribute('height', `${RING_MM}mm`)
      return u
    }
    const fast = lagUse()
    fast.setAttribute('class', 'stjerne-ring-fast')
    ring.appendChild(fast)
    for (const n of [1, 2]) {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('class', `stjerne-puls stjerne-puls-${n}`)
      g.appendChild(lagUse())
      ring.appendChild(g)
    }
    return ring
  }

  /**
   * Synk ringene i kart-SVG-en med lista. Kalles etter kart-last, etter at et
   * kulturminne-lag er bygget (de kommer asynkront, lenge etter lasten) og ved
   * temabytte.
   */
  function merkAlle() {
    const svg = svgHostRef.value?.querySelector('svg')
    if (!svg) return
    const farge = stjerneRingFarge(!!(isDark?.value ?? isDark))
    for (const [velger, kilde] of [
      ['[data-kulturminne-id]', KILDE_BRUKER],
      ['[data-fredet-id]', KILDE_FREDET],
    ]) {
      for (const el of svg.querySelectorAll(velger)) {
        const nokkel = minneNokkel(kilde, el.getAttribute(velger.slice(1, -1)))
        const paa = harStjerne(stjerner.value, nokkel)
        const finnes = el.querySelector(':scope > .stjerne-ring')
        if (!paa) { finnes?.remove(); continue }
        if (!finnes) {
          ensureRingDef(svg)
          // Ringen legges FØRST i markøren, altså under symbolet: et omriss
          // oppå diamanten ville skjult prikken som skiller de fem kategoriene.
          el.insertBefore(byggRing(), el.firstChild)
        }
        el.querySelector(':scope > .stjerne-ring').style.color = farge
      }
    }
  }

  return { stjerner, antall, kanLagre, load, erStjernet, veksle, merkAlle }
}
