import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import { byggVertSvg, STI_ISO_KODER } from './kartVert.js'

const NS = 'http://www.w3.org/2000/svg'

// Bygger en «kilde-rot» slik DOMParser leverer den, i sitt EGET dokument —
// poenget med adoptNode er nettopp at nodene re-homes over dokumentgrensen.
function kilde(innhold = '', { doc } = {}) {
  const d = doc ?? parseHTML('<html><body></body></html>').document
  const root = d.createElementNS(NS, 'svg')
  root.setAttribute('viewBox', '0 0 2000 2000')
  root.innerHTML = innhold
  return root
}

function maal() {
  return parseHTML('<html><body></body></html>').document
}

describe('byggVertSvg', () => {
  it('setter rot-attributtene kartet leses gjennom', () => {
    const { svg } = byggVertSvg(kilde(), { doc: maal() })
    expect(svg.getAttribute('viewBox')).toBe('0 0 2000 2000')
    expect(svg.classList.contains('isom-map')).toBe(true)
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(svg.style.overflow).toBe('visible')
  })

  // v8.9.26: uten denne feiler serialisert eksport i Chrome på Android med
  // «Namespace prefix xlink for href on image is not defined».
  it('deklarerer xmlns:xlink på roten', () => {
    const { svg } = byggVertSvg(kilde(), { doc: maal() })
    expect(svg.getAttribute('xmlns:xlink')).toBe('http://www.w3.org/1999/xlink')
  })

  it('flytter kart-innholdet inn og tømmer kilden', () => {
    const src = kilde('<g data-layer="vann"></g><g data-layer="sti"></g>')
    const { svg } = byggVertSvg(src, { doc: maal() })
    expect(src.firstChild).toBeNull()
    expect(svg.querySelectorAll('[data-layer]')).toHaveLength(2)
  })

  // Uten #user-layer returnerer tegnBrukerPrikk stille uten å tegne noe —
  // altså GPS-prikk som bare forsvinner. Laget må ligge SIST, over kartet.
  it('legger #user-layer sist, og uten pointer-events', () => {
    const { svg } = byggVertSvg(kilde('<g data-layer="vann"></g>'), { doc: maal() })
    const lag = svg.querySelector('#user-layer')
    expect(lag).toBeTruthy()
    expect(lag.getAttribute('pointer-events')).toBe('none')
    expect(svg.lastElementChild).toBe(lag)
  })

  it('løfter detalj-lagene ut av live-DOM-en og gir dem til kalleren', () => {
    const { svg, detaljLag } = byggVertSvg(
      kilde('<g data-detail="1" id="a"></g><g data-layer="vann"></g><g data-detail="1" id="b"></g>'),
      { doc: maal() })
    expect(detaljLag.map((g) => g.id)).toEqual(['a', 'b'])
    expect(svg.querySelectorAll('[data-detail="1"]')).toHaveLength(0)
  })

  // v4.8.6: «ingen innbakte ikoner» er IKKE «ingen finnes» — svaret må være
  // null (vet ikke), ellers påstår badgen at området er tomt før noen spurte.
  it('teller kulturminner, og svarer null i stedet for 0', () => {
    expect(byggVertSvg(kilde(), { doc: maal() }).kulturminneAntall).toBeNull()
    const med = kilde('<g data-kulturminne-id="1"></g><g data-kulturminne-id="2"></g>')
    expect(byggVertSvg(med, { doc: maal() }).kulturminneAntall).toBe(2)
  })

  it('kjenner igjen routbare sti-lag på alle ISOM-kodene', () => {
    expect(byggVertSvg(kilde('<g data-layer="vann"></g>'), { doc: maal() }).harStier).toBe(false)
    for (const kode of STI_ISO_KODER) {
      const r = byggVertSvg(kilde(`<path data-iso="${kode}"/>`), { doc: maal() })
      expect(r.harStier, `ISOM ${kode}`).toBe(true)
    }
  })

  // Kalleren MÅ fjerne denne igjen etter LOD-passet. En vert uten et pass
  // etterpå har usynlige navn for alltid — det er den stille feilen.
  it('starter med lod-pending så navn ikke blinker frem udeklutret', () => {
    const { svg } = byggVertSvg(kilde(), { doc: maal() })
    expect(svg.classList.contains('lod-pending')).toBe(true)
  })
})
