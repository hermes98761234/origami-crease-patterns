// Triangular-lattice patterns with six creases at every interior vertex: Yoshimura and waterbomb tessellation.
// Vertex (i, j) sits at (i w + (j odd ? w/2 : 0), j h). Every interior vertex has sector angles A, B, A, A, B, A
// with 2A + B = 180 degrees, so Kawasaki holds for any w and h.
import { buildFold } from './fold.ts'
import type { PatternDef } from './pattern.ts'

function lattice(cols: number, rows: number, w: number, h: number, ring: 'M' | 'V') {
  const other = ring === 'M' ? 'V' : 'M'
  const coords: [number, number][] = []
  const id = (i: number, j: number) => j * (cols + 1) + i
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) coords.push([i * w + (j % 2 ? w / 2 : 0), j * h])
  const faces: number[][] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (j % 2 === 0) {
        faces.push([id(i, j), id(i + 1, j), id(i, j + 1)])
        faces.push([id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)])
      } else {
        faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)])
        faces.push([id(i, j), id(i + 1, j + 1), id(i, j + 1)])
      }
    }
  }
  const rowOf = (v: number) => Math.floor(v / (cols + 1))
  return buildFold(coords, faces, (a, b) => (rowOf(a) === rowOf(b) ? ring : other))
}

export const yoshimuraDef: PatternDef = {
  id: 'yoshimura',
  name: 'Yoshimura',
  blurb: 'Diamond pattern of the buckled cylinder: valley rows crossed by mountain diagonals.',
  params: [
    { key: 'cols', label: 'Triangles across', min: 1, max: 16, step: 1 },
    { key: 'rows', label: 'Rows', min: 1, max: 12, step: 1 },
    { key: 'width', label: 'Triangle base', min: 5, max: 60, step: 1, unit: 'mm' },
    { key: 'ratio', label: 'Height / base', min: 0.3, max: 1.5, step: 0.05 },
  ],
  defaults: { cols: 8, rows: 6, width: 20, ratio: 0.6 },
  sim3d: true,
  presets: [
    { name: 'Standard', values: { cols: 8, rows: 6, width: 20, ratio: 0.6 } },
    { name: 'Wide', values: { cols: 10, rows: 4, width: 20, ratio: 0.4 } },
    { name: 'Tall', values: { cols: 6, rows: 6, width: 24, ratio: 1 } },
  ],
  generate: (p) => ({ fold: lattice(p.cols, p.rows, p.width, p.width * p.ratio, 'V'), info: ['Isosceles triangles; six creases meet at every interior vertex.'] }),
}

export const waterbombDef: PatternDef = {
  id: 'waterbomb',
  name: 'Waterbomb tessellation',
  blurb: 'Waterbomb bases tiled edge to edge: mountain rows crossed by 45° valley diagonals.',
  params: [
    { key: 'cols', label: 'Bases across', min: 1, max: 16, step: 1 },
    { key: 'rows', label: 'Rows', min: 1, max: 16, step: 1 },
    { key: 'width', label: 'Base width', min: 5, max: 60, step: 1, unit: 'mm' },
  ],
  defaults: { cols: 6, rows: 8, width: 24 },
  sim3d: true,
  generate: (p) => ({ fold: lattice(p.cols, p.rows, p.width, p.width / 2, 'M'), info: ['Right isosceles triangles; every interior vertex is a waterbomb base centre.'] }),
}
