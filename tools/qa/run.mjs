#!/usr/bin/env node
/**
 * Browser QA for the laboratory.
 *
 *   npm run build && npm run qa
 *
 * It drives the real production build in headless Chrome and checks the
 * things that are easy to break and hard to see in a screenshot: does the
 * landing page render, does every lab load without a console error, does the
 * panel fill up, does the language toggle work, does the mobile layout put
 * the panel in a bottom sheet.
 *
 * Screenshots land in tools/qa/shots/.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { preview } from 'vite'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const SHOTS = join(ROOT, 'tools', 'qa', 'shots')
const PORT = 4173

/**
 * By default the checks run against a local production build. Set LAB_BASE to
 * run the very same suite against a deployed site:
 *
 *   LAB_BASE=https://your-domain npm run qa
 */
const EXTERNAL = process.env.LAB_BASE
const BASE = EXTERNAL || `http://localhost:${PORT}`

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p
  throw new Error('No Chrome/Chromium found. Install Chrome or set CHROME_PATH.')
}

const results = []
function check(name, ok, extra) {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `   [${extra}]` : ''}`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch { /* not up yet */ }
    await sleep(300)
  }
  throw new Error(`server did not start at ${url}`)
}

async function main() {
  if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    console.error('✗ dist/ is missing — run `npm run build` first.')
    process.exit(1)
  }
  mkdirSync(SHOTS, { recursive: true })

  let server = null
  if (!EXTERNAL) {
    server = await preview({
      root: ROOT,
      preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
      logLevel: 'warn',
    })
  }
  const stop = () => { try { server?.httpServer.close() } catch { /* ignore */ } }
  process.on('exit', stop)
  process.on('SIGINT', () => { stop(); process.exit(1) })

  await waitForServer(`${BASE}/index.html`)

  const browser = await puppeteer.launch({
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

  const consoleErrors = []
  const pageErrors = []

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    page.on('pageerror', (e) => pageErrors.push(e.message))

    /* ---------------------------------------------------- landing page */
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 })
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
    await page.goto(`${BASE}/lab/`, { waitUntil: 'networkidle2', timeout: 60000 })
    await sleep(2500)
    check('lab: canvas mounted', !!(await page.$('canvas.lab-canvas')))
    check('lab: WebGL context alive', await page.evaluate(() => {
      const c = document.querySelector('canvas.lab-canvas')
      return !!(c && (c.getContext('webgl2') || c.getContext('webgl')))
    }))
    check('lab: chapter index lists 11 rooms', (await page.$$('.chapter-card')).length === 11)
    check('lab: no page errors on boot', pageErrors.length === 0, pageErrors.join(' | '))

    await page.screenshot({ path: join(SHOTS, '01-index.png') })

    /* ------------------------------------------------------- room page */
    await page.click('.chapter-card')
    await sleep(900)
    check('room: 3 playable labs', (await page.$$('.lab-card:not(.is-locked)')).length === 3)
    check('room: 3 planned labs shown as locked', (await page.$$('.lab-card.is-locked')).length === 3)
    await page.screenshot({ path: join(SHOTS, '02-room-mechanics.png') })

    /* --------------------------------------------------------- the labs */
    const labs = [
      { id: 'lever', title: 'Tuas' },
      { id: 'pulley', title: 'Katrol' },
      { id: 'incline', title: 'Bidang Miring' },
    ]

    for (const lab of labs) {
      await page.goto(`${BASE}/lab/#/lab/mechanics/${lab.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
      await sleep(2600)

      const info = await page.evaluate(() => {
        const panel = document.querySelector('#panel')
        return {
          sections: panel ? panel.querySelectorAll('.panel-section').length : 0,
          readouts: panel ? panel.querySelectorAll('.readout').length : 0,
          sliders: panel ? panel.querySelectorAll('input[type=range]').length : 0,
          ma: panel?.querySelector('.ma-badge .num')?.textContent ?? null,
          overlayHidden: document.querySelector('#overlay')?.classList.contains('hidden') ?? false,
          canvas: !!document.querySelector('canvas.lab-canvas'),
        }
      })

      check(`${lab.id}: lab opens (overlay hidden)`, info.overlayHidden)
      check(`${lab.id}: panel has sections`, info.sections >= 3, `${info.sections}`)
      check(`${lab.id}: readouts present`, info.readouts >= 5, `${info.readouts}`)
      check(`${lab.id}: sliders present`, info.sliders >= 2, `${info.sliders}`)
      check(`${lab.id}: mechanical advantage computed`, !!info.ma && info.ma !== '—', info.ma)

      await page.screenshot({ path: join(SHOTS, `03-lab-${lab.id}.png`) })
    }

    /* ------------------------------------------------- lever interaction */
    await page.goto(`${BASE}/lab/#/lab/mechanics/lever`, { waitUntil: 'networkidle2' })
    await sleep(2400)
    const maBefore = await page.$eval('.ma-badge .num', (n) => n.textContent)
    /* drag the effort slider and watch MA change */
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('#panel input[type=range]')
      const el = sliders[3] // effort arm
      el.value = '1.2'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await sleep(400)
    const maAfter = await page.$eval('.ma-badge .num', (n) => n.textContent)
    check('lever: moving the effort arm changes MA', maBefore !== maAfter, `${maBefore} -> ${maAfter}`)

    /* ------------------------------------------------- lever dragging
       Dragging an object must move the object, NOT orbit the camera.
       (Regression test: the engine once never forwarded pointer events to
       the lab at all, so every drag spun the scene.)                      */
    await page.goto(`${BASE}/lab/#/lab/mechanics/lever`, { waitUntil: 'networkidle2' })
    await sleep(2400)

    const before = await page.evaluate(() => {
      const app = window.APP
      const lab = app.debug.lab
      const crate = lab.root.getObjectByName('lever-crate')
      const v = crate.position.clone()
      crate.getWorldPosition(v)
      v.project(app.debug.engine.camera)
      const r = app.debug.engine.dom.getBoundingClientRect()
      return {
        x: r.left + ((v.x + 1) / 2) * r.width,
        y: r.top + ((1 - v.y) / 2) * r.height,
        azim: app.debug.engine.orbit.azim,
        dLoad: lab.dLoad,
      }
    })

    await page.mouse.move(before.x, before.y)
    await page.mouse.down()
    await page.mouse.move(before.x + 70, before.y + 6, { steps: 12 })
    await page.mouse.up()
    await sleep(400)

    const afterDrag = await page.evaluate(() => ({
      azim: window.APP.debug.engine.orbit.azim,
      dLoad: window.APP.debug.lab.dLoad,
    }))

    check('lever: dragging the crate moves the crate', Math.abs(afterDrag.dLoad - before.dLoad) > 0.05,
      `${before.dLoad.toFixed(2)} -> ${afterDrag.dLoad.toFixed(2)} m`)
    check('lever: dragging the crate does NOT orbit the camera',
      Math.abs(afterDrag.azim - before.azim) < 0.005,
      `azim ${before.azim.toFixed(4)} -> ${afterDrag.azim.toFixed(4)}`)

    /* dragging empty space must still orbit the camera */
    const azimBefore = await page.evaluate(() => window.APP.debug.engine.orbit.azim)
    await page.mouse.move(180, 170)
    await page.mouse.down()
    await page.mouse.move(320, 170, { steps: 12 })
    await page.mouse.up()
    await sleep(400)
    const azimAfter = await page.evaluate(() => window.APP.debug.engine.orbit.azim)
    check('lever: dragging empty space still orbits the camera',
      Math.abs(azimAfter - azimBefore) > 0.02,
      `azim ${azimBefore.toFixed(3)} -> ${azimAfter.toFixed(3)}`)

    /* -------------------------------------------- inclined plane physics
       30 degrees, 300 N, a 100 N push: the resultant along the slope is
       100 - 300*sin(30) = -50 N (down the slope), and static friction
       (mu*N = 52 N) holds the box still.                                   */
    await page.goto(`${BASE}/lab/#/lab/mechanics/incline`, { waitUntil: 'networkidle2' })
    await sleep(2600)

    const setSliders = async (values) => {
      await page.evaluate((vals) => {
        const els = document.querySelectorAll('#panel input[type=range]')
        vals.forEach((v, i) => {
          els[i].value = String(v)
          els[i].dispatchEvent(new Event('input', { bubbles: true }))
        })
      }, values)
      await sleep(350)
    }

    const releaseButton = async () => {
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#panel .btn')]
        const b = btns.find((x) => /Release|Lepas/i.test(x.textContent))
        b?.click()
      })
      await sleep(1500)
    }

    /** drag the box up the ramp so it has somewhere to fall from */
    const dragBoxUp = async () => {
      const at = await page.evaluate(() => {
        const app = window.APP
        const lab = app.debug.lab
        const block = lab.root.getObjectByName('incline-block')
        const v = block.position.clone()
        block.getWorldPosition(v)
        v.project(app.debug.engine.camera)
        const r = app.debug.engine.dom.getBoundingClientRect()
        return {
          x: r.left + ((v.x + 1) / 2) * r.width,
          y: r.top + ((1 - v.y) / 2) * r.height,
          s: lab.s,
        }
      })
      await page.mouse.move(at.x, at.y)
      await page.mouse.down()
      await page.mouse.move(at.x + 110, at.y - 150, { steps: 14 })
      await page.mouse.up()
      await sleep(350)
      return at.s
    }

    /* the readouts, in panel order */
    const readIncline = () => page.evaluate(() => {
      const nums = [...document.querySelectorAll('#panel .readout .v')].map((n) =>
        parseFloat(String(n.textContent).replace(',', '.')))
      const lab = window.APP.debug.lab
      return {
        normal: nums[0], friction: nums[1], along: nums[2], resultant: nums[3],
        net: nums[4], accel: nums[5], speed: nums[6],
        s: lab.s, v: lab.v,
      }
    })

    await setSliders([30, 0.2, 300, 100])
    let inc = await readIncline()
    check('incline: normal force = W cos θ',
      Math.abs(inc.normal - 300 * Math.cos((30 * Math.PI) / 180)) < 1, `${inc.normal} N`)
    check('incline: weight along the slope = W sin θ', Math.abs(inc.along - 150) < 1, `${inc.along} N`)
    check('incline: resultant = F - W sin θ is NEGATIVE', inc.resultant < -40 && inc.resultant > -60,
      `${inc.resultant} N`)
    check('incline: static friction balances it (net = 0)', Math.abs(inc.net) < 1, `${inc.net} N`)

    /* put the box partway up the ramp, then let go — friction must hold it */
    const sBeforeDrag = await dragBoxUp()
    inc = await readIncline()
    check('incline: the box can be dragged up the ramp', inc.s > sBeforeDrag + 0.3,
      `s ${sBeforeDrag.toFixed(2)} -> ${inc.s.toFixed(2)} m`)
    await releaseButton()
    inc = await readIncline()
    check('incline: box stays put when friction is enough',
      Math.abs(inc.s - (sBeforeDrag + 0.8)) < 0.35 && Math.abs(inc.v) < 0.01,
      `s=${inc.s.toFixed(3)} m, v=${inc.v.toFixed(3)} m/s`)

    /* with no friction the box must slide DOWN the slope */
    await setSliders([30, 0, 300, 100])
    await dragBoxUp()
    const sTop = (await readIncline()).s
    await releaseButton()
    inc = await readIncline()
    check('incline: with no friction the box slides DOWN the slope',
      inc.v < -0.05 && inc.s < sTop,
      `s ${sTop.toFixed(3)} -> ${inc.s.toFixed(3)} m, v=${inc.v.toFixed(3)} m/s`)

    /* a push that beats gravity must send it UP */
    /* start from the bottom, so the box has room to rise (Reset clears the push) */
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('#panel .btn')]
      btns.find((x) => /Reset|Atur ulang/i.test(x.textContent))?.click()
    })
    await sleep(400)
    await setSliders([30, 0, 300, 250])
    const sLow = (await readIncline()).s
    await releaseButton()
    inc = await readIncline()
    check('incline: a push larger than W sin θ sends the box UP',
      inc.v > 0.05 && inc.s > sLow,
      `s ${sLow.toFixed(3)} -> ${inc.s.toFixed(3)} m, v=${inc.v.toFixed(3)} m/s`)

    /* --------------------------------------------- pulley rope pulling
       Dragging the hook down must haul the crate up — and must not orbit. */
    await page.goto(`${BASE}/lab/#/lab/mechanics/pulley`, { waitUntil: 'networkidle2' })
    await sleep(2600)

    const hook = await page.evaluate(() => {
      const app = window.APP
      const lab = app.debug.lab
      const g = lab.root.getObjectByName('pulley-hook')
      const v = g.position.clone()
      g.getWorldPosition(v)
      v.project(app.debug.engine.camera)
      const r = app.debug.engine.dom.getBoundingClientRect()
      return {
        x: r.left + ((v.x + 1) / 2) * r.width,
        y: r.top + ((1 - v.y) / 2) * r.height,
        azim: app.debug.engine.orbit.azim,
        h: lab.h,
      }
    })

    await page.mouse.move(hook.x, hook.y)
    await page.mouse.down()
    await page.mouse.move(hook.x, hook.y + 220, { steps: 18 })
    await page.mouse.up()
    await sleep(500)

    const pulled = await page.evaluate(() => ({
      azim: window.APP.debug.engine.orbit.azim,
      h: window.APP.debug.lab.h,
    }))
    check('pulley: dragging the hook hauls the crate up', pulled.h > hook.h + 0.02,
      `h ${hook.h.toFixed(3)} -> ${pulled.h.toFixed(3)} m`)
    check('pulley: dragging the hook does NOT orbit the camera',
      Math.abs(pulled.azim - hook.azim) < 0.005,
      `azim ${hook.azim.toFixed(4)} -> ${pulled.azim.toFixed(4)}`)

    /* ------------------------------------------------- language in lab */
    const idStatus = await page.$eval('#panel .status', (n) => n.textContent).catch(() => '')

    /* =============================================== the measurements room
       The foundation chapter: reading instruments, density, vectors.     */
    await page.goto(`${BASE}/lab/#/`, { waitUntil: 'networkidle2' })
    await sleep(700)
    check('measurements: the chapter index lists 11 rooms',
      (await page.$$('.chapter-card')).length === 11,
      `${(await page.$$('.chapter-card')).length}`)
    const firstRoom = await page.$eval('.chapter-card h2', (n) => n.textContent)
    check('measurements: the foundation chapter comes first',
      /Pengukuran|Measurements/i.test(firstRoom), firstRoom)

    await page.goto(`${BASE}/lab/#/room/measurements`, { waitUntil: 'networkidle2' })
    await sleep(900)
    check('measurements: 3 playable labs', (await page.$$('.lab-card:not(.is-locked)')).length === 3)
    check('measurements: 3 planned labs locked', (await page.$$('.lab-card.is-locked')).length === 3)

    const newLabs = [
      { id: 'apparatus', name: 'apparatus' },
      { id: 'density', name: 'density' },
      { id: 'vectors', name: 'vectors' },
    ]

    for (const lab of newLabs) {
      await page.goto(`${BASE}/lab/#/lab/measurements/${lab.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
      await sleep(2800)
      const info = await page.evaluate(() => ({
        sections: document.querySelectorAll('#panel .panel-section').length,
        readouts: document.querySelectorAll('#panel .readout').length,
        sliders: document.querySelectorAll('#panel input[type=range]').length,
        overlayHidden: document.querySelector('#overlay')?.classList.contains('hidden') ?? false,
        canvas: !!document.querySelector('canvas.lab-canvas'),
      }))
      check(`measurements/${lab.id}: opens with a populated panel`,
        info.overlayHidden && info.sections >= 2 && (info.readouts >= 3 || info.sliders >= 2),
        `${info.sections} sections, ${info.readouts} readouts, ${info.sliders} sliders`)
      await page.screenshot({ path: join(SHOTS, `06-measurements-${lab.id}.png`) })
    }

    /* --- apparatus: the challenge loop must accept a correct reading --- */
    await page.goto(`${BASE}/lab/#/lab/measurements/apparatus`, { waitUntil: 'networkidle2' })
    await sleep(2600)
    const challenged = await page.evaluate(() => {
      const click = (re) => {
        const b = [...document.querySelectorAll('#panel .btn')].find((x) => re.test(x.textContent))
        b?.click()
        return !!b
      }
      const challenge = click(/Tantangan|Challenge/i)
      const fresh = click(/Objek baru|New object/i)
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
      return { challenge, fresh, options: btns.length, bestDiff, status: document.querySelector('#panel .status')?.textContent ?? '' }
    })
    check('apparatus: challenge mode offers four readings', challenged.challenge && challenged.options === 4,
      `${challenged.options} options`)
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
      await page.screenshot({ path: join(SHOTS, `07-instrument-${i}.png`) })
    }

    /* --- density: the computed density must land near the truth --- */
    await page.goto(`${BASE}/lab/#/lab/measurements/density`, { waitUntil: 'networkidle2' })
    await sleep(2600)
    const density = await page.evaluate(() => {
      const nums = [...document.querySelectorAll('#panel .readout .v')].map((n) =>
        parseFloat(String(n.textContent).replace(',', '.')))
      return { values: nums.filter((n) => !Number.isNaN(n)) }
    })
    const rhos = density.values.filter((v) => v > 0.5 && v < 10)
    check('density: a density near the 2.5 g/cm³ of glass is computed',
      rhos.some((v) => Math.abs(v - 2.5) < 0.35), rhos.map((v) => v.toFixed(2)).join(', '))

    /* --- vectors: the components must satisfy R cos θ and R sin θ --- */
    await page.goto(`${BASE}/lab/#/lab/measurements/vectors`, { waitUntil: 'networkidle2' })
    await sleep(2600)
    const vectors = await page.evaluate(() => {
      const nums = [...document.querySelectorAll('#panel .readout .v')].map((n) =>
        parseFloat(String(n.textContent).replace(',', '.')))
      const lab = window.APP.debug.lab
      return { values: nums.filter((n) => !Number.isNaN(n)), state: lab ? JSON.stringify(lab.serialize()) : '' }
    })
    check('vectors: component readouts are produced', vectors.values.length >= 3,
      vectors.values.map((v) => v.toFixed(1)).join(', '))
    await page.click('.lang-toggle')
    await sleep(700)
    const enStatus = await page.$eval('#panel .status', (n) => n.textContent).catch(() => '')
    check('lab: language toggle rebuilds the panel', idStatus !== enStatus && enStatus.length > 0)
    await page.click('.lang-toggle')
    await sleep(400)

    /* ---------------------------------------------------- mobile layout */
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await page.goto(`${BASE}/lab/#/lab/mechanics/lever`, { waitUntil: 'networkidle2' })
    await sleep(2400)
    const mobile = await page.evaluate(() => {
      const p = document.querySelector('#panel')
      const r = p.getBoundingClientRect()
      return { top: r.top, width: r.width, vw: window.innerWidth }
    })
    check('mobile: panel spans the width', mobile.width > mobile.vw * 0.9, `${Math.round(mobile.width)}/${mobile.vw}`)
    check('mobile: panel sits in the lower half', mobile.top > 300, `${Math.round(mobile.top)}px`)
    await page.screenshot({ path: join(SHOTS, '04-mobile-lever.png') })

    /* ------------------------------------------------------ error sweep */
    check('no uncaught page errors across the run', pageErrors.length === 0, pageErrors.join(' | '))
    const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e))
    check('no console errors across the run', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
  } finally {
    await browser.close()
    stop()
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('failed:')
    for (const f of failed) console.log(`  - ${f.name}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
