import * as THREE from 'three'
import { OrbitCamera } from './camera'
import {
  AutoQuality,
  QUALITY,
  applyQualityToScene,
  autoStartLevel,
  isQualityName,
  probeSoftwareRenderer,
  type EngineLights,
  type QualityMode,
  type QualityName,
} from './quality'
import type { LabInstance } from './lab'
import { LABEL_REFERENCE_DISTANCE, LABEL_TAG } from '../kit/labels'

const tmpVec = new THREE.Vector3()

const STORAGE_KEY = 'lab.quality'

export interface EngineStats {
  fps: number
  idle: boolean
  level: QualityName
  mode: QualityMode
  software: boolean
  rendererName: string
}

/**
 * The rendering heart of the laboratory.
 *
 * Two ideas matter most here:
 *
 *  1. **On-demand rendering.** The scene is only drawn when something actually
 *     changed, so an untouched simulation costs ~0% CPU and a phone can sit on
 *     a lab for ten minutes without heating up.
 *  2. **Quality tiers.** Pixel ratio, shadows and extra lights are scaled to
 *     the device, and the tier steps itself down when frames get heavy.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly orbit: OrbitCamera

  readonly dom: HTMLElement
  private host: HTMLElement
  private lights: EngineLights | null = null
  private resizeObserver: ResizeObserver | null = null
  /** true while a lab is dragging an object — the camera must not orbit */
  private labDragging = false
  private roomGroup: THREE.Group
  private lab: LabInstance | null = null

  private dirty = true
  private rafId = 0
  private prevTick = 0
  private idleMs = 0
  private visible = true
  private disposed = false

  /** how many frames have actually been drawn — the QA harness waits on this */
  frames = 0

  qualityMode: QualityMode = 'auto'
  qualityLevel: QualityName = 'high'
  software = false
  rendererName = ''

  /**
   * How far (in pixels) the scene should be shifted away from the side panel.
   * Without this the right-hand part of a simulation hides behind the panel.
   */
  private panelOffset = 0

  private auto: AutoQuality
  private stats: EngineStats = { fps: 0, idle: true, level: 'high', mode: 'auto', software: false, rendererName: '' }
  private statListeners = new Set<(s: EngineStats) => void>()

  constructor(host: HTMLElement) {
    const probe = probeSoftwareRenderer()
    this.software = probe.software
    this.rendererName = probe.renderer

    let stored: QualityMode = 'auto'
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'auto' || (v !== null && isQualityName(v))) stored = v
    } catch { /* private mode */ }
    this.qualityMode = stored

    const startLevel = stored === 'auto' ? autoStartLevel(this.software) : stored
    this.qualityLevel = startLevel

    this.renderer = new THREE.WebGLRenderer({
      antialias: QUALITY[startLevel].antialias && !this.software,
      powerPreference: 'high-performance',
      alpha: false,
    })
    this.host = host
    const { w, h } = this.viewport()
    this.renderer.setSize(w, h)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type =
      startLevel === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.dom = this.renderer.domElement
    this.dom.className = 'lab-canvas'
    host.appendChild(this.dom)

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 400)
    this.roomGroup = new THREE.Group()
    this.scene.add(this.roomGroup)
    this.buildRoom()

    this.orbit = new OrbitCamera(this.camera, this.dom, () => this.invalidate())

    /* ---- input routing ------------------------------------------------
       The lab gets the first chance at every pointer event. If it claims
       the event (it is dragging something) the camera is told not to orbit,
       so dragging an object never spins the scene.                       */
    this.dom.addEventListener('pointerdown', (e) => {
      const consumed = this.lab ? this.lab.onPointerDown(e) : false
      if (consumed) {
        this.labDragging = true
        this.dom.setPointerCapture?.(e.pointerId)
      }
      this.orbit.pointerDown(e, !consumed)
    })

    window.addEventListener('pointermove', (e) => {
      if (!this.lab) return
      /* the lab only cares about moves over the canvas, or while it drags */
      if (e.target === this.dom || this.labDragging) this.lab.onPointerMove(e)
    })

    window.addEventListener('pointerup', (e) => {
      if (this.lab) this.lab.onPointerUp(e)
      this.labDragging = false
    })

    window.addEventListener('pointercancel', (e) => {
      if (this.lab) this.lab.onPointerUp(e)
      this.labDragging = false
    })

    this.auto = new AutoQuality(
      () => this.qualityMode,
      () => this.qualityLevel,
      (next, fps) => {
        this.applyLevel(next)
        console.info(`[lab] auto quality → ${next} (${fps} fps)`)
      },
    )

    window.addEventListener('resize', this.handleResize)
    document.addEventListener('visibilitychange', this.handleVisibility)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize())
      this.resizeObserver.observe(host)
    }
    this.handleResize()
    this.applyLevel(this.qualityLevel)
    this.loop()
  }

  /* ------------------------------------------------------------- the room */
  private buildRoom(): void {
    const bg = 0x0d131c
    this.scene.background = new THREE.Color(bg)
    this.scene.fog = new THREE.Fog(bg, 26, 78)
    this.scene.environment = makeEnvTexture()

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.95, metalness: 0.05 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.roomGroup.add(floor)

    const grid = new THREE.GridHelper(64, 64, 0x35465f, 0x243347)
    grid.position.y = 0.002
    const gm = grid.material as THREE.Material | THREE.Material[]
    if (Array.isArray(gm)) gm.forEach((m) => { m.transparent = true; m.opacity = 0.5 })
    else { gm.transparent = true; gm.opacity = 0.5 }
    this.roomGroup.add(grid)

    const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x1a2130, 0.8)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(7, 13, 9)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    const c = key.shadow.camera
    c.left = -12; c.right = 12; c.top = 14; c.bottom = -8
    c.near = 1; c.far = 50
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.02
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x9fc4ff, 0.5)
    fill.position.set(-9, 7, 7)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0x5ee0c8, 0.28)
    rim.position.set(0, 4, -10)
    this.scene.add(rim)

    this.lights = { key, fill, rim }
  }

  /** Hide the room backdrop for labs that want an empty void. */
  setBare(bare: boolean): void {
    this.roomGroup.visible = !bare
    this.scene.fog = bare ? null : new THREE.Fog(0x0d131c, 26, 78)
  }

  /* --------------------------------------------------------------- labs */
  mountLab(lab: LabInstance, shadows = true): void {
    this.unmountLab()
    this.lab = lab
    this.scene.add(lab.root)
    this.setBare(false)
    this.renderer.shadowMap.enabled = QUALITY[this.qualityLevel].shadows && shadows
    if (this.lights) this.lights.key.castShadow = QUALITY[this.qualityLevel].shadows && shadows
    this.invalidate()
  }

  unmountLab(): void {
    if (!this.lab) return
    this.scene.remove(this.lab.root)
    this.lab.dispose()
    this.lab = null
  }

  get currentLab(): LabInstance | null {
    return this.lab
  }

  /* ------------------------------------------------------------ quality */
  setQuality(mode: QualityMode): void {
    this.qualityMode = mode
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
    const level = mode === 'auto' ? autoStartLevel(this.software) : mode
    this.applyLevel(level)
  }

  private applyLevel(level: QualityName): void {
    this.qualityLevel = level
    const q = QUALITY[level]
    const shadowsWanted = this.lab ? true : q.shadows
    const { w, h } = this.viewport()
    applyQualityToScene(this.renderer, q, this.lights, shadowsWanted, w, h)
    document.body.classList.toggle('q-low', !q.extras)
    this.invalidate()
    this.pushStats()
  }

  /* -------------------------------------------------------------- frame */
  invalidate(): void {
    this.dirty = true
  }

  onStats(fn: (s: EngineStats) => void): () => void {
    this.statListeners.add(fn)
    fn(this.stats)
    return () => this.statListeners.delete(fn)
  }

  private pushStats(): void {
    this.stats = {
      ...this.stats,
      level: this.qualityLevel,
      mode: this.qualityMode,
      software: this.software,
      rendererName: this.rendererName,
    }
    for (const fn of this.statListeners) fn(this.stats)
  }

  /**
   * Shift the scene sideways so it sits in the middle of the *visible* canvas
   * rather than the middle of the window (the panel covers the right edge).
   */
  setPanelOffset(pixels: number): void {
    this.panelOffset = Math.max(0, pixels)
    this.applyViewOffset()
    this.invalidate()
  }

  /** The size of the canvas host — not necessarily the whole window. */
  private viewport(): { w: number; h: number } {
    const w = this.host.clientWidth || window.innerWidth
    const h = this.host.clientHeight || window.innerHeight
    return { w: Math.max(1, w), h: Math.max(1, h) }
  }

  private applyViewOffset(): void {
    const { w, h } = this.viewport()
    if (this.panelOffset <= 0) {
      this.camera.clearViewOffset()
    } else {
      // fullWidth = width keeps the scale; the offset slides the frustum right,
      // which moves the rendered scene left by exactly `panelOffset` pixels.
      this.camera.setViewOffset(w, h, this.panelOffset, 0, w, h)
    }
    this.camera.updateProjectionMatrix()
  }

  private handleResize = (): void => {
    const { w, h } = this.viewport()
    this.camera.aspect = w / h
    /* a narrow (portrait) viewport needs the camera further back so the same
       content still fits across the screen */
    this.orbit.radiusScale = Math.min(2.2, Math.max(1, 1 / this.camera.aspect))
    this.applyViewOffset()
    this.camera.updateProjectionMatrix()
    this.applyLevel(this.qualityLevel)
  }

  private handleVisibility = (): void => {
    this.visible = document.visibilityState === 'visible'
    if (this.visible) {
      this.prevTick = 0
      this.invalidate()
    }
  }

  private loop = (): void => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.loop)
    if (!this.visible) return

    const now = performance.now()
    const frameMs = this.prevTick ? now - this.prevTick : 16.7
    this.prevTick = now
    const dt = Math.min(0.1, frameMs / 1000)

    let dirty = this.dirty
    this.dirty = false

    if (this.orbit.update(dt)) dirty = true
    if (this.lab && this.lab.update(dt)) dirty = true

    if (!dirty) {
      this.idleMs += frameMs
      if (this.idleMs > 1200 && !this.stats.idle) {
        this.stats = { ...this.stats, idle: true }
        this.pushStats()
      }
      return
    }

    this.idleMs = 0
    const t0 = performance.now()
    this.updateLabelScales()
    this.renderer.render(this.scene, this.camera)
    this.frames++
    const renderMs = performance.now() - t0

    this.auto.sample(frameMs)
    this.stats = {
      ...this.stats,
      idle: false,
      fps: Math.round(1000 / Math.max(1, frameMs)),
    }
    this.pushStats()
    void renderMs
  }

  /**
   * Keep the text labels a readable size on screen.
   *
   * A sprite is sized in world units, so a label on a phone (where the camera
   * has to stand much further back) would shrink to a smudge. Scaling each
   * label with its distance from the camera keeps the text the same size on
   * the glass, whatever the device.
   */
  private updateLabelScales(): void {
    const cam = this.camera
    this.scene.traverse((obj) => {
      const sprite = obj as THREE.Sprite & { userData: Record<string, unknown> }
      if (!sprite.isSprite || !sprite.userData[LABEL_TAG]) return
      const base = sprite.userData.baseScale as { x: number; y: number } | undefined
      if (!base) return
      sprite.getWorldPosition(tmpVec)
      const d = cam.position.distanceTo(tmpVec)
      const k = Math.min(3, Math.max(0.55, d / LABEL_REFERENCE_DISTANCE))
      sprite.scale.set(base.x * k, base.y * k, 1)
    })
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.handleResize)
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.resizeObserver?.disconnect()
    this.orbit.dispose()
    this.unmountLab()
    this.renderer.dispose()
    this.dom.remove()
  }
}

/** A tiny gradient cube map so metals have something to reflect. */
function makeEnvTexture(): THREE.CubeTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, size)
  g.addColorStop(0, '#dceaff')
  g.addColorStop(0.45, '#94a9c6')
  g.addColorStop(0.55, '#3b4759')
  g.addColorStop(1, '#111721')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CubeTexture([canvas, canvas, canvas, canvas, canvas, canvas])
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
