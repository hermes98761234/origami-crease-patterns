import type { FlatFoldReport } from '../lib/flatfold.ts'

const deg = (r: number) => `${((r * 180) / Math.PI).toFixed(2)}°`

export default function CheckPanel({ report, selected, onSelect }: { report: FlatFoldReport; selected: number | null; onSelect: (v: number | null) => void }) {
  const kFail = report.failing.filter((v) => v.kawasaki === 'fail').length
  const mFail = report.failing.filter((v) => v.maekawa === 'fail').length
  const unknown = report.vertices.filter((v) => v.maekawa === 'unknown').length
  return (
    <div>
      {report.interior === 0 ? (
        <p className="verdict warn">No interior vertices to check.</p>
      ) : report.ok ? (
        <p className="verdict ok">Locally flat-foldable: all {report.interior} interior vertices pass Kawasaki{unknown ? '' : ' and Maekawa'}.</p>
      ) : (
        <p className="verdict err">{report.failing.length} of {report.interior} interior vertices fail ({kFail} Kawasaki, {mFail} Maekawa).</p>
      )}
      {unknown > 0 && <p className="hint">{unknown} vertices have unassigned creases (U), so only Kawasaki could be checked there.</p>}
      <p className="hint">Maekawa: |mountains − valleys| = 2. Kawasaki: alternating angles around the vertex each sum to 180°. Both are necessary, not sufficient: they do not catch paper passing through itself.</p>
      {report.failing.length > 0 && (
        <div className="scroll">
          <table className="data">
            <thead>
              <tr><td>Vertex</td><td>x, y</td><td>Creases</td><td>M / V</td><td>Alternating sums</td></tr>
            </thead>
            <tbody>
              {report.failing.slice(0, 60).map((v) => (
                <tr key={v.vertex} className={selected === v.vertex ? 'active' : ''} onClick={() => onSelect(selected === v.vertex ? null : v.vertex)} style={{ cursor: 'pointer' }}>
                  <td>#{v.vertex}</td>
                  <td>{v.x.toFixed(1)}, {v.y.toFixed(1)}</td>
                  <td>{v.degree}</td>
                  <td className={v.maekawa === 'fail' ? 'err-text' : ''}>{v.mountains} / {v.valleys}</td>
                  <td className={v.kawasaki === 'fail' ? 'err-text' : ''}>{deg(v.sums[0])} | {deg(v.sums[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.failing.length > 60 && <p className="hint">Showing the first 60.</p>}
        </div>
      )}
    </div>
  )
}
