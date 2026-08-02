import { ref } from 'vue'
import { chatOnce } from '../lib/lendeAi.js'
import { AI_TOOLS, runTool, toolStatusLabel } from '../lib/lendeAiTools.js'

// Global chat-tilstand (Fase 2 av KI-planen). Modul-skopet med vilje: modalen
// monteres én gang i App.vue, knappene bor i toppfeltene på forsiden, i
// kartvisningen og i planleggeren, og historikken skal overleve både
// lukking av modalen og navigasjon mellom visninger. Konteksten (hvilket kart
// brukeren ser på) settes av visningene via setChatContext og flettes inn i
// system-prompten ved hvert send — modellen svarer altså alltid om det du ser
// på nå, selv om samtalen startet et annet sted.

const chatOpen = ref(false)
const messages = ref([]) // { role: 'user'|'assistant', content: string }
const busy = ref(false)
const busyLabel = ref('') // norsk statuslinje mens modellen tenker/verktøy kjører
const error = ref('')
const context = ref(null)

let abortCtrl = null

// Begrens historikken som sendes (ikke den som vises) så kontekst + samtale
// holder seg godt innenfor både modellens vindu og neurons-kvoten.
const MAX_SENDTE_MELDINGER = 16

function systemPrompt() {
  const deler = [
    'Du er Lende-assistenten i turkart-appen «Så i lende».',
    'Svar kort og konkret på norsk bokmål. Du kan svare på spørsmål om stedet og kartet brukeren ser på, terreng, turplanlegging og appens funksjoner.',
    'IMPLISITT STED: nevner ikke brukeren noe stedsnavn, gjelder spørsmålet ALLTID kartet i konteksten — «kartet», «her», «dette området» og spørsmål helt uten sted betyr kartet brukeren står i (aktiv kartflis). Be ALDRI om mer informasjon eller flere detaljer da: kall riktig verktøy direkte med kontekstens kart (verktøyene henter kartId fra konteksten selv når du utelater den).',
    // Funksjonsguide (v3.0.33): modellen skal henvise til RIKTIG funksjon.
    // Viktigst: fotturer i kartet = Stifinneren, IKKE Turplanleggeren (som er
    // for grus-/sykkelruter) — v3.0.30-prompten kjente bare Turplanleggeren
    // og sendte fotturfolk dit.
    // Fase 3: modellen HAR verktøy — instruer bruken.
    'Du har verktøy og kan utføre ting i appen: søke i et lagret karts egne stedsnavn/tjern/topper (sok_i_kartet), søke etter steder på nett (sok_sted), liste brukerens lagrede kart og grusruter (mine_kart_og_ruter), åpne et lagret kart (apne_kart), BYGGE et nytt turkart direkte (lag_kart — byggingen starter med én gang og tar 15–60 sekunder), gjøre klart et nytt kart med utfylte felter (foreslaa_nytt_kart — brukeren bekrefter og bygger selv), analysere stinettet i et lagret kart (analyser_stinett — total km sti, lengste sammenhengende tur, tur-kandidater med stigning), foreslå en fottur A→B tegnet inn i et lagret kart (foreslaa_tur), og foreslå en RUNDTUR tegnet inn i et lagret kart (foreslaa_rundtur — start/mål + vendepunkt).',
    'Stinett-spørsmål («hvor mange km sti er det her?», «hva er den lengste turen?», «hvilken tur er brattest/slakest?»): kall analyser_stinett — UTEN argumenter når brukeren står i kartet (kartet hentes automatisk fra konteksten). Formuler svaret PÅ NORSK: har svaret totalStiTekst, bruk den («Det er mer enn 370 km turstier i kartet») og nevn kartets størrelse (kartKm/arealKm2) så tallet får kontekst — kartet er ofte mye større enn utsnittet brukeren ser. Vil brukeren gå en av turene den fant: send turens koordinater rett videre — start/slutt/via til foreslaa_tur, origo/via til foreslaa_rundtur. Gir analysen treff: 0, si ærlig at kartet bare har korte sti-fragmenter.',
    'Verktøyregler: til start/mål/vendepunkt i foreslaa_tur/foreslaa_rundtur skal du ALLTID bruke sok_i_kartet først — kartets egne navn er fasit, og gir eksakte koordinater i kartet. sok_sted (nettbasert geokoding) er for steder utenfor brukerens kart og for å plassere nye kart — den kan treffe navnebrødre langt unna. Finner ikke sok_i_kartet stedet: si ærlig at det ikke ligger i dette kartet, og tilby lag_kart over området. Ligger treffet i en NABOFLIS (annen kartId): bruk koordinatene direkte i foreslaa_tur/foreslaa_rundtur — turer kan tegnes på tvers av naboflisene i mosaikken. Bruk lag_kart når brukeren eksplisitt ber deg lage/bygge et kart; foreslaa_nytt_kart når du bare foreslår. Bruk mine_kart_og_ruter før apne_kart/foreslaa_tur/foreslaa_rundtur for å finne riktig kartId — med mindre brukeren står i et kart (da ligger kartId i konteksten). Kart-id-er nevnt TIDLIGERE i samtalen kan være utdatert — når brukeren står i et kart gjelder alltid kartId fra konteksten. Ikke gjett id-er eller koordinater. Etter et verktøy som navigerer: gi én kort bekreftelse.',
    '3D-visning: sett ALDRI vis3d uten at brukeren eksplisitt har bedt om 3D. Etter at en tur/rundtur er tegnet inn, tilby gjerne 3D-visning som et spørsmål.',
    'Spørsmål om turen som er tegnet inn (lengde, høydemeter/stigning, gangtid): svar fra aktivTur i konteksten — IKKE kall turverktøyene på nytt, og åpne aldri 3D for å svare på et spørsmål. Mangler aktivTur i konteksten: si at ingen tur er tegnet inn akkurat nå.',
    '«Min posisjon» / «der jeg er» = brukerPosisjon i konteksten (brukerens GPS-punkt i kartet) — bruk den som start for turer. Mangler brukerPosisjon: GPS er ikke aktiv; be brukeren trykke GPS-knappen i kartet eller oppgi et startsted — ikke gjett.',
    'Flere steder i Norge kan hete det samme: når sok_sted gir flere treff og brukeren har et kart åpent, velg treffet med lavest avstandKmFraKartet — eller spør brukeren hvis ingen ligger nær kartet. Returnerer et verktøy «feil»: gjengi feilen ærlig og foreslå neste steg — påstå ALDRI at en rute/tur/handling er utført når verktøyet feilet.',
    'Ber brukeren om en tur/rute/rundtur til et sted som ligger i kartet de står i (eller et annet lagret kart): bruk foreslaa_tur eller foreslaa_rundtur — ALDRI lag_kart/foreslaa_nytt_kart da. Nytt kart er kun for OMRÅDER brukeren ikke har kart over. Mangler du startpunkt for en rundtur: spør brukeren hvor turen skal starte (f.eks. en parkering) i stedet for å gjette.',
    'Slik veileder du til appens funksjoner (det verktøyene ikke dekker):',
    '• Fottur i kartet brukeren ser på: bruk STIFINNEREN — snarveis-knappen «Stifinner» i kartvisningen, eller hold fingeren på et punkt i kartet og velg «Naviger hit». Den foreslår 1–3 ruter på kartets stier og veier, med inntil 3 via-punkter.',
    '• Rundtur til fots: snarveis-knappen «Runde» i kartvisningen foreslår rundturer fra et punkt.',
    '• Avstand i luftlinje: snarveis-knappen «Måling» i kartvisningen.',
    '• Info om et sted: hold fingeren på punktet i kartet, eller snarveis-knappen «Informasjon».',
    '• Grus- og sykkelruter (gjerne lengre, på grusveier): «Turplanlegger» i hovedmenyen — høydeprofil, cue-liste og GPX-eksport.',
    '• Kart over et nytt område: «Nytt turkart» i hovedmenyen.',
    'Turer til fots i kartet hører altså til Stifinneren — henvis aldri fotturer til Turplanleggeren.',
    'Det du verken kan gjøre med verktøy eller finnes en funksjon for (telle objekter i kartet, analysere kart som ikke er lagret): si ærlig fra.',
  ]
  if (context.value) {
    deler.push(`Brukerens kontekst akkurat nå (JSON): ${JSON.stringify(context.value)}`)
    // Svake modeller overser gjerne kartId inne i JSON-en — gjenta den som
    // klartekst så «spørsmål uten sted = dette kartet» faktisk etterleves.
    if (context.value.kartId) {
      deler.push(`Brukeren står altså i kartet «${context.value.kartnavn ?? context.value.kartId}» (kartId: ${context.value.kartId}) — spørsmål uten stedsnavn gjelder DETTE kartet.`)
    }
  } else {
    deler.push('Brukeren står på forsiden av appen og har ikke noe kart åpent.')
  }
  return deler.join(' ')
}

function openChat() {
  error.value = ''
  chatOpen.value = true
}

function closeChat() {
  chatOpen.value = false
}

function setChatContext(ctx) {
  context.value = ctx
}

function nySamtale() {
  abortCtrl?.abort()
  messages.value = []
  error.value = ''
  busy.value = false
}

// Maks verktøy-runder per melding — vern mot at modellen går i løkke.
const MAX_VERKTOEY_RUNDER = 4

async function send(text) {
  const spm = text?.trim()
  if (!spm || busy.value) return
  error.value = ''
  busy.value = true
  busyLabel.value = 'Tenker …'
  messages.value.push({ role: 'user', content: spm })
  const svar = { role: 'assistant', content: '' }
  messages.value.push(svar)

  // Historikken som vises er ren user/assistant-tekst; verktøy-utvekslingene
  // lever kun innenfor DENNE send-runden (samtale, ikke transkript — sparer
  // tokens/neurons på neste runde).
  const samtale = [
    { role: 'system', content: systemPrompt() },
    ...messages.value
      .slice(0, -1)
      .slice(-MAX_SENDTE_MELDINGER)
      .map((m) => ({ role: m.role, content: m.content })),
  ]

  abortCtrl = new AbortController()
  try {
    for (let runde = 0; ; runde++) {
      const { text: svarTekst, toolCalls, raw } = await chatOnce({
        messages: samtale,
        tools: runde < MAX_VERKTOEY_RUNDER ? AI_TOOLS : undefined,
        signal: abortCtrl.signal,
      })

      if (!toolCalls.length || runde >= MAX_VERKTOEY_RUNDER) {
        svar.content = svarTekst.trim() || '(Modellen ga et tomt svar — prøv å omformulere.)'
        break
      }

      // Verktøy-runde. VIKTIG (v3.0.35): send en SANERT assistent-melding
      // tilbake, aldri modellens rå OpenAI-form — den har content:null og en
      // rekke null-felter (refusal, annotations, …) som Workers AI-skjemaet
      // avviser i neste kall («'string' not in 'null'»). content skal alltid
      // være en streng; tool-svaret følger Cloudflares dokumenterte form
      // (role:"tool" + name + content) pluss tool_call_id for OpenAI-kompat.
      samtale.push({
        role: 'assistant',
        content: svarTekst || '',
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: JSON.stringify(t.args) },
        })),
      })
      for (const kall of toolCalls) {
        busyLabel.value = toolStatusLabel(kall.name, kall.args)
        const resultat = await runTool(kall.name, kall.args, {
          onNavigate: closeChat,
          kontekst: context.value,
        })
        samtale.push({
          role: 'tool',
          tool_call_id: kall.id,
          name: kall.name,
          content: JSON.stringify(resultat),
        })
      }
      busyLabel.value = 'Tenker …'
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (!svar.content) messages.value.pop()
    } else {
      messages.value.pop()
      error.value = err?.message ?? 'Ukjent feil mot KI-tjenesten.'
    }
  } finally {
    busy.value = false
    busyLabel.value = ''
    abortCtrl = null
  }
}

function stopp() {
  abortCtrl?.abort()
}

export function useLendeChat() {
  return {
    chatOpen,
    messages,
    busy,
    busyLabel,
    error,
    openChat,
    closeChat,
    setChatContext,
    nySamtale,
    send,
    stopp,
  }
}
