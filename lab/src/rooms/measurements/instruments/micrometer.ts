import * as THREE from 'three'
import { C, disposeObject } from '../../../kit/arrows'
import { makeLabel } from '../../../kit/labels'
import { hover, pick } from '../../../kit/picking'
import { MM, makeGrabHandle, makeLinearScale } from './scale'
import type { Instrument, InstrumentCtx } from './types'


/**
 * The micrometer: the spindle advances 0.5 mm per turn and the thimble has fifty divisions, so the least count is 0.01 mm.
 */
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
