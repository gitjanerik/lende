<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import AppModal from './AppModal.vue'
import { useLendeChat } from '../composables/useLendeChat.js'
import { useSpeechInput } from '../composables/useSpeechInput.js'

// Selve chat-modalen (Fase 2). Monteres ÉN gang i App.vue og deler global
// tilstand via useLendeChat — historikken overlever lukking og navigasjon.
// Fase 2 er ren spørsmål/svar med kontekst fra visningen; verktøykjøring
// (bygg kart, planlegg rute) kommer i Fase 3 i samme flate.

const { chatOpen, messages, busy, busyLabel, error, closeChat, nySamtale, send, stopp } = useLendeChat()

const input = ref('')
const listRef = ref(null)
const inputRef = ref(null)

function onSend() {
  const text = input.value
  input.value = ''
  void send(text)
  nextTick(() => autoGrow())
}

// Auto-høyde på meldingsfeltet: 2 rader som utgangspunkt, vokser med
// innholdet opp til 4 rader (bunnraden er forankret nederst i modalen, så
// veksten skjer oppover). scrollHeight-trikset trenger height:auto først.
const MAKS_RADER = 4
function autoGrow() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  const stil = getComputedStyle(el)
  const maksH = parseFloat(stil.lineHeight) * MAKS_RADER
    + parseFloat(stil.paddingTop) + parseFloat(stil.paddingBottom)
  el.style.height = `${Math.min(el.scrollHeight, maksH)}px`
  el.style.overflowY = el.scrollHeight > maksH ? 'auto' : 'hidden'
}

// Taleinput — samme komposable og mønster som søkefeltene (MapSearchOverlay,
// MapPickerContent m.fl.): transkriptet legges i feltet, brukeren sender selv.
const { isSupported: micSupported, isListening: micListening, toggle: toggleMic } =
  useSpeechInput({ onResult: (t) => {
    input.value = t
    inputRef.value?.focus()
    nextTick(() => autoGrow())
  } })

// Autoscroll til bunnen mens svaret strømmer inn.
watch(
  () => messages.value.map((m) => m.content.length).join(','),
  async () => {
    await nextTick()
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  }
)

watch(chatOpen, async (open) => {
  if (!open) {
    if (micListening.value) toggleMic()
    return
  }
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  inputRef.value?.focus()
})

// Escape lukker chatten. AppModal overlater med vilje Escape til eieren
// (jf. AppMenu); chat-modalen åpnes fra toppfeltene, aldri oppå menyen,
// så en enkel global lytter er trygg her.
function onKeydown(e) {
  if (e.key === 'Escape' && chatOpen.value) closeChat()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <AppModal :open="chatOpen" title="Lende-chat" @close="closeChat">
    <template #header>
      <button v-if="messages.length" type="button" @click="nySamtale"
              class="px-3 h-9 rounded-full bg-ink/10 text-ink/80 text-[12px] font-medium
                     active:scale-95 transition shrink-0">
        Ny samtale
      </button>
    </template>

    <div class="flex flex-col h-full min-h-[50dvh]">
      <div ref="listRef" class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div v-if="!messages.length" class="text-ink/60 text-[14px] leading-relaxed">
          <p class="font-medium text-ink/80 mb-1.5">Hei! 👋</p>
          <p>
            Spør meg om stedet og kartet du ser på, terrenget eller turmuligheter —
            jeg vet hvilket kart du har åpent. Jeg kan også bygge nye kart, tegne
            turer og rundturer i kartet ditt, og vise dem i 3D om du vil.
          </p>
        </div>

        <div v-for="(m, i) in messages" :key="i"
             class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
          <div class="max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap"
               :class="m.role === 'user'
                 ? 'bg-ink/10 text-ink rounded-br-md'
                 : 'bg-ink/5 text-ink/90 rounded-bl-md'">
            <template v-if="busy && i === messages.length - 1 && m.role === 'assistant' && !m.content">
              <span class="italic text-ink/50 animate-pulse">{{ busyLabel || 'Tenker …' }}</span>
            </template>
            <template v-else>{{ m.content }}<span v-if="busy && i === messages.length - 1 && m.role === 'assistant'"
                                 class="chat-cursor" aria-hidden="true" /></template>
          </div>
        </div>

        <p v-if="error" class="text-[13px] text-red-600/90 px-1">{{ error }}</p>
      </div>

      <div class="shrink-0 border-t border-ink/10 px-3 py-2.5 flex items-end gap-2"
           :style="{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.625rem)' }">
        <textarea ref="inputRef" v-model="input" rows="2" enterkeyhint="send"
                  placeholder="Spør om kartet, stedet eller turen …"
                  @keydown.enter.exact.prevent="onSend"
                  @input="autoGrow"
                  class="flex-1 resize-none rounded-xl bg-ink/5 border border-ink/10 px-3 py-2
                         text-[14px] text-ink placeholder:text-ink/40 focus:outline-none
                         focus:border-ink/30" />
        <button v-if="micSupported && !busy" type="button" @click="toggleMic"
                :aria-label="micListening ? 'Stopp diktering' : 'Diktér melding (tale til tekst)'"
                :aria-pressed="micListening"
                :class="['w-10 h-10 rounded-full flex items-center justify-center transition',
                         'active:scale-95 shrink-0',
                         micListening ? 'bg-red-500/90 text-white animate-pulse' : 'bg-ink/10 text-ink/70']">
          <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <button v-if="busy" type="button" @click="stopp" aria-label="Stopp svaret"
                class="w-10 h-10 rounded-full bg-ink/10 text-ink/80 flex items-center justify-center
                       active:scale-95 transition shrink-0">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>
        <button v-else type="button" @click="onSend" :disabled="!input.trim()"
                aria-label="Send"
                class="w-10 h-10 rounded-full bg-ink text-app flex items-center justify-center
                       active:scale-95 transition shrink-0 disabled:opacity-30">
          <svg viewBox="0 0 24 24" class="w-4.5 h-4.5" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5"/>
            <path d="m5 12 7-7 7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.chat-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: currentColor;
  animation: chat-blink 1s steps(2) infinite;
}
@keyframes chat-blink {
  50% { opacity: 0; }
}
</style>
