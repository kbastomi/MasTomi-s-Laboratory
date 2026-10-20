import { CHAPTERS, chapterById } from './catalog'
import { L, getLang, num, onLangChange, setLang, t } from './core/i18n'
import type { LabDef } from './catalog/types'
import { store } from './core/store'

/** Chapter index — the first thing a student sees. */
export function renderHome(host: HTMLElement, onOpenChapter: (id: string) => void): void {
  host.innerHTML = ''

  const hero = document.createElement('section')
  hero.className = 'view hero'
  hero.innerHTML = `
    <p class="eyebrow">${t(L('Laboratorium fisika virtual', 'A virtual physics laboratory'))}</p>
    <h1>MasTomi's <span>Laboratory</span></h1>
    <p class="lede">${t(
      L(
        'Sepuluh ruang, tiap ruang satu bab ilmu fisika. Semua simulasi bisa kamu sentuh, ubah, dan coba sampai paham.',
        'Ten rooms, each one a chapter of physics. Every simulation can be touched, changed, and played with until it makes sense.',
      ),
    )}</p>
    <div class="hero-stats">
      <span><b>${CHAPTERS.length}</b> ${t(L('ruang', 'rooms'))}</span>
      <span><b>${CHAPTERS.reduce((n, c) => n + c.labs.length, 0)}</b> ${t(L('simulasi siap', 'simulations ready'))}</span>
      <span><b>${CHAPTERS.reduce((n, c) => n + c.planned.length, 0)}</b> ${t(L('direncanakan', 'planned'))}</span>
    </div>
  `
  host.appendChild(hero)

  const grid = document.createElement('section')
  grid.className = 'view chapter-grid'

  for (const chapter of CHAPTERS) {
    const done = store.doneIn(chapter.id)
    const card = document.createElement('article')
    card.className = 'chapter-card'
    card.style.setProperty('--accent', chapter.accent)
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    card.innerHTML = `
      <div class="ch-icon">${chapter.icon}</div>
      <h2>${t(chapter.title)}</h2>
      <p>${t(chapter.blurb)}</p>
      <div class="ch-meta">
        <span class="tag ${chapter.labs.length ? 'tag-ok' : ''}">${chapter.labs.length} ${t(L('simulasi', 'simulations'))}</span>
        ${chapter.planned.length ? `<span class="tag tag-soon">${chapter.planned.length} ${t(L('segera', 'soon'))}</span>` : ''}
        ${done ? `<span class="tag tag-done">✓ ${done} ${t(L('selesai', 'done'))}</span>` : ''}
      </div>
    `
    const open = (): void => onOpenChapter(chapter.id)
    card.addEventListener('click', open)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
    })
    grid.appendChild(card)
  }

  host.appendChild(grid)
}

/** One chapter: its objectives and its labs. */
export function renderRoom(
  host: HTMLElement,
  chapterId: string,
  onOpenLab: (lab: LabDef) => void,
  onBack: () => void,
): void {
  host.innerHTML = ''
  const chapter = chapterById(chapterId)
  if (!chapter) {
    host.innerHTML = `<section class="view"><h1 class="view-404">404</h1></section>`
    return
  }

  const done = store.doneIn(chapter.id)

  const head = document.createElement('section')
  head.className = 'view room-head'
  head.style.setProperty('--accent', chapter.accent)
  head.innerHTML = `
    <button class="back-link" type="button">← ${t(L('Semua ruang', 'All rooms'))}</button>
    <div class="room-title">
      <div class="ch-icon">${chapter.icon}</div>
      <div>
        <h1>${t(chapter.title)}</h1>
        <p class="lede">${t(chapter.blurb)}</p>
      </div>
    </div>
    <div class="objectives">
      <h3>${t(L('Tujuan pembelajaran', 'Learning goals'))}</h3>
      <ul>${chapter.objectives.map((o) => `<li>${t(o)}</li>`).join('')}</ul>
    </div>
    ${done ? `<p class="room-progress">✓ ${done} ${t(L('simulasi selesai', 'simulations completed'))}</p>` : ''}
  `
  head.querySelector('.back-link')?.addEventListener('click', onBack)
  host.appendChild(head)

  const grid = document.createElement('section')
  grid.className = 'view lab-grid'

  for (const lab of chapter.labs) {
    const card = document.createElement('article')
    card.className = 'lab-card'
    card.style.setProperty('--accent', chapter.accent)
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    const finished = store.isDone(lab.id)
    card.innerHTML = `
      <div class="lab-head">
        <h2>${t(lab.title)}${finished ? ' <span class="tick">✓</span>' : ''}</h2>
        <span class="level" title="${t(L('Tingkat kesukaran', 'Difficulty'))}">${'●'.repeat(lab.level)}${'○'.repeat(5 - lab.level)}</span>
      </div>
      <p>${t(lab.blurb)}</p>
      <div class="ch-meta">
        ${lab.tags.map((tag) => `<span class="tag">${t(tag)}</span>`).join('')}
        <span class="tag">${lab.estMinutes} ${t(L('menit', 'min'))}</span>
      </div>
      <div class="go">${t(L('Buka simulasi →', 'Open the simulation →'))}</div>
    `
    const open = (): void => onOpenLab(lab)
    card.addEventListener('click', open)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() }
    })
    grid.appendChild(card)
  }

  for (const planned of chapter.planned) {
    const card = document.createElement('article')
    card.className = 'lab-card is-locked'
    card.style.setProperty('--accent', chapter.accent)
    card.innerHTML = `
      <div class="lab-head">
        <h2>${t(planned.title)}</h2>
        <span class="lock">🔒</span>
      </div>
      <p>${t(planned.blurb)}</p>
      <div class="ch-meta"><span class="tag tag-soon">${t(L('sedang dibangun', 'under construction'))}</span></div>
    `
    grid.appendChild(card)
  }

  host.appendChild(grid)
}

/** Small helper for the language toggle in the top bar. */
export function makeLangToggle(onChange: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.className = 'btn chip ghost lang-toggle'
  btn.type = 'button'
  btn.title = 'Bahasa / Language'
  const paint = (): void => {
    btn.innerHTML = getLang() === 'id' ? '<b>ID</b> · EN' : 'ID · <b>EN</b>'
  }
  paint()
  onLangChange(paint)
  btn.addEventListener('click', () => {
    setLang(getLang() === 'id' ? 'en' : 'id')
    onChange()
  })
  return btn
}

/** Re-render the current language-dependent chrome. */
export function refreshLangAware(root: HTMLElement, render: () => void): void {
  void root
  render()
}

export { num }
