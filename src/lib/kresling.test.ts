import { describe, expect, it } from 'vitest'
import { foldedAssignments, len3, sub3, type Vec3 } from './fold.ts'
import { kresling } from './kresling.ts'

const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b))

describe('Kresling cylinder', () => {
  const k = kresling(6, 20, 3, 2.1, 25)
  const flat = (a: number, b: number) => Math.hypot(k.fold.vertices_coords[a][0] - k.fold.vertices_coords[b][0], k.fold.vertices_coords[a][1] - k.fold.vertices_coords[b][1])
  const isRing = (a: number, b: number) => Math.abs(k.fold.vertices_coords[a][1] - k.fold.vertices_coords[b][1]) < 1e-9

  it('the deployed state reproduces every flat edge length (flat sheet rolls into a cylinder exactly)', () => {
    const pos = k.positions(0)
    k.fold.edges_vertices.forEach(([a, b]) => expect(dist(pos[a], pos[b])).toBeCloseTo(flat(a, b), 9))
  })
  it('ring edges and vertical edges keep their length all the way down', () => {
    for (const t of [0.2, 0.5, 0.8, 1]) {
      const pos = k.positions(t)
      k.fold.edges_vertices.forEach(([a, b]) => {
        if (isRing(a, b)) expect(dist(pos[a], pos[b])).toBeCloseTo(flat(a, b), 9)
      })
    }
  })
  it('the vertical creases keep their length m while the diagonals flex', () => {
    // vertices (k, r) have index r*(n+1)+k; (k, r) -> (k, r+1) is a vertical crease
    for (const t of [0, 0.4, 1]) {
      const pos = k.positions(t)
      for (let r = 0; r < 3; r++) for (let i = 0; i <= 6; i++) expect(dist(pos[r * 7 + i], pos[(r + 1) * 7 + i])).toBeCloseTo(k.m, 9)
    }
  })
  it('is bistable: the second state has the same diagonal length d as the first', () => {
    expect(k.bistable).toBe(true)
    const a = k.positions(0), b = k.positions(1)
    for (const pos of [a, b]) {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) expect(dist(pos[r * 7 + i + 1], pos[(r + 1) * 7 + i])).toBeCloseTo(k.d0, 6)
    }
    // and the story is shorter
    expect(b[7][2]).toBeLessThan(a[7][2])
  })
  it('strain is zero at both stable states and positive in between', () => {
    const d = (t: number) => {
      const pos = k.positions(t)
      return dist(pos[1], pos[7]) // B_1 to T_0
    }
    expect(d(0)).toBeCloseTo(d(1), 6)
    expect(Math.abs(d(0.5) - d(0))).toBeGreaterThan(0.5)
    expect(k.strain).toBeGreaterThan(0)
  })
  it('the seam closes: vertex (n, r) lands on vertex (0, r)', () => {
    const pos = k.positions(0.3)
    for (let r = 0; r <= 3; r++) expect(dist(pos[r * 7], pos[r * 7 + 6])).toBeLessThan(1e-9)
  })
  it('mountain/valley labels agree with the deployed geometry', () => {
    expect(foldedAssignments(k.fold, k.positions(0))).toEqual(k.fold.edges_assignment)
  })
  it('a Kresling that cannot reach a twin state collapses to zero height instead', () => {
    const c = kresling(6, 20, 2, 0.6, 25)
    expect(c.bistable).toBe(false)
    expect(c.height1).toBeCloseTo(0, 6)
  })
})
