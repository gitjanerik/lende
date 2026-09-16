<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { hasAiToken } from '../lib/lendeAi.js'
import { useLendeChat } from '../composables/useLendeChat.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
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
//   kart-vis               — chatten er en SNARVEI i raden over kartet
//     (v7.8.17, lib/snarveier.js). Fram til v7.8.16 var grunnen en egen
//     FabCluster nede til høyre; den knappen er borte, og hjørnet er
//     kompassnålas. Grunnen består altså, men den er en annen: en global FAB
//     her ville vært en ANDRE inngang til chatten, og den ville dessuten lagt
//     seg oppå nåla. Merk at porten er den samme i begge ender — snarveien
//     bærer `kunChat`, og `hasAiToken()` gater denne knappen.
//   ruteplanlegger         — har sin egen FabCluster nede til høyre, og
//     ankeret eier chatten der. Fjernes klyngen, skal ruta ut av lista igjen.
//
// `fritt-lende` sto her til v7.8.14 med en TREDJE grunn — modusen var bevisst
// funksjonsløs og skulle ikke ha chat i det hele tatt. Ruta er slettet, og med
// den den eneste oppføringen som ikke handlet om en FabCluster.
const UTEN_GLOBAL_CHAT = ['kart-vis', 'ruteplanlegger']

const { openChat } = useLendeChat()
// `overleggSkala`: knappen svever oppå innholdet, altså chrome — og i liggende
// har chromet et tak (se useUiTextScale.js). Sida under beholder brukerens
// egen skala.
const { overleggSkala } = useUiTextScale()
const visible = hasAiToken()
const route = useRoute()

const show = computed(() => visible && !UTEN_GLOBAL_CHAT.includes(route.name))

const logoUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<template>
  <FabCluster v-if="show" positioning="fixed" chat-enabled :logo-url="logoUrl"
              :ui-text-scale="overleggSkala" @chat="openChat" />
</template>
