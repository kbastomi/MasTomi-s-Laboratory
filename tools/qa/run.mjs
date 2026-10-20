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
const BASE = `http://localhost:${PORT}`

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

  const server = await preview({
    root: ROOT,
    preview: { port: PORT, strictPort: true, host: '127.0.0.1' },
    logLevel: 'warn',
  })
  const stop = () => { try { server.httpServer.close() } catch { /* ignore */ } }
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
    check('landing: 10 chapter cards', (await page.$$('.card')).length === 10)
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
    check('lab: chapter index lists 10 rooms', (await page.$$('.chapter-card')).length === 10)
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

    /* --------------------------------------------------- language in lab */
    const idStatus = await page.$eval('#panel .status', (n) => n.textContent).catch(() => '')
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
