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
import { gunzipSync } from 'node:zlib'

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
    // v5.25.2: de åtte lende-pilene var en periode klampet til viewportens
    // ytterkant og landet under toppbaren, modus-chip-raden, målestokken og
    // FAB-en. Enhetstesten på edgeSafeFrame kjenner bare KONSTANTENE — den kan
    // ikke se at en knapp faktisk ligger under et annet element i nettleseren.
    // Derfor måler denne mot ekte layout, og med elementFromPoint framfor egne
    // selektorer: spørsmålet er ikke «overlapper den denne boksen», men «er det
    // pila man treffer om man trykker der». Alt som ligger over — nå eller etter
    // en framtidig UI-endring — fanges av seg selv.
    navn: 'lende-pilene er faktisk trykkbare og viser pilla',
    domene: 'useMapExtend',
    async kjør(page) {
      // Deterministisk avsløring: draweren skjuler håndtakene (drawerCoversCanvas),
      // så åpne + lukke gir extendZonesVisible false → true, som er nøyaktig
      // signalet «kartet ble relevant» — samme vei som ved lasting av kart.
      try {
        await åpneDrawer(page)
        await lukkDrawer(page)
      } finally { /* måler uansett — feilet lukkingen, sier neste linje det */ }
      await page.waitForTimeout(250)
      const SEL = 'button[aria-label^="Hent kartfliser mot"]'
      const n = await page.locator(SEL).count()
      if (n === 0) throw new Error('ingen lende-piler etter avsløring — fyrte watchen på extendZonesVisible?')

      const dekket = await page.evaluate((sel) => {
        const ut = []
        for (const b of document.querySelectorAll(sel)) {
          const r = b.getBoundingClientRect()
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2
          const treff = document.elementFromPoint(cx, cy)
          if (!treff || !b.contains(treff)) {
            ut.push({
              pil: b.getAttribute('aria-label'),
              over: treff ? `${treff.tagName.toLowerCase()}.${treff.className || ''}`.slice(0, 60) : 'ingenting',
            })
          }
        }
        return ut
      }, SEL)
      if (dekket.length) {
        throw new Error(`${dekket.length} av ${n} lende-piler ligger under noe annet: ` +
          dekket.map((d) => `«${d.pil}» → ${d.over}`).join('; '))
      }

      // TRYKK på noe: hover fyrer preview-emiten, som skal vise pilla med
      // retningsnavn og kostnad. Vi HOLDER oss til hover — et ekte klikk ville
      // startet en nettverks-bygging av nye kartfliser.
      const forste = page.locator(SEL).first()
      const boks = await forste.boundingBox()
      await page.mouse.move(boks.x + boks.width / 2, boks.y + boks.height / 2)
      await page.waitForTimeout(300)
      const pille = await page.evaluate((sel) => {
        const b = document.querySelector(sel)
        const el = b?.querySelector('span:last-of-type')
        if (!el) return null
        return { tekst: el.innerText.trim(), opak: parseFloat(getComputedStyle(el).opacity) }
      }, SEL)
      if (!pille) throw new Error('fant ikke etikett-pilla i håndtaket')
      if (!(pille.opak > 0.5)) throw new Error(`pilla kom ikke fram ved hover (opacity ${pille.opak})`)
      if (!/\+\d/.test(pille.tekst)) throw new Error(`pilla mangler kostnaden «+N»: «${pille.tekst}»`)

      // NØYTRALISERING: flytt pekeren av håndtaket, ellers står pilla og
      // hovertilstanden igjen til neste sjekk.
      await page.mouse.move(4, 4)
      await page.waitForTimeout(150)
      return `${n} piler, alle trykkbare, pille «${pille.tekst}»`
    },
  },
  {
    // v5.23.0: kartstil-velgeren er den ENE kontrollen som setter hele
    // uttrykket. Sjekken TRYKKER på den (ikke bare leter etter markup) og
    // verifiserer at BÅDE paletten og lagene flyttet seg — en knapp som bare
    // endret farge ville vært det gamle forhåndsvalg-problemet speilvendt.
    navn: 'kartstil bytter palett og lag',
    domene: 'useKartStil',
    async kjør(page) {
      await åpneDrawer(page)
      await klikkTekst(page, /^KARTSTIL$/)

      // Tema-variablene settes på [data-map-inner] (mapInnerRef), ikke på
      // .isom-map — samme sted tema-sjekken lenger ned leser.
      const bg = () => page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        return el ? getComputedStyle(el).getPropertyValue('--bg').trim() : ''
      })

      // Lag-tilstanden måles på KNAPPENE i Kartlag-fanen, ikke på SVG-en.
      // Knappene finnes alltid (de kommer fra lag-katalogen), mens det
      // innebygde vardasen-demokartet er en innlands-symboldemo helt uten
      // marine grupper — en DOM-telling der ville målt 0 → 0 og rapportert
      // en ekte forskjell som feil.
      const paa = (etikett) => page.evaluate((navn) => {
        const b = [...document.querySelectorAll('button[aria-pressed]')].find((e) =>
          e.offsetParent !== null && e.innerText.trim().startsWith(navn))
        return b ? b.getAttribute('aria-pressed') === 'true' : null
      }, etikett)
      const lagTilstand = async () => {
        await klikkTekst(page, /^KARTLAG$/)
        const marint = await paa('Sjø & padling')
        const gjerde = await paa('Gjerde')
        await klikkTekst(page, /^KARTSTIL$/)
        return { marint, gjerde }
      }

      try {
        await klikkTekst(page, /^Orientering/)
        const isomBg = await bg()
        const isomLag = await lagTilstand()

        await klikkTekst(page, /^Turkart/)
        const turkartBg = await bg()
        const turkartLag = await lagTilstand()

        if (!turkartBg) throw new Error('kartstil satte ingen --bg')
        if (turkartBg === isomBg) {
          throw new Error(`Turkart og Orientering ga samme bakgrunn (${turkartBg}) — paletten byttet ikke`)
        }
        // Orientering viser gjerder (ISOM-detalj); Turkart gjør det ikke.
        if (isomLag.gjerde === turkartLag.gjerde) {
          throw new Error('Orientering og Turkart har samme gjerde-tilstand — lagene byttet ikke')
        }

        await klikkTekst(page, /^Padling/)
        const padleLag = await lagTilstand()
        if (turkartLag.marint !== false || padleLag.marint !== true) {
          throw new Error(`Padling slo ikke på de marine lagene (${turkartLag.marint} → ${padleLag.marint})`)
        }

        return `bakgrunn ${isomBg} → ${turkartBg}, marine lag av→på, gjerde byttet`
      } finally {
        // NØYTRAL TILSTAND, uansett utfall: står vi igjen i Padling eller i
        // Kartstil-fanen, kjører alle senere sjekker på et annet kart enn de
        // ble skrevet for. En feilende sjekk skal koste ÉN sjekk, ikke resten.
        await klikkTekst(page, /^Turkart/).catch(() => {})
        await klikkTekst(page, /^KARTLAG$/).catch(() => {})
      }
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
    navn: 'auto-nabo-bryteren lagrer valget, firkant-valget følger den, status rendrer',
    domene: 'useAutoNabo',
    async kjør(page) {
      // ALT står i try/finally: kaster sjekken før opprydningen, blir skuffen
      // stående åpen over FAB-ene, og HVER sjekk etter denne feiler på noe som
      // ikke er deres feil. (Lært den harde veien i denne PR-en.)
      try {
        await åpneDrawer(page)
        // Fane-raden rendres i VERSALER (text-transform), og klikkTekst leser
        // innerText — derfor «INNSTILLINGER», ikke «Innstillinger». Default-fanen
        // er «Kartlag», så uten dette ligger bryteren i en skjult pane.
        await klikkTekst(page, /^INNSTILLINGER$/)
        await page.waitForTimeout(400)
        const les = () => page.evaluate(() => {
          try { return localStorage.getItem('lende-auto-nabo') } catch { return null }
        })
        // Bryteren er en <button role="switch"> uten egen tekst — etiketten står
        // i en søsken-div — så klikkTekst (som matcher innerText) treffer den
        // ikke. Vi går på aria-label.
        const bryter = page.locator('button[aria-label="Hent nabokart automatisk"]')
        const firkant = page.locator('button[aria-label="Gjør arket firkantet automatisk"]')
        // Automatikken er AV som standard fra v5.19.7, så første trykk slår den PÅ.
        if (await firkant.count() !== 0) {
          throw new Error('«Gjør arket firkantet» sto framme før automatikken var på')
        }
        await bryter.click()
        await page.waitForTimeout(300)
        const på = await les()
        if (på !== '1') throw new Error(`forventet lende-auto-nabo="1" etter første trykk, fikk ${på}`)
        // Under-innstillingen skal følge bryteren over seg — og den skal la seg
        // trykke, ikke bare finnes.
        if (await firkant.count() === 0) {
          throw new Error('«Gjør arket firkantet» kom ikke fram da automatikken ble slått på')
        }
        await firkant.click()
        await page.waitForTimeout(300)
        const firkantAv = await page.evaluate(() => {
          try { return localStorage.getItem('lende-auto-nabo-firkant') } catch { return null }
        })
        if (firkantAv !== '0') {
          throw new Error(`forventet lende-auto-nabo-firkant="0" etter trykk, fikk ${firkantAv}`)
        }
        // NØYTRALISERING: slå automatikken AV igjen. En bakgrunns-nettverks-
        // funksjon som står og bygger fliser mens de neste sjekkene kjører er
        // nettopp den støyen røyktesten ikke skal lage.
        await bryter.click()
        await page.waitForTimeout(300)
        const av = await les()
        if (av !== '0') throw new Error(`forventet lende-auto-nabo="0" etter andre trykk, fikk ${av}`)
        if (await firkant.count() !== 0) {
          throw new Error('«Gjør arket firkantet» ble stående etter at automatikken ble slått av')
        }
        // Status-raden i Utvikler-fanen beviser at prop-stien faktisk er bundet.
        // En feilstavet prop-sti gir STILLE død funksjon i Vue — nettopp den
        // feilmodusen verktøyene våre er svakest på.
        await klikkTekst(page, /^UTVIKLER$/)
        await page.waitForTimeout(400)
        const harRad = await page.evaluate(() => /Auto-nabo/.test(document.body.innerText))
        if (!harRad) throw new Error('Auto-nabo-raden mangler i Utvikler-fanen — er prop-stien riktig?')
        return 'bryter på→av, firkant-valget følger med, status-rad rendrer'
      } finally {
        await lukkDrawer(page).catch(() => {})
      }
    },
  },
  {
    navn: 'relieff-knotten kjører mosaikk-render og relieff-passet',
    domene: 'useGhostTiles',
    // Krever et kart med ekte DEM: applyHillshade returnerer tidlig uten, og
    // stub-kartet har ingen høydedata (samme grunn som 3D melder «ingen DEM»).
    krever: 'ektekart',
    async kjør(page) {
      await lukkDrawer(page)
      const synlig = () => page.evaluate(() => {
        const el = document.querySelector('svg.isom-map #hillshade-layer')
        if (!el) return 'borte'
        return el.tagName.toLowerCase()
      })
      const før = await synlig()
      let etter
      // FAB-klyngen MÅ lukkes igjen. Sjekken etter denne åpner den selv, og en
      // klynge som alt står åpen blir LUKKET av det trykket — da finner den
      // ikke knotten sin. Nøyaktig den kollateralskaden dette gjorde første
      // gang: strek-sjekken feilet på noe som ikke var dens feil.
      try {
        // Relieff-knotten kaller renderGhostTiles() — altså hele den nye
        // render- + relieff-pass-stien, inkludert planleggRelieffPass.
        await page.locator('[aria-label*="vis kartknappene"]').click()
        await page.waitForTimeout(700)
        await page.locator('[aria-label^="Relieff"]').click()
        await page.waitForTimeout(1200)
        etter = await synlig()
      } finally {
        await page.locator('[aria-label*="kartknappene"]').click().catch(() => {})
        await page.waitForTimeout(400)
      }
      if (før === etter && før === 'borte') {
        throw new Error('relieff-laget dukket aldri opp — kjørte applyHillshade?')
      }
      // Røyk-kartet er ÉN flis med vilje, så den spøkelses-spesifikke stien
      // (feste/løsne, inntoning på nabo) kan ikke dekkes her — å bygge en andre
      // flis krever nett, og røyktesten skal ikke avhenge av at Kartverket er
      // oppe. Den delen står på manuell verifisering.
      return `#hillshade-layer ${før} → ${etter}`
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
      await klikkTekst(page, /^STEMNING$/)
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
    navn: 'offline-fil pakkes og lastes ned',
    domene: 'useKartPakke',
    async kjør(page) {
      // Datakildene (Kulturminnesøk, Geonorge-WFS, NVE) blokkeres med vilje:
      // sjekken skal bevise at VÅR pakking virker og degraderer pent, ikke at
      // tre eksterne tjenester svarer i dag. Uten blokkeringen kan detalj-
      // hentingen bruke et minutt på et kart med mange kulturminner.
      const blokker = /^https?:\/\/(?!localhost|127\.0\.0\.1)/
      await page.route(blokker, (r) => r.abort())
      try {
        await åpneDrawer(page)
        await klikkTekst(page, /^EKSPORT$/)
        const last = page.waitForEvent('download', { timeout: 60_000 })
        await klikkTekst(page, /Del som offline-fil/)
        const fil = await last
        const sti = await fil.path()
        if (!sti) throw new Error('ingen fil på disk fra nedlastingen')
        const rå = readFileSync(sti)
        if (rå[0] !== 0x1f || rå[1] !== 0x8b) throw new Error('pakka er ikke gzip')
        const pakke = JSON.parse(gunzipSync(rå).toString('utf8'))
        if (pakke.format !== 'lende-kart') throw new Error(`feil format: ${pakke.format}`)
        if (!pakke.kart?.svg?.includes('data-meta')) throw new Error('pakka mangler kart-SVG med data-meta')
        if (!Array.isArray(pakke.cache)) throw new Error('pakka mangler cache-lista')
        await lukkDrawer(page)      // nøytral tilstand for neste sjekk
        return `${(rå.length / 1024).toFixed(0)} kB pakke, ${(pakke.kart.svg.length / 1024).toFixed(0)} kB SVG`
      } finally {
        await page.unroute(blokker)
      }
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

      // Eksporten skal IKKE røre brukerens visning (v5.16.1): kartet står
      // fortsatt rotert, og labelene står fortsatt vannrett PÅ SKJERMEN — det er
      // bare klonen i fila som er nord-opp. Hadde gjenopprettingen glippet,
      // ville navnene stått på skrå i kartet brukeren fortsatt ser på.
      await lukkDrawer(page)
      const rotEtter = await page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        const m = /rotate\((-?[\d.]+)deg\)/.exec(el?.style.transform || '')
        return m ? Math.round(Number(m[1])) : 0
      })
      if (rotEtter === 0) throw new Error('eksporten nullstilte brukerens rotasjon — den skal stå urørt')
      const skjermEtter = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map text[transform^="rotate(-40"]').length)
      if (!skjermEtter) throw new Error('skjermens labels ble IKKE gjenopprettet etter eksport')
      await page.evaluate(() => {
        const sl = document.querySelector('input[aria-label*="Roter kartet"]')
        sl.value = '0'; sl.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.waitForTimeout(600)
      return `${skjermFør} skjeve på skjerm → 0 i fil → ${skjermEtter} urørt på skjerm (rot ${rotEtter}°)`
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
      // Nådde vi canvas, skal kartbildet FAKTISK ligge på terrenget. Feiler
      // rasteriseringen, faller motoren til gråtone-relieff — et månelandskap
      // uten kartografi — og sier fra med en melding. Den meldingen er sjekken:
      // et grønt «canvas 1080×2000» sa ingenting om hva canvas-en viste.
      if (utfall.startsWith('canvas')) {
        await page.waitForTimeout(1500)
        const klage = await page.evaluate(() =>
          /kunne ikke tegnes på terrenget/i.exec(document.body.innerText)?.input
            ?.match(/[^.\n]*kunne ikke tegnes på terrenget[^.\n]*/i)?.[0] ?? null)
        if (klage) throw new Error(`kartbildet kom ikke på terrenget: ${klage.trim()}`)
      }
      // Lukk med en EKTE peker-sekvens, ikke el.click() fra page.evaluate.
      // Forskjellen er ikke akademisk: el.click() sender hendelsen rett på
      // elementet og bryr seg ikke om noe ligger OVER det. Laste- og
      // feil-overlayene i 3D-viseren er fullskjerms lag på z-20, over topprada
      // på z-10, og lå og svelget trykket på X-en (v5.18.4) — en test som
      // klikker programmatisk ville aldri sett det. Playwright-klikket treffer
      // det som faktisk ligger øverst i punktet, og feiler hvis noe dekker det.
      const x = page.locator('button[aria-label="Lukk 3D-visning"]')
      let lukk = false
      try {
        await x.click({ timeout: 5000 })
        // Viseren lukkes ved history.back() → popstate; gi den en frame.
        await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
        lukk = true
      } catch { lukk = false }
      if (!lukk) throw new Error('X-en i 3D-viseren lukket ikke visningen (dekket av et overlay?)')
      return `${utfall}, lukket med ekte trykk`
    },
  },
  {
    navn: 'sol/måne veksler mellom dag med vær og natt',
    domene: 'Viewer3D + vaerHimmel',
    // Krever ekte kart: knappene i 3D-viseren finnes bare når phase === 'ready',
    // og demo-kartet uten DEM lander på «ingen høydedata» der ingen knapp vises.
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      await lukkDrawer(page)
      await klikkTekst(page, /^3D$/)
      // ÅPNINGSMODUSEN AVHENGER AV KLOKKA (v6.1.0): 3D åpner i natt når sola er
      // under horisonten der arket ligger. Vi kan derfor ikke anta hvilket steg
      // knappen står på — vi leser den, og krever at syklusen er LUKKET: to trykk
      // skal føre tilbake dit vi startet, uansett hvor det var. Det er en sterkere
      // sjekk enn en fast rekkefølge, og immun mot både klokka og husket tilstand.
      const lesSteg = () => lesSolMaaneSteg(page)

      // To gyldige utfall, som i sjekken over: knappene er der, ELLER viseren
      // melder ærlig at kartet mangler høydedata. Det siste skjer på hvert kart
      // bygd i et miljø uten tilgang til Kartverkets WCS — og en røyktest skal
      // feile på en ØDELAGT inngang, ikke på manglende terrengdata. CI har full
      // nettilgang og treffer knappe-veien.
      const klar = await page.waitForFunction((steg) => {
        if ([...document.querySelectorAll('button[aria-label]')]
          .some((b) => steg.includes(b.getAttribute('aria-label')))) return 'knapper'
        if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
        return false
      }, SOLMAANE_STEG, { timeout: 60_000 }).then((h) => h.jsonValue())

      // La motoren bli FERDIG før vi begynner å trykke. Knappene dukker opp ved
      // phase='ready', men rett etterpå skjerper sceneCore karttekstur til 4096²
      // (upgradeTexture, via requestIdleCallback) — og den rasteriseringen
      // blokkerer hovedtråden i sekunder på en CI-runner uten GPU. page.evaluate
      // har ingen egen timeout og køer bak den; klikker vi inn i det vinduet,
      // henger sjekken framfor å feile. «Skjerper kartbildet …» er motorens egen
      // beskjed om at passet går, så vi venter til den er borte.
      await page.waitForFunction(
        () => !/Skjerper kartbildet/i.test(document.body.innerText),
        null, { timeout: 45_000 },
      ).catch(() => { /* beskjeden kan ha kommet og gått før vi så etter */ })
      await page.waitForTimeout(800)

      if (klar === 'ingen-dem') {
        const x0 = page.locator('button[aria-label="Lukk 3D-visning"]')
        await x0.click({ timeout: 5000 })
        await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
        return 'ingen-dem-melding — syklusen kan ikke prøves uten terreng'
      }

      const start = await lesSteg()
      if (!start) throw new Error('fant ikke sol/måne-knappen')
      const sett = [start]
      let radSett = start === 'Bytt til natt'
        && await evalMedTak(page, () =>
          /Henter værvarsel|Værvarsel ikke tilgjengelig|MET\s*Norway/i.test(document.body.innerText))
      for (let i = 0; i < SOLMAANE_STEG.length; i++) {
        // Ekte Playwright-klikk, så et overlay som dekker knappen gir en feil og
        // ikke en stille no-op (v5.18.4-fella).
        await page.locator(`button[aria-label="${sett[sett.length - 1]}"]`).click({ timeout: 10_000 })
        await page.waitForTimeout(1200)
        const na = await lesSteg()
        if (!na) throw new Error(`knappen forsvant etter trykk ${i + 1}`)
        sett.push(na)
        // «Bytt til natt» betyr at vi står i DAG, og da skal værraden være der:
        // været er alltid på om dagen fra v6.1.0, uten en egen bryter.
        if (na === 'Bytt til natt') {
          radSett = radSett || await evalMedTak(page, () =>
            /Henter værvarsel|Værvarsel ikke tilgjengelig|MET\s*Norway/i.test(document.body.innerText))
        }
      }
      if (sett[sett.length - 1] !== start) {
        throw new Error(`to trykk endte på «${sett[sett.length - 1]}», ikke tilbake på «${start}» — syklusen er ikke lukket`)
      }
      // Knappen kan være riktig mens raden er koblet feil, og da ser alt ut som
      // det virker. I dagmodus skal raden stå der i EN av sine tre tilstander:
      // varselet, «Henter …» eller den ærlige «ikke tilgjengelig». Vi krever ikke
      // ekte MET-data — api.met.no er ikke nåbart fra alle miljøer, og en
      // røyktest skal ikke feile på tredjeparts nedetid.
      if (!radSett) throw new Error('værsymbolraden dukket aldri opp i dagmodus')

      // Værraden skal stå OVER Info-pilla (v5.27.0). Rekkefølgen er hele
      // endringen, og den er lett å miste i en senere mal-omrokering uten at
      // noe annet feiler. compareDocumentPosition er billig og entydig.
      const rekkefolge = await evalMedTak(page, () => {
        const info = document.querySelector('button[aria-label="Vis hjelp for 3D-visningen"]')
        if (!info) return 'ingen-info-pille'
        const rad = [...document.querySelectorAll('div')].find((d) => d.children.length
          && /MET\s*Norway|Henter værvarsel|Værvarsel ikke tilgjengelig/i.test(d.textContent)
          && !d.querySelector('button[aria-label="Vis hjelp for 3D-visningen"]'))
        if (!rad) return 'ingen-værrad'
        // 4 = DOCUMENT_POSITION_FOLLOWING: info kommer ETTER raden.
        return (rad.compareDocumentPosition(info) & 4) ? 'rad-først' : 'info-først'
      })
      if (rekkefolge === 'info-først') {
        throw new Error('værraden ligger UNDER Info-pilla — den skal ligge over')
      }

      // To trykk er en hel runde, så vi står der vi startet. En sjekk skal ikke
      // etterlate en 3D-visning i nattmodus for den neste.
      const x = page.locator('button[aria-label="Lukk 3D-visning"]')
      await x.click({ timeout: 5000 })
      await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
      return `syklus lukket: ${sett.join(' → ')}, værrad sett`
    },
  },
  {
    navn: 'himmelvippen løfter blikket opp i himmelen',
    domene: 'freeRig + sceneCore',
    // Krever ekte kart av samme grunn som sol/måne-sjekken: uten DEM finnes
    // ingen fri rigg å dra i.
    krever: 'ektekart',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkTekst(page, /^3D$/)
      const klar = await page.waitForFunction(() => {
        const c = document.querySelector('canvas')
        if (c && c.width > 0) return 'canvas'
        if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
        return false
      }, null, { timeout: 60_000 }).then((h) => h.jsonValue())
      // La tekstur-skjerpingen bli ferdig først — den blokkerer hovedtråden i
      // sekunder på en CI-runner uten GPU, og et drag inn i det vinduet henger
      // framfor å feile. Samme grunn som i sol/måne-sjekken over.
      await page.waitForFunction(
        () => !/Skjerper kartbildet/i.test(document.body.innerText),
        null, { timeout: 45_000 },
      ).catch(() => { /* meldingen kan ha kommet og gått */ })
      await page.waitForTimeout(800)

      const lukk = async () => {
        const x = page.locator('button[aria-label="Lukk 3D-visning"]')
        await x.click({ timeout: 5000 })
        await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
      }
      if (klar === 'ingen-dem') {
        await lukk()
        return 'ingen-dem-melding — vippen kan ikke prøves uten terreng'
      }

      // TVING DAGMODUS FØRST. Denne sjekken leser to landemerker — himmel-hintet
      // og «Oversikt» — og BEGGE er skjult i nattmodus fra v6.1.0. Siden 3D nå
      // åpner i den modusen himmelen faktisk er i, ville sjekken feilet halve
      // døgnet uten dette. Modusen gis tilbake til slutt, som alltid.
      const startSteg = await lesSolMaaneSteg(page)
      if (startSteg === 'Bytt til dag') {
        await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }

      // Ekte peker-sekvens: gesten er drevet av pointerdown/move/up, og
      // OrbitControls ser aldri et programmatisk klikk (samme lærdom som
      // FAB-ene). Vi drar i mange små steg fordi både OrbitControls og
      // himmelvippen leser DELTAER — ett hopp på 1 200 px er ett delta og
      // ville rotert forbi hele veien i én frame.
      //
      // HØYRE museknapp, ikke venstre: freeRig setter
      // `mouseButtons = { LEFT: PAN, RIGHT: ROTATE }`, så et venstre-drag
      // panorerer og rører ikke polarvinkelen. Første utgave av denne sjekken
      // brukte venstre og feilet med rette.
      //
      // OPPOVER, ikke nedover: OrbitControls gjør `phi -= dy` (rotateUp), så et
      // drag oppover senker blikket mot horisonten og fortsetter derfra inn i
      // himmelen. Det var dette fortegnet sjekken avslørte i v5.27.0.
      //
      // Koordinatene tas fra VIEWPORTEN og ikke fra en canvas-locator: 3D-viseren
      // er fullskjerm, og kartflata har sine egne canvas-er (relieffet), så
      // `locator('canvas')` treffer flere og faller på strict mode.
      const vp = page.viewportSize()
      const x0 = Math.round(vp.width / 2)
      // Startpunktet følger retningen, så hele draget holder seg INNENFOR
      // viewporten: et drag som løper ut av vinduet får hendelsene klampet, og
      // da er utslaget et annet enn det testen tror den ga.
      const dra = async (retning) => {
        const y0 = Math.round(vp.height * (retning > 0 ? 0.85 : 0.15))
        await page.mouse.move(x0, y0)
        await page.mouse.down({ button: 'right' })
        for (let i = 1; i <= 60; i++) {
          await page.mouse.move(x0, y0 - retning * i * 10)
          if (i % 12 === 0) await page.waitForTimeout(60)
        }
        await page.mouse.up({ button: 'right' })
        await page.waitForTimeout(900)
      }
      await dra(1)   // oppover: forbi horisonten og inn i himmelen

      // Observasjonen: viseren melder selv at blikket er oppe. Hintet er ikke
      // bare et testkrok — uten kart i bildet er det ikke åpenbart at samme
      // drag den andre veien er veien ned.
      const oppe = await page.evaluate(() =>
        /Ser opp i himmelen/i.test(document.body.innerText))
      if (!oppe) throw new Error('draget forbi horisonten løftet ikke blikket opp i himmelen')

      // Samme finger tilbake skal lande deg i kartet igjen — vippen spises opp
      // FØR orbiten får bevege seg. Uten denne halvdelen kunne vippen vært en
      // enveisbillett og sjekken likevel stått grønn.
      await dra(-1)
      const tilbake = await page.evaluate(() =>
        /Ser opp i himmelen/i.test(document.body.innerText))
      if (tilbake) throw new Error('draget tilbake tok ikke blikket ned i kartet igjen')

      // Og «Oversikt» skal alltid gi oversikt: vippen nulles av enhver
      // programmatisk pose. Vi vipper opp én gang til for å ha noe å nullstille.
      await dra(1)
      await klikkTekst(page, /^Oversikt$/)
      await page.waitForTimeout(1400)
      const nede = await page.evaluate(() =>
        /Ser opp i himmelen/i.test(document.body.innerText))
      if (nede) throw new Error('«Oversikt» nullstilte ikke himmelvippen')

      // Tilbake til modusen vi arvet, så neste sjekk står i samme bilde.
      if (startSteg === 'Bytt til dag' && await lesSolMaaneSteg(page) === 'Bytt til natt') {
        await page.locator('button[aria-label="Bytt til natt"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }
      await lukk()
      return 'vippet opp i himmelen, Oversikt tok blikket ned igjen'
    },
  },
  {
    // DELT I TO MED VILJE. Første utgave gjorde alt i én sjekk og brukte mer enn
    // takets 120 s på en runner uten GPU, der nattmodus baker en 4096²-tekstur
    // på hovedtråden. To halvparter går inn under taket hver for seg, og en feil
    // peker dessuten på HVILKEN halvdel som brakk.
    navn: 'stjernekikkeren finner, velger og forteller',
    domene: 'himmelObjekter + Tour3dHimmelSok/Kort',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      const h = await aapneNatt3d(page)
      if (h.hoppet) return h.hoppet

      // INGEN DRAG HER (v6.1.0). Nattmodus løfter blikket selv, og søkefeltet
      // står der uansett — det var hele forenklingen. At draget fortsatt virker
      // dekkes av himmelvipp-sjekken over.
      const pille = page.locator('button[aria-label="Finn et stjernebilde eller en planet"]')
      await pille.waitFor({ state: 'visible', timeout: 10_000 })
      await pille.click({ timeout: 5000 })
      await page.waitForTimeout(300)

      // Lista skal inneholde noe — himmelen over Vardåsen har alltid noen
      // formasjoner oppe, uansett dato. En tom liste er en ekte feil.
      const forste = await evalMedTak(page, () => {
        const b = document.querySelector('ul[aria-label="Treff på himmelen"] li button')
        return b ? (b.querySelector('span.block')?.textContent ?? '').trim() : null
      })
      if (!forste) throw new Error('himmellista var tom — ingenting å velge')
      await page.locator('ul[aria-label="Treff på himmelen"] li button').first()
        .click({ timeout: 5000 })
      await page.waitForTimeout(1600)

      // Infokortet skal ha åpnet seg, og det skal handle om det vi valgte.
      const kortTekst = await evalMedTak(page, () => document.body.innerText)
      if (!kortTekst.includes(forste)) {
        throw new Error(`valgte «${forste}», men kortet nevner den ikke`)
      }
      if (!/over horisonten/i.test(kortTekst)) {
        throw new Error('infokortet mangler retning og høyde — det er linja man trenger')
      }

      // «Sett i fokus» skal finnes: har man sett seg bort, er det veien tilbake
      // til det som er fremhevet.
      if (!await evalMedTak(page, () => !!document
        .querySelector('button[aria-label^="Sett "][aria-label$=" i fokus"]'))) {
        throw new Error('kortet mangler «Sett i fokus»')
      }

      // MINIMER (v6.1.0): navnet blir stående, lesestoffet forsvinner. Vi måler
      // på «Historien», som bare finnes i det utvidede kortet.
      const harHistorien = () => evalMedTak(page, () => /Historien|Verdt å vite|Månegloben/
        .test(document.body.innerText))
      const utvidetFor = await harHistorien()
      await page.locator('button[aria-label="Minimer infokortet"]').click({ timeout: 5000 })
      await page.waitForTimeout(400)
      if (await harHistorien()) throw new Error('kortet ble ikke minimert')
      if (!(await evalMedTak(page, () => document.body.innerText)).includes(forste)) {
        throw new Error('navnet forsvant da kortet ble minimert — da vet man ikke hva som lyser')
      }
      // Og tilbake ut igjen.
      await page.locator(`button[aria-label="Vis mer om ${forste}"]`).click({ timeout: 5000 })
      await page.waitForTimeout(400)
      if (utvidetFor && !await harHistorien()) throw new Error('kortet lot seg ikke utvide igjen')

      // NABO-HOPP minimerer av seg selv: man hopper for å SE, ikke for å lese.
      const nabo = await evalMedTak(page, () => {
        const b = [...document.querySelectorAll('button[aria-label^="Hopp til "]')][0]
        return b ? b.getAttribute('aria-label').replace(/^Hopp til /, '').split(',')[0] : null
      })
      if (nabo) {
        await page.locator('button[aria-label^="Hopp til "]').first().click({ timeout: 5000 })
        await page.waitForTimeout(1600)
        if (await harHistorien()) {
          throw new Error(`hoppet til «${nabo}», men kortet ble ikke minimert`)
        }
        if (!(await evalMedTak(page, () => document.body.innerText)).includes(nabo)) {
          throw new Error(`hoppet til «${nabo}», men kortet nevner den ikke`)
        }
      }

      await page.locator('button[aria-label="Lukk infokortet"]').click({ timeout: 5000 })
      await page.waitForTimeout(400)
      await lukkNatt3d(page, h.startSteg)
      return `valgte «${forste}», minimerte, utvidet${nabo ? `, hoppet til «${nabo}»` : ''}`
    },
  },
  {
    navn: 'nattmodus er stjernekikkeren: alt annet er borte',
    domene: 'Viewer3D (nattsyn)',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      const h = await aapneNatt3d(page)
      if (h.hoppet) return h.hoppet

      // v6.1.0-bestillingen, punkt for punkt: igjen står sol/måne-knappen,
      // X-en og himmelsøket mellom dem. Alt annet er borte — også maksimer-
      // knappen, som ER fjernet: natt går rett inn i dette bildet.
      const i = await evalMedTak(page, () => {
        const labels = [...document.querySelectorAll('button[aria-label]')]
          .filter((b) => b.offsetParent !== null)
          .map((b) => b.getAttribute('aria-label'))
        return {
          labels,
          oversikt: /\bOversikt\b/.test(document.body.innerText),
          hint: /Ser opp i himmelen/i.test(document.body.innerText),
          sok: labels.some((l) => l === 'Finn et stjernebilde eller en planet'
            || (l ?? '').startsWith('Valgt:')),
          // Lag-knappene og maksimer skal ikke finnes i det hele tatt.
          naaler: labels.some((l) => /knappenåler/i.test(l ?? '')),
          stier: labels.some((l) => /stinettet/i.test(l ?? '')),
          kurver: labels.some((l) => /høydekurver/i.test(l ?? '')),
          maksimer: labels.some((l) => /Skjul alt utenom|Vis knappene igjen/i.test(l ?? '')),
        }
      })
      if (i.oversikt) throw new Error('«Oversikt» står fortsatt i nattmodus')
      if (i.hint) throw new Error('himmel-hintet står fortsatt i nattmodus')
      if (!i.sok) throw new Error('himmelsøket mangler — da er skjermen tom')
      if (i.naaler) throw new Error('nåle-knappen står fortsatt i nattmodus')
      if (i.stier) throw new Error('sti-knappen står fortsatt i nattmodus')
      if (i.kurver) throw new Error('kurve-knappen står fortsatt i nattmodus')
      if (i.maksimer) throw new Error('maksimer-knappen finnes ennå — den skulle vært fjernet')

      // HIMMELKOMPASSET nede til høyre. Grafikken kan ikke leses fra en test,
      // men aria-labelen ER retningen i ord — og den er dermed også sjekken på
      // at blikk-eventet henger sammen hele veien fra kameramatrisen til SVG-en.
      const lesKompass = () => evalMedTak(page, () => document
        .querySelector('svg[role="img"][aria-label^="Du ser mot"]')?.getAttribute('aria-label') ?? null)
      const forDrag = await page.waitForFunction(() => document
        .querySelector('svg[role="img"][aria-label^="Du ser mot"]')?.getAttribute('aria-label'),
      null, { timeout: 15_000 }).then((x) => x.jsonValue())
      if (!forDrag) throw new Error('himmelkompasset kom ikke i nattmodus')

      // Snu deg, og kompasset må følge. Høyre knapp roterer (venstre panorerer),
      // og et halvt skjermbredde-drag er godt over 45°, altså minst én
      // himmelretning. Sier labelen det samme etterpå, er prikken frosset.
      const vp = page.viewportSize()
      const y = Math.round(vp.height * 0.5)
      await page.mouse.move(Math.round(vp.width * 0.2), y)
      await page.mouse.down({ button: 'right' })
      for (let k = 1; k <= 40; k++) {
        await page.mouse.move(Math.round(vp.width * 0.2) + k * 12, y)
        if (k % 10 === 0) await page.waitForTimeout(60)
      }
      await page.mouse.up({ button: 'right' })
      await page.waitForTimeout(900)
      const etterDrag = await lesKompass()
      if (etterDrag === forDrag) {
        throw new Error(`kompasset står stille: «${forDrag}» både før og etter et drag`)
      }

      await lukkNatt3d(page, h.startSteg)
      return `igjen sto ${i.labels.length} knapper; kompasset gikk «${forDrag}» → «${etterDrag}»`
    },
  },
  {
    // v5.25.6-regresjonsvakt. Står SIST med vilje: sjekken setter kart-temaet,
    // og kart-temaet er inngangsverdi for 3D-visningens dag/natt-tilstand.
    // Første plassering var midt i lista, og da arvet sol/måne-sjekken et lyst
    // kart der den før hadde arvet Curves — dag→natt-trykket re-baket 4096²-
    // teksturen og blokkerte hovedtråden forbi klikkets timeout. Sjekken var
    // riktig, plasseringen var feil. Ligger den bakerst, kan ingen arve den.
    // Håndtakets strek er sort på lyse kart og hvit på
    // mørke, og den avgjørelsen MÅ komme fra KARTETS tema og ikke app-chromets:
    // turkart, print og padling er lyse kart som normalt vises med mørkt chrome.
    // Første utgave brukte --color-ink (app-chromet) og ga åtte nesten usynlige
    // hvite vinkler på kremgul bakgrunn. Enhetstestene kan ikke se det —
    // fargevalget bor i en CSS-klasse mot en computed. Derfor måler denne den
    // FAKTISKE luminansen av streken mot kartets --bg, i begge retninger.
    navn: 'kanthåndtakets strek kontrasterer kartet i begge temaer',
    domene: 'useMapExtend',
    async kjør(page) {
      const lum = (farge) => {
        const m = /(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(farge || '')
        if (!m) return null
        return 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]
      }
      // Streken males i browseren, så vi leser den ut av getComputedStyle på en
      // ekte path og --bg på samme sted temaet setter den.
      const mål = () => page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        const p = document.querySelector('button[aria-label^="Hent kartfliser mot"] path')
        if (!el) throw new Error('fant ikke [data-map-inner]')
        if (!p) throw new Error('fant ingen kanthåndtak å måle streken på')
        const cs = getComputedStyle(p)
        // Tomt --bg = lyst standard-tema (det setter ingen vars). Da er
        // bakgrunnen katalogens egen kremgule, og vi må oppgi den selv.
        const bg = getComputedStyle(el).getPropertyValue('--bg').trim()
        return { strek: cs.stroke, bg: bg || '#fefae0' }
      })
      const somRgb = async (hex) => page.evaluate((h) => {
        if (h.startsWith('rgb')) return h
        const d = document.createElement('div')
        d.style.color = h; document.body.appendChild(d)
        const ut = getComputedStyle(d).color; d.remove(); return ut
      }, hex)

      const vurder = async (merkelapp) => {
        const { strek, bg } = await mål()
        const ls = lum(strek), lb = lum(await somRgb(bg))
        if (ls == null || lb == null) throw new Error(`kunne ikke lese farger (${merkelapp}): strek "${strek}", bg "${bg}"`)
        if (Math.abs(ls - lb) < 90) {
          throw new Error(`streken forsvinner i kartet (${merkelapp}): strek-lum ${ls.toFixed(0)} mot bg-lum ${lb.toFixed(0)} — leser fargen app-chromet i stedet for kart-temaet?`)
        }
        return `${merkelapp}: ${ls.toFixed(0)} mot ${lb.toFixed(0)}`
      }

      // Sjekken SETTER begge temaene selv i stedet for å måle det den arver.
      // Sjekken over slutter på Curves (mørkt), og da ville «lyst kart» målt et
      // mørkt kart og bestått uten å ha sett den feilen den finnes for.
      // Merk hvor de to bor: kartstilene (Turkart, Orientering, Padling) i
      // KARTSTIL-fanen, stemningene (Curves m.fl.) i STEMNING. Kartstil-knappene
      // har en beskrivelse under navnet, derfor uankret regex.
      const settKartstil = async (re) => {
        await åpneDrawer(page)
        await klikkTekst(page, /^KARTSTIL$/)
        await klikkTekst(page, re)
        await page.waitForTimeout(700)
        await lukkDrawer(page)
        await page.waitForTimeout(250)
      }

      await settKartstil(/^Turkart/)
      const lyst = await vurder('lyst kart (Turkart)')

      // Mørkt kart: en stemning oppå. Nå skal streken ha snudd til hvit.
      await åpneDrawer(page)
      await klikkTekst(page, /^STEMNING$/)
      const morkt = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((e) =>
          e.offsetParent && /^(Mørk|Curves|Forest|Indigo|Petrol|Mocha)$/i.test(e.innerText.trim()))
        if (!b) return ''
        b.click(); return b.innerText.trim()
      })
      if (!morkt) throw new Error('fant ingen mørk stemning å bytte til')
      await page.waitForTimeout(900)
      await lukkDrawer(page)
      await page.waitForTimeout(250)
      const morkResultat = await vurder(`mørkt kart («${morkt}»)`)

      // Nøytral tilstand for neste sjekk: tilbake til det lyse utgangspunktet.
      await settKartstil(/^Turkart/)
      return `${lyst}; ${morkResultat}`
    },
  },
]

// ---- små hjelpere ---------------------------------------------------------

// Tak pr sjekk. Rundelig: den tregeste ekte sjekken (3D med tekstur-bygging på
// en CI-runner uten GPU) bruker under et halvt minutt, så to minutter rammer
// bare noe som faktisk har stoppet.
const SJEKK_TAK_MS = 120_000
// Skjermbildet er billig når siden lever og uendelig når den ikke gjør det.
const SKJERMBILDE_TAK_MS = 20_000

/**
 * Kjør en sjekk mot klokka. Løftet vi kappløper mot kan ikke avbrytes — det
 * gjenstående Playwright-kallet lever videre til nettleseren lukkes — men
 * sjekken er da alt merket feilet, og det er hele poenget: vi mister én sjekk
 * framfor hele jobben.
 */
function medTak(løfte, ms, navn) {
  let timer
  return Promise.race([
    løfte.finally(() => clearTimeout(timer)),
    new Promise((_, nei) => {
      timer = setTimeout(
        () => nei(new Error(`sjekken svarte ikke innen ${Math.round(ms / 1000)} s — hang den? (${navn})`)),
        ms,
      )
    }),
  ])
}

// Vi treffer knapper på TEKST og ikke på CSS-klasser med vilje: klassene i
// denne appen er Tailwind-kjeder som endres støtt, mens teksten er UI-kontrakt.
// ---- natt-3D for stjerne-sjekkene ---------------------------------------
// Delt av de to stjerne-sjekkene. Egne hjelpere og ikke kopi: begge må inn i
// SAMME tilstand (natt UTEN vær) og ut i NØYTRAL tilstand igjen, og to kopier av
// den koreografien kommer i utakt ved første endring.

// Sol/måne-knappens aria-label sier hva NESTE trykk gjør. Vær-biten huskes i
// localStorage og dag/natt-biten avledes av kart-temaet, så vi kan ikke ANTA
// noe steg — vi leser det.
const SOLMAANE_STEG = ['Bytt til natt', 'Bytt til dag']
/**
 * `page.evaluate` MED TAK. Playwright gir evaluate ingen egen timeout, så en
 * travel hovedtråd (3D baker en 4096²-tekstur ved bytte til natt) gjør et
 * uskyldig oppslag til en uendelig venting. Sjekk-taket over fanger det, men da
 * har vi brent 180 s og vet ikke hvor. Et lokalt tak sier hvilken linje.
 */
const evalMedTak = (page, fn, arg, ms = 25_000) =>
  medTak(page.evaluate(fn, arg), ms, 'page.evaluate')

const lesSolMaaneSteg = (page) => evalMedTak(page, (steg) =>
  [...document.querySelectorAll('button[aria-label]')]
    .map((b) => b.getAttribute('aria-label'))
    .find((l) => steg.includes(l)) ?? null, SOLMAANE_STEG)

/**
 * Åpne 3D og still den på NATT UTEN VÆR. Returnerer `{ startSteg }`, eller
 * `{ hoppet }` når kartet mangler høydedata — en røyktest skal feile på en
 * ødelagt inngang, ikke på manglende terrengdata.
 */
async function aapneNatt3d(page) {
  await lukkDrawer(page)
  await klikkTekst(page, /^3D$/)
  const klar = await page.waitForFunction(() => {
    const c = document.querySelector('canvas')
    if (c && c.width > 0) return 'canvas'
    if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
    return false
  }, null, { timeout: 60_000 }).then((h) => h.jsonValue())
  // Tekstur-skjerpingen blokkerer hovedtråden i sekunder på en runner uten GPU,
  // og et klikk eller en page.evaluate inn i det vinduet henger framfor å feile.
  await page.waitForFunction(
    () => !/Skjerper kartbildet/i.test(document.body.innerText),
    null, { timeout: 45_000 },
  ).catch(() => { /* meldingen kan ha kommet og gått */ })
  await page.waitForTimeout(800)

  if (klar === 'ingen-dem') {
    await page.locator('button[aria-label="Lukk 3D-visning"]').click({ timeout: 5000 })
    await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
    return { hoppet: 'ingen-dem-melding — stjernehimmelen kan ikke prøves uten terreng' }
  }

  const startSteg = await lesSolMaaneSteg(page)
  if (!startSteg) throw new Error('fant ikke sol/måne-knappen')
  // «Bytt til dag» på knappen betyr at vi ALLEREDE er i natt — og siden 3D fra
  // v6.1.0 åpner i den modusen himmelen faktisk er i, kan vi være der uten å ha
  // trykket. Ett trykk er nok i alle andre tilfeller.
  let steg = startSteg
  if (steg !== 'Bytt til dag') {
    await page.locator(`button[aria-label="${steg}"]`).click({ timeout: 10_000 })
    await page.waitForTimeout(900)
    steg = await lesSolMaaneSteg(page)
  }
  if (steg !== 'Bytt til dag') throw new Error('kom ikke i nattmodus')
  // NATTBYTTET BAKER SIN EGEN 4096²-TEKSTUR, og på en runner uten GPU blokkerer
  // den hovedtråden i sekunder. Alt vi gjør etterpå — et klikk, et oppslag —
  // ville køet bak den. Samme grunn som ventingen ved åpning, og det er nettopp
  // denne som gjorde at fire-stegs-sjekken en gang gikk forbi klikkets timeout.
  await page.waitForFunction(
    () => !/Skjerper kartbildet/i.test(document.body.innerText),
    null, { timeout: 45_000 },
  ).catch(() => { /* meldingen kan ha kommet og gått */ })
  await page.waitForTimeout(1200)
  // NATTMODUS LØFTER BLIKKET SELV (v6.1.0), med en ease-out over 1,5 s. Vi venter
  // den ut: alt etterpå leser en skjerm der himmelen fyller bildet.
  await page.waitForTimeout(1800)
  return { startSteg }
}

/**
 * NØYTRAL TILSTAND (v5.8.1-fella): blikket ned, sol/måne tilbake på steget den
 * sto på, 3D lukket. Ellers arver neste sjekk en nattvisning med et kort i
 * bildet — og localStorage-verdien følger med inn i neste kjøring.
 */
async function lukkNatt3d(page, startSteg) {
  // INGEN «Oversikt»-knapp i nattmodus — den er skjult med resten av overlegget.
  // Veien ut er sol/måne-knappen, som også tar blikket ned i kartet igjen.
  let na = await lesSolMaaneSteg(page)
  for (let i = 0; i < 4 && na !== startSteg; i++) {
    await page.locator(`button[aria-label="${na}"]`).click({ timeout: 10_000 })
    await page.waitForTimeout(900)
    na = await lesSolMaaneSteg(page)
  }
  if (na !== startSteg) throw new Error(`etterlot sol/måne på «${na}», ikke «${startSteg}»`)
  await page.locator('button[aria-label="Lukk 3D-visning"]').click({ timeout: 5000 })
  await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
}

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
    // Legger du til en NY `krever: 'ektekart'`-sjekk: sjekk at domenets filer
    // står på MAA_HA_EKTEKART i scripts/trenger-ektekart.mjs. Den lista styrer
    // om CI i det hele tatt bygger et ekte kart for en gitt PR, og står domenet
    // ikke der, hopper sjekken din stille over på nettopp de PR-ene som endrer
    // det. (Ukjente stier faller til ekte kart, så et NYTT domene er dekket
    // automatisk — det er kjente-men-ulistede stier som er fella.)
    if (s.krever === 'ektekart' && !harEkteKart) {
      resultat.push({ ...s, hoppet: true, obs: 'krever --ektekart' })
      console.log(`⊘ ${s.navn} — hoppet over (krever --ektekart)`)
      continue
    }
    try {
      // TAK PR SJEKK. En sjekk som HENGER er verre enn en som feiler: den
      // blokkerer jobben til GitHub dreper den etter timer, uten logg og uten
      // skjermbilde, og dermed hver framtidige PR. Det skjedde 2026-08-23 —
      // fire-stegs-sjekken sto fast etter «3D-visningen åpner» og jobben måtte
      // kanselleres manuelt. Årsaken er alltid den samme klassen: page.evaluate
      // har INGEN egen timeout, så er sidas hovedtråd travel (3D bygger tekstur)
      // venter den i det uendelige. Taket gjør hengingen til en lesbar feil med
      // et skjermbilde ved siden av.
      const obs = await medTak(s.kjør(page), s.maksMs ?? SJEKK_TAK_MS, s.navn)
      resultat.push({ ...s, ok: true, obs })
      console.log(`✓ ${s.navn} — ${obs}`)
    } catch (err) {
      resultat.push({ ...s, ok: false, obs: err.message })
      console.log(`✗ ${s.navn} — ${err.message}`)
      kode = 1
    }
    // SKJERMBILDET MÅ HA SAMME TAK SOM SJEKKEN. Det sto utenfor fram til v6.0.0,
    // og det er et hull i nettopp den beskyttelsen taket over finnes for: taket
    // gjør en hengt sjekk til en lesbar feil, men `page.screenshot` mot en
    // renderer som står fast venter i det uendelige — og da henger jobben
    // likevel, nå UTEN at noe navn er skrevet, siden loggen skrives til slutt.
    // Ingen målt hendelse bak dette; det er samme klasse feil som taket over
    // ble laget for, lukket på samme sted.
    if (BILDER) {
      await medTak(
        page.screenshot({ path: `${BILDER}/${s.domene}.png` }),
        SKJERMBILDE_TAK_MS, `skjermbilde etter ${s.navn}`,
      ).catch((e) => console.log(`  ⚠ ${e.message}`))
    }
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
