import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp } from '../../core/math'
import type {
  CameraSpec,
  GoalHandle,
  LabContext,
  LabInstance,
  NumberHandle,
  PanelContext,
  PanelSection,
  Readout,
  SegmentedHandle,
  SliderHandle,
  StatusHandle,
} from '../../core/lab'
import { C, disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { hover, isInside, pick, rayPlaneZ } from '../../kit/picking'

/* ------------------------------------------------------------------ scene */
/** Height of the plane's origin above the room floor. */
const ORIGIN_Y = 3.6
/** The board is graph paper: 9 units wide, 7 tall. */
const BOARD_W = 9
const BOARD_H = 7
/** World units per newton — the drawing scale of the coordinate plane. */
const SCALE = 0.045
const R_MIN = 5
const R_MAX = 75
/** The grab handle that sits on the tip of a vector. */
const HANDLE_R = 0.15
/** A generous invisible sphere, so the handle is easy to grab on a phone. */
const HIT_R = 0.38
/** Segments used to draw an angle arc. */
const ARC_STEPS = 28

/* ------------------------------------------------------------------ texts */
const S = {
  activity: L('Aktivitas', 'Activity'),
  resolve: L('Menguraikan', 'Resolve'),
  add: L('Menjumlahkan', 'Add'),
  resolveSub: L('vektor → komponen', 'vector → components'),
  addSub: L('A + B = R', 'A + B = R'),
  context: L('KONTEKS', 'CONTEXT'),
  ctxResolve: L(
    'Satu vektor A dengan besar R dan sudut θ dari sumbu +x. Seret ujung panah atau geser slider untuk ' +
      'mengubahnya; garis putus-putus ke kedua sumbu menunjukkan komponennya.',
    'One vector A with magnitude R and angle θ from the +x axis. Drag the arrow tip or move the sliders to ' +
      'change it; the dashed lines to the axes show its components.',
  ),
  ctxAdd: L(
    'Perahu dayung: dayung dorong 60 N ke arah 30°, arus sungai 40 N ke arah 120°. Resultannya adalah ' +
      'kecepatan perahu terhadap tanah. Seret kedua ujung panah.',
    'A rowing boat: the oar pushes 60 N at 30°, the river current pulls 40 N at 120°. The resultant is the ' +
      'boat’s velocity over the ground. Drag both arrow tips.',
  ),

  vecA: L('Vektor A', 'Vector A'),
  vecB: L('Vektor B', 'Vector B'),
  magSlider: L('Besar  R  (newton)', 'Magnitude  R  (newton)'),
  thetaSlider: L('Sudut  θ  dari +x (derajat)', 'Angle  θ  from +x (degrees)'),
  magA: L('|A|  (besar)', '|A|  (magnitude)'),
  thA: L('Sudut  θ_A', 'Angle  θ_A'),
  ax: L('Ax = R cos θ', 'Ax = R cos θ'),
  ay: L('Ay = R sin θ', 'Ay = R sin θ'),
  unit: L('Vektor satuan  î = (cos θ, sin θ)', 'Unit vector  î = (cos θ, sin θ)'),
  magB: L('|B|  (besar)', '|B|  (magnitude)'),
  thB: L('Sudut  θ_B', 'Angle  θ_B'),
  bx: L('Bx = R cos θ', 'Bx = R cos θ'),
  by: L('By = R sin θ', 'By = R sin θ'),

  result: L('Hasil — vektor resultan', 'Result — the resultant'),
  rx: L('Rx = Ax + Bx', 'Rx = Ax + Bx'),
  ry: L('Ry = Ay + By', 'Ry = Ay + By'),
  magR: L('|R| = √(Rx² + Ry²)', '|R| = √(Rx² + Ry²)'),
  thR: L('Sudut  θR = atan2(Ry, Rx)', 'Angle  θR = atan2(Ry, Rx)'),

  answer: L('Jawabanmu', 'Your answer'),
  task: L('TUGAS', 'TASK'),
  qResolve: L(
    'Tulis besar |A| dan komponen x Ax (dalam newton).',
    'Write the magnitude |A| and the x-component Ax (in newtons).',
  ),
  qAdd: L(
    'Tulis besar resultan |R| dan komponen x Rx (dalam newton).',
    'Write the magnitude of the resultant |R| and its x-component Rx (in newtons).',
  ),
  qMag: L('Besar vektor  (newton)', 'Vector magnitude  (newton)'),
  qComp: L('Komponen x  (newton)', 'x-component  (newton)'),
  checkMag: L('Cek besar', 'Check magnitude'),
  checkComp: L('Cek komponen', 'Check component'),
  reset: L('↺ Atur ulang', '↺ Reset'),
  goal: L('Jawab benar: besar vektor & komponen x', 'Answer both: the magnitude and the x-component'),
  goalDone: L(
    'Tepat! Vektormu terurai dan terjumlah dengan benar.',
    'Correct — your vector resolves and adds properly.',
  ),

  hintTitle: L('Isi kedua kolom, lalu tekan Cek.', 'Fill in both fields, then press Check.'),
  hintSub: L('Toleransi: 1% atau 0,5 newton.', 'Tolerance: 1% or 0.5 newton.'),
  emptyTitle: L('BELUM DIISI', 'NOT FILLED IN'),
  emptySub: L('Tulis angka di kolomnya lebih dulu.', 'Write a number in that field first.'),
  okTitle: L('BENAR', 'CORRECT'),
  okSub: L('Nilainya {v} N.  {f}', 'The value is {v} N.  {f}'),
  noTitle: L('BELUM TEPAT', 'NOT QUITE'),
  noSub: L('Jawaban yang benar {v} N.  {f}', 'The right answer is {v} N.  {f}'),

  fMagResolve: L('|A| = √(Ax² + Ay²) = {v} N', '|A| = √(Ax² + Ay²) = {v} N'),
  fMagAdd: L('|R| = √(Rx² + Ry²) = {v} N', '|R| = √(Rx² + Ry²) = {v} N'),
  fCompResolve: L('Ax = R cos θ = {r} cos {t}° = {v} N', 'Ax = R cos θ = {r} cos {t}° = {v} N'),
  fCompAdd: L('Rx = Ax + Bx = {v} N', 'Rx = Ax + Bx = {v} N'),

  howTitle: L('Aturan vektor: kepala-ke-ekor & parallelogram', 'Vector rules: head-to-tail & parallelogram'),
  howBody: L(
    'Vektor punya <b>besar</b> (panjang panah, dalam newton) dan <b>arah</b> (sudut dari sumbu +x). ' +
      'Sudut diukur berlawanan arah jarum jam mulai dari +x: 0° ke kanan, 90° ke atas, 180° ke kiri, 270° ke bawah.<br><br>' +
      '<b>Menguraikan.</b> Komponen pada sumbu x adalah <code>Ax = R cos θ</code> dan pada sumbu y ' +
      '<code>Ay = R sin θ</code>. Garis putus-putus dari ujung panah ke kedua sumbu itulah komponennya.<br><br>' +
      '<b>Menjumlahkan.</b> Aturan <b>kepala-ke-ekor</b>: geser ekor vektor kedua ke ujung vektor pertama; panah ' +
      'dari ekor awal sampai ujung akhir adalah resultan. Aturan <b>parallelogram</b>: gambar A dan B dari titik ' +
      'asal yang sama, lengkapi parallelogram, dan diagonal dari titik asal itu adalah <code>R = A + B</code>.<br><br>' +
      'Komponennya dijumlahkan langsung: <code>Rx = Ax + Bx</code>, <code>Ry = Ay + By</code>, besarnya ' +
      '<code>|R| = √(Rx² + Ry²)</code> dan arahnya <code>θR = atan2(Ry, Rx)</code>.',
    'A vector has a <b>magnitude</b> (the length of the arrow, in newtons) and a <b>direction</b> (the angle ' +
      'from the +x axis). Angles are measured anticlockwise from +x: 0° to the right, 90° up, 180° to the left, ' +
      '270° down.<br><br>' +
      '<b>Resolving.</b> The x-component is <code>Ax = R cos θ</code> and the y-component ' +
      '<code>Ay = R sin θ</code>. The dashed lines from the arrow tip to the two axes are exactly those ' +
      'components.<br><br>' +
      '<b>Adding.</b> The <b>head-to-tail</b> rule: slide the tail of the second vector onto the head of the ' +
      'first; the arrow from the first tail to the last head is the resultant. The <b>parallelogram</b> rule: draw ' +
      'A and B from the same origin, complete the parallelogram, and the diagonal from the origin is ' +
      '<code>R = A + B</code>.<br><br>' +
      'The components simply add: <code>Rx = Ax + Bx</code>, <code>Ry = Ay + By</code>, the magnitude is ' +
      '<code>|R| = √(Rx² + Ry²)</code> and the direction <code>θR = atan2(Ry, Rx)</code>.',
  ),
}

/** Degrees → radians. */
const rad = (deg: number): number => (deg * Math.PI) / 180
/** Degrees → the 0…360° circle. */
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360

type Mode = 'resolve' | 'add'
type Which = 'A' | 'B'
type Question = 'mag' | 'comp'

class VectorsLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext

  /* the coordinate plane and everything drawn on it */
  private plane!: THREE.Group
  private groupA!: THREE.Group
  private groupB!: THREE.Group
  private arrowA!: ReturnType<typeof makeArrow>
  private arrowB!: ReturnType<typeof makeArrow>
  private arrowR!: ReturnType<typeof makeArrow>
  private compX!: ReturnType<typeof makeArrow>
  private compY!: ReturnType<typeof makeArrow>
  private tipA!: THREE.Mesh
  private tipB!: THREE.Mesh
  private hitA!: THREE.Mesh
  private hitB!: THREE.Mesh
  private projA!: THREE.LineSegments
  private projB!: THREE.LineSegments
  private para!: THREE.LineSegments
  private arcA!: THREE.Line
  private arcB!: THREE.Line

  /* state */
  private mode: Mode = 'resolve'
  private rA = 60
  private thA = 30
  private rB = 40
  private thB = 120
  private drag: Which | null = null
  private ansMag = 0
  private ansComp = 0
  private magOk = false
  private compOk = false
  private lastCheck: Question | null = null
  private vizSig = ''
  private hudSig = ''

  /* panel */
  private seg!: SegmentedHandle
  private sRA!: SliderHandle
  private sTA!: SliderHandle
  private sRB!: SliderHandle
  private sTB!: SliderHandle
  private rMagA!: Readout
  private rThA!: Readout
  private rAx!: Readout
  private rAy!: Readout
  private rUnit!: Readout
  private rMagB!: Readout
  private rThB!: Readout
  private rBx!: Readout
  private rBy!: Readout
  private rRx!: Readout
  private rRy!: Readout
  private rMagR!: Readout
  private rThR!: Readout
  private ctxText!: HTMLElement
  private qText!: HTMLElement
  private nMag!: NumberHandle
  private nComp!: NumberHandle
  private secB!: HTMLElement
  private secR!: HTMLElement
  private status!: StatusHandle
  private goal!: GoalHandle

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'vectors-lab'
    this.build()
    this.applyScene()
    /* Frame the coordinate plane. The platform may override this with the
       camera of its own catalogue entry, so the call is optional. */
    const framing = this.ctx as LabContext & { setCamera?: (spec: CameraSpec) => void }
    framing.setCamera?.({
      target: [0, ORIGIN_Y, 0],
      radius: 11.5,
      azim: 0,
      polar: 1.4,
    })
  }

  /* -------------------------------------------------------------- scene */
  private build(): void {
    const G = this.root

    /* Everything lives on one group so the drawing coordinates are the plain
       lab coordinates (x to the right, y up) and only this group knows that
       the plane stands on the floor of the room. */
    this.plane = new THREE.Group()
    this.plane.position.set(0, ORIGIN_Y, 0)
    G.add(this.plane)

    /* the graph-paper board */
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_W, BOARD_H, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x18212e, roughness: 0.92, metalness: 0.04 }),
    )
    board.position.z = -0.12
    board.receiveShadow = true
    this.plane.add(board)

    /* the whole grid in one draw call */
    const gridPts: number[] = []
    for (let x = -4; x <= 4; x++) gridPts.push(x, -BOARD_H / 2, 0, x, BOARD_H / 2, 0)
    for (let y = -3; y <= 3; y++) gridPts.push(-BOARD_W / 2, y, 0, BOARD_W / 2, y, 0)
    const gridGeo = new THREE.BufferGeometry()
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3))
    const grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0x2c3d55, transparent: true, opacity: 0.8 }),
    )
    grid.position.z = -0.05
    this.plane.add(grid)

    /* the two axes */
    const axisMat = new THREE.MeshStandardMaterial({ color: 0x7f92ab, roughness: 0.45, metalness: 0.45 })
    const axisX = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, 0.055, 0.055), axisMat)
    axisX.position.z = -0.03
    const axisY = new THREE.Mesh(new THREE.BoxGeometry(0.055, BOARD_H, 0.055), axisMat)
    axisY.position.z = -0.03
    this.plane.add(axisX, axisY)

    /* axis labels */
    this.axisLabel('O', -0.34, -0.36)
    this.axisLabel('x', -BOARD_W / 2 + 0.42, -0.42)
    this.axisLabel('+x', BOARD_W / 2 - 0.42, 0.42)
    this.axisLabel('y', -0.42, -BOARD_H / 2 + 0.42)
    this.axisLabel('+y', 0.42, BOARD_H / 2 - 0.42)

    /* ---- vector A ---- */
    this.groupA = new THREE.Group()
    this.groupA.name = 'vector-A'
    this.plane.add(this.groupA)
    this.arrowA = makeArrow(C.input, { labelSide: 0.85, radius: 0.06, headLen: 0.4 })
    this.groupA.add(this.arrowA)
    this.tipA = this.makeHandle(C.input)
    this.groupA.add(this.tipA)
    this.hitA = this.makeHit()
    this.groupA.add(this.hitA)

    /* ---- vector B ---- */
    this.groupB = new THREE.Group()
    this.groupB.name = 'vector-B'
    this.plane.add(this.groupB)
    this.arrowB = makeArrow(C.input, { labelSide: -0.9, radius: 0.06, headLen: 0.4 })
    this.groupB.add(this.arrowB)
    this.tipB = this.makeHandle(C.input)
    this.groupB.add(this.tipB)
    this.hitB = this.makeHit()
    this.groupB.add(this.hitB)

    /* ---- the resultant and the two component arrows ---- */
    this.arrowR = makeArrow(C.output, { labelSide: 0.9, radius: 0.06, headLen: 0.42 })
    /* the component labels sit outside the axes, so they never fight with the
       label of the vector they belong to */
    this.compX = makeArrow(C.output, { labelSide: 0.7, radius: 0.038, headLen: 0.26 })
    this.compY = makeArrow(C.output, { labelSide: -0.8, radius: 0.038, headLen: 0.26 })
    this.plane.add(this.arrowR, this.compX, this.compY)

    /* ---- projections, parallelogram and angle arcs ---- */
    this.projA = this.makeProj()
    this.projB = this.makeProj()
    this.para = this.makePara()
    this.arcA = this.makeArc()
    this.arcB = this.makeArc()
    this.plane.add(this.projA, this.projB, this.para, this.arcA, this.arcB)
  }

  private axisLabel(text: string, lx: number, ly: number): void {
    const label = makeLabel(text, { color: C.neutral, size: 34, scale: 0.0044 })
    label.position.set(lx, ly, 0.14)
    this.plane.add(label)
  }

  /** The little ball the student grabs to move a vector. */
  private makeHandle(color: string): THREE.Mesh {
    const c = new THREE.Color(color)
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(HANDLE_R, 18, 14),
      new THREE.MeshStandardMaterial({
        color: c,
        emissive: c.clone().multiplyScalar(0.45),
        roughness: 0.3,
        metalness: 0.15,
      }),
    )
    m.position.z = 0.1
    return m
  }

  /**
   * An invisible, generous sphere around the handle.
   *
   * three.js only uses `visible` when it draws a scene, so the raycaster still
   * finds it — that gives the handle a comfortable touch target on a phone
   * without adding anything to the picture.
   */
  private makeHit(): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.SphereGeometry(HIT_R, 10, 8), new THREE.MeshBasicMaterial())
    m.visible = false
    m.position.z = 0.1
    m.name = 'tip-hit'
    return m
  }

  /** The dashed lines that drop from an arrow tip to both axes. */
  private makeProj(): THREE.LineSegments {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3))
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineDashedMaterial({
        color: 0xff9f43,
        dashSize: 0.14,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.8,
      }),
    )
    line.frustumCulled = false
    line.position.z = 0.004
    return line
  }

  /** The faint parallelogram that shows the sum of two vectors. */
  private makePara(): THREE.LineSegments {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3))
    const line = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x9db0c6, transparent: true, opacity: 0.45 }),
    )
    line.frustumCulled = false
    line.position.z = 0.002
    return line
  }

  /** The little arc that shows how far a vector is turned away from +x. */
  private makeArc(): THREE.Line {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array((ARC_STEPS + 1) * 3), 3),
    )
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0x9db0c6, transparent: true, opacity: 0.75 }),
    )
    line.frustumCulled = false
    line.position.z = 0.02
    return line
  }

  /* -------------------------------------------------------- the drawing */
  private applyScene(): void {
    const tA = rad(this.thA)
    const tB = rad(this.thB)
    const ax = this.rA * Math.cos(tA)
    const ay = this.rA * Math.sin(tA)
    const bx = this.rB * Math.cos(tB)
    const by = this.rB * Math.sin(tB)
    const add = this.mode === 'add'

    /* every vector starts at the origin of the plane */
    vOrigin.set(0, 0, 0)

    /* vector A */
    vDir.set(Math.cos(tA), Math.sin(tA), 0)
    this.arrowA.set(vOrigin, vDir, this.rA * SCALE)
    this.arrowA.setLabel(`A = ${num(this.rA, 0)} N`)
    this.tipA.position.set(ax * SCALE, ay * SCALE, 0.1)
    this.hitA.position.copy(this.tipA.position)
    this.setProj(this.projA, ax * SCALE, ay * SCALE)
    this.setArc(this.arcA, this.thA, 0.8)

    /* vector B only exists in the adding activity */
    this.groupB.visible = add
    vDir.set(Math.cos(tB), Math.sin(tB), 0)
    this.arrowB.set(vOrigin, vDir, add ? this.rB * SCALE : 0)
    this.arrowB.setLabel(`B = ${num(this.rB, 0)} N`)
    this.tipB.position.set(bx * SCALE, by * SCALE, 0.1)
    this.hitB.position.copy(this.tipB.position)
    this.projB.visible = add
    this.setProj(this.projB, bx * SCALE, by * SCALE)
    this.arcB.visible = add
    this.setArc(this.arcB, this.thB, 1.2)

    /* the resultant: in the adding activity it is A + B */
    const rx = ax + bx
    const ry = ay + by
    const mag = Math.hypot(rx, ry)
    vDir.set(mag > 1e-6 ? rx / mag : 1, mag > 1e-6 ? ry / mag : 0, 0)
    this.arrowR.set(vOrigin, vDir, add ? mag * SCALE : 0)
    this.arrowR.setLabel(`R = ${num(mag, 1)} N`)

    /* the orange component arrows belong to A while resolving and to R while
       adding — in both cases they show what the student is asked to find */
    const cx = add ? rx : ax
    const cy = add ? ry : ay
    this.setComponent(this.compX, cx * SCALE, 'x')
    this.setComponent(this.compY, cy * SCALE, 'y')
    this.compX.setLabel(`${add ? 'Rx' : 'Ax'} = ${num(cx, 2)} N`)
    this.compY.setLabel(`${add ? 'Ry' : 'Ay'} = ${num(cy, 2)} N`)

    /* the parallelogram only makes sense when two vectors are added */
    this.para.visible = add
    if (add) this.setPara(ax * SCALE, ay * SCALE, bx * SCALE, by * SCALE)
  }

  /** One dashed projection line to the x-axis and one to the y-axis. */
  private setProj(line: THREE.LineSegments, ax: number, ay: number): void {
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    /* the drop to the x-axis, then the run to the y-axis */
    a[0] = ax
    a[1] = ay
    a[2] = 0
    a[3] = ax
    a[4] = 0
    a[5] = 0
    a[6] = ax
    a[7] = ay
    a[8] = 0
    a[9] = 0
    a[10] = ay
    a[11] = 0
    attr.needsUpdate = true
    line.computeLineDistances()
  }

  /** The four sides of the parallelogram: O → A → A+B → B → O. */
  private setPara(ax: number, ay: number, bx: number, by: number): void {
    const attr = this.para.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    const put = (i: number, x: number, y: number): void => {
      a[i * 3] = x
      a[i * 3 + 1] = y
      a[i * 3 + 2] = 0
    }
    put(0, 0, 0)
    put(1, ax, ay)
    put(2, ax, ay)
    put(3, ax + bx, ay + by)
    put(4, ax + bx, ay + by)
    put(5, bx, by)
    put(6, bx, by)
    put(7, 0, 0)
    attr.needsUpdate = true
  }

  /** Sweep an arc from the +x axis to the vector's direction. */
  private setArc(line: THREE.Line, deg: number, radius: number): void {
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    const end = rad(deg)
    for (let i = 0; i <= ARC_STEPS; i++) {
      const ang = (end * i) / ARC_STEPS
      a[i * 3] = Math.cos(ang) * radius
      a[i * 3 + 1] = Math.sin(ang) * radius
      a[i * 3 + 2] = 0
    }
    attr.needsUpdate = true
  }

  /** Draw a component as an arrow that runs along its axis. */
  private setComponent(arrow: ReturnType<typeof makeArrow>, value: number, axis: 'x' | 'y'): void {
    if (axis === 'x') {
      vDir.set(value >= 0 ? 1 : -1, 0, 0)
    } else {
      vDir.set(0, value >= 0 ? 1 : -1, 0)
    }
    /* a touch in front of the axis it lies on */
    vComp.set(0, 0, 0.02)
    arrow.set(vComp, vDir, Math.abs(value))
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    /* ---- activity ---- */
    const act = panel.section(t(S.activity))
    this.seg = act.segmented({
      items: [
        { value: 'resolve', label: t(S.resolve), sub: t(S.resolveSub) },
        { value: 'add', label: t(S.add), sub: t(S.addSub) },
      ],
      value: this.mode,
      onChange: (v) => this.setMode(v === 'add' ? 'add' : 'resolve'),
    })
    this.ctxText = this.makeNote(act, t(S.context))

    /* ---- vector A ---- */
    const secA = panel.section(t(S.vecA))
    this.sRA = secA.slider({
      label: t(S.magSlider),
      min: R_MIN,
      max: R_MAX,
      step: 1,
      value: this.rA,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.rA = v; this.onEdit() },
    })
    this.sTA = secA.slider({
      label: t(S.thetaSlider),
      min: 0,
      max: 360,
      step: 1,
      value: this.thA,
      format: (v) => `${num(v, 0)}°`,
      onInput: (v) => { this.thA = v; this.onEdit() },
    })
    this.rMagA = secA.readout(t(S.magA))
    this.rThA = secA.readout(t(S.thA))
    this.rAx = secA.readout(t(S.ax))
    this.rAy = secA.readout(t(S.ay))
    this.rUnit = secA.readout(t(S.unit))

    /* ---- vector B ---- */
    const secB = panel.section(t(S.vecB))
    this.secB = secB.host
    this.sRB = secB.slider({
      label: t(S.magSlider),
      min: R_MIN,
      max: R_MAX,
      step: 1,
      value: this.rB,
      format: (v) => `${num(v, 0)} N`,
      onInput: (v) => { this.rB = v; this.onEdit() },
    })
    this.sTB = secB.slider({
      label: t(S.thetaSlider),
      min: 0,
      max: 360,
      step: 1,
      value: this.thB,
      format: (v) => `${num(v, 0)}°`,
      onInput: (v) => { this.thB = v; this.onEdit() },
    })
    this.rMagB = secB.readout(t(S.magB))
    this.rThB = secB.readout(t(S.thB))
    this.rBx = secB.readout(t(S.bx))
    this.rBy = secB.readout(t(S.by))

    /* ---- the resultant ---- */
    const secR = panel.section(t(S.result))
    this.secR = secR.host
    this.rRx = secR.readout(t(S.rx))
    this.rRy = secR.readout(t(S.ry))
    this.rMagR = secR.readout(t(S.magR))
    this.rThR = secR.readout(t(S.thR))

    /* ---- the student's answer ---- */
    const ans = panel.section(t(S.answer))
    this.qText = this.makeNote(ans, t(S.task))
    this.nMag = ans.number({
      label: t(S.qMag),
      value: 0,
      step: 0.1,
      suffix: 'N',
      onChange: (v) => this.onAnswer('mag', v),
    })
    this.nComp = ans.number({
      label: t(S.qComp),
      value: 0,
      step: 0.1,
      suffix: 'N',
      onChange: (v) => this.onAnswer('comp', v),
    })

    const actions = ans.el('div', 'row-2')
    const checkMag = ans.el('button', 'btn btn-primary', t(S.checkMag))
    const checkComp = ans.el('button', 'btn', t(S.checkComp))
    const resetBtn = ans.el('button', 'btn btn-ghost', t(S.reset))
    checkMag.addEventListener('click', () => this.check('mag'))
    checkComp.addEventListener('click', () => this.check('comp'))
    resetBtn.addEventListener('click', () => this.reset())
    actions.append(checkMag, checkComp, resetBtn)

    this.status = ans.status()
    this.goal = ans.goal(t(S.goal))

    /* ---- the rules behind the drawing ---- */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)

    this.updatePanels()
  }

  /** A small caption card — the same look the lever and pulley rooms use. */
  private makeNote(section: PanelSection, title: string): HTMLElement {
    const badge = section.el('div', 'ma-badge')
    const info = section.el('div', 'ma-info')
    const lbl = document.createElement('div')
    lbl.className = 'lbl'
    lbl.textContent = title
    const text = document.createElement('div')
    text.className = 'formula'
    info.append(lbl, text)
    badge.append(info)
    return text
  }

  /* ------------------------------------------------------------ actions */
  private setMode(mode: Mode): void {
    if (mode === this.mode) return
    this.mode = mode
    /* the questions belong to the activity, so the old answers are dropped */
    this.ansMag = 0
    this.ansComp = 0
    this.magOk = false
    this.compOk = false
    this.lastCheck = null
    this.nMag?.set(0)
    this.nComp?.set(0)
    this.updatePanels()
    this.ctx.invalidate()
  }

  /** Show the parts of the panel that belong to the current activity. */
  private updatePanels(): void {
    const add = this.mode === 'add'
    if (this.secB) this.secB.style.display = add ? '' : 'none'
    if (this.secR) this.secR.style.display = add ? '' : 'none'
    if (this.ctxText) this.ctxText.textContent = add ? t(S.ctxAdd) : t(S.ctxResolve)
    if (this.qText) this.qText.textContent = add ? t(S.qAdd) : t(S.qResolve)
  }

  /**
   * The student changed a vector, so the questions have new answers and the
   * old verdict no longer applies.
   */
  private onEdit(): void {
    this.magOk = false
    this.compOk = false
    this.lastCheck = null
    this.syncHud(true)
    this.ctx.invalidate()
  }

  private onAnswer(which: Question, value: number): void {
    if (which === 'mag') {
      this.ansMag = value
      this.magOk = false
    } else {
      this.ansComp = value
      this.compOk = false
    }
    /* an edited answer invalidates the last verdict */
    this.lastCheck = null
    this.syncHud(true)
  }

  private reset(): void {
    this.rA = 60
    this.thA = 30
    this.rB = 40
    this.thB = 120
    this.ansMag = 0
    this.ansComp = 0
    this.magOk = false
    this.compOk = false
    this.lastCheck = null
    this.sRA?.set(this.rA)
    this.sTA?.set(this.thA)
    this.sRB?.set(this.rB)
    this.sTB?.set(this.thB)
    this.nMag?.set(0)
    this.nComp?.set(0)
    this.syncHud(true)
    this.ctx.invalidate()
  }

  /* ------------------------------------------------------------ the maths */
  private compAx(): number {
    return this.rA * Math.cos(rad(this.thA))
  }

  private compAy(): number {
    return this.rA * Math.sin(rad(this.thA))
  }

  private compBx(): number {
    return this.rB * Math.cos(rad(this.thB))
  }

  private compBy(): number {
    return this.rB * Math.sin(rad(this.thB))
  }

  private resultX(): number {
    return this.compAx() + this.compBx()
  }

  private resultY(): number {
    return this.compAy() + this.compBy()
  }

  private resultMag(): number {
    return Math.hypot(this.resultX(), this.resultY())
  }

  /** What the student is expected to type in each field. */
  private target(which: Question): number {
    const add = this.mode === 'add'
    if (which === 'mag') return add ? this.resultMag() : this.rA
    return add ? this.resultX() : this.compAx()
  }

  private check(which: Question): void {
    const entered = which === 'mag' ? this.ansMag : this.ansComp
    if (!Number.isFinite(entered)) {
      this.status?.set(`${t(S.emptyTitle)}<span class="sub">${t(S.emptySub)}</span>`, 'warn')
      return
    }
    const target = this.target(which)
    /* one percent, but never tighter than half a newton */
    const tol = Math.max(0.5, Math.abs(target) * 0.01)
    const ok = Math.abs(entered - target) <= tol
    if (which === 'mag') this.magOk = ok
    else this.compOk = ok
    this.lastCheck = which
    this.syncHud(true)
  }

  /* --------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, this.pickTargets())
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return false
    this.drag = isInside(hits[0].object, this.groupA) ? 'A' : 'B'
    this.dragTo(p.x, p.y - ORIGIN_Y)
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drag) {
      const hits = pick(event, this.ctx.camera, this.ctx.dom, this.pickTargets())
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return
    this.dragTo(p.x, p.y - ORIGIN_Y)
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  /** Only the tips of the vectors may be grabbed — empty space still orbits. */
  private pickTargets(): THREE.Object3D[] {
    return this.mode === 'add' ? [this.hitA, this.hitB] : [this.hitA]
  }

  /** Turn a point on the plane into a magnitude and a direction. */
  private dragTo(lx: number, ly: number): void {
    const r = clamp(Math.round(Math.hypot(lx, ly) / SCALE), R_MIN, R_MAX)
    const deg = Math.round(norm360((Math.atan2(ly, lx) * 180) / Math.PI))
    if (this.drag === 'A') {
      this.rA = r
      this.thA = deg
      this.sRA?.set(r)
      this.sTA?.set(deg)
    } else {
      this.rB = r
      this.thB = deg
      this.sRB?.set(r)
      this.sTB?.set(deg)
    }
    this.onEdit()
  }

  /* --------------------------------------------------------------- frame */
  update(_dt: number): boolean {
    /* Nothing animates in this room — the drawing only changes when the
       student changes something, so an idle lab costs no CPU at all. */
    const sig = `${this.mode}|${this.rA}|${this.thA}|${this.rB}|${this.thB}`
    const dirty = sig !== this.vizSig
    this.vizSig = sig
    if (dirty) this.applyScene()
    this.syncHud(false)
    return dirty
  }

  /* ----------------------------------------------------------- readouts */
  private syncHud(force: boolean): void {
    const sig =
      `${this.mode}|${this.rA}|${this.thA}|${this.rB}|${this.thB}|` +
      `${this.lastCheck}|${this.magOk}|${this.compOk}`
    if (!force && sig === this.hudSig) return
    this.hudSig = sig

    const thA = rad(this.thA)
    const ax = this.compAx()
    const ay = this.compAy()
    const bx = this.compBx()
    const by = this.compBy()
    const rx = this.resultX()
    const ry = this.resultY()
    const mag = this.resultMag()
    const thR = norm360((Math.atan2(ry, rx) * 180) / Math.PI)

    this.rMagA?.set(`${num(this.rA, 0)} N`, 'input')
    this.rThA?.set(`${num(this.thA, 0)}°`, 'input')
    this.rAx?.set(`${num(ax, 2)} N`, 'output')
    this.rAy?.set(`${num(ay, 2)} N`, 'output')
    this.rUnit?.set(`(${num(Math.cos(thA), 3)}, ${num(Math.sin(thA), 3)})`, 'neutral')

    this.rMagB?.set(`${num(this.rB, 0)} N`, 'input')
    this.rThB?.set(`${num(this.thB, 0)}°`, 'input')
    this.rBx?.set(`${num(bx, 2)} N`, 'output')
    this.rBy?.set(`${num(by, 2)} N`, 'output')

    this.rRx?.set(`${num(rx, 2)} N`, 'output')
    this.rRy?.set(`${num(ry, 2)} N`, 'output')
    this.rMagR?.set(`${num(mag, 2)} N`, 'result')
    this.rThR?.set(`${num(thR, 1)}°`, 'result')

    this.syncStatus()
    /* the goal text is swapped too, otherwise a stale "correct" text would
       stay on screen after the student changes the vector */
    if (this.magOk && this.compOk) this.goal?.setDone(true, t(S.goalDone))
    else this.goal?.setDone(false, t(S.goal))
  }

  private syncStatus(): void {
    if (this.lastCheck === null) {
      this.status?.set(
        `${t(S.hintTitle)}<span class="sub">${t(S.hintSub)}</span>`,
        'neutral',
      )
      return
    }
    const add = this.mode === 'add'
    const isMag = this.lastCheck === 'mag'
    const target = this.target(this.lastCheck)
    const formula = isMag
      ? tf(add ? S.fMagAdd : S.fMagResolve, { v: num(target, 2) })
      : tf(add ? S.fCompAdd : S.fCompResolve, {
          r: num(this.rA, 0),
          t: num(this.thA, 0),
          v: num(target, 2),
        })
    const ok = isMag ? this.magOk : this.compOk
    if (ok) {
      this.status?.set(
        `${t(S.okTitle)}<span class="sub">${tf(S.okSub, { v: num(target, 2), f: formula })}</span>`,
        'result',
      )
    } else {
      this.status?.set(
        `${t(S.noTitle)}<span class="sub">${tf(S.noSub, { v: num(target, 2), f: formula })}</span>`,
        'warn',
      )
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return {
      mode: this.mode,
      rA: this.rA,
      thA: this.thA,
      rB: this.rB,
      thB: this.thB,
      ansMag: Number.isFinite(this.ansMag) ? this.ansMag : 0,
      ansComp: Number.isFinite(this.ansComp) ? this.ansComp : 0,
      magOk: this.magOk,
      compOk: this.compOk,
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, unknown>
    if (s.mode === 'resolve' || s.mode === 'add') this.mode = s.mode
    if (typeof s.rA === 'number') this.rA = clamp(s.rA, R_MIN, R_MAX)
    if (typeof s.thA === 'number') this.thA = norm360(s.thA)
    if (typeof s.rB === 'number') this.rB = clamp(s.rB, R_MIN, R_MAX)
    if (typeof s.thB === 'number') this.thB = norm360(s.thB)
    if (typeof s.ansMag === 'number') this.ansMag = s.ansMag
    if (typeof s.ansComp === 'number') this.ansComp = s.ansComp
    if (typeof s.magOk === 'boolean') this.magOk = s.magOk
    if (typeof s.compOk === 'boolean') this.compOk = s.compOk

    /* push everything back into the panel */
    this.seg?.set(this.mode)
    this.sRA?.set(this.rA)
    this.sTA?.set(this.thA)
    this.sRB?.set(this.rB)
    this.sTB?.set(this.thB)
    this.nMag?.set(this.ansMag)
    this.nComp?.set(this.ansComp)
    this.updatePanels()

    this.applyScene()
    this.syncHud(true)
    this.ctx.invalidate()
  }

  dispose(): void {
    disposeObject(this.root)
  }
}

/* scratch vectors — the drawing is updated often, so nothing is allocated */
const vOrigin = new THREE.Vector3()
const vDir = new THREE.Vector3()
const vComp = new THREE.Vector3()

export default function createVectorsLab(ctx: LabContext): LabInstance {
  return new VectorsLab(ctx)
}
