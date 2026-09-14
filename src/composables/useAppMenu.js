import { ref } from 'vue'

// Global hovedmeny-tilstand. Modulnivå-ref (singleton) så meny-knappen i hver
// visning og selve AppMenu-panelet (montert én gang i App.vue) deler samme
// åpen/lukket-tilstand uten props eller provide/inject.

const menuOpen = ref(false)

// MENYENS «SIDER» KAN ÅPNES UTENFRA (v7.8.13). «Mine kart» og «Nytt turkart» er
// modaler AppMenu eier, og de har ingen egen rute — så et kallsted utenfor
// menyen hadde ingen vei dit. Det trengs når kart-visningen står igjen uten
// kart: meldinga der peker til nettopp de to, og et menyanker man må lete etter
// hamburgeren for ville vært en blindvei.
//
// EN REF OG IKKE ET KALL, fordi AppMenu er montert ÉN gang og skal eie sin egen
// tilstand: den watcher denne og kvitterer ut ønsket (`null`) når modalen er
// åpnet. Uten kvitteringen ville et nytt trykk på samme lenke ikke gitt noen
// endring å reagere på.
const onsketSheet = ref(null)

export function useAppMenu() {
  const open = () => { menuOpen.value = true }
  const close = () => { menuOpen.value = false }
  const toggle = () => { menuOpen.value = !menuOpen.value }
  // 'kart' | 'rute' | 'nytt' | 'om' — samme navn som AppMenus egne.
  const openMenuSheet = (navn) => { onsketSheet.value = navn }
  return { menuOpen, open, close, toggle, onsketSheet, openMenuSheet }
}
