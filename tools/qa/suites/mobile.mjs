/**
 * The phone layout.
 *
 * The panel has to become a bottom sheet, and the scene has to stay above it
 * rather than hiding behind it.
 */
import { gotoLab, PHONE, shot, sleep } from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, check } = ctx

  await page.setViewport(PHONE)
  await gotoLab(page, base, 'mechanics', 'lever')
  await sleep(600)

  const mobile = await page.evaluate(() => {
    const panel = document.querySelector('#panel')
    const r = panel.getBoundingClientRect()
    const canvas = document.querySelector('canvas.lab-canvas').getBoundingClientRect()
    return {
      panelTop: r.top,
      panelWidth: r.width,
      canvasBottom: canvas.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })

  check('mobile: the panel spans the width',
    mobile.panelWidth > mobile.viewportWidth * 0.9,
    `${Math.round(mobile.panelWidth)}/${mobile.viewportWidth}`)
  check('mobile: the panel sits in the lower half',
    mobile.panelTop > mobile.viewportHeight * 0.35,
    `${Math.round(mobile.panelTop)}px`)
  check('mobile: the scene stays above the panel',
    mobile.canvasBottom <= mobile.panelTop + 2,
    `canvas ends ${Math.round(mobile.canvasBottom)}, panel starts ${Math.round(mobile.panelTop)}`)

  await shot(page, ctx.shots, '04-mobile-lever.png')
}
