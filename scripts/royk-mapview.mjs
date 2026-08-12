#!/usr/bin/env node
// Røyktest for MapView — monterer kartet i en EKTE nettleser og trykker på
// hvert domene som er trukket ut i en composable.
//
// Hvorfor denne finnes: under v5.8.0-uttrekket oppsto tre monteringsfeil (to
// TDZ-feil på verdier sendt inn før de var deklarert, og en tekst-sletting som
// tok med seg tre ubeslektede blokker). ALLE tre passerte `npm run test`
// (1 978 tester) og `npm run build` uten en lyd — Vue-oppsettet kaster først
// når komponenten faktisk monteres, og et bygg monterer ingenting. Denne testen
// fanget alle tre på under et minutt.
//
// Regelen for nye sjekker: én sjekk per domene som er trukket ut, og sjekken
// skal TRYKKE på noe — ikke bare lete etter markup. En knapp som finnes men
// kaller en udefinert funksjon ser frisk ut i DOM-en.
//
// Bruk:
//   npm run royk                  # bygger, starter vite preview, tester
//   npm run royk -- --url=http://localhost:5173/lende   # mot kjørende dev-server
//   npm run royk -- --bilder=/tmp/royk                  # lagre skjermbilder
//
// Exit 1 ved enhver JS-feil i konsollen eller en feilet sjekk.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flagg = (navn, def = null) => {
  const t = args.find((a) => a.startsWith(`--${navn}=`))
  return t ? t.slice(navn.length + 3) : (args.includes(`--${navn}`) ? true : def)
}
const EGEN_URL = flagg('url')
const BILDER = flagg('bilder')
const EKTEKART = !!flagg('ektekart')
const PREVIEW_PORT = 4173
const BASE = EGEN_URL || `http://localhost:${PREVIEW_PORT}/lende`

// Nettverksfeil er ikke det vi tester. Kartet (public/maps/vardasen.svg) ligger
// i repoet, så MONTERINGEN er offline; DEM, kulturminner og vannmålestasjoner
// hentes live og har graceful fallback. Å feile på dem ville gjort røyktesten
// avhengig av at Kartverket er oppe.
// To ting til som er miljø, ikke app:
//   • `navigator.vibrate` blokkeres av Chromium til brukeren har tappet i ramma.
//   • CORS: proxy-Workeren slipper bare gjennom `https://gitjanerik.github.io`,
//     så et kall fra localhost avvises PER DESIGN. Merk hva dette betyr: en ekte
//     CORS-regresjon på produksjons-origin vil røyktesten IKKE se.
const STØY = new RegExp([
  'ERR_', 'Failed to load resource', 'Failed to fetch', 'net::', 'NetworkError',
  '429', '503', 'navigator\\.vibrate', 'blocked by CORS policy',
].join('|'), 'i')

// ---- sjekkene -------------------------------------------------------------
// Hver sjekk: { navn, domene, kjør(page) → string (hva som ble observert) }.
// Kast for å feile. `domene` peker på composable-en sjekken dekker, så det er
// synlig hvilke uttrekk som IKKE har røykdekning ennå.

const SJEKKER = [
  {
    navn: 'kartet monterer',
    domene: 'MapView',
    async kjør(page) {
      await page.waitForSelector('svg.isom-map', { timeout: 60_000 })
      // Terreng-først: skjelettet er i DOM-en før detalj-passet. Vent til
      // symbol-/geometri-antallet har roet seg, ellers måler de neste sjekkene
      // på et halvferdig kart.
      const tell = () => page.evaluate(() =>
        document.querySelectorAll('svg.isom-map path, svg.isom-map use, svg.isom-map polygon').length)
      let forrige = -1
      let n = await tell()
      for (let i = 0; i < 20 && n !== forrige; i++) {
        forrige = n
        await page.waitForTimeout(500)
        n = await tell()
      }
      // Innebygde vardasen.svg i repoet er en symbol-demo (~400 elementer) —
      // det ekte kartet bygges i deploy-workflowen. Terskelen må derfor treffe
      // «noe er faktisk tegnet», ikke «kartet er detaljrikt».
      if (n < 50) throw new Error(`bare ${n} tegnede elementer — rendret kartet egentlig?`)
      const lag = await page.evaluate(() =>
        new Set([...document.querySelectorAll('[data-layer]')].map((g) => g.dataset.layer)).size)
      if (lag < 5) throw new Error(`bare ${lag} lag-grupper i SVG-en`)
      return `${n} elementer i ${lag} lag`
    },
  },
  {
    navn: 'lag-toggle slår grupper av og på',
    domene: 'useLagStyring',
    async kjør(page) {
      await åpneDrawer(page)
      const synlige = () => page.evaluate(() => [...document.querySelectorAll('[data-layer="sti"]')]
        .filter((g) => g.style.display !== 'none').length)
      const før = await synlige()
      if (!før) throw new Error('fant ingen synlige sti-grupper å slå av')
      await klikkTekst(page, /^Sti$/)
      const av = await synlige()
      if (av !== 0) throw new Error(`Sti-laget ble ikke skjult (${før} → ${av})`)
      await klikkTekst(page, /^Sti$/)
      const på = await synlige()
      if (på !== før) throw new Error(`Sti-laget kom ikke tilbake (${før} → ${av} → ${på})`)
      return `${før} → 0 → ${på} grupper`
    },
  },
  {
    navn: 'deling gir en lenke',
    domene: 'useKartDeling',
    async kjør(page) {
      await åpneDrawer(page)
      await klikkTekst(page, /^EKSPORT$/)
      await klikkTekst(page, /Del kart/)
      await page.waitForTimeout(600)
      const url = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
      if (!/^https?:\/\/.+\/kart\//.test(url)) throw new Error(`utklippstavla fikk «${url}»`)
      return url.replace(/^https?:\/\/[^/]+/, '')
    },
  },
  {
    navn: 'GPS starter og gir posisjon',
    domene: 'useGpsSpor',
    async kjør(page) {
      await åpneDrawer(page)
      await klikkTekst(page, /Start GPS/)
      await page.waitForTimeout(2500)
      const prikk = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map [id*="user"], svg.isom-map [data-user-pos]').length)
      if (!prikk) throw new Error('ingen brukerposisjon i kartet etter Start GPS')
      return `${prikk} posisjons-node(r)`
    },
  },
  {
    navn: 'zoom rører navn-LOD',
    domene: 'useNavnLod',
    // Demo-kartet i repoet har 7 labels og ingen data-bbox — verken LOD eller
    // culling har noe å gjøre der. Disse to sjekkene krever et ekte kart.
    krever: 'ektekart',
    async kjør(page) {
      await lukkDrawer(page)
      const tell = () => page.evaluate(() => ({
        lod: document.querySelectorAll('svg.isom-map .name-lod-off').length,
        geometri: document.querySelectorAll('svg.isom-map path.name-lod-off').length,
      }))
      const før = await tell()
      await zoomInn(page, 6)
      const etter = await tell()
      if (etter.lod === før.lod) {
        throw new Error(`zoom endret ikke navne-LOD (${før.lod} → ${etter.lod})`)
      }
      // Geometri skal ALDRI LOD-skjules. Da forsvant innsjøene (2026-07-21):
      // navngitte polygoner står i søkeindeksen med selve polygonet som `el`.
      if (etter.geometri) {
        throw new Error(`${etter.geometri} <path> fikk name-lod-off — navn-LOD toggler geometri`)
      }
      return `${før.lod} → ${etter.lod} skjulte navn`
    },
  },
  {
    navn: 'dyp zoom culler vektorer',
    domene: 'useViewportCull',
    krever: 'ektekart',
    async kjør(page) {
      // Culling gjør INGENTING på oversiktszoom — cull-rekta dekker hele kartet
      // og det er meningen («null arbeid ved oversikts-zoom»). Målt på Vardåsen:
      // første treff ved ~10 hjul-tikk, 289 ved 15, 809 ved 30. Vi zoomer godt
      // forbi terskelen så sjekken ikke står og vipper på den.
      await zoomInn(page, 16)
      const cullet = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map .vp-cull').length)
      if (!cullet) throw new Error('ingenting cullet etter dyp zoom — ble indeksen bygget?')
      return `${cullet} elementer cullet`
    },
  },
  {
    navn: 'strek-knotten endrer --stroke-scale',
    domene: 'useKartKnotter',
    async kjør(page) {
      await lukkDrawer(page)
      const les = () => page.evaluate(() =>
        document.querySelector('svg.isom-map')?.style.getPropertyValue('--stroke-scale') || '')
      const før = await les()
      // FAB-ene styres av pointerdown/pointerup (useLongPress), ikke @click — et
      // el.click() fra evaluate() gjør INGENTING her. Playwright-locator sender
      // en ekte peker-sekvens, så den må brukes for alt i FabCluster.
      await page.locator('[aria-label*="vis kartknappene"]').click()
      await page.waitForTimeout(700)
      await page.locator('[aria-label^="Strektykkelse"]').click()
      await page.waitForTimeout(800)
      const etter = await les()
      if (!etter || etter === før) {
        throw new Error(`--stroke-scale endret seg ikke ("${før}" → "${etter}")`)
      }
      // Hint-boblen er knottens egen tilbakemelding — den beviser at watchen kjørte
      // (og ikke bare at en computed ble lest).
      const hint = await page.evaluate(() => /Strek [\d.]+×/.test(document.body.innerText))
      if (!hint) throw new Error('ingen hint-boble etter knott-tapp — kjørte watchen?')
      return `--stroke-scale ${Number(før).toFixed(3)} → ${Number(etter).toFixed(3)}, hint vist`
    },
  },
  {
    navn: 'hold på knotten åpner FAB-panelet',
    domene: 'useKartKnotter',
    async kjør(page) {
      // Lang-trykk (600 ms) = åpne panelet. Panelet er per-kart-finjusteringen,
      // og «Angi som standard»/«Nullstill» bor der.
      const knott = page.locator('[aria-label^="Strektykkelse"]')
      const boks = await knott.boundingBox()
      await page.mouse.move(boks.x + boks.width / 2, boks.y + boks.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(900)
      await page.mouse.up()
      await page.waitForTimeout(600)
      const åpent = await page.evaluate(() =>
        !!document.querySelector('[aria-label="Lukk panel"]'))
      if (!åpent) throw new Error('FAB-panelet åpnet ikke på lang-trykk')
      const harNullstill = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => b.offsetParent && /Nullstill/i.test(b.innerText)))
      await page.locator('[aria-label="Lukk panel"]').click()
      await page.waitForTimeout(400)
      return `panel åpnet${harNullstill ? ' med Nullstill' : ' (fant ingen Nullstill)'}`
    },
  },
  {
    navn: 'måling legger vertices og regner distanse',
    domene: 'useMaaling',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkTekst(page, /^Måling$/)
      await page.waitForTimeout(700)
      // Tre tapp i kartflaten = to strekk. Ekte museklikk: måle-modus lytter på
      // kart-tappen, ikke på en knapp.
      const boks = await page.locator('svg.isom-map').boundingBox()
      const punkter = [[-70, -60], [40, -20], [10, 70]]
      for (const [dx, dy] of punkter) {
        await page.mouse.click(boks.x + boks.width / 2 + dx, boks.y + boks.height / 2 + dy)
        await page.waitForTimeout(350)
      }
      await page.waitForTimeout(600)
      const vertices = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map #measure-layer circle, svg.isom-map [data-measure] circle').length)
      const tall = await page.evaluate(() => {
        const t = document.body.innerText
        const m = t.match(/(\d+[,.]?\d*)\s*(m|km)\b/g)
        return m ? m.slice(0, 3).join(' ') : ''
      })
      if (!vertices && !tall) throw new Error('verken vertices i kartet eller distanse i UI etter tre tapp')
      // Rydd etter seg: måle-modus bytter ut fane-raden, så neste sjekk fant
      // ikke 3D-knappen. En sjekk skal alltid forlate appen i nøytral tilstand.
      await klikkTekst(page, /^(Avslutt måling|Måling)$/)
      await page.waitForTimeout(500)
      return `${vertices} vertices, leste «${tall}»`
    },
  },
  {
    navn: 'eksport bygger SVG-markup, tema-bytte maler om',
    domene: 'useKartEksport+useTemaBytte',
    async kjør(page) {
      await åpneDrawer(page)
      // Eksport: «Lagre .svg» laster ned en fil. Vi fanger nedlastingen i stedet
      // for å skrive den til disk — det som skal bevises er at markupen bygges.
      await klikkTekst(page, /^EKSPORT$/)
      const last = page.waitForEvent('download', { timeout: 20_000 })
      await klikkTekst(page, /Lagre \.svg/)
      const fil = await last
      // Sjekk INNHOLDET, ikke filnavnet: navnet kommer fra en blob-URL og
      // rapporteres som «download» i headless Chromium (tittelen har «å» og
      // «·»). Innholdet er dessuten det som faktisk beviser at markupen ble
      // bygget — med tema bakt inn og spøkelses-flisene klippet bort.
      const sti = await fil.path()
      const tekst = sti ? readFileSync(sti, 'utf8') : ''   // hele fila: data-iso kan ligge langt inn
      if (!/<svg[\s>]/.test(tekst)) throw new Error('nedlastet fil er ikke SVG')
      if (!/data-iso=/.test(tekst)) throw new Error('SVG-en mangler ISOM-lag — tom eksport?')
      if (/id="ghost-tiles"/.test(tekst)) throw new Error('spøkelses-flisene ble med i eksporten')
      const navn = fil.suggestedFilename()
      // Tema: bytt til et annet tema og se at kart-variablene faktisk endres.
      await klikkTekst(page, /^TEMA$/)
      await page.waitForTimeout(500)
      // Tema-variablene settes på [data-map-inner] (mapInnerRef). Lys tema setter
      // INGEN vars — det er default — så «tomt → farge» er det forventede
      // utfallet ved bytte til et mørkt tema, ikke et tegn på at noe mangler.
      const les = () => page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        if (!el) throw new Error('fant ikke [data-map-inner]')
        return getComputedStyle(el).getPropertyValue('--bg').trim()
      })
      const før = await les()
      const byttet = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((e) =>
          e.offsetParent && /^(Natt|Mørk|Dark|Curves|Skisse)$/i.test(e.innerText.trim()))
        if (!b) return ''
        b.click(); return b.innerText.trim()
      })
      if (!byttet) throw new Error('fant ingen tema-knapp å bytte til')
      await page.waitForTimeout(900)
      const etter = await les()
      if (før === etter) throw new Error(`tema «${byttet}» endret ikke --bg ("${før}")`)
      if (!etter) throw new Error(`tema «${byttet}» satte ingen --bg`)
      await lukkDrawer(page)      // nøytral tilstand for neste sjekk
      return `${(tekst.length / 1024).toFixed(0)} kB SVG (${navn}), tema «${byttet}»: --bg "${før}" → "${etter}"`
    },
  },
  {
    navn: 'søk highlighter et treff og panorerer dit',
    domene: 'useKartSok',
    // Demo-kartet har sju navn; et ekte kart har ~200. Vi trenger et navn å
    // søke opp, så sjekken krever ekte kart.
    krever: 'ektekart',
    async kjør(page) {
      await lukkDrawer(page)
      // Finn et navn som faktisk står i kartet, og søk på de fire første
      // bokstavene — da er sjekken uavhengig av hvilke stedsnavn Vardåsen har.
      const navn = await page.evaluate(() => {
        const t = [...document.querySelectorAll('svg.isom-map text')]
          .map((e) => (e.textContent || '').trim())
          .filter((s) => /^[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s-]{4,}$/.test(s))
        return t[0] || ''
      })
      if (!navn) throw new Error('fant ingen stedsnavn i kartet å søke på')
      const før = await page.evaluate(() =>
        document.querySelector('[data-map-inner]')?.style.transform || '')
      await klikkTekst(page, /^Søk i kart$/)
      await page.waitForTimeout(500)
      await page.locator('input[type="search"], input[type="text"]').first()
        .fill(navn.slice(0, 4))
      await page.waitForTimeout(900)
      // Første treff i kart-lista (ikke «Andre steder» — det bygger nytt kart).
      const traff = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button, [role="option"]')]
          .filter((e) => e.offsetParent && /^[A-Za-zÆØÅæøå]/.test(e.innerText.trim()))
        const t = b.find((e) => !/Andre steder|Lag kart|Søk/i.test(e.innerText))
        if (!t) return ''
        t.click(); return t.innerText.trim().split('\n')[0]
      })
      if (!traff) throw new Error(`ingen treff-knapp for «${navn.slice(0, 4)}»`)
      await page.waitForTimeout(1600)     // pan + panToSettled-vinduet
      const ring = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map #search-highlight-layer *').length)
      const etter = await page.evaluate(() =>
        document.querySelector('[data-map-inner]')?.style.transform || '')
      if (!ring) throw new Error('ingen highlight-ring etter valgt treff')
      if (før === etter) throw new Error('kartet panorerte ikke til treffet')
      // Nøytral tilstand: highlight-chippen ERSTATTER fane-raden mens den står,
      // så neste sjekk finner ikke 3D-knappen. Fjern markeringen.
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      await klikkTekst(page, /^Fjern markering$/)
      await page.waitForTimeout(400)
      return `«${traff}» → ${ring} ring-noder, transform endret`
    },
  },
  {
    navn: 'eksport av rotert kart gir vannrette labels',
    domene: 'useKartEksport',
    krever: 'ektekart',
    async kjør(page) {
      // Skjermen counter-roterer labels så de står vannrett mens kartet er
      // rotert. Den eksporterte SVG-en er ALLTID nord-opp, så counter-
      // rotasjonen må ikke følge med ut — ellers står 179 navn skjevt på et
      // rett kart (rapportert etter PDF-test, rettet i v5.14.0).
      await lukkDrawer(page)
      const rotert = await page.evaluate(() => {
        const sl = document.querySelector('input[aria-label*="Roter kartet"]')
        if (!sl) return false
        sl.value = '40'
        sl.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })
      if (!rotert) throw new Error('fant ingen rotasjons-slider (kjører testen i mobil-viewport?)')
      await page.waitForTimeout(1200)
      const skjermFør = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map text[transform^="rotate(-40"]').length)
      if (!skjermFør) throw new Error('labels ble ikke counter-rotert på skjermen — rotasjonen slo ikke inn')

      await åpneDrawer(page)
      await klikkTekst(page, /^EKSPORT$/)
      const last = page.waitForEvent('download', { timeout: 20_000 })
      await klikkTekst(page, /Lagre \.svg/)
      const sti = await (await last).path()
      const fil = sti ? readFileSync(sti, 'utf8') : ''
      const skjeve = (fil.match(/<text[^>]*transform="rotate\((?!0[\s)])/g) || []).length
      if (skjeve) throw new Error(`${skjeve} labels er rotert i den eksporterte fila`)

      // Fra v5.16.0 nullstiller eksporten rotasjonen på skjermen først, så det
      // brukeren ser er det han får. Kartet skal altså stå nord-opp etterpå — og
      // labelene skal følgelig stå vannrett også der.
      await lukkDrawer(page)
      const rotEtter = await page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        const m = /rotate\((-?[\d.]+)deg\)/.exec(el?.style.transform || '')
        return m ? Math.round(Number(m[1])) : 0
      })
      if (rotEtter !== 0) throw new Error(`kartet står fortsatt rotert (${rotEtter}°) etter eksport`)
      const skjeveEtter = await page.evaluate(() =>
        [...document.querySelectorAll('svg.isom-map text')]
          .filter((e) => /rotate\(-?(?!0[\s)])[\d.]+/.test(e.getAttribute('transform') || '')).length)
      if (skjeveEtter) throw new Error(`${skjeveEtter} labels står skjevt på skjermen etter eksport`)
      return `${skjermFør} skjeve på skjerm → 0 i fil → kartet nullstilt til nord`
    },
  },
  {
    navn: 'gest slår på perf-modus og rydder etter seg',
    domene: 'useGestPerf',
    krever: 'ektekart',
    async kjør(page) {
      // Dette er sjekken som gjør at perf-tiltakene ikke kan «ryddes bort» ved
      // et uhell: de er usynlige når de virker, så ingenting brekker visuelt om
      // de forsvinner — kartet blir bare hakkete igjen på mobil.
      await lukkDrawer(page)
      const les = () => page.evaluate(() => {
        const svg = document.querySelector('svg.isom-map')
        const p = svg?.querySelector('[data-layer] path')
        return {
          zoomer: !!svg?.classList.contains('is-zooming'),
          solid: p?.style.strokeDasharray === 'none',
        }
      })
      await pekMidtPaaKartet(page)
      // Midt i gesten: hjul-zoom holder isGesturing i 200 ms etter siste tikk.
      await page.mouse.wheel(0, -200)
      await page.waitForTimeout(60)
      const under = await les()
      if (!under.zoomer) throw new Error('.is-zooming ble ikke satt under gest')
      if (!under.solid) throw new Error('stiplede streker ble ikke gjort solide under gest')
      // Etter gesten (200 ms wheel-end + 120 ms utsatt gjenoppretting + slakk).
      await page.waitForTimeout(1200)
      const etter = await les()
      if (etter.zoomer) throw new Error('.is-zooming ble ikke fjernet etter gest')
      if (etter.solid) throw new Error('dash-overstyringen ble ikke ryddet etter gest')
      return 'is-zooming + solid dash under gest, ryddet etterpå'
    },
  },
  {
    navn: '3D-visningen åpner',
    domene: 'use3dEntry',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkTekst(page, /^3D$/)
      // To gyldige utfall: en three.js-canvas, ELLER viserens ærlige «ingen
      // høydedata»-melding. Det siste er hva demo-kartet i repoet gir (det har
      // ingen DEM), og en røyktest skal ikke feile på manglende terrengdata —
      // den skal feile hvis INNGANGEN er ødelagt. Kjør med --ektekart for å
      // faktisk nå canvas-veien.
      const utfall = await page.waitForFunction(() => {
        const c = document.querySelector('canvas')
        if (c && c.width > 0) return `canvas ${c.width}×${c.height}`
        if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem-melding'
        return false
      }, null, { timeout: 45_000 }).then((h) => h.jsonValue())
      const lukk = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((e) =>
          e.offsetParent && /Lukk|✕|×/.test(e.getAttribute('aria-label') || e.innerText))
        if (b) { b.click(); return true }
        return false
      })
      return `${utfall}${lukk ? '' : ' (fant ingen lukkeknapp)'}`
    },
  },
]

// ---- små hjelpere ---------------------------------------------------------

// Vi treffer knapper på TEKST og ikke på CSS-klasser med vilje: klassene i
// denne appen er Tailwind-kjeder som endres støtt, mens teksten er UI-kontrakt.
async function klikkTekst(page, re) {
  const traff = await page.evaluate((kilde) => {
    const rx = new RegExp(kilde.source, kilde.flags)
    const b = [...document.querySelectorAll('button, [role="button"]')].find((e) =>
      e.offsetParent !== null && rx.test((e.innerText || e.getAttribute('aria-label') || '').trim()))
    if (!b) return false
    b.click()
    return true
  }, { source: re.source, flags: re.flags })
  if (!traff) throw new Error(`fant ingen synlig knapp som matcher ${re}`)
  await page.waitForTimeout(700)
}

// Hjul = zoom i denne appen (usePinchZoom.onWheel, 1.1× pr tikk — ingen
// ctrl-tast). Små pauser fordi både LOD og culling er debouncet 120 ms.
// Midt i VIEWPORTEN — ikke midt i elementets bbox. Etter en dyp zoom er SVG-ens
// bbox langt større enn skjermen, og senteret havner utenfor vinduet: musen
// flyttes dit, og hjul-eventet treffer ingenting. Kostet én feilsøkt sjekk.
async function pekMidtPaaKartet(page) {
  const vp = page.viewportSize()
  await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2))
}

async function zoomInn(page, tikk) {
  await pekMidtPaaKartet(page)
  for (let i = 0; i < tikk; i++) {
    await page.mouse.wheel(0, -260)
    await page.waitForTimeout(140)
  }
  await page.waitForTimeout(1000)
}

async function åpneDrawer(page) {
  if (!(await erDrawerÅpen(page))) await klikkTekst(page, /^Innstillinger$/)
  await page.waitForTimeout(400)
}

async function lukkDrawer(page) {
  // Escape først (skuffen lytter på den), så ✕-knappen i hodet som reserve. Å
  // trykke «Innstillinger» på nytt virket ikke: den treffer også fane-raden, og
  // sjekken etterpå kjørte med skuffen fortsatt over FAB-ene.
  for (let i = 0; i < 3; i++) {
    if (!(await erDrawerÅpen(page))) return
    await klikkTekst(page, /^Lukk innstillinger$/)
    await page.waitForTimeout(350)
  }
  if (await erDrawerÅpen(page)) throw new Error('fikk ikke lukket innstillings-skuffen')
}

function erDrawerÅpen(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => b.offsetParent && /^KARTLAG$/.test(b.innerText.trim())))
}

function ventPå(url, maksMs = 60_000) {
  const start = Date.now()
  return new Promise((ok, nei) => {
    const prøv = async () => {
      try {
        const r = await fetch(url)
        if (r.ok) return ok()
      } catch { /* server ikke oppe ennå */ }
      if (Date.now() - start > maksMs) return nei(new Error(`${url} svarte ikke på ${maksMs} ms`))
      setTimeout(prøv, 400)
    }
    prøv()
  })
}

function kjør(kommando, argv) {
  return new Promise((ok, nei) => {
    const p = spawn(kommando, argv, { stdio: 'inherit' })
    p.on('exit', (k) => (k === 0 ? ok() : nei(new Error(`${kommando} ${argv.join(' ')} → ${k}`))))
  })
}

// `public/maps/vardasen.svg` i repoet er en symbol-demo; det ekte kartet bygges
// i deploy-workflowen. --ektekart bygger et ferskt Vardåsen-kart fra Kartverket
// + OSM (~12 s, krever nett) og legger det i dist-en vi tester mot. Det SPOREDE
// demo-kartet legges tilbake etterpå — røyktesten skal ikke etterlate en diff.
const DEMO_KART = 'public/maps/vardasen.svg'
// Returnerer om vi FIKK et ekte kart. Feiler byggingen (kildene er nede, ingen
// nett), går vi videre med demo-kartet og hopper over sjekkene som krever ekte
// geometri — en PR skal ikke blokkeres av at Overpass har en dårlig dag.
async function byggEkteKart() {
  const original = readFileSync(DEMO_KART)
  try {
    console.log('→ bygger ekte Vardåsen-kart (nett) …')
    await kjør('node', ['scripts/build-vardasen-svg.js'])
    copyFileSync(DEMO_KART, 'dist/maps/vardasen.svg')
    return true
  } catch (err) {
    console.log(`⚠ klarte ikke bygge ekte kart (${err.message}) — kjører på demo-kartet`)
    return false
  } finally {
    writeFileSync(DEMO_KART, original)
  }
}

async function startPreview() {
  // Bygg ALLTID. Å gjenbruke en eksisterende dist sparer to sekunder og lyver:
  // første versjon av denne fila gjorde det, og rapporterte grønt/rødt for kode
  // som ikke lenger sto i src. En sikkerhetsnett som tester gammel kode er verre
  // enn ingen. --hoppbygg finnes for feilsøking av testen selv.
  if (!flagg('hoppbygg')) {
    console.log('→ bygger …')
    await kjør('npm', ['run', 'build'])
  } else if (!existsSync('dist/index.html')) {
    throw new Error('--hoppbygg, men dist/index.html finnes ikke')
  }
  if (EKTEKART) harEkteKart = await byggEkteKart()
  console.log(`→ starter vite preview på ${PREVIEW_PORT} …`)
  const p = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
    { stdio: 'ignore', detached: false })
  await ventPå(`${BASE}/`)
  return p
}

// ---- kjøring --------------------------------------------------------------

let preview = null
let harEkteKart = false
let browser = null
let kode = 0

try {
  if (!EGEN_URL) preview = await startPreview()
  else await ventPå(`${BASE}/`, 10_000)

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  })
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 900 },              // mobil — appens hjemmebane
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    geolocation: { latitude: 59.8412, longitude: 10.4123 },   // Vardåsen, Asker
  })
  const page = await ctx.newPage()

  const jsFeil = []
  page.on('pageerror', (e) => jsFeil.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (!STØY.test(t)) jsFeil.push(t.slice(0, 300))
  })

  await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  if (BILDER) mkdirSync(BILDER, { recursive: true })
  const resultat = []
  for (const s of SJEKKER) {
    if (s.krever === 'ektekart' && !harEkteKart) {
      resultat.push({ ...s, hoppet: true, obs: 'krever --ektekart' })
      console.log(`⊘ ${s.navn} — hoppet over (krever --ektekart)`)
      continue
    }
    try {
      const obs = await s.kjør(page)
      resultat.push({ ...s, ok: true, obs })
      console.log(`✓ ${s.navn} — ${obs}`)
    } catch (err) {
      resultat.push({ ...s, ok: false, obs: err.message })
      console.log(`✗ ${s.navn} — ${err.message}`)
      kode = 1
    }
    if (BILDER) await page.screenshot({ path: `${BILDER}/${s.domene}.png` }).catch(() => {})
  }

  console.log('\n── røyktest ───────────────────────────────')
  for (const r of resultat) {
    console.log(`${r.hoppet ? '⊘' : r.ok ? '✓' : '✗'} ${r.domene.padEnd(24)} ${r.navn}`)
  }
  const hoppet = resultat.filter((r) => r.hoppet)
  if (hoppet.length) {
    // Aldri stille utelatelse: en hoppet sjekk skal være synlig, ellers leses
    // «alt grønt» som «alt dekket».
    console.log(`⊘ ${hoppet.length} sjekk(er) hoppet over — kjør med --ektekart for full dekning`)
  }

  if (jsFeil.length) {
    kode = 1
    console.log(`\n✗ ${jsFeil.length} JS-feil i konsollen:`)
    for (const f of [...new Set(jsFeil)].slice(0, 10)) console.log(`   ${f}`)
  } else {
    console.log('\n✓ ingen JS-feil')
  }
} catch (err) {
  console.error(`\n✗ røyktesten falt: ${err.message}`)
  kode = 1
} finally {
  await browser?.close().catch(() => {})
  if (preview) preview.kill('SIGTERM')
}

process.exit(kode)
