# MasTomi's Laboratory

A **virtual physics laboratory** for junior and senior high school students.
Ten rooms, each one a chapter of physics, with interactive 3D simulations the
student can touch, re-tune and play with.

Built with **three.js**, deployed as a **static site**, and designed to run on
a laptop, a tablet and a phone.

```
/            the landing page
/lab/        the laboratory
```

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run build          # → dist/
npm run preview        # serve the production build
npm run qa             # headless-Chrome checks against the build
npm run typecheck      # tsc --noEmit
```

Node **22.12+** is required (Vite 8, and `node:sqlite` for the optional
back-end).

---

## What is in it right now

| Chapter | Simulations |
|---|---|
| **Pengukuran & Satuan** / Measurements & Units | Alat ukur (vernier, micrometer, Ohaus, stopwatch) · Massa jenis (density) · Vektor (vectors) |
| **Mekanika** / Mechanics | Tuas (lever) · Katrol (pulley) · Bidang miring (inclined plane) |

The other ten chapters — Kinematics, Dynamics, Work & Energy, Waves,
Optics, Thermodynamics, Electricity & Magnetism, Fluids and Modern Physics —
are scaffolded with their learning goals and their roadmap of planned
simulations, so the catalogue is navigable from day one.

The laboratory is **bilingual**: Indonesian by default, one tap for English.

---

## The design in one paragraph

A simulation is a single file that implements one small interface
(`lab/src/core/lab.ts`). It owns its 3D objects, answers *"did anything
change?"*, and can save and restore its own state. Everything else — the
camera, the quality settings, the panel, the language, the progress storage —
belongs to the platform. Adding the thirtieth simulation should feel like
adding the third.

---

## Documentation

| Document | What it covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | how the whole thing fits together |
| [`docs/ADDING-A-LAB.md`](docs/ADDING-A-LAB.md) | how to write a new simulation |
| [`docs/DEPLOY-CLOUDFLARE.md`](docs/DEPLOY-CLOUDFLARE.md) | deploying to Cloudflare Pages |
| [`docs/DEPLOY-VPS.md`](docs/DEPLOY-VPS.md) | the later LEMP + Node.js deployment |
| [`docs/conversations/`](docs/conversations/) | the working sessions, kept with the code |
| [`server/README.md`](server/README.md) | the optional back-end |

---

## Performance

The laboratory draws the scene **only when something changes**, so an idle
simulation costs almost nothing on the CPU. On top of that:

- quality tiers scale the pixel ratio, the shadow maps and the lights to the
  device, and step themselves down when frames get heavy;
- a software-rasteriser probe catches Chrome's SwiftShader fallback and drops
  to the cheapest tier with an explanation;
- the camera stands further back on a narrow screen, and the text labels keep
  the same size on the glass whatever the device.

The whole laboratory is about **95 KB gzipped**; each extra simulation costs
about 6 KB and is loaded only when it is opened.

---

## Layout

```
index.html            landing page (domain root)
src/                  the landing page's script and styles
lab/                  the laboratory
  src/core/           engine, camera, quality, routing, i18n, storage, api
  src/kit/            the shared widgets: panel, labels, arrows, objects, plots
  src/catalog/        the curriculum: chapters, labs and roadmap
  src/rooms/          the simulations themselves
server/               the optional Node back-end (no npm dependencies)
tools/                the conversation exporter and the QA harness
docs/                 documentation
```

---

## Licence

Private project. All rights reserved.
