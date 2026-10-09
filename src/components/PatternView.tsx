import { bounds, type Assignment, type Fold } from '../lib/fold.ts'
import type { FlatFoldReport } from '../lib/flatfold.ts'
import { STYLES } from '../lib/export.ts'

interface Props {
  fold: Fold
  report: FlatFoldReport
  selected: number | null
  onSelect: (v: number | null) => void
  onEdge: (edge: number) => void
}

const ORDER: Assignment[] = ['F', 'U', 'V', 'M', 'B']

/** The 2D crease pattern: mountain red dash-dot, valley blue dashed, border black. Click a crease to cycle its assignment. */
export default function PatternView({ fold, report, selected, onSelect, onEdge }: Props) {
  const b = bounds(fold.vertices_coords)
  const w = b.maxX - b.minX || 1, h = b.maxY - b.minY || 1
  const u = Math.hypot(w, h) / 230 // one "screen pixel" in pattern units, roughly
  const pad = 8 * u
  const X = (x: number) => x - b.minX + pad
  const Y = (y: number) => b.maxY - y + pad
  const failing = new Set(report.failing.map((v) => v.vertex))
  const sel = selected !== null ? fold.vertices_coords[selected] : null
  return (
    <svg className="pattern" viewBox={`0 0 ${w + 2 * pad} ${h + 2 * pad}`} role="img" aria-label="Crease pattern. Mountain folds are red dash-dot, valley folds blue dashed." onClick={() => onSelect(null)}>
      {ORDER.map((a) => {
        const st = STYLES[a]
        const dash = st.dash.map((d) => +(d * u * 1.6).toFixed(3)).join(' ')
        return (
          <g key={a} stroke={a === 'B' ? 'var(--chart-fg)' : st.color} strokeWidth={st.width * u * 3} strokeDasharray={dash || undefined} strokeLinecap="round" fill="none">
            {fold.edges_vertices.map(([p, q], i) =>
              fold.edges_assignment[i] === a ? <line key={i} x1={X(fold.vertices_coords[p][0])} y1={Y(fold.vertices_coords[p][1])} x2={X(fold.vertices_coords[q][0])} y2={Y(fold.vertices_coords[q][1])} /> : null,
            )}
          </g>
        )
      })}
      <g stroke="transparent" strokeWidth={7 * u} fill="none" style={{ cursor: 'pointer' }}>
        {fold.edges_vertices.map(([p, q], i) =>
          fold.edges_assignment[i] === 'B' ? null : (
            <line key={i} x1={X(fold.vertices_coords[p][0])} y1={Y(fold.vertices_coords[p][1])} x2={X(fold.vertices_coords[q][0])} y2={Y(fold.vertices_coords[q][1])} pointerEvents="stroke" onClick={(e) => { e.stopPropagation(); onEdge(i) }}>
              <title>Click to change this crease (M, V, flat, unassigned)</title>
            </line>
          ),
        )}
      </g>
      {report.vertices.filter((v) => failing.has(v.vertex)).map((v) => (
        <g key={v.vertex} pointerEvents="none">
          <circle cx={X(v.x)} cy={Y(v.y)} r={5 * u} fill="rgba(239,68,68,.25)" stroke="#ef4444" strokeWidth={1.4 * u} />
        </g>
      ))}
      {sel && <circle cx={X(sel[0])} cy={Y(sel[1])} r={8 * u} fill="none" stroke="var(--accent)" strokeWidth={2 * u} pointerEvents="none" />}
    </svg>
  )
}
