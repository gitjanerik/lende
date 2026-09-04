<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import AppMenuButton from '../components/AppMenuButton.vue'
import MapLibrary from '../components/MapLibrary.vue'

// Forsiden. Selve biblioteket (faner, Mine kart, Mine ruter, lag-nytt-flyten)
// ligger i MapLibrary, som deles med modalen hovedmenyen åpner. Her ligger bare
// toppbaren, tekst-skaleringen og speilingen av fanen mot ?tab=kart|rute — så
// delte lenker og hovedmenyens navigasjon lander på riktig fane.
const { uiTextScale } = useUiTextScale()
const route = useRoute()
const router = useRouter()

const activeTab = ref(route.query.tab === 'rute' ? 'rute' : 'kart')
watch(() => route.query.tab, (t) => { if (t === 'rute' || t === 'kart') activeTab.value = t })
// Hold URL-en i takt med fanen, så en refresh (og delte lenker) beholder den.
watch(activeTab, (t) => {
  if ((route.query.tab ?? 'kart') === t) return
  router.replace({ path: '/', query: { ...route.query, tab: t } })
})

// «Flere valg» og søkefeltets pin-knapp ender begge her; forskjellen er ?gps=1,
// som ber skjemaet hente posisjonen og sentrere seg der straks det er oppe.
function apnePicker(opt) {
  router.push(opt?.gps ? { path: '/nytt', query: { gps: '1' } } : '/nytt')
}

// Snarveien til Fritt lende i den tomme lista. `replace` og ikke `push`, samme
// regel som hovedmenyens egen rad: modusen er en bryter og ikke en drill-down,
// så tilbake-knappen skal ikke lande i det vanlige kartet.
function goFrittLende() {
  router.replace({ name: 'fritt-lende' })
}
</script>

<template>
  <div class="kart-ui relative w-full min-h-[100dvh] bg-app text-ink/90">

    <!-- Toppbar: full bredde som en chrome-stripe, men innholdet sentreres i
         samme 700 px-spalte som panelet under, så hamburgeren og tittelen flukter
         med det. Klebrig: hamburgeren ER inngangen til hovedmenyen på forsiden og
         skal ikke scrolle bort.

         INGEN GRAFIKK BAK HAMBURGEREN (v6.5.36). Her lå fire kontur-ringer fra
         logoen. De var ment som et diskret ekko, men de ligger under den ENE
         knappen i toppbaren og bryter opp silhuetten hennes — i lyst tema, der
         ring-fargen hadde mest kontrast mot flata, ser det ut som et grafisk
         element knappen har falt oppå. En dekorasjon som konkurrerer med en
         kontroll om det samme hjørnet, taper. -->
    <div class="sticky top-0 z-20 relative
                bg-surface/80 backdrop-blur border-b border-ink/10">
      <div class="relative mx-auto w-full max-w-[700px] px-3 py-2.5 flex items-center gap-2">
        <AppMenuButton variant="header" />
        <div class="flex-1 text-[15px] font-semibold text-ink">Så i lende</div>
      </div>
    </div>

    <!-- Innhold i en midtstilt spalte med samme maksbredde som modalene (700 px)
         — på en bred skjerm strakk listene seg tidligere over hele vinduet, med
         kartnavnet i venstre kant og knappene nesten en halvmeter unna (v2.4.17).
         Siden scroller selv (ingen indre overflow-container), så mobil-nettleserens
         adressefelt oppfører seg normalt. Global tekststørrelse skalerer flaten. -->
    <div class="mx-auto w-full max-w-[700px] px-4 pt-4 pb-32" :style="{ zoom: uiTextScale }">
      <MapLibrary v-model:tab="activeTab" @open-picker="apnePicker"
                  @fritt-lende="goFrittLende" />
    </div>
  </div>
</template>
