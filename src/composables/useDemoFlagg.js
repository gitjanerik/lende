import { ref, watch } from 'vue'

// DE SMÅ 3D-FLAGGENE I LOCALSTORAGE (v7.8.35).
//
// Vær-demoen, nordlys-demoen og de tvungne himmellegemene hadde hver sin
// identiske kopi av samme seks linjer i `DrawerDevTab`: en `ref` som leser
// `localStorage` ved oppsett, og en `toggle` som skriver tilbake. Da alle tre
// flyttet til Preferanse-fana ville det blitt en fjerde og femte kopi — og det
// er nettopp den formen på duplikat CLAUDE.md ber om å se etter før man bygger
// en ny variant av noe som finnes.
//
// FLAGGET GÅR GJENNOM LOCALSTORAGE OG IKKE GJENNOM EN PROP-KJEDE, og det er
// den opprinnelige begrunnelsen, uendret: 3D-viseren er den som LESER flagget,
// og den monteres først etterpå. En prop gjennom hele kjeden for en
// demo-bryter er ikke verdt seks ekstra ledd. Viewer3D leser derfor nøklene
// direkte ved MONTERING, og det er med vilje — en reaktiv kilde ville lovet et
// bytte midt i en 3D-økt, som ikke er det som skjer.
//
// REFEN CACHES PER NØKKEL, så to kallsteder på samme flagg deler tilstand. Uten
// det ville en andre bruker av nøkkelen fått sin egen ref, og de to ville
// sprikt i det den ene ble endret — samme klasse feil som to flater med hver
// sin mening om relieffet (v7.8.4).
const lager = new Map()

function les(nokkel) {
  try { return localStorage.getItem(nokkel) === '1' } catch { return false }
}

/**
 * @param {string} nokkel localStorage-nøkkelen (prefikses `lende-` som resten)
 * @returns {{ pa: import('vue').Ref<boolean>, sett: (v: boolean) => void }}
 */
export function useDemoFlagg(nokkel) {
  if (!lager.has(nokkel)) {
    const pa = ref(les(nokkel))
    watch(pa, (v) => {
      try { localStorage.setItem(nokkel, v ? '1' : '0') } catch { /* privat modus */ }
    })
    lager.set(nokkel, pa)
  }
  const pa = lager.get(nokkel)
  return { pa, sett: (v) => { pa.value = !!v } }
}

// Nøklene samlet, så et navn ikke skrives av for hånd på to steder. Viewer3D
// har sine egne konstanter med samme verdier — den leser ved montering og skal
// ikke importere en reaktiv modul for det — og en test holder de to settene
// like.
export const DEMO_NOKLER = {
  vaer: 'lende-3d-vaerdemo',
  nordlys: 'lende-3d-nordlysdemo',
  himmelTvang: 'lende-3d-himmel-tvang',
}
