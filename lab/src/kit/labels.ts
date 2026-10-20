import * as THREE from 'three'

/**
 * A text label that lives in the 3D scene.
 *
 * The label is drawn on a fixed-size canvas once and then scaled, because
 * resizing a canvas texture while it is being uploaded breaks on some mobile
 * drivers. The canvas is redrawn only when the text actually changes.
 */
export interface LabelOptions {
  color?: string
  size?: number
  /** world units per canvas pixel */
  scale?: number
  bg?: string
  border?: string
}

export interface Label extends THREE.Sprite {
  userData: THREE.Object3D['userData'] & {
    setText(text: string): void
    /** the label's size at the reference camera distance */
    baseScale: { x: number; y: number }
  }
}

/** Tags a sprite so the engine can keep it legible at any camera distance. */
export const LABEL_TAG = 'labLabel'

/**
 * The distance at which a label is shown at its natural size. Labels are
 * scaled relative to this so that a phone held at arm's length shows the same
 * readable text as a laptop.
 */
export const LABEL_REFERENCE_DISTANCE = 13

export function makeLabel(text: string, opts: LabelOptions = {}): Label {
  const color = opts.color ?? '#ffffff'
  const size = opts.size ?? 44
  const scale = opts.scale ?? 0.0046

  const CW = 1024
  const CH = Math.max(128, Math.round(size * 3.1))

  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')!

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })

  const sprite = new THREE.Sprite(mat) as Label
  sprite.renderOrder = 30
  sprite.scale.set(CW * scale, CH * scale, 1)
  sprite.userData.baseScale = { x: CW * scale, y: CH * scale }
  sprite.userData[LABEL_TAG] = true

  let lastText: string | null = null

  const setText = (t: string): void => {
    if (t === lastText) return
    lastText = t

    const font = `700 ${size}px system-ui, "Segoe UI", Arial`
    ctx.font = font
    const padX = size * 0.55
    const padY = size * 0.3
    let w = ctx.measureText(t).width + padX * 2
    let h = size + padY * 2
    let k = 1
    if (w > CW - 10) {
      k = (CW - 10) / w
      w *= k
      h *= k
    }

    ctx.clearRect(0, 0, CW, CH)
    ctx.save()
    ctx.translate(CW / 2, CH / 2)
    ctx.scale(k, k)
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const r = h / 2
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r)
    else ctx.rect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = opts.bg ?? 'rgba(9,14,22,0.74)'
    ctx.fill()
    if (opts.border) {
      ctx.strokeStyle = opts.border
      ctx.lineWidth = 2.5 / k
      ctx.stroke()
    }
    ctx.fillStyle = color
    ctx.fillText(t, 0, size * 0.05)
    ctx.restore()
    tex.needsUpdate = true
  }

  sprite.userData.setText = setText
  setText(text)
  return sprite
}
