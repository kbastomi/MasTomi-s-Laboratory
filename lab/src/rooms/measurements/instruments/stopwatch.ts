import * as THREE from 'three'
import { C, disposeObject } from '../../../kit/arrows'
import { makeLabel } from '../../../kit/labels'
import { hover, pick } from '../../../kit/picking'
import { makeArcScale, makeGrabHandle } from './scale'
import type { Instrument, InstrumentCtx } from './types'


/**
 * The analog stopwatch: a thirty-second dial read to a tenth of a second, with a small minutes dial.
 */
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

