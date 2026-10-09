// Printable templates: SVG and PDF at a chosen paper size, with mountain/valley drawn by print convention
// (valley = dashed, mountain = dash-dot, borders solid, red/blue for screen and colour printers).
import { bounds, type Assignment, type Fold } from './fold.ts'

export const PAPERS = { A4: [210, 297], Letter: [215.9, 279.4] } as const
export type Paper = keyof typeof PAPERS

export interface ExportOptions {
  paper: Paper
  orientation: 'auto' | 'portrait' | 'landscape'
  margin: number // mm
  scale: 'fit' | 'actual'
  title: string
}

export interface LineStyle { color: string; rgb: [number, number, number]; dash: number[]; width: number }

/** Dash lengths are in mm at print size. */
export const STYLES: Record<Assignment, LineStyle> = {
  M: { color: '#d62828', rgb: [0.84, 0.16, 0.16], dash: [4, 1.2, 0.8, 1.2], width: 0.35 },
  V: { color: '#1d4ed8', rgb: [0.11, 0.31, 0.85], dash: [2.4, 1.4], width: 0.35 },
  B: { color: '#111111', rgb: [0.07, 0.07, 0.07], dash: [], width: 0.5 },
  F: { color: '#9aa1ad', rgb: [0.6, 0.63, 0.68], dash: [0.4, 1], width: 0.15 },
  U: { color: '#7c3aed', rgb: [0.49, 0.23, 0.93], dash: [1, 1], width: 0.3 },
}

export interface Page {
  width: number
  height: number
  scale: number
  fits: boolean
  /** Printed size of the pattern in mm. */
  size: [number, number]
  segs: { x1: number; y1: number; x2: number; y2: number; a: Assignment }[]
  footer: string
}

export function layoutPage(fold: Fold, o: ExportOptions): Page {
  const b = bounds(fold.vertices_coords)
  const pw = b.maxX - b.minX || 1, ph = b.maxY - b.minY || 1
  const [short, long] = PAPERS[o.paper]
  const footer = 9
  const fitFor = (w: number, h: number) => Math.min((w - 2 * o.margin) / pw, (h - 2 * o.margin - footer) / ph)
  let orient = o.orientation
  if (orient === 'auto') orient = fitFor(short, long) >= fitFor(long, short) ? 'portrait' : 'landscape'
  const [W, H] = orient === 'portrait' ? [short, long] : [long, short]
  const maxScale = fitFor(W, H)
  const scale = o.scale === 'fit' ? maxScale : 1
  const size: [number, number] = [pw * scale, ph * scale]
  const ox = (W - size[0]) / 2, oy = o.margin + (H - 2 * o.margin - footer - size[1]) / 2
  const segs = fold.edges_vertices.map(([u, v], i) => {
    const [x1, y1] = fold.vertices_coords[u], [x2, y2] = fold.vertices_coords[v]
    return { x1: ox + (x1 - b.minX) * scale, y1: oy + (b.maxY - y1) * scale, x2: ox + (x2 - b.minX) * scale, y2: oy + (b.maxY - y2) * scale, a: fold.edges_assignment[i] }
  })
  const pct = Math.round(scale * 100)
  return {
    width: W, height: H, scale, fits: scale <= maxScale + 1e-9, size, segs,
    footer: `${o.title}   ${o.paper} ${orient}   scale ${pct}%   ${size[0].toFixed(0)} x ${size[1].toFixed(0)} mm   mountain: dash-dot   valley: dashed`,
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const n = (x: number) => +x.toFixed(3)

export function toSvg(fold: Fold, o: ExportOptions): string {
  const p = layoutPage(fold, o)
  const order: Assignment[] = ['F', 'U', 'V', 'M', 'B']
  const lines = order.flatMap((a) => {
    const st = STYLES[a]
    return p.segs.filter((s) => s.a === a).map((s) =>
      `<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="${st.color}" stroke-width="${st.width}"${st.dash.length ? ` stroke-dasharray="${st.dash.join(' ')}"` : ''} stroke-linecap="round"/>`)
  })
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${p.width}mm" height="${p.height}mm" viewBox="0 0 ${p.width} ${p.height}">
<rect width="${p.width}" height="${p.height}" fill="#fff"/>
${lines.join('\n')}
<text x="${o.margin}" y="${n(p.height - o.margin)}" font-family="Helvetica, Arial, sans-serif" font-size="3" fill="#333">${esc(p.footer)}</text>
</svg>
`
}

/** A single-page vector PDF. Units: PDF points, y up. */
export function toPdf(fold: Fold, o: ExportOptions): Uint8Array<ArrayBuffer> {
  const p = layoutPage(fold, o)
  const k = 72 / 25.4
  const X = (x: number) => n(x * k), Y = (y: number) => n((p.height - y) * k)
  const ops: string[] = ['1 J']
  for (const a of ['F', 'U', 'V', 'M', 'B'] as Assignment[]) {
    const st = STYLES[a]
    ops.push(`${st.rgb.join(' ')} RG ${n(st.width * k)} w [${st.dash.map((d) => n(d * k)).join(' ')}] 0 d`)
    for (const s of p.segs) if (s.a === a) ops.push(`${X(s.x1)} ${Y(s.y1)} m ${X(s.x2)} ${Y(s.y2)} l S`)
  }
  const text = p.footer.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')
  ops.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg ${X(o.margin)} ${Y(p.height - o.margin)} Td (${text}) Tj ET`)
  const content = ops.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.width * k)} ${n(p.height * k)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const bytes = new Uint8Array(out.length)
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i)
  return bytes
}
