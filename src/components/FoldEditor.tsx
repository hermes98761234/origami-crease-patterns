import { useRef, useState } from 'react'
import { download } from '../lib/download.ts'
import { parseFold, serializeFold, type Fold } from '../lib/fold.ts'

interface Props {
  fold: Fold
  isCustom: boolean
  onApply: (f: Fold) => void
  onReset: () => void
  text: string
  setText: (t: string) => void
  filename: string
}

/** Paste, upload or edit a .fold file. Apply runs the flat-foldability check on it. */
export default function FoldEditor({ fold, isCustom, onApply, onReset, text, setText, filename }: Props) {
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const apply = (t: string) => {
    try {
      onApply(parseFold(t))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div>
      <p className="hint">Paste or edit FOLD JSON, or upload a .fold file, then Check it. Clicking a crease in the 2D view also edits the pattern. Coordinates are read as x, y and any z is ignored.</p>
      <div className="row">
        <button onClick={() => file.current?.click()}>Upload .fold</button>
        <input ref={file} type="file" accept=".fold,.json,application/json" hidden
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); apply(t) } e.target.value = '' }} />
        <button onClick={() => setText(serializeFold(fold))}>Load current pattern</button>
        <button className="primary" onClick={() => apply(text)}>Check this FOLD</button>
        {isCustom && <button onClick={onReset}>Back to generator</button>}
        <button onClick={() => download(filename, serializeFold(fold), 'application/json')}>Download .fold</button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={10} placeholder='{"vertices_coords": [[0,0],[1,0],[1,1],[0,1]], "edges_vertices": [...], "edges_assignment": ["B", ...]}' aria-label="FOLD JSON" />
      {error && <p className="err-text">{error}</p>}
    </div>
  )
}
