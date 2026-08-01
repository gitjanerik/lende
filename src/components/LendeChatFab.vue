<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { hasAiToken } from '../lib/lendeAi.js'
import { useLendeChat } from '../composables/useLendeChat.js'

// Inngangen til Lende-chatten: en klassisk FAB nederst til høyre med
// app-logoen, alltid ett trykk unna. Rendrer ingenting uten invitasjonstoken
// — uinviterte ser ikke at funksjonen finnes.
//
// Global FAB montert i App.vue (forsiden, planleggeren, …). Ligger på
// z-[60]: under meny-backdrop (200) og modaler (210), så den dekkes
// naturlig når noe annet er åpent — ingen tilstands-wiring trengs.
// Kartvisningen har sin egen Lende-FAB (ankeret i FAB-klyngen, v4.3.1),
// så den globale viker for ruten `kart-vis`.

const { openChat } = useLendeChat()
const visible = hasAiToken()
const route = useRoute()

const show = computed(() => visible && route.name !== 'kart-vis')

const logoUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<template>
  <button v-if="show" @click="openChat" aria-label="Åpne Lende-chat"
          class="fixed z-[60] right-3 w-14 h-14 rounded-full overflow-hidden bg-overlay
                 shadow-xl ring-1 ring-ink/15 active:scale-95 transition shrink-0"
          :style="{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }">
    <img :src="logoUrl" alt="" class="w-full h-full" draggable="false" />
  </button>
</template>
