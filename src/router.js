import { createRouter, createWebHistory } from 'vue-router'

// Kart-hjem er hele appens forside — eager import så forsiden rendrer uten
// ekstra chunk-rundtur. Alt annet lazy-lastes.
import MapHomeView from './views/MapHomeView.vue'

const routes = [
  { path: '/',               name: 'kart-hjem',      component: MapHomeView },
  { path: '/nytt',           name: 'kart-nytt',      component: () => import('./views/MapPickerView.vue') },
  { path: '/kart/:id',       name: 'kart-vis',       component: () => import('./views/MapView.vue') },
  { path: '/rute',           name: 'ruteplanlegger', component: () => import('./views/GravelPlannerView.vue') },
  { path: '/tegnforklaring', name: 'tegnforklaring', component: () => import('./views/LegendView.vue') },

  // Bakoverkompatible stier fra svg-insights-tiden — gamle bokmerker,
  // interne literal-pushes og delte lenker lander fortsatt riktig.
  { path: '/kart',           redirect: { name: 'kart-hjem' } },
  { path: '/kart/nytt',      redirect: to => ({ name: 'kart-nytt', query: to.query }) },
  { path: '/ruteplanlegger', redirect: to => ({ name: 'ruteplanlegger', query: to.query }) },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // Scroll til topp på hver navigasjon. Uten dette beholdt browser
  // scroll-posisjonen fra forrige rute — så når brukeren scrollet ned i
  // MapPickerView for å trykke «Lag turkart» og ble navigert til /kart/:id,
  // hadde body fortsatt scroll-offset. MapView er h-[100dvh] overflow-hidden,
  // men body-scrollen overstyrer det visuelt og brukeren ser tomt sort
  // område under kartet inntil de scroller opp.
  scrollBehavior(to, from, savedPosition) {
    // Tilbake-navigasjon via nettleser: bevar savedPosition så bruker
    // havner der de var i listen før de åpnet et kart.
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  },
})

export default router
