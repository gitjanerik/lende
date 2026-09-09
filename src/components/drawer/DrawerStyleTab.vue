<script setup>
// Drawer-fane «Kartstil» (v5.23.0) — det ENE valget som setter hele uttrykket.
//
// Erstatter forhåndsvalg-raden i Kartlag-fanen og de fem tema-knappene som
// egentlig var kartstiler. Hver knapp viser en ekte miniatyr av paletten sin:
// bakgrunn, skogflate, vann, høydekurve og sti, hentet fra samme tema-katalog
// kartet selv bruker. Fem knapper med bare tekst ville vært det gamle
// problemet i ny drakt — brukeren skal SE forskjellen før hun trykker.
import { computed } from 'vue'
import { KARTSTILER, STI_PALETTER } from '../../lib/kartStiler.js'
import { kartStilForhandsvisning } from '../../lib/mapSettingsApply.js'

const props = defineProps({
  aktivStil: { type: String, default: null },
  velgStil: { type: Function, required: true },
  aktivStiPalett: { type: String, default: 'tema' },
  velgStiPalett: { type: Function, required: true },
  // De to frie fargevelgerne bodde i Strek-FAB-panelet fram til v6.5.82. De
  // hører hjemme her: paletten og den frie fargen svarer på SAMME spørsmål, og
  // to steder å stille det ga to «nullstill»-knapper som ikke visste om
  // hverandre. «Følg tema» er nå den ene — den tømmer overstyringen.
  trailSwatches: { type: Object, default: () => ({ fg: '#000000', bg: '#fbf7ec' }) },
  setTrailColor: { type: Function, default: null },
})

const stiler = computed(() => KARTSTILER.map((s) => ({
  ...s, farger: kartStilForhandsvisning(s.key),
})))
</script>

<template>
  <div>
    <div class="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
      Kartstil
    </div>
    <div class="flex flex-col gap-2 mb-4">
      <button v-for="s in stiler" :key="s.key"
              @click="velgStil(s.key)"
              :aria-pressed="aktivStil === s.key"
              class="flex items-stretch gap-3 rounded-xl border p-2 text-left active:scale-[0.99] transition"
              :class="aktivStil === s.key
                      ? 'bg-emerald-500/20 border-emerald-300/60'
                      : 'bg-ink/5 border-ink/10'">
        <!-- Miniatyren er kartet i miniatyr, ikke en fargeprikk: en skogflate
             med vann, en høydekurve og en sti oppå, i stilens egne farger. -->
        <svg viewBox="0 0 48 34" class="w-[3.4rem] h-[2.4rem] shrink-0 rounded-md"
             :style="{ backgroundColor: s.farger.bg }" aria-hidden="true">
          <path d="M0 20 Q 12 12 24 17 T 48 13 L48 34 L0 34 Z" :fill="s.farger.skog" />
          <ellipse cx="36" cy="9" rx="10" ry="5.5" :fill="s.farger.vann" />
          <path d="M0 25 Q 14 19 26 24 T 48 21" fill="none"
                :stroke="s.farger.kontur" stroke-width="1.1" />
          <path d="M2 33 Q 16 26 24 29 T 46 24" fill="none"
                :stroke="s.farger.sti" stroke-width="1.5"
                stroke-dasharray="2.6 1.8" stroke-linecap="butt" />
        </svg>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-medium"
                :class="aktivStil === s.key ? 'text-ink' : 'text-ink-2'">{{ s.label }}</span>
          <span class="block text-[11px] leading-snug text-ink-4">{{ s.beskrivelse }}</span>
        </span>
      </button>
    </div>

    <!-- ── Tilpass ──────────────────────────────────────────────────────
         De navngitte palettene først — det er valget folk faktisk tar; to
         fargevelgere med 16 millioner verdier hver er ikke et valg. Den frie
         velgeren står under, for den som vil noe eget. «Følg tema» er seksjonens
         ENESTE nullstilling: den tømmer overstyringen på begge nivåer, og et
         eget «Nullstill farger» ved siden av ville sagt det samme en gang til. -->
    <div class="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
      Tilpass — sti-farge
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="p in STI_PALETTER" :key="p.key"
              @click="velgStiPalett(p.key)"
              :aria-pressed="aktivStiPalett === p.key"
              :title="p.beskrivelse"
              class="grow basis-[5.5rem] flex items-center gap-2 px-2.5 py-2 rounded-lg border
                     active:scale-[0.98] transition"
              :class="aktivStiPalett === p.key
                      ? 'bg-slate-400/25 border-slate-300/50 text-ink'
                      : 'bg-ink/5 border-ink/10 text-ink-3'">
        <svg viewBox="0 0 20 10" class="w-5 h-2.5 shrink-0" aria-hidden="true">
          <template v-if="p.farger">
            <path d="M0 5 H20" :stroke="p.farger.bg" stroke-width="6" stroke-linecap="round" />
            <path d="M0 5 H20" :stroke="p.farger.fg" stroke-width="2.6"
                  stroke-dasharray="3 2" stroke-linecap="butt" />
          </template>
          <!-- «Følg tema» har ingen egen farge å vise — den viser fravær. -->
          <path v-else d="M0 5 H20" stroke="currentColor" stroke-width="2"
                stroke-dasharray="3 2" opacity="0.5" />
        </svg>
        <span class="text-[11px] truncate">{{ p.label }}</span>
      </button>
    </div>

    <!-- Fri farge: forgrunn = den stiplede streken (505/506/507), bakgrunn =
         den kontinuerlige casing-linja under (505/506). Et valg her gjør
         paletten «egendefinert» av seg selv — aktivStiPalett AVLEDES av de
         faktiske fargene, så de to kan ikke komme i utakt. -->
    <div v-if="setTrailColor" class="grid grid-cols-2 gap-2 mt-2">
      <label class="flex items-center gap-2 rounded-lg bg-ink/5 border border-ink/10 px-2.5 py-2">
        <input type="color" :value="trailSwatches.fg"
               @input="setTrailColor('fg', $event.target.value)"
               aria-label="Egen farge på sti-strek"
               class="w-7 h-7 rounded shrink-0 bg-transparent border-0 p-0 cursor-pointer"/>
        <span class="text-[11px] text-ink-2 leading-tight">Egen strek</span>
      </label>
      <label class="flex items-center gap-2 rounded-lg bg-ink/5 border border-ink/10 px-2.5 py-2">
        <input type="color" :value="trailSwatches.bg"
               @input="setTrailColor('bg', $event.target.value)"
               aria-label="Egen farge på sti-bakgrunn"
               class="w-7 h-7 rounded shrink-0 bg-transparent border-0 p-0 cursor-pointer"/>
        <span class="text-[11px] text-ink-2 leading-tight">Egen bakgrunn</span>
      </label>
    </div>
    <div class="text-[11px] text-ink-4 leading-snug mt-1.5">
      «Følg tema» gir kartstilens egne sti-farger igjen. Stitråkk (svakeste sti)
      har ingen bakgrunnslinje og påvirkes bare av strek-fargen.
    </div>
  </div>
</template>
