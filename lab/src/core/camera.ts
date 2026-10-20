import * as THREE from 'three'

/**
 * Touch-first orbit camera.
 *
 *   one finger / left drag   → orbit
 *   two fingers               → pinch to zoom + drag to pan
 *   wheel                    → zoom
 *   right drag / middle drag → pan
 *
 * Damping is applied per frame so the camera keeps gliding for a moment
 * after the finger lifts — that alone makes a scene feel much less "stiff"
 * on a touch screen.
 */
export class OrbitCamera {
  readonly target = new THREE.Vector3(0, 2, 0)
  radius = 13
  azim = 0
  polar = 1.22

  minPolar = 0.25
  maxPolar = 1.52
  minRadius = 3.5
  maxRadius = 40

  /** smoothing factor for the applied camera (0 = instant, 1 = never arrives) */
  damping = 0.18

  /**
   * Multiplies the orbit radius. A portrait phone viewport is much narrower
   * than a laptop, so the camera has to stand further back for the same
   * content to fit across.
   */
  radiusScale = 1

  private wantTarget = new THREE.Vector3(0, 2, 0)
  private wantRadius = 13
  private wantAzim = 0
  private wantPolar = 1.22

  private pointers = new Map<number, { x: number; y: number }>()
  private mode: 'none' | 'orbit' | 'pan' | 'pinch' = 'none'
  private pinchStart = 0
  private pinchRadius = 0
  private lastPanX = 0
  private lastPanY = 0
  /** true while a lab is dragging an object — the camera must not move */
  private labDrags = false

  constructor(
    private camera: THREE.PerspectiveCamera,
    private dom: HTMLElement,
    private onChange: () => void,
  ) {
    this.wantTarget.copy(this.target)
    this.wantRadius = this.radius
    this.wantAzim = this.azim
    this.wantPolar = this.polar

    this.dom.style.touchAction = 'none'

    /* The platform routes pointer events here through pointerDown(), so that a
       lab gets the first chance to claim an event before the camera reacts. */
    this.dom.addEventListener('pointermove', this.handleMove)
    this.dom.addEventListener('pointerup', this.handleUp)
    this.dom.addEventListener('pointercancel', this.handleUp)
    this.dom.addEventListener('wheel', this.handleWheel, { passive: false })
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  dispose(): void {
    this.dom.removeEventListener('pointermove', this.handleMove)
    this.dom.removeEventListener('pointerup', this.handleUp)
    this.dom.removeEventListener('pointercancel', this.handleUp)
    this.dom.removeEventListener('wheel', this.handleWheel)
  }

  /**
   * A pointer went down.
   *
   * @param allowOrbit false when the lab has claimed the event — the camera
   *   then tracks the pointer but does not move, so dragging an object never
   *   spins the scene.
   */
  pointerDown(e: PointerEvent, allowOrbit: boolean): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    this.dom.setPointerCapture?.(e.pointerId)

    if (!allowOrbit) {
      /* the lab is dragging something — stay out of the way completely */
      this.labDrags = true
      this.mode = 'none'
      return
    }

    if (this.pointers.size === 1) {
      const wantsPan = e.button === 2 || e.button === 1 || e.shiftKey
      this.mode = wantsPan ? 'pan' : 'orbit'
      if (wantsPan) {
        this.lastPanX = e.clientX
        this.lastPanY = e.clientY
      }
    } else if (this.pointers.size === 2) {
      /* do not pinch-zoom while the lab is dragging an object */
      if (this.labDrags) return
      this.mode = 'pinch'
      const [a, b] = [...this.pointers.values()]
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
      this.pinchRadius = this.wantRadius
      this.lastPanX = (a.x + b.x) / 2
      this.lastPanY = (a.y + b.y) / 2
    }
  }

  /** Frame a scene immediately (no glide) — used when a lab opens. */
  frame(target: [number, number, number] | THREE.Vector3, radius?: number, azim?: number, polar?: number): void {
    if (target) {
      if (Array.isArray(target)) this.wantTarget.set(target[0], target[1], target[2])
      else this.wantTarget.copy(target)
      this.target.copy(this.wantTarget)
    }
    if (radius !== undefined) { this.radius = this.wantRadius = radius }
    if (azim !== undefined) { this.azim = this.wantAzim = azim }
    if (polar !== undefined) { this.polar = this.wantPolar = polar }
    this.apply()
  }

  /** True while the user is actively manipulating the camera. */
  get dragging(): boolean {
    return this.mode !== 'none'
  }

  private handleMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    prev.x = e.clientX
    prev.y = e.clientY

    if (this.mode === 'orbit' && this.pointers.size === 1) {
      this.wantAzim -= dx * 0.006
      this.wantPolar = clamp(this.wantPolar - dy * 0.005, this.minPolar, this.maxPolar)
      this.onChange()
    } else if (this.mode === 'pan' && this.pointers.size === 1) {
      this.pan(this.lastPanX - e.clientX, this.lastPanY - e.clientY)
      this.lastPanX = e.clientX
      this.lastPanY = e.clientY
    } else if (this.mode === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchStart > 4) {
        const scale = this.pinchStart / Math.max(4, dist)
        this.wantRadius = clamp(this.pinchRadius * scale, this.minRadius, this.maxRadius)
      }
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      this.pan(this.lastPanX - cx, this.lastPanY - cy)
      this.lastPanX = cx
      this.lastPanY = cy
      this.onChange()
    }
  }

  private handleUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId)
    if (this.pointers.size === 0) {
      this.mode = 'none'
      this.labDrags = false
    } else if (this.pointers.size === 1) {
      this.mode = 'orbit'
      const [p] = [...this.pointers.values()]
      this.lastPanX = p.x
      this.lastPanY = p.y
    }
  }

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault()
    this.wantRadius = clamp(
      this.wantRadius * Math.exp(e.deltaY * 0.0011),
      this.minRadius,
      this.maxRadius,
    )
    this.onChange()
  }

  private pan(dx: number, dy: number): void {
    const scale = this.radius * 0.0022
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1)
    this.wantTarget.addScaledVector(right, dx * scale)
    this.wantTarget.addScaledVector(up, dy * scale)
    this.onChange()
  }

  /** Called every frame: glide the camera toward the wanted pose. */
  update(dt: number): boolean {
    const before =
      this.target.distanceToSquared(this.wantTarget) +
      Math.abs(this.radius - this.wantRadius) +
      Math.abs(this.azim - this.wantAzim) +
      Math.abs(this.polar - this.wantPolar)

    if (before < 1e-8) return false

    const k = 1 - Math.pow(1 - this.damping, dt * 60)
    this.target.lerp(this.wantTarget, k)
    this.radius += (this.wantRadius - this.radius) * k
    this.azim += (this.wantAzim - this.azim) * k
    this.polar += (this.wantPolar - this.polar) * k

    this.apply()
    return true
  }

  private apply(): void {
    const sp = Math.sin(this.polar)
    const cp = Math.cos(this.polar)
    const r = this.radius * this.radiusScale
    this.camera.position.set(
      this.target.x + r * sp * Math.sin(this.azim),
      this.target.y + r * cp,
      this.target.z + r * sp * Math.cos(this.azim),
    )
    this.camera.lookAt(this.target)
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}
