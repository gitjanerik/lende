<script setup>
import { computed, ref } from 'vue'
import { nordavvikDeg, nordavvikISoneDeg } from '../lib/utm.js'
import { LENDE_SONE, STEDER, avvikTekst, sentralmeridian, sonebaand, utmSone } from '../lib/utmSoner.js'

// Interaktiv figur til «Nord er nord» i «Om appen»: sonebåndene på den
// breddegraden du står på, og nordavviket det gir.
//
// GREPET ER AT FIGUREN TEGNER REGELEN, IKKE ET BILDE AV DEN. Båndene kommer fra
// `sonebaand`, som spør `utmSone` for hver kvarte grad — så Sørvestlands-unntaket
// er ikke en strek noen har tegnet inn på 3°, det er grensa som FLYTTER seg i det
// man drar breddegraden inn i 56–64°, og Svalbards fire brede soner dukker opp av
// seg selv over 72°. En håndtegnet grense ville sett helt lik ut og vært en
// påstand ingen test kan ta.
//
// TALLENE GÅR GJENNOM PROJEKSJONEN (`nordavvikDeg` / `nordavvikISoneDeg`), ikke
// gjennom tilnærmingen γ ≈ (λ − λ0)·sin φ. Den bommer med seks bueminutter i
// Kirkenes, og figuren ville da fortalt noe annet enn kartet gjør.
//
// BETJENINGEN ER TO EKTE `<input type="range">`. Draget i SVG-en er en snarvei
// oppå dem og ikke kontrollen selv — en figur man bare kan dra i, finnes ikke for
// den som bruker tastatur (SC 2.1.1), og en `role="slider"` på en `<g>` måtte ha
// hatt hele tastaturkontrakten skrevet for hånd.

const lon = ref(18.96)   // Tromsø: der forskjellen på 32 og «sin egen» sone er størst
const lat = ref(69.65)

const LON_MIN = 0, LON_MAKS = 36

const sone = computed(() => utmSone(lat.value, lon.value))
const baand = computed(() => sonebaand(lat.value, LON_MIN, LON_MAKS))
const grenser = computed(() => {
  const g = baand.value.map(b => b.fra)
  g.push(LON_MAKS)
  return g
})

// Gradmerkene under båndet. FØRSTE OG SISTE STÅR ALLTID — de er spennet — og en
// midtre merkelapp droppes når den ikke har plass ved siden av naboen. På
// Svalbard ligger 33° og 36° 27 px fra hverandre i viewBox-en, altså tættere enn
// to tresifrede tall er brede, og de skrev oppi hverandre.
const MERKE_LUFT = 30
const merker = computed(() => {
  const g = grenser.value
  if (g.length < 2) return g
  const ut = [g[0]]
  const siste = g[g.length - 1]
  for (let i = 1; i < g.length - 1; i++) {
    if (xFor(g[i]) - xFor(ut[ut.length - 1]) < MERKE_LUFT) continue
    if (xFor(siste) - xFor(g[i]) < MERKE_LUFT) continue
    ut.push(g[i])
  }
  ut.push(siste)
  return ut
})

const avvikLende = computed(() => nordavvikDeg(lat.value, lon.value))
const avvikEgen = computed(() => nordavvikISoneDeg(lat.value, lon.value, sone.value))
const lendeTekst = computed(() => avvikTekst(avvikLende.value))
const egenTekst = computed(() => avvikTekst(avvikEgen.value))

const stedNavn = computed(() => {
  const t = STEDER.find(s => Math.abs(s.lon - lon.value) < 0.06 && Math.abs(s.lat - lat.value) < 0.06)
  return t ? t.navn : null
})

// ── Sonebåndene ────────────────────────────────────────────────────────────
const B = { x0: 12, x1: 328, topp: 34, hoyde: 40 }
const xFor = (lo) => B.x0 + ((lo - LON_MIN) / (LON_MAKS - LON_MIN)) * (B.x1 - B.x0)
const bunn = B.topp + B.hoyde
const merkeX = computed(() => xFor(lon.value))

function gradTekst(lo) {
  return `${Math.round(lo)}°`
}

// ── Kompasset ──────────────────────────────────────────────────────────────
// Positivt nordavvik = sann nord ligger med klokka fra rutenettets nord, så
// rutenettet selv står den andre veien. Fortegnet snus ÉN gang, her.
const KOMPASS = { cx: 80, cy: 84, r: 54 }
const rutenettRotasjon = computed(() => -avvikLende.value)
const bueBane = computed(() => {
  const { cx, cy } = KOMPASS
  const r = 34
  const v = rutenettRotasjon.value
  const rad = (g) => (g - 90) * Math.PI / 180
  const a = rad(v), b = rad(0)
  const stor = Math.abs(v) > 180 ? 1 : 0
  const feier = v < 0 ? 1 : 0
  return `M ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} A ${r} ${r} 0 ${stor} ${feier} ${cx + r * Math.cos(b)} ${cy + r * Math.sin(b)}`
})

// ── Drag i sonefiguren ─────────────────────────────────────────────────────
const svgRef = ref(null)
const drar = ref(false)

function lonFraPeker(ev) {
  const el = svgRef.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  // viewBox-en er 340 bred; SVG-en skalerer til boksen, så andelen er nok.
  const andel = (ev.clientX - r.left) / r.width
  const vbX = andel * 340
  const lo = LON_MIN + ((vbX - B.x0) / (B.x1 - B.x0)) * (LON_MAKS - LON_MIN)
  return Math.min(LON_MAKS, Math.max(LON_MIN, Math.round(lo * 100) / 100))
}

function pekerNed(ev) {
  const lo = lonFraPeker(ev)
  if (lo == null) return
  drar.value = true
  lon.value = lo
  svgRef.value?.setPointerCapture?.(ev.pointerId)
}
function pekerFlytt(ev) {
  if (!drar.value) return
  const lo = lonFraPeker(ev)
  if (lo != null) lon.value = lo
}
function pekerOpp(ev) {
  drar.value = false
  svgRef.value?.releasePointerCapture?.(ev.pointerId)
}

function velgSted(s) {
  lon.value = s.lon
  lat.value = s.lat
}

const erValgt = (s) => Math.abs(s.lon - lon.value) < 0.06 && Math.abs(s.lat - lat.value) < 0.06

const figurTekst = computed(() =>
  `Sonekart: ${lon.value.toFixed(1).replace('.', ',')}° øst, ${lat.value.toFixed(1).replace('.', ',')}° nord `
  + `ligger i UTM-sone ${sone.value} med sentralmeridian ${sentralmeridian(sone.value)}°. `
  + `Lende projiserer i sone ${LENDE_SONE}, og sann nord ligger da ${lendeTekst.value.hel} for rutenettets nord.`)
</script>

<template>
  <figure data-utm-figur class="utm-figur rounded-xl border border-ink/10 bg-ink/5 p-3 space-y-3">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
      <!-- Sonebåndene -->
      <svg
        ref="svgRef"
        viewBox="0 0 340 96"
        class="w-full sm:flex-1 select-none touch-pan-y cursor-ew-resize"
        role="img"
        :aria-label="figurTekst"
        @pointerdown.prevent="pekerNed"
        @pointermove="pekerFlytt"
        @pointerup="pekerOpp"
        @pointercancel="pekerOpp"
      >
        <!-- Båndene. Sone 32 er Lendes, og den er den eneste som er farget:
             figuren handler om hva som skjer når man fjerner seg fra DEN. -->
        <g>
          <rect
            v-for="b in baand"
            :key="`b${b.fra}`"
            data-utm-baand :data-sone="b.sone" :data-fra="b.fra"
            :x="xFor(b.fra)" :y="B.topp"
            :width="Math.max(0, xFor(b.til) - xFor(b.fra))" :height="B.hoyde"
            :class="b.sone === LENDE_SONE ? 'fill-amber-400/25' : 'fill-ink/10'"
          />
          <line
            v-for="g in grenser" :key="`g${g}`"
            :x1="xFor(g)" :y1="B.topp" :x2="xFor(g)" :y2="bunn"
            class="stroke-ink/30" stroke-width="1"
          />
        </g>

        <!-- Sentralmeridianene: den stiplede midtlinja i hvert bånd. -->
        <g stroke-dasharray="2 2" stroke-width="1">
          <line
            v-for="b in baand" :key="`s${b.fra}`"
            :x1="xFor(b.sentral)" :y1="B.topp + 4" :x2="xFor(b.sentral)" :y2="bunn - 4"
            :class="b.sone === LENDE_SONE ? 'stroke-amber-500' : 'stroke-ink/35'"
          />
        </g>

        <!-- Markøren: stedet du står på. -->
        <g>
          <line :x1="merkeX" :y1="B.topp" :x2="merkeX" :y2="bunn" class="stroke-amber-500" stroke-width="2" />
          <path :d="`M ${merkeX - 5} 20 L ${merkeX + 5} 20 L ${merkeX} 31 Z`" class="fill-amber-500" />
          <text
            v-if="stedNavn"
            :x="Math.min(300, Math.max(40, merkeX))" y="13"
            class="fill-ink-2" font-size="10" font-weight="600" text-anchor="middle"
          >{{ stedNavn }}</text>
        </g>
        <!-- Sonenummer. Droppes i et bånd som er for smalt til å bære det —
             et tall som kolliderer med nabotallet leses som støy. -->
        <g class="fill-ink-2" font-size="12" font-weight="600" text-anchor="middle">
          <text
            v-for="b in baand" :key="`n${b.fra}`"
            v-show="xFor(b.til) - xFor(b.fra) > 20"
            :x="(xFor(b.fra) + xFor(b.til)) / 2" :y="B.topp + 20"
          >{{ b.sone }}</text>
        </g>

        <!-- Gradene under båndet. -->
        <g class="fill-ink-4" font-size="8.5" text-anchor="middle">
          <line
            v-for="g in grenser" :key="`t${g}`"
            :x1="xFor(g)" :y1="bunn" :x2="xFor(g)" :y2="bunn + 4"
            class="stroke-ink/30" stroke-width="1"
          />
          <text
            v-for="g in merker" :key="`gt${g}`"
            :x="xFor(g)" :y="bunn + 15"
            :text-anchor="g === LON_MIN ? 'start' : g === LON_MAKS ? 'end' : 'middle'"
          >{{ gradTekst(g) }}</text>
        </g>

      </svg>

      <!-- Kompasset: rutenettets nord mot sann nord. Tegnforklaringen er HTML og
           ikke SVG-tekst — to etiketter inne i sirkelen kolliderte med hverandre
           når avviket ble lite, og en tekst i figuren følger ikke appens
           tekststørrelse. -->
      <div class="flex flex-col items-center gap-1 self-center sm:self-start shrink-0">
      <svg viewBox="0 0 160 150" class="w-40 sm:w-36" role="img"
           :aria-label="`Rutenettets nord står ${lendeTekst.tall} fra sann nord, ${lendeTekst.retning || 'altså i samme retning'}.`">
        <circle :cx="KOMPASS.cx" :cy="KOMPASS.cy" :r="KOMPASS.r" class="fill-ink/5 stroke-ink/15" stroke-width="1" />

        <!-- Arket, som ligger i rutenettet og derfor står på skrå. -->
        <g data-utm-rutenett :data-rotasjon="rutenettRotasjon.toFixed(2)"
           :transform="`rotate(${rutenettRotasjon} ${KOMPASS.cx} ${KOMPASS.cy})`">
          <rect :x="KOMPASS.cx - 30" :y="KOMPASS.cy - 30" width="60" height="60"
                class="fill-ink/10 stroke-ink/40" stroke-width="1.2" />
          <g class="stroke-ink/20" stroke-width="0.8">
            <line :x1="KOMPASS.cx - 10" :y1="KOMPASS.cy - 30" :x2="KOMPASS.cx - 10" :y2="KOMPASS.cy + 30" />
            <line :x1="KOMPASS.cx + 10" :y1="KOMPASS.cy - 30" :x2="KOMPASS.cx + 10" :y2="KOMPASS.cy + 30" />
            <line :x1="KOMPASS.cx - 30" :y1="KOMPASS.cy - 10" :x2="KOMPASS.cx + 30" :y2="KOMPASS.cy - 10" />
            <line :x1="KOMPASS.cx - 30" :y1="KOMPASS.cy + 10" :x2="KOMPASS.cx + 30" :y2="KOMPASS.cy + 10" />
          </g>
          <line :x1="KOMPASS.cx" :y1="KOMPASS.cy" :x2="KOMPASS.cx" :y2="KOMPASS.cy - KOMPASS.r"
                class="stroke-ink-3" stroke-width="1.6" />
          <circle :cx="KOMPASS.cx" :cy="KOMPASS.cy - KOMPASS.r" r="3.2"
                  class="fill-app stroke-ink-3" stroke-width="1.6" />
        </g>

        <!-- Sann nord står ALLTID opp: det er den Lende legger arket etter. -->
        <line :x1="KOMPASS.cx" :y1="KOMPASS.cy" :x2="KOMPASS.cx" :y2="KOMPASS.cy - KOMPASS.r"
              stroke="#e11d48" stroke-width="2.2" />
        <path :d="`M ${KOMPASS.cx} ${KOMPASS.cy - KOMPASS.r - 7} l -4.5 8 h 9 Z`" fill="#e11d48" />
        <text :x="KOMPASS.cx" :y="KOMPASS.cy - KOMPASS.r - 12" fill="#e11d48"
              font-size="10" font-weight="700" text-anchor="middle">N</text>

        <path :d="bueBane" fill="none" class="stroke-amber-500" stroke-width="1.4" />
        <text :x="KOMPASS.cx" :y="KOMPASS.cy + 46" class="fill-ink-2" font-size="11"
              font-weight="600" text-anchor="middle" data-utm-avvik>{{ lendeTekst.hel }}</text>
      </svg>
        <ul class="flex flex-col gap-0.5 text-[10px] text-ink-3">
          <li class="flex items-center gap-1.5">
            <span class="h-0.5 w-4 shrink-0 rounded-full bg-rose-600" aria-hidden="true"></span>sann nord
          </li>
          <li class="flex items-center gap-1.5">
            <span class="h-0.5 w-4 shrink-0 rounded-full bg-ink-3" aria-hidden="true"></span>rutenettets nord
          </li>
        </ul>
      </div>
    </div>

    <!-- Betjening: stedene først, så de to skyvene. -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="s in STEDER" :key="s.navn"
        type="button"
        class="px-2 py-1 rounded-lg text-[11px] border transition-colors"
        :class="erValgt(s)
          ? 'bg-amber-400/20 border-amber-500/50 text-ink'
          : 'bg-ink/5 border-ink/10 text-ink-3 hover:text-ink hover:bg-ink/10'"
        :aria-pressed="erValgt(s)"
        @click="velgSted(s)"
      >{{ s.navn }}</button>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <label class="block text-[11px] text-ink-3">
        <span class="flex justify-between">
          <span>Lengdegrad</span>
          <span class="tabular-nums text-ink-2">{{ lon.toFixed(1).replace('.', ',') }}° Ø</span>
        </span>
        <input v-model.number="lon" type="range" :min="LON_MIN" :max="LON_MAKS" step="0.1" class="w-full accent-amber-500" />
      </label>
      <label class="block text-[11px] text-ink-3">
        <span class="flex justify-between">
          <span>Breddegrad</span>
          <span class="tabular-nums text-ink-2">{{ lat.toFixed(1).replace('.', ',') }}° N</span>
        </span>
        <input v-model.number="lat" type="range" min="54" max="80" step="0.1" class="w-full accent-amber-500" />
      </label>
    </div>

    <figcaption class="text-[12px] leading-relaxed text-ink-3 space-y-1">
      <p aria-live="polite">
        Her ligger du i <strong class="text-ink-2">sone {{ sone }}</strong>, med
        sentralmeridian {{ sentralmeridian(sone) }}°. Der ville nord stått
        <strong class="text-ink-2">{{ egenTekst.hel }}</strong> — men Lende
        projiserer i sone {{ LENDE_SONE }} overalt, og avviket blir
        <strong class="text-ink-2">{{ lendeTekst.hel }}</strong>. Arket roteres
        tilbake, så sann nord (<span class="text-rose-500 font-semibold">N</span>)
        alltid peker opp.
      </p>
      <p>
        Det gule båndet er sone 32, den Lende alltid bruker — den finnes
        ikke på Svalbard. Stiplet linje er sonens sentralmeridian, der
        avviket er null; 0° er Greenwich, som havner på en sonegrense og aldri i
        en sonemidte. Dra breddegraden ned i 56–64° og se grensa mot sone 31
        flytte seg fra 6° til 3° — Sørvestlands-unntaket. Over 72° deles Svalbard
        i fire brede soner i stedet for seks. Kartverket velger for sin del blant
        sone 32, 33 og 35 til kartseriene sine, altså ikke alltid den sonen
        rutenettet peker på her.
      </p>
    </figcaption>
  </figure>
</template>
