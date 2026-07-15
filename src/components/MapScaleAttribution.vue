<script setup>
// Skalabar + ekvidistanse (nederst til venstre) og attribusjon (nederst til
// høyre), skilt ut fra MapView v1.0.8. Rent presentasjonelt — skala-utregningen
// (candidate-step-algoritmen) blir i forelderen som eier wrapper-målingen.
defineProps({
  visible: { type: Boolean, default: false },
  scaleBar: { type: Object, default: () => ({ px: 0, ticks: [], label: '' }) },
  equidistanceLabel: { type: String, default: '' },
  meta: { type: Object, default: null },
})
</script>

<template>
  <!-- Skala + ekvidistanse + ISOM-info (skjult under aktivt søk så den
       ikke ligger under treff-listen). -->
  <div v-if="visible"
       class="absolute bottom-3 left-3 z-20 pointer-events-none">
    <div class="px-3 py-2 rounded-lg bg-zinc-950 text-white text-[11px]
                font-medium space-y-1.5 shadow-lg">
      <div v-if="scaleBar.px > 0">
        <div class="flex items-end gap-2">
          <svg :width="scaleBar.px" height="14" class="overflow-visible">
            <line x1="0" y1="6" :x2="scaleBar.px" y2="6" stroke="white" stroke-width="2"/>
            <g v-for="(t, i) in scaleBar.ticks" :key="i">
              <line :x1="t.px" y1="2" :x2="t.px" y2="10" stroke="white"
                    :stroke-width="i === 0 || i === scaleBar.ticks.length - 1 ? 2 : 1"/>
            </g>
          </svg>
          <div>{{ scaleBar.label }}</div>
        </div>
        <div v-if="meta?.scaleDenom" class="text-[9px] text-white/55 mt-0.5">
          print 1:{{ meta.scaleDenom.toLocaleString('no-NO') }}
        </div>
      </div>
      <div class="text-white/70">{{ equidistanceLabel }}</div>
    </div>
  </div>

  <!-- Attribusjon (skjult under aktivt søk) -->
  <div v-if="visible"
       class="absolute bottom-3 right-3 z-20 px-2 py-1 rounded-md bg-zinc-950
              text-white/85 text-[9px] leading-tight pointer-events-none shadow-lg max-w-[180px]">
    © OpenStreetMap-bidragsytere<br>
    <span class="text-white/50">{{ meta?.isomVersion ? `ISOM ${meta.isomVersion}` : '' }}</span><br>
    <span class="text-white/50">DEM: {{ meta?.demSource ?? '—' }}{{ meta?.demResolutionM ? ` · ${meta.demResolutionM} m` : '' }}</span>
    <!-- Dybde-provenens-badge: ekte Sjøkart vs DEM-estimat. Det fragile
         Sjøkart-WFS faller stille tilbake til estimatet — padleren må vite
         hva dybden faktisk er. -->
    <template v-if="meta?.depthSource && meta.depthSource !== 'ingen'">
      <br><span :class="meta.depthSource === 'sjokart' ? 'text-sky-300/90' : 'text-amber-300/95 font-medium'">{{ meta.depthSource === 'sjokart' ? 'Dybde: Sjøkart' : 'Dybde: estimat — ikke for navigasjon' }}</span>
    </template>
  </div>
</template>
