import type * as THREE from 'three'

export type QualityName = 'high' | 'medium' | 'low'
export type QualityMode = QualityName | 'auto'

export interface QualitySettings {
  /** hard cap on devicePixelRatio */
  prCap: number
  /** soft cap on rendered pixels (w * h * pr²) */
  budget: number
  shadows: boolean
  shadowMapSize: number
  antialias: boolean
  /** extra accent lights */
  extras: boolean
}

export const QUALITY: Record<QualityName, QualitySettings> = {
  high:   { prCap: 2.0,  budget: 3.2e6, shadows: true,  shadowMapSize: 1024, antialias: true,  extras: true },
  medium: { prCap: 1.25, budget: 1.7e6, shadows: true,  shadowMapSize: 1024, antialias: true,  extras: true },
  low:    { prCap: 1.0,  budget: 0.9e6, shadows: false, shadowMapSize: 512,  antialias: false, extras: false },
}

const ORDER: QualityName[] = ['low', 'medium', 'high']

export function isQualityName(v: string): v is QualityName {
  return v === 'high' || v === 'medium' || v === 'low'
}

/**
 * Detect a software rasteriser (Chrome's SwiftShader fallback, llvmpipe).
 * A software-drawn frame at 1080p costs the CPU ~100x a GPU frame, which is
 * exactly the "CPU spiked to 100%" complaint. When we see it we drop to the
 * cheapest tier and tell the user how to fix it.
 */
export function probeSoftwareRenderer(): { software: boolean; renderer: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return { software: true, renderer: 'none' }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
    const software = /swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(name)
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
    return { software, renderer: name }
  } catch {
    return { software: false, renderer: '' }
  }
}

/** A sensible starting tier for this device. */
export function autoStartLevel(software: boolean): QualityName {
  if (software) return 'low'
  const dpr = window.devicePixelRatio || 1
  const pixels = window.innerWidth * window.innerHeight * dpr * dpr
  if (pixels > 3.4e6) return 'medium'
  return 'high'
}

/**
 * Resolve the pixel ratio for a tier: capped by the device ratio and by a
 * total pixel budget, so a 4K screen does not try to shade 8 megapixels.
 */
export function resolvePixelRatio(q: QualitySettings, width = window.innerWidth, height = window.innerHeight): number {
  const dpr = window.devicePixelRatio || 1
  let pr = Math.min(dpr, q.prCap)
  const pixels = width * height * pr * pr
  if (pixels > q.budget) pr *= Math.sqrt(q.budget / pixels)
  return Math.max(0.6, pr)
}

/** Rolling frame-time watchdog that steps the tier down when we are too slow. */
export class AutoQuality {
  private frames = 0
  private elapsed = 0
  private slowStreak = 0
  private windowMs = 1000

  constructor(
    private getMode: () => QualityMode,
    private getLevel: () => QualityName,
    private onDowngrade: (next: QualityName, fps: number) => void,
  ) {}

  /** @param frameMs wall-clock time of the last frame */
  sample(frameMs: number): void {
    this.frames++
    this.elapsed += frameMs
    if (this.elapsed < this.windowMs) return

    const fps = Math.round(1000 / (this.elapsed / this.frames))
    this.frames = 0
    this.elapsed = 0

    if (this.getMode() !== 'auto') return
    const level = this.getLevel()
    if (level === 'low' || this.frames < 4) return

    // below ~33 fps
    if (frameMs > 30) this.slowStreak++
    else this.slowStreak = 0

    if (this.slowStreak >= 2) {
      this.slowStreak = 0
      const next = ORDER[Math.max(0, ORDER.indexOf(level) - 1)]
      if (next !== level) this.onDowngrade(next, fps)
    }
  }
}

/** Convenience for the scene lights the engine owns. */
export interface EngineLights {
  key: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  rim: THREE.DirectionalLight
}

export function applyQualityToScene(
  renderer: THREE.WebGLRenderer,
  q: QualitySettings,
  lights: EngineLights | null,
  shadowsWanted: boolean,
  width = window.innerWidth,
  height = window.innerHeight,
): void {
  renderer.setPixelRatio(resolvePixelRatio(q, width, height))
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = q.shadows && shadowsWanted
  if (lights) {
    lights.key.castShadow = q.shadows && shadowsWanted
    const size = q.shadowMapSize
    if (lights.key.shadow.mapSize.x !== size) {
      lights.key.shadow.mapSize.set(size, size)
      if (lights.key.shadow.map) {
        lights.key.shadow.map.dispose()
        lights.key.shadow.map = null
      }
    }
    lights.fill.visible = q.extras
    lights.rim.visible = q.extras
  }
}
