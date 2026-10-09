// Polygon twist fold. A regular n-gon P0 (circumradius r0) sits in the middle of a regular n-gon sheet P1.
// Two creases leave every vertex v_k of P0: C_k and A_k, rotated by tau - pi/n and tau + pi/n from the outward
// radial direction. The sector between them is 2 pi / n, so the four sectors at v_k are
//   interior angle (pi - 2pi/n), pi/2 - tau, 2pi/n, pi/2 + tau
// and both alternating sums are pi: Kawasaki holds for every tau. The ray A_k is parallel to C_{k+1}, so the
// paper next to each side of P0 is a pleated band; P0 itself stays flat and rotates as the bands wrap around it.
// n = 4 is the square twist, n = 3 a Resch-style triangle twist.
import { buildFold } from './fold.ts'
import { rad, type PatternDef } from './pattern.ts'

export function twist(n: number, side: number, tauDeg: number, sheet: number) {
  const r0 = side / (2 * Math.sin(Math.PI / n))
  const R1 = sheet * r0
  const tau = rad(tauDeg)
  const rot = n === 3 ? Math.PI / 6 : 0
  const at = (r: number, a: number): [number, number] => [r * Math.cos(a + rot), r * Math.sin(a + rot)]
  const coords: [number, number][] = []
  const ids = new Map<string, number>()
  const vid = (p: [number, number]) => {
    const k = `${p[0].toFixed(7)},${p[1].toFixed(7)}`
    let i = ids.get(k)
    if (i === undefined) { i = coords.length; ids.set(k, i); coords.push(p) }
    return i
  }
  const step = (2 * Math.PI) / n
  const v = Array.from({ length: n }, (_, k) => vid(at(r0, k * step)))
  const corners = Array.from({ length: n }, (_, j) => at(R1, (j + 0.5) * step))
  const polar = (p: [number, number]) => ((Math.atan2(p[1], p[0]) - rot + 4 * Math.PI) % (2 * Math.PI))

  // Where a ray from `o` with direction angle `a` leaves the sheet.
  const hit = (o: [number, number], a: number): [number, number] => {
    const d: [number, number] = [Math.cos(a + rot), Math.sin(a + rot)]
    let best = Infinity
    for (let j = 0; j < n; j++) {
      const p = corners[j], q = corners[(j + 1) % n]
      const e: [number, number] = [q[0] - p[0], q[1] - p[1]]
      const den = d[0] * e[1] - d[1] * e[0]
      if (Math.abs(den) < 1e-12) continue
      const t = ((p[0] - o[0]) * e[1] - (p[1] - o[1]) * e[0]) / den
      const u = ((p[0] - o[0]) * d[1] - (p[1] - o[1]) * d[0]) / den
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t)
    }
    return [o[0] + best * d[0], o[1] + best * d[1]]
  }
  const hitA: number[] = [], hitC: number[] = []
  for (let k = 0; k < n; k++) {
    const o = coords[v[k]]
    hitC.push(vid(hit(o, k * step + tau - Math.PI / n)))
    hitA.push(vid(hit(o, k * step + tau + Math.PI / n)))
  }
  const cornerIds = corners.map((c) => vid(c))
  // Sheet corners strictly between two boundary points, walking counter-clockwise from `from` to `to`.
  const between = (from: number, to: number) => {
    const a = polar(coords[from]), b = polar(coords[to])
    const span = (b - a + 2 * Math.PI) % (2 * Math.PI)
    return cornerIds
      .map((c) => ({ c, off: (polar(coords[c]) - a + 2 * Math.PI) % (2 * Math.PI) }))
      .filter((x) => x.off > 1e-7 && x.off < span - 1e-7)
      .sort((p, q) => p.off - q.off)
      .map((x) => x.c)
  }
  const faces: number[][] = [[...v]]
  for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n
    faces.push([v[k], hitC[k], ...between(hitC[k], hitA[k]), hitA[k]]) // wedge at v_k
    faces.push([v[k1], v[k], hitA[k], ...between(hitA[k], hitC[k1]), hitC[k1]]) // pleat band on side k
  }
  const isA = new Set(hitA.map((h, k) => `${v[k]},${h}`))
  const fold = buildFold(coords, faces, (a, b) => {
    if (v.includes(a) && v.includes(b)) return 'V'
    const [lo, hi] = v.includes(a) ? [a, b] : [b, a]
    return isA.has(`${lo},${hi}`) ? 'M' : 'V'
  })
  return { fold, r0, R1 }
}

const tauParam = { key: 'twist', label: 'Twist angle', min: 0, max: 40, step: 1, unit: '°' }
const sheetParam = { key: 'sheet', label: 'Sheet size / inner size', min: 1.8, max: 6, step: 0.1 }

export const squareTwistDef: PatternDef = {
  id: 'square-twist',
  name: 'Square twist',
  blurb: 'A square that turns while four pleated bands wrap around it.',
  params: [{ key: 'side', label: 'Inner square side', min: 10, max: 80, step: 1, unit: 'mm' }, tauParam, sheetParam],
  defaults: { side: 30, twist: 12, sheet: 3 },
  presets: [
    { name: 'Gentle', values: { side: 30, twist: 5, sheet: 3 } },
    { name: 'Strong', values: { side: 30, twist: 30, sheet: 3.5 } },
  ],
  generate: (p) => {
    const t = twist(4, p.side, p.twist, p.sheet)
    return { fold: t.fold, info: [`Square sheet ${(t.R1 * Math.SQRT2).toFixed(0)} mm across, inner square ${p.side} mm.`] }
  },
}

export const triangleTwistDef: PatternDef = {
  id: 'triangle-twist',
  name: 'Resch-like triangle twist',
  blurb: 'The same twist on a triangle: three pleated bands around a turning triangle, as in Resch patterns.',
  params: [{ key: 'side', label: 'Inner triangle side', min: 10, max: 80, step: 1, unit: 'mm' }, tauParam, sheetParam],
  defaults: { side: 30, twist: 12, sheet: 3 },
  presets: [
    { name: 'Gentle', values: { side: 30, twist: 5, sheet: 3 } },
    { name: 'Strong', values: { side: 30, twist: 30, sheet: 3.5 } },
  ],
  generate: (p) => {
    const t = twist(3, p.side, p.twist, p.sheet)
    return { fold: t.fold, info: [`Triangular sheet, circumradius ${t.R1.toFixed(0)} mm, inner triangle ${p.side} mm.`] }
  },
}
