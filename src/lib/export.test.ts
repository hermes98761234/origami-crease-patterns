import { describe, expect, it } from 'vitest'
import { layoutPage, toPdf, toSvg, type ExportOptions } from './export.ts'
import { PATTERNS } from './patterns.ts'

const base: ExportOptions = { paper: 'A4', orientation: 'portrait', margin: 15, scale: 'fit', title: 'Test' }
const { fold } = PATTERNS[0].generate(PATTERNS[0].defaults)

describe('printable templates', () => {
  it('SVG has the paper size in mm and draws M, V and B with distinct dashes', () => {
    const svg = toSvg(fold, base)
    expect(svg).toContain('width="210mm" height="297mm"')
    expect(svg).toContain('stroke="#d62828" stroke-width="0.35" stroke-dasharray="4 1.2 0.8 1.2"')
    expect(svg).toContain('stroke="#1d4ed8" stroke-width="0.35" stroke-dasharray="2.4 1.4"')
    expect(svg).toMatch(/stroke="#111111" stroke-width="0.5" stroke-linecap/)
    expect((svg.match(/<line /g) ?? []).length).toBe(fold.edges_vertices.length)
  })
  it('Letter is 215.9 x 279.4 mm', () => {
    expect(toSvg(fold, { ...base, paper: 'Letter' })).toContain('width="215.9mm" height="279.4mm"')
  })
  it('fit scale keeps the pattern inside the margins', () => {
    for (const margin of [5, 15, 30]) {
      const p = layoutPage(fold, { ...base, margin })
      for (const s of p.segs) for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        expect(x).toBeGreaterThanOrEqual(margin - 1e-6)
        expect(x).toBeLessThanOrEqual(p.width - margin + 1e-6)
        expect(y).toBeGreaterThanOrEqual(margin - 1e-6)
        expect(y).toBeLessThanOrEqual(p.height - margin + 1e-6)
      }
    }
  })
  it('actual size prints 1:1 and says when it does not fit', () => {
    const small = layoutPage(fold, { ...base, scale: 'actual' })
    expect(small.scale).toBe(1)
    expect(small.fits).toBe(true)
    const big = PATTERNS[0].generate({ ...PATTERNS[0].defaults, size: 60, cols: 16 }).fold
    expect(layoutPage(big, { ...base, scale: 'actual' }).fits).toBe(false)
  })
  it('auto orientation picks landscape for a wide pattern', () => {
    const wide = PATTERNS[0].generate({ ...PATTERNS[0].defaults, cols: 16, rows: 2 }).fold
    expect(layoutPage(wide, { ...base, orientation: 'auto' }).width).toBeGreaterThan(250)
  })
  it('PDF is well-formed: header, A4 media box, consistent xref offsets', () => {
    const bytes = toPdf(fold, base)
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/MediaBox [0 0 595.276 841.89]')
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    const start = +/startxref\n(\d+)/.exec(text)![1]
    expect(text.slice(start, start + 4)).toBe('xref')
    const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => +m[1])
    entries.forEach((off, i) => expect(text.slice(off, off + 7)).toBe(`${i + 1} 0 obj`))
    const len = +/\/Length (\d+)/.exec(text)![1]
    const s = text.indexOf('stream\n') + 7
    expect(text.slice(s + len, s + len + 10)).toBe('\nendstream')
    expect((text.match(/ l S/g) ?? []).length).toBe(fold.edges_vertices.length)
  })
})
