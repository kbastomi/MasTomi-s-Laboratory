import * as THREE from 'three'
import { C, disposeObject } from '../../../kit/arrows'
import { makeLabel } from '../../../kit/labels'
import { hover, pick, rayPlaneZ } from '../../../kit/picking'
import { makeArcScale, makeGrabHandle } from './scale'
import { clamp } from '../../../core/math'
import type { Instrument, InstrumentCtx } from './types'

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



/**
 * The Ohaus balance: the pointer swings across a graduated arc, read to 0.1 g.
 */
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
