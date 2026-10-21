/**
 * The kinematics room: projectile motion and free fall.
 *
 * The numbers are compared against the closed-form answers from the
 * textbook, so a regression in the integration shows up immediately.
 */
import {
  clickButton,
  gotoLab,
  numbers,
  readPanel,
  readReadouts,
  readoutValue,
  setNumberField,
  setSliderByLabel,
  setSliders,
  shot,
  sleep,
  waitForValue,
} from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, shots, check } = ctx

  /* ------------------------------------------------------- projectile */
  await gotoLab(page, base, 'kinematics', 'projectile')
  const proj = await readPanel(page)
  check('projectile: the lab opens with a full panel',
    proj.overlayHidden && proj.sections >= 3 && proj.readouts >= 8,
    `${proj.sections} sections, ${proj.readouts} readouts`)

  /* v0 = 20 m/s at 45 degrees on Earth:
     vx = vy = 14.14 m/s, t = 2.89 s, R = 40.8 m, H = 10.2 m */
  await setSliderByLabel(page, [/launch speed/i], 20)
  await setSliderByLabel(page, [/launch angle/i], 45)
  await sleep(500)

  const vx = await readoutValue(page, [/horizontal component/i])
  const vy = await readoutValue(page, [/vertical component/i])
  const range = await readoutValue(page, [/^range/i])
  const height = await readoutValue(page, [/maximum height/i])
  const flight = await readoutValue(page, [/time of flight/i])

  check('projectile: vx = v0 cos θ', vx && Math.abs(vx.value - 20 * Math.cos(Math.PI / 4)) < 0.2,
    vx ? `${vx.text} (expected 14.14)` : 'not found')
  check('projectile: vy = v0 sin θ', vy && Math.abs(vy.value - 20 * Math.sin(Math.PI / 4)) < 0.2,
    vy ? `${vy.text} (expected 14.14)` : 'not found')
  check('projectile: the range is v0² sin 2θ / g',
    range && Math.abs(range.value - (20 * 20 * Math.sin(Math.PI / 2)) / 9.81) < 0.5,
    range ? `${range.text} (expected 40.8 m)` : 'not found')
  check('projectile: the maximum height is v0² sin²θ / 2g',
    height && Math.abs(height.value - (20 * 20 * Math.sin(Math.PI / 4) ** 2) / (2 * 9.81)) < 0.3,
    height ? `${height.text} (expected 10.2 m)` : 'not found')
  check('projectile: the flight time is 2 v0 sin θ / g',
    flight && Math.abs(flight.value - (2 * 20 * Math.sin(Math.PI / 4)) / 9.81) < 0.1,
    flight ? `${flight.text} (expected 2.89 s)` : 'not found')

  await shot(page, shots, '08-kinematics-projectile.png')

  /* --------------------------------------------------------- free fall */
  await gotoLab(page, base, 'kinematics', 'freefall')
  const fall = await readPanel(page)
  check('freefall: the lab opens with a full panel',
    fall.overlayHidden && fall.sections >= 3 && fall.readouts >= 8,
    `${fall.sections} sections, ${fall.readouts} readouts`)

  /* 20 m on Earth: t = √(2h/g) = 2.02 s, v = √(2gh) = 19.8 m/s */
  await setSliderByLabel(page, [/drop height/i], 20)
  await sleep(500)

  const predicted = await readoutValue(page, [/formula prediction/i])
  check('freefall: the predicted fall time is √(2h/g)',
    predicted && Math.abs(predicted.value - Math.sqrt((2 * 20) / 9.81)) < 0.05,
    predicted ? `${predicted.text} (expected 2.02 s)` : 'not found')

  /* the lab wants the student to predict first, check it, then drop */
  await setNumberField(page, [/predicted fall time/i], Math.sqrt((2 * 20) / 9.81).toFixed(2))
  await clickButton(page, /^check/i)

  await clickButton(page, /drop|jatuhkan/i)
  /* the fall has to finish before the stopwatch is read */
  const measured = await waitForValue(page, [/fall time/i], (r) => r.value >= 2.0, 30000)
  check('freefall: the measured fall time agrees with the formula',
    measured && Math.abs(measured.value - Math.sqrt((2 * 20) / 9.81)) < 0.06,
    measured ? `${measured.text} (expected 2.02 s)` : 'not found')

  const impact = await readoutValue(page, [/^speed/i])
  check('freefall: the impact speed is √(2gh)',
    impact && Math.abs(impact.value - Math.sqrt(2 * 9.81 * 20)) < 0.4,
    impact ? `${impact.text} (expected 19.8 m/s)` : 'not found')

  await shot(page, shots, '08-kinematics-freefall.png')

  void numbers
  void readReadouts
  void setSliders
}
