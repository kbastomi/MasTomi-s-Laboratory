import * as THREE from 'three'
import { C, disposeObject } from '../../../kit/arrows'
import { makeLabel } from '../../../kit/labels'
import { hover, pick, rayPlaneZ } from '../../../kit/picking'
import { MM, makeGrabHandle, makeLinearScale } from './scale'
import type { Instrument, InstrumentCtx } from './types'


/**
 * The vernier caliper: ten vernier divisions span nine millimetres, so the least count is 0.1 mm.
 */
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
