// Miura-ori: a tessellation of parallelograms (sides b and a, angle alpha) that folds rigidly with one degree of freedom.
//
// Closed form. Row j is a polyline P_i that zigzags in the xz-plane, translated by vectors u_j that zigzag in x:
//   x(i,j) = i b cos(phi) + (j odd ? a cos(alpha) / cos(phi) : 0)
//   y(i,j) = j a sqrt(1 - cos^2(alpha) / cos^2(phi))
//   z(i,j) = (i odd ? b sin(phi) : 0)
// phi = 0 is the flat sheet, phi = alpha the fully flat-folded stack. Every face is a parallelogram with its
// original side lengths and angle, so the motion is rigid.
import { buildFold, type Vec3 } from './fold.ts'
import { rad, type PatternDef } from './pattern.ts'

export function miura(cols: number, rows: number, alphaDeg: number, aspect: number, b: number) {
  const alpha = rad(alphaDeg)
  const a = aspect * b
  const s = a * Math.cos(alpha), H = a * Math.sin(alpha)
  const coords: [number, number][] = []
  const idx: number[][] = []
  for (let i = 0; i <= cols; i++) {
    idx.push([])
    for (let j = 0; j <= rows; j++) {
      idx[i].push(coords.length)
      coords.push([i * b + (j % 2 ? s : 0), j * H])
    }
  }
  const faces: number[][] = []
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) faces.push([idx[i][j], idx[i + 1][j], idx[i + 1][j + 1], idx[i][j + 1]])
  const where = new Map<number, [number, number]>()
  idx.forEach((col, i) => col.forEach((v, j) => where.set(v, [i, j])))
  const fold = buildFold(coords, faces, (p, q) => {
    const [i1, j1] = where.get(p)!, [i2] = where.get(q)!
    if (i1 === i2) return i1 % 2 ? 'M' : 'V' // zigzag chains alternate by column
    return (Math.min(i1, i2) + j1) % 2 ? 'V' : 'M' // straight lines alternate along the row
  })
  const positions = (t: number): Vec3[] => {
    const phi = Math.min(Math.max(t, 0), 1) * alpha
    const cp = Math.cos(phi)
    const k = Math.cos(alpha) / cp
    const uy = Math.sqrt(Math.max(0, 1 - k * k))
    return coords.map((_, v) => {
      const [i, j] = where.get(v)!
      return [i * b * cp + (j % 2 ? a * k : 0), j * a * uy, i % 2 ? b * Math.sin(phi) : 0]
    })
  }
  return { fold, positions, flatSize: [cols * b + s, rows * H] as const }
}

export const miuraDef: PatternDef = {
  id: 'miura',
  name: 'Miura-ori',
  blurb: 'Parallelogram tessellation that folds flat in one smooth motion, along both axes at once.',
  params: [
    { key: 'cols', label: 'Cells across', min: 1, max: 16, step: 1 },
    { key: 'rows', label: 'Cells up', min: 1, max: 16, step: 1 },
    { key: 'angle', label: 'Parallelogram angle', min: 20, max: 85, step: 1, unit: '°' },
    { key: 'aspect', label: 'Aspect a / b', min: 0.4, max: 2.5, step: 0.05 },
    { key: 'size', label: 'Cell width b', min: 5, max: 60, step: 1, unit: 'mm' },
  ],
  defaults: { cols: 6, rows: 6, angle: 60, aspect: 1, size: 20 },
  presets: [
    { name: 'Classic 60°', values: { cols: 6, rows: 6, angle: 60, aspect: 1, size: 20 } },
    { name: 'Steep 75°', values: { cols: 6, rows: 5, angle: 75, aspect: 1.5, size: 18 } },
    { name: 'Shallow 35°', values: { cols: 7, rows: 8, angle: 35, aspect: 0.8, size: 16 } },
    { name: 'Map fold', values: { cols: 4, rows: 8, angle: 70, aspect: 1.2, size: 25 } },
  ],
  generate: (p) => {
    const m = miura(p.cols, p.rows, p.angle, p.aspect, p.size)
    const folded = m.positions(0.85)
    const ext = [0, 1, 2].map((k) => Math.max(...folded.map((v) => v[k])) - Math.min(...folded.map((v) => v[k])))
    return {
      fold: m.fold,
      positions: m.positions,
      info: [
        `Flat sheet ${m.flatSize[0].toFixed(0)} × ${m.flatSize[1].toFixed(0)} mm.`,
        `At 85% folded: ${ext[0].toFixed(0)} × ${ext[1].toFixed(0)} × ${ext[2].toFixed(0)} mm.`,
      ],
    }
  },
}
