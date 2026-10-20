import * as THREE from 'three'

/**
 * The diorama that sits behind the chapter index.
 *
 * It is deliberately cheap — a handful of primitives — because it only has to
 * look good, not teach anything. The engine's on-demand renderer still keeps
 * it cheap: it is redrawn only while the camera is drifting.
 */
export function buildShowcase(): THREE.Group {
  const group = new THREE.Group()

  const steel = new THREE.MeshStandardMaterial({ color: 0xb9c6d4, roughness: 0.4, metalness: 0.7 })
  const warm = new THREE.MeshStandardMaterial({ color: 0xe0a458, roughness: 0.75, metalness: 0.05 })
  const teal = new THREE.MeshStandardMaterial({
    color: 0x2fc7b6,
    roughness: 0.35,
    metalness: 0.5,
    emissive: 0x0d3b36,
  })

  /* a beam resting on a fulcrum */
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 0.6), steel)
  beam.position.set(0, 2.5, 0)
  beam.rotation.z = 0.16
  beam.castShadow = true
  group.add(beam)

  const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 4), teal)
  fulcrum.position.set(0, 1.1, 0)
  fulcrum.rotation.y = Math.PI / 4
  fulcrum.castShadow = true
  group.add(fulcrum)

  const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), warm)
  crate.position.set(2.4, 3.35, 0)
  crate.rotation.z = 0.16
  crate.castShadow = true
  group.add(crate)

  /* a sheave on the right */
  const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 12, 36), steel)
  sheave.position.set(-3.1, 3.4, 0)
  sheave.castShadow = true
  group.add(sheave)

  /* a slow floating sphere, like a planet */
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 18),
    new THREE.MeshStandardMaterial({ color: 0x4cc9f0, roughness: 0.3, metalness: 0.4 }),
  )
  sphere.position.set(-3.1, 3.4, 0)
  sphere.castShadow = true
  group.add(sphere)

  /* a few drifting motes */
  const moteMat = new THREE.MeshBasicMaterial({ color: 0x8fd7ff, transparent: true, opacity: 0.55 })
  for (let i = 0; i < 12; i++) {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), moteMat)
    mote.position.set(
      (Math.random() - 0.5) * 12,
      1 + Math.random() * 5,
      (Math.random() - 0.5) * 6 - 1,
    )
    group.add(mote)
  }

  return group
}
