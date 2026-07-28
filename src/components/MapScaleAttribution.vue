<script setup>
// Skalabar (nederst til venstre) og attribusjon (nederst til høyre), skilt ut
// fra MapView v1.0.8. Rent presentasjonelt — skala-utregningen
// (candidate-step-algoritmen) blir i forelderen som eier wrapper-målingen.
//
// v2.4.20: boksen er BARE linjalen. Print-målestokken og ekvidistansen var to
// faste tekstlinjer som gjorde den nesten tre ganger så høy for tall du leser
// én gang, ikke mens du går — de står nå øverst i punkt-skuffen, og i kolofonen
// på eksporterte kart (se lib/mapColophon.js).
defineProps({
  visible: { type: Boolean, default: false },
  scaleBar: { type: Object, default: () => ({ px: 0, ticks: [], label: '' }) },
  meta: { type: Object, default: null },
})
</script>

<template>
  <!-- Linjal (skjult under aktivt søk så den ikke ligger under treff-listen). -->
  <div v-if="visible && scaleBar.px > 0"
       class="absolute bottom-3 left-3 z-20 pointer-events-none">
    <div class="px-3 py-1.5 rounded-lg bg-overlay text-ink text-[11px]
                font-medium shadow-lg flex items-end gap-2">
      <!-- currentColor, ikke hardkodet hvit: bakgrunnen (bg-overlay) er hvit i
           lyst tema, der en hvit linjal var usynlig. -->
      <svg :width="scaleBar.px" height="14" class="overflow-visible text-ink">
        <line x1="0" y1="6" :x2="scaleBar.px" y2="6" stroke="currentColor" stroke-width="2"/>
        <g v-for="(t, i) in scaleBar.ticks" :key="i">
          <line :x1="t.px" y1="2" :x2="t.px" y2="10" stroke="currentColor"
                :stroke-width="i === 0 || i === scaleBar.ticks.length - 1 ? 2 : 1"/>
        </g>
      </svg>
      <div>{{ scaleBar.label }}</div>
    </div>
  </div>

  <!-- Attribusjon (skjult under aktivt søk) -->
  <div v-if="visible"
       class="absolute bottom-3 right-3 z-20 px-2 py-1 rounded-md bg-overlay
              text-ink/85 text-[9px] leading-tight pointer-events-none shadow-lg max-w-[180px]">
    © OpenStreetMap-bidragsytere<br>
    <span class="text-ink/50">{{ meta?.isomVersion ? `ISOM ${meta.isomVersion}` : '' }}</span><br>
    <span class="text-ink/50">DEM: {{ meta?.demSource ?? '—' }}{{ meta?.demResolutionM ? ` · ${meta.demResolutionM} m` : '' }}</span>
    <!-- Dybde-provenens-badge: ekte Sjøkart vs DEM-estimat. Det fragile
         Sjøkart-WFS faller stille tilbake til estimatet — padleren må vite
         hva dybden faktisk er. -->
    <template v-if="meta?.depthSource && meta.depthSource !== 'ingen'">
      <br><span :class="meta.depthSource === 'sjokart' ? 'text-sky-300/90' : 'text-amber-300/95 font-medium'">{{ meta.depthSource === 'sjokart' ? 'Dybde: Sjøkart' : 'Dybde: estimat — ikke for navigasjon' }}</span>
    </template>
  </div>
</template>
