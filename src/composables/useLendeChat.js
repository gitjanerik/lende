import { ref } from 'vue'
import { streamChat } from '../lib/lendeAi.js'

// Global chat-tilstand (Fase 2 av KI-planen). Modul-skopet med vilje: modalen
// monteres én gang i App.vue, knappene bor i toppfeltene på forsiden, i
// kartvisningen og i planleggeren, og historikken skal overleve både
// lukking av modalen og navigasjon mellom visninger. Konteksten (hvilket kart
// brukeren ser på) settes av visningene via setChatContext og flettes inn i
// system-prompten ved hvert send — modellen svarer altså alltid om det du ser
// på nå, selv om samtalen startet et annet sted.

const chatOpen = ref(false)
const messages = ref([]) // { role: 'user'|'assistant', content: string }
const busy = ref(false)
const error = ref('')
const context = ref(null)

let abortCtrl = null

// Begrens historikken som sendes (ikke den som vises) så kontekst + samtale
// holder seg godt innenfor både modellens vindu og neurons-kvoten.
const MAX_SENDTE_MELDINGER = 16

function systemPrompt() {
  const deler = [
    'Du er Lende-assistenten i turkart-appen «Så i lende».',
    'Svar kort og konkret på norsk bokmål. Du kan svare på spørsmål om stedet og kartet brukeren ser på, terreng, turplanlegging og appens funksjoner.',
    'Du kan foreløpig ikke utføre handlinger i appen (bygge kart, planlegge ruter, endre visning). Ber brukeren om det: forklar vennlig at det kommer i en senere versjon, og pek til hovedmenyen — «Nytt turkart» for å lage kart, «Turplanlegger» for grusruter.',
  ]
  if (context.value) {
    deler.push(`Brukerens kontekst akkurat nå (JSON): ${JSON.stringify(context.value)}`)
  } else {
    deler.push('Brukeren står på forsiden av appen og har ikke noe kart åpent.')
  }
  return deler.join(' ')
}

function openChat() {
  error.value = ''
  chatOpen.value = true
}

function closeChat() {
  chatOpen.value = false
}

function setChatContext(ctx) {
  context.value = ctx
}

function nySamtale() {
  abortCtrl?.abort()
  messages.value = []
  error.value = ''
  busy.value = false
}

async function send(text) {
  const spm = text?.trim()
  if (!spm || busy.value) return
  error.value = ''
  busy.value = true
  messages.value.push({ role: 'user', content: spm })
  const svar = { role: 'assistant', content: '' }
  messages.value.push(svar)

  const historikk = messages.value
    .slice(0, -1)
    .slice(-MAX_SENDTE_MELDINGER)
    .map((m) => ({ role: m.role, content: m.content }))

  abortCtrl = new AbortController()
  try {
    await streamChat({
      messages: [{ role: 'system', content: systemPrompt() }, ...historikk],
      signal: abortCtrl.signal,
      onDelta: (delta) => {
        svar.content += delta
      },
    })
    if (!svar.content.trim()) {
      svar.content = '(Modellen ga et tomt svar — prøv å omformulere.)'
    }
  } catch (err) {
    // Fjern den tomme assistent-boblen ved feil; behold delvis svar ved abort.
    if (err?.name === 'AbortError') {
      if (!svar.content) messages.value.pop()
    } else {
      messages.value.pop()
      error.value = err?.message ?? 'Ukjent feil mot KI-tjenesten.'
    }
  } finally {
    busy.value = false
    abortCtrl = null
  }
}

function stopp() {
  abortCtrl?.abort()
}

export function useLendeChat() {
  return {
    chatOpen,
    messages,
    busy,
    error,
    openChat,
    closeChat,
    setChatContext,
    nySamtale,
    send,
    stopp,
  }
}
