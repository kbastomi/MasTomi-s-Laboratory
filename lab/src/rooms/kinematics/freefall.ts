import * as THREE from 'three'
import { L, num, t, tf, type Localized } from '../../core/i18n'
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
 * In vacuum a steel ball and a feather land together; the whole lesson is to
 * make that unmistakable and then let the air break it. Without drag the
 * motion has a closed form, so it is evaluated exactly and the stopwatch
 * agrees with √(2h/g) to the digit. With drag we integrate the very same
 * fixed-step equation the answer key uses, so the stopwatch can never argue
 * with the revealed answer.
 *
 * The tower is drawn at WS world units per metre so a 30 m tower still fits
 * the room (fog, shadow camera). A catalogue entry should frame it with
 * `{ target: [-1.2, 5.0, 0], radius: 15, azim: 0.12, polar: 1.36 }`.
 */

/* ------------------------------------------------------------------ scene */
const WS = 0.34     // world units per metre
const H_MIN = 1     // shortest drop, metres
const H_MAX = 30    // tallest drop, metres
const TOWER_X = -3.1
const TOWER_W = 1.1
const TOWER_D = 1.2
const TOWER_TOP = H_MAX * WS
const OBJ_X = -1.95 // the fall line, just in front of the tower
const OBJ_Z = 0.25  // the plane the object is dragged in
const FACE_Z = TOWER_D / 2 + 0.02

/* ---------------------------------------------------------------- physics */
/**
 * One drag constant for all three bodies, on purpose: they have the same size
 * and the same frontal area, so mass is the only variable left and
 * `a_drag = (k/m)·v²` is the entire story. k = 0.02 with the masses below
 * lands the steel ball at ≈2.04 s, the block at ≈2.25 s and the feather at
 * ≈12.9 s from 20 m on Earth; the feather's terminal speed is √(mg/k) ≈ 1.6
 * m/s. Verified against this integrator, step for step.
 */
const DRAG_K = 0.02
/** fixed step — the live fall and the answer key must be the same motion */
const FIXED = 1 / 240
/** safety net for the per-frame accumulator (24 steps already cover dt = 0.1 s) */
const STEP_CAP = 32
/** cadence at which the graph samples a running fall */
const TRACE_DT = 0.05

type PlanetId = 'earth' | 'moon' | 'mars'
type BodyId = 'steel' | 'wood' | 'feather'
type Phase = 'ready' | 'falling' | 'landed'

const GRAVITY: Record<PlanetId, number> = { earth: G, moon: 1.62, mars: 3.72 }
const PLANET_IDS: PlanetId[] = ['earth', 'moon', 'mars']
const BODY_IDS: BodyId[] = ['steel', 'wood', 'feather']

interface BodySpec {
  /** kg — enters the equations only through the drag term */
  mass: number
  /** half of the display size, for standing the body on y = 0 */
  half: number
  name: Localized
}

const BODIES: Record<BodyId, BodySpec> = {
  steel:   { mass: 8,     half: 0.15, name: L('Bola baja', 'Steel ball') },
  wood:    { mass: 0.6,   half: 0.13, name: L('Balok kayu', 'Wooden block') },
  feather: { mass: 0.005, half: 0.08, name: L('Bulu', 'Feather') },
}

/* ------------------------------------------------------------------ texts */
const S = {
  /* sections and controls */
  setup: L('Penyiapan — jatuh bebas', 'Setup — free fall'),
  height: L('Tinggi jatuh  h', 'Drop height  h'),
  earth: L('Bumi', 'Earth'),
  moon: L('Bulan', 'Moon'),
  mars: L('Mars', 'Mars'),
  air: L('Hambatan udara', 'Air resistance'),
  showGraph: L('Grafik v–t', 'Show the v–t graph'),
  dropBtn: L('▼ Jatuhkan', '▼ Drop'),
  resetBtn: L('↺ Atur ulang', '↺ Reset'),

  /* measurements */
  meas: L('Pengukuran', 'Measurements'),
  heightRead: L('Tinggi jatuh  h', 'Drop height  h'),
  gravRead: L('Gravitasi  g', 'Gravity  g'),
  massRead: L('Massa benda  m', 'Object mass  m'),
  timeRead: L('Waktu jatuh  t  (terukur)', 'Fall time  t  (measured)'),
  predRead: L('Prediksi rumus  √(2h/g)', 'Formula prediction  √(2h/g)'),
  speedRead: L('Kecepatan  v', 'Speed  v'),
  fallenRead: L('Jarak jatuh  d', 'Distance fallen  d'),
  checkRead: L('Uji  h = ½ g t²', 'Check  h = ½ g t²'),
  termRead: L('Kecepatan batas  v_t', 'Terminal speed  v_t'),

  /* the live graph */
  graphTitle: L('Grafik v–t', 'The v–t graph'),
  graphLive: L('v terukur', 'measured v'),
  graphModel: L('v tanpa hambatan', 'v without drag'),

  /* the student's answer */
  answer: L('Jawabanmu', 'Your answer'),
  answerT: L('Prediksi waktu jatuh  t', 'Your predicted fall time  t'),
  answerV: L('Bonus: kecepatan mendarat  v', 'Bonus: landing speed  v'),
  checkBtn: L('Periksa jawaban', 'Check answer'),
  reveal: L('Kunci jawaban', 'Answer key'),

  /* status */
  goal: L('Prediksi waktu jatuh dalam 2 %', 'Predict the fall time within 2 %'),
  goalDone: L('Tepat! Jatuh dalam {t} s.', 'Spot on! It falls in {t} s.'),
  ready: L('PREDIKSI DULU', 'PREDICT FIRST'),
  readySub: L(
    'Tulis perkiraan waktu jatuhmu, tekan Periksa, lalu Jatuhkan — stopwatch di lantai adalah jurinya.',
    'Type your predicted fall time, press Check, then Drop — the stopwatch on the floor is the judge.',
  ),
  empty: L('ISI DULU PREDIKSIMU', 'FILL IN YOUR PREDICTION'),
  emptySub: L(
    'Tulis perkiraan waktu jatuh dalam detik, lalu tekan Periksa.',
    'Type your estimate of the fall time in seconds, then press Check.',
  ),
  falling: L('SEDANG JATUH…', 'FALLING…'),
  fallingSub: L(
    'stopwatch {t} s — prediksi rumus {p} s.',
    'stopwatch {t} s — formula prediction {p} s.',
  ),
  landed: L('MENDARAT', 'LANDED'),
  landedSub: L(
    'stopwatch berhenti di {t} s. Prediksi rumus: {p} s.',
    'the stopwatch stopped at {t} s. The formula predicted: {p} s.',
  ),
  landedDragSub: L(
    'stopwatch berhenti di {t} s — dengan udara. Tanpa hambatan hanya {p} s.',
    'the stopwatch stopped at {t} s — with the air. Without drag just {p} s.',
  ),
  correct: L('BENAR', 'CORRECT'),
  correctSub: L(
    't = {t} s. Stopwatch akan berhenti tepat di angka itu.',
    't = {t} s. The stopwatch will stop exactly there.',
  ),
  correctDragSub: L(
    't = {t} s dengan hambatan udara. Tanpa hambatan rumus memberi {v} s — udara memperlambat jatuhmu.',
    't = {t} s with air resistance. Without it the formula gives {v} s — the air slows your fall.',
  ),
  wrong: L('BELUM TEPAT', 'NOT QUITE'),
  wrongSub: L(
    'Kamu menulis {a} s; jawabannya {t} s (selisih {d} s). Ingat t = √(2h/g).',
    'You wrote {a} s; the answer is {t} s (off by {d} s). Remember t = √(2h/g).',
  ),
  wrongDragSub: L(
    'Kamu menulis {a} s, tetapi dengan hambatan udara ia jatuh {t} s. Tanpa hambatan rumusnya memberi {v} s.',
    'You wrote {a} s, but with air resistance it lands after {t} s. Without drag the formula gives {v} s.',
  ),
  speedOk: L('Kecepatan mendaratmu juga benar: {v} m/s.', 'Your landing speed is right too: {v} m/s.'),
  speedBad: L('Kecepatan mendaratnya {v} m/s, bukan {a} m/s.', 'The landing speed is {v} m/s, not {a} m/s.'),

  /* explanation */
  howTitle: L('Mengapa massa tidak berpengaruh?', 'Why does mass not matter?'),
  howBody: L(
    'Gravitasi menarik setiap benda dengan gaya <code>W = m g</code> — gaya itu sendiri sudah ' +
      'sebanding dengan massa. Percepatan <code>a = W / m = g</code>: massa saling menghapus. ' +
      'Itulah mengapa bola baja dan bulu mendarat bersamaan saat tidak ada udara — ' +
      '<code>h = ½ g t²</code> dan <code>v = √(2 g h)</code> tidak mengenal <b>m</b> sama sekali.<br><br>' +
      'Hambatan udara lain halnya: gayanya <code>F = ½ ρ C_d A v²</code>, bergantung pada bentuk dan ' +
      'kecepatan — bukan massa. Dibagi massa, perlambatannya <code>F / m</code> justru besar untuk ' +
      'benda ringan; karena itu bulu melayang pelan sementara bola baja nyaris tidak terpengaruh. ' +
      'Saat hambatan tepat menyetarakan berat, benda berhenti mempercepat dan turun lurus dengan ' +
      '<b>kecepatan batas</b> <code>v_t = √(m g / k)</code>.',
    'Gravity pulls every object with the force <code>W = m g</code> — that force is already ' +
      'proportional to the mass. The acceleration <code>a = W / m = g</code>: the mass cancels. ' +
      'That is why a steel ball and a feather land together in vacuum — <code>h = ½ g t²</code> and ' +
      '<code>v = √(2 g h)</code> never contain <b>m</b> at all.<br><br>' +
      'Air resistance is different: its force is <code>F = ½ ρ C_d A v²</code> — it depends on shape ' +
      'and speed, not mass. Divided by the mass, the deceleration <code>F / m</code> is huge for a ' +
      'light object; that is why a feather drifts down slowly while a steel ball barely notices. ' +
      'Once drag exactly balances the weight the object stops accelerating and falls straight at its ' +
      '<b>terminal speed</b> <code>v_t = √(m g / k)</code>.',
  ),
}

class FreeFallLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext

  /* scene */
  private carrier!: THREE.Group
  private bodies!: Record<BodyId, THREE.Group>
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
  /** leftovers between fixed steps, so a fall is frame-rate independent */
  private acc = 0

  private answerT = 0
  private answerV = 0
  /** true only while the verdict on screen belongs to the current answer */
  private checked = false

  /** the answer key: the fall the student is about to watch, solved ahead */
  private truth = { t: 0, v: 0 }
  private trace: { x: number; y: number }[] = []
  private lastTrace = -1
  private grab: { offset: number } | null = null
  private sig = ''

  /* panel widgets */
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
  private rPred!: Readout
  private rV!: Readout
  private rD!: Readout
  private rCheck!: Readout
  private rTerm!: Readout
  private rReveal!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle
  private graphHost: HTMLElement | null = null
  private plot: Plot | null = null

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'freefall-lab'
    this.build()
    this.refreshTruth()
    this.applyScene()
    /* the platform calls buildPanel() exactly once, after this constructor */
  }

  /* ------------------------------------------------------------- helpers */
  private get g(): number {
    return GRAVITY[this.planet]
  }

  private get body(): BodySpec {
    return BODIES[this.bodyId]
  }

  private get vacuumTime(): number {
    return Math.sqrt((2 * this.height) / this.g)
  }

  private get vacuumSpeed(): number {
    return Math.sqrt(2 * this.g * this.height)
  }

  /* ---------------------------------------------------------------- scene */
  private build(): void {
    const root = this.root

    /* ---- the landing apron: the zero of the height scale ---- */
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 0.3, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 0.95, metalness: 0.05 }),
    )
    /* a hair above the room floor — an exact overlap would z-fight with it */
    ground.position.set(-0.9, -0.14, 0)
    ground.receiveShadow = true
    root.add(ground)

    /* a bright lip along the front edge marks the drop zone */
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(10.4, 0.03, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x46586f }),
    )
    lip.position.set(-0.9, 0.016, 2.56)
    root.add(lip)

    /* a pad where the object will land, plus the marker shown on arrival */
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.37, 0.06, 28),
      new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.9 }),
    )
    pad.position.set(OBJ_X, 0.012, OBJ_Z)
    pad.receiveShadow = true
    root.add(pad)

    this.landing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.024, 8, 34),
      new THREE.MeshStandardMaterial({
        color: C.output,
        emissive: C.output,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.2,
      }),
    )
    this.landing.rotation.x = Math.PI / 2
    this.landing.position.set(OBJ_X, 0.055, OBJ_Z)
    this.landing.visible = false
    root.add(this.landing)

    /* ---- the tower ---- */
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x4d5b70, roughness: 0.72, metalness: 0.2 })
    const tower = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, TOWER_TOP, TOWER_D), towerMat)
    tower.position.set(TOWER_X, TOWER_TOP / 2, 0)
    tower.castShadow = true
    tower.receiveShadow = true
    root.add(tower)

    const base = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W + 0.55, 0.4, TOWER_D + 0.6), towerMat)
    base.position.set(TOWER_X, 0.2, 0)
    base.castShadow = true
    base.receiveShadow = true
    root.add(base)

    const cap = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W + 0.26, 0.12, TOWER_D + 0.26), towerMat)
    cap.position.set(TOWER_X, TOWER_TOP + 0.06, 0)
    cap.castShadow = true
    root.add(cap)

    /* ---- the height scale up its front face ---- */
    const tickGeo = new THREE.BoxGeometry(0.24, 0.014, 0.03)
    const tickMat = new THREE.MeshBasicMaterial({ color: 0x8ea2ba })
    for (let m = 1; m <= H_MAX; m++) {
      const tick = new THREE.Mesh(tickGeo, tickMat)
      tick.position.set(TOWER_X + TOWER_W / 2 - 0.12, m * WS, FACE_Z)
      root.add(tick)
    }
    /* a number every five metres is enough to read a height off the tower */
    for (let m = 5; m <= H_MAX; m += 5) {
      const label = makeLabel(`${m} m`, { color: C.neutral, size: 30, scale: 0.0042 })
      label.position.set(TOWER_X - 0.16, m * WS, FACE_Z + 0.02)
      root.add(label)
    }

    /* the current drop height, marked across the face and tied to the object */
    const markMat = new THREE.MeshBasicMaterial({ color: 0x38d6c4 })
    this.hMarker = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W + 0.02, 0.045, 0.045), markMat)
    this.hMarker.position.set(TOWER_X, this.height * WS, FACE_Z + 0.04)
    root.add(this.hMarker)

    const gap = OBJ_X - TOWER_X - TOWER_W / 2
    this.hLine = new THREE.Mesh(new THREE.BoxGeometry(gap, 0.026, 0.026), markMat)
    this.hLine.position.set(TOWER_X + TOWER_W / 2 + gap / 2, this.height * WS, OBJ_Z)
    root.add(this.hLine)

    this.heightLabel = makeLabel('', {
      color: C.input,
      size: 36,
      scale: 0.0046,
      border: 'rgba(56,214,196,0.75)',
    })
    this.heightLabel.position.set(TOWER_X - 1.15, this.height * WS, 0.2)
    root.add(this.heightLabel)

    /* ---- the three bodies, one visible at a time ---- */
    this.carrier = new THREE.Group()
    this.carrier.name = 'freefall-object'
    root.add(this.carrier)

    const steel = new THREE.Group()
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 28, 20),
      new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.2, metalness: 0.9 }),
    )
    ball.castShadow = true
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(0.151, 0.0075, 6, 34),
      new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.4, metalness: 0.7 }),
    )
    seam.rotation.x = Math.PI / 2
    steel.add(ball, seam)

    const wood = makeCrate(0.26, 0.26, 0.26, C.crate)

    const feather = new THREE.Group()
    const quill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.012, 0.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8c8a2, roughness: 0.85 }),
    )
    quill.rotation.z = Math.PI / 2
    const vane = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.09, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xf2ecdb, roughness: 0.9 }),
    )
    vane.position.set(0.015, 0.05, 0)
    vane.rotation.z = 0.14
    feather.add(quill, vane)
    feather.rotation.z = -0.5

    this.bodies = { steel, wood, feather }
    this.carrier.add(steel, wood, feather)

    /* ---- the velocity arrow, growing as v builds up ---- */
    this.arrowV = makeArrow(C.output, { labelSide: -0.9 })
    root.add(this.arrowV)

    /* ---- the stopwatch: the instrument the student measures with ---- */
    const postMat = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.5, metalness: 0.6 })
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.06, 22), postMat)
    foot.position.set(0.95, 0.03, 0.05)
    foot.receiveShadow = true
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.042, 1.2, 12), postMat)
    post.position.set(0.95, 0.63, 0.05)
    post.castShadow = true
    root.add(foot, post)

    this.stopwatch = makeLabel('t = 0.00 s', {
      color: C.input,
      size: 46,
      scale: 0.006,
      border: 'rgba(56,214,196,0.8)',
    })
    this.stopwatch.position.set(0.95, 1.5, 0.05)
    root.add(this.stopwatch)
  }

  /* --------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    /* the panel is rebuilt on every language switch — the previous plot must
       not keep a resize listener behind on a detached canvas */
    this.plot?.dispose()
    this.plot = null

    /* ---- drop ---- */
    const setup = panel.section(t(S.setup))

    this.sHeight = setup.slider({
      label: t(S.height),
      min: H_MIN,
      max: H_MAX,
      step: 0.5,
      value: this.height,
      format: (v) => `${num(v, 1)} m`,
      onInput: (v) => this.setHeight(v),
    })

    this.segPlanet = setup.segmented({
      items: [
        { value: 'earth', label: t(S.earth), sub: `g = ${num(GRAVITY.earth, 2)} m/s²` },
        { value: 'moon', label: t(S.moon), sub: `g = ${num(GRAVITY.moon, 2)} m/s²` },
        { value: 'mars', label: t(S.mars), sub: `g = ${num(GRAVITY.mars, 2)} m/s²` },
      ],
      value: this.planet,
      cols: 3,
      onChange: (v) => {
        this.planet = v as PlanetId
        this.arm(true)
      },
    })

    /* same shape, same frontal area — the mass is the only variable left */
    this.segBody = setup.segmented({
      items: [
        { value: 'steel', label: t(BODIES.steel.name), sub: `${num(BODIES.steel.mass, 0)} kg` },
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
        this.arm(true)
      },
    })

    this.tglDrag = setup.toggle({
      label: t(S.air),
      value: this.dragOn,
      onChange: (v) => {
        this.dragOn = v
        this.arm(true)
      },
    })

    this.tglGraph = setup.toggle({
      label: t(S.showGraph),
      value: this.showGraph,
      onChange: (v) => {
        this.showGraph = v
        if (this.graphHost) this.graphHost.style.display = v ? '' : 'none'
        this.plot?.resize() // re-measure the canvas now it is visible again
        this.ctx.invalidate()
      },
    })

    const actions = setup.el('div', 'row-2')
    const dropBtn = setup.el('button', 'btn btn-primary', t(S.dropBtn))
    const resetBtn = setup.el('button', 'btn btn-ghost', t(S.resetBtn))
    dropBtn.addEventListener('click', () => this.drop())
    resetBtn.addEventListener('click', () => this.arm(false))
    actions.append(dropBtn, resetBtn)

    /* ---- measurements ---- */
    const meas = panel.section(t(S.meas))
    this.rH = meas.readout(t(S.heightRead))
    this.rG = meas.readout(t(S.gravRead))
    this.rM = meas.readout(t(S.massRead))
    meas.el('div', 'hr')
    /* the measured time sits right next to the formula's prediction —
       the comparison is the entire point of the lab */
    this.rT = meas.readout(t(S.timeRead))
    this.rPred = meas.readout(t(S.predRead))
    this.rV = meas.readout(t(S.speedRead))
    this.rD = meas.readout(t(S.fallenRead))
    meas.el('div', 'hr')
    this.rCheck = meas.readout(t(S.checkRead))
    this.rTerm = meas.readout(t(S.termRead))

    /* ---- the student's answer ---- */
    const ans = panel.section(t(S.answer))
    this.ansT = ans.number({
      label: t(S.answerT),
      value: this.answerT,
      min: 0,
      max: 120,
      step: 0.01,
      suffix: 's',
      onChange: (v) => {
        this.answerT = Number.isFinite(v) ? v : 0
        this.checked = false // a freshly typed answer retires the old verdict
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
        this.checked = false
        this.ctx.invalidate()
      },
    })
    ans.button({ label: t(S.checkBtn), variant: 'primary', onClick: () => this.check() })
    this.rReveal = ans.readout(t(S.reveal))
    ans.el('div', 'hr')
    this.status = ans.status()
    this.goal = ans.goal(t(S.goal))

    /* ---- the live v–t graph ---- */
    const graph = panel.section(t(S.graphTitle))
    this.graphHost = graph.host
    this.plot = new Plot(graph.host, {
      title: 'v – t',
      xLabel: 't (s)',
      yLabel: 'v (m/s)',
      height: 150,
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
    const h = clamp(value, H_MIN, H_MAX)
    if (h === this.height) return
    this.height = h
    this.sHeight?.set(h) // dragging the object keeps the slider in step
    this.arm(true)
  }

  /** Back at the top with the stopwatch wound to zero. A drop is an event. */
  private arm(clearAnswer: boolean): void {
    this.phase = 'ready'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    if (clearAnswer) this.checked = false // the truth changed — verdicts expire
    this.refreshTruth()
    this.armGraph()
    this.ctx.invalidate()
  }

  private drop(): void {
    this.phase = 'falling'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    this.trace = []
    this.lastTrace = -1
    this.ctx.invalidate()
  }

  private check(): void {
    /* re-read the fields: whatever is typed right now is the answer */
    const ta = this.ansT.get()
    const va = this.ansV.get()
    this.answerT = Number.isFinite(ta) ? ta : 0
    this.answerV = Number.isFinite(va) ? va : 0
    this.checked = true
    this.ctx.invalidate()
  }

  /* ------------------------------------------------------------- physics */
  private refreshTruth(): void {
    this.truth = this.solve()
  }

  /**
   * The answer key. Without drag the closed form is exact; with drag the very
   * same fixed-step integrator as the live fall runs, so the stopwatch and
   * the revealed answer can never disagree.
   */
  private solve(): { t: number; v: number } {
    if (!this.dragOn) return { t: this.vacuumTime, v: this.vacuumSpeed }

    const g = this.g
    const k = DRAG_K / this.body.mass
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

  /** One fixed step of the live fall. Downward is positive throughout. */
  private stepPhysics(step: number): void {
    const g = this.g
    if (this.dragOn) {
      /* quadratic drag — the only place the mass enters this lab */
      const k = DRAG_K / this.body.mass
      this.v += (g - k * this.v * Math.abs(this.v)) * step
      this.y -= this.v * step
      this.time += step
    } else {
      /* no air: the closed form *is* the solution, so evaluate it directly.
         An integrator would only add drift to a motion physics already solved
         — and h = ½ g t² deserves a stopwatch that agrees to the digit. */
      const tt = Math.min(this.time + step, this.vacuumTime)
      this.time = tt
      this.v = g * tt
      this.y = Math.max(0, this.height - 0.5 * g * tt * tt)
    }
    if (this.y <= 0) this.land()
  }

  private land(): void {
    this.y = 0
    this.phase = 'landed'
    this.acc = 0
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    if (this.phase === 'falling') {
      /* fixed-step accumulator: whatever fps the device manages, the stopwatch
         shows the same fall every time — that is what makes a stopwatch a
         measurement instead of an animation */
      this.acc += dt
      let guard = 0
      while (this.acc >= FIXED && this.phase === 'falling' && guard++ < STEP_CAP) {
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

  /* ---------------------------------------------------------------- graph */
  private armGraph(): void {
    this.trace = []
    this.lastTrace = -1
    /* frame the axes around the fall the student is about to watch */
    const tMax = Math.max(1, Math.ceil(Math.max(this.truth.t, this.vacuumTime) * 1.2 * 2) / 2)
    const vMax = Math.max(1, Math.ceil(Math.max(this.truth.v, this.vacuumSpeed) * 1.1))
    this.plot?.setXRange(0, tMax)
    this.plot?.setYRange(0, vMax)
    this.plot?.setMarker(null)
    this.plot?.setSeries(this.buildSeries())
  }

  private pushTrace(): void {
    if (this.time <= this.lastTrace + 1e-6) return
    if (this.phase === 'falling' && this.time - this.lastTrace < TRACE_DT) return
    this.lastTrace = this.time
    this.trace.push({ x: this.time, y: this.v })
    if (this.trace.length > 420) this.trace.shift()
    this.plot?.setMarker(this.time)
    this.plot?.setSeries(this.buildSeries())
  }

  private buildSeries(): PlotSeries[] {
    const live: PlotSeries = {
      name: t(S.graphLive),
      color: C.output,
      points: this.trace,
    }
    if (!this.dragOn) return [live]

    /* the dashed line is the straight v = g t the formula promises: the gap
       between it and the measured curve is exactly what the air costs */
    const theory: { x: number; y: number }[] = []
    const end = this.vacuumTime
    for (let i = 0; i <= 40; i++) {
      const tt = (end * i) / 40
      theory.push({ x: tt, y: this.g * tt })
    }
    return [live, { name: t(S.graphModel), color: C.input, points: theory, dashed: true }]
  }

  /* ---------------------------------------------------------------- scene */
  private applyScene(): void {
    const body = this.body
    for (const id of BODY_IDS) this.bodies[id].visible = id === this.bodyId

    /* the feather is the one body the air really pushes around — a gentle
       sway says so without touching any geometry */
    const flutter = this.dragOn && this.bodyId === 'feather' && this.phase === 'falling'
    const x = flutter ? OBJ_X + 0.07 * Math.sin(this.time * 6.3) : OBJ_X
    const z = flutter ? OBJ_Z + 0.05 * Math.sin(this.time * 4.1 + 1.2) : OBJ_Z

    this.carrier.position.set(x, this.y * WS + body.half, z)
    this.carrier.rotation.z = flutter ? 0.4 * Math.sin(this.time * 5.1) : 0
    this.carrier.rotation.y = flutter ? 0.3 * Math.sin(this.time * 3.3) : 0

    const len = this.v > 0.04 ? 0.3 + 2.0 * Math.min(1, this.v / 25) : 0
    this.arrowV.set(
      new THREE.Vector3(x, this.y * WS, z + 0.05),
      new THREE.Vector3(0, -1, 0),
      len,
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

  /* ----------------------------------------------------------------- hud */
  private syncHud(): void {
    const g = this.g
    const h = this.height
    const m = this.body.mass
    const fallen = h - this.y
    const landed = this.phase === 'landed'
    const check = 0.5 * g * this.time * this.time

    this.rH.set(`${num(h, 1)} m`, 'input')
    this.rG.set(`${num(g, 2)} m/s²`, 'neutral')
    this.rM.set(m < 0.1 ? `${num(m * 1000, 0)} g` : `${num(m, 2)} kg`, 'neutral')
    this.rT.set(
      `${num(this.time, 2)} s`,
      landed ? 'result' : this.time > 0 ? 'output' : 'neutral',
    )
    this.rPred.set(`${num(this.vacuumTime, 2)} s`, 'neutral')
    this.rV.set(`${num(this.v, 2)} m/s`, this.v > 0.005 ? 'output' : 'neutral')
    this.rD.set(`${num(fallen, 2)} m`, 'neutral')

    /* the formula may only pass when there was no air — with drag the
       measured fall must visibly disagree with h = ½ g t² */
    if (landed) {
      const ok = Math.abs(check - h) <= Math.max(0.05, 0.01 * h)
      this.rCheck.set(
        `${num(check, 2)} m ${ok ? '≈' : '≠'} h = ${num(h, 1)} m`,
        ok ? 'result' : 'warn',
      )
    } else {
      this.rCheck.set(`${num(check, 2)} m`, 'neutral')
    }

    this.rTerm.set(
      this.dragOn ? `${num(Math.sqrt((m * g) / DRAG_K), 2)} m/s` : '—',
      'neutral',
    )
    this.rReveal.set(
      this.checked
        ? `t = ${num(this.truth.t, 2)} s · v = ${num(this.truth.v, 2)} m/s`
        : '—',
      this.checked ? 'result' : 'neutral',
    )

    this.syncStatus()
  }

  private syncStatus(): void {
    /* without a current answer, the fall itself is the message */
    if (!this.checked) {
      if (this.phase === 'ready') {
        this.status.set(`${t(S.ready)}<span class="sub">${t(S.readySub)}</span>`, 'neutral')
      } else if (this.phase === 'falling') {
        this.status.set(
          `${t(S.falling)}<span class="sub">` +
            `${tf(S.fallingSub, { t: num(this.time, 2), p: num(this.vacuumTime, 2) })}</span>`,
          'neutral',
        )
      } else {
        const sub = this.dragOn
          ? tf(S.landedDragSub, { t: num(this.time, 2), p: num(this.vacuumTime, 2) })
          : tf(S.landedSub, { t: num(this.time, 2), p: num(this.vacuumTime, 2) })
        this.status.set(`${t(S.landed)}<span class="sub">${sub}</span>`, 'result')
      }
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

    /* the landing speed is a bonus — judged only when it was filled in */
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
    /* only the *visible* body is grabbable — the raycaster does not skip
       hidden meshes, and picking the see-through feather's shape would feel
       like grabbing empty air */
    const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.bodies[this.bodyId]])
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, OBJ_Z)
    if (!p) return false

    /* grabbing a falling object puts it back at the top — heights are chosen
       one fall at a time (a prediction already given stays standing) */
    if (this.phase !== 'ready') this.arm(false)
    const pointerH = p.y / WS - this.body.half
    this.grab = { offset: this.height - pointerH }
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.grab) {
      const hits = pick(event, this.ctx.camera, this.ctx.dom, [this.bodies[this.bodyId]])
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, OBJ_Z)
    if (!p) return
    const raw = p.y / WS - this.body.half + this.grab.offset
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
    if (typeof s.planet === 'string' && (PLANET_IDS as string[]).includes(s.planet)) {
      this.planet = s.planet as PlanetId
    }
    if (typeof s.body === 'string' && (BODY_IDS as string[]).includes(s.body)) {
      this.bodyId = s.body as BodyId
    }
    if (typeof s.drag === 'boolean') this.dragOn = s.drag
    if (typeof s.graph === 'boolean') this.showGraph = s.graph
    if (typeof s.answerT === 'number' && Number.isFinite(s.answerT)) this.answerT = s.answerT
    if (typeof s.answerV === 'number' && Number.isFinite(s.answerV)) this.answerV = s.answerV
    if (typeof s.checked === 'boolean') this.checked = s.checked

    /* a half-finished fall is not worth restoring — return to the top */
    this.phase = 'ready'
    this.y = this.height
    this.v = 0
    this.time = 0
    this.acc = 0
    this.refreshTruth()

    /* push every value back into the widgets — restore also runs after a
       language switch has rebuilt the panel from scratch */
    this.sHeight?.set(this.height)
    this.segPlanet?.set(this.planet)
    this.segBody?.set(this.bodyId)
    this.tglDrag?.set(this.dragOn)
    this.tglGraph?.set(this.showGraph)
    this.ansT?.set(this.answerT)
    this.ansV?.set(this.answerV)
    if (this.graphHost) this.graphHost.style.display = this.showGraph ? '' : 'none'
    this.applyScene()
    this.armGraph()
    this.syncHud()
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
