import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp } from '../../core/math'
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
import { hover, pick } from '../../kit/picking'

/**
 * Projectile motion — one launch, two independent motions.
 *
 * The stage is a fixed sixteen-unit measuring field; the metre scale auto-fits
 * the current speed and target so the whole flight stays on screen. A
 * catalogue entry may frame it with
 * `{ target: [6.9, 2.2, 0], radius: 18.5, azim: 0, polar: 1.3 }`.
 */

/* ------------------------------------------------------------------ scene */
/** Radius of the ball in world units. The physics starts at y = 0, so the
 *  ball is drawn with its centre one radius above the ground. */
const BALL_R = 0.17
/** The measuring field is a fixed sixteen units wide; the metre scale is
 *  chosen to fit the current shot into it, like auto-fitting a graph. */
const FIELD_W = 16
const FIELD_H = 8.4
const TARGET_MIN = 10
const TARGET_MAX = 120
const TARGET_DEFAULT = 50
/** The ruler has one label pool; steps grow when the view zooms out. */
const RULER_LABELS = 14
const MAX_RULER = 960
const MAX_TRAIL = 900
/** Fixed integration step for the drag model — the same idea as the incline. */
const SIM_H = 1 / 240
/** Quadratic drag coefficient per metre; a light ball at school-lab speeds. */
const DRAG_K = 0.0085
/** World units per metre-per-second for the launch-vector drawing. */
const ARROW_SCALE = 0.09
const ARC_STEPS = 32
const START_V = 20
const START_THETA = 45

type Planet = 'earth' | 'moon' | 'mars'
type ShotState = 'aim' | 'flying' | 'landed'
type AnswerState = 'none' | 'ok' | 'bad'

const GRAVITY: Record<Planet, number> = { earth: 9.81, moon: 1.62, mars: 3.72 }

interface Shot {
  /** seconds */
  time: number
  /** metres */
  range: number
  /** metres above the launch level */
  height: number
  /** horizontal position of the apex, metres */
  apexX: number
  /** metres per second */
  impactSpeed: number
  /** degrees below the horizontal */
  impactAngle: number
}

interface PathPoint {
  t: number
  x: number
  y: number
}

const zeroShot = (): Shot => ({
  time: 0,
  range: 0,
  height: 0,
  apexX: 0,
  impactSpeed: 0,
  impactAngle: 0,
})

/** Pick the "round" ruler step closest to the wanted spacing. */
function niceStep(target: number): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]
  let best = candidates[0]
  for (const c of candidates) {
    if (Math.abs(Math.log(c / target)) < Math.abs(Math.log(best / target))) best = c
  }
  return best
}

/* ------------------------------------------------------------------ texts */
const S = {
  launch: L('Peluncuran', 'Launch'),
  speed: L('Kecepatan awal  v₀', 'Launch speed  v₀'),
  angle: L('Sudut lempar  θ', 'Launch angle  θ'),
  gravity: L('Gravitasi', 'Gravity'),
  earth: L('Bumi', 'Earth'),
  moon: L('Bulan', 'Moon'),
  mars: L('Mars', 'Mars'),
  air: L('Hambatan udara', 'Air resistance'),
  launchBtn: L('🚀 Luncurkan', '🚀 Launch'),
  reset: L('↺ Atur ulang', '↺ Reset'),

  measurements: L('Pengukuran', 'Measurements'),
  launchVector: L('Kecepatan awal  v₀', 'Launch velocity  v₀'),
  gravityReadout: L('Gravitasi  g', 'Gravity  g'),
  vx: L('Komponen mendatar  v₀x', 'Horizontal component  v₀x'),
  vy: L('Komponen vertikal  v₀y', 'Vertical component  v₀y'),
  time: L('Waktu terbang  t', 'Time of flight  t'),
  range: L('Jarak jangkauan  R', 'Range  R'),
  height: L('Tinggi maksimum  H', 'Maximum height  H'),
  impactSpeed: L('Kecepatan tumbukan', 'Impact speed'),
  impactAngle: L('Sudut tumbukan', 'Impact angle'),
  idealShort: L('ideal', 'ideal'),

  targetTitle: L('Target', 'Target'),
  targetDistance: L('Jarak target', 'Target distance'),
  targetAt: L('Target  {d} m', 'Target  {d} m'),
  targetValue: L('Target berada di', 'Target stands at'),
  targetZone: L('Zona pendaratan', 'Landing zone'),
  targetIdle: L(
    'Seret tiang target di tanah (atau pakai slider), lalu luncurkan bola.',
    'Drag the target post along the ground (or use the slider), then launch the ball.',
  ),
  targetFlying: L('Bola sedang terbang…', 'Ball in flight…'),
  targetHit: L('TEPAT SASARAN', 'BULLSEYE'),
  targetShort: L('KURANG {d} m', 'SHORT BY {d} m'),
  targetLong: L('LEBIH {d} m', 'LONG BY {d} m'),
  targetHitSub: L(
    'Mendarat di {x} m — target {d} m, toleransi {t} m.',
    'Landed at {x} m — target {d} m, tolerance {t} m.',
  ),
  targetMissSub: L(
    'Mendarat di {x} m, target {d} m. Selisih {e} m; coba ubah kecepatan atau sudut.',
    'Landed at {x} m, target {d} m. Off by {e} m; try another speed or angle.',
  ),
  targetZoneHint: L('Toleransi pendaratan ± {t} m.', 'Landing tolerance ± {t} m.'),
  goalTarget: L('Mendarat dalam {t} m dari target', 'Land within {t} m of the target'),
  goalTargetDone: L(
    'Tepat sasaran! Mendarat di {x} m, target {d} m.',
    'Bullseye! Landed at {x} m, target {d} m.',
  ),

  answer: L('Jawabanmu', 'Your answer'),
  answerTask: L('TUGAS', 'TASK'),
  answerPrompt: L(
    'Tulis jarak jangkauan yang ditunjukkan pengukuran (dalam meter).',
    'Write the range shown by the measurements (in metres).',
  ),
  answerField: L('Prediksi jangkauan  R', 'Predicted range  R'),
  check: L('Cek jawaban', 'Check answer'),
  clear: L('Hapus', 'Clear'),
  hintTitle: L('Isi prediksimu, lalu tekan Cek.', 'Fill in your prediction, then press Check.'),
  hintSub: L('Toleransi: 2% atau 0,5 m.', 'Tolerance: 2% or 0.5 m.'),
  emptyTitle: L('BELUM DIISI', 'NOT FILLED IN'),
  emptySub: L('Tulis angka di kolomnya lebih dulu.', 'Write a number in the field first.'),
  okTitle: L('BENAR', 'CORRECT'),
  noTitle: L('BELUM TEPAT', 'NOT QUITE'),
  okSub: L('Jangkauan terukur {r} m. {f}', 'The measured range is {r} m. {f}'),
  noSub: L(
    'Kamu menulis {a} m; jangkauan terukur {r} m. {f}',
    'You wrote {a} m; the measured range is {r} m. {f}',
  ),
  fRange: L('R = v₀² sin 2θ / g = {r} m', 'R = v₀² sin 2θ / g = {r} m'),
  fRangeDrag: L(
    'tanpa hambatan {i} m, dengan hambatan {a} m — udara memperpendek lintasan.',
    'no drag {i} m, with drag {a} m — the air shortens the flight.',
  ),
  goalAnswer: L('Jawab jangkauan dengan benar', 'Answer the range correctly'),
  goalAnswerDone: L('Benar! Jangkauannya {r} m.', 'Correct! The range is {r} m.'),

  idealAt: L('R ideal = {r} m', 'R ideal = {r} m'),
  distanceAxis: L('x (m)', 'x (m)'),

  howTitle: L(
    'Mengapa gerak mendatar dan vertikal saling bebas',
    'Why horizontal and vertical motion are independent',
  ),
  howBody: L(
    '<b>Satu gerak, dua sumbu.</b> Gerak parabola adalah dua gerak lurus yang berjalan bersamaan. ' +
      'Pada arah mendatar tidak ada gaya (jika hambatan udara diabaikan), jadi <code>v₀x = v₀ cos θ</code> ' +
      'tetap dan <code>x = v₀ cos θ · t</code>. Pada arah vertikal hanya gravitasi yang bekerja, jadi ' +
      '<code>v₀y = v₀ sin θ</code> menyusut dan <code>y = v₀ sin θ · t − ½ g t²</code>.<br><br>' +
      'Kedua gerak hanya berbagi satu hal: <b>waktu t</b>. Waktu terbang ditentukan oleh gerak vertikal ' +
      '(kembali ke y = 0): <code>t = 2 v₀ sin θ / g</code>. Jangkauan adalah kecepatan mendatar dikali waktu: ' +
      '<code>R = v₀² sin 2θ / g</code>. Tinggi maksimum terjadi saat <code>v_y = 0</code>, yaitu pada t/2, ' +
      'dan <code>H = v₀² sin²θ / (2g)</code>. Di ruang hampa, jangkauan terbesar ada pada θ = 45°.<br><br>' +
      'Hambatan udara mengubahnya: percepatan hambat <code>−k v |v|</code> melawan arah kecepatan, sehingga kedua ' +
      'sumbu tidak lagi terpisah. Lintasannya bukan parabola sempurna, jangkauannya lebih pendek, sudut ' +
      'tumbuknya lebih curam, dan sudut terbaiknya sedikit di bawah 45°.',
    '<b>One motion, two axes.</b> A projectile is two straight-line motions running at once. ' +
      'Horizontally there is no force (ignoring air), so <code>v₀x = v₀ cos θ</code> stays constant and ' +
      '<code>x = v₀ cos θ · t</code>. Vertically only gravity acts, so <code>v₀y = v₀ sin θ</code> shrinks and ' +
      '<code>y = v₀ sin θ · t − ½ g t²</code>.<br><br>' +
      'The two motions share exactly one thing: <b>the clock t</b>. The flight time comes from the vertical ' +
      'motion (returning to y = 0): <code>t = 2 v₀ sin θ / g</code>. The range is the horizontal speed times ' +
      'that time: <code>R = v₀² sin 2θ / g</code>. The maximum height happens when <code>v_y = 0</code>, at ' +
      't/2, and <code>H = v₀² sin²θ / (2g)</code>. In a vacuum the greatest range comes at θ = 45°.<br><br>' +
      'Air resistance changes the picture: a drag acceleration <code>−k v |v|</code> opposes the velocity, so ' +
      'the axes are no longer independent. The path is not a perfect parabola, the range is shorter, the impact ' +
      'angle is steeper, and the best launch angle drops a little below 45°.',
  ),
}

class ProjectileLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext

  /* scene */
  private ball!: THREE.Mesh
  private trail!: THREE.Line
  private trailGeo!: THREE.BufferGeometry
  private trailPos!: Float32Array

  private arrowV0!: ReturnType<typeof makeArrow>
  private arrowVx!: ReturnType<typeof makeArrow>
  private arrowVy!: ReturnType<typeof makeArrow>
  private projLine!: THREE.LineSegments
  private thetaArc!: THREE.Line

  private apexGroup!: THREE.Group
  private apexLine!: THREE.Line
  private apexLabel!: ReturnType<typeof makeLabel>
  private landGroup!: THREE.Group
  private landLabel!: ReturnType<typeof makeLabel>
  private idealGroup!: THREE.Group
  private idealLine!: THREE.Line
  private idealLabel!: ReturnType<typeof makeLabel>

  private targetGroup!: THREE.Group
  private targetPad!: THREE.Mesh
  private targetLabel!: ReturnType<typeof makeLabel>
  private targetMat!: THREE.MeshStandardMaterial
  private groundPick!: THREE.Mesh

  private ruler!: THREE.LineSegments
  private rulerPos!: Float32Array
  private rulerLabels: ReturnType<typeof makeLabel>[] = []
  private axisLabel!: ReturnType<typeof makeLabel>

  /* state */
  private v0 = START_V
  private thetaDeg = START_THETA
  private planet: Planet = 'earth'
  private dragOn = false
  private target = TARGET_DEFAULT
  private answer = 0
  private answerState: AnswerState = 'none'
  private state: ShotState = 'aim'
  private flightTime = 0
  private targetHit = false
  private dragTarget: { offset: number } | null = null

  /** world units per metre — the auto-fitted scale of the measuring field */
  private scale = 0.3
  private playback = 1
  private ideal: Shot = zeroShot()
  private actual: Shot = zeroShot()
  private path: PathPoint[] = [{ t: 0, x: 0, y: 0 }]
  private trailCount = 1
  private hudSig = ''

  /* panel */
  private sV0!: SliderHandle
  private sTheta!: SliderHandle
  private sTarget!: SliderHandle
  private segG!: SegmentedHandle
  private tDrag!: ToggleHandle
  private nAnswer!: NumberHandle
  private rLaunch!: Readout
  private rGravity!: Readout
  private rVx!: Readout
  private rVy!: Readout
  private rTime!: Readout
  private rRange!: Readout
  private rHeight!: Readout
  private rImpactV!: Readout
  private rImpactA!: Readout
  private rTarget!: Readout
  private rZone!: Readout
  private statusTarget!: StatusHandle
  private goalTarget!: GoalHandle
  private statusAnswer!: StatusHandle
  private goalAnswer!: GoalHandle

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'projectile-lab'
    this.build()
    this.computeFlight()
    this.layout()
    /* The field is sixteen units wide and the panel takes the right side of
       the screen; frame it once so the catalogue does not have to guess. */
    this.ctx.setCamera({ target: [6.9, 2.2, 0], radius: 18.5, azim: 0, polar: 1.3 })
    /* note: do NOT build the panel here — the platform calls buildPanel() */
  }

  private get theta(): number {
    return (this.thetaDeg * Math.PI) / 180
  }

  private get g(): number {
    return GRAVITY[this.planet]
  }

  /** The challenge accepts landings within two percent of the target. */
  private tol(): number {
    return Math.max(0.6, this.target * 0.02)
  }

  /* ------------------------------------------------------------- scene */
  private build(): void {
    this.buildGround()
    this.buildRamp()
    this.buildBall()
    this.buildVectors()
    this.buildMarkers()
    this.buildTarget()
    this.buildRuler()
    this.buildTrail()
  }

  private buildGround(): void {
    const G = this.root

    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a2432, roughness: 0.93, metalness: 0.03 }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.set(9, 0.002, 0)
    pad.receiveShadow = true
    G.add(pad)

    const laneMat = new THREE.MeshBasicMaterial({ color: 0x2c3d55, transparent: true, opacity: 0.85 })
    for (const z of [-2.6, 2.6]) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(26, 0.012, 0.035), laneMat)
      lane.position.set(9, 0.01, z)
      G.add(lane)
    }
    const centre = new THREE.Mesh(new THREE.BoxGeometry(26, 0.01, 0.025), laneMat)
    centre.position.set(9, 0.008, 0)
    G.add(centre)

    const start = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.012, 2.4),
      new THREE.MeshBasicMaterial({ color: 0x2f8a80 }),
    )
    start.position.set(0, 0.012, 0)
    G.add(start)

    /* A big invisible horizontal plane gives the pointer drag a stable
       surface to intersect. Raycasting ignores `visible`, so it costs no
       draw call and no pixel. */
    this.groundPick = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 40),
      new THREE.MeshBasicMaterial(),
    )
    this.groundPick.rotation.x = -Math.PI / 2
    this.groundPick.position.set(20, 0, 0)
    this.groundPick.visible = false
    G.add(this.groundPick)
  }

  private buildRamp(): void {
    const G = this.root
    const steel = new THREE.MeshStandardMaterial({ color: 0x59677d, roughness: 0.55, metalness: 0.35 })

    /* A low wedge behind the ball: the marked launch ramp. The physics
       launches from ground level so the textbook formulas stay exact. */
    const shape = new THREE.Shape()
    shape.moveTo(-1.5, 0.02)
    shape.lineTo(-0.05, 0.02)
    shape.lineTo(-0.05, 0.33)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false })
    geo.translate(0, 0, -0.45)
    const ramp = new THREE.Mesh(geo, steel)
    ramp.position.set(-0.25, 0, 0)
    ramp.castShadow = true
    ramp.receiveShadow = true
    G.add(ramp)

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.018, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x2fc7b6,
        roughness: 0.4,
        metalness: 0.3,
        emissive: 0x0d4a44,
        emissiveIntensity: 0.6,
      }),
    )
    strip.position.set(-1.02, 0.2, 0)
    strip.rotation.z = 0.211
    G.add(strip)

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.05), steel)
    base.position.set(-0.95, 0.025, 0)
    base.receiveShadow = true
    G.add(base)

    const launchPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.27, 0.035, 22),
      new THREE.MeshStandardMaterial({
        color: 0x2fc7b6,
        roughness: 0.4,
        metalness: 0.35,
        emissive: 0x0d4a44,
        emissiveIntensity: 0.5,
      }),
    )
    launchPad.position.set(0, 0.0175, 0)
    G.add(launchPad)
  }

  private buildBall(): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc65c,
      roughness: 0.32,
      metalness: 0.15,
      emissive: 0x6b4300,
      emissiveIntensity: 0.35,
    })
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 26, 20), mat)
    this.ball.castShadow = true
    this.ball.position.set(0, BALL_R, 0)
    this.root.add(this.ball)

    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(BALL_R * 1.002, 0.011, 6, 30),
      new THREE.MeshStandardMaterial({ color: 0x8a5a1c, roughness: 0.7 }),
    )
    this.ball.add(seam)
  }

  private buildVectors(): void {
    const G = this.root

    /* The decomposition is the lesson: the neutral arrow is v₀ itself, the
       teal one is the part that never changes, the orange one is the part
       gravity eats away. */
    this.arrowV0 = makeArrow('#e6eef8', { labelSide: 0.7, radius: 0.045, headLen: 0.28 })
    this.arrowVx = makeArrow(C.input, { labelSide: -0.6, radius: 0.048, headLen: 0.28 })
    this.arrowVy = makeArrow(C.output, { labelSide: -0.6, radius: 0.048, headLen: 0.28 })
    G.add(this.arrowV0, this.arrowVx, this.arrowVy)

    const projGeo = new THREE.BufferGeometry()
    projGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3))
    this.projLine = new THREE.LineSegments(
      projGeo,
      new THREE.LineDashedMaterial({
        color: 0x9db0c6,
        dashSize: 0.1,
        gapSize: 0.07,
        transparent: true,
        opacity: 0.8,
      }),
    )
    this.projLine.frustumCulled = false
    G.add(this.projLine)

    const arcGeo = new THREE.BufferGeometry()
    arcGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array((ARC_STEPS + 1) * 3), 3),
    )
    this.thetaArc = new THREE.Line(
      arcGeo,
      new THREE.LineBasicMaterial({ color: 0x9db0c6, transparent: true, opacity: 0.8 }),
    )
    this.thetaArc.frustumCulled = false
    G.add(this.thetaArc)
  }

  private buildMarkers(): void {
    const G = this.root
    const orange = 0xff9f43

    /* apex ---------------------------------------------------------- */
    this.apexGroup = new THREE.Group()
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1),
      new THREE.MeshStandardMaterial({
        color: orange,
        emissive: 0x7a3c00,
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.2,
      }),
    )
    const apexGeo = new THREE.BufferGeometry()
    apexGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3))
    this.apexLine = new THREE.Line(
      apexGeo,
      new THREE.LineDashedMaterial({
        color: orange,
        dashSize: 0.14,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.6,
      }),
    )
    this.apexLine.frustumCulled = false
    this.apexLabel = makeLabel('', { color: C.output, size: 30, scale: 0.0042 })
    this.apexLabel.position.set(0, 0.32, 0.1)
    this.apexGroup.add(diamond, this.apexLabel)
    G.add(this.apexLine, this.apexGroup)

    /* landing ------------------------------------------------------- */
    this.landGroup = new THREE.Group()
    const landMat = new THREE.MeshBasicMaterial({
      color: orange,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.3, 28), landMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.018
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8),
      new THREE.MeshBasicMaterial({ color: orange }),
    )
    pin.position.y = 0.31
    const flagShape = new THREE.Shape()
    flagShape.moveTo(0, 0)
    flagShape.lineTo(0.3, 0.09)
    flagShape.lineTo(0, 0.18)
    flagShape.closePath()
    const flag = new THREE.Mesh(
      new THREE.ShapeGeometry(flagShape),
      new THREE.MeshBasicMaterial({ color: orange, side: THREE.DoubleSide }),
    )
    flag.position.set(0, 0.62, 0)
    this.landLabel = makeLabel('', { color: C.output, size: 30, scale: 0.0042 })
    this.landLabel.position.set(0, 0.98, 0.08)
    this.landGroup.add(ring, pin, flag, this.landLabel)
    G.add(this.landGroup)

    /* the ghost of the no-drag range ------------------------------- */
    this.idealGroup = new THREE.Group()
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x9db0c6,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })
    const ghost = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.22, 24), ghostMat)
    ghost.rotation.x = -Math.PI / 2
    ghost.position.y = 0.014
    const idealGeo = new THREE.BufferGeometry()
    idealGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3))
    this.idealLine = new THREE.Line(
      idealGeo,
      new THREE.LineDashedMaterial({
        color: 0x9db0c6,
        dashSize: 0.1,
        gapSize: 0.08,
        transparent: true,
        opacity: 0.55,
      }),
    )
    this.idealLine.frustumCulled = false
    this.idealLabel = makeLabel('', { color: C.neutral, size: 26, scale: 0.0039 })
    this.idealLabel.position.set(0, 0.62, 0.08)
    this.idealGroup.add(ghost, this.idealLine, this.idealLabel)
    G.add(this.idealGroup)
  }

  private buildTarget(): void {
    const G = this.root
    this.targetGroup = new THREE.Group()
    this.targetGroup.name = 'projectile-target'

    const dark = new THREE.MeshStandardMaterial({ color: 0x46536a, roughness: 0.6, metalness: 0.4 })
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c6d4, roughness: 0.35, metalness: 0.75 })
    this.targetMat = new THREE.MeshStandardMaterial({
      color: 0x5ee07a,
      emissive: 0x1f6b31,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.35,
    })

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.07, 22), dark)
    base.position.y = 0.035
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.04, 1.72, 10), steel)
    pole.position.y = 0.9
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.032, 10, 30), this.targetMat)
    hoop.rotation.x = Math.PI / 2
    hoop.position.y = 1.74

    /* A unit ring, scaled to the current tolerance, so the green patch on
       the ground really is the landing zone the challenge checks. */
    this.targetPad = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 36), this.targetMat)
    this.targetPad.rotation.x = -Math.PI / 2
    this.targetPad.position.y = 0.012

    this.targetLabel = makeLabel('', {
      color: C.lift,
      size: 30,
      scale: 0.0042,
      border: 'rgba(94,224,122,0.7)',
    })
    this.targetLabel.position.set(0, 2.28, 0.05)

    /* invisible, generous grab box for phones */
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 2.7, 1.15),
      new THREE.MeshBasicMaterial(),
    )
    hitBox.position.y = 1.35
    hitBox.visible = false

    this.targetGroup.add(base, pole, hoop, this.targetPad, this.targetLabel, hitBox)
    this.targetGroup.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    G.add(this.targetGroup)
  }

  private buildRuler(): void {
    const G = this.root

    /* a continuous baseline turns the ticks into a readable ruler */
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(FIELD_W, 0.012, 0.026),
      new THREE.MeshBasicMaterial({ color: 0x8fa3bd, transparent: true, opacity: 0.7 }),
    )
    base.position.set(FIELD_W / 2, 0.009, 0.55)
    G.add(base)

    this.rulerPos = new Float32Array(MAX_RULER)
    const geo = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(this.rulerPos, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', attr)
    geo.setDrawRange(0, 0)
    this.ruler = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x8fa3bd, transparent: true, opacity: 0.75 }),
    )
    this.ruler.frustumCulled = false
    G.add(this.ruler)

    for (let i = 0; i < RULER_LABELS; i++) {
      const lab = makeLabel('', { color: C.neutral, size: 26, scale: 0.0038 })
      lab.position.set(0, 0.1, 1.1)
      lab.visible = false
      this.rulerLabels.push(lab)
      G.add(lab)
    }

    this.axisLabel = makeLabel(t(S.distanceAxis), { color: C.neutral, size: 26, scale: 0.0038 })
    this.axisLabel.position.set(-0.8, 0.1, 1.55)
    G.add(this.axisLabel)
  }

  private buildTrail(): void {
    this.trailPos = new Float32Array(MAX_TRAIL * 3)
    this.trailGeo = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(this.trailPos, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    this.trailGeo.setAttribute('position', attr)
    this.trailGeo.setDrawRange(0, 0)
    this.trail = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({
        color: 0xff9f43,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    )
    this.trail.frustumCulled = false
    this.root.add(this.trail)
  }

  /* -------------------------------------------------------- the drawing */
  /**
   * The metre scale shrinks until the whole possible flight fits the fixed
   * measuring field. Changing the angle therefore never rescales the stage:
   * the student sees the arc grow and shrink against the same ruler.
   */
  private computeScale(): void {
    const v0 = this.v0
    const g = this.g
    const rangeMax = (v0 * v0) / g
    const heightMax = (v0 * v0) / (2 * g)
    const spanX = Math.max(rangeMax, this.target, 12) * 1.08
    const spanY = Math.max(heightMax, 4) * 1.22 + 1.2
    this.scale = clamp(Math.min(FIELD_W / spanX, FIELD_H / spanY), 0.01, 1.4)
  }

  private layout(): void {
    this.computeScale()
    this.layoutRuler()
    this.layoutApex()
    this.layoutLanding()
    this.layoutTarget()
    this.applyVectors()
    this.fillTrail()
    this.applyBallState()
  }

  private layoutRuler(): void {
    const fieldM = Math.max(this.actual.range, this.ideal.range, this.target, 12) * 1.08
    const visibleM = Math.min(fieldM, FIELD_W / this.scale)
    const step = niceStep(Math.max(0.5, visibleM / 9))
    const minor = step / 5
    const arr = this.rulerPos
    let n = 0
    const ticks = Math.ceil(visibleM / minor)
    for (let i = 0; i <= ticks; i++) {
      if (n > arr.length - 6) break
      const d = i * minor
      const x = d * this.scale
      if (x > FIELD_W - 0.02) break
      const major = i % 5 === 0
      const z0 = 0.55
      const z1 = z0 + (major ? 0.32 : 0.16)
      arr[n++] = x
      arr[n++] = 0.012
      arr[n++] = z0
      arr[n++] = x
      arr[n++] = 0.012
      arr[n++] = z1
    }
    const attr = this.ruler.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
    this.ruler.geometry.setDrawRange(0, n / 3)

    let li = 0
    const last = Math.floor(visibleM / step + 1e-6)
    for (let i = 0; i <= last; i++) {
      if (li >= this.rulerLabels.length) break
      const d = i * step
      const x = d * this.scale
      if (x > FIELD_W - 0.05) break
      const lab = this.rulerLabels[li++]
      lab.visible = true
      lab.userData.setText(num(d, 0))
      lab.position.set(x, 0.1, 1.1)
    }
    for (; li < this.rulerLabels.length; li++) this.rulerLabels[li].visible = false
    this.axisLabel.userData.setText(t(S.distanceAxis))
  }

  private layoutApex(): void {
    const h = this.actual.height
    const x = this.actual.apexX * this.scale
    const y = h * this.scale + BALL_R
    this.apexGroup.position.set(x, y, 0)
    this.apexGroup.visible = h > 0.08
    this.apexLabel.userData.setText(`H = ${num(h, 1)} m`)
    this.apexLine.visible = h > 0.08
    this.setDashedVertical(this.apexLine, x, y)
  }

  private layoutLanding(): void {
    const r = this.actual.range
    this.landGroup.position.set(r * this.scale, 0, 0)
    this.landGroup.visible = r > 0.15
    this.landLabel.userData.setText(`R = ${num(r, 1)} m`)

    const ir = this.ideal.range
    const showIdeal = this.dragOn && ir > 0.15 && Math.abs(ir - r) > 0.05
    this.idealGroup.visible = showIdeal
    if (!showIdeal) return
    this.idealGroup.position.set(ir * this.scale, 0, 0)
    this.idealLabel.userData.setText(tf(S.idealAt, { r: num(ir, 1) }))
    const attr = this.idealLine.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    a[0] = 0
    a[1] = 0.02
    a[2] = 0.05
    a[3] = 0
    a[4] = 0.5
    a[5] = 0.05
    attr.needsUpdate = true
    this.idealLine.computeLineDistances()
  }

  private layoutTarget(): void {
    this.targetGroup.position.set(this.target * this.scale, 0, 0)
    this.targetLabel.userData.setText(tf(S.targetAt, { d: num(this.target, 1) }))
    this.targetPad.scale.setScalar(Math.max(0.2, this.tol() * this.scale))
  }

  private setDashedVertical(line: THREE.Line, x: number, top: number): void {
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    a[0] = x
    a[1] = 0.03
    a[2] = 0
    a[3] = x
    a[4] = top
    a[5] = 0
    attr.needsUpdate = true
    line.computeLineDistances()
  }

  private applyVectors(): void {
    const th = this.theta
    const vx = this.v0 * Math.cos(th)
    const vy = this.v0 * Math.sin(th)
    const oz = 0.24
    vOrigin.set(0, BALL_R + 0.02, oz)

    vDir.set(Math.cos(th), Math.sin(th), 0)
    this.arrowV0.setLabel('v₀')
    this.arrowV0.set(vOrigin, vDir, this.v0 * ARROW_SCALE)

    vDir.set(1, 0, 0)
    this.arrowVx.set(vOrigin, vDir, vx * ARROW_SCALE)
    this.arrowVx.setLabel('v₀x')

    vDir.set(0, 1, 0)
    this.arrowVy.set(vOrigin, vDir, vy * ARROW_SCALE)
    this.arrowVy.setLabel('v₀y')

    /* The dashed right-angle bracket: from the horizontal tip up to the
       resultant, then across to the vertical tip. */
    const ax = vx * ARROW_SCALE
    const ay = vy * ARROW_SCALE
    const attr = this.projLine.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = attr.array as Float32Array
    a[0] = ax
    a[1] = 0
    a[2] = 0
    a[3] = ax
    a[4] = ay
    a[5] = 0
    a[6] = ax
    a[7] = ay
    a[8] = 0
    a[9] = 0
    a[10] = ay
    a[11] = 0
    attr.needsUpdate = true
    this.projLine.position.copy(vOrigin)
    this.projLine.computeLineDistances()
    /* at a purely horizontal or vertical launch the bracket collapses onto
       the arrow itself, so it would only add clutter */
    this.projLine.visible = this.thetaDeg > 0.5 && this.thetaDeg < 89.5

    const arcAttr = this.thetaArc.geometry.getAttribute('position') as THREE.BufferAttribute
    const arc = arcAttr.array as Float32Array
    /* keep the angle mark tied to the arrow, not to a fixed world size */
    const arcR = clamp(this.v0 * ARROW_SCALE * 0.5, 0.3, 1.5)
    for (let i = 0; i <= ARC_STEPS; i++) {
      const ang = (th * i) / ARC_STEPS
      arc[i * 3] = Math.cos(ang) * arcR
      arc[i * 3 + 1] = Math.sin(ang) * arcR
      arc[i * 3 + 2] = 0
    }
    arcAttr.needsUpdate = true
    this.thetaArc.position.copy(vOrigin)
    this.thetaArc.visible = this.thetaDeg > 0.5
  }

  private fillTrail(): void {
    const count = Math.min(this.path.length, MAX_TRAIL)
    if (count === 0) {
      this.trailGeo.setDrawRange(0, 0)
      return
    }
    const stride = Math.max(1, Math.ceil(this.path.length / MAX_TRAIL))
    let k = 0
    for (let i = 0; i < this.path.length && k < MAX_TRAIL; i += stride) {
      const p = this.path[i]
      const j = k * 3
      this.trailPos[j] = p.x * this.scale
      this.trailPos[j + 1] = p.y * this.scale + BALL_R
      this.trailPos[j + 2] = 0
      k++
    }
    /* Always finish exactly on the landing point, whatever the stride. */
    const last = this.path[this.path.length - 1]
    const j = Math.max(0, k - 1) * 3
    this.trailPos[j] = last.x * this.scale
    this.trailPos[j + 1] = last.y * this.scale + BALL_R
    this.trailPos[j + 2] = 0
    const attr = this.trailGeo.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
    this.trailGeo.setDrawRange(0, Math.min(this.trailCount, k))
  }

  private applyBallState(): void {
    if (this.state === 'aim') {
      this.ball.position.set(0, BALL_R, 0)
      this.trailCount = 1
      this.trailGeo.setDrawRange(0, 1)
      return
    }
    const time = this.state === 'landed' ? this.actual.time : this.flightTime
    this.placeBall(time)
  }

  /** Put the ball and the end of the trail at a physics time. */
  private placeBall(time: number): void {
    const path = this.path
    if (path.length === 0) return
    if (path.length === 1) {
      this.ball.position.set(path[0].x * this.scale, path[0].y * this.scale + BALL_R, 0)
      this.trailCount = 1
      this.trailGeo.setDrawRange(0, 1)
      return
    }
    let i = 1
    while (i < path.length && path[i].t < time) i++
    const a = path[i - 1]
    const b = path[i] ?? a
    const span = b.t - a.t
    const f = span > 1e-9 ? clamp((time - a.t) / span, 0, 1) : 1
    const x = a.x + (b.x - a.x) * f
    const y = a.y + (b.y - a.y) * f
    this.ball.position.set(x * this.scale, y * this.scale + BALL_R, 0)
    this.trailCount = Math.max(1, Math.min(i, path.length))
    this.trailGeo.setDrawRange(0, this.trailCount)
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    /* ---- launch ---- */
    const launch = panel.section(t(S.launch))
    this.sV0 = launch.slider({
      label: t(S.speed),
      min: 5,
      max: 40,
      step: 0.5,
      value: this.v0,
      format: (v) => `${num(v, 1)} m/s`,
      onInput: (v) => {
        this.v0 = v
        this.onParamChange()
      },
    })
    this.sTheta = launch.slider({
      label: t(S.angle),
      min: 0,
      max: 90,
      step: 1,
      value: this.thetaDeg,
      format: (v) => `${num(v, 0)}°`,
      onInput: (v) => {
        this.thetaDeg = v
        this.onParamChange()
      },
    })
    this.segG = launch.segmented({
      items: [
        { value: 'earth', label: t(S.earth), sub: `${num(9.81, 2)} m/s²` },
        { value: 'moon', label: t(S.moon), sub: `${num(1.62, 2)} m/s²` },
        { value: 'mars', label: t(S.mars), sub: `${num(3.72, 2)} m/s²` },
      ],
      value: this.planet,
      cols: 3,
      onChange: (v) => {
        if (v === 'earth' || v === 'moon' || v === 'mars') {
          this.planet = v
          this.onParamChange()
        }
      },
    })
    this.tDrag = launch.toggle({
      label: t(S.air),
      value: this.dragOn,
      onChange: (v) => {
        this.dragOn = v
        this.onParamChange()
      },
    })

    const actions = launch.el('div', 'row-2')
    const launchBtn = launch.el('button', 'btn btn-primary', t(S.launchBtn))
    const resetBtn = launch.el('button', 'btn btn-ghost', t(S.reset))
    launchBtn.addEventListener('click', () => this.launch())
    resetBtn.addEventListener('click', () => this.resetAll())
    actions.append(launchBtn, resetBtn)

    /* ---- measurements ---- */
    const meas = panel.section(t(S.measurements))
    this.rLaunch = meas.readout(t(S.launchVector))
    this.rGravity = meas.readout(t(S.gravityReadout))
    meas.el('div', 'hr')
    this.rVx = meas.readout(t(S.vx))
    this.rVy = meas.readout(t(S.vy))
    meas.el('div', 'hr')
    this.rTime = meas.readout(t(S.time))
    this.rRange = meas.readout(t(S.range))
    this.rHeight = meas.readout(t(S.height))
    meas.el('div', 'hr')
    this.rImpactV = meas.readout(t(S.impactSpeed))
    this.rImpactA = meas.readout(t(S.impactAngle))

    /* ---- the target challenge ---- */
    const tgt = panel.section(t(S.targetTitle))
    this.sTarget = tgt.slider({
      label: t(S.targetDistance),
      min: TARGET_MIN,
      max: TARGET_MAX,
      step: 0.5,
      value: this.target,
      format: (v) => `${num(v, 1)} m`,
      onInput: (v) => this.updateTarget(v, true),
    })
    this.rTarget = tgt.readout(t(S.targetValue))
    this.rZone = tgt.readout(t(S.targetZone))
    this.statusTarget = tgt.status()
    this.goalTarget = tgt.goal(tf(S.goalTarget, { t: num(this.tol(), 1) }))

    /* ---- the recorded answer ---- */
    const ans = panel.section(t(S.answer))
    const badge = ans.el('div', 'ma-badge')
    const info = ans.el('div', 'ma-info')
    const lbl = document.createElement('div')
    lbl.className = 'lbl'
    lbl.textContent = t(S.answerTask)
    const prompt = document.createElement('div')
    prompt.className = 'formula'
    prompt.textContent = t(S.answerPrompt)
    info.append(lbl, prompt)
    badge.append(info)

    this.nAnswer = ans.number({
      label: t(S.answerField),
      value: Number.isFinite(this.answer) ? this.answer : 0,
      min: 0,
      max: 2000,
      step: 0.1,
      suffix: 'm',
      onChange: (v) => {
        this.answer = Number.isFinite(v) ? Math.max(0, v) : 0
        this.answerState = 'none'
        this.syncHud(true)
      },
    })

    const ansActions = ans.el('div', 'row-2')
    const checkBtn = ans.el('button', 'btn btn-primary', t(S.check))
    const clearBtn = ans.el('button', 'btn btn-ghost', t(S.clear))
    checkBtn.addEventListener('click', () => this.checkAnswer())
    clearBtn.addEventListener('click', () => this.clearAnswer())
    ansActions.append(checkBtn, clearBtn)

    this.statusAnswer = ans.status()
    this.goalAnswer = ans.goal(t(S.goalAnswer))

    /* ---- the explanation ---- */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)

    this.syncHud(true)
  }

  /* ------------------------------------------------------------ actions */
  private launch(): void {
    this.toAim()
    this.state = 'flying'
    this.flightTime = 0
    this.trailCount = 1
    this.targetHit = false
    this.setTargetGlow(false)
    this.placeBall(0)
    this.syncHud(true)
    this.ctx.invalidate()
  }

  /** Put the ball back on the pad, ready for the next launch. */
  private toAim(): void {
    this.state = 'aim'
    this.flightTime = 0
    this.targetHit = false
    this.setTargetGlow(false)
    this.applyBallState()
  }

  private resetAll(): void {
    this.v0 = START_V
    this.thetaDeg = START_THETA
    this.planet = 'earth'
    this.dragOn = false
    this.target = TARGET_DEFAULT
    this.answer = 0
    this.answerState = 'none'
    this.dragTarget = null
    this.ctx.dom.style.cursor = 'default'

    this.sV0?.set(this.v0)
    this.sTheta?.set(this.thetaDeg)
    this.segG?.set(this.planet)
    this.tDrag?.set(this.dragOn)
    this.sTarget?.set(this.target)
    this.nAnswer?.set(0)

    this.toAim()
    this.computeFlight()
    this.layout()
    this.syncHud(true)
    this.ctx.invalidate()
  }

  /** Any launch parameter changed: the old shot and verdict no longer apply. */
  private onParamChange(): void {
    this.answerState = 'none'
    this.toAim()
    this.computeFlight()
    this.layout()
    this.syncHud(true)
    this.ctx.invalidate()
  }

  private updateTarget(value: number, rescale: boolean): void {
    const next = Math.round(clamp(value, TARGET_MIN, TARGET_MAX) * 2) / 2
    if (Math.abs(next - this.target) < 1e-6) return
    this.target = next
    this.sTarget?.set(next)
    this.targetHit = false
    this.setTargetGlow(false)
    this.toAim()
    if (rescale) {
      /* the slider zooms the field to keep the whole challenge in view */
      this.layout()
    } else {
      /* while dragging, the scale is frozen so the post follows the finger */
      this.layoutTarget()
    }
    this.syncHud(true)
    this.ctx.invalidate()
  }

  private checkAnswer(): void {
    const entered = this.nAnswer ? this.nAnswer.get() : this.answer
    if (!Number.isFinite(entered) || entered <= 0) {
      this.answerState = 'none'
      this.syncHud(true)
      this.statusAnswer?.set(
        `${t(S.emptyTitle)}<span class="sub">${t(S.emptySub)}</span>`,
        'warn',
      )
      return
    }
    this.answer = entered
    const target = this.actual.range
    const tol = Math.max(0.5, Math.abs(target) * 0.02)
    this.answerState = Math.abs(entered - target) <= tol ? 'ok' : 'bad'
    this.syncHud(true)
  }

  private clearAnswer(): void {
    this.answer = 0
    this.answerState = 'none'
    this.nAnswer?.set(0)
    this.syncHud(true)
  }

  private setTargetGlow(on: boolean): void {
    this.targetMat.color.set(on ? 0x9dffb0 : 0x5ee07a)
    this.targetMat.emissive.set(on ? 0x3fbf62 : 0x1f6b31)
    this.targetMat.emissiveIntensity = on ? 1.2 : 0.35
  }

  /* ---------------------------------------------------------- interaction */
  /** The label is a sprite; only solid parts of the post may be grabbed. */
  private targetHits(event: PointerEvent): THREE.Intersection[] {
    return pick(event, this.ctx.camera, this.ctx.dom, [this.targetGroup]).filter(
      (hit) => (hit.object as THREE.Mesh).isMesh,
    )
  }

  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = this.targetHits(event)
    if (!hits.length) return false
    const ground = pick(event, this.ctx.camera, this.ctx.dom, [this.groundPick])
    if (!ground.length) return false

    /* grabbing the target cancels a shot in progress; the ground offset keeps
       the post from jumping to the pointer on the first move */
    this.toAim()
    this.syncHud(true)
    this.ctx.invalidate()
    this.dragTarget = { offset: this.target - ground[0].point.x / this.scale }
    this.ctx.dom.style.cursor = 'grabbing'
    return true
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragTarget) {
      const hits = this.targetHits(event)
      hover(this.ctx.dom, hits.length > 0)
      return
    }
    const drag = this.dragTarget
    const ground = pick(event, this.ctx.camera, this.ctx.dom, [this.groundPick])
    if (!ground.length) return
    const raw = ground[0].point.x / this.scale + drag.offset
    /* keep the post inside the framed field; the slider can still go farther */
    const maxM = Math.min(TARGET_MAX, (FIELD_W - 0.4) / this.scale)
    const minM = Math.min(TARGET_MIN, maxM)
    this.updateTarget(clamp(raw, minM, maxM), false)
  }

  onPointerUp(): void {
    if (!this.dragTarget) return
    this.dragTarget = null
    this.ctx.dom.style.cursor = 'default'
    /* now that the post is released, zoom back out to include it */
    this.layout()
    this.syncHud(true)
    this.ctx.invalidate()
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    if (this.state !== 'flying' || dt <= 0) return false
    const duration = this.actual.time
    this.flightTime = Math.min(duration, this.flightTime + dt * this.playback)
    this.placeBall(this.flightTime)
    if (this.flightTime >= duration - 1e-6) {
      this.flightTime = duration
      this.state = 'landed'
      this.placeBall(duration)
      this.finishLanding()
    }
    return true
  }

  private finishLanding(): void {
    this.targetHit = Math.abs(this.actual.range - this.target) <= this.tol()
    this.setTargetGlow(this.targetHit)
    this.syncHud(true)
  }

  /* --------------------------------------------------------------- physics */
  private computeFlight(): void {
    const g = this.g
    const th = this.theta
    const v0 = this.v0
    const vx0 = v0 * Math.cos(th)
    const vy0 = v0 * Math.sin(th)

    /* the exact textbook solution, used as the reference and as the path
       when air resistance is off */
    const tIdeal = vy0 > 1e-6 ? (2 * vy0) / g : 0
    const rIdeal = vx0 * tIdeal
    const hIdeal = vy0 > 1e-6 ? (vy0 * vy0) / (2 * g) : 0
    this.ideal = {
      time: tIdeal,
      range: rIdeal,
      height: hIdeal,
      apexX: rIdeal / 2,
      impactSpeed: v0,
      impactAngle: this.thetaDeg,
    }

    if (tIdeal <= 1e-6) {
      this.actual = zeroShot()
      this.path = [{ t: 0, x: 0, y: 0 }]
      this.playback = 1
      return
    }

    if (!this.dragOn) {
      this.actual = { ...this.ideal }
      const n = 360
      const path: PathPoint[] = []
      for (let i = 0; i <= n; i++) {
        const tt = (tIdeal * i) / n
        path.push({ t: tt, x: vx0 * tt, y: vy0 * tt - 0.5 * g * tt * tt })
      }
      this.path = path
      this.playback = clamp(tIdeal / 6, 1, 8)
      return
    }

    /* Quadratic drag. The force opposes the whole velocity, so the two axes
       are no longer independent — that coupling is exactly what the student
       is meant to see when they switch it on. */
    const path: PathPoint[] = [{ t: 0, x: 0, y: 0 }]
    const recordEvery = Math.max(1, Math.ceil(tIdeal / SIM_H / 500))
    let x = 0
    let y = 0
    let vx = vx0
    let vy = vy0
    let time = 0
    let apexY = 0
    let apexX = 0
    let shot: Shot | null = null
    let guard = 0

    while (guard < 200000) {
      guard++
      const speed = Math.hypot(vx, vy)
      const nvx = vx - DRAG_K * speed * vx * SIM_H
      const nvy = vy - g * SIM_H - DRAG_K * speed * vy * SIM_H
      const nx = x + nvx * SIM_H
      const ny = y + nvy * SIM_H

      if (ny > apexY) {
        apexY = ny
        apexX = nx
      }

      if (ny <= 0) {
        /* land exactly on the ground, not one step below it */
        const f = y > 1e-9 ? clamp(y / (y - ny), 0, 1) : 0
        const lx = x + (nx - x) * f
        const lvx = vx + (nvx - vx) * f
        const lvy = vy + (nvy - vy) * f
        const lt = time + SIM_H * f
        const landing: PathPoint = { t: lt, x: lx, y: 0 }
        if (path.length >= MAX_TRAIL) path[path.length - 1] = landing
        else path.push(landing)
        shot = {
          time: lt,
          range: lx,
          height: apexY,
          apexX,
          impactSpeed: Math.hypot(lvx, lvy),
          impactAngle: (Math.atan2(-lvy, Math.max(1e-9, lvx)) * 180) / Math.PI,
        }
        break
      }

      x = nx
      y = ny
      vx = nvx
      vy = nvy
      time += SIM_H
      if (guard % recordEvery === 0 && path.length < MAX_TRAIL - 1) {
        path.push({ t: time, x, y })
      }
    }

    this.actual = shot ?? zeroShot()
    this.path = path
    this.playback = clamp(Math.max(0.5, this.actual.time) / 6, 1, 8)
  }

  /* ----------------------------------------------------------- readouts */
  private syncHud(force: boolean): void {
    const sig =
      `${this.v0}|${this.thetaDeg}|${this.planet}|${this.dragOn}|${this.target}|` +
      `${this.answer}|${this.answerState}|${this.state}|${this.targetHit}`
    if (!force && sig === this.hudSig) return
    this.hudSig = sig

    const th = this.theta
    const vx = this.v0 * Math.cos(th)
    const vy = this.v0 * Math.sin(th)
    const actual = this.actual
    const ideal = this.ideal
    const tol = this.tol()

    this.rLaunch?.set(`${num(this.v0, 1)} m/s · ${num(this.thetaDeg, 1)}°`, 'input')
    this.rGravity?.set(`${num(this.g, 2)} m/s² · ${t(S[this.planet])}`, 'neutral')
    this.rVx?.set(`${num(vx, 2)} m/s`, 'input')
    this.rVy?.set(`${num(vy, 2)} m/s`, 'output')
    this.rTime?.set(`${num(actual.time, 2)} s`, 'neutral')
    this.rRange?.set(
      this.dragOn
        ? `${num(actual.range, 1)} m  (${t(S.idealShort)} ${num(ideal.range, 1)} m)`
        : `${num(actual.range, 1)} m`,
      'result',
    )
    this.rHeight?.set(`${num(actual.height, 2)} m`, 'neutral')
    this.rImpactV?.set(`${num(actual.impactSpeed, 2)} m/s`, 'neutral')
    this.rImpactA?.set(`${num(actual.impactAngle, 1)}° ↓`, 'neutral')
    this.rTarget?.set(`${num(this.target, 1)} m`, 'input')
    this.rZone?.set(`± ${num(tol, 1)} m`, 'neutral')

    this.goalTarget?.setDone(
      this.targetHit,
      this.targetHit
        ? tf(S.goalTargetDone, {
            x: num(actual.range, 1),
            d: num(this.target, 1),
          })
        : tf(S.goalTarget, { t: num(tol, 1) }),
    )

    if (this.state === 'flying') {
      this.statusTarget?.set(t(S.targetFlying), 'neutral')
    } else if (this.state === 'landed') {
      const off = actual.range - this.target
      const diff = Math.abs(off)
      if (this.targetHit) {
        this.statusTarget?.set(
          `${t(S.targetHit)}<span class="sub">${tf(S.targetHitSub, {
            x: num(actual.range, 1),
            d: num(this.target, 1),
            t: num(tol, 1),
          })}</span>`,
          'result',
        )
      } else {
        const title =
          off < 0 ? tf(S.targetShort, { d: num(diff, 1) }) : tf(S.targetLong, { d: num(diff, 1) })
        this.statusTarget?.set(
          `${title}<span class="sub">${tf(S.targetMissSub, {
            x: num(actual.range, 1),
            d: num(this.target, 1),
            e: num(diff, 1),
          })}</span>`,
          'warn',
        )
      }
    } else {
      this.statusTarget?.set(
        `${t(S.targetIdle)}<span class="sub">${tf(S.targetZoneHint, {
          t: num(tol, 1),
        })}</span>`,
        'neutral',
      )
    }

    const formula = this.dragOn
      ? tf(S.fRangeDrag, {
          i: num(ideal.range, 1),
          a: num(actual.range, 1),
        })
      : tf(S.fRange, { r: num(actual.range, 1) })

    if (this.answerState === 'ok') {
      this.statusAnswer?.set(
        `${t(S.okTitle)}<span class="sub">${tf(S.okSub, {
          r: num(actual.range, 1),
          f: formula,
        })}</span>`,
        'result',
      )
    } else if (this.answerState === 'bad') {
      this.statusAnswer?.set(
        `${t(S.noTitle)}<span class="sub">${tf(S.noSub, {
          a: num(this.answer, 1),
          r: num(actual.range, 1),
          f: formula,
        })}</span>`,
        'warn',
      )
    } else {
      this.statusAnswer?.set(
        `${t(S.hintTitle)}<span class="sub">${t(S.hintSub)}</span>`,
        'neutral',
      )
    }

    this.goalAnswer?.setDone(
      this.answerState === 'ok',
      this.answerState === 'ok'
        ? tf(S.goalAnswerDone, { r: num(actual.range, 1) })
        : t(S.goalAnswer),
    )
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return {
      v0: this.v0,
      theta: this.thetaDeg,
      planet: this.planet,
      drag: this.dragOn,
      target: this.target,
      answer: Number.isFinite(this.answer) ? this.answer : 0,
      answerState: this.answerState,
      state: this.state,
      flightTime: this.flightTime,
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, unknown>

    if (typeof s.v0 === 'number') this.v0 = clamp(s.v0, 5, 40)
    if (typeof s.theta === 'number') this.thetaDeg = clamp(s.theta, 0, 90)
    if (s.planet === 'earth' || s.planet === 'moon' || s.planet === 'mars') {
      this.planet = s.planet
    }
    if (typeof s.drag === 'boolean') this.dragOn = s.drag
    if (typeof s.target === 'number') {
      this.target = Math.round(clamp(s.target, TARGET_MIN, TARGET_MAX) * 2) / 2
    }
    if (typeof s.answer === 'number' && Number.isFinite(s.answer)) this.answer = Math.max(0, s.answer)
    if (s.answerState === 'none' || s.answerState === 'ok' || s.answerState === 'bad') {
      this.answerState = s.answerState
    }
    if (s.state === 'aim' || s.state === 'flying' || s.state === 'landed') {
      this.state = s.state
    } else {
      this.state = 'aim'
    }
    this.flightTime =
      typeof s.flightTime === 'number' && Number.isFinite(s.flightTime)
        ? Math.max(0, s.flightTime)
        : 0
    this.targetHit = false

    /* push everything back into the panel */
    this.sV0?.set(this.v0)
    this.sTheta?.set(this.thetaDeg)
    this.segG?.set(this.planet)
    this.tDrag?.set(this.dragOn)
    this.sTarget?.set(this.target)
    this.nAnswer?.set(Number.isFinite(this.answer) ? this.answer : 0)

    this.computeFlight()
    if (this.state === 'landed') this.flightTime = this.actual.time
    this.flightTime = clamp(this.flightTime, 0, this.actual.time)
    this.setTargetGlow(false)
    this.layout()

    if (this.state === 'landed') {
      this.targetHit = Math.abs(this.actual.range - this.target) <= this.tol()
      this.setTargetGlow(this.targetHit)
    } else if (this.state === 'aim') {
      this.toAim()
    }

    this.syncHud(true)
    this.ctx.invalidate()
  }

  dispose(): void {
    this.ctx.dom.style.cursor = 'default'
    disposeObject(this.root)
  }
}

/* scratch vectors — the decomposition is redrawn on every edit, so it must
   not allocate */
const vOrigin = new THREE.Vector3()
const vDir = new THREE.Vector3()

export default function createProjectileLab(ctx: LabContext): LabInstance {
  return new ProjectileLab(ctx)
}
