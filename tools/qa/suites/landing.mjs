/**
 * The landing page and the laboratory's shell.
 */
import { gotoIndex, readPanel, shot, sleep } from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, shots, check } = ctx

  /* ---------------------------------------------------- landing page */
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 })
  check('landing: h1 renders', await page.$eval('.hero h1', (n) => n.textContent.includes('Laboratory')))
  check('landing: 11 chapter cards', (await page.$$('.card')).length === 11)
  check('landing: CTA points at /lab/', await page.$eval('.cta', (n) => n.getAttribute('href') === '/lab/'))

  /* ------------------------------------------------- language toggle */
  const beforeEn = await page.$eval('.card h3', (n) => n.textContent)
  await page.click('.lang')
  await sleep(200)
  const afterEn = await page.$eval('.card h3', (n) => n.textContent)
  check('landing: language toggle changes the copy', beforeEn !== afterEn, `${beforeEn} -> ${afterEn}`)
  await page.click('.lang')
  await sleep(200)

  /* ------------------------------------------------------- lab shell */
  await gotoIndex(page, base)
  check('lab: canvas mounted', !!(await page.$('canvas.lab-canvas')))
  check('lab: WebGL context alive', await page.evaluate(() => {
    const c = document.querySelector('canvas.lab-canvas')
    return !!(c && (c.getContext('webgl2') || c.getContext('webgl')))
  }))
  check('lab: chapter index lists 11 rooms', (await page.$$('.chapter-card')).length === 11)
  check('lab: no page errors on boot', ctx.pageErrors.length === 0, ctx.pageErrors.join(' | '))

  await shot(page, shots, '01-index.png')

  /* --------------------------------------------- the language in a lab */
  await page.goto(`${base}/lab/#/lab/mechanics/lever`, { waitUntil: 'networkidle2' })
  await sleep(2400)
  const idStatus = await page.$eval('#panel .status', (n) => n.textContent).catch(() => '')
  await page.click('.lang-toggle')
  await sleep(700)
  const enStatus = await page.$eval('#panel .status', (n) => n.textContent).catch(() => '')
  check('lab: language toggle rebuilds the panel', idStatus !== enStatus && enStatus.length > 0)
  await page.click('.lang-toggle')
  await sleep(400)

  void readPanel
}
