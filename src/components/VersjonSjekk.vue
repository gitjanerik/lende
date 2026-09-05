<script setup>
// Versjonslinja med en «Se etter oppdatering»-knapp (v6.5.50).
//
// HVORFOR DEN FINNES: `checkForUpdateNow()` i `lib/swUpdate.js` ble skrevet for
// nettopp denne knappen, men knappen ble igjen i svg-insights da Lende ble
// skilt ut — funksjonen sto med NULL kallere, og appen hadde ingen manuell vei
// til en ny versjon i det hele tatt. Den automatiske stien i `main.js` går nå
// gjennom samme funksjon, men den sjekker bare når appen foregrunnes eller en
// gang i timen; står man og lurer på om det er kommet noe nytt, skal man kunne
// spørre.
//
// ÉN KOMPONENT, TO KALLSTEDER (hovedmenyen og Om-siden). De to versjonslinjene
// er samme opplysning på to skjermer, og en knapp bare det ene stedet er en
// knapp halve appen ikke vet om. Stilen ARVER farge og skriftstørrelse
// (`inherit`) fordi de to stedene har hver sin — menyens `--am-dim` og
// Om-sidens `text-ink-4` — og en komponent som satte sin egen ville stukket seg
// ut nøyaktig ett av stedene.
import { ref } from 'vue'
import { APP_VERSION } from '../version.js'
import { checkForUpdateNow, applyUpdate } from '../lib/swUpdate.js'

// null = ikke spurt, 'sjekker', ellers utfallet fra checkForUpdateNow().
const status = ref(null)

const TEKST = {
  sjekker: 'Ser etter ny versjon …',
  'update-ready': 'Ny versjon er klar.',
  'up-to-date': 'Du har nyeste versjon.',
  // Ingen SW: utviklingsserver, ren http eller en iframe. Å si «du har nyeste»
  // ville vært en påstand vi ikke har dekning for.
  unsupported: 'Kan ikke sjekke her.',
  feil: 'Fikk ikke kontakt. Prøv igjen.',
}

async function sjekk() {
  if (status.value === 'sjekker') return
  status.value = 'sjekker'
  try {
    status.value = await checkForUpdateNow()
  } catch {
    status.value = 'feil'
  }
}
</script>

<template>
  <div class="vs">
    <div class="vs-rad">
      <span>Versjon {{ APP_VERSION }}</span>
      <button type="button" class="vs-knapp" @click="sjekk"
              :disabled="status === 'sjekker'">
        Se etter oppdatering
      </button>
    </div>
    <!-- `aria-live`: utfallet kommer etter et nettkall, altså uten at fokus
         flytter seg, og en skjermleser ville ellers aldri fått vite hva som
         skjedde. Beholderen står ALLTID i DOM-en — et felt som først opprettes
         når svaret kommer, blir ikke lest opp. -->
    <p class="vs-status" aria-live="polite">
      <template v-if="status">{{ TEKST[status] ?? TEKST.feil }}</template>
    </p>
    <!-- EGEN «Oppdater nå» HER, selv om App.vue alt viser et banner når
         `update-ready` setter `updateAvailable`: banneret ligger på z-100 og
         hovedmenyen på z-201, så et treff funnet FRA menyen ville svart med en
         knapp bak menyen man står i. -->
    <button v-if="status === 'update-ready'" type="button" class="vs-oppdater"
            @click="applyUpdate()">
      Oppdater nå
    </button>
  </div>
</template>

<style scoped>
/* INGEN polstring her: begge kallstedene har sin egen (`.am-version`,
   `pt-1`), og en scoped regel på komponentens rot ville kjempet med dem om
   samme egenskap med lik spesifisitet — altså avgjort av rekkefølgen i
   bunten. */
.vs-rad {
  display: flex; flex-wrap: wrap; align-items: baseline;
  gap: 4px 10px; font-size: inherit; color: inherit;
}
/* Knappen er tekst og arver fargen, men understrekes så den leses som noe man
   kan trykke på. Polstringa gir den ≥24 px trefflate (WCAG 2.5.8) uten å bli en
   klump i en linje som ellers er ren opplysning. */
.vs-knapp {
  font: inherit; color: inherit; background: none; border: 0;
  padding: 4px 0; text-decoration: underline; text-underline-offset: 2px;
  cursor: pointer; min-height: 24px;
}
.vs-knapp:disabled { opacity: 0.6; cursor: default; text-decoration: none; }
.vs-status { font-size: inherit; color: inherit; opacity: 0.85; }
.vs-oppdater {
  margin-top: 6px; font: inherit; font-weight: 600;
  color: #fff;
  background: #15803d;   /* green-700 — samme knapp som banneret i App.vue */
  border: 0; border-radius: 999px; padding: 6px 14px;
  min-height: 32px; cursor: pointer;
}
.vs-oppdater:active { transform: scale(0.97); }
</style>
