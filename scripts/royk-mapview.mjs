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
import { dirname } from 'node:path'
import { gunzipSync } from 'node:zlib'

const args = process.argv.slice(2)
const flagg = (navn, def = null) => {
  const t = args.find((a) => a.startsWith(`--${navn}=`))
  return t ? t.slice(navn.length + 3) : (args.includes(`--${navn}`) ? true : def)
}
const EGEN_URL = flagg('url')
const BILDER = flagg('bilder')
const EKTEKART = !!flagg('ektekart')
// Sti til et lagret ekte kart. Finnes fila, brukes den i stedet for å bygge —
// se byggEkteKart. CI setter den til en actions/cache-sti.
const KARTCACHE = (() => {
  const v = flagg('kartcache')
  return typeof v === 'string' && v ? v : null
})()
// --lagkart bygger (eller henter fra --kartcache) det ekte Vardåsen-kartet og
// stopper. CI kjører den i en egen forjobb, slik at de parallelle delene kan
// dele ETT kart i stedet for å bygge hvert sitt fra Overpass samtidig.
const LAGKART = !!flagg('lagkart')
// --ikkebyggkart: bruk et cachet kart hvis det finnes, men rør ALDRI nettet.
// Delene kjører med den, så et tapt artefakt gir sju hoppede sjekker og ikke tre
// samtidige bygg mot Overpass — og delene svarer i det minste likt.
const IKKE_BYGG_KART = !!flagg('ikkebyggkart')
// --del=N/M kjører bare hver M-te sjekk med rest N-1 — CI deler røyktesten
// på M parallelle jobber. Se DEL-kommentaren over kjøre-løkka for hvorfor
// fordelingen er rundgang og ikke sammenhengende blokker.
const DEL = (() => {
  const v = flagg('del')
  if (typeof v !== 'string' || !v) return null
  const m = /^(\d+)\/(\d+)$/.exec(v)
  if (!m) throw new Error(`--del må være på formen N/M, fikk «${v}»`)
  const n = Number(m[1]); const av = Number(m[2])
  if (av < 1 || n < 1 || n > av) throw new Error(`--del=${v} er utenfor 1/1 … ${av}/${av}`)
  return { n, av }
})()
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
      const { n, lag } = await ventPåFerdigKart(page)
      // Innebygde vardasen.svg i repoet er en symbol-demo (~400 elementer) —
      // det ekte kartet bygges i deploy-workflowen. Terskelen må derfor treffe
      // «noe er faktisk tegnet», ikke «kartet er detaljrikt».
      if (n < 50) throw new Error(`bare ${n} tegnede elementer — rendret kartet egentlig?`)
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
    // v6.5.32: et HOLD på en lende-pil åpnet punkt-arket i tillegg til pilla.
    // Håndtaket stopper `pointerdown` selv, så vår egen long-press-timer fyrte
    // aldri — men nettleserens EGEN long-press sender et `contextmenu` som
    // bobler opp fra knappen til kart-wrapperen, og den åpnet arket.
    //
    // Sjekken måler nøyaktig det: samme event på pila skal IKKE åpne arket, og
    // samme event på kartet skal fortsatt gjøre det. Uten den andre halvdelen
    // ville en for bred vakt sett grønn ut mens høyreklikk på kartet var dødt.
    navn: 'hold på en lende-pil åpner ikke punkt-arket',
    domene: 'useContextLookups',
    async kjør(page) {
      const ARK = 'button[aria-label="Kopier koordinater"]'
      const fyr = (sel) => page.evaluate((s2) => {
        const el = typeof s2 === 'string' ? document.querySelector(s2) : null
        const mål = el ?? document.querySelector('svg.isom-map')
        const r = mål.getBoundingClientRect()
        mål.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }))
      }, sel)

      await fyr('button[aria-label^="Hent kartfliser mot"]')
      await page.waitForTimeout(400)
      if (await page.locator(ARK).count()) {
        throw new Error('punkt-arket åpnet seg av et hold på kantpila')
      }

      await fyr(null)
      await page.waitForTimeout(600)
      if (!(await page.locator(ARK).count())) {
        throw new Error('punkt-arket åpnet seg ikke fra kartet — er vakten for bred?')
      }

      // NØYTRALISERING: arket dekker kartet og skjuler kanthåndtakene.
      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      return 'pila ignorerer holdet, kartet svarer fortsatt'
    },
  },
  {
    // v6.5.32: nettleserens eget hold starter et tekstutvalg, og når vår timer
    // har åpnet punkt-arket ligger ARKET under fingeren — så koordinatlinja ble
    // markert nesten hver gang man åpnet et punkt. Teksten skal fortsatt kunne
    // markeres (opplesing), så fiksen er en vakt som varer fra holdet fyrer til
    // fingeren slippes, og ikke `user-select`/`pointer-events` på teksten.
    //
    // Sjekken måler BEGGE sider: prevented mens fingeren er nede, og ikke
    // prevented etterpå. Bare den første ville stått grønn på en vakt som aldri
    // slippes — altså et ark der ingen kan markere noe.
    navn: 'holdet som åpner punkt-arket markerer ikke teksten i det',
    domene: 'useContextLookups',
    async kjør(page) {
      const kart = await page.locator('svg.isom-map').boundingBox()
      const x = kart.x + kart.width / 2, y = kart.y + kart.height / 2
      const prov = () => page.evaluate(() => {
        const el = document.querySelector('button[aria-label="Kopier koordinater"]')?.closest('div')
        if (!el) return null
        const ev = new Event('selectstart', { bubbles: true, cancelable: true })
        el.dispatchEvent(ev)
        return ev.defaultPrevented
      })

      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.waitForTimeout(800)
      const under = await prov()
      await page.mouse.up()
      await page.waitForTimeout(200)
      const etter = await prov()

      if (under === null) throw new Error('punkt-arket åpnet seg ikke av holdet')
      if (!under) throw new Error('utvalget ble ikke stoppet mens fingeren var nede')
      if (etter !== false) throw new Error('vakten slippes ikke — teksten kan ikke markeres etterpå')

      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      return 'stoppet under holdet, fri etterpå'
    },
  },
  {
    // v6.5.32: kroppen i punkt-arket fulgte hovedmenyens 100/125/150/200-valg,
    // men headeren gjorde det ikke — og det er koordinatene der oppe man åpner
    // arket for å lese. Sjekken leser den bundne zoomen på begge blokkene:
    // står valget på 100 % er begge «1», så en sammenlikning av VERDIENE ville
    // vært grønn uansett. Det som måles er at headeren i det hele tatt HAR
    // bindingen — det var nettopp den som manglet.
    navn: 'punkt-arkets header følger tekststørrelse-valget',
    domene: 'ContextMenuSheet',
    async kjør(page) {
      await page.evaluate(() => {
        const el = document.querySelector('svg.isom-map')
        const r = el.getBoundingClientRect()
        el.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }))
      })
      await page.waitForTimeout(500)
      const zoom = await page.evaluate(() => {
        const kopi = document.querySelector('button[aria-label="Kopier koordinater"]')
        if (!kopi) return null
        const header = kopi.closest('[style*="zoom"]')
        const kropp = [...document.querySelectorAll('[style*="zoom"]')]
          .find((el) => el !== header && el.contains(kopi) === false)
        return { header: header?.style.zoom ?? '', kropp: kropp?.style.zoom ?? '' }
      })
      if (!zoom) throw new Error('punkt-arket åpnet seg ikke')
      if (!zoom.header) throw new Error('headeren har ingen zoom-binding — den følger ikke tekststørrelsen')
      if (!zoom.kropp) throw new Error('fant ingen zoom-bundet kropp å sammenlikne med')
      if (zoom.header !== zoom.kropp) {
        throw new Error(`header og kropp står på ulik skala: ${zoom.header} mot ${zoom.kropp}`)
      }

      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      return `header og kropp på samme skala (${zoom.header})`
    },
  },
  {
    // v6.5.49: kroppen i punkt-arket ligger i en `zoom`-blokk, så ved 200 % er
    // den effektive bredden HALVERT — og med faste `grid-cols-2`/`grid-cols-3`
    // fikk «Del kart og sted» rundt 100 px og ble fire ord under hverandre,
    // mens annoteringene ble klippet til «Kn…». Enhetstester ser ingenting av
    // dette: markupen er den samme, det er layouten som brekker.
    navn: 'punkt-arkets knapper klippes ikke ved 200 % tekst',
    domene: 'ContextMenuSheet',
    async kjør(page) {
      const åpne = () => page.evaluate(() => {
        const el = document.querySelector('svg.isom-map')
        const r = el.getBoundingClientRect()
        el.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }))
      })
      await åpne()
      await page.waitForTimeout(500)
      const A = 'button[aria-label^="Tekststørrelse i grensesnittet"]'
      if (!(await page.locator(A).count())) throw new Error('punkt-arket åpnet seg ikke')
      // 100 → 125 → 150 → 200. Knappen runder tilbake til 100 på det femte.
      let prosent = 0
      for (let i = 0; i < 4; i++) {
        await page.locator(A).first().click()
        await page.waitForTimeout(180)
        prosent = Number(await page.locator(A).first().getAttribute('aria-label')
          .then((s) => (s.match(/(\d+) prosent/) ?? [])[1]))
        if (prosent === 200) break
      }
      const feil = []
      if (prosent !== 200) feil.push(`kom bare til ${prosent} %`)
      const maalt = await page.evaluate(() => {
        const kopi = document.querySelector('button[aria-label="Kopier koordinater"]')
        const ark = kopi?.closest('.drawer-shell')
        if (!ark) return null
        // LINJETALL, ikke `scrollWidth`. Feilen var ikke at teksten ble klippet
        // — en flex-knapp bryter i stedet, og «Del kart og sted» ble til fire
        // ord under hverandre uten at én eneste piksel var i overflyt. Range
        // over tekstnoden gir ett rektangel per linje, altså det man ser.
        const linjer = (el) => {
          const r = document.createRange()
          r.selectNodeContents(el)
          return r.getClientRects().length
        }
        const brede = [...ark.querySelectorAll('button span')]
          .filter((el) => el.textContent.trim().length > 4 && el.offsetParent)
          .map((el) => ({ tekst: el.textContent.trim().slice(0, 24), n: linjer(el) }))
          .filter((x) => x.n > 2)
        // Et `truncate` som klipper bort et ord er den andre halvdelen.
        const klippet = [...ark.querySelectorAll('button span, button div')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && el.textContent.trim())
          .map((el) => el.textContent.trim().slice(0, 24))
        // v6.5.77: tekst-kolonnen i headeren skal ha HELE bredden. A-knappen
        // og X sto i samme rad og tok ~80 px, og en kolonne som er 80 px for
        // smal ser helt normal ut i markup — det er bare linjene som brekker.
        // Kolonnen bærer `zoom`, og rektangelet er den VISUELLE bredden, altså
        // direkte sammenliknbar med forelderens.
        // Forelderens INNHOLDSBREDDE, ikke rektangelet: headeren har `px-4`,
        // og en rå sammenlikning ville meldt 32 px tap på en kolonne som
        // allerede fyller alt den kan (samme felle som værradens måling,
        // v6.3.12).
        const kolonne = kopi.closest('[style*="zoom"]')
        const vert = kolonne?.parentElement
        const cs = vert ? getComputedStyle(vert) : null
        const bredde = kolonne && vert
          ? Math.round(vert.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
                       - kolonne.getBoundingClientRect().width)
          : null
        return {
          brede: brede.slice(0, 4).map((x) => `«${x.tekst}» på ${x.n} linjer`),
          klippet: klippet.slice(0, 4),
          // Arket selv skal aldri kunne rulles sidelengs.
          sidelengs: ark.scrollWidth - ark.clientWidth,
          breddetap: bredde,
        }
      })
      if (!maalt) feil.push('fant ikke arket etter skalering')
      else {
        if (maalt.brede.length) feil.push(maalt.brede.join(', '))
        if (maalt.klippet.length) feil.push(`klippet tekst: ${maalt.klippet.join(', ')}`)
        if (maalt.sidelengs > 1) feil.push(`arket ruller ${maalt.sidelengs} px sidelengs`)
        if (maalt.breddetap == null) feil.push('fant ikke tekst-kolonnen i headeren')
        else if (maalt.breddetap > 4) {
          feil.push(`headerens tekst-kolonne er ${maalt.breddetap} px smalere enn arket`)
        }
      }

      // NØYTRAL TILSTAND: runde tilbake til 100 % og lukke arket.
      for (let i = 0; i < 4; i++) {
        const na = Number(await page.locator(A).first().getAttribute('aria-label')
          .then((s) => (s.match(/(\d+) prosent/) ?? [])[1]))
        if (na === 100) break
        await page.locator(A).first().click()
        await page.waitForTimeout(180)
      }
      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      if (feil.length) throw new Error(feil.join(' | '))
      return 'full bredde i headeren, ingen klippede etiketter ved 200 %'
    },
  },
  {
    // v6.5.78: Tips-stripa i punkt-arket er en ekte <details>. Vue eier
    // tilstanden (den bor i localStorage), <details> eier sin egen `open` — og
    // to eiere av samme sannhet er nettopp der en toggle-løkke oppstår. Sjekken
    // TRYKKER på stripa og krever at begge sidene snudde, og at det bare skjedde
    // én gang.
    navn: 'Tips-stripa i punkt-arket åpner og lukker som en disclosure',
    domene: 'ContextMenuSheet',
    async kjør(page) {
      await page.evaluate(() => localStorage.removeItem('lende-info-tips-minimert'))
      await klikkSnarvei(page, 'info')
      await page.waitForTimeout(500)
      const tips = page.locator('details:has(summary span:text-is("Tips"))').first()
      if (!(await tips.count())) throw new Error('Tips-stripa kom ikke fram i punkt-arket')
      const les = () => page.evaluate(() => {
        const d = [...document.querySelectorAll('details')]
          .find((el) => el.querySelector('summary')?.textContent.trim() === 'Tips')
        return { open: !!d?.open, lagret: localStorage.getItem('lende-info-tips-minimert') }
      })
      const feil = []
      const før = await les()
      if (!før.open) feil.push('stripa sto sammenlagt uten at noe var lagret')
      await tips.locator('summary').click()
      await page.waitForTimeout(200)
      const etter = await les()
      if (etter.open) feil.push('trykket lukket ikke stripa')
      if (etter.lagret !== '1') feil.push(`Vue-tilstanden fulgte ikke med (lagret=${etter.lagret})`)
      await tips.locator('summary').click()
      await page.waitForTimeout(200)
      const igjen = await les()
      if (!igjen.open) feil.push('trykk nummer to åpnet ikke igjen')
      if (igjen.lagret !== '0') feil.push(`lagret verdi ble ikke satt tilbake (${igjen.lagret})`)

      // NØYTRAL TILSTAND: lukk arket og fjern nøkkelen igjen.
      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      await page.evaluate(() => localStorage.removeItem('lende-info-tips-minimert'))
      if (feil.length) throw new Error(feil.join(' | '))
      return 'åpner, lukker og holder Vue-tilstanden i takt'
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
      await klikkTekst(page, /^Sti$/, SKUFF)
      const av = await synlige()
      if (av !== 0) throw new Error(`Sti-laget ble ikke skjult (${før} → ${av})`)
      await klikkTekst(page, /^Sti$/, SKUFF)
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
      // Drawer-raden med «Start GPS» er borte (v6.5.68); pin-knappen i
      // høyre søyle er nå den eneste veien inn i posisjonen.
      await lukkDrawer(page)
      await page.locator('button[aria-label^="Posisjon av"]').first().click()
      await page.waitForTimeout(2500)
      const prikk = await page.evaluate(() =>
        document.querySelectorAll('svg.isom-map [id*="user"], svg.isom-map [data-user-pos]').length)
      if (!prikk) throw new Error('ingen brukerposisjon i kartet etter Start GPS')
      const av = await page.locator('button[aria-label^="Posisjon på"]').count()
      if (!av) throw new Error('pin-knappen sier fortsatt «Posisjon av» etter at GPS-en er i gang')
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
    navn: 'spøkelses-fliser culles — hel flis og per element',
    domene: 'useViewportCull (mosaikk)',
    krever: 'ektekart',
    async kjør(page) {
      // HVORFOR SJEKKEN FABRIKKERER NABOFLISENE: royktesten bygger ETT ark, og
      // en ekte mosaikk krever to lagrede fliser side om side — flere minutter
      // Overpass og Kartverket til. Nodene lages derfor her, med NØYAKTIG
      // attributtene buildGhostSvg skriver (x/y = dx − blø, viewBox med
      // blø-offset, data-layer → data-ghost-layer), og den EKTE cull-koden
      // avgjør resten. Feilmodusene sjekken finnes for — en bommet forskyvning,
      // en selektor som ikke treffer data-ghost-layer, en hel flis som blir
      // stående — slår ut uansett hvem som bygde noden.
      //
      // Den NÆRE flisa legges rett oppå aktiv flis (dx = dy = 0). Da er den per
      // konstruksjon delvis inne i cull-rekta i akkurat de utsnittene der aktiv
      // flis selv culles, og sjekken slipper å gjette hvor rekta går.
      await lukkDrawer(page)
      await zoomInn(page, 14)
      const bygget = await page.evaluate(() => {
        const svg = document.querySelector('svg.isom-map')
        if (!svg) return 'fant ingen kart-SVG'
        const vb = svg.viewBox?.baseVal
        if (!vb?.width) return 'kart-SVG-en mangler viewBox'
        const ns = 'http://www.w3.org/2000/svg'
        const W = vb.width, H = vb.height, blo = 0.5
        const settRom = (el, dx, dy) => {
          el.setAttribute('x', String(dx - blo))
          el.setAttribute('y', String(dy - blo))
          el.setAttribute('width', String(W + 2 * blo))
          el.setAttribute('height', String(H + 2 * blo))
          el.setAttribute('viewBox', `${-blo} ${-blo} ${W + 2 * blo} ${H + 2 * blo}`)
          el.setAttribute('class', 'isom-map')
          el.setAttribute('pointer-events', 'none')
        }
        let cont = svg.querySelector('#ghost-tiles')
        const lagetCont = !cont
        if (!cont) {
          cont = document.createElementNS(ns, 'g')
          cont.setAttribute('id', 'ghost-tiles')
          const bg = svg.querySelector('#bakgrunn')
          svg.insertBefore(cont, bg ?? svg.firstChild)
        }
        cont.setAttribute('data-royk-cont', lagetCont ? 'laget' : 'fantes')

        const naer = svg.cloneNode(true)
        naer.querySelector('#ghost-tiles')?.remove()
        for (const st of naer.querySelectorAll(':scope > style')) st.remove()
        for (const el of naer.querySelectorAll('[data-layer]')) {
          el.setAttribute('data-ghost-layer', el.getAttribute('data-layer'))
          el.removeAttribute('data-layer')
        }
        // Klonen bærer aktiv flis' egne cull-klasser og id-er. Klassene ville
        // gjort tellingen under falsk grønn (den ville telt forrige pass' arbeid),
        // og id-ene ville skygget for originalene — spøkelses-containeren står
        // FØR #bakgrunn, så klonen kommer først i dokumentrekkefølgen.
        for (const el of naer.querySelectorAll('.vp-cull')) el.classList.remove('vp-cull')
        for (const el of naer.querySelectorAll('[id]')) el.removeAttribute('id')
        naer.removeAttribute('id')
        settRom(naer, 0, 0)
        naer.setAttribute('data-royk-ghost', 'naer')
        cont.appendChild(naer)

        // Den FJERNE trenger ikke innhold: hel-flis-kuttet skjer på rota, og en
        // tom flis beviser nettopp at det ikke er per-element-passet som gjør det.
        const fjern = document.createElementNS(ns, 'svg')
        settRom(fjern, 8 * W, 0)
        fjern.setAttribute('data-royk-ghost', 'fjern')
        cont.appendChild(fjern)
        return null
      })
      if (bygget) throw new Error(bygget)

      const rydd = () => page.evaluate(() => {
        for (const el of document.querySelectorAll('[data-royk-ghost]')) el.remove()
        const cont = document.querySelector('#ghost-tiles[data-royk-cont]')
        if (cont?.getAttribute('data-royk-cont') === 'laget') cont.remove()
        else cont?.removeAttribute('data-royk-cont')
      })

      try {
        // Cull-passet er debounced og hysterese-gated, så nodene må følges av
        // noe som FAKTISK utløser en ny beregning. TRE feller ligger her, og
        // alle tre har smelt:
        //   • Kartet panorerer bare på `touchstart` (usePinchZoom), så en
        //     mus-drag flytter ingenting og watcheren fyrer aldri.
        //   • Etter zoom-sjekken over står zoomen på taket, så et hjul-tikk INN
        //     endrer heller ikke skalaen.
        //   • Og en tur UT og inn igjen ender der den startet: hysteresen måler
        //     mot forrige KJØRTE pass, og de mellomliggende tikkene spises av
        //     debouncen — så netto null er netto ingen re-beregning.
        // Vi zoomer derfor UT og blir der. Hvert tikk er ~1,25×, altså er tre
        // godt over RECULL_SCALE_RATIO, og kartet er fortsatt dypt zoomet.
        await pekMidtPaaKartet(page)
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 260)
          await page.waitForTimeout(160)
        }
        await page.waitForTimeout(900)

        const res = await page.evaluate(() => {
          const naer = document.querySelector('[data-royk-ghost="naer"]')
          const fjern = document.querySelector('[data-royk-ghost="fjern"]')
          return {
            fjernSkjult: !!fjern?.classList.contains('vp-cull'),
            naerSkjult: !!naer?.classList.contains('vp-cull'),
            naerElementer: naer ? naer.querySelectorAll('[data-ghost-layer] .vp-cull, [data-ghost-layer].vp-cull').length : -1,
          }
        })
        if (!res.fjernSkjult) throw new Error('naboflis langt utenfor utsnittet fikk ikke vp-cull på rota')
        if (res.naerSkjult) throw new Error('naboflis midt i utsnittet ble skjult i sin helhet')
        if (res.naerElementer <= 0) {
          throw new Error('ingen elementer cullet inne i naboflisa — traff indekseringen data-ghost-layer?')
        }
        return `hel flis skjult, ${res.naerElementer} elementer cullet i naboen`
      } finally {
        await rydd()
      }
    },
  },
  {
    navn: 'zoom-skyven og retningsrosa styrer kartet uten hjul (desktop)',
    domene: 'ZoomSkyv + RetningsRose',
    async kjør(page) {
      // HVORFOR SJEKKEN FINNES: uten scrollhjul — styreflate, mus uten hjul —
      // fantes det ingen vei inn i kartet i det hele tatt. Pinch krever
      // berøring, og dobbeltklikk zoomer bare INN. Sjekken beviser at man både
      // kommer inn OG ut igjen, og at rosa snur kartet, uten en eneste gest.
      //
      // Playwright-konteksten setter ikke `hasTouch`, så begge kontrollene står
      // bak samme port de gjør på en ekte desktop. Settes hasTouch en gang i
      // framtida, forsvinner de og sjekken skal da FEILE, ikke hoppe stille over.
      await lukkDrawer(page)
      const transform = () => page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
        return { skala: Math.hypot(m.a, m.b), grader: Math.atan2(m.b, m.a) * 180 / Math.PI }
      })

      const skyv = page.locator('input.zoom-skyv').first()
      if (!await skyv.count()) {
        throw new Error('zoom-skyven mangler — uten scrollhjul finnes ingen vei inn i kartet')
      }
      const start = await skyv.inputValue()
      // MÅLENE ER SKYVENS EGNE ENDER, ikke faste tall i midten. Hvor skyven STÅR
      // når sjekken begynner er ikke vår å bestemme: kartets startskala følger
      // arkets størrelse (ekte Vardåsen er fire ganger demokartet), og sjekken
      // over kan ha etterlatt kartet dypt inne. Et fast «0,8» var derfor et lite
      // steg OPP fra 0,757 på det ekte arket — skyven virket, og sjekken sa den
      // ikke gjorde det. Ende mot ende beviser begge retninger uten å anta noe.
      // `fill` på en range gir et ekte input-event, som er det komponenten
      // lytter på — og hele poenget er at INGEN gest trengs.
      await skyv.fill('1')
      await page.waitForTimeout(700)
      const inne = await transform()
      await skyv.fill('0')
      await page.waitForTimeout(700)
      const ute = await transform()
      if (!(inne.skala > ute.skala * 1.5)) {
        throw new Error(`zoom-skyven flyttet ikke kartet mellom endene (${ute.skala.toFixed(2)} → ${inne.skala.toFixed(2)})`)
      }

      const rose = page.locator('input[aria-label="Roter kartet"]').first()
      if (!await rose.count()) {
        throw new Error('retningsrosa mangler — kartet kan da ikke roteres uten to fingre')
      }
      await rose.fill('45')
      await page.waitForTimeout(700)
      const rotert = await transform()
      if (Math.abs(Math.abs(rotert.grader) - 45) > 3) {
        throw new Error(`rosa roterte ikke kartet til 45° (leste ${rotert.grader.toFixed(1)}°)`)
      }

      // NØYTRAL TILSTAND: nord opp og zoomen der vi fant den. Måle-modus-fella
      // fra v5.8.1 — en sjekk som etterlater et annet bilde felles den neste.
      await rose.fill('0')
      await skyv.fill(start)
      await page.waitForTimeout(700)
      return `zoom ${ute.skala.toFixed(2)} (helt ut) → ${inne.skala.toFixed(2)} (helt inn) fra ${start}, rosa til 45°`
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
      // RELIEFFET BOR I INNSTILLINGER → KARTSTIL FRA v7.4.0. Det var en
      // gruppe-pille i snarvei-raden; nå er det en seksjon nederst i fana, med
      // av/på, styrke og stil. Styrke-slideren går gjennom hele render- +
      // relieff-pass-stien (renderGhostTiles → planleggRelieffPass), altså
      // samme kode hakket kjørte.
      await åpneDrawer(page)
      await klikkTekst(page, /^KARTSTIL$/)
      await settSkyv(page, 'Relieff-styrke for alle kart', 0)
      await page.waitForTimeout(1200)
      await lukkDrawer(page)
      const etter = await synlig()
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
    // STREK OG RELIEFF BLE INNSTILLINGER (v7.4.0). De sto som gruppe-piller
    // med tannhjul i snarvei-raden, med et delt bunn-ark bak seg; nå er de to
    // seksjoner nederst i Kartstil-fana. Sjekken måler at BEGGE nivåene
    // fortsatt virker derfra — den globale knotten (--stroke-scale) og
    // per-element-tuningen (override-CSS-en i kart-SVG-en) — for de har hver
    // sin kode-sti og en av dem kan dø alene uten at noe sier fra.
    navn: 'strek-seksjonen i Kartstil endrer --stroke-scale og per-element',
    domene: 'useKartKnotter + DrawerStyleTab',
    async kjør(page) {
      const skala = () => page.evaluate(() =>
        document.querySelector('svg.isom-map')?.style.getPropertyValue('--stroke-scale') || '')
      const override = () => page.evaluate(() =>
        document.querySelector('svg.isom-map #stroke-override-style')?.textContent || '')

      await åpneDrawer(page)
      await klikkTekst(page, /^KARTSTIL$/)

      const førSkala = await skala()
      await settSkyv(page, 'Strektykkelse for alle kart', 0)
      await page.waitForTimeout(700)
      const etterSkala = await skala()
      if (!etterSkala || etterSkala === førSkala) {
        throw new Error(`--stroke-scale endret seg ikke ("${førSkala}" → "${etterSkala}")`)
      }
      // Hint-boblen er knottens egen tilbakemelding — den beviser at watchen
      // kjørte, og ikke bare at en computed ble lest.
      const hint = await page.evaluate(() => /Strek [\d.]+×/.test(document.body.innerText))
      if (!hint) throw new Error('ingen hint-boble etter strek-endringen — kjørte watchen?')

      // CSS-en er der fra før (kartstilene setter sin egen strek-profil), så
      // spørsmålet er om den ENDRET SEG — ikke om den vokste. En lengde-
      // sammenlikning her er en tilfeldighet: «1.20» og «2.50» er like lange.
      const førOverride = await override()
      await settSkyv(page, 'Strekbredde Høydekurver', 2.5)
      await page.waitForTimeout(700)
      const etterOverride = await override()
      if (!etterOverride) throw new Error('per-element-slideren skrev ingen override-CSS')
      if (etterOverride === førOverride) {
        throw new Error('override-CSS-en sto stille etter et per-element-drag')
      }

      // NØYTRAL TILSTAND: neste sjekk skal ikke arve en ekstrem strek.
      await klikkTekst(page, /^Nullstill strek$/)
      await page.waitForTimeout(500)
      await lukkDrawer(page)
      return `--stroke-scale ${Number(førSkala).toFixed(3)} → ${Number(etterSkala).toFixed(3)}, `
        + `override-CSS skrevet om (${etterOverride.length} tegn), hint vist`
    },
  },
  {
    // SORTERINGEN SKJER I RADEN (v7.7.0), og de to veiene som IKKE er et drag
    // måles her — de er akkurat de som forsvinner stille om noen «rydder» i
    // modusen senere:
    //
    //   • ETT TRYKK LØFTER, DET NESTE PLASSERER. Dette er SC 2.5.7: en
    //     dra-bevegelse skal kunne gjøres med ett enkelt trykk. Det var
    //     panelets opp/ned-knapper som bar kravet før, og et tastatur-
    //     alternativ dekker det IKKE.
    //   • PILTASTENE flytter den fokuserte cella, og FOKUS FØLGER MED. Uten
    //     det må man tabbe seg fram på nytt for hvert eneste hakk, og da er
    //     tastatur-veien teknisk til stede og praktisk ubrukelig (SC 2.1.1).
    //
    // Måles på DOM-en og ikke på pikslene: begge deler er rene rekkefølge-
    // endringer, og de har ingen egen geometri å lese av.
    navn: 'sorteringen i raden: ett trykk løfter, piltastene flytter',
    domene: 'SnarveiRad (sorterings-modus) + lib/snarveier',
    async kjør(page) {
      const ider = () => page.evaluate(() =>
        [...document.querySelectorAll('[data-snarvei-id]')].map((e) => e.getAttribute('data-snarvei-id')))

      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      const start = await ider()
      if (start.length < 3) throw new Error('for få snarveier til å sortere')

      await startSortering(page)
      if (!(await page.locator('[data-sorter-footer]').count())) {
        throw new Error('sorterings-modus startet ikke — ingen footer i raden')
      }
      if (await page.locator('.snarvei-handle').count()) {
        throw new Error('håndtaket står igjen i sorterings-modus — det kan ikke dra noe der')
      }

      // OG DEN STIPLEDE KANTEN MÅ VÆRE HEL HELE VEIEN RUNDT (v7.7.4). Gitteret
      // klipper (`overflow: hidden`) og hadde ingen polstring under siste rad,
      // så den nederste streken lå under footeren. Måles som lufta mellom
      // nederste celle og gitterets klippekant — den var 0 px før fiksen.
      // Den SAMME lufta måles ved 200 % i tekstskala-sjekken over: her var den
      // grønn hele tida mens 200 % var rød (v7.7.5).
      const luft = await page.evaluate(() => {
        const g = document.querySelector('[data-snarvei-gitter]')
        const celler = [...g.querySelectorAll('[data-snarvei]')]
        const gb = g.getBoundingClientRect()
        const nederst = Math.max(...celler.map((c) => c.getBoundingClientRect().bottom))
        return Math.round((gb.bottom - nederst) * 10) / 10
      })
      if (luft < 1) {
        throw new Error(`siste rad har ${luft} px under seg i sorterings-modus — `
          + 'den stiplede kanten klippes bort av gitteret')
      }

      // ETT TRYKK, SÅ ETT TIL: løft den første og legg den på tredjeplass.
      const celle = (i) => page.locator('[data-snarvei]').nth(i)
      await celle(0).click()
      await page.waitForTimeout(200)
      const loftet = await page.locator('.shortcut-btn--valgt').count()
      if (loftet !== 1) throw new Error(`ett trykk løftet ${loftet} celler, ikke én`)
      await celle(2).click()
      await page.waitForTimeout(300)
      const etterTrykk = await ider()
      if (etterTrykk[2] !== start[0]) {
        throw new Error(`to trykk flyttet ikke ${start[0]} til plass 3: ${etterTrykk.join(',')}`)
      }
      if (await page.locator('.shortcut-btn--valgt').count()) {
        throw new Error('cella står fortsatt løftet etter at den ble plassert')
      }

      // PILTASTENE: fokuser cella som nettopp landet, og send den ett hakk
      // tilbake. Fokus skal være PÅ DEN SAMME cella etterpå.
      await celle(2).focus()
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(300)
      const etterPil = await ider()
      if (etterPil[1] !== start[0]) {
        throw new Error(`piltasten flyttet ikke cella: ${etterPil.join(',')}`)
      }
      const fokusId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-snarvei-id') || null)
      if (fokusId !== start[0]) {
        throw new Error(`fokus fulgte ikke cella (sto på «${fokusId}») — `
          + 'da må man tabbe seg fram på nytt for hvert hakk')
      }

      // NØYTRAL TILSTAND: standard rekkefølge tilbake, modusen av, raden sammen.
      await klikkTekst(page, /^Tilbakestill$/, '[data-sorter-footer]')
      await avsluttSortering(page)
      await page.waitForTimeout(300)
      const slutt = await ider()
      if (slutt.join(',') !== start.join(',')) {
        throw new Error(`«Tilbakestill» ga ikke standard rekkefølge: ${slutt.join(',')}`)
      }
      if (await page.locator('[data-sorter-footer]').count()) {
        throw new Error('«Ferdig» avsluttet ikke sorterings-modus')
      }
      const apen = await page.locator('.snarvei-handle').getAttribute('aria-expanded')
      if (apen !== 'false') throw new Error('«Ferdig» la ikke raden sammen igjen')
      return `to trykk og en piltast flyttet ${start[0]}, fokus fulgte med, `
        + `${luft} px luft under siste rad, Tilbakestill + Ferdig ryddet`
    },
  },
  {
    // NAVNET STÅR ALLTID (v7.6.0). Draget avdekket etikettene fra v7.4.0; det
    // ble målt i felt og forkastet — gevinsten var fjorten piksler, prisen at
    // ikonene måtte bære betydningen alene. Fire ting måles, og ingen av dem
    // finnes i en enhetstest: at etiketten er SYNLIG sammenlagt, at cella ikke
    // endrer form av draget (det er nå bare flere RADER som avdekkes), at
    // navnet ligger i `aria-label` — teksten der er fyldigere enn kortformen
    // under ikonet — og at et KLIKK på håndtaket ikke gjør noe (v7.5.0).
    navn: 'snarvei-navnene står alltid, klikk på håndtaket gjør ingenting',
    domene: 'SnarveiRad',
    async kjør(page) {
      await lukkDrawer(page)
      // EN SMAL SKJERM, ellers har draget ingenting å avdekke: etikettene er
      // kortformer fra v7.6.0, og på et desktop-vindu får alle snarveiene plass
      // på ÉN rad — da er sammenlagt og utfoldet like høye, og «vokste skuffa?»
      // er et spørsmål om ingenting. 360 px er der målingen har en jobb.
      const forrigeVindu = page.viewportSize()
      await page.setViewportSize({ width: 360, height: forrigeVindu.height })
      await page.waitForTimeout(600)
      await lukkSnarveiRad(page)
      const les = () => page.evaluate(() => {
        const rad = document.querySelector('.snarvei-rad')
        const k = rad?.querySelector('[data-snarvei]')
        if (!k) return null
        const navn = k.querySelector('span:last-child')
        const b = k.getBoundingClientRect()
        return {
          navnHoyde: navn ? Math.round(navn.getBoundingClientRect().height) : -1,
          navnOpasitet: navn ? Number(getComputedStyle(navn).opacity) : -1,
          navnTekst: navn ? navn.textContent.trim() : '',
          aria: k.getAttribute('aria-label') || '',
          bredde: Math.round(b.width),
          hoyde: Math.round(b.height),
          radHoyde: Math.round(rad.getBoundingClientRect().height),
          apen: document.querySelector('.snarvei-handle')?.getAttribute('aria-expanded'),
        }
      })

      const lukket = await les()
      if (!lukket) throw new Error('fant ingen snarvei-knapp')
      if (!(lukket.navnHoyde > 1) || !(lukket.navnOpasitet > 0.9)) {
        throw new Error(`den sammenlagte raden viser ingen etikett `
          + `(${lukket.navnHoyde} px, opasitet ${lukket.navnOpasitet}) — `
          + 'navnene skal stå alltid fra v7.6.0')
      }
      if (!lukket.navnTekst) throw new Error('etiketten er tom')
      if (!lukket.aria) throw new Error('snarvei-knappen har ingen aria-label')
      // 44 px er WCAG 2.5.8.
      if (lukket.bredde < 44 || lukket.hoyde < 44) {
        throw new Error(`snarvei-knappen er ${lukket.bredde}×${lukket.hoyde} px — under 44 px`)
      }

      // KLIKK ÅPNER IKKE (v7.5.0). Håndtaket er et håndtak: man drar i det.
      await page.locator('.snarvei-handle').click()
      await page.waitForTimeout(500)
      const etterKlikk = await les()
      if (etterKlikk.apen !== 'false') {
        throw new Error('et klikk på håndtaket foldet ut skuffa — den skal bare dras')
      }

      await apneSnarveiRad(page)
      const apen = await les()
      // CELLA ER UENDRET AV DRAGET: bredde OG høyde. Endrer noen av dem seg,
      // er etiketten blitt noe som vokser fram igjen.
      if (apen.bredde !== lukket.bredde || apen.hoyde !== lukket.hoyde) {
        throw new Error(`cella endret form med draget `
          + `(${lukket.bredde}×${lukket.hoyde} → ${apen.bredde}×${apen.hoyde} px) `
          + '— draget skal bare avdekke flere rader')
      }
      if (apen.aria !== lukket.aria) {
        throw new Error(`aria-navnet endret seg med draget: «${lukket.aria}» → «${apen.aria}»`)
      }
      if (apen.radHoyde <= lukket.radHoyde) {
        throw new Error(`skuffa vokste ikke av draget (${lukket.radHoyde} → ${apen.radHoyde} px)`)
      }

      await lukkSnarveiRad(page)
      const igjen = await les()
      if (igjen.radHoyde !== lukket.radHoyde) {
        throw new Error(`skuffa dokket ikke tilbake til samme høyde `
          + `(${lukket.radHoyde} → ${igjen.radHoyde} px)`)
      }
      await page.setViewportSize(forrigeVindu)
      await page.waitForTimeout(400)
      return `«${lukket.navnTekst}» synlig sammenlagt ved 360 px, celle `
        + `${lukket.bredde}×${lukket.hoyde} px uendret av draget, skuff `
        + `${lukket.radHoyde} → ${apen.radHoyde} px, klikk gjorde ingenting`
    },
  },
  {
    // DE FASTE IKONENE FØLGER TEKSTSTØRRELSEN (v7.6.0). Hamburgeren, søket,
    // kompassnåla og Lende-chatten er de fire runde knappene som ikke bærer en
    // etikett, og et ikon «leses» som tekst: den som skrur opp til 200 % fordi
    // etikettene er for små, trenger også en større trykkflate.
    //
    // TRE TING MÅLES, og ingen av dem finnes i en enhetstest:
    //   • at knappene faktisk BLIR STØRRE;
    //   • at hamburgeren står der plassholderen sin står. Den er teleportert til
    //     <body> og `position: fixed` med koordinater fra plassholderens rect,
    //     mens `zoom` multipliserer nettopp de brukte verdiene — uten
    //     divisjonen havner den dobbelt så langt ned og inn;
    //   • at snarvei-raden fortsatt står UNDER knapperada. `--ovl-top` var
    //     faste 4rem, og en bar som vokser ville da fått raden oppå seg.
    navn: 'hamburger, søk og kompass vokser med tekststørrelsen',
    domene: 'AppMenuButton + MapView (topprada) + MapScaleAttribution + style.css',
    async kjør(page) {
      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      const mål = () => page.evaluate(() => {
        const boks = (v) => {
          const e = document.querySelector(v)
          if (!e) return null
          const r = e.getBoundingClientRect()
          return { b: Math.round(r.width), h: Math.round(r.height),
                   x: Math.round(r.left), y: Math.round(r.top) }
        }
        const rad = document.querySelector('.snarvei-rad')
        return {
          meny: boks('[data-hovedmeny-knapp]'),
          plass: boks('[data-hovedmeny-plass]'),
          sok: boks('[data-sok-knapp]'),
          kompass: boks('[data-kompass-knapp]'),
          radTopp: rad ? Math.round(rad.getBoundingClientRect().top) : null,
          barBunn: (() => {
            const e = document.querySelector('[data-sok-knapp]')
            return e ? Math.round(e.getBoundingClientRect().bottom) : null
          })(),
        }
      })
      const sett = async (skala) => {
        await page.evaluate((v) => {
          localStorage.setItem('lende-ui-text-scale', String(v))
        }, skala)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2500)
        await lukkDrawer(page)
      }

      const ved100 = await mål()
      if (!ved100.meny || !ved100.sok) throw new Error('fant ikke hamburgeren eller søket')
      try {
        await sett(2)
        const ved200 = await mål()
        for (const [id, a, b] of [['hamburgeren', ved100.meny, ved200.meny],
                                  ['søket', ved100.sok, ved200.sok],
                                  ['kompasset', ved100.kompass, ved200.kompass]]) {
          if (!a || !b) continue   // kompasset finnes bare med berøring
          if (!(b.h > a.h * 1.4)) {
            throw new Error(`${id} vokste ikke med tekststørrelsen (${a.h} → ${b.h} px)`)
          }
        }
        // HAMBURGEREN ER TELEPORTERT: den skal ligge på plassholderens
        // koordinater, ikke på dem ganget med zoomen.
        if (ved200.plass && Math.abs(ved200.meny.x - ved200.plass.x) > 4) {
          throw new Error(`hamburgeren står ${ved200.meny.x} px fra venstre, `
            + `plassholderen på ${ved200.plass.x} — er koordinaten delt på skalaen?`)
        }
        if (ved200.meny.x < 0 || ved200.meny.y < 0) {
          throw new Error(`hamburgeren er utenfor skjermen ved 200 % `
            + `(${ved200.meny.x}, ${ved200.meny.y})`)
        }
        if (ved200.radTopp != null && ved200.barBunn != null
            && ved200.radTopp < ved200.barBunn) {
          throw new Error(`snarvei-raden (${ved200.radTopp}) ligger oppå knapperada `
            + `(bunn ${ved200.barBunn}) ved 200 % — følger --ovl-top skalaen?`)
        }
        return `hamburger ${ved100.meny.h} → ${ved200.meny.h} px, søk `
          + `${ved100.sok.h} → ${ved200.sok.h} px, raden fortsatt under baren`
      } finally {
        await sett(1)
        await lukkSnarveiRad(page)
      }
    },
  },
  {
    // TOASTENE OG BANNERNE PÅ KARTET FØLGER TEKSTSTØRRELSEN (v7.6.1), og de er
    // de eneste flatene der teksten ER hele innholdet. Måleboksen står modell
    // for dem alle — den har både et tekstfelt og et lukke-kryss, altså
    // nøyaktig den kombinasjonen regelen handler om. Tre ting måles, og bare
    // det første kan en enhetstest se:
    //   • tekstblokka VOKSER (zoom ligger på innholdet);
    //   • X-EN GJØR DET IKKE — zoom på boksen ville skalert polstringen og
    //     dyttet krysset ut, altså en beskjed man ikke blir kvitt ved 200 %;
    //   • boksen holder seg innenfor skjermen, fordi bredde-taket følger
    //     skalaen (`maksBredde`) med 92 % som tak.
    navn: 'måleboksens tekst vokser med tekststørrelsen, krysset blir stående',
    domene: 'MapModeChips + MapStatusOverlays (zoom på innhold, ikke på boksen)',
    async kjør(page) {
      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      const mål = () => page.evaluate(() => {
        const boks = document.querySelector('[data-maal-boks]')
        if (!boks) return null
        const tekst = boks.querySelector('[data-maal-tekst]')
        const kryss = boks.querySelector('[aria-label="Avslutt måling"]')
        const r = (e) => { const q = e.getBoundingClientRect(); return { b: Math.round(q.width), h: Math.round(q.height) } }
        return {
          tekst: r(tekst), kryss: r(kryss),
          hoyre: Math.round(boks.getBoundingClientRect().right),
          vindu: window.innerWidth,
          zoom: getComputedStyle(tekst).zoom,
        }
      })
      const sett = async (skala) => {
        await page.evaluate((v) => { localStorage.setItem('lende-ui-text-scale', String(v)) }, skala)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2500)
        await lukkDrawer(page)
      }

      // MÅLE-MODUS SKJULER SNARVEI-RADEN (se v-if-en i MapView), så håndtaket
      // finnes ikke mens målingen står på — raden må lukkes FØR og målingen
      // avsluttes før neste gang den skal åpnes.
      const stoppMåling = async () => {
        const x = page.locator('[aria-label="Avslutt måling"]')
        if (await x.count()) { await x.first().click(); await page.waitForTimeout(300) }
      }
      await klikkSnarvei(page, 'maaling')
      const ved100 = await mål()
      if (!ved100) throw new Error('fant ikke måleboksen etter at målingen ble slått på')
      try {
        await stoppMåling()
        await sett(2)
        // Målemodus overlever ikke en reload — slå den på igjen.
        await klikkSnarvei(page, 'maaling')
        const ved200 = await mål()
        if (!ved200) throw new Error('måleboksen kom ikke tilbake ved 200 %')
        if (!(ved200.tekst.h > ved100.tekst.h * 1.4)) {
          throw new Error(`måleboksens tekst vokste ikke (${ved100.tekst.h} → ${ved200.tekst.h} px) `
            + '— følger den uiTextScale?')
        }
        if (Math.abs(ved200.kryss.b - ved100.kryss.b) > 2) {
          throw new Error(`lukke-krysset endret størrelse (${ved100.kryss.b} → ${ved200.kryss.b} px) `
            + '— ligger zoomen på boksen i stedet for på teksten?')
        }
        if (ved200.hoyre > ved200.vindu) {
          throw new Error(`måleboksen går ${ved200.hoyre - ved200.vindu} px utenfor skjermen ved 200 % `
            + '— følger bredde-taket skalaen?')
        }
        return `tekst ${ved100.tekst.h} → ${ved200.tekst.h} px (zoom ${ved200.zoom}), `
          + `krysset ${ved200.kryss.b} px, boksen innenfor ${ved200.vindu} px`
      } finally {
        // NØYTRAL TILSTAND: måle-modus bytter ut kart-flata for neste sjekk.
        await stoppMåling()
        await sett(1)
        await lukkSnarveiRad(page)
      }
    },
  },
  {
    // TOASTENE HAR HELE BREDDEN, IKKE HALVE (v7.7.2). GPS-toasten hang i
    // `left: 50%` + `-translate-x-1/2`, og et absolutt plassert element med
    // `right: auto` får da BARE avstanden fra `left` til høyrekanten som
    // tilgjengelig bredde — 180 px på en 360 px-skjerm. Transformen flytter
    // boksen etterpå og gir ingenting tilbake, så toasten brøt til fire linjer
    // med god plass på begge sider. Nøyaktig samme felle som snarvei-raden gikk
    // i (v6.6.1), og den er usynlig i enhetstester: markupen er helt riktig,
    // det er den tilgjengelige bredden som er halv.
    // Tre ting måles, og alle tre er lette å «rydde» bort igjen:
    //   1. båndet toasten sentreres i dekker hele den synlige kartflata;
    //   2. toasten står midt i det, med samme luft på begge sider;
    //   3. KRYSSET VOKSER med tekststørrelsen (v7.7.2). Det sto fast fordi en
    //      zoomet boks dytter X-en ut av skjermen — men zoomen ligger på
    //      KNAPPEN, og med båndets bredde tar et dobbelt kryss av tekstens
    //      plass og ikke av skjermens. 24 px er under 44 px-målet, og den som
    //      skrur teksten til 200 % gjør det nettopp fordi små mål er vanskelige.
    // EGEN KONTEKST MED EN STUBBET GEOLOCATION: standard-konteksten GIR
    // posisjons-tillatelsen, og en kontekst som bare lar være å gi den er ikke
    // nok — målt: uten tillatelse svarer headless Chromium hverken med posisjon
    // eller med feil, så toasten kom aldri. Stubben kaller feil-callbacken med
    // kode 1 (avslått), som er nøyaktig den tilstanden toasten finnes for, og
    // den overlever reloaden fordi den ligger i `addInitScript`.
    navn: 'GPS-toasten er midtstilt med hele bredden, og krysset følger teksten',
    domene: 'MapStatusOverlays (bånd + kryss-zoom)',
    maksMs: 120_000,
    async kjør(page) {
      const ctx = await egenKontekst(page, {
        viewport: { width: 360, height: 780 },
        hasTouch: true,
      })
      await ctx.addInitScript(() => {
        const feil = { code: 1, message: 'Posisjon avslått', PERMISSION_DENIED: 1 }
        const nekt = (_ok, err) => { if (err) setTimeout(() => err(feil), 60) }
        navigator.geolocation.getCurrentPosition = nekt
        navigator.geolocation.watchPosition = (ok, err) => { nekt(ok, err); return 1 }
        navigator.geolocation.clearWatch = () => {}
      })
      const p2 = await ctx.newPage()
      try {
        await p2.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })

        const framToasten = async () => {
          await lukkDrawer(p2)
          await klikkSnarvei(p2, 'posisjon')
          await p2.waitForFunction(
            () => !![...document.querySelectorAll('[role="alert"]')]
              .find((e) => e.querySelector('[aria-label="Lukk"]')),
            null, { timeout: 20_000 })
          await p2.waitForTimeout(250)
        }
        const mål = () => p2.evaluate(() => {
          const boks = [...document.querySelectorAll('[role="alert"]')]
            .find((e) => e.querySelector('[aria-label="Lukk"]'))
          if (!boks) return null
          const b = boks.getBoundingClientRect()
          const band = boks.parentElement.getBoundingClientRect()
          const k = boks.querySelector('[aria-label="Lukk"]').getBoundingClientRect()
          return {
            vindu: window.innerWidth,
            band: Math.round(band.width),
            venstre: Math.round(b.left),
            hoyre: Math.round(window.innerWidth - b.right),
            kryss: Math.round(k.width),
          }
        })

        await framToasten()
        const ved100 = await mål()
        if (!ved100) throw new Error('fikk ikke fram GPS-toasten etter en avvist posisjon')
        if (ved100.band < ved100.vindu - 1) {
          throw new Error(`båndet er ${ved100.band} px av ${ved100.vindu} px `
            + '— toasten måler mot halve skjermen igjen (left: 50 %-fella)')
        }
        if (Math.abs(ved100.venstre - ved100.hoyre) > 2) {
          throw new Error(`toasten står ikke midt i båndet (${ved100.venstre} px mot `
            + `${ved100.hoyre} px luft)`)
        }

        await p2.evaluate(() => { localStorage.setItem('lende-ui-text-scale', '2') })
        await p2.reload({ waitUntil: 'domcontentloaded' })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await framToasten()
        const ved200 = await mål()
        if (!ved200) throw new Error('GPS-toasten kom ikke tilbake ved 200 %')
        if (!(ved200.kryss > ved100.kryss * 1.5)) {
          throw new Error(`lukke-krysset vokste ikke (${ved100.kryss} → ${ved200.kryss} px) `
            + '— mangler zoom-bindingen på knappen?')
        }
        if (ved200.hoyre < 0 || ved200.venstre < 0) {
          throw new Error('toasten går utenfor skjermen ved 200 % — følger bredde-taket skalaen?')
        }
        return `bånd ${ved100.band}/${ved100.vindu} px, luft ${ved100.venstre}/${ved100.hoyre} px, `
          + `krysset ${ved100.kryss} → ${ved200.kryss} px`
      } finally {
        await ctx.close()
      }
    },
  },
  {
    // HELE PILLA ER GRIPEFLATE (v7.6.0). Håndtaket er 44 px nederst i en boks
    // som er dobbelt så høy — man måtte sikte på den nederste tredjedelen, og
    // bommet man, trykket man på en snarvei. Sjekken drar fra MIDT PÅ EN
    // SNARVEI-KNAPP, altså nøyaktig der det gamle draget ikke tok tak, og
    // krever to ting av samme gest: at skuffa åpner seg, og at knappen man dro
    // fra IKKE ble utløst. Det siste er hele grunnen til at draget har en slop.
    navn: 'et sveip ned på en snarvei åpner skuffa uten å utløse den',
    domene: 'SnarveiRad (gripeflate + slop)',
    async kjør(page) {
      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      // «Valg» åpner en skuff vi kan se; drar vi fra den og skuffa likevel
      // dukker opp, har slop-en sviktet. Den ligger i første rad på et bredt
      // vindu — sjekken kjører i suitens vanlige viewport.
      const boks = await page.locator('[data-snarvei-id="innstillinger"]').boundingBox()
      if (!boks) throw new Error('fant ingen «Valg»-snarvei å dra fra')
      const x = boks.x + boks.width / 2
      const y = boks.y + boks.height / 2

      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x, y + 140, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(600)

      const etter = await page.evaluate(() => ({
        apen: document.querySelector('.snarvei-handle')?.getAttribute('aria-expanded'),
        skuff: !!document.querySelector('[role="dialog"][aria-label="Valg"]'),
      }))
      if (etter.skuff) {
        await lukkDrawer(page)
        await lukkSnarveiRad(page)
        throw new Error('draget utløste snarveien det startet på — slop-en avlyser ikke trykket')
      }
      if (etter.apen !== 'true') {
        throw new Error('et sveip ned på en snarvei åpnet ikke skuffa — '
          + 'gripeflata er håndtaket alene igjen')
      }

      // OG ET TRYKK SKAL FORTSATT VÆRE ET TRYKK: uten et drag imellom må
      // knappen virke som før. Ett svakt drag under slop-en teller som trykk.
      await lukkSnarveiRad(page)
      await page.locator('[data-snarvei-id="innstillinger"]').click()
      await page.waitForTimeout(600)
      const aapnet = await page.evaluate(() =>
        !!document.querySelector('[role="dialog"][aria-label="Valg"]'))
      if (!aapnet) throw new Error('et vanlig trykk på «Valg» åpnet ingen skuff')
      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      return 'sveip fra en snarvei åpner skuffa uten å utløse den, og trykket virker'
    },
  },
  {
    // SKUFFA FØLGER FINGEREN OG DOKKER (v7.5.0). Draget satte før bare en
    // av/på: raden hoppet mellom to former. Nå er høyden kontinuerlig, og på
    // slipp dokker den til nærmeste ende med appens fjærkurve. Begge deler er
    // usynlige i en enhetstest — det ene er en høyde midt i en pekersekvens,
    // det andre en `transition` som bare finnes når man IKKE drar.
    navn: 'snarvei-skuffa følger fingeren og dokker på slipp',
    domene: 'SnarveiRad + useDraggableDrawer (pickSnapTarget)',
    async kjør(page) {
      await lukkDrawer(page)
      // SMAL SKJERM, av samme grunn som sjekken over: uten en andre rad har
      // skuffa ingen høyde å følge fingeren med.
      const forrigeVindu = page.viewportSize()
      await page.setViewportSize({ width: 360, height: forrigeVindu.height })
      await page.waitForTimeout(600)
      await lukkSnarveiRad(page)
      const hoyde = () => page.evaluate(() =>
        Math.round(document.querySelector('.snarvei-rad').getBoundingClientRect().height))
      const h = await page.locator('.snarvei-handle').boundingBox()
      const x = h.x + h.width / 2
      const y = h.y + h.height / 2

      const start = await hoyde()
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x, y + 30, { steps: 6 })
      await page.waitForTimeout(120)
      const midt = await hoyde()
      if (!(midt > start)) {
        throw new Error(`skuffa fulgte ikke fingeren (${start} → ${midt} px) — `
          + 'da er draget bare en av/på igjen')
      }
      await page.mouse.move(x, y + 130, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(500)
      const dokket = await hoyde()
      if (!(dokket > midt)) {
        throw new Error(`skuffa dokket ikke til full høyde (${midt} → ${dokket} px)`)
      }

      // ET SVAKT DRAG COMMITTER. `pickSnapTarget` er retnings-basert med en
      // fjerdedels gap: man må ikke forbi midtpunktet for å bytte tilstand.
      // Uten den regelen blir en skuff man må dra hele veien hver gang.
      // HÅNDTAKET HAR FLYTTET SEG: skuffa er høyere nå, så boksen må leses på
      // nytt — et `mouse.down()` på den gamle posisjonen treffer kartet.
      const h2 = await page.locator('.snarvei-handle').boundingBox()
      const x2 = h2.x + h2.width / 2
      const y2 = h2.y + h2.height / 2
      await page.mouse.move(x2, y2)
      await page.mouse.down()
      await page.mouse.move(x2, y2 - 40, { steps: 5 })
      await page.mouse.up()
      await page.waitForTimeout(500)
      const etterSvakt = await hoyde()
      if (etterSvakt !== start) {
        throw new Error(`et svakt drag oppover dokket ikke tilbake `
          + `(${dokket} → ${etterSvakt} px, ventet ${start})`)
      }
      await page.setViewportSize(forrigeVindu)
      await page.waitForTimeout(400)
      return `${start} → ${midt} px under fingeren → ${dokket} px dokket, `
        + 'og et svakt drag tilbake committer'
    },
  },
  {
    // LUFTA RUNDT DRA-HÅNDTAKET ER DEN SAMME OVERALT (v7.5.0). Eieren hadde
    // snarvei-skuffa og punkt-arket åpne samtidig og så at de ikke matchet.
    // Verdien er dessuten LIK over og under, så «lufta rundt håndtaket» er ett
    // tall enten arket henger fra toppen eller fra bunnen.
    navn: 'dra-håndtaket har samme luft i snarvei-skuffa og punkt-arket',
    domene: 'SnarveiRad + ContextMenuSheet',
    async kjør(page) {
      await lukkDrawer(page)
      await page.evaluate(() => {
        const el = document.querySelector('svg.isom-map')
        const r = el.getBoundingClientRect()
        el.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }))
      })
      await page.waitForTimeout(700)
      const luft = await page.evaluate(() => {
        const les = (el) => {
          if (!el) return null
          const cs = getComputedStyle(el)
          return [Math.round(parseFloat(cs.paddingTop)), Math.round(parseFloat(cs.paddingBottom))]
        }
        const snar = document.querySelector('.snarvei-handle')
        const ark = [...document.querySelectorAll('.cursor-grab')]
          .find((e) => e.offsetParent && e !== snar && e.querySelector('.rounded-full'))
        return { snarvei: les(snar), punktark: les(ark) }
      })
      if (!luft.snarvei || !luft.punktark) {
        throw new Error(`fant ikke begge håndtakene: ${JSON.stringify(luft)}`)
      }
      if (luft.snarvei.join() !== luft.punktark.join()) {
        throw new Error(`ulik luft rundt dra-håndtaket: snarvei ${luft.snarvei.join('/')} `
          + `mot punkt-ark ${luft.punktark.join('/')}`)
      }
      if (luft.snarvei[0] !== luft.snarvei[1]) {
        throw new Error(`håndtaket har ulik luft over og under (${luft.snarvei.join('/')}) `
          + '— da er den ikke den samme når arket snus')
      }
      await page.locator('[aria-label="Lukk punktinfo"]').first().click().catch(() => {})
      await page.waitForTimeout(400)
      return `begge håndtakene har ${luft.snarvei[0]} px luft over og under`
    },
  },
  {
    // SNARVEIENE FØLGER TEKSTSTØRRELSE-VALGET (v7.4.0). Resten av appen har
    // gjort det lenge (skuffene, punkt-arket, headerne); raden var det ene
    // stedet der 200 % ikke slo gjennom — altså nøyaktig den flata man leser
    // mens man går. `zoom` står på hver KNAPP og ikke på raden, fordi en zoomet
    // rad også skalerer sitt eget gap og sin egen polstring, og da måles et
    // budsjett i én enhet mot knapper i en annen.
    //
    // To ting måles, og begge er usynlige for en enhetstest: at knappen
    // faktisk BLIR STØRRE, og at målingen henger med — en rad som ikke måler
    // om ved skala-bytte klipper knapper ut over skjermkanten.
    navn: 'snarveiene vokser med tekststørrelsen, og raden måler om',
    domene: 'SnarveiRad + useUiTextScale',
    async kjør(page) {
      await lukkDrawer(page)
      await lukkSnarveiRad(page)
      const mål = () => page.evaluate(() => {
        const rad = document.querySelector('.snarvei-rad')
        const knapp = rad?.querySelector('[data-snarvei]')
        if (!knapp) return null
        const b = knapp.getBoundingClientRect()
        return {
          bredde: Math.round(b.width),
          hoyde: Math.round(b.height),
          zoom: getComputedStyle(knapp).zoom,
          synlige: [...rad.querySelectorAll('[data-snarvei]')].filter((e) =>
            e.getBoundingClientRect().bottom <= rad.getBoundingClientRect().bottom + 1).length,
          hoyre: Math.round(rad.getBoundingClientRect().right),
          vindu: window.innerWidth,
        }
      })
      const sett = async (skala) => {
        await page.evaluate((v) => {
          localStorage.setItem('lende-ui-text-scale', String(v))
        }, skala)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2500)
      }

      const ved100 = await mål()
      if (!ved100) throw new Error('fant ingen snarvei-knapp å måle')
      try {
        await sett(2)
        const ved200 = await mål()
        if (!ved200) throw new Error('fant ingen snarvei-knapp ved 200 %')
        if (!(ved200.hoyde > ved100.hoyde * 1.4)) {
          throw new Error(`snarveien vokste ikke med tekststørrelsen `
            + `(${ved100.hoyde} → ${ved200.hoyde} px) — følger den uiTextScale?`)
        }
        if (ved200.hoyre > ved200.vindu + 1) {
          throw new Error(`raden går ${ved200.hoyre - ved200.vindu} px ut over `
            + 'skjermkanten ved 200 % — målingen tok ikke skala-byttet')
        }
        // Færre får plass, og det er meningen: resten ligger bak håndtaket.
        if (ved200.synlige > ved100.synlige) {
          throw new Error(`flere knapper synlige ved 200 % (${ved100.synlige} → `
            + `${ved200.synlige}) — da er ikke den store teksten målt`)
        }
        // OG KANTEN RUNDT CELLA MÅ VÆRE HEL VED 200 % (v7.7.5). Sjekken for
        // dette sto i sorterings-sjekken og målte BARE standard tekststørrelse,
        // og det var nøyaktig hullet: veksten som klippet den nederste streken
        // var 2 px per rad ganget med cellenes `zoom`, altså minst ved 100 % og
        // verst ved 200 %. Lufta måles derfor der den brakk.
        await startSortering(page)
        const luft200 = await page.evaluate(() => {
          const g = document.querySelector('[data-snarvei-gitter]')
          const celler = [...g.querySelectorAll('[data-snarvei]')]
          const gb = g.getBoundingClientRect()
          const nederst = Math.max(...celler.map((c) => c.getBoundingClientRect().bottom))
          return Math.round((gb.bottom - nederst) * 10) / 10
        })
        await avsluttSortering(page)
        if (luft200 < 1) {
          throw new Error(`siste rad har ${luft200} px under seg i sorterings-modus `
            + 'ved 200 % — kanten rundt cella klippes bort av gitteret')
        }
        return `knapp ${ved100.hoyde} → ${ved200.hoyde} px høy, `
          + `${ved100.synlige} → ${ved200.synlige} på linja, ingen overflyt, `
          + `${luft200} px luft under siste rad ved 200 %`
      } finally {
        // NØYTRAL TILSTAND: hele resten av suiten kjører på 100 %.
        await sett(1)
      }
    },
  },
  {
    navn: 'snarvei-raden måler seg, håndtaket står alltid, sorteringen virker',
    domene: 'SnarveiRad+lib/snarveier',
    async kjør(page) {
      await lukkDrawer(page)
      // Målingen er hele poenget med raden: den skal aldri klippe en knapp bort
      // over skjermkanten, og håndtaket skal stå der uansett — det er også
      // eneste vei til sorteringen. Fra v7.4.0 er håndtaket et SØSKEN av raden
      // og ikke en knapp inne i den, så det leses utenfor `.snarvei-rad`.
      // Fra v7.5.0 er raden et GITTER: «synlig» er ikke lenger `offsetParent`
      // (alle cellene står i DOM-en hele tida) men om cella ligger innenfor
      // gitterets klipp.
      const les = () => page.evaluate(() => {
        const r = document.querySelector('.snarvei-rad')
        if (!r) return null
        const boks = r.getBoundingClientRect()
        const alle = [...r.querySelectorAll('[data-snarvei]')]
        const synlige = alle.filter((b) => b.getBoundingClientRect().bottom <= boks.bottom + 1)
        const handle = document.querySelector('.snarvei-handle')
        return {
          ider: synlige.map((b) => b.getAttribute('data-snarvei-id')),
          totalt: alle.length,
          harHandle: !!handle && handle.offsetParent !== null,
          handleIRaden: !!r.querySelector('.snarvei-handle'),
          kolonner: getComputedStyle(r).gridTemplateColumns.split(' ').filter(Boolean).length,
          bredder: [...new Set(alle.map((b) => Math.round(b.getBoundingClientRect().width)))],
          venstre: Math.round(boks.left),
          hoyre: Math.round(boks.right),
          vindu: window.innerWidth,
        }
      })

      const forrigeVindu = page.viewportSize()
      const funn = []
      // Bred OG smal skjerm: på 360 px har målingen faktisk en jobb, og en
      // rad som bare er målt på desktop er en rad som ikke er målt.
      for (const bredde of [forrigeVindu.width, 360]) {
        await page.setViewportSize({ width: bredde, height: forrigeVindu.height })
        await page.waitForTimeout(500)
        const r = await les()
        if (!r) throw new Error(`fant ingen snarvei-rad ved ${bredde} px`)
        if (!r.harHandle) throw new Error(`håndtaket mangler ved ${bredde} px`)
        if (r.handleIRaden) {
          throw new Error(`håndtaket står inne i .snarvei-rad ved ${bredde} px `
            + '— da spiser det bredde fra knappene og er formet som en snarvei igjen')
        }
        if (!r.ider.length) throw new Error(`ingen synlige snarveier ved ${bredde} px`)
        if (r.venstre < -1 || r.hoyre > r.vindu + 1) {
          throw new Error(`raden er utenfor skjermen ved ${bredde} px: ${r.venstre}..${r.hoyre} av ${r.vindu}`)
        }
        // ALLE CELLER ER LIKE BREDE (v7.5.0). Det var de ikke da raden var en
        // flex-rad: hver knapp var så bred som ordet sitt. Ett `1fr`-gitter gir
        // det gratis, men en `min-width` eller en `flex`-regel som sniker seg
        // inn igjen tar det like gratis bort.
        if (r.bredder.length !== 1) {
          throw new Error(`snarveiene er ulikt brede ved ${bredde} px: ${r.bredder.join(', ')} px`)
        }
        funn.push(`${bredde}px → ${r.kolonner} kolonner, ${r.ider.length}/${r.totalt} i første rad`)
      }
      await page.setViewportSize(forrigeVindu)
      await page.waitForTimeout(500)

      // SORTERINGEN SKJER I SELVE RADEN (v7.7.0), og det er nettopp derfor den
      // hører hjemme i DENNE sjekken: den måler hvor mange kolonner raden får
      // og hvem som havner i første rad, og det er samme gitter man nå flytter
      // knappene i. Panelet kunne per konstruksjon ikke svare på det — det var
      // en loddrett liste uten et kolonnetall.
      //
      // TRE TING MÅLES, og ingen av dem finnes i en enhetstest:
      //   • cella man drar FØLGER FINGEREN (en `transform` skrevet fra en
      //     pekerhendelse), og et SPØKELSE holder plassen den forlot;
      //   • naboene GLIR til side, altså forhåndsvisningen av slippet;
      //   • rekkefølgen endrer seg først VED SLIPP, og raden speiler den.
      const forFor = (await les()).ider
      await startSortering(page)
      if (!(await page.locator('[data-sorter-footer]').count())) {
        throw new Error('sorterings-modus startet ikke')
      }

      const drag = await (async () => {
        const celler = page.locator('[data-snarvei]')
        const fra = await celler.nth(0).boundingBox()
        const til = await celler.nth(1).boundingBox()
        if (!fra || !til) return { feil: 'fant ikke to celler å bytte om på' }
        await page.mouse.move(fra.x + fra.width / 2, fra.y + fra.height / 2)
        await page.mouse.down()
        await page.mouse.move(fra.x + fra.width / 2 + 12, fra.y + fra.height / 2, { steps: 3 })
        await page.mouse.move(til.x + til.width / 2, til.y + til.height / 2, { steps: 8 })
        const midt = await page.evaluate(() => {
          const loftet = document.querySelector('.shortcut-btn--loftet')
          const spok = document.querySelector('.snarvei-rad > [aria-hidden="true"]')
          const nabo = document.querySelectorAll('[data-snarvei]')[1]
          const tall = (el) => {
            const m = /translate\((-?[\d.]+)px/.exec(el?.style.transform || '')
            return m ? Number(m[1]) : null
          }
          return { dx: tall(loftet), naboDx: tall(nabo), spokelse: !!spok }
        })
        await page.mouse.up()
        await page.waitForTimeout(400)
        return midt
      })()
      if (drag.feil) throw new Error(drag.feil)
      if (!(Math.abs(drag.dx ?? 0) > 20)) {
        throw new Error(`cella man drar i fulgte ikke fingeren (translate ${drag.dx}px)`)
      }
      if (!drag.spokelse) {
        throw new Error('ingen spøkelses-boks der cella lå — man ser ikke hvor den kom fra')
      }
      if (!(Math.abs(drag.naboDx ?? 0) > 20)) {
        throw new Error(`naboen gled ikke til side (translate ${drag.naboDx}px) — `
          + 'da er det ingen forhåndsvisning av hva slippet gjør')
      }

      const etterDrag = (await les()).ider
      if (etterDrag[0] === forFor[0]) {
        throw new Error(`draget flyttet ingenting: ${etterDrag.join(',')}`)
      }

      // Rydd etter seg — neste sjekk skal møte standard rekkefølge, og en
      // localStorage-nøkkel som blir liggende gjør sjekker etter denne
      // avhengige av hvilken rekkefølge DENNE endte på.
      await klikkTekst(page, /^Tilbakestill$/, '[data-sorter-footer]')
      await avsluttSortering(page)
      const slutt = (await les()).ider
      if (slutt[0] !== forFor[0]) throw new Error('tilbakestillingen ga ikke standard rekkefølge')
      return `${funn.join(', ')}; draget i raden byttet ${forFor[0]} og ${forFor[1]} `
        + `(cella ${Math.round(drag.dx)}px, naboen ${Math.round(drag.naboDx)}px), og tilbakestilte`
    },
  },
  {
    // TOPPRADA ER TILBAKE, OG PILLENE LUKKER IKKE RADEN (v7.2.0).
    //
    // v7.1.0 flyttet hamburgeren, kartnavnet, søket og innstillingene inn i
    // snarvei-raden. Felttesten svarte at raden ble fire linjer svart boks over
    // kartet, og at man måtte åpne et nedtrekk for å se hvilket kart man sto i.
    // Rada er nøyaktig den fra v6.6.5 igjen. To ting måles her, begge usynlige
    // for en enhetstest:
    //
    //   1. ALLE FIRE STÅR OVER RADEN. Ikke bare at de finnes — at de ligger
    //      HØYERE på skjermen enn snarvei-raden. En knapp som havner inni raden
    //      igjen ser helt lik ut i DOM-en.
    //   2. HÅNDTAKET ER BUNNPLASSERT OG MIDTSTILT (v7.4.0), og «Sorter
    //      snarveier» står FRISTILT under raden — ikke inne i radens boks.
    //      Begge er ren geometri: de ser identiske ut i DOM-en om de havner
    //      feil sted, og en enhetstest ser ingen av delene.
    navn: 'topprada over raden, tannhjulet ute, håndtaket under den',
    domene: 'MapView (topprada) + SnarveiRad (håndtak)',
    async kjør(page) {
      await lukkDrawer(page)
      const topp = await page.evaluate(() => {
        const rad = document.querySelector('.snarvei-rad')
        if (!rad) return { mangler: 'snarvei-raden' }
        const radTopp = rad.getBoundingClientRect().top
        const finn = (velger) => {
          const e = document.querySelector(velger)
          if (!e) return null
          const r = e.getBoundingClientRect()
          return r.width > 0 ? Math.round(r.top) : null
        }
        return {
          radTopp: Math.round(radTopp),
          meny: finn('[data-hovedmeny-knapp]'),
          // `data-kartnavn` og ikke aria-label: på et innebygd demokart kan
          // navnet ikke endres, og da er det en statisk pille uten etikett.
          navn: finn('[data-kartnavn]'),
          sok: finn('button[aria-label="Søk i kart"]'),
          // TANNHJULET ER UTE AV TOPPRADA (v7.6.0) — «Valg» er en snarvei. Den
          // skal ikke kunne snike seg tilbake i god tro og gi to veier til
          // samme skuff; `[data-snarvei]` skiller den fra snarvei-cella.
          oppsett: !!document.querySelector('button[aria-label="Innstillinger"], button[aria-label="Valg"]:not([data-snarvei])'),
        }
      })
      if (topp.mangler) throw new Error(`fant ingen ${topp.mangler}`)
      if (topp.oppsett) {
        throw new Error('tannhjulet står i topprada igjen — innstillingene er snarveien «Valg»')
      }
      for (const [id, y] of [['hamburgeren', topp.meny], ['kartnavnet', topp.navn],
                             ['søket', topp.sok]]) {
        if (y == null) throw new Error(`${id} har ingen synlig boks — er den flyttet inn i raden igjen?`)
        if (y >= topp.radTopp) {
          throw new Error(`${id} står på ${y}, altså ikke over snarvei-raden på ${topp.radTopp}`)
        }
      }

      // HÅNDTAKET ER BUNNPLASSERT OG MIDTSTILT (v7.4.0). Det sto i samme
      // flex-rad som funksjonene, formet som en snarvei — nå er det appens
      // grå drawer-håndtak på sin egen linje under raden. Målt, ikke antatt:
      // et håndtak som glir tilbake inn i raden ser likt ut i DOM-en.
      await apneSnarveiRad(page)
      const geo = await page.evaluate(() => {
        const rad = document.querySelector('.snarvei-rad')
        const handle = document.querySelector('.snarvei-handle')
        const sorter = [...document.querySelectorAll('button')]
          .find((b) => b.offsetParent && b.innerText.trim() === 'Sorter snarveier')
        if (!rad || !handle || !sorter) {
          return { mangler: !rad ? 'raden' : !handle ? 'håndtaket' : '«Sorter»' }
        }
        // KNOTTE-RADA er det midtstilte, ikke knappen. De to falt sammen igjen
        // i v7.7.6 da navne-bryteren ble slettet, men raden er fortsatt det som
        // midtstilles — kommer det en knott til, er det den som skal stemme.
        const knotter = sorter.parentElement
        const kr = knotter.getBoundingClientRect()
        const r = rad.getBoundingClientRect()
        const h = handle.getBoundingClientRect()
        const so = sorter.getBoundingClientRect()
        // Selve streken i håndtaket, ikke trykkflata: det er den man ser.
        const strek = handle.querySelector('span')?.getBoundingClientRect()
        return {
          handleUnderRaden: h.top >= r.bottom - 1,
          handleMidt: Math.round(h.left + h.width / 2),
          radMidt: Math.round(r.left + r.width / 2),
          strekBredde: strek ? Math.round(strek.width) : 0,
          strekMidt: strek ? Math.round(strek.left + strek.width / 2) : 0,
          sorterUnderHandtaket: so.top >= h.bottom - 1,
          sorterUtenforBoksen: !rad.parentElement.contains(sorter),
          knotterMidt: Math.round(kr.left + kr.width / 2),
          sorterHarIkon: !!sorter.querySelector('svg'),
          // NAVNE-BRYTEREN ER SLETTET (v7.7.6): navnene står alltid, og en
          // knott med et NIVÅ hørte ikke hjemme i en rad med bare funksjoner.
          harBryter: !!knotter.querySelector('[role="switch"]'),
        }
      })
      if (geo.mangler) throw new Error(`fant ingen ${geo.mangler}`)
      if (!geo.handleUnderRaden) {
        throw new Error('håndtaket står ikke under raden — det er ikke bunnplassert')
      }
      if (Math.abs(geo.handleMidt - geo.radMidt) > 4) {
        throw new Error(`håndtaket er ${Math.abs(geo.handleMidt - geo.radMidt)} px ` +
          'ute av radens midtlinje')
      }
      if (Math.abs(geo.strekMidt - geo.radMidt) > 4) {
        throw new Error('selve håndtaks-streken er ikke midtstilt')
      }
      if (geo.strekBredde < 24 || geo.strekBredde > 96) {
        throw new Error(`håndtaks-streken er ${geo.strekBredde} px bred — ` +
          'det er ikke appens drawer-håndtak lenger')
      }
      if (!geo.sorterUnderHandtaket) {
        throw new Error('«Sorter» står ikke under håndtaket')
      }
      if (!geo.sorterUtenforBoksen) {
        throw new Error('«Sorter» ligger inne i radens boks — den skal være fristilt')
      }
      if (geo.sorterHarIkon) {
        throw new Error('«Sorter» har fått et ikon igjen — knappen er ren tekst')
      }
      if (Math.abs(geo.knotterMidt - geo.radMidt) > 4) {
        throw new Error('knotte-rada under håndtaket er ikke midtstilt under raden')
      }
      // NAVNE-BRYTEREN ER BORTE (v7.7.6) — navnene står alltid. Sjekken måler
      // fraværet fordi en bryter er lett å legge tilbake i god tro.
      if (geo.harBryter) {
        throw new Error('det står en vippebryter ved siden av «Sorter» igjen — '
          + 'navnene skal alltid stå, uten en knott som kan skru dem av')
      }
      // «Sorter» ER BORTE I SORTERINGS-MODUS: der er man allerede inne i den.
      await klikkTekst(page, /^Sorter snarveier$/)
      await page.waitForTimeout(300)
      const iModus = await page.evaluate(() => ({
        sorter: !![...document.querySelectorAll('button')]
          .find((b) => b.offsetParent && b.innerText.trim() === 'Sorter snarveier'),
      }))
      if (iModus.sorter) throw new Error('«Sorter» står igjen i sorterings-modus')
      await avsluttSortering(page)

      // NØYTRAL TILSTAND: raden skal ikke stå åpen inn i neste sjekk.
      await lukkSnarveiRad(page)
      return `topprada over raden (${topp.meny}/${topp.navn}/${topp.sok} `
        + `< ${topp.radTopp}), tannhjulet ute, håndtak ${geo.strekBredde} px `
        + 'midtstilt under raden, «Sorter» fristilt under håndtaket '
        + 'og borte i sorterings-modus'
    },
  },
  {
    // DE EKSTERNE KARTENE BOR ØVERST I INFOPANELET (v7.2.0). De var chips i
    // hovedmenyen til v6.6.5, snarveier bak «Mer» i v7.0.0, og er nå der de
    // hører hjemme: i panelet om DETTE punktet, som åpnes både av Info-snarveien
    // og av et lang-trykk i kartet. Det som kan brekke stille er koblingen — en
    // knapp som åpner en fane på feil sted, eller ingen fane i det hele tatt,
    // ser helt lik ut i DOM-en. Derfor måles den ekte URL-en fanen får.
    navn: 'UT.no og Google Maps åpner på punktet i infopanelet',
    domene: 'ContextMenuSheet + MapView (eksternt kart)',
    async kjør(page) {
      await lukkDrawer(page)

      // `window.open` STUBBES, og den ekte fanen åpnes ikke. Første utgave
      // ventet på en popup og leste `page.url()` — den ble
      // `chrome-error://chromewebdata/`, fordi ut.no ikke er nåbar herfra.
      // Sjekken målte da nettverket og ikke koblingen. Stubben fanger nøyaktig
      // URL-en knappen ber om, og trykket er fortsatt et ekte klikk gjennom den
      // ekte handleren.
      await page.evaluate(() => {
        window.__roykUrler = []
        window.open = (url) => { window.__roykUrler.push(String(url)); return null }
      })

      await klikkSnarvei(page, 'info')
      await page.waitForTimeout(700)
      await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('button')]
          .find((e) => e.offsetParent !== null && /^UT\.no$/.test(e.innerText.trim()))
        return !!b
      }, null, { timeout: 10_000 })
        .catch(() => { throw new Error('infopanelet viste ingen UT.no-knapp øverst') })

      const funn = []
      for (const [id, etikett, monster] of [
        ['utno', /^UT\.no$/, /ut\.no/i],
        ['gmaps', /^Google Maps$/, /google\.[a-z.]+\/maps/i],
      ]) {
        await klikkTekst(page, etikett)
        const url = await page.evaluate(() => window.__roykUrler.at(-1) ?? '')
        if (!url) throw new Error(`«${id}» åpnet ingenting`)
        if (!monster.test(url)) throw new Error(`«${id}» åpnet ${url}`)
        // Koordinatene skal være punktets, ikke en default et sted i Norge.
        const tall = url.match(/-?\d+\.\d+/g) || []
        if (tall.length < 2) throw new Error(`«${id}» fikk ingen koordinater: ${url}`)
        funn.push(`${id} → ${tall.slice(0, 2).join(',')}`)
      }

      // NØYTRAL TILSTAND: punkt-arket ligger over kartet til det lukkes.
      await page.locator('button[aria-label="Lukk"]').first().click()
      await page.waitForTimeout(300)
      return funn.join('; ')
    },
  },
  {
    navn: 'måling legger vertices og regner distanse',
    domene: 'useMaaling',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkSnarvei(page, 'maaling')
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
      // Rydd etter seg: måle-modus bytter ut snarvei-raden, så neste sjekk fant
      // ikke 3D-knappen. En sjekk skal alltid forlate appen i nøytral tilstand.
      // Fra v6.6.0 er Måling sin EGEN skuff, så den må lukkes også — ellers
      // ligger arket over kartet når neste sjekk trykker.
      await klikkTekst(page, /^(Avslutt måling|Måling)$/)
      await page.waitForTimeout(500)
      await lukkFunksjonsSkuff(page, 'Måling')
      return `${vertices} vertices, leste «${tall}»`
    },
  },
  {
    // X-en lukket bare arket, mens kartet sto igjen og ventet på et trykk
    // (v6.6.3). Modusen har ingen annen bryter, så neste tapp i kartet
    // plasserte et symbol brukeren hadde gått bort fra. Sjekken må måle at
    // INDIKATOREN er borte — at arket er lukket var sant også før fiksen.
    //
    // Den må seede sitt eget kart: Annotering er `kunEgne`, altså skjult på
    // demokartene, og `/kart/vardasen` er det suiten ellers står i. Samme
    // seeding som «Mine kart»-sjekken over, og den rydder etter seg.
    navn: 'X-en i annoterings-arket avslutter plasserings-modusen',
    domene: 'MapView (annotering)',
    async kjør(page) {
      const ID = 'royk-annotering'
      const seed = () => evalMedTak(page, async (id) => {
        const svg = await fetch(`${location.pathname.split('/kart/')[0]}/maps/vardasen.svg`)
          .then((r) => r.text())
        const post = {
          id, navn: 'Annoterings-arket', svg, opprettet: Date.now(),
          bbox: { south: 59.79, north: 59.84, west: 10.37, east: 10.46 },
          equidistanceM: 20, isAuto: false, partial: false, annotations: [], tracks: [],
        }
        const db = await new Promise((ok, nei) => {
          const r = indexedDB.open('lende-maps', 3)
          r.onsuccess = () => ok(r.result)
          r.onerror = () => nei(r.error)
        })
        await new Promise((ok, nei) => {
          const t = db.transaction(['maps', 'meta'], 'readwrite')
          t.objectStore('maps').put(post)
          const { svg: _s, annotations: _a, tracks: _t, ...lett } = post
          t.objectStore('meta').put({ ...lett, hasDem: false, sizeBytes: svg.length })
          t.oncomplete = ok
          t.onerror = () => nei(t.error)
        })
        db.close()
      }, ID)

      const indikator = () => page.evaluate(() =>
        [...document.querySelectorAll('div')].some((d) =>
          d.offsetParent && /^Trykk på kartet for å plassere/.test(d.innerText.trim())))

      try {
        await seed()
        await page.goto(`${BASE}/kart/${ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await lukkDrawer(page)

        // Annotering kan ligge bak håndtaket på en smal skjerm — raden viser
        // bare den første raden sammenlagt. `klikkSnarvei` drar den ut først.
        await klikkSnarvei(page, 'annotering')
        await page.waitForTimeout(600)
        await klikkTekst(page, /^Knaus$/)
        await page.waitForTimeout(400)
        if (!await indikator()) {
          throw new Error('valgte «Knaus», men kartet sier ikke at det venter på et trykk')
        }

        await lukkFunksjonsSkuff(page, 'Annotering')
        if (await indikator()) {
          throw new Error('arket er lukket, men kartet venter fortsatt på et annoterings-trykk')
        }
        return 'plasserings-modus fulgte arket ut'
      } finally {
        await evalMedTak(page, async (id) => {
          const db = await new Promise((ok, nei) => {
            const r = indexedDB.open('lende-maps', 3)
            r.onsuccess = () => ok(r.result)
            r.onerror = () => nei(r.error)
          })
          await new Promise((ok) => {
            const t = db.transaction(['maps', 'meta'], 'readwrite')
            t.objectStore('maps').delete(id)
            t.objectStore('meta').delete(id)
            t.oncomplete = ok
            t.onerror = ok
          })
          db.close()
        }, ID).catch(() => {})
        await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
      }
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
      // Radene skal si HVOR LANGT UNNA treffet er, aldri hvilken flis det ligger
      // i (v6.5.81). Merkelappen «i naboflis» sto på hver rad i et utbygd ark og
      // forklarte appens indre oppdeling; avstanden betyr det samme enten kartet
      // er én flis eller trettiseks. Måles her fordi den avhenger av at
      // visibleCenterSvg faktisk svarer når søket åpnes — ingen enhetstest ser det.
      const rader = await page.evaluate(() =>
        [...document.querySelectorAll('#mapsearch-results [role="option"]')]
          .map((e) => e.innerText.trim()))
      if (!rader.length) throw new Error(`ingen trefferader for «${navn.slice(0, 4)}»`)
      const flisord = rader.find((t) => /naboflis|kartflis/i.test(t))
      if (flisord) throw new Error(`trefflista nevner fliser: «${flisord}»`)
      // Radene leses med innerText, som respekterer text-transform: uppercase —
      // «930 m» kommer ut som «930 M». Derfor i-flagget.
      const medAvstand = rader.filter((t) => /·\s*\d+([,.]\d+)?\s*(m|km)\b/i.test(t)).length
      if (!medAvstand) throw new Error(`ingen avstand på radene: «${rader[0]}»`)
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
      return `«${traff}» → ${ring} ring-noder, transform endret, `
        + `${medAvstand}/${rader.length} rader med avstand, ingen flis-ord`
    },
  },
  {
    navn: 'plassholder klippes med ellipse og blir full ved fokus',
    domene: 'style.css',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkTekst(page, /^Søk i kart$/)
      await page.waitForTimeout(500)
      const felt = page.locator('input[type="search"], input[type="text"]').first()
      await felt.focus()
      await page.waitForTimeout(150)
      const m = await evalMedTak(page, () => {
        const el = document.querySelector('input[type="search"], input[type="text"]')
        if (!el) return null
        const inn = getComputedStyle(el)
        const ph = getComputedStyle(el, '::placeholder')
        const les = (c) => (c.match(/[\d.]+/g) || []).map(Number)
        return {
          klipp: inn.textOverflow,
          tekst: les(inn.color),
          plass: les(ph.color),
          op: parseFloat(ph.opacity),
        }
      })
      // Nøytral tilstand: søkeoverlegget dekker fane-raden, så neste sjekk
      // finner ikke 3D-knappen. Escape alene lukker det ikke når feltet har
      // fokus — trykk lukkeknappen, og verifiser at den er borte.
      await page.locator('button[aria-label="Lukk søk"]').first().click()
      await page.waitForTimeout(400)
      const åpent = await page.locator('button[aria-label="Lukk søk"]').count()
      if (åpent) throw new Error('søkeoverlegget ble stående åpent')
      if (!m) throw new Error('fant ikke søkefeltet')
      // 1. Ellipsen må ligge på selve inputen — en regel på ::placeholder gir
      //    hard klipping (målt i Chromium, v6.5.32).
      if (m.klipp !== 'ellipsis')
        throw new Error(`text-overflow på inputen er «${m.klipp}», ikke ellipsis`)
      // 2. Ved fokus skal plassholderen ha inputens EGEN tekstfarge i full
      //    styrke — «full hvit» på mørk flate, full blekk på lys. Sammenlikn
      //    kanalene, ikke strengen: currentColor serialiseres med alfa.
      const likeKanaler = m.tekst.slice(0, 3).every((v, i) => v === m.plass[i])
      const fullAlfa = (m.plass[3] ?? 1) >= 0.99 && m.op >= 0.99
      if (!likeKanaler || !fullAlfa)
        throw new Error(`fokusert plassholder er ${m.plass.join(',')} @${m.op}, `
          + `ikke inputens ${m.tekst.join(',')} i full styrke`)
      return `${m.klipp}, fokus → rgb(${m.plass.slice(0, 3).join(',')}) @${m.op}`
    },
  },
  {
    navn: 'eksport av rotert kart gir vannrette labels',
    domene: 'useKartEksport',
    krever: 'ektekart',
    async kjør(page) {
      // Skjermen counter-roterer labels så de står vannrett mens kartet er
      // rotert, og den counter-rotasjonen må ikke følge med ut — ellers står
      // 179 navn skjevt (rapportert etter PDF-test, rettet i v5.14.0).
      //
      // MEN fila er ikke lenger nødvendigvis rett: eksporten roterer arket til
      // sann nord, og da bærer teksten sin egen counter-rotasjon mot NØYAKTIG
      // den. Invarianten er derfor ikke «rotate(0)» men SUMMEN: tekstens
      // rotasjon pluss arkets skal være null, altså vannrett på papiret.
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
      // Skjermrotasjonen er sliderens 40° pluss arkets nord-korreksjon, så
      // tallet er ikke rundt. Vi krever bare at det ligger nær −40.
      const skjermFør = await page.evaluate(() => {
        const t = [...document.querySelectorAll('svg.isom-map text[transform]')]
          .map((e) => Number(/rotate\((-?[\d.]+)/.exec(e.getAttribute('transform'))?.[1]))
          .filter((v) => Number.isFinite(v) && Math.abs(v + 40) < 2)
        return t.length
      })
      if (!skjermFør) throw new Error('labels ble ikke counter-rotert på skjermen — rotasjonen slo ikke inn')

      await åpneDrawer(page)
      await klikkTekst(page, /^EKSPORT$/)
      const last = page.waitForEvent('download', { timeout: 20_000 })
      await klikkTekst(page, /Lagre \.svg/)
      const sti = await (await last).path()
      const fil = sti ? readFileSync(sti, 'utf8') : ''
      // Fila parses, den regexes ikke: `forHverUpright` hopper med vilje over
      // tekst i <defs> (maler, ikke tegnet tekst) og over tekst i lag som er
      // skrudd AV — de bærer en foreldet rotasjon, men de vises ikke på
      // papiret. En telling som tar dem med måler noe annet enn den påstår.
      const papir = await page.evaluate((txt) => {
        const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
        const ark = Number(doc.querySelector('[data-sann-nord]')?.getAttribute('data-sann-nord') ?? 0)
        let sett = 0
        const feil = []
        for (const t of doc.querySelectorAll('text')) {
          if (t.closest('defs')) continue
          const lag = t.closest('[data-layer]')
          if (lag && /display:\s*none/.test(lag.getAttribute('style') || '')) continue
          const r = /rotate\((-?[\d.]+)/.exec(t.getAttribute('transform') || '')
          if (!r) continue
          sett++
          if (Math.abs(Number(r[1]) + ark) > 0.05) {
            feil.push(`${r[1]}° i ${lag?.getAttribute('data-layer') || '(uten lag)'}`)
          }
        }
        return { ark, sett, feil }
      }, fil)
      const arkRot = papir.ark
      if (!Number.isFinite(arkRot)) throw new Error('data-sann-nord er ikke et tall')
      if (papir.feil.length) {
        const unike = [...new Set(papir.feil)].slice(0, 6).join(', ')
        throw new Error(`${papir.feil.length} av ${papir.sett} labels står skjevt på papiret `
          + `(ark ${arkRot}°): ${unike}`)
      }
      if (!papir.sett) throw new Error('fant ingen roterte labels i fila — målte den noe?')

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
      const skjermEtter = await page.evaluate(() => [...document.querySelectorAll('svg.isom-map text[transform]')]
        .map((e) => Number(/rotate\((-?[\d.]+)/.exec(e.getAttribute('transform'))?.[1]))
        .filter((v) => Number.isFinite(v) && Math.abs(v + 40) < 2).length)
      if (!skjermEtter) throw new Error('skjermens labels ble IKKE gjenopprettet etter eksport')
      await page.evaluate(() => {
        const sl = document.querySelector('input[aria-label*="Roter kartet"]')
        sl.value = '0'; sl.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.waitForTimeout(600)
      return `${skjermFør} vannrette på skjerm → 0 av ${papir.sett} skjeve i fil `
        + `(ark ${arkRot}°) → ${skjermEtter} urørt (rot ${rotEtter}°)`
    },
  },
  {
    navn: 'sann nord: arket står rotert i hvile, og bryteren styrer fila',
    domene: 'useKartEksport',
    krever: 'ektekart',
    async kjør(page) {
      // Kartnord (UTM-rutenettet) er ikke sann nord, og arket lastes ferdig
      // rotert så nord er nord. To ting måles her:
      //  1. NULL PÅ ROSA ER SANN NORD, ikke null på arket. Sjekken TRYKKER seg
      //     dit framfor å lese av «i hvile»: harnessen laster siden på nytt
      //     etter en rød sjekk, localStorage overlever, og en tidligere sjekk
      //     kan ha lagret en visning som gjenopprettes — da er hvile-tilstanden
      //     ikke den ferske. Skyver vi rosa til 0 SELV, måler vi invarianten
      //     uansett hva som lå lagret.
      //  2. Bryteren i Eksport-fanen styrer FILA. Av gir det rene UTM-arket.
      //     Kolofonen skriver orienteringen begge veier: et ark uten app rundt
      //     seg må si det selv.
      await lukkDrawer(page)
      // Rosas egen skyv bærer gradtallet brukeren leser, så den er entydig —
      // et span-søk ville plukket zoom-avlesningen like gjerne.
      const settRosa = (v) => page.evaluate((deg) => {
        const sl = document.querySelector('input[aria-label="Roter kartet"]')
        if (!sl) return false
        sl.value = String(deg)
        sl.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }, v)
      const lesRosa = () => page.evaluate(() => {
        const el = document.querySelector('[data-map-inner]')
        const m = /rotate\((-?[\d.]+)deg\)/.exec(el?.style.transform || '')
        const sl = document.querySelector('input[aria-label="Roter kartet"]')
        return { ark: m ? Number(m[1]) : 0, grad: sl ? Number(sl.value) : null }
      })
      if (!(await settRosa(40))) throw new Error('fant ingen rosa-skyv (kjører testen i mobil-viewport?)')
      await page.waitForTimeout(700)
      const skrå = await lesRosa()
      if (skrå.grad !== 40) throw new Error(`rosa leser ${skrå.grad}° etter et skyv til 40`)
      const avvik = skrå.ark - 40
      if (Math.abs(avvik) < 0.05) {
        throw new Error('arket står nøyaktig på rosas 40° — nord-korreksjonen slo ikke inn')
      }
      await settRosa(0)
      await page.waitForTimeout(700)
      const nord = await lesRosa()
      if (nord.grad !== 0) throw new Error(`rosa leser ${nord.grad}° etter et skyv til 0`)
      if (Math.abs(nord.ark) < 0.05) {
        throw new Error('0 på rosa ga 0° på arket — da er rosa kartnord og ikke sann nord')
      }
      if (Math.abs(nord.ark - avvik) > 0.05) {
        throw new Error(`arket står ${nord.ark}° på rosas 0, men korreksjonen målte ${avvik}°`)
      }

      await åpneDrawer(page)
      await klikkTekst(page, /^EKSPORT$/)
      const les = async () => {
        const last = page.waitForEvent('download', { timeout: 20_000 })
        await klikkTekst(page, /Lagre \.svg/)
        const sti = await (await last).path()
        return sti ? readFileSync(sti, 'utf8') : ''
      }
      const på = await les()
      if (!/data-sann-nord/.test(på)) throw new Error('bryteren står PÅ, men fila er ikke rotert')
      if (!/Sann nord opp/.test(på)) throw new Error('kolofonen mangler «Sann nord opp»')

      await klikkTekst(page, /Eksporter uten nord-korreksjon/)
      const av = await les()
      if (/data-sann-nord/.test(av)) throw new Error('bryteren står AV, men fila er likevel rotert')
      if (!/Kartnord \(UTM 32N\) opp/.test(av)) throw new Error('kolofonen mangler kartnord-raden')

      // Nøytral tilstand: bryteren tilbake på (den er persistert i localStorage
      // og ville fulgt med inn i neste sjekk), og skuffen lukket.
      await klikkTekst(page, /Eksporter med sann nord opp/)
      await lukkDrawer(page)
      return `rosa 0° → ark ${nord.ark}° (korreksjon ${avvik.toFixed(3)}°) → fil rotert på, rett av`
    },
  },
  {
    // KOMPASSNÅLA FØLGER ARKET, OG DEN STÅR DER I HVILE.
    //
    // Fram til v6.5.66 hadde kartet TO nåler — kompass-FAB-en og zoom-søylas
    // nord-knapp — og denne sjekken målte at de pekte samme vei, fordi den ene
    // hadde fortegnet snudd fra v6.5.48 til v6.5.62. FAB-en bærer nå et
    // rewind-ikon, så det finnes bare én nål igjen, og det er ingen andre
    // avlesning å holde den opp mot. Invarianten som blir igjen er den samme
    // feilen målt direkte: nåla skal dreie MED arket, like mye og samme vei.
    // Et snudd fortegn gir dobbelt utslag med motsatt retning.
    //
    // Sjekken måler i tillegg at knappen står der på et ark i HVILE — fram til
    // v6.5.66 sto den bak `v-if="azimut"` og dukket opp først når kartet var
    // dreid. Ingen enhetstest kan se noe av dette: prosjektet enhetstester
    // ikke Vue-komponenter, og begge tallene er riktige tall som ender i hver
    // sin `transform`. Det er bare å måle på skjermen.
    //
    // EGEN KONTEKST MED `hasTouch`, fordi zoom-søyla er berøringens kontroll:
    // standard-konteksten rapporterer `pointer: fine` og får desktop-søyla i
    // stedet, så sjekken ville hoppet stille over det den finnes for.
    navn: 'kompassnåla nede til venstre står i hvile og følger arket',
    domene: 'MapScaleAttribution (kompass)',
    krever: 'ektekart',
    maksMs: 120_000,
    async kjør(page) {
      const ctx = await egenKontekst(page, {
        viewport: { width: 430, height: 900 },
        hasTouch: true,
        isMobile: false,
      })
      const p2 = await ctx.newPage()
      try {
        await p2.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await lukkDrawer(p2)

        const les = () => p2.evaluate(() => {
          const inner = document.querySelector('[data-map-inner]')
          const mm = /rotate\((-?[\d.]+)deg\)/.exec(inner?.style.transform || '')
          const knapp = document.querySelector('button[aria-label^="Vend kartet mot nord"]')
          const nal = knapp?.querySelector('svg')
          const nm = /rotate\((-?[\d.]+)deg\)/.exec(nal?.style.transform || '')
          return {
            ark: mm ? Number(mm[1]) : 0,
            nal: nal ? (nm ? Number(nm[1]) : 0) : null,
            // Nord er RØDT og sør arver tekstfargen (v6.6.2). Sjekken måtte
            // skjerpes: fram til da leste den bare «finnes det en fylt
            // polygon», og det er sant også for en ensfarget rombe — altså en
            // nål uten retning å lese. Nå kreves BEGGE halvdelene, hver med
            // sin fyllfarge.
            rod: !!nal?.querySelector('polygon[fill="#ef4444"]')
              && !!nal?.querySelector('polygon[fill="currentColor"]'),
            synlig: !!knapp?.getBoundingClientRect().width,
          }
        })

        const hvile = await les()
        if (hvile.nal == null) {
          throw new Error('fant ingen kompassknapp på et ark i hvile — '
            + 'står den bak en port igjen?')
        }
        if (!hvile.synlig) throw new Error('kompassknappen finnes i DOM-en, men har ingen boks')
        if (!hvile.rod) throw new Error('kompassnåla mangler den røde nordspissen eller den hvite sørenden')

        // Kartet dreies med syntetiske TouchEvents (usePinchZoom lytter med
        // { passive: false }); vi slipper fingrene igjen, for her måles
        // hviletilstanden etter gesten.
        const dreid = await p2.evaluate(async () => {
          const inner = document.querySelector('[data-map-inner]')
          const el = inner?.parentElement
          if (!el) return { feil: 'fant ikke kart-wrapperen' }
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const R = 120
          const finger = (deg, i) => {
            const a = (deg + i * 180) * Math.PI / 180
            return new Touch({
              identifier: i, target: el,
              clientX: cx + R * Math.cos(a), clientY: cy + R * Math.sin(a),
            })
          }
          const send = (type, deg) => {
            const t = deg == null ? [] : [finger(deg, 0), finger(deg, 1)]
            el.dispatchEvent(new TouchEvent(type, {
              bubbles: true, cancelable: true, touches: t, targetTouches: t, changedTouches: t,
            }))
          }
          const frame = () => new Promise((res) => requestAnimationFrame(res))
          send('touchstart', 0)
          for (let d = 6; d <= 60; d += 6) { send('touchmove', d); await frame(); await frame() }
          send('touchend', null)
          return {}
        })
        if (dreid.feil) throw new Error(dreid.feil)
        await p2.waitForTimeout(700)

        const etter = await les()
        const norm = (v) => ((((v % 360) + 540) % 360) - 180)
        const arkDelta = norm(etter.ark - hvile.ark)
        const nalDelta = norm(etter.nal - hvile.nal)
        // Et snudd fortegn er bare utvetydig når dreiningen er stor nok; en
        // gest som ikke slo inn ville ellers vært grønn med to nuller.
        if (Math.abs(arkDelta) < 20) {
          throw new Error(`to-finger-rotasjonen slo ikke inn (arket dreide ${arkDelta.toFixed(1)}°) — `
            + 'uten en dreining måler denne sjekken ingenting')
        }
        const avvik = Math.abs(norm(nalDelta - arkDelta))
        if (avvik > 1) {
          const speilet = Math.abs(norm(nalDelta + arkDelta)) <= 1
          throw new Error(`arket dreide ${arkDelta.toFixed(1)}°, nåla ${nalDelta.toFixed(1)}° `
            + `(${avvik.toFixed(1)}° fra hverandre)`
            + (speilet ? ' — de er speilvendte, altså et snudd fortegn i nåla' : ''))
        }
        return `nål i hvile ${hvile.nal}°, ark dreid ${arkDelta.toFixed(1)}° → nål ${nalDelta.toFixed(1)}°`
      } finally {
        await ctx.close()
      }
    },
  },
  {
    // ALLE SNARVEIER ER LIKEVERDIGE (v7.3.0), OG POSISJONEN BÆRER TILSTANDEN.
    //
    // Raden hadde en FAST venstregruppe — posisjon + «nord opp» — foran en
    // skillestrek. Den er borte: posisjonen er en vanlig, sorterbar snarvei
    // med plass #1 i standarden, og kompasset har flyttet ned i linjal-boksen.
    // Fire invarianter som ingen enhetstest ser:
    //
    //   1. POSISJONEN ER EN VANLIG SNARVEI — den har `data-snarvei` som de
    //      andre, og ingen `data-nav`-gruppe står igjen i raden.
    //   2. RADEN STÅR PÅ ÉN LINJE ved 360 px, den smaleste telefonen vi bryr
    //      oss om, og posisjonen er synlig innenfor skjermen.
    //   3. POSISJONEN BÆRER EN TILSTAND: på er en AKSENTFLATE med hvitt
    //      innhold, ikke en fargeforskjell i ikonet. Hvitt på flaten må bestå
    //      WCAG 1.4.11 sitt 3:1.
    //   4. KOMPASSET STÅR I LINJAL-BOKSEN, til VENSTRE for målestokken — ikke
    //      i raden.
    //
    // EGEN KONTEKST MED `hasTouch` — kompasset gis bare til berøring, så
    // standard-konteksten ville hoppet stille over punkt 4.
    navn: 'posisjonen er en vanlig snarvei, og nåla står over linjalen',
    domene: 'SnarveiRad',
    maksMs: 120_000,
    async kjør(page) {
      const ctx = await egenKontekst(page, {
        viewport: { width: 360, height: 780 },
        hasTouch: true,
        isMobile: false,
        permissions: ['geolocation'],
        geolocation: { latitude: 59.8412, longitude: 10.4123 },
      })
      const p2 = await ctx.newPage()
      try {
        await p2.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await lukkDrawer(p2)

        const raden = await p2.evaluate(() => {
          const rad = document.querySelector('.snarvei-rad')
          const gps = document.querySelector('[data-snarvei-id="posisjon"]')
          if (!rad || !gps) return { mangler: !rad ? 'raden' : 'posisjons-snarveien' }
          const r = gps.getBoundingClientRect()
          return {
            vanlig: gps.hasAttribute('data-snarvei'),
            navIgjen: rad.querySelectorAll('[data-nav]').length,
            gpsSynlig: r.width > 0 && r.left >= -1 && r.right <= window.innerWidth + 1,
            // Gitteret KLIPPER radene under den første sammenlagt (v7.5.0), så
            // «linjer» er de radene som faktisk er innenfor skuffas boks — ikke
            // alle cellene i DOM-en, som nå står der uansett tilstand.
            linjer: new Set([...rad.querySelectorAll('[data-snarvei]')]
              .filter(e => e.getBoundingClientRect().bottom <= rad.getBoundingClientRect().bottom + 1)
              .map(e => Math.round(e.getBoundingClientRect().top))).size,
          }
        })
        if (raden.mangler) throw new Error(`fant ingen ${raden.mangler} ved 360 px`)
        if (!raden.vanlig) throw new Error('posisjonen er ikke merket som en vanlig snarvei')
        if (raden.navIgjen) {
          throw new Error(`${raden.navIgjen} knapp(er) står igjen i en fast nav-gruppe `
            + '— alle snarveier skal være likeverdige')
        }
        if (!raden.gpsSynlig) throw new Error('posisjonen er klippet av skjermkanten ved 360 px')
        if (raden.linjer !== 1) {
          throw new Error(`snarvei-raden brøt til ${raden.linjer} linjer ved 360 px `
            + '— den sammenlagte raden skal stå på én')
        }

        // KOMPASSET ER FRISTILT (v7.3.2): egen rund, halvgjennomsiktig skive
        // utenfor linjal-boksen. Fra v7.6.0 står den på RADEN OVER linjalen og
        // deler VENSTREKANT med den, ikke bunnlinje: begge to skalerer nå med
        // tekststørrelsen, og side om side ville de spist bredden av hverandre
        // og dyttet linjalen inn mot midten av kartet. Egenskapene er lette å
        // miste i en opprydning, og ingen av dem gir en JS-feil når de
        // forsvinner. Kreditten måles samtidig: den skal IKKE skalere.
        const kompass = await p2.evaluate(() => {
          const knapp = document.querySelector('button[aria-label^="Vend kartet mot nord"]')
          if (!knapp) return { mangler: true }
          // Linjal-boksen er den som bærer OSM-kreditten.
          const kreditt = [...document.querySelectorAll('div')]
            .find((e) => e.children.length === 0 && /OpenStreetMap/.test(e.textContent || ''))
          const boks = kreditt?.closest('.rounded-lg')
          const svgLinjal = boks?.querySelector('svg')
          const kr = knapp.getBoundingClientRect()
          const br = boks?.getBoundingClientRect()
          const st = getComputedStyle(knapp)
          return {
            iRaden: !!knapp.closest('.snarvei-rad'),
            iBoksen: boks ? boks.contains(knapp) : null,
            // Linjalen skal ligge HELT til venstre, altså med samme venstrekant
            // som nåla over den. Målestokk-SVG-en er der bare for å bekrefte at
            // boksen vi måler faktisk er linjalen.
            harStrek: !!svgLinjal,
            overLinjalen: br ? Math.round(br.top - kr.bottom) : null,
            venstreAvvik: br ? Math.round(Math.abs(br.left - kr.left)) : null,
            nede: kr.top > window.innerHeight / 2,
            bredde: Math.round(kr.width),
            rund: parseFloat(st.borderRadius) >= kr.width / 2 - 1,
            // rgba(...) med alfa < 1 — skiva skal slippe kartet gjennom.
            gjennomsiktig: /rgba\(.*,\s*0?\.\d+\)$/.test(st.backgroundColor),
            // Tallet skalerer med tekststørrelsen, kreditten ikke. `zoom`
            // rapporteres som «1» eller «normal» avhengig av motor.
            kredittZoom: kreditt ? getComputedStyle(kreditt).zoom : null,
          }
        })
        if (kompass.mangler) throw new Error('fant ingen kompassknapp på en berøringsflate')
        if (kompass.iRaden) throw new Error('kompasset står fortsatt i snarvei-raden')
        if (kompass.iBoksen === null) throw new Error('fant ingen linjal-boks å måle mot')
        if (kompass.iBoksen) throw new Error('kompasset ligger inne i linjal-boksen igjen')
        if (!kompass.nede) throw new Error('kompasset står ikke i nedre halvdel av skjermen')
        if (!kompass.harStrek) throw new Error('fant ingen målestokk-strek i linjal-boksen')
        if (!(kompass.overLinjalen > 0)) {
          throw new Error(`nåla står ${kompass.overLinjalen} px over linjal-boksen `
            + '— den skal stå på raden OVER, med luft imellom (v7.6.0)')
        }
        if (kompass.venstreAvvik > 2) {
          throw new Error(`nåla og linjalen står ${kompass.venstreAvvik} px fra hverandre `
            + 'til venstre — de skal dele venstrekant')
        }
        if (!['1', 'normal'].includes(kompass.kredittZoom)) {
          throw new Error(`ODbL-kreditten er zoomet (${kompass.kredittZoom}) — `
            + 'meterangivelsen skalerer, kreditten skal stå fast')
        }
        if (!kompass.rund) throw new Error('kompass-skiva er ikke sirkelformet')
        if (!kompass.gjennomsiktig) {
          throw new Error('kompass-skiva er ugjennomsiktig — den skal slippe kartet svakt gjennom')
        }
        if (kompass.bredde < 44) {
          throw new Error(`kompassknappen er ${kompass.bredde} px bred — en knapp som står `
            + 'alene på et kart skal være minst 44')
        }

        const les = () => p2.evaluate(() => {
          const gps = document.querySelector('[data-snarvei-id="posisjon"]')
          if (!gps || !gps.getBoundingClientRect().width) return null
          const ikon = gps.querySelector('svg')
          return {
            flate: getComputedStyle(gps).backgroundColor,
            blekk: ikon ? getComputedStyle(ikon).stroke : null,
            trykt: gps.getAttribute('aria-pressed'),
          }
        })
        const av = await les()
        if (!av) throw new Error('fant ingen synlig posisjons-knapp')
        if (av.trykt !== 'false') throw new Error(`posisjonen sier aria-pressed="${av.trykt}" i hvile`)

        await p2.locator('[data-snarvei-id="posisjon"]').click()
        await p2.waitForTimeout(600)
        const pa = await les()
        if (pa.trykt !== 'true') throw new Error('et trykk på posisjonen slo den ikke på')
        if (pa.flate === av.flate) {
          throw new Error(`av og på har samme flate (${pa.flate}) — tilstanden bæres av `
            + 'aksentflaten, ikke av ikonet')
        }

        const kontrast = (a, b) => {
          const rel = (farge) => {
            const m = /(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(farge || '')
            if (!m) return null
            const k = [+m[1], +m[2], +m[3]].map((v) => {
              const c = v / 255
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]
          }
          const [x, y] = [rel(a), rel(b)]
          if (x == null || y == null) return null
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
        }
        const k = kontrast(pa.blekk, pa.flate)
        if (k != null && k < 3) {
          throw new Error(`ikonet gir ${k.toFixed(2)}:1 mot den påslåtte flaten `
            + '— WCAG 1.4.11 krever 3:1 for grafiske objekter')
        }

        // Nøytral tilstand: posisjonen skrur seg ikke av selv.
        await p2.locator('[data-snarvei-id="posisjon"]').click()
        await p2.waitForTimeout(300)
        return `én linje ved 360 px, nåla ${kompass.bredde} px over linjalen `
          + `(${kompass.overLinjalen} px luft, venstreavvik ${kompass.venstreAvvik} px), `
          + `av→på bytter flate (${pa.flate}), ikon ${k ? k.toFixed(1) : '?'}:1`
      } finally {
        await ctx.close()
      }
    },
  },
  {
    // LENDE-FAB-EN ER TILBAKE NEDE TIL HØYRE (v7.2.0), OG ET TAPP ÅPNER
    // CHATTEN.
    //
    // Chatten var en snarvei i raden i v7.0.0–7.1.0. Den er nå den samme
    // FAB-en som i ruteplanleggeren: samme anker, samme hjørne —
    // og uten knotter rundt seg gjør `anchorPress.onTap` rett `emit('chat')`,
    // altså ingen lang-trykk-ring å vente ut. To ting kan brekke stille: at
    // FAB-en ikke rendres i det hele tatt (den er portet på et AI-token), og
    // at tappet åpner knotte-klyngen i stedet for chatten.
    //
    // EGEN KONTEKST med tokenet lagt inn FØR appen monterer — `hasAiToken()`
    // leses én gang i oppsettet, så en localStorage-skriving etterpå kommer
    // for sent.
    navn: 'Lende-FAB-en står nede til høyre og åpner chatten med ett tapp',
    domene: 'MapView (FabCluster)',
    maksMs: 120_000,
    async kjør(page) {
      const ctx = await egenKontekst(page, {
        viewport: { width: 430, height: 900 },
        hasTouch: true,
        isMobile: false,
      })
      await ctx.addInitScript(() => {
        try { localStorage.setItem('lende-ai-token', 'royk-token') } catch { /* tom */ }
      })
      const p2 = await ctx.newPage()
      try {
        await p2.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await lukkDrawer(p2)

        const fab = p2.locator('button[aria-label="Spør Lende"]')
        if (!(await fab.count())) {
          throw new Error('fant ingen Lende-FAB — rendres FabCluster med tokenet på plass?')
        }
        const boks = await fab.boundingBox()
        const vp = p2.viewportSize()
        if (!boks) throw new Error('Lende-FAB-en har ingen boks')
        if (boks.x + boks.width / 2 < vp.width / 2 || boks.y + boks.height / 2 < vp.height / 2) {
          throw new Error(`Lende-FAB-en står på ${Math.round(boks.x)},${Math.round(boks.y)} `
            + '— den hører hjemme nede til høyre, som i ruteplanleggeren')
        }
        // IKONET ER EN SNAKKEBOBLE (v7.6.0), ikke Lende-logoen. Uten knotter
        // ER knappen chatten, og logoen sa «hjem». Den ene måten å se det på i
        // DOM-en er at `img`-en er borte og en SVG står i stedet — begge ser ut
        // som «et ikon i en rund knapp» for alt annet.
        if (await fab.locator('img').count()) {
          throw new Error('FAB-en viser Lende-logoen igjen — den rene chat-inngangen '
            + 'skal ha en snakkeboble')
        }
        if (!(await fab.locator('svg').count())) {
          throw new Error('FAB-en har verken logo eller ikon')
        }

        // OG BOBLA MÅ VÆRE MIDTSTILT I KNAPPEN (v7.7.3). Knappen midtstiller
        // ikon-BOKSEN (`grid place-items-center`), ikke tegningen inni den — så
        // en glyf med tyngdepunktet utenfor viewBoxens midte står skjevt uansett
        // hvor riktig knappen er plassert. Den gamle snakkebobla lå 2,24 px for
        // lavt (hale ned mot venstre), og FAB-en zoomer hele knappen, så på
        // 200 % tekst var det 4,5 px. Måles som blekkets union mot knappens
        // boks; 1,5 px slingring for avrunding og strek-asymmetri.
        const skjev = await fab.evaluate((knapp) => {
          const svg = knapp.querySelector('svg')
          const deler = [...svg.children]
          if (!deler.length) return null
          const r = deler.map((e) => e.getBoundingClientRect())
          const boks = {
            left: Math.min(...r.map((b) => b.left)),
            right: Math.max(...r.map((b) => b.right)),
            top: Math.min(...r.map((b) => b.top)),
            bottom: Math.max(...r.map((b) => b.bottom)),
          }
          const k = knapp.getBoundingClientRect()
          return {
            dx: (boks.left + boks.right) / 2 - (k.left + k.right) / 2,
            dy: (boks.top + boks.bottom) / 2 - (k.top + k.bottom) / 2,
          }
        })
        if (!skjev) throw new Error('snakkebobla har ingen tegning å måle')
        if (Math.abs(skjev.dx) > 1.5 || Math.abs(skjev.dy) > 1.5) {
          throw new Error(`snakkebobla står ${skjev.dx.toFixed(1)},${skjev.dy.toFixed(1)} px `
            + 'fra knappens midte — glyfen må være symmetrisk om 12/12 i viewBoxen')
        }

        // ETT TAPP MED FINGEREN, ikke et hold og ikke musa. FabCluster er
        // drevet av pointerdown/-up via useLongPress, så `el.click()` gjør
        // ingenting. Og TOUCH er ikke et strengere mus-trykk: den sender en
        // kompatibilitets-`click` ~25 ms etter `touchend`, som fram til v7.3.3
        // traff bakteppet modalen nettopp la under fingeren og lukket chatten
        // igjen. Musa gjør ikke det — derfor sto denne sjekken grønn mens
        // chatten i praksis bare kunne åpnes med lang-trykk på telefon.
        const midtX = boks.x + boks.width / 2
        const midtY = boks.y + boks.height / 2
        await p2.touchscreen.tap(midtX, midtY)
        const seChat = () => p2.evaluate(() =>
          [...document.querySelectorAll('h1, h2, h3, [role="dialog"]')]
            .some((e) => e.offsetParent !== null && /Lende-chat/.test(e.textContent || '')))
        await p2.waitForTimeout(120)
        if (!(await seChat())) throw new Error('ett tapp på FAB-en åpnet ikke chatten')
        // ETTER spøkelsesklikket, ikke før: åpner og lukker den i samme
        // øyeblikk, er en måling på 120 ms grønn og brukeren uten chat.
        await p2.waitForTimeout(700)
        if (!(await seChat())) {
          throw new Error('chatten åpnet, men lukket seg igjen — spøkelsesklikket '
            + 'fra touchend traff bakteppet (AppModal.bakteppeKlikk)')
        }
        return `FAB nede til høyre (${Math.round(boks.x)},${Math.round(boks.y)}), `
          + `snakkebobla ${skjev.dx.toFixed(1)},${skjev.dy.toFixed(1)} px fra midten, `
          + 'ett finger-tapp åpnet chatten og den ble stående'
      } finally {
        await ctx.close()
      }
    },
  },
  {
    // KOMPASSET OG LENDE-FAB-EN DELER BUNNLINJE (v7.7.6).
    //
    // De to flytende elementene i hver sin nedre kant hadde hver sin regel:
    // FAB-en gikk gjennom useFloatAboveSheets og dokket over et minimert ark,
    // mens linjal-boksen med kompass-nåla sto på en FAST bunn og ble liggende
    // halvt bak arkets peek-kant. To knapper i samme kant som svarer ulikt på
    // det samme arket leses som en feil i den ene. Nå mates begge av ÉN
    // `useFloatAboveSheets`.
    //
    // MÅLES VED 200 % OGSÅ, og det er der den andre halvdelen av feilen satt:
    // `zoom` lå på FAB-ens PLASSERTE boks, og zoom skalerer et elements egne
    // offsets — så den dokkede verdien (`peek + 12`) ble dobbelt så høy og
    // FAB-en fløt hundre piksler over arket. Zoomen bor nå på en indre boks
    // forankret i hjørnet, så plasseringen er i ekte skjermpiksler.
    //
    // Tre tilstander, og alle tre er i bestillingen: uten ark står begge
    // nederst, over et MINIMERT ark står begge like høyt over peek-kanten, og
    // med arket dratt opp er begge borte.
    navn: 'kompasset og Lende-FAB-en står på samme bunnlinje over et minimert ark',
    domene: 'MapView (bunnlinja) + MapScaleAttribution + FabCluster',
    maksMs: 150_000,
    async kjør(page) {
      const resultat = []
      for (const skala of [1, 2]) {
        const ctx = await egenKontekst(page, {
          viewport: { width: 430, height: 900 },
          hasTouch: true,
        })
        await ctx.addInitScript((s) => {
          try {
            localStorage.setItem('lende-ai-token', 'royk-token')
            localStorage.setItem('lende-ui-text-scale', String(s))
          } catch { /* tom */ }
        }, skala)
        const p2 = await ctx.newPage()
        try {
          await p2.goto(`${BASE}/kart/vardasen`,
            { waitUntil: 'domcontentloaded', timeout: 60_000 })
          await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
            null, { timeout: 30_000 })
          await lukkDrawer(p2)

          // Bunnen måles fra VIEWPORTENS underkant, ikke fra elementets top:
          // det er avstanden ned til skjermkanten (eller opp fra arket) de to
          // skal dele, og høydene deres er ulike.
          const les = () => p2.evaluate(() => {
            const vh = innerHeight
            const fab = document.querySelector('button[aria-label="Spør Lende"]')
            const sk = document.querySelector('[data-osm-kreditt]')?.closest('div.absolute')
            const ark = [...document.querySelectorAll('.drawer-shell')]
              .filter((e) => e.offsetParent)
            const bunn = (e) => (e ? Math.round(vh - e.getBoundingClientRect().bottom) : null)
            return {
              fab: bunn(fab),
              linjal: sk ? Math.round(vh - sk.getBoundingClientRect().bottom) : null,
              arkHoyde: ark.length
                ? Math.round(vh - Math.max(...ark.map((a) => a.getBoundingClientRect().top)))
                : 0,
            }
          })
          const like = (m, hva) => {
            if (m.fab === null || m.linjal === null) {
              throw new Error(`ved ${skala * 100} %, ${hva}: `
                + `${m.fab === null ? 'FAB-en' : 'linjalen'} er borte — begge skal stå`)
            }
            if (Math.abs(m.fab - m.linjal) > 2) {
              throw new Error(`ved ${skala * 100} %, ${hva}: FAB-en står ${m.fab} px `
                + `over skjermkanten og linjalen ${m.linjal} px — de skal dele bunnlinje`)
            }
          }

          const fritt = await les()
          like(fritt, 'uten ark')

          // Punkt-arket åpner MIDTSTORT av et hold i kartet; peek nås med et
          // drag ned i håndtaket. Begge tilstandene er i bestillingen.
          const kart = await p2.locator('svg.isom-map').boundingBox()
          await p2.mouse.move(kart.x + kart.width / 2, kart.y + kart.height * 0.55)
          await p2.mouse.down()
          await p2.waitForTimeout(800)
          await p2.mouse.up()
          await p2.waitForTimeout(1200)
          const midt = await les()
          if (!midt.arkHoyde) throw new Error('holdet åpnet ikke punkt-arket')
          if (midt.fab !== null || midt.linjal !== null) {
            throw new Error(`ved ${skala * 100} % står `
              + `${midt.fab !== null ? 'FAB-en' : 'linjalen'} igjen under et `
              + 'oppslått ark — begge skal være borte')
          }

          const ark = await p2.locator('.drawer-shell').first().boundingBox()
          await p2.mouse.move(ark.x + ark.width / 2, ark.y + 10)
          await p2.mouse.down()
          await p2.mouse.move(ark.x + ark.width / 2, ark.y + 330, { steps: 14 })
          await p2.mouse.up()
          await p2.waitForTimeout(700)
          const peek = await les()
          if (!(peek.arkHoyde > 0 && peek.arkHoyde < midt.arkHoyde)) {
            throw new Error(`arket ble ikke minimert (${peek.arkHoyde} px)`)
          }
          like(peek, 'over et minimert ark')
          if (!(peek.fab > peek.arkHoyde)) {
            throw new Error(`ved ${skala * 100} % ligger begge ${peek.fab} px over kanten, `
              + `men arkets peek er ${peek.arkHoyde} px — de står bak arket`)
          }
          // OG IKKE SVEVENDE HØYT OVER DET: zoom-fella ga dobbelt avstand.
          if (peek.fab > peek.arkHoyde + 40) {
            throw new Error(`ved ${skala * 100} % står de ${peek.fab - peek.arkHoyde} px `
              + 'over arkets peek-kant — skalerer zoomen plasseringen igjen?')
          }
          resultat.push(`${skala * 100} %: ${fritt.fab} px fritt, `
            + `${peek.fab} px over en peek på ${peek.arkHoyde} px`)
        } finally {
          await ctx.close()
        }
      }
      return resultat.join('; ')
    },
  },
  {
    navn: 'stedsnavn står vannrett MENS kartet roteres',
    domene: 'useSymbolRenderers',
    krever: 'ektekart',
    async kjør(page) {
      // Fram til v6.5.25 hoppet counter-rotasjonen over hele gesten: navnene lå
      // på skrå så lenge fingrene var nede og snappet opp når man slapp. Denne
      // sjekken måler MIDT I GESTEN, som er det eneste øyeblikket forskjellen
      // finnes — en sjekk som leser av etterpå ville vært grønn også før.
      //
      // Gesten er syntetiske TouchEvents: FabCluster-lærdommen gjelder her også,
      // og usePinchZoom lytter på touchstart/touchmove med { passive: false }.
      // To fingre 180° fra hverandre roteres i steg på 6° — over dødsonen på
      // 1,5° som beskytter mot skjelving.
      await lukkDrawer(page)
      const m = await page.evaluate(async () => {
        const inner = document.querySelector('[data-map-inner]')
        const el = inner?.parentElement
        if (!el) return { feil: 'fant ikke kart-wrapperen' }
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const R = 120
        const finger = (deg, i) => {
          const a = (deg + i * 180) * Math.PI / 180
          return new Touch({
            identifier: i, target: el,
            clientX: cx + R * Math.cos(a), clientY: cy + R * Math.sin(a),
          })
        }
        const send = (type, deg) => {
          const t = deg == null ? [] : [finger(deg, 0), finger(deg, 1)]
          el.dispatchEvent(new TouchEvent(type, {
            bubbles: true, cancelable: true, touches: t, targetTouches: t, changedTouches: t,
          }))
        }
        const frame = () => new Promise((res) => requestAnimationFrame(res))
        const kartRot = () => {
          const mm = /rotate\((-?[\d.]+)deg\)/.exec(inner.style.transform || '')
          return mm ? Number(mm[1]) : 0
        }
        // Bare det som faktisk tegnes: culling og navne-LOD skjuler resten, og
        // den live passeringen hopper over dem med vilje.
        const synligeTekster = () => [...document.querySelectorAll('svg.isom-map text')]
          .filter((t) => !t.closest('defs, .vp-cull, .name-lod-off')
                      && t.dataset.label !== 'veinummer'
                      && t.closest('[data-layer]')?.style.display !== 'none')
        const tekstRot = (t) => {
          const mm = /rotate\((-?[\d.]+)/.exec(t.getAttribute('transform') || '')
          return mm ? Number(mm[1]) : 0
        }

        send('touchstart', 0)
        for (let d = 6; d <= 36; d += 6) {
          send('touchmove', d)
          await frame(); await frame()
        }
        // Måling MENS fingrene fortsatt er nede.
        const rotUnder = kartRot()
        const tekster = synligeTekster()
        const følger = tekster.filter((t) => Math.abs(tekstRot(t) + rotUnder) < 1).length
        send('touchend', null)
        await new Promise((res) => setTimeout(res, 500))
        const rotEtter = kartRot()
        const etter = synligeTekster()
        const følgerEtter = etter.filter((t) => Math.abs(tekstRot(t) + rotEtter) < 1).length
        return {
          rotUnder, rotEtter,
          antall: tekster.length, følger,
          antallEtter: etter.length, følgerEtter,
        }
      })
      if (m.feil) throw new Error(m.feil)
      if (Math.abs(m.rotUnder) < 20) throw new Error(`to-finger-rotasjonen slo ikke inn (kart ${m.rotUnder}°)`)
      if (!m.antall) throw new Error('ingen synlige labels å måle på')
      // Ikke «alle»: et navn kan bli cullet bort mellom snapshot og måling, og
      // sjekken skal fange at counter-rotasjonen er BORTE, ikke jage én label.
      if (m.følger < m.antall * 0.9) {
        throw new Error(`bare ${m.følger}/${m.antall} labels stod vannrett MIDT I gesten `
                      + `(kart ${m.rotUnder.toFixed(1)}°) — myk rotasjon virker ikke`)
      }
      // Og den autoritative passeringen ved gest-slutt tar med det snapshotet
      // hoppet over.
      if (m.følgerEtter < m.antallEtter) {
        throw new Error(`${m.antallEtter - m.følgerEtter}/${m.antallEtter} labels stod skjevt ETTER gesten`)
      }
      // Etterlat appen i nøytral tilstand: neste sjekk skal ikke arve et
      // rotert kart (SJEKKER-kontrakten i denne fila).
      const nullstilt = await page.evaluate(() => {
        const sl = document.querySelector('input[aria-label*="Roter kartet"]')
        if (!sl) return false
        sl.value = '0'; sl.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })
      if (!nullstilt) throw new Error('fant ingen rotasjons-slider å nullstille med')
      await page.waitForTimeout(600)
      return `${m.følger}/${m.antall} vannrett under gest (${m.rotUnder.toFixed(0)}°), `
           + `${m.følgerEtter}/${m.antallEtter} etter`
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
      // Dash-en måles COMPUTED og ikke som inline stil (v6.5.72): fra da av er
      // det en CSS-regel som gjør strekene solide, og en sjekk som leser
      // `style.strokeDasharray` ville stått grønn på en regel som ikke virket.
      // Vi finner først en path som FAKTISK er stiplet i hvile — en heltrukken
      // strek computer også til «none», og ville gjort sjekken meningsløs.
      const finnStiplet = () => page.evaluate(() => {
        const svg = document.querySelector('svg.isom-map')
        if (!svg) return null
        const paths = svg.querySelectorAll('[data-layer] path')
        for (let i = 0; i < paths.length; i++) {
          const d = getComputedStyle(paths[i]).strokeDasharray
          if (d && d !== 'none') {
            paths[i].setAttribute('data-royk-dash', '1')
            return d
          }
        }
        return null
      })
      const iHvile = await finnStiplet()
      if (!iHvile) throw new Error('fant ingen stiplet strek å måle dash-overstyringen på')
      const les = () => page.evaluate(() => {
        const svg = document.querySelector('svg.isom-map')
        const p = svg?.querySelector('[data-royk-dash]')
        return {
          zoomer: !!svg?.classList.contains('is-zooming'),
          dash: p ? getComputedStyle(p).strokeDasharray : null,
        }
      })
      await pekMidtPaaKartet(page)
      // Midt i gesten: hjul-zoom holder isGesturing i 200 ms etter siste tikk.
      await page.mouse.wheel(0, -200)
      await page.waitForTimeout(60)
      const under = await les()
      if (!under.zoomer) throw new Error('.is-zooming ble ikke satt under gest')
      if (under.dash !== 'none') throw new Error(`stiplede streker ble ikke gjort solide under gest (${under.dash})`)
      // Etter gesten (200 ms wheel-end + 120 ms utsatt gjenoppretting + slakk).
      await page.waitForTimeout(1200)
      const etter = await les()
      if (etter.zoomer) throw new Error('.is-zooming ble ikke fjernet etter gest')
      if (etter.dash === 'none') throw new Error('dash-overstyringen ble ikke ryddet etter gest')
      return `is-zooming + solid dash under gest (${iHvile} → none), ryddet etterpå`
    },
  },
  {
    navn: '3D-visningen åpner',
    domene: 'use3dEntry',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkSnarvei(page, 'tre-d')
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
      await klikkSnarvei(page, 'tre-d')
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

      // VÆRRADEN SKAL IKKE RULLE (v6.3.9). Den var en rulleflate med åtte faste
      // timer, og på en 430 px-telefon fikk seks plass — to timer lå gjemt bak en
      // gest ingenting antydet. Nå fyller raden bredden og viser bare det som
      // passer. INVARIANTEN er derfor målbar: ingenting stikker utenfor.
      //
      // scrollWidth > clientWidth er nettopp «det finnes skjult innhold til
      // siden». Sjekken er streng med vilje: én piksel for mye betyr at en time
      // er delvis skjult, og det var hele feilen.
      const radOverflyt = await evalMedTak(page, () => {
        const rad = [...document.querySelectorAll('div')].find((d) =>
          /MET\s*Norway/.test(d.textContent) && d.querySelector('[data-time]'))
        if (!rad) return null
        return {
          skjult: rad.scrollWidth - rad.clientWidth,
          timer: rad.querySelectorAll('[data-time]').length,
        }
      })
      if (radOverflyt && radOverflyt.skjult > 1) {
        throw new Error(`værraden har ${radOverflyt.skjult} px skjult innhold til `
          + `siden (${radOverflyt.timer} timer) — den skal fylle bredden, ikke rulle`)
      }
      const radTimer = radOverflyt ? radOverflyt.timer : 0

      // OG DEN SKAL TÅLE STOR SYSTEMTEKST (v6.3.12). Dette er tilfellet som
      // faktisk brakk: målingen kjørte aldri (raden finnes ikke ved montering,
      // for varselet er ikke hentet enda), så antallet sto på startverdien og
      // X-en ble klippet bort av overflow-hidden. Med rot-font 16 px passet
      // startverdien tilfeldigvis, så sjekken over var grønn uten å måle noe.
      // 24 px er 150 % tekstskalering, som er valget i hovedmenyen.
      const stortTekstOverflyt = await evalMedTak(page, async () => {
        const rot = document.documentElement
        const for0 = rot.style.fontSize
        rot.style.fontSize = '24px'
        await new Promise((r) => setTimeout(r, 700))
        const rad = [...document.querySelectorAll('div')].find((d) =>
          /MET\s*Norway/.test(d.textContent) && d.querySelector('[data-time]'))
        const svar = rad
          ? { skjult: rad.scrollWidth - rad.clientWidth, timer: rad.querySelectorAll('[data-time]').length }
          : null
        // TILBAKE TIL NØYTRAL TILSTAND før neste sjekk — måle-modus-fella fra
        // v5.8.1 gjelder rot-fontstørrelsen like mye som en åpen fane.
        rot.style.fontSize = for0
        await new Promise((r) => setTimeout(r, 500))
        return svar
      })
      if (stortTekstOverflyt && stortTekstOverflyt.skjult > 1) {
        throw new Error(`med 150 % tekst har værraden ${stortTekstOverflyt.skjult} px `
          + `skjult innhold (${stortTekstOverflyt.timer} timer) — X-en blir klippet bort`)
      }

      // OG DEN SKAL TÅLE Å STÅ I ET `zoom`-LAG (v6.5.51). Raden følger nå
      // tekstvalget fra hovedmenyen, og det er `zoom` på innpakningen som gjør
      // det. Det er en felle for målingen: `getBoundingClientRect()` gir
      // VISUELLE piksler (ganget med zoomen) mens `clientWidth` gir lokale, så
      // en kolonne målt med rammen ble dobbelt så bred som den ledige plassen
      // var talt i — og raden falt til gulvet på to timer uansett skjermbredde.
      // Vi setter zoomen direkte på innpakningen framfor å gå veien om
      // hovedmenyen: verdien er den samme, og en tur ut av 3D og inn igjen ville
      // kostet en ny 4096²-tekstur.
      const zoomOverflyt = await evalMedTak(page, async () => {
        const rad = [...document.querySelectorAll('div')].find((d) =>
          /MET\s*Norway/.test(d.textContent) && d.querySelector('[data-time]'))
        if (!rad) return null
        const mor = rad.parentElement
        const for0 = mor.style.zoom
        mor.style.zoom = '2'
        await new Promise((r) => setTimeout(r, 900))
        const svar = {
          skjult: rad.scrollWidth - rad.clientWidth,
          timer: rad.querySelectorAll('[data-time]').length,
          // Zoomen MÅ ligge på en full-bredde forelder: er den flyttet til en
          // `justify-center`-boks som krymper til innholdet, måler raden en
          // forelder som følger sitt eget resultat.
          morBredde: mor.clientWidth,
        }
        // NØYTRAL TILSTAND før neste sjekk (v5.8.1-fella).
        mor.style.zoom = for0
        await new Promise((r) => setTimeout(r, 700))
        return svar
      })
      if (zoomOverflyt && zoomOverflyt.skjult > 1) {
        throw new Error(`med 200 % tekst (zoom) har værraden ${zoomOverflyt.skjult} px `
          + `skjult innhold (${zoomOverflyt.timer} timer)`)
      }
      if (zoomOverflyt && zoomOverflyt.timer < 2) {
        throw new Error('værraden falt under gulvet på to timer i zoom-laget — '
          + 'målingen blander visuelle og lokale piksler')
      }

      // X-EN I VÆRRADEN (v6.3.8) tar bort både raden og værhimmelen, og gir dem
      // tilbake ved et bytte av lysmodus. Den erstatter det tredje steget
      // sol/måne-knappen hadde fram til v6.1.0.
      //
      // Vi må stå i DAGMODUS for at raden skal finnes; syklusen over endte der vi
      // startet, så det er ikke gitt. Leses av knappen framfor å antas.
      if (await lesSolMaaneSteg(page) === 'Bytt til dag') {
        await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }
      const radFinnes = () => evalMedTak(page, () =>
        /Henter værvarsel|Værvarsel ikke tilgjengelig|MET\s*Norway/i.test(document.body.innerText))
      const lukkVaer = page.locator('button[aria-label="Skjul værvarselet og værhimmelen"]')
      let vaerXUtfall = 'X-en fantes ikke (varselet kom aldri fram)'
      if (await lukkVaer.count()) {
        if (!await radFinnes()) throw new Error('X-en finnes, men værraden gjør det ikke')
        await lukkVaer.click({ timeout: 5000 })
        await page.waitForTimeout(700)
        if (await radFinnes()) throw new Error('trykk på X-en fjernet ikke værraden')
        // OG DEN SKAL KOMME TILBAKE av et bytte til natt og tilbake. Uten denne
        // halvparten kunne X-en vært en enveisbillett ut av været for hele økta.
        await page.locator('button[aria-label="Bytt til natt"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
        await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1800)
        if (!await radFinnes()) {
          throw new Error('værraden kom ikke tilbake etter en runde om natta — '
            + 'da er X-en en enveisbillett')
        }
        vaerXUtfall = 'X-en tok bort raden, natt-runden ga den tilbake'
      }

      // To trykk er en hel runde, så vi står der vi startet. En sjekk skal ikke
      // etterlate en 3D-visning i nattmodus for den neste.
      const x = page.locator('button[aria-label="Lukk 3D-visning"]')
      await x.click({ timeout: 5000 })
      await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
      return `syklus lukket: ${sett.join(' → ')}, værrad med ${radTimer} timer `
        + `uten skjult innhold; ${vaerXUtfall}`
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
      await klikkSnarvei(page, 'tre-d')
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

      // STJERNEKIKKER (v6.5.44): veien fra en tom dagshimmel til natthimmelen.
      // Den finnes BARE mens blikket står oppe, så den kan ikke prøves før vi
      // har løftet det igjen — og «Oversikt» over tok det nettopp ned, som er
      // den negative halvdelen av sjekken. Den ligger SIST med vilje: et trykk
      // åpner nattmodus, som stiller kameraet om (apneStjernehimmel), og et
      // bytte midt i sjekken ville flyttet grunnen under målingene over.
      const stjernekikker = page.locator('button[aria-label="Stjernekikker — åpne natthimmelen"]')
      if (await stjernekikker.count()) {
        throw new Error('Stjernekikker-knappen står i kartbildet — den skal bare vises med blikket i himmelen')
      }
      await dra(1)
      if (!await stjernekikker.count()) {
        throw new Error('Stjernekikker-knappen kom ikke fram da blikket sto i himmelen')
      }
      await stjernekikker.click({ timeout: 5000 })
      await page.waitForTimeout(1800)
      if (await lesSolMaaneSteg(page) !== 'Bytt til dag') {
        throw new Error('trykk på Stjernekikker åpnet ikke nattmodus')
      }
      // Tilbake til dag, så modus-gjenopprettingen under regner på det den tror.
      await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
      await page.waitForTimeout(1800)

      // Tilbake til modusen vi arvet, så neste sjekk står i samme bilde.
      if (startSteg === 'Bytt til dag' && await lesSolMaaneSteg(page) === 'Bytt til natt') {
        await page.locator('button[aria-label="Bytt til natt"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }
      await lukk()
      return 'vippet opp i himmelen, Oversikt tok blikket ned igjen, Stjernekikker åpnet natta'
    },
  },
  {
    navn: 'Info og POI-filter åpner som nedtrekk og flytter ikke hverandre',
    domene: 'Tour3dInfoPanel + Tour3dPinPanel',
    // Kunne i prinsippet kjørt uten DEM, men uten terreng er 3D-overlegget en
    // «Ingen høydedata»-melding og ingen av pillene finnes. Samme port som de
    // andre 3D-sjekkene.
    krever: 'ektekart',
    async kjør(page) {
      await lukkDrawer(page)
      await klikkSnarvei(page, 'tre-d')
      const klar = await page.waitForFunction(() => {
        const c = document.querySelector('canvas')
        if (c && c.width > 0) return 'canvas'
        if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
        return false
      }, null, { timeout: 60_000 }).then((h) => h.jsonValue())
      await page.waitForFunction(
        () => !/Skjerper kartbildet/i.test(document.body.innerText),
        null, { timeout: 45_000 },
      ).catch(() => { /* meldingen kan ha kommet og gått */ })
      await page.waitForTimeout(800)

      const lukk = async () => {
        await page.locator('button[aria-label="Lukk 3D-visning"]').click({ timeout: 5000 })
        await page.waitForFunction(() => !document.querySelector('canvas'), null, { timeout: 8000 })
      }
      if (klar === 'ingen-dem') {
        await lukk()
        return 'ingen-dem-melding — pillene finnes ikke uten terreng'
      }

      // DAGMODUS: både Info-pilla og POI-filteret er skjult i nattmodus, og 3D
      // åpner i den modusen himmelen faktisk er i. Modusen gis tilbake til slutt.
      const startSteg = await lesSolMaaneSteg(page)
      if (startSteg === 'Bytt til dag') {
        await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }

      const infoPille = page.locator('button[aria-label="Vis hjelp for 3D-visningen"]')
      if (!await infoPille.count()) throw new Error('Info-pilla finnes ikke i dagmodus')

      // POI-pilla er kartets egen: finnes den ikke, er det ingen kollisjon å
      // måle, og det er ikke en feil i denne koden. Den halvdelen rapporteres
      // framfor å feile — men header-toggelen under prøves uansett.
      const poi = page.locator('button[aria-label^="Vis filter for"]')
      const boksFor = await poi.count() ? await poi.boundingBox() : null

      await infoPille.click({ timeout: 5000 })
      await page.waitForTimeout(500)

      const kropp = page.locator('#tour3d-info-kropp')
      if (!await kropp.count()) throw new Error('trykk på Info-headeren åpnet ikke hjelpekroppen')

      // HEADEREN BLIR STÅENDE, og den er nå den eneste veien ut. Fram til
      // v6.5.44 byttet pilla seg ut med boksen, og lukkeknappen fulgte boksen
      // ut av skjermen når den vokste.
      const lukkPille = page.locator('button[aria-label="Skjul hjelp for 3D-visningen"]')
      if (!await lukkPille.count()) {
        throw new Error('Info-headeren forsvant da kroppen åpnet seg — den skal bli stående og lukke igjen')
      }

      // KJERNEN: en åpen hjelp skal ikke flytte POI-filteret. Boksen er den
      // eneste observasjonen som fanger det — markup-en er lik i begge
      // tilfeller, det er LAYOUTEN som brakk.
      let poiUtfall = 'POI-filteret finnes ikke i dette kartet'
      if (boksFor) {
        const boksEtter = await poi.boundingBox()
        if (!boksEtter) throw new Error('POI-filteret forsvant da Info ble åpnet')
        const flyttet = Math.round(Math.abs(boksEtter.x - boksFor.x) + Math.abs(boksEtter.y - boksFor.y))
        if (flyttet > 1) {
          throw new Error(`POI-filteret flyttet seg ${flyttet} px da Info ble åpnet — `
            + 'raden skal være like bred åpen som lukket')
        }
        const vp = page.viewportSize()
        if (boksEtter.x < 0 || boksEtter.x + boksEtter.width > vp.width + 1) {
          throw new Error(`POI-filteret ligger utenfor skjermen med Info åpen `
            + `(x ${Math.round(boksEtter.x)}–${Math.round(boksEtter.x + boksEtter.width)} av ${vp.width})`)
        }
        poiUtfall = 'POI-filteret sto stille og innenfor skjermen'
      }

      // TILBAKE TIL NØYTRAL TILSTAND: en åpen hjelpeboks dekker halve
      // overlegget, og neste sjekk ville ikke funnet knappene sine.
      await lukkPille.click({ timeout: 5000 })
      await page.waitForTimeout(400)
      if (await kropp.count()) throw new Error('trykk på headeren lukket ikke hjelpekroppen igjen')

      // SPEILVENDT (v6.5.49): filteret skal like lite kunne flytte hjelpen.
      // Det var den retningen som faktisk brakk — den grønne boksen vokste mot
      // venstre til den nådde Info-pilla og rant så ut over høyre skjermkant.
      let filterUtfall = 'POI-filteret finnes ikke i dette kartet'
      if (boksFor) {
        const infoFor = await infoPille.boundingBox()
        await poi.click({ timeout: 5000 })
        await page.waitForTimeout(500)

        const filterKropp = page.locator('#tour3d-poi-kropp')
        if (!await filterKropp.count()) {
          throw new Error('trykk på filter-headeren åpnet ikke filterkroppen')
        }
        const skjulFilter = page.locator('button[aria-label^="Skjul filter for"]')
        if (!await skjulFilter.count()) {
          throw new Error('filter-headeren forsvant da kroppen åpnet seg — den skal bli stående og lukke igjen')
        }

        const infoEtter = await infoPille.boundingBox()
        const infoFlyttet = Math.round(Math.abs(infoEtter.x - infoFor.x) + Math.abs(infoEtter.y - infoFor.y))
        if (infoFlyttet > 1) {
          throw new Error(`Info-pilla flyttet seg ${infoFlyttet} px da filteret ble åpnet — `
            + 'raden skal være like bred åpen som lukket')
        }

        const vp = page.viewportSize()
        const kroppBoks = await filterKropp.boundingBox()
        if (kroppBoks.x < -1 || kroppBoks.x + kroppBoks.width > vp.width + 1) {
          throw new Error('filterkroppen ligger utenfor skjermen '
            + `(x ${Math.round(kroppBoks.x)}–${Math.round(kroppBoks.x + kroppBoks.width)} av ${vp.width})`)
        }

        await skjulFilter.click({ timeout: 5000 })
        await page.waitForTimeout(400)
        if (await filterKropp.count()) throw new Error('trykk på headeren lukket ikke filterkroppen igjen')
        filterUtfall = 'filteret åpnet som nedtrekk uten å flytte Info'
      }

      if (startSteg === 'Bytt til dag' && await lesSolMaaneSteg(page) === 'Bytt til natt') {
        await page.locator('button[aria-label="Bytt til natt"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }
      await lukk()
      return `headeren åpnet og lukket hjelpen; ${poiUtfall}; ${filterUtfall}`
    },
  },
  {
    navn: 'retningsrosa løfter og snur blikket uten et drag (desktop)',
    domene: 'RetningsRose',
    krever: 'ektekart',
    maksMs: 120_000,
    async kjør(page) {
      // HVORFOR DEN SJEKKEN FINNES: himmelvippen drives av et DRAG med HØYRE
      // museknapp (venstre panorerer). På en stor skjerm uten berøring er det
      // ingenting som sier det, og stjernekikkeren er dermed utilgjengelig. Denne
      // sjekken beviser at man kommer opp i himmelen UTEN å kjenne den gesten.
      //
      // Playwright-konteksten setter ikke `hasTouch`, så Chromium rapporterer
      // `(hover: hover) and (pointer: fine)` — nøyaktig porten knappen står bak.
      // Settes hasTouch en gang i framtida, forsvinner knappen og denne sjekken
      // skal da feile og ikke hoppe stille over.
      await lukkDrawer(page)
      await klikkSnarvei(page, 'tre-d')
      const klar = await page.waitForFunction(() => {
        const c = document.querySelector('canvas')
        if (c && c.width > 0) return 'canvas'
        if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
        return false
      }, null, { timeout: 60_000 }).then((h) => h.jsonValue())
      const lukk = async () => {
        await page.locator('button[aria-label="Lukk 3D-visning"]').click({ timeout: 8000 })
        await page.waitForFunction(() => !document.querySelector('canvas'),
          null, { timeout: 8000 })
      }
      if (klar === 'ingen-dem') {
        await lukk()
        return 'ingen-dem-melding — blikket kan ikke løftes uten terreng'
      }
      await page.waitForFunction(
        () => !/Skjerper kartbildet/i.test(document.body.innerText),
        null, { timeout: 45_000 },
      ).catch(() => { /* meldingen kan ha kommet og gått */ })

      // Dagmodus: himmel-hintet og «Oversikt» er skjult om natta (v6.1.0), og de
      // to er landemerkene sjekken leser.
      const startSteg = await lesSolMaaneSteg(page)
      if (startSteg === 'Bytt til dag') {
        await page.locator('button[aria-label="Bytt til dag"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }

      const skyv = page.locator('input.blikk-skyv')
      if (!await skyv.count()) {
        throw new Error('høyde-kontrollen i retningsrosa mangler — himmelen er '
          + 'uoppnåelig uten et høyre-drag på desktop')
      }
      // Sett den til maks. `fill` på en range gir et ekte input-event, som er
      // det komponenten lytter på — og hele poenget er at INGEN gest trengs.
      const maks = await skyv.getAttribute('max')
      await skyv.fill(String(maks))
      await page.waitForTimeout(1200)

      const oppe = await evalMedTak(page, () =>
        /Ser opp i himmelen/i.test(document.body.innerText))
      if (!oppe) throw new Error('skyveknappen på maks løftet ikke blikket opp i himmelen')

      // Og ned igjen: en enveisbillett ville stått grønn på halve sjekken.
      // Minimum er nå fugleperspektivet (−85°, orbit-regimet) og ikke bare
      // horisonten — det er den andre halvdelen av «tilt» rosa skal kunne.
      await skyv.fill(String(await skyv.getAttribute('min')))
      await page.waitForTimeout(1200)
      if (await evalMedTak(page, () => /Ser opp i himmelen/i.test(document.body.innerText))) {
        throw new Error('rosa på minimum tok ikke blikket ned i kartet igjen')
      }

      // ROTASJONEN: samme luke som høyden. Uten kontrollen kan man ikke snu seg
      // med mus i det hele tatt (venstre knapp panorerer). Avlesningen kommer
      // fra MOTOREN via `blikk`-eventet, ikke fra vår egen prop — så en rose som
      // bare flyttet håndtaket sitt ville stått rød her.
      const azimut = page.locator('input[aria-label="Blikkets retning i grader fra nord"]')
      if (!await azimut.count()) {
        throw new Error('retnings-kontrollen mangler — man kan ikke snu seg med mus')
      }
      await azimut.fill('90')
      await page.waitForTimeout(1400)
      const lest = await page.locator('[role="group"][aria-label*="Blikkretning"]')
        .first().getAttribute('aria-label')
      const grader = Number((lest || '').match(/(-?\d+)\s*grader/)?.[1])
      if (!Number.isFinite(grader) || Math.abs(grader - 90) > 8) {
        throw new Error(`rosa snudde ikke blikket mot øst (motoren melder «${lest}»)`)
      }

      // NØYTRAL TILSTAND: modusen vi arvet, og 3D lukket. Måle-modus-fella fra
      // v5.8.1 — en sjekk som etterlater et annet bilde felles den neste.
      if (startSteg === 'Bytt til dag' && await lesSolMaaneSteg(page) === 'Bytt til natt') {
        await page.locator('button[aria-label="Bytt til natt"]').click({ timeout: 10_000 })
        await page.waitForTimeout(1600)
      }
      await lukk()
      return `rosa gikk 0 → ${maks}° → fugleperspektiv og snudde mot øst, uten en eneste gest`
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
      // HIMMELEN TVINGES OPP, og det er en RETTELSE (v6.5.28). Globe-halvdelen
      // under krevde at ett av månen/Mars/Jupiter/Saturn sto over horisonten, med
      // begrunnelsen «praktisk talt alltid ett av de fire oppe». Det er ikke
      // sant: 2026-09-03 17:39 UTC over Vardåsen sto månen 3° UNDER horisonten
      // og ingen av de tre planetene var oppe — bare Venus, som ikke har globe.
      // Sjekken var rød på klokkeslettet, ikke på koden, akkurat som den
      // tidsavhengige røden kommentaren under beskriver. Alle grønne kjøringer
      // fram til da lå mellom 06 og 15 UTC.
      //
      // Bryteren er `lende-3d-himmel-tvang` fra Utvikler-fanen, som finnes for
      // nøyaktig dette: månen er under horisonten store deler av døgnet og de
      // tre planetene store deler av året, og da kan verken globene eller
      // trykk-plukkingen prøves i det hele tatt. Alt annet ved legemet er ekte —
      // azimut, fase, lysside, avstand — så kjeden vi måler er den samme.
      // Flagget leses ved MONTERING av 3D-viseren, så reloaden er nødvendig
      // (samme mønster som nordlysdemoen under).
      await evalMedTak(page, () => {
        try { localStorage.setItem('lende-3d-himmel-tvang', '1') } catch { /* privat */ }
      })
      await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
        null, { timeout: 30_000 })
      const rydd = async () => {
        await evalMedTak(page, () => {
          try { localStorage.removeItem('lende-3d-himmel-tvang') } catch { /* privat */ }
        })
      }

      try {
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
        //
        // SOLA HOPPES OVER, og det er en RETTELSE. Sola er `rang: 0` i
        // himmelObjekter og står derfor ALLTID først (v6.5.6), så «det første
        // elementet» sluttet å være et stjernebilde den dagen sola kom inn i
        // lista — sjekken het «stjernekikkeren finner, velger og forteller» og
        // testet i praksis sola, som har sin EGEN sjekk rett under.
        //
        // Det avslørte seg som en tidsavhengig rød: kravet «over horisonten»
        // lenger nede er sant for et stjernebilde (lista lover bare det som er
        // oppe), men sola er unntaket som også listes når den står UNDER — og da
        // sier kortet «under horisonten», helt etter planen. Alle tidligere
        // kjøringer lå mellom 07 og 15 UTC, altså høylys dag over Vardåsen, så
        // sjekken hadde aldri møtt en natt før 2026-08-31 21:27 UTC.
        //
        // GLOBE-LEGEMENE HOPPES OVER AV SAMME GRUNN (v6.5.28): `rang` i
        // himmelObjekter er sol 0, måne 1, planet 2, formasjon 3 — så med tvangen
        // over ville «det første elementet» blitt Månen, og denne halvdelen sluttet
        // å teste et stjernebilde. Globene har sin egen halvdel lenger nede.
        const forste = await evalMedTak(page, () => {
          const hopp = ['Sola', 'Månen', 'Merkur', 'Venus', 'Mars', 'Jupiter', 'Saturn']
          const b = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
            .find((e) => !hopp.includes((e.querySelector('span.block')?.textContent ?? '').trim()))
          return b ? (b.querySelector('span.block')?.textContent ?? '').trim() : null
        })
        if (!forste) {
          throw new Error('himmellista hadde ingen stjernebilder eller stjerner — ingenting å velge')
        }
        await page.locator('ul[aria-label="Treff på himmelen"] li button')
          .filter({ hasText: forste }).first()
          .click({ timeout: 5000 })
        await page.waitForTimeout(1600)

        // ET VALG FRA LISTA GIR MINIMERT KORT (v6.3.10). Å plukke et navn fra
        // nedtrekkslista er NAVIGASJON — man har alt bestemt seg for hva man vil se
        // — så kortet skal ikke legge seg over halve himmelen. Vi måler på
        // «Historien», som bare finnes i det utvidede kortet.
        // CASE-INSENSITIVT: «Historien», «Verdt å vite» og «Fakta» er overskrifter
        // med `uppercase`, og `innerText` gir RENDRET tekst. Uten /i kunne ingen av
        // dem matche, og sjekken var halvblind — grønn fordi den ikke kunne feile.
        const harHistorien = () => evalMedTak(page, () => /Historien|Verdt å vite|Fakta/i
          .test(document.body.innerText))
        if (await harHistorien()) {
          throw new Error(`valgte «${forste}» fra lista, men kortet åpnet seg — `
            + 'et listevalg skal minimere')
        }
        if (!(await evalMedTak(page, () => document.body.innerText)).includes(forste)) {
          throw new Error(`valgte «${forste}», men pilla nevner den ikke`)
        }

        // «SETT I FOKUS» HØRER BARE I DEN MINIMERTE PILLA (v6.3.5). Med kortet
        // sammenlagt kan man panorere, og da er krysshåret veien tilbake; i det
        // åpne kortet har det ingen jobb. Sjekken måler BEGGE sider, for en knapp
        // er lett å legge tilbake på feil sted i god tro.
        const fokusKnapper = () => evalMedTak(page, () => document
          .querySelectorAll('button[aria-label^="Sett "][aria-label$=" i fokus"]').length)
        if (!await fokusKnapper()) {
          throw new Error('«Sett i fokus» mangler i den minimerte pilla — da finnes '
            + 'ingen vei tilbake etter panorering')
        }

        // UTVID: lesestoffet og retningslinja kommer, og krysshåret går bort.
        await page.locator(`button[aria-label="Vis mer om ${forste}"]`).click({ timeout: 5000 })
        await page.waitForTimeout(400)
        const kortTekst = await evalMedTak(page, () => document.body.innerText)
        if (!kortTekst.includes(forste)) {
          throw new Error(`utvidet kortet for «${forste}», men det nevner den ikke`)
        }
        if (!/over horisonten/i.test(kortTekst)) {
          throw new Error('infokortet mangler retning og høyde — det er linja man trenger')
        }
        if (await fokusKnapper()) throw new Error('«Sett i fokus» står i det ÅPNE kortet')
        if (!await harHistorien()) {
          throw new Error('det utvidede kortet mangler lesestoffet — Fakta, Verdt å '
            + 'vite og Historien var alle borte')
        }
        if (!await evalMedTak(page, () => !!document
          .querySelector('button[aria-label="Minimer infokortet"]'))) {
          throw new Error('kortet mangler minimer-knappen')
        }

        // HEADEREN HOLDER VED STOR TEKST (v6.5.54). Navnet og knappene sto på
        // samme rad: knappene `shrink-0`, navnet `flex-1 min-w-0`, altså det som
        // fikk det som ble til overs — og ved 200 % app-tekst oppå Androids egen
        // tekstskalering ble det ingenting. «Bjørnevokteren» kom ut som én
        // bokstav per linje. Det er en ren layout-feil: markupen er den samme,
        // så den kan BARE måles.
        //
        // Vi hever rot-fonten til 32 px (Androids 200 %) og krever to ting av
        // headeren: at navnet får en reell del av kortbredden, og at knappene
        // holder seg innenfor kortet — kortet er `overflow-hidden`, så en
        // knapperad som stikker ut er en lukkeknapp brukeren ikke har. Rot-fonten
        // settes tilbake etterpå, ellers arver neste sjekk den.
        const headerMaal = await evalMedTak(page, () => {
          const rot = document.documentElement
          const forrige = rot.style.fontSize
          rot.style.fontSize = '32px'
          const navn = document.querySelector('[data-himmel-navn]')
          const knapper = document.querySelector('[data-himmel-knapper]')
          const kort = navn?.closest('.rounded-md')
          const m = navn && knapper && kort
            ? {
                // PLASSEN navnet har, ikke bredden på akkurat dette navnet:
                // «Lyren» er kort uansett hvor godt headeren oppfører seg.
                navn: Math.round(navn.parentElement.getBoundingClientRect().width),
                kort: Math.round(kort.getBoundingClientRect().width),
                utenfor: Math.round(knapper.getBoundingClientRect().right
                  - kort.getBoundingClientRect().right),
              }
            : null
          rot.style.fontSize = forrige
          return m
        })
        if (!headerMaal) throw new Error('fant ikke navnet eller knappene i infokortets header')
        if (headerMaal.navn < headerMaal.kort * 0.6) {
          throw new Error(`navnelinja klemmes ved stor tekst: ${headerMaal.navn} px av `
            + `${headerMaal.kort} px kortbredde — headeren er ikke stablet`)
        }
        if (headerMaal.utenfor > 1) {
          throw new Error(`knapperaden stikker ${headerMaal.utenfor} px utenfor kortet, `
            + 'som er overflow-hidden — lukkeknappen klippes bort')
        }

        // Og sammen igjen: navnet blir stående, lesestoffet forsvinner.
        await page.locator('button[aria-label="Minimer infokortet"]').click({ timeout: 5000 })
        await page.waitForTimeout(400)
        if (await harHistorien()) throw new Error('kortet ble ikke minimert')
        if (!(await evalMedTak(page, () => document.body.innerText)).includes(forste)) {
          throw new Error('navnet forsvant da kortet ble minimert — da vet man ikke hva som lyser')
        }

        // NABO-HOPP minimerer av seg selv: man hopper for å SE, ikke for å lese.
        // Kortet MÅ utvides først — snarveiene bor i det åpne kortet, og et hopp
        // fra et alt sammenlagt kort ville ikke målt noe.
        await page.locator(`button[aria-label="Vis mer om ${forste}"]`).click({ timeout: 5000 })
        await page.waitForTimeout(400)
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
          // ET LISTEVALG MINIMERER (v6.3.10), også når kortet alt er sammenlagt.
          // Vi velger noe annet og krever at det fortsatt er sammenlagt — og at
          // navnet FULGTE med, ellers flyttet ingenting seg.
          await page.locator('button[aria-label^="Valgt:"]').click({ timeout: 8000 })
          await page.waitForTimeout(400)
          const annet = await evalMedTak(page, (unntak) => {
            const b = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
              .find((e) => !e.textContent.includes(unntak))
            return b ? (b.querySelector('span.block')?.textContent ?? '').trim() : null
          }, nabo)
          if (annet) {
            await page.locator('ul[aria-label="Treff på himmelen"] li button')
              .filter({ hasText: annet }).first().click({ timeout: 5000 })
            await page.waitForTimeout(1600)
            if (await harHistorien()) {
              throw new Error(`byttet til «${annet}» fra lista, men kortet åpnet seg `
                + '— et listevalg skal minimere')
            }
            if (!(await evalMedTak(page, () => document.body.innerText)).includes(annet)) {
              throw new Error(`byttet til «${annet}», men pilla viser den ikke`)
            }
            // Og kortet skal fortsatt kunne åpnes — det minimeres, det låses ikke.
            await page.locator(`button[aria-label="Vis mer om ${annet}"]`).click({ timeout: 5000 })
            await page.waitForTimeout(400)
            if (!await harHistorien()) {
              throw new Error('kortet lot seg ikke åpne etter et listevalg — pilla '
                + 'skal være sammenlagt, ikke låst')
            }
          }
        }

        // GLOBENE (v6.2.0): månen, Mars, Jupiter og Saturn kan åpnes som roterbare
        // kuler. Vi finner en av dem i lista og krever at et valg gir stedsnavn på
        // overflata — det er den enden av kjeden som beviser at globen faktisk
        // tegnes, og den kan ikke leses av noe annet.
        // LISTA MÅ ÅPNES PÅ NYTT FØRST. Den lukker seg når man velger, så en
        // spørring mot den her fant ingenting — og sjekken meldte «ingen
        // globe-legeme over horisonten» og testet dermed ingenting, grønt.
        // Nøyaktig den feilklassen prosjektet frykter mest, og den slapp gjennom
        // én kjøring før den ble oppdaget i loggen.
        await page.locator('button[aria-label^="Valgt:"]').click({ timeout: 8000 })
        await page.waitForTimeout(400)
        const medGlobe = await evalMedTak(page, () => {
          const navn = ['Månen', 'Mars', 'Jupiter', 'Saturn']
          const b = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
            .find((e) => navn.some((n) => e.textContent.includes(n)))
          return b ? (b.querySelector('span.block')?.textContent ?? '').trim() : null
        })
        if (!medGlobe) {
          // Himmelen over Vardåsen har praktisk talt alltid ett av de fire oppe.
          // Er den tom, er det lista som er brutt — ikke astronomien.
          throw new Error('fant verken månen, Mars, Jupiter eller Saturn i himmellista')
        }

        // GLOBE-MERKET i lista (v6.3.2): raden for et legeme med globe skal bære
        // trådkloden, og en formasjon skal IKKE. Måles som et FORHOLD og ikke som
        // et absolutt antall: hvilke legemer som er oppe avhenger av dato, men at
        // merket står på riktige rader gjør det ikke.
        const merker = await evalMedTak(page, () => {
          const rader = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
          let medMerke = 0
          let formasjonMedMerke = 0
          for (const r of rader) {
            const harMerke = /kan åpnes som globe/.test(r.textContent)
            if (harMerke) medMerke++
            // Formasjonene har ✦ som type-ikon.
            if (harMerke && r.textContent.includes('✦')) formasjonMedMerke++
          }
          return { rader: rader.length, medMerke, formasjonMedMerke }
        })
        if (!merker.medMerke) {
          throw new Error('ingen rad i himmellista bærer globe-merket, men '
            + `«${medGlobe}» står der`)
        }
        if (merker.formasjonMedMerke) {
          throw new Error(`${merker.formasjonMedMerke} stjernebilde(r) fikk globe-merket `
            + '— et merke som lover en globe som ikke finnes')
        }
        // Fem fra v6.5.6: sola kom inn som det femte legemet med globe.
        if (merker.medMerke > 5) {
          throw new Error(`${merker.medMerke} rader bærer globe-merket, men bare fem `
            + 'legemer har globe')
        }
        await page.locator('ul[aria-label="Treff på himmelen"] li button')
          .filter({ hasText: medGlobe }).first().click({ timeout: 5000 })
        // Globen vokser fram over noen frames, og labelene kommer først når den er
        // over 60 % — så vi venter på navnene framfor en fast pause.
        const trekk = await page.waitForFunction(() => {
          const n = document.querySelectorAll('div[aria-hidden="true"] span + span').length
          return n > 0 ? n : false
        }, null, { timeout: 20_000 }).then((x) => x.jsonValue()).catch(() => 0)
        if (!trekk) throw new Error(`åpnet globen for «${medGlobe}», men ingen stedsnavn kom`)

        // STEDSNAVNENE PÅ GLOBEN følger tekststørrelse-valget (v6.5.32), og taket
        // deres MÅ være i `vw`. Fella er kjent fra 3D-overlegget (v6.3.12): inne i
        // et `zoom`-lag ganges rem og px opp sammen med teksten, så en bredde i rem
        // ville vokst i takt og «Hellasbassenget» aldri brutt — mens `vw` er
        // absolutt mot viewporten og derfor et ekte tak på skjermen.
        const navnStil = await evalMedTak(page, () => {
          const el = document.querySelector('div[aria-hidden="true"] > div > span:nth-child(2)')
          if (!el) return null
          const c = getComputedStyle(el)
          return {
            px: parseFloat(c.fontSize),
            zoom: el.style.zoom,
            maks: el.style.maxWidth,
            deling: c.hyphens,
          }
        })
        if (!navnStil) throw new Error('fant ingen stedsnavn-span på globen å måle')
        if (!(navnStil.px >= 12)) {
          throw new Error(`stedsnavnet på globen er ${navnStil.px} px — for smått å lese i felt`)
        }
        if (!navnStil.zoom) throw new Error('stedsnavnet på globen følger ikke tekststørrelse-valget')
        if (!/vw$/.test(navnStil.maks || '')) {
          throw new Error(`stedsnavnets tak er «${navnStil.maks}» og ikke i vw — `
            + 'da vokser bredden med teksten og lange navn brekker aldri')
        }
        if (navnStil.deling !== 'auto') {
          throw new Error(`stedsnavnet har hyphens: ${navnStil.deling} — lange navn brytes uten bindestrek`)
        }
        const globeUtfall = `${medGlobe}-globen ga ${trekk} stedsnavn `
          + `(${navnStil.px} px, tak ${navnStil.maks}); `
          + `globe-merket på ${merker.medMerke} av ${merker.rader} rader`

        // KORTET MÅ ÅPNES FØRST. Et listevalg MINIMERER (v6.3.10), så globe-valget
        // over etterlot en sammenlagt pille — og faktablokka finnes ikke der.
        // Sjekken under skal måle INNHOLDET i kortet, ikke hvordan vi kom dit.
        const visMer = page.locator(`button[aria-label="Vis mer om ${medGlobe}"]`)
        if (await visMer.count()) {
          await visMer.click({ timeout: 5000 })
          await page.waitForTimeout(400)
        }

        // TAKET BOR PÅ KORTET SELV (v6.5.32), ikke på en rullbar forelder. Er det
        // forelderen som klipper, ruller headeren bort — og da er vi tilbake i
        // nøyaktig feilen v6.3.2 rettet, med navnet og knappene ute av skjermen.
        const kortTak = await evalMedTak(page, () => {
          const knapp = document.querySelector('button[aria-label="Lukk infokortet"]')
          const kort = knapp?.closest('div[style*="max-height"]')
          if (!kort) return null
          const r = kort.getBoundingClientRect()
          return { inline: kort.style.maxHeight, andel: r.height / window.innerHeight }
        })
        if (!kortTak) throw new Error('infokortet har ikke sitt eget høydetak — da klipper forelderen')
        if (!/vh$/.test(kortTak.inline)) {
          throw new Error(`infokortets tak er «${kortTak.inline}» og ikke i vh`)
        }
        if (kortTak.andel > 0.72) {
          throw new Error(`infokortet dekker ${Math.round(kortTak.andel * 100)} % av skjermen `
            + '— det skal stå OVER en himmel man fortsatt ser')
        }

        // ASTRONOMISKE FAKTA (v6.3.0). Kortet for et legeme skal bære nøkkeltall,
        // utforskningshistorie og lenker til SNL og Wikipedia. Alt er DATA, så
        // koden kan ikke kaste — en glemt faktablokk viser seg bare som et tomt
        // panel, og det er nettopp derfor sjekken må lese teksten.
        const faktaFunn = await evalMedTak(page, () => {
          const t = document.body.innerText
          const lenke = (v) => !!document.querySelector(`a[href*="${v}"]`)
          return {
            // CASE-INSENSITIVT, OG DET ER IKKE SLURV: `innerText` er RENDRET tekst,
            // og Chromium bruker `text-transform` på den. Overskriftene i kortet
            // har `uppercase`, så «Fakta» kommer ut som «FAKTA». Første utgave av
            // denne sjekken feilet på nettopp det — og den samme fella gjorde
            // `harHistorien` under blind, se kommentaren der.
            fakta: /\bfakta\b/i.test(t),
            utforsket: /\butforsket\b/i.test(t),
            maner: /(måner|måne:|ingen måner)/i.test(t),
            snl: lenke('snl.no'),
            wiki: lenke('wikipedia.org'),
            arstall: (t.match(/\b(1[5-9]\d\d|20[0-3]\d)\b/g) ?? []).length,
          }
        })
        if (!faktaFunn.fakta) throw new Error(`kortet for «${medGlobe}» mangler faktablokka`)
        // MÅNEN HAR INGEN MÅNELINJE, og det er riktig: den ER en måne, så
        // `manerLinje` returnerer null for den (egen test i himmelFakta.test.js).
        //
        // Dette var en DATOAVHENGIG feil i sjekken selv, lagt inn i v6.3.0: hvilket
        // globe-legeme som plukkes avhenger av hva som står oppe den natta CI
        // kjører. Tidligere kjøringer traff Venus og Jupiter og sto grønne; første
        // gang månen kom først, feilet den. En sjekk som bare virker for noen av
        // inndataene er en sjekk som venter på å bli rød.
        if (medGlobe !== 'Månen' && !faktaFunn.maner) {
          throw new Error(`kortet for «${medGlobe}» mangler månelinja`)
        }
        if (!faktaFunn.utforsket) throw new Error(`kortet for «${medGlobe}» mangler utforskningshistorien`)
        if (faktaFunn.arstall < 2) {
          throw new Error(`utforskningshistorien for «${medGlobe}» har ingen årstall`)
        }
        if (!faktaFunn.snl || !faktaFunn.wiki) {
          throw new Error(`kortet for «${medGlobe}» mangler lenke til `
            + `${!faktaFunn.snl ? 'snl.no' : 'Wikipedia'}`)
        }
        // «alle N» skal gi HELE historien. Bare de fire nyeste vises sammenlagt,
        // og en knapp som ikke utvider noe er verre enn ingen knapp.
        const flereFor = faktaFunn.arstall
        // Samme normaliserings-felle som «Tilbake til natthimmel» under: teksten
        // står på egen linje i malen, så et ankret regex mot `textContent` traff
        // aldri — og siden knappen er valgfri, hoppet sjekken bare stille over
        // seg selv. Rollenavnet er normalisert.
        const utvid = page.getByRole('button', { name: /^alle \d+$/ }).first()
        let faktaUtfall = `fakta + ${flereFor} årstall + begge lenkene`
        if (await utvid.count()) {
          await utvid.click({ timeout: 5000 })
          await page.waitForTimeout(300)
          const etter = await evalMedTak(page, () => (document.body.innerText
            .match(/\b(1[5-9]\d\d|20[0-3]\d)\b/g) ?? []).length)
          if (etter <= flereFor) throw new Error('«alle N» utvidet ikke historien')
          faktaUtfall = `fakta + ${flereFor}→${etter} årstall + begge lenkene`
        }

        // ET TRYKK LEGGER KULA TILBAKE PÅ HIMMELEN — og kortet skal LEGGES SAMMEN,
        // ikke lukkes (v6.3.5). Fram til da nullstilte exit hele valget, og kortet
        // forsvant i det man forlot nærbildet: man er fortsatt på legemet, man har
        // bare lagt kula tilbake.
        //
        // PUNKTET MÅ LIGGE UTENFOR INFOKORTET, og det er ikke en detalj: kortet er
        // to tredjedeler høyt (58 vh fra v6.3.2, 66 fra v6.5.32), så det faste
        // punktet (40, halve høyden) landet
        // OPPÅ kortet og trykket nådde aldri lerretet. Den gamle utgaven av sjekken
        // tolererte begge utfall og avslørte det derfor ikke. Vi regner nå ut et
        // ledig punkt og VERIFISERER med elementFromPoint at det er canvaset som
        // ligger der — ellers tester vi ingenting.
        const utsideKortet = await evalMedTak(page, () => {
          const kort = [...document.querySelectorAll('div')]
            .find((d) => /Lukk infokortet/.test(d.querySelector('button[aria-label]')
              ? [...d.querySelectorAll('button[aria-label]')]
                .map((b) => b.getAttribute('aria-label')).join(' ') : ''))
          const r = kort?.getBoundingClientRect()
          const kandidater = [
            [Math.round(window.innerWidth * 0.5), window.innerHeight - 40],
            [30, window.innerHeight - 40],
            [Math.round(window.innerWidth * 0.5), Math.round((r?.bottom ?? 0) + 60)],
          ]
          for (const [x, y] of kandidater) {
            if (y < 0 || y > window.innerHeight - 5) continue
            const el = document.elementFromPoint(x, y)
            if (el && el.tagName === 'CANVAS') return { x, y }
          }
          return null
        })
        if (!utsideKortet) {
          throw new Error('fant ikke et punkt på lerretet utenfor infokortet — '
            + 'et trykk her ville truffet kortet og bevist ingenting')
        }
        await page.mouse.click(utsideKortet.x, utsideKortet.y)
        await page.waitForTimeout(900)
        const etterExit = await evalMedTak(page, (navn) => ({
          harNavn: document.body.innerText.includes(navn),
          minimert: !!document.querySelector('button[aria-label="Vis hele infokortet"]'),
        }), medGlobe)
        if (!etterExit.harNavn) {
          throw new Error(`exit fra globen lukket kortet helt — «${medGlobe}» er borte`)
        }
        if (!etterExit.minimert) throw new Error('exit fra globen la ikke kortet sammen')

        // «TILBAKE TIL NATTHIMMEL» (v6.5.40). Trykket utenfor kula over er den
        // samme veien ut, men den er ikke å GJETTE på: uten en synlig utvei
        // trykket brukerne X-en oppe til høyre, som lukker hele 3D-visningen.
        // Knappen må derfor gjøre nøyaktig det trykket gjør — legge kula tilbake
        // og legge kortet SAMMEN, ikke lukke det (v6.3.5) — og den må være minst
        // 44 px høy og midtstilt under kula, ellers er den ikke affordansen den
        // skal være. Globen åpnes på nytt, for trykket over la den bort.
        await page.locator('button[aria-label^="Valgt:"]').click({ timeout: 8000 })
        await page.waitForTimeout(400)
        await page.locator('ul[aria-label="Treff på himmelen"] li button')
          .filter({ hasText: medGlobe }).first().click({ timeout: 5000 })
        await page.waitForFunction(() => document
          .querySelectorAll('div[aria-hidden="true"] span + span').length > 0,
        null, { timeout: 20_000 })

        // MATCHET PÅ DET TILGJENGELIGE NAVNET, ikke med et regex mot rå tekst.
        // Playwrights `hasText` måler et REGEX mot elementets `textContent` slik
        // det står i DOM-en — altså med malens linjeskift og innrykk rundt
        // teksten — så `/^…$/` traff aldri, og sjekken meldte at knappen manglet
        // mens den sto der. Rollenavnet er normalisert (og er dessuten det en
        // skjermleser leser opp), så det er den ekte affordansen vi spør etter.
        const tilbake = page.getByRole('button', { name: 'Tilbake til natthimmel', exact: true })
        if (!await tilbake.count()) {
          throw new Error('globen står åpen, men «Tilbake til natthimmel» mangler — '
            + 'da er den eneste synlige utveien X-en, som lukker hele 3D')
        }
        const knappMaal = await evalMedTak(page, () => {
          const b = [...document.querySelectorAll('button')]
            .find((e) => e.textContent.trim() === 'Tilbake til natthimmel')
          const r = b.getBoundingClientRect()
          return {
            hoyde: Math.round(r.height),
            avvikPx: Math.abs((r.left + r.width / 2) - window.innerWidth / 2),
            zoom: b.style.zoom || '',
          }
        })
        if (knappMaal.hoyde < 44) {
          throw new Error(`«Tilbake til natthimmel» er ${knappMaal.hoyde} px høy — `
            + 'en finger trenger 44')
        }
        if (knappMaal.avvikPx > 8) {
          throw new Error(`«Tilbake til natthimmel» står ${Math.round(knappMaal.avvikPx)} px `
            + 'fra midten — den skal stå midtstilt under kula')
        }
        // Ingen `zoom`: en knapp er ikke lesestoff, og 44 px er 44 px (v6.1.0).
        if (knappMaal.zoom) {
          throw new Error(`«Tilbake til natthimmel» har zoom: ${knappMaal.zoom} — `
            + 'knapper skalerer ikke med tekstvalget')
        }
        await tilbake.first().click({ timeout: 5000 })
        await page.waitForTimeout(900)
        const etterKnapp = await evalMedTak(page, (navn) => ({
          knappBorte: ![...document.querySelectorAll('button')]
            .some((e) => e.textContent.trim() === 'Tilbake til natthimmel'),
          harNavn: document.body.innerText.includes(navn),
          minimert: !!document.querySelector('button[aria-label="Vis hele infokortet"]'),
        }), medGlobe)
        if (!etterKnapp.knappBorte) {
          throw new Error('«Tilbake til natthimmel» ble stående etter trykket — kula lukket seg ikke')
        }
        if (!etterKnapp.harNavn) {
          throw new Error(`knappen lukket kortet helt — «${medGlobe}» er borte, `
            + 'og man er fortsatt på legemet')
        }
        if (!etterKnapp.minimert) throw new Error('knappen la ikke kortet sammen')

        await page.locator('button[aria-label="Lukk infokortet"]').click({ timeout: 5000 })
          .catch(() => { /* kortet kan alt være lukket */ })
        await page.waitForTimeout(400)
        await lukkNatt3d(page, h.startSteg)
        return `valgte «${forste}» (fokus bare i pilla), minimerte, utvidet`
          + `${nabo ? `, hoppet til «${nabo}»` : ''}; ${globeUtfall}; ${faktaUtfall}; `
          + 'exit og «Tilbake til natthimmel» la begge kortet sammen '
          + '(himmelen tvunget opp)'
      } finally {
        // Flagget MÅ vekk uansett utfall: localStorage overlever reloaden, og en
        // tvungen himmel som følger med inn i neste sjekk ville gjort sola-sjekken
        // under til en måling av noe annet enn den ekte lista.
        await rydd()
      }
    },
  },
  {
    // v6.5.6. SOLA er det femte legemet med globe, og det ene som er der HELE
    // DØGNET — står den ikke på himmelen, står den under terrengarket der den
    // faktisk er. Enhetstestene dekker lista, teksten og riggens vinkler hver for
    // seg; det er kjeden fra rad til kort ingen av dem ser.
    //
    // Sjekken TRYKKER, og den måler tre ting enhetstestene ikke kan:
    // at raden faktisk finnes i den ekte lista, at ikonet er SVG-en og ikke
    // ☀️-emojien, og at kortet sier hvilken side av horisonten sola er på.
    navn: 'sola er med hele døgnet, med SVG-ikon og globe',
    domene: 'himmelObjekter + Tour3dHimmelSok (sola)',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      const h = await aapneNatt3d(page)
      if (h.hoppet) return h.hoppet

      const pille = page.locator('button[aria-label="Finn et stjernebilde eller en planet"], '
        + 'button[aria-label^="Valgt:"]').first()
      await pille.click({ timeout: 8000 })
      await page.waitForSelector('ul[aria-label="Treff på himmelen"]', { timeout: 8000 })

      // Skriv «sol» i søkefeltet: det beviser at søket treffer den, ikke bare at
      // den ligger i lista.
      const felt = page.locator('ul[aria-label="Treff på himmelen"]')
        .locator('xpath=preceding::input[1]')
      await felt.fill('sol', { timeout: 5000 }).catch(() => { /* felt kan mangle */ })
      await page.waitForTimeout(300)

      const rad = await evalMedTak(page, () => {
        const b = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
          .find((e) => /Sola/.test(e.textContent))
        if (!b) return null
        return {
          tekst: b.innerText.replace(/\s+/g, ' ').trim(),
          // SVG OG IKKE EMOJI (v6.5.6): ☀️ tegnes av systemets font i full farge
          // og ville vært det eneste som lyste i en liste man leser i mørket.
          harSvgIkon: b.querySelectorAll('svg').length >= 2,
          harEmoji: /[☀🌞]/u.test(b.textContent),
          harGlobeMerke: /kan åpnes som globe/.test(b.textContent),
        }
      })
      if (!rad) throw new Error('sola sto ikke i himmellista — den skal være der hele døgnet')
      if (rad.harEmoji) throw new Error(`sola-raden bruker emoji: «${rad.tekst}»`)
      if (!rad.harSvgIkon) {
        throw new Error('sola-raden mangler SVG-ikonet (fant færre enn to svg-er: '
          + 'sol-ikonet og globe-merket)')
      }
      if (!rad.harGlobeMerke) throw new Error('sola-raden mangler globe-merket')
      if (!/(over|under) horisonten/.test(rad.tekst)) {
        throw new Error(`sola-raden sier ikke hvilken side av horisonten den er på: «${rad.tekst}»`)
      }
      // Ingen minus foran gradene — fortegnet bæres av ordet.
      if (/[-−]\d+°/.test(rad.tekst)) {
        throw new Error(`sola-raden har et minustegn foran gradene: «${rad.tekst}»`)
      }

      await page.locator('ul[aria-label="Treff på himmelen"] li button')
        .filter({ hasText: 'Sola' }).first().click({ timeout: 5000 })
      await page.waitForTimeout(1800)

      // Kortet er sammenlagt etter et listevalg (v6.3.11). Åpne det og krev at
      // faktaene er der — det er den enden av kjeden som beviser at HIMMEL_FAKTA
      // faktisk nås for et legeme som ikke er en planet.
      await page.locator('button[aria-label="Vis mer om Sola"]').click({ timeout: 8000 })
      await page.waitForTimeout(500)
      const kort = await evalMedTak(page, () => document.body.innerText)
      if (!/Sola/.test(kort)) throw new Error('kortet nevner ikke Sola etter valget')
      if (!/(over|under) horisonten/.test(kort)) {
        throw new Error('kortet sier ikke hvilken side av horisonten sola er på')
      }
      if (!/Historien|Verdt å vite|Fakta/i.test(kort)) {
        throw new Error('kortet for Sola har ingen fakta — HIMMEL_FAKTA nås ikke')
      }

      // NØYTRAL TILSTAND: kortet lukkes, og natta forlates slik neste sjekk
      // forventer å finne appen.
      await page.locator('button[aria-label="Lukk infokortet"]').click({ timeout: 5000 })
        .catch(() => { /* kan alt være lukket */ })
      await page.waitForTimeout(300)
      await lukkNatt3d(page, h.startSteg)
      return `sola i lista med SVG-ikon og globe-merke: «${rad.tekst}»`
    },
  },
  {
    // v6.5.15. Nordlyset er nattas motstykke til værraden, og det er DEMOEN som
    // testes her og ikke det ekte varselet — med vilje. OVATION ga 0 % over
    // Vardåsen den natta laget ble bygget, og en sjekk som bare virker når sola
    // er urolig er en sjekk som venter på å bli grønn ved et tilfelle. Demoen er
    // deterministisk og går gjennom styrkene uansett hva NOAA melder.
    //
    // Sjekken TRYKKER: den slår på demoen i localStorage, laster på nytt, går i
    // natt, og krever at både demo-pilla og nordlyspanelet står der — og at X-en
    // tar dem bort. Det er kjeden fra flagg til gardin, som ingen enhetstest ser.
    navn: 'nordlyspanelet og gardinene kommer i nattmodus',
    domene: 'Viewer3D + nordlysGardiner',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      await evalMedTak(page, () => {
        try { localStorage.setItem('lende-3d-nordlysdemo', '1') } catch { /* privat */ }
      })
      // Flagget leses ved MONTERING av 3D-viseren (som vær-demoen), så en
      // reload er nødvendig — å sette det mens 3D står åpent gjør ingenting.
      await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
        null, { timeout: 30_000 })

      const rydd = async () => {
        await evalMedTak(page, () => {
          try { localStorage.setItem('lende-3d-nordlysdemo', '0') } catch { /* privat */ }
        })
      }

      try {
        const h = await aapneNatt3d(page)
        if (h.hoppet) { await rydd(); return h.hoppet }

        // Panelet: styrkeordet fra demoens første steg, og de fire tallene.
        const panel = await page.waitForFunction(() => {
          const t = document.body.innerText
          return /NORDLYS/i.test(t) && /SJANSE/i.test(t) ? t : false
        }, null, { timeout: 20_000 }).then((x) => x.jsonValue())
        for (const felt of ['KP', 'SOLVIND']) {
          if (!panel.includes(felt)) {
            throw new Error(`nordlyspanelet mangler «${felt}» — de fire tallene `
              + 'svarer på hvert sitt spørsmål, og skydekket er det som avgjør')
          }
        }
        // Demo-pilla må SI at det er en demo. Et Kp 8 fra Utvikler-fanen som
        // ser ut som et ekte varsel er verre enn ingen demo.
        if (!/DEMO/.test(panel)) {
          throw new Error('panelet sier ikke at tallene kommer fra demoen')
        }

        // X-EN OVERLEVER STOR TEKST (v6.5.54). Alle cellene var `shrink-0` og
        // pilla er `overflow-hidden`, så ved 200 % systemtekst var det
        // LUKKEKNAPPEN som ble klippet bort — panelet viste to av fire tall og
        // ingen X, og var dermed umulig å bli kvitt. Markupen er den samme ved
        // begge tekststørrelser, så dette kan BARE måles. Rot-fonten settes
        // tilbake etterpå, ellers arver neste sjekk den.
        //
        // INGEN VENTING PÅ EN MÅLING HER (v6.5.55): brytingen er ren CSS, så
        // den er på plass i samme layout-pass som fonten. Vi venter likevel én
        // runde, fordi rot-fonten settes i en egen eval.
        //
        // ALLE FIRE TALLENE SKAL STÅ IGJEN. De svarer på hvert sitt spørsmål —
        // sjanse, skyer, Kp og solvind — så et panel som løser plassmangelen
        // ved å droppe to av dem har byttet bort selve innholdet. Ved stor
        // tekst skal de i stedet ha falt ned på en EGEN linje under hodet, og
        // X-en skal stå i ro i hjørnet: hun er ute av flyten nettopp for at
        // brytingen ikke skal kunne ta henne med seg.
        // ANTALLET TELLES FØRST, VED VANLIG TEKST. Påstanden «fire tall» var min
        // egen og den er gal: SKYER-raden kommer fra MET-varselet
        // (`nordlysSkydekke`) og ikke fra demoen, så på en runner der varselet
        // ikke svarer er tre tall det RIKTIGE svaret — panelet gjetter ikke om
        // skyer. Invarianten er at stor tekst ikke skal ta noe bort: det som sto
        // der ved vanlig tekst skal stå der ved 200 %, på en linje til.
        const tallFoer = await evalMedTak(page, () =>
          document.querySelector('[data-nordlys-tall]')?.children.length ?? 0)
        if (tallFoer < 3) {
          throw new Error(`bare ${tallFoer} tall ved vanlig tekst — sjanse, Kp og `
            + 'solvind kommer alle fra demoen og skal alltid stå der')
        }
        await evalMedTak(page, () => { document.documentElement.style.fontSize = '32px' })
        await page.waitForTimeout(400)
        const nordlysMaal = await evalMedTak(page, () => {
          const rot = document.documentElement
          const knapp = document.querySelector(
            'button[aria-label="Skjul nordlysvarselet og nordlyset"]')
          const pille = knapp?.closest('.nordlys-pille')
          const tall = document.querySelector('[data-nordlys-tall]')
          const m = knapp && pille && tall
            ? {
                utenfor: Math.round(knapp.getBoundingClientRect().right
                  - pille.getBoundingClientRect().right),
                bredde: Math.round(knapp.getBoundingClientRect().width),
                flyter: Math.round(pille.scrollWidth - pille.clientWidth),
                tall: tall.children.length,
                // Stablet = tall-cella brøt til en linje under hode-cella.
                stablet: tall.offsetTop > pille.firstElementChild.offsetTop,
              }
            : null
          rot.style.fontSize = ''
          return m
        })
        await page.waitForTimeout(300)
        if (!nordlysMaal) throw new Error('fant ikke X-en i nordlyspanelet ved stor tekst')
        if (nordlysMaal.utenfor > 1 || nordlysMaal.bredde < 20) {
          throw new Error(`X-en klippes ved stor tekst: ${nordlysMaal.utenfor} px utenfor `
            + `pilla, ${nordlysMaal.bredde} px bred`)
        }
        if (nordlysMaal.flyter > 1) {
          throw new Error(`pilla flyter over med ${nordlysMaal.flyter} px ved stor tekst `
            + '— tall-cella krymper ikke (mangler `min-width: 0`?)')
        }
        if (nordlysMaal.tall < tallFoer) {
          throw new Error(`${tallFoer} tall ved vanlig tekst, ${nordlysMaal.tall} ved 200 % — `
            + 'de svarer på hvert sitt spørsmål, og skal få en linje til i stedet for å falle bort')
        }
        if (!nordlysMaal.stablet) {
          throw new Error('tallene sto fortsatt på hode-linja ved 200 % tekst — '
            + '`flex-basis: max-content` på .nordlys-tall er trolig borte')
        }

        // X-EN TAR BORT BÅDE PANELET OG GARDINENE, som i værraden (v6.3.8).
        // Vi kan ikke lese gardinene fra DOM-en, men de henger på det SAMME
        // flagget — så at panelet forsvinner er kjeden vi kan måle.
        const X = 'button[aria-label="Skjul nordlysvarselet og nordlyset"]'
        await page.locator(X).click({ timeout: 8000 })
        await page.waitForTimeout(400)
        if (await evalMedTak(page, () => /SJANSE/i.test(document.body.innerText))) {
          throw new Error('X-en tok ikke bort nordlyspanelet')
        }
        await rydd()
        // NØYTRAL TILSTAND: ut av natta igjen, som de andre natt-sjekkene.
        await lukkNatt3d(page, h.startSteg)
        return `panelet kom med styrke, sjanse, Kp og solvind; X-en tok det bort`
      } catch (e) {
        await rydd()
        throw e
      }
    },
  },
  {
    // v6.5.57. Sjekken over går inn i natta ved å TRYKKE. Denne åpner 3D som
    // allerede står der — og det var nettopp den stien som var brutt: mount-
    // lista startet nordlysdemoen, men ikke det ekte varselet, så `nightOn`
    // endret seg aldri, watch(nightOn) fyrte aldri, og panelet kom først etter
    // en tur innom dag og tilbake.
    //
    // TO TING GJØR DEN DETERMINISTISK, og begge er nødvendige:
    // 1. EGEN KONTEKST MED FORSKJØVET KLOKKE. Om 3D åpner i natt avgjøres av
    //    solas høyde over arket (v6.1.0), altså av når CI kjører — en sjekk som
    //    bare virker om kvelden er en sjekk som blir grønn ved et tilfelle. Vi
    //    flytter `Date` til en januarnatt over Vardåsen. Klokka GÅR fortsatt
    //    (bare et fast tillegg): `page.clock` ville frosset timerne som 3D-
    //    byggingen henger på. Konteksten er egen fordi et addInitScript ikke kan
    //    tas bort igjen, og den ville da fulgt hver senere sjekk.
    // 2. NOAA STUBBES. Panelet skal vises fordi hentingen ble STARTET, ikke
    //    fordi sola tilfeldigvis er urolig — OVATION ga 0 % over Vardåsen den
    //    natta laget ble bygget. Stubben gir 42 % rett over arket.
    navn: 'nordlysvarselet kommer også når 3D åpner rett i natt',
    domene: 'Viewer3D (nordlys ved montering)',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      const nattCtx = await egenKontekst(page, {
        viewport: { width: 430, height: 900 },
        permissions: ['geolocation'],
        geolocation: { latitude: 59.8412, longitude: 10.4123 },
      })
      // Fast tillegg på Date — ikke en frossen klokke. Konstruktøren uten
      // argumenter og Date.now() forskyves; alt annet er den ekte Date.
      await nattCtx.addInitScript((maal) => {
        const Ekte = Date
        const naa = Ekte.now.bind(Ekte)
        const delta = maal - naa()
        // Subklasse og ikke Proxy: en Proxy videresender `Skjov.now = …` til
        // TARGET, altså den ekte Date.now — som da kaller seg selv i evig løkke.
        // Målt: «Maximum call stack size exceeded» ved første oppslag.
        class Skjov extends Ekte {
          constructor(...a) { super(...(a.length ? a : [naa() + delta])) }
          static now() { return naa() + delta }
        }
        window.Date = Skjov
      }, Date.UTC(2026, 0, 15, 23, 0, 0))

      const noaa = []
      await nattCtx.route('**/services.swpc.noaa.gov/**', (rute) => {
        const u = rute.request().url()
        noaa.push(u)
        const svar = (o) => rute.fulfill({ contentType: 'application/json', body: JSON.stringify(o) })
        if (/ovation_aurora_latest/.test(u)) {
          return svar({
            'Observation Time': '2026-01-15T22:50:00Z',
            'Forecast Time': '2026-01-15T23:50:00Z',
            // [lon 0–360, lat, prosent]. Tett rutenett rundt Vardåsen, pluss
            // ovalen et stykke nordover så gardinene får en høyde å stå i.
            coordinates: [
              [10, 59, 42], [10, 60, 42], [11, 59, 42], [11, 60, 42],
              [10, 66, 80], [11, 66, 80],
            ],
          })
        }
        if (/planetary_k_index_1m/.test(u)) {
          return svar([{ time_tag: '2026-01-15T22:59:00Z', estimated_kp: 5.3 }])
        }
        if (/solar-wind-speed/.test(u)) return svar({ proton_speed: 612 })
        if (/solar-wind-mag-field/.test(u)) return svar({ bt: 14, bz_gsm: -9 })
        return svar({})
      })

      const p2 = await nattCtx.newPage()
      const jsFeil = []
      p2.on('pageerror', (e) => jsFeil.push(e.message))
      try {
        await p2.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await p2.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await lukkDrawer(p2)
        await klikkSnarvei(p2, 'tre-d')
        const klar = await p2.waitForFunction(() => {
          const c = document.querySelector('canvas')
          if (c && c.width > 0) return 'canvas'
          if (/Ingen høydedata/i.test(document.body.innerText)) return 'ingen-dem'
          return false
        }, null, { timeout: 60_000 }).then((h) => h.jsonValue())
        if (klar === 'ingen-dem') {
          return 'ingen-dem-melding — nordlyset ved montering kan ikke prøves uten terreng'
        }
        await p2.waitForFunction(
          () => !/Skjerper kartbildet/i.test(document.body.innerText),
          null, { timeout: 45_000 },
        ).catch(() => { /* meldingen kan ha kommet og gått */ })

        // OVERLEGGET MÅ VÆRE `ready` FØR VI LESER DET. Knappene står bak
        // `v-if="phase === 'ready'"`, så et oppslag rett etter at lerretet har
        // fått bredde treffer et overlegg uten en eneste knapp — og
        // `lesSolMaaneSteg` svarer da `null`, som leses som «vi kom ikke i
        // natt». `aapneNatt3d` skjuler dette bak en fast venting på 800 ms;
        // her ventes det på det vi faktisk trenger.
        await p2.waitForFunction((steg) => [...document.querySelectorAll('button[aria-label]')]
          .some((b) => steg.includes(b.getAttribute('aria-label'))),
        SOLMAANE_STEG, { timeout: 30_000 })

        // FORUTSETNINGEN FØRST: står vi faktisk i natt uten å ha trykket? Feiler
        // klokke-skjøvet, skal sjekken si DET og ikke «nordlyset mangler».
        const steg = await lesSolMaaneSteg(p2)
        if (steg !== 'Bytt til dag') {
          throw new Error(`3D åpnet ikke i natt (sol/måne sier «${steg}») — `
            + 'klokke-skjøvet i denne sjekken virker ikke lenger')
        }

        // Panelet — uten et eneste trykk.
        const tekst = await p2.waitForFunction(() => {
          const t = document.body.innerText
          return /NORDLYS/i.test(t) && /SJANSE/i.test(t) ? t : false
        }, null, { timeout: 30_000 }).then((h) => h.jsonValue())
          .catch(() => null)
        if (!tekst) {
          throw new Error('nordlyspanelet kom ikke av seg selv i natt — '
            + `mount-stien starter det ikke (NOAA-kall: ${noaa.length})`)
        }
        if (!noaa.length) throw new Error('nordlyspanelet står der, men NOAA ble aldri spurt')
        if (!/42\s*%/.test(tekst)) {
          throw new Error(`sjansen fra stubben (42 %) står ikke i panelet: ${tekst.slice(0, 200)}`)
        }
        if (jsFeil.length) throw new Error(`JS-feil i natt-konteksten: ${jsFeil[0]}`)
        return `panelet kom uten et trykk, med 42 % fra ${noaa.length} NOAA-kall`
      } finally {
        await nattCtx.close().catch(() => {})
      }
    },
  },
  {
    // v6.4.0. Halve himmelen er stjerner som ikke inngår i en figur vi tegner —
    // Sirius, Aldebaran, Altair, Antares — og fram til nå kunne man ikke spørre
    // hva de var. Eieren leste en skjerm med prikker uten streker som en FEIL,
    // og det er en rimelig lesning når ingenting svarer på et trykk.
    //
    // Sjekken TRYKKER: den finner en stjerne-rad i lista, velger den, åpner
    // kortet og krever at kortet forteller hvem stjerna er. Enhetstestene dekker
    // lista og teksten hver for seg; det er kjeden fra rad til kort ingen av dem
    // ser.
    navn: 'en løs stjerne kan velges og forteller hvem den er',
    domene: 'himmelObjekter + Tour3dHimmelKort (stjerner)',
    krever: 'ektekart',
    maksMs: 180_000,
    async kjør(page) {
      const h = await aapneNatt3d(page)
      if (h.hoppet) return h.hoppet

      const aapneLista = async () => {
        const pille = page.locator('button[aria-label="Finn et stjernebilde eller en planet"], '
          + 'button[aria-label^="Valgt:"]').first()
        await pille.click({ timeout: 8000 })
        await page.waitForSelector('ul[aria-label="Treff på himmelen"]', { timeout: 8000 })
      }
      await aapneLista()

      // Stjerne-radene kjennes på undertittelen, som himmelUndertekst skriver.
      // Vi tar den ØVERSTE, som er den lyseste — den er lettest å se etterpå.
      const stjerne = await evalMedTak(page, () => {
        const rad = [...document.querySelectorAll('ul[aria-label="Treff på himmelen"] li button')]
          .find((b) => /^Stjerne(\s|$)/.test(
            (b.querySelectorAll('span.block')[1]?.textContent ?? '').trim(),
          ))
        return rad ? (rad.querySelector('span.block')?.textContent ?? '').trim() : null
      })
      // Minst sju løse stjerner er over horisonten fra Norge til enhver tid
      // (målt over et helt år på 61°N). Er lista tom for dem, er det lista som
      // er brutt — ikke astronomien.
      if (!stjerne) throw new Error('ingen enkeltstjerne i himmellista')

      await page.locator('ul[aria-label="Treff på himmelen"] li button')
        .filter({ hasText: stjerne }).first().click({ timeout: 5000 })
      await page.waitForTimeout(900)

      // Et valg fra lista gir SAMMENLAGT kort (v6.3.11) — innholdet finnes bare
      // i det åpne, så vi må trykke det opp.
      await page.locator(`button[aria-label="Vis mer om ${stjerne}"]`).click({ timeout: 8000 })
      await page.waitForTimeout(400)

      const kort = await evalMedTak(page, () => document.body.innerText)
      if (!kort.includes(stjerne)) {
        throw new Error(`valgte «${stjerne}», men kortet nevner den ikke`)
      }
      if (!/hører til/.test(kort)) {
        throw new Error(`kortet for «${stjerne}» sier ikke hvilket stjernebilde den hører til`)
      }
      // SVARET PÅ «ER DETTE EN FEIL?» skal stå i kortet og ikke bare i en
      // CHANGELOG: vi tegner ikke figuren, derfor står stjerna uten streker.
      //
      // CASE-UFØLSOMT MED VILJE: `innerText` gjengir teksten SLIK DEN VISES, og
      // seksjonsoverskriftene i kortet har `uppercase` i CSS — Chrome svarer
      // altså «UTEN STREKER». Første utgave av sjekken feilet på nettopp det,
      // med et kort som var helt riktig.
      if (!/uten streker/i.test(kort)) {
        throw new Error(`kortet for «${stjerne}» forklarer ikke hvorfor den står alene`)
      }

      await page.locator('button[aria-label="Lukk infokortet"]').click({ timeout: 5000 })
        .catch(() => { /* kortet kan alt være lukket */ })
      await page.waitForTimeout(300)
      await lukkNatt3d(page, h.startSteg)
      return `valgte «${stjerne}» fra lista; kortet ga stjernebilde og forklaring`
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
      // NORDLYSPANELET ER ET BEVISST UNNTAK fra «alt annet er borte» (v6.5.15),
      // på linje med himmelsøket og av samme grunn: det er nettopp det man slo
      // på natta for å se. Listene over er derfor navngitte forbud og ikke en
      // telling — en telling ville gjort hvert nytt natt-element til en rød.
      

      // HIMMELKOMPASSET nede til høyre. Grafikken kan ikke leses fra en test,
      // men aria-labelen ER retningen i ord — og den er dermed også sjekken på
      // at blikk-eventet henger sammen hele veien fra kameramatrisen til SVG-en.
      // Kompasset er en KNAPP fra v6.1.1 (trykk = vend mot nord), og labelen
      // bærer retningen i ord — den er dermed også sjekken på at blikk-eventet
      // henger sammen hele veien fra kameramatrisen til SVG-en.
      const KOMPASS = 'button[aria-label^="Du ser mot"]'
      const lesKompass = () => evalMedTak(page, (sel) => document
        .querySelector(sel)?.getAttribute('aria-label') ?? null, KOMPASS)
      const forDrag = await page.waitForFunction((sel) => document
        .querySelector(sel)?.getAttribute('aria-label'),
      KOMPASS, { timeout: 15_000 }).then((x) => x.jsonValue())
      if (!forDrag) throw new Error('himmelkompasset kom ikke i nattmodus')

      // INNGANGEN TIL NATTA STILLER KAMERAET TILBAKE TIL OVERSIKTEN OG SER NORD
      // (v6.4.0). Man kommer nesten alltid hit fra dagmodus etter å ha panorert
      // rundt, og før dette lå blikket der turen tilfeldigvis endte — man visste
      // ikke hvilken vei man så, og da bærer ingen stjernebildetekst.
      //
      // DETTE ER DEN ENESTE MÅLINGEN AV DEN REGELEN. Enhetstestene ser
      // `seMot(freeRig.blikkAzimut, …)`, altså at asimuten ikke endres — de kan
      // ikke se hvilken asimut riggen faktisk sto i. Kompassets aria-label kan.
      if (!/^Du ser mot nord/.test(forDrag)) {
        throw new Error(`nattmodus åpnet med blikket mot «${forDrag}» — inngangen `
          + 'skal nullstille kameraet til oversikten, som er nordvendt')
      }

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

      // TRYKK PÅ KOMPASSET vender kameraet mot nord — den ene handlingen et
      // kompass skal ha. Vi drar oss først bort fra nord (gjort over), så kravet
      // er entydig: etterpå skal labelen si nord.
      await page.locator(KOMPASS).click({ timeout: 8000 })
      await page.waitForTimeout(1600)
      const etterNord = await lesKompass()
      if (!/^Du ser mot nord/.test(etterNord ?? '')) {
        throw new Error(`trykk på kompasset ga «${etterNord}», ikke nord`)
      }
      // Og høyden skal være beholdt: et trykk snur deg om, det drar ikke blikket
      // ned i bakken. Blikket sto på ~50° etter nattmodus' eget løft.
      const grader = Number((etterNord.match(/,\s*(-?\d+)°/) ?? [])[1])
      if (!(grader > 20)) {
        throw new Error(`kompass-trykket tok blikket ned til ${grader}° — høyden skal beholdes`)
      }

      await lukkNatt3d(page, h.startSteg)
      return `igjen sto ${i.labels.length} knapper; kompasset gikk «${forDrag}» → «${etterDrag}»`
        + `, trykk ga nord på ${grader}°`
    },
  },
  {
    // v6.6.4: «Hold skjermen våken» har verken knapp eller tekst — sliderens tall
    // og den gule ringen rundt hamburgeren ER hele grensesnittet. Ringen tegnes
    // av `ringDash`, som er enhetstestet, men INGEN enhetstest kan se at ringen
    // faktisk havner i DOM-en, at den forsvinner igjen på 0, eller at
    // nedtellingen når hamburger-knappen — den bor i et annet komponenttre,
    // teleportert til <body>, og bindes bare gjennom singletonen.
    navn: 'hold skjermen våken: slider i menyen gir ring på hamburgeren',
    domene: 'useHoldVaken + AppMenu + AppMenuButton',
    async kjør(page) {
      await page.locator('button[aria-label^="Åpne meny"]').click({ timeout: 10_000 })
      const meny = page.locator('aside[aria-label="Hovedmeny"]')
      await meny.waitFor({ state: 'visible', timeout: 10_000 })

      const slider = meny.locator('.am-wake-range')
      if (!await slider.count()) throw new Error('fant ingen «hold skjermen våken»-slider i hovedmenyen')
      const meta = meny.locator('.am-wake-meta')
      if ((await meta.innerText()).trim() !== 'Av') {
        throw new Error('nedtellingen sto PÅ før noen dro i slideren')
      }
      const ring = page.locator('[data-hovedmeny-knapp] svg circle')
      if (await ring.count()) throw new Error('ringen var tegnet før nedtellingen startet')

      await slider.fill('30')
      const tekst = (await meta.innerText()).trim()
      if (tekst !== '30 minutter igjen') throw new Error(`slideren svarte «${tekst}»`)
      // Merket i hjørnet (v6.6.5): ringen sier hvor langt det er igjen, tallet
      // sier hvor mange minutter. Det bor i et annet komponenttre enn
      // slideren, så bare en ekte måling ser at de to er i takt.
      const merke = page.locator('[data-hovedmeny-knapp] .vaken-merke')
      const merketekst = (await merke.innerText()).trim()
      if (merketekst !== '30') throw new Error(`merket i hjørnet sa «${merketekst}», ikke 30`)
      await ring.waitFor({ state: 'attached', timeout: 5000 })
      const strek = await ring.getAttribute('stroke')
      if (strek !== '#ffd84a') throw new Error(`ringen er ikke gul, men «${strek}»`)
      // Full andel = hele omkretsen tegnet, altså offset 0. Er den negativ her,
      // spises ringen feil vei fra første bilde.
      const offset = Number(await ring.getAttribute('stroke-dashoffset'))
      if (offset !== 0) throw new Error(`ringen startet på dashoffset ${offset}, ikke 0`)
      const label = await page.locator('[data-hovedmeny-knapp]').getAttribute('aria-label')
      if (!/våken i 30 minutter/.test(label ?? '')) {
        throw new Error(`hamburgerens aria-label sier ingenting om nedtellingen: «${label}»`)
      }

      // NØYTRAL TILSTAND: 0 slår av igjen, ellers står ringen og teller mens de
      // neste sjekkene måler farger og trefflater på kartet.
      await slider.fill('0')
      if ((await meta.innerText()).trim() !== 'Av') throw new Error('0 slo ikke av nedtellingen')
      if (await ring.count()) throw new Error('ringen ble stående etter at nedtellingen ble slått av')
      if (await merke.count()) throw new Error('merket ble stående etter at nedtellingen ble slått av')

      await page.keyboard.press('Escape')
      await meny.waitFor({ state: 'hidden', timeout: 8000 })
      return 'slider → 30 min ga gul ring, merke «30» og aria-label; 0 ryddet dem bort'
    },
  },
  {
    // v6.5.50: `checkForUpdateNow()` i lib/swUpdate.js ble skrevet for en
    // «Se etter oppdatering»-knapp som ble igjen i svg-insights da Lende ble
    // skilt ut — funksjonen sto med NULL kallere, og appen hadde ingen manuell
    // vei til en ny versjon. Ingen enhetstest kan se det: en ubrukt eksport er
    // helt gyldig kode, og et manglende kallsted er nettopp ingenting. Derfor
    // måles knappen her, der den faktisk må stå og svare.
    navn: 'versjonslinja i hovedmenyen kan se etter oppdatering',
    domene: 'VersjonSjekk + swUpdate',
    async kjør(page) {
      await page.locator('button[aria-label="Åpne meny"]').click({ timeout: 10_000 })
      const meny = page.locator('aside[aria-label="Hovedmeny"]')
      await meny.waitFor({ state: 'visible', timeout: 10_000 })

      const versjon = meny.locator('.vs-rad')
      if (!await versjon.count()) throw new Error('fant ingen versjonslinje i hovedmenyen')
      const linje = (await versjon.first().innerText()).trim()
      if (!/Versjon \d+\.\d+\.\d+/.test(linje)) {
        throw new Error(`versjonslinja mangler versjonsnummeret: «${linje}»`)
      }

      const knapp = meny.locator('button.vs-knapp')
      if (!await knapp.count()) throw new Error('«Se etter oppdatering» finnes ikke i versjonslinja')
      const status = meny.locator('.vs-status')
      if ((await status.innerText()).trim()) {
        throw new Error('statuslinja hadde tekst FØR noen spurte')
      }

      await knapp.first().click({ timeout: 10_000 })
      // Utfallet avhenger av om preview-serveren rakk å registrere en SW, og
      // begge svarene er riktige — det som måles er at knappen svarer I DET HELE
      // TATT. En knapp som blir stående taus er den ene feilen som ikke synes.
      await status.filter({ hasText: /\S/ }).waitFor({ state: 'visible', timeout: 20_000 })
      const svar = (await status.innerText()).trim()
      const kjente = [
        'Ser etter ny versjon …', 'Ny versjon er klar.',
        'Du har nyeste versjon.', 'Kan ikke sjekke her.', 'Fikk ikke kontakt. Prøv igjen.',
      ]
      if (!kjente.includes(svar)) throw new Error(`ukjent svar fra versjonssjekken: «${svar}»`)

      // NØYTRAL TILSTAND: menyen lukkes igjen, ellers står den over kartet og
      // neste sjekk finner ingenting å trykke på.
      await page.keyboard.press('Escape')
      await meny.waitFor({ state: 'hidden', timeout: 8000 })
      return `versjonslinja svarte «${svar}»`
    },
  },
  {
    // v6.5.39: «Mine kart» ble stående oppå kartet når man valgte kartet man
    // ALLEREDE sto i. AppMenu lukker modalen på en rute-watch, og en push til
    // gjeldende rute er en no-op — `route.fullPath` endrer seg ikke, så watchen
    // fyrer aldri. Med ETT lagret kart traff det hver gang: boot-gjenopptaket
    // sender deg rett inn i det ene kartet du har, så raden i lista ER kartet du
    // står i. Med to kart traff man vanligvis det andre og så det aldri.
    //
    // Ingen enhetstest kan se dette — det bor i AppMenu + MapLibrary + router
    // sammen — så det måles her, og med ETT kart i basen, som er tilfellet som
    // brakk. Sjekken seeder derfor IndexedDB selv og rydder etter seg.
    navn: 'Mine kart lukker seg når man velger kartet man alt står i',
    domene: 'AppMenu + MapLibrary',
    async kjør(page) {
      const ID = 'royk-ett-kart'
      const seed = () => evalMedTak(page, async (id) => {
        const svg = await fetch(`${location.pathname.split('/kart/')[0]}/maps/vardasen.svg`)
          .then((r) => r.text())
        const post = {
          id, navn: 'Røyk-arket', svg, opprettet: Date.now(),
          bbox: { south: 59.79, north: 59.84, west: 10.37, east: 10.46 },
          equidistanceM: 20, isAuto: false, partial: false, annotations: [], tracks: [],
        }
        const db = await new Promise((ok, nei) => {
          const r = indexedDB.open('lende-maps', 3)
          r.onsuccess = () => ok(r.result)
          r.onerror = () => nei(r.error)
        })
        await new Promise((ok, nei) => {
          const t = db.transaction(['maps', 'meta'], 'readwrite')
          t.objectStore('maps').put(post)
          const { svg: _s, annotations: _a, tracks: _t, ...lett } = post
          t.objectStore('meta').put({ ...lett, hasDem: false, sizeBytes: svg.length })
          t.oncomplete = ok
          t.onerror = () => nei(t.error)
        })
        db.close()
      }, ID)

      const rydd = async () => {
        await evalMedTak(page, async (id) => {
          const db = await new Promise((ok, nei) => {
            const r = indexedDB.open('lende-maps', 3)
            r.onsuccess = () => ok(r.result)
            r.onerror = () => nei(r.error)
          })
          await new Promise((ok) => {
            const t = db.transaction(['maps', 'meta'], 'readwrite')
            t.objectStore('maps').delete(id)
            t.objectStore('meta').delete(id)
            t.oncomplete = ok
            t.onerror = ok
          })
          db.close()
        }, ID).catch(() => {})
        await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
      }

      try {
        await seed()
        // STÅ I kartet. Det er hele forutsetningen: navigasjonen lista utløser
        // er da en no-op, og det er nettopp den rute-watchen ikke ser.
        await page.goto(`${BASE}/kart/${ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })

        await page.locator('button[aria-label="Åpne meny"]').click({ timeout: 10_000 })
        await page.locator('aside[aria-label="Hovedmeny"]')
          .waitFor({ state: 'visible', timeout: 10_000 })
        await page.locator('button.am-row-main', { hasText: 'Mine kart' })
          .click({ timeout: 10_000 })

        const modal = page.locator('[role="dialog"][aria-label="Mine kart"]')
        await modal.waitFor({ state: 'visible', timeout: 10_000 })
        // Modalen er synlig FØR lista er lest: `listMaps()` er et async
        // IndexedDB-oppslag, og `count()` venter ikke. Uten en waitFor er
        // sjekken en kappestrid mot databasen som den taper når runneren har
        // en treg dag.
        const rad = modal.locator('div.font-medium', { hasText: 'Røyk-arket' })
        await rad.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
        const antall = await rad.count()
        if (antall !== 1) throw new Error(`ventet ETT kart i lista, fant ${antall}`)

        await rad.first().click({ timeout: 10_000 })
        // Modalen skal være borte. Uten fiksen står den her for alltid.
        await modal.waitFor({ state: 'hidden', timeout: 8000 })
        return 'ett kart, samme rute — modalen lukket'
      } finally {
        await rydd().catch(() => {})
      }
    },
  },
  {
    // v6.5.52. Stjernemerkingen bor i tre lag som ingen enhetstest ser sammen:
    // kart-recorden i IndexedDB, ringen som pipelinen tegner inn i SVG-en, og
    // pilla i «Mine kart». Sjekken seeder derfor sitt eget kart — Vardåsen har
    // ingen record, og `kanLagre` er falsk nettopp der — og legger to
    // kulturminne-markører i arket, der BARE den ene er stjernemerket. To
    // retninger er hele poenget: en `merkAlle` som ringer alt, eller ingenting,
    // ville sett like grønn ut med bare den positive halvdelen.
    navn: 'stjernemerket kulturminne får ring, og kartet får pille',
    domene: 'useStjerneminner + MapLibrary',
    async kjør(page) {
      const ID = 'royk-stjerneminne'
      const rydd = async () => {
        await evalMedTak(page, async (id) => {
          const db = await new Promise((ok, nei) => {
            const r = indexedDB.open('lende-maps', 3)
            r.onsuccess = () => ok(r.result)
            r.onerror = () => nei(r.error)
          })
          await new Promise((ok) => {
            const t = db.transaction(['maps', 'meta'], 'readwrite')
            t.objectStore('maps').delete(id)
            t.objectStore('meta').delete(id)
            t.oncomplete = ok
            t.onerror = ok
          })
          db.close()
        }, ID).catch(() => {})
        await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
      }

      try {
        await evalMedTak(page, async (id) => {
          const rå = await fetch(`${location.pathname.split('/kart/')[0]}/maps/vardasen.svg`)
            .then((r) => r.text())
          // To markører av samme form som useHeritageLayers bygger: en <g> med
          // data-kulturminne-id, plassert i meter-rommet.
          const markorer =
            '<g data-kulturminne-id="royk-1" transform="translate(400,400)">' +
            '<circle r="1.2" fill="#b03a2e"/></g>' +
            '<g data-kulturminne-id="royk-2" transform="translate(600,400)">' +
            '<circle r="1.2" fill="#b03a2e"/></g>'
          const svg = rå.replace(/<\/svg>\s*$/, `${markorer}</svg>`)
          const post = {
            id, navn: 'Stjerne-arket', svg, opprettet: Date.now(),
            bbox: { south: 59.79, north: 59.84, west: 10.37, east: 10.46 },
            equidistanceM: 20, isAuto: false, partial: false, annotations: [], tracks: [],
            stjerneminner: ['k:royk-1'],
          }
          const db = await new Promise((ok, nei) => {
            const r = indexedDB.open('lende-maps', 3)
            r.onsuccess = () => ok(r.result)
            r.onerror = () => nei(r.error)
          })
          await new Promise((ok, nei) => {
            const t = db.transaction(['maps', 'meta'], 'readwrite')
            t.objectStore('maps').put(post)
            const { svg: _s, annotations: _a, tracks: _t, ...lett } = post
            t.objectStore('meta').put({ ...lett, hasDem: false, sizeBytes: svg.length })
            t.oncomplete = ok
            t.onerror = () => nei(t.error)
          })
          db.close()
        }, ID)

        await page.goto(`${BASE}/kart/${ID}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
        await page.waitForFunction(
          () => !!document.querySelector('[data-kulturminne-id="royk-1"] > .stjerne-ring'),
          null, { timeout: 15_000 })

        const ring = await evalMedTak(page, () => {
          const merket = document.querySelector('[data-kulturminne-id="royk-1"] > .stjerne-ring')
          const umerket = document.querySelector('[data-kulturminne-id="royk-2"] > .stjerne-ring')
          const cs = getComputedStyle(merket)
          return {
            umerket: !!umerket,
            farge: cs.color,
            treff: cs.pointerEvents,
            pulser: merket.querySelectorAll('.stjerne-puls').length,
            // Ringen skal ligge UNDER symbolet, altså først i markøren.
            forst: merket.parentElement.firstElementChild === merket,
          }
        })
        if (ring.umerket) throw new Error('markør uten stjerne fikk ring likevel')
        // De to valørene fra stjerneRingFarge(): mørkt ark #ffd24a, lyst #8a5f00.
        const FARGER = ['rgb(255, 210, 74)', 'rgb(138, 95, 0)']
        if (!FARGER.includes(ring.farge)) throw new Error(`uventet ringfarge: ${ring.farge}`)
        if (ring.treff !== 'none') throw new Error(`ringen tar trykk (${ring.treff})`)
        if (ring.pulser !== 2) throw new Error(`ventet to pulser, fant ${ring.pulser}`)
        if (!ring.forst) throw new Error('ringen ligger over symbolet, ikke under')

        await page.locator('button[aria-label="Åpne meny"]').click({ timeout: 10_000 })
        await page.locator('aside[aria-label="Hovedmeny"]')
          .waitFor({ state: 'visible', timeout: 10_000 })
        await page.locator('button.am-row-main', { hasText: 'Mine kart' })
          .click({ timeout: 10_000 })
        const modal = page.locator('[role="dialog"][aria-label="Mine kart"]')
        await modal.waitFor({ state: 'visible', timeout: 10_000 })
        const pille = modal.locator('span[title*="stjernemerke"]')
        await pille.first().waitFor({ state: 'visible', timeout: 10_000 })
        const tekst = (await pille.first().innerText()).trim()
        if (!tekst.endsWith('1')) throw new Error(`ventet «1» i pilla, fant «${tekst}»`)

        await page.keyboard.press('Escape')
        return `ring i kartet (${ring.farge}), pille med 1 i Mine kart`
      } finally {
        await rydd().catch(() => {})
      }
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
  {
    // v6.5.43: A-knappen i infopanelenes hode. Enhetstesten dekker regelen
    // (`nesteTextScale`), men ikke at knappen sitter i skuffen, at den treffer
    // den globale singletonen, eller at skuffen tåler resultatet. Sjekken
    // TRYKKER derfor og LESER `zoom` på flata under.
    navn: 'A-knappen i skuffen skrur tekststørrelsen',
    domene: 'useUiTextScale',
    async kjør(page) {
      await åpneDrawer(page)
      const knapp = page.locator('button[aria-label^="Tekststørrelse i grensesnittet"]').first()
      if (!(await knapp.count())) throw new Error('fant ingen A-knapp i skuffens hode')
      const zoomNå = () => page.evaluate(() => {
        const el = [...document.querySelectorAll('[style*="zoom"]')]
          .find((n) => n.offsetParent && n.closest('.drawer-shell, [class*="drawer"]'))
        return el ? getComputedStyle(el).zoom : null
      })
      const før = await zoomNå()
      await knapp.click()
      await page.waitForTimeout(300)
      const etter = await zoomNå()
      const etikett = await knapp.getAttribute('aria-label')
      if (etter === før) throw new Error(`zoom sto stille på ${før} etter trykk`)
      if (!/125 prosent/.test(etikett || '')) {
        throw new Error(`knappen bærer ikke sin egen tilstand: «${etikett}»`)
      }
      // Skuffen må fortsatt kunne rulles til bunns — en tekstskala som skyver
      // fanene ut av flata er verre enn ingen knapp.
      const rull = await page.evaluate(() => {
        const el = [...document.querySelectorAll('div')]
          .find((n) => n.offsetParent && n.scrollHeight > n.clientHeight + 4 && /KARTLAG/.test(n.innerText))
        if (!el) return null
        el.scrollTop = el.scrollHeight
        return el.scrollTop > 0
      })
      // NØYTRAL TILSTAND: skalaen er global og persistert. Rund tilbake til
      // 100 % framfor å la neste sjekk måle en 125 %-layout.
      for (let i = 0; i < 3; i++) { await knapp.click(); await page.waitForTimeout(200) }
      const tilbake = await knapp.getAttribute('aria-label')
      await lukkDrawer(page)
      if (!/100 prosent/.test(tilbake || '')) throw new Error(`rundet ikke tilbake: «${tilbake}»`)
      return `zoom ${før} → ${etter}, skuffen ruller ${rull}, runder tilbake til 100 %`
    },
  },
  {
    // v6.5.43: manifestet låste den installerte appen til høykant. Nå roterer
    // den, og da må liggende faktisk være brukbart. Enhetstesten ser bare
    // manifest-feltet; dette måler layouten i den retningen ingen sjekk hittil
    // har sett.
    navn: 'kartet tåler liggende skjerm',
    domene: 'MapView',
    async kjør(page) {
      const mål = async () => page.evaluate(() => {
        const d = document.documentElement
        let verst = null
        for (const el of document.querySelectorAll('.kart-ui *')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (getComputedStyle(el).position === 'absolute' && el.tagName === 'IMG') continue
          const ut = Math.round(r.right - innerWidth)
          if (ut > 2 && (!verst || ut > verst.ut)) {
            verst = { ut, hvem: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}` }
          }
        }
        return { doc: d.scrollWidth - d.clientWidth, verst }
      })
      const stående = await mål()
      // EN RØD SJEKK HER MÅ IKKE FORGIFTE DE NESTE (v7.1.1). Restaureringen av
      // viewporten sto SIST i kroppen, så det første kastet hoppet over den og
      // lot hele resten av suiten kjøre på 900 × 430. Chat-sjekken ved 200 %
      // tekst ble rød av nettopp det, ikke av noe i chatten. `finally` gir
      // mobil-viewporten tilbake uansett hvordan sjekken ender.
      try {
        await page.setViewportSize({ width: 900, height: 430 })
        await page.waitForTimeout(700)
        const liggende = await mål()
        // Sammenlikningen er mot STÅENDE og ikke mot null: kart-SVG-en og de
        // dokkede lende-pilene stikker utenfor i begge retninger med vilje, så en
        // absolutt terskel ville vært rød fra dag én. Spørsmålet er om ROTASJONEN
        // gjorde det verre.
        if (liggende.doc > stående.doc + 1) {
          throw new Error(`dokumentet renner ut i liggende: ${liggende.doc} px mot ${stående.doc} px stående`)
        }
        // Skuffen må åpne og lukke på 430 px høyde — det er den flata som har
        // minst å gå på når høyden halveres.
        await åpneDrawer(page)
        // Spørsmålet er om skuffen er BRUKBAR, ikke om den tilfeldigvis renner
        // over: på 900 px bredde kan innholdet få plass, og en sjekk som krever
        // en rulleflate ville da vært rød uten at noe var galt. Måler derfor at
        // fane-knappen finnes, er synlig, og ligger innenfor viewporten.
        const skuff = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')]
            .find((n) => n.offsetParent && /^KARTLAG$/.test(n.innerText.trim()))
          if (!b) return null
          const r = b.getBoundingClientRect()
          const treff = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return {
            innenfor: r.top >= -1 && r.bottom <= innerHeight + 1,
            trykkbar: !!treff && b.contains(treff),
            // Overlegget skal ikke kunne rulles i det hele tatt (v6.5.68) — er
            // det rullet, har noe fått fokus utenfor kanten og dratt hele
            // kart-chromet med seg.
            rullet: Math.round(document.querySelector('.kart-ui')?.scrollTop || 0),
            // Navigasjonssøyla skal holde seg innenfor skjermen og rulle i seg
            // selv når den ikke får plass — renner den ut, er de nederste
            // knappene ikke til å nå.
            søyleUt: (() => {
              const g = document.querySelector('.nav-soyle')
              return g ? Math.round(g.getBoundingClientRect().bottom - innerHeight) : null
            })(),
            // OG SØYLA SKAL IKKE TEGNE RULLEFELT (v6.5.69). Taket over gjorde
            // den rullbar, og telefonen tegnet da rullefelt oppå kartet: en grå
            // strek langs knappene og en under den nederste.
            // DENNE MÅLER DEKLARASJONEN OG IKKE PIKSLENE, og det er en målt
            // begrensning: headless Chromium bruker overleggs-rullefelt, så
            // `offsetWidth − clientWidth` er 0 enten feltet er skjult eller
            // ikke — en piksel-sjekk her kunne ALDRI blitt rød. Det som kan bli
            // rødt er at CSS-en forsvinner, og det er også slik feilen kommer
            // tilbake. Rullingen skal fortsatt finnes, så `overflow-y` måles i
            // samme åndedrag: er den borte, er liggende-fiksen borte med den.
            søyleFelt: (() => {
              const g = document.querySelector('.nav-soyle')
              if (!g) return null
              const cs = getComputedStyle(g)
              return { sbw: cs.scrollbarWidth, ovY: cs.overflowY, ovX: cs.overflowX }
            })(),
          }
        })
        if (!skuff) throw new Error('skuffen åpnet ikke i liggende')
        if (skuff.rullet) {
          throw new Error(`kart-overlegget er rullet ${skuff.rullet} px i liggende — `
            + 'en fokusert kontroll utenfor kanten har flyttet hele chromet')
        }
        if (!skuff.innenfor) throw new Error('skuffens fane-rad ligger utenfor viewporten i liggende')
        if (!skuff.trykkbar) throw new Error('skuffens fane-rad ligger under noe annet i liggende')
        if (skuff.søyleUt == null) throw new Error('fant ikke navigasjonssøyla i liggende')
        if (skuff.søyleUt > 1) {
          throw new Error(`navigasjonssøyla stikker ${skuff.søyleUt} px under skjermkanten i `
            + 'liggende — de nederste knappene er ikke til å nå')
        }
        if (!skuff.søyleFelt) throw new Error('fant ikke navigasjonssøyla å måle rullefelt på')
        if (skuff.søyleFelt.sbw !== 'none') {
          throw new Error(`navigasjonssøyla har scrollbar-width: ${skuff.søyleFelt.sbw} — `
            + 'da tegner telefonen grå rullefelt-streker oppå kartet')
        }
        // `clip` MÅLES SOM `hidden` HER, og det er spec: er én akse `clip` og
        // den andre en rulleverdi, regnes `clip` om til `hidden`. Begge tegner
        // null rullefelt, som er det sjekken finnes for; `auto` og `scroll` er
        // de to som gjør det.
        if (!/^(hidden|clip)$/.test(skuff.søyleFelt.ovX)) {
          throw new Error(`navigasjonssøyla har overflow-x: ${skuff.søyleFelt.ovX} — `
            + 'en rulleakse ingenting trenger, som kan tegne et vannrett felt')
        }
        if (!/^(auto|scroll)$/.test(skuff.søyleFelt.ovY)) {
          throw new Error(`navigasjonssøyla har overflow-y: ${skuff.søyleFelt.ovY} — `
            + 'da ruller den ikke i seg selv, og de nederste knappene forsvinner i liggende')
        }
        await lukkDrawer(page)
        return `liggende doc-overflyt ${liggende.doc} px (stående ${stående.doc}), skuffen brukbar, `
          + 'søyla innenfor uten rullefelt og overlegget urullet'
      } finally {
        await page.setViewportSize({ width: 430, height: 900 })
        await page.waitForTimeout(600)
      }
    },
  },
  {
    // v6.5.48: kartflata var en ren peker-kontroll — drag for å panorere, hjul
    // for å zoome — altså appens kjernefunksjon uten en eneste tastatur-inngang.
    // Enhetstester ser ikke dette: regnestykket i onKartKeydown er trivielt,
    // spørsmålet er om flata i det hele tatt KAN få fokus i en nettleser.
    navn: 'kartflata panorerer og zoomer fra tastatur',
    domene: 'MapView',
    async kjør(page) {
      const trans = () => page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-map-inner]')).transform)
      const SEL = '[role="application"][aria-label^="Kartflate"]'
      if (!(await page.locator(SEL).count())) throw new Error('fant ingen role="application" på kartflata')
      await page.locator(SEL).focus()
      const fikkFokus = await page.evaluate((sel) => document.activeElement?.matches(sel), SEL)
      if (!fikkFokus) throw new Error('kartflata tok ikke fokus — mangler tabindex?')

      // Zoom først: et nylastet ark fyller skjermen, og da klamper clampPan
      // panoreringen bort. Zoomen lager rommet piltasten skal bevege seg i.
      const start = await trans()
      await page.keyboard.press('+')
      await page.waitForTimeout(400)
      const zoomet = await trans()
      if (zoomet === start) throw new Error(`pluss zoomet ikke (${start})`)
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(400)
      const panorert = await trans()
      if (panorert === zoomet) throw new Error('ArrowLeft flyttet ikke kartet')

      // NØYTRAL TILSTAND: samme vei tilbake, og slipp fokus.
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(250)
      await page.keyboard.press('-')
      await page.waitForTimeout(400)
      await page.evaluate(() => document.activeElement?.blur())
      return 'pluss zoomer, piltast panorerer, minus tilbake'
    },
  },
  {
    // v6.5.48: skuffa hadde ingen vei ut fra tastatur (X eller et drag nedover),
    // og fokus ble stående igjen ute på kartet når den åpnet. Begge halvdelene
    // måles her — en fokusflytting er per definisjon usynlig i en enhetstest.
    navn: 'innstillings-skuffa tar fokus og lukkes med Escape',
    domene: 'MapView',
    async kjør(page) {
      await åpneDrawer(page)
      await page.waitForTimeout(250)
      const inne = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Valg"]')
        if (!d) return 'ingen role=dialog på skuffa'
        if (d.getAttribute('aria-modal')) return 'skuffa satte aria-modal — kartet ved siden av er betjenbart'
        return d.contains(document.activeElement) ? null : 'fokus havnet ikke i skuffa'
      })
      if (inne) { await lukkDrawer(page); throw new Error(inne) }
      // En fokusflytting kan RULLE en `overflow-hidden` rot (det gjorde den, og
      // lende-pilene forsvant ut av viewporten). Målt her fordi det er den ene
      // bivirkningen fokus-koden har utenfor seg selv.
      const rullet = await page.evaluate(() =>
        [...document.querySelectorAll('.kart-ui')].some((e) => e.scrollTop || e.scrollLeft))
      if (rullet) { await lukkDrawer(page); throw new Error('fokuseringen rullet kart-flata — mangler preventScroll?') }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(450)
      if (await erDrawerÅpen(page)) { await lukkDrawer(page); throw new Error('Escape lukket ikke skuffa') }
      return 'fokus flyttes inn uten å rulle, Escape lukker, ingen aria-modal'
    },
  },
  {
    // v6.5.48: den globale :focus-visible-regelen er det ENE som gjør en
    // tastatur-tur mulig å følge med øynene. Den bor i style.css og kan brytes
    // av en hvilken som helst `outline-none`-klasse lenger ned i kaskaden —
    // altså en feil ingen enhetstest kan se.
    navn: 'fokusringen males på tastatur-fokus',
    domene: 'style.css',
    async kjør(page) {
      await page.evaluate(() => document.activeElement?.blur?.())
      await page.keyboard.press('Tab')
      const ring = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        const s = getComputedStyle(el)
        return {
          hvem: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40),
          bredde: s.outlineWidth,
          stil: s.outlineStyle,
        }
      })
      if (!ring) throw new Error('Tab flyttet ikke fokus til noe fokuserbart')
      if (ring.stil === 'none' || !(parseFloat(ring.bredde) >= 1)) {
        throw new Error(`ingen fokusring på «${ring.hvem}» (${ring.stil} ${ring.bredde})`)
      }
      await page.evaluate(() => document.activeElement?.blur?.())
      return `fokusring ${ring.stil} ${ring.bredde} på «${ring.hvem}»`
    },
  },
  {
    // v6.5.82: de frie sti-fargevelgerne flyttet fra Strek-FAB-panelet til
    // Innstillinger → Kartstil → «Tilpass — sti-farge», der de navngitte
    // palettene alt bodde. Enhetstestene ser CSS-en (trailColors.test.js), men
    // ikke at velgeren står i den nye fanen, treffer den samme singletonen, og
    // at «Følg tema» — seksjonens ENESTE nullstilling — faktisk rydder etter
    // seg. Sjekken SETTER en farge og LESER den ut av kartet.
    navn: 'sti-fargevelgeren bor i Kartstil-fanen, og «Følg tema» nullstiller',
    domene: 'DrawerStyleTab',
    // KREVER ET EKTE KART (v7.1.1). Sjekken LESER fargen ut av en sti-path i
    // kart-SVG-en, og demokartet suiten ellers står i har ingen — den svarte
    // «null → null» på hver kjøring uten flagget. CI kjører med --ektekart og
    // så den derfor aldri; lokalt var den rød uten at noe var galt, altså
    // nøyaktig den støyen som gjør at man slutter å lese suiten.
    krever: 'ektekart',
    async kjør(page) {
      const strekFarge = () => page.evaluate(() => {
        const el = document.querySelector('svg.isom-map [data-iso="505"] path:not(.casing), svg.isom-map [data-iso="506"] path:not(.casing)')
        return el ? getComputedStyle(el).stroke : null
      })
      await åpneDrawer(page)
      await klikkTekst(page, /^KARTSTIL$/)
      const velger = page.locator('input[aria-label="Egen farge på sti-strek"]')
      if (!(await velger.count())) throw new Error('fant ingen fri sti-fargevelger i Kartstil-fanen')
      const før = await strekFarge()
      // <input type="color"> tar ikke .click() — sett verdien og fyr input.
      await velger.evaluate((el) => {
        el.value = '#ff00ff'
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await page.waitForTimeout(400)
      const etter = await strekFarge()
      if (etter !== 'rgb(255, 0, 255)') {
        throw new Error(`fargevelgeren slo ikke gjennom på kartet (${før} → ${etter})`)
      }
      // NØYTRAL TILSTAND — og selve poenget: «Følg tema» er den ene knappen
      // som rydder. Finnes den ikke, blir kartet magenta for alle sjekkene
      // etter denne, og det er nettopp feilen vi vil se.
      await klikkTekst(page, /^Følg tema$/)
      await page.waitForTimeout(400)
      const tilbake = await strekFarge()
      await lukkDrawer(page)
      if (tilbake === 'rgb(255, 0, 255)') throw new Error('«Følg tema» nullstilte ikke sti-fargen')
      return `satt til magenta, «Følg tema» ga ${tilbake}`
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
// VENTER TIL KARTET STÅR STILLE, og den er delt fordi DELINGEN gjorde den delt.
// Terreng-først: skjelettet er i DOM-en før detalj-passet, så et `goto` som har
// svart sier ingenting om at kartet er ferdig. Ventingen bodde i den FØRSTE
// sjekken («kartet monterer»), og alle de andre arvet den gratis ved å ligge bak
// den i lista. Med --del er det ikke lenger sant: hver del starter på sin egen
// første sjekk, og del 3 startet på et halvferdig kart («Cannot read properties
// of null (reading 'getBoundingClientRect')» på noe som ennå ikke var tegnet).
// Kjøre-løkka venter derfor selv, FØR første sjekk, i både delt og udelt
// kjøring — så en del starter i nøyaktig samme tilstand som en hel kjøring.
async function ventPåFerdigKart(page) {
  await page.waitForSelector('svg.isom-map', { timeout: 60_000 })
  const tell = () => page.evaluate(() =>
    document.querySelectorAll('svg.isom-map path, svg.isom-map use, svg.isom-map polygon').length)
  let forrige = -1
  let n = await tell()
  for (let i = 0; i < 20 && n !== forrige; i++) {
    forrige = n
    await page.waitForTimeout(500)
    n = await tell()
  }
  const lag = await page.evaluate(() =>
    new Set([...document.querySelectorAll('[data-layer]')].map((g) => g.dataset.layer)).size)
  return { n, lag }
}

// SERVICE WORKEREN ER BLOKKERT I ALLE KONTEKSTER, og det er ikke en snarvei.
// `sw.js` kaller `self.clients.claim()` i activate, og `main.js` reloader på
// `controllerchange`: appen laster seg selv om igjen ett ubestemt sted mellom en
// halv og et par sekunder etter FØRSTE `goto` i en kontekst. En `evaluate` som
// havner i det vinduet dør med «Execution context was destroyed», og et element
// man nettopp ventet på er plutselig null. Begge deler er sett i felt, og begge
// ganger så det ut som en feil i sjekken.
//
// Udelt gikk det som regel bra fordi de to første sjekkene er trege nok til at
// reloaden rakk å skje i skyggen av dem. Delt er det ikke sant lenger: hver del
// starter på sin egen første sjekk, og del 3 startet rett i vinduet. Vi kan ikke
// vente oss ut av det — vi vet ikke når det kommer — så vi fjerner det.
//
// INGEN sjekk måler service workeren. Den ene som er i nærheten,
// «versjonslinja i hovedmenyen kan se etter oppdatering», måler at KNAPPEN
// svarer i det hele tatt, og godtar «Kan ikke sjekke her.» som et av fem
// gyldige svar — det står i sjekkens egen kommentar, og var sant også før
// blokkeringen (preview-serveren rakk ikke alltid å registrere noen SW).
async function egenKontekst(page, opts) {
  return page.context().browser().newContext({ serviceWorkers: 'block', ...opts })
}

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
  await klikkSnarvei(page, 'tre-d')
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

async function klikkTekst(page, re, innenfor = null) {
  const traff = await page.evaluate((kilde) => {
    const rx = new RegExp(kilde.source, kilde.flags)
    const rot = kilde.innenfor ? document.querySelector(kilde.innenfor) : document
    if (!rot) return false
    const b = [...rot.querySelectorAll('button, [role="button"]')].find((e) =>
      e.offsetParent !== null && rx.test((e.innerText || e.getAttribute('aria-label') || '').trim()))
    if (!b) return false
    b.click()
    return true
  }, { source: re.source, flags: re.flags, innenfor })
  if (!traff) {
    throw new Error(`fant ingen synlig knapp som matcher ${re}`
      + (innenfor ? ` inne i ${innenfor}` : ''))
  }
  await page.waitForTimeout(700)
}

// SKUFFA, IKKE HELE SIDA. Snarvei-etikettene ble kortformer i v7.6.0, og «Sti»
// er nå BÅDE en snarvei i raden og et lag i Kartlag-fana — en uskopet
// tekst-klikking treffer den som står først i DOM-en, altså snarveien. Det
// koster ikke noe å si hvilken av de to man mener.
const SKUFF = '[role="dialog"][aria-label="Valg"]'

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

// INNGANGEN TIL SKUFFEN ER EN SNARVEI IGJEN (v7.6.0), sist i raden og under
// navnet «Valg». Tannhjulet i topprada er borte. Den kan ligge bak håndtaket på
// en smal skjerm, så raden dras ut først; `velg` legger den sammen igjen selv.
// Vi går på `data-snarvei-id` og ikke på etiketten: dialogen som åpnes har
// `aria-label="Valg"`, altså det samme som knappen.
async function åpneDrawer(page) {
  if (await erDrawerÅpen(page)) return
  await apneSnarveiRad(page)
  await page.locator('[data-snarvei-id="innstillinger"]').first().click()
  await page.waitForTimeout(500)
}

// HÅNDTAKET DRAS, DET KLIKKES IKKE (v7.5.0). Klikk-toggelen er fjernet: et
// lite drag og et tapp gjorde helt ulike ting på samme piksel. Helperen gjør
// derfor et EKTE drag — `handle.click()` ville stått og ventet på en tilstand
// som aldri kommer. Dra-lengda må være romslig nok til å committe (skuffa
// dokker retnings-basert på en fjerdedel av gapet), og retningen er speilvendt
// av et bunn-ark: NED folder ut, OPP legger sammen.
async function draSnarveiHandle(page, dy) {
  const h = await page.locator('.snarvei-handle').boundingBox()
  if (!h) throw new Error('fant ikke snarvei-håndtaket')
  const x = h.x + h.width / 2
  const y = h.y + h.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}

// SORTERINGS-MODUS SKJULER HÅNDTAKET (v7.7.0) — footeren står der. Begge
// hjelperne under venter på `.snarvei-handle`, så en sjekk som lot modusen stå
// igjen ville hengt 30 sekunder i den NESTE sjekken i stedet for i sin egen.
async function avsluttSortering(page) {
  if (await page.locator('[data-sorter-footer]').count()) {
    await klikkTekst(page, /^Ferdig$/, '[data-sorter-footer]')
  }
}

async function startSortering(page) {
  await apneSnarveiRad(page)
  await klikkTekst(page, /^Sorter snarveier$/)
}

async function apneSnarveiRad(page) {
  await avsluttSortering(page)
  const handle = page.locator('.snarvei-handle')
  if ((await handle.getAttribute('aria-expanded')) === 'false') {
    await draSnarveiHandle(page, 120)
  }
}

async function lukkSnarveiRad(page) {
  await avsluttSortering(page)
  const handle = page.locator('.snarvei-handle')
  if ((await handle.getAttribute('aria-expanded')) === 'true') {
    await draSnarveiHandle(page, -120)
  }
}

// EN SNARVEI KAN LIGGE BAK HÅNDTAKET. På en smal skjerm får ikke alle plass i
// første rad, og gitteret KLIPPER resten (v7.5.0) — en klikk rett på en celle
// i rad to treffer ingenting. Derfor dras raden ut først.
//
// ID OG IKKE ETIKETT (v7.6.0): etikettene er kortformer nå («Mål», «Merk»,
// «Spor», «GPS»), og de er valgt for å spare kolonnebredde — ikke for å være
// stabile testankere. `data-snarvei-id` er kontrakten.
async function klikkSnarvei(page, id) {
  await apneSnarveiRad(page)
  const knapp = page.locator(`[data-snarvei-id="${id}"]`)
  if (!(await knapp.count())) throw new Error(`fant ingen snarvei «${id}»`)
  await knapp.first().click()
  await page.waitForTimeout(400)
}

// SETT EN SLIDER TIL EN VERDI. `input[type=range]` reagerer ikke på et klikk
// midt på sporet (verdien blir da posisjonen man traff), og et tastatur-steg er
// ett hakk om gangen. Vi setter verdien direkte og fyrer BEGGE hendelsene:
// Vue binder på `input`, mens `change` er den nettleseren sender ved slipp — en
// sjekk som bare fyrer den ene måler halve kontrakten.
async function settSkyv(page, ariaLabel, verdi) {
  const ok = await page.evaluate(([navn, v]) => {
    const el = [...document.querySelectorAll('input[type="range"]')]
      .find((e) => e.getAttribute('aria-label') === navn && e.offsetParent !== null)
    if (!el) return false
    el.value = String(v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, [ariaLabel, verdi])
  if (!ok) throw new Error(`fant ingen synlig slider «${ariaLabel}»`)
  await page.waitForTimeout(400)
}

async function lukkDrawer(page) {
  // Escape først (skuffen lytter på den), så ✕-knappen i hodet som reserve. Å
  // trykke «Innstillinger» på nytt virket ikke: den treffer også fane-raden, og
  // sjekken etterpå kjørte med skuffen fortsatt over FAB-ene.
  for (let i = 0; i < 3; i++) {
    if (!(await erDrawerÅpen(page))) return
    await klikkTekst(page, /^Lukk Valg$/)
    await page.waitForTimeout(350)
  }
  if (await erDrawerÅpen(page)) throw new Error('fikk ikke lukket innstillings-skuffen')
}

// Lukker en funksjons-skuff (Måling/Sporing/Annotering) via
// X-en i headeren. Ingen feil om den ikke står åpen — kallerne rydder.
async function lukkFunksjonsSkuff(page, etikett) {
  await page.evaluate((navn) => {
    const b = [...document.querySelectorAll('button')].find((e) =>
      e.offsetParent !== null && e.getAttribute('aria-label') === `Lukk ${navn}`)
    b?.click()
  }, etikett)
  await page.waitForTimeout(350)
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
const EKTE_KART_UT = 'dist/maps/vardasen.svg'

// Minste størrelse et ekte kart kan ha. Tallene er MÅLT og ikke gjettet: det
// sporede demo-kartet er 75 kB, og det ekte Vardåsen-arket som ligger deployet
// på gh-pages er 691 kB. Gulvet er en SANITETSSJEKK på cachen — en avbrutt jobb
// kan ha lagret en halvskrevet fil, og et trunkert kart ville gitt sju sjekker
// som feiler på noe som ikke er kodens feil. Bommer gulvet den andre veien
// (kartet krymper under 150 kB), cacher vi bare ikke, og loggen sier hvorfor.
const EKTE_KART_MIN_BYTES = 150_000

/**
 * Er dette et brukbart ekte kart? Størrelse OG at det faktisk er et SVG —
 * begge deler, fordi de fanger hver sin måte en cache kan være ødelagt på.
 */
function brukbartKart(buf) {
  if (!buf || buf.length < EKTE_KART_MIN_BYTES) return false
  return /<svg[\s>]/.test(buf.subarray(0, 4096).toString('utf8'))
}

// Returnerer om vi FIKK et ekte kart. Feiler byggingen (kildene er nede, ingen
// nett), går vi videre med demo-kartet og hopper over sjekkene som krever ekte
// geometri — en PR skal ikke blokkeres av at Overpass har en dårlig dag.
//
// --kartcache=<sti> ER HELE GRUNNEN TIL AT DENNE ER TO VEIER (v6.5.24):
// byggingen henter Overpass + Kartverket WCS og koster ~2 av jobbens ~6
// minutter, og den er dessuten den eneste delen av røyktesten som kan feile
// fordi en tredjepart har en dårlig dag. Kartet er en REN FUNKSJON av
// kart-pipelinen og byggeskriptet, så det trenger bare bygges når en av dem
// endrer seg — og det er nøyaktig det CI-nøkkelen er hashet over. Er kartet
// hentet fra cachen, rører vi ikke nettet i det hele tatt.
async function byggEkteKart() {
  if (KARTCACHE && existsSync(KARTCACHE)) {
    const lagret = readFileSync(KARTCACHE)
    if (brukbartKart(lagret)) {
      mkdirSync(dirname(EKTE_KART_UT), { recursive: true })
      writeFileSync(EKTE_KART_UT, lagret)
      console.log(`→ ekte Vardåsen-kart fra cache (${KARTCACHE}, ${lagret.length} B) — ingen nett`)
      return true
    }
    console.log(`⚠ cachet kart i ${KARTCACHE} er ubrukelig (${lagret.length} B) — bygger på nytt`)
  }
  if (IKKE_BYGG_KART) {
    console.log('→ --ikkebyggkart: ingen brukbar kart-cache, kjører på demo-kartet')
    return false
  }
  // Byggeskriptet skriver til det SPOREDE demo-kartet, så originalen legges
  // tilbake i finally: røyktesten skal ikke etterlate en diff.
  const original = readFileSync(DEMO_KART)
  try {
    console.log('→ bygger ekte Vardåsen-kart (nett) …')
    await kjør('node', ['scripts/build-vardasen-svg.js'])
    // dist/maps/ må lages her, ikke antas. Cache-stien over gjør det allerede;
    // byggestien gjorde det ikke, og det gikk bra så lenge røyktesten var ÉN
    // jobb som kjørte `npm run build` (og dermed lagde dist/) før kartet. Etter
    // delingen i v7.7.12 kjører forjobben `--lagkart` ALENE — ingen build, ingen
    // dist/ — så copyFileSync feilet med ENOENT og hele PR-en falt tilbake på
    // demo-kartet. Feilmodusen er den stille: byggingen lykkes, kartet er
    // riktig, og de 22 ektekart-sjekkene hoppes over med en advarsel ingen
    // leser. Den traff bare ved cache-BOM, altså nøyaktig på de PR-ene som
    // endrer kart-pipelinen og trenger sjekkene mest.
    mkdirSync(dirname(EKTE_KART_UT), { recursive: true })
    copyFileSync(DEMO_KART, EKTE_KART_UT)
    if (KARTCACHE) {
      const bygd = readFileSync(EKTE_KART_UT)
      if (brukbartKart(bygd)) {
        mkdirSync(dirname(KARTCACHE), { recursive: true })
        writeFileSync(KARTCACHE, bygd)
        console.log(`→ la kartet i ${KARTCACHE} (${bygd.length} B) for neste kjøring`)
      } else {
        // Et for lite kart er ikke verdt å cache: da ville feilen fulgt med
        // videre til hver kjøring som treffer nøkkelen.
        console.log(`⚠ bygd kart er mistenkelig lite (${bygd.length} B) — cacher det ikke`)
      }
    }
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
  if (LAGKART) {
    // Verken bygg eller nettleser — bare kartet. Feiler byggingen, er det IKKE
    // en feil: kallerne hopper da over sjekkene som krever ekte geometri, og
    // det er om kartfila finnes etterpå de leser svaret, ikke exit-koden.
    const ok = await byggEkteKart()
    console.log(ok ? '→ kartet er på plass' : '⚠ intet ekte kart — det kjøres på demo-kartet')
    process.exit(0)
  }
  if (!EGEN_URL) preview = await startPreview()
  else await ventPå(`${BASE}/`, 10_000)

  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH
      || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
  })
  const ctx = await browser.newContext({
    serviceWorkers: 'block',                            // se egenKontekst()
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
  await ventPåFerdigKart(page)

  if (BILDER) mkdirSync(BILDER, { recursive: true })
  const resultat = []
  // DELINGEN ER RUNDGANG (i % M), IKKE SAMMENHENGENDE BLOKKER, og det er MÅLT.
  // Tidsstemplene i CI-loggen for kjøring 34645932028 (master, varmt kart) sier
  // at de ELLEVE 3D-sjekkene — fra «3D-visningen åpner» til «nattmodus er
  // stjernekikkeren» — sto for 282 av stegets 508 sekunder, altså 56 % av
  // kjøretida på 17 % av sjekkene. Himmelvippen alene tok 71 s, stjernekikkeren
  // 48 s, Info/POI-filteret 39 s. De ligger ETTER HVERANDRE i lista, fordi den
  // vokser kronologisk med uttrekkene. Tre sammenhengende tredjedeler ville
  // derfor lagt hele 3D-blokka i ÉN jobb, og den jobben ville vært nesten like
  // treg som dagens udelte kjøring — parallelliseringen ville sett ut som den
  // virket og spart under to minutter.
  //
  // Rundgang fordeler klyngen av seg selv (fire, fire og tre av de elleve) og
  // trenger ingen vedlikeholdt vekt-tabell når det kommer en sjekk til. Prisen
  // er at NABOSKAPET brytes: sjekk 5 følger sjekk 2 i stedet for sjekk 4. Det er
  // lov fordi kontrakten allerede sier at hver sjekk skal FORLATE APPEN I
  // NØYTRAL TILSTAND — og delingen er dermed også den første håndhevingen den
  // regelen har hatt. Ryker en sjekk bare når den kjøres delt, er det sjekken
  // FØR den som ikke ryddet opp; det er en ekte feil, ikke en delings-artefakt.
  const mine = DEL ? SJEKKER.filter((_, i) => i % DEL.av === DEL.n - 1) : SJEKKER
  if (DEL) console.log(`→ del ${DEL.n}/${DEL.av}: ${mine.length} av ${SJEKKER.length} sjekker`)
  // EN TOM DEL ER EN GRØNN LØGN. Hver del rapporterer for seg, så en del som
  // velger null sjekker passerer uten et ord — og en feil i regnestykket over
  // ville da tatt bort en tredjedel av dekningen uten at noe ble rødt. Det er
  // nøyaktig den stille klassen hele denne fila finnes for å lukke.
  if (!mine.length) throw new Error(`del ${DEL.n}/${DEL.av} valgte ingen sjekker`)
  for (const s of mine) {
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
      const t0 = Date.now()
      const obs = await medTak(s.kjør(page), s.maksMs ?? SJEKK_TAK_MS, s.navn)
      const ms = Date.now() - t0
      resultat.push({ ...s, ok: true, obs, ms })
      console.log(`✓ ${s.navn} — ${obs} (${(ms / 1000).toFixed(1)} s)`)
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

    // EN FEILET SJEKK SKAL IKKE ØDELEGGE DEN NESTE. Hver sjekk rydder etter seg
    // selv på veien ut — men en sjekk som KASTER kommer aldri dit, og etterlater
    // appen der den døde. Det skjedde 2026-08-28: fakta-sjekken feilet med
    // månegloben åpen, og nattmodus-sjekken etter den dro i kula i stedet for
    // kameraet og rapporterte «kompasset står stille». To feil i loggen, én
    // årsak — og den andre var ren støy som kostet en runde å avskrive.
    //
    // ETTER SKJERMBILDET, ikke før: bildet er bevismaterialet for feilen.
    // localStorage overlever en reload, så sjekker som lagrer et valg er urørt.
    if (!resultat[resultat.length - 1].ok && !resultat[resultat.length - 1].hoppet) {
      await medTak((async () => {
        await page.goto(`${BASE}/kart/vardasen`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForFunction(() => !!document.querySelector('svg.isom-map'),
          null, { timeout: 30_000 })
      })(), 60_000, `nullstilling etter ${s.navn}`)
        .catch((e) => console.log(`  ⚠ ${e.message}`))
    }
  }

  console.log('\n── røyktest ───────────────────────────────')
  for (const r of resultat) {
    // Tida per sjekk står her fordi den er det eneste grunnlaget en framtidig
    // omfordeling av --del har: en klynge som vokser seg tung vises her først.
    const tid = r.ms ? `${(r.ms / 1000).toFixed(1).padStart(6)} s` : ' '.repeat(8)
    console.log(`${r.hoppet ? '⊘' : r.ok ? '✓' : '✗'} ${tid}  ${r.domene.padEnd(24)} ${r.navn}`)
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
