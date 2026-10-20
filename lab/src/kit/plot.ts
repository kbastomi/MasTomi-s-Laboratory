/**
 * A small 2D graph panel.
 *
 * Many school physics labs are really about *reading a graph*, so every lab
 * can drop one of these into its panel and stream live data into it.
 * It is plain canvas — no chart library, no extra download.
 */
export interface PlotSeries {
  name: string
  color: string
  points: { x: number; y: number }[]
  /** draw as a dashed line (for a theory curve) */
  dashed?: boolean
  /** draw points only (for a scatter of measurements) */
  pointsOnly?: boolean
}

export interface PlotOptions {
  title?: string
  xLabel?: string
  yLabel?: string
  height?: number
}

export class Plot {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private series: PlotSeries[] = []
  private xMin = 0
  private xMax = 1
  private yMin = 0
  private yMax = 1
  private autoY = true
  private marker: number | null = null
  private opts: PlotOptions

  constructor(host: HTMLElement, opts: PlotOptions = {}) {
    this.opts = opts
    const wrap = document.createElement('div')
    wrap.className = 'plot'

    if (opts.title) {
      const h = document.createElement('div')
      h.className = 'plot-title'
      h.textContent = opts.title
      wrap.appendChild(h)
    }

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'plot-canvas'
    wrap.appendChild(this.canvas)

    const legend = document.createElement('div')
    legend.className = 'plot-legend'
    wrap.appendChild(legend)
    this.legendEl = legend

    host.appendChild(wrap)
    this.ctx = this.canvas.getContext('2d')!

    this.resize()
    window.addEventListener('resize', this.resize)
  }

  private legendEl: HTMLElement

  dispose(): void {
    window.removeEventListener('resize', this.resize)
  }

  resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(120, rect.width || this.canvas.parentElement?.clientWidth || 260)
    const h = this.opts.height ?? 150
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.height = `${h}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.draw()
  }

  /** Replace all series. */
  setSeries(series: PlotSeries[]): void {
    this.series = series
    this.renderLegend()
    this.draw()
  }

  addSeries(series: PlotSeries): void {
    this.series.push(series)
    this.renderLegend()
    this.draw()
  }

  clear(): void {
    this.series = []
    this.marker = null
    this.renderLegend()
    this.draw()
  }

  setXRange(min: number, max: number): void {
    this.xMin = min
    this.xMax = max
    this.draw()
  }

  /** Fixed y range, or `null` to follow the data. */
  setYRange(min: number | null, max?: number): void {
    if (min === null) {
      this.autoY = true
    } else {
      this.autoY = false
      this.yMin = min
      this.yMax = max ?? min + 1
    }
    this.draw()
  }

  /** A vertical marker, e.g. "now". */
  setMarker(x: number | null): void {
    this.marker = x
    this.draw()
  }

  private renderLegend(): void {
    this.legendEl.innerHTML = ''
    for (const s of this.series) {
      const item = document.createElement('span')
      item.className = 'plot-key'
      const dot = document.createElement('i')
      dot.style.background = s.color
      const label = document.createElement('span')
      label.textContent = s.name
      item.append(dot, label)
      this.legendEl.appendChild(item)
    }
  }

  private draw(): void {
    const ctx = this.ctx
    const w = this.canvas.width / (window.devicePixelRatio > 2 ? 2 : Math.min(window.devicePixelRatio || 1, 2))
    const h = this.opts.height ?? 150
    const padL = 42
    const padR = 10
    const padT = 10
    const padB = 22

    if (this.autoY) {
      let lo = Infinity
      let hi = -Infinity
      for (const s of this.series) {
        for (const p of s.points) {
          if (p.y < lo) lo = p.y
          if (p.y > hi) hi = p.y
        }
      }
      if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
      if (hi - lo < 1e-9) { hi = lo + 1 }
      const margin = (hi - lo) * 0.12
      this.yMin = lo - margin
      this.yMax = hi + margin
    }

    const plotW = w - padL - padR
    const plotH = h - padT - padB
    const sx = (x: number) => padL + ((x - this.xMin) / (this.xMax - this.xMin || 1)) * plotW
    const sy = (y: number) => padT + plotH - ((y - this.yMin) / (this.yMax - this.yMin || 1)) * plotH

    ctx.clearRect(0, 0, w, h)

    // frame
    ctx.fillStyle = 'rgba(9,14,22,0.55)'
    ctx.fillRect(padL, padT, plotW, plotH)

    // grid
    ctx.strokeStyle = 'rgba(120,145,175,0.16)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const gy = padT + (plotH * i) / 4
      ctx.beginPath()
      ctx.moveTo(padL, gy)
      ctx.lineTo(padL + plotW, gy)
      ctx.stroke()
    }
    for (let i = 0; i <= 4; i++) {
      const gx = padL + (plotW * i) / 4
      ctx.beginPath()
      ctx.moveTo(gx, padT)
      ctx.lineTo(gx, padT + plotH)
      ctx.stroke()
    }

    // axes
    ctx.strokeStyle = 'rgba(160,185,215,0.5)'
    ctx.strokeRect(padL, padT, plotW, plotH)

    // labels
    ctx.fillStyle = '#9db0c6'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${this.opts.xLabel ?? ''}`, padL + plotW / 2, padT + plotH + 5)
    ctx.save()
    ctx.translate(10, padT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(this.opts.yLabel ?? '', 0, 0)
    ctx.restore()

    // y tick labels
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i <= 4; i++) {
      const value = this.yMax - ((this.yMax - this.yMin) * i) / 4
      const gy = padT + (plotH * i) / 4
      ctx.fillText(formatTick(value), padL - 5, gy)
    }

    // marker
    if (this.marker !== null) {
      const mx = sx(this.marker)
      if (mx >= padL && mx <= padL + plotW) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(mx, padT)
        ctx.lineTo(mx, padT + plotH)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // series
    for (const s of this.series) {
      if (!s.points.length) continue
      ctx.strokeStyle = s.color
      ctx.fillStyle = s.color
      ctx.lineWidth = 1.8
      ctx.setLineDash(s.dashed ? [5, 4] : [])
      if (!s.pointsOnly) {
        ctx.beginPath()
        s.points.forEach((p, i) => {
          const px = sx(p.x)
          const py = sy(p.y)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }
      if (s.pointsOnly) {
        for (const p of s.points) {
          ctx.beginPath()
          ctx.arc(sx(p.x), sy(p.y), 2.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.setLineDash([])
    }
  }
}

function formatTick(v: number): string {
  if (!Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  if (abs !== 0 && (abs < 0.01 || abs >= 10000)) return v.toExponential(1)
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(abs < 1 ? 2 : 1)
}
