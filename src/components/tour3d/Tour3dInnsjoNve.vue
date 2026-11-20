<script setup>
// NVE-målingene for innsjøen i 3D, der værraden ellers står. Bare det
// stasjonen faktisk måler vises; lufta faller tilbake på MET-varselet.
import { computed } from 'vue'

const props = defineProps({
  // { navn, sildreUrl, iVannet, vannTemp, vannforing, vannstand, luftTemp, luftKilde, tid }
  data: { type: Object, required: true },
})

const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 })
const heltall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 })

function foring(v) {
  return v >= 10 ? heltall.format(v) : tall.format(v)
}

const kolonner = computed(() => {
  const d = props.data
  const ut = []
  if (d.vannTemp != null) ut.push({ k: 'vann', etikett: 'Vann', verdi: `${tall.format(d.vannTemp)}°` })
  if (d.vannforing != null) ut.push({ k: 'foring', etikett: 'Vannføring', verdi: `${foring(d.vannforing)} m³/s` })
  else if (d.vannstand != null) ut.push({ k: 'stand', etikett: 'Vannstand', verdi: `${tall.format(d.vannstand)} m` })
  if (d.luftTemp != null) ut.push({ k: 'luft', etikett: d.luftKilde === 'met' ? 'Luft (MET)' : 'Luft', verdi: `${tall.format(d.luftTemp)}°` })
  return ut
})

const klokke = computed(() => {
  const t = props.data.tid ? new Date(props.data.tid) : null
  if (!t || Number.isNaN(t.getTime())) return null
  return t.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
})
</script>

<template>
  <section v-if="kolonner.length" data-innsjo-nve
           class="rounded-2xl bg-black/72 backdrop-blur max-w-full overflow-hidden text-white"
           :aria-label="`Målinger fra NVE-stasjonen ${data.navn}`">
    <div class="flex items-baseline gap-2 px-3 pt-1.5">
      <span class="text-[0.6875rem] font-semibold truncate min-w-0">{{ data.navn }}</span>
      <a :href="data.sildreUrl" target="_blank" rel="noopener"
         class="shrink-0 text-[0.5625rem] text-white/72 underline underline-offset-2">
        NVE<template v-if="klokke"> · kl. {{ klokke }}</template>
      </a>
    </div>
    <div class="flex items-stretch divide-x divide-white/10">
      <div v-for="c in kolonner" :key="c.k"
           class="shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5">
        <span class="text-[0.5625rem] text-white/72 leading-none">{{ c.etikett }}</span>
        <span class="text-sm font-semibold tabular-nums leading-tight">{{ c.verdi }}</span>
      </div>
    </div>
  </section>
</template>
