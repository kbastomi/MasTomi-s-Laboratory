# Architecture

MasTomi's Laboratory is a static web application. It runs on Cloudflare Pages
today and will run unchanged behind nginx on a VPS tomorrow.

```
                    ┌──────────────────────────────┐
   browser  ───────▶│  Cloudflare Pages (static)   │
                    │  /            → landing page  │
                    │  /lab/        → the laboratory│
                    └──────────────┬───────────────┘
                                   │  /api/* (optional)
                    ┌──────────────▼───────────────┐
                    │  Node service (VPS, later)   │
                    │  progress · accounts · events│
                    └──────────────────────────────┘
```

The front-end never *requires* the back-end. When `/api` is absent the
laboratory runs perfectly well, keeping a student's progress in
`localStorage`. That is the rule that makes the move from Cloudflare Pages to
a VPS a configuration change rather than a rewrite.

---

## Repository layout

```
index.html            landing page (domain root)
src/landing.ts        its script — imports the same catalogue the lab uses
lab/index.html        the laboratory (served at /lab/)
lab/src/
  app.ts              the shell: canvas, panel, top bar, router, lab life cycle
  views.ts            the chapter index and the chapter page
  core/
    engine.ts         renderer, scene, on-demand render loop, panel offset
    quality.ts        quality tiers, pixel budget, software-renderer probe
    camera.ts         touch-first orbit camera (orbit · pinch · pan)
    i18n.ts           Indonesian/English strings and locale handling
    lab.ts            the Lab contract — the types every simulation implements
    router.ts         hash routing
    store.ts          local progress storage
    api.ts            the only place that talks to a server
    math.ts           small maths helpers
    showcase.ts       the diorama behind the chapter index
  kit/
    panel.ts          the panel builder (sliders, readouts, buttons, …)
    labels.ts         text labels that stay legible at any camera distance
    arrows.ts         force/velocity arrows, shared materials, cleanup
    objects.ts        crates, sheaves, plates, rope
    picking.ts        ray picking helpers
    plot.ts           the 2D graph panel (v–t, x–t, F–t)
  catalog/chapters.ts the curriculum: 10 chapters, their labs and roadmap
  rooms/mechanics/   the built labs (lever, pulley, inclined plane)
  styles/            base.css + components.css
server/               the optional Node backend (zero npm dependencies)
tools/
  export-conversations.mjs   dumps the OpenCode sessions into docs/conversations
  qa/run.mjs                 headless-Chrome checks against the real build
docs/                 architecture, how to add a lab, deployment guides
```

---

## The Lab contract

Everything the laboratory does for a simulation is defined by one interface
(`lab/src/core/lab.ts`):

```ts
interface LabInstance {
  readonly root: THREE.Group
  update(dt: number): boolean          // true → the scene needs redrawing
  onPointerDown(event: PointerEvent): boolean
  onPointerMove(event: PointerEvent): void
  onPointerUp(event: PointerEvent): void
  buildPanel(ctx: PanelContext): void
  serialize(): unknown                 // ← progress saving
  restore(state: unknown): void        // ← progress restoring
  dispose(): void
}
```

A lab owns its 3D objects and nothing else. The camera, the quality settings,
the panel, the language and the persistence are all provided by the platform.

Two rules keep the contract honest:

1. **The platform builds the panel.** The factory does not; `App.openLab()`
   calls `buildPanel()` exactly once, after the instance exists.
2. **`update()` returns whether anything changed.** The engine draws the scene
   only when it must, which is what keeps an idle simulation at ~0 % CPU.

---

## Performance model

The single most important thing in this project: **an untouched lab must cost
almost nothing.** A student may leave a simulation open on a phone for an
hour.

| Technique | Where | Why |
|---|---|---|
| On-demand rendering | `engine.ts` | the scene is drawn only when the lab or the camera changed |
| Quality tiers | `quality.ts` | pixel-ratio cap, total pixel budget, shadows, extra lights |
| Auto-degrade | `quality.ts` | two slow windows in a row → step down a tier |
| Software-renderer probe | `quality.ts` | SwiftShader/llvmpipe → force "low" and tell the user |
| Visibility pause | `engine.ts` | the loop stops when the tab is hidden |
| Per-lab code splitting | Vite | each lab is a dynamic import (4–7 KB gzipped) |
| Camera-relative labels | `engine.ts` | text keeps the same size on the glass on any device |
| Panel-aware framing | `engine.ts` | the scene is nudged out from behind the side panel |
| Portrait framing | `engine.ts` | the camera stands further back on a narrow screen |

Current production bundle:

| File | Raw | Gzipped |
|---|---|---|
| `three.core` | 224 KB | 61 KB |
| laboratory app | 384 KB | **95 KB** |
| one lab (lever / pulley / incline) | 12–16 KB | 5–7 KB |

The laboratory therefore downloads ~95 KB before it can show the first
simulation, and each additional simulation costs about 6 KB.

---

## Internationalisation

Indonesian is the default; English is one tap away.

- A string is a pair: `L('Tuas', 'Lever')`.
- `t(pair)` resolves it for the active language.
- `tf(pair, { n: 200 })` resolves it and fills `{placeholders}`.
- Numbers go through `num()` / `unit()`, which use `Intl.NumberFormat` so the
  decimal and thousands separators follow the language.

The locale lives in `localStorage` and can be overridden with `?lang=en`.
Switching language rebuilds the open lab's panel and re-applies its state, so
nothing is lost.

---

## The catalogue

`lab/src/catalog/chapters.ts` holds all ten chapters with their learning
goals and their roadmap. Adding a lab is two edits in that file plus one new
module — the engine never needs to know a chapter exists.

Each chapter knows three kinds of lab:

- **built** — a real `LabDef` with a `load()` that lazy-imports the module;
- **planned** — a title and a blurb, shown as a locked card;
- nothing else — a chapter with no built labs still renders a full page with
  its learning goals.

---

## The back-end contract

`lab/src/core/api.ts` is the *only* module allowed to call `fetch`. It reads
`VITE_API_BASE` at build time:

| `VITE_API_BASE` | Behaviour |
|---|---|
| unset (default) | no probe, no requests — the laboratory is purely local |
| `/api` | probes `GET /api/health` once at boot and enables the extra features |

Endpoints the Node service implements:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | capability probe: `{ ok, accounts, progress, analytics }` |
| `POST /api/auth/login` | sign in, returns a session token |
| `GET /api/progress/:labId` | the saved state blob for one lab |
| `PUT /api/progress/:labId` | save the state blob for one lab |
| `GET /api/classrooms` | the classrooms a teacher owns |
| `POST /api/classrooms` | create a classroom, returns a join code |
| `POST /api/classrooms/:code/join` | a student joins with the code |
| `POST /api/events` | a batch of analytics events |

---

## Decisions and why

| Decision | Reason |
|---|---|
| Hash routing | works on every static host with zero server configuration, and survives the move to a VPS unchanged |
| three.js r186 (ESM) | r159 was the last UMD build; the ESM path is the only one going forward |
| Vite | one build command for two pages, per-lab code splitting, hashed assets |
| TypeScript | the lab contract and the catalogue are the things most likely to rot |
| No UI framework | one canvas plus a panel; a framework would add weight and fight the render loop |
| Custom physics | the curriculum's ideal machines are closed-form; a general engine would be bigger, slower and less exact |
| `node:sqlite` in the server | the back-end needs no npm install on the VPS |
