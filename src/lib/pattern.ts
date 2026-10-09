import type { Fold, Vec3 } from './fold.ts'

export interface Param {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export interface Pattern {
  fold: Fold
  /** Exact folded positions (aligned with fold.vertices_coords) for fold amount t in [0, 1]. Absent: use the simulator. */
  positions?: (t: number) => Vec3[]
  /** Short facts about the generated pattern, shown under the controls. */
  info: string[]
}

export interface PatternDef {
  id: string
  name: string
  blurb: string
  params: Param[]
  defaults: Record<string, number>
  generate: (p: Record<string, number>) => Pattern
  /** True if the generic simulator gives a believable 3D fold for this pattern. */
  sim3d?: boolean
  presets?: { name: string; values: Record<string, number> }[]
}

export const rad = (d: number) => (d * Math.PI) / 180
