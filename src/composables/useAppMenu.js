import { ref } from 'vue'

// Global hovedmeny-tilstand. Modulnivå-ref (singleton) så meny-knappen i hver
// visning og selve AppMenu-panelet (montert én gang i App.vue) deler samme
// åpen/lukket-tilstand uten props eller provide/inject.

const menuOpen = ref(false)

export function useAppMenu() {
  const open = () => { menuOpen.value = true }
  const close = () => { menuOpen.value = false }
  const toggle = () => { menuOpen.value = !menuOpen.value }
  return { menuOpen, open, close, toggle }
}
