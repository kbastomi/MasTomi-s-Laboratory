import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp } from '../../core/math'
import type {
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
import { C, disposeObject } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { hover, pick, rayPlaneZ } from '../../kit/picking'

/* ------------------------------------------------------------------ scene */
const BENCH_TOP = 1.0
/** world units per centimetre — the glass pieces are small, the bench is not */
const U = 0.42

/* ----------------------------------------------------------------- instruments */
/** a school ruler reads to the nearest 0.1 cm */
const RULER = 0.1
/** the balance reads to the nearest 0.1 g */
const BALANCE = 0.1
/** the graduated cylinder reads to the nearest 0.5 cm³ */
const JAR = 0.5
/** soda-lime glass — the value the student is supposed to arrive at */
const TRUE_RHO = 2.5

/* ------------------------------------------------------------------ specimen */
type ObjectId = 'cube' | 'cylinder' | 'pebble'

/**
 * The three pieces of glass.
 *
 * The masses are chosen so that each specimen really is glass (ρ ≈ 2.50 g/cm³)
 * while the ruler's 0.1 cm resolution still costs the student a couple of
 * per cent — which is exactly the lesson: a "perfect" measurement is not
 * possible with a 0.1 cm ruler, and the percentage error is the proof.
 */
const MASS: Record<ObjectId, number> = {
  cube: 68.9,
  cylinder: 44.3,
  pebble: 31.8,
}

/* ------------------------------------------------------------------ texts */
const S = {
  objTitle: L('Objek', 'Object'),
  cube: L('Kubus', 'Cube'),
  cylinder: L('Gelas', 'Beaker'),
  pebble: L('Kerikil', 'Pebble'),
  cubeSub: L('sisi a', 'edge a'),
  cylinderSub: L('d & h', 'd & h'),
  pebbleSub: L('volume air', 'water volume'),
  mass: L('Massa di neraca', 'Mass on the balance'),
  measTitle: L('Pengukuran', 'Measurements'),
  sliderA: L('Sisi kubus  a', 'Cube edge  a'),
  sliderD: L('Diameter  d', 'Diameter  d'),
  sliderH: L('Tinggi  h', 'Height  h'),
  sliderV: L('Volume air (pergeseran)', 'Displaced water volume'),
  volume: L('Volume  V', 'Volume  V'),
  rho: L('Massa jenis  ρ', 'Density  ρ'),
  rhoSI: L('Massa jenis (SI)', 'Density (SI)'),
  rhoErr: L('ρ ± δρ', 'ρ ± δρ'),
  chainA: L('Sisi  a', 'Edge  a'),
  chainD: L('Diameter  d', 'Diameter  d'),
  chainH: L('Tinggi  h', 'Height  h'),
  chainV: L('Volume  V', 'Volume  V'),
  dV: L('Ketidakpastian volume  δV/V', 'Volume uncertainty  δV/V'),
  dM: L('Ketidakpastian massa  δm/m', 'Mass uncertainty  δm/m'),
  reference: L('Acuan: massa jenis kaca', 'Reference: glass density'),
  error: L('Galat terhadap acuan', 'Error against the reference'),
  answerTitle: L('Jawabanmu', 'Your answer'),
  answerLabel: L('Massa jenis hitunganmu', 'Your computed density'),
  checkBtn: L('Periksa jawaban', 'Check answer'),
  reveal: L('Jawaban sebenarnya', 'The real answer'),
  revealSize: L('Ukuran pasti (guru)', 'True size (teacher)'),
  statusTitle: L('Status', 'Status'),
  goal: L('Masukkan massa jenis yang kamu peroleh', 'Enter the density you computed'),
  goalDone: L('Benar! ρ = {r} g/cm³', 'Correct! ρ = {r} g/cm³'),
  ready: L('Siap dihitung', 'Ready to calculate'),
  readySub: L(
    'Baca dimensi di panel, hitung volumenya, lalu tulis ρ = m ÷ V.',
    'Read the dimensions in the panel, work out the volume, then write ρ = m ÷ V.',
  ),
  empty: L('Isi dulu nilaimu', 'Fill in your value first'),
  emptySub: L(
    'Tulis massa jenis hasil hitunganmu (g/cm³), lalu tekan Periksa.',
    'Type the density you computed (g/cm³), then press Check.',
  ),
  correct: L('BENAR', 'CORRECT'),
  correctSub: L(
    'ρ = {r} g/cm³ cocok dengan hitungan {c} g/cm³. Galat terhadap acuan {e}% — ' +
      'masih di dalam ketidakpastian pengukuran.',
    'ρ = {r} g/cm³ matches the computed {c} g/cm³. The error against the reference is {e}% — ' +
      'still inside the measurement uncertainty.',
  ),
  wrong: L('BELUM TEPAT', 'NOT QUITE'),
  wrongSub: L(
    'Kamu menulis {r} g/cm³, tetapi dari m dan V yang terbaca diperoleh {c} g/cm³ ' +
      '(selisih {d}). Periksa lagi rumus ρ = m ÷ V dan satuan cm³.',
    'You wrote {r} g/cm³, but the mass and the volume you read give {c} g/cm³ ' +
      '(a gap of {d}). Check ρ = m ÷ V again, and the cm³ units.',
  ),
  sizeA: L('sisi a₀ =', 'edge a₀ ='),
  sizeD: L('diameter d₀ =', 'diameter d₀ ='),
  sizeH: L('tinggi h₀ =', 'height h₀ ='),
  sizeV: L('volume V₀ =', 'volume V₀ ='),
  howTitle: L('Bagaimana ketidakpastian merambat', 'How the uncertainty propagates'),
  howBody: L(
    'Massa jenis adalah massa per satuan volume: <code>ρ = m / V</code>. ' +
      'Volume dihitung dari dimensi yang kamu baca: <code>V = a³</code> untuk kubus, ' +
      '<code>V = π (d/2)² h</code> untuk gelas, dan dari <b>pergeseran air</b> untuk kerikil.<br><br>' +
      'Ketidakpastian ikut merambat ke turun. Untuk pangkat <code>V = a³</code> galat relatifnya ' +
      'berlipat: <code>δV/V = 3·δa/a</code>; untuk tabung <code>δV/V = 2·δd/d + δh/h</code>. ' +
      'Volume dan massa dijumlahkan pada kasus terburuk: <code>δρ/ρ = δm/m + δV/V</code>.<br><br>' +
      'Jadi penggaris 0,1 cm saja sudah memakan sekitar 10 % dari volume — ' +
      'satu dimensi yang salah langsung merusak seluruh jawaban.',
    'Density is mass per unit volume: <code>ρ = m / V</code>. ' +
      'The volume comes from the dimensions you read: <code>V = a³</code> for the cube, ' +
      '<code>V = π (d/2)² h</code> for the beaker, and from the <b>water displacement</b> for the pebble.<br><br>' +
      'The uncertainty travels down the calculation. For a power <code>V = a³</code> the relative ' +
      'errors multiply: <code>δV/V = 3·δa/a</code>; for the cylinder <code>δV/V = 2·δd/d + δh/h</code>. ' +
      'Volume and mass are added in the worst case: <code>δρ/ρ = δm/m + δV/V</code>.<br><br>' +
      'That is why a 0.1 cm ruler already costs about 10 % of the volume — ' +
      'one bad dimension ruins the whole answer.',
  ),
}

/** a dimension marker: a thin bar with two end ticks and a label */
interface Dim {
  root: THREE.Group
  line: THREE.Mesh
  tickA: THREE.Mesh
  tickB: THREE.Mesh
  label: ReturnType<typeof makeLabel>
  lastText: string
}

class DensityLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext

  /* scene */
  private objGroup!: THREE.Group
  private cubeMesh!: THREE.Group
  private cylMesh!: THREE.Mesh
  private pebbleMesh!: THREE.Mesh
  private massLabel!: ReturnType<typeof makeLabel>
  private markers!: THREE.Group
  private dimA!: Dim
  private dimD!: Dim
  private dimH!: Dim
  private grad!: THREE.Group
  private gradLabel!: ReturnType<typeof makeLabel>
  private water!: THREE.Mesh

  /* state */
  private objectId: ObjectId = 'cube'
  private a = 3.0
  private d = 2.4
  private h = 4.0
  private v = 12.5
  private objX = -1.3
  private answer = 0
  private checked = false
  private drag: { offset: number } | null = null
  private vizSig = ''
  /** 0 → 1 while the piece pops into place after a change */
  private pop = 1

  /* panel widgets */
  private meas!: PanelSection
  private seg!: SegmentedHandle
  private sA!: SliderHandle
  private sD!: SliderHandle
  private sH!: SliderHandle
  private sV!: SliderHandle
  private answerField!: NumberHandle
  private rMass!: Readout
  private rV!: Readout
  private rRho!: Readout
  private rSI!: Readout
  private rRhoErr!: Readout
  private rDV!: Readout
  private rDM!: Readout
  private rRef!: Readout
  private rErr!: Readout
  private rReveal!: Readout
  private rSize!: Readout
  private chainRows: Readout[] = []
  private status!: StatusHandle
  private goal!: GoalHandle

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'density-lab'
    this.build()
  }

  /* -------------------------------------------------------------- scene */
  private build(): void {
    const G = this.root

    /* ---- the bench ---- */
    const legMat = new THREE.MeshStandardMaterial({ color: 0x46536a, roughness: 0.6, metalness: 0.3 })
    const topMat = new THREE.MeshStandardMaterial({ color: 0x59677d, roughness: 0.55, metalness: 0.25 })

    const top = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 2.6), topMat)
    top.position.set(0, BENCH_TOP - 0.07, 0)
    top.castShadow = true
    top.receiveShadow = true
    G.add(top)

    const legGeo = new THREE.BoxGeometry(0.22, BENCH_TOP - 0.14, 0.22)
    for (const [x, z] of [[-3.2, -1.0], [3.2, -1.0], [-3.2, 1.0], [3.2, 1.0]] as const) {
      const leg = new THREE.Mesh(legGeo, legMat)
      leg.position.set(x, (BENCH_TOP - 0.14) / 2, z)
      leg.castShadow = true
      leg.receiveShadow = true
      G.add(leg)
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.1, 0.14), legMat)
    rail.position.set(0, 0.4, -1.0)
    G.add(rail)

    /* ---- the balance: base, column, pan — the source of the mass ---- */
    const steel = new THREE.MeshStandardMaterial({ color: C.steel, roughness: 0.35, metalness: 0.8 })
    const dark = new THREE.MeshStandardMaterial({ color: C.steelDark, roughness: 0.55, metalness: 0.45 })

    const balance = new THREE.Group()
    balance.name = 'density-balance'
    balance.position.set(2.2, BENCH_TOP, 0)

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.9), dark)
    base.position.y = 0.07
    base.castShadow = true
    base.receiveShadow = true

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 14), steel)
    column.position.y = 0.69
    column.castShadow = true

    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 0.07, 26), steel)
    pan.position.y = 1.24
    pan.castShadow = true

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 26), dark)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.27

    /* the balance shows what it weighed — the reading has a source */
    this.massLabel = makeLabel('', {
      color: C.output,
      size: 34,
      scale: 0.0044,
      border: 'rgba(255,159,67,0.8)',
    })
    this.massLabel.position.set(0, 1.75, 0)

    balance.add(base, column, pan, rim, this.massLabel)
    G.add(balance)

    /* ---- the glass pieces ---- */
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9ad7ea,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.45,
    })
    const glassEdge = new THREE.LineBasicMaterial({
      color: 0xcdeeff,
      transparent: true,
      opacity: 0.75,
    })

    this.objGroup = new THREE.Group()
    this.objGroup.name = 'density-object'
    G.add(this.objGroup)

    /* the cube */
    this.cubeMesh = new THREE.Group()
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1)
    const cube = new THREE.Mesh(cubeGeo, glass)
    cube.castShadow = true
    this.cubeMesh.add(cube, new THREE.LineSegments(new THREE.EdgesGeometry(cubeGeo), glassEdge))
    this.objGroup.add(this.cubeMesh)

    /* the beaker */
    this.cylMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 26), glass)
    this.cylMesh.castShadow = true
    /* a high angle threshold keeps only the two rims — the side edges would
       turn the beaker into a bundle of lines */
    this.cylMesh.add(
      new THREE.LineSegments(new THREE.EdgesGeometry(this.cylMesh.geometry, 20), glassEdge),
    )
    this.objGroup.add(this.cylMesh)

    /* the pebble: a rough blob, deformed deterministically so it never flickers */
    const pebbleGeo = new THREE.IcosahedronGeometry(1, 2)
    roughen(pebbleGeo)
    this.pebbleMesh = new THREE.Mesh(pebbleGeo, glass)
    this.pebbleMesh.castShadow = true
    this.objGroup.add(this.pebbleMesh)

    /* ---- dimension markers ---- */
    this.markers = new THREE.Group()
    G.add(this.markers)

    this.dimA = this.makeDim()
    this.dimD = this.makeDim()
    this.dimH = this.makeDim()
    /* the height marker runs upwards: rotate its local x axis into the y axis */
    this.dimH.root.rotation.z = Math.PI / 2
    this.markers.add(this.dimA.root, this.dimD.root, this.dimH.root)

    /* ---- the graduated cylinder, where the pebble's volume was measured ---- */
    this.grad = new THREE.Group()
    this.grad.position.set(-1.3, 0, 0.15)

    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 1.7, 24, 1, true),
      glass,
    )
    tube.position.y = 0.97
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.12, 24), dark)
    foot.position.y = 0.06
    foot.castShadow = true

    this.water = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1, 24),
      new THREE.MeshStandardMaterial({
        color: 0x2f8fd0,
        roughness: 0.12,
        transparent: true,
        opacity: 0.5,
      }),
    )
    this.water.position.y = 0.5

    this.gradLabel = makeLabel('', { color: C.input, size: 32, scale: 0.0042 })
    this.grad.add(tube, foot, this.water, this.gradLabel)
    this.markers.add(this.grad)
  }

  private makeDim(): Dim {
    const root = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: 0x9db0c6 })
    const lineGeo = new THREE.BoxGeometry(1, 0.03, 0.04)
    lineGeo.translate(0.5, 0, 0)
    const line = new THREE.Mesh(lineGeo, mat)
    const tickGeo = new THREE.BoxGeometry(0.04, 0.22, 0.04)
    const tickA = new THREE.Mesh(tickGeo, mat)
    const tickB = new THREE.Mesh(tickGeo, mat)
    const label = makeLabel('', { color: C.neutral, size: 32, scale: 0.0042 })
    root.add(line, tickA, tickB, label)
    return { root, line, tickA, tickB, label, lastText: '' }
  }

  /** Lay a marker out along its local x axis. */
  private placeDim(dim: Dim, len: number, text: string, labelY: number, labelZ: number): void {
    dim.line.scale.x = Math.max(0.05, len)
    dim.tickB.position.x = len
    if (dim.lastText !== text) {
      dim.lastText = text
      dim.label.userData.setText(text)
    }
    dim.label.position.set(len / 2, labelY, labelZ)
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    const obj = panel.section(t(S.objTitle))
    this.seg = obj.segmented({
      items: [
        { value: 'cube', label: t(S.cube), sub: t(S.cubeSub) },
        { value: 'cylinder', label: t(S.cylinder), sub: t(S.cylinderSub) },
        { value: 'pebble', label: t(S.pebble), sub: t(S.pebbleSub) },
      ],
      value: this.objectId,
      onChange: (v) => this.setObject(v as ObjectId),
    })
    this.rMass = obj.readout(t(S.mass))

    /* the measurement section is rebuilt whenever the object changes */
    this.meas = panel.section(t(S.measTitle))
    this.buildMeasurements()

    const ans = panel.section(t(S.answerTitle))
    this.answerField = ans.number({
      label: t(S.answerLabel),
      value: this.answer,
      min: 0.1,
      max: 30,
      step: 0.01,
      suffix: 'g/cm³',
      onChange: (v) => {
        this.answer = Number.isFinite(v) ? v : 0
        this.ctx.invalidate()
      },
    })
    ans.button({ label: t(S.checkBtn), variant: 'primary', onClick: () => this.check() })
    this.rReveal = ans.readout(t(S.reveal))
    this.rSize = ans.readout(t(S.revealSize))
    this.status = ans.status()
    this.goal = ans.goal(t(S.goal))

    /* explanation */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)
  }

  /** Rebuild the sliders and the derived readouts for the current specimen. */
  private buildMeasurements(): void {
    /* keep the section title, drop the old widgets */
    for (const child of Array.from(this.meas.host.children)) {
      if (!child.classList.contains('sec-title')) child.remove()
    }
    this.chainRows = []

    if (this.objectId === 'cube') {
      this.sA = this.meas.slider({
        label: t(S.sliderA),
        min: 2,
        max: 4,
        step: 0.1,
        value: this.a,
        format: (v) => `${num(v, 1)} cm`,
        onInput: (v) => { this.a = v; this.ctx.invalidate() },
      })
    } else if (this.objectId === 'cylinder') {
      this.sD = this.meas.slider({
        label: t(S.sliderD),
        min: 1,
        max: 3.2,
        step: 0.1,
        value: this.d,
        format: (v) => `${num(v, 1)} cm`,
        onInput: (v) => { this.d = v; this.ctx.invalidate() },
      })
      this.sH = this.meas.slider({
        label: t(S.sliderH),
        min: 2,
        max: 6,
        step: 0.1,
        value: this.h,
        format: (v) => `${num(v, 1)} cm`,
        onInput: (v) => { this.h = v; this.ctx.invalidate() },
      })
    } else {
      this.sV = this.meas.slider({
        label: t(S.sliderV),
        min: 8,
        max: 18,
        step: 0.5,
        value: this.v,
        format: (v) => `${num(v, 1)} cm³`,
        onInput: (v) => { this.v = v; this.ctx.invalidate() },
      })
    }

    this.meas.el('div', 'hr')
    this.rV = this.meas.readout(t(S.volume))
    this.rRho = this.meas.readout(t(S.rho))
    this.rSI = this.meas.readout(t(S.rhoSI))
    this.rRhoErr = this.meas.readout(t(S.rhoErr))

    this.meas.el('div', 'hr')
    /* one row per measured dimension: the reading together with its resolution */
    for (const row of this.measure().chain) {
      this.chainRows.push(this.meas.readout(row.label))
    }
    this.rDV = this.meas.readout(t(S.dV))
    this.rDM = this.meas.readout(t(S.dM))

    this.meas.el('div', 'hr')
    this.rRef = this.meas.readout(t(S.reference))
    this.rErr = this.meas.readout(t(S.error))
  }

  /* ------------------------------------------------------------ actions */
  private setObject(id: ObjectId): void {
    if (this.objectId === id) return
    this.objectId = id
    this.buildMeasurements()
    this.pop = 0
    this.ctx.invalidate()
  }

  /** Compare the student's number with the density the lab computes. */
  private check(): void {
    /* the verdict itself is derived in syncHud, so it survives a restore */
    this.checked = true
    this.ctx.invalidate()
  }

  /** Only the piece that is on the bench may be grabbed. */
  private pickTargets(): THREE.Object3D[] {
    if (this.objectId === 'cube') return [this.cubeMesh]
    if (this.objectId === 'cylinder') return [this.cylMesh]
    return [this.pebbleMesh]
  }

  /* --------------------------------------------------------- interaction */
  onPointerDown(event: PointerEvent): boolean {
    if (event.button !== 0) return false
    const hits = pick(event, this.ctx.camera, this.ctx.dom, this.pickTargets())
    if (!hits.length) return false
    const p = rayPlaneZ(event, this.ctx.camera, this.ctx.dom, 0)
    if (!p) return false
    this.drag = { offset: this.objX - p.x }
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
    const x = clamp(p.x + this.drag.offset, -2.8, 1.2)
    if (Math.abs(x - this.objX) > 1e-4) {
      this.objX = x
      this.ctx.invalidate()
    }
  }

  onPointerUp(): void {
    if (this.drag) {
      this.drag = null
      this.ctx.dom.style.cursor = 'default'
    }
  }

  /* --------------------------------------------------------------- frame */
  update(dt: number): boolean {
    const sig =
      `${this.objectId}|${this.a}|${this.d}|${this.h}|${this.v}|` +
      `${this.objX.toFixed(3)}|${this.answer}|${this.checked}`
    let dirty = sig !== this.vizSig
    this.vizSig = sig

    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 3.2)
      dirty = true
    }
    if (!dirty) return false

    this.applyScene()
    this.syncHud()
    return true
  }

  /* ------------------------------------------------------------- physics */
  private mass(): number {
    return MASS[this.objectId]
  }

  /** Volume from the student's readings, plus how uncertain that volume is. */
  private measure(): { V: number; dVrel: number; chain: { label: string; value: string }[] } {
    if (this.objectId === 'cube') {
      return {
        V: this.a ** 3,
        /* V = a³ → the relative error is multiplied by the power */
        dVrel: (3 * RULER) / this.a,
        chain: [{ label: t(S.chainA), value: `${num(this.a, 1)} ± ${num(RULER, 1)} cm` }],
      }
    }
    if (this.objectId === 'cylinder') {
      return {
        V: Math.PI * (this.d / 2) ** 2 * this.h,
        /* V = π (d/2)² h → d counts twice, h once */
        dVrel: (2 * RULER) / this.d + RULER / this.h,
        chain: [
          { label: t(S.chainD), value: `${num(this.d, 1)} ± ${num(RULER, 1)} cm` },
          { label: t(S.chainH), value: `${num(this.h, 1)} ± ${num(RULER, 1)} cm` },
        ],
      }
    }
    return {
      V: this.v,
      dVrel: JAR / this.v,
      chain: [{ label: t(S.chainV), value: `${num(this.v, 1)} ± ${num(JAR, 1)} cm³` }],
    }
  }

  private rho(): number {
    return this.mass() / this.measure().V
  }

  /** The teacher's own measurement — the hidden "true" size of the specimen. */
  private teacherText(): string {
    if (this.objectId === 'cube') {
      return `${t(S.sizeA)} ${num(3.02, 2)} cm · V = ${num(3.02 ** 3, 2)} cm³`
    }
    if (this.objectId === 'cylinder') {
      const v = Math.PI * (2.38 / 2) ** 2 * 3.98
      return (
        `${t(S.sizeD)} ${num(2.38, 2)} cm · ${t(S.sizeH)} ${num(3.98, 2)} cm · ` +
        `V = ${num(v, 2)} cm³`
      )
    }
    return `${t(S.sizeV)} ${num(12.7, 2)} cm³`
  }

  /* -------------------------------------------------------------- scene */
  private applyScene(): void {
    this.objGroup.position.set(this.objX, BENCH_TOP, 0)
    this.markers.position.set(this.objX, BENCH_TOP, 0)

    /* the piece pops into place when it changes */
    const k = this.pop * this.pop * (3 - 2 * this.pop)
    this.objGroup.scale.setScalar(0.88 + 0.12 * k)

    this.cubeMesh.visible = this.objectId === 'cube'
    this.cylMesh.visible = this.objectId === 'cylinder'
    this.pebbleMesh.visible = this.objectId === 'pebble'
    this.dimA.root.visible = this.objectId === 'cube'
    this.dimD.root.visible = this.objectId === 'cylinder'
    this.dimH.root.visible = this.objectId === 'cylinder'
    this.grad.visible = this.objectId === 'pebble'

    this.massLabel.userData.setText(`m = ${num(this.mass(), 1)} g`)

    if (this.objectId === 'cube') {
      const s = this.a * U
      this.cubeMesh.scale.set(s, s, s)
      this.cubeMesh.position.y = s / 2
      this.dimA.root.position.set(0, 0.02, s / 2 + 0.25)
      this.placeDim(this.dimA, s, `a = ${num(this.a, 1)} cm`, 0.24, 0)
    } else if (this.objectId === 'cylinder') {
      const dw = this.d * U
      const hh = this.h * U
      this.cylMesh.scale.set(dw, hh, dw)
      this.cylMesh.position.y = hh / 2
      this.dimD.root.position.set(0, 0.02, dw / 2 + 0.22)
      this.placeDim(this.dimD, dw, `d = ${num(this.d, 1)} cm`, 0.22, 0)
      this.dimH.root.position.set(dw / 2 + 0.3, 0, 0)
      this.placeDim(this.dimH, hh, `h = ${num(this.h, 1)} cm`, -0.34, 0)
    } else {
      /* the pebble is drawn from its volume, so it grows with the reading */
      const r = Math.cbrt(this.v / 2.45) * U
      this.pebbleMesh.scale.set(r, r, r)
      this.pebbleMesh.position.y = r * 0.9
      const wh = this.v * 0.055
      this.water.scale.set(1, wh, 1)
      this.water.position.y = 0.12 + wh / 2
      this.gradLabel.userData.setText(`V_air = ${num(this.v, 1)} cm³`)
      this.gradLabel.position.set(0, 0.2 + wh, 0)
    }
  }

  /* -------------------------------------------------------------- panel */
  private syncHud(): void {
    const m = this.mass()
    const { V, dVrel, chain } = this.measure()
    const rho = this.rho()
    const dmrel = BALANCE / m
    /* worst case: the relative errors simply add up */
    const drho = rho * (dmrel + dVrel)
    const err = ((rho - TRUE_RHO) / TRUE_RHO) * 100

    this.rMass.set(`${num(m, 1)} g`, 'output')
    this.rV.set(`${num(V, 2)} cm³`, 'neutral')
    this.rRho.set(`${num(rho, 2)} g/cm³`, 'result')
    this.rSI.set(`${num(rho * 1000, 0)} kg/m³`, 'result')
    this.rRhoErr.set(`${num(rho, 2)} ± ${num(drho, 2)} g/cm³`, 'result')

    for (let i = 0; i < this.chainRows.length; i++) {
      this.chainRows[i].set(chain[i]?.value ?? '—', 'neutral')
    }
    this.rDV.set(`${num(dVrel * 100, 1)} %`, 'warn')
    this.rDM.set(`${num(dmrel * 100, 1)} %`, 'warn')
    this.rRef.set(`${num(TRUE_RHO, 2)} g/cm³ = ${num(TRUE_RHO * 1000, 0)} kg/m³`, 'neutral')
    this.rErr.set(`${err >= 0 ? '+' : '−'}${num(Math.abs(err), 1)} %`, 'warn')

    /* the answer is only revealed once the student has checked it */
    if (this.checked) {
      this.rReveal.set(`${num(TRUE_RHO, 2)} g/cm³ = ${num(TRUE_RHO * 1000, 0)} kg/m³`, 'result')
      this.rSize.set(this.teacherText(), 'neutral')
    } else {
      this.rReveal.set('—', 'neutral')
      this.rSize.set('—', 'neutral')
    }

    this.syncStatus(rho, err)
  }

  private syncStatus(rho: number, err: number): void {
    if (!this.checked) {
      this.status.set(`${t(S.ready)}<span class="sub">${t(S.readySub)}</span>`, 'neutral')
      this.goal.setDone(false)
      return
    }
    if (!Number.isFinite(this.answer) || this.answer <= 0) {
      this.status.set(`${t(S.empty)}<span class="sub">${t(S.emptySub)}</span>`, 'warn')
      this.goal.setDone(false)
      return
    }
    const gap = Math.abs(this.answer - rho)
    /* two per cent is as close as the instruments can tell */
    if (gap / rho <= 0.02) {
      this.status.set(
        `${t(S.correct)}<span class="sub">${tf(S.correctSub, {
          r: num(this.answer, 2),
          c: num(rho, 2),
          e: num(Math.abs(err), 1),
        })}</span>`,
        'result',
      )
      this.goal.setDone(true, tf(S.goalDone, { r: num(this.answer, 2) }))
    } else {
      this.status.set(
        `${t(S.wrong)}<span class="sub">${tf(S.wrongSub, {
          r: num(this.answer, 2),
          c: num(rho, 2),
          d: num(gap, 2),
        })}</span>`,
        'bad',
      )
      this.goal.setDone(false)
    }
  }

  /* ------------------------------------------------------------- persist */
  serialize(): unknown {
    return {
      object: this.objectId,
      a: this.a,
      d: this.d,
      h: this.h,
      v: this.v,
      answer: this.answer,
      checked: this.checked,
      x: this.objX,
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, unknown>

    const id = s.object
    if (id === 'cube' || id === 'cylinder' || id === 'pebble') this.setObject(id)
    if (typeof s.a === 'number') this.a = s.a
    if (typeof s.d === 'number') this.d = s.d
    if (typeof s.h === 'number') this.h = s.h
    if (typeof s.v === 'number') this.v = s.v
    if (typeof s.answer === 'number') this.answer = s.answer
    if (typeof s.checked === 'boolean') this.checked = s.checked
    if (typeof s.x === 'number') this.objX = clamp(s.x, -2.8, 1.2)

    /* push the state back into the panel */
    this.seg?.set(this.objectId)
    this.sA?.set(this.a)
    this.sD?.set(this.d)
    this.sH?.set(this.h)
    this.sV?.set(this.v)
    this.answerField?.set(this.answer)

    this.ctx.invalidate()
  }

  dispose(): void {
    disposeObject(this.root)
  }
}

/**
 * Deform a sphere into a rough pebble.
 *
 * The displacement is a function of the vertex position, so the shape is
 * identical every time the lab opens — a random blob would make the saved
 * progress look different on every visit.
 */
function roughen(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = 1 + 0.14 * Math.sin(x * 5.1 + y * 3.7 + z * 2.9)
    pos.setXYZ(i, x * k, y * k * 0.88, z * k)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

export default function createDensityLab(ctx: LabContext): LabInstance {
  return new DensityLab(ctx)
}
