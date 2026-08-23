// Rendrer PWA-ikonene fra public/icon.svg.
//
// Sjekken nederst finnes fordi dette gikk STILLE galt i v5.22.6:
// @napi-rs/canvas 1.0 løser ikke `href` på <use>, bare den gamle
// `xlink:href`-formen. Ikonet brukte <defs> + <use>, så alle fire høydekurvene
// forsvant — men scriptet skrev fire glade «Wrote …»-linjer og returnerte 0.
// Feilen var bare synlig i bildet, og PNG-ene er binære i git-diffen.
//
// Derfor teller vi GULE PIKSLER. Merket er fire strøk-tegnede ringer pluss en
// liten fylt prikk; forsvinner ringene, faller tallet med over 90 %. Det er den
// klassen feil en renderer-oppgradering gir, og den eneste som ikke kan
// oppdages ved at scriptet «kjørte fint».
import { readFileSync, writeFileSync } from 'fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const svg = readFileSync('public/icon.svg', 'utf8')

// #ffd84a. Terskel framfor eksakt treff: kantutjevning gir mellomtoner.
const ER_GUL = (r, g, b) => r > 200 && g > 160 && b < 130

/**
 * Nedre grense for andel gule piksler, som brøk av flaten. Målt til ~0,073 på
 * et riktig ikon; bare-prikken-varianten gir ~0,002. Grensa ligger godt under
 * det riktige og godt over det ødelagte, så den tåler at merket justeres litt
 * uten å måtte flyttes — men fanger at strøkene forsvinner.
 */
const MIN_GUL_ANDEL = 0.03

async function render(size, outPath) {
  const c = createCanvas(size, size)
  const ctx = c.getContext('2d')
  const img = await loadImage(Buffer.from(svg))
  ctx.drawImage(img, 0, 0, size, size)

  const { data } = ctx.getImageData(0, 0, size, size)
  let gule = 0
  for (let i = 0; i < data.length; i += 4) {
    if (ER_GUL(data[i], data[i + 1], data[i + 2])) gule++
  }
  const andel = gule / (size * size)
  if (andel < MIN_GUL_ANDEL) {
    throw new Error(
      `${outPath}: bare ${(andel * 100).toFixed(2)} % gule piksler (krav: ${MIN_GUL_ANDEL * 100} %). `
      + 'Høydekurvene mangler — rendret rendereren <use>/strøkene?',
    )
  }

  writeFileSync(outPath, await c.encode('png'))
  console.log(`Wrote ${outPath} ${size}x${size} — ${(andel * 100).toFixed(1)} % gult`)
}

await render(192, 'public/icon-192.png')
await render(512, 'public/icon-512.png')
await render(512, 'public/icon-maskable-512.png')
await render(180, 'public/apple-touch-icon.png')
