import type * as THREE from 'three'

/**
 * The contract every measuring instrument implements.
 *
 * An instrument is a small 3D model the student actually operates: close the
 * jaws on something, balance a weight, or read a dial. The whole point of the
 * room is that the student learns to *read* the instrument, so every model
 * shows the scale they are meant to read, not just a number.
 */

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
