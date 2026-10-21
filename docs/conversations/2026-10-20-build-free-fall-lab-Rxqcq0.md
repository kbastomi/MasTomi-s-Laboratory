# Build free fall lab

| | |
|---|---|
| **Session ID** | `ses_ea7b4d0a5ffeV2CdIiRLRxqcq0` |
| **Directory** | `D:/lab` |
| **Started** | 2026-10-20 14:51 |
| **Last activity** | 2026-10-20 14:51 |
| **Messages** | 3 |
| **Model** | opencode/glm-5.3-flash |
| **Exported** | 2026-10-21 |

---

### 👤 Student · 14:51

You are a subagent spawned by another session.
Write ONE new file: `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\kinematics\freefall.ts`

This is a physics lab for a virtual 3D physics laboratory (three.js + TypeScript + Vite). It is the "free fall" activity of the Kinematics chapter.

## CRITICAL: files you may touch
Create ONLY `lab/src/rooms/kinematics/freefall.ts` (and the `lab/src/rooms/kinematics/` folder if it does not exist).
Do NOT modify ANY other file. In particular do NOT touch:
- `lab/src/catalog/**` (the catalogue is being restructured right now by someone else)
- `lab/src/core/**`, `lab/src/kit/**`, `lab/src/rooms/mechanics/**`, `lab/src/rooms/measurements/**`
- `tools/**`, `package.json`, `vite.config.ts`, `tsconfig.json`
Your file will be registered in the catalogue by someone else afterwards.

Another agent is writing `projectile.ts` into the same folder at the same time — do not create, read-modify or overwrite that file, and do not add any import of it.

## READ THESE FIRST (in this order) — they define the API and the house style
1. `D:\lab\MasTomi-s-Laboratory\docs\ADDING-A-LAB.md` — the contract, the rules, the "rules that matter" table
2. `D:\lab\MasTomi-s-Laboratory\lab\src\core\lab.ts` — the `LabInstance` / `LabContext` / `PanelContext` types you must implement
3. `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\mechanics\lever.ts` — THE reference example. Match its structure, naming, comment style and idioms closely.
4. `D:\lab\MasTomi-s-Laboratory\lab\src\kit\panel.ts` — the panel widgets: `slider`, `number`, `readout`, `segmented`, `button`, `status`, `goal`, `el`
5. `D:\lab\MasTomi-s-Laboratory\lab\src\kit\arrows.ts` (`makeArrow`, `C` palette, `disposeObject`), `labels.ts` (`makeLabel`), `picking.ts` (`pick`, `rayPlaneZ`, `hover`, `isInside`), `objects.ts` (`makeCrate`, `makePlate`, `makeSheave`)
6. `D:\lab\MasTomi-s-Laboratory\lab\src\core\i18n.ts` — `L(id, en)`, `t()`, `tf(pair, vars)`, `num(value, decimals)`
7. `D:\lab\MasTomi-s-Laboratory\lab\src\core\math.ts` — `clamp`, `lerp`, `smooth`, `tanh`, `G`
8. `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\mechanics\incline.ts` — the best example of a *numerically integrated* lab: fixed small timestep, static-versus-kinetic logic, and how the readouts are refreshed.

Import paths from `lab/src/rooms/kinematics/` are `../../core/...` and `../../kit/...`.

## HARD RULES (the build is strict — `noUnusedLocals` and `noUnusedParameters` are ON, `strict` is ON)
- Export `export default function createFreeFallLab(ctx: LabContext): LabInstance { return new FreeFallLab(ctx) }`
- The class implements `LabInstance` exactly: `readonly root: THREE.Group`, `update(dt: number): boolean`, `onPointerDown(e: PointerEvent): boolean`, `onPointerMove(e: PointerEvent): void`, `onPointerUp(e: PointerEvent): void`, `buildPanel(panel: PanelContext): void`, `serialize(): unknown`, `restore(state: unknown): void`, `dispose(): void`
- **Do NOT call `buildPanel` in the constructor.** The platform calls it once, after the instance exists.
- `update(dt)` must return `true` only when something changed (the engine only redraws when you say so).
- EVERY user-facing string goes through `L('Bahasa Indonesia', 'English')`; render with `t()` or `tf()`.
- All numbers rendered with `num(value, decimals)`.
- Use `this.ctx.invalidate()` whenever the student changes something.
- `serialize()` returns a plain JSON object; `restore(state)` restores it AND pushes the values back into the panel widgets (call the slider/number handles' `set()`).
- `dispose()` calls `disposeObject(this.root)` from `kit/arrows`.
- Write comments in the same voice as the rest of the codebase (English, explaining *why*).
- The project uses `strict` TypeScript: no `any`, no unused variables, no unused function parameters (prefix them with `_` if truly needed).

## THE LAB ITSELF — physics and pedagogy

Topic: **free fall (jatuh bebas)** — the simplest and most fundamental motion, and the one that proves the ideas a student needs for everything after it.

**The idea to teach:** in the absence of air resistance, the mass of the falling object does not matter — a steel ball and a feather fall in exactly the same time. That is the lesson, and the lab must make it unmistakable.

**Controls**
- drop height `h` (slider, e.g. 1–30 m)
- gravity: segmented control for Earth (9.81), Moon (1.62), Mars (3.72) m/s²
- the falling object: segmented control for a steel ball, a wooden block, a feather — same shape, different mass
- a toggle for air resistance (on/off)
- a toggle for "show the free-fall graph" — a live v–t graph (use `Plot` from `lab/src/kit/plot.ts`; see `lab/src/rooms/mechanics/incline.ts` for how it is used)

**Physics**
- Without drag: `v = g t`, `h = ½ g t²`, so `t = √(2h/g)`.
  - time of fall `t = √(2h/g)`
  - impact speed `v = √(2 g h)`
- With drag: quadratic drag `a_drag = −k v |v|`, so the feather falls far more slowly than the steel ball. Integrate with a small fixed timestep (the pattern in `incline.ts`).
- The mass only shows up in the drag model — make that visible: with drag on, a heavy object and a light one fall differently; with drag off they do not.

**Scene**
- A tall tower or a cliff edge on the left, with a height scale up its side (tick marks every metre, a `makeLabel` sprite every 5 m).
- The object dropped from the top, falling in front of the tower.
- A **stopwatch** in the scene, or a digital readout of the elapsed time, so the student can *measure* the fall and compare it with the predicted time.
- A ground line with a small dust puff / landing marker where the object lands.
- The falling object's **velocity arrow**, growing as it falls, so the student sees `v` build up.
- When air resistance is on and the feather is selected, show a subtle difference (the feather flutters) — keep it cheap, no per-frame geometry churn.

**Readouts** (in the panel)
- `h`, `g`, the object's mass
- elapsed time `t`, current speed `v`, the distance fallen
- the predicted time `t = √(2h/g)` beside the measured time, so the student can compare
- the check `h = ½ g t²`
- when drag is on, the "without drag" time beside the actual one

**The student records an answer**
Use the `number()` panel widget (a typed numeric field) so the student predicts the fall time, plus a "Check" button. The lab compares with the computed value (tolerance 2 %, or 0.05 s) and reports correct/incorrect with a short explanation, then reveals the answer. A second question can ask for the impact speed.

A good challenge: the student is given a height and must predict the fall time; the lab then drops the object and measures the real time, showing that the prediction was right.

**Interaction**
- The student can drag the falling object to change the drop height (it snaps to the tower's side). Use `rayPlaneZ` from `kit/picking` for the x–z plane, or a `THREE.Plane` of normal (0,0,1) — the tower is in the x–y plane, so the z = 0 plane is right here.
- Return `true` from `onPointerDown` only when the pointer actually grabbed the object, so dragging empty space still orbits the camera. `onPointerMove` should give a hover cursor over it.
- "Drop" and "Reset" buttons.

### Panel layout
Use `panel.section(...)` to group:
- "Drop" — height, gravity, object, drag toggle, Drop/Reset buttons
- "Measurements" — time, speed, distance, predicted time, the check
- "Your answer" — the `number()` field, "Check" button, `status()`, `goal()`

Finish with a `details`/`summary` block explaining why mass does not matter (and why air resistance does) — see how `lever.ts` builds its `details.info` block. Bilingual.

### Numbers to use
For Earth, `g = 9.81`:
- `h = 20 m` → `t = √(40/9.81) = 2.02 s`, `v = 19.8 m/s`
- `h = 45 m` → `t = 3.03 s`, `v = 29.7 m/s`
On the Moon (`g = 1.62`), `h = 20 m` → `t = 4.97 s`.
Use these to sanity-check your implementation before you finish.

### Done means
- `npx tsc --noEmit` from `D:\lab\MasTomi-s-Laboratory` passes with no errors
- You did not modify any file other than the one you created

Run `npx tsc --noEmit` yourself and fix any errors before you finish. Report a short summary of what you built and confirm the typecheck is clean.
