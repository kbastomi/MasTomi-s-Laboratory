# Adding a simulation

A new simulation is **one file** plus **one entry** in the catalogue. You do
not touch the engine, the router or the panel.

Let's build a worked example: a *pendulum* for the Dynamics chapter.

---

## 1. Write the module

Create `lab/src/rooms/dynamics/pendulum.ts`.

```ts
import * as THREE from 'three'
import { L, num, t } from '../../core/i18n'
import { clamp, G } from '../../core/math'
import type { LabContext, LabInstance, PanelContext, Readout } from '../../core/lab'
import { disposeObject, makeArrow } from '../../kit/arrows'
import { makeLabel } from '../../kit/labels'
import { Plot } from '../../kit/plot'

/* every user-visible string exists in both languages */
const S = {
  setup:   L('Penyiapan', 'Setup'),
  length:  L('Panjang tali  L', 'Rope length  L'),
  angle:   L('Sudut awal  θ₀', 'Starting angle  θ₀'),
  results: L('Hasil', 'Results'),
  period:  L('Periode  T', 'Period  T'),
}

class PendulumLab implements LabInstance {
  readonly root = new THREE.Group()

  private ctx: LabContext
  private L = 1.2          // metres
  private theta = 0.4      // radians
  private omega = 0        // rad/s
  private periodReadout!: Readout

  constructor(ctx: LabContext) {
    this.ctx = ctx
    this.root.name = 'pendulum-lab'
    this.buildScene()
    /* note: do NOT build the panel here — the platform calls buildPanel() */
  }

  /* ---------------------------------------------------------------- scene */
  private buildScene(): void {
    // ... your three.js objects ...
  }

  /* ------------------------------------------------------------- the panel */
  buildPanel(panel: PanelContext): void {
    const setup = panel.section(t(S.setup))
    setup.slider({
      label: t(S.length),
      min: 0.4, max: 3, step: 0.05, value: this.L,
      format: (v) => `${num(v, 2)} m`,
      onInput: (v) => { this.L = v; this.ctx.invalidate() },
    })

    const results = panel.section(t(S.results))
    this.periodReadout = results.readout(t(S.period))
  }

  /* -------------------------------------------------------------- physics */
  update(dt: number): boolean {
    // ... integrate, then move your objects ...
    this.periodReadout.set(`${num(2 * Math.PI * Math.sqrt(this.L / G), 2)} s`)
    return true   // true → the scene must be redrawn
  }

  /* ------------------------------------------------------------- pointer */
  onPointerDown(event: PointerEvent): boolean { return false }
  onPointerMove(event: PointerEvent): void {}
  onPointerUp(event: PointerEvent): void {}

  /* ------------------------------------------------------------ progress */
  serialize(): unknown {
    return { L: this.L, theta: this.theta }
  }

  restore(state: unknown): void {
    if (!state || typeof state !== 'object') return
    const s = state as Record<string, number>
    if (typeof s.L === 'number') this.L = s.L
    if (typeof s.theta === 'number') this.theta = s.theta
  }

  dispose(): void {
    disposeObject(this.root)
  }
}

export default function createPendulumLab(ctx: LabContext): LabInstance {
  return new PendulumLab(ctx)
}
```

### The rules that matter

| Rule | Why |
|---|---|
| `export default` a factory that takes a `LabContext` | the platform calls it with the camera, the panel and an `invalidate()` |
| **do not** call `buildPanel` in the constructor | the platform calls it exactly once, after you exist |
| `update(dt)` returns `true` when something moved | the engine only redraws when you say so — this is what keeps an idle lab at 0 % CPU |
| `dt` is already clamped to 0.1 s | you do not need your own guard |
| every string goes through `L()` | the whole laboratory is bilingual |
| `serialize()` returns plain JSON | it is stored verbatim and synced to the back-end |
| `restore()` must put the UI back too | call your slider handles' `set()` inside it |

### Claiming a pointer

The platform routes every pointer event to the lab **first**, and only lets
the camera move if the lab did not want it:

```ts
onPointerDown(event: PointerEvent): boolean {
  const hit = pick(event, this.ctx.camera, this.ctx.dom, [this.crate])
  if (!hit.length) return false          // false → the camera may orbit
  this.drag = { ... }                    // true  → the lab owns the drag
  return true
}
```

Return `true` whenever the student grabs one of your objects, and `false`
when the pointer misses. The camera tracks the pointer either way (so a
two-finger pinch still works), but it will not move while your lab is
dragging.

`onPointerMove` is called for every move over the canvas and for every move
while a drag is in progress; `onPointerUp` ends the drag.

---

## 2. Register it in the catalogue

Open `lab/src/catalog/chapters.ts` and add it to the chapter's `labs` array:

```ts
{
  id: 'dynamics.pendulum',
  room: 'dynamics',
  title: L('Bandul', 'Pendulum'),
  blurb: L('Ayunan sederhana — how the period depends on the length.',
           'A simple swing — how the period depends on the length.'),
  tags: [L('osilasi', 'oscillation'), L('periode', 'period')],
  level: 3,
  mode: ['sim', 'demo'],
  concepts: [L('T = 2π√(L/g)', 'T = 2π√(L/g)')],
  estMinutes: 8,
  camera: { target: [0, 1.5, 0], radius: 8, azim: 0, polar: 1.35 },
  load: () => import('../rooms/dynamics/pendulum'),
}
```

That is the whole integration. The chapter page, the search, the progress
tracking and the language switch all pick it up automatically.

If the chapter does not exist yet, add it to `CHAPTERS` with an empty `labs`
array and a `planned` list.

---

## 3. Reuse the kit

Before writing geometry, check whether the kit already has it:

| Need | Use |
|---|---|
| a text label in the scene | `makeLabel(text, { color, size })` from `kit/labels` |
| a force or velocity arrow | `makeArrow(color, { labelSide })` from `kit/arrows` |
| a crate / sheave / plate / rope | `kit/objects` |
| a slider, button, readout, goal | the `PanelContext` handed to `buildPanel` |
| a graph (v–t, x–t, F–t) | `new Plot(section.host, { title, xLabel, yLabel })` |
| ray picking | `pick`, `rayPlaneZ`, `hover` from `kit/picking` |
| shared colours | `C` from `kit/arrows` |

Colour roles are consistent across the whole laboratory:

| Colour | Meaning |
|---|---|
| teal `#38d6c4` | **input** — what the student applies |
| orange `#ff9f43` | **output** — the load, the result |
| green `#5ee07a` | the useful force the machine produces |

---

## 4. Check it

```powershell
npm run typecheck     # types
npm run build         # production build
npm run qa            # headless Chrome checks + screenshots
```

`npm run qa` writes screenshots to `tools/qa/shots/`. Add a check for your new
lab in `tools/qa/run.mjs` so a regression is caught before it reaches a
student.

---

## 5. Performance checklist

A new lab should not make the whole laboratory slow:

- [ ] keep the object count sane (a few dozen, not hundreds)
- [ ] reuse geometries and materials where you can
- [ ] return `true` from `update()` only when something actually moved
- [ ] set `rendering: { shadows: false }` in the lab definition if the scene
      does not need shadows — it is the single biggest win on a weak GPU
- [ ] avoid allocating new `Vector3`s every frame — reuse scratch vectors
