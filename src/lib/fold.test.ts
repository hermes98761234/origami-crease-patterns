import { describe, expect, it } from 'vitest'
import { parseFold, serializeFold } from './fold.ts'
import { PATTERNS } from './patterns.ts'

describe('FOLD round trip', () => {
  for (const def of PATTERNS) {
    it(`${def.name} survives serialise then parse unchanged`, () => {
      const { fold } = def.generate(def.defaults)
      const back = parseFold(serializeFold(fold))
      expect(back).toEqual(fold)
    })
  }

  it('writes a spec-compliant header and fold angles', () => {
    const { fold } = PATTERNS[0].generate(PATTERNS[0].defaults)
    const j = JSON.parse(serializeFold(fold))
    expect(j.file_spec).toBe(1.2)
    expect(j.frame_classes).toContain('creasePattern')
    j.edges_assignment.forEach((a: string, i: number) => {
      expect(j.edges_foldAngle[i]).toBe(a === 'M' ? -180 : a === 'V' ? 180 : 0)
    })
  })

  it('reads a hand-written file: 3D coordinates drop z, fold angles stand in for assignments', () => {
    const f = parseFold(JSON.stringify({
      vertices_coords: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      edges_vertices: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
      edges_foldAngle: [0, 0, 0, 0, -180],
    }))
    expect(f.vertices_coords[2]).toEqual([1, 1])
    expect(f.edges_assignment).toEqual(['F', 'F', 'F', 'F', 'M'])
  })

  it('derives edges from faces when edges_vertices is missing, and defaults to unassigned', () => {
    const f = parseFold(JSON.stringify({ vertices_coords: [[0, 0], [1, 0], [0, 1]], faces_vertices: [[0, 1, 2]] }))
    expect(f.edges_vertices).toHaveLength(3)
    expect(f.edges_assignment).toEqual(['U', 'U', 'U'])
  })

  it('rejects malformed input with a readable message', () => {
    expect(() => parseFold('{nope')).toThrow(/JSON/)
    expect(() => parseFold('{}')).toThrow(/vertices_coords/)
    expect(() => parseFold('{"vertices_coords":[[0,0],[1,0]],"edges_vertices":[[0,5]]}')).toThrow(/edges_vertices\[0\]/)
    expect(() => parseFold('{"vertices_coords":[[0,0],[1,0]],"edges_vertices":[[0,1]],"edges_assignment":["X"]}')).toThrow(/edges_assignment/)
  })
})
