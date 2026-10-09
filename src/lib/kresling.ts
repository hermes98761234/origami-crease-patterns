// Kresling pattern: a stack of twisted n-gon rings joined by triangles.
//
// Folded model: ring r has its n vertices at radius R, angle k 2pi/n + r psi, height r h, so
//   vertical edge  m^2 = h^2 + 4R^2 sin^2(psi/2)            (ring r to ring r+1, same k)
//   diagonal edge  d^2 = h^2 + 4R^2 sin^2(pi/n - psi/2)     (vertex k+1 to vertex k of the next ring)
//   ring edge      l   = 2R sin(pi/n)
// The flat sheet is a sheared strip: B_k = (k l, 0), T_k = B_k + (delta, w) with delta = (l^2 + m^2 - d^2) / 2l.
// Kresling is not rigid-foldable: while folding we keep l and m exact and let the diagonal creases flex.
// With m and d fixed, m^2 - d^2 = 4R^2 sin(pi/n) sin(psi - pi/n), so the second solution is psi' = pi + 2pi/n - psi
// (the bistable "other" state) when its height is real.
import { buildFold, type Vec3 } from './fold.ts'
import { rad, type PatternDef } from './pattern.ts'

export function kresling(n: number, ell: number, stories: number, hRatio: number, psi0Deg: number) {
  const R = ell / (2 * Math.sin(Math.PI / n))
  const h0 = hRatio * R
  const psi0 = rad(psi0Deg)
  const s2 = (psi: number) => 4 * R * R * Math.sin(psi / 2) ** 2
  const m2 = h0 * h0 + s2(psi0)
  const m = Math.sqrt(m2)
  const dOf = (h: number, psi: number) => Math.sqrt(h * h + s2(Math.PI / n * 2 - psi))
  const d0 = dOf(h0, psi0)
  const delta = (ell * ell + m2 - d0 * d0) / (2 * ell)
  const w = Math.sqrt(m2 - delta * delta)

  const coords: [number, number][] = []
  const id = (k: number, r: number) => r * (n + 1) + k
  const where: [number, number][] = []
  for (let r = 0; r <= stories; r++) {
    for (let k = 0; k <= n; k++) { coords.push([k * ell + r * delta, r * w]); where.push([k, r]) }
  }
  const faces: number[][] = []
  for (let r = 0; r < stories; r++) {
    for (let k = 0; k < n; k++) {
      faces.push([id(k, r), id(k + 1, r), id(k, r + 1)])
      faces.push([id(k + 1, r), id(k + 1, r + 1), id(k, r + 1)])
    }
  }
  const fold = buildFold(coords, faces, (p, q) => {
    const [k1, r1] = where[p], [k2, r2] = where[q]
    if (r1 === r2) return 'V' // ring edges
    if (k1 === k2) return 'M' // vertical edges
    return 'M' // diagonals
  })

  // End of the fold: the bistable twin if it exists, else the fully collapsed state (h = 0).
  const other = Math.PI + (2 * Math.PI) / n - psi0
  const psiLimit = m >= 2 * R ? Infinity : 2 * Math.asin(m / (2 * R))
  const otherOk = other > psi0 && s2(other) <= m2 + 1e-9 && (m >= 2 * R || other <= Math.PI)
  const psi1 = otherOk ? other : Math.min(psiLimit, 2 * Math.PI - 1e-3)
  const height = (psi: number) => Math.sqrt(Math.max(0, m2 - s2(psi)))
  const state = (t: number) => {
    const psi = psi0 + Math.min(Math.max(t, 0), 1) * (psi1 - psi0)
    return { psi, h: height(psi) }
  }
  const positions = (t: number): Vec3[] => {
    const { psi, h } = state(t)
    return where.map(([k, r]) => {
      const a = (k * 2 * Math.PI) / n + r * psi
      return [R * Math.cos(a), R * Math.sin(a), r * h]
    })
  }
  let strain = 0
  for (let i = 0; i <= 100; i++) {
    const { psi, h } = state(i / 100)
    strain = Math.max(strain, Math.abs(dOf(h, psi) - d0) / d0)
  }
  return { fold, positions, R, m, d0, h0, psi1, bistable: otherOk, height1: height(psi1), strain, delta, w }
}

export const kreslingDef: PatternDef = {
  id: 'kresling',
  name: 'Kresling cylinder',
  blurb: 'Twisted triangulated cylinder that shortens by rotating, like a paper spring.',
  params: [
    { key: 'n', label: 'Sides of the polygon', min: 3, max: 12, step: 1 },
    { key: 'stories', label: 'Stories', min: 1, max: 8, step: 1 },
    { key: 'side', label: 'Polygon side', min: 5, max: 50, step: 1, unit: 'mm' },
    { key: 'height', label: 'Height / radius', min: 0.5, max: 4, step: 0.05 },
    { key: 'twist', label: 'Twist per story', min: 5, max: 90, step: 1, unit: '°' },
  ],
  defaults: { n: 6, stories: 3, side: 20, height: 2.1, twist: 25 },
  presets: [
    { name: 'Hexagon', values: { n: 6, stories: 3, side: 20, height: 2.1, twist: 25 } },
    { name: 'Pentagon', values: { n: 5, stories: 4, side: 22, height: 2.4, twist: 30 } },
    { name: 'Octagon', values: { n: 8, stories: 2, side: 14, height: 2.6, twist: 18 } },
  ],
  generate: (p) => {
    const k = kresling(p.n, p.side, p.stories, p.height, p.twist)
    const info = [
      `Cylinder radius ${k.R.toFixed(1)} mm, story height ${k.h0.toFixed(1)} mm at full extension.`,
      k.bistable
        ? `Bistable: a second stable state exists at story height ${k.height1.toFixed(1)} mm, twist ${((k.psi1 * 180) / Math.PI).toFixed(0)}°.`
        : `No second stable state. The slider runs to the fully collapsed story (${k.height1.toFixed(1)} mm).`,
      `Peak diagonal-crease strain during the fold: ${(k.strain * 100).toFixed(1)}%. Panels flex, so this is not a rigid fold.`,
    ]
    return { fold: k.fold, positions: k.positions, info }
  },
}
