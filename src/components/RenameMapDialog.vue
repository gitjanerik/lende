<script setup>
// Gi kart nytt navn — liten bunn-ark-modal delt av forsiden (MapHomeView) og
// kart-visningen (MapView). Forelderen styrer synlighet via v-model:open og gir
// gjeldende navn inn; komponenten eier tekstfeltet og emitter `save` med det
// trimmede navnet. Auto-fokus + merking av teksten når arket åpnes, Enter =
// lagre, Escape = avbryt.
//
// TEKSTSTØRRELSE (v7.8.1): arket følger hovedmenyens 100/125/150/200 som alle
// andre paneler, med samme knapp og samme regel som SkuffHeader håndhever —
// ALT SOM ER INNHOLD ZOOMES (tittel, tekstfelt, Avbryt/Lagre), mens A-knappen
// og X-en beholder sine 32 px. Dette er arket der man skriver, altså det ene
// stedet en for liten tekst koster mer enn et par piksler: navnet man retter er
// ofte langt og full av æ/ø/å.
//
// Zoomen ligger på tittelen og kroppen HVER FOR SEG og aldri på kontrollraden:
// en zoomet rad skalerer polstringen og dytter X-en ut av skjermen (v6.3.12).
import { ref, watch, nextTick } from 'vue'
import TekstStorrelseKnapp from './TekstStorrelseKnapp.vue'
import { useUiTextScale } from '../composables/useUiTextScale.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  navn: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'save'])

const { uiTextScale } = useUiTextScale()
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
    <div class="w-full max-w-[560px] bg-surface border-t border-ink/10 rounded-t-2xl p-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="min-w-0 text-ink text-sm font-semibold truncate"
             :style="{ zoom: uiTextScale }">Gi kart nytt navn</div>
        <div class="shrink-0 flex items-center gap-1.5 -mr-1">
          <TekstStorrelseKnapp />
          <button @click="close" aria-label="Lukk"
                  class="w-8 h-8 rounded-full bg-ink/5 border border-ink/10
                         text-ink-3 flex items-center justify-center active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div :style="{ zoom: uiTextScale }">
        <input ref="inputRef" v-model="value" type="text" maxlength="80"
               placeholder="Navn på kart"
               @keydown.enter.prevent="save"
               @keydown.esc.prevent="close"
               class="w-full px-3 py-3 rounded-xl bg-ink/[0.06] border border-ink/15
                      text-[15px] text-ink placeholder-ink/30
                      focus:bg-ink/12 focus:border-emerald-300/50 transition" />

        <div class="mt-3 flex gap-2">
          <button @click="close"
                  class="flex-1 px-3 py-2.5 rounded-lg border text-[13px] font-medium
                         bg-ink/5 border-ink/10 text-ink-2 active:scale-[0.98] transition">
            Avbryt
          </button>
          <button @click="save" :disabled="!canSave()"
                  class="flex-1 px-3 py-2.5 rounded-lg text-[13px] font-semibold
                         bg-emerald-700 text-white active:scale-[0.98] transition
                         disabled:opacity-50 disabled:cursor-not-allowed">
            Lagre
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
