import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp, rot2, smooth, tanh } from '../../core/math'
import type {
  LabContext,
  LabInstance,
  PanelContext,
  Readout,
  SliderHandle,
  StatusHandle,
  GoalHandle,
} from '../../core/lab'
import { C, disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { makeCrate } from '../../kit/objects'
import { hover, isInside, pick, rayPlaneZ } from '../../kit/picking'

/* ------------------------------------------------------------------ scene */
const BENCH_TOP = 1.2
const PIVOT_Y = 2.58
const HALF = 4.5
const D_MIN = 0.6
const D_MAX = 4.3
const TILT_MAX = 0.22

/* ------------------------------------------------------------------ texts */
const S = {
  setup: L('Penyiapan — beban & lengan', 'Setup — weights & arms'),
  loadW: L('Berat beban  W  (keluaran)', 'Load weight  W  (output)'),
  effortF: L('Gaya dorong  F  (masukan)', 'Effort force  F  (input)'),
  armOut: L('Lengan beban  d_out', 'Load arm  d_out'),
  armIn: L('Lengan dorong  d_in', 'Effort arm  d_in'),
  balance: L('⚖ Seimbangkan', '⚖ Balance it'),
  reset: L('↺ Atur ulang', '↺ Reset'),
  measurements: L('Pengukuran', 'Measurements'),
  maLabel: L('KEUNTUNGAN MEKANIS', 'MECHANICAL ADVANTAGE'),
  maFormula: L('MA = lengan dorong ÷ lengan beban', 'MA = effort arm ÷ load arm'),
  outForce: L('Gaya keluar  (beban)', 'Output force  (the load)'),
  inForce: L('Gaya masuk  (doronganmu)', 'Input force  (your effort)'),
  ideal: L('Dorongan ideal untuk seimbang', 'Ideal input for balance'),
  tauLoad: L('Torsi beban  W × d_out', 'Load torque  W × d_out'),
  tauEffort: L('Torsi dorongan  F × d_in', 'Effort torque  F × d_in'),
  tradeOff: L('Konsekuensi jarak', 'Distance trade-off'),
  statusTitle: L('Status', 'Status'),
  goal: L('Seimbangkan balok  (F×d_in = W×d_out)', 'Balance the beam  (F×d_in = W×d_out)'),
  goalDone: L('Seimbang! Doronganmu dikalikan', 'Balanced! The effort is multiplied'),
  balanced: L('SEIMBANG', 'BALANCED'),
  balancedSub: L(
    'F_in × d_in = F_out × d_out',
    'F_in × d_in = F_out × d_out',
  ),
  loadWins: L('BEBAN MENANG — lengannya turun', 'LOAD WINS — its arm is sinking'),
  effortWins: L('DORONGAN MENANG — beban terangkat', 'EFFORT WINS — the load is rising'),
  tradeOffText: L('input bergerak lebih jauh', 'input moves'),
  howTitle: L('Cara kerja tuas', 'How the lever works'),
  howBody: L(
    'Tuas berputar pada <b>tumpuan</b>. Setiap beban menghasilkan torsi <code>τ = F × d</code>. ' +
      'Balok seimbang ketika kedua torsi sama: <code>F_in × d_in = F_out × d_out</code>.<br><br>' +
      'Jadi mesin ini mengalikan gaya sebesar <code>MA = d_in / d_out</code>. ' +
      'Konsekuensinya: ujung doronganmu harus bergerak <code>MA</code> kali lebih jauh daripada beban — ' +
      'tidak ada mesin yang bisa menciptakan energi, hanya menukar jarak dengan gaya.',
    'A lever turns about the <b>fulcrum</b>. Each weight creates a torque <code>τ = F × d</code>. ' +
      'The beam balances when the two torques are equal: <code>F_in × d_in = F_out × d_out</code>.<br><br>' +
      'So the machine multiplies your force by <code>MA = d_in / d_out</code>. ' +
      'The catch: your end of the beam must travel <code>MA</code> times farther than the load — ' +
      'no machine can create energy, it only trades distance for force.',
  ),
  dimOut: L('d_out', 'd_out'),
  dimIn: L('d_in', 'd_in'),
  tryForce: L('Coba {n} N.', 'Try {n} N.'),
  liftPct: L(
    'Kamu mengangkat beban dengan hanya {p}% beratnya.',
    'You are lifting the load with only {p}% of its weight.',
  ),
}

interface Dim {
  root: THREE.Group
  line: THREE.Mesh
  tickA: THREE.Mesh
  tickB: THREE.Mesh
  label: ReturnType<typeof makeLabel>
  lastText: string
}

class LeverLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext
  private beam!: THREE.Group
  private crate!: THREE.Group
  private effortPod!: THREE.Group
  private arrowLoad!: ReturnType<typeof makeArrow>
  private arrowEffort!: ReturnType<typeof makeArrow>
  private maLabel!: ReturnType<typeof makeLabel>
  private dimLoad!: Dim
  private dimEffort!: Dim

  /* state */
  private W = 400
  private F = 100
  private dLoad = 1.5
  private dEffort = 3.0
  private tilt = 0
  private drag: { kind: 'load' | 'effort'; offset: number } | null = null
  private vizSig = ''
  private hudSig = ''

  /* panel widgets */
  private sW!: SliderHandle
  private sF!: SliderHandle
  private sDL!: SliderHandle
  private sDE!: SliderHandle
  private maNum!: HTMLElement
  private rOut!: Readout
  private rIn!: Readout
  private rIdeal!: Readout
  private rTauL!: Readout
  private rTauE!: Readout
  private rVR!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'lever-lab'
    this.build()
    this.applyDistances()
  }

  /* ------------------------------------------------------------- scene */
  private build(): void {
    const G = this.root

    const legMat = new THREE.MeshStandardMaterial({ color: 0x46536a, roughness: 0.6, metalness: 0.3 })
    const topMat = new THREE.MeshStandardMaterial({ color: 0x59677d, roughness: 0.55, metalness: 0.25 })

    const top = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.14, 2.7), topMat)
    top.position.set(0, BENCH_TOP - 0.07, 0)
    top.castShadow = true
    top.receiveShadow = true
    G.add(top)

    const legGeo = new THREE.BoxGeometry(0.22, BENCH_TOP - 0.14, 0.22)
    for (const [x, z] of [[-4.9, -1.05], [4.9, -1.05], [-4.9, 1.05], [4.9, 1.05]] as const) {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(x, (BENCH_TOP - 0.14) / 2, z)
      leg.castShadow = true
      leg.receiveShadow = true
      G.add(leg)
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.1, 0.14), legMat)
    rail.position.set(0, 0.42, -1.05)
    G.add(rail)

    /* fulcrum: a triangular prism with its apex at the pivot */
    const shape = new THREE.Shape()
    shape.moveTo(-0.55, 0)
    shape.lineTo(0.55, 0)
    shape.lineTo(0, 1.3)
    shape.closePath()
    const fulGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.62, bevelEnabled: false })
    fulGeo.translate(0, 0, -0.31)
    const fulcrum = new THREE.Mesh(
      fulGeo,
      new THREE.MeshStandardMaterial({ color: C.fulcrum, roughness: 0.5, metalness: 0.35 }),
    )
    fulcrum.position.set(0, BENCH_TOP, 0)
    fulcrum.castShadow = true
    fulcrum.receiveShadow = true
    G.add(fulcrum)

    /* the beam rotates about the pivot */
    this.beam = new THREE.Group()
    this.beam.position.set(0, PIVOT_Y, 0)
    G.add(this.beam)

    const beamMat = new THREE.MeshStandardMaterial({ color: C.beam, roughness: 0.4, metalness: 0.65 })
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.16, 0.5), beamMat)
    beam.castShadow = true
    beam.receiveShadow = true
    this.beam.add(beam)

    const tickMat = new THREE.MeshStandardMaterial({ color: 0x36414f, roughness: 0.6 })
    for (let x = -4; x <= 4; x++) {
      if (x === 0) continue
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.52), tickMat)
      tick.position.set(x, 0.09, 0)
      this.beam.add(tick)
    }
    const capMat = new THREE.MeshStandardMaterial({ color: 0x54637a, roughness: 0.5, metalness: 0.6 })
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.54), capMat)
      cap.position.set(s * (HALF - 0.03), 0, 0)
      cap.castShadow = true
      this.beam.add(cap)
    }
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.72, 16),
      new THREE.MeshStandardMaterial({ color: 0x8fa0b5, roughness: 0.3, metalness: 0.9 }),
    )
    pin.rotation.x = Math.PI / 2
    pin.castShadow = true
    this.beam.add(pin)

    this.crate = makeCrate(0.9, 0.9, 0.9, C.crate, { ring: true })
    this.crate.name = 'lever-crate'
    this.crate.position.set(this.dLoad, 0.53, 0)
    this.beam.add(this.crate)

    /* the push pad is the input force */
    this.effortPod = new THREE.Group()
    this.effortPod.name = 'lever-effort'
    this.beam.add(this.effortPod)
    const padMat = new THREE.MeshStandardMaterial({ color: 0x2fc7b6, roughness: 0.35, metalness: 0.5 })
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.14, 26), padMat)
    pad.position.set(0, 0.15, 0)
    pad.castShadow = true
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.024, 8, 30),
      new THREE.MeshStandardMaterial({ color: 0x0f6f66, roughness: 0.5, metalness: 0.6 }),
    )
    rim.rotation.x = Math.PI / 2
    rim.position.set(0, 0.15, 0)
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x9fb0c6, roughness: 0.35, metalness: 0.8 }),
    )
    handle.position.set(0, 0.27, 0)
    handle.castShadow = true
    this.effortPod.add(pad, rim, handle)
    this.effortPod.position.set(-this.dEffort, 0, 0)

    this.arrowLoad = makeArrow(C.output, { labelSide: -0.95 })
    this.arrowEffort = makeArrow(C.input, { labelSide: 0.95 })
    G.add(this.arrowLoad, this.arrowEffort)

    this.maLabel = makeLabel('MA = 2.00', {
      color: C.input,
      size: 54,
      scale: 0.0052,
      border: 'rgba(56,214,196,0.8)',
    })
    this.maLabel.position.set(0, PIVOT_Y + 1.55, 0)
    G.add(this.maLabel)

    this.dimLoad = this.makeDim()
    this.dimEffort = this.makeDim()
    G.add(this.dimLoad.root, this.dimEffort.root)
  }

  private makeDim(): Dim {
    const root = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: 0x8fa3bd })
    const lineGeo = new THREE.BoxGeometry(1, 0.035, 0.05)
    lineGeo.translate(0.5, 0, 0)
    const line = new THREE.Mesh(lineGeo, mat)
    const tickGeo = new THREE.BoxGeometry(0.05, 0.26, 0.05)
    const tickA = new THREE.Mesh(tickGeo, mat)
    const tickB = new THREE.Mesh(tickGeo, mat)
    const label = makeLabel('', { color: C.neutral, size: 34, scale: 0.0048 })
    root.add(line, tickA, tickB, label)
    root.position.set(0, BENCH_TOP + 0.02, 1.15)
    return { root, line, tickA, tickB, label, lastText: '' }
  }

  private syncDim(dim: Dim, d: number, sign: number, text: string, labelY: number): void {
    dim.line.scale.x = Math.max(0.05, d)
    dim.line.position.x = 0
    dim.tickA.position.x = 0
    dim.tickB.position.x = sign * d
    const mid = sign * d * 0.5
    if (dim.lastText !== text) {
      dim.lastText = text
      dim.label.userData.setText(text)
    }
    dim.label.position.set(mid, labelY, 0.05)
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    const setup = panel.section(t(S.setup))

    this.sW = setup.slider({
      label: t(S.loadW),
      min: 50,
      max: 1000,
      step: 10,
      value: this.W,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.W = v; this.ctx.invalidate() },
    })
    this.sF = setup.slider({
      label: t(S.effortF),
      min: 0,
      max: 1000,
      step: 5,
      value: this.F,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.F = v; this.ctx.invalidate() },
    })
    this.sDL = setup.slider({
      label: t(S.armOut),
      min: D_MIN,
      max: D_MAX,
      step: 0.05,
      value: this.dLoad,
      format: (v) => `${num(v, 2)} m`,
      onInput: (v) => { this.dLoad = v; this.applyDistances() },
    })
    this.sDE = setup.slider({
      label: t(S.armIn),
      min: D_MIN,
      max: D_MAX,
      step: 0.05,
      value: this.dEffort,
      format: (v) => `${num(v, 2)} m`,
      onInput: (v) => { this.dEffort = v; this.applyDistances() },
    })

    const actions = setup.el('div', 'row-2')
    const balanceBtn = setup.el('button', 'btn btn-primary', t(S.balance))
    const resetBtn = setup.el('button', 'btn btn-ghost', t(S.reset))
    balanceBtn.addEventListener('click', () => this.balance())
    resetBtn.addEventListener('click', () => this.reset())
    actions.append(balanceBtn, resetBtn)

    /* measurements */
    const meas = panel.section(t(S.measurements))

    const badge = meas.el('div', 'ma-badge')
    const info = meas.el('div', 'ma-info')
    info.innerHTML =
      `<div class="lbl">${t(S.maLabel)}</div>` +
      `<div class="formula">${t(S.maFormula)}</div>`
    this.maNum = meas.el('div', 'num', '2.00')
    badge.append(info, this.maNum)
    meas.el('div', 'hr')
    this.rOut = meas.readout(t(S.outForce))
    this.rIn = meas.readout(t(S.inForce))
    this.rIdeal = meas.readout(t(S.ideal))
    meas.el('div', 'hr')
    this.rTauL = meas.readout(t(S.tauLoad))
    this.rTauE = meas.readout(t(S.tauEffort))
    this.rVR = meas.readout(t(S.tradeOff))

    /* status */
    const st = panel.section(t(S.statusTitle))
    this.status = st.status()
    this.goal = st.goal(t(S.goal))

    /* explanation */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)
  }

  /* ------------------------------------------------------------ actions */
  private balance(): void {
    const v = clamp(Math.round((this.W * this.dLoad) / this.dEffort / 5) * 5, 0, 1000)
    this.F = v
    this.sF.set(v)
    this.ctx.invalidate()
  }

  private reset(): void {
    this.W = 400
    this.F = 100
    this.dLoad = 1.5
    this.dEffort = 3.0
    this.sW.set(this.W)
    this.sF.set(this.F)
    this.sDL.set(this.dLoad)
    this.sDE.set(this.dEffort)
    this.applyDistances()
  }

  private applyDistances(): void {
    this.crate.position.x = this.dLoad
    this.effortPod.position.x = -this.dEffort
    this.sDL?.set(this.dLoad)
    this.sDE?.set(this.dEffort)
    this.syncDim(this.dimLoad, this.dLoad, 1, `${t(S.dimOut)} = ${num(this.dLoad, 2)} m`, 0.32)
    this.syncDim(this.dimEffort, this.dEffort, -1, `${t(S.dimIn)} = ${num(this.dEffort, 2)} m`, 0.62)
    this.ctx.invalidate()
  }

  /* ---------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.crate, this.effortPod])
    if (!hits.length) return false
    const kind: 'load' | 'effort' = isInside(hits[0].object, this.crate) ? 'load' : 'effort'
    const zPlane = kind === 'load' ? 0.45 : 0
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, zPlane)
    if (!p) return false
    const local = rot2(p.x, p.y - PIVOT_Y, this.tilt)
    const pointerD = kind === 'load' ? local.x : -local.x
    const currentD = kind === 'load' ? this.dLoad : this.dEffort
    this.drag = { kind, offset: currentD - pointerD }
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag) {
      const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.crate, this.effortPod])
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const zPlane = this.drag.kind === 'load' ? 0.45 : 0
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, zPlane)
    if (!p) return
    const local = rot2(p.x, p.y - PIVOT_Y, this.tilt)
    const pointerD = (this.drag.kind === 'load' ? local.x : -local.x) + this.drag.offset
    const d = clamp(pointerD, D_MIN, D_MAX)
    if (this.drag.kind === 'load') {
      this.dLoad = d
      this.sDL.set(d)
    } else {
      this.dEffort = d
      this.sDE.set(d)
    }
    this.applyDistances()
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    const tauLoad = this.W * this.dLoad
    const tauEff = this.F * this.dEffort
    const net = tauLoad - tauEff

    const target = TILT_MAX * tanh(net / 300)
    const prevTilt = this.tilt
    this.tilt = smooth(this.tilt, target, dt, 4.5)
    this.beam.rotation.z = -this.tilt

    const viz = `${this.W}|${this.F}|${this.dLoad.toFixed(2)}|${this.dEffort.toFixed(2)}`
    let dirty = viz !== this.vizSig || Math.abs(this.tilt - prevTilt) > 1.5e-4
    this.vizSig = viz

    /* the arrow tips land on the object each arrow describes */
    const loadLocal = rot2(this.dLoad, 0.53, -this.tilt)
    const loadWorld = new THREE.Vector3(loadLocal.x, PIVOT_Y + loadLocal.y, 0)
    const lOut = 0.55 + 1.3 * Math.min(1, this.W / 800)
    this.arrowLoad.set(
      new THREE.Vector3(loadWorld.x, loadWorld.y + 0.45 + 0.14 + lOut, 0),
      new THREE.Vector3(0, -1, 0),
      lOut,
    )

    const effLocal = rot2(-this.dEffort, 0.34, -this.tilt)
    const effWorld = new THREE.Vector3(effLocal.x, PIVOT_Y + effLocal.y, 0)
    const lIn = this.F < 5 ? 0 : 0.5 + 1.5 * Math.min(1, this.F / 800)
    this.arrowEffort.set(
      new THREE.Vector3(effWorld.x, effWorld.y + 0.12 + lIn, 0),
      new THREE.Vector3(0, -1, 0),
      lIn,
    )

    this.arrowLoad.userData.setLabel(`F_out = ${num(this.W, 0)} N`)
    this.arrowEffort.userData.setLabel(`F_in = ${num(this.F, 0)} N`)
    this.maLabel.userData.setText(`MA = ${num(this.dEffort / this.dLoad, 2)} ×`)

    this.syncHud(false, net, tauLoad, tauEff)
    return dirty
  }

  private syncHud(force: boolean, net?: number, tauLoad?: number, tauEff?: number): void {
    if (net === undefined) {
      tauLoad = this.W * this.dLoad
      tauEff = this.F * this.dEffort
      net = tauLoad - tauEff
    }
    const ma = this.dEffort / this.dLoad
    const balanced = Math.abs(net) < Math.max(2, 0.02 * Math.max(tauLoad!, tauEff!))
    const sig = `${this.W}|${this.F}|${this.dLoad.toFixed(2)}|${this.dEffort.toFixed(2)}|${balanced}`
    if (!force && sig === this.hudSig) return
    this.hudSig = sig

    this.maNum.textContent = num(ma, 2)
    this.rOut.set(`${num(this.W, 0)} N`, 'output')
    this.rIn.set(`${num(this.F, 0)} N`, 'input')
    this.rIdeal.set(`${num(this.W / ma, 0)} N`, 'neutral')
    this.rTauL.set(`${num(tauLoad!, 0)} N·m`, 'output')
    this.rTauE.set(`${num(tauEff!, 0)} N·m`, 'input')
    this.rVR.set(`${t(S.tradeOffText)} ${num(ma, 2)}×`, 'neutral')

    if (balanced) {
      this.status.set(
        `${t(S.balanced)}<span class="sub">${t(S.balancedSub)} &nbsp;→&nbsp; ` +
          `${num(this.F * this.dEffort, 0)} N·m = ${num(this.W * this.dLoad, 0)} N·m</span>`,
        'result',
      )
      this.goal.setDone(true, `${t(S.goalDone)} ${num(ma, 2)}×`)
    } else if (net > 0) {
      this.status.set(
        `${t(S.loadWins)}<span class="sub">${t(S.tauLoad)} ${num(tauLoad!, 0)} N·m &nbsp;&gt;&nbsp; ` +
          `${t(S.tauEffort)} ${num(tauEff!, 0)} N·m. ` +
          `${tf(S.tryForce, { n: num(this.W / ma, 0) })}</span>`,
        'warn',
      )
      this.goal.setDone(false)
    } else {
      this.status.set(
        `${t(S.effortWins)}<span class="sub">${t(S.tauEffort)} ${num(tauEff!, 0)} N·m &nbsp;&gt;&nbsp; ` +
          `${t(S.tauLoad)} ${num(tauLoad!, 0)} N·m. ` +
          `${tf(S.liftPct, { p: num((100 * this.F) / this.W, 0) })}</span>`,
        'result',
      )
      this.goal.setDone(false)
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return { W: this.W, F: this.F, dLoad: this.dLoad, dEffort: this.dEffort }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, number>
    if (typeof s.W === 'number') this.W = s.W
    if (typeof s.F === 'number') this.F = s.F
    if (typeof s.dLoad === 'number') this.dLoad = s.dLoad
    if (typeof s.dEffort === 'number') this.dEffort = s.dEffort
    this.sW?.set(this.W)
    this.sF?.set(this.F)
    this.applyDistances()
    this.syncHud(true)
  }

  dispose(): void {
    disposeObject(this.root)
  }
}

export default function createLeverLab(ctx: LabContext): LabInstance {
  return new LeverLab(ctx)
}
