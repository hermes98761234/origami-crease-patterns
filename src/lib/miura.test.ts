import { describe, expect, it } from 'vitest'
import { foldedAssignments, len3, sub3, cross3, dot3, type Vec3 } from './fold.ts'
import { miura } from './miura.ts'

const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b))

describe('Miura-ori rigid folding', () => {
  for (const [alpha, aspect] of [[60, 1], [75, 1.5], [35, 0.8]]) {
    const m = miura(5, 4, alpha, aspect, 20)
    it(`α=${alpha}° a/b=${aspect}: every edge keeps its flat length at all fold amounts`, () => {
      for (const t of [0, 0.1, 0.35, 0.6, 0.9, 1]) {
        const pos = m.positions(t)
        m.fold.edges_vertices.forEach(([a, b]) => {
          const [ax, ay] = m.fold.vertices_coords[a], [bx, by] = m.fold.vertices_coords[b]
          expect(dist(pos[a], pos[b])).toBeCloseTo(Math.hypot(ax - bx, ay - by), 9)
        })
      }
    })
    it(`α=${alpha}° a/b=${aspect}: faces stay planar and keep their diagonals`, () => {
      const pos = m.positions(0.55)
      for (const f of m.fold.faces_vertices!) {
        const [p0, p1, p2, p3] = f.map((v) => pos[v])
        const n = cross3(sub3(p1, p0), sub3(p3, p0))
        expect(Math.abs(dot3(sub3(p2, p0), n)) / len3(n)).toBeLessThan(1e-9)
        const [c0, c1, c2] = f.map((v) => m.fold.vertices_coords[v])
        expect(dist(p0, p2)).toBeCloseTo(Math.hypot(c2[0] - c0[0], c2[1] - c0[1]), 9)
        expect(dist(p1, p3)).toBeCloseTo(Math.hypot(c1[0] - m.fold.vertices_coords[f[3]][0], c1[1] - m.fold.vertices_coords[f[3]][1]), 9)
      }
    })
  }

  const m = miura(6, 6, 60, 1, 20)
  it('t = 0 reproduces the flat pattern', () => {
    m.positions(0).forEach((p, i) => {
      expect(p[0]).toBeCloseTo(m.fold.vertices_coords[i][0], 9)
      expect(p[1]).toBeCloseTo(m.fold.vertices_coords[i][1], 9)
      expect(p[2]).toBeCloseTo(0, 9)
    })
  })
  it('mountain/valley labels agree with the folded geometry', () => {
    const asg = foldedAssignments(m.fold, m.positions(0.5))
    expect(asg).toEqual(m.fold.edges_assignment)
  })
  it('fully folded (φ = α), the sheet has collapsed to zero extent along y', () => {
    const p = m.positions(1)
    expect(Math.max(...p.map((q) => q[1]))).toBeCloseTo(0, 6)
  })
  it('both extents shrink monotonically while the height grows (negative Poisson ratio)', () => {
    const ext = (t: number) => {
      const p = m.positions(t)
      return [0, 1, 2].map((k) => Math.max(...p.map((q) => q[k])) - Math.min(...p.map((q) => q[k])))
    }
    let prev = ext(0)
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const e = ext(t)
      expect(e[0]).toBeLessThan(prev[0])
      expect(e[1]).toBeLessThan(prev[1])
      expect(e[2]).toBeGreaterThan(prev[2])
      prev = e
    }
  })
  it('matches the closed-form height of a cell, b sin(phi)', () => {
    const alpha = (60 * Math.PI) / 180, phi = 0.5 * alpha
    const p = miura(2, 2, 60, 1, 20).positions(0.5)
    expect(Math.max(...p.map((q) => q[2]))).toBeCloseTo(20 * Math.sin(phi), 9)
  })
})
