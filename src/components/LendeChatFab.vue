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
// naturlig når noe annet er åpent — ingen tilstands-wiring trengs. Begge
// kartvisningene har sin egen klynge (ankeret eier kart-knottene der), så den
// globale viker for `kart-vis` og `ruteplanlegger`.
const CLUSTER_ROUTES = ['kart-vis', 'ruteplanlegger']

const { openChat } = useLendeChat()
const visible = hasAiToken()
const route = useRoute()

const show = computed(() => visible && !CLUSTER_ROUTES.includes(route.name))

const logoUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<template>
  <FabCluster v-if="show" positioning="fixed" chat-enabled :logo-url="logoUrl"
              @chat="openChat" />
</template>
