<script setup>
// Søkbar liste over innsjøer med dybdekurver, i «Om appen». Et trykk bygger et
// kart i Padling der innsjøen er — gjennom «Mine kart» (useAppMenu.byggKartHer),
// så fremdrift og avbryt er de samme som for alle andre nye kart.
//
// Samme form som himmelsøket i 3D: ett felt, én rullbar liste, ingen faner.
import { ref, computed, onMounted } from 'vue'
import { hentInnsjoIndeks, filtrerInnsjoer, eksempler, kartBestilling } from '../lib/innsjoIndeks.js'
import { useAppMenu } from '../composables/useAppMenu.js'

const { byggKartHer } = useAppMenu()

const liste = ref([])
const status = ref('laster')   // 'laster' | 'ok' | 'feil'
const sok = ref('')

onMounted(async () => {
  try {
    liste.value = await hentInnsjoIndeks()
    status.value = 'ok'
  } catch {
    status.value = 'feil'
  }
})

const treff = computed(() => filtrerInnsjoer(liste.value, sok.value))
const eksempelListe = computed(() => eksempler(liste.value))
const TAK = 60
const vist = computed(() => treff.value.slice(0, TAK))

const tall = (v) => (v >= 10 ? String(Math.round(v)) : String(v).replace('.', ','))
function undertekst(i) {
  const deler = []
  if (i.maks != null) deler.push(`maks ${tall(i.maks)} m`)
  if (i.km2 != null) deler.push(`${tall(i.km2)} km²`)
  deler.push(i.demo ? `utsnitt ${i.km} × ${i.km} km` : `kart ${i.km} × ${i.km} km`)
  return deler.join(' · ')
}

function velg(i) {
  byggKartHer(kartBestilling(i))
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="eksempelListe.length" class="text-[13px] leading-relaxed text-ink-2">
      Prøv for eksempel
      <template v-for="(i, k) in eksempelListe" :key="i.nr">
        <button type="button" @click="velg(i)"
                class="font-medium text-ink underline underline-offset-4 decoration-ink/30
                       hover:decoration-ink active:text-ink-2 rounded-sm">{{ i.navn }}</button><template
          v-if="k < eksempelListe.length - 2">, </template><template
          v-else-if="k === eksempelListe.length - 2"> eller </template>
      </template>.
    </p>

    <div class="rounded-xl bg-surface border border-ink/10 overflow-hidden">
      <label class="flex items-center gap-2 px-3 py-2 border-b border-ink/10">
        <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-ink-3" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
        <span class="sr-only">Søk etter innsjø med dybdekart</span>
        <input v-model="sok" type="search" inputmode="search" autocomplete="off"
               placeholder="Søk etter innsjø …"
               class="flex-1 min-w-0 bg-transparent text-[14px] text-ink placeholder:text-ink-4 outline-none py-1"/>
        <span v-if="status === 'ok'" class="text-[11px] text-ink-4 tabular-nums shrink-0" aria-live="polite">
          {{ treff.length }}
        </span>
      </label>

      <p v-if="status === 'laster'" class="px-3 py-3 text-[13px] text-ink-3">Henter lista …</p>
      <p v-else-if="status === 'feil'" class="px-3 py-3 text-[13px] text-ink-3">
        Lista kunne ikke hentes — den trenger nett første gang.
      </p>
      <p v-else-if="!treff.length" class="px-3 py-3 text-[13px] text-ink-3">
        Ingen innsjø med dybdekart heter det.
      </p>
      <ul v-else aria-label="Innsjøer med dybdekart"
          class="max-h-[50vh] overflow-y-auto overscroll-contain divide-y divide-ink/5 [scrollbar-width:thin]">
        <li v-for="i in vist" :key="i.nr">
          <button type="button" @click="velg(i)"
                  :aria-label="`Lag kart over ${i.navn} i Padling`"
                  class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-ink/5
                         active:bg-ink/10 transition-colors">
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] text-ink truncate">
                {{ i.navn }}<span v-if="i.alias" class="text-ink-4"> ({{ i.alias }})</span>
              </span>
              <span class="block text-[12px] text-ink-3">{{ undertekst(i) }}</span>
            </span>
            <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-ink-4" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6"/>
            </svg>
          </button>
        </li>
        <li v-if="treff.length > TAK" class="px-3 py-2 text-[12px] text-ink-4">
          … og {{ treff.length - TAK }} til. Skriv for å snevre inn.
        </li>
      </ul>
    </div>
  </div>
</template>
