// FOLD (https://github.com/edemaine/fold) data model, parsing and serialising, plus small geometry helpers.

export type Assignment = 'M' | 'V' | 'B' | 'F' | 'U'
export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

export interface Fold {
  vertices_coords: Vec2[]
  edges_vertices: [number, number][]
  edges_assignment: Assignment[]
  faces_vertices?: number[][]
}

const ASSIGNMENTS: Assignment[] = ['M', 'V', 'B', 'F', 'U']
const FOLD_ANGLE: Record<Assignment, number | null> = { M: -180, V: 180, B: 0, F: 0, U: null }

/** Builds a Fold from vertex coordinates and CCW faces. Edges come from the faces; edges in one face are boundary. */
export function buildFold(coords: Vec2[], faces: number[][], assign: (a: number, b: number) => Assignment): Fold {
  const count = new Map<string, number>()
  const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`)
  const order: [number, number][] = []
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length]
      const k = key(a, b)
      if (!count.has(k)) order.push(a < b ? [a, b] : [b, a])
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  return {
    vertices_coords: coords,
    edges_vertices: order,
    edges_assignment: order.map(([a, b]) => (count.get(key(a, b)) === 1 ? 'B' : assign(a, b))),
    faces_vertices: faces,
  }
}

export function serializeFold(f: Fold, creator = 'origami-crease-patterns'): string {
  const out = {
    file_spec: 1.2,
    file_creator: creator,
    file_classes: ['singleModel'],
    frame_classes: ['creasePattern'],
    vertices_coords: f.vertices_coords,
    edges_vertices: f.edges_vertices,
    edges_assignment: f.edges_assignment,
    edges_foldAngle: f.edges_assignment.map((a) => FOLD_ANGLE[a]),
    ...(f.faces_vertices ? { faces_vertices: f.faces_vertices } : {}),
  }
  return JSON.stringify(out, null, 1)
}

/** Parses FOLD JSON. Throws an Error with a readable message on invalid input. */
export function parseFold(text: string): Fold {
  let j: Record<string, unknown>
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (!j || typeof j !== 'object') throw new Error('FOLD file must be a JSON object.')
  const vc = j.vertices_coords
  if (!Array.isArray(vc) || vc.length === 0) throw new Error('Missing vertices_coords.')
  const coords: Vec2[] = vc.map((p, i) => {
    if (!Array.isArray(p) || p.length < 2 || !p.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      throw new Error(`vertices_coords[${i}] must be [x, y].`)
    }
    return [p[0], p[1]]
  })
  const faces = Array.isArray(j.faces_vertices) ? (j.faces_vertices as number[][]) : undefined
  let ev = j.edges_vertices as [number, number][] | undefined
  if (!ev && faces) {
    const seen = new Set<string>()
    ev = []
    for (const f of faces) {
      for (let i = 0; i < f.length; i++) {
        const a = Math.min(f[i], f[(i + 1) % f.length]), b = Math.max(f[i], f[(i + 1) % f.length])
        if (!seen.has(`${a},${b}`)) { seen.add(`${a},${b}`); ev.push([a, b]) }
      }
    }
  }
  if (!Array.isArray(ev)) throw new Error('Missing edges_vertices.')
  ev.forEach((e, i) => {
    if (!Array.isArray(e) || e.length !== 2 || !e.every((v) => Number.isInteger(v) && v >= 0 && v < coords.length)) {
      throw new Error(`edges_vertices[${i}] must be two valid vertex indices.`)
    }
    if (e[0] === e[1]) throw new Error(`edges_vertices[${i}] is a self-loop.`)
  })
  faces?.forEach((f, i) => {
    if (!Array.isArray(f) || f.length < 3 || !f.every((v) => Number.isInteger(v) && v >= 0 && v < coords.length)) {
      throw new Error(`faces_vertices[${i}] must list at least 3 valid vertex indices.`)
    }
  })
  const ea = j.edges_assignment as unknown[] | undefined
  const fa = j.edges_foldAngle as unknown[] | undefined
  const assignment: Assignment[] = ev.map((_, i) => {
    const a = ea?.[i]
    if (typeof a === 'string') {
      const u = a.toUpperCase() as Assignment
      if (!ASSIGNMENTS.includes(u)) throw new Error(`edges_assignment[${i}] "${a}" is not one of M V B F U.`)
      return u
    }
    const ang = fa?.[i]
    if (typeof ang === 'number') return ang < 0 ? 'M' : ang > 0 ? 'V' : 'F'
    return 'U'
  })
  return { vertices_coords: coords, edges_vertices: ev.map(([a, b]) => [a, b]), edges_assignment: assignment, ...(faces ? { faces_vertices: faces.map((f) => [...f]) } : {}) }
}

export function bounds(coords: ArrayLike<number>[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of coords as [number, number][]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])

/**
 * Crease type of every interior edge of a folded model, judged from the front (the side whose
 * face normals point up in the flat pattern): 'V' if the two faces fold toward the viewer, 'M' if away.
 * Boundary edges and edges whose faces are coplanar give 'F'/'B'.
 */
export function foldedAssignments(fold: Fold, pos: Vec3[], tol = 1e-7): Assignment[] {
  const faces = fold.faces_vertices ?? []
  const sides = new Map<string, { from: number; to: number; third: number }[]>()
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length], c = f[(i + 2) % f.length]
      const k = a < b ? `${a},${b}` : `${b},${a}`
      sides.set(k, [...(sides.get(k) ?? []), { from: a, to: b, third: c }])
    }
  }
  return fold.edges_vertices.map(([a, b]) => {
    const s = sides.get(a < b ? `${a},${b}` : `${b},${a}`) ?? []
    if (s.length !== 2) return 'B'
    const [l, r] = s
    // Face l traverses the edge a->b-ish; use its own orientation for the normal.
    const n = cross3(sub3(pos[l.to], pos[l.from]), sub3(pos[l.third], pos[l.from]))
    const nl = len3(n)
    const d = dot3(sub3(pos[r.third], pos[l.from]), n) / (nl || 1)
    // Outside neighbour on the far side: compare with the position of l.third's side.
    if (Math.abs(d) < tol) return 'F'
    return d > 0 ? 'V' : 'M'
  })
}
