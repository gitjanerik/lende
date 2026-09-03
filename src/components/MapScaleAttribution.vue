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
// v6.5.0: valgfri ekvidistanse-linje for Fritt lende, som ikke har en
// punkt-skuffe å legge tallet i.
//
// v6.5.27: linja bærer AVSTAND FRA SENTER i stedet, og bare når en posisjon er
// kjent. Ekvidistansen er fast 10 m i den modusen og leses én gang; avstanden er
// tallet man trenger MENS man går, fordi det er det som sier når arket tar slutt
// og et nytt utsnitt er tilgjengelig. Begge prop-ene er valgfrie, så MapView er
// uendret.
//
// `avstandNaadd` er en TILSTAND og ikke en farge på kallstedet: linjalen eier
// sitt eget uttrykk, og porten (NYTT_KART_M) bor i lib/frittLende.js.
defineProps({
  visible: { type: Boolean, default: false },
  scaleBar: { type: Object, default: () => ({ px: 0, ticks: [], label: '' }) },
  avstandTekst: { type: String, default: '' },
  avstandNaadd: { type: Boolean, default: false },
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
      <!-- Tabulære siffer: tallet oppdateres hvert tredje sekund, og med
           proporsjonale siffer flytter hele linja seg for hver 1 som blir en 8. -->
      <div v-if="avstandTekst"
           class="text-[10px] leading-tight font-normal [font-variant-numeric:tabular-nums]"
           :class="avstandNaadd ? 'text-amber-200 font-semibold' : ''">
        {{ avstandTekst }}
      </div>
      <div class="text-[9px] leading-tight font-normal text-ink/55">
        © OpenStreetMap-bidragsytere
      </div>
    </div>
  </div>
</template>
