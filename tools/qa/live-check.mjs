import puppeteer from 'puppeteer-core'

const BASE = 'https://mastomi.my.id'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(name, ok, extra) {
  results.push(!!ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `   [${extra}]` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const errors = []
const page = await browser.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.setViewport({ width: 1440, height: 900 })

// landing page
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
check('live landing: hero renders', await page.$eval('.hero h1', (n) => n.textContent.includes('Laboratory')))
check('live landing: 10 chapter cards', (await page.$$('.card')).length === 10)
check('live landing: language toggle', await page.evaluate(() => {
  const b = document.querySelector('.lang'); b.click();
  return new Promise((r) => setTimeout(() => r(document.querySelector('.card h3').textContent), 250));
}).then((v) => v === 'Mekanika'))

// the laboratory
await page.goto(`${BASE}/lab/`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(3000)
check('live lab: canvas mounted', !!(await page.$('canvas.lab-canvas')))
check('live lab: WebGL alive', await page.evaluate(() => {
  const c = document.querySelector('canvas.lab-canvas')
  return !!(c && (c.getContext('webgl2') || c.getContext('webgl')))
}))
check('live lab: 10 rooms listed', (await page.$$('.chapter-card')).length === 10)

// open a simulation
await page.goto(`${BASE}/lab/#/lab/mechanics/lever`, { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(3500)
const info = await page.evaluate(() => ({
  sections: document.querySelectorAll('#panel .panel-section').length,
  readouts: document.querySelectorAll('#panel .readout').length,
  ma: document.querySelector('.ma-badge .num')?.textContent ?? null,
  overlayHidden: document.querySelector('#overlay')?.classList.contains('hidden') ?? false,
}))
check('live lab: simulation opens', info.overlayHidden)
check('live lab: panel populated', info.sections >= 3 && info.readouts >= 5, `${info.sections} sections / ${info.readouts} readouts`)
// the value is locale-formatted: "2.00" in English, "2,00" in Indonesian
check('live lab: mechanical advantage computed', /^2[.,]00$/.test(info.ma ?? ''), info.ma)

await page.screenshot({ path: 'tools/qa/shots/05-live-lever.png' })
check('live lab: no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))

await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} live checks passed`)
process.exit(failed ? 1 : 0)
