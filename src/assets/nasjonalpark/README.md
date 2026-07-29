# Nasjonalpark-logoer

Faktaboksen for nasjonalparker i infoskuffen viser parkens offisielle merke.
Merkene er en del av den nasjonale nasjonalpark-identiteten (Norges
nasjonalparker, designet av Snøhetta) og ligger IKKE i repoet fra før — de må
lastes ned og legges her manuelt.

## Slik legger du inn et merke

1. Last ned SVG-en fra designmanualen:
   https://designmanual.norgesnasjonalparker.no/logo/last-ned-logofiler
2. Velg **hvit** variant. Faktaboksen står på mørk grønn bakgrunn, og appen
   fargelegger ikke merket om.
3. Døp filen om til parkens slug og legg den i denne mappen.

Slug-regelen ligger i `src/lib/nasjonalparkLogo.js` (`parkSlug`): små
bokstaver, «nasjonalpark» strippes, æ→ae, ø→o, å→a, aksenter fjernes,
mellomrom → bindestrek.

| Park | Filnavn |
| --- | --- |
| Børgefjell nasjonalpark | `borgefjell.svg` |
| Ytre Hvaler nasjonalpark | `ytre-hvaler.svg` |
| Anárjohka nasjonalpark | `anarjohka.svg` |
| Rondane nasjonalpark | `rondane.svg` |

Filene bundles av Vite (`import.meta.glob(..., '?raw')`) og inlines i DOM-en —
ingen nettverkskall i appen. Mangler merket for en park, viser faktaboksen bare
teksten; det er ingen feil.

## Bruksrett

Merkene er offentlige kjennemerker med egne bruksregler i designmanualen. De
brukes her til å identifisere parken kartet dekker — ikke som avsender-logo for
Lende.
