import { describe, expect, it } from 'vitest'
import { checkFlatFoldable } from './flatfold.ts'
import type { Assignment, Fold } from './fold.ts'
import { PATTERNS } from './patterns.ts'

/** One interior vertex at the origin with rays at the given angles (degrees), inside a big square sheet. */
function vertex(angles: number[], assign: Assignment[]): Fold {
  const coords: [number, number][] = [[0, 0]]
  const edges: [number, number][] = []
  const asg: Assignment[] = []
  angles.forEach((a, i) => {
    coords.push([Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)])
    edges.push([0, i + 1])
    asg.push(assign[i])
  })
  // Closing boundary so the origin is interior.
  for (let i = 1; i <= angles.length; i++) { edges.push([i, (i % angles.length) + 1]); asg.push('B') }
  return { vertices_coords: coords, edges_vertices: edges, edges_assignment: asg }
}

describe('Kawasaki and Maekawa on single vertices', () => {
  it('accepts the 4 right angles with 3 valleys and 1 mountain', () => {
    const r = checkFlatFoldable(vertex([0, 90, 180, 270], ['V', 'V', 'M', 'V']))
    expect(r.interior).toBe(1)
    expect(r.ok).toBe(true)
  })
  it('rejects wrong mountain/valley counts (Maekawa)', () => {
    const r = checkFlatFoldable(vertex([0, 90, 180, 270], ['V', 'V', 'M', 'M']))
    expect(r.failing[0]).toMatchObject({ maekawa: 'fail', kawasaki: 'ok', mountains: 2, valleys: 2 })
  })
  it('rejects angles whose alternating sums differ from 180 (Kawasaki)', () => {
    const r = checkFlatFoldable(vertex([0, 50, 180, 270], ['V', 'V', 'M', 'V']))
    expect(r.failing[0].kawasaki).toBe('fail')
    expect(r.failing[0].maekawa).toBe('ok')
  })
  it('accepts a non-orthogonal degree-4 vertex with alternating sums of 180', () => {
    // sectors 60, 120, 120, 60 -> 60+120 = 180 and 120+60 = 180
    const r = checkFlatFoldable(vertex([0, 60, 180, 300], ['M', 'M', 'V', 'M']))
    expect(r.ok).toBe(true)
    expect(r.vertices[0].sums[0]).toBeCloseTo(Math.PI, 9)
  })
  it('rejects odd degree', () => {
    expect(checkFlatFoldable(vertex([0, 120, 240], ['M', 'M', 'V'])).failing[0].kawasaki).toBe('fail')
  })
  it('reports Maekawa as unknown while creases are unassigned', () => {
    const r = checkFlatFoldable(vertex([0, 90, 180, 270], ['U', 'U', 'U', 'U']))
    expect(r.vertices[0].maekawa).toBe('unknown')
    expect(r.ok).toBe(true)
  })
})

describe('generated patterns', () => {
  for (const def of PATTERNS) {
    it(`${def.name}: every interior vertex is flat-foldable, for the defaults and each preset`, () => {
      for (const values of [def.defaults, ...(def.presets ?? []).map((p) => p.values)]) {
        const { fold } = def.generate(values)
        const r = checkFlatFoldable(fold)
        expect(r.interior).toBeGreaterThan(0)
        expect(r.failing).toEqual([])
      }
    })
    it(`${def.name}: faces are counter-clockwise and boundary edges are labelled B`, () => {
      const { fold } = def.generate(def.defaults)
      for (const f of fold.faces_vertices!) {
        let area = 0
        f.forEach((v, i) => {
          const [x1, y1] = fold.vertices_coords[v], [x2, y2] = fold.vertices_coords[f[(i + 1) % f.length]]
          area += x1 * y2 - x2 * y1
        })
        expect(area).toBeGreaterThan(1e-9)
      }
      expect(fold.edges_assignment.filter((a) => a === 'B').length).toBeGreaterThanOrEqual(3)
    })
  }

  it('Miura-ori at 60° has the expected vertex count and degree-4 interior vertices', () => {
    const r = checkFlatFoldable(PATTERNS[0].generate({ cols: 4, rows: 3, angle: 60, aspect: 1, size: 20 }).fold)
    expect(r.interior).toBe(3 * 2)
    expect(r.vertices.every((v) => v.degree === 4)).toBe(true)
  })

  it('a perturbed interior vertex is flagged and nothing else is', () => {
    const { fold } = PATTERNS[0].generate(PATTERNS[0].defaults)
    const r0 = checkFlatFoldable(fold)
    const victim = r0.vertices[7].vertex
    fold.vertices_coords[victim] = [fold.vertices_coords[victim][0] + 1.3, fold.vertices_coords[victim][1] + 0.4]
    const r = checkFlatFoldable(fold)
    expect(r.failing.map((v) => v.vertex)).toContain(victim)
    expect(r.failing.every((v) => v.kawasaki === 'fail')).toBe(true)
  })

  it('flipping one interior crease breaks Maekawa at its two end vertices', () => {
    const { fold } = PATTERNS[2].generate(PATTERNS[2].defaults)
    const r0 = checkFlatFoldable(fold)
    const inner = new Set(r0.vertices.map((v) => v.vertex))
    const e = fold.edges_vertices.findIndex(([a, b], i) => inner.has(a) && inner.has(b) && fold.edges_assignment[i] === 'M')
    fold.edges_assignment[e] = 'V'
    const r = checkFlatFoldable(fold)
    expect(r.failing.map((v) => v.vertex).sort()).toEqual([...fold.edges_vertices[e]].sort())
    expect(r.failing.every((v) => v.maekawa === 'fail')).toBe(true)
  })
})
