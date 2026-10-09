// Local flat-foldability: Maekawa's and Kawasaki's theorems at every interior vertex.
import type { Fold } from './fold.ts'

export interface VertexReport {
  vertex: number
  x: number
  y: number
  degree: number
  mountains: number
  valleys: number
  /** Alternating sector sums (radians). Kawasaki needs both to equal pi. */
  sums: [number, number]
  /** 'unknown' when some creases are unassigned (U), so only the geometry can be judged. */
  maekawa: 'ok' | 'fail' | 'unknown'
  kawasaki: 'ok' | 'fail'
  ok: boolean
}

export interface FlatFoldReport {
  vertices: VertexReport[]
  interior: number
  failing: VertexReport[]
  ok: boolean
}

const DEG_TOL = 1e-6 // radians; generated patterns are exact to ~1e-12

/** A vertex is on the boundary if a B edge touches it. Without any B edges, boundary edges are those in one face, else the bounding box. */
function boundaryVertices(fold: Fold): Set<number> {
  const out = new Set<number>()
  const hasB = fold.edges_assignment.some((a) => a === 'B')
  if (hasB) {
    fold.edges_vertices.forEach(([a, b], i) => {
      if (fold.edges_assignment[i] === 'B') { out.add(a); out.add(b) }
    })
    return out
  }
  if (fold.faces_vertices?.length) {
    const count = new Map<string, number>()
    for (const f of fold.faces_vertices) {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length]
        const k = a < b ? `${a},${b}` : `${b},${a}`
        count.set(k, (count.get(k) ?? 0) + 1)
      }
    }
    for (const [k, c] of count) {
      if (c === 1) k.split(',').forEach((s) => out.add(+s))
    }
    return out
  }
  const xs = fold.vertices_coords.map((p) => p[0]), ys = fold.vertices_coords.map((p) => p[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const eps = 1e-9 * Math.max(1, x1 - x0, y1 - y0)
  fold.vertices_coords.forEach(([x, y], i) => {
    if (Math.abs(x - x0) < eps || Math.abs(x - x1) < eps || Math.abs(y - y0) < eps || Math.abs(y - y1) < eps) out.add(i)
  })
  return out
}

export function checkFlatFoldable(fold: Fold): FlatFoldReport {
  const onBoundary = boundaryVertices(fold)
  const incident: { angle: number; a: string }[][] = fold.vertices_coords.map(() => [])
  fold.edges_vertices.forEach(([u, v], i) => {
    const a = fold.edges_assignment[i]
    if (a === 'B' || a === 'F') return // flat edges are not creases
    const [ux, uy] = fold.vertices_coords[u], [vx, vy] = fold.vertices_coords[v]
    incident[u].push({ angle: Math.atan2(vy - uy, vx - ux), a })
    incident[v].push({ angle: Math.atan2(uy - vy, ux - vx), a })
  })
  const vertices: VertexReport[] = []
  incident.forEach((list, vertex) => {
    if (onBoundary.has(vertex) || list.length === 0) return
    list.sort((p, q) => p.angle - q.angle)
    const n = list.length
    const sectors = list.map((e, i) => {
      const next = list[(i + 1) % n].angle
      const d = next - e.angle
      return n === 1 ? 2 * Math.PI : d <= 0 ? d + 2 * Math.PI : d
    })
    const sums: [number, number] = [0, 0]
    sectors.forEach((s, i) => { sums[i % 2] += s })
    const mountains = list.filter((e) => e.a === 'M').length
    const valleys = list.filter((e) => e.a === 'V').length
    const unassigned = list.some((e) => e.a === 'U')
    const kawasaki = n % 2 === 0 && n >= 2 && Math.abs(sums[0] - Math.PI) < DEG_TOL && Math.abs(sums[1] - Math.PI) < DEG_TOL ? 'ok' : 'fail'
    const maekawa = unassigned ? 'unknown' : Math.abs(mountains - valleys) === 2 ? 'ok' : 'fail'
    const [x, y] = fold.vertices_coords[vertex]
    vertices.push({ vertex, x, y, degree: n, mountains, valleys, sums, maekawa, kawasaki, ok: kawasaki === 'ok' && maekawa !== 'fail' })
  })
  const failing = vertices.filter((v) => !v.ok)
  return { vertices, interior: vertices.length, failing, ok: failing.length === 0 }
}
