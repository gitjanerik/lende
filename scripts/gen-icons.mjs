import { readFileSync, writeFileSync } from 'fs'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const svg = readFileSync('public/icon.svg', 'utf8')

async function render(size, outPath) {
  const c = createCanvas(size, size)
  const ctx = c.getContext('2d')
  const img = await loadImage(Buffer.from(svg))
  ctx.drawImage(img, 0, 0, size, size)
  writeFileSync(outPath, await c.encode('png'))
  console.log('Wrote', outPath, size + 'x' + size)
}

await render(192, 'public/icon-192.png')
await render(512, 'public/icon-512.png')
await render(512, 'public/icon-maskable-512.png')
await render(180, 'public/apple-touch-icon.png')
