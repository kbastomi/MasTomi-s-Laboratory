import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { G, clamp } from '../../core/math'
import type {
  GoalHandle,
  LabContext,
  LabInstance,
  PanelContext,
  Readout,
  SliderHandle,
  StatusHandle,
} from '../../core/lab'
import { C, disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { Plot } from '../../kit/plot'
import { hover, pick, rayPlaneZ } from '../../kit/picking'

/* ------------------------------------------------------------------ scene */
const RAMP_LEN = 6.4
const RAMP_THICK = 0.28
const BLOCK = 0.85

/* ------------------------------------------------------------------ texts */
const S = {
  setup: L('Penyiapan — bidang miring', 'Setup — the ramp'),
  angle: L('Kemiringan  θ', 'Slope angle  θ'),
  friction: L('Koefisien gesek  μ', 'Friction coefficient  μ'),
  loadW: L('Berat kotak  W', 'Box weight  W'),
  pushF: L('Gaya dorong sejajar  F', 'Push force along the slope  F'),
  pushBtn: L('↑ Lepaskan dengan dorongan', '↑ Release with the push'),
  releaseBtn: L('▶ Lepaskan tanpa dorongan', '▶ Release without pushing'),
  resetBtn: L('↺ Atur ulang', '↺ Reset'),
  measurements: L('Pengukuran', 'Measurements'),
  normal: L('Gaya normal  N', 'Normal force  N'),
  frictionF: L('Gaya gesek  f', 'Friction force  f'),
  alongPlane: L('Komponen berat sejajar  W sin θ', 'Weight along the slope  W sin θ'),
  net: L('Resultan  F − W sin θ', 'Resultant  F − W sin θ'),
  netTotal: L('Gaya bersih (termasuk gesek)', 'Net force (including friction)'),
  accel: L('Percepatan  a', 'Acceleration  a'),
  speed: L('Kecepatan  v', 'Speed  v'),
  height: L('Tinggi  h = L sin θ', 'Height  h = L sin θ'),
  maLabel: L('KEUNTUNGAN MEKANIS', 'MECHANICAL ADVANTAGE'),
  maFormula: L('MA = panjang bidang ÷ tinggi', 'MA = slope length ÷ height'),
  win: L('Usaha dorong  F × Δs', 'Push work  F × Δs'),
  wout: L('Usaha gravitasi  W × Δh', 'Gravity work  W × Δh'),
  statusTitle: L('Status', 'Status'),
  goal: L('Dorong kotak naik bidang miring', 'Push the box up the ramp'),
  goalDone: L(
    'Kotak naik! Dorongan {p} N melawan berat {w} N.',
    'Box is up! Your push of {p} N against a {w} N weight.',
  ),
  idle: L('DIAM — kotak ditahan di tempat', 'AT REST — the box is held'),
  sliding: L('BERGERAK', 'MOVING'),
  blocked: L('TERTAHAN — gesekan menahan kotak', 'HELD — friction is holding the box'),
  maTooSmall: L('Keuntungan mekanis bidang miring =', 'The ramp’s mechanical advantage is'),
  idleSub: L(
    'dorongan {a} N sudah cukup untuk melawan gaya gesek {f} N.',
    'a push of {a} N is enough to overcome the friction force of {f} N.',
  ),
  blockedSub: L(
    'gaya pendorong {d} N ≤ gaya gesek {f} N.',
    'the driving force {d} N ≤ the friction force {f} N.',
  ),
  moving: L('BERGERAK — {dir}', 'MOVING — {dir}'),
  up: L('naik', 'up'),
  down: L('turun', 'down'),
  howTitle: L('Cara kerja bidang miring', 'How an inclined plane works'),
  howBody: L(
    'Bidang miring menukar gaya dengan jarak. Berat kotak <code>W</code> memiliki komponen ' +
      'sejajar bidang sebesar <code>W sin θ</code> — inilah gaya yang benar-benar meluncurkannya. ' +
      'Komponen tegak lurus bidang <code>N = W cos θ</code> menekan kotak ke bidang, dan gesekan ' +
      'sebesar <code>f = μN</code> melawan gerak.<br><br>' +
      'Karena itu <code>MA = L / h = 1 / sin θ</code>: bidang yang landai memberi keuntungan besar, ' +
      'tapi kamu harus mendorong sejauh L untuk mengangkat setinggi h. <b>Kerja masuk tetap sama dengan kerja keluar</b> ' +
      '— mesin tidak pernah mengubah energi, hanya bentuknya.',
    'An inclined plane trades force for distance. The box’s weight <code>W</code> has a component ' +
      'along the slope of <code>W sin θ</code> — that is the force actually sliding it down. ' +
      'The perpendicular component <code>N = W cos θ</code> presses the box into the ramp, and friction ' +
      'of <code>f = μN</code> opposes the motion.<br><br>' +
      'So <code>MA = L / h = 1 / sin θ</code>: a shallow ramp gives a big advantage, but you must push ' +
      'a distance L to raise it by h. <b>Input work always equals output work</b> — a machine never ' +
      'changes energy, only its form.',
  ),
}

class InclineLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext
  private rampGroup = new THREE.Group()
  private block!: THREE.Group
  private arrowGravity!: ReturnType<typeof makeArrow>
  private arrowNormal!: ReturnType<typeof makeArrow>
  private arrowFriction!: ReturnType<typeof makeArrow>
  private arrowPush!: ReturnType<typeof makeArrow>
  private heightLabel!: ReturnType<typeof makeLabel>
  private maLabelSprite!: ReturnType<typeof makeLabel>

  /* state */
  private thetaDeg = 25
  private mu = 0.2
  private W = 300
  private push = 0
  private s = 0
  private v = 0
  private held = true
  private plot!: Plot
  private trace: { x: number; y: number }[] = []
  private simTime = 0
  private hudSig = ''
  /** where the box was when it was let go — the work is measured from here */
  private s0 = 0

  /* panel */
  private sAngle!: SliderHandle
  private sMu!: SliderHandle
  private sW!: SliderHandle
  private sPush!: SliderHandle
  private maNum!: HTMLElement
  private rNormal!: Readout
  private rFriction!: Readout
  private rAlong!: Readout
  private rNet!: Readout
  private rNetTotal!: Readout
  private rAccel!: Readout
  private rSpeed!: Readout
  private rHeight!: Readout
  private rWin!: Readout
  private rWout!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle
  private pushBtn!: HTMLButtonElement

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'incline-lab'
    this.build()
    this.applyGeometry()
  }

  private get theta(): number {
    return (this.thetaDeg * Math.PI) / 180
  }

  private get mass(): number {
    return this.W / G
  }

  /* -------------------------------------------------------------- scene */
  private build(): void {
    const G_ = this.root

    /* the ramp: a slab, pivoted at its lower end */
    this.rampGroup = new THREE.Group()
    G_.add(this.rampGroup)

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(RAMP_LEN, RAMP_THICK, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x59677d, roughness: 0.6, metalness: 0.2 }),
    )
    slab.position.set(RAMP_LEN / 2, 0, 0)
    slab.castShadow = true
    slab.receiveShadow = true
    this.rampGroup.add(slab)

    /* side rails so the box does not look like it is floating */
    for (const z of [-0.78, 0.78]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(RAMP_LEN, 0.12, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x46536a, roughness: 0.55, metalness: 0.35 }),
      )
      rail.position.set(RAMP_LEN / 2, RAMP_THICK / 2 + 0.05, z)
      rail.castShadow = true
      this.rampGroup.add(rail)
    }

    /* the hinge post at the bottom */
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.45, metalness: 0.7 }),
    )
    post.position.set(0, 0.3, 0)
    post.castShadow = true
    G_.add(post)

    /* the box */
    this.block = new THREE.Group()
    this.block.name = 'incline-block'
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK),
      new THREE.MeshStandardMaterial({ color: C.crate, roughness: 0.8, metalness: 0.05 }),
    )
    body.castShadow = true
    body.receiveShadow = true
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x241a0c, transparent: true, opacity: 0.55 }),
    )
    this.block.add(body, edges)
    G_.add(this.block)

    /* arrows */
    this.arrowGravity = makeArrow(C.output, { labelSide: -0.8 })
    this.arrowNormal = makeArrow(C.neutral, { labelSide: 0.8 })
    this.arrowFriction = makeArrow('#ff6b6b', { labelSide: 0.8 })
    this.arrowPush = makeArrow(C.input, { labelSide: 0.8 })
    G_.add(this.arrowGravity, this.arrowNormal, this.arrowFriction, this.arrowPush)

    this.heightLabel = makeLabel('', { color: C.neutral, size: 34, scale: 0.0044 })
    this.maLabelSprite = makeLabel('', {
      color: C.input,
      size: 44,
      scale: 0.0048,
      border: 'rgba(56,214,196,0.8)',
    })
    G_.add(this.heightLabel, this.maLabelSprite)
  }

  /** Rebuild the scene for the current angle and position. */
  private applyGeometry(): void {
    const th = this.theta
    this.rampGroup.rotation.z = th

    /* place the box on the ramp surface */
    const half = BLOCK / 2
    const along = clamp(this.s, half + 0.05, RAMP_LEN - half - 0.05)
    const x = along * Math.cos(th)
    const y = RAMP_THICK / 2 + half + along * Math.sin(th)
    this.block.position.set(x, y, 0)
    this.block.rotation.z = th

    const height = RAMP_LEN * Math.sin(th)
    this.heightLabel.userData.setText(`h = ${num(height, 2)} m`)
    this.heightLabel.position.set(RAMP_LEN * Math.cos(th) * 0.52, height + 0.55, 1.05)

    const ma = 1 / Math.max(0.08, Math.sin(th))
    this.maLabelSprite.userData.setText(`MA = ${num(ma, 2)} ×`)
    this.maLabelSprite.position.set(RAMP_LEN * Math.cos(th) * 0.22, height + 0.55, 1.05)
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    const setup = panel.section(t(S.setup))

    this.sAngle = setup.slider({
      label: t(S.angle),
      min: 5,
      max: 60,
      step: 1,
      value: this.thetaDeg,
      format: (v) => `${num(v, 0)}°`,
      onInput: (v) => { this.thetaDeg = v; this.applyGeometry(); this.ctx.invalidate() },
    })
    this.sMu = setup.slider({
      label: t(S.friction),
      min: 0,
      max: 0.6,
      step: 0.01,
      value: this.mu,
      format: (v) => num(v, 2),
      onInput: (v) => { this.mu = v; this.ctx.invalidate() },
    })
    this.sW = setup.slider({
      label: t(S.loadW),
      min: 50,
      max: 800,
      step: 10,
      value: this.W,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.W = v; this.ctx.invalidate() },
    })
    this.sPush = setup.slider({
      label: t(S.pushF),
      min: 0,
      max: 800,
      step: 10,
      value: this.push,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.push = v; this.ctx.invalidate() },
    })

    const actions = setup.el('div', 'row-2')
    this.pushBtn = setup.el('button', 'btn btn-primary', t(S.pushBtn))
    const releaseBtn = setup.el('button', 'btn', t(S.releaseBtn))
    const resetBtn = setup.el('button', 'btn btn-ghost', t(S.resetBtn))
    this.pushBtn.addEventListener('click', () => this.pushUp())
    releaseBtn.addEventListener('click', () => this.release())
    resetBtn.addEventListener('click', () => this.reset())
    actions.append(this.pushBtn, releaseBtn, resetBtn)

    const meas = panel.section(t(S.measurements))
    const badge = meas.el('div', 'ma-badge')
    const info = meas.el('div', 'ma-info')
    info.innerHTML =
      `<div class="lbl">${t(S.maLabel)}</div>` +
      `<div class="formula">${t(S.maFormula)}</div>`
    this.maNum = meas.el('div', 'num', '2.37')
    badge.append(info, this.maNum)
    meas.el('div', 'hr')

    this.rNormal = meas.readout(t(S.normal))
    this.rFriction = meas.readout(t(S.frictionF))
    this.rAlong = meas.readout(t(S.alongPlane))
    this.rNet = meas.readout(t(S.net))
    this.rNetTotal = meas.readout(t(S.netTotal))
    this.rAccel = meas.readout(t(S.accel))
    this.rSpeed = meas.readout(t(S.speed))
    this.rHeight = meas.readout(t(S.height))
    meas.el('div', 'hr')
    this.rWin = meas.readout(t(S.win))
    this.rWout = meas.readout(t(S.wout))

    const graph = panel.section(t(S.measurements))
    this.plot = new Plot(graph.host, {
      title: 'v – t',
      xLabel: 't (s)',
      yLabel: 'v (m/s)',
      height: 140,
    })
    this.plot.setXRange(0, 8)
    this.plot.setYRange(0, 8)

    const st = panel.section(t(S.statusTitle))
    this.status = st.status()
    this.goal = st.goal(t(S.goal))

    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)
  }

  /* ------------------------------------------------------------ actions */
  private pushUp(): void {
    this.held = false
    this.s0 = this.s
    this.ctx.invalidate()
  }

  private release(): void {
    this.held = false
    this.push = 0
    this.sPush.set(0)
    this.s0 = this.s
    this.ctx.invalidate()
  }

  private reset(): void {
    this.s = 0
    this.s0 = 0
    this.v = 0
    this.held = true
    this.push = 0
    this.simTime = 0
    this.trace = []
    this.sPush.set(0)
    this.applyGeometry()
    this.plot.setSeries([{ name: 'v', color: C.lift, points: [] }])
    this.syncHud(true)
  }

  /* --------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.block])
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return false
    // place the box where it was grabbed
    const along = (p.x * Math.cos(this.theta) + p.y * Math.sin(this.theta))
    this.s = clamp(along, BLOCK / 2 + 0.05, RAMP_LEN - BLOCK / 2 - 0.05)
    this.v = 0
    this.held = true
    this.applyGeometry()
    this.ctx.invalidate()
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.held) return
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.block])
    hover(this.ctx.dom, hits.length > 0)
  }

  onPointerUp(): void {
    /* nothing to release */
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    const th = this.theta
    const m = this.mass
    const n = this.W * Math.cos(th)
    const alongGravity = this.W * Math.sin(th)

    let dirty = false

    /* ---------------------------------------------------------------------
       Sign convention: **positive is UP the slope**.
         drive = F_push − W·sinθ      the applied forces, before friction
         net  = drive − friction      the true resultant along the slope
       so `s` (position) and `v` (velocity) are both up-slope positive and
       everything is consistent with the direction the student is pushing.
       --------------------------------------------------------------------- */
    const drive = this.push - alongGravity
    const fMax = this.mu * n

    if (!this.held) {
      /* fixed-step integration keeps the motion smooth and reproducible */
      const steps = Math.min(8, Math.max(1, Math.ceil(dt / (1 / 120))))
      const h = dt / steps
      for (let i = 0; i < steps; i++) {
        const moving = Math.abs(this.v) > 1e-3
        let net: number
        if (moving) {
          /* kinetic friction opposes the motion */
          net = drive - Math.sign(this.v) * fMax
        } else if (Math.abs(drive) <= fMax) {
          /* static friction holds the box — nothing moves */
          net = 0
          this.v = 0
        } else {
          /* the drive beats the friction — the box starts to slide */
          net = drive - Math.sign(drive) * fMax
        }

        const a = net / m
        this.v += a * h
        if (Math.abs(this.v) < 1e-4) this.v = 0
        this.s += this.v * h
        this.simTime += h

        if (this.s <= 0) {
          this.s = 0
          if (this.v < 0) this.v = 0
        }
        if (this.s >= RAMP_LEN - BLOCK) {
          this.s = RAMP_LEN - BLOCK
          if (this.v > 0) this.v = 0
        }
      }
      dirty = true

      /* keep a short velocity trace for the graph */
      if (this.trace.length === 0 || this.simTime - this.trace[this.trace.length - 1].x > 0.08) {
        this.trace.push({ x: this.simTime, y: Math.abs(this.v) })
        if (this.trace.length > 220) this.trace.shift()
        this.plot.setSeries([{ name: 'v', color: C.lift, points: this.trace }])
      }
    }

    this.applyGeometry()

    /* arrows — a clean four-force diagram: weight, normal, friction, push */
    const bp = this.block.position
    const along = new THREE.Vector3(Math.cos(th), Math.sin(th), 0)
    const normal = new THREE.Vector3(-Math.sin(th), Math.cos(th), 0)

    const lW = 0.55 + 1.15 * Math.min(1, this.W / 800)
    this.arrowGravity.set(
      bp.clone().add(new THREE.Vector3(0, 0.72, 0.85)),
      new THREE.Vector3(0, -1, 0),
      lW,
    )
    this.arrowGravity.userData.setLabel(`W = ${num(this.W, 0)} N`)

    const lN = 0.4 + 1.0 * Math.min(1, n / 800)
    this.arrowNormal.set(bp.clone().add(normal.clone().multiplyScalar(0.62)), normal, lN)
    this.arrowNormal.userData.setLabel(`N = ${num(n, 0)} N`)

    /* friction opposes the tendency of motion:
       at rest it opposes the drive, while moving it opposes the velocity */
    const moving = Math.abs(this.v) > 1e-3
    const fDir = moving ? -Math.sign(this.v) : (drive === 0 ? 1 : -Math.sign(drive))
    const fActual = moving ? this.mu * n : Math.min(this.mu * n, Math.abs(drive))
    const lF = 0.3 + 0.9 * Math.min(1, fActual / 600)
    this.arrowFriction.set(
      bp.clone()
        .add(along.clone().multiplyScalar(fDir * 0.95))
        .add(new THREE.Vector3(0, -0.22, 0.85)),
      along.clone().multiplyScalar(fDir),
      fActual > 0.5 ? lF : 0,
    )
    this.arrowFriction.userData.setLabel(`f = ${num(fActual, 0)} N`)

    const lP = this.push > 1 ? 0.4 + 1.1 * Math.min(1, this.push / 800) : 0
    this.arrowPush.set(
      bp.clone()
        .add(along.clone().multiplyScalar(0.95))
        .add(new THREE.Vector3(0, -0.22, -0.85)),
      along.clone(),
      lP,
    )
    this.arrowPush.userData.setLabel(`F = ${num(this.push, 0)} N`)

    this.syncHud(false, n, alongGravity)
    return dirty
  }

  private syncHud(force: boolean, n?: number, alongGravity?: number): void {
    const th = this.theta
    if (n === undefined) n = this.W * Math.cos(th)
    if (alongGravity === undefined) alongGravity = this.W * Math.sin(th)

    const m = this.mass
    const fMax = this.mu * n
    /* positive is UP the slope, everywhere */
    const drive = this.push - alongGravity
    const moving = Math.abs(this.v) > 1e-3
    const fActual = moving ? fMax : Math.min(fMax, Math.abs(drive))
    const fSign = moving ? -Math.sign(this.v) : (drive === 0 ? 0 : -Math.sign(drive))
    const net = drive + fSign * fActual
    const a = moving ? net / m : 0
    const height = RAMP_LEN * Math.sin(th)
    const ma = 1 / Math.max(0.08, Math.sin(th))
    const ds = this.s - this.s0

    const sig = `${this.thetaDeg}|${this.mu}|${this.W}|${this.push}|${this.s.toFixed(2)}|${this.v.toFixed(2)}|${this.held}`
    if (!force && sig === this.hudSig) return
    this.hudSig = sig

    this.maNum.textContent = num(ma, 2)
    this.rNormal.set(`${num(n, 0)} N`, 'neutral')
    this.rFriction.set(
      `${num(fActual, 0)} N${fSign > 0 ? '  ↑' : fSign < 0 ? '  ↓' : ''}`,
      'neutral',
    )
    this.rAlong.set(`${num(alongGravity, 0)} N  ↓`, 'output')
    this.rNet.set(`${num(drive, 0)} N`, drive > 0 ? 'input' : drive < 0 ? 'output' : 'neutral')
    this.rNetTotal.set(`${num(net, 0)} N`, net > 0 ? 'input' : net < 0 ? 'output' : 'neutral')
    this.rAccel.set(`${num(a, 2)} m/s²`, 'neutral')
    this.rSpeed.set(`${num(Math.abs(this.v), 2)} m/s`, 'neutral')
    this.rHeight.set(`${num(height, 2)} m`, 'neutral')
    this.rWin.set(`${num(this.push * ds, 0)} J`, 'input')
    this.rWout.set(`${num(this.W * ds * Math.sin(th), 0)} J`, 'output')

    if (this.held) {
      this.status.set(
        `${t(S.idle)}<span class="sub">${t(S.maTooSmall)} ${num(ma, 2)} × — ` +
          `${tf(S.idleSub, {
            a: num(this.W * Math.sin(th), 0),
            f: num(fMax, 0),
          })}</span>`,
        'neutral',
      )
      this.goal.setDone(false)
    } else if (!moving && Math.abs(drive) <= fMax) {
      this.status.set(
        `${t(S.blocked)}<span class="sub">${tf(S.blockedSub, {
          d: num(Math.abs(drive), 0),
          f: num(fMax, 0),
        })}</span>`,
        'warn',
      )
      this.goal.setDone(false)
    } else {
      const rising = this.v > 0
      this.status.set(
        tf(S.moving, { dir: rising ? t(S.up) : t(S.down) }) +
          `<span class="sub">a = ${num(a, 2)} m/s², v = ${num(Math.abs(this.v), 2)} m/s, ` +
          `s = ${num(this.s, 2)} m</span>`,
        'result',
      )
      if (this.s > 0.5) {
        this.goal.setDone(true, tf(S.goalDone, { p: num(this.push, 0), w: num(this.W, 0) }))
      } else {
        this.goal.setDone(false)
      }
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return {
      thetaDeg: this.thetaDeg,
      mu: this.mu,
      W: this.W,
      push: this.push,
      s: this.s,
      v: this.v,
      held: this.held,
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, number | boolean>
    if (typeof s.thetaDeg === 'number') this.thetaDeg = s.thetaDeg
    if (typeof s.mu === 'number') this.mu = s.mu
    if (typeof s.W === 'number') this.W = s.W
    if (typeof s.push === 'number') this.push = s.push
    if (typeof s.s === 'number') this.s = s.s
    if (typeof s.v === 'number') this.v = s.v
    if (typeof s.held === 'boolean') this.held = s.held

    this.sAngle?.set(this.thetaDeg)
    this.sMu?.set(this.mu)
    this.sW?.set(this.W)
    this.sPush?.set(this.push)
    this.applyGeometry()
    this.syncHud(true)
  }

  dispose(): void {
    this.plot?.dispose()
    disposeObject(this.root)
  }
}

export default function createInclineLab(ctx: LabContext): LabInstance {
  return new InclineLab(ctx)
}
