<script setup>
// Ett værsymbol fra METs offisielle ikonsett.
//
// Tegnes som <img src="data:…"> og IKKE som inline SVG. Det er ikke en
// smakssak: METs SVG-er definerer <symbol id="sun"> og gradienter med GLOBALE
// id-er, så to inlinede ikoner i samme dokument ville overskrevet hverandres
// gradienter — den første skya i raden ville stjålet fargene til den andre. I en
// <img> er hvert ikon sitt eget dokument.
//
// Settet lastes lazily (lastVaerIkoner) — se den fila for hvorfor. Fram til det
// har landet tegnes ingenting; ikonet er en detalj ved en linje som alt har
// temperatur og vind, så en plassholder ville blinket mer enn den hjelper.
//
// `variant` overstyrer dag/natt/polartwilight fra symbol_code, slik at ikonet kan
// følge lysmodusen brukeren HAR VALGT i 3D framfor klokka.
import { ref, computed, watch } from 'vue'
import { lastVaerIkoner } from '../lib/vaerIkoner.js'
import { symbolBasis, medVariant } from '../lib/vaerFetcher.js'

const props = defineProps({
  symbol: { type: String, default: null },
  variant: { type: String, default: null },
  // Piksler. Ikonene er kvadratiske (viewBox 0 0 100 100).
  size: { type: Number, default: 24 },
})

const sett = ref(null)
watch(() => props.symbol, (s) => {
  if (!s || sett.value) return
  lastVaerIkoner().then((m) => { sett.value = m }).catch(() => { /* ingen ikoner */ })
}, { immediate: true })

const kode = computed(() => (props.variant ? medVariant(props.symbol, props.variant) : props.symbol))
const src = computed(() => sett.value?.VAER_IKON[kode.value] ?? null)
// Norsk navn på været, fra METs egen legend.csv — ikke vår oversettelse.
const navn = computed(() => sett.value?.VAER_NAVN[symbolBasis(kode.value).basis] ?? null)
</script>

<template>
  <!-- Ingen kjent kode → ingenting. Et spørsmålstegn ville lest som «ukjent
       vær» når sannheten er «vi kjenner ikke koden». -->
  <img v-if="src" :src="src" :alt="navn ?? ''" :title="navn ?? undefined"
       :width="size" :height="size"
       class="shrink-0 select-none" draggable="false"/>
</template>
