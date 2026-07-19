<script setup>
// Gi kart nytt navn — liten bunn-ark-modal delt av forsiden (MapHomeView) og
// kart-visningen (MapView). Forelderen styrer synlighet via v-model:open og gir
// gjeldende navn inn; komponenten eier tekstfeltet og emitter `save` med det
// trimmede navnet. Auto-fokus + merking av teksten når arket åpnes, Enter =
// lagre, Escape = avbryt.
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  navn: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'save'])

const value = ref('')
const inputRef = ref(null)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    value.value = props.navn ?? ''
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  }
})

const canSave = () => value.value.trim().length > 0

function close() {
  emit('update:open', false)
}

function save() {
  const navn = value.value.trim().slice(0, 80)
  if (!navn) return
  emit('save', navn)
  close()
}
</script>

<template>
  <div v-if="open"
       class="absolute inset-0 z-[55] bg-black/60 backdrop-blur-sm flex items-end justify-center"
       @click.self="close">
    <div class="w-full max-w-[560px] bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="text-white text-sm font-semibold">Gi kart nytt navn</div>
        <button @click="close" aria-label="Lukk"
                class="w-8 h-8 rounded-full bg-white/5 border border-white/10
                       text-white/65 flex items-center justify-center active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <input ref="inputRef" v-model="value" type="text" maxlength="80"
             placeholder="Navn på kart"
             @keydown.enter.prevent="save"
             @keydown.esc.prevent="close"
             class="w-full px-3 py-3 rounded-xl bg-white/[0.06] border border-white/15
                    text-[15px] text-white placeholder-white/30 focus:outline-none
                    focus:bg-white/12 focus:border-emerald-300/50 transition" />

      <div class="mt-3 flex gap-2">
        <button @click="close"
                class="flex-1 px-3 py-2.5 rounded-lg border text-[13px] font-medium
                       bg-white/5 border-white/10 text-white/70 active:scale-[0.98] transition">
          Avbryt
        </button>
        <button @click="save" :disabled="!canSave()"
                class="flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold
                       bg-emerald-600 text-white active:scale-[0.98] transition
                       disabled:opacity-50 disabled:cursor-not-allowed">
          Lagre
        </button>
      </div>
    </div>
  </div>
</template>
