/**
 * The mechanics room: the lever, the pulley and the inclined plane.
 *
 * These checks are about physics, not about the DOM: the numbers are
 * compared against the formulas from the textbook.
 */
import {
  cameraAzimuth,
  clickButton,
  drag,
  gotoLab,
  readPanel,
  readReadouts,
  clickAt,
  screenPosition,
  screenPositionAlong,
  setSliders,
  shot,
  sleep,
  waitForLabValue,
} from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, shots, check } = ctx

  /* ---------------------------------------------------------- the lever */
  await gotoLab(page, base, 'mechanics', 'lever')
  const lever = await readPanel(page)
  check('lever: the lab opens with a full panel',
    lever.overlayHidden && lever.sections >= 3 && lever.readouts >= 5,
    `${lever.sections} sections, ${lever.readouts} readouts`)

  const maBefore = await page.$eval('.ma-badge .num', (n) => n.textContent)
  await setSliders(page, [400, 100, 1.5, 3.0])
  await setSliders(page, [400, 100, 1.5, 1.2])
  const maAfter = await page.$eval('.ma-badge .num', (n) => n.textContent)
  check('lever: moving the effort arm changes MA', maBefore !== maAfter, `${maBefore} -> ${maAfter}`)

  /* Dragging an object must move the object, NOT orbit the camera.
     (Regression test: the engine once never forwarded pointer events to the
     lab at all, so every drag spun the scene.) */
  await gotoLab(page, base, 'mechanics', 'lever')
  const crate = await screenPosition(page, 'lever-crate')
  const azimBefore = await cameraAzimuth(page)
  const dLoadBefore = await page.evaluate(() => window.APP.debug.lab.dLoad)
  await drag(page, crate, 70, 6)
  await sleep(400)
  const dLoadAfter = await page.evaluate(() => window.APP.debug.lab.dLoad)
  const azimAfter = await cameraAzimuth(page)

  check('lever: dragging the crate moves the crate', Math.abs(dLoadAfter - dLoadBefore) > 0.05,
    `${dLoadBefore.toFixed(2)} -> ${dLoadAfter.toFixed(2)} m`)
  check('lever: dragging the crate does NOT orbit the camera',
    Math.abs(azimAfter - azimBefore) < 0.005,
    `azim ${azimBefore.toFixed(4)} -> ${azimAfter.toFixed(4)}`)

  /* dragging empty space must still orbit the camera */
  const azimBeforeEmpty = await cameraAzimuth(page)
  await drag(page, { x: 180, y: 170 }, 140, 0)
  await sleep(400)
  const azimAfterEmpty = await cameraAzimuth(page)
  check('lever: dragging empty space still orbits the camera',
    Math.abs(azimAfterEmpty - azimBeforeEmpty) > 0.02,
    `azim ${azimBeforeEmpty.toFixed(3)} -> ${azimAfterEmpty.toFixed(3)}`)

  await shot(page, shots, '03-lab-lever.png')

  /* --------------------------------------------- the inclined plane
     30 degrees, 300 N, a 100 N push: the resultant along the slope is
     100 - 300*sin(30) = -50 N (down the slope), and static friction
     (mu*N = 52 N) holds the box still.                                   */
  await gotoLab(page, base, 'mechanics', 'incline')
  const incline = await readPanel(page)
  check('incline: the lab opens with a full panel',
    incline.overlayHidden && incline.sections >= 3 && incline.readouts >= 8,
    `${incline.sections} sections, ${incline.readouts} readouts`)

  const readIncline = async () => {
    const nums = await readReadouts(page)
    const lab = await page.evaluate(() => ({ s: window.APP.debug.lab.s, v: window.APP.debug.lab.v }))
    return {
      normal: nums[0], friction: nums[1], along: nums[2], resultant: nums[3],
      net: nums[4], accel: nums[5], speed: nums[6],
      s: lab.s, v: lab.v,
    }
  }

  /* start every scenario from the same state — Reset clears the push too */
  const reset = async () => { await clickButton(page, /Reset|Atur ulang/i); await sleep(300) }
  const release = async () => { await clickButton(page, /Release|Lepas/i); await sleep(1500) }

  /**
   * Move the box up the ramp.
   * The inclined plane places the box by *clicking* a spot on the ramp, so
   * the test clicks a point further up the slope rather than dragging.
   */
  /**
   * Drag the box up the ramp so it has somewhere to fall from.
   * The grab point is the block itself; the drop point is 1.6 m further up
   * the slope, on the ramp's surface.
   */
  const moveBoxUp = async (distance = 1.6) => {
    const from = await screenPosition(page, 'incline-block')
    const to = await screenPositionAlong(page, 'incline-block', distance, 0.565)
    if (from && to) await drag(page, from, to.x - from.x, to.y - from.y, 14)
    await sleep(350)
    return page.evaluate(() => window.APP.debug.lab.s)
  }

  await reset()
  await setSliders(page, [30, 0.2, 300, 100])
  let inc = await readIncline()
  check('incline: normal force = W cos θ',
    Math.abs(inc.normal - 300 * Math.cos((30 * Math.PI) / 180)) < 1, `${inc.normal} N`)
  check('incline: weight along the slope = W sin θ', Math.abs(inc.along - 150) < 1, `${inc.along} N`)
  check('incline: resultant = F - W sin θ is NEGATIVE', inc.resultant < -40 && inc.resultant > -60,
    `${inc.resultant} N`)
  check('incline: static friction balances it (net = 0)', Math.abs(inc.net) < 1, `${inc.net} N`)

  /* put the box partway up the ramp, then let go — friction must hold it */
  await moveBoxUp()
  inc = await readIncline()
  const sHeld = inc.s
  check('incline: the box can be dragged up the ramp', sHeld > 0.3, `s=${sHeld.toFixed(2)} m`)
  await release()
  inc = await readIncline()
  check('incline: box stays put when friction is enough',
    Math.abs(inc.s - sHeld) < 0.2 && Math.abs(inc.v) < 0.01,
    `s=${inc.s.toFixed(3)} m, v=${inc.v.toFixed(3)} m/s`)

  /* with no friction the box must slide DOWN the slope */
  await reset()
  await setSliders(page, [30, 0, 300, 100])
  await moveBoxUp()
  const sTop = (await readIncline()).s
  check('incline: the box is up the ramp before it is released', sTop > 0.3, `s=${sTop.toFixed(2)} m`)
  await release()
  const sDown = await waitForLabValue(page, 's', (v) => v < sTop - 0.12, 30000)
  inc = await readIncline()
  check('incline: with no friction the box slides DOWN the slope',
    inc.accel < 0 && sDown < sTop - 0.12,
    `s ${sTop.toFixed(3)} -> ${sDown.toFixed(3)} m, a=${inc.accel.toFixed(2)} m/s²`)

  /* a push that beats gravity must send it UP */
  await reset()
  await setSliders(page, [30, 0, 300, 250])
  const sLow = (await readIncline()).s
  await release()
  const sUp = await waitForLabValue(page, 's', (v) => v > sLow + 0.12, 30000)
  inc = await readIncline()
  check('incline: a push larger than W sin θ sends the box UP',
    inc.accel > 0 && sUp > sLow + 0.12,
    `s ${sLow.toFixed(3)} -> ${sUp.toFixed(3)} m, a=${inc.accel.toFixed(2)} m/s²`)

  await shot(page, shots, '03-lab-incline.png')

  /* --------------------------------------------- the pulley rope
     Dragging the hook down must haul the crate up — and must not orbit. */
  await gotoLab(page, base, 'mechanics', 'pulley')
  const pulley = await readPanel(page)
  check('pulley: the lab opens with a full panel',
    pulley.overlayHidden && pulley.sections >= 3 && pulley.readouts >= 8,
    `${pulley.sections} sections, ${pulley.readouts} readouts`)

  const hook = await screenPosition(page, 'pulley-hook')
  const hookAzim = await cameraAzimuth(page)
  const hBefore = await page.evaluate(() => window.APP.debug.lab.h)
  await drag(page, hook, 0, 220, 18)
  await sleep(500)
  const hAfter = await page.evaluate(() => window.APP.debug.lab.h)
  const hookAzimAfter = await cameraAzimuth(page)

  check('pulley: dragging the hook hauls the crate up', hAfter > hBefore + 0.02,
    `h ${hBefore.toFixed(3)} -> ${hAfter.toFixed(3)} m`)
  check('pulley: dragging the hook does NOT orbit the camera',
    Math.abs(hookAzimAfter - hookAzim) < 0.005,
    `azim ${hookAzim.toFixed(4)} -> ${hookAzimAfter.toFixed(4)}`)

  await shot(page, shots, '03-lab-pulley.png')
}
