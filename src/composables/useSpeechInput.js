import { ref, onScopeDispose } from 'vue'

// Tale-til-tekst via Web Speech API (SpeechRecognition). All gjenkjenning skjer
// i nettleseren — ingen ekstern tjeneste, ingen opplasting av lyd. Android
// Chrome støtter norsk (nb-NO); iOS Safari / standalone-PWA er upålitelig, så vi
// feature-detecter og lar UI skjule mikrofon-knappen når isSupported=false
// (samme graceful mønster som supportsGeolocation).
//
// onResult kalles med det ferdige transkriptet (vi bruker ikke interim-
// resultater — søkefeltet skal ikke flimre mens du snakker). Én ytring pr
// trykk (continuous=false); recognition stopper selv etter en pause.

export function useSpeechInput({ lang = 'nb-NO', onResult } = {}) {
  const Ctor = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null
  const isSupported = ref(!!Ctor)
  const isListening = ref(false)
  const error = ref(null)
  let recognition = null

  function stop() {
    if (recognition) {
      try { recognition.stop() } catch { /* allerede stoppet */ }
    }
    isListening.value = false
  }

  function start() {
    if (!Ctor || isListening.value) return
    error.value = null
    recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results ?? [])
        .map(r => r[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (transcript) onResult?.(transcript)
    }
    recognition.onerror = (e) => {
      // «no-speech»/«aborted» er normale avslutninger, ikke reelle feil.
      const kind = e?.error ?? 'feil'
      error.value = kind === 'no-speech' || kind === 'aborted' ? null : kind
      isListening.value = false
    }
    recognition.onend = () => { isListening.value = false }
    try {
      recognition.start()
      isListening.value = true
    } catch {
      isListening.value = false
    }
  }

  function toggle() {
    if (isListening.value) stop()
    else start()
  }

  onScopeDispose(stop)

  return { isSupported, isListening, error, start, stop, toggle }
}
