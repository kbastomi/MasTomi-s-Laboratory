import * as THREE from 'three'
import { makeLabel, type Label } from './labels'

/**
 * Colour roles shared by every lab.
 *
 * These stay consistent across the whole laboratory so a student who learns
 * "teal = what you put in, orange = what you get out" in the lever room
 * still knows it in the pulley room.
 */
export const C = {
  bg: 0x0d131c,
  floor: 0x1d2634,
  beam: 0xc7d3e0,
  fulcrum: 0xd95f4c,
  crate: 0xe0a458,
  crateEdge: 0x4a3413,
  steel: 0xb9c6d4,
  steelDark: 0x57637a,
  rope: 0xe8d5a8,
  input: '#38d6c4',
  output: '#ff9f43',
  lift: '#5ee07a',
  neutral: '#9db0c6',
} as const

export interface ArrowOptions {
  radius?: number
  headLen?: number
  labelSide?: number
}

export interface Arrow extends THREE.Group {
  set(origin: THREE.Vector3, direction: THREE.Vector3, length: number): void
  setLabel(text: string): void
}

/**
 * A force / velocity arrow: shaft, head and a value label that stays
 * upright in the un-rotated frame so it is always readable.
 */
export function makeArrow(color: string, opts: ArrowOptions = {}): Arrow {
  const col = new THREE.Color(color)
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col.clone().multiplyScalar(0.35),
    roughness: 0.4,
    metalness: 0.1,
  })

  const group = new THREE.Group() as Arrow
  const shape = new THREE.Group()
  const headLen = opts.headLen ?? 0.34
  const rad = opts.radius ?? 0.055

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 1, 10), mat)
  shaft.geometry.translate(0, 0.5, 0)

  const head = new THREE.Mesh(new THREE.ConeGeometry(rad * 2.4, headLen, 14), mat)
  head.geometry.translate(0, headLen / 2, 0)

  const headHolder = new THREE.Group()
  headHolder.add(head)
  shape.add(shaft, headHolder)

  const label: Label = makeLabel('', { color, border: color })
  group.add(shape, label)

  const up = new THREE.Vector3(0, 1, 0)
  const zAxis = new THREE.Vector3(0, 0, 1)

  const set = (origin: THREE.Vector3, direction: THREE.Vector3, length: number): void => {
    if (length < 0.12) {
      group.visible = false
      return
    }
    group.visible = true
    group.position.copy(origin)
    const d = direction.clone().normalize()
    shape.quaternion.setFromUnitVectors(up, d)
    const body = Math.max(0.02, length - headLen)
    shaft.scale.set(1, body, 1)
    headHolder.position.y = body

    const perp = new THREE.Vector3().crossVectors(d, zAxis)
    if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0)
    perp.normalize()
    const side = opts.labelSide ?? 0.6
    const t = length * 0.55
    label.position.set(
      d.x * t + perp.x * side,
      d.y * t + perp.y * side,
      d.z * t + perp.z * side + 0.3,
    )
  }

  group.set = set
  group.setLabel = (text: string) => label.userData.setText(text)
  /* also reachable through userData, which is how the labs call it */
  group.userData.set = set
  group.userData.setLabel = group.setLabel
  group.visible = false
  return group
}

/** Shared material factory — reusing materials keeps draw calls low. */
export function metal(color: number, roughness = 0.45, metalness = 0.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

export function matte(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 })
}

/** Recursively release everything a lab allocated. */
export function disposeObject(root: THREE.Object3D | null): void {
  if (!root) return
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const material = mesh.material
    if (material) {
      const list = Array.isArray(material) ? material : [material]
      for (const m of list) {
        if (!m) continue
        const anyM = m as THREE.MeshStandardMaterial
        if (anyM.map) anyM.map.dispose()
        m.dispose()
      }
    }
  })
  root.parent?.remove(root)
}
