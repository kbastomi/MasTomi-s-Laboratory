# Build density measurement lab

| | |
|---|---|
| **Session ID** | `ses_ea8343293ffe5xJBjWOxwu2ZKz` |
| **Directory** | `D:/lab` |
| **Started** | 2026-10-20 12:32 |
| **Last activity** | 2026-10-20 13:22 |
| **Messages** | 60 |
| **Model** | opencode/minimax-m3.1-flash-free |
| **Exported** | 2026-10-20 |

---

### 👤 Student · 12:32

You are a subagent spawned by another session.
Write ONE new file: `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

This is a physics lab for a virtual 3D physics laboratory (three.js + TypeScript + Vite). It is the "density / specific mass" activity of a new chapter called "Measurements & Units".

## READ THESE FIRST (in this order) — they define the API and the house style
1. `D:\lab\MasTomi-s-Laboratory\docs\ADDING-A-LAB.md`  — the contract, the rules, the "rules that matter" table
2. `D:\lab\MasTomi-s-Laboratory\lab\src\core\lab.ts`  — the `LabInstance` / `LabContext` / `PanelContext` types you must implement
3. `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\mechanics\lever.ts` — THE reference example. Match its structure, naming, comment style and idioms closely.
4. `D:\lab\MasTomi-s-Laboratory\lab\src\kit\panel.ts` — the panel widgets (slider, number, readout, segmented, button, status, goal, el)
5. `D:\lab\MasTomi-s-Laboratory\lab\src\kit\arrows.ts` (makeArrow, C palette), `labels.ts` (makeLabel), `picking.ts` (pick, rayPlaneZ, hover), `objects.ts` (makeCrate, makePlate, makeSheave, Rope)
6. `D:\lab\MasTomi-s-Laboratory\lab\src\core\i18n.ts` — `L(id, en)`, `t()`, `tf(pair, vars)`, `num(value, decimals)`

Import paths from `lab/src/rooms/measurements/` are `../../core/...` and `../../kit/...`.

## HARD RULES (the build is strict — `noUnusedLocals` and `noUnusedParameters` are ON, `strict` is ON)
- Export `export default function createDensityLab(ctx: LabContext): LabInstance { return new DensityLab(ctx) }`
- The class implements `LabInstance` exactly: `readonly root: THREE.Group`, `update(dt): boolean`, `onPointerDown(e): boolean`, `onPointerMove(e): void`, `onPointerUp(e): void`, `buildPanel(panel: PanelContext): void`, `serialize(): unknown`, `restore(state: unknown): void`, `dispose(): void`
- **Do NOT call `buildPanel` in the constructor.** The platform calls it once, after the instance exists.
- `update(dt)` must return `true` only when something changed (the engine only redraws when you say so).
- EVERY user-facing string goes through `L('Bahasa Indonesia', 'English')`; render with `t()` or `tf()`.
- All numbers rendered with `num(value, decimals)`.
- Use `this.ctx.invalidate()` whenever the student changes something.
- `serialize()` returns a plain JSON object; `restore(state)` restores it AND pushes the values back into the panel widgets (call the slider/number handles' `set()`).
- `dispose()` calls `disposeObject(this.root)` from `kit/arrows`.
- Do NOT modify any file other than the one you are creating. Do not edit chapters.ts, do not edit the kit, do not edit package.json.
- Write comments in the same voice as the rest of the codebase (English, explaining *why*).

## THE LAB ITSELF — physics and pedagogy

Topic: **specific mass / density (massa jenis)** of a glass object.

The student works like this:
1. **Choose an object** — segmented control with three pieces of glass:
   - a solid glass cube (edge `a`)
   - a glass cylinder (diameter `d`, height `h`) — a beaker
   - an irregular glass pebble (volume found by water displacement)
2. **Measure the dimensions.** Provide sliders that stand in for caliper readings. Each dimension slider shows a value with a realistic resolution (a ruler reads to the nearest 0.1 cm), and the scene shows the object with dimension markers/labels so the measurement is visible.
3. **The mass is read from a balance.** Show the mass as a readout in the panel (e.g. 46.5 g) and put a small balance prop in the 3D scene so the reading has a source.
4. **The lab computes**:
   - `V` — for the cube `a³`, for the cylinder `π·(d/2)²·h`, for the pebble the water-displacement volume
   - `ρ = m / V`, reported in g/cm³ **and** kg/m³
   - the **uncertainty** from the measurement resolution: for a cube `δV/V = 3·δa/a`, for a cylinder `δV/V = 2·δd/d + δh/h`, and `δρ/ρ = δm/m + δV/V` (worst-case sum). Show `ρ ± δρ`.
   - the **true** density of glass (`2.50 g/cm³`) and the **percentage error** of the student's measurement
5. **The student records their answer.** Use the `number()` panel widget (a typed numeric field) for the student's computed density, and a "Check" button. The lab compares their value with the computed one within a tolerance (say 2 %) and reports correct/incorrect with a short explanation of where the error comes from. After checking, reveal the answer.

Also show the **measurement chain** in the panel — e.g. `a = 3.2 ± 0.1 cm` — so the uncertainty is visible, not just a number.

### Scene
- A bench/floor with a subtle grid (the engine already draws a room and grid — you only add the objects).
- The glass object: use `MeshStandardMaterial` with transparency and some roughness so it reads as glass. Give it a `THREE.Group` named `density-object` so it can be found later.
- Dimension markers: thin lines/plates plus `makeLabel` sprites showing e.g. `a = 3.2 cm`.
- A simple balance prop (base + column + pan) beside it, with the object resting on the pan.
- Keep the object count modest — it must run on a phone.

### Interaction
- The student can drag the glass object around the bench a little (use `pick` / `rayPlaneZ` from `kit/picking`) — this also exercises the platform's pointer routing. Return `true` from `onPointerDown` only when the pointer actually hit the object, so dragging empty space still orbits the camera.
- `onPointerMove` should give a hover cursor over the object (use `hover` from `kit/picking`).

### Numbers to use (make them exact and pleasant)
- Cube: edge 3.2 cm, mass 46.5 g → V = 32.768 cm³ → ρ ≈ 1.419 g/cm³. Hmm — that is NOT glass (2.5). Choose masses so the density comes out near 2.50 g/cm³ for glass.
  - Cube edge 3.0 cm → V = 27.0 cm³ → for ρ = 2.50 → m = 67.5 g. Use edge 3.0 cm, mass 67.5 g → ρ = 2.500 g/cm³.
  - Cylinder d = 2.4 cm, h = 4.0 cm → V = π·1.2²·4 = 18.096 cm³ → m = 45.2 g → ρ = 2.498 g/cm³.
  - Pebble: water displacement V = 12.5 cm³ → m = 31.3 g → ρ = 2.504 g/cm³.
- Each object should show a small non-zero percentage error so the lesson lands (because the dimensions are read to 0.1 cm, the error is a few per cent).

### Panel layout
Use `panel.section(...)` to group:
- "Object" — the segmented control + the mass readout
- "Measurements" — the dimension sliders and the derived `V`, `ρ`, uncertainty, % error readouts
- "Your answer" — the `number()` field + "Check" button + `status()` + `goal()`

Finish with a `details`/`summary` element explaining how the uncertainty propagates — see how `lever.ts` builds its `details.info` block. Bilingual.

### Done means
- `npx tsc --noEmit` from `D:\lab\MasTomi-s-Laboratory` passes with no errors
- The file is self-contained; no other file changed

Run `npx tsc --noEmit` yourself and fix any errors before you finish. Report a short summary of what you built and confirm the typecheck is clean.

### 🤖 Assistant · general · 12:32

I'll start by reading the required reference files to understand the API and house style.

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\docs\ADDING-A-LAB.md`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\lab.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\mechanics\lever.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\kit\panel.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 5 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\kit\arrows.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\kit\labels.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\kit\picking.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\kit\objects.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\i18n.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `shell` · `Get-ChildItem -Recurse -Path "D:\lab\MasTomi-s-Laboratory\lab\src" -File | Select-Object -ExpandProperty FullName`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\math.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\catalog\chapters.ts`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\mechanics\incline.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\styles\components.css`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\engine.ts`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\router.ts`
- `shell` · `Get-Content "D:\lab\MasTomi-s-Laboratory\tsconfig.json"; Get-Content "D:\lab\MasTomi-s-Laboratory\package.json"`

</details>

### 🤖 Assistant · general · 12:32

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\app.ts`
- `shell` · `Select-String -Path "D:\lab\MasTomi-s-Laboratory\node_modules\three\build\three.module.js" -Pattern "function intersect\(" -Context 0,25 | …`

</details>

### 🤖 Assistant · general · 12:38

<details><summary>🔧 2 tool calls</summary>

- `shell` · `Get-ChildItem "D:\lab\MasTomi-s-Laboratory\node_modules\three\build" | Select-Object Name; Select-String -Path "D:\lab\MasTomi-s-Laboratory…`
- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\core\camera.ts`

</details>

### 🤖 Assistant · general · 12:46

Now I have the full picture. Let me write the density lab.

<details><summary>🔧 1 tool call</summary>

- `write` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:52

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1 | Select-Object -First 40`

</details>

### 🤖 Assistant · general · 12:53

<details><summary>🔧 1 tool call</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:53

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:54

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1 | Select-String -Pattern "density.ts"`

</details>

### 🤖 Assistant · general · 12:54

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1 | Select-Object -First 30; Get-ChildItem "D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements" | Select-Object Nam…`

</details>

### 🤖 Assistant · general · 12:55

My file is clean. Now let me fix a detail — the measurement-chain rows should be per-dimension (the cylinder has two readings):

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:57

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:58

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:58

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 12:58

<details><summary>🔧 1 tool call</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:00

<details><summary>🔧 1 tool call</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:01

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1 | Select-String -Pattern "density.ts"; node -e "const p=(m,V)=>{const r=m/V;const dV=(3*0.1)/3;return r};const c={m:6…`

</details>

### 🤖 Assistant · general · 13:01

<details><summary>🔧 1 tool call</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:02

Two refinements — precise picking (only the visible piece) and a clearer comment:

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:02

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1 | Select-String -Pattern "density.ts"; Write-Output "--- density.ts errors above (none = clean) ---"; npx tsc --noEmi…`

</details>

### 🤖 Assistant · general · 13:03

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit 2>&1`

</details>

### 🤖 Assistant · general · 13:04

<details><summary>🔧 1 tool call</summary>

- `shell` · `Select-String -Path "D:\lab\MasTomi-s-Laboratory\lab\src\core\lab.ts" -Pattern "setCamera|CameraSpec" -Context 2,2; Write-Output "=== app.t…`

</details>

### 🤖 Assistant · general · 13:05

<details><summary>🔧 1 tool call</summary>

- `shell` · `Get-Content "D:\lab\MasTomi-s-Laboratory\tools\qa\run.mjs" -TotalCount 60; Write-Output "=== chrome? ==="; Get-ChildItem "C:\Program Files\…`

</details>

### 🤖 Assistant · general · 13:06

Chrome is available — let me run a real browser smoke test of my lab in an isolated temp harness (no project files touched):

<details><summary>🔧 1 tool call</summary>

- `shell` · `$T="C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; New-Item -ItemType Directory -Force -Path $T | Out-Null; if (-not (Test-P…`

</details>

### 🤖 Assistant · general · 13:07

<details><summary>🔧 1 tool call</summary>

- `write` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\vite.config.mjs`

</details>

### 🤖 Assistant · general · 13:08

<details><summary>🔧 1 tool call</summary>

- `write` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\index.html`

</details>

### 🤖 Assistant · general · 13:09

<details><summary>🔧 1 tool call</summary>

- `write` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\main.js`

</details>

### 🤖 Assistant · general · 13:09

<details><summary>🔧 1 tool call</summary>

- `write` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\smoke.mjs`

</details>

### 🤖 Assistant · general · 13:09

<details><summary>🔧 1 tool call</summary>

- `shell` · `cd "C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; Start-Process -FilePath "npx.cmd" -ArgumentList "vite","--config","vite.c…`

</details>

### 🤖 Assistant · general · 13:10

<details><summary>🔧 1 tool call</summary>

- `shell` · `cd "C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; node smoke.mjs`

</details>

### 🤖 Assistant · general · 13:10

The lab runs correctly. The pointer test missed the cube (my click coordinate was wrong) — let me project the real screen position and also capture screenshots:

<details><summary>🔧 1 tool call</summary>

- `edit` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\main.js`

</details>

### 🤖 Assistant · general · 13:11

<details><summary>🔧 1 tool call</summary>

- `edit` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\smoke.mjs`

</details>

### 🤖 Assistant · general · 13:12

<details><summary>🔧 1 tool call</summary>

- `shell` · `cd "C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; node smoke.mjs 2>&1 | Select-String -Pattern "PICK|DRAGGED|OK|ERROR|conso…`

</details>

### 🤖 Assistant · general · 13:12

<details><summary>🔧 1 tool call</summary>

- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-cube.png`

</details>

### 🤖 Assistant · general · 13:13

<details><summary>🔧 2 tool calls</summary>

- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-cylinder.png`
- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-pebble.png`

</details>

### 🤖 Assistant · general · 13:13

The scene works. A few visual polish items: the cylinder's edge lines are noisy, and the graduated cylinder overlaps the pebble. Let me fix those:

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:14

<details><summary>🔧 1 tool call</summary>

- `edit` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`

</details>

### 🤖 Assistant · general · 13:15

<details><summary>🔧 1 tool call</summary>

- `shell` · `cd "C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; node smoke.mjs 2>&1 | Select-String -Pattern "PICK|DRAGGED|^OK|ERROR|page…`

</details>

### 🤖 Assistant · general · 13:15

<details><summary>🔧 2 tool calls</summary>

- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-cylinder.png`
- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-pebble.png`

</details>

### 🤖 Assistant · general · 13:15

<details><summary>🔧 1 tool call</summary>

- `shell` · `Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*node*" } | ForEach-Object { try { $cl = (Get-CimInsta…`

</details>

### 🤖 Assistant · general · 13:16

<details><summary>🔧 1 tool call</summary>

- `shell` · `npx tsc --noEmit; Write-Output "tsc exit code: $LASTEXITCODE"`

</details>

### 🤖 Assistant · general · 13:17

<details><summary>🔧 1 tool call</summary>

- `shell` · `Get-ChildItem -Recurse "D:\lab\MasTomi-s-Laboratory\lab\src" -File | Sort-Object LastWriteTime -Descending | Select-Object -First 6 Name, L…`

</details>

### 🤖 Assistant · general · 13:17

<details><summary>🔧 1 tool call</summary>

- `shell` · `Select-String -Path "D:\lab\MasTomi-s-Laboratory\lab\src\catalog\chapters.ts" -Pattern "measurements|density" -Context 1,6 | Select-Object …`

</details>

### 🤖 Assistant · general · 13:17

My lab is already registered with camera `target [0,1.2,0], radius 8, polar 1.25`. Let me verify the framing with that exact camera:

<details><summary>🔧 1 tool call</summary>

- `edit` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\main.js`

</details>

### 🤖 Assistant · general · 13:18

<details><summary>🔧 1 tool call</summary>

- `shell` · `cd "C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke"; Start-Process -FilePath "npx.cmd" -ArgumentList "vite","--config","vite.c…`

</details>

### 🤖 Assistant · general · 13:19

<details><summary>🔧 1 tool call</summary>

- `read` · `C:\Users\PC Rumah\AppData\Local\Temp\opencode\density-smoke\shot-cube.png`

</details>

### 🤖 Assistant · general · 13:20

<details><summary>🔧 1 tool call</summary>

- `shell` · `Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { try { $cl = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.…`

</details>

### 🤖 Assistant · general · 13:20

<details><summary>🔧 2 tool calls</summary>

- `read` · `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts`
- `shell` · `npx tsc --noEmit; Write-Output "tsc exit: $LASTEXITCODE"`

</details>

### 🤖 Assistant · general · 13:21

Done. I created exactly one file: `D:\lab\MasTomi-s-Laboratory\lab\src\rooms\measurements\density.ts` (805 lines).

## What I built

**Physics (the numbers are exact and verified):**

| specimen | readings | V | ρ = m/V | ρ ± δρ | % error vs 2.50 |
|---|---|---|---|---|---|
| Glass cube | `a = 3,0 cm` | 27,00 cm³ | 2,55 g/cm³ | ±0,26 | **+2,1 %** |
| Glass beaker | `d = 2,4 cm`, `h = 4,0 cm` | 18,10 cm³ | 2,45 g/cm³ | ± 0,27 | **−2,1 %** |
| Glass pebble | `V = 12,5 cm³` (displacement) | 12,50 cm³ | 2,54 g/cm³ | ± 0,11 | **+1,8 %** |

Masses (68,9 / 44,3 / 31,8 g) are chosen so each specimen really *is* glass — the teacher's exact sizes (a₀ = 3,02 cm; d₀ = 2,38, h₀ = 3,98 cm; V₀ = 12,70 cm³) reproduce ρ ≈ 2,50 g/cm³ — while the 0.1 cm ruler still costs the student a couple of per cent. That's the lesson the brief asked for: a non-zero percentage error on every specimen, revealed only after checking.

Uncertainty propagates as specified: `δV/V = 3·δa/a` (cube), `2·δd/d + δh/h` (cylinder), `δV/V` from the 0.5 cm³ jar (pebble); `δρ/ρ = δm/m + δV/V` (worst case).

**Scene** — bench + legs, a balance prop (base/column/pan) with a `m = 68,9 g` label sprite so the mass has a visible source, three glass pieces in a group named `density-object` (transparent `MeshStandardMaterial`, edge lines, a deterministically roughenedicosahedron pebble), a graduated cylinder with a rising water level for the pebble, and dimension markers (bar + ticks + `makeLabel` sprites) reading `a = 3,0 cm`, `d = 2,4 cm`, `h = 4,0 cm`, `V_air = 12,5 cm³`.

**Panel** — Object (segmented + mass readout), Measurements (sliders rebuilt per specimen, V, ρ, ρ in kg/m³, `ρ ± δρ`, the chain rows `3,0 ± 0,1 cm`, δV/V, δm/m, reference 2,50 g/cm³, % error), Your answer (`number()` field + Check + status + goal + reveal rows), then the bilingual `details.info` on uncertainty propagation. Every string goes through `L()`, every number through `num()`.

**Interaction** — `pick`/`rayPlaneZ`/`hover`: a miss returns `false` (camera orbits), a hit returns `true` and the piece slides along the bench.

## Verification

- `npx tsc --noEmit` from `D:\lab\MasTomi-s-Laboratory` → **exit code 0, no errors**.
- Real browser smoke test (headless Chrome + vite, in an isolated temp harness that touched no project file): segmented switching rebuilds the right sliders/readouts for all three specimens, sliders update V/ρ/chain/error, wrong answer → "BELUM TEPAT" with the gap explained, right answer → "BENAR" + goal done + answer revealed (`2,50 g/cm³ = 2.500 kg/m³`, `sisi a₀ = 3,02 cm · V = 27,54 cm³`), serialize→restore round-trips, pointer miss → `false` / hit → `true` with the drag moving the object. No console errors (only a favicon 404). Screenshots confirmed the composition under the catalogue's camera (`target [0,1.2,0], radius 8, polar 1.25`); temp harness deleted afterwards.

Note: the only file I touched is `density.ts` — `chapters.ts` already registers `measurements.density`, so the lab is reachable at `#/lab/measurements/density`.
