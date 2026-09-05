import { watch, onUnmounted } from 'vue'
import { FOKUSERBART, tabbbare, nesteFokus } from '../lib/fokusFelle.js'

/**
 * Holder Tab inne i et åpent lag, og gir fokus tilbake dit det kom fra.
 *
 * Regelen selv bor i `lib/fokusFelle.js`; her er bare lytteren og de to
 * DOM-tingene som ikke kan testes: hvem som HADDE fokus, og om et element er
 * synlig (offsetParent).
 *
 * @param elRef     ref til laget som skal holde fokus
 * @param aapenRef  getter som sier om laget er åpent
 * @param opts.forsteFokus  getter for elementet som skal ha fokus ved åpning.
 *                          Uten den tas første tabbbare.
 * @param opts.ogsaa        getter for kontroller som HØRER til laget men står
 *                          utenfor det i DOM-en. Hovedmenyens hamburger er
 *                          nettopp det: den bor i <body> og ER lukkeknappen, så
 *                          en felle uten den låser brukeren inne i en skuff
 *                          hun ikke kan lukke.
 */
export function useFokusFelle(elRef, aapenRef, opts = {}) {
  let forrigeFokus = null

  const synlig = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)

  function onKeydown(e) {
    if (e.key !== 'Tab') return
    const rot = elRef.value
    if (!rot) return
    const liste = tabbbare([...(opts.ogsaa?.() ?? []), ...rot.querySelectorAll(FOKUSERBART)], synlig)
    const maal = nesteFokus(liste, document.activeElement, e.shiftKey)
    if (!maal) return
    e.preventDefault()
    maal.focus({ preventScroll: true })
  }

  function girTilbake() {
    document.removeEventListener('keydown', onKeydown, true)
    // Gi fokus tilbake dit det kom fra. Uten dette lander det på <body>, og
    // neste Tab starter på toppen av sida — altså langt fra der man var.
    if (forrigeFokus?.isConnected) forrigeFokus.focus({ preventScroll: true })
    forrigeFokus = null
  }

  // `immediate` fordi et lag som MONTERES åpent (3D-visningen er `v-if`-et av
  // forelderen) aldri får en overgang å reagere på — uten den ville fella
  // gjeldt alle lag unntatt det mest heldekkende.
  watch(() => !!aapenRef(), (aapen) => {
    if (aapen) {
      forrigeFokus = document.activeElement
      document.addEventListener('keydown', onKeydown, true)
      // Fokus settes av kalleren når den har et bedre førstevalg enn «første
      // knapp» — en søkeboks, for eksempel.
      requestAnimationFrame(() => {
        const rot = elRef.value
        if (!rot || rot.contains(document.activeElement)) return
        const forste = opts.forsteFokus?.()
        if (forste) { forste.focus({ preventScroll: true }); return }
        tabbbare(rot.querySelectorAll(FOKUSERBART), synlig)[0]?.focus({ preventScroll: true })
      })
      return
    }
    girTilbake()
  }, { immediate: true })

  // Et lag som forsvinner med komponenten sin får ingen lukke-overgang, så
  // fokus må gis tilbake her også.
  onUnmounted(girTilbake)
}
