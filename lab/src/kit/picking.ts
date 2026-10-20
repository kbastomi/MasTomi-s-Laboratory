import * as THREE from 'three'

/** Shared raycaster — one instance for the whole application. */
const ray = new THREE.Raycaster()

export function pointerNDC(event: PointerEvent, dom: HTMLElement): THREE.Vector2 {
  const rect = dom.getBoundingClientRect()
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
}

/** All intersections of the pointer with the given objects. */
export function pick(
  event: PointerEvent,
  camera: THREE.Camera,
  dom: HTMLElement,
  objects: THREE.Object3D[],
): THREE.Intersection[] {
  ray.setFromCamera(pointerNDC(event, dom), camera)
  return ray.intersectObjects(objects, true)
}

/** Where the pointer ray meets a plane at a fixed z (the scene is mostly planar). */
export function rayPlaneZ(
  event: PointerEvent,
  camera: THREE.Camera,
  dom: HTMLElement,
  z = 0,
): THREE.Vector3 | null {
  ray.setFromCamera(pointerNDC(event, dom), camera)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z)
  const hit = new THREE.Vector3()
  return ray.ray.intersectPlane(plane, hit) ? hit : null
}

/** Cursor feedback for hoverable objects. */
export function hover(dom: HTMLElement, hit: boolean): void {
  dom.style.cursor = hit ? 'grab' : 'default'
}

/** Is `obj` inside `ancestor`? */
export function isInside(obj: THREE.Object3D | null, ancestor: THREE.Object3D): boolean {
  let o = obj
  while (o) {
    if (o === ancestor) return true
    o = o.parent
  }
  return false
}
