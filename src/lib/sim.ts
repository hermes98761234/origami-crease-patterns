// Small dynamic-relaxation folder for patterns without a closed-form motion. Faces are triangulated; edges are
// springs at their flat length, and every crease is a torsion spring driving its dihedral angle to
// +-t * MAX_FOLD (valley +, mountain -). Triangulation diagonals and F edges aim for 0, which keeps faces flat.
import type { Fold, Vec3 } from './fold.ts'

export const MAX_FOLD = 0.9 * Math.PI
const K_EDGE = 12, K_CREASE = 0.7, K_FLAT = 3, DT = 0.1, DAMP = 0.88

interface Hinge { i: number; j: number; k: number; l: number; kind: 'M' | 'V' | 'flat' }

/** Signed fold angle at edge i->j with wings k (left of i->j) and l (right). Valley is positive. */
export function dihedral(p: Float64Array, i: number, j: number, k: number, l: number): number {
  const g = (a: number, c: number) => p[3 * a + c]
  const ex = g(j, 0) - g(i, 0), ey = g(j, 1) - g(i, 1), ez = g(j, 2) - g(i, 2)
  const kx = g(k, 0) - g(i, 0), ky = g(k, 1) - g(i, 1), kz = g(k, 2) - g(i, 2)
  const lx = g(l, 0) - g(j, 0), ly = g(l, 1) - g(j, 1), lz = g(l, 2) - g(j, 2)
  const n1x = ey * kz - ez * ky, n1y = ez * kx - ex * kz, n1z = ex * ky - ey * kx
  // n2 = (p_i - p_j) x (p_l - p_j) = -e x l
  const n2x = -(ey * lz - ez * ly), n2y = -(ez * lx - ex * lz), n2z = -(ex * ly - ey * lx)
  const el = Math.hypot(ex, ey, ez) || 1
  const cx = n1y * n2z - n1z * n2y, cy = n1z * n2x - n1x * n2z, cz = n1x * n2y - n1y * n2x
  const sin = (cx * ex + cy * ey + cz * ez) / el
  const cos = n1x * n2x + n1y * n2y + n1z * n2z
  return -Math.atan2(sin, cos)
}

export class FoldSim {
  readonly n: number
  p: Float64Array
  private v: Float64Array
  private f: Float64Array
  private edges: { a: number; b: number; rest: number }[] = []
  private hinges: Hinge[] = []
  private scale: number
  private t = 0

  constructor(fold: Fold) {
    this.n = fold.vertices_coords.length
    const coords = fold.vertices_coords
    const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
    const kind = new Map<string, 'M' | 'V' | 'flat'>()
    fold.edges_vertices.forEach(([a, b], i) => {
      const s = fold.edges_assignment[i]
      kind.set(key(a, b), s === 'M' ? 'M' : s === 'V' ? 'V' : 'flat')
    })
    const tris: [number, number, number][] = []
    for (const f of fold.faces_vertices ?? []) for (let i = 1; i + 1 < f.length; i++) tris.push([f[0], f[i], f[i + 1]])
    const sides = new Map<string, { a: number; b: number; w: number }[]>()
    for (const [a, b, c] of tris) {
      for (const [u, w, x] of [[a, b, c], [b, c, a], [c, a, b]]) {
        sides.set(key(u, w), [...(sides.get(key(u, w)) ?? []), { a: u, b: w, w: x }])
      }
    }
    let total = 0
    for (const [k, list] of sides) {
      const [a, b] = k.split(',').map(Number)
      const rest = Math.hypot(coords[a][0] - coords[b][0], coords[a][1] - coords[b][1])
      this.edges.push({ a, b, rest })
      total += rest
      if (list.length === 2) {
        const [s0, s1] = list // s0 traverses a->b or b->a; wings are on its left; the other side has the opposite direction
        this.hinges.push({ i: s0.a, j: s0.b, k: s0.w, l: s1.w, kind: kind.get(k) ?? 'flat' })
      }
    }
    this.scale = total / (this.edges.length || 1) || 1
    this.p = new Float64Array(3 * this.n)
    coords.forEach(([x, y], i) => { this.p[3 * i] = x / this.scale; this.p[3 * i + 1] = y / this.scale })
    this.edges.forEach((e) => { e.rest /= this.scale })
    this.v = new Float64Array(3 * this.n)
    this.f = new Float64Array(3 * this.n)
  }

  setAmount(t: number) { this.t = Math.min(Math.max(t, 0), 1) }

  /** Runs `iters` relaxation steps and returns the largest vertex speed (small means settled). */
  step(iters: number): number {
    const { p, v, f } = this
    let speed = 0
    for (let it = 0; it < iters; it++) {
      f.fill(0)
      for (const e of this.edges) {
        const dx = p[3 * e.b] - p[3 * e.a], dy = p[3 * e.b + 1] - p[3 * e.a + 1], dz = p[3 * e.b + 2] - p[3 * e.a + 2]
        const len = Math.hypot(dx, dy, dz) || 1e-9
        const s = (K_EDGE * (len - e.rest)) / len
        f[3 * e.a] += s * dx; f[3 * e.a + 1] += s * dy; f[3 * e.a + 2] += s * dz
        f[3 * e.b] -= s * dx; f[3 * e.b + 1] -= s * dy; f[3 * e.b + 2] -= s * dz
      }
      for (const h of this.hinges) {
        const target = h.kind === 'V' ? this.t * MAX_FOLD : h.kind === 'M' ? -this.t * MAX_FOLD : 0
        const kc = h.kind === 'flat' ? K_FLAT : K_CREASE
        let err = target - dihedral(p, h.i, h.j, h.k, h.l)
        err = Math.atan2(Math.sin(err), Math.cos(err))
        if (Math.abs(err) < 1e-9) continue
        for (const a of [h.i, h.j, h.k, h.l]) {
          for (let c = 0; c < 3; c++) {
            const o = p[3 * a + c], d = 1e-6
            p[3 * a + c] = o + d
            const up = dihedral(p, h.i, h.j, h.k, h.l)
            p[3 * a + c] = o - d
            const dn = dihedral(p, h.i, h.j, h.k, h.l)
            p[3 * a + c] = o
            f[3 * a + c] += kc * err * ((up - dn) / (2 * d))
          }
        }
      }
      speed = 0
      for (let i = 0; i < 3 * this.n; i++) {
        v[i] = (v[i] + f[i] * DT) * DAMP
        const dv = Math.max(-0.5, Math.min(0.5, v[i] * DT))
        p[i] += dv
        speed = Math.max(speed, Math.abs(v[i]))
      }
    }
    return speed
  }

  positions(): Vec3[] {
    const out: Vec3[] = []
    for (let i = 0; i < this.n; i++) out.push([this.p[3 * i] * this.scale, this.p[3 * i + 1] * this.scale, this.p[3 * i + 2] * this.scale])
    return out
  }

  /** Largest relative edge length error against the flat sheet. */
  maxStrain(): number {
    let m = 0
    for (const e of this.edges) {
      const len = Math.hypot(this.p[3 * e.b] - this.p[3 * e.a], this.p[3 * e.b + 1] - this.p[3 * e.a + 1], this.p[3 * e.b + 2] - this.p[3 * e.a + 2])
      m = Math.max(m, Math.abs(len - e.rest) / e.rest)
    }
    return m
  }
}
