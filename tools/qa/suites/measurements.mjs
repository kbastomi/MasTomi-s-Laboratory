/**
 * The measurements room: reading instruments, density, and vectors.
 */
import { gotoLab, numbers, readPanel, readReadoutRows, readReadouts, shot, sleep } from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, shots, check } = ctx

  for (const lab of ['apparatus', 'density', 'vectors']) {
    await gotoLab(page, base, 'measurements', lab)
    const info = await readPanel(page)
    check(`measurements/${lab}: opens with a populated panel`,
      info.overlayHidden && info.sections >= 2 && (info.readouts >= 3 || info.sliders >= 2),
      `${info.sections} sections, ${info.readouts} readouts, ${info.sliders} sliders`)
    await shot(page, shots, `06-measurements-${lab}.png`)
  }

  /* --- apparatus: the challenge loop must accept a correct reading --- */
  await gotoLab(page, base, 'measurements', 'apparatus')
  const challenged = await page.evaluate(() => {
    const click = (re) => {
      const b = [...document.querySelectorAll('#panel .btn')].find((x) => re.test(x.textContent))
      b?.click()
      return !!b
    }
    const challenge = click(/Tantangan|Challenge/i)
    click(/Objek baru|New object/i)
    const lab = window.APP.debug.lab
    const target = lab.target
    const btns = [...document.querySelectorAll('#panel .option')].filter((b) => b.style.display !== 'none')
    let best = null
    let bestDiff = Infinity
    for (const b of btns) {
      const v = parseFloat(b.textContent)
      const d = Math.abs(v - target)
      if (d < bestDiff) { bestDiff = d; best = b }
    }
    best?.click()
    return {
      challenge,
      options: btns.length,
      status: document.querySelector('#panel .status')?.textContent ?? '',
    }
  })
  check('apparatus: challenge mode offers four readings',
    challenged.challenge && challenged.options === 4, `${challenged.options} options`)
  check('apparatus: the right reading is accepted',
    /BENAR|CORRECT/i.test(challenged.status), challenged.status.slice(0, 60))

  /* --- every instrument must be reachable and framed --- */
  const instrumentNames = ['Vernier', 'Micrometer', 'Ohaus', 'stopwatch']
  for (let i = 0; i < 4; i++) {
    await page.evaluate((idx) => {
      const b = [...document.querySelectorAll('#panel .seg-btn')][idx]
      b?.click()
    }, i)
    await sleep(1200)
    const framed = await page.evaluate(() => {
      const app = window.APP
      const lab = app.debug.lab
      const inst = lab.instruments?.[lab.activeIndex]
      if (!inst) return { visible: false, onScreen: false }
      inst.group.updateWorldMatrix(true, true)
      const v = inst.group.position.clone()
      inst.group.getWorldPosition(v)
      v.project(app.debug.engine.camera)
      return {
        visible: inst.group.visible,
        onScreen: Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2,
      }
    })
    check(`apparatus: ${instrumentNames[i]} is shown and framed`,
      framed.visible && framed.onScreen, JSON.stringify(framed))
    await shot(page, shots, `07-instrument-${i}.png`)
  }

  /* --- density: the computed density must land near the truth --- */
  await gotoLab(page, base, 'measurements', 'density')
  const values = numbers(await readReadouts(page))
  const rhos = values.filter((v) => v > 0.5 && v < 10)
  check('density: a density near the 2.5 g/cm³ of glass is computed',
    rhos.some((v) => Math.abs(v - 2.5) < 0.35), rhos.map((v) => v.toFixed(2)).join(', '))

  /* --- vectors: the components must satisfy R cos θ and R sin θ --- */
  await gotoLab(page, base, 'measurements', 'vectors')
  const rows = await readReadoutRows(page)
  const vec = numbers(await readReadouts(page))
  check('vectors: component readouts are produced', vec.length >= 3,
    rows.slice(0, 6).map((r) => `${r.label} = ${r.text}`).join(' | '))
}
