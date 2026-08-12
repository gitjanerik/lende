#!/usr/bin/env node
// Navnediff: hva forsvant ut av en stor komponent i denne endringen, og hvor
// ble det av det?
//
// Hvorfor denne finnes: uttrekk fra MapView.vue gjøres ved å KLIPPE en blokk ut
// og LIME den inn i en composable, og klippingen skjer på tekst. I v5.8.0 tok
// én slik sletting med seg tre ubeslektede blokker (`useReliefRender`- og
// `useGhostTiles`-kallene + en hillshade-watch) fordi de lå mellom start- og
// sluttmarkøren jeg siktet på. Verken 1 978 enhetstester eller produksjonsbygget
// merket noe. Røyktesten (`npm run royk`) fanger den varianten som KASTER ved
// montering — denne fanger den som forsvinner stille: en watch som ikke lenger
// finnes, et composable-kall som ingen overtok.
//
// Bruk:
//   npm run navnediff                                  # MapView mot origin/master
//   npm run navnediff -- src/views/MapView.vue --ref HEAD~1
//   npm run navnediff -- --ok formatDistance,startGpsTick   # kvitter ut villet sletting
//
// Exit 1 hvis et navn er borte men FORTSATT brukt (sikker bug), hvis et
// composable-kall forsvant uten å dukke opp i en ny fil, eller hvis noe er
// uforklart borte uten --ok. Det siste er ikke mistenksomhet for moro skyld:
// hele poenget er at en sletting skal være et valg, ikke en bieffekt.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flagg = (navn, def = null) => {
  const t = args.find((a) => a.startsWith(`--${navn}=`))
  if (t) return t.slice(navn.length + 3)
  const i = args.indexOf(`--${navn}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def
}
const FIL = args.find((a) => !a.startsWith('--') && a.includes('/')) ?? 'src/views/MapView.vue'
const REF = flagg('ref', 'origin/master')
const KVITTERT = new Set((flagg('ok', '') || '').split(',').map((s) => s.trim()).filter(Boolean))

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// ---- parsing --------------------------------------------------------------
// Vi leser bare deklarasjoner i KOLONNE 0 inne i <script setup>. Det er hele
// poenget: det er top-level-navnene som er komponentens flate, og det er de som
// forsvinner når en blokk klippes bort. Innrykkede navn er lokale og uinteressante.

function scriptDel(tekst) {
  const a = tekst.indexOf('<script setup>')
  if (a < 0) return tekst
  const b = tekst.indexOf('</script>', a)
  return tekst.slice(a + 14, b < 0 ? undefined : b)
}

// Fjern kommentarer før vi leter etter BRUK av et navn — ellers gir en
// forklarende kommentar («flyttet til useGpsSpor») falsk treff.
function utenKommentarer(tekst) {
  return tekst
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
}

function navnFraDestrukturering(innhold) {
  return innhold
    .split(',')
    .map((d) => d.split(':').pop().split('=')[0].trim())
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n))
}

function deklarasjoner(sfcTekst) {
  const linjer = scriptDel(sfcTekst).split('\n')
  const navn = new Set()
  const komposabler = []      // useX( kalt på top-level
  const kroker = { watch: 0, onMounted: 0, onUnmounted: 0, computed: 0 }

  for (let i = 0; i < linjer.length; i++) {
    const l = linjer[i]
    if (/^\s/.test(l) || !l.trim()) {
      // Ikke top-level — men tell kroker uansett hvor de står, se under.
    }
    const topp = !/^\s/.test(l)

    if (topp) {
      let m = l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
      if (m) navn.add(m[1])
      m = l.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/)
      if (m) navn.add(m[1])
      // Enlinjes destrukturering: const { a, b } = useX()
      m = l.match(/^(?:const|let)\s*\{(.+)\}\s*=/)
      if (m) for (const n of navnFraDestrukturering(m[1])) navn.add(n)
      // Flerlinjes destrukturering: `const {` … `} = useX({`
      if (/^(?:const|let)\s*\{\s*$/.test(l)) {
        const buffer = []
        let j = i + 1
        for (; j < linjer.length && !/^\}\s*=/.test(linjer[j]); j++) buffer.push(linjer[j])
        for (const n of navnFraDestrukturering(buffer.join(','))) navn.add(n)
        const kall = linjer[j]?.match(/^\}\s*=\s*([A-Za-z_$][\w$]*)/)
        if (kall) komposabler.push(kall[1])
        i = j
        continue
      }
      const kall = l.match(/^(?:const|let)\s*(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/)
      if (kall && /^use[A-Z]/.test(kall[1])) komposabler.push(kall[1])
      const bart = l.match(/^([A-Za-z_$][\w$]*)\s*\(/)
      if (bart && /^use[A-Z]/.test(bart[1])) komposabler.push(bart[1])
      for (const k of Object.keys(kroker)) if (l.startsWith(`${k}(`)) kroker[k] += 1
    }
    // Importerte navn regnes som deklarert (de er en del av flaten).
    const imp = l.match(/^import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))/)
    if (imp) {
      if (imp[1]) for (const n of navnFraDestrukturering(imp[1])) navn.add(n)
      if (imp[2]) navn.add(imp[2])
    }
  }
  return { navn, komposabler, kroker }
}

// ---- kjøring --------------------------------------------------------------

const nyTekst = readFileSync(FIL, 'utf8')
let gammelTekst
try {
  gammelTekst = git('show', `${REF}:${FIL}`)
} catch {
  console.error(`✗ fant ikke ${FIL} i ${REF} — er ref-en hentet? (git fetch origin)`)
  process.exit(1)
}

const gammel = deklarasjoner(gammelTekst)
const ny = deklarasjoner(nyTekst)

// Filer som er lagt til eller endret i denne endringen, uten den vi ser på:
// det er dit et uttrekk skal ha flyttet navnet.
// Merk `ls-files --others`: en fersk composable er UTRACKET til den er staget,
// og `git diff` ser den ikke. Uten den halvdelen rapporterte verktøyet «16
// uforklart borte» for navn som lå i splitter nye filer rett ved siden av.
const endredeFiler = [
  ...git('diff', '--name-only', REF, '--', 'src', 'mcp', 'scripts').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard', '--', 'src', 'mcp', 'scripts').split('\n'),
].map((s) => s.trim()).filter((s) => s && s !== FIL)
const nyeFilerTekst = new Map()
for (const f of endredeFiler) {
  try { nyeFilerTekst.set(f, readFileSync(f, 'utf8')) } catch { /* slettet */ }
}

// Teksten vi leter etter BRUK i. Tre ting må vaskes bort, ellers roper verktøyet
// om navn som bare tilfeldigvis staves likt — og et gate-verktøy som roper feil
// blir slått av:
//   • property-tilgang (`tour.open3d` er ikke en referanse til vår `open3d`)
//   • attributt-navn i malen (`@open3d="openTour3d"` — navnet er en event, ikke en verdi)
//   • objekt-nøkler på egen linje (`open3d: nav.open3d`)
//   • sitat-strenger — `import { findByName } from './useMapSearch.js'` er en
//     STI, ikke en referanse til funksjonen useMapSearch. (Template-literaler
//     røres ikke: `${foo}` inni dem ER kode.)
const brukTekst = utenKommentarer(nyTekst)
  .replace(/'[^'\n]*'|"[^"\n]*"/g, "''")
  .replace(/\.\s*[A-Za-z_$][\w$]*/g, '.')
  .replace(/([\s@:])[\w.-]+=(?=["'])/g, '$1=')
  .replace(/^[ \t]*[A-Za-z_$][\w$]*[ \t]*:/gm, ':')
const bruktI = (navn) => new RegExp(`(?<![\\w$])${navn}\\b`).test(brukTekst)
const finnesI = (navn) => [...nyeFilerTekst.entries()]
  .filter(([, t]) => new RegExp(`\\b${navn}\\b`).test(t))
  .map(([f]) => f.replace(/^src\/(composables|lib)\//, ''))

const borte = [...gammel.navn].filter((n) => !ny.navn.has(n)).sort()
const fortsattBrukt = []
const flyttet = []
const uforklart = []
for (const n of borte) {
  if (bruktI(n)) { fortsattBrukt.push(n); continue }
  const traff = finnesI(n)
  if (traff.length) flyttet.push([n, traff])
  else if (!KVITTERT.has(n)) uforklart.push(n)
}

const nye = [...ny.navn].filter((n) => !gammel.navn.has(n)).sort()

console.log(`navnediff: ${FIL} mot ${REF}`)
console.log(`  top-level-navn: ${gammel.navn.size} → ${ny.navn.size} (${nye.length} nye, ${borte.length} borte)`)
for (const k of Object.keys(ny.kroker)) {
  const d = ny.kroker[k] - gammel.kroker[k]
  if (d) console.log(`  ${k}(: ${gammel.kroker[k]} → ${ny.kroker[k]} (${d > 0 ? '+' : ''}${d})`)
}

if (flyttet.length) {
  console.log(`\n✓ flyttet (${flyttet.length}):`)
  const perFil = new Map()
  for (const [n, filer] of flyttet) {
    const nøkkel = filer.join(', ')
    perFil.set(nøkkel, [...(perFil.get(nøkkel) ?? []), n])
  }
  for (const [f, navn] of perFil) console.log(`   → ${f}: ${navn.join(', ')}`)
}

let kode = 0

// Et composable-kall som forsvant og ikke ble overtatt av en ny fil er nesten
// alltid en utilsiktet sletting — dette er præcis feilen i v5.8.0.
const komposablerBorte = gammel.komposabler.filter((k) => !ny.komposabler.includes(k))
const hjemløse = komposablerBorte.filter((k) => !finnesI(k).length && !KVITTERT.has(k))
if (hjemløse.length) {
  console.log(`\n✗ composable-kall forsvant uten å dukke opp i en ny fil: ${hjemløse.join(', ')}`)
  console.log('   Ble blokken slettet ved et uhell? Kvitter ut med --ok hvis den skulle bort.')
  kode = 1
}

if (fortsattBrukt.length) {
  console.log(`\n✗ borte, men FORTSATT brukt i fila (${fortsattBrukt.length}):`)
  for (const n of fortsattBrukt) console.log(`   ${n}`)
  console.log('   Dette kaster i nettleseren. Importer navnet, eller fjern bruken.')
  kode = 1
}

if (uforklart.length) {
  console.log(`\n⚠ uforklart borte (${uforklart.length}) — ikke brukt, ikke funnet i endrede filer:`)
  for (const n of uforklart) console.log(`   ${n}`)
  console.log(`   Var det med vilje? Kvitter ut: npm run navnediff -- --ok ${uforklart.join(',')}`)
  kode = 1
}

if (!kode) console.log(`\n✓ ingenting forsvant stille${KVITTERT.size ? ` (kvittert ut: ${[...KVITTERT].join(', ')})` : ''}`)
process.exit(kode)
