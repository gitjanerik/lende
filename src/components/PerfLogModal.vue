<script setup>
// Perf-logg-modal (byggetider), skilt ut fra MapView v1.0.5. Brukeren på mobil
// kan ikke lese konsollen, så localStorage-loggen vises her med kopier-knapp.
// Kun utvikler-flate (åpnes fra Utvikler-fanen). Selvstendig: eier hele
// perf-logg-konseptet; forelderen styrer bare synlighet via v-model:open.
import { ref, watch } from 'vue'
import { getPerfLog, clearPerfLog } from '../lib/perfLog.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const entries = ref([])
const copied = ref(false)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    entries.value = getPerfLog().slice().reverse()  // nyeste øverst
    copied.value = false
  }
})

function perfLogText() {
  return getPerfLog()
    .map((e) => `${new Date(e.t).toLocaleString('no-NO')}  ${e.msg}`)
    .join('\n')
}

async function copy() {
  const text = perfLogText()
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard-API utilgjengelig (eldre WebView) — vis råtekst for manuell kopiering.
    window.prompt('Kopier perf-loggen:', text)
  }
}

function clear() {
  clearPerfLog()
  entries.value = []
}
</script>

<template>
  <div v-if="open"
       class="absolute inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-end justify-center"
       @click.self="emit('update:open', false)">
    <div class="w-full max-w-[560px] bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4 max-h-[75dvh] flex flex-col">
      <div class="flex items-center justify-between mb-3">
        <div class="text-white text-sm font-semibold">Byggetider (perf-logg)</div>
        <button @click="emit('update:open', false)" aria-label="Lukk"
                class="w-8 h-8 rounded-full bg-white/5 border border-white/10
                       text-white/65 flex items-center justify-center active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="flex gap-2 mb-3">
        <button @click="copy"
                class="flex-1 px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]"
                :class="copied
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/80'">
          {{ copied ? 'Kopiert ✓' : 'Kopier alt' }}
        </button>
        <button @click="clear"
                class="px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]
                       bg-white/5 border-white/10 text-white/60">
          Tøm
        </button>
      </div>

      <div v-if="!entries.length" class="text-[12px] text-white/50 py-6 text-center">
        Ingen byggetider ennå. Lag et nytt kart (auto-kart eller «lag her»), så dukker tallene opp her.
      </div>
      <div v-else class="overflow-y-auto -mx-1 px-1">
        <div v-for="(e, i) in entries" :key="i"
             class="mb-2 rounded-lg bg-zinc-950/70 border border-white/5 px-2.5 py-2">
          <div class="text-[9px] text-white/40 tabular-nums mb-0.5">
            {{ new Date(e.t).toLocaleString('no-NO') }}
          </div>
          <div class="text-[11px] text-emerald-200/90 font-mono break-all leading-snug">{{ e.msg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
