import * as THREE from 'three'

/**
 * The scale-drawing helpers shared by the measuring instruments.
 *
 * Ticks are drawn as a single `LineSegments` per scale, so a whole vernier
 * costs one draw call rather than sixty.
 */

/** World units per millimetre. */
export const MM = 0.1

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

export function makeLinearScale(opts: {
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

export function makeArcScale(opts: {
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
