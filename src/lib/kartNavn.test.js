import { describe, it, expect } from 'vitest'
import { DOMParser } from 'linkedom'
import { lesNavnIFlis, lesSpokelsesNavn } from './kartNavn.js'

const FLIS = `<svg xmlns="http://www.w3.org/2000/svg" x="8000" y="-8000" width="8000" height="8000">
  <g transform="translate(10, 20)"><text data-label="vann-navn" x="100" y="200">Langvatnet</text></g>
</svg>`

function rot(innhold) {
  return new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg"><g id="ghost-tiles">${innhold}</g></svg>`, 'image/svg+xml',
  ).documentElement
}

describe('lesNavnIFlis (v8.0.6)', () => {
  it('leser en løsrevet flis i aktiv flis’ meter-rom', () => {
    const flis = new DOMParser().parseFromString(FLIS, 'image/svg+xml').documentElement
    const [n] = lesNavnIFlis(flis)
    expect(n).toMatchObject({ name: 'Langvatnet', label: 'vann-navn', x: 8110, y: -7780 })
  })
  it('gir samme posisjon som en festet flis', () => {
    const svg = rot(FLIS)
    const festet = lesSpokelsesNavn(svg)[0]
    const flis = svg.querySelector('#ghost-tiles > svg')
    const løs = lesNavnIFlis(flis, svg)[0]
    expect([løs.x, løs.y]).toEqual([festet.x, festet.y])
  })
  it('tåler en manglende flis', () => {
    expect(lesNavnIFlis(null)).toEqual([])
  })
})
