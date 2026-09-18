<script setup>
// Drawer-fane «Utvikler» (debug-hjelp), skilt ut fra MapView v1.0.8.
// Vardåsen-referansekart, Zoom-LOD-tuning (runtime-parametre), debug-tellere
// (fliser, viewport-culling, Sjøkart-WFS), diagnose-modus, lilla-stier-A/B og
// perf-logg-åpner.
import { computed, ref } from 'vue'
import { LOD_DEFAULTS } from '../../composables/useLodTuning.js'
import { APP_VERSION } from '../../version.js'

const appVersion = APP_VERSION

const props = defineProps({
  scale: { type: Number, default: 1 },
  zoomTier: { type: String, default: 'far' },
  resetLodTuning: { type: Function, required: true },
  mapDataLabel: { type: String, default: '' },
  autoTileCount: { type: Number, default: 0 },
  maxTiles: { type: Number, default: 0 },
  cullStats: { type: Object, default: () => ({ indexed: 0, culled: 0, ms: 0, ghostFliser: 0, ghostHele: 0, ghostIndeksert: 0, ghostCulled: 0 }) },
  mosaikkStats: { type: Object, default: () => ({ modellert: 0, noder: 0, festet: 0, tak: 0 }) },
  // Automatisk flis-påfyll: hva triggeren ser akkurat nå. Uten denne raden er
  // «hvorfor bygde den ikke?» ikke et spørsmål man kan svare på fra en mobil.
  cullDisabled: { type: Boolean, default: false },
  toggleCull: { type: Function, required: true },
  sjokartStatusText: { type: String, default: '' },
  nveInnsjoStatusText: { type: String, default: '' },
  turruteStatusText: { type: String, default: '' },
  n50StiStatusText: { type: String, default: '' },
  meta: { type: Object, default: null },
  openVardasen: { type: Function, required: true },
  openPerfLog: { type: Function, required: true },
})

// Vær-demo i 3D. Flagget bor i localStorage framfor å gå gjennom MapView, fordi
// 3D-viseren er den som skal lese det, og den monteres først etterpå — en prop
// gjennom hele kjeden for en utviklerbryter er ikke verdt seks ekstra ledd.
const VAERDEMO_KEY = 'lende-3d-vaerdemo'
const vaerDemo = ref((() => {
  try { return localStorage.getItem(VAERDEMO_KEY) === '1' } catch { return false }
})())
function toggleVaerDemo() {
  vaerDemo.value = !vaerDemo.value
  try { localStorage.setItem(VAERDEMO_KEY, vaerDemo.value ? '1' : '0') } catch { /* privat modus */ }
}

// Myk tekstrotasjon i kartet. Samme localStorage-mønster som demoene under, men
// motsatt polaritet: den er PÅ som standard, og bryteren finnes for å slå den AV
// i felt. Grunnen er at effekten er en YTELSES-avveining (se lib/mykRotasjon.js)
// — kjennes en rotasjons-gest hakkete på en gammel telefon, er dette den ene
// tingen å prøve å skru av for å vite om det er stedsnavnene som koster.
// Budsjettet slår seg av selv når det MÅLER at det ikke går; denne bryteren er
// for å sammenlikne før man tror på tallet.
const MYKROT_KEY = 'lende-myk-rotasjon'
const mykRotAv = ref((() => {
  try { return localStorage.getItem(MYKROT_KEY) === '0' } catch { return false }
})())
function toggleMykRot() {
  mykRotAv.value = !mykRotAv.value
  try { localStorage.setItem(MYKROT_KEY, mykRotAv.value ? '0' : '1') } catch { /* privat modus */ }
}

// Nordlys-demo i 3D. Samme mønster som vær-demoen, og grunnen er en sterkere
// utgave av den samme: et synlig nordlys over Sør-Norge er noe som skjer noen
// netter i året, så uten demoen kan laget i praksis ikke prøves i det hele tatt.
// Foldene, strålenes drift og pulseringen er dessuten ren BEVEGELSE, som
// vinddriften og lyn-blinket.
const NORDLYSDEMO_KEY = 'lende-3d-nordlysdemo'
const nordlysDemo = ref((() => {
  try { return localStorage.getItem(NORDLYSDEMO_KEY) === '1' } catch { return false }
})())
function toggleNordlysDemo() {
  nordlysDemo.value = !nordlysDemo.value
  try {
    localStorage.setItem(NORDLYSDEMO_KEY, nordlysDemo.value ? '1' : '0')
  } catch { /* privat modus */ }
}

// TVUNGNE HIMMELLEGEMER BOR I PREFERANSE-FANA FRA v7.8.34, ikke her.
// Bryteren løfter månen, Mars, Jupiter og Saturn over horisonten så de fire
// globene kan prøves når som helst. Den sto her fordi den ble laget for å
// TESTE globene — men denne fana er `userOnly`, altså skjult på demokartet, og
// det er nettopp det kartet en fersk bruker har. En bryter som bare finnes for
// den som alt har bygget sitt eget kart er en bryter ingen finner.
// Nøkkelen er uendret (`lende-3d-himmel-tvang`), så et valg gjort før flyttinga
// står. Se DrawerPrefsTab.vue.
const metaAppVersionText = computed(() => props.meta?.appVersion ?? null)

// Tetthets-linja: «915 /km² · svært tett → sparsom · bredde 8 → 6 km».
// meta.tetthet er null på kart bygget før v5.0.0 og på kart der sonderingen
// ikke kjørte (nett nede) — da vises ingen linje i stedet for et falskt «full».
const tetthetTekst = computed(() => {
  const t = props.meta?.tetthet
  if (!t || !Number.isFinite(Number(t.indeks))) return ''
  const deler = [`${Math.round(t.indeks)} /km²`, t.klasse]
  const nivaa = props.meta?.detaljNivaa
  if (nivaa && nivaa !== 'full') deler.push(`→ ${nivaa}`)
  if (Number.isFinite(t.fraBreddeKm) && Number.isFinite(t.tilBreddeKm) &&
      t.tilBreddeKm !== t.fraBreddeKm) {
    deler.push(`bredde ${t.fraBreddeKm} → ${t.tilBreddeKm} km`)
  }
  return deler.join(' · ')
})

const zoomNearThreshold = defineModel('zoomNearThreshold', { type: Number, default: 2.5 })
const nameBudgetFar = defineModel('nameBudgetFar', { type: Number, default: 60 })
const nameBudgetMid = defineModel('nameBudgetMid', { type: Number, default: 130 })
const nameBudgetNear = defineModel('nameBudgetNear', { type: Number, default: 250 })
const diagnose = defineModel('diagnose', { type: Boolean, default: false })
</script>

<template>
  <div>
    <!-- Vardåsen-referansekartet: bygges fra ekte Kartverket-data i CI og er
         nyttig som fast fasit ved feilsøk. -->
    <button @click="openVardasen"
            class="w-full mb-3 px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                   flex items-center justify-center gap-2 transition
                   bg-ink/5 border-ink/10 text-ink-2">
      <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6 L9 4 L15 6 L21 4 L21 18 L15 20 L9 18 L3 20 Z"/>
        <path d="M9 4 V18 M15 6 V20"/>
      </svg>
      <span class="font-medium">Åpne Vardåsen-referansekart</span>
    </button>

    <!-- Zoom-LOD: live-indikator + justerbare terskler. Endrer kun
         RUNTIME-parametre (når .zoom-near settes + navne-budsjett). Hvilke
         lag som gates er bakt inn i kartets CSS ved bygging. -->
    <div class="rounded-lg bg-ink/5 px-3 py-2.5 mb-3">
      <div class="flex items-baseline justify-between gap-2 mb-1.5">
        <span class="text-ink-3 text-[11px] uppercase tracking-wide">Zoom-LOD</span>
        <span class="text-[11px] tabular-nums"
              :class="{ 'text-ink-4': zoomTier === 'far', 'text-sky-300': zoomTier === 'mid', 'text-emerald-300': zoomTier === 'near' }">
          {{ (scale || 1).toFixed(2) }}× · {{ zoomTier }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-ink-3 text-[11px]">Detalj-terskel (.zoom-near)</span>
        <span class="text-ink-3 text-[11px] tabular-nums">{{ zoomNearThreshold.toFixed(1) }}×</span>
      </div>
      <input type="range" min="1.5" max="5" step="0.1" v-model.number="zoomNearThreshold"
             aria-label="Detalj-terskel" class="w-full accent-emerald-400 mb-2"/>
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span class="text-ink-3 text-[11px]">Navne-budsjett (far/mid/near)</span>
        <span class="text-ink-3 text-[11px] tabular-nums">{{ nameBudgetFar }}/{{ nameBudgetMid }}/{{ nameBudgetNear }}</span>
      </div>
      <input type="range" min="20" max="150" step="10" v-model.number="nameBudgetFar"
             aria-label="Navne-budsjett oversikt" class="w-full accent-ink/40"/>
      <input type="range" min="40" max="250" step="10" v-model.number="nameBudgetMid"
             aria-label="Navne-budsjett mellomnivå" class="w-full accent-sky-400"/>
      <input type="range" min="80" max="500" step="10" v-model.number="nameBudgetNear"
             aria-label="Navne-budsjett detalj" class="w-full accent-emerald-400"/>
      <button @click="resetLodTuning"
              class="mt-1.5 w-full px-3 py-1.5 rounded-lg text-[11px] border
                     bg-ink/5 border-ink/10 text-ink-2 active:scale-[0.98]">
        Nullstill ({{ LOD_DEFAULTS.near }}× · {{ LOD_DEFAULTS.budgetFar }}/{{ LOD_DEFAULTS.budgetMid }}/{{ LOD_DEFAULTS.budgetNear }})
      </button>
    </div>

    <div class="flex items-baseline justify-between gap-2 mb-2">
      <span class="text-ink-3 text-[11px] uppercase tracking-wide">Debug</span>
      <span v-if="mapDataLabel" class="text-ink-4 text-[11px] tabular-nums">{{ mapDataLabel }}</span>
    </div>
    <!-- Tile-cache: antall auto-fliser lagret (scroll-tilbake-mosaikk). -->
    <div class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Auto-fliser i cache</span>
      <span class="text-ink-3 text-[11px] tabular-nums">{{ autoTileCount }} / {{ maxTiles }}</span>
    </div>
    <!-- Mosaikk-nivåene (v6.5.74): modellert = alle grid-kompatible nabofliser
         useGhostTiles kjenner, noder = de som er parset inn i minnet, festet =
         de som faktisk henger i #ghost-tiles. Står «noder» stille på taket
         mens «modellert» er høyere, tegnes ikke hele arket — det var nettopp
         den feilen som var usynlig fram til denne målingen fantes. -->
    <div v-if="mosaikkStats.modellert" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Mosaikk-noder</span>
      <span class="text-ink-3 text-[11px] tabular-nums">
        {{ mosaikkStats.festet }} festet / {{ mosaikkStats.noder }} noder /
        {{ mosaikkStats.modellert }} modellert · tak {{ mosaikkStats.tak }}
      </span>
    </div>
    <!-- Viewport-culling: hvor mange indekserte elementer som er skjult
         utenfor utsnittet akkurat nå + siste cull-beregning i ms. -->
    <div class="flex items-center justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Viewport-culling</span>
      <span v-if="!cullDisabled && cullStats.indexed" class="text-ink-3 text-[11px] tabular-nums">
        {{ cullStats.culled }} / {{ cullStats.indexed }} skjult · {{ cullStats.ms }} ms
      </span>
      <!-- Feilsøk: culling av/på uten reload. Forsvinner «borte» innhold
           tilbake når den slås AV, er culling synderen — ellers dataene. -->
      <button @click="toggleCull()"
              class="px-2 py-1 rounded-md border text-[11px] active:scale-[0.98]"
              :class="cullDisabled
                      ? 'bg-amber-400/20 border-amber-300/50 text-amber-200'
                      : 'bg-ink/5 border-ink/10 text-ink-2'">
        {{ cullDisabled ? 'AV — slå på' : 'Slå av' }}
      </button>
    </div>
    <!-- Spøkelses-culling (v6.5.73): hvor mange nabofliser som er festet, hvor
         mange av dem som er skjult i sin helhet, og per-element-tallet for de
         som ligger delvis inne. Målingen er hele grunnen til at tiltaket kan
         vurderes i felt i stedet for å gjettes på. -->
    <div v-if="!cullDisabled && cullStats.ghostFliser"
         class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Spøkelses-culling</span>
      <span class="text-ink-3 text-[11px] tabular-nums">
        {{ cullStats.ghostHele }} / {{ cullStats.ghostFliser }} fliser skjult ·
        {{ cullStats.ghostCulled }} / {{ cullStats.ghostIndeksert }} elementer
      </span>
    </div>
    <!-- Datatetthet: hva sonderingen fant, og hva den gjorde med kartet. Eneste
         sporet av HVORFOR et kart ble lettere eller mindre enn brukeren ba om. -->
    <div v-if="tetthetTekst" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Datatetthet</span>
      <span class="text-ink-3 text-[11px] text-right">{{ tetthetTekst }}</span>
    </div>
    <!-- Sjøkart-status: WFS-hentingen feiler stille (timeout/CORS/tom) —
         her vises HVORFOR dybdetall/kai mangler på kystkart. -->
    <div v-if="sjokartStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink-4 text-[11px]">Sjøkart-WFS</span>
        <span class="text-[11px]"
              :class="meta?.sjokartStatus?.state === 'ok' ? 'text-ink-3' : 'text-amber-300/80'">
          {{ sjokartStatusText }}
        </span>
      </div>
      <div v-for="(err, i) in (meta?.sjokartStatus?.errors ?? [])" :key="i"
           class="text-ink-4 text-[10px] leading-tight break-all">
        {{ err.endpoint }}{{ err.typeName ? ` ${err.typeName}` : '' }} · {{ err.kind }}: {{ err.message }}
      </div>
    </div>
    <!-- Hvilken app-versjon ARKET ble bygd med (≠ appen som viser det).
         Avgjør på sekundet om en «kartet mangler X»-feil bare er et gammelt
         ark: bygd-med ≠ kjørende versjon → bygg kartet på nytt. -->
    <div v-if="meta" class="flex items-baseline justify-between gap-2 mb-2 px-1">
      <span class="text-ink-4 text-[11px]">Kart bygd med</span>
      <span class="text-[11px]" :class="metaAppVersionText === appVersion ? 'text-ink-3' : 'text-amber-300/80'">
        {{ metaAppVersionText === appVersion ? `v${metaAppVersionText}` : `${metaAppVersionText ? 'v' + metaAppVersionText : 'eldre enn v1.0.47'} — app kjører v${appVersion}; bygg på nytt for ferske data` }}
      </span>
    </div>
    <!-- NVE-innsjø-status: innsjøene hentes live ved bygging — her vises
         HVORFOR innsjøer eventuelt mangler (stille nett-/CORS-feil på mobil).
         Vises ALLTID når kart-meta finnes; mangler status er det i seg selv
         diagnosen (ark bygd før v1.0.45). -->
    <div v-if="nveInnsjoStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink-4 text-[11px]">NVE-innsjø</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.nveInnsjoStatus?.state === 'ok' ? 'text-ink-3' : 'text-amber-300/80'">
          {{ nveInnsjoStatusText }}
        </span>
      </div>
    </div>
    <!-- Turrutebasen (merkede fotruter fra Kartverket). Samme grunn som raden
         over: WFS-en kan feile stille på mobil, og «nye» forteller i tillegg
         hvor mye som faktisk kom i tillegg til OSM etter uttynningen. -->
    <div v-if="turruteStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink-4 text-[11px]">Turrutebasen</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.turruteStatus?.state === 'ok' ? 'text-ink-3' : 'text-amber-300/80'">
          {{ turruteStatusText }}
        </span>
      </div>
    </div>
    <!-- N50-stinettet fra statiske fliser. «nye» viser hvor mye som kom i
         tillegg til OSM og Turrutebasen etter uttynningen. -->
    <div v-if="n50StiStatusText" class="mb-2 px-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-ink-4 text-[11px]">N50-sti</span>
        <span class="text-[11px] text-right break-all"
              :class="meta?.n50StiStatus?.state === 'ok' ? 'text-ink-3' : 'text-amber-300/80'">
          {{ n50StiStatusText }}
        </span>
      </div>
    </div>
    <button @click="diagnose = !diagnose"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-2"
            :class="diagnose
                    ? 'bg-slate-400/20 border-slate-300/50 text-ink'
                    : 'bg-ink/5 border-ink/10 text-ink-2'">
      {{ diagnose ? 'Diagnose: AV' : 'Diagnose-modus' }}
    </button>
    <div v-if="diagnose" class="text-[10px] text-ink-3 leading-relaxed mb-3 px-1">
      Polygon-fargen viser kilden:
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(180, 80%, 55%);"></span> N50,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(140, 70%, 45%);"></span> NVE innsjø,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(220, 80%, 60%);"></span> OSM way,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(300, 80%, 60%);"></span> OSM relation,
      <span class="inline-block w-3 h-3 rounded-sm align-middle" style="background: hsl(45, 90%, 55%);"></span> merged.
    </div>
    <!-- Myk tekstrotasjon: leses av useSymbolRenderers ved montering, så et
         bytte krever et nytt kart-besøk (samme kontrakt som demo-flaggene). -->
    <button @click="toggleMykRot"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-1"
            :class="mykRotAv
                    ? 'bg-amber-400/20 border-amber-300/50 text-amber-200'
                    : 'bg-ink/5 border-ink/10 text-ink-2'">
      {{ mykRotAv ? 'Myk tekstrotasjon: AV' : 'Myk tekstrotasjon: PÅ' }}
    </button>
    <div class="text-[10px] text-ink-3 leading-relaxed mb-3 px-1">
      <template v-if="mykRotAv">
        Stedsnavn vipper med kartet under en rotasjons-gest og rettes opp når du
        slipper. Åpne kartet på nytt for at endringen skal slå inn.
      </template>
      <template v-else>
        Stedsnavn står vannrett hele veien mens du roterer. Slår seg av selv om
        passene sprenger frame-budsjettet — se perf-loggen.
      </template>
    </div>
    <!-- Vær-demo i 3D: går gjennom værtypene, 10 s hver. Finnes fordi flere av
         uttrykkene er ren BEVEGELSE (vinddrift, lyn-blink, fallende nedbør) og
         ikke kan vurderes på et stillbilde. -->
    <button @click="toggleVaerDemo"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-1"
            :class="vaerDemo
                    ? 'bg-sky-400/20 border-sky-300/50 text-ink'
                    : 'bg-ink/5 border-ink/10 text-ink-2'">
      {{ vaerDemo ? 'Vær-demo i 3D: PÅ' : 'Vær-demo i 3D' }}
    </button>
    <div v-if="vaerDemo" class="text-[10px] text-ink-3 leading-relaxed mb-3 px-1">
      Åpne 3D: værtypene spilles i rekkefølge, 10 s hver, med «neste» for å hoppe
      videre. Overstyrer det ekte varselet så lenge den står på.
    </div>
    <!-- Nordlys-demo i 3D: går gjennom styrkene, 14 s hver. Finnes fordi et
         synlig nordlys over Sør-Norge er noen netter i året — uten demoen kan
         laget i praksis ikke prøves. -->
    <button @click="toggleNordlysDemo"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98] mb-1"
            :class="nordlysDemo
                    ? 'bg-emerald-400/20 border-emerald-300/50 text-ink'
                    : 'bg-ink/5 border-ink/10 text-ink-2'">
      {{ nordlysDemo ? 'Nordlys-demo i 3D: PÅ' : 'Nordlys-demo i 3D' }}
    </button>
    <div v-if="nordlysDemo" class="text-[10px] text-ink-3 leading-relaxed mb-3 px-1">
      Åpne 3D og slå på NATT: styrkene spilles i rekkefølge, 14 s hver, fra et
      svakt slør lavt i nord til et som fyller himmelen. Siste steg viser samme
      styrke lenger nord, så du ser at høyden over horisonten faktisk regnes ut.
      Overstyrer det ekte varselet så lenge den står på.
    </div>
    <!-- Byggetider (perf): viser localStorage-loggen så den kan kopieres
         og deles — mobil-konsollen er upraktisk. -->
    <button @click="openPerfLog"
            class="w-full px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]
                   bg-ink/5 border-ink/10 text-ink-2">
      Byggetider (perf-logg)
    </button>
  </div>
</template>
