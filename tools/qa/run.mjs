#!/usr/bin/env node
/**
 * Browser QA for the laboratory.
 *
 *   npm run build && npm run qa
 *
 * The checks live in suites/, one per area, so a single room can be checked
 * on its own:
 *
 *   npm run qa                        everything
 *   npm run qa -- measurements         just that suite
 *   npm run qa -- mechanics,rooms     several suites
 *
 * The same suite can be pointed at a deployed site:
 *
 *   LAB_BASE=https://your-domain npm run qa
 *
 * Screenshots land in tools/qa/shots/.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preview } from 'vite'
import { createReporter, DESKTOP, launchBrowser, openPage, sleep } from './lib/harness.mjs'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const SHOTS = join(ROOT, 'tools', 'qa', 'shots')
const PORT = 4173

const EXTERNAL = process.env.LAB_BASE
const BASE = EXTERNAL || `http://localhost:${PORT}`

/** The suites, in the order they run. */
const SUITES = [
  { name: 'landing', load: () => import('./suites/landing.mjs') },
  { name: 'rooms', load: () => import('./suites/rooms.mjs') },
  { name: 'mechanics', load: () => import('./suites/mechanics.mjs') },
  { name: 'kinematics', load: () => import('./suites/kinematics.mjs') },
  { name: 'measurements', load: () => import('./suites/measurements.mjs') },
  { name: 'mobile', load: () => import('./suites/mobile.mjs') },
]

function selectedSuites() {
  const wanted = process.argv.slice(2)
    .flatMap((a) => a.split(','))
    .map((a) => a.trim())
    .filter(Boolean)
  if (!wanted.length) return SUITES
  const chosen = SUITES.filter((s) => wanted.includes(s.name))
  const unknown = wanted.filter((w) => !SUITES.some((s) => s.name === w))
  if (unknown.length) {
    console.error(`✗ unknown suite(s): ${unknown.join(', ')}`)
    console.error(`  available: ${SUITES.map((s) => s.name).join(', ')}`)
    process.exit(1)
  }
  return chosen
}

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
  if (!EXTERNAL && !existsSync(join(ROOT, 'dist', 'index.html'))) {
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

  const browser = await launchBrowser()
  const { page, consoleErrors, pageErrors } = await openPage(browser, DESKTOP)
  const reporter = createReporter()

  const ctx = {
    page,
    base: BASE,
    shots: SHOTS,
    check: reporter.check,
    sleep,
    consoleErrors,
    pageErrors,
  }

  const suites = selectedSuites()
  console.log(`running ${suites.length} suite(s) against ${BASE}\n`)

  try {
    for (const suite of suites) {
      console.log(`— ${suite.name} —`)
      const mod = await suite.load()
      await page.setViewport(DESKTOP)
      await mod.run(ctx)
      console.log('')
    }

    /* nothing may have logged an error along the way */
    const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e))
    reporter.check('no uncaught page errors across the run', pageErrors.length === 0, pageErrors.join(' | '))
    reporter.check('no console errors across the run', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
  } finally {
    await browser.close()
    stop()
  }

  const failed = reporter.results.filter((r) => !r.ok)
  console.log(`\n${reporter.results.length - failed.length}/${reporter.results.length} checks passed`)
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
