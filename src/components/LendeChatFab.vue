<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { hasAiToken } from '../lib/lendeAi.js'
import { useLendeChat } from '../composables/useLendeChat.js'

// Inngangen til Lende-chatten: en klassisk FAB nederst til høyre med
// app-logoen, alltid ett trykk unna. Rendrer ingenting uten invitasjonstoken
// — uinviterte ser ikke at funksjonen finnes.
//
// To moduser:
//  • 'fixed'  — global FAB montert i App.vue (forsiden, planleggeren, …).
//    Ligger på z-[60]: under meny-backdrop (200) og modaler (210), så den
//    dekkes naturlig når noe annet er åpent — ingen tilstands-wiring trengs.
//  • 'inline' — kartvisningen, der knott-kolonnen (sentrer/strek/relieff)
//    allerede eier hjørnet nederst til høyre og flytter seg med paneler og
//    skuffer. Chat-FAB-en monteres som nederste knott i samme kolonne og
//    arver alle transisjonene gratis; den globale FAB-en viker for ruten.

const props = defineProps({
  mode: { type: String, default: 'fixed' },
})

const { openChat } = useLendeChat()
const visible = hasAiToken()
const route = useRoute()

const show = computed(
  () => visible && (props.mode === 'inline' || route.name !== 'kart-vis')
)

const logoUrl = `${import.meta.env.BASE_URL}icon.svg`
</script>

<template>
  <button v-if="show" @click="openChat" aria-label="Åpne Lende-chat"
          class="rounded-full overflow-hidden bg-overlay shadow-lg ring-1 ring-ink/15
                 active:scale-95 transition shrink-0"
          :class="mode === 'fixed' ? 'fixed z-[60] right-3 w-14 h-14 shadow-xl' : 'w-12 h-12'"
          :style="mode === 'fixed'
            ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }
            : null">
    <img :src="logoUrl" alt="" class="w-full h-full" draggable="false" />
  </button>
</template>
