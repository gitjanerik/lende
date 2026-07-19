/**
 * usePwaInstall — reactive state for the browser's beforeinstallprompt event
 * and a helper for triggering the install prompt on user action.
 *
 * How it works:
 *  - Chrome/Edge/Samsung dispatch `beforeinstallprompt` when the PWA meets
 *    installability criteria (manifest + SW + served from https + not
 *    already installed). The event fires EXACTLY ONCE, and often before the
 *    JS bundle has loaded — so an early inline listener in index.html stashes
 *    it on `window.__deferredInstallPrompt`. Here we read that stash at module
 *    load and also listen for any later firing.
 *  - State is a MODULE-LEVEL SINGLETON: every caller shares the same reactive
 *    refs. Previously each call kept its own state and attached its listener in
 *    onMounted; a component mounted after the one-time event fired (e.g. the
 *    Om-page, or the front page if the event beat Vue's mount) never saw
 *    canInstall flip and the button stayed hidden.
 *  - iOS Safari never fires this event — it has no programmatic install. We
 *    detect iOS (incl. iPadOS 13+ which reports as «Macintosh») separately and
 *    expose `isIOS` so the UI can show a manual "Del → Legg til på Hjem-skjerm"
 *    hint instead.
 *  - Once the user installs (or we get `appinstalled`), canInstall goes false.
 */

import { ref } from 'vue'

const canInstall = ref(false)
const isInstalled = ref(false)
const isIOS = ref(false)
const isStandalone = ref(false)

let deferredPrompt = null

function capturePrompt(e) {
  deferredPrompt = e
  canInstall.value = true
}

function onAppInstalled() {
  canInstall.value = false
  isInstalled.value = true
  deferredPrompt = null
}

let initialized = false
function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  // Detect iOS (no programmatic install — show manual hint). iPadOS 13+ melder
  // seg som «Macintosh» (desktop-UA), så ren UA-sjekk bommer på iPad. Vi fanger
  // dem via touch: en Mac med flerpunkts-touch og uten MSStream er i praksis en
  // iPad. maxTouchPoints > 1 skiller iPad fra ekte pekeskjerm-frie Mac-er (0).
  const ua = navigator.userAgent || ''
  const iOSbyUA = /iPad|iPhone|iPod/.test(ua)
  const iPadAsMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1
  isIOS.value = (iOSbyUA || iPadAsMac) && !window.MSStream

  // Detect already-installed (running as PWA)
  isStandalone.value =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  if (isStandalone.value || window.__appInstalled) isInstalled.value = true

  // Eventet kan alt ha vært fanget av den tidlige inline-lytteren i index.html.
  if (window.__deferredInstallPrompt) capturePrompt(window.__deferredInstallPrompt)

  // ...og fang senere fyringer direkte (etter at bundelen er lastet).
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.__deferredInstallPrompt = e
    capturePrompt(e)
  })
  window.addEventListener('appinstalled', () => {
    window.__deferredInstallPrompt = null
    onAppInstalled()
  })
}

// Kjør ved modul-import — skjer under app-bootstrap, før første mount.
init()

async function promptInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' }
  deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice
  deferredPrompt = null
  window.__deferredInstallPrompt = null
  canInstall.value = false
  return choice
}

export function usePwaInstall() {
  init()
  return { canInstall, isInstalled, isIOS, isStandalone, promptInstall }
}
