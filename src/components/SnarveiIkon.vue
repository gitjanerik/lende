<script setup>
// Ikonene til snarvei-raden, samlet ett sted (v6.6.0). De sto som sju
// innrykkede <svg>-blokker midt i MapView-malen; nå trengs de tre steder —
// raden, nedtrekket og sorterings-lista — og en kopi per sted er en kopi som
// kommer i utakt.
// `bue` er knott-geometrien for Strek og Relieff (v7.0.0): den blå/oransje
// ringen som viser NIVÅET, arvet fra Lende-knappens knotter. Den kommer inn
// utenfra fordi tallene bor i useKartKnotter — ikonet tegner, det regner ikke.
defineProps({
  id: { type: String, required: true },
  // { trackD, arcD, farge, strekBredde?, flateOpacity? }
  bue: { type: Object, default: null },
})
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon v-if="id === 'stifinner'" points="3 11 22 2 13 21 11 13 3 11"/>
    <template v-else-if="id === 'runde'">
      <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/>
    </template>
    <template v-else-if="id === 'maaling'">
      <circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>
      <line x1="6.4" y1="17.6" x2="17.6" y2="6.4" stroke-dasharray="2 2.5"/>
    </template>
    <template v-else-if="id === 'tre-d'">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/>
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>
    </template>
    <template v-else-if="id === 'annotering'">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>
    </template>
    <template v-else-if="id === 'sporing'">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      <circle cx="12" cy="12" r="8"/>
    </template>
    <!-- Nav-gruppen. Posisjonen er PIN-en fra de runde knappene (v6.5.70), med
         hullet som en ekte utstansing; kompassnåla roteres av kallstedet, så
         den må peke rett OPP i hvile.
         NORD ER RØDT OG SØR ER HVITT (v6.6.2), som på ethvert fysisk kompass —
         en fylt/åpen halvdel sier bare at nåla har en retning, ikke HVILKEN.
         Rødt er derfor bakt inn og arver ikke `currentColor`: knappen er hvit
         på grønt når posisjonen står på, og en nord-ende som følger med der
         ville mistet nettopp det den er til for. Nåla fyller nesten hele
         viewBoxen — den er den ene av de sju ikonene som bærer to farger, og
         under ~10 px blir waisten en strek. -->
    <template v-else-if="id === 'posisjon'">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </template>
    <template v-else-if="id === 'kompass'">
      <polygon points="12 1.4 17.2 12 12 9.4 6.8 12" fill="#ef4444" stroke="none"/>
      <polygon points="12 22.6 17.2 12 12 14.6 6.8 12" fill="currentColor" stroke="none"/>
    </template>
    <!-- De to eksterne (v6.6.5). Formene sier HVOR man havner og ikke hvem
         tjenesten er: en varde med T-merket er norsk merket løype, et brettet
         kart er kartet «der ute». Ingen logoer — de er andres varemerker, og
         de ville dessuten vært det eneste fargede i et sett med streker. -->
    <template v-else-if="id === 'utno'">
      <path d="M4 20h16"/><path d="M12 20V9"/>
      <path d="M12 4.5h6l2 2.2-2 2.3h-6z"/><path d="M12 4.5H6L4 6.7l2 2.3h6"/>
    </template>
    <template v-else-if="id === 'gmaps'">
      <path d="M9 4 3 6.2v13.6L9 17.6l6 2.2 6-2.2V4l-6 2.2z"/>
      <path d="M9 4v13.6M15 6.2v13.6"/>
    </template>
    <!-- ARVEN ETTER LENDE-KNAPPEN (v7.0.0). Buen er den samme 270°-gaugen
         knottene bar, og glyfen demonstrerer seg selv: streken tegnes i den
         tykkelsen som er valgt, og fjellets skygge i den opasiteten. Uten
         `bue` (sorterings-lista, som ikke kjenner kart-tilstanden) tegnes bare
         glyfen i nøytral form — en tom gauge ville løyet om et nivå på null. -->
    <template v-else-if="id === 'strek'">
      <template v-if="bue">
        <path :d="bue.trackD" stroke="currentColor" stroke-width="2" opacity="0.22"/>
        <path :d="bue.arcD" :stroke="bue.farge" stroke-width="2"/>
      </template>
      <line x1="7.5" y1="12" x2="16.5" y2="12" :stroke-width="bue?.strekBredde ?? 2"/>
    </template>
    <template v-else-if="id === 'relieff'">
      <template v-if="bue">
        <path :d="bue.trackD" stroke="currentColor" stroke-width="2" opacity="0.22"/>
        <path :d="bue.arcD" :stroke="bue.farge" stroke-width="2"/>
      </template>
      <path d="M6.5 15.5 L9.5 10 L11.8 12.8 L14.3 8.5 L17.5 15.5 Z"
            fill="currentColor" :fill-opacity="bue?.flateOpacity ?? 0.45"
            stroke-width="1"/>
    </template>
    <!-- Chatten (v7.0.0): en snakkeboble med tre prikker. Ingen Lende-logo —
         logoen var ANKERET, og et ikon som ser ut som appen selv sier «hjem»
         og ikke «spør». -->
    <template v-else-if="id === 'chat'">
      <path d="M20.5 12.2a8 8 0 0 1-8.5 7.9L4 21.5l1.4-3.6a8 8 0 1 1 15.1-5.7Z"/>
      <circle cx="8.6" cy="12" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="12.2" cy="12" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="15.8" cy="12" r="0.7" fill="currentColor" stroke="none"/>
    </template>
    <template v-else-if="id === 'innstillinger'">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.62.79 1.02 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </template>
    <template v-else-if="id === 'info'">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
      <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
    </template>
  </svg>
</template>
