<script setup>
// Drawer-fane «Stemning», skilt ut fra MapView v1.0.8 (het «Tema» til
// v5.23.0). Tema-grid + font-par for kart-navn (byttes live). Tema-listen
// (fra isomCatalog) kommer som prop; font-paret bindes toveis.
//
// v5.23.0: temaene som en KARTSTIL eier (light, dark, turkart, padling,
// print) rendres IKKE her. De velges under Kartstil, sammen med lag, strek og
// sti-farger. Sto de begge steder, ville to kontroller styrt samme utseende —
// nettopp forvirringen kartstil-begrepet ble innført for å fjerne. Det som
// står igjen her er den monokrome familien: stemninger, ikke kartstiler.
import { computed } from 'vue'
import { FONT_PAIRS } from '../../composables/useLabelFonts.js'
import { THEME_GROUPS } from '../../lib/mapSettingsApply.js'

const props = defineProps({
  themes: { type: Array, default: () => [] },
  currentTheme: { type: String, default: null },
  onThemeTap: { type: Function, required: true },
  landFont: { type: String, default: '' },
  waterFont: { type: String, default: '' },
})
const fontPairId = defineModel('fontPairId', { type: String, default: '' })

// Temaene delt i seksjoner. 'kartstil'-gruppa hoppes over — den eies av
// Kartstil-fanen. Tomme seksjoner droppes, og temaer med ukjent gruppe faller
// inn under den første SYNLIGE så de aldri forsvinner helt fra menyen.
const SKJULTE_GRUPPER = new Set(['kartstil'])
const sections = computed(() => {
  const grupper = THEME_GROUPS.filter((g) => !SKJULTE_GRUPPER.has(g.key))
  const known = new Set(THEME_GROUPS.map((g) => g.key))
  const fallback = grupper[0]?.key
  return grupper
    .map((g) => ({
      ...g,
      themes: props.themes.filter((t) => {
        if (SKJULTE_GRUPPER.has(t.group)) return false
        return (known.has(t.group) ? t.group : fallback) === g.key
      }),
    }))
    .filter((g) => g.themes.length)
})
</script>

<template>
  <div>
    <p class="text-[11px] text-ink/50 leading-snug mb-3">
      Stemninger er rene fargeeksperimenter oppå kartet du allerede har valgt.
      Skal du bytte selve kartstilen — farger, lag, strek og sti-farger
      samlet — ligger det under Kartstil.
    </p>

    <section v-for="s in sections" :key="s.key" class="mb-3">
      <h3 class="text-[11px] uppercase tracking-wide text-ink/45 mb-1.5">{{ s.label }}</h3>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="t in s.themes" :key="t.key"
                @click="onThemeTap(t.key)"
                class="px-3 py-2 rounded-lg border text-[11px] active:scale-[0.98] transition text-center"
                :class="currentTheme === t.key
                        ? 'bg-slate-400/25 border-slate-300/50 text-ink font-medium'
                        : 'bg-ink/5 border-ink/10 text-ink/65'">
          {{ t.label }}
        </button>
      </div>
      <p v-if="s.beskrivelse" class="text-[11px] text-ink/45 leading-snug mt-1.5">
        {{ s.beskrivelse }}
      </p>
    </section>

    <!-- Font-par for kart-navn (Stedsnavn-typografi). Land = sans
         (bebyggelse/topp/område), vann = kursiv serif. Byttes live. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="text-[13px] text-ink font-medium mb-2">Skrift på kart-navn</div>
      <select v-model="fontPairId" aria-label="Font-par for kart-navn"
              class="w-full rounded-md bg-ink/10 text-ink text-[12px] px-2 py-1.5
                     border border-ink/10 focus:outline-none focus:ring-1 focus:ring-emerald-400
                     [&>option]:text-zinc-900 [&>option]:bg-white">
        <option v-for="p in FONT_PAIRS" :key="p.id" :value="p.id">{{ p.id }}</option>
      </select>
      <div class="mt-2 flex items-baseline gap-2" aria-hidden="true">
        <span class="text-ink/85 text-[14px]" :style="{ fontFamily: landFont }">Stubdalskampen</span>
        <span class="text-sky-300 text-[14px] italic" :style="{ fontFamily: waterFont }">Damtjern</span>
      </div>
      <div class="text-[11px] text-ink/55 leading-snug mt-1.5">
        Bebyggelse, topp og område settes i sans; vann-navn i kursiv serif.
        Gjelder kart bygd etter denne oppdateringen — eldre kart må regenereres.
      </div>
    </div>
  </div>
</template>
