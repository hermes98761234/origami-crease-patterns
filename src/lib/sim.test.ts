import { describe, expect, it } from 'vitest'
import { dihedral, FoldSim, MAX_FOLD } from './sim.ts'
import { PATTERNS } from './patterns.ts'

describe('dihedral angle', () => {
  const hinge = (a: number) => Float64Array.from([0, 0, 0, 1, 0, 0, 0.5, Math.cos(a), Math.sin(a), 0.5, -Math.cos(a), Math.sin(a)])
  it('is 0 for a flat hinge and positive for wings raised toward the viewer (valley)', () => {
    expect(dihedral(hinge(0), 0, 1, 2, 3)).toBeCloseTo(0, 12)
    expect(dihedral(hinge(0.4), 0, 1, 2, 3)).toBeCloseTo(0.8, 9)
    expect(dihedral(hinge(-0.4), 0, 1, 2, 3)).toBeCloseTo(-0.8, 9)
  })
})

describe('simulator', () => {
  const def = PATTERNS.find((p) => p.id === 'yoshimura')!
  const { fold } = def.generate({ ...def.defaults, cols: 4, rows: 3 })
  it('folds a Yoshimura sheet with small edge strain and the requested creases', () => {
    const sim = new FoldSim(fold)
    sim.setAmount(0.6)
    for (let i = 0; i < 400 && sim.step(20) > 1e-4; i++);
    expect(sim.maxStrain()).toBeLessThan(0.06)
    const z = sim.positions().map((p) => p[2])
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(3)
    expect(MAX_FOLD).toBeGreaterThan(2.5)
  })
  it('returns to flat when the amount goes back to 0', () => {
    const sim = new FoldSim(fold)
    sim.setAmount(0.6)
    for (let i = 0; i < 100; i++) sim.step(20)
    sim.setAmount(0)
    for (let i = 0; i < 400 && sim.step(20) > 1e-4; i++);
    const z = sim.positions().map((p) => p[2])
    expect(Math.max(...z.map(Math.abs))).toBeLessThan(0.3)
  })
})
