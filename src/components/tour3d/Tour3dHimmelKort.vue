<script setup>
// Infokort for det valgte på himmelen: stjernebilde, planet eller månen.
//
// EGEN KOMPONENT og ikke Tour3dFeatureCard, som ble vurdert: den er bundet til
// kart-feature-typer (TYPE_LABELS, TYPE_IKONER) og henter NVE-observasjoner
// lazily. Å presse en stjernehimmel inn i den ville gitt to formål i én
// komponent — og det er ingen delt logikk å spare, bare et navn.
//
// Snarveiene nederst er stjernehopping, og de er den beste grunnen til at kortet
// finnes: har man først funnet Orion, er neste steg å hoppe til naboen. Det er
// slik man lærer seg en himmel.
//
// Stilen er dempet mørk av samme grunn som søkefeltet: kortet står åpent mens
// man ser på stjerner, og et lyst kort ødelegger nattsynet det tok en halvtime
// å bygge opp.
import { computed } from 'vue'
import { kompass } from '../../lib/tour3d/himmelObjekter.js'

const props = defineProps({
  // Objektet fra himmelObjekter().
  objekt: { type: Object, default: null },
  // De nærmeste andre, fra naboerFor().
  naboer: { type: Array, default: () => [] },
})
const emit = defineEmits(['lukk', 'velg'])

const GRAD = 180 / Math.PI
const komma = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '–')

const hoydeGrader = computed(() => Math.round((props.objekt?.hoyde ?? 0) * GRAD))
const retning = computed(() => kompass((props.objekt?.azimut ?? 0) * GRAD))

const IKON = { mane: '🌙', planet: '🪐', formasjon: '✦' }

// Månefasen med ord. Et tall i prosent sier lite; «voksende halvmåne» er det
// man faktisk ser opp på.
const faseNavn = computed(() => {
  const o = props.objekt
  if (o?.type !== 'mane') return null
  const k = o.lysAndel ?? 0
  const voksende = o.voksende
  if (k < 0.04) return 'nymåne'
  if (k > 0.96) return 'fullmåne'
  if (k < 0.46) return voksende ? 'voksende månesigd' : 'minkende månesigd'
  if (k < 0.54) return voksende ? 'voksende halvmåne' : 'minkende halvmåne'
  return voksende ? 'voksende, nesten full' : 'minkende, nesten full'
})
</script>

<template>
  <div v-if="objekt"
       class="rounded-md bg-black/80 backdrop-blur shadow-lg max-w-[86vw] sm:max-w-sm
              flex items-start gap-1.5 pl-3 pr-1 py-2">
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[0.8125rem]" aria-hidden="true">{{ IKON[objekt.type] }}</span>
        <span class="text-[0.875rem] font-semibold text-white/90 truncate">{{ objekt.navn }}</span>
        <span v-if="objekt.latin && objekt.latin !== objekt.navn"
              class="text-[0.625rem] italic text-white/40 truncate">{{ objekt.latin }}</span>
      </div>

      <!-- Hvor det står. Alltid først, fordi det er det man trenger for å løfte
           blikket i riktig retning. -->
      <div class="mt-0.5 text-[0.625rem] text-white/50">
        {{ retning }}, {{ hoydeGrader }}° over horisonten
      </div>

      <!-- Tallene, per type. -->
      <div v-if="objekt.type === 'formasjon'" class="mt-1.5 text-[0.6875rem] text-white/70">
        {{ objekt.antallStjerner }} stjerner tegnet<template v-if="objekt.lysesteStjerne">, lyseste er
        <span class="text-white/90">{{ objekt.lysesteStjerne.navn }}</span>
        ({{ komma(objekt.lysesteStjerne.mag) }})</template>.
      </div>
      <div v-else-if="objekt.type === 'planet'" class="mt-1.5 text-[0.6875rem] text-white/70">
        Lysstyrke {{ komma(objekt.mag) }} ·
        {{ komma(objekt.avstandAE, 2) }} AE unna ·
        {{ Math.round(objekt.lysAndel * 100) }} % opplyst
      </div>
      <div v-else-if="objekt.type === 'mane'" class="mt-1.5 text-[0.6875rem] text-white/70">
        {{ faseNavn }} · {{ Math.round(objekt.lysAndel * 100) }} % opplyst
      </div>

      <!-- Teksten for stjernebildene. -->
      <template v-if="objekt.info">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Finn den</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.finnDen }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Historien</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.mytologi }}</p>

        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">Verdt å vite</div>
        <p class="text-[0.6875rem] leading-relaxed text-white/70">{{ objekt.info.funFact }}</p>
      </template>

      <!-- Snarveier: stjernehopping. Bare de som faktisk er i nærheten. -->
      <template v-if="naboer.length">
        <div class="mt-2 text-[0.5625rem] uppercase tracking-wide text-white/35">I nærheten</div>
        <div class="mt-1 flex flex-wrap gap-1">
          <button v-for="n in naboer" :key="n.id"
                  @click="emit('velg', n)"
                  class="rounded-full bg-white/10 px-2 py-1 text-[0.625rem] text-white/75
                         active:scale-95 transition-colors">
            {{ IKON[n.type] }} {{ n.navn }}
            <span class="text-white/40">{{ Math.round(n.avstandGrader) }}°</span>
          </button>
        </div>
      </template>
    </div>

    <button @click="emit('lukk')" aria-label="Lukk"
            class="w-7 h-7 shrink-0 flex items-center justify-center text-white/45
                   active:scale-90">
      <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
      </svg>
    </button>
  </div>
</template>
