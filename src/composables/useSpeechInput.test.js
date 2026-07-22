import { describe, it, expect, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useSpeechInput } from './useSpeechInput.js'

// Fanger opprettede recognition-instanser så testen kan simulere onresult/onend.
class MockRecognition {
  constructor() { MockRecognition.instances.push(this) }
  start() { this.started = true }
  stop() { this.stopped = true; this.onend?.() }
  emitResult(transcript) { this.onresult?.({ results: [[{ transcript }]] }) }
}
MockRecognition.instances = []

function withWindow(win, fn) {
  const prev = globalThis.window
  globalThis.window = win
  try { return fn() } finally { globalThis.window = prev }
}

afterEach(() => { MockRecognition.instances = [] })

describe('useSpeechInput', () => {
  it('isSupported=false uten Web Speech API', () => {
    withWindow({}, () => {
      const s = useSpeechInput()
      expect(s.isSupported.value).toBe(false)
      s.start() // no-op, skal ikke kaste
      expect(s.isListening.value).toBe(false)
    })
  })

  it('isSupported=true og start setter isListening + konfigurerer nb-NO', () => {
    withWindow({ SpeechRecognition: MockRecognition }, () => {
      const s = useSpeechInput()
      expect(s.isSupported.value).toBe(true)
      s.start()
      expect(s.isListening.value).toBe(true)
      const rec = MockRecognition.instances[0]
      expect(rec.lang).toBe('nb-NO')
      expect(rec.continuous).toBe(false)
      expect(rec.started).toBe(true)
    })
  })

  it('leverer transkript via onResult og stopper ved onend', () => {
    withWindow({ SpeechRecognition: MockRecognition }, () => {
      let got = null
      const s = useSpeechInput({ onResult: (t) => { got = t } })
      s.start()
      MockRecognition.instances[0].emitResult('  Sognsvann  ')
      expect(got).toBe('Sognsvann')
      MockRecognition.instances[0].onend()
      expect(s.isListening.value).toBe(false)
    })
  })

  it('toggle starter og stopper', () => {
    withWindow({ webkitSpeechRecognition: MockRecognition }, () => {
      const s = useSpeechInput()
      s.toggle()
      expect(s.isListening.value).toBe(true)
      s.toggle()
      expect(s.isListening.value).toBe(false)
      expect(MockRecognition.instances[0].stopped).toBe(true)
    })
  })

  it('onScopeDispose stopper aktiv gjenkjenning', () => {
    withWindow({ SpeechRecognition: MockRecognition }, () => {
      const scope = effectScope()
      let s
      scope.run(() => { s = useSpeechInput() })
      s.start()
      expect(s.isListening.value).toBe(true)
      scope.stop()
      expect(MockRecognition.instances[0].stopped).toBe(true)
      expect(s.isListening.value).toBe(false)
    })
  })
})
