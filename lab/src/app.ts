import * as THREE from 'three'
import { CHAPTERS, chapterById, labById } from './catalog'
import { api } from './core/api'
import { Engine } from './core/engine'
import { onLangChange, t } from './core/i18n'
import type { CameraSpec, LabInstance } from './core/lab'
import type { LabDef } from './catalog/types'
import { L } from './core/i18n'
import { Router, type Route } from './core/router'
import { buildShowcase } from './core/showcase'
import { store } from './core/store'
import { PanelBuilder } from './kit/panel'
import { makeLangToggle, renderHome, renderRoom } from './views'

/**
 * The application shell.
 *
 * It owns the canvas, the side panel, the top bar and the router, and it
 * drives the life cycle of a lab: load → build panel → restore progress →
 * run → save progress → dispose.
 */
export class App {
  private root: HTMLElement
  private engine!: Engine
  private router = new Router()

  private canvasHost!: HTMLElement
  private overlay!: HTMLElement
  private panelEl!: HTMLElement
  private crumb!: HTMLElement
  private fpsChip!: HTMLElement
  private hint!: HTMLElement
  private loader!: HTMLElement

  private showcase: THREE.Group | null = null
  private lab: LabInstance | null = null
  private labDef: LabDef | null = null
  private panelBuilder: PanelBuilder | null = null
  private route: Route = { name: 'home' }
  private labToken = 0
  private lastSaved = ''

  constructor(root: HTMLElement) {
    this.root = root
  }

  /* --------------------------------------------------------------- boot */
  async boot(): Promise<void> {
    this.buildShell()

    this.engine = new Engine(this.canvasHost)
    const qualitySel = this.root.querySelector('.quality') as HTMLSelectElement | null
    if (qualitySel) qualitySel.value = this.engine.qualityMode
    this.engine.onStats((s) => {
      const label = s.idle
        ? 'idle'
        : s.fps
          ? `${s.fps} fps`
          : '— fps'
      const level = s.mode === 'auto' ? `auto → ${s.level}` : s.level
      this.fpsChip.textContent = `${label} · ${level}`
      this.fpsChip.title = s.software
        ? 'Software rendering detected (SwiftShader) — quality is limited to "low".\nTurn on hardware acceleration in your browser settings for full speed.'
        : 'The scene only redraws when something changes, so an idle lab costs ~0% CPU.'
    })

    this.router.onChange((route) => this.handleRoute(route))
    window.addEventListener('hashchange', () => { /* the router already listens */ })
    window.addEventListener('resize', () => this.syncPanelOffset())
    window.addEventListener('keydown', (e) => this.onKey(e))
    onLangChange(() => this.onLanguageChange())

    /* the backend is optional — probe once and carry on either way */
    void api.probe().then((ok) => {
      if (ok) {
        this.crumb.classList.add('has-backend')
        api.track('app_open')
      }
    })

    this.loop()
  }

  /* -------------------------------------------------------------- shell */
  private buildShell(): void {
    this.root.innerHTML = ''

    this.canvasHost = document.createElement('div')
    this.canvasHost.className = 'canvas-host'
    this.canvasHost.id = 'canvas-host'
    this.root.appendChild(this.canvasHost)

    this.overlay = document.createElement('div')
    this.overlay.className = 'overlay'
    this.overlay.id = 'overlay'
    this.root.appendChild(this.overlay)

    this.panelEl = document.createElement('aside')
    this.panelEl.className = 'panel glass hidden'
    this.panelEl.id = 'panel'
    this.root.appendChild(this.panelEl)

    this.hint = document.createElement('div')
    this.hint.className = 'hint glass hidden'
    this.hint.id = 'hint'
    this.root.appendChild(this.hint)

    this.loader = document.createElement('div')
    this.loader.className = 'loader hidden'
    this.loader.id = 'loader'
    this.loader.textContent = '…'
    this.root.appendChild(this.loader)

    const bar = document.createElement('header')
    bar.className = 'topbar'
    bar.id = 'topbar'
    bar.innerHTML = `
      <button class="btn chip ghost back" type="button" title="${t(L('Kembali', 'Back'))}">←</button>
      <div class="crumb chip glass"><span class="crumb-main"></span></div>
      <div class="spacer"></div>
      <span class="chip glass fps" title="frames per second">— fps</span>
      <select class="chip glass quality" title="${t(L('Kualitas render', 'Render quality'))}">
        <option value="auto">${t(L('Kualitas: otomatis', 'Quality: auto'))}</option>
        <option value="high">${t(L('Tinggi', 'High'))}</option>
        <option value="medium">${t(L('Sedang', 'Medium'))}</option>
        <option value="low">${t(L('Rendah', 'Low'))}</option>
      </select>
      <button class="btn chip ghost panel-toggle" type="button" title="${t(L('Panel', 'Panel'))}">◧</button>
    `
    this.root.appendChild(bar)

    this.crumb = bar.querySelector('.crumb')!
    this.fpsChip = bar.querySelector('.fps')!

    const back = bar.querySelector('.back') as HTMLButtonElement
    back.addEventListener('click', () => {
      if (this.labDef) this.router.go({ name: 'room', chapterId: this.labDef.room })
      else this.router.go({ name: 'home' })
    })
    this.crumb.addEventListener('click', () => this.router.go({ name: 'home' }))
    this.crumb.classList.add('clickable')

    const quality = bar.querySelector('.quality') as HTMLSelectElement
    quality.addEventListener('change', () => this.engine.setQuality(quality.value as never))

    const panelToggle = bar.querySelector('.panel-toggle') as HTMLButtonElement
    panelToggle.addEventListener('click', () => this.togglePanel())

    const langBtn = makeLangToggle(() => this.onLanguageChange())
    bar.appendChild(langBtn)

    this.setHint([
      `<b>${t(L('Seret', 'Drag'))}</b> ${t(L('benda di dalam adegan', 'objects in the scene'))}`,
      `<b>${t(L('Seret ruang kosong', 'Drag empty space'))}</b> ${t(L('untuk memutar kamera', 'to orbit'))} · <b>${t(L('Pencit', 'Pinch'))}</b> ${t(L('untuk zoom', 'to zoom'))}`,
    ])
  }

  private togglePanel(): void {
    this.panelEl.classList.toggle('hidden')
    this.root.classList.toggle('panel-open', !this.panelEl.classList.contains('hidden'))
    this.syncPanelOffset()
    this.engine.invalidate()
  }

  /**
   * Tell the engine how much of the canvas the panel is hiding, so the scene
   * can be nudged into the middle of what the student can actually see.
   */
  private syncPanelOffset(): void {
    if (!this.engine) return
    const wide = window.innerWidth > 820
    const visible = wide && !this.panelEl.classList.contains('hidden')
    const width = visible ? this.panelEl.getBoundingClientRect().width : 0
    this.engine.setPanelOffset(width / 2)
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null
    if (target && /input|textarea|select/i.test(target.tagName)) return
    if (e.key === 'h' || e.key === 'H') this.togglePanel()
    if (e.key === 'Escape' && this.labDef) {
      this.router.go({ name: 'room', chapterId: this.labDef.room })
    }
  }

  /* ------------------------------------------------------------- routing */
  private async handleRoute(route: Route): Promise<void> {
    this.route = route
    const token = ++this.labToken

    if (route.name === 'home') {
      this.closeLab()
      this.overlay.classList.remove('hidden')
      this.overlay.innerHTML = ''
      this.setCrumb('MasTomi’s Laboratory', '')
      renderHome(this.overlay, (id) => this.router.go({ name: 'room', chapterId: id }))
      this.showShowcase()
      this.hint.classList.add('hidden')
      api.track('chapter_index')
      return
    }

    if (route.name === 'room') {
      this.closeLab()
      const chapter = chapterById(route.chapterId)
      this.overlay.classList.remove('hidden')
      this.overlay.innerHTML = ''
      this.setCrumb(t(chapter?.title ?? { id: '?', en: '?' }), chapter ? chapter.icon : '')
      renderRoom(
        this.overlay,
        route.chapterId,
        (lab) => this.router.go({ name: 'lab', chapterId: lab.room, labId: lab.id }),
        () => this.router.go({ name: 'home' }),
      )
      this.showShowcase()
      this.hint.classList.add('hidden')
      api.track('chapter_open', undefined, route.chapterId)
      return
    }

    if (route.name === 'lab') {
      const def = labById(route.labId)
      if (!def) {
        this.router.go({ name: 'home' })
        return
      }
      await this.openLab(def, token)
      return
    }

    this.router.go({ name: 'home' })
  }

  private setCrumb(main: string, icon: string): void {
    const el = this.crumb.querySelector('.crumb-main') as HTMLElement
    el.innerHTML = icon ? `${icon} ${main}` : main
  }

  /* ----------------------------------------------------------- showcase */
  private showShowcase(): void {
    if (!this.showcase) {
      this.showcase = buildShowcase()
      this.engine.scene.add(this.showcase)
    }
    this.showcase.visible = true
    this.engine.orbit.frame([0, 2.4, 0], 12, 0.5, 1.2)
    this.engine.orbit.azim = 0.5
    this.engine.invalidate()
  }

  private hideShowcase(): void {
    if (this.showcase) this.showcase.visible = false
  }

  /* ---------------------------------------------------------------- lab */
  private async openLab(def: LabDef, token: number): Promise<void> {
    this.closeLab()
    this.overlay.classList.add('hidden')
    this.loader.classList.remove('hidden')
    this.setCrumb(t(def.title), CHAPTERS.find((c) => c.id === def.room)?.icon ?? '')

    let mod: { default: (ctx: never) => LabInstance }
    try {
      mod = (await def.load()) as never
    } catch (err) {
      this.loader.classList.add('hidden')
      console.error('[lab] failed to load', def.id, err)
      this.overlay.classList.remove('hidden')
      this.overlay.innerHTML = `<section class="view"><h1>…</h1><p>${t(L('Simulasi gagal dimuat.', 'The simulation could not be loaded.'))}</p></section>`
      return
    }
    if (token !== this.labToken) return

    this.hideShowcase()
    this.labDef = def

    this.panelEl.innerHTML = ''
    this.panelEl.classList.remove('hidden')
    this.root.classList.add('panel-open')
    this.panelBuilder = new PanelBuilder(this.panelEl)

    /* The catalogue's framing is the default… */
    if (def.camera) {
      this.engine.orbit.frame(def.camera.target, def.camera.radius, def.camera.azim, def.camera.polar)
    }

    const factory = mod.default as unknown as (ctx: never) => LabInstance
    const instance = factory({
      invalidate: () => this.engine.invalidate(),
      root: new THREE.Group(),
      panel: this.panelBuilder,
      camera: this.engine.camera,
      dom: this.engine.dom,
      setCamera: (spec: CameraSpec) => {
        this.engine.orbit.frame(spec.target, spec.radius, spec.azim, spec.polar)
        this.engine.invalidate()
      },
    } as never)

    this.lab = instance
    this.engine.mountLab(instance, def.rendering?.shadows !== false)
    instance.buildPanel(this.panelBuilder)
    /* …but a lab may re-frame the camera, because it knows its own geometry
       better than a catalogue entry can. */

    /* restore any saved progress */
    const saved = store.get(def.id)
    if (saved?.state) instance.restore(saved.state)
    this.lastSaved = JSON.stringify(saved?.state ?? null)

    this.loader.classList.add('hidden')
    this.hint.classList.remove('hidden')
    this.syncPanelOffset()
    api.track('lab_open', def.id, def.room)
    this.engine.invalidate()
  }

  private closeLab(): void {
    if (this.lab) {
      this.saveProgress(true)
      this.engine.unmountLab()
      this.lab = null
    }
    this.labDef = null
    this.panelBuilder = null
    this.panelEl.classList.add('hidden')
    this.root.classList.remove('panel-open')
  }

  /* ---------------------------------------------------------- progress */
  private saveProgress(force = false): void {
    if (!this.lab || !this.labDef) return
    const state = this.lab.serialize()
    const serialised = JSON.stringify(state ?? null)
    if (!force && serialised === this.lastSaved) return
    this.lastSaved = serialised
    store.set(this.labDef.id, state)
    void api.putProgress(this.labDef.id, state)
  }

  private onLanguageChange(): void {
    this.updateChrome()

    if (this.lab && this.labDef) {
      /* rebuild the panel in place and put the lab's state back */
      const state = this.lab.serialize()
      this.panelEl.innerHTML = ''
      this.panelBuilder = new PanelBuilder(this.panelEl)
      this.lab.buildPanel(this.panelBuilder)
      this.lab.restore(state)
      this.setCrumb(t(this.labDef.title), CHAPTERS.find((c) => c.id === this.labDef?.room)?.icon ?? '')
      this.engine.invalidate()
      return
    }

    this.handleRoute(this.route)
  }

  /** Re-translate the bits of chrome that are built once at boot. */
  private updateChrome(): void {
    const quality = this.root.querySelector('.quality') as HTMLSelectElement | null
    if (quality) {
      const labels: Record<string, string> = {
        auto: t(L('Kualitas: otomatis', 'Quality: auto')),
        high: t(L('Tinggi', 'High')),
        medium: t(L('Sedang', 'Medium')),
        low: t(L('Rendah', 'Low')),
      }
      for (const option of Array.from(quality.options)) {
        option.textContent = labels[option.value] ?? option.textContent
      }
    }
    const panelToggle = this.root.querySelector('.panel-toggle') as HTMLButtonElement | null
    if (panelToggle) panelToggle.title = t(L('Panel', 'Panel'))
    const back = this.root.querySelector('.back') as HTMLButtonElement | null
    if (back) back.title = t(L('Kembali', 'Back'))

    this.setHint([
      `<b>${t(L('Seret', 'Drag'))}</b> ${t(L('benda di dalam adegan', 'objects in the scene'))}`,
      `<b>${t(L('Seret ruang kosong', 'Drag empty space'))}</b> ${t(L('untuk memutar kamera', 'to orbit'))} · <b>${t(L('Pencit', 'Pinch'))}</b> ${t(L('untuk zoom', 'to zoom'))}`,
    ])
  }

  /**
   * A window onto the running application — used by the QA harness and handy
   * for tinkering from the browser console.
   */
  get debug() {
    return {
      engine: this.engine,
      lab: this.lab,
      route: this.route,
    }
  }

  /* ------------------------------------------------------------- loop */
  private loop(): void {    setInterval(() => {
      if (!this.lab) return
      this.saveProgress()
      /* a lab that has been solved is marked as done */
      if (this.labDef && !store.isDone(this.labDef.id)) {
        const goal = this.panelEl.querySelector('.goal.done')
        if (goal) {
          store.markDone(this.labDef.id, true)
          void api.putProgress(this.labDef.id, this.lab?.serialize() ?? null)
          api.track('lab_complete', this.labDef.id, this.labDef.room)
        }
      }
    }, 2000)
  }

  private setHint(parts: string[]): void {
    this.hint.innerHTML = parts.map((p) => `<span>${p}</span>`).join('')
  }
}
