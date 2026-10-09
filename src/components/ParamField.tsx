import type { Param } from '../lib/pattern.ts'

export default function ParamField({ param, value, onChange }: { param: Param; value: number; onChange: (v: number) => void }) {
  const id = `p-${param.key}`
  const decimals = param.step < 1 ? (param.step < 0.1 ? 2 : 1) : 0
  return (
    <div className="field">
      <label htmlFor={id}>{param.label}{param.unit ? ` (${param.unit})` : ''}</label>
      <div className="slider-row">
        <input id={id} type="range" min={param.min} max={param.max} step={param.step} value={value} onChange={(e) => onChange(+e.target.value)} />
        <input type="number" aria-label={param.label} min={param.min} max={param.max} step={param.step} value={+value.toFixed(decimals)}
          onChange={(e) => { const v = +e.target.value; if (Number.isFinite(v)) onChange(Math.min(param.max, Math.max(param.min, v))) }} />
      </div>
    </div>
  )
}
