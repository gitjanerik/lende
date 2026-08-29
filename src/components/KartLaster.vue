<script setup>
// Animert «landmåler»-ikon: topo-konturer tegnes inn mens en gul sveipelinje
// roterer over kartet. Ren SMIL — ingen CSS-keyframes, ingen JS.
//
// Trukket ut av MapModeChips i v6.5.1 fordi Fritt lende skal ha nøyaktig den
// samme, og en andre kopi ville drevet fra originalen. Markupen er flyttet
// ordrett; endres den her, endres den begge steder — det er hensikten.
defineProps({
  // Tailwind-størrelse. Fritt lendes chip er lavere enn turkartets.
  storrelse: { type: String, default: 'w-7 h-7' },
})
</script>

<template>
  <svg viewBox="0 0 32 32" :class="['shrink-0', storrelse]" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="10.5" stroke="#7dd3fc" stroke-width="1.6"
            stroke-dasharray="66" stroke-linecap="round" opacity="0.9">
      <animate attributeName="stroke-dashoffset" values="66;0;0;66" dur="2.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="16" r="6" stroke="#34d399" stroke-width="1.6"
            stroke-dasharray="38" stroke-linecap="round" opacity="0.9">
      <animate attributeName="stroke-dashoffset" values="38;0;0;38" dur="2.4s" begin="0.3s" repeatCount="indefinite"/>
    </circle>
    <g>
      <line x1="16" y1="16" x2="16" y2="3.5" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>
      <circle cx="16" cy="3.5" r="1.7" fill="#fbbf24"/>
      <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="1.8s" repeatCount="indefinite"/>
    </g>
    <circle cx="16" cy="16" r="1.8" fill="#fff">
      <animate attributeName="r" values="1.4;2.4;1.4" dur="1.4s" repeatCount="indefinite"/>
    </circle>
  </svg>
</template>
