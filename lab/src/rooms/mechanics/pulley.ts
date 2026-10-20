import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp } from '../../core/math'
import type {
  GoalHandle,
  LabContext,
  LabInstance,
  PanelContext,
  Readout,
  SegmentedHandle,
  SliderHandle,
  StatusHandle,
} from '../../core/lab'
import { C, disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { makeCrate, makePlate, makeSheave, Rope } from '../../kit/objects'
import { hover, pick, rayPlaneZ } from '../../kit/picking'

/* ------------------------------------------------------------------ scene */
const P_R = 0.42
const P_S = 0.84
const P_TOP_Y = 5.5
const P_BEAM_BOTTOM = 6.35
const P_TAIL0 = 1.6

/* ------------------------------------------------------------------ texts */
const S = {
  system: L('Sistem katrol', 'Pulley system'),
  fixed: L('Tetap', 'Fixed'),
  movable: L('Bergerak', 'Movable'),
  tackle: L('Blok & tali', 'Blk & tkl'),
  rig: L('Konfigurasi', 'Rig'),
  setup: L('Penyiapan — beban & tarikan', 'Setup — load & effort'),
  loadW: L('Berat beban  W  (keluaran)', 'Load weight  W  (output)'),
  pullF: L('Gaya tarikan  F  (masukan)', 'Pull force  F  (input)'),
  idealBtn: L('≈ Dorongan ideal', '≈ Set ideal effort'),
  reset: L('↺ Atur ulang', '↺ Reset'),
  measurements: L('Pengukuran', 'Measurements'),
  maLabel: L('KEUNTUNGAN MEKANIS', 'MECHANICAL ADVANTAGE'),
  maFormula: L('MA = untai tali penahan beban', 'MA = strands holding the load'),
  outForce: L('Gaya keluar  (beban)', 'Output force  (the load)'),
  inForce: L('Gaya masuk  (tarikanmu)', 'Input force  (your pull)'),
  idealIn: L('Dorongan ideal  W / MA', 'Ideal input  W / MA'),
  lift: L('Tarikan ke atas  MA × F_in', 'Upward pull  MA × F_in'),
  pulled: L('Tali ditarik  MA × h', 'Rope pulled  MA × h'),
  lifted: L('Kotak terangkat  h', 'Crate lifted  h'),
  win: L('Usaha masuk  F × ditarik', 'Input work  F × pulled'),
  wout: L('Usaha keluar  W × h', 'Output work  W × h'),
  statusTitle: L('Status', 'Status'),
  goal: L('Angkat kotak 0,5 m dari lantai', 'Lift the crate 0.5 m off the ground'),
  goalDone: L('Terangkat 0,5 m dengan MA', 'Lifted 0.5 m with MA'),
  manual: L('TARIKAN MANUAL — sedang mengangkat tali', 'MANUAL PULL — you are hauling the rope'),
  onFloor: L('BEBAN DI LANTAI — dorongan terlalu kecil', 'LOAD SITS ON THE FLOOR — effort too small'),
  balanced: L('SEIMBANG', 'BALANCED'),
  balancedAt: L('SEIMBANG — melayang di', 'BALANCED — hovering at'),
  balancedRest: L('SEIMBANG dalam keadaan diam', 'BALANCED at rest'),
  rising: L('NAIK — masih ada sisa gaya', 'RISING — you have effort to spare'),
  sinking: L('TURUN — gaya tidak cukup', 'SINKING — not enough effort'),
  topReached: L('BATAS TERCAPAI — ketinggian maksimum rig ini', 'TOP REACHED — maximum height for this rig'),
  howTitle: L('Cara kerja katrol', 'How pulleys work'),
  howBody: L(
    'Setiap untai tali yang menahan beban membawa tegangan yang sama <code>T = F_in</code>. ' +
      'Dengan <b>n</b> untai, beban merasa <code>n × F_in</code>, jadi kamu hanya perlu ' +
      '<code>F_in = W / n</code> — inilah <b>keuntungan mekanis</b> <code>MA = n</code>.<br><br>' +
      'Harganya adalah jarak: kamu harus menarik <code>n ×</code> tali sepanjang naiknya beban, ' +
      'sehingga <code>F_in × ditarik = W × h</code>. Katrol tetap (MA 1) hanya mengubah arah tarikan; ' +
      'katrol bergerak menggandakan gaya; blok & tali menumpuk sheave untuk mengalikan lebih jauh lagi.',
    'Every rope strand that holds the load carries the same tension <code>T = F_in</code>. ' +
      'With <b>n</b> strands the load feels <code>n × F_in</code>, so you only need ' +
      '<code>F_in = W / n</code> — that is the <b>mechanical advantage</b> <code>MA = n</code>.<br><br>' +
      'The price is distance: you must pull <code>n ×</code> as much rope as the load rises, ' +
      'so <code>F_in × pulled = W × h</code>. A single fixed pulley (MA 1) changes only the ' +
      'direction of your pull; a movable pulley doubles your force; block &amp; tackle rigs stack ' +
      'sheaves to multiply it further.',
  ),
  rig1: L('1 sheave tetap', '1 fixed sheave'),
  rig2: L('1 sheave tetap + 1 bergerak', '1 fixed + 1 movable sheave'),
  rigN: L('{t} sheave tetap + {b} bergerak', '{t} fixed + {b} movable sheaves'),
  strands: L('{n} untai', '{n} strands'),
  manualSub: L(
    'ditarik {p} m tali → kotak terangkat {h} m (×{n} konsekuensi jarak)',
    'pulled {p} m of rope → crate lifted {h} m (×{n} distance trade-off)',
  ),
  floorSub: L(
    'butuh F_in ≥ W / MA = {w} / {n} = {i} N. Tiap untai hanya membawa {f} N.',
    'it needs F_in ≥ W / MA = {w} / {n} = {i} N. Each strand only carries {f} N.',
  ),
  balancedSub: L(
    'MA × F_in = {n} × {f} = {t} N = berat beban — sistem diam.',
    'MA × F_in = {n} × {f} = {t} N = the load weight — the system holds still.',
  ),
  risingSub: L(
    '{n} × {f} = {t} N vs beban {w} N ({p}%). Tarik {pu} m untuk {h} m kenaikan.',
    '{n} × {f} = {t} N vs {w} N load ({p}%). Pulled {pu} m for {h} m of lift.',
  ),
  sinkingSub: L(
    '{n} × {f} = {t} N belum cukup untuk {w} N. Naikkan F_in ke {i} N atau tambah untai.',
    '{n} × {f} = {t} N cannot hold {w} N. Increase F_in to {i} N or add strands.',
  ),
  topSub: L(
    'tali ditarik {p} m. MA lebih tinggi = kenaikan lebih kecil untuk tarikan yang sama.',
    'rope pulled {p} m. A higher MA lifts less far for the same pull.',
  ),
}

class PulleyLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext
  private crate!: THREE.Group
  private rig: THREE.Group | null = null
  private topBlock: THREE.Group | null = null
  private botBlock: THREE.Group | null = null
  private rope!: Rope
  private tail!: Rope
  private hook!: THREE.Group
  private spinTop: THREE.Group[] = []
  private spinBot: THREE.Group[] = []
  private xs: number[] = []
  private topCenters: number[] = []
  private botCenters: number[] = []
  private topCount = 0
  private botCount = 0

  private arrowLoad!: ReturnType<typeof makeArrow>
  private arrowInput!: ReturnType<typeof makeArrow>
  private arrowLift!: ReturnType<typeof makeArrow>
  private strandLabel!: ReturnType<typeof makeLabel>

  /* state */
  private n = 3
  private W = 600
  private F = 100
  private h = 0
  private drag: { y0: number; h0: number } | null = null
  private liftedOnce = false
  private lastH = -1
  private rigDirty = true
  private vizSig = ''
  private hudSig = ''

  /* panel */
  private seg!: SegmentedHandle
  private rRig!: Readout
  private sW!: SliderHandle
  private sF!: SliderHandle
  private maNum!: HTMLElement
  private rOut!: Readout
  private rIn!: Readout
  private rIdeal!: Readout
  private rLift!: Readout
  private rPull!: Readout
  private rLiftH!: Readout
  private rWin!: Readout
  private rWout!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'pulley-lab'
    this.buildRoom()
    this.buildCrate()
    this.buildArrows()
    this.buildRig()
  }

  /* -------------------------------------------------------------- scene */
  private buildRoom(): void {
    const G = this.root
    const steel = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.45, metalness: 0.8 })

    const postGeo = new THREE.BoxGeometry(0.3, 6.35, 0.3)
    for (const x of [-3.4, 3.4]) {
      const post = new THREE.Mesh(postGeo, steel)
      post.position.set(x, 3.175, 0)
      post.castShadow = true
      post.receiveShadow = true
      G.add(post)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), steel)
      foot.position.set(x, 0.07, 0)
      foot.castShadow = true
      foot.receiveShadow = true
      G.add(foot)
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.3, 0.6), steel)
    beam.position.set(0, P_BEAM_BOTTOM + 0.15, 0)
    beam.castShadow = true
    beam.receiveShadow = true
    G.add(beam)

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.06, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x2a3546, roughness: 0.85 }),
    )
    pad.position.set(0, 0.03, 0)
    pad.receiveShadow = true
    G.add(pad)
  }

  private buildCrate(): void {
    this.crate = makeCrate(1.5, 1.1, 1.1, C.crate, { ring: true })
    this.root.add(this.crate)
    this.placeCrate()
  }

  private placeCrate(): void {
    this.crate.position.set(0, 0.55 + this.h, 0)
  }

  private buildArrows(): void {
    this.arrowLoad = makeArrow(C.output, { labelSide: -0.95 })
    this.arrowInput = makeArrow(C.input, { labelSide: -0.95 })
    this.arrowLift = makeArrow(C.lift, { labelSide: -0.95 })
    this.root.add(this.arrowLoad, this.arrowInput, this.arrowLift)

    this.strandLabel = makeLabel('', {
      color: C.lift,
      size: 38,
      scale: 0.0044,
      border: 'rgba(94,224,122,0.7)',
    })
    this.root.add(this.strandLabel)
  }

  /* --------------------------------------------------------------- rig */
  private buildRig(): void {
    if (this.rig) disposeObject(this.rig)
    this.rig = new THREE.Group()
    this.root.add(this.rig)

    const n = this.n
    this.topCount = n % 2 === 0 ? n / 2 : (n + 1) / 2
    this.botCount = n % 2 === 0 ? n / 2 : (n - 1) / 2

    const xs: number[] = []
    for (let i = 1; i <= n + 1; i++) xs.push(-(n * P_S) / 2 + (i - 1) * P_S)

    const topCentersRaw: number[] = []
    for (let j = 1; j <= this.topCount; j++) {
      const idx = n % 2 === 0 ? 2 * j : 2 * j - 1
      topCentersRaw.push(xs[idx - 1] + P_R)
    }
    const botCentersRaw: number[] = []
    for (let j = 1; j <= this.botCount; j++) {
      const idx = n % 2 === 0 ? 2 * j - 1 : 2 * j
      botCentersRaw.push(xs[idx - 1] + P_R)
    }
    const centerRaw = botCentersRaw.length
      ? (Math.min(...botCentersRaw) + Math.max(...botCentersRaw)) / 2
      : xs[0]
    const off = -centerRaw
    this.xs = xs.map((x) => x + off)
    this.topCenters = topCentersRaw.map((x) => x + off)
    this.botCenters = botCentersRaw.map((x) => x + off)

    /* ---- top (fixed) block ---- */
    this.topBlock = new THREE.Group()
    this.topBlock.position.set(0, P_TOP_Y, 0)
    this.rig.add(this.topBlock)

    const topMin0 = Math.min(...this.topCenters) - P_R - 0.16
    const topMax = Math.max(...this.topCenters) + P_R + 0.16
    const topMin = n % 2 === 0 ? Math.min(topMin0, this.xs[0] - 0.22) : topMin0
    const topSpan = topMax - topMin
    const topMid = (topMin + topMax) / 2

    this.spinTop = this.topCenters.map((cx) => {
      const sh = makeSheave(P_R)
      sh.position.set(cx, 0, 0)
      this.topBlock!.add(sh)
      return sh
    })
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.42, 10),
      new THREE.MeshStandardMaterial({ color: 0x6c7a90, roughness: 0.4, metalness: 0.5 }),
    )
    axle.rotation.x = Math.PI / 2
    this.topBlock.add(axle)

    const topBar = makePlate(topSpan, 0.26, 0.46)
    topBar.position.set(topMid, 0.56, 0)
    this.topBlock.add(topBar)
    for (const s of [-1, 1]) {
      const p = makePlate(0.07, 1.0, 0.44)
      p.position.set(topMid + s * (topSpan / 2 - 0.035), 0.03, 0)
      this.topBlock.add(p)
    }
    if (n % 2 === 0) {
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.028, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.35, metalness: 0.9 }),
      )
      eye.position.set(this.xs[0], -0.45, 0)
      this.topBlock.add(eye)
    }
    const bracket = makePlate(0.14, 0.24, 0.34)
    bracket.position.set(topMid, 0.78, 0)
    this.topBlock.add(bracket)

    /* ---- bottom (movable) block ---- */
    this.botBlock = new THREE.Group()
    this.rig.add(this.botBlock)
    this.spinBot = this.botCenters.map((cx) => {
      const sh = makeSheave(P_R)
      sh.position.set(cx, 0, 0)
      this.botBlock!.add(sh)
      return sh
    })
    if (this.botCount) {
      const botMin = Math.min(...this.botCenters) - P_R - 0.16
      const botMax = Math.max(...this.botCenters) + P_R + 0.16
      const bkMin = n % 2 === 1 ? this.xs[0] - 0.22 : botMin
      const bSpan = botMax - bkMin
      const bPlateMid = (bkMin + botMax) / 2
      const bBar = makePlate(bSpan, 0.26, 0.46)
      bBar.position.set(bPlateMid, 0.56, 0)
      this.botBlock.add(bBar)
      for (const s of [-1, 1]) {
        const p = makePlate(0.07, 1.0, 0.44)
        p.position.set(bPlateMid + s * (bSpan / 2 - 0.035), 0.03, 0)
        this.botBlock.add(p)
      }
      const axle2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.42, 10),
        new THREE.MeshStandardMaterial({ color: 0x6c7a90, roughness: 0.4, metalness: 0.5 }),
      )
      axle2.rotation.x = Math.PI / 2
      this.botBlock.add(axle2)
      if (n % 2 === 1) {
        const eye = new THREE.Mesh(
          new THREE.TorusGeometry(0.08, 0.028, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.35, metalness: 0.9 }),
        )
        eye.position.set(this.xs[0], 0.42, 0)
        this.botBlock.add(eye)
      }
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.45, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x8fa0b5, roughness: 0.4, metalness: 0.8 }),
      )
      strap.position.set(0, -0.725, 0)
      strap.castShadow = true
      this.botBlock.add(strap)
    }

    /* ---- rope and hook ---- */
    this.rope = new Rope(0xdcc79b, 0.055)
    this.tail = new Rope(0x57d3c4, 0.055)
    this.rig.add(this.rope.mesh, this.tail.mesh)

    this.hook = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.045, 10, 22),
      new THREE.MeshStandardMaterial({ color: 0x2fc7b6, roughness: 0.35, metalness: 0.7 }),
    )
    ring.castShadow = true
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x8fa0b5, roughness: 0.4, metalness: 0.8 }),
    )
    grip.rotation.z = Math.PI / 2
    this.hook.add(ring, grip)
    this.rig.add(this.hook)

    this.rigDirty = true
    this.updateRig()
  }

  private handY(): number {
    return P_TOP_Y - (P_TAIL0 + this.n * this.h)
  }

  private botY(): number {
    return this.h + 2.15
  }

  private hMax(): number {
    return Math.min(2.325, 3.35 / this.n)
  }

  private ropePoints(): { work: THREE.Vector3[]; tail: THREE.Vector3[] } {
    const n = this.n
    const X = (i: number) => this.xs[i - 1]
    const yTop = P_TOP_Y
    const yBot = this.botY()
    const work: THREE.Vector3[] = []
    const push = (x: number, y: number): void => {
      const l = work[work.length - 1]
      if (l && Math.abs(l.x - x) < 1e-6 && Math.abs(l.y - y) < 1e-6) return
      work.push(new THREE.Vector3(x, y, 0))
    }
    const arc = (cx: number, cy: number, a0: number, a1: number): void => {
      const steps = 10
      for (let s = 0; s <= steps; s++) {
        const a = a0 + ((a1 - a0) * s) / steps
        push(cx + P_R * Math.cos(a), cy + P_R * Math.sin(a))
      }
    }

    if (n % 2 === 1) {
      const yAnchor = n === 1 ? this.h + 1.2 : yBot + 0.42
      push(X(1), yAnchor)
      for (let j = 1; j <= this.topCount; j++) {
        push(X(2 * j - 1), yTop)
        arc(X(2 * j - 1) + P_R, yTop, Math.PI, 0)
        if (j < this.topCount) {
          push(X(2 * j), yBot)
          arc(X(2 * j) + P_R, yBot, Math.PI, 2 * Math.PI)
        }
      }
    } else {
      push(X(1), yTop - 0.45)
      for (let j = 1; j <= this.botCount; j++) {
        push(X(2 * j - 1), yBot)
        arc(X(2 * j - 1) + P_R, yBot, Math.PI, 2 * Math.PI)
        push(X(2 * j), yTop)
        arc(X(2 * j) + P_R, yTop, Math.PI, 0)
      }
    }
    const tailStart = work[work.length - 1].clone()
    const handY = this.handY()
    return { work, tail: [tailStart, new THREE.Vector3(X(n + 1), handY + 0.19, 0)] }
  }

  private updateRig(): void {
    if (!this.rig) return
    const yBot = this.botY()
    if (this.botBlock) this.botBlock.position.set(0, yBot, 0)
    const handY = this.handY()
    if (this.hook) this.hook.position.set(this.xs[this.n], handY, 0)
    const pts = this.ropePoints()
    this.rope.update(pts.work)
    this.tail.update(pts.tail)
    this.lastH = this.h
  }

  private spinSheaves(dh: number): void {
    const w = dh / P_R
    for (const s of this.spinTop) s.rotation.z -= w
    for (const s of this.spinBot) s.rotation.z += w
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    const sys = panel.section(t(S.system))
    this.seg = sys.segmented({
      items: [
        { value: '1', label: t(S.fixed), sub: 'MA 1' },
        { value: '2', label: t(S.movable), sub: 'MA 2' },
        { value: '3', label: t(S.tackle), sub: 'MA 3' },
        { value: '4', label: t(S.tackle), sub: 'MA 4' },
        { value: '5', label: t(S.tackle), sub: 'MA 5' },
      ],
      value: String(this.n),
      onChange: (v) => this.setSystem(parseInt(v, 10)),
    })
    this.rRig = sys.readout(t(S.rig))

    const setup = panel.section(t(S.setup))
    this.sW = setup.slider({
      label: t(S.loadW),
      min: 100,
      max: 1500,
      step: 25,
      value: this.W,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.W = v; this.ctx.invalidate() },
    })
    this.sF = setup.slider({
      label: t(S.pullF),
      min: 0,
      max: 600,
      step: 5,
      value: this.F,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.F = v; this.ctx.invalidate() },
    })
    const actions = setup.el('div', 'row-2')
    const idealBtn = setup.el('button', 'btn btn-primary', t(S.idealBtn))
    const resetBtn = setup.el('button', 'btn btn-ghost', t(S.reset))
    idealBtn.addEventListener('click', () => this.setForce(Math.round(this.W / this.n)))
    resetBtn.addEventListener('click', () => this.reset())
    actions.append(idealBtn, resetBtn)

    const meas = panel.section(t(S.measurements))
    const badge = meas.el('div', 'ma-badge')
    const info = meas.el('div', 'ma-info')
    info.innerHTML =
      `<div class="lbl">${t(S.maLabel)}</div>` +
      `<div class="formula">${t(S.maFormula)}</div>`
    this.maNum = meas.el('div', 'num', String(this.n))
    badge.append(info, this.maNum)
    meas.el('div', 'hr')

    this.rOut = meas.readout(t(S.outForce))
    this.rIn = meas.readout(t(S.inForce))
    this.rIdeal = meas.readout(t(S.idealIn))
    meas.el('div', 'hr')
    this.rLift = meas.readout(t(S.lift))
    this.rPull = meas.readout(t(S.pulled))
    this.rLiftH = meas.readout(t(S.lifted))
    meas.el('div', 'hr')
    this.rWin = meas.readout(t(S.win))
    this.rWout = meas.readout(t(S.wout))

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
  private setSystem(n: number): void {
    if (n === this.n && this.rig) return
    this.n = n
    this.h = 0
    this.buildRig()
    this.syncHud(true)
  }

  private setForce(v: number): void {
    const clamped = clamp(Math.round(v / 5) * 5, 0, 600)
    this.F = clamped
    this.sF.set(clamped)
    this.ctx.invalidate()
  }

  private reset(): void {
    this.W = 600
    this.F = 100
    this.h = 0
    this.sW.set(this.W)
    this.sF.set(this.F)
    this.seg.set('3')
    this.setSystem(3)
    this.placeCrate()
    this.updateRig()
    this.syncHud(true)
  }

  /* --------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0 || !this.hook) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.hook])
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return false
    this.drag = { y0: p.y, h0: this.h }
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag) {
      const hits = this.hook ? pick(event, this.ctx.camera, this.ctx.dom, [this.hook]) : []
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return
    // pulling the rope down lifts the crate by 1/n of the pull — the distance trade-off, felt by hand
    const h = clamp(this.drag.h0 + (this.drag.y0 - p.y) / this.n, 0, this.hMax())
    this.h = h
    this.ctx.invalidate()
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    const n = this.n
    const ideal = this.W / n
    const excess = this.F - ideal
    const h0 = this.h

    let v = 0
    if (Math.abs(excess) > 3) v = clamp(excess * 0.0035, -0.8, 0.8)

    if (!this.drag) {
      const next = clamp(this.h + v * dt, 0, this.hMax())
      this.h = next
    }

    const viz = `${n}|${this.W}|${this.F}`
    let dirty = viz !== this.vizSig
    this.vizSig = viz

    this.placeCrate()
    if (Math.abs(this.h - this.lastH) > 0.0015 || this.rigDirty) {
      const dh = this.h - this.lastH
      this.updateRig()
      this.spinSheaves(dh)
      this.rigDirty = false
      dirty = true
    }
    if (Math.abs(this.h - h0) > 1e-4) dirty = true

    /* arrows */
    const crateTop = this.h + 1.1
    const lOut = 0.55 + 1.3 * Math.min(1, this.W / 1500)
    this.arrowLoad.set(
      new THREE.Vector3(0, crateTop + 0.14 + lOut, 0.7),
      new THREE.Vector3(0, -1, 0),
      lOut,
    )
    this.arrowLoad.userData.setLabel(`F_out = ${num(this.W, 0)} N`)

    const handY = this.handY()
    const lIn = this.F < 5 ? 0 : 0.5 + 1.5 * Math.min(1, this.F / 600)
    this.arrowInput.set(
      new THREE.Vector3(this.xs[n], handY + 0.19 + 0.1 + lIn, 0.5),
      new THREE.Vector3(0, -1, 0),
      lIn,
    )
    this.arrowInput.userData.setLabel(`F_in = ${num(this.F, 0)} N`)

    const upForce = n * this.F
    this.arrowLift.set(
      new THREE.Vector3(-1.2, this.h + 0.05, 0.75),
      new THREE.Vector3(0, 1, 0),
      0.45 + 1.0 * Math.min(1, upForce / 1500),
    )
    this.arrowLift.userData.setLabel(`${n} × F_in = ${num(upForce, 0)} N`)

    this.strandLabel.userData.setText(tf(S.strands, { n }))
    this.strandLabel.position.set(-1.2, this.h + 1.9, 0.75)

    this.syncHud(false, ideal, excess)
    return dirty
  }

  private syncHud(force: boolean, idealIn?: number, excessIn?: number): void {
    const ideal = idealIn ?? this.W / this.n
    const excess = excessIn ?? this.F - ideal
    const n = this.n
    const pulled = n * this.h
    const balanced = Math.abs(excess) <= 3
    const top = this.h >= this.hMax() - 0.01
    const sig = `${n}|${this.W}|${this.F}|${this.h.toFixed(2)}|${balanced}|${top}|${!!this.drag}`
    if (!force && sig === this.hudSig) return
    this.hudSig = sig

    const rigText =
      n === 1
        ? t(S.rig1)
        : n === 2
          ? t(S.rig2)
          : tf(S.rigN, { t: this.topCount, b: this.botCount })
    this.rRig.set(rigText, 'neutral')
    this.maNum.textContent = String(n)
    this.rOut.set(`${num(this.W, 0)} N`, 'output')
    this.rIn.set(`${num(this.F, 0)} N`, 'input')
    this.rIdeal.set(`${num(ideal, 0)} N`, 'neutral')
    this.rLift.set(`${n} × ${num(this.F, 0)} = ${num(n * this.F, 0)} N`, 'result')
    this.rPull.set(`${num(pulled, 2)} m`, 'input')
    this.rLiftH.set(`${num(this.h, 2)} m`, 'neutral')
    this.rWin.set(`${num(this.F * pulled, 0)} J`, 'input')
    this.rWout.set(`${num(this.W * this.h, 0)} J`, 'output')

    const pct = Math.round((100 * n * this.F) / this.W)
    if (this.drag) {
      this.status.set(
        `${t(S.manual)}<span class="sub">${tf(S.manualSub, {
          p: num(pulled, 2),
          h: num(this.h, 2),
          n,
        })}</span>`,
        'neutral',
      )
    } else if (this.h <= 0.001 && this.F < ideal - 3) {
      this.status.set(
        `${t(S.onFloor)}<span class="sub">${tf(S.floorSub, {
          w: num(this.W, 0),
          n,
          i: num(ideal, 0),
          f: num(this.F, 0),
        })}</span>`,
        'bad',
      )
    } else if (balanced) {
      this.status.set(
        `${this.h > 0.01 ? `${t(S.balancedAt)} ${num(this.h, 2)} m` : t(S.balancedRest)}` +
          `<span class="sub">${tf(S.balancedSub, {
            n,
            f: num(this.F, 0),
            t: num(n * this.F, 0),
          })}</span>`,
        'result',
      )
    } else if (excess > 0) {
      this.status.set(
        `${t(S.rising)}<span class="sub">${tf(S.risingSub, {
          n,
          f: num(this.F, 0),
          t: num(n * this.F, 0),
          w: num(this.W, 0),
          p: `${pct}%`,
          pu: num(pulled, 2),
          h: num(this.h, 2),
        })}</span>`,
        'result',
      )
    } else {
      this.status.set(
        `${t(S.sinking)}<span class="sub">${tf(S.sinkingSub, {
          n,
          f: num(this.F, 0),
          t: num(n * this.F, 0),
          w: num(this.W, 0),
          i: num(ideal, 0),
        })}</span>`,
        'warn',
      )
    }
    if (top && excess > 3) {
      this.status.set(
        `${t(S.topReached)}<span class="sub">${tf(S.topSub, { p: num(pulled, 2) })}</span>`,
        'result',
      )
    }

    if (this.h >= 0.5) {
      this.liftedOnce = true
      this.goal.setDone(true, `${t(S.goalDone)} ${n} — tali ditarik ${num(pulled, 2)} m`)
    } else if (!this.liftedOnce) {
      this.goal.setDone(false)
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return { n: this.n, W: this.W, F: this.F, h: this.h }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, number>
    if (typeof s.n === 'number' && s.n !== this.n) this.setSystem(s.n)
    if (typeof s.W === 'number') this.W = s.W
    if (typeof s.F === 'number') this.F = s.F
    if (typeof s.h === 'number') this.h = clamp(s.h, 0, this.hMax())
    this.sW?.set(this.W)
    this.sF?.set(this.F)
    this.seg?.set(String(this.n))
    this.placeCrate()
    this.updateRig()
    this.syncHud(true)
  }

  dispose(): void {
    disposeObject(this.root)
  }
}

export default function createPulleyLab(ctx: LabContext): LabInstance {
  return new PulleyLab(ctx)
}
