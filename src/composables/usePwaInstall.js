/**
 * usePwaInstall — reactive state for the browser's beforeinstallprompt event
 * and a helper for triggering the install prompt on user action.
 *
 * How it works:
 *  - Chrome/Edge/Samsung dispatch `beforeinstallprompt` when the PWA meets
 *    installability criteria (manifest + SW + served from https + not
 *    already installed). We capture the event and expose a `canInstall`
 *    ref plus a `promptInstall()` trigger.
 *  - iOS Safari never fires this event — it has no programmatic install.
 *    We detect iOS separately and expose `isIOS` so the UI can show a
 *    manual "Trykk Del → Legg til på Hjem-skjerm" hint instead.
 *  - Once the user installs (or dismisses and we get `appinstalled`),
 *    canInstall goes back to false.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'

export function usePwaInstall() {
  const canInstall = ref(false)
  const isInstalled = ref(false)
  const isIOS = ref(false)
  const isStandalone = ref(false)

  let deferredPrompt = null

  function onBeforeInstallPrompt(e) {
    // Prevent Chrome's mini-infobar from showing; we'll trigger manually
    e.preventDefault()
    deferredPrompt = e
    canInstall.value = true
  }

  function onAppInstalled() {
    canInstall.value = false
    isInstalled.value = true
    deferredPrompt = null
  }

  async function promptInstall() {
    if (!deferredPrompt) return { outcome: 'unavailable' }
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    canInstall.value = false
    return choice
  }

  onMounted(() => {
    // Detect iOS (no programmatic install — show manual hint).
    // iPadOS 13+ later melder seg som «Macintosh» (desktop-UA), så ren UA-sjekk
    // bommer på iPad. Vi fanger dem via touch: en Mac med flerpunkts-touch og
    // uten MSStream er i praksis en iPad. maxTouchPoints > 1 skiller iPad fra
    // ekte pekeskjerm-frie Mac-er (som gir 0).
    const ua = navigator.userAgent || ''
    const iOSbyUA = /iPad|iPhone|iPod/.test(ua)
    const iPadAsMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1
    isIOS.value = (iOSbyUA || iPadAsMac) && !window.MSStream

    // Detect already-installed (running as PWA)
    isStandalone.value =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (isStandalone.value) isInstalled.value = true

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
  })

  return { canInstall, isInstalled, isIOS, isStandalone, promptInstall }
}
