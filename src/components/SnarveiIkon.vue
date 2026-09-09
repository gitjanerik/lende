<script setup>
// Ikonene til snarvei-raden, samlet ett sted (v6.6.0). De sto som sju
// innrykkede <svg>-blokker midt i MapView-malen; nå trengs de tre steder —
// raden, nedtrekket og sorterings-lista — og en kopi per sted er en kopi som
// kommer i utakt.
defineProps({ id: { type: String, required: true } })
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
    <template v-else-if="id === 'info'">
      <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
      <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
    </template>
  </svg>
</template>
