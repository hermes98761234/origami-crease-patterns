import { kreslingDef } from './kresling.ts'
import { miuraDef } from './miura.ts'
import { waterbombDef, yoshimuraDef } from './lattice.ts'
import { squareTwistDef, triangleTwistDef } from './twist.ts'
import type { PatternDef } from './pattern.ts'

export const PATTERNS: PatternDef[] = [miuraDef, kreslingDef, yoshimuraDef, waterbombDef, squareTwistDef, triangleTwistDef]

export function getPattern(id: string): PatternDef {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0]
}
