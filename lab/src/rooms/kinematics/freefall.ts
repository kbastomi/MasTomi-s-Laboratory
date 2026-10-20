import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { G, clamp } from '../../core/math'
import type {
  GoalHandle,
  LabContext,
  LabInstance,
  NumberHandle,
  PanelContext,
  Readout,
  SegmentedHandle,
  SliderHandle,
  StatusHandle,
  ToggleHandle,
} from '../../core/lab'
import { C, disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { makeCrate } from '../../kit/objects'
import { hover, pick, rayPlaneZ } from '../../kit/picking'
import { Plot, type PlotSeries } from '../../kit/plot'

/**
 * Free fall — the mass does not matter, the air does.
 *
 * The tower is drawn at 0.34 world units per metre so a 30 m drop still fits
 * the room. A catalogue entry for this lab should frame it with
 * `{ target: [-1.2, 5.0, 0], radius: 15, azim: 0.12, polar: 1.36 }`.
 */

/* ------------------------------------------------------------------ scene */
const WS = 0.34
const H_MIN = 1
const H_MAX = 30
const TOWER_X = -3.1
const TOWER_W = 1.1
const TOWER_D = 1.2
const TOWER_TOP = H_MAX * WS
const OBJ_X = -1.95
const OBJ_Z = 0.25

/* ---------------------------------------------------------------- physics */
/**
 * The drag constant is the same for all three objects on purpose: they have
 * the same size and the same frontal area, so mass is the only variable left.
 * `a_drag = (k / m) v²` is then the whole story of the lesson.
 */
const DRAG_K = 0.02
/** fixed step — the live fall and the answer key must be the same simulation */
const FIXED = 1 / 240

type PlanetId = 'earth' | 'moon' | 'mars'
type BodyId = 'steel' | 'wood' | 'feather'
type Phase = 'ready' | 'falling' | 'landed'

const GRAVITY: Record<PlanetId, number> = { earth: G, moon: 1.62, mars: 3.72 }
const PLANET_IDS: PlanetId[] = ['earth', 'moon', 'mars']
const BODY_IDS: BodyId[] = ['steel', 'wood', 'feather']

const BODIES: Record<BodyId, { mass: number; half: number; name: { id: string; en: string } }> = {
  steel: { mass: 8, half: 0.15, name: L('Bola baja', 'Steel ball') },
  wood: { mass: 0.6, half: 0.13, name: L('Balok kayu', 'Wooden block') },
  feather: { mass: 0.005, half: 0.06, name: L('Bulu', 'Feather') },
}

/* ------------------------------------------------------------------ texts */
const S = {
  dropTitle: L('Jatuhkan', 'Drop'),
  height: L('Tinggi jatuh  h', 'Drop height  h'),
  gravity: L('Gravitasi', 'Gravity'),
  earth: L('Bumi', 'Earth'),
  moon: L('Bulan', 'Moon'),
  mars: L('Mars', 'Mars'),
  object: L('Benda', 'Object'),
  air: L('Hambatan udara', 'Air resistance'),
  showGraph: L('Tampilkan grafik v–t', 'Show the v–t graph'),
  dropBtn: L('▼ Jatuhkan', '▼ Drop'),
  resetBtn: L('↺ Atur ulang', '↺ Reset'),
  measTitle: L('Pengukuran', 'Measurements'),
  heightRead: L('Tinggi jatuh  h', 'Drop height  h'),
  gravRead: L('Gravitasi  g', 'Gravity  g'),
  massRead: L('Massa benda  m', 'Object mass  m'),
  timeRead: L('Waktu terukur  t', 'Measured time  t'),
  speedRead: L('Kecepatan  v', 'Speed  v'),
  fallen: L('Jarak jatuh  d', 'Distance fallen  d'),
  pred: L('Prediksi tanpa hambatan  √(2h/g)', 'No-drag prediction  √(2h/g)'),
  check: L('Uji  h = ½ g t²', 'Check  h = ½ g t²'),
  terminal: L('Kecepatan batas  v_t', 'Terminal speed  v_t'),
  graphTitle: L('Grafik v–t', 'The v–t graph'),
  graphLive: L('v terukur', 'measured v'),
  graphTheory: L('v tanpa hambatan', 'v without drag'),
  answerTitle: L('Jawabanmu', 'Your answer'),
  answerT: L('Prediksimu: waktu jatuh  t', 'Your prediction: fall time  t'),
  answerV: L('Bonus: kecepatan saat mendarat  v', 'Bonus: speed on landing  v'),
  checkBtn: L('Periksa jawaban', 'Check answer'),
  reveal: L('Jawaban sebenarnya', 'The actual answer'),
  statusTitle: L('Status', 'Status'),
  goal: L('Prediksi waktu jatuh dalam 2 %', 'Predict the fall time within 2 %'),
  goalDone: L('Tepat! Jatuh dalam {t} s.', 'Spot on! It falls in {t} s.'),
  ready: L('Siap menjatuhkan', 'Ready to drop'),
  readySub: L(
    'Prediksi dulu waktunya, lalu tekan Jatuhkan dan bandingkan dengan stopwatch.',
    'Predict the time first, then press Drop and compare it with the stopwatch.',
  ),
  empty: L('Isi dulu prediksimu', 'Fill in your prediction first'),
  emptySub: L(
    'Tulis perkiraan waktu jatuh dalam detik, lalu tekan Periksa.',
    'Type your estimate of the fall time in seconds, then press Check.',
  ),
  correct: L('BENAR', 'CORRECT'),
  correctSub: L(
    't = {t} s. Stopwatch akan berhenti tepat di angka itu.',
    't = {t} s. The stopwatch will stop exactly there.',
  ),
  correctDragSub: L(
    't = {t} s dengan hambatan udara. Tanpa hambatan, rumus √(2h/g) memberi {v} s — ' +
      'udara memperlambat jatuhnya.',
    't = {t} s with air resistance. Without it √(2h/g) gives {v} s — the air slows the fall.',
  ),
  wrong: L('BELUM TEPAT', 'NOT QUITE'),
  wrongSub: L(
    'Kamu menulis {a} s, jawabannya {t} s (selisih {d} s). Ingat t = √(2h/g).',
    'You wrote {a} s; the answer is {t} s (off by {d} s). Remember t = √(2h/g).',
  ),
  wrongDragSub: L(
    'Kamu menulis {a} s, tetapi dengan hambatan udara benda jatuh {t} s. ' +
      'Tanpa hambatan rumusnya memberi {v} s.',
    'You wrote {a} s, but with air resistance it falls in {t} s. ' +
      'Without drag the formula gives {v} s.',
  ),
  speedOk: L('Kecepatanmu juga benar: {v} m/s.', 'Your speed is right too: {v} m/s.'),
  speedBad: L(
    'Kecepatan saat mendarat {v} m/s, bukan {a} m/s.',
    'The landing speed is {v} m/s, not {a} m/s.',
  ),
  howTitle: L('Mengapa massa tidak berpengaruh?', 'Why does the mass not matter?'),
  howBody: L(
    'Gravitasi menarik setiap benda dengan gaya <code>W = m g</code>, dan gaya itu sendiri ' +
      'sudah sebanding dengan massa. Percepatannya <code>a = W / m = g</code> — massa saling ' +
      'menghapus. Itulah sebabnya bola baja dan bulu jatuh dalam waktu yang sama asal tidak ada udara: ' +
      '<code>h = ½ g t²</code> dan <code>v = √(2 g h)</code> tidak memuat m sama sekali.<br><br>' +
      'Hambatan udara berbeda: gayanya bergantung pada bentuk dan kecepatan, ' +
      '<code>F = ½ ρ C_d A v²</code>, bukan pada massa. Percepatan yang ditimbulkannya ' +
      '<code>F / m</code> justru makin besar untuk benda ringan — karena itu bulu melayang pelan ' +
      'sementara bola baja nyaris tidak terpengaruh. Saat hambatan sama dengan berat, benda mencapai ' +
      '<b>kecepatan batas</b> <code>v_t = √(m g / k)</code> dan jatuh lurus beraturan.',
    'Gravity pulls every object with a force <code>W = m g</code>, and that force is itself ' +
      'proportional to the mass. The acceleration is <code>a = W / m = g</code> — the mass cancels. ' +
      'That is why a steel ball and a feather fall in the same time when there is no air: ' +
      '<code>h = ½ g t²</code> and <code>v = √(2 g h)</code> do not contain m at all.<br><br>' +
      'Air resistance is different: its force depends on shape and speed, ' +
      '<code>F = ½ ρ C_d A v²</code>, not on mass. The acceleration it causes, <code>F / m</code>, ' +
      'is large for a light object — which is why a feather drifts down slowly while a steel ball ' +
      'barely notices the air. When drag balances weight the object reaches its ' +
      '<b>terminal speed</b> <code>v_t = √(m g / k)</code> and falls at a steady rate.',
  ),
}

class FreeFallLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext

  /* scene */
  private carrier!: THREE.Group
  private bodyGroups!: Record<BodyId, THREE.Group>
  private arrowV!: ReturnType<typeof makeArrow>
  private hMarker!: THREE.Mesh
  private hLine!: THREE.Mesh
  private landing!: THREE.Mesh
  private heightLabel!: ReturnType<typeof makeLabel>
  private stopwatch!: ReturnType<typeof makeLabel>

  /* state */
  private height = 20 // metres, measured from the ground
  private planet: PlanetId = 'earth'
  private bodyId: BodyId = 'steel'
  private dragOn = false
  private showGraph = true

  private phase: Phase = 'ready'
  /** height of the object's underside above the ground, in metres */
  private y = 20
  /** downward is positive — one sign convention for the whole lab */
  private v = 0
  private time = 0
  /** leftover between fixed steps, so the fall is reproducible */
  private acc = 0

  private answerT = 0
  private answerV = 0
  private checked = false

  private truth = { t: 0, v: 0 }
  private trace: { x: number; y: number }[] = []
  private lastTrace = -1
  private grab: { offset: number } | null = null
  private sig = ''

  /* panel */
  private sHeight!: SliderHandle
  private segPlanet!: SegmentedHandle
  private segBody!: SegmentedHandle
  private tglDrag!: ToggleHandle
  private tglGraph!: ToggleHandle
  private ansT!: NumberHandle
  private ansV!: NumberHandle
  private rH!: Readout
  private rG!: Readout
  private rM!: Readout
  private rT!: Readout
  private rV!: Readout
  private rD!: Readout
  private rPred!: Readout
  private rCheck!: Readout
  private rVt!: Readout
  private rReveal!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle
  private graphHost: HTMLElement | null = null
  private plot: Plot | null = null

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'freefall-lab'
    this.build()
    this.y = this.height
    this.refreshTruth()
    this.applyScene()
    /* the platform calls buildPanel() once, after this constructor returns */
  }

  /* -------------------------------------------------------------- helpers */
  private get gravity(): number {
    return GRAVITY[this.planet]
  }

  private get vacuumTime(): number {
    return Math.sqrt((2 * this.height) / this.gravity)
  }

  private get vacuumSpeed(): number {
    return Math.sqrt(2 * this.gravity * this.height)
  }

  /* ---------------------------------------------------------------- scene */
  private build(): void {
    const root = this.root

    /* ---- the ground: the zero of the height scale ---- */
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x232c3a,
      roughness: 0.95,
      metalness: 0.05,
    })
    const ground = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.3, 5.2), groundMat)
    ground.position.set(-0.9, -0.15, 0)
    ground.receiveShadow = true
    root.add(ground)

    /* a bright lip along the front edge makes the ground line unmistakable */
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 0.035, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x46586f }),
    )
    lip.position.set(-0.9, 0.012, 2.58)
    root.add(lip)

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.36, 0.05, 26),
      new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.9 }),
    )
    /* the top sits a hair above the ground so it never z-fights with it */
    pad.position.set(OBJ_X, -0.015, OBJ_Z)
    pad.receiveShadow = true
    root.add(pad)

    /* the landing marker only appears once the object is down */
    this.landing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.022, 8, 32),
      new THREE.MeshStandardMaterial({
        color: C.output,
        emissive: C.output,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      }),
    )
    this.landing.rotation.x = Math.PI / 2
    this.landing.position.set(OBJ_X, 0.06, OBJ_Z)
    this.landing.visible = false
    root.add(this.landing)

    /* ---- the tower ---- */
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x4d5b70,
      roughness: 0.72,
      metalness: 0.2,
    })
    const tower = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, TOWER_TOP, TOWER_D), towerMat)
    tower.position.set(TOWER_X, TOWER_TOP / 2, 0)
    tower.castShadow = true
    tower.receiveShadow = true
    root.add(tower)

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W + 0.5, 0.34, TOWER_D + 0.5),
      towerMat,
    )
    base.position.set(TOWER_X, 0.17, 0)
    base.castShadow = true
    base.receiveShadow = true
    root.add(base)

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W + 0.24, 0.1, TOWER_D + 0.24),
      towerMat,
    )
    cap.position.set(TOWER_X, TOWER_TOP + 0.05, 0)
    cap.castShadow = true
    root.add(cap)

    /* ---- the height scale up the tower ---- */
    const faceZ = TOWER_D / 2 + 0.02
    const tickGeo = new THREE.BoxGeometry(0.22, 0.016, 0.03)
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x93a6bd })
    for (let m = 1; m <= H_MAX; m++) {
      const tick = new THREE.Mesh(tickGeo, tickMat)
      tick.position.set(TOWER_X + TOWER_W / 2 - 0.11, m * WS, faceZ)
      root.add(tick)
    }
    /* a number every five metres is enough to read a height off the tower */
    for (let m = 5; m <= H_MAX; m += 5) {
      const label = makeLabel(`${m} m`, { color: C.neutral, size: 34, scale: 0.0046 })
      label.position.set(TOWER_X - 0.05, m * WS, faceZ + 0.02)
      root.add(label)
    }

    const markerMat = new THREE.MeshBasicMaterial({ color: 0x38d6c4 })
    this.hMarker = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, 0.045, 0.05), markerMat)
    this.hMarker.position.set(TOWER_X, this.height * WS, faceZ + 0.03)
    root.add(this.hMarker)

    /* a short tie from the scale to the object: "this is your h" */
    const gap = OBJ_X - (TOWER_X + TOWER_W / 2)
    this.hLine = new THREE.Mesh(new THREE.BoxGeometry(gap, 0.028, 0.028), markerMat)
    this.hLine.position.set(TOWER_X + TOWER_W / 2 + gap / 2, this.height * WS, OBJ_Z)
    root.add(this.hLine)

    this.heightLabel = makeLabel('', {
      color: C.input,
      size: 38,
      scale: 0.0048,
      border: 'rgba(56,214,196,0.7)',
    })
    this.heightLabel.position.set(TOWER_X - 1.05, this.height * WS, 0.2)
    root.add(this.heightLabel)

    /* ---- the three objects, one visible at a time ---- */
    this.carrier = new THREE.Group()
    this.carrier.name = 'freefall-object'
    root.add(this.carrier)

    const steel = new THREE.Group()
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 26, 18),
      new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.22, metalness: 0.9 }),
    )
    ball.castShadow = true
    /* the seam keeps the sphere from reading as a flat grey disc */
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.151, 0.008, 6, 30),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    seam.rotation.x = Math.PI / 2
    steel.add(ball, seam)

    const wood = makeCrate(0.26, 0.26, 0.26, C.crate)

    const feather = new THREE.Group()
    const quill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.42, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8c8a2, roughness: 0.85 }),
    )
    quill.rotation.z = Math.PI / 2
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xf4eddc, roughness: 0.9 }),
    )
    vane.position.set(0.02, 0.06, 0)
    vane.rotation.z = 0.12
    feather.add(quill, vane)
    feather.rotation.z = -0.45

    this.bodyGroups = { steel, wood, feather }
    this.carrier.add(steel, wood, feather)

    /* ---- the velocity arrow ---- */
    this.arrowV = makeArrow(C.output, { labelSide: 0.9 })
    root.add(this.arrowV)

    /* ---- the stopwatch: the instrument the student measures with ---- */
    const postMat = new THREE.MeshStandardMaterial({
      color: C.steelDark,
      roughness: 0.5,
      metalness: 0.5,
    })
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.06, 20), postMat)
    foot.position.set(0.95, 0.03, 0.05)
    foot.receiveShadow = true
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 1.15, 10), postMat)
    post.position.set(0.95, 0.6, 0.05)
    post.castShadow = true
    root.add(foot, post)

    this.stopwatch = makeLabel('t = 0.00 s', {
      color: C.input,
      size: 46,
      scale: 0.006,
      border: 'rgba(56,214,196,0.8)',
    })
    this.stopwatch.position.set(0.95, 1.42, 0.05)
    root.add(this.stopwatch)
  }

  /* --------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    const drop = panel.section(t(S.dropTitle))

    this.sHeight = drop.slider({
      label: t(S.height),
      min: H_MIN,
      max: H_MAX,
      step: 0.5,
      value: this.height,
      format: (v) => `${num(v, 1)} m`,
      onInput: (v) => this.setHeight(v),
    })

    this.segPlanet = drop.segmented({
      items: [
        { value: 'earth', label: t(S.earth), sub: `${num(GRAVITY.earth, 2)} m/s²` },
        { value: 'moon', label: t(S.moon), sub: `${num(GRAVITY.moon, 2)} m/s²` },
        { value: 'mars', label: t(S.mars), sub: `${num(GRAVITY.mars, 2)} m/s²` },
      ],
      value: this.planet,
      cols: 3,
      onChange: (v) => {
        this.planet = v as PlanetId
        this.arm()
      },
    })

    this.segBody = drop.segmented({
      items: [
        { value: 'steel', label: t(BODIES.steel.name), sub: `${num(BODIES.steel.mass, 1)} kg` },
        { value: 'wood', label: t(BODIES.wood.name), sub: `${num(BODIES.wood.mass, 1)} kg` },
        {
          value: 'feather',
          label: t(BODIES.feather.name),
          sub: `${num(BODIES.feather.mass * 1000, 0)} g`,
        },
      ],
      value: this.bodyId,
      cols: 3,
      onChange: (v) => {
        this.bodyId = v as BodyId
        this.arm()
      },
    })

    this.tglDrag = drop.toggle({
      label: t(S.air),
      value: this.dragOn,
      onChange: (v) => {
        this.dragOn = v
        this.arm()
      },
    })

    this.tglGraph = drop.toggle({
      label: t(S.showGraph),
      value: this.showGraph,
      onChange: (v) => {
        this.showGraph = v
        if (this.graphHost) this.graphHost.style.display = v ? '' : 'none'
        this.ctx.invalidate()
      },
    })

    const actions = drop.el('div', 'row-2')
    const dropBtn = drop.el('button', 'btn btn-primary', t(S.dropBtn))
    const resetBtn = drop.el('button', 'btn btn-ghost', t(S.resetBtn))
    dropBtn.addEventListener('click', () => this.release())
    resetBtn.addEventListener('click', () => this.arm())
    actions.append(dropBtn, resetBtn)

    /* ---- measurements ---- */
    const meas = panel.section(t(S.measTitle))
    this.rH = meas.readout(t(S.heightRead))
    this.rG = meas.readout(t(S.gravRead))
    this.rM = meas.readout(t(S.massRead))
    meas.el('div', 'hr')
    /* the measured time and the formula prediction sit side by side — the
       whole point is to compare the two */
    this.rT = meas.readout(t(S.timeRead))
    this.rPred = meas.readout(t(S.pred))
    this.rV = meas.readout(t(S.speedRead))
    this.rD = meas.readout(t(S.fallen))
    meas.el('div', 'hr')
    this.rCheck = meas.readout(t(S.check))
    this.rVt = meas.readout(t(S.terminal))

    /* ---- the student's answer ---- */
    const ans = panel.section(t(S.answerTitle))
    this.ansT = ans.number({
      label: t(S.answerT),
      value: this.answerT,
      min: 0,
      max: 120,
      step: 0.01,
      suffix: 's',
      onChange: (v) => {
        this.answerT = Number.isFinite(v) ? v : 0
        this.ctx.invalidate()
      },
    })
    this.ansV = ans.number({
      label: t(S.answerV),
      value: this.answerV,
      min: 0,
      max: 200,
      step: 0.1,
      suffix: 'm/s',
      onChange: (v) => {
        this.answerV = Number.isFinite(v) ? v : 0
        this.ctx.invalidate()
      },
    })
    ans.button({ label: t(S.checkBtn), variant: 'primary', onClick: () => this.check() })
    this.rReveal = ans.readout(t(S.reveal))

    const st = panel.section(t(S.statusTitle))
    this.status = st.status()
    this.goal = st.goal(t(S.goal))

    /* ---- the live v–t graph ---- */
    const graph = panel.section(t(S.graphTitle))
    this.graphHost = graph.host
    this.plot = new Plot(graph.host, {
      title: 'v – t',
      xLabel: 't (s)',
      yLabel: 'v (m/s)',
      height: 140,
    })
    this.graphHost.style.display = this.showGraph ? '' : 'none'
    this.armGraph()

    /* ---- why mass cancels ---- */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)
  }

  /* ------------------------------------------------------------- actions */
  private setHeight(value: number): void {
    this.height = clamp(value, H_MIN, H_MAX)
    this.sHeight?.set(this.height)
    this.arm()
  }

  /** Back to the top — the drop is an event, not a state. */
  private arm(): void {
    this.phase = 'ready'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    this.checked = false
    this.refreshTruth()
    this.armGraph()
    this.ctx.invalidate()
  }

  private release(): void {
    this.phase = 'falling'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    this.armGraph()
    this.ctx.invalidate()
  }

  private check(): void {
    /* the verdict is derived in syncHud, so it survives a restore */
    this.checked = true
    this.ctx.invalidate()
  }

  /* ------------------------------------------------------------- physics */
  private refreshTruth(): void {
    this.truth = this.solve()
  }

  /**
   * The fall the student is about to watch, computed ahead of time.
   * Without drag the closed form is exact; with drag we run the very same
   * fixed-step integrator as the live simulation, so the answer key and the
   * stopwatch can never disagree.
   */
  private solve(): { t: number; v: number } {
    const g = this.gravity
    if (!this.dragOn) {
      const time = Math.sqrt((2 * this.height) / g)
      return { t: time, v: g * time }
    }
    const k = DRAG_K / BODIES[this.bodyId].mass
    let y = this.height
    let v = 0
    let time = 0
    while (y > 0 && time < 240) {
      v += (g - k * v * Math.abs(v)) * FIXED
      y -= v * FIXED
      time += FIXED
    }
    return { t: time, v }
  }

  private stepPhysics(dt: number): void {
    const g = this.gravity
    const k = this.dragOn ? DRAG_K / BODIES[this.bodyId].mass : 0
    const a = g - k * this.v * Math.abs(this.v)
    this.v += a * dt
    this.y -= this.v * dt
    this.time += dt
    if (this.y <= 0) {
      this.y = 0
      this.phase = 'landed'
    }
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    if (this.phase === 'falling') {
      this.acc += dt
      /* a fixed accumulator makes the measured time reproducible — the same
         number every run, which is what a stopwatch is for */
      let guard = 0
      while (this.acc >= FIXED && this.phase === 'falling' && guard++ < 64) {
        this.stepPhysics(FIXED)
        this.acc -= FIXED
      }
      if (this.phase !== 'falling') this.acc = 0
    }

    const sig =
      `${this.height.toFixed(2)}|${this.planet}|${this.bodyId}|${this.dragOn}|${this.phase}|` +
      `${this.y.toFixed(3)}|${this.v.toFixed(3)}|${this.time.toFixed(3)}|` +
      `${this.answerT}|${this.answerV}|${this.checked}`
    if (sig === this.sig) return false
    this.sig = sig

    this.applyScene()
    if (this.phase !== 'ready') this.pushTrace()
    this.syncHud()
    return true
  }

  /* ----------------------------------------------------------------- graph */
  private armGraph(): void {
    this.trace = []
    this.lastTrace = -1
    const tMax = Math.max(1, Math.ceil(Math.max(this.truth.t, this.vacuumTime) * 1.2 * 2) / 2)
    const vMax = Math.max(1, Math.ceil(Math.max(this.truth.v, this.vacuumSpeed) * 1.1))
    this.plot?.setXRange(0, tMax)
    this.plot?.setYRange(0, vMax)
    this.plot?.setSeries(this.buildSeries())
  }

  private pushTrace(): void {
    if (this.time <= this.lastTrace + 1e-4) return
    if (this.phase === 'falling' && this.time - this.lastTrace < 0.05) return
    this.lastTrace = this.time
    this.trace.push({ x: this.time, y: this.v })
    this.plot?.setSeries(this.buildSeries())
  }

  private buildSeries(): PlotSeries[] {
    const live: PlotSeries = {
      name: t(S.graphLive),
      color: C.output,
      points: this.trace,
    }
    if (!this.dragOn) return [live]

    /* the vacuum line is the straight v = g t the formula promises — the gap
       between the two is exactly what the air costs */
    const theory: { x: number; y: number }[] = []
    const end = this.vacuumTime
    for (let i = 0; i <= 40; i++) {
      const tt = (end * i) / 40
      theory.push({ x: tt, y: this.gravity * tt })
    }
    return [live, { name: t(S.graphTheory), color: C.input, points: theory, dashed: true }]
  }

  /* --------------------------------------------------------------- scene */
  private applyScene(): void {
    const body = BODIES[this.bodyId]
    for (const id of BODY_IDS) this.bodyGroups[id].visible = id === this.bodyId

    /* a feather is the one thing the air really pushes around: a gentle sway
       says it without touching any geometry */
    const flutter = this.dragOn && this.bodyId === 'feather' && this.phase === 'falling'
    const cx = flutter ? OBJ_X + 0.07 * Math.sin(this.time * 6.3) : OBJ_X
    const cz = flutter ? OBJ_Z + 0.05 * Math.sin(this.time * 4.1 + 1.2) : OBJ_Z

    this.carrier.position.set(cx, this.y * WS + body.half, cz)
    this.carrier.rotation.z = flutter ? 0.4 * Math.sin(this.time * 5.1) : 0
    this.carrier.rotation.y = flutter ? 0.3 * Math.sin(this.time * 3.3) : 0

    const vLen = this.v > 0.03 ? 0.3 + 2.0 * Math.min(1, this.v / 25) : 0
    this.arrowV.set(
      new THREE.Vector3(cx, this.carrier.position.y - body.half, cz + 0.06),
      new THREE.Vector3(0, -1, 0),
      vLen,
    )
    this.arrowV.userData.setLabel(`v = ${num(this.v, 2)} m/s`)

    const hY = this.height * WS
    this.hMarker.position.y = hY
    this.hLine.position.y = hY
    this.heightLabel.position.y = hY
    this.heightLabel.userData.setText(`h = ${num(this.height, 1)} m`)

    this.stopwatch.userData.setText(`t = ${num(this.time, 2)} s`)
    this.landing.visible = this.phase === 'landed'
  }

  /* --------------------------------------------------------------- panel */
  private syncHud(): void {
    const g = this.gravity
    const h = this.height
    const m = BODIES[this.bodyId].mass
    const fallen = h - this.y
    const check = 0.5 * g * this.time * this.time
    const landed = this.phase === 'landed'

    this.rH.set(`${num(h, 1)} m`, 'input')
    this.rG.set(`${num(g, 2)} m/s²`, 'neutral')
    this.rM.set(m < 0.05 ? `${num(m * 1000, 0)} g` : `${num(m, 2)} kg`, 'neutral')
    this.rT.set(`${num(this.time, 2)} s`, landed ? 'result' : 'neutral')
    this.rV.set(`${num(this.v, 2)} m/s`, this.v > 0 ? 'output' : 'neutral')
    this.rD.set(`${num(fallen, 2)} m`, 'neutral')
    this.rPred.set(`${num(this.vacuumTime, 2)} s`, 'neutral')

    /* the formula is only allowed to pass when the object has actually landed
       and there was no air — with drag it must visibly disagree with h */
    if (landed) {
      const ok = Math.abs(check - h) <= Math.max(0.05, 0.01 * h)
      this.rCheck.set(`${num(check, 2)} m · h = ${num(h, 1)} m`, ok ? 'result' : 'warn')
    } else {
      this.rCheck.set(`${num(check, 2)} m`, 'neutral')
    }

    this.rVt.set(this.dragOn ? `${num(Math.sqrt((m * g) / DRAG_K), 2)} m/s` : '—', 'neutral')
    this.rReveal.set(
      this.checked ? `t = ${num(this.truth.t, 2)} s · v = ${num(this.truth.v, 2)} m/s` : '—',
      this.checked ? 'result' : 'neutral',
    )

    this.syncStatus()
  }

  private syncStatus(): void {
    if (!this.checked) {
      this.status.set(`${t(S.ready)}<span class="sub">${t(S.readySub)}</span>`, 'neutral')
      this.goal.setDone(false, t(S.goal))
      return
    }
    if (!Number.isFinite(this.answerT) || this.answerT <= 0) {
      this.status.set(`${t(S.empty)}<span class="sub">${t(S.emptySub)}</span>`, 'warn')
      this.goal.setDone(false, t(S.goal))
      return
    }

    const truth = this.truth
    const gap = Math.abs(this.answerT - truth.t)
    const tol = Math.max(0.05, 0.02 * truth.t)
    const correct = gap <= tol

    /* the speed question is a bonus — it is only judged when it was filled in */
    const vGiven = Number.isFinite(this.answerV) && this.answerV > 0
    const vOk = vGiven && Math.abs(this.answerV - truth.v) <= Math.max(0.3, 0.02 * truth.v)
    const vNote = vGiven
      ? ' ' +
        (vOk
          ? tf(S.speedOk, { v: num(this.answerV, 2) })
          : tf(S.speedBad, { v: num(truth.v, 2), a: num(this.answerV, 2) }))
      : ''

    if (correct) {
      const sub = this.dragOn
        ? tf(S.correctDragSub, { t: num(truth.t, 2), v: num(this.vacuumTime, 2) })
        : tf(S.correctSub, { t: num(truth.t, 2) })
      this.status.set(`${t(S.correct)}<span class="sub">${sub}${vNote}</span>`, 'result')
      this.goal.setDone(true, tf(S.goalDone, { t: num(truth.t, 2) }))
    } else {
      const sub = this.dragOn
        ? tf(S.wrongDragSub, {
            a: num(this.answerT, 2),
            t: num(truth.t, 2),
            v: num(this.vacuumTime, 2),
          })
        : tf(S.wrongSub, {
            a: num(this.answerT, 2),
            t: num(truth.t, 2),
            d: num(gap, 2),
          })
      this.status.set(`${t(S.wrong)}<span class="sub">${sub}${vNote}</span>`, 'bad')
      this.goal.setDone(false, t(S.goal))
    }
  }

  /* ---------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.carrier])
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, OBJ_Z)
    if (!p) return false

    /* grabbing a moving object stops it — the student is choosing a new height */
    if (this.phase !== 'ready') this.arm()
    const pointerH = p.y / WS - BODIES[this.bodyId].half
    this.grab = { offset: this.height - pointerH }
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.grab) {
      const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.carrier])
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, OBJ_Z)
    if (!p) return
    const raw = p.y / WS - BODIES[this.bodyId].half + this.grab.offset
    /* snap to the slider's step so dragging and the slider always agree */
    const snapped = Math.round(clamp(raw, H_MIN, H_MAX) * 2) / 2
    if (Math.abs(snapped - this.height) < 1e-4) return
    this.setHeight(snapped)
  }

  onPointerUp(): void {
    if (this.grab) {
      this.grab = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return {
      height: this.height,
      planet: this.planet,
      body: this.bodyId,
      drag: this.dragOn,
      graph: this.showGraph,
      answerT: this.answerT,
      answerV: this.answerV,
      checked: this.checked,
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, unknown>

    if (typeof s.height === 'number') this.height = clamp(s.height, H_MIN, H_MAX)
    if (typeof s.planet === 'string' && PLANET_IDS.includes(s.planet as PlanetId)) {
      this.planet = s.planet as PlanetId
    }
    if (typeof s.body === 'string' && BODY_IDS.includes(s.body as BodyId)) {
      this.bodyId = s.body as BodyId
    }
    if (typeof s.drag === 'boolean') this.dragOn = s.drag
    if (typeof s.graph === 'boolean') this.showGraph = s.graph
    if (typeof s.answerT === 'number') this.answerT = s.answerT
    if (typeof s.answerV === 'number') this.answerV = s.answerV
    if (typeof s.checked === 'boolean') this.checked = s.checked

    /* a half-finished fall is not worth restoring — come back to the top */
    this.phase = 'ready'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    this.refreshTruth()

    /* push the state back into every widget */
    this.sHeight?.set(this.height)
    this.segPlanet?.set(this.planet)
    this.segBody?.set(this.bodyId)
    this.tglDrag?.set(this.dragOn)
    this.tglGraph?.set(this.showGraph)
    this.ansT?.set(this.answerT)
    this.ansV?.set(this.answerV)
    if (this.graphHost) this.graphHost.style.display = this.showGraph ? '' : 'none'
    this.armGraph()
    this.ctx.invalidate()
  }

  dispose(): void {
    this.plot?.dispose()
    disposeObject(this.root)
  }
}

export default function createFreeFallLab(ctx: LabContext): LabInstance {
  return new FreeFallLab(ctx)
}
