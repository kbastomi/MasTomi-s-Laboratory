/**
 * The shared bits of the browser QA.
 *
 * Every suite gets the same small toolkit: a reporter, a page, and the few
 * helpers that know how the laboratory is put together (how a lab is opened,
 * how an object is found on screen, how a slider is set).
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

export function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p
  throw new Error('No Chrome/Chromium found. Install Chrome or set CHROME_PATH.')
}

/**
 * The desktop viewport the checks run in.
 *
 * It is deliberately smaller than a real desktop window: under software
 * rendering (headless Chrome has no GPU) a large canvas draws so slowly that
 * a simulation advances at a fraction of the wall clock, which makes every
 * timing-sensitive check flaky. A smaller canvas keeps the frame rate up.
 */
export const DESKTOP = { width: 1100, height: 700, deviceScaleFactor: 1 }
export const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

/** Collects the results and prints them as they happen. */
export function createReporter() {
  const results = []
  return {
    results,
    check(name, ok, extra) {
      const pass = !!ok
      results.push({ name, ok: pass })
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `   [${extra}]` : ''}`)
    },
  }
}

export async function launchBrowser() {
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || findChrome(),
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--hide-scrollbars',
    ],
  })
}

/** A page that records its own console and page errors. */
export async function openPage(browser, viewport = DESKTOP) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))
  return { page, consoleErrors, pageErrors }
}

/* ------------------------------------------------------------------ helpers */

/** Open the laboratory's home page. */
export async function gotoIndex(page, base) {
  await page.goto(`${base}/lab/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(2500)
}

/** Open one simulation and wait for it to settle. */
export async function gotoLab(page, base, chapter, lab) {
  await page.goto(`${base}/lab/#/lab/${chapter}/${lab}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(2600)
}

/** The structure of the open lab's panel. */
export function readPanel(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#panel')
    return {
      sections: panel ? panel.querySelectorAll('.panel-section').length : 0,
      readouts: panel ? panel.querySelectorAll('.readout').length : 0,
      sliders: panel ? panel.querySelectorAll('input[type=range]').length : 0,
      numbers: panel ? panel.querySelectorAll('input[type=number]').length : 0,
      ma: panel?.querySelector('.ma-badge .num')?.textContent ?? null,
      overlayHidden: document.querySelector('#overlay')?.classList.contains('hidden') ?? false,
      canvas: !!document.querySelector('canvas.lab-canvas'),
    }
  })
}

/** Every number in the panel's readout rows, in order. */
export function readReadouts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#panel .readout .v')].map((n) => {
      const parsed = parseFloat(String(n.textContent).replace(',', '.'))
      return Number.isFinite(parsed) ? parsed : null
    }),
  )
}

/** The readout rows with their labels — useful for reporting. */
export function readReadoutRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#panel .readout')].map((row) => ({
      label: row.querySelector('.k')?.textContent ?? '',
      text: row.querySelector('.v')?.textContent ?? '',
    })),
  )
}

/** The finite numbers of a readReadouts() result. */
export function numbers(values) {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v))
}

/** Set panel sliders by index. */
export async function setSliders(page, values) {
  await page.evaluate((vals) => {
    const els = document.querySelectorAll('#panel input[type=range]')
    vals.forEach((v, i) => {
      if (!els[i]) return
      els[i].value = String(v)
      els[i].dispatchEvent(new Event('input', { bubbles: true }))
    })
  }, values)
  await sleep(350)
}

/**
 * Set a slider by the label beside it, so a check does not depend on the
 * order the sliders happen to be in. The first pattern that matches wins.
 */
export async function setSliderByLabel(page, patterns, value) {
  const sources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)))
  const found = await page.evaluate((srcs, val) => {
    const rows = [...document.querySelectorAll('#panel .slider-row')]
    for (const source of srcs) {
      const re = new RegExp(source, 'i')
      const row = rows.find((r) => re.test(r.querySelector('.name')?.textContent ?? ''))
      const input = row?.querySelector('input[type=range]')
      if (!input) continue
      input.value = String(val)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    return false
  }, sources, value)
  await sleep(350)
  return found
}

/** Type a value into a numbered field, found by its label. */
export async function setNumberField(page, patterns, value) {
  const sources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)))
  const found = await page.evaluate((srcs, val) => {
    for (const source of srcs) {
      const re = new RegExp(source, 'i')
      const row = [...document.querySelectorAll('#panel .slider-row')]
        .find((r) => re.test(r.querySelector('.name')?.textContent ?? ''))
      const input = row?.querySelector('input[type=number]')
      if (!input) continue
      input.value = String(val)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
    return false
  }, sources, value)
  await sleep(350)
  return found
}

/**
 * Poll until a readout settles.
 *
 * Under software rendering the browser draws far fewer frames than a real
 * GPU, and the engine clamps a frame's delta, so a simulation runs slower
 * than the wall clock. Waiting for the *result* is therefore more honest
 * than waiting for a fixed number of seconds.
 */
export async function waitForValue(page, patterns, predicate, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await readoutValue(page, patterns)
    if (last && predicate(last)) return last
    await sleep(400)
  }
  return last
}

/**
 * Poll a value on the open lab until it satisfies a condition.
 *
 * Under software rendering the browser draws far fewer frames than a real
 * GPU, so a simulation runs slower than the wall clock. Waiting for the
 * *result* is therefore more honest than waiting for a fixed number of
 * seconds.
 */
export async function waitForLabValue(page, key, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await page.evaluate((k) => window.APP.debug.lab[k], key)
    if (typeof last === 'number' && predicate(last)) return last
    await sleep(300)
  }
  return last
}

/** The value of a readout row, found by its label. */
export async function readoutValue(page, patterns) {
  const sources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)))
  return page.evaluate((srcs) => {
    for (const source of srcs) {
      const re = new RegExp(source, 'i')
      const row = [...document.querySelectorAll('#panel .readout')]
        .find((r) => re.test(r.querySelector('.k')?.textContent ?? ''))
      if (row) {
        const text = row.querySelector('.v')?.textContent ?? ''
        const parsed = parseFloat(text.replace(',', '.'))
        return { text, value: Number.isFinite(parsed) ? parsed : null }
      }
    }
    return null
  }, sources)
}

/** Click a panel button whose label matches. */
export async function clickButton(page, pattern) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern)
  const clicked = await page.evaluate((src) => {
    const re = new RegExp(src, 'i')
    const b = [...document.querySelectorAll('#panel .btn')].find((x) => re.test(x.textContent))
    b?.click()
    return !!b
  }, source)
  await sleep(400)
  return clicked
}

/**
 * Where a named object in the open lab sits on screen, so a test can drag it.
 * The lab exposes its scene through `window.APP.debug`.
 */
export async function screenPosition(page, objectName) {
  return page.evaluate((name) => {
    const app = window.APP
    const lab = app.debug.lab
    const obj = lab.root.getObjectByName(name)
    if (!obj) return null
    obj.updateWorldMatrix(true, true)
    const v = obj.position.clone()
    obj.getWorldPosition(v)
    v.project(app.debug.engine.camera)
    const r = app.debug.engine.dom.getBoundingClientRect()
    return {
      x: r.left + ((v.x + 1) / 2) * r.width,
      y: r.top + ((1 - v.y) / 2) * r.height,
    }
  }, objectName)
}

/**
 * Where a point `distance` along an object's local +X axis sits on screen,
 * optionally dropped `drop` along its local +Y (the surface normal).
 *
 * Some labs place an object by clicking a spot rather than by dragging it,
 * so the test has to click where the object should end up, not where it is.
 */
export async function screenPositionAlong(page, objectName, distance, drop = 0) {
  return page.evaluate((name, d, dropBy) => {
    const app = window.APP
    const lab = app.debug.lab
    const obj = lab.root.getObjectByName(name)
    if (!obj) return null
    obj.updateWorldMatrix(true, true)
    const e = obj.matrixWorld.elements
    const v = obj.position.clone()
    v.set(
      v.x + e[0] * d - e[4] * dropBy,
      v.y + e[1] * d - e[5] * dropBy,
      v.z + e[2] * d - e[6] * dropBy,
    )
    v.project(app.debug.engine.camera)
    const r = app.debug.engine.dom.getBoundingClientRect()
    return {
      x: r.left + ((v.x + 1) / 2) * r.width,
      y: r.top + ((1 - v.y) / 2) * r.height,
    }
  }, objectName, distance, drop)
}

/** Click somewhere on the canvas. */
export async function clickAt(page, x, y) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.up()
  await sleep(350)
}

/** The camera's azimuth, used to prove a drag did not orbit the scene. */
export function cameraAzimuth(page) {
  return page.evaluate(() => window.APP.debug.engine.orbit.azim)
}

/** Drag the mouse from one point to another. */
export async function drag(page, from, dx, dy, steps = 12) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + dx, from.y + dy, { steps })
  await page.mouse.up()
}

/** Save a screenshot into the shots folder. */
export async function shot(page, shots, name) {
  await page.screenshot({ path: join(shots, name) })
}
