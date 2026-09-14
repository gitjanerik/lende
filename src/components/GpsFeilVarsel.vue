<script setup>
// Gul varselboks for en GPS-feil, med en X som skjuler den.
//
// ÉN KOMPONENT FORDI DEN VISES TRE STEDER (v7.8.16): «Lag kart der jeg er» i
// «Mine kart», «Nytt turkart» i hovedmenyen og utsnitts-velgeren. De hadde hver
// sin kopi av den samme amber-boksen, og to av dem hadde ingen vei ut — boksen
// ble stående til man lukket hele panelet.
//
// TEKSTEN ER ETIKETTEN ALENE, OGSÅ I VELGEREN (v7.8.16). Den bar tidligere rådet
// med seg («Trykk på låsikonet i adressefeltet og sett Posisjon til «Tillat» —
// eller søk opp stedet i stedet.»), og tre linjer med nettleser-instruksjon er
// mer skjerm enn feilen er verdt: en avvist tillatelse er noe man har gjort
// selv, og den som vil ha den tilbake finner låsikonet uten at vi peker på det.
// Fram til v7.8.16 sto velgeren igjen med den lange varianten, med den
// begrunnelsen at boksen der har mer plass — men plass er ikke et argument for
// å bruke den, og to lengder på samme feil leses som to ulike feil.
//
// STØRRELSEN ER I `em` OG IKKE I PIKSLER, og det er hele forskjellen (v7.8.16).
// Boksen står i tre ulike skalerings-regimer: hovedmenyen setter en rot-font på
// `16px × tekstskalaen` og måler alt annet i `em`, mens AppModal legger `zoom`
// på kroppen. Med `text-[13px]` fulgte den bare det siste — i menyen sto den
// fast mens alt rundt vokste. `em` følger begge av seg selv, og kan ikke
// dobbelt-skalere slik en egen `zoom` her ville gjort inne i modalen.
defineProps({
  tekst: { type: String, required: true },
})
const emit = defineEmits(['lukk'])
</script>

<template>
  <div role="alert"
       class="px-3 py-2.5 rounded-lg bg-amber-500/[0.12] border border-amber-400/35
              text-amber-100 text-[0.82em] leading-snug flex items-center gap-2">
    <span class="flex-1 min-w-0">{{ tekst }}</span>
    <!-- X-en er 28 px og ikke 44: den står inne i en boks, ikke alene på et
         kart, og en knapp på størrelse med halve varselet leses som selve
         handlingen. Den er dessuten det ene som IKKE vokser med teksten —
         samme regel som A-knappen og lukkeknappen i hver ark-header: den er
         veien tilbake fra et valg som nettopp gjorde alt større. -->
    <button type="button" @click="emit('lukk')" aria-label="Skjul varselet"
            class="-mr-1 w-7 h-7 shrink-0 rounded-full flex items-center justify-center
                   text-amber-200/80 active:bg-amber-400/20 active:scale-95 transition">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  </div>
</template>
