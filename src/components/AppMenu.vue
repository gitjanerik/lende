<script setup>
import { watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppMenu } from '../composables/useAppMenu.js'
import { APP_VERSION } from '../version.js'

// Global hovedmeny — slide-in fra venstre. Montert én gang i App.vue og styrt av
// den delte useAppMenu-tilstanden, så meny-knappen i enhver visning åpner denne.
// Lukkes på valg, backdrop-klikk, Escape og rute-endring.

const { menuOpen, close } = useAppMenu()
const route = useRoute()
const router = useRouter()

// Er vi i ruteplanleggeren? Da tilbyr mode-vekslingen «Turkart», ellers «Ruteplanlegger».
const isRute = computed(() => route.name === 'ruteplanlegger')

function go(path, mode) {
  close()
  if (mode) { try { localStorage.setItem('lende-last-mode', mode) } catch { /* ignorer */ } }
  if (route.path !== path) router.push(path)
}

function toggleMode() {
  if (isRute.value) go('/', 'kart')
  else go('/rute', 'rute')
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
      <div class="flex items-center justify-between px-4 pb-3 pt-1">
        <span class="text-[15px] font-semibold text-white">Så i lende</span>
        <button @click="close" aria-label="Lukk meny"
                class="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border
                       border-white/10 text-white/70 active:scale-95 transition">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-1">
        <!-- Mode-veksling: turkart ↔ ruteplanlegger -->
        <button @click="toggleMode" class="menu-item">
          <svg v-if="isRute" viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/>
            <line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
            <path d="M9 19h6a3 3 0 0 0 3-3V8"/><path d="M6 16V8a3 3 0 0 1 3-3h6"/>
          </svg>
          <span>{{ isRute ? 'Turkart' : 'Ruteplanlegger' }}</span>
        </button>

        <button @click="go('/', 'kart')" class="menu-item">
          <svg viewBox="0 0 24 24" class="menu-icon" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>
          </svg>
          <span>Hjem / Mine kart</span>
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
