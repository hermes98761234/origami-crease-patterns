import { useEffect, useRef } from 'react'
import type { Fold, Vec3 } from '../lib/fold.ts'
import { FoldSim } from '../lib/sim.ts'

export type Motion = { kind: 'exact'; positions: (t: number) => Vec3[] } | { kind: 'sim' }

interface Props {
  fold: Fold
  motion: Motion
  t: number
  onStrain?: (s: number | null) => void
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Canvas painter's-algorithm renderer with drag-to-orbit and wheel zoom. */
export default function FoldView3D({ fold, motion, t, onStrain }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const cam = useRef({ yaw: -0.6, pitch: 0.9, zoom: 1 })
  const state = useRef({ t, motion, fold, dirty: true, sim: null as FoldSim | null, pos: null as Vec3[] | null, ref: 0 })
  const strain = useRef(onStrain)

  useEffect(() => {
    strain.current = onStrain
    const s = state.current
    s.t = t; s.motion = motion; s.dirty = true
    if (s.fold !== fold || s.motion !== motion) s.ref = 0
    if (s.fold !== fold || motion.kind !== 'sim') { s.sim = null }
    s.fold = fold
    if (motion.kind === 'sim') {
      s.sim ??= new FoldSim(fold)
      s.sim.setAmount(t)
    }
  }, [t, motion, fold, onStrain])

  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    let raf = 0
    let alive = true
    const flat = fold
    const xs = flat.vertices_coords.map((p) => p[0]), ys = flat.vertices_coords.map((p) => p[1])
    const flatDiag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1
    const diagOf = (pos: Vec3[]) => Math.hypot(...[0, 1, 2].map((c) => Math.max(...pos.map((p) => p[c])) - Math.min(...pos.map((p) => p[c]))))

    const draw = (pos: Vec3[]) => {
      const dpr = window.devicePixelRatio || 1
      const w = el.clientWidth, h = el.clientHeight
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      let cx = 0, cy = 0, cz = 0
      for (const p of pos) { cx += p[0]; cy += p[1]; cz += p[2] }
      cx /= pos.length; cy /= pos.length; cz /= pos.length
      const { yaw, pitch, zoom } = cam.current
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      const k = (Math.min(w, h) / (state.current.ref || flatDiag)) * 0.95 * zoom
      // world (z up) -> yaw about z -> pitch about x -> screen (x right, y up, depth toward viewer)
      const proj = pos.map(([x, y, z]): Vec3 => {
        const X = x - cx, Y = y - cy, Z = z - cz
        const x1 = X * cyw - Y * syw, y1 = X * syw + Y * cyw
        return [w / 2 + x1 * k, h / 2 - (y1 * sp + Z * cp) * k, -y1 * cp + Z * sp]
      })
      // Camera looks from +z when pitch = 90deg; "depth" larger = closer to the viewer.
      const view = (n: Vec3): number => {
        const y1 = n[0] * syw + n[1] * cyw
        return -y1 * cp + n[2] * sp
      }
      const front = css('--paper-front') || '#f6f1e7'
      const back = css('--paper-back') || '#e0704a'
      const edgeCol = css('--paper-edge') || 'rgba(0,0,0,.45)'
      const faces = (fold.faces_vertices ?? []).map((f) => {
        let d = 0
        for (const v of f) d += proj[v][2]
        // Newell normal in world space (front = counter-clockwise in the flat pattern)
        let nx = 0, ny = 0, nz = 0
        f.forEach((v, i) => {
          const a = pos[v], b = pos[f[(i + 1) % f.length]]
          nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1])
        })
        const nl = Math.hypot(nx, ny, nz) || 1
        const n: Vec3 = [nx / nl, ny / nl, nz / nl]
        return { f, depth: d / f.length, n, facing: view(n) }
      })
      faces.sort((a, b) => a.depth - b.depth)
      ctx.lineJoin = 'round'
      for (const { f, n, facing } of faces) {
        const light = 0.62 + 0.38 * Math.abs(view(n))
        ctx.beginPath()
        f.forEach((v, i) => (i ? ctx.lineTo(proj[v][0], proj[v][1]) : ctx.moveTo(proj[v][0], proj[v][1])))
        ctx.closePath()
        ctx.fillStyle = facing > 0 ? front : back
        ctx.fill()
        ctx.fillStyle = `rgba(0,0,0,${(1 - light).toFixed(3)})`
        ctx.fill()
        ctx.strokeStyle = edgeCol
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }

    const tick = () => {
      if (!alive) return
      const s = state.current
      if (!s.ref) s.ref = s.motion.kind === 'exact' ? Math.max(...[0, 0.5, 1].map((x) => diagOf((s.motion as { positions: (t: number) => Vec3[] }).positions(x)))) : 0.6 * flatDiag
      if (s.motion.kind === 'sim' && s.sim) {
        const speed = s.sim.step(14)
        if (speed > 1e-4) s.dirty = true
        s.pos = s.sim.positions()
        strain.current?.(s.sim.maxStrain())
      } else if (s.dirty && s.motion.kind === 'exact') {
        s.pos = s.motion.positions(s.t)
        strain.current?.(null)
      }
      if (s.dirty && s.pos) { draw(s.pos); s.dirty = false }
      raf = requestAnimationFrame(tick)
    }
    tick()

    let drag: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId) }
    const move = (e: PointerEvent) => {
      if (!drag) return
      cam.current.yaw += (e.clientX - drag.x) * 0.01
      cam.current.pitch = Math.min(Math.PI / 2 + 0.2, Math.max(-0.2, cam.current.pitch + (e.clientY - drag.y) * 0.01))
      drag = { x: e.clientX, y: e.clientY }
      state.current.dirty = true
    }
    const up = () => { drag = null }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      cam.current.zoom = Math.min(5, Math.max(0.3, cam.current.zoom * Math.exp(-e.deltaY * 0.001)))
      state.current.dirty = true
    }
    const resize = () => { state.current.dirty = true }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', resize)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', resize)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', resize)
      mq.removeEventListener('change', resize)
    }
  }, [fold])

  return <canvas ref={canvas} role="img" aria-label="Interactive 3D preview of the folded model. Drag to rotate, scroll to zoom." />
}

