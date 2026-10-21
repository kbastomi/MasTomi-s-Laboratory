# The QA harness

The laboratory is checked by driving the **real production build** in headless
Chrome: the same bundle that is deployed, opened in a browser, and played with
by a script that asserts what a student would see.

```bash
npm run build
npm run qa                  # every suite
npm run qa -- mechanics      # just one suite
npm run qa -- mechanics,rooms
```

The runner boots its own `vite preview` server, so nothing has to be running
first.

---

## The suites

| Suite | What it checks |
|---|---|
| `landing` | the landing page, the language toggle, the canvas, the chapter index |
| `rooms` | the chapter pages **and a sweep of every lab in the catalogue** |
| `mechanics` | the lever, the pulley and the inclined plane — the numbers are compared with the textbook formulas |
| `kinematics` | the projectile motion and free-fall labs, against their closed-form answers |
| `measurements` | the instruments, the density and the vector labs |
| `mobile` | the phone layout: the panel becomes a bottom sheet and the scene stays above it |

`rooms` is the important one: it reads the catalogue **from the running page**
and opens every lab it finds. A typo in somebody's `load()` import therefore
fails the build instead of reaching one student on one page.

---

## Options

| Variable | Default | Meaning |
|---|---|---|
| `LAB_BASE` | *(a local build)* | run against a deployed site: `LAB_BASE=https://your-domain npm run qa` |
| `QA_CONCURRENCY` | *auto* | how many suites run at once |
| `QA_GL` | `default` | `swiftshader` to force the software path, `d3d11` for the Windows path |
| `QA_HEADLESS` | `1` | set to `0` to watch the run in a real window |
| `QA_PROTOCOL_TIMEOUT` | `300000` | how long a single page may take to answer, in ms |
| `CHROME_PATH` | *(auto-detected)* | where Chrome lives, if it is somewhere unusual |

### Concurrency

The default follows the renderer:

- **hardware accelerated** → two suites at a time, which roughly halves the
  wall clock;
- **software rendering** → one at a time. Two software-rendered WebGL pages
  on a small machine starve each other and the run gets *slower*, not faster.

`QA_CONCURRENCY` overrides it either way.

---

## The renderer matters

The harness prints which renderer it got:

```
WebGL: WebGL 2  ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)
  software rendering — a simulation advances slower than the wall clock, so
  the checks wait for results rather than for time.
```

With software rendering the browser draws far fewer frames than a real GPU,
and the engine clamps a frame's delta — so **a simulation advances at a
fraction of the wall clock**. That is why the checks wait for *results* (the
readout changing, the object reaching the bottom) rather than for a fixed
number of milliseconds. A fixed wait is a flaky wait.

On a machine with a working GPU this all disappears: the simulation runs at
real-time speed and the checks become trivial.

> **Note.** three.js r186 needs WebGL 2. An old integrated GPU may only offer
> WebGL 1 — check the `WebGL:` line. If it says `WebGL 1 only`, the
> laboratory cannot run there at all and the QA has to use SwiftShader.

---

## Adding a check

Put it in the suite that owns the area:

```js
import { gotoLab, readPanel, readoutValue, setSliderByLabel } from '../lib/harness.mjs'

await gotoLab(page, base, 'mechanics', 'lever')
const info = await readPanel(page)
check('lever: the lab opens with a full panel',
  info.overlayHidden && info.sections >= 3, `${info.sections} sections`)
```

Useful helpers in `lib/harness.mjs`:

| Helper | Does |
|---|---|
| `gotoIndex` / `gotoLab` | navigate and wait until the page is *ready* |
| `readPanel` | the open lab's panel structure |
| `readReadouts` / `readReadoutRows` / `readoutValue` | the panel's numbers, by label |
| `setSliders` / `setSliderByLabel` / `setNumberField` | drive the panel's controls |
| `screenPosition` / `screenPositionAlong` / `groupCentre` | where things are on screen, for dragging |
| `drag` / `clickAt` / `clickButton` | mouse work |
| `waitForValue` / `waitForLabValue` | wait for a *result*, not for time |
| `describeRenderer` | which WebGL renderer the browser got |

---

## Screenshots

Every suite writes to `tools/qa/shots/`. They are git-ignored, but the CI
workflow uploads them as an artifact, so a failed run can be looked at rather
than guessed about.
