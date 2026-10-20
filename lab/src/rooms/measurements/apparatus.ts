import * as THREE from 'three'
import { L, num, t, tf } from '../../core/i18n'
import { clamp } from '../../core/math'
import type {
  CameraSpec,
  LabContext,
  LabInstance,
  PanelContext,
  Readout,
  StatusHandle,
  GoalHandle,
} from '../../core/lab'
import { disposeObject } from '../../kit/arrows'
import {
  Micrometer,
  OhausBalance,
  Stopwatch,
  VernierCaliper,
  type Instrument,
} from './instruments'

/**
 * Reading a measuring instrument.
 *
 * The student operates four real instruments and has to read them the way a
 * scientist would: find the last whole division on the main scale, then read
 * the matching division on the vernier (or the thimble, or the pointer).
 *
 * Each instrument is operated by dragging it, and the reading is recorded by
 * choosing it from a list of plausible values — so the skill being practised
 * is reading, not clicking.
 */

const S = {
  instrument: L('Alat ukur', 'Measuring instrument'),
  vernier: L('Jangka pengukur', 'Vernier caliper'),
  micrometer: L('Mikrometer sekrup', 'Micrometer'),
  balance: L('Timbangan Ohaus', 'Ohaus balance'),
  stopwatch: L('Stopwatch analog', 'Analog stopwatch'),
  mode: L('Mode', 'Mode'),
  explore: L('Belajar', 'Explore'),
  challenge: L('Tantangan', 'Challenge'),
  newObject: L('Objek baru', 'New object'),
  task: L('Tugas baca', 'Reading task'),
  taskVernier: L(
    'Tutup rahang pada benda, lalu baca skala utama dan skala vernier.',
    'Close the jaws on the object, then read the main scale and the vernier.',
  ),
  taskMicrometer: L(
    'Putuskan benang mikrometer pada benda, lalu baca skala sleeve dan thimble.',
    'Wind the micrometer onto the object, then read the sleeve and the thimble.',
  ),
  taskBalance: L(
    'Letakkan berat pada pan, lalu baca posisi pointer pada busur.',
    'Put the weights on the pan, then read the pointer on the arc.',
  ),
  taskStopwatch: L(
    'Baca dial detik dan dial menit pada stopwatch.',
    'Read the seconds dial and the minutes dial on the stopwatch.',
  ),
  pick: L('Pembacaanmu', 'Your reading'),
  check: L('Periksa', 'Check'),
  correct: L('BENAR', 'CORRECT'),
  wrong: L('BELUM TEPAT', 'NOT QUITE'),
  correctSub: L(
    'Bacaannya tepat. Ingat: skala utama dibaca pada garis yang tepat, lalu ditambah satu divisi vernier.',
    'That is right. Remember: take the main scale at the line, then add one vernier division.',
  ),
  wrongSub: L(
    'Yang benar adalah {v}. Coba cek kembali cara membaca skala principale.',
    'The correct value is {v}. Try reading the main scale again.',
  ),
  measurements: L('Pengukuran', 'Measurements'),
  mainScale: L('Skala utama', 'Main scale'),
  vernierScale: L('Skala vernier', 'Vernier scale'),
  sleeve: L('Skala sleeve', 'Sleeve scale'),
  thimble: L('Skala thimble', 'Thimble scale'),
  onPan: L('Berat di pan', 'Weights on the pan'),
  dial: L('Pembacaan dial', 'Dial reading'),
  live: L('Pembacaan langsung', 'Live reading'),
  taskDone: L('Bacaan benar', 'Reading correct'),
  goal: L('Baca инструksi ini dengan benar', 'Read this instrument correctly'),
  goalDone: L('Bagus! Kamu membaca {v} dengan benar', 'Well done — you read {v} correctly'),
  howTitle: L('Cara membaca alat ukur', 'How to read an instrument'),
  howBody: L(
    'Setiap alat ukur punya <b>divisi terkecil</b> — itulah ketelitian pembacaannya. ' +
      'Baca <b>skala utama</b> pada garis yang tepat di depan nol skala kecil, lalu tambahkan ' +
      'divisi kecil yang berimpit dengan satu garis skala utama.<br><br>' +
      'Jangka pengukur: <code>1 divisi vernier = 0,1 mm</code>. ' +
      'Mikrometer: <code>1 divisi thimble = 0,01 mm</code>. ' +
      'Timbangan: <code>1 divisi busur = 0,1 g</code>. ' +
      'Stopwatch: <code>1 divisi dial = 0,1 s</code>.<br><br>' +
      'Angka yang diukur harus <b>selalu ditulis dengan satuan</b> dan ' +
      'dibulatkan mengikuti ketelitian alat — bukan lebih panjang.',
    'Every instrument has a <b>smallest division</b> — that is its precision. ' +
      'Read the <b>main scale</b> at the line just before the zero of the small scale, then add ' +
      'the small division that lines up with a line on the main scale.<br><br>' +
      'Vernier caliper: <code>1 vernier division = 0.1 mm</code>. ' +
      'Micrometer: <code>1 thimble division = 0.01 mm</code>. ' +
      'Balance: <code>1 arc division = 0.1 g</code>. ' +
      'Stopwatch: <code>1 dial division = 0.1 s</code>.<br><br>' +
      'A measured value is <b>always written with its unit</b> and rounded to the ' +
      'precision of the instrument — never with more digits than the instrument can give.',
  ),
}

/** Where the camera sits for each instrument. */
const VIEWS: Record<string, CameraSpec> = {
  /* looking down at the beam, so the two scales can be read against each other */
  vernier: { target: [2.9, 0.1, 0.1], radius: 7.2, azim: 0, polar: 0.48 },
  /* the thimble's face points at the camera, so the reference line is visible */
  micrometer: { target: [1.8, 0.35, 0.3], radius: 7.6, azim: 0, polar: 1.22 },
  balance: { target: [0, 1.9, 0.3], radius: 8.0, azim: 0, polar: 1.34 },
  stopwatch: { target: [0, 0, 0], radius: 5.6, azim: 0, polar: 1.5 },
}

class ApparatusLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext
  private instruments: Instrument[] = []
  private activeIndex = 0
  private active!: Instrument

  /* challenge */
  private challenge = false
  private target: number | null = null
  private options: number[] = []
  private answered = false
  private answerButtons: HTMLButtonElement[] = []
  private optionRow!: HTMLElement

  /* panel */
  private sections: HTMLElement[] = []
  private rMain!: Readout
  private rVernier!: Readout
  private rSleeve!: Readout
  private rThimble!: Readout
  private rPan!: Readout
  private rDial!: Readout
  private rLive!: Readout
  private status!: StatusHandle
  private goal!: GoalHandle
  private taskText!: HTMLElement

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'apparatus-lab'

    const ictx = {
      camera: ctx.camera,
      dom: ctx.dom,
      invalidate: () => ctx.invalidate(),
    }

    this.instruments = [new VernierCaliper(ictx), new Micrometer(ictx), new OhausBalance(ictx), new Stopwatch(ictx)]
    for (const inst of this.instruments) {
      inst.group.visible = false
      this.root.add(inst.group)
    }
    this.active = this.instruments[0]
    this.active.group.visible = true
  }

  private get unitLabel(): string {
    if (this.active.id === 'balance') return 'g'
    if (this.active.id === 'stopwatch') return 's'
    return 'mm'
  }

  /* -------------------------------------------------------------- panel */
  buildPanel(panel: PanelContext): void {
    /* --- which instrument --- */
    const head = panel.section(t(S.instrument))
    head.segmented({
      items: [
        { value: '0', label: t(S.vernier) },
        { value: '1', label: t(S.micrometer) },
        { value: '2', label: t(S.balance) },
        { value: '3', label: t(S.stopwatch) },
      ],
      value: '0',
      cols: 2,
      onChange: (v) => this.select(parseInt(v, 10)),
    })

    const modeRow = head.el('div', 'row-2')
    const exploreBtn = head.el('button', 'btn', t(S.explore))
    const challengeBtn = head.el('button', 'btn btn-primary', t(S.challenge))
    exploreBtn.addEventListener('click', () => this.setMode(false))
    challengeBtn.addEventListener('click', () => this.setMode(true))
    modeRow.append(exploreBtn, challengeBtn)

    const newBtn = head.el('button', 'btn btn-ghost', t(S.newObject))
    newBtn.addEventListener('click', () => this.newChallenge())
    head.el('div', 'row-2').append(newBtn)

    /* --- the task --- */
    const task = panel.section(t(S.task))
    this.taskText = task.el('div', 'task-text', t(S.taskVernier))
    const optionRow = task.el('div', 'options')
    this.optionRow = optionRow
    this.answerButtons = []
    for (let i = 0; i < 4; i++) {
      const b = task.el('button', 'option')
      b.addEventListener('click', () => this.answer(i))
      optionRow.appendChild(b)
      this.answerButtons.push(b)
    }
    this.status = task.status()
    this.goal = task.goal(t(S.goal))

    /* --- one section per instrument --- */
    const vernierSec = panel.section(t(S.vernier))
    this.rMain = vernierSec.readout(t(S.mainScale))
    this.rVernier = vernierSec.readout(t(S.vernierScale))
    this.sections.push(vernierSec.host)

    const microSec = panel.section(t(S.micrometer))
    this.rSleeve = microSec.readout(t(S.sleeve))
    this.rThimble = microSec.readout(t(S.thimble))
    this.sections.push(microSec.host)

    const balanceSec = panel.section(t(S.balance))
    this.rPan = balanceSec.readout(t(S.onPan))
    this.sections.push(balanceSec.host)

    const stopSec = panel.section(t(S.stopwatch))
    this.rDial = stopSec.readout(t(S.dial))
    this.sections.push(stopSec.host)

    /* --- the live reading (explore mode) --- */
    const liveSec = panel.section(t(S.live))
    this.rLive = liveSec.readout(t(S.live))
    this.sections.push(liveSec.host)

    /* --- how to read them --- */
    const details = panel.el('details', 'info')
    const summary = panel.el('summary', '', t(S.howTitle))
    const body = panel.el('div', 'body')
    body.innerHTML = t(S.howBody)
    details.append(summary, body)

    this.setMode(false)
    this.select(0)
  }

  /* ------------------------------------------------------------- actions */
  private select(index: number): void {
    this.activeIndex = clamp(index, 0, this.instruments.length - 1)
    this.instruments.forEach((inst, i) => {
      inst.group.visible = i === this.activeIndex
    })
    this.active = this.instruments[this.activeIndex]

    /* only this instrument's section stays visible */
    this.sections.forEach((el, i) => {
      const isInstrument = i < 4
      el.style.display = isInstrument ? (i === this.activeIndex ? '' : 'none') : ''
    })

    this.ctx.setCamera(VIEWS[this.active.id])
    this.updateTaskText()
    /* a new instrument needs its own object to measure */
    if (this.challenge) this.newChallenge()
    this.refreshOptions()
    this.ctx.invalidate()
  }

  private setMode(challenge: boolean): void {
    this.challenge = challenge
    this.answered = false
    if (challenge) this.newChallenge()
    else {
      this.target = null
      this.options = []
      this.goal.setDone(false)
      this.status.set('', 'neutral')
    }
    this.refreshOptions()
    this.ctx.invalidate()
  }

  private updateTaskText(): void {
    const text =
      this.active.id === 'vernier' ? S.taskVernier
      : this.active.id === 'micrometer' ? S.taskMicrometer
      : this.active.id === 'balance' ? S.taskBalance
      : S.taskStopwatch
    this.taskText.textContent = t(text)
  }

  /** A fresh object to measure. */
  private newChallenge(): void {
    this.answered = false
    this.goal.setDone(false)
    this.status.set('', 'neutral')

    const id = this.active.id
    let target = 0
    if (id === 'vernier') {
      target = Math.round((5 + Math.random() * 45) * 10) / 10
      ;(this.active as VernierCaliper).setTarget(target)
    } else if (id === 'micrometer') {
      target = Math.round((0.5 + Math.random() * 4) * 100) / 100
      ;(this.active as Micrometer).setTarget(target)
    } else if (id === 'balance') {
      const pool = [1, 2, 5, 10, 20, 50]
      const pick = () => pool[Math.floor(Math.random() * pool.length)]
      const a = pick()
      const b = Math.random() > 0.4 ? pick() : 0
      target = a + b
      ;(this.active as OhausBalance).setTarget(target)
    } else {
      target = Math.round((5 + Math.random() * 280) * 10) / 10
      ;(this.active as Stopwatch).setTarget(target)
    }
    this.target = target

    /* four plausible readings — the right one and three near misses */
    const p = this.active.precision
    const wrong = new Set<number>()
    while (wrong.size < 3) {
      const offset = (Math.floor(Math.random() * 5) - 2) * p * (1 + Math.floor(Math.random() * 4))
      const v = Math.round((target + offset) * 1000) / 1000
      if (v > 0 && Math.abs(v - target) > p * 0.5) wrong.add(v)
    }
    const opts = [target, ...wrong]
    /* shuffle so the answer is not always first */
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[opts[i], opts[j]] = [opts[j], opts[i]]
    }
    this.options = opts
    this.refreshOptions()
  }

  private refreshOptions(): void {
    const show = this.challenge && this.options.length > 0
    this.optionRow.style.display = show ? '' : 'none'
    this.answerButtons.forEach((b, i) => {
      b.style.display = show ? '' : 'none'
      if (show) b.textContent = `${num(this.options[i], this.active.precision === 0.01 ? 2 : 1)} ${this.unitLabel}`
    })
  }

  private answer(index: number): void {
    if (!this.challenge || this.answered) return
    const chosen = this.options[index]
    const right = this.target
    if (right === null) return
    this.answered = true

    const ok = Math.abs(chosen - right) < this.active.precision * 0.5
    this.answerButtons.forEach((b, i) => {
      b.classList.toggle('right', Math.abs(this.options[i] - right) < this.active.precision * 0.5)
      b.classList.toggle('wrong', i === index && !ok)
    })

    if (ok) {
      this.status.set(
        `${t(S.correct)}<span class="sub">${t(S.correctSub)}</span>`,
        'result',
      )
      this.goal.setDone(true, tf(S.goalDone, { v: `${num(right, this.active.precision === 0.01 ? 2 : 1)} ${this.unitLabel}` }))
    } else {
      this.status.set(
        `${t(S.wrong)}<span class="sub">${tf(S.wrongSub, {
          v: `${num(right, this.active.precision === 0.01 ? 2 : 1)} ${this.unitLabel}`,
        })}</span>`,
        'warn',
      )
    }
    this.ctx.invalidate()
  }

  /* ------------------------------------------------------------ the read */
  /** How the student should read the active instrument, split into parts. */
  private readingParts(): { main: string; small: string; value: number } {
    const r = this.active.reading()
    if (this.active.id === 'vernier') {
      const main = Math.floor(r)
      const k = Math.round((r - main) * 10) % 10
      return { main: `${num(main, 0)} mm`, small: `${num(k, 0)} × 0,1 mm`, value: main + k * 0.1 }
    }
    if (this.active.id === 'micrometer') {
      const sleeve = Math.floor(r * 2) / 2
      const k = Math.round(r * 100) % 50
      return { main: `${num(sleeve, 1)} mm`, small: `${num(k, 0)} × 0,01 mm`, value: sleeve + k * 0.01 }
    }
    if (this.active.id === 'balance') {
      return { main: `${num(r, 1)} g`, small: '', value: r }
    }
    const minutes = Math.floor(r / 60)
    const seconds = r - minutes * 60
    return { main: `${num(minutes, 0)} min ${num(seconds, 1)} s`, small: '', value: r }
  }

  /* -------------------------------------------------------------- frame */
  update(dt: number): boolean {
    let dirty = false
    for (const inst of this.instruments) {
      if (inst.group.visible && inst.update(dt)) dirty = true
    }

    const parts = this.readingParts()
    if (this.active.id === 'vernier') {
      this.rMain.set(parts.main, 'neutral')
      this.rVernier.set(parts.small, 'neutral')
    } else if (this.active.id === 'micrometer') {
      this.rSleeve.set(parts.main, 'neutral')
      this.rThimble.set(parts.small, 'neutral')
    } else if (this.active.id === 'balance') {
      this.rPan.set(parts.main, 'neutral')
    } else {
      this.rDial.set(parts.main, 'neutral')
    }

    /* in explore mode the reading is shown; in challenge mode it is hidden */
    this.rLive.set(
      this.challenge && !this.answered
        ? '—'
        : `${num(parts.value, this.active.precision === 0.01 ? 2 : 1)} ${this.unitLabel}`,
      'result',
    )
    return dirty
  }

  /* ------------------------------------------------------------ pointer */
  onPointerDown(event: PointerEvent): boolean {
    return this.active.onPointerDown(event)
  }

  onPointerMove(event: PointerEvent): void {
    this.active.onPointerMove(event)
  }

  onPointerUp(): void {
    this.active.onPointerUp()
  }

  /* ------------------------------------------------------------ persist */
  serialize(): unknown {
    return {
      instrument: this.activeIndex,
      challenge: this.challenge,
      target: this.target,
      readings: this.instruments.map((i) => i.reading()),
    }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, unknown>
    if (typeof s.instrument === 'number') this.select(s.instrument)
    if (typeof s.challenge === 'boolean') this.setMode(s.challenge)
  }

  dispose(): void {
    for (const inst of this.instruments) inst.dispose()
    disposeObject(this.root)
  }
}

export default function createApparatusLab(ctx: LabContext): LabInstance {
  return new ApparatusLab(ctx)
}
