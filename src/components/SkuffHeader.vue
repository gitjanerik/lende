<script setup>
// ─────────────────────────────────────────────────────────────────────────────
// SkuffHeader — den delte headeren i bunn-arkene (v6.6.0).
//
// HVORFOR DEN FINNES: tekststørrelse-knappen virket ULIKT fra ark til ark.
// Punkt-arket zoomet etikett og tittel, innstillings-skuffen zoomet bare
// kroppen, og turark/målestasjon lot tittelen stå fast — så «A 200 %» gjorde
// tre forskjellige ting avhengig av hvilket ark man sto i. Regelen bor nå ETT
// sted, og den er den som allerede var riktig i punkt-arket:
//
//   ALT SOM ER INNHOLD ZOOMES — etiketten, tittelen, undertekstene og ikonene
//   som hører til dem. DE TO KONTROLLENE GJØR DET IKKE: A-knappen og X-en
//   beholder sine 32 px, fordi de er veien TILBAKE fra et valg som nettopp
//   gjorde alt større. En A-knapp som vokser med sin egen effekt er en knapp
//   man til slutt ikke finner.
//
// Kontrollraden ligger ØVERST og tittelen i FULL BREDDE under (v6.5.77/78) —
// ikke rør den rekkefølgen: knappene tok ~80–120 px av en 380 px header, og
// lange navn brakk i fire linjer mot en tom høyrekant.
// ─────────────────────────────────────────────────────────────────────────────
import TekstStorrelseKnapp from './TekstStorrelseKnapp.vue'

defineProps({
  // Liten versal-etikett i kontrollraden — «Punkt», «Måling», «Innstillinger».
  etikett: { type: String, default: '' },
  // Hovedtittelen under. Tom = ingen tittel-linje (etiketten bærer alt).
  tittel: { type: String, default: '' },
  lukkTekst: { type: String, default: 'Lukk' },
  uiTextScale: { type: Number, default: 1 },
})
defineEmits(['lukk'])
</script>

<template>
  <div class="shrink-0 px-4 pb-2.5 bg-surface/95 border-b border-ink/8">
    <div class="flex items-center justify-between gap-2">
      <!-- Etiketten er zoomet FOR SEG og ikke raden: en zoomet rad skalerer
           polstringen og dytter X-en ut av skjermen (v6.3.12). -->
      <div class="min-w-0 flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-4"
           :style="{ zoom: uiTextScale }">
        <slot name="merke" />
        <span class="min-w-0 truncate">{{ etikett }}</span>
      </div>
      <div class="shrink-0 flex items-center gap-1.5 -mr-1">
        <slot name="knapper" />
        <TekstStorrelseKnapp />
        <button type="button" @pointerdown.stop @click.stop="$emit('lukk')" :aria-label="lukkTekst"
                class="w-8 h-8 rounded-full flex items-center justify-center
                       bg-ink/5 border border-ink/10 text-ink-2 active:scale-90">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
               stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div v-if="tittel || $slots.under" class="min-w-0" :style="{ zoom: uiTextScale }">
      <div v-if="tittel" class="text-ink text-[15px] font-semibold leading-snug break-words">
        {{ tittel }}
      </div>
      <slot name="under" />
    </div>
  </div>
</template>
