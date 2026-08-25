#!/usr/bin/env node
// Trenger denne endringen et EKTE Vardåsen-kart i røyktesten?
//
// `--ektekart` bygger et ferskt kart fra Kartverket + OSM og koster ~2 av
// røyk-jobbens ~3 minutter. Sju av de tjue sjekkene krever det; de øvrige
// tretten klarer seg med det sporede demo-kartet i repoet.
//
// Gaten er IKKE «rører endringen kart-pipelinen». Det var den første
// formuleringen, og den er feil: de sju sjekkene dekker useNavnLod,
// useViewportCull, useGhostTiles, useKartSok, useKartEksport, useGestPerf og
// Viewer3D + vaerHimmel — altså composables og komponenter, ikke pipelinen. En
// ren pipeline-gate ville derfor hoppet STILLE over navn-LOD-sjekken på en PR
// som endrer nettopp useNavnLod, og en sjekk som ikke virker er verre enn ingen
// sjekk.
//
// To regler, i rekkefølge:
//   1. Rører endringen noe på MÅ-lista → ekte kart.
//   2. Rører den noe som IKKE står på TRYGG-lista → ekte kart. Ukjente stier
//      faller altså til den dyre siden med vilje: legger noen til en ny
//      `krever: 'ektekart'`-sjekk for et nytt domene, blir den dekket av seg
//      selv. Det er den ene feilretningen vi kan leve med.
//
// Bruk:  git diff --name-only origin/master HEAD | node scripts/trenger-ektekart.mjs
// Exit 0 = trengs (bygg ekte kart), exit 1 = trengs ikke.

// Filene de sju ektekart-sjekkene faktisk trykker på, pluss kart-pipelinen
// (src/lib/**) og selve testen. MapView.vue står her fordi den komponerer alle
// sju domenene — endrer man den, vil man ha maks dekning.
export const MAA_HA_EKTEKART = [
  /^src\/lib\//,
  /^src\/views\/MapView\.vue$/,
  /^src\/components\/tour3d\//,
  /^src\/composables\/use(NavnLod|ViewportCull|GhostTiles|KartSok|KartEksport|GestPerf)\.js$/,
  /^scripts\/royk-mapview\.mjs$/,
  /^scripts\/build-vardasen-svg\.js$/,
  /^scripts\/trenger-ektekart\.(mjs|test\.js)$/,
]

// Stier vi VET ikke trenger et ekte kart. Alt utenfor både denne og lista over
// regnes som ukjent → ekte kart.
export const TRYGT_UTEN_EKTEKART = [
  /^src\/composables\//,
  /^src\/components\//,
  /^src\/router\.js$/,
  /^src\/App\.vue$/,
  /^src\/version\.js$/,
  /^scripts\/(navnediff|ruter-royk|frie-variabler)\.mjs$/,
  /^\.github\//,
  /^CHANGELOG\.md$/,
  /^package(-lock)?\.json$/,
  /^public\/sw\.js$/,
]

/**
 * @param {string[]} filer endrede filer, repo-relative
 * @returns {{ ekte: boolean, grunn: string }}
 */
export function trengerEktekart(filer) {
  const rene = (filer || []).map((f) => f.trim()).filter(Boolean)
  if (!rene.length) return { ekte: true, grunn: 'fant ingen endrede filer — velger dyr og trygg' }

  const truffet = rene.find((f) => MAA_HA_EKTEKART.some((re) => re.test(f)))
  if (truffet) return { ekte: true, grunn: `${truffet} er på må-lista` }

  const ukjent = rene.find((f) => !TRYGT_UTEN_EKTEKART.some((re) => re.test(f)))
  if (ukjent) return { ekte: true, grunn: `${ukjent} er ukjent for gaten — velger dyr og trygg` }

  return { ekte: false, grunn: `${rene.length} fil(er), alle trygge uten ekte kart` }
}

// Kjørt direkte (ikke importert av testen): les stdin, skriv grunnen, sett exit.
if (process.argv[1] && process.argv[1].endsWith('trenger-ektekart.mjs')) {
  const inn = await new Promise((res) => {
    let s = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => { s += d })
    process.stdin.on('end', () => res(s))
  })
  const { ekte, grunn } = trengerEktekart(inn.split('\n'))
  console.log(`${ekte ? 'ekte kart' : 'demo-kart'}: ${grunn}`)
  process.exit(ekte ? 0 : 1)
}
