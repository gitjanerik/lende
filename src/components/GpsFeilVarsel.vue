<script setup>
// Gul varselboks for en GPS-feil, med en X som skjuler den.
//
// ÉN KOMPONENT FORDI DEN VISES TO STEDER (v7.8.14): «Lag kart der jeg er» i
// «Mine kart» og «Nytt turkart» i hovedmenyen. De to sto med hver sin kopi av
// den samme amber-boksen, og en av dem hadde ingen vei ut — boksen ble stående
// til man lukket hele panelet.
//
// TEKSTEN ER KORTET NED TIL ETIKETTEN ALENE. Den bar tidligere rådet med seg
// («Trykk på låsikonet i adressefeltet og sett Posisjon til «Tillat» — eller søk
// opp stedet i stedet.»), og tre linjer med nettleser-instruksjon over lista er
// mer skjerm enn feilen er verdt: en avvist tillatelse er noe man har gjort
// selv, og den som vil ha den tilbake finner låsikonet uten at vi peker på det.
// Rådet lever videre i `lib/gpsFeil.js` for utsnitts-velgeren, der boksen står
// alene på en tom flate og har plassen.
defineProps({
  tekst: { type: String, required: true },
})
const emit = defineEmits(['lukk'])
</script>

<template>
  <div role="alert"
       class="px-3 py-2.5 rounded-lg bg-amber-500/[0.12] border border-amber-400/35
              text-amber-100 text-[13px] leading-snug flex items-start gap-2">
    <span class="flex-1 min-w-0">{{ tekst }}</span>
    <!-- X-en er 28 px og ikke 44: den står inne i en boks, ikke alene på et
         kart, og en knapp på størrelse med halve varselet leses som selve
         handlingen. -->
    <button type="button" @click="emit('lukk')" aria-label="Skjul varselet"
            class="-mr-1 -mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center
                   text-amber-200/80 active:bg-amber-400/20 active:scale-95 transition">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  </div>
</template>
