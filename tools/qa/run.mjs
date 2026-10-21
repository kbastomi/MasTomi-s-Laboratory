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
import { createReporter, describeRenderer, DESKTOP, launchBrowser, openPage, sleep } from './lib/harness.mjs'

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
  const reporter = createReporter()
  const suites = selectedSuites()

  const workers = []
  workers.push(await openPage(browser, DESKTOP))

  const renderer = await describeRenderer(workers[0].page)
  console.log(`WebGL: ${renderer.webgl2 ? 'WebGL 2' : 'WebGL 1 only'}  ${renderer.renderer.slice(0, 90)}`)

  /**
   * How many suites run at once.
   *
   * With hardware rendering two suites are cheap and halve the wall clock.
   * With software rendering they are not: two WebGL pages on a small machine
   * starve each other and the run gets *slower*, not faster — so the default
   * follows the renderer. QA_CONCURRENCY overrides it either way.
   */
  const defaultConcurrency = renderer.software ? 1 : 2
  const CONCURRENCY = Math.max(
    1,
    Math.min(Number(process.env.QA_CONCURRENCY ?? defaultConcurrency), suites.length),
  )
  for (let i = 1; i < CONCURRENCY; i++) {
    workers.push(await openPage(browser, DESKTOP))
  }

  const ctx = {
    base: BASE,
    shots: SHOTS,
    check: reporter.check,
    sleep,
  }

  console.log(`running ${suites.length} suite(s) against ${BASE}, ${CONCURRENCY} at a time\n`)

  if (renderer.software) {
    console.log('  software rendering — a simulation advances slower than the wall clock, so')
    console.log('  the checks wait for results rather than for time.  QA_GL=swiftshader forces it.\n')
  } else {
    console.log('  hardware accelerated\n')
  }

  let next = 0
  async function worker(w) {
    for (;;) {
      const index = next++
      if (index >= suites.length) return
      const suite = suites[index]
      reporter.setSuite(suite.name)
      console.log(`— ${suite.name} —`)
      try {
        const mod = await suite.load()
        await w.page.setViewport(DESKTOP)
        await mod.run({ ...ctx, page: w.page, consoleErrors: w.consoleErrors, pageErrors: w.pageErrors })
      } catch (err) {
        /* one suite falling over must not take the whole run with it */
        reporter.check(`${suite.name}: suite ran to the end`, false, String(err).slice(0, 140))
      }
      console.log('')
    }
  }

  try {
    await Promise.all(workers.map(worker))

    /* nothing may have logged an error along the way */
    const consoleErrors = workers.flatMap((w) => w.consoleErrors)
    const pageErrors = workers.flatMap((w) => w.pageErrors)
    const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e))
    reporter.setSuite('')
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
