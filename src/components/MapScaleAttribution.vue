<script setup>
// Linjal + OSM-kreditt nederst til venstre i kartet, skilt ut fra MapView
// v1.0.8. Rent presentasjonelt — skala-utregningen (candidate-step-algoritmen)
// blir i forelderen som eier wrapper-målingen.
//
// v2.4.20: boksen er BARE linjalen. Print-målestokken og ekvidistansen var to
// faste tekstlinjer som gjorde den nesten tre ganger så høy for tall du leser
// én gang, ikke mens du går — de står nå øverst i punkt-skuffen, og i kolofonen
// på eksporterte kart (se lib/mapColophon.js).
//
// v2.4.26: attribusjons-boksen nede til høyre er borte. ISOM-variant, DEM-kilde
// og dybde-provenens er oppslags-fakta, ikke noe du leser mens du går — de står
// i punkt-skuffen sammen med målestokk og ekvidistanse. Selve ODbL-kreditten må
// stå på kartet, og ligger nå som en linje under linjalen.
// v6.5.0: valgfri ekvidistanse-linje. Fritt lende har ingen punkt-skuffe å
// legge tallet i, og et kart med høydekurver uten oppgitt ekvidistanse er ikke
// et topografisk kart — det er et krusedullebilde. Prop-en er valgfri, så
// MapView er uendret.
defineProps({
  visible: { type: Boolean, default: false },
  scaleBar: { type: Object, default: () => ({ px: 0, ticks: [], label: '' }) },
  equidistanceM: { type: Number, default: null },
})
</script>

<template>
  <!-- Skjult under aktivt søk så den ikke ligger under treff-listen. -->
  <div v-if="visible"
       class="absolute bottom-3 left-3 z-20 pointer-events-none">
    <div class="px-3 py-1.5 rounded-lg bg-overlay text-ink text-[11px]
                font-medium shadow-lg">
      <div v-if="scaleBar.px > 0" class="flex items-end gap-2">
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
      <div v-if="equidistanceM" class="text-[10px] leading-tight font-normal">
        Ekvidistanse {{ equidistanceM }} m
      </div>
      <div class="text-[9px] leading-tight font-normal text-ink/55">
        © OpenStreetMap-bidragsytere
      </div>
    </div>
  </div>
</template>
