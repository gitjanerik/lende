import { ref, computed, watch } from 'vue'

// HVOR EKSTERNE LENKER ÅPNES. Modulnivå-singleton som useUiTextScale og
// useMapTheme, slik at hovedmenyens bryter og hvert kallsted leser SAMME
// tilstand.
//
// GRUNNEN ER ET FELTFUNN, og den er verdt å kjenne fordi symptomet ser ut som
// en feil i Lende: åpner man ut.no fra infopanelet, blir nettleserens egen
// URL-stripe stående nede i venstre hjørne etterpå — tydeligst i Fritt lende,
// der det ellers ikke er noe chrome over kartet. Den stripa er nettleserens og
// ikke vår: en `_blank`-åpning fra en installert PWA legger seg i et minimalt
// nettleser-lag OPPÅ appen, og lager man den fra en `<a>` som forsvinner i det
// skuffa lukkes, har lenke-boblen ingen vert å bli tatt bort av igjen.
//
// DEFAULT ER AV, altså samme fane. Det er det som ikke etterlater noe: siden
// navigerer, og telefonens tilbake-knapp fører rett hjem til kartet, som ligger
// i service worker-cachen. Den som heller vil ha lenkene i et eget vindu —
// typisk på desktop, der en fane ved siden av er nettopp poenget — slår
// bryteren PÅ, og alt går tilbake til `_blank` med `noopener`.
//
// BRYTEREN GJELDER ALLE UTGÅENDE LENKER, ikke bare ut.no: kulturminnesok.no,
// NVEs stasjonssider, Naturbase-faktaark, Wikipedia og SNL i 3D-himmelen.
// Legger du til en ny utgående lenke, gå gjennom `eksternTarget` (for en `<a>`)
// eller `apneEkstern` (for et klikk) — ellers har brukeren en bryter som
// gjelder alt unntatt det nyeste.
const STORAGE_KEY = 'lende-ekstern-ny-fane'

function load() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

const nyFane = ref(load())

watch(nyFane, (v) => {
  try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0') } catch { /* ignorer */ }
})

export function useEksterneLenker() {
  // Bindes som `:target` på en `<a>`. `_self` og ikke fravær av attributtet:
  // en `<a>` uten target arver `<base>`, og appen setter en.
  const eksternTarget = computed(() => (nyFane.value ? '_blank' : '_self'))

  // BEGGE VEIENE GÅR GJENNOM `window.open`, og det er et bevisst valg framfor
  // `location.assign` for av-stillingen. `open(url, '_self')` navigerer samme
  // fane, altså nøyaktig det samme — men da finnes det ETT sted å avskjære en
  // utgående lenke i stedet for to. Røyktesten stubber nettopp `window.open`
  // for å lese hvilken URL «UT.no» ber om; med `location.assign` navigerte
  // siden i stedet, stubben forsvant med den, og sjekken målte ingenting.
  function apneEkstern(url) {
    if (typeof url !== 'string' || !url) return
    if (nyFane.value) window.open(url, '_blank', 'noopener')
    else window.open(url, '_self')
  }

  function settNyFane(på) { nyFane.value = !!på }

  return { nyFane, eksternTarget, apneEkstern, settNyFane }
}
