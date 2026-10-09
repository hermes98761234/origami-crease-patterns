import { useEffect, useMemo, useState } from 'react'
import CheckPanel from './components/CheckPanel.tsx'
import FoldEditor from './components/FoldEditor.tsx'
import FoldView3D, { type Motion } from './components/FoldView3D.tsx'
import ParamField from './components/ParamField.tsx'
import PatternView from './components/PatternView.tsx'
import { download } from './lib/download.ts'
import { layoutPage, toPdf, toSvg, type ExportOptions } from './lib/export.ts'
import { checkFlatFoldable } from './lib/flatfold.ts'
import { parseFold, serializeFold, type Assignment, type Fold } from './lib/fold.ts'
import { getPattern, PATTERNS } from './lib/patterns.ts'

const KEY = 'origami-crease-patterns:v1'
const NEXT: Record<string, Assignment> = { M: 'V', V: 'F', F: 'U', U: 'M' }

interface Saved {
  id: string
  params: Record<string, Record<string, number>>
  t: number
  exp: ExportOptions
  custom: string | null
}
const DEFAULT_EXPORT: ExportOptions = { paper: 'A4', orientation: 'auto', margin: 15, scale: 'fit', title: '' }

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '')
    if (s && typeof s.id === 'string') return { id: s.id, params: s.params ?? {}, t: typeof s.t === 'number' ? s.t : 0.5, exp: { ...DEFAULT_EXPORT, ...s.exp }, custom: typeof s.custom === 'string' ? s.custom : null }
  } catch { /* first visit */ }
  return { id: PATTERNS[0].id, params: {}, t: 0.6, exp: DEFAULT_EXPORT, custom: null }
}

export default function App() {
  const [saved] = useState(load)
  const [id, setId] = useState(getPattern(saved.id).id)
  const [allParams, setAllParams] = useState(saved.params)
  const [t, setT] = useState(saved.t)
  const [exp, setExp] = useState(saved.exp)
  const [custom, setCustom] = useState<Fold | null>(() => {
    try { return saved.custom ? parseFold(saved.custom) : null } catch { return null }
  })
  const [text, setText] = useState(saved.custom ?? '')
  const [selected, setSelected] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [strain, setStrain] = useState<number | null>(null)

  const def = getPattern(id)
  const params = useMemo(() => ({ ...def.defaults, ...allParams[id] }), [def, allParams, id])
  const pattern = useMemo(() => def.generate(params), [def, params])
  const fold = custom ?? pattern.fold
  const report = useMemo(() => checkFlatFoldable(fold), [fold])
  const title = custom ? 'Custom FOLD' : def.name
  const opts: ExportOptions = { ...exp, title }
  const page = useMemo(() => layoutPage(fold, opts), [fold, exp, title]) // eslint-disable-line

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ id, params: allParams, t, exp, custom: custom ? serializeFold(custom) : null } satisfies Saved))
  }, [id, allParams, t, exp, custom])

  useEffect(() => {
    if (!playing) return
    const start = performance.now() - t * 2500
    let raf = 0
    const tick = (now: number) => {
      const ph = ((now - start) / 2500) % 2
      setT(ph < 1 ? ph : 2 - ph)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing]) // eslint-disable-line

  const motion: Motion | null = useMemo(() => {
    if (!custom && pattern.positions) return { kind: 'exact', positions: pattern.positions }
    if ((custom || def.sim3d) && fold.faces_vertices?.length) return { kind: 'sim' }
    return null
  }, [custom, pattern, def, fold])

  const setParam = (k: string, v: number) => { setCustom(null); setAllParams((p) => ({ ...p, [id]: { ...params, [k]: v } })) }
  const pick = (next: string) => { setId(next); setCustom(null); setSelected(null); setStrain(null) }
  const apply = (f: Fold) => { setCustom(f); setSelected(null) }
  const editEdge = (i: number) => {
    const next = structuredClone(fold)
    next.edges_assignment[i] = NEXT[next.edges_assignment[i]] ?? 'M'
    setCustom(next)
    setText(serializeFold(next))
  }
  const base = custom ? 'custom' : def.id

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">Origami crease patterns</span>
        <span className="muted">Generate, fold in 3D, check flat-foldability, print.</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <section className="section">
              <h3>Pattern</h3>
              <div className="tabs" role="tablist" aria-label="Pattern">
                {PATTERNS.map((p) => (
                  <button key={p.id} role="tab" aria-selected={!custom && p.id === id} className={!custom && p.id === id ? 'tab on' : 'tab'} onClick={() => pick(p.id)}>{p.name}</button>
                ))}
              </div>
              <p className="hint">{def.blurb}</p>
              {def.presets && (
                <div className="row">
                  <label htmlFor="preset">Example</label>
                  <select id="preset" value="" onChange={(e) => { const pr = def.presets![+e.target.value]; if (pr) { setCustom(null); setAllParams((p) => ({ ...p, [id]: { ...pr.values } })) } }}>
                    <option value="" disabled>Choose…</option>
                    {def.presets.map((pr, i) => <option key={pr.name} value={i}>{pr.name}</option>)}
                  </select>
                </div>
              )}
            </section>
            <section className="section">
              <h3>Parameters</h3>
              {def.params.map((p) => <ParamField key={p.key} param={p} value={params[p.key]} onChange={(v) => setParam(p.key, v)} />)}
              {custom ? <p className="hint warn-text">Showing an edited or uploaded pattern. Moving a slider returns to the generator.</p> : pattern.info.map((s) => <p className="hint" key={s}>{s}</p>)}
            </section>
            <section className="section">
              <h3>Print and export</h3>
              <div className="grid2">
                <div className="field">
                  <label htmlFor="paper">Paper</label>
                  <select id="paper" value={exp.paper} onChange={(e) => setExp({ ...exp, paper: e.target.value as ExportOptions['paper'] })}>
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="orient">Orientation</label>
                  <select id="orient" value={exp.orientation} onChange={(e) => setExp({ ...exp, orientation: e.target.value as ExportOptions['orientation'] })}>
                    <option value="auto">Best fit</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="margin">Margin (mm)</label>
                  <input id="margin" type="number" min={0} max={60} step={1} value={exp.margin} onChange={(e) => setExp({ ...exp, margin: Math.min(60, Math.max(0, +e.target.value || 0)) })} />
                </div>
                <div className="field">
                  <label htmlFor="scale">Scale</label>
                  <select id="scale" value={exp.scale} onChange={(e) => setExp({ ...exp, scale: e.target.value as ExportOptions['scale'] })}>
                    <option value="fit">Fit to page</option>
                    <option value="actual">Actual size (1:1 mm)</option>
                  </select>
                </div>
              </div>
              <p className={page.fits ? 'hint' : 'hint err-text'}>
                Prints {page.size[0].toFixed(0)} × {page.size[1].toFixed(0)} mm at {(page.scale * 100).toFixed(0)}%{page.fits ? '.' : ', which is larger than the printable area. Use Fit to page.'}
              </p>
              <div className="row">
                <button className="primary" onClick={() => download(`${base}.svg`, toSvg(fold, opts), 'image/svg+xml')}>SVG</button>
                <button className="primary" onClick={() => download(`${base}.pdf`, toPdf(fold, opts), 'application/pdf')}>PDF</button>
                <button className="primary" onClick={() => download(`${base}.fold`, serializeFold(fold), 'application/json')}>.fold</button>
              </div>
              <p className="hint">Valley: dashed blue. Mountain: dash-dot red. Border: solid black. Mountain and valley are as seen from the printed side.</p>
            </section>
          </div>
        </aside>
        <main className="main">
          <div className="views">
            <section className="box">
              <h3>Crease pattern <span className="legend"><i className="m" /> mountain <i className="v" /> valley <i className="bad" /> fails</span></h3>
              <PatternView fold={fold} report={report} selected={selected} onSelect={setSelected} onEdge={editEdge} />
            </section>
            <section className="box">
              <h3>Folded preview</h3>
              <div className="scene-canvas">
                {motion ? <FoldView3D fold={fold} motion={motion} t={t} onStrain={setStrain} /> : (
                  <div className="scene-msg"><p>{fold.faces_vertices?.length ? 'This twist folds flat in layers, so there is no 3D motion to preview.' : 'This FOLD file has no faces_vertices, so it cannot be folded in 3D.'}</p></div>
                )}
              </div>
              <div className="row">
                <label htmlFor="fold-amount">Fold amount</label>
                <input id="fold-amount" type="range" min={0} max={1} step={0.005} value={t} disabled={!motion} onChange={(e) => { setPlaying(false); setT(+e.target.value) }} />
                <output>{Math.round(t * 100)}%</output>
                <button disabled={!motion} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
              </div>
              <p className="hint">
                {motion?.kind === 'exact' && (id === 'miura' ? 'Rigid closed-form motion: every panel stays flat and every edge keeps its length.' : 'Closed-form positions. Drag to rotate, scroll to zoom.')}
                {motion?.kind === 'sim' && `Approximate: a spring simulation, not an exact motion${strain !== null ? ` (edge stretch up to ${(strain * 100).toFixed(1)}%)` : ''}.`}
                {motion?.kind === 'exact' && id === 'kresling' && ' Panels flex.'}
              </p>
            </section>
          </div>
          <section className="box">
            <h3>Flat-foldability check</h3>
            <CheckPanel report={report} selected={selected} onSelect={setSelected} />
          </section>
          <section className="box">
            <h3>FOLD file</h3>
            <FoldEditor fold={fold} isCustom={!!custom} onApply={apply} onReset={() => setCustom(null)} text={text} setText={setText} filename={`${base}.fold`} />
          </section>
        </main>
      </div>
      <footer className="foot hint">
        Everything runs in your browser. <a href="https://github.com/hermes98761234/origami-crease-patterns">Source on GitHub</a> · MIT
      </footer>
    </div>
  )
}
