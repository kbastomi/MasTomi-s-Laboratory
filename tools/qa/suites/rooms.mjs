/**
 * The chapter pages, and the sweep that opens every lab in the catalogue.
 *
 * The sweep is the guard that matters: a typo in somebody's
 * `load: () => import('../rooms/x/typo')` would otherwise only surface in a
 * browser, for one student, on one page. Here it fails the build instead.
 */
import { gotoLab, readPanel, shot, sleep } from '../lib/harness.mjs'

export async function run(ctx) {
  const { page, base, shots, check } = ctx

  await page.goto(`${base}/lab/#/`, { waitUntil: 'networkidle2' })
  await sleep(700)
  const roomCount = (await page.$$('.chapter-card')).length
  check('rooms: the chapter index lists 11 rooms', roomCount === 11, `${roomCount}`)

  const firstRoom = await page.$eval('.chapter-card h2', (n) => n.textContent)
  check('rooms: the foundation chapter comes first',
    /Pengukuran|Measurements/i.test(firstRoom), firstRoom)

  await page.goto(`${base}/lab/#/room/measurements`, { waitUntil: 'networkidle2' })
  await sleep(900)
  check('rooms: a chapter page lists playable and locked labs',
    (await page.$$('.lab-card:not(.is-locked)')).length === 3 &&
    (await page.$$('.lab-card.is-locked')).length === 3)
  await shot(page, shots, '02-room-measurements.png')

  /* --------------------------------------------- sweep every lab in the
     catalogue, so a broken import can never reach production unnoticed.   */
  const labs = await page.evaluate(() => {
    const out = []
    for (const chapter of window.APP.debug.chapters) {
      for (const lab of chapter.labs) {
        out.push({
          chapter: chapter.id,
          lab: lab.id.startsWith(`${chapter.id}.`) ? lab.id.slice(chapter.id.length + 1) : lab.id,
          id: lab.id,
        })
      }
    }
    return out
  })
  check('rooms: the catalogue exposes its labs', labs.length >= 6, `${labs.length} labs`)

  for (const entry of labs) {
    await gotoLab(page, base, entry.chapter, entry.lab)
    const info = await readPanel(page)
    check(`rooms: ${entry.id} opens`, info.overlayHidden && info.canvas && info.sections >= 1,
      `${info.sections} sections, ${info.readouts} readouts`)
  }
}
