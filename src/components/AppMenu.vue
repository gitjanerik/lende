<script setup>
import { watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppMenu } from '../composables/useAppMenu.js'
import { useMapContext } from '../composables/useMapContext.js'
import { useUiTextScale } from '../composables/useUiTextScale.js'
import AppMenuButton from './AppMenuButton.vue'
import { gmapsUrl, streetViewUrl, buildVegkartUrl } from '../lib/externalMapLinks.js'
import { buildUtNoUrl } from '../lib/utNoLink.js'
import { APP_VERSION } from '../version.js'

// Global hovedmeny — slide-in fra venstre. Montert én gang i App.vue og styrt av
// den delte useAppMenu-tilstanden, så meny-knappen i enhver visning åpner denne.
// Lukkes på valg, backdrop-klikk, Escape og rute-endring.

const { menuOpen, close } = useAppMenu()
const { hasMapContext, getPoint } = useMapContext()
const { uiTextScale, cycleTextScale } = useUiTextScale()
const route = useRoute()
const router = useRouter()

// Er vi i ruteplanleggeren? Da tilbyr mode-vekslingen «Turkart», ellers «Ruteplanlegger».
const isRute = computed(() => route.name === 'ruteplanlegger')

function go(to, mode) {
  close()
  if (mode) { try { localStorage.setItem('lende-last-mode', mode) } catch { /* ignorer */ } }
  router.push(to)
}

function toggleMode() {
  if (isRute.value) go('/', 'kart')
  else go('/rute', 'rute')
}

// Eksterne karttjenester på synlig kartsenter — kun når en kartvisning har
// registrert en punkt-provider (useMapContext), dvs. brukeren er inne i et kart.
const EXTERNAL_SERVICES = [
  { key: 'gmaps', label: 'Google Maps', url: (p) => gmapsUrl(p.lat, p.lon) },
  { key: 'streetview', label: 'Street View', url: (p) => streetViewUrl(p.lat, p.lon) },
  { key: 'utno', label: 'UT.no-kart', url: (p) => buildUtNoUrl(p) },
  { key: 'vegkart', label: 'Vegkart (Vegvesen.no)', url: (p) => buildVegkartUrl(p) },
]

function openExternal(svc) {
  const p = getPoint()
  if (!p) return
  const url = svc.url(p)
  if (url) window.open(url, '_blank', 'noopener')
  close()
}

// Lukk ved rute-endring (f.eks. maskinvare-tilbake) og på Escape.
watch(() => route.fullPath, () => { if (menuOpen.value) close() })

function onKey(e) { if (e.key === 'Escape' && menuOpen.value) close() }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="menu-fade">
    <div v-if="menuOpen" class="fixed inset-0 z-[200] bg-black/50" @click="close" />
  </Transition>

  <Transition name="menu-slide">
    <aside v-if="menuOpen"
           class="fixed top-0 left-0 bottom-0 z-[201] w-[82%] max-w-[320px] flex flex-col
                  bg-zinc-900 border-r border-white/10 shadow-2xl"
           :style="{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }">
      <!-- Panelets egen meny-knapp ligger på samme sted som trigger-knappen i
           visningen under (venstre, px-3) — delt tilstand gjør at den viser
           X-animasjonen, så det ser ut som om knappen står stille mens panelet
           glir inn under den. Den ER lukkekontrollen; ingen separat X. -->
      <div class="flex items-center gap-3 px-3 pb-3">
        <AppMenuButton variant="float" />
        <span class="text-[15px] font-semibold text-white">Så i lende</span>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-1"
           :style="{ zoom: uiTextScale }">
        <div class="flex items-center gap-1">
          <button @click="go({ path: '/', query: { tab: 'kart' } })" class="menu-item flex-1">
            <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/>
              <line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>
            </svg>
            <span>Mine kart</span>
          </button>
          <button @click="go('/nytt', 'kart')" aria-label="Nytt kart"
                  class="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-lg
                         bg-emerald-500 hover:bg-emerald-600 text-white transition active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-1">
          <button @click="go({ path: '/', query: { tab: 'rute' } })" class="menu-item flex-1">
            <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
              <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
            </svg>
            <span>Mine ruter</span>
          </button>
          <button @click="go('/rute', 'rute')" aria-label="Ny rute"
                  class="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-lg
                         bg-emerald-500 hover:bg-emerald-600 text-white transition active:scale-90">
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor"
                 stroke-width="2.6" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        <!-- Mode-veksling: turkart ↔ ruteplanlegger -->
        <button @click="toggleMode" class="menu-item">
          <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          <span>{{ isRute ? 'Bytt til turkart' : 'Bytt til ruteplanlegger' }}</span>
        </button>

        <button @click="go('/tegnforklaring')" class="menu-item">
          <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/>
            <circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>
          </svg>
          <span>Tegnforklaring</span>
        </button>

        <button @click="go('/om')" class="menu-item">
          <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="8" r="0.6" fill="currentColor"/>
          </svg>
          <span>Om appen</span>
        </button>

        <!-- Global tekststørrelse (flyttet fra skuffe-headerne): sykler
             100 % → 125 % → 150 %. Menyen selv skaleres, så effekten vises
             umiddelbart; menyen holdes åpen. -->
        <button @click="cycleTextScale" class="menu-item" aria-label="Tekststørrelse">
          <span class="menu-icon flex items-end justify-center font-semibold leading-none">
            <span class="text-[11px]">A</span><span class="text-[16px]">A</span>
          </span>
          <span>Tekststørrelse</span>
          <span class="ml-auto text-[12px] tabular-nums text-white/45">
            {{ Math.round(uiTextScale * 100) }} %
          </span>
        </button>

        <!-- Eksterne karttjenester på synlig kartsenter — kun inne i et kart
             (turkart eller ruteplanlegger), skjult på Hjem/Mine kart. -->
        <template v-if="hasMapContext">
          <div class="px-3 pt-4 pb-1 text-[10px] uppercase tracking-wide text-white/40">
            Åpne stedet i
          </div>
          <button v-for="svc in EXTERNAL_SERVICES" :key="svc.key"
                  @click="openExternal(svc)" class="menu-item">
            <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ svc.label }}</span>
          </button>
        </template>
      </nav>

      <div class="px-4 py-3 border-t border-white/10 text-[11px] text-white/35"
           :style="{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }">
        Versjon {{ APP_VERSION }}
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem;
  border-radius: 0.6rem;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  text-align: left;
  transition: background 0.15s ease;
}
.menu-item:active { transform: scale(0.98); }
.menu-item:hover { background: rgba(255, 255, 255, 0.06); }
.menu-icon { width: 20px; height: 20px; flex-shrink: 0; color: rgba(255, 255, 255, 0.6); }

.menu-fade-enter-active, .menu-fade-leave-active { transition: opacity 0.25s ease; }
.menu-fade-enter-from, .menu-fade-leave-to { opacity: 0; }

.menu-slide-enter-active, .menu-slide-leave-active { transition: transform 0.28s ease; }
.menu-slide-enter-from, .menu-slide-leave-to { transform: translateX(-100%); }
</style>
