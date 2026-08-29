<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { hasAiToken } from '../lib/lendeAi.js'
import { useLendeChat } from '../composables/useLendeChat.js'
import FabCluster from './FabCluster.vue'

// Inngangen til Lende-chatten på innholdssidene (forsiden, kartvelgeren,
// tegnforklaringen, om). Rendrer ingenting uten invitasjonstoken — uinviterte
// ser ikke at funksjonen finnes. Her har ankeret ingen kart-knotter, så det ER
// chat-knappen: tap OG lang-trykk gir samme resultat, slik at gesten man lærer
// i kartvisningene aldri stopper i en blindgate.
//
// Fra v4.8.2 er dette en tynn wrapper rundt FabCluster, så knappen har samme
// størrelse (48 px) og samme anker nede til høyre overalt — den byttet før
// størrelse (56 → 48) og posisjoneringsmodell ved navigering.
//
// Ligger på z-[60]: under meny-backdrop (200) og modaler (210), så den dekkes
// naturlig når noe annet er åpent — ingen tilstands-wiring trengs.
//
// Rutene under får IKKE den globale knappen, av to ULIKE grunner. Skillet er
// verdt å holde, for grunnene tåler ulike endringer:
//
//   kart-vis, ruteplanlegger — har sin egen FabCluster nede til høyre, og
//     ankeret eier chatten der. Fjernes klyngen i en av dem, skal ruta ut av
//     lista igjen.
//   fritt-lende             — HAR INGEN CHAT I DET HELE TATT. Modusen er
//     bevisst funksjonsløs, og det står fast selv om knappen nede til høyre
//     skulle endre seg eller forsvinne. Ikke fjern denne fordi Fritt lende
//     «ikke har en klynge» — den er her fordi chatten ikke hører hjemme der.
const UTEN_GLOBAL_CHAT = ['kart-vis', 'ruteplanlegger', 'fritt-lende']

const { openChat } = useLendeChat()
const visible = hasAiToken()
const route = useRoute()

const show = computed(() => visible && !UTEN_GLOBAL_CHAT.includes(route.name))

const logoUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<template>
  <FabCluster v-if="show" positioning="fixed" chat-enabled :logo-url="logoUrl"
              @chat="openChat" />
</template>
