import * as THREE from 'three'
import { C } from './arrows'

/**
 * Reusable props for the lab rooms: crates, sheaves, steel plates and rope.
 * Keeping them here means every lab builds its scene from the same parts, so
 * the whole laboratory looks like one place.
 */

/** A wooden crate. */
export function makeCrate(
  w: number,
  h: number,
  d: number,
  color = C.crate,
  opts: { ring?: boolean } = {},
): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 })
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  box.castShadow = true
  box.receiveShadow = true

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color: 0x241a0c, transparent: true, opacity: 0.5 }),
  )

  const slatMat = new THREE.MeshStandardMaterial({ color: 0x8c6a3a, roughness: 0.9 })
  const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.06, d * 1.01), slatMat)
  slat.position.y = h / 2 - 0.06
  const slat2 = slat.clone()
  slat2.position.y = -h / 2 + 0.06

  g.add(box, edges, slat, slat2)

  if (opts.ring) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.035, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.3, metalness: 0.85 }),
    )
    ring.position.y = h / 2 + 0.1
    ring.rotation.x = Math.PI / 2
    ring.castShadow = true
    g.add(ring)
    g.userData.ringY = h / 2 + 0.1
  }

  g.userData.size = { w, h, d }
  return g
}

/** A pulley sheave: wheel, groove and hub, axis along z. */
export function makeSheave(R: number, thickness = 0.14): THREE.Group {
  const t = thickness || 0.14
  const g = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.42, metalness: 0.5 })
  const dark = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.6, metalness: 0.35 })

  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, t, 30), steel)
  wheel.rotation.x = Math.PI / 2
  const groove = new THREE.Mesh(new THREE.TorusGeometry(R - 0.015, 0.042, 8, 34), dark)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, t + 0.14, 12), dark)
  hub.rotation.x = Math.PI / 2

  g.add(wheel, groove, hub)
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
  })
  g.userData.R = R
  return g
}

/** A steel block or frame plate. */
export function makePlate(w: number, h: number, t: number, color = C.steelDark): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.45 })
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Rope drawn as a tube through a polyline. */
export class Rope {
  readonly mesh: THREE.Mesh
  private material: THREE.MeshStandardMaterial
  private radius: number

  constructor(color: number = C.rope, radius = 0.05) {
    this.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0.05,
    })
    this.radius = radius
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material)
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
  }

  update(points: THREE.Vector3[]): void {
    if (!points || points.length < 2) {
      this.mesh.visible = false
      return
    }
    this.mesh.visible = true
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
    const seg = Math.max(32, Math.min(220, points.length * 5))
    const geo = new THREE.TubeGeometry(curve, seg, this.radius, 7, false)
    this.mesh.geometry.dispose()
    this.mesh.geometry = geo
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
