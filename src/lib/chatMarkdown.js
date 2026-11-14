// Fet og kursiv i chat-bobler. Modellene skriver markdown uansett hva
// systemprompten sier, og «**Kjekstadmarka**» med stjernene synlige leses som
// en feil. Bevisst ikke v-html og ikke et markdown-bibliotek: svaret er
// modell-tekst, og segmenter som Vue rendrer som tekst kan ikke injisere noe.
// Lister, overskrifter og lenker står som ren tekst — `whitespace-pre-wrap`
// bærer linjeskiftene, og «- punkt» leses fint som det er.

// Kursiv krever et tegn som ikke er mellomrom innenfor stjernene, så en
// punktliste med «* » ikke blir kursiv fram til neste stjerne.
const MONSTER = /\*\*(?=\S)([^*\n]+?)(?<=\S)\*\*|\*(?=\S)([^*\n]+?)(?<=\S)\*/g

export function chatSegmenter(tekst) {
  if (!tekst) return []
  const ut = []
  let fra = 0
  for (const m of tekst.matchAll(MONSTER)) {
    if (m.index > fra) ut.push({ tekst: tekst.slice(fra, m.index) })
    ut.push(m[1] != null ? { tekst: m[1], fet: true } : { tekst: m[2], kursiv: true })
    fra = m.index + m[0].length
  }
  if (fra < tekst.length) ut.push({ tekst: tekst.slice(fra) })
  return ut
}
