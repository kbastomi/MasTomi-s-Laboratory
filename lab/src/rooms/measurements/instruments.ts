import * as THREE from 'three'
import { C, disposeObject } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { hover, pick, rayPlaneZ } from '../../kit/picking'

/**
 * The measuring instruments.
 *
 * Each one is a small 3D model you can actually operate: close the jaws on
 * something, balance a weight, or read a dial. The whole point of the room is
 * that the student learns to *read* the instrument, so every model shows the
 * scale they are meant to read, not just a number.
 */

/** World units per millimetre. */
const MM = 0.1

export interface InstrumentCtx {
  camera: THREE.PerspectiveCamera
  dom: HTMLElement
  invalidate(): void
}

export interface Instrument {
  readonly id: string
  readonly group: THREE.Group
  /** the value the instrument currently reads, in its own unit */
  reading(): number
  /** the smallest division — the reading is only good to this many digits */
  readonly precision: number
  /** has the student actually taken the measurement? */
  measured(): boolean
  update(dt: number): boolean
  onPointerDown(e: PointerEvent): boolean
  onPointerMove(e: PointerEvent): void
  onPointerUp(): void
  dispose(): void
}

/**
 * An invisible sphere that makes a small part comfortable to grab.
 * It is not rendered (the material is invisible) but the raycaster finds it.
 */
export function makeGrabHandle(radius: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  mesh.name = 'grab-handle'
  return mesh
}

/* ------------------------------------------------------------------ scales */

/** A row of ticks along the x axis, used for the beam of a caliper. */
function makeLinearScale(opts: {
  from: number
  count: number
  step: number
  length: number
  longEvery?: number
  longLength?: number
  y: number
  z: number
  color?: number
  dir?: 1 | -1
}): THREE.LineSegments {
  const longEvery = opts.longEvery ?? 10
  const longLength = opts.longLength ?? opts.length * 1.8
  const points: number[] = []
  for (let i = 0; i <= opts.count; i++) {
    const x = opts.from + i * opts.step
    const isLong = i % longEvery === 0
    const len = isLong ? longLength : opts.length
    points.push(x, opts.y, opts.z, x, opts.y + len * (opts.dir ?? 1), opts.z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: opts.color ?? 0xcfd8e3, transparent: true, opacity: 0.9 }),
  )
}

/** A ring of ticks on a dial, used by the balance and the stopwatch. */
function makeArcScale(opts: {
  radius: number
  count: number
  fromAngle: number
  toAngle: number
  length: number
  longEvery?: number
  longLength?: number
  color?: number
  z?: number
}): THREE.LineSegments {
  const longEvery = opts.longEvery ?? 5
  const longLength = opts.longLength ?? opts.length * 1.9
  const points: number[] = []
  for (let i = 0; i <= opts.count; i++) {
    const a = opts.fromAngle + ((opts.toAngle - opts.fromAngle) * i) / opts.count
    const isLong = i % longEvery === 0
    const len = isLong ? longLength : opts.length
    const c = Math.cos(a)
    const s = Math.sin(a)
    points.push(c * opts.radius, s * opts.radius, opts.z ?? 0, c * (opts.radius + len), s * (opts.radius + len), opts.z ?? 0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: opts.color ?? 0xcfd8e3, transparent: true, opacity: 0.9 }),
  )
}

/* ====================================================================== *
 *  Vernier caliper — least count 0.1 mm
 * ====================================================================== */

export class VernierCaliper implements Instrument {
  readonly id = 'vernier'
  readonly group = new THREE.Group()
  readonly precision = 0.1

  /** the jaws are at this position, in millimetres */
  private v = 0
  private drag = false
  private target: number | null = null
  private slider: THREE.Group
  private object: THREE.Group
  private objectWidth = 0

  constructor(private ctx: InstrumentCtx) {
    this.group.name = 'instrument-vernier'

    /* the beam: a long steel bar with the main scale on top. It is deliberately
       dark, so the pale scale engraving reads against it. */
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.22, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x39465a, roughness: 0.42, metalness: 0.6 }),
    )
    beam.position.set(3.05, 0, 0)
    beam.castShadow = true
    beam.receiveShadow = true
    this.group.add(beam)

    /* the fixed jaw, its measuring face exactly at x = 0 */
    const fixed = new THREE.Group()
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.5, 1.1),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    jaw.position.set(0.09, 0.55, 0)
    jaw.castShadow = true
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.55, 1.1),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    anvil.position.set(0.09, -0.4, 0)
    anvil.castShadow = true
    fixed.add(jaw, anvil)
    this.group.add(fixed)

    /* the main scale: millimetres, numbered every ten */
    this.group.add(
      makeLinearScale({
        from: 0, count: 60, step: MM, length: 0.2, longEvery: 10, longLength: 0.36,
        y: 0.11, z: 0.3, color: 0xf2f6fb,
      }),
    )
    for (let mm = 0; mm <= 60; mm += 10) {
      const label = makeLabel(String(mm), { color: '#e8eef7', size: 40, scale: 0.0034 })
      label.position.set(mm * MM, 0.5, 0.3)
      this.group.add(label)
    }

    /* the sliding carriage with the vernier scale */
    this.slider = new THREE.Group()
    this.slider.name = 'vernier-slider'
    const carriage = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.34, 1.15),
      new THREE.MeshStandardMaterial({ color: 0xaebccd, roughness: 0.4, metalness: 0.7 }),
    )
    carriage.position.set(0.575, 0.06, 0)
    carriage.castShadow = true
    const movingJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.5, 1.1),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    movingJaw.position.set(0.09, 0.55, 0)
    movingJaw.castShadow = true
    const lowerJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.55, 1.1),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    lowerJaw.position.set(0.09, -0.4, 0)
    lowerJaw.castShadow = true
    this.slider.add(carriage, movingJaw, lowerJaw)

    /* the vernier: ten divisions spanning nine millimetres */
    this.slider.add(
      makeLinearScale({
        from: 0, count: 10, step: 0.9 * MM, length: 0.16, longEvery: 5, longLength: 0.26,
        y: 0.23, z: 0.32, color: 0xffd166,
      }),
    )
    for (let k = 0; k <= 10; k++) {
      const label = makeLabel(String(k), { color: '#ffd166', size: 30, scale: 0.0026 })
      label.position.set(k * 0.9 * MM, 0.4, 0.32)
      this.slider.add(label)
    }
    const vernierGrab = makeGrabHandle(0.5)
    vernierGrab.position.set(0.575, 0.1, 0)
    this.slider.add(vernierGrab)
    this.group.add(this.slider)

    /* the thing being measured, between the jaws */
    this.object = new THREE.Group()
    this.object.name = 'vernier-object'
    const piece = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1, 28),
      new THREE.MeshStandardMaterial({ color: 0xc9d6e4, roughness: 0.25, metalness: 0.15 }),
    )
    piece.rotation.x = Math.PI / 2
    piece.castShadow = true
    this.object.add(piece)
    this.group.add(this.object)

    this.setReading(0)
  }

  setTarget(mm: number | null): void {
    this.target = mm
    if (mm !== null) {
      this.objectWidth = mm * MM
      this.setReading(mm)
    }
  }

  private setReading(mm: number): void {
    this.v = mm
    this.slider.position.x = mm * MM
    this.object.position.set((mm * MM) / 2, 0.05, 0)
    this.object.scale.x = Math.max(0.02, this.objectWidth / Math.max(0.001, mm * MM))
  }

  reading(): number {
    return this.v
  }

  measured(): boolean {
    if (this.target === null) return true
    return Math.abs(this.v - this.target) < 0.12
  }

  update(): boolean {
    return false
  }

  onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.slider])
    if (!hits.length) return false
    this.drag = true
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drag) {
      const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.slider])
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(e, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return
    const mm = Math.round(Math.min(60, Math.max(0, p.x / MM)) * 10) / 10
    this.setReading(mm)
    this.ctx.invalidate()
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = false
      this.ctx.dom.style.cursor = 'default'
    }
  }

  dispose(): void {
    disposeObject(this.group)
  }
}

/* ====================================================================== *
 *  Micrometer — least count 0.01 mm
 * ====================================================================== */

export class Micrometer implements Instrument {
  readonly id = 'micrometer'
  readonly group = new THREE.Group()
  readonly precision = 0.01

  /** the reading in millimetres */
  private r = 0
  private drag = false
  private target: number | null = null
  private thimble: THREE.Group
  private spindle: THREE.Mesh
  private piece: THREE.Mesh

  constructor(private ctx: InstrumentCtx) {
    this.group.name = 'instrument-micrometer'
    const steel = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.35, metalness: 0.75 })
    const dark = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.45, metalness: 0.65 })

    /* the C frame */
    const frame = new THREE.Group()
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.4, 0.9), dark)
    bar.position.set(3.3, 0.2, 0)
    bar.castShadow = true
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.9), dark)
    arm.position.set(1.8, -1.1, 0)
    arm.castShadow = true
    const armTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.9), dark)
    armTop.position.set(1.8, 1.5, 0)
    armTop.castShadow = true
    frame.add(bar, arm, armTop)
    this.group.add(frame)

    /* the anvil */
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.9), steel)
    anvil.position.set(0.45, 0.2, 0)
    anvil.castShadow = true
    this.group.add(anvil)

    /* the sleeve with the main scale along the top */
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.1, 24), steel)
    sleeve.rotation.z = Math.PI / 2
    sleeve.position.set(1.6, 0.2, 0)
    sleeve.castShadow = true
    sleeve.castShadow = true
    this.group.add(sleeve)

    /* main scale: half-millimetre divisions, numbered every millimetre */
    this.group.add(
      makeLinearScale({ from: 0.5, count: 40, step: 0.5 * MM, length: 0.14, longEvery: 2, longLength: 0.24, y: 0.62, z: 0.18, color: 0xf2f6fb }),
    )
    for (let mm = 0; mm <= 20; mm++) {
      const label = makeLabel(String(mm), { color: '#e8eef7', size: 30, scale: 0.0028 })
      label.position.set(mm * MM, 0.86, 0.18)
      this.group.add(label)
    }

    /* the spindle */
    this.spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 16), steel)
    this.spindle.rotation.z = Math.PI / 2
    this.spindle.castShadow = true
    this.group.add(this.spindle)

    /* the thimble: a drum whose end face carries fifty divisions */
    this.thimble = new THREE.Group()
    this.thimble.name = 'micrometer-thimble'
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 32), dark)
    drum.rotation.x = Math.PI / 2
    drum.castShadow = true
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 40),
      new THREE.MeshStandardMaterial({ color: 0x1c2634, roughness: 0.6, metalness: 0.2 }),
    )
    face.position.z = 0.56
    this.thimble.add(drum, face)

    /* fifty divisions around the face */
    const ticks: number[] = []
    for (let k = 0; k < 50; k++) {
      const a = (k / 50) * Math.PI * 2
      const len = k % 5 === 0 ? 0.2 : 0.12
      const c = Math.cos(a)
      const s = Math.sin(a)
      ticks.push(c * 0.58, s * 0.58, 0.57, c * (0.58 - len), s * (0.58 - len), 0.57)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3))
    this.thimble.add(
      new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 })),
    )
    /* the datum line the student reads against, at the top of the face */
    const datum = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.3, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff5c5c }),
    )
    datum.position.set(0, 0.43, 0.59)
    this.thimble.add(datum)

    const thimbleGrab = makeGrabHandle(0.7)
    this.thimble.add(thimbleGrab)
    this.group.add(this.thimble)

    /* the piece being measured */
    this.piece = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.9, 24),
      new THREE.MeshStandardMaterial({ color: 0xc9d6e4, roughness: 0.25, metalness: 0.15 }),
    )
    this.piece.rotation.x = Math.PI / 2
    this.piece.castShadow = true
    this.group.add(this.piece)

    this.setReading(0)
  }

  setTarget(mm: number | null): void {
    this.target = mm
    if (mm !== null) this.setReading(mm)
  }

  private setReading(mm: number): void {
    this.r = mm
    /* the thimble turns one revolution per 0.5 mm of spindle travel */
    const k = Math.round(mm * 100) % 50
    const angle = (k / 50) * Math.PI * 2
    this.thimble.rotation.z = angle
    this.thimble.position.set(3.35, 0.2, 0)
    this.spindle.position.set(0.45 + (mm * MM) / 2 + 0.11, 0.2, 0)
    this.spindle.scale.y = Math.max(0.05, (mm * MM) / 2.2)
    this.piece.position.set(0.45 + (mm * MM) / 2, 0.2, 0)
  }

  reading(): number {
    return this.r
  }

  measured(): boolean {
    if (this.target === null) return true
    return Math.abs(this.r - this.target) < 0.012
  }

  update(): boolean {
    return false
  }

  onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.thimble])
    if (!hits.length) return false
    this.drag = true
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drag) {
      const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.thimble])
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    /* dragging turns the thimble: horizontal movement of the pointer maps to
       a rotation, the way the real instrument is turned */
    const dx = e.movementX ?? 0
    const steps = dx / 6
    const turns = Math.round(this.r * 100) / 100 + steps * 0.01
    this.setReading(Math.round(turns * 100) / 100)
    this.ctx.invalidate()
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = false
      this.ctx.dom.style.cursor = 'default'
    }
  }

  dispose(): void {
    disposeObject(this.group)
  }
}

/* ====================================================================== *
 *  Ohaus balance — least count 0.1 g
 * ====================================================================== */

const BALANCE_WEIGHTS = [
  { g: 50, r: 0.42 },
  { g: 20, r: 0.32 },
  { g: 10, r: 0.26 },
  { g: 5, r: 0.2 },
  { g: 2, r: 0.15 },
  { g: 1, r: 0.12 },
]

export class OhausBalance implements Instrument {
  readonly id = 'balance'
  readonly group = new THREE.Group()
  readonly precision = 0.1

  private target: number | null = null
  private onPan: number[] = []
  private pointer: THREE.Group
  private arc: THREE.Group
  private weights: THREE.Group[] = []
  private dragging: THREE.Group | null = null
  private dragOffset = 0
  /** the beam overshoots and settles, like a real balance */
  private swing = 0
  private swingVel = 0
  private readout = 0

  constructor(private ctx: InstrumentCtx) {
    this.group.name = 'instrument-balance'
    const steel = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.4, metalness: 0.7 })
    const dark = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.5, metalness: 0.55 })

    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 1.8), dark)
    base.position.set(0, 0.11, 0)
    base.castShadow = true
    base.receiveShadow = true
    this.group.add(base)

    const column = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), steel)
    column.position.set(0, 1.8, -0.55)
    column.castShadow = true
    this.group.add(column)

    /* the graduated arc the pointer reads against */
    this.arc = new THREE.Group()
    this.arc.position.set(0, 2.9, -0.5)
    this.arc.add(
      makeArcScale({
        radius: 1.35, count: 100, fromAngle: Math.PI * 0.72, toAngle: Math.PI * 0.28,
        length: 0.09, longEvery: 10, longLength: 0.18, color: 0xcfd8e3,
      }),
    )
    for (let g = 0; g <= 100; g += 10) {
      const a = Math.PI * 0.72 + (Math.PI * 0.28 - Math.PI * 0.72) * (g / 100)
      const label = makeLabel(String(g), { color: C.neutral, size: 24, scale: 0.0021 })
      label.position.set(Math.cos(a) * 1.62, Math.sin(a) * 1.62, 0)
      this.arc.add(label)
    }
    this.group.add(this.arc)

    /* the beam and the pointer */
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.18), steel)
    beam.position.set(0, 2.72, -0.42)
    beam.castShadow = true
    this.group.add(beam)

    this.pointer = new THREE.Group()
    this.pointer.name = 'balance-pointer'
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.5, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xff5c5c }),
    )
    needle.position.y = 0.75
    this.pointer.add(needle)
    this.pointer.position.set(0, 2.9 - 1.35, -0.5)
    this.group.add(this.pointer)

    /* the pan */
    const pan = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 0.95, 0.12, 32),
      steel,
    )
    pan.position.set(0, 0.72, 0.5)
    pan.castShadow = true
    pan.receiveShadow = true
    this.group.add(pan)
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), steel)
      leg.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.85, 0.4, 0.5 + Math.sin((i / 3) * Math.PI * 2) * 0.85)
      leg.castShadow = true
      this.group.add(leg)
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 10), steel)
    post.position.set(0, 1.55, 0.5)
    post.castShadow = true
    this.group.add(post)

    /* the loose weights, waiting to be picked up */
    BALANCE_WEIGHTS.forEach((w, i) => {
      const g = new THREE.Group()
      g.name = `weight-${w.g}`
      g.userData.grams = w.g
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(w.r, w.r, w.r * 1.1, 24),
        new THREE.MeshStandardMaterial({ color: 0x8fa0b5, roughness: 0.4, metalness: 0.7 }),
      )
      disc.rotation.x = Math.PI / 2
      disc.castShadow = true
      g.add(disc)
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(w.r * 0.35, w.r * 0.45, w.r * 0.6, 16),
        new THREE.MeshStandardMaterial({ color: 0x5d6a7d, roughness: 0.5, metalness: 0.6 }),
      )
      knob.rotation.x = Math.PI / 2
      knob.position.z = w.r * 0.7
      g.add(knob)
      const grab = makeGrabHandle(Math.max(0.22, w.r * 1.5))
      g.add(grab)
      g.position.set(-2.6 + i * 0.62, 0.28, 1.5)
      this.weights.push(g)
      this.group.add(g)
    })
  }

  setTarget(g: number | null): void {
    this.target = g
    if (g !== null) this.setLoad(g)
  }

  private setLoad(g: number): void {
    /* put the target mass on the pan as a combination of the real weights */
    let rest = g
    this.onPan = []
    for (const w of BALANCE_WEIGHTS) {
      if (rest >= w.g - 1e-6) {
        rest -= w.g
        this.onPan.push(w.g)
      }
    }
    this.applyWeights()
  }

  private applyWeights(): void {
    let i = 0
    for (const g of this.weights) {
      const grams = g.userData.grams as number
      if (this.onPan.includes(grams)) {
        g.position.set(-0.45 + i * 0.34, 0.86, 0.5)
        i++
      } else {
        g.position.set(-2.6 + this.weights.indexOf(g) * 0.62, 0.28, 1.5)
      }
    }
  }

  reading(): number {
    return this.readout
  }

  measured(): boolean {
    if (this.target === null) return true
    return Math.abs(this.readout - this.target) < 0.15
  }

  update(dt: number): boolean {
    /* the beam oscillates and settles, the way a real balance does */
    const goal = this.onPan.reduce((a, b) => a + b, 0)
    this.swingVel += -this.swing * 34 * dt
    this.swingVel *= Math.exp(-3.6 * dt)
    this.swing += this.swingVel * dt
    if (Math.abs(this.swing) < 1e-4) this.swing = 0
    this.readout = goal + this.swing

    /* the pointer swings across the graduated arc, 0 g at the left */
    const fraction = clamp(this.readout / 100, 0, 1)
    const angle = Math.PI * 0.72 + (Math.PI * 0.28 - Math.PI * 0.72) * fraction
    this.pointer.rotation.z = angle - Math.PI / 2
    return true
  }

  onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    const hits = pick(e, this.ctx.camera, this.ctx.dom, this.weights)
    if (!hits.length) return false
    let g: THREE.Group | null = null
    for (const w of this.weights) {
      if (hits[0].object === w || w.getObjectById(hits[0].object.id)) {
        g = w
        break
      }
    }
    if (!g) return false
    this.dragging = g
    const p = rayPlaneZ(e, this.ctx.camera, this.ctx.dom, 0)
    this.dragOffset = p ? p.x - g.position.x : 0
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.dragging) {
      const hits = pick(e, this.ctx.camera, this.ctx.dom, this.weights)
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(e, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return
    const x = p.x - this.dragOffset
    /* over the pan → the weight goes on it */
    const onPan = Math.hypot(x, 0.5) < 1.15
    const grams = this.dragging.userData.grams as number
    if (onPan) {
      if (!this.onPan.includes(grams)) {
        this.onPan.push(grams)
        this.swingVel += 3
      }
    } else if (this.onPan.includes(grams)) {
      this.onPan = this.onPan.filter((x2) => x2 !== grams)
    }
    this.applyWeights()
    this.ctx.invalidate()
  }

  onPointerUp(): void {
    if (this.dragging) {
      this.dragging = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  dispose(): void {
    disposeObject(this.group)
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}

/* ====================================================================== *
 *  Stopwatch — least count 0.1 s
 * ====================================================================== */

export class Stopwatch implements Instrument {
  readonly id = 'stopwatch'
  readonly group = new THREE.Group()
  readonly precision = 0.1

  /** seconds on the big dial */
  private t = 0
  private running = false
  private target: number | null = null
  private hand: THREE.Group
  private minuteHand: THREE.Group
  private crown: THREE.Mesh

  constructor(private ctx: InstrumentCtx) {
    this.group.name = 'instrument-stopwatch'

    const caseMat = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.3, metalness: 0.85 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.5, 48), caseMat)
    body.rotation.x = Math.PI / 2
    body.castShadow = true
    this.group.add(body)

    const face = new THREE.Mesh(
      new THREE.CircleGeometry(2.15, 48),
      new THREE.MeshStandardMaterial({ color: 0x141c28, roughness: 0.75, metalness: 0.05 }),
    )
    face.position.z = 0.26
    this.group.add(face)

    /* the big dial: thirty seconds, tenths of a second */
    this.group.add(
      makeArcScale({
        radius: 1.75, count: 300, fromAngle: -Math.PI / 2, toAngle: Math.PI * 1.5,
        length: 0.06, longEvery: 25, longLength: 0.17, color: 0xcfd8e3, z: 0.28,
      }),
    )
    for (let s = 0; s < 30; s += 5) {
      const a = -Math.PI / 2 + (s / 30) * Math.PI * 2
      const label = makeLabel(String(s), { color: C.neutral, size: 30, scale: 0.0026 })
      label.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.3)
      this.group.add(label)
    }

    /* the small minute dial */
    const small = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a2432, roughness: 0.75 }),
    )
    small.position.set(0, 1.25, 0.28)
    this.group.add(small)
    this.group.add(
      makeArcScale({
        radius: 0.58, count: 30, fromAngle: -Math.PI / 2, toAngle: Math.PI * 1.5,
        length: 0.05, longEvery: 5, longLength: 0.12, color: 0x8fa0b5, z: 0.3,
      }),
    );
    const smallLabel = makeLabel('min', { color: C.neutral, size: 20, scale: 0.0018 })
    smallLabel.position.set(0, 0.95, 0.3)
    this.group.add(smallLabel)

    /* the seconds hand */
    this.hand = new THREE.Group()
    this.hand.name = 'stopwatch-hand'
    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 1.9, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xff9f43 }),
    )
    needle.position.y = 0.85
    this.hand.add(needle)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.42, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xff9f43 }),
    )
    counter.position.y = -0.22
    this.hand.add(counter)
    this.hand.position.z = 0.32
    this.group.add(this.hand)

    /* the minute hand */
    this.minuteHand = new THREE.Group()
    this.minuteHand.name = 'stopwatch-minute-hand'
    const mNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.66, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x9db0c6 }),
    )
    mNeedle.position.y = 0.26
    this.minuteHand.add(mNeedle)
    this.minuteHand.position.set(0, 1.25, 0.33)
    this.group.add(this.minuteHand)

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), caseMat)
    hub.rotation.x = Math.PI / 2
    hub.position.z = 0.36
    this.group.add(hub)

    /* the crown, which the student presses */
    this.crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: 0x5d6a7d, roughness: 0.4, metalness: 0.8 }),
    )
    this.crown.rotation.z = Math.PI / 2
    this.crown.position.set(2.42, 0, 0)
    this.crown.name = 'stopwatch-crown'
    this.crown.castShadow = true
    const crownGrab = makeGrabHandle(0.34)
    crownGrab.position.set(0, 0, 0)
    this.crown.add(crownGrab)
    this.group.add(this.crown)

    this.setTime(0)
  }

  setTarget(seconds: number | null): void {
    this.target = seconds
    if (seconds !== null) this.setTime(seconds)
  }

  private setTime(seconds: number): void {
    this.t = seconds
    const dial = seconds % 30
    this.hand.rotation.z = -(dial / 30) * Math.PI * 2
    const minutes = Math.floor(seconds / 60)
    this.minuteHand.rotation.z = -((minutes % 15) / 15) * Math.PI * 2
  }

  reading(): number {
    return this.t
  }

  measured(): boolean {
    if (this.target === null) return true
    return Math.abs(this.t - this.target) < 0.06
  }

  update(dt: number): boolean {
    if (!this.running) return false
    this.setTime(this.t + dt)
    return true
  }

  onPointerDown(e: PointerEvent): boolean {
    if (e.button !== 0) return false
    const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.crown])
    if (!hits.length) return false
    this.running = !this.running
    this.ctx.invalidate()
    return true
  }

  onPointerMove(e: PointerEvent): void {
    const hits = pick(e, this.ctx.camera, this.ctx.dom, [this.crown])
    hover(this.ctx.dom, hits.length > 0)
  }

  onPointerUp(): void {
    /* nothing to release */
  }

  dispose(): void {
    disposeObject(this.group)
  }
}
