<script setup>
// Drawer-fane «Kartstil» (v5.23.0) — det ENE valget som setter hele uttrykket.
//
// Erstatter forhåndsvalg-raden i Kartlag-fanen og de fem tema-knappene som
// egentlig var kartstiler. Hver knapp viser en ekte miniatyr av paletten sin:
// bakgrunn, skogflate, vann, høydekurve og sti, hentet fra samme tema-katalog
// kartet selv bruker. Fem knapper med bare tekst ville vært det gamle
// problemet i ny drakt — brukeren skal SE forskjellen før hun trykker.
//
// FANA BÆRER HELE UTTRYKKET FRA v7.4.0. Strek og relieff sto som gruppe-piller
// med tannhjul i snarvei-raden, med et delt bunn-ark (`FabSettingsPanel`) bak
// seg — altså en tredje klasse kontroll, med sin egen form og sitt eget ark,
// midt i en rad som ellers bare bærer FUNKSJONER. Prisen var at kartets uttrykk
// ble stilt inn to steder. Nå står de nederst her, etter kartstil og sti-farge,
// i grovest-først-rekkefølge som resten av skuffa. Bua som viste nivået er
// slettet med pillene: et tall ved en slider leses, en bue tolkes.
import { computed } from 'vue'
import { KARTSTILER, STI_PALETTER } from '../../lib/kartStiler.js'
import { kartStilForhandsvisning } from '../../lib/mapSettingsApply.js'
import { STROKE_GROUPS } from '../../lib/strokeOverrides.js'

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

  // ── Strek og relieff (v7.4.0) ───────────────────────────────────────────
  // De to bodde i snarvei-raden som gruppe-piller med tannhjul, med et delt
  // bunn-ark bak seg. Det var en tredje klasse kontroll — verken funksjon
  // eller innstilling — midt i en rad som ellers bare bærer funksjoner, og
  // prisen var at kartets uttrykk ble stilt inn to steder: tema, lag og
  // sti-farge her, strek og relieff der. Nå er alt uttrykk i denne fana, og
  // nivået står som et TALL ved en slider i stedet for som en bue å tolke.
  strekTrinn: { type: Number, default: 0 },
  strekTrinnAntall: { type: Number, default: 1 },
  strekSkala: { type: Number, default: 1 },
  strokeEffective: { type: Object, default: () => ({}) },
  reliefTrinn: { type: Number, default: 0 },
  reliefTrinnAntall: { type: Number, default: 1 },
  reliefProsent: { type: Number, default: 0 },
  // Relieffet kan være slått av av TEMAET (monokrom) uten at brukerens egen
  // innstilling er rørt. Da er bryteren fortsatt «på», og seksjonen må si
  // hvorfor det likevel ikke vises — ellers ser det ut som en feil.
  reliefAutoAv: { type: Boolean, default: false },
})

const emit = defineEmits([
  'set-strek-trinn', 'set-stroke-group', 'strek-standard', 'strek-nullstill',
  'set-relief-trinn', 'relieff-standard', 'relieff-nullstill',
])
const reliefEnabled = defineModel('reliefEnabled', { type: Boolean, default: false })
const reliefMode = defineModel('reliefMode', { type: String, default: 'vektor' })

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

    <!-- ── Strek (v7.4.0) ───────────────────────────────────────────────
         Grov-knotten øverst, per-element under. Det er to nivåer, ikke to
         innstillinger: den øverste ganger ALT, de nederste vekter gruppene mot
         hverandre — og den effektive verdien ved hver slider er produktet, så
         tallet man leser er det kartet faktisk tegner. Grov-knotten er global
         og huskes for alle kart; per-element er per kart, med global standard
         som fallback. «Angi som standard» er broen mellom de to. -->
    <div class="mt-5 pt-4 border-t border-ink/10">
      <div class="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
        Strek
      </div>
      <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
        <div class="flex items-center justify-between gap-3 mb-1.5">
          <div class="text-[13px] text-ink font-medium">Strektykkelse — alt</div>
          <span class="text-ink-3 text-[12px] tabular-nums">{{ strekSkala.toFixed(2) }}×</span>
        </div>
        <input type="range" min="0" :max="strekTrinnAntall - 1" step="1"
               :value="strekTrinn"
               @input="emit('set-strek-trinn', Number($event.target.value))"
               aria-label="Strektykkelse for alle kart"
               class="w-full accent-sky-400"/>
        <div class="text-[11px] text-ink-4 leading-snug mt-1.5">
          Gjelder alle kart. Store kart har tettere kurver, så samme hakk gir
          tynnere strek der enn på et lite kart — tallet er den faktiske skalaen.
        </div>
      </div>

      <div class="text-[11px] text-ink-3 leading-snug mb-2">
        Per element for DETTE kartet. Ganges med knotten over.
      </div>
      <div v-for="g in STROKE_GROUPS" :key="g.id"
           class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
        <div class="flex items-center justify-between gap-3 mb-1.5">
          <div class="text-[13px] text-ink font-medium">{{ g.label }}</div>
          <span class="text-ink-3 text-[12px] tabular-nums">{{ (strokeEffective[g.id] ?? 1).toFixed(2) }}×</span>
        </div>
        <input type="range" min="0.5" max="2.5" step="0.05"
               :value="strokeEffective[g.id] ?? 1"
               @input="emit('set-stroke-group', g.id, Number($event.target.value))"
               :aria-label="`Strekbredde ${g.label}`"
               class="w-full accent-sky-400"/>
      </div>
      <div class="flex gap-2">
        <button @click="emit('strek-standard')"
                class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                       active:scale-[0.98] bg-emerald-500/15 border-emerald-400/40 text-emerald-100">
          Angi som standard
        </button>
        <button @click="emit('strek-nullstill')"
                class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                       active:scale-[0.98] bg-ink/5 border-ink/15 text-ink-2">
          Nullstill strek
        </button>
      </div>
    </div>

    <!-- ── Relieff (v7.4.0) ─────────────────────────────────────────────
         Av/på og stil er per kart; styrken er den globale knotten. Styrke-
         slideren står bare når relieffet er PÅ — en slider som ikke gjør noe
         er verre enn ingen slider. -->
    <div class="mt-5 pt-4 border-t border-ink/10">
      <div class="text-[11px] font-semibold text-ink-3 uppercase tracking-wide mb-1.5">
        Relieff
      </div>
      <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-[13px] text-ink font-medium">Relieff (terrengskygge)</div>
          <div class="text-[11px] text-ink-3 leading-snug">
            Gjelder dette kartet. Bruker mer minne/GPU — slå av på svake enheter.
          </div>
        </div>
        <button @click="reliefEnabled = !reliefEnabled"
                :aria-pressed="reliefEnabled"
                :aria-label="reliefEnabled ? 'Slå av relieff for dette kartet' : 'Slå på relieff for dette kartet'"
                class="relative w-11 h-6 rounded-full transition-colors shrink-0"
                :class="reliefEnabled ? 'bg-emerald-500' : 'bg-ink/15'">
          <span class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                :class="reliefEnabled ? 'left-5' : 'left-0.5'" />
        </button>
      </div>

      <!-- Temaets auto-av er ikke brukerens valg, og uten denne linja ser en
           bryter som står på PÅ mens kartet er flatt ut som en feil. -->
      <div v-if="reliefEnabled && reliefAutoAv"
           class="rounded-lg bg-amber-400/10 border border-amber-300/30 px-3 py-2 mb-2
                  text-[11px] text-amber-100 leading-snug">
        Kartstilen du står i er monokrom, og slår relieffet av for å holde
        flatene rene. Bytt kartstil eller stemning for å få det tilbake.
      </div>

      <template v-if="reliefEnabled">
        <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
          <div class="flex items-center justify-between gap-3 mb-1.5">
            <div class="text-[13px] text-ink font-medium">Styrke</div>
            <span class="text-ink-3 text-[12px] tabular-nums">
              {{ reliefProsent === 0 ? 'av' : `${reliefProsent} %` }}
            </span>
          </div>
          <input type="range" min="0" :max="reliefTrinnAntall - 1" step="1"
                 :value="reliefTrinn"
                 @input="emit('set-relief-trinn', Number($event.target.value))"
                 aria-label="Relieff-styrke for alle kart"
                 class="w-full accent-amber-400"/>
        </div>
        <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-2">
          <div class="text-[13px] text-ink font-medium mb-2">Relieff-stil</div>
          <div class="flex gap-2" role="group" aria-label="Relieff-stil for dette kartet">
            <button @click="reliefMode = 'vektor'"
                    :aria-pressed="reliefMode === 'vektor'"
                    class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                    :class="reliefMode === 'vektor' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
              Skarp (vektor)
            </button>
            <button @click="reliefMode = 'mjuk'"
                    :aria-pressed="reliefMode === 'mjuk'"
                    class="flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
                    :class="reliefMode === 'mjuk' ? 'bg-emerald-700 text-white' : 'bg-ink/10 text-ink-2'">
              Mjuk (bilde)
            </button>
          </div>
          <div class="text-[11px] text-ink-3 leading-snug mt-1.5">
            Skarp = tone-bånd som vektor: liten fil, knivskarpt ved zoom og print.
            Mjuk = myk gradient (foto-relieff), men gir et tungt bilde i kart-fila.
          </div>
        </div>
      </template>

      <div class="flex gap-2">
        <button @click="emit('relieff-standard')"
                class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                       active:scale-[0.98] bg-emerald-500/15 border-emerald-400/40 text-emerald-100">
          Angi som standard
        </button>
        <button @click="emit('relieff-nullstill')"
                class="flex-1 px-3 py-2 rounded-lg text-[12px] font-medium border transition
                       active:scale-[0.98] bg-ink/5 border-ink/15 text-ink-2">
          Nullstill relieff
        </button>
      </div>
    </div>
  </div>
</template>
