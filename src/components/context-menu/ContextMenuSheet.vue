<script setup>
// Long-press-kontekstmenyen (bottom-sheet), skilt ut fra MapView v1.0.8.
// Template-kroppen er flyttet verbatim: verdier inn som props, handlinger som
// funksjons-props. De to DOM-referansene forelderen trenger (arket for
// into-focus, detalj-inset-verten for det imperative mini-kartet) leveres
// tilbake via funksjons-refs (setSheetEl/setInsetEl) — forelderens
// buildDetailInset/attachInsetPanZoom er uendret.
import { ANNOTATION_SYMBOLS } from '../../composables/useMapAnnotations.js'
import AnnotationIcon from '../AnnotationIcon.vue'
import { formatDistanceM } from '../../lib/mapContext.js'

defineProps({
  contextMenuOpen: { type: Boolean, default: false },
  contextMenuInfo: { type: Object, default: null },
  contextDrawer: { type: Object, required: true },
  setSheetEl: { type: Function, required: true },
  setInsetEl: { type: Function, required: true },
  contextActionState: { type: String, default: 'idle' },
  uiTextScale: { type: Number, default: 1 },
  DETAIL_INSET_M: { type: Number, default: 500 },
  lakeQuery: { type: Object, default: null },
  verneQuery: { type: Object, default: null },
  naturtypeQuery: { type: Object, default: null },
  placeWikiCard: { type: Object, default: null },
  expandedRedCat: { type: String, default: null },
  mapDataLabel: { type: String, default: '' },
  ctxCanNavigate: { type: Boolean, default: false },
  ctxCanMeasure: { type: Boolean, default: false },
  ctxCanAnnotate: { type: Boolean, default: false },
  ctxBusy: { type: Boolean, default: false },
  ctxTooFarToArm: { type: Boolean, default: false },
  ctxDistFromUser: { type: Number, default: null },
  proximityPanelOpen: { type: Boolean, default: false },
  proximityCfg: { type: Object, required: true },
  proximity: { type: Object, required: true },
  userPos: { type: Object, required: true },
  poiCounts: { type: Object, default: () => ({}) },
  measureMode: { type: [Boolean, String], default: false },
  closeContextMenu: { type: Function, required: true },
  onCopyCoords: { type: Function, required: true },
  formatAreaKm2: { type: Function, required: true },
  formatVolum: { type: Function, required: true },
  formatVernedato: { type: Function, required: true },
  formatCount: { type: Function, required: true },
  redListCats: { type: Function, required: true },
  redListGroups: { type: Function, required: true },
  toggleRedCat: { type: Function, required: true },
  sourceLabel: { type: Function, required: true },
  naturtypeVerdiClass: { type: Function, required: true },
  onShareMap: { type: Function, required: true },
  onShareMapWithContextPlace: { type: Function, required: true },
  onNavigateHere: { type: Function, required: true },
  onRoundTripHere: { type: Function, required: true },
  onStartMeasureHere: { type: Function, required: true },
  toggleProximityPanel: { type: Function, required: true },
  armProximityAlert: { type: Function, required: true },
  startPositioning: { type: Function, required: true },
  nearestPoiFromPoint: { type: Function, required: true },
  onPlaceAnnotationFromContext: { type: Function, required: true },
  showInfoTip: { type: Boolean, default: false },
  dismissInfoTip: { type: Function, required: true },
})

function formatDistance(m) {
  if (!m) return '0 m'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}
</script>

<template>
<Transition name="overlay-fade">
  <div v-if="contextMenuOpen && contextMenuInfo"
       class="absolute inset-0 z-40 flex items-end justify-center transition-colors duration-200"
       :class="contextDrawer.isMaximized.value ? 'bg-black/60' : 'bg-transparent pointer-events-none'"
       @click.self="closeContextMenu">
    <div :ref="setSheetEl"
         class="w-full bg-zinc-900 border-t border-white/10 rounded-t-2xl flex flex-col pointer-events-auto"
         :style="contextDrawer.drawerHeightStyle.value">
      <!-- Dra-håndtak: dra opp for å maksimere (~85dvh), ned for standard.
           Romslig hit-flate (pt-3.5 pb-3) så tappen er lett å treffe. -->
      <div class="shrink-0 touch-none cursor-grab active:cursor-grabbing pt-3.5 pb-3 flex justify-center"
           @pointerdown="contextDrawer.onPointerDown($event)"
           @pointermove="contextDrawer.onPointerMove($event)"
           @pointerup="contextDrawer.onPointerUp($event)"
           @pointercancel="contextDrawer.onPointerUp($event)">
        <div class="w-12 h-1.5 rounded-full bg-white/40"
             :style="{ opacity: contextDrawer.handleOpacity.value }"></div>
      </div>
      <!-- Header: koordinater + lukk -->
      <div class="shrink-0 px-4 pb-2.5 bg-zinc-900/95
                  border-b border-white/8 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wide text-white/45">Punkt</div>
          <div class="flex items-center gap-2">
            <div class="text-white text-[13px] font-mono tabular-nums">
              {{ contextMenuInfo.lat.toFixed(5) }}, {{ contextMenuInfo.lon.toFixed(5) }}
            </div>
            <!-- Snarvei: kopier koordinater uten å scrolle ned til
                 handlings-knappene under detalj-inset-en. Samme handler +
                 tilstands-feedback som knappen der nede. -->
            <button @click="onCopyCoords"
                    aria-label="Kopier koordinater"
                    class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center
                           border active:scale-90 transition"
                    :class="contextActionState === 'copied'
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                            : contextActionState === 'failed'
                              ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                              : 'bg-white/5 border-white/10 text-white/60'">
              <svg v-if="contextActionState !== 'copied'" viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="11" height="11" rx="2"/>
                <path d="M5 15 V5 a2 2 0 0 1 2 -2 h10"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                   stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
          <div v-if="!contextMenuInfo.inside" class="text-[10px] text-amber-300 mt-0.5">
            Utenfor kart-utsnittet
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button @click="closeContextMenu"
                  aria-label="Lukk"
                  class="w-8 h-8 -mr-1 -mt-0.5 rounded-full flex items-center justify-center
                         bg-white/5 border border-white/10 text-white/70 active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <!-- Scrollbar kropp: detalj-inset (uten zoom) + tekst-info (zoom-bar).
           Skjult når skuffen er minimert (v11.0.61) → kun koordinat-header
           peeker, lik hovedmenyen. -->
      <div v-show="!contextDrawer.isMinimized.value"
           class="flex-1 overflow-y-auto"
           :style="{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">

      <!-- Blått oppdagbarhets-tips: vises kun når arket åpnes via Info-snarveien
           (ikke ved faktisk long-press). Dismissible, husket i localStorage. -->
      <div v-if="showInfoTip" class="px-4 pt-3">
        <div class="relative flex items-start gap-2.5 rounded-lg px-3 py-2.5 pr-9
                    bg-sky-500/15 border border-sky-400/40 text-sky-50/95 text-[12px] leading-snug">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 mt-0.5 text-sky-300" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
            <line x1="12" y1="8" x2="12" y2="8"/>
          </svg>
          <div>
            <span class="font-semibold">Tips:</span> du kan trykke-og-holde et par
            sekunder i kartet for å åpne infopanelet du ser her. Det samme fungerer på
            de tre knottene nede til høyre for å finjustere kantlinjer, relieff og zoom.
          </div>
          <button @click="dismissInfoTip" aria-label="Skjul tips"
                  class="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-md
                         text-sky-100/80 active:scale-90 active:bg-white/10">
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Detalj-inset: roambart 500×500 m utsnitt (start 250 m) med alle
           detaljer (dybdetall, dybdekurver, sjø-POI) avslørt. Pan + zoom,
           ingen rotasjon. Fungerer uten GPS. Vises KUN når skuffen er
           maksimert — ellers ser man samme utsnitt/crosshair dobbelt (kartet
           bak + minikartet). -->
      <div v-if="contextDrawer.isMaximized.value" class="px-4 pt-3">
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-[10px] uppercase tracking-wide text-white/45">
            Detaljer · {{ DETAIL_INSET_M }} × {{ DETAIL_INSET_M }} m
          </span>
          <span class="text-[10px] text-white/30">dra · knip for zoom</span>
        </div>
        <div :ref="setInsetEl"
             class="w-[90%] aspect-[16/9] max-w-[380px] mx-auto rounded-lg overflow-hidden
                    border border-white/10 bg-[#fefae0] touch-none"></div>
      </div>

      <!-- Tekst-info-blokk: skaleres av tekststørrelse-kontrollen (zoom). -->
      <div :style="{ zoom: uiTextScale }">
      <!-- Info-seksjon: høyde / sted / sti / avstand-fra-deg -->
      <div class="px-4 pt-3 space-y-1.5">
        <!-- Innsjø med ekte data fra NVE Innsjødatabase (+ HydAPI sanntid). -->
        <template v-if="lakeQuery?.status === 'done'">
          <div class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Vannflate</span>
            <span class="text-white font-medium tabular-nums">
              {{ Math.round(lakeQuery.lake.hoyde) }} moh<template v-if="lakeQuery.lake.navn"><span class="text-white/55 font-normal"> · {{ lakeQuery.lake.navn }}</span></template>
            </span>
          </div>
          <!-- Dyp (bathymetri) — kun for oppmålte innsjøer. -->
          <div v-if="lakeQuery.lake.maxDybde != null"
               class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Dyp</span>
            <span class="text-white tabular-nums">
              maks {{ Math.round(lakeQuery.lake.maxDybde) }} m<template v-if="lakeQuery.lake.midDybde != null"><span class="text-white/55"> · snitt {{ Math.round(lakeQuery.lake.midDybde) }} m</span></template>
            </span>
          </div>
          <!-- Areal / volum når NVE har det. -->
          <div v-if="lakeQuery.lake.arealKm2 != null || lakeQuery.lake.volumMillM3 != null"
               class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Areal</span>
            <span class="text-white/80 tabular-nums">
              <template v-if="lakeQuery.lake.arealKm2 != null">{{ formatAreaKm2(lakeQuery.lake.arealKm2) }} km²</template><template v-if="lakeQuery.lake.volumMillM3 != null"><span class="text-white/55"><template v-if="lakeQuery.lake.arealKm2 != null"> · </template>{{ formatVolum(lakeQuery.lake.volumMillM3) }}</span></template>
            </span>
          </div>
          <!-- Regulert vannkraftmagasin. -->
          <div v-if="lakeQuery.lake.magasin"
               class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Magasin</span>
            <span class="text-white/80">
              Regulert<template v-if="lakeQuery.lake.magasin.navn"><span class="text-white/55"> · {{ lakeQuery.lake.magasin.navn }}</span></template>
            </span>
          </div>
          <!-- Sanntid fra HydAPI (vannstand / temperatur) når tilgjengelig. -->
          <div v-if="lakeQuery.live?.waterLevel"
               class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Vannstand</span>
            <span class="text-white/80 tabular-nums">
              {{ lakeQuery.live.waterLevel.value.toFixed(2) }} moh<span class="text-white/45"> · {{ lakeQuery.live.stationName }}</span>
            </span>
          </div>
          <div v-if="lakeQuery.live?.waterTemp"
               class="flex items-baseline gap-2 text-[12px]">
            <span class="text-white/45 w-20 shrink-0">Vanntemp</span>
            <span class="text-white/80 tabular-nums">{{ lakeQuery.live.waterTemp.value.toFixed(1) }} °C</span>
          </div>
        </template>
        <!-- Vann, men NVE ennå ikke svart. -->
        <div v-else-if="contextMenuInfo.isWater && lakeQuery?.status === 'loading'"
             class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">Vannflate</span>
          <span class="text-white/50">henter innsjøhøyde …</span>
        </div>
        <!-- Vann, men NVE har ingen registrert innsjøhøyde her (eller var
             utilgjengelig) — ærlig svar, aldri en falsk 0. -->
        <div v-else-if="contextMenuInfo.isWater"
             class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">Høyde</span>
          <span class="text-white/70">
            Vannflate-høyde ikke tilgjengelig
          </span>
        </div>
        <!-- Land: DEM-høyde. -->
        <div v-else-if="contextMenuInfo.elevationM != null"
             class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">Høyde</span>
          <span class="text-white font-medium tabular-nums">
            {{ Math.round(contextMenuInfo.elevationM) }} moh
          </span>
        </div>
        <div v-if="contextMenuInfo.place"
             class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">{{ contextMenuInfo.place.onFeature ? 'Sted' : 'Nærmest' }}</span>
          <span class="text-white truncate">
            {{ contextMenuInfo.place.name }}
            <span v-if="!contextMenuInfo.place.onFeature" class="text-white/55 tabular-nums">
              · {{ formatDistanceM(contextMenuInfo.place.distM) }}
            </span>
          </span>
        </div>
        <div v-if="contextMenuInfo.fromUser"
             class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">Fra deg</span>
          <span class="text-white">
            {{ contextMenuInfo.fromUser.compass }}
            <span class="text-white/55 tabular-nums">
              · {{ formatDistanceM(contextMenuInfo.fromUser.distM) }}
            </span>
          </span>
        </div>
        <div v-if="mapDataLabel" class="flex items-baseline gap-2 text-[12px]">
          <span class="text-white/45 w-20 shrink-0">Kartdata</span>
          <span class="text-white/85 tabular-nums">{{ mapDataLabel }}</span>
        </div>
      </div>

      <!-- Verneområde: Naturbase-metadata + GBIF-arter + Wikipedia.
           Vises kun når long-press traff et verneområde. -->
      <div v-if="verneQuery?.status === 'done'" class="px-4 pt-3">
        <div class="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 space-y-2">
          <div class="flex items-start gap-2">
            <svg viewBox="0 0 24 24" class="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6"/>
            </svg>
            <div class="min-w-0">
              <div class="text-emerald-100 font-semibold text-[13px] leading-tight">
                {{ verneQuery.area.navn }}
              </div>
              <div v-if="verneQuery.area.verneform" class="text-emerald-200/80 text-[11px]">
                {{ verneQuery.area.verneform }}
              </div>
            </div>
          </div>

          <div class="space-y-1 text-[12px]">
            <div v-if="verneQuery.area.vernedato" class="flex items-baseline gap-2">
              <span class="text-emerald-200/55 w-20 shrink-0">Vernet</span>
              <span class="text-emerald-50 tabular-nums">{{ formatVernedato(verneQuery.area.vernedato) }}</span>
            </div>
            <div v-if="verneQuery.area.arealKm2 != null" class="flex items-baseline gap-2">
              <span class="text-emerald-200/55 w-20 shrink-0">Areal</span>
              <span class="text-emerald-50 tabular-nums">{{ formatAreaKm2(verneQuery.area.arealKm2) }} km²</span>
            </div>
            <div v-if="verneQuery.area.forvaltning" class="flex items-baseline gap-2">
              <span class="text-emerald-200/55 w-20 shrink-0">Forvaltning</span>
              <span class="text-emerald-50/90 truncate">{{ verneQuery.area.forvaltning }}</span>
            </div>

            <!-- Observerte rødlistearter: arter med GBIF-funn innenfor
                 verneområde-polygonet, snittet mot Norsk rødliste 2021.
                 IKKE vernegrunnlaget/verneforskriften — derfor kan streif-
                 observasjoner (f.eks. en lomvi på en innlands-øy) dukke opp.
                 Trykk en kategori (CR/EN/VU/NT) for å folde ut artene,
                 gruppert etter dyre-/plantegruppe. -->
            <div v-if="verneQuery.species === 'loading'" class="flex items-baseline gap-2">
              <span class="text-emerald-200/55 w-20 shrink-0">Rødlistet</span>
              <span class="text-emerald-200/50">vurderer arter …</span>
            </div>
            <template v-else-if="verneQuery.species && verneQuery.species.redListNo && verneQuery.species.redListNo.count > 0">
              <div class="flex items-baseline gap-2">
                <span class="text-emerald-200/70 font-medium">Observerte rødlistearter</span>
                <span class="text-rose-200 tabular-nums shrink-0">· {{ formatCount(verneQuery.species.redListNo.count) }}</span>
              </div>
              <!-- Klikkbare kategori-chips -->
              <div class="flex flex-wrap gap-1.5">
                <button v-for="c in redListCats(verneQuery.species.redListNo.byCategory)" :key="c.code"
                        type="button" :title="c.label" @click="toggleRedCat(c.code)"
                        class="px-2 py-0.5 rounded-md border text-[11px] tabular-nums transition"
                        :class="[c.cls, expandedRedCat === c.code ? 'ring-1 ring-white/50' : '']">
                  {{ c.code }} {{ verneQuery.species.redListNo.byCategory[c.code] }}
                </button>
              </div>
              <!-- Utvidet, gruppert artsliste for valgt kategori -->
              <div v-if="expandedRedCat" class="pr-1 pt-1 space-y-2">
                <div v-for="grp in redListGroups(verneQuery.species.redListNo, expandedRedCat)" :key="grp.group">
                  <div class="text-emerald-200/70 text-[11px] font-medium">
                    {{ grp.group }} <span class="text-emerald-200/40">· {{ grp.species.length }}</span>
                  </div>
                  <ul class="mt-0.5 space-y-0.5">
                    <li v-for="sp in grp.species" :key="sp.key" class="leading-snug text-[11px]">
                      <span v-if="sp.vern" class="text-emerald-50">{{ sp.vern }}</span><span
                            class="text-emerald-200/55 italic">{{ sp.vern ? ' · ' : '' }}{{ sp.sci }}</span>
                    </li>
                  </ul>
                </div>
                <div v-if="!verneQuery.species.redListNo.species || verneQuery.species.redListNo.species.length === 0"
                     class="text-emerald-200/45 text-[11px] italic">
                  Artsnavn oppdateres ved neste datagenerering.
                </div>
              </div>
            </template>
            <div v-else-if="verneQuery.species" class="flex items-baseline gap-2">
              <span class="text-emerald-200/55 w-20 shrink-0">Rødlistet</span>
              <span class="text-emerald-200/50">ingen observerte rødlistearter</span>
            </div>
          </div>

          <!-- Leksikon-ingress (SNL foretrukket, Wikipedia fallback) -->
          <div v-if="verneQuery.wiki && verneQuery.wiki !== 'loading' && verneQuery.wiki.extract"
               class="text-[12px] text-emerald-50/80 leading-snug border-t border-emerald-400/15 pt-2">
            {{ verneQuery.wiki.extract }}
          </div>

          <!-- Lenker -->
          <div class="flex flex-wrap gap-2 pt-0.5">
            <a v-if="verneQuery.area.faktaarkUrl" :href="verneQuery.area.faktaarkUrl" target="_blank" rel="noopener"
               class="px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 text-[11px]">
              Naturbase faktaark ↗
            </a>
            <a v-if="verneQuery.wiki && verneQuery.wiki !== 'loading'" :href="verneQuery.wiki.url"
               target="_blank" rel="noopener"
               class="px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-100 text-[11px]">
              {{ sourceLabel(verneQuery.wiki.source) }} ↗
            </a>
            <span v-else
               class="px-2.5 py-1.5 rounded-lg border border-emerald-400/15 bg-emerald-500/5 text-emerald-100/35 text-[11px] cursor-not-allowed"
               :title="verneQuery.wiki === 'loading' ? 'Søker i leksika …' : 'Ingen leksikon-artikkel funnet'">
              Oppslag {{ verneQuery.wiki === 'loading' ? '…' : '—' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Nærmeste sted med leksikon-artikkel (Wikipedia-geosearch finner og
           lokaliserer; SNL foretrukket for tekst) — uavhengig av verneområde.
           Fakta om innsjø/fjelltopp/grend/elv/stedsnavn. -->
      <div v-if="placeWikiCard" class="px-4 pt-3">
        <div class="rounded-xl border border-sky-400/25 bg-sky-500/8 p-3 space-y-2">
          <div class="flex items-start gap-2">
            <svg viewBox="0 0 24 24" class="w-4 h-4 mt-0.5 shrink-0 text-sky-300" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <div class="min-w-0 flex-1">
              <div class="text-sky-100 font-semibold text-[13px] leading-tight">
                {{ placeWikiCard.title }}
              </div>
              <div v-if="placeWikiCard.distanceM != null" class="text-sky-200/70 text-[11px] tabular-nums">
                {{ formatDistanceM(placeWikiCard.distanceM) }} herfra
              </div>
            </div>
          </div>
          <div v-if="placeWikiCard.extract" class="text-[12px] text-sky-50/80 leading-snug">
            {{ placeWikiCard.extract }}
          </div>
          <div v-if="placeWikiCard.url" class="pt-0.5 flex flex-wrap items-center gap-2">
            <a :href="placeWikiCard.url" target="_blank" rel="noopener"
               class="inline-block px-2.5 py-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-100 text-[11px]">
              {{ sourceLabel(placeWikiCard.source) }} ↗
            </a>
            <!-- Sekundær: lenke til den overordnede «første del»-artikkelen
                 (selve stedet) når den har et eget oppslag. Ofte vil man lese
                 begge — f.eks. både «Hjerkinn stasjon» og «Hjerkinn». -->
            <a v-if="placeWikiCard.secondary?.url" :href="placeWikiCard.secondary.url"
               target="_blank" rel="noopener"
               class="inline-block px-2.5 py-1.5 rounded-lg border border-sky-400/20 bg-white/5 text-sky-100/80 text-[11px]">
              {{ placeWikiCard.secondary.title }} ({{ sourceLabel(placeWikiCard.secondary.source) }}) ↗
            </a>
          </div>
        </div>
      </div>

      <!-- NiN-naturtyper (Miljødirektoratet) — uavhengig av verneområde. -->
      <div v-if="naturtypeQuery?.status === 'done'" class="px-4 pt-3">
        <div class="rounded-xl border border-lime-400/25 bg-lime-500/8 p-3 space-y-2">
          <div class="flex items-center gap-2">
            <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0 text-lime-300" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22c4-2 7-6 7-11a7 7 0 0 0-14 0c0 5 3 9 7 11Z"/>
              <path d="M12 22V8"/>
              <path d="M9 12l3-3 3 3"/>
            </svg>
            <div class="text-lime-100 font-semibold text-[12px] uppercase tracking-wide">Naturtype (NiN)</div>
          </div>
          <div v-for="(nt, i) in naturtypeQuery.items" :key="nt.id ?? i"
               class="space-y-0.5" :class="i > 0 ? 'border-t border-lime-400/12 pt-1.5' : ''">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-lime-50 text-[13px] font-medium leading-tight">{{ nt.naturtype }}</span>
              <span v-if="nt.verdi"
                    class="px-1.5 py-0.5 rounded text-[10px] border leading-none"
                    :class="naturtypeVerdiClass(nt.verdi)">{{ nt.verdi }}</span>
            </div>
            <div v-if="nt.utforming" class="text-lime-200/70 text-[11px] leading-snug">{{ nt.utforming }}</div>
            <div v-if="nt.tilstand" class="text-lime-200/55 text-[11px]">Tilstand: {{ nt.tilstand }}</div>
            <div v-if="nt.navn" class="text-lime-200/45 text-[10px] italic">{{ nt.navn }}</div>
          </div>
        </div>
      </div>

      <!-- Handlinger. Koordinat-kopiering bor i headeren (ved tallene);
           eksterne karttjenester (Google/UT.no/Vegkart) bor i hovedmenyen. -->
      <div class="px-4 pt-4 grid grid-cols-2 gap-2">
        <button @click="onShareMap"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z"/>
            <path d="M9 4 V18 M15 6 V20"/>
          </svg>
          <span>Del kart</span>
        </button>
        <button @click="onShareMapWithContextPlace"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Del kart og sted</span>
        </button>
        <button v-if="ctxCanNavigate" @click="onNavigateHere"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          <span>Naviger hit</span>
        </button>
        <button v-if="ctxCanNavigate" @click="onRoundTripHere"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 2.1 21 6l-4 3.9"/>
            <path d="M21 6H9a6 6 0 0 0 0 12h1"/>
            <circle cx="6.5" cy="18" r="2.5"/>
          </svg>
          <span>Gå en runde herfra</span>
        </button>
        <button v-if="ctxCanMeasure" @click="onStartMeasureHere"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 21 9 15 13 19 21 11"/>
            <path d="M5 19 V21 H7 M19 11 V13 H21"/>
          </svg>
          <span>Start måling her</span>
        </button>
        <button @click="toggleProximityPanel"
                :aria-expanded="proximityPanelOpen"
                class="px-3 py-2.5 rounded-lg border text-[12px] active:scale-[0.98]
                       flex items-center gap-2 transition"
                :class="proximityPanelOpen
                        ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                        : 'bg-white/5 border-white/10 text-white/80'">
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="2.5"/>
            <path d="M12 5.5 a6.5 6.5 0 0 1 6.5 6.5 M12 2.5 a9.5 9.5 0 0 1 9.5 9.5"/>
            <path d="M12 18.5 a6.5 6.5 0 0 1 -6.5 -6.5 M12 21.5 a9.5 9.5 0 0 1 -9.5 -9.5"/>
          </svg>
          <span>Nærhetsvarsel</span>
        </button>
      </div>

      <!-- Nærhetsvarsel-config: avstand, varseltype og trigger-adferd.
           Krever aktiv GPS — uten den vises en Start GPS-prompt. -->
      <div v-if="proximityPanelOpen" class="px-4 pt-3">
        <div class="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
          <template v-if="userPos.isWatching && ctxTooFarToArm">
            <div class="flex items-start gap-2">
              <svg viewBox="0 0 24 24" class="w-5 h-5 shrink-0 text-amber-300 mt-0.5" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                <path d="M12 9 v4 M12 17 h.01"/>
              </svg>
              <div class="text-[12px] text-white/85 leading-snug">
                Du er {{ formatDistance(ctxDistFromUser) }} unna. Nærhetsvarsel er for
                <span class="text-white font-medium">siste etappe</span> og varsler kun mens
                appen er åpen — aktiver det når du er innen 2 km av målet.
              </div>
            </div>
          </template>
          <template v-else-if="userPos.isWatching">
            <div class="text-[11px] uppercase tracking-wide text-sky-100/80 mb-1.5">Varsle når jeg er innen</div>
            <div class="grid grid-cols-3 gap-2 mb-3">
              <button v-for="d in proximity.DISTANCE_OPTIONS" :key="d"
                      @click="proximityCfg.distanceM = d"
                      :aria-pressed="proximityCfg.distanceM === d"
                      class="px-2 py-2 rounded-lg border text-center text-[13px] active:scale-[0.98] transition"
                      :class="proximityCfg.distanceM === d
                              ? 'bg-sky-500/30 border-sky-300/70 text-white font-semibold'
                              : 'bg-white/5 border-white/10 text-white/65'">
                {{ d }} m
              </button>
            </div>

            <div class="text-[11px] uppercase tracking-wide text-sky-100/80 mb-1.5">Varseltype</div>
            <div class="grid grid-cols-2 gap-2 mb-3">
              <button @click="proximityCfg.sound = !proximityCfg.sound"
                      :aria-pressed="proximityCfg.sound"
                      class="px-2 py-2 rounded-lg border text-center text-[12px] active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                      :class="proximityCfg.sound
                              ? 'bg-sky-500/30 border-sky-300/70 text-white font-medium'
                              : 'bg-white/5 border-white/10 text-white/55'">
                <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5 L6 9 H2 v6 h4 l5 4 Z"/>
                  <path d="M15.5 8.5 a5 5 0 0 1 0 7 M18.5 6 a9 9 0 0 1 0 12"/>
                </svg>
                Lyd
              </button>
              <button @click="proximityCfg.vibration = !proximityCfg.vibration"
                      :aria-pressed="proximityCfg.vibration"
                      class="px-2 py-2 rounded-lg border text-center text-[12px] active:scale-[0.98] transition flex items-center justify-center gap-1.5"
                      :class="proximityCfg.vibration
                              ? 'bg-sky-500/30 border-sky-300/70 text-white font-medium'
                              : 'bg-white/5 border-white/10 text-white/55'">
                <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="8" y="4" width="8" height="16" rx="1.5"/>
                  <path d="M3 9 v6 M21 9 v6"/>
                </svg>
                Vibrering
              </button>
            </div>

            <div class="text-[10px] text-sky-100/70 leading-snug mb-3">
              Virker mens appen er åpen og GPS er på — kan ikke varsle i bakgrunnen. Skjermen
              holdes automatisk våken sammenhengende mens varselet er aktivt (overstyrer
              2-min-grensen i «Hold skjerm våken»). Alarmen ringer til du avbryter den.
            </div>

            <button @click="armProximityAlert"
                    class="w-full px-3 py-2.5 rounded-lg bg-sky-500 text-white text-[13px] font-semibold
                           active:scale-[0.98] transition flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8 a6 6 0 0 0 -12 0 c0 7 -3 9 -3 9 h18 s-3 -2 -3 -9"/>
                <path d="M13.7 21 a2 2 0 0 1 -3.4 0"/>
              </svg>
              Aktiver varsel
            </button>
          </template>
          <template v-else>
            <div class="text-[12px] text-white/80 mb-2 leading-snug">
              Nærhetsvarsel krever aktiv GPS — start posisjonering for å varsle når du nærmer deg stedet.
            </div>
            <button @click="startPositioning"
                    class="w-full px-3 py-2.5 rounded-lg bg-sky-500 text-white text-[13px] font-semibold
                           active:scale-[0.98] transition">
              Start GPS
            </button>
          </template>
        </div>
      </div>

      <!-- Nærmeste POI relativt til DETTE punktet. Highlighter med rosa
           puls-ring (samme som søk). Knappen gråes ut når kartet ikke har
           typen (f.eks. ingen holdeplass i utsnittet). -->
      <div class="px-4 pt-4 pb-1 text-white/55 text-[10px] uppercase tracking-wide">
        Nærmeste herfra
      </div>
      <div class="px-4 pb-1 grid grid-cols-3 gap-2">
        <button @click="nearestPoiFromPoint('parkering')" :disabled="!poiCounts.parkering"
                class="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition
                       bg-white/5 border-white/10 text-white/80 active:scale-[0.98]
                       disabled:opacity-35 disabled:active:scale-100">
          <span class="w-7 h-7 rounded-md bg-[#1f5d8a] text-white text-[13px] font-bold
                       flex items-center justify-center shrink-0">P</span>
          <span class="text-[11px]">Parkering</span>
        </button>
        <button @click="nearestPoiFromPoint('toalett')" :disabled="!poiCounts.toalett"
                class="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition
                       bg-white/5 border-white/10 text-white/80 active:scale-[0.98]
                       disabled:opacity-35 disabled:active:scale-100">
          <span class="w-7 h-7 rounded-md bg-[#1f5d8a] text-white text-[9px] font-bold
                       flex items-center justify-center shrink-0">WC</span>
          <span class="text-[11px]">Toalett</span>
        </button>
        <button @click="nearestPoiFromPoint('holdeplass')" :disabled="!poiCounts.holdeplass"
                class="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition
                       bg-white/5 border-white/10 text-white/80 active:scale-[0.98]
                       disabled:opacity-35 disabled:active:scale-100">
          <span class="w-7 h-7 rounded-md bg-[#1f5d8a] flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="#fff">
              <path d="M6 3 h12 a2 2 0 0 1 2 2 v9 a2 2 0 0 1 -2 2 v1.5 a1 1 0 0 1 -2 0 V18 H8 v1.5 a1 1 0 0 1 -2 0 V16 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z"/>
              <rect x="6.5" y="6" width="11" height="5" rx="0.6" fill="#1f5d8a"/>
              <circle cx="8.5" cy="14" r="1.2" fill="#1f5d8a"/>
              <circle cx="15.5" cy="14" r="1.2" fill="#1f5d8a"/>
            </svg>
          </span>
          <span class="text-[11px]">Buss / tog</span>
        </button>
      </div>

      <!-- Plasser annotering — kun for bruker-kart, og ikke mens
           sporing/måling pågår. -->
      <template v-if="ctxCanAnnotate">
        <div class="px-4 pt-4 pb-1 text-white/55 text-[10px] uppercase tracking-wide">
          Plasser annotering
        </div>
        <div class="px-4 pb-4 grid grid-cols-2 gap-2">
          <button v-for="s in ANNOTATION_SYMBOLS" :key="s.code"
                  @click="onPlaceAnnotationFromContext(s.symbolKey)"
                  class="px-3 py-2 rounded-lg border text-[12px] active:scale-[0.98]
                         flex items-center gap-2 bg-white/5 border-white/10 text-white/80">
            <AnnotationIcon :symbol-key="s.symbolKey"/>
            <span class="truncate">{{ s.label }}</span>
          </button>
        </div>
      </template>
      <div v-else class="px-4 pt-3 pb-4 text-[10px] text-white/40 leading-snug">
        <template v-if="ctxBusy">
          Avslutt pågående {{ measureMode ? 'måling' : 'sporing' }} for flere valg.
        </template>
      </div>
      </div><!-- /zoom-blokk -->
      </div><!-- /scrollbar kropp -->
    </div>
  </div>
</Transition>
</template>

<style scoped>
.overlay-fade-enter-active, .overlay-fade-leave-active { transition: opacity 0.22s ease; }
.overlay-fade-enter-from, .overlay-fade-leave-to       { opacity: 0; }
.overlay-fade-leave-active { pointer-events: none; }
</style>
